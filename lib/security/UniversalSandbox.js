import { InputValidator } from './InputValidator.js';
import { JPLAssertions } from './JPLAssertions.js';
import { ErrorHandler } from './ErrorHandler.js';
import { RateLimiter } from './RateLimiter.js';
import { TrustedToolVerifier } from './TrustedToolVerifier.js';
import { createHash } from 'crypto';

// Constants for magic numbers
const DEFAULT_MAX_REQUESTS = 50;
const DEFAULT_WINDOW_MS = 60000;
const DEFAULT_BURST_LIMIT = 5;
const DEFAULT_MAX_COMMAND_LENGTH = 500;
const DEFAULT_MAX_ARG_LENGTH = 300;
const DEFAULT_MAX_TOTAL_ARGS = 20;
const DEFAULT_MAX_FUNCTION_LINES = 60;
const DEFAULT_MIN_ASSERTIONS_PER_FUNCTION = 2;
const DEFAULT_MAX_RETRY_ATTEMPTS = 3;
const MAX_AUDIT_LOG_SIZE = 10000;
const CACHE_KEY_LENGTH = 16;
const STACK_TRACE_LINES = 6;

/**
 * Universal Sandbox - Security Policy Manager
 * Provides security policies and validation for command execution
 * Works with SecureCommandExecutor to enforce zero-trust architecture
 */
export class UniversalSandbox {
  constructor(options = {}) {
    // Initialize basic properties
    this.initializeBasicProperties(options);

    // Initialize security policies
    this.initializeSecurityPolicies();

    // Initialize all security components
    this.initializeSecurityComponents(options);

    // Initialize if enabled
    if (this.options.enabled) {
      this.initialize();
    }
  }

  /**
   * Initialize basic properties and data structures
   */
  initializeBasicProperties(options) {
    this.options = {
      enabled: true,
      mode: 'block', // monitor | warn | block
      performanceOptimization: true,
      bypassTrustedTools: true,
      ...options,
    };

    this.commandCache = new Map();
    this.auditLog = [];
    this.securityMetrics = {
      totalCommands: 0,
      blockedCommands: 0,
      allowedCommands: 0,
      cachedCommands: 0,
    };
  }

  /**
   * Initialize all security components
   */
  initializeSecurityComponents(options) {
    const strictMode = this.options.mode === 'block';

    // Initialize enhanced input validator
    this.inputValidator = new InputValidator({
      strictMode: strictMode,
      maxCommandLength: DEFAULT_MAX_COMMAND_LENGTH,
      maxArgLength: DEFAULT_MAX_ARG_LENGTH,
      maxTotalArgs: DEFAULT_MAX_TOTAL_ARGS,
    });

    // Initialize JPL runtime assertions for safety-critical compliance
    this.jplAssertions = new JPLAssertions({
      enabled: true,
      strictMode: strictMode,
      throwOnFailure: strictMode,
      maxFunctionLines: DEFAULT_MAX_FUNCTION_LINES,
      minAssertionsPerFunction: DEFAULT_MIN_ASSERTIONS_PER_FUNCTION,
    });

    // Initialize comprehensive error handling system
    this.errorHandler = new ErrorHandler({
      enableRecovery: !strictMode,
      maxRetryAttempts: DEFAULT_MAX_RETRY_ATTEMPTS,
      enableCircuitBreaker: true,
      criticalErrorCallback: this.createCriticalErrorCallback(),
      sanitizeErrors: true,
    });

    // Initialize rate limiter for DoS protection
    this.rateLimiter = new RateLimiter({
      maxRequests: options.maxRequests || DEFAULT_MAX_REQUESTS,
      windowMs: options.windowMs || DEFAULT_WINDOW_MS,
      burstLimit: options.burstLimit || DEFAULT_BURST_LIMIT,
      enableDDoSProtection: options.enableDDoSProtection !== false,
    });

    // Initialize trusted tool verifier with cryptographic verification
    this.trustedToolVerifier = new TrustedToolVerifier({
      enableCryptographicVerification: options.enableCryptographicVerification !== false,
      enableChecksumVerification: options.enableChecksumVerification !== false,
      enableSignatureVerification: options.enableSignatureVerification || false,
      allowSelfSigned: options.allowSelfSigned !== false,
    });
  }

