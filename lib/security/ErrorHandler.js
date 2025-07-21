import { createHash } from 'crypto';

/**
 * Comprehensive Error Handling System for Security-Critical Operations
 * Provides structured error handling, recovery mechanisms, and safety guarantees
 */
export class ErrorHandler {
  constructor(options = {}) {
    this.options = {
      enableRecovery: true,
      maxRetryAttempts: 3,
      retryDelayMs: 1000,
      enableCircuitBreaker: true,
      circuitBreakerThreshold: 5,
      circuitBreakerTimeoutMs: 30000,
      enableErrorReporting: true,
      criticalErrorCallback: null,
      logErrorDetails: true,
      enableStackTrace: true,
      sanitizeErrors: true,
      ...options,
    };

    this.errorHistory = [];
    this.circuitBreakerState = new Map();
    this.retryCounters = new Map();
    this.errorCounts = new Map();
    this.lastErrorTime = new Map();
    
    this.initializeErrorCategories();
  }

  /**
   * Initialize error categorization system
   */
  initializeErrorCategories() {
    this.errorCategories = {
      // Critical errors that should stop execution immediately
      CRITICAL: new Set([
        'SECURITY_VIOLATION',
        'VALIDATION_FAILED',
        'PERMISSION_DENIED',
        'AUTHENTICATION_FAILED',
        'INJECTION_DETECTED',
        'SANDBOX_BREACH',
      ]),

      // Recoverable errors that can be retried
      RECOVERABLE: new Set([
        'NETWORK_ERROR',
        'TIMEOUT',
        'TEMPORARY_FAILURE',
        'RESOURCE_BUSY',
        'RATE_LIMITED',
      ]),

      // Input/validation errors
      INPUT_ERROR: new Set([
        'INVALID_COMMAND',
        'INVALID_ARGUMENT',
        'INVALID_PATH',
        'INVALID_FORMAT',
        'MISSING_PARAMETER',
      ]),

      // System errors
      SYSTEM_ERROR: new Set([
        'FILE_NOT_FOUND',
        'PERMISSION_ERROR',
        'MEMORY_ERROR',
        'DISK_FULL',
        'PROCESS_ERROR',
      ]),

      // Configuration errors
      CONFIG_ERROR: new Set([
        'INVALID_CONFIG',
        'MISSING_CONFIG',
        'CONFIG_PARSE_ERROR',
      ]),
    };

    this.errorSeverity = {
      CRITICAL: 5,
      HIGH: 4,
      MEDIUM: 3,
      LOW: 2,
      INFO: 1,
    };
  }

  /**
   * Main error handling method with comprehensive processing
   */
  async handleError(error, context = {}) {
    const errorInfo = this.analyzeError(error, context);
    
    // Log the error
    this.logError(errorInfo);
    
    // Update error statistics
    this.updateErrorStats(errorInfo);
    
    // Check circuit breaker
    if (this.isCircuitBreakerOpen(errorInfo.operation)) {
      throw this.createError('CIRCUIT_BREAKER_OPEN', 
        `Circuit breaker is open for operation: ${errorInfo.operation}`, 
        { originalError: errorInfo });
    }
    
    // Handle based on error category
    const category = this.categorizeError(errorInfo.type);
    
    switch (category) {
      case 'CRITICAL':
        return this.handleCriticalError(errorInfo);
        
      case 'RECOVERABLE':
        return this.handleRecoverableError(errorInfo);
        
      case 'INPUT_ERROR':
        return this.handleInputError(errorInfo);
        
      case 'SYSTEM_ERROR':
        return this.handleSystemError(errorInfo);
        
      case 'CONFIG_ERROR':
        return this.handleConfigError(errorInfo);
        
      default:
        return this.handleUnknownError(errorInfo);
    }
  }

