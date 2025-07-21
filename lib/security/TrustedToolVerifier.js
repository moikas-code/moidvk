/**
 * Trusted Tool Verifier with Cryptographic Verification
 * Provides secure verification of trusted tools using digital signatures and checksums
 */

import { createHash, createHmac, randomBytes } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { resolve, basename } from 'path';

export class TrustedToolVerifier {
  constructor(options = {}) {
    this.options = {
      enableCryptographicVerification: options.enableCryptographicVerification !== false,
      enableChecksumVerification: options.enableChecksumVerification !== false,
      enableSignatureVerification: options.enableSignatureVerification !== false,
      trustedToolsPath: options.trustedToolsPath || './trusted-tools.json',
      secretKey: options.secretKey || this.generateSecretKey(),
      checksumAlgorithm: options.checksumAlgorithm || 'sha256',
      signatureAlgorithm: options.signatureAlgorithm || 'sha256',
      allowSelfSigned: options.allowSelfSigned !== false,
      verificationTimeout: options.verificationTimeout || 5000,
      cacheTtlMs: options.cacheTtlMs || 300000, // 5 minutes
      ...options
    };

    // Verification cache
    this.verificationCache = new Map();
    
    // Tool registry
    this.trustedTools = new Map();
    
    // Verification metrics
    this.verificationMetrics = {
      totalVerifications: 0,
      successfulVerifications: 0,
      failedVerifications: 0,
      cacheHits: 0,
      cacheMisses: 0,
      verificationTypes: {
        checksum: 0,
        signature: 0,
        hybrid: 0
      }
    };

    // Initialize trusted tools registry
    this.initializeTrustedTools();
    
    // Start cache cleanup
    this.startCacheCleanup();
  }

  /**
   * Initialize trusted tools registry with known good tools
   */
  async initializeTrustedTools() {
    // Built-in trusted tools with their known checksums
    const builtInTools = {
      // Core system tools
      'echo': {
        type: 'system',
        paths: ['/bin/echo', '/usr/bin/echo'],
        checksum: null, // Will be computed on first use
        signature: null,
        permissions: ['read'],
        description: 'Echo command - safe output tool'
      },
      'ls': {
        type: 'system', 
        paths: ['/bin/ls', '/usr/bin/ls'],
        checksum: null,
        signature: null,
        permissions: ['read'],
        description: 'List directory contents'
      },
      'cat': {
        type: 'system',
        paths: ['/bin/cat', '/usr/bin/cat'],
        checksum: null,
        signature: null,
        permissions: ['read'],
        description: 'Display file contents'
      },
      'grep': {
        type: 'system',
        paths: ['/bin/grep', '/usr/bin/grep'],
        checksum: null,
        signature: null,
        permissions: ['read'],
        description: 'Search text patterns'
      },
      'find': {
        type: 'system',
        paths: ['/usr/bin/find'],
        checksum: null,
        signature: null,
        permissions: ['read'],
        description: 'Find files and directories'
      },
      
      // Development tools
      'node': {
        type: 'development',
        paths: ['/usr/local/bin/node', '/usr/bin/node'],
        checksum: null,
        signature: null,
        permissions: ['execute'],
        description: 'Node.js runtime'
      },
      'bun': {
        type: 'development',
        paths: ['/usr/local/bin/bun', '/opt/homebrew/bin/bun'],
        checksum: null,
        signature: null,
        permissions: ['execute'],
        description: 'Bun runtime'
      },
      'git': {
        type: 'development',
        paths: ['/usr/bin/git', '/usr/local/bin/git'],
        checksum: null,
        signature: null,
        permissions: ['read', 'write'],
        description: 'Git version control'
      },
      
      // Package managers
      'npm': {
        type: 'package-manager',
        paths: ['/usr/local/bin/npm'],
        checksum: null,
        signature: null,
        permissions: ['execute', 'network'],
        description: 'Node package manager',
        requiresConsent: true
      },
      'yarn': {
        type: 'package-manager',
        paths: ['/usr/local/bin/yarn'],
        checksum: null,
        signature: null,
        permissions: ['execute', 'network'],
        description: 'Yarn package manager',
        requiresConsent: true
      }
    };

    // Register built-in tools
    for (const [name, config] of Object.entries(builtInTools)) {
      this.trustedTools.set(name, {
        ...config,
        registeredAt: Date.now(),
        verifiedAt: null,
        verificationStatus: 'pending'
      });
    }

    // Try to load external trusted tools configuration
    try {
      await this.loadExternalTrustedTools();
    } catch (error) {
      // External config is optional
    }
  }

