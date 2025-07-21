import { resolve, normalize } from 'path';
import { createHash } from 'crypto';

/**
 * Enhanced Input Validation for Security-Critical Operations
 * Provides comprehensive validation for commands, arguments, and data inputs
 * Following defense-in-depth security principles
 */
export class InputValidator {
  constructor(options = {}) {
    this.options = {
      maxCommandLength: 1000,
      maxArgLength: 500,
      maxTotalArgs: 50,
      maxPathDepth: 10,
      allowUnicode: false,
      strictMode: true,
      ...options,
    };
    
    this.initializeValidationRules();
  }

  /**
   * Initialize validation rules and patterns
   */
  initializeValidationRules() {
    // Command injection patterns
    this.injectionPatterns = [
      // Shell metacharacters
      /[;&|`$(){}[\]<>'"\\]/,
      // Command substitution
      /\$\([^)]*\)/,
      /`[^`]*`/,
      // Redirection operators
      /[<>]+/,
      // Null bytes
      /\x00/,
      // Unicode control characters
      /[\u0000-\u001F\u007F-\u009F]/,
      // ANSI escape sequences
      /\x1b\[[0-9;]*[a-zA-Z]/,
    ];

    // Path traversal patterns
    this.pathTraversalPatterns = [
      /\.\./,
      /\/\.\//,
      /\\\.\\/, 
      /~\//,
      /\$[A-Z_]+/,
      /%[0-9a-fA-F]{2}/,
    ];

    // Dangerous file extensions
    this.dangerousExtensions = new Set([
      '.exe', '.bat', '.cmd', '.com', '.scr', '.pif',
      '.sh', '.bash', '.zsh', '.fish', '.csh', '.tcsh',
      '.ps1', '.psm1', '.psd1', '.ps1xml',
      '.js', '.vbs', '.wsf', '.wsh', '.jar',
      '.app', '.deb', '.rpm', '.dmg', '.pkg',
      '.so', '.dll', '.dylib',
    ]);

    // Sensitive directory patterns
    this.sensitiveDirectories = [
      '/etc', '/root', '/usr/bin', '/usr/sbin', '/bin', '/sbin',
      '/home', '/Users', '/var/log', '/var/run', '/tmp', '/temp',
      'C:\\Windows', 'C:\\Program Files', 'C:\\Users',
      '.ssh', '.aws', '.docker', '.kube', '.config',
    ];

    // Valid command character set (alphanumeric + safe symbols)
    this.validCommandChars = /^[a-zA-Z0-9_\-\.\/]+$/;
    
    // Valid argument character set (more permissive but still safe)
    this.validArgChars = /^[a-zA-Z0-9_\-\.\/\s=:@+,]+$/;
  }

  /**
   * Comprehensive command validation
   */
  validateCommand(command) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: command,
    };

    // 1. Null/undefined check
    if (!command || typeof command !== 'string') {
      validationResult.isValid = false;
      validationResult.errors.push('Command must be a non-empty string');
      return validationResult;
    }

    // 2. Length validation
    if (command.length > this.options.maxCommandLength) {
      validationResult.isValid = false;
      validationResult.errors.push(`Command exceeds maximum length of ${this.options.maxCommandLength} characters`);
    }

    // 3. Character set validation
    if (!this.validCommandChars.test(command)) {
      validationResult.isValid = false;
      validationResult.errors.push('Command contains invalid characters');
    }

    // 4. Injection pattern detection
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(command)) {
        validationResult.isValid = false;
        validationResult.errors.push(`Command contains potential injection pattern: ${pattern.source}`);
      }
    }

    // 5. Whitespace validation
    const trimmedCommand = command.trim();
    if (trimmedCommand !== command) {
      validationResult.warnings.push('Command has leading/trailing whitespace');
      validationResult.sanitized = trimmedCommand;
    }

    // 6. Empty command check
    if (trimmedCommand.length === 0) {
      validationResult.isValid = false;
      validationResult.errors.push('Command cannot be empty');
    }