  /**
   * Analyze and structure error information
   */
  analyzeError(error, context) {
    const timestamp = new Date().toISOString();
    const errorId = this.generateErrorId();
    
    let errorInfo = {
      id: errorId,
      timestamp: timestamp,
      type: 'UNKNOWN_ERROR',
      message: 'Unknown error occurred',
      originalError: error,
      context: context,
      stackTrace: null,
      severity: 'MEDIUM',
      operation: context.operation || 'unknown',
      retryable: false,
      sanitized: false,
    };

    // Extract information from different error types
    if (error instanceof Error) {
      errorInfo.message = error.message;
      errorInfo.type = error.name || 'Error';
      errorInfo.stackTrace = this.options.enableStackTrace ? error.stack : null;
    } else if (typeof error === 'string') {
      errorInfo.message = error;
      errorInfo.type = 'STRING_ERROR';
    } else if (typeof error === 'object' && error !== null) {
      errorInfo.message = error.message || JSON.stringify(error);
      errorInfo.type = error.type || error.code || 'OBJECT_ERROR';
      errorInfo.stackTrace = error.stack;
    }

    // Determine error type from message patterns
    errorInfo.type = this.inferErrorType(errorInfo.message, errorInfo.type);
    
    // Set severity based on type
    errorInfo.severity = this.getErrorSeverity(errorInfo.type);
    
    // Determine if retryable
    errorInfo.retryable = this.isRetryable(errorInfo.type);
    
    // Sanitize sensitive information
    if (this.options.sanitizeErrors) {
      errorInfo = this.sanitizeErrorInfo(errorInfo);
    }

    return errorInfo;
  }

  /**
   * Infer error type from message content
   */
  inferErrorType(message, currentType) {
    const patterns = {
      'VALIDATION_FAILED': /validation failed|invalid input|input validation/i,
      'PERMISSION_DENIED': /permission denied|access denied|forbidden/i,
      'FILE_NOT_FOUND': /file not found|no such file|enoent/i,
      'TIMEOUT': /timeout|timed out|deadline exceeded/i,
      'NETWORK_ERROR': /network|connection|econnrefused|enotfound/i,
      'MEMORY_ERROR': /out of memory|memory|heap/i,
      'INJECTION_DETECTED': /injection|dangerous pattern|security violation/i,
      'INVALID_COMMAND': /command.*not allowed|invalid command/i,
      'PROCESS_ERROR': /spawn|exec|process/i,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(message)) {
        return type;
      }
    }