  /**
   * Load external trusted tools configuration
   */
  async loadExternalTrustedTools() {
    try {
      const configData = await readFile(this.options.trustedToolsPath, 'utf8');
      const externalTools = JSON.parse(configData);
      
      for (const [name, config] of Object.entries(externalTools)) {
        this.trustedTools.set(name, {
          ...config,
          registeredAt: Date.now(),
          verifiedAt: null,
          verificationStatus: 'pending',
          source: 'external'
        });
      }
    } catch (error) {
      // File doesn't exist or invalid JSON - that's okay
    }
  }

  /**
   * Verify if a tool is trusted
   */
  async verifyTool(toolPath, options = {}) {
    const startTime = Date.now();
    this.verificationMetrics.totalVerifications++;
    
    try {
      // Check cache first
      const cacheKey = this.getCacheKey(toolPath, options);
      const cachedResult = this.getFromCache(cacheKey);
      if (cachedResult) {
        this.verificationMetrics.cacheHits++;
        return cachedResult;
      }
      this.verificationMetrics.cacheMisses++;

      // Resolve tool path
      const resolvedPath = resolve(toolPath);
      const toolName = basename(resolvedPath);

      // Check if tool is in trusted registry
      const trustedConfig = this.trustedTools.get(toolName);
      if (!trustedConfig) {
        return this.createVerificationResult(false, 'Tool not in trusted registry', {
          toolPath: resolvedPath,
          toolName,
          reason: 'UNREGISTERED_TOOL'
        });
      }

      // Verify tool exists and get stats
      let fileStats;
      try {
        fileStats = await stat(resolvedPath);
      } catch (error) {
        return this.createVerificationResult(false, 'Tool file not found', {
          toolPath: resolvedPath,
          toolName,
          reason: 'FILE_NOT_FOUND',
          error: error.message
        });
      }

      // Check if tool path matches registered paths
      const pathMatch = trustedConfig.paths.some(registeredPath => 
        resolve(registeredPath) === resolvedPath
      );
      
      if (!pathMatch && !this.options.allowSelfSigned) {
        return this.createVerificationResult(false, 'Tool path not in trusted paths', {
          toolPath: resolvedPath,
          toolName,
          reason: 'UNTRUSTED_PATH',
          expectedPaths: trustedConfig.paths
        });
      }

      // Perform cryptographic verification if enabled
      let verificationResult = { verified: true, methods: [] };
      
      if (this.options.enableChecksumVerification) {
        const checksumResult = await this.verifyChecksum(resolvedPath, trustedConfig);
        verificationResult.checksum = checksumResult;
        if (!checksumResult.valid) {
          verificationResult.verified = false;
        }
        this.verificationMetrics.verificationTypes.checksum++;
      }

      if (this.options.enableSignatureVerification && trustedConfig.signature) {
        const signatureResult = await this.verifySignature(resolvedPath, trustedConfig);
        verificationResult.signature = signatureResult;
        if (!signatureResult.valid) {
          verificationResult.verified = false;
        }
        this.verificationMetrics.verificationTypes.signature++;
      }

      // Create final result
      const result = this.createVerificationResult(
        verificationResult.verified,
        verificationResult.verified ? 'Tool verification successful' : 'Tool verification failed',
        {
          toolPath: resolvedPath,
          toolName,
          trustedConfig,
          verification: verificationResult,
          fileStats: {
            size: fileStats.size,
            modified: fileStats.mtime,
            permissions: fileStats.mode
          },
          verificationTime: Date.now() - startTime
        }
      );

      // Update tool verification status
      if (verificationResult.verified) {
        trustedConfig.verifiedAt = Date.now();
        trustedConfig.verificationStatus = 'verified';
        this.verificationMetrics.successfulVerifications++;
      } else {
        trustedConfig.verificationStatus = 'failed';
        this.verificationMetrics.failedVerifications++;
      }

      // Cache result
      this.addToCache(cacheKey, result);

      return result;

    } catch (error) {
      this.verificationMetrics.failedVerifications++;
      return this.createVerificationResult(false, 'Verification error', {
        toolPath,
        reason: 'VERIFICATION_ERROR',
        error: error.message,
        verificationTime: Date.now() - startTime
      });
    }
  }

