import { spawn } from 'child_process';
import { resolve, dirname, join, relative } from 'path';
import { promises as fs } from 'fs';
import { createHash } from 'crypto';

// Store process reference at module level to avoid conflicts
const nodeProcess = process;

/**
 * Enhanced Secure Command Executor with development tool support
 * Features: Dynamic command learning, privacy-first filtering, adaptive security
 */
export class EnhancedSecureCommandExecutor {
  constructor(workspaceRoot = nodeProcess.cwd(), options = {}) {
    this.workspaceRoot = resolve(workspaceRoot);
    this.options = {
      securityLevel: 'DEVELOPMENT', // STRICT, BALANCED, DEVELOPMENT, PERMISSIVE
      enableLearning: true,
      enableAuditing: true,
      enableContentFiltering: true,
      maxOutputSize: 10 * 1024 * 1024, // 10MB for development
      timeoutMs: 60000, // 60 seconds for builds
      policyManager: null,
      userConsentStorage: null, // For persistent consent
      ...options
    };
    
    this.auditLog = [];
    this.learnedCommands = new Set();
    this.userConsents = new Map(); // command -> { granted: boolean, timestamp: Date }
    this.initializeSecurityConfig();
    this.loadLearnedCommands();
  }
  
  /**
   * Enhanced security configuration with development support
   */
  initializeSecurityConfig() {
    const configs = {
      STRICT: {
        requireConsent: true,
        commandCategories: ['FILESYSTEM'],
        contentFiltering: true,
        pathRestrictions: true,
        allowedExtensions: ['.js', '.ts', '.json', '.md', '.txt']
      },
      BALANCED: {
        requireConsent: false,
        commandCategories: ['FILESYSTEM', 'UTILITIES'],
        contentFiltering: true,
        pathRestrictions: true,
        allowedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.json', '.md', '.txt', '.css', '.html']
      },
      DEVELOPMENT: {
        requireConsent: true, // For new commands only
        commandCategories: ['FILESYSTEM', 'UTILITIES', 'PACKAGE_MANAGERS', 'RUNTIMES', 'TESTING', 'LINTING', 'BUILD_TOOLS', 'GIT', 'DOCKER', 'RUST', 'CARGO'],
        contentFiltering: true,
        pathRestrictions: true,
        allowedExtensions: null, // All extensions for development
        outputSanitization: true
      },
      PERMISSIVE: {
        requireConsent: false,
        commandCategories: ['ALL'],
        contentFiltering: false,
        pathRestrictions: false,
        allowedExtensions: null
      }
    };
    
    this.securityConfig = configs[this.options.securityLevel] || configs.DEVELOPMENT;
  }
  