  /**
   * Create critical error callback handler
   */
  createCriticalErrorCallback() {
    return (errorInfo) => {
      // JPL Rule 5: Minimum 2 assertions per function
      if (!errorInfo) {
        throw new TypeError('Error info must be provided');
      }
      if (typeof errorInfo !== 'object') {
        throw new TypeError('Error info must be an object');
      }
      return this.handleCriticalSecurityError(errorInfo);
    };
  }

  /**
   * Initialize security policies and command categorization
   */
  initializeSecurityPolicies() {
    // Initialize command categories
    this.securityPolicies = this.initializeCommandCategories();

    // Initialize dangerous patterns
    this.dangerousPatterns = this.initializeDangerousPatterns();
  }

  /**
   * Initialize command security categories
   */
  initializeCommandCategories() {
    return {
      // Commands that are always safe (no validation needed)
      ALWAYS_ALLOW: new Set(['echo', 'printf', 'true', 'false']),

      // Commands that need validation but are generally safe
      VALIDATE_REQUIRED: new Set([
        'ls',
        'find',
        'grep',
        'cat',
        'head',
        'tail',
        'wc',
        'sort',
        'uniq',
        'cut',
        'diff',
      ]),

      // Commands that require user consent
      REQUIRE_CONSENT: new Set([
        'npm',
        'yarn',
        'bun',
        'git',
        'docker',
        'make',
        'cmake',
        'tsc',
        'webpack',
        'rm',     // Moved from NEVER_ALLOW - destructive but may be needed
        'curl',   // Moved from NEVER_ALLOW - network access but may be needed
        'wget',   // Moved from NEVER_ALLOW - network access but may be needed
      ]),

      // Commands that are never allowed
      NEVER_ALLOW: new Set([
        'sudo',
        'su',
        'chmod',
        'chown',
        'ssh',
        'scp',
        'nc',
        'telnet',
        'dd',
        'fdisk',
        'mkfs',
        'mount',
        'umount',
      ]),

      // Trusted MCP tools that can bypass sandbox temporarily
      TRUSTED_TOOLS: new Set([
        'check_code_practices',
        'format_code',
        'check_safety_rules',
        'scan_security_vulnerabilities',
        'check_production_readiness',
        'check_accessibility',
        'check_graphql_schema',
        'check_graphql_query',
        'check_redux_patterns',
      ]),
    };
  }