    return currentType;
  }

  /**
   * Get error severity level
   */
  getErrorSeverity(errorType) {
    if (this.errorCategories.CRITICAL.has(errorType)) return 'CRITICAL';
    if (errorType.includes('SECURITY') || errorType.includes('INJECTION')) return 'HIGH';
    if (this.errorCategories.SYSTEM_ERROR.has(errorType)) return 'MEDIUM';
    if (this.errorCategories.INPUT_ERROR.has(errorType)) return 'LOW';
    return 'MEDIUM';
  }

  /**
   * Determine if error is retryable
   */
  isRetryable(errorType) {
    return this.errorCategories.RECOVERABLE.has(errorType) ||
           errorType.includes('TIMEOUT') ||
           errorType.includes('TEMPORARY');
  }

  /**
   * Categorize error for handling strategy
   */
  categorizeError(errorType) {
    for (const [category, types] of Object.entries(this.errorCategories)) {
      if (types.has(errorType)) {
        return category;
      }
    }
    return 'UNKNOWN';
  }

  /**
   * Handle critical errors - immediate stop, no recovery
   */
  async handleCriticalError(errorInfo) {
    // Log critical error with high priority
    this.logError({
      ...errorInfo,
      severity: 'CRITICAL',
      critical: true,
    });

    // Trigger critical error callback if configured
    if (this.options.criticalErrorCallback) {
      try {
        await this.options.criticalErrorCallback(errorInfo);
      } catch (callbackError) {
        // Don't let callback errors interfere with critical error handling
        this.logError({
          type: 'CALLBACK_ERROR',
          message: `Critical error callback failed: ${callbackError.message}`,
          severity: 'HIGH',
        });
      }
    }

    // Create enhanced error for critical failures
    const criticalError = this.createError('CRITICAL_FAILURE', 
      `Critical error: ${errorInfo.message}`, {
        errorId: errorInfo.id,
        timestamp: errorInfo.timestamp,
        operation: errorInfo.operation,
        severity: 'CRITICAL',
      });

    throw criticalError;
  }

  /**
   * Handle recoverable errors with retry logic
   */
  async handleRecoverableError(errorInfo) {
    const operation = errorInfo.operation;
    const retryKey = `${operation}_${errorInfo.type}`;
    
    // Get current retry count
    const currentRetries = this.retryCounters.get(retryKey) || 0;
    
    if (currentRetries >= this.options.maxRetryAttempts) {
      // Max retries exceeded, treat as non-recoverable
      this.retryCounters.delete(retryKey);
      
      // Update circuit breaker
      this.updateCircuitBreaker(operation, false);
      
      throw this.createError('MAX_RETRIES_EXCEEDED', 
        `Maximum retry attempts (${this.options.maxRetryAttempts}) exceeded for ${operation}`, {
          originalError: errorInfo,
          retryAttempts: currentRetries,
        });
    }

    // Increment retry counter
    this.retryCounters.set(retryKey, currentRetries + 1);
    
    // Log retry attempt
    this.logError({
      ...errorInfo,
      type: 'RETRY_ATTEMPT',
      message: `Retry attempt ${currentRetries + 1}/${this.options.maxRetryAttempts} for: ${errorInfo.message}`,
      severity: 'LOW',
    });

    // Calculate delay with exponential backoff
    const delay = this.options.retryDelayMs * Math.pow(2, currentRetries);
    
    // Wait before retry
    await this.sleep(delay);
    
    // Return retry signal
    return {
      shouldRetry: true,
      retryAttempt: currentRetries + 1,
      delay: delay,
      errorInfo: errorInfo,
    };
  }

  /**
   * Handle input validation errors
   */
  async handleInputError(errorInfo) {
    // Input errors are not retryable, return structured error response
    const inputError = this.createError('INPUT_VALIDATION_ERROR', 
      `Input validation failed: ${errorInfo.message}`, {
        errorId: errorInfo.id,
        inputError: true,
        suggestions: this.generateInputSuggestions(errorInfo),
      });

    // Don't throw, return error object for graceful handling
    return {
      success: false,
      error: inputError,
      errorInfo: errorInfo,
    };
  }

  /**
   * Handle system errors
   */
  async handleSystemError(errorInfo) {
    // Log system error
    this.logError({
      ...errorInfo,
      severity: 'HIGH',
      systemError: true,
    });

    // Some system errors might be retryable
    if (errorInfo.retryable) {
      return this.handleRecoverableError(errorInfo);
    }

    // Non-retryable system error
    throw this.createError('SYSTEM_ERROR', 
      `System error: ${errorInfo.message}`, {
        errorId: errorInfo.id,
        systemError: true,
      });
  }

  /**
   * Handle configuration errors
   */
  async handleConfigError(errorInfo) {
    // Configuration errors are typically not retryable
    const configError = this.createError('CONFIGURATION_ERROR', 
      `Configuration error: ${errorInfo.message}`, {
        errorId: errorInfo.id,
        configError: true,
        suggestions: 'Please check configuration settings',
      });

    throw configError;
  }

  /**
   * Handle unknown errors with conservative approach
   */
  async handleUnknownError(errorInfo) {
    // Log unknown error for investigation
    this.logError({
      ...errorInfo,
      type: 'UNKNOWN_ERROR',
      severity: 'HIGH',
      message: `Unknown error type: ${errorInfo.message}`,
    });

    // Treat unknown errors as non-retryable for safety
    throw this.createError('UNKNOWN_ERROR', 
      `Unknown error: ${errorInfo.message}`, {
        errorId: errorInfo.id,
        requiresInvestigation: true,
      });
  }

  /**
   * Circuit breaker implementation
   */
  isCircuitBreakerOpen(operation) {
    if (!this.options.enableCircuitBreaker) return false;
    
    const state = this.circuitBreakerState.get(operation);
    if (!state) return false;
    
    if (state.state === 'OPEN') {
      // Check if timeout period has elapsed
      if (Date.now() - state.openTime > this.options.circuitBreakerTimeoutMs) {
        // Move to half-open state
        state.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    
    return false;
  }

  /**
   * Update circuit breaker state
   */
  updateCircuitBreaker(operation, success) {
    if (!this.options.enableCircuitBreaker) return;
    
    const state = this.circuitBreakerState.get(operation) || {
      state: 'CLOSED',
      failureCount: 0,
      lastFailureTime: null,
      openTime: null,
    };

    if (success) {
      // Success resets the circuit breaker
      state.state = 'CLOSED';
      state.failureCount = 0;
    } else {
      // Failure increments counter
      state.failureCount++;
      state.lastFailureTime = Date.now();
      
      if (state.failureCount >= this.options.circuitBreakerThreshold) {
        state.state = 'OPEN';
        state.openTime = Date.now();
      }
    }

    this.circuitBreakerState.set(operation, state);
  }

  /**
   * Sanitize error information to remove sensitive data
   */
  sanitizeErrorInfo(errorInfo) {
    const sensitivePatterns = [
      /password[=:]\s*[^\s]+/gi,
      /token[=:]\s*[^\s]+/gi,
      /key[=:]\s*[^\s]+/gi,
      /secret[=:]\s*[^\s]+/gi,
      /api[_-]?key[=:]\s*[^\s]+/gi,
    ];

    let sanitizedMessage = errorInfo.message;
    let sanitizedStack = errorInfo.stackTrace;

    sensitivePatterns.forEach(pattern => {
      sanitizedMessage = sanitizedMessage.replace(pattern, '[REDACTED]');
      if (sanitizedStack) {
        sanitizedStack = sanitizedStack.replace(pattern, '[REDACTED]');
      }
    });

    return {
      ...errorInfo,
      message: sanitizedMessage,
      stackTrace: sanitizedStack,
      sanitized: true,
    };
  }

  /**
   * Generate helpful suggestions for input errors
   */
  generateInputSuggestions(errorInfo) {
    const suggestions = [];
    
    if (errorInfo.type === 'INVALID_COMMAND') {
      suggestions.push('Check command spelling and availability');
      suggestions.push('Verify command is in allowed list');
    } else if (errorInfo.type === 'INVALID_ARGUMENT') {
      suggestions.push('Check argument format and values');
      suggestions.push('Verify required arguments are provided');
    } else if (errorInfo.type === 'INVALID_PATH') {
      suggestions.push('Ensure path exists and is accessible');
      suggestions.push('Check path permissions');
    }

    return suggestions;
  }

  /**
   * Create structured error object
   */
  createError(type, message, metadata = {}) {
    const error = new Error(message);
    error.name = type;
    error.type = type;
    error.timestamp = new Date().toISOString();
    error.errorId = this.generateErrorId();
    
    // Add metadata
    Object.assign(error, metadata);
    
    return error;
  }

  /**
   * Utility methods
   */
  generateErrorId() {
    return createHash('sha256')
      .update(`${Date.now()}_${Math.random()}`)
      .digest('hex')
      .slice(0, 8);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log error with appropriate detail level
   */
  logError(errorInfo) {
    if (!this.options.logErrorDetails) return;

    this.errorHistory.push({
      ...errorInfo,
      loggedAt: new Date().toISOString(),
    });

    // Keep error history manageable
    const MAX_HISTORY_SIZE = 1000;
    if (this.errorHistory.length > MAX_HISTORY_SIZE) {
      this.errorHistory.shift();
    }
  }

  /**
   * Update error statistics
   */
  updateErrorStats(errorInfo) {
    const type = errorInfo.type;
    const count = this.errorCounts.get(type) || 0;
    this.errorCounts.set(type, count + 1);
    this.lastErrorTime.set(type, Date.now());
  }

  /**
   * Get error handling metrics
   */
  getErrorMetrics() {
    const totalErrors = Array.from(this.errorCounts.values())
      .reduce((sum, count) => sum + count, 0);

    return {
      totalErrors: totalErrors,
      errorsByType: Object.fromEntries(this.errorCounts),
      circuitBreakerStates: Object.fromEntries(this.circuitBreakerState),
      activeRetries: this.retryCounters.size,
      errorHistorySize: this.errorHistory.length,
      options: this.options,
    };
  }

  /**
   * Get recent errors
   */
  getRecentErrors(limit = 50) {
    return this.errorHistory.slice(-limit);
  }

  /**
   * Clear error history and reset counters
   */
  reset() {
    this.errorHistory = [];
    this.circuitBreakerState.clear();
    this.retryCounters.clear();
    this.errorCounts.clear();
    this.lastErrorTime.clear();
  }
}

export default ErrorHandler;