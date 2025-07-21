import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { LIMITS, SHARING_LEVELS } from './constants.js';

/**
 * Patterns for detecting sensitive data
 */
const SENSITIVE_PATTERNS = [
  // API Keys
  /api[_-]?key\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /apikey\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  
  // Passwords
  /password\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /pass\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /pwd\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  
  // Secrets and Tokens
  /secret\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /token\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /auth[_-]?token\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /access[_-]?token\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /refresh[_-]?token\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  
  // Database credentials
  /db[_-]?pass(word)?\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /database[_-]?url\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /connection[_-]?string\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  
  // AWS/Cloud credentials
  /aws[_-]?access[_-]?key[_-]?id\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /aws[_-]?secret[_-]?access[_-]?key\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  /private[_-]?key\s*[:=]\s*['"`]([^'"`]+)['"`]/gi,
  
  // Generic credentials
  /credentials?\s*[:=]\s*\{[^}]+\}/gi,
  /bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi,
  
  // SSH Keys
  /-----BEGIN\s+(RSA|DSA|EC|OPENSSH)\s+PRIVATE\s+KEY-----/gi,
  
  // Environment variables that might contain secrets
  /process\.env\.[A-Z_]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS|PWD|AUTH|CREDENTIAL)/gi,
];

/**
 * Boundary types for snippet extraction
 */
// Using SHARING_LEVELS from constants.js
const BOUNDARY_TYPES = SHARING_LEVELS;

/**
 * Sanitizes code snippets by detecting and redacting sensitive data
 */
export class SnippetSanitizer {
  constructor(options = {}) {
    this.patterns = options.patterns || SENSITIVE_PATTERNS;
    this.redactText = options.redactText || '[REDACTED]';
    this.customPatterns = options.customPatterns || [];
  }

  /**
   * Sanitize a code snippet
   * @param {string} code - Code to sanitize
   * @returns {{sanitized: string, detectedSecrets: number, secretTypes: string[]}}
   */
  sanitize(code) {
    let sanitized = code;
    const detectedTypes = new Set();
    let detectedCount = 0;

    // Apply all patterns
    const allPatterns = [...this.patterns, ...this.customPatterns];
    
    for (const pattern of allPatterns) {
      const matches = sanitized.matchAll(new RegExp(pattern));
      
      for (const match of matches) {
        detectedCount++;
        
        // Determine secret type
        const patternStr = pattern.toString().toLowerCase();
        if (patternStr.includes('api')) detectedTypes.add('API Key');
        else if (patternStr.includes('password') || patternStr.includes('pass')) detectedTypes.add('Password');
        else if (patternStr.includes('token')) detectedTypes.add('Token');
        else if (patternStr.includes('secret')) detectedTypes.add('Secret');
        else if (patternStr.includes('aws')) detectedTypes.add('AWS Credential');
        else if (patternStr.includes('private') && patternStr.includes('key')) detectedTypes.add('Private Key');
        else if (patternStr.includes('database') || patternStr.includes('connection')) detectedTypes.add('Database Credential');
        else detectedTypes.add('Sensitive Data');
        
        // Replace the sensitive data
        sanitized = sanitized.replace(match[0], match[0].replace(match[1] || match[0], this.redactText));
      }
    }

    return {
      sanitized,
      detectedSecrets: detectedCount,
      secretTypes: Array.from(detectedTypes),
    };
  }

  /**
   * Check if code contains sensitive data without sanitizing
   * @param {string} code - Code to check
   * @returns {boolean}
   */
  containsSensitiveData(code) {
    const allPatterns = [...this.patterns, ...this.customPatterns];
    return allPatterns.some(pattern => new RegExp(pattern).test(code));
  }

  /**
   * Add custom pattern for sensitive data detection
   * @param {RegExp} pattern - Pattern to add
   */
  addCustomPattern(pattern) {
    this.customPatterns.push(pattern);
  }
}

/**
 * Manages controlled snippet extraction with consent and audit trail
 */
export class SnippetManager {
  constructor(options = {}) {
    this.sanitizer = options.sanitizer || new SnippetSanitizer();
    this.auditFile = options.auditFile || join(process.cwd(), '.snippet-audit.json');
    this.maxAuditEntries = options.maxAuditEntries || 1000;
    this.boundaryTypes = options.boundaryTypes || BOUNDARY_TYPES;
  }

  /**
   * Extract a snippet from a file with smart boundary detection
   * @param {Object} params - Extraction parameters
   * @returns {Promise<Object>} Extraction result
   */
  async extractSnippet(params) {
    const {
      filePath,
      startLine,
      endLine,
      purpose,
      sharingLevel = 'micro',
      autoDetectBoundaries = true,
      sanitize = true,
      confirmed = false,
    } = params;

    // Validate sharing level
    const boundary = this.boundaryTypes[sharingLevel];
    if (!boundary) {
      throw new Error(`Invalid sharing level: ${sharingLevel}. Use: ${Object.keys(this.boundaryTypes).join(', ')}`);
    }

    // Read file content
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n');

    // Validate line numbers
    if (startLine < 1 || endLine > lines.length || startLine > endLine) {
      throw new Error('Invalid line range');
    }

    // Auto-detect boundaries if requested
    let extractStart = startLine;
    let extractEnd = endLine;
    
    if (autoDetectBoundaries) {
      const boundaries = await this.detectCodeBoundaries(content, startLine, endLine);
      extractStart = boundaries.start;
      extractEnd = boundaries.end;
    }

    // Enforce size limits
    const lineCount = extractEnd - extractStart + 1;
    if (lineCount > boundary.maxLines) {
      throw new Error(`Snippet exceeds ${sharingLevel} limit of ${boundary.maxLines} lines (has ${lineCount} lines)`);
    }

    // Extract snippet with context
    const contextStart = Math.max(1, extractStart - boundary.context);
    const contextEnd = Math.min(lines.length, extractEnd + boundary.context);
    
    const snippet = lines.slice(extractStart - 1, extractEnd).join('\n');
    const contextSnippet = lines.slice(contextStart - 1, contextEnd).join('\n');

    // Sanitize if requested
    let finalSnippet = snippet;
    let sanitizationResult = null;
    
    if (sanitize) {
      sanitizationResult = this.sanitizer.sanitize(snippet);
      finalSnippet = sanitizationResult.sanitized;
    }

    // Check for sensitive data
    const containsSensitive = this.sanitizer.containsSensitiveData(snippet);

    // Prepare result
    const result = {
      snippet: finalSnippet,
      metadata: {
        filePath,
        lineRange: `${extractStart}-${extractEnd}`,
        actualLines: lineCount,
        purpose,
        sharingLevel,
        boundariesAutoDetected: autoDetectBoundaries,
        sanitized: sanitize,
        containsSensitiveData: containsSensitive,
      },
      context: {
        before: lines.slice(contextStart - 1, extractStart - 1).join('\n'),
        after: lines.slice(extractEnd, contextEnd).join('\n'),
      },
      safetyCheck: {
        containsSensitiveData: containsSensitive,
        withinSizeLimit: true,
        appropriateScope: true,
        sanitizationApplied: sanitize,
        detectedSecrets: sanitizationResult?.detectedSecrets || 0,
        secretTypes: sanitizationResult?.secretTypes || [],
      },
    };

    // Require confirmation if not provided
    if (!confirmed) {
      return {
        requiresConfirmation: true,
        preview: `Share lines ${extractStart}-${extractEnd} from ${filePath}?`,
        purpose,
        lineCount,
        safetyCheck: result.safetyCheck,
        message: 'Add "confirmed: true" to share this snippet',
      };
    }

    // Log to audit trail
    await this.addAuditEntry({
      timestamp: new Date().toISOString(),
      filePath,
      lineRange: `${extractStart}-${extractEnd}`,
      lineCount,
      purpose,
      sharingLevel,
      containedSensitive: containsSensitive,
      sanitized: sanitize,
      secretsDetected: sanitizationResult?.detectedSecrets || 0,
    });

    return result;
  }

  /**
   * Detect code boundaries (functions, classes) around given lines
   * @param {string} content - File content
   * @param {number} startLine - Start line number
   * @param {number} endLine - End line number
   * @returns {Promise<{start: number, end: number, type: string}>}
   */
  async detectCodeBoundaries(content, startLine, endLine) {
    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy'],
        locations: true,
      });

      let bestBoundary = { start: startLine, end: endLine, type: 'selection' };
      let smallestRange = endLine - startLine;

      traverse.default(ast, {
        enter(path) {
          const { node } = path;
          if (!node.loc) return;

          const nodeStart = node.loc.start.line;
          const nodeEnd = node.loc.end.line;

          // Check if this node contains our selection
          if (nodeStart <= startLine && nodeEnd >= endLine) {
            const nodeRange = nodeEnd - nodeStart;

            // Is this a better (smaller) boundary?
            if (nodeRange < smallestRange) {
              let type = 'block';
              
              if (path.isFunctionDeclaration() || path.isFunctionExpression() || path.isArrowFunctionExpression()) {
                type = 'function';
              } else if (path.isClassDeclaration() || path.isClassExpression()) {
                type = 'class';
              } else if (path.isObjectExpression()) {
                type = 'object';
              } else if (path.isBlockStatement()) {
                type = 'block';
              }

              bestBoundary = {
                start: nodeStart,
                end: nodeEnd,
                type,
              };
              smallestRange = nodeRange;
            }
          }
        },
      });

      return bestBoundary;
    } catch (error) {
      // If AST parsing fails, return original boundaries
      return { start: startLine, end: endLine, type: 'selection' };
    }
  }

  /**
   * Request editing help with smart escalation
   * @param {Object} params - Help request parameters
   * @returns {Promise<Object>} Help response
   */
  async requestEditingHelp(params) {
    const {
      task,
      filePath,
      sharingLevel = 'function',
      preferEmbeddings = true,
      maxAttempts = 3,
    } = params;

    const response = {
      task,
      filePath,
      attempts: [],
    };

    // First attempt: Try embeddings only
    if (preferEmbeddings) {
      response.attempts.push({
        type: 'embeddings',
        message: 'Analyzing file structure and semantics...',
        timestamp: new Date().toISOString(),
      });

      // In a real implementation, this would check if embeddings provide enough context
      const embeddingsSuccessful = await this.checkEmbeddingsSufficient(task, filePath);
      
      if (embeddingsSuccessful) {
        response.status = 'success';
        response.method = 'embeddings_only';
        response.message = 'Task can be completed using semantic analysis only';
        return response;
      }
    }

    // Second attempt: Suggest specific snippets
    const relevantSnippets = await this.identifyRelevantSnippets(task, filePath);
    
    if (relevantSnippets.length > 0) {
      response.status = 'needs_snippets';
      response.method = 'controlled_sharing';
      response.suggestedSnippets = relevantSnippets;
      response.message = 'The following code sections would help complete this task:';
      
      // Add safety information
      for (const snippet of relevantSnippets) {
        snippet.safetyCheck = {
          containsSensitive: this.sanitizer.containsSensitiveData(snippet.preview || ''),
          estimatedLines: snippet.estimatedLines,
          sharingLevel: this.determineSharingLevel(snippet.estimatedLines),
        };
      }
      
      return response;
    }

    // Final attempt: Suggest alternative approaches
    response.status = 'alternative_approach';
    response.suggestions = [
      'Provide a more specific description of the issue',
      'Share the error message or specific behavior',
      'Describe the expected vs actual behavior',
      'Consider sharing a minimal reproducible example',
    ];
    
    return response;
  }

  /**
   * Check if embeddings provide sufficient context
   * @private
   */
  async checkEmbeddingsSufficient(task, filePath) {
    // Simplified implementation - in reality would use embedding similarity
    const simpleTaskKeywords = ['structure', 'overview', 'organization', 'architecture'];
    return simpleTaskKeywords.some(keyword => task.toLowerCase().includes(keyword));
  }

  /**
   * Identify relevant code snippets for a task
   * @private
   */
  async identifyRelevantSnippets(task, filePath) {
    // Simplified implementation - in reality would use AST and task analysis
    const snippets = [];
    
    // Extract keywords from task
    const keywords = task.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    
    try {
      const content = await readFile(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Simple keyword matching (in reality would be more sophisticated)
      lines.forEach((line, index) => {
        const lowerLine = line.toLowerCase();
        if (keywords.some(keyword => lowerLine.includes(keyword))) {
          snippets.push({
            startLine: Math.max(1, index - 2),
            endLine: Math.min(lines.length, index + 3),
            estimatedLines: 6,
            relevance: 'keyword_match',
            preview: lines[index].trim().substring(0, 50) + '...',
          });
        }
      });
    } catch (error) {
      // File reading error
    }
    
    return snippets.slice(0, 3); // Return top 3 suggestions
  }

  /**
   * Determine appropriate sharing level based on line count
   * @private
   */
  determineSharingLevel(lineCount) {
    if (lineCount <= BOUNDARY_TYPES.micro.maxLines) return 'micro';
    if (lineCount <= BOUNDARY_TYPES.function.maxLines) return 'function';
    return 'component';
  }

  /**
   * Add entry to audit trail
   * @private
   */
  async addAuditEntry(entry) {
    let audit = [];
    
    try {
      if (existsSync(this.auditFile)) {
        const data = await readFile(this.auditFile, 'utf8');
        audit = JSON.parse(data);
      }
    } catch (error) {
      // Start fresh if audit file is corrupted
      audit = [];
    }

    // Add new entry
    audit.push(entry);

    // Limit audit size
    if (audit.length > this.maxAuditEntries) {
      audit = audit.slice(-this.maxAuditEntries);
    }

    // Save audit trail
    await writeFile(this.auditFile, JSON.stringify(audit, null, 2), 'utf8');
  }

  /**
   * Get audit trail report
   * @param {Object} filters - Optional filters
   * @returns {Promise<Object>} Audit report
   */
  async getAuditReport(filters = {}) {
    let audit = [];
    
    try {
      if (existsSync(this.auditFile)) {
        const data = await readFile(this.auditFile, 'utf8');
        audit = JSON.parse(data);
      }
    } catch (error) {
      return { error: 'Failed to read audit trail' };
    }

    // Apply filters
    if (filters.startDate) {
      audit = audit.filter(entry => new Date(entry.timestamp) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      audit = audit.filter(entry => new Date(entry.timestamp) <= new Date(filters.endDate));
    }
    if (filters.filePath) {
      audit = audit.filter(entry => entry.filePath.includes(filters.filePath));
    }
    if (filters.containedSensitive !== undefined) {
      audit = audit.filter(entry => entry.containedSensitive === filters.containedSensitive);
    }

    // Generate summary
    const summary = {
      totalSnippets: audit.length,
      filesAccessed: [...new Set(audit.map(e => e.filePath))].length,
      sensitiveDataEncountered: audit.filter(e => e.containedSensitive).length,
      secretsDetected: audit.reduce((sum, e) => sum + (e.secretsDetected || 0), 0),
      byShareLevel: {
        micro: audit.filter(e => e.sharingLevel === 'micro').length,
        function: audit.filter(e => e.sharingLevel === 'function').length,
        component: audit.filter(e => e.sharingLevel === 'component').length,
      },
      recentActivity: audit.slice(-10).reverse(),
    };

    return {
      summary,
      entries: audit,
    };
  }

  /**
   * Clear audit trail
   * @param {boolean} confirmed - Confirmation required
   */
  async clearAuditTrail(confirmed = false) {
    if (!confirmed) {
      throw new Error('Confirmation required to clear audit trail');
    }

    await writeFile(this.auditFile, '[]', 'utf8');
    return { message: 'Audit trail cleared' };
  }
}