  /**
   * Verify tool checksum
   */
  async verifyChecksum(toolPath, trustedConfig) {
    try {
      // Compute current checksum
      const fileContent = await readFile(toolPath);
      const currentChecksum = createHash(this.options.checksumAlgorithm)
        .update(fileContent)
        .digest('hex');

      // If no stored checksum, store current one (first-run learning)
      if (!trustedConfig.checksum) {
        trustedConfig.checksum = currentChecksum;
        trustedConfig.checksumAlgorithm = this.options.checksumAlgorithm;
        trustedConfig.checksumGenerated = Date.now();
        
        return {
          valid: true,
          method: 'checksum',
          algorithm: this.options.checksumAlgorithm,
          checksum: currentChecksum,
          status: 'learned'
        };
      }

      // Compare checksums
      const isValid = currentChecksum === trustedConfig.checksum;
      
      return {
        valid: isValid,
        method: 'checksum',
        algorithm: this.options.checksumAlgorithm,
        expectedChecksum: trustedConfig.checksum,
        actualChecksum: currentChecksum,
        status: isValid ? 'verified' : 'mismatch'
      };

    } catch (error) {
      return {
        valid: false,
        method: 'checksum',
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * Verify tool signature (HMAC-based)
   */
  async verifySignature(toolPath, trustedConfig) {
    try {
      // Read file content
      const fileContent = await readFile(toolPath);
      
      // Create HMAC signature
      const hmac = createHmac(this.options.signatureAlgorithm, this.options.secretKey);
      hmac.update(fileContent);
      const currentSignature = hmac.digest('hex');

      // If no stored signature, store current one
      if (!trustedConfig.signature) {
        trustedConfig.signature = currentSignature;
        trustedConfig.signatureAlgorithm = this.options.signatureAlgorithm;
        trustedConfig.signatureGenerated = Date.now();
        
        return {
          valid: true,
          method: 'signature',
          algorithm: this.options.signatureAlgorithm,
          signature: currentSignature,
          status: 'learned'
        };
      }

      // Compare signatures
      const isValid = currentSignature === trustedConfig.signature;
      
      return {
        valid: isValid,
        method: 'signature',
        algorithm: this.options.signatureAlgorithm,
        expectedSignature: trustedConfig.signature,
        actualSignature: currentSignature,
        status: isValid ? 'verified' : 'mismatch'
      };

    } catch (error) {
      return {
        valid: false,
        method: 'signature',
        error: error.message,
        status: 'error'
      };
    }
  }

  /**
   * Create verification result
   */
  createVerificationResult(trusted, message, metadata = {}) {
    return {
      trusted,
      message,
      timestamp: Date.now(),
      verifier: 'TrustedToolVerifier',
      metadata
    };
  }

  /**
   * Generate cache key
   */
  getCacheKey(toolPath, options) {
    const keyData = {
      toolPath: resolve(toolPath),
      options: JSON.stringify(options),
      enableChecksum: this.options.enableChecksumVerification,
      enableSignature: this.options.enableSignatureVerification
    };
    return createHash('sha256').update(JSON.stringify(keyData)).digest('hex');
  }

  /**
   * Get from cache
   */
  getFromCache(cacheKey) {
    const cached = this.verificationCache.get(cacheKey);
    if (!cached) return null;
    
    // Check TTL
    if (Date.now() - cached.timestamp > this.options.cacheTtlMs) {
      this.verificationCache.delete(cacheKey);
      return null;
    }
    
    return cached.result;
  }

  /**
   * Add to cache
   */
  addToCache(cacheKey, result) {
    this.verificationCache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });
  }

  /**
   * Generate secret key
   */
  generateSecretKey() {
    return randomBytes(32).toString('hex');
  }

  /**
   * Get trusted tools list
   */
  getTrustedTools() {
    const tools = {};
    for (const [name, config] of this.trustedTools.entries()) {
      tools[name] = {
        type: config.type,
        description: config.description,
        permissions: config.permissions,
        verificationStatus: config.verificationStatus,
        verifiedAt: config.verifiedAt,
        requiresConsent: config.requiresConsent || false
      };
    }
    return tools;
  }

  /**
   * Add trusted tool
   */
  addTrustedTool(name, config) {
    this.trustedTools.set(name, {
      ...config,
      registeredAt: Date.now(),
      verifiedAt: null,
      verificationStatus: 'pending',
      source: 'manual'
    });
  }

  /**
   * Remove trusted tool
   */
  removeTrustedTool(name) {
    return this.trustedTools.delete(name);
  }

  /**
   * Get verification metrics
   */
  getVerificationMetrics() {
    return {
      ...this.verificationMetrics,
      cacheSize: this.verificationCache.size,
      trustedToolsCount: this.trustedTools.size,
      verificationConfig: {
        enableCryptographicVerification: this.options.enableCryptographicVerification,
        enableChecksumVerification: this.options.enableChecksumVerification,
        enableSignatureVerification: this.options.enableSignatureVerification,
        checksumAlgorithm: this.options.checksumAlgorithm,
        signatureAlgorithm: this.options.signatureAlgorithm
      }
    };
  }

  /**
   * Start cache cleanup interval
   */
  startCacheCleanup() {
    this.cacheCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, cached] of this.verificationCache.entries()) {
        if (now - cached.timestamp > this.options.cacheTtlMs) {
          this.verificationCache.delete(key);
        }
      }
    }, this.options.cacheTtlMs);
  }

  /**
   * Destroy verifier and cleanup
   */
  destroy() {
    if (this.cacheCleanupInterval) {
      clearInterval(this.cacheCleanupInterval);
    }
    this.verificationCache.clear();
  }
}