    return validationResult;
  }

  /**
   * Validate command arguments
   */
  validateArguments(args) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: [],
    };

    // 1. Array validation
    if (!Array.isArray(args)) {
      validationResult.isValid = false;
      validationResult.errors.push('Arguments must be an array');
      return validationResult;
    }

    // 2. Number of arguments validation
    if (args.length > this.options.maxTotalArgs) {
      validationResult.isValid = false;
      validationResult.errors.push(`Too many arguments: ${args.length}. Maximum allowed: ${this.options.maxTotalArgs}`);
    }

    // 3. Validate each argument
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const argResult = this.validateSingleArgument(arg, i);
      
      if (!argResult.isValid) {
        validationResult.isValid = false;
        validationResult.errors.push(...argResult.errors.map(err => `Arg[${i}]: ${err}`));
      }
      
      validationResult.warnings.push(...argResult.warnings.map(warn => `Arg[${i}]: ${warn}`));
      validationResult.sanitized.push(argResult.sanitized);
    }

    return validationResult;
  }

  /**
   * Validate a single argument
   */
  validateSingleArgument(arg, index = 0) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: arg,
    };

    // 1. Type validation
    if (typeof arg !== 'string') {
      validationResult.isValid = false;
      validationResult.errors.push('Argument must be a string');
      return validationResult;
    }

    // 2. Length validation
    if (arg.length > this.options.maxArgLength) {
      validationResult.isValid = false;
      validationResult.errors.push(`Argument exceeds maximum length of ${this.options.maxArgLength} characters`);
    }

    // 3. Character set validation (more permissive for arguments)
    if (this.options.strictMode && !this.validArgChars.test(arg)) {
      // In strict mode, only allow safe characters
      validationResult.isValid = false;
      validationResult.errors.push('Argument contains potentially unsafe characters');
    }

    // 4. Injection pattern detection
    for (const pattern of this.injectionPatterns) {
      if (pattern.test(arg)) {
        validationResult.isValid = false;
        validationResult.errors.push(`Argument contains potential injection pattern: ${pattern.source}`);
      }
    }

    // 5. Path traversal detection
    if (this.isPathArgument(arg)) {
      const pathResult = this.validatePath(arg);
      if (!pathResult.isValid) {
        validationResult.isValid = false;
        validationResult.errors.push(...pathResult.errors);
      }
      validationResult.warnings.push(...pathResult.warnings);
    }

    // 6. Sanitization
    const trimmed = arg.trim();
    if (trimmed !== arg) {
      validationResult.warnings.push('Argument has leading/trailing whitespace');
      validationResult.sanitized = trimmed;
    }

    return validationResult;
  }

  /**
   * Enhanced path validation
   */
  validatePath(inputPath) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: inputPath,
      resolvedPath: null,
    };

    try {
      // 1. Basic validation
      if (!inputPath || typeof inputPath !== 'string') {
        validationResult.isValid = false;
        validationResult.errors.push('Path must be a non-empty string');
        return validationResult;
      }

      // 2. Path traversal detection
      for (const pattern of this.pathTraversalPatterns) {
        if (pattern.test(inputPath)) {
          validationResult.isValid = false;
          validationResult.errors.push(`Path contains traversal pattern: ${pattern.source}`);
        }
      }

      // 3. Normalize and resolve path
      const normalizedPath = normalize(inputPath);
      validationResult.sanitized = normalizedPath;
      
      // 4. Check path depth
      const pathDepth = normalizedPath.split('/').length - 1;
      if (pathDepth > this.options.maxPathDepth) {
        validationResult.isValid = false;
        validationResult.errors.push(`Path depth ${pathDepth} exceeds maximum of ${this.options.maxPathDepth}`);
      }

      // 5. Sensitive directory detection
      for (const sensitiveDir of this.sensitiveDirectories) {
        if (normalizedPath.startsWith(sensitiveDir) || normalizedPath.includes(sensitiveDir)) {
          validationResult.isValid = false;
          validationResult.errors.push(`Path accesses sensitive directory: ${sensitiveDir}`);
        }
      }

      // 6. File extension validation
      const extension = this.getFileExtension(normalizedPath);
      if (extension && this.dangerousExtensions.has(extension.toLowerCase())) {
        validationResult.warnings.push(`Path has potentially dangerous extension: ${extension}`);
      }

      // 7. Resolve path for final validation
      try {
        validationResult.resolvedPath = resolve(normalizedPath);
      } catch (error) {
        validationResult.warnings.push(`Could not resolve path: ${error.message}`);
      }

    } catch (error) {
      validationResult.isValid = false;
      validationResult.errors.push(`Path validation error: ${error.message}`);
    }

    return validationResult;
  }

  /**
   * Validate complete command execution request
   */
  validateCommandExecution(command, args = [], options = {}) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: {
        command: command,
        args: args,
        options: options,
      },
      metadata: {
        validatedAt: new Date().toISOString(),
        validator: 'InputValidator',
        version: '1.0.0',
      },
    };

    // 1. Validate command
    const commandResult = this.validateCommand(command);
    if (!commandResult.isValid) {
      validationResult.isValid = false;
      validationResult.errors.push(...commandResult.errors);
    }
    validationResult.warnings.push(...commandResult.warnings);
    validationResult.sanitized.command = commandResult.sanitized;

    // 2. Validate arguments
    const argsResult = this.validateArguments(args);
    if (!argsResult.isValid) {
      validationResult.isValid = false;
      validationResult.errors.push(...argsResult.errors);
    }
    validationResult.warnings.push(...argsResult.warnings);
    validationResult.sanitized.args = argsResult.sanitized;

    // 3. Validate options
    const optionsResult = this.validateOptions(options);
    if (!optionsResult.isValid) {
      validationResult.isValid = false;
      validationResult.errors.push(...optionsResult.errors);
    }
    validationResult.warnings.push(...optionsResult.warnings);
    validationResult.sanitized.options = optionsResult.sanitized;

    // 4. Cross-validation (command + args combination)
    const crossValidationResult = this.crossValidateCommandAndArgs(
      validationResult.sanitized.command,
      validationResult.sanitized.args
    );
    if (!crossValidationResult.isValid) {
      validationResult.isValid = false;
      validationResult.errors.push(...crossValidationResult.errors);
    }
    validationResult.warnings.push(...crossValidationResult.warnings);

    // 5. Generate validation hash for audit trail
    validationResult.metadata.validationHash = this.generateValidationHash(
      validationResult.sanitized.command,
      validationResult.sanitized.args
    );

    return validationResult;
  }

  /**
   * Validate execution options
   */
  validateOptions(options) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      sanitized: { ...options },
    };

    if (typeof options !== 'object' || options === null) {
      validationResult.errors.push('Options must be an object');
      validationResult.isValid = false;
      return validationResult;
    }

    // Validate specific option properties
    const allowedOptions = ['cwd', 'env', 'timeout', 'encoding', 'maxBuffer'];
    const providedOptions = Object.keys(options);
    
    for (const option of providedOptions) {
      if (!allowedOptions.includes(option)) {
        validationResult.warnings.push(`Unknown option: ${option}`);
      }
    }

    // Validate cwd if provided
    if (options.cwd) {
      const cwdResult = this.validatePath(options.cwd);
      if (!cwdResult.isValid) {
        validationResult.isValid = false;
        validationResult.errors.push(...cwdResult.errors.map(err => `cwd: ${err}`));
      }
      validationResult.sanitized.cwd = cwdResult.sanitized;
    }

    // Validate timeout
    if (options.timeout !== undefined) {
      if (typeof options.timeout !== 'number' || options.timeout < 0 || options.timeout > 300000) {
        validationResult.errors.push('timeout must be a number between 0 and 300000ms');
        validationResult.isValid = false;
      }
    }

    return validationResult;
  }

  /**
   * Cross-validate command and arguments for logical consistency
   */
  crossValidateCommandAndArgs(command, args) {
    const validationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Command-specific validation rules
    switch (command) {
      case 'grep':
        if (args.length < 1) {
          validationResult.errors.push('grep requires at least a pattern argument');
          validationResult.isValid = false;
        }
        break;
        
      case 'find':
        if (args.length < 1) {
          validationResult.errors.push('find requires at least a path argument');
          validationResult.isValid = false;
        }
        break;
        
      case 'ls':
        // ls can work with no arguments (current directory)
        break;
        
      default:
        // Generic validation for unknown commands
        validationResult.warnings.push(`No specific validation rules for command: ${command}`);
    }

    return validationResult;
  }

  /**
   * Utility methods
   */
  isPathArgument(arg) {
    return arg.includes('/') || arg.includes('\\') || arg.startsWith('./') || arg.startsWith('../');
  }

  getFileExtension(path) {
    const lastDot = path.lastIndexOf('.');
    const lastSlash = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    
    if (lastDot > lastSlash && lastDot !== -1) {
      return path.slice(lastDot);
    }
    return null;
  }

  generateValidationHash(command, args) {
    const content = `${command}|${args.join('|')}|${Date.now()}`;
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  }

  /**
   * Get validation statistics
   */
  getValidationMetrics() {
    return {
      injectionPatterns: this.injectionPatterns.length,
      pathTraversalPatterns: this.pathTraversalPatterns.length,
      dangerousExtensions: this.dangerousExtensions.size,
      sensitiveDirectories: this.sensitiveDirectories.length,
      options: this.options,
    };
  }
}

export default InputValidator;