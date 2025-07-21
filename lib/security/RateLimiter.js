/**
 * Rate Limiter for command execution to prevent DoS attacks
 * Implements token bucket algorithm with sliding window tracking
 */

export class RateLimiter {
  constructor(options = {}) {
    this.options = {
      maxRequests: options.maxRequests || 100,     // Max requests per window
      windowMs: options.windowMs || 60000,         // 1 minute window
      burstLimit: options.burstLimit || 10,        // Max burst requests
      burstWindowMs: options.burstWindowMs || 1000, // 1 second burst window
      enableDDoSProtection: options.enableDDoSProtection !== false,
      suspiciousThreshold: options.suspiciousThreshold || 50,
      blockDurationMs: options.blockDurationMs || 300000, // 5 minutes
      enableGracefulDegradation: options.enableGracefulDegradation !== false,
      ...options
    };

    // Token bucket for rate limiting
    this.buckets = new Map(); // clientId -> bucket
    
    // Sliding window tracking
    this.windows = new Map(); // clientId -> requests array
    
    // Blocked clients tracking
    this.blockedClients = new Map(); // clientId -> blockEndTime
    
    // DDoS detection patterns
    this.suspiciousPatterns = new Map(); // clientId -> pattern data
    
    // Cleanup intervals
    this.startCleanupIntervals();
  }

  /**
   * Check if request is allowed for client
   */
  async isAllowed(clientId, commandType = 'general', metadata = {}) {
    const now = Date.now();
    
    // Check if client is blocked
    if (this.isClientBlocked(clientId, now)) {
      return {
        allowed: false,
        reason: 'CLIENT_BLOCKED',
        retryAfter: this.getBlockTimeRemaining(clientId, now),
        metadata: { blockReason: 'DDoS protection activated' }
      };
    }

    // Check for suspicious patterns
    if (this.detectSuspiciousActivity(clientId, commandType, metadata, now)) {
      this.blockClient(clientId, now, 'SUSPICIOUS_ACTIVITY');
      return {
        allowed: false,
        reason: 'SUSPICIOUS_ACTIVITY',
        retryAfter: this.options.blockDurationMs,
        metadata: { pattern: 'Automated/malicious behavior detected' }
      };
    }

    // Check burst limit
    const burstResult = this.checkBurstLimit(clientId, now);
    if (!burstResult.allowed) {
      return burstResult;
    }

    // Check rate limit
    const rateResult = this.checkRateLimit(clientId, now);
    if (!rateResult.allowed) {
      return rateResult;
    }

    // Record the request
    this.recordRequest(clientId, commandType, metadata, now);

    return {
      allowed: true,
      remaining: this.getRemainingRequests(clientId, now),
      resetTime: this.getResetTime(clientId, now),
      metadata: { 
        rateLimit: this.options.maxRequests,
        window: this.options.windowMs 
      }
    };
  }

  /**
   * Check burst limit (short-term protection)
   */
  checkBurstLimit(clientId, now) {
    const window = this.windows.get(clientId) || [];
    const recentRequests = window.filter(req => 
      now - req.timestamp < this.options.burstWindowMs
    );

    if (recentRequests.length >= this.options.burstLimit) {
      return {
        allowed: false,
        reason: 'BURST_LIMIT_EXCEEDED',
        retryAfter: this.options.burstWindowMs,
        metadata: { 
          burstLimit: this.options.burstLimit,
          window: this.options.burstWindowMs 
        }
      };
    }

    return { allowed: true };
  }

  /**
   * Check rate limit (long-term protection)
   */
  checkRateLimit(clientId, now) {
    const window = this.windows.get(clientId) || [];
    const validRequests = window.filter(req => 
      now - req.timestamp < this.options.windowMs
    );

    if (validRequests.length >= this.options.maxRequests) {
      return {
        allowed: false,
        reason: 'RATE_LIMIT_EXCEEDED',
        retryAfter: this.getRetryAfter(clientId, now),
        metadata: { 
          rateLimit: this.options.maxRequests,
          window: this.options.windowMs 
        }
      };
    }

    return { allowed: true };
  }

  /**
   * Detect suspicious activity patterns
   */
  detectSuspiciousActivity(clientId, commandType, metadata, now) {
    if (!this.options.enableDDoSProtection) return false;

    const patterns = this.suspiciousPatterns.get(clientId) || {
      commandCounts: new Map(),
      lastRequest: 0,
      rapidFireCount: 0,
      identicalCommands: [],
      errorCount: 0
    };

    // Pattern 1: Rapid fire requests (< 100ms apart)
    if (now - patterns.lastRequest < 100) {
      patterns.rapidFireCount++;
      if (patterns.rapidFireCount > 20) return true;
    } else {
      patterns.rapidFireCount = 0;
    }

    // Pattern 2: Identical commands in succession
    const commandKey = `${commandType}_${JSON.stringify(metadata)}`;
    patterns.identicalCommands.push({ command: commandKey, timestamp: now });
    patterns.identicalCommands = patterns.identicalCommands.filter(cmd => 
      now - cmd.timestamp < 5000 // Last 5 seconds
    );
    
    const identicalCount = patterns.identicalCommands.filter(cmd => 
      cmd.command === commandKey
    ).length;
    if (identicalCount > 10) return true;

    // Pattern 3: High error rate commands
    if (metadata.isError) {
      patterns.errorCount++;
      if (patterns.errorCount > 30) return true;
    }

    // Pattern 4: Command type distribution analysis
    patterns.commandCounts.set(commandType, (patterns.commandCounts.get(commandType) || 0) + 1);
    const totalCommands = Array.from(patterns.commandCounts.values()).reduce((a, b) => a + b, 0);
    if (totalCommands > this.options.suspiciousThreshold) return true;

    patterns.lastRequest = now;
    this.suspiciousPatterns.set(clientId, patterns);
    
    return false;
  }