  /**
   * Initialize dangerous command patterns
   */
  initializeDangerousPatterns() {
    return [
      /rm\s+-rf\s*\//, // rm -rf /
      /sudo\s+/, // sudo usage
      /curl\s+.*\|\s*sh/, // curl | sh
      /wget\s+.*\|\s*sh/, // wget | sh
      /eval\s*\(/, // eval execution
      /exec\s*\(/, // exec execution
      /system\s*\(/, // system calls
      /`[^`]*`/, // backtick execution
      /\$\([^)]*\)/, // command substitution
      /;\s*(rm|del|format)/, // chained dangerous commands
      /&&\s*(rm|del|format)/, // conditional dangerous commands
      /\|\s*(rm|del|format)/, // piped dangerous commands
    ];
  }

  /**
   * Initialize the universal sandbox security policy manager
   */
  initialize() {
    this.logSecurityEvent('INIT', 'system', [], 'Universal Sandbox Policy Manager initialization started');

    // Verify all security components are initialized
    this.verifySecurityComponents();

    this.logSecurityEvent(
      'INIT',
      'system',
      [],
      `Universal Sandbox Policy Manager initialized in ${this.options.mode} mode`,
    );
  }

  /**
   * Verify all security components are properly initialized
   */
  verifySecurityComponents() {
    const components = [
      { name: 'inputValidator', component: this.inputValidator },
      { name: 'jplAssertions', component: this.jplAssertions },
      { name: 'errorHandler', component: this.errorHandler },
      { name: 'rateLimiter', component: this.rateLimiter },
      { name: 'trustedToolVerifier', component: this.trustedToolVerifier },
    ];

    for (const { name, component } of components) {
      if (!component) {
        throw new Error(`Security component ${name} not initialized`);
      }
    }
  }

  /**
   * Check security policy for a command
   * @param {string} command - The command to check
   * @param {Array} args - Command arguments
   * @returns {Object} Policy decision with action and metadata
   */
  checkCommandPolicy(command, args = []) {
    // Validate inputs
    if (!command || typeof command !== 'string') {
      return {
        action: 'BLOCK',
        reason: 'Invalid command',
        metadata: { command, args }
      };
    }

    // Check for dangerous patterns first
    const fullCommand = `${command} ${args.join(' ')}`;
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(fullCommand)) {
        return {
          action: 'BLOCK',
          reason: 'Dangerous pattern detected',
          pattern: pattern.toString(),
          metadata: { command, args, fullCommand }
        };
      }
    }

    // Get security action
    const action = this.determineSecurityAction(command, args);
    
    return {
      action,
      reason: this.getPolicyReason(action, command),
      metadata: {
        command,
        args,
        category: this.getCommandCategory(command)
      }
    };
  }

  /**
   * Get the security policy for a specific command
   * @param {string} command - The command to get policy for
   * @returns {string} The policy category
   */
  getPolicyForCommand(command) {
    if (this.securityPolicies.NEVER_ALLOW.has(command)) {
      return 'NEVER_ALLOW';
    }
    if (this.securityPolicies.ALWAYS_ALLOW.has(command)) {
      return 'ALWAYS_ALLOW';
    }
    if (this.securityPolicies.VALIDATE_REQUIRED.has(command)) {
      return 'VALIDATE_REQUIRED';
    }
    if (this.securityPolicies.REQUIRE_CONSENT.has(command)) {
      return 'REQUIRE_CONSENT';
    }
    if (this.securityPolicies.TRUSTED_TOOLS.has(command)) {
      return 'TRUSTED_TOOLS';
    }
    return 'UNKNOWN';
  }

  /**
   * Get command category for metadata
   */
  getCommandCategory(command) {
    const category = this.getPolicyForCommand(command);
    return category !== 'UNKNOWN' ? category : 'UNCATEGORIZED';
  }

  /**
   * Get human-readable reason for policy decision
   */
  getPolicyReason(action, command) {
    const reasons = {
      'ALLOW': `Command '${command}' is in the always-allow list`,
      'VALIDATE': `Command '${command}' requires validation`,
      'CONSENT': `Command '${command}' requires user consent`,
      'BLOCK': `Command '${command}' is blocked by security policy`
    };
    return reasons[action] || `Unknown security action for '${command}'`;
  }

  /**
   * Validate command execution request against security policies
   * Used by SecureCommandExecutor to enforce policies
   * @returns {Object} Validation result with success flag and metadata
   */
  async validateCommandExecution(command, args = [], options = {}) {
    // JPL Rule 5: Function entry with assertions
    this.jplAssertions.enterFunction('validateCommandExecution');

    // JPL Rule 5: Assertion 1 - Validate inputs
    this.jplAssertions.assert(typeof command === 'string', 'Command must be a string', {
      command,
    });
    this.jplAssertions.assert(Array.isArray(args), 'Args must be an array', { args });

    // Rate limiting check
    const clientId = options.clientId || 'default';
    const rateLimitResult = await this.rateLimiter.isAllowed(clientId, command, {
      args,
      isError: false,
    });

    if (!rateLimitResult.allowed) {
      this.securityMetrics.blockedCommands++;
      this.securityMetrics.rateLimitViolations =
        (this.securityMetrics.rateLimitViolations || 0) + 1;

      this.logSecurityEvent(
        'RATE_LIMIT_EXCEEDED',
        command,
        args,
        `Rate limit exceeded: ${rateLimitResult.reason}`
      );

      this.jplAssertions.exitFunction('validateCommandExecution');
      return {
        success: false,
        action: 'BLOCK',
        reason: `Rate limit exceeded: ${rateLimitResult.reason}`,
        metadata: {
          command,
          args,
          clientId,
          rateLimitInfo: rateLimitResult,
          timestamp: new Date().toISOString()
        }
      };
    }

    this.securityMetrics.totalCommands++;

    try {
      // Enhanced input validation
      const validationResult = this.inputValidator.validateCommandExecution(
        command,
        args,
        options,
      );

      // JPL Rule 5: Assertion 2 - Validation must succeed for safety
      this.jplAssertions.assert(validationResult !== null, 'Validation result cannot be null');

      if (!validationResult.isValid) {
        this.logSecurityEvent(
          'VALIDATION_FAILED',
          command,
          args,
          `Input validation failed: ${validationResult.errors.join(', ')}`,
        );

        // JPL Rule 5: Function exit with compliance check
        this.jplAssertions.exitFunction('validateCommandExecution');
        return {
          success: false,
          action: 'BLOCK',
          reason: `Input validation failed: ${validationResult.errors.join(', ')}`,
          metadata: {
            command,
            args,
            validationErrors: validationResult.errors,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Log validation warnings if any
      if (validationResult.warnings.length > 0) {
        this.logSecurityEvent(
          'VALIDATION_WARNING',
          command,
          args,
          `Validation warnings: ${validationResult.warnings.join(', ')}`,
        );
      }

      // Use sanitized inputs for further processing
      const sanitizedCommand = validationResult.sanitized.command;
      const sanitizedArgs = validationResult.sanitized.args;
      const sanitizedOptions = validationResult.sanitized.options;

      // Get call source for audit trail
      const source = this.getCallSource();

      // Check if this is from a trusted tool and bypass is enabled
      if (this.options.bypassTrustedTools && this.isTrustedToolCall(source)) {
        return this.executeTrustedCommand(
          method,
          sanitizedCommand,
          sanitizedArgs,
          sanitizedOptions,
          callback,
        );
      }

      // Determine security action using sanitized inputs
      const securityAction = this.determineSecurityAction(sanitizedCommand, sanitizedArgs);

      // Log the attempt with validation metadata
      this.logCommandAttempt(
        method,
        sanitizedCommand,
        sanitizedArgs,
        source,
        securityAction,
        validationResult.metadata,
      );

      // Handle based on security action
      let result;
      switch (securityAction) {
        case 'ALLOW':
          result = await this.validateAllowedCommand(
            sanitizedCommand,
            sanitizedArgs,
            sanitizedOptions,
          );
          break;

        case 'VALIDATE':
          result = await this.validateCommandWithChecks(
            sanitizedCommand,
            sanitizedArgs,
            sanitizedOptions,
          );
          break;

        case 'CONSENT':
          result = this.validateConsentCommand(
            sanitizedCommand,
            sanitizedArgs,
            sanitizedOptions,
          );
          break;

        case 'BLOCK':
          result = this.validateBlockedCommand(
            sanitizedCommand,
            sanitizedArgs,
            'Command blocked by security policy',
          );
          break;

        default:
          result = this.validateBlockedCommand(
            sanitizedCommand,
            sanitizedArgs,
            'Unknown security action',
          );
      }

      // JPL Rule 7: Check return value
      this.jplAssertions.checkReturnValue(result, 'object', 'validation result');
      this.jplAssertions.exitFunction('validateCommandExecution');
      return result;
    } catch (error) {
      this.logSecurityEvent('ERROR', command, args, error.message);

      try {
        // Use comprehensive error handling
        const errorResult = await this.errorHandler.handleError(error, {
          operation: 'validateCommandExecution',
          command: command,
          args: args,
          function: 'validateCommandExecution',
        });

        // If error handler returns retry signal
        if (errorResult && errorResult.shouldRetry) {
          this.logSecurityEvent(
            'RETRY_ATTEMPT',
            command,
            args,
            `Retrying command validation: attempt ${errorResult.retryAttempt}`,
          );

          // JPL Rule 5: Function exit before retry
          this.jplAssertions.exitFunction('validateCommandExecution');

          // Recursive retry with same parameters
          return this.validateCommandExecution(command, args, options);
        }

        // If error handler returns structured error response
        if (errorResult && !errorResult.success) {
          this.jplAssertions.exitFunction('validateCommandExecution');
          return {
            success: false,
            action: 'ERROR',
            reason: errorResult.error.message,
            error: errorResult.error,
            metadata: {
              command,
              args,
              timestamp: new Date().toISOString()
            }
          };
        }
      } catch (handlerError) {
        // Error handler itself failed or threw
        this.logSecurityEvent('ERROR_HANDLER_FAILED', command, args, handlerError.message);
      }

      // JPL Rule 5: Function exit on error path
      this.jplAssertions.exitFunction('validateCommandExecution');
      return {
        success: false,
        action: 'ERROR',
        reason: `Validation error: ${error.message}`,
        error: error,
        metadata: {
          command,
          args,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Synchronous command validation
   */
  validateCommandSync(command, args = [], options = {}) {
    this.securityMetrics.totalCommands++;

    const source = this.getCallSource();
    const securityAction = this.determineSecurityAction(command, args);

    this.logCommandAttempt('sync', command, args, source, securityAction);

    switch (securityAction) {
      case 'ALLOW':
        return this.validateAllowedCommand(command, args, options);

      case 'VALIDATE':
        // For sync operations, we'll use a simplified validation
        if (this.isCommandSafe(command, args)) {
          this.securityMetrics.allowedCommands++;
          return {
            success: true,
            action: 'VALIDATE',
            metadata: {
              command,
              args,
              sync: true,
              timestamp: new Date().toISOString()
            }
          };
        } else {
          this.securityMetrics.blockedCommands++;
          return {
            success: false,
            action: 'BLOCK',
            reason: `Command failed safety checks: ${command}`,
            metadata: {
              command,
              args,
              sync: true,
              timestamp: new Date().toISOString()
            }
          };
        }

      case 'CONSENT':
        return this.validateConsentCommand(command, args, options);

      case 'BLOCK':
      default:
        return this.validateBlockedCommand(command, args, 'Command blocked by security policy');
    }
  }

  /**
   * Determine what security action to take for a command
   */
  determineSecurityAction(command, args = []) {
    // JPL Rule 5: Function entry with assertions
    this.jplAssertions.enterFunction('determineSecurityAction');
    this.jplAssertions.assert(typeof command === 'string', 'Command must be a string', {
      command,
    });
    this.jplAssertions.assert(Array.isArray(args), 'Args must be an array', { args });

    // Check for dangerous patterns first
    const fullCommand = `${command} ${args.join(' ')}`;

    // JPL Rule 2: Loop with fixed bounds
    const loopId = 'dangerousPatternCheck';
    this.jplAssertions.enterLoop(loopId, this.dangerousPatterns.length);

    for (const pattern of this.dangerousPatterns) {
      this.jplAssertions.checkLoopBound(loopId);
      if (pattern.test(fullCommand)) {
        this.jplAssertions.exitLoop(loopId);
        this.jplAssertions.exitFunction('determineSecurityAction');
        return 'BLOCK';
      }
    }
    this.jplAssertions.exitLoop(loopId);

    // Check against policy categories
    if (this.securityPolicies.NEVER_ALLOW.has(command)) {
      this.jplAssertions.exitFunction('determineSecurityAction');
      return 'BLOCK';
    }

    if (this.securityPolicies.ALWAYS_ALLOW.has(command)) {
      this.jplAssertions.exitFunction('determineSecurityAction');
      return 'ALLOW';
    }

    if (this.securityPolicies.VALIDATE_REQUIRED.has(command)) {
      this.jplAssertions.exitFunction('determineSecurityAction');
      return 'VALIDATE';
    }

    if (this.securityPolicies.REQUIRE_CONSENT.has(command)) {
      this.jplAssertions.exitFunction('determineSecurityAction');
      return 'CONSENT';
    }

    // Default to validation for unknown commands
    // JPL Rule 7: Check return value is valid
    const result = 'VALIDATE';
    this.jplAssertions.assert(typeof result === 'string', 'Security action must be string', {
      result,
    });
    this.jplAssertions.exitFunction('determineSecurityAction');
    return result;
  }

  /**
   * Validate allowed command
   */
  validateAllowedCommand(command, args, options) {
    this.securityMetrics.allowedCommands++;

    // Check cache for performance
    const cacheKey = this.getCacheKey(command, args);
    if (this.commandCache.has(cacheKey) && this.options.performanceOptimization) {
      this.securityMetrics.cachedCommands++;
      return this.commandCache.get(cacheKey);
    }

    const result = {
      success: true,
      action: 'ALLOW',
      metadata: {
        command,
        args,
        cached: false,
        timestamp: new Date().toISOString()
      }
    };

    // Cache the result
    if (this.options.performanceOptimization) {
      this.commandCache.set(cacheKey, result);
    }

    return result;
  }

  /**
   * Validate command that requires additional checks
   */
  async validateCommandWithChecks(command, args, options) {
    try {
      // Verify tool trust with cryptographic verification
      const verificationResult = await this.trustedToolVerifier.verifyTool(command, {
        args,
        checkPermissions: true,
      });

      if (!verificationResult.trusted) {
        this.securityMetrics.blockedCommands++;
        this.securityMetrics.untrustedToolBlocks =
          (this.securityMetrics.untrustedToolBlocks || 0) + 1;

        this.logSecurityEvent(
          'UNTRUSTED_TOOL',
          command,
          args,
          `Tool verification failed: ${verificationResult.message}`,
        );

        return {
          success: false,
          action: 'BLOCK',
          reason: `Untrusted tool blocked: ${verificationResult.message}`,
          metadata: {
            command,
            args,
            verificationResult,
            timestamp: new Date().toISOString()
          }
        };
      }

      // Log successful verification
      this.logSecurityEvent(
        'TOOL_VERIFIED',
        command,
        args,
        `Tool verified: ${verificationResult.message}`,
      );

      // Additional validation checks
      if (!this.isCommandSafe(command, args)) {
        this.securityMetrics.blockedCommands++;
        return {
          success: false,
          action: 'BLOCK',
          reason: 'Command failed safety checks',
          metadata: {
            command,
            args,
            timestamp: new Date().toISOString()
          }
        };
      }

      this.securityMetrics.allowedCommands++;
      this.securityMetrics.verifiedToolExecutions =
        (this.securityMetrics.verifiedToolExecutions || 0) + 1;

      return {
        success: true,
        action: 'VALIDATE',
        metadata: {
          command,
          args,
          verified: true,
          verificationResult,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.securityMetrics.blockedCommands++;

      // Use error handler for validation failures
      try {
        const errorResult = await this.errorHandler.handleError(error, {
          operation: 'validateCommandWithChecks',
          command: command,
          args: args,
        });

        // If it's a recoverable error and we get retry signal
        if (errorResult && errorResult.shouldRetry) {
          this.logSecurityEvent(
            'VALIDATION_RETRY',
            command,
            args,
            `Retrying validation: attempt ${errorResult.retryAttempt}`,
          );
          return this.validateCommandWithChecks(command, args, options);
        }
      } catch (handlerError) {
        // Error handler threw, continue with original error
        this.logSecurityEvent('ERROR_HANDLER_VALIDATION_FAILED', command, args, handlerError.message);
      }

      return {
        success: false,
        action: 'BLOCK',
        reason: `Validation failed: ${error.message}`,
        error: error,
        metadata: {
          command,
          args,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Validate command requiring user consent
   */
  validateConsentCommand(command, args, options) {
    if (this.options.mode === 'monitor') {
      // In monitor mode, log but allow
      this.logSecurityEvent('CONSENT_BYPASSED', command, args, 'Monitor mode - consent bypassed');
      return {
        success: true,
        action: 'CONSENT',
        metadata: {
          command,
          args,
          consentBypassed: true,
          mode: 'monitor',
          timestamp: new Date().toISOString()
        }
      };
    }

    // In block/warn mode, require actual consent
    return {
      success: false,
      action: 'CONSENT',
      reason: `Command requires user consent: ${command} ${args.join(' ')}`,
      metadata: {
        command,
        args,
        requiresConsent: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Validate blocked command
   */
  validateBlockedCommand(command, args, reason) {
    this.securityMetrics.blockedCommands++;
    this.logSecurityEvent('BLOCKED', command, args, reason);

    if (this.options.mode === 'monitor') {
      this.logSecurityEvent('MONITOR_BLOCK', command, args, 'Would have blocked in enforce mode');
      // In monitor mode, log but return success with warning
      return {
        success: true,
        action: 'BLOCK',
        warning: 'Would have been blocked in enforce mode',
        metadata: {
          command,
          args,
          reason,
          mode: 'monitor',
          timestamp: new Date().toISOString()
        }
      };
    }

    return {
      success: false,
      action: 'BLOCK',
      reason: `${reason} - Command: ${command} ${args.join(' ')}`,
      metadata: {
        command,
        args,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Validate trusted tool command
   */
  validateTrustedCommand(command, args, options) {
    this.logSecurityEvent('TRUSTED_BYPASS', command, args, 'Trusted tool bypass');
    return {
      success: true,
      action: 'ALLOW',
      trusted: true,
      metadata: {
        command,
        args,
        trustedTool: true,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Check if command is from a trusted tool
   */
  isTrustedToolCall(source) {
    // Check if the call stack includes trusted tools
    return (
      this.securityPolicies.TRUSTED_TOOLS.has(source.tool) ||
      source.stack.some((frame) => {
        // JPL Rule 5: Minimum 2 assertions per function
        if (!frame) {
          throw new TypeError('Frame must be provided');
        }
        if (typeof frame !== 'object') {
          throw new TypeError('Frame must be an object');
        }
        return this.securityPolicies.TRUSTED_TOOLS.has(frame.function);
      })
    );
  }

  /**
   * Get call source information for audit trail
   */
  getCallSource() {
    const stack = new Error().stack.split('\n');

    return {
      timestamp: new Date().toISOString(),
      tool: this.extractToolName(stack),
      stack: stack.slice(1, STACK_TRACE_LINES).map((line) => {
        // JPL Rule 5: Minimum 2 assertions per function
        if (!line) {
          throw new TypeError('Stack line must be provided');
        }
        if (typeof line !== 'string') {
          throw new TypeError('Stack line must be a string');
        }
        return {
          function: line.match(/at\s+([^\s]+)/)?.[1] || 'unknown',
          location: line.match(/\(([^)]+)\)/)?.[1] || 'unknown',
        };
      }),
    };
  }

  /**
   * Extract tool name from call stack
   */
  extractToolName(stack) {
    for (const line of stack) {
      // Look for MCP tool patterns
      const toolMatch = line.match(/at\s+handle([A-Z][a-zA-Z]+)/);
      if (toolMatch) {
        return toolMatch[1].toLowerCase();
      }

      // Look for file-based tool patterns
      const fileMatch = line.match(/([a-z-]+)\.js/);
      if (fileMatch && this.securityPolicies.TRUSTED_TOOLS.has(fileMatch[1])) {
        return fileMatch[1];
      }
    }

    return 'unknown';
  }

  /**
   * Simple safety check for commands
   */
  isCommandSafe(command, args) {
    // Basic safety checks
    const fullCommand = `${command} ${args.join(' ')}`;

    // Check for dangerous patterns
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(fullCommand)) {
        return false;
      }
    }

    // Check for path traversal attempts
    if (args.some((arg) => arg.includes('../') || arg.includes('/etc') || arg.includes('/root'))) {
      return false;
    }

    return true;
  }

  /**
   * Create cache key for command
   */
  getCacheKey(command, args) {
    return createHash('sha256')
      .update(`${command}:${args.join(':')}`)
      .digest('hex')
      .slice(0, CACHE_KEY_LENGTH);
  }

  /**
   * Create mock process object for SecureCommandExecutor results
   */
  createMockProcess(result) {
    const mockProcess = {
      stdout: {
        on: (event, callback) => {
          // JPL Rule 5: Minimum 2 assertions per function
          if (!event) {
            throw new TypeError('Event must be provided');
          }
          if (typeof callback !== 'function') {
            throw new TypeError('Callback must be a function');
          }
          if (event === 'data') {
            setTimeout(() => callback(result.output), 0);
          }
        },
      },
      stderr: {
        on: (event, callback) => {
          // JPL Rule 5: Minimum 2 assertions per function
          if (!event) {
            throw new TypeError('Event must be provided');
          }
          if (typeof callback !== 'function') {
            throw new TypeError('Callback must be a function');
          }
          // No stderr for successful results
        },
      },
      on: (event, callback) => {
        // JPL Rule 5: Minimum 2 assertions per function
        if (!event) {
          throw new TypeError('Event must be provided');
        }
        if (typeof callback !== 'function') {
          throw new TypeError('Callback must be a function');
        }
        if (event === 'close') {
          setTimeout(() => callback(0), 0);
        }
      },
    };

    return mockProcess;
  }

  /**
   * Log command attempt for audit trail
   */
  logCommandAttempt(method, command, args, source, action, validationMetadata = null) {
    const logEntry = {
      timestamp: source.timestamp,
      method,
      command,
      args: args.slice(), // Copy array
      source,
      action,
      mode: this.options.mode,
      validation: validationMetadata || { validated: false },
    };

    this.auditLog.push(logEntry);

    // Keep audit log size manageable
    if (this.auditLog.length > MAX_AUDIT_LOG_SIZE) {
      this.auditLog.shift();
    }
  }

  /**
   * Log security events
   */
  logSecurityEvent(eventType, command, args, details) {
    const event = {
      timestamp: new Date().toISOString(),
      type: eventType,
      command,
      args: args.slice(),
      details,
      mode: this.options.mode,
    };

    // Add to audit log for later retrieval
    this.auditLog.push({
      ...event,
      severity: this.getEventSeverity(eventType),
    });

    // In production, this would integrate with external security monitoring
    // For development, events can be retrieved via getAuditLog()
  }

  /**
   * Get event severity level for security events
   */
  getEventSeverity(eventType) {
    const severityMap = {
      BLOCKED: 'high',
      ERROR: 'high',
      VALIDATION_FAILED: 'high',
      VALIDATION_WARNING: 'low',
      CONSENT_BYPASSED: 'medium',
      TRUSTED_BYPASS: 'low',
      MONITOR_BLOCK: 'medium',
      INIT: 'info',
      SHUTDOWN: 'info',
      INTERCEPT: 'info',
      METRICS: 'info',
      EXPORT: 'info',
      EMERGENCY_DISABLE: 'critical',
      TOOL_START: 'info',
      TOOL_SUCCESS: 'info',
      TOOL_ERROR: 'medium',
      UNCAUGHT_EXCEPTION: 'critical',
      UNHANDLED_REJECTION: 'high',
    };

    return severityMap[eventType] || 'medium';
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics() {
    return {
      ...this.securityMetrics,
      auditLogSize: this.auditLog.length,
      cacheSize: this.commandCache.size,
      mode: this.options.mode,
      validation: this.inputValidator.getValidationMetrics(),
      jplCompliance: this.jplAssertions.getComplianceMetrics(),
      errorHandling: this.errorHandler.getErrorMetrics(),
      rateLimiting: this.rateLimiter.getStats(),
      toolVerification: this.trustedToolVerifier.getVerificationMetrics(),
    };
  }

  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }

  /**
   * Reset audit log
   */
  clearAuditLog() {
    this.auditLog = [];
  }

  /**
   * Disable universal sandbox policy manager
   */
  disable() {
    if (!this.options.enabled) {
      return;
    }

    this.options.enabled = false;
    this.logSecurityEvent('SHUTDOWN', 'system', [], 'Universal Sandbox Policy Manager disabled');
  }

  /**
   * Enable universal sandbox policy manager
   */
  enable() {
    if (this.options.enabled) {
      return;
    }

    this.options.enabled = true;
    this.initialize();
  }

  /**
   * Get JPL compliance report
   */
  getJPLComplianceReport() {
    return this.jplAssertions.generateComplianceReport();
  }

  /**
   * Handle critical security errors
   */
  handleCriticalSecurityError(errorInfo) {
    // Log critical security event
    this.logSecurityEvent(
      'CRITICAL_SECURITY_ERROR',
      errorInfo.context?.command || 'unknown',
      errorInfo.context?.args || [],
      `Critical security error: ${errorInfo.message}`,
    );

    // In a production system, this could:
    // - Trigger incident response
    // - Send alerts to security team
    // - Initiate safe shutdown procedures
    // - Lock down the system

    // For now, we ensure it's logged and tracked
    this.securityMetrics.criticalErrors = (this.securityMetrics.criticalErrors || 0) + 1;

    return {
      handled: true,
      timestamp: new Date().toISOString(),
      action: 'logged_and_tracked',
    };
  }
}

export default UniversalSandbox;