  /**
   * Command categories with their allowed commands and arguments
   */
  getCommandCategories() {
    return {
      FILESYSTEM: {
        'grep': ['-r', '-i', '-n', '--include', '--exclude', '-l', '-c', '-v', '-E', '-F', '-o', '-A', '-B', '-C'],
        'find': ['-name', '-type', '-maxdepth', '-mtime', '-size', '-newer'],
        'ls': ['-la', '-lh', '-R', '-t', '-S', '-1'],
        'cat': ['-n'],
        'head': ['-n'],
        'tail': ['-n', '-f'],
        'wc': ['-l', '-w', '-c'],
        'sort': ['-r', '-n', '-k'],
        'uniq': ['-c']
      },
      UTILITIES: {
        'echo': [],
        'pwd': [],
        'which': [],
        'whoami': [],
        'date': [],
        'du': ['-sh', '-h'],
        'df': ['-h']
      },
      PACKAGE_MANAGERS: {
        'npm': ['install', 'run', 'test', 'build', 'start', 'lint', 'audit', 'list', 'outdated', 'update', '--version'],
        'bun': ['install', 'run', 'test', 'build', 'start', 'lint', 'audit', 'list', 'outdated', 'update', '--version'],
        'yarn': ['install', 'run', 'test', 'build', 'start', 'lint', 'audit', 'list', 'outdated', 'upgrade', '--version'],
        'pnpm': ['install', 'run', 'test', 'build', 'start', 'lint', 'audit', 'list', 'outdated', 'update', '--version'],
        'deno': ['run', 'test', 'lint', 'fmt', 'cache', 'info', '--version']
      },
      RUNTIMES: {
        'node': ['--version', '-v', '-e', '-p'],
        'bun': ['--version', '-v', '-e', '-p'],
        'python': ['--version', '-V', '-c'],
        'python3': ['--version', '-V', '-c']
      },
      TESTING: {
        'jest': ['--version', '--config', '--passWithNoTests'],
        'vitest': ['--version', '--config', '--run'],
        'mocha': ['--version', '--config'],
        'tap': ['--version'],
        'cypress': ['--version'],
        'playwright': ['--version']
      },
      LINTING: {
        'eslint': ['--version', '--fix', '--config', '--ext'],
        'prettier': ['--version', '--write', '--check', '--config'],
        'tsc': ['--version', '--noEmit', '--project'],
        'ruff': ['--version', 'check', 'format'],
        'black': ['--version', '--check'],
        'flake8': ['--version']
      },
      BUILD_TOOLS: {
        'webpack': ['--version', '--config'],
        'vite': ['--version', 'build', 'dev'],
        'rollup': ['--version', '--config'],
        'esbuild': ['--version', '--bundle']
      },
      GIT: {
        'git': ['status', 'log', 'diff', 'branch', 'show', '--version']
      },
      DOCKER: {
        'docker': ['--version', 'ps', 'images', 'build', 'run', 'stop', 'start', 'restart', 'logs', 'exec', 'pull', 'push',
          '--tail', '-f', '--follow', '--since', '--until', '--timestamps', '-t', '-a', '--all', '-q', '--quiet',
          // Docker Compose v2 subcommand and its options
          'compose', 'up', 'down', 'create', 'rm', 'kill', 'pause', 'unpause',
          '-d', '--detach', '--remove-orphans', '--no-color', '--quiet-pull', '--force-recreate'],
        'docker-compose': ['--version', 'up', 'down', 'build', 'ps', 'logs', 'exec', 'restart', 'stop', 'start', 
          '-d', '--detach', '--tail', '-f', '--follow', 'pull', 'rm', 'kill', 'create', 'pause', 'unpause',
          '--remove-orphans', '--no-color', '--quiet-pull', '--force-recreate'],
        'docker-machine': ['--version', 'ls', 'status', 'start', 'stop', 'restart']
      },
      RUST: {
        'rustc': ['--version', '-V', '--print'],
        'rustup': ['--version', 'show', 'update', 'toolchain', 'component', 'target'],
        'rustfmt': ['--version', '--check'],
        'clippy': ['--version']
      },
      CARGO: {
        'cargo': ['--version', '-V', 'build', 'check', 'test', 'run', 'clean', 'doc', 'new', 'init', 
          'add', 'remove', 'search', 'publish', 'install', 'uninstall', 'bench', 'update', 
          'fetch', 'package', 'generate-lockfile', 'locate-project', 'metadata', 'tree',
          'verify-project', 'version', 'yank', 'owner', 'login', 'logout', 'publish',
          'fix', 'fmt', 'clippy', 'audit', 'outdated',
          '--release', '--debug', '--verbose', '--quiet', '--features', '--all-features', 
          '--no-default-features', '--target', '--lib', '--bin', '--example', '--test', 
          '--bench', '--all', '--workspace', '--package', '--exclude', '--manifest-path',
          '--frozen', '--locked', '--offline', '--config']
      }
    };
  }
  
  /**
   * Get allowed commands based on security level
   */
  getAllowedCommands() {
    const categories = this.getCommandCategories();
    const allowedCommands = {};
    
    if (this.securityConfig.commandCategories.includes('ALL')) {
      return Object.assign({}, ...Object.values(categories));
    }
    
    for (const category of this.securityConfig.commandCategories) {
      if (categories[category]) {
        Object.assign(allowedCommands, categories[category]);
      }
    }
    
    // Add learned commands
    for (const command of this.learnedCommands) {
      if (!allowedCommands[command]) {
        allowedCommands[command] = []; // Allow all args for learned commands
      }
    }
    
    return allowedCommands;
  }
  
  /**
   * Enhanced sensitive patterns with development context
   */
  getSensitivePatterns() {
    return [
      // API Keys and tokens
      /api[_-]?key[_-]?[=:]\s*['""]?([a-zA-Z0-9]{20,})['""]?/gi,
      /access[_-]?token[_-]?[=:]\s*['""]?([a-zA-Z0-9]{20,})['""]?/gi,
      /secret[_-]?key[_-]?[=:]\s*['""]?([a-zA-Z0-9]{20,})['""]?/gi,
      
      // Passwords
      /password[_-]?[=:]\s*['""]?([^'"\s]{6,})['""]?/gi,
      /passwd[_-]?[=:]\s*['""]?([^'"\s]{6,})['""]?/gi,
      
      // Database URLs
      /mongodb:\/\/[^\s]+/gi,
      /postgres:\/\/[^\s]+/gi,
      /mysql:\/\/[^\s]+/gi,
      
      // Personal data
      /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
      /\b\d{3}-\d{2}-\d{4}\b/g,
      
      // JWT tokens
      /eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g,
      
      // Private keys
      /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/gi,
      
      // AWS keys
      /AKIA[0-9A-Z]{16}/g,
      
      // GitHub tokens
      /ghp_[a-zA-Z0-9]{36}/g,
      /gho_[a-zA-Z0-9]{36}/g,
      /ghu_[a-zA-Z0-9]{36}/g,
      
      // Absolute paths (privacy - only show relative paths)
      new RegExp(`${this.workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g'),
      
      // Common private directories
      /\/Users\/[^\s\/]+/g,
      /\/home\/[^\s\/]+/g,
      /C:\\Users\\[^\s\\]+/g
    ];
  }
  
  /**
   * Smart output sanitization for development
   */
  sanitizeOutput(output) {
    if (!this.securityConfig.outputSanitization) {
      return output;
    }
    
    let sanitized = output;
    
    // Replace absolute paths with relative paths
    const workspaceRegex = new RegExp(this.workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    sanitized = sanitized.replace(workspaceRegex, '.');
    
    // Filter sensitive data
    if (this.securityConfig.contentFiltering) {
      const patterns = this.getSensitivePatterns();
      patterns.forEach(pattern => {
        sanitized = sanitized.replace(pattern, '[REDACTED]');
      });
    }
    
    return sanitized;
  }
  
  /**
   * Check if command requires user consent
   */
  async needsUserConsent(command, args) {
    const commandKey = `${command} ${args.join(' ')}`;
    
    // Check if we already have consent for this command
    if (this.userConsents.has(commandKey)) {
      const consent = this.userConsents.get(commandKey);
      // Consent expires after 24 hours
      if (Date.now() - consent.timestamp < 24 * 60 * 60 * 1000) {
        return !consent.granted;
      }
    }
    
    // New commands always need consent in development mode
    if (this.options.securityLevel === 'DEVELOPMENT') {
      const allowedCommands = this.getAllowedCommands();
      if (!allowedCommands[command]) {
        return true;
      }
    }
    
    // Certain operations always need consent
    const sensitiveOperations = [
      'npm install', 'bun install', 'yarn install', 'pnpm install', // Package installs
      'rm', 'rmdir', 'del', // Deletion commands
      'git push', 'git commit', // Git operations
    ];
    
    for (const op of sensitiveOperations) {
      if (commandKey.startsWith(op)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Grant user consent for a command
   */
  grantConsent(command, args) {
    const commandKey = `${command} ${args.join(' ')}`;
    this.userConsents.set(commandKey, {
      granted: true,
      timestamp: Date.now()
    });
    
    // Learn the command if it's not already known
    if (!this.getAllowedCommands()[command]) {
      this.learnCommand(command);
    }
  }
  
  /**
   * Learn a new command
   */
  learnCommand(command) {
    if (!this.options.enableLearning) {
      return;
    }
    
    this.learnedCommands.add(command);
    this.saveLearnedCommands();
  }
  
  /**
   * Load learned commands from storage
   */
  async loadLearnedCommands() {
    try {
      const learningFile = join(this.workspaceRoot, '.moidvk-learned-commands.json');
      const data = await fs.readFile(learningFile, 'utf8');
      const learned = JSON.parse(data);
      this.learnedCommands = new Set(learned.commands || []);
    } catch (error) {
      // File doesn't exist yet, that's okay
    }
  }
  
  /**
   * Save learned commands to storage
   */
  async saveLearnedCommands() {
    try {
      const learningFile = join(this.workspaceRoot, '.moidvk-learned-commands.json');
      const data = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        commands: Array.from(this.learnedCommands)
      };
      await fs.writeFile(learningFile, JSON.stringify(data, null, 2));
    } catch (error) {
      // Ignore save errors
    }
  }
  
  /**
   * Validate command with enhanced logic
   */
  validateCommand(command, args) {
    const allowedCommands = this.getAllowedCommands();
    
    if (!allowedCommands[command]) {
      const availableCategories = Object.keys(this.getCommandCategories());
      throw new Error(`Command '${command}' is not allowed. Available categories: ${availableCategories.join(', ')}`);
    }
    
    const allowedArgs = allowedCommands[command];
    
    // If it's a learned command, allow all args
    if (this.learnedCommands.has(command)) {
      return true;
    }
    
    // Check arguments for predefined commands
    if (allowedArgs && allowedArgs.length > 0) {
      for (const arg of args) {
        // For docker-compose, cargo, and similar commands, check all args (including subcommands)
        // For other commands, only check flags (starting with -)
        const shouldCheckArg = ['docker-compose', 'docker', 'git', 'cargo'].includes(command) || arg.startsWith('-');
        
        if (shouldCheckArg && !allowedArgs.includes(arg)) {
          throw new Error(`Argument '${arg}' is not allowed for command '${command}'. Allowed: ${allowedArgs.join(', ')}`);
        }
      }
    }
    
    return true;
  }
  
  /**
   * Enhanced execution with development support
   */
  async execute(command, args, options = {}) {
    let paths = [];
    let output = '';
    let success = false;
    
    // Input validation
    if (!command || typeof command !== 'string') {
      throw new Error('Command must be a non-empty string');
    }
    
    if (!Array.isArray(args)) {
      throw new Error('Args must be an array');
    }
    
    try {
      // Check if user consent is required
      if (await this.needsUserConsent(command, args)) {
        return {
          requiresConsent: true,
          operation: `${command} ${args.join(' ')}`,
          message: `Command '${command}' requires user consent. This helps maintain security while allowing development flexibility.`,
          securityLevel: this.options.securityLevel,
          commandCategory: this.getCommandCategory(command),
          isLearned: this.learnedCommands.has(command)
        };
      }
      
      // Validate command
      this.validateCommand(command, args);
      
      // Extract paths (for file operations)
      paths = this.extractPaths(args);
      
      // Execute command
      output = await this.executeCommand(command, args);
      
      // Sanitize output
      const sanitized = this.sanitizeOutput(output);
      
      success = true;
      
      // Log execution
      this.logExecution(command, args, paths, success, sanitized);
      
      return {
        success: true,
        output: sanitized,
        command,
        args,
        paths: paths.map(p => {
          try {
            return relative(this.workspaceRoot, p);
          } catch {
            return p;
          }
        }),
        securityLevel: this.options.securityLevel,
        contentFiltered: this.securityConfig.contentFiltering,
        outputSanitized: this.securityConfig.outputSanitization,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logExecution(command, args, paths, false, '', error.message);
      throw new Error(`Secure execution failed: ${error.message}`);
    }
  }
  
  /**
   * Get command category for a given command
   */
  getCommandCategory(command) {
    const categories = this.getCommandCategories();
    for (const [category, commands] of Object.entries(categories)) {
      if (commands[command]) {
        return category;
      }
    }
    return this.learnedCommands.has(command) ? 'LEARNED' : 'UNKNOWN';
  }
  
  /**
   * Extract file paths from arguments
   */
  extractPaths(args) {
    const paths = [];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('-')) {
        // Skip flags and their values
        if (['-n', '--include', '--exclude', '--config', '--ext'].includes(arg)) {
          i++; // Skip next argument
        }
        continue;
      }
      
      // Check if it looks like a file path
      if (arg.includes('/') || arg.includes('\\') || arg.includes('.')) {
        paths.push(arg);
      }
    }
    
    return paths;
  }
  
  /**
   * Execute command with enhanced error handling
   */
  async executeCommand(command, args) {
    return new Promise((resolve, reject) => {
      const childProcess = spawn(command, args, {
        cwd: this.workspaceRoot,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...nodeProcess.env, NODE_ENV: 'development' }
      });
      
      let stdout = '';
      let stderr = '';
      
      childProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        
        if (stdout.length > this.options.maxOutputSize) {
          childProcess.kill();
          reject(new Error(`Output size limit exceeded (${this.options.maxOutputSize} bytes)`));
        }
      });
      
      childProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeout = setTimeout(() => {
        childProcess.kill();
        reject(new Error(`Command execution timeout (${this.options.timeoutMs}ms)`));
      }, this.options.timeoutMs);
      
      childProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          resolve(stdout);
        } else {
          // Include stderr in error for debugging
          reject(new Error(`Command failed with code ${code}: ${stderr || 'No error output'}`));
        }
      });
      
      childProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Command execution error: ${error.message}`));
      });
    });
  }
  
  /**
   * Enhanced logging with development context
   */
  logExecution(command, args, paths, success, output = '', error = '') {
    if (!this.options.enableAuditing) {
      return;
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      command,
      args: args.join(' '),
      paths: paths.map(p => {
        try {
          return relative(this.workspaceRoot, p);
        } catch {
          return p;
        }
      }),
      success,
      outputSize: output.length,
      errorMessage: error,
      securityLevel: this.options.securityLevel,
      commandCategory: this.getCommandCategory(command),
      isLearned: this.learnedCommands.has(command),
      hash: createHash('sha256').update(`${command}${args.join('')}${Date.now()}`).digest('hex').slice(0, 8)
    };
    
    this.auditLog.push(logEntry);
    
    // Keep last 2000 entries for development
    if (this.auditLog.length > 2000) {
      this.auditLog.shift();
    }
  }
  
  /**
   * Get statistics about learned commands
   */
  getLearnedCommandsStats() {
    const categories = this.getCommandCategories();
    const stats = {
      total: this.learnedCommands.size,
      commands: Array.from(this.learnedCommands),
      categories: {}
    };
    
    for (const command of this.learnedCommands) {
      const category = this.getCommandCategory(command);
      stats.categories[category] = (stats.categories[category] || 0) + 1;
    }
    
    return stats;
  }
  
  /**
   * Reset learned commands
   */
  async resetLearning() {
    this.learnedCommands.clear();
    this.userConsents.clear();
    await this.saveLearnedCommands();
  }
  
  /**
   * Get enhanced audit log
   */
  getAuditLog() {
    return {
      entries: this.auditLog,
      stats: {
        totalCommands: this.auditLog.length,
        successRate: this.auditLog.length > 0 ? 
          (this.auditLog.filter(e => e.success).length / this.auditLog.length * 100).toFixed(1) + '%' : 'N/A',
        learnedCommands: this.getLearnedCommandsStats()
      }
    };
  }
}