  /**
   * Record a successful request
   */
  recordRequest(clientId, commandType, metadata, now) {
    const window = this.windows.get(clientId) || [];
    window.push({
      timestamp: now,
      commandType,
      metadata
    });
    
    // Keep only recent requests
    const filtered = window.filter(req => 
      now - req.timestamp < Math.max(this.options.windowMs, this.options.burstWindowMs)
    );
    
    this.windows.set(clientId, filtered);
  }

  /**
   * Block a client
   */
  blockClient(clientId, now, reason) {
    this.blockedClients.set(clientId, {
      blockEndTime: now + this.options.blockDurationMs,
      reason,
      timestamp: now
    });
  }

  /**
   * Check if client is blocked
   */
  isClientBlocked(clientId, now) {
    const blockInfo = this.blockedClients.get(clientId);
    if (!blockInfo) return false;
    
    if (now >= blockInfo.blockEndTime) {
      this.blockedClients.delete(clientId);
      return false;
    }
    
    return true;
  }

  /**
   * Get remaining block time
   */
  getBlockTimeRemaining(clientId, now) {
    const blockInfo = this.blockedClients.get(clientId);
    return blockInfo ? Math.max(0, blockInfo.blockEndTime - now) : 0;
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(clientId, now) {
    const window = this.windows.get(clientId) || [];
    const validRequests = window.filter(req => 
      now - req.timestamp < this.options.windowMs
    );
    return Math.max(0, this.options.maxRequests - validRequests.length);
  }

  /**
   * Get time when rate limit resets
   */
  getResetTime(clientId, now) {
    const window = this.windows.get(clientId) || [];
    if (window.length === 0) return now;
    
    const oldestRequest = Math.min(...window.map(req => req.timestamp));
    return oldestRequest + this.options.windowMs;
  }

  /**
   * Get retry after time for rate limited requests
   */
  getRetryAfter(clientId, now) {
    const resetTime = this.getResetTime(clientId, now);
    return Math.max(1000, resetTime - now); // At least 1 second
  }

  /**
   * Get rate limiting statistics
   */
  getStats() {
    const now = Date.now();
    return {
      activeClients: this.windows.size,
      blockedClients: this.blockedClients.size,
      suspiciousClients: this.suspiciousPatterns.size,
      totalBlocked: Array.from(this.blockedClients.values()).length,
      blockedByReason: Array.from(this.blockedClients.values()).reduce((acc, block) => {
        acc[block.reason] = (acc[block.reason] || 0) + 1;
        return acc;
      }, {}),
      rateLimitConfig: {
        maxRequests: this.options.maxRequests,
        windowMs: this.options.windowMs,
        burstLimit: this.options.burstLimit,
        burstWindowMs: this.options.burstWindowMs
      }
    };
  }

  /**
   * Start cleanup intervals
   */
  startCleanupIntervals() {
    // Clean up expired windows every minute
    this.windowCleanupInterval = setInterval(() => {
      const now = Date.now();
      const maxAge = Math.max(this.options.windowMs, this.options.burstWindowMs);
      
      for (const [clientId, window] of this.windows.entries()) {
        const filtered = window.filter(req => now - req.timestamp < maxAge);
        if (filtered.length === 0) {
          this.windows.delete(clientId);
        } else {
          this.windows.set(clientId, filtered);
        }
      }
    }, 60000);

    // Clean up expired blocks every 5 minutes
    this.blockCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, blockInfo] of this.blockedClients.entries()) {
        if (now >= blockInfo.blockEndTime) {
          this.blockedClients.delete(clientId);
        }
      }
    }, 300000);

    // Clean up old suspicious patterns every 10 minutes
    this.patternCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [clientId, patterns] of this.suspiciousPatterns.entries()) {
        if (now - patterns.lastRequest > 600000) { // 10 minutes inactive
          this.suspiciousPatterns.delete(clientId);
        }
      }
    }, 600000);
  }

  /**
   * Stop cleanup intervals
   */
  destroy() {
    if (this.windowCleanupInterval) {
      clearInterval(this.windowCleanupInterval);
    }
    if (this.blockCleanupInterval) {
      clearInterval(this.blockCleanupInterval);
    }
    if (this.patternCleanupInterval) {
      clearInterval(this.patternCleanupInterval);
    }
  }
}