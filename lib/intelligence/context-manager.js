import { readFile, readdir, stat } from 'fs/promises';
import { join, dirname, basename, extname } from 'path';
import { createHash } from 'crypto';

/**
 * Context Manager for intelligent development awareness
 * Tracks project structure, session state, and development context
 */
export class ContextManager {
  constructor() {
    this.currentContext = {
      session: null,
      project: null,
      workflow: null,
      client: null,
      timestamp: Date.now(),
      history: [],
      goals: [],
      toolUsage: new Map(),
      qualityTrends: [],
    };
    
    this.contextCache = new Map();
    this.projectPatterns = new Map();
    this.sessionId = null;
  }

  /**
   * Initialize context for a new or existing session
   */
  async initializeContext(clientType, projectPath, sessionId = null) {
    this.sessionId = sessionId || this.generateSessionId();
    
    this.currentContext = {
      session: await this.createSession(this.sessionId),
      project: await this.analyzeProject(projectPath),
      workflow: await this.detectWorkflowType(projectPath),
      client: clientType,
      timestamp: Date.now(),
      history: [],
      goals: [],
      toolUsage: new Map(),
      qualityTrends: [],
    };

    // Cache the context
    this.contextCache.set(this.sessionId, this.currentContext);
    
    return this.currentContext;
  }

  /**
   * Create a new session
   */
  async createSession(sessionId = null) {
    return {
      id: sessionId || this.generateSessionId(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      state: 'active',
      checkpoints: [],
      achievements: [],
      filesModified: new Set(),
      toolsUsed: new Set(),
      errors: [],
      insights: [],
    };
  }

  /**
   * Analyze project structure and patterns
   */
  async analyzeProject(projectPath) {
    const cacheKey = `project_${projectPath}`;
    
    // Check cache first
    if (this.contextCache.has(cacheKey)) {
      const cached = this.contextCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        return cached.data;
      }
    }

    try {
      const analysis = {
        path: projectPath,
        structure: await this.getProjectStructure(projectPath),
        dependencies: await this.analyzeDependencies(projectPath),
        patterns: await this.identifyProjectPatterns(projectPath),
        quality_baseline: await this.establishQualityBaseline(projectPath),
        git_context: await this.getGitContext(projectPath),
        framework: await this.detectFramework(projectPath),
        testingSetup: await this.detectTestingSetup(projectPath),
        buildTool: await this.detectBuildTool(projectPath),
      };

      // Cache the analysis
      this.contextCache.set(cacheKey, {
        data: analysis,
        timestamp: Date.now(),
      });

      return analysis;
    } catch (error) {
      return {
        path: projectPath,
        error: error.message,
        structure: { error: true },
      };
    }
  }

  /**
   * Get project structure overview
   */
  async getProjectStructure(projectPath) {
    const structure = {
      totalFiles: 0,
      totalDirectories: 0,
      fileTypes: new Map(),
      directories: [],
      codebaseSize: 0,
      mainLanguage: null,
    };

    try {
      await this.analyzeDirectory(projectPath, structure, 0, 3);
      
      // Determine main language
      let maxCount = 0;
      structure.fileTypes.forEach((count, ext) => {
        if (count > maxCount && ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.go'].includes(ext)) {
          maxCount = count;
          structure.mainLanguage = ext;
        }
      });

      // Convert Map to object for serialization
      structure.fileTypes = Object.fromEntries(structure.fileTypes);
      
      return structure;
    } catch (error) {
      return { ...structure, error: error.message };
    }
  }

  /**
   * Recursively analyze directory structure
   */
  async analyzeDirectory(dirPath, structure, depth, maxDepth) {
    if (depth > maxDepth) return;

    try {
      const items = await readdir(dirPath, { withFileTypes: true });
      
      for (const item of items) {
        // Skip hidden and node_modules
        if (item.name.startsWith('.') || item.name === 'node_modules') continue;
        
        const fullPath = join(dirPath, item.name);
        
        if (item.isDirectory()) {
          structure.totalDirectories++;
          structure.directories.push(item.name);
          await this.analyzeDirectory(fullPath, structure, depth + 1, maxDepth);
        } else if (item.isFile()) {
          structure.totalFiles++;
          const ext = extname(item.name);
          structure.fileTypes.set(ext, (structure.fileTypes.get(ext) || 0) + 1);
          
          const stats = await stat(fullPath);
          structure.codebaseSize += stats.size;
        }
      }
    } catch (error) {
      // Ignore permission errors
    }
  }

  /**
   * Analyze project dependencies
   */
  async analyzeDependencies(projectPath) {
    const dependencies = {
      production: {},
      development: {},
      packageManager: null,
    };

    try {
      // Check for package.json
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      
      dependencies.production = packageJson.dependencies || {};
      dependencies.development = packageJson.devDependencies || {};
      dependencies.packageManager = await this.detectPackageManager(projectPath);
      
      // Analyze dependency complexity
      dependencies.totalDependencies = 
        Object.keys(dependencies.production).length + 
        Object.keys(dependencies.development).length;
      
      return dependencies;
    } catch (error) {
      return dependencies;
    }
  }

  /**
   * Detect package manager
   */
  async detectPackageManager(projectPath) {
    try {
      // Check for lock files
      const files = await readdir(projectPath);
      
      if (files.includes('bun.lockb') || files.includes('bun.lock')) return 'bun';
      if (files.includes('yarn.lock')) return 'yarn';
      if (files.includes('pnpm-lock.yaml')) return 'pnpm';
      if (files.includes('package-lock.json')) return 'npm';
      
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Identify common project patterns
   */
  async identifyProjectPatterns(projectPath) {
    const patterns = {
      architecture: 'unknown',
      designPatterns: [],
      codeStyle: {},
      conventions: {},
    };

    try {
      const files = await readdir(projectPath);
      
      // Check for common architectures
      if (files.includes('src') && files.includes('public')) {
        patterns.architecture = 'spa';
      } else if (files.includes('pages') || files.includes('app')) {
        patterns.architecture = 'nextjs-like';
      } else if (files.includes('server.js') || files.includes('index.js')) {
        patterns.architecture = 'node-server';
      }

      // Check for common patterns
      if (files.includes('components')) patterns.designPatterns.push('component-based');
      if (files.includes('hooks')) patterns.designPatterns.push('hooks-pattern');
      if (files.includes('services')) patterns.designPatterns.push('service-layer');
      if (files.includes('controllers')) patterns.designPatterns.push('mvc');
      if (files.includes('models')) patterns.designPatterns.push('mvc');
      
      return patterns;
    } catch (error) {
      return patterns;
    }
  }

  /**
   * Establish quality baseline for the project
   */
  async establishQualityBaseline(projectPath) {
    return {
      averageFileSize: 0,
      testCoverage: 'unknown',
      documentationLevel: 'unknown',
      codeComplexity: 'unknown',
      lastAnalyzed: Date.now(),
    };
  }

  /**
   * Get git context if available
   */
  async getGitContext(projectPath) {
    try {
      const gitPath = join(projectPath, '.git');
      const gitStats = await stat(gitPath);
      
      if (gitStats.isDirectory()) {
        return {
          isGitRepo: true,
          branch: 'unknown', // Would need to read .git/HEAD
          hasUncommittedChanges: false, // Would need git status
        };
      }
    } catch (error) {
      // Not a git repo
    }
    
    return {
      isGitRepo: false,
      branch: null,
      hasUncommittedChanges: null,
    };
  }

  /**
   * Detect development workflow type
   */
  async detectWorkflowType(projectPath) {
    const indicators = {
      hasTests: false,
      hasCI: false,
      hasLinting: false,
      hasTypeScript: false,
      hasDocs: false,
    };

    try {
      const files = await readdir(projectPath);
      
      // Check for workflow indicators
      indicators.hasTests = files.some(f => 
        f.includes('test') || f.includes('spec') || f === '__tests__'
      );
      indicators.hasCI = files.some(f => 
        f === '.github' || f === '.gitlab-ci.yml' || f === '.circleci'
      );
      indicators.hasLinting = files.some(f => 
        f.includes('eslint') || f === '.eslintrc.json'
      );
      indicators.hasTypeScript = files.some(f => 
        f === 'tsconfig.json' || f.endsWith('.ts')
      );
      indicators.hasDocs = files.some(f => 
        f === 'docs' || f.includes('README')
      );
      
      // Determine workflow type
      let workflowType = 'basic';
      const score = Object.values(indicators).filter(Boolean).length;
      
      if (score >= 4) workflowType = 'professional';
      else if (score >= 2) workflowType = 'standard';
      
      return {
        type: workflowType,
        indicators,
        maturityScore: score,
      };
    } catch (error) {
      return {
        type: 'unknown',
        indicators,
        error: error.message,
      };
    }
  }

  /**
   * Detect framework being used
   */
  async detectFramework(projectPath) {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for common frameworks
      if (deps.react) return 'react';
      if (deps.vue) return 'vue';
      if (deps.angular) return 'angular';
      if (deps.svelte) return 'svelte';
      if (deps.next) return 'nextjs';
      if (deps.nuxt) return 'nuxt';
      if (deps.express) return 'express';
      if (deps.fastify) return 'fastify';
      if (deps.koa) return 'koa';
      
      return 'vanilla';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Detect testing setup
   */
  async detectTestingSetup(projectPath) {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for test frameworks
      if (deps.jest) return 'jest';
      if (deps.mocha) return 'mocha';
      if (deps.vitest) return 'vitest';
      if (deps['@testing-library/react']) return 'testing-library';
      if (deps.cypress) return 'cypress';
      if (deps.playwright) return 'playwright';
      
      // Check scripts for bun test
      if (packageJson.scripts?.test?.includes('bun test')) return 'bun';
      
      return 'none';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Detect build tool
   */
  async detectBuildTool(projectPath) {
    try {
      const packageJsonPath = join(projectPath, 'package.json');
      const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for build tools
      if (deps.webpack) return 'webpack';
      if (deps.vite) return 'vite';
      if (deps.parcel) return 'parcel';
      if (deps.rollup) return 'rollup';
      if (deps.esbuild) return 'esbuild';
      
      // Check for bun
      if (packageJson.scripts?.build?.includes('bun build')) return 'bun';
      
      return 'none';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Update context with new information
   */
  async updateContext(contextUpdate) {
    this.currentContext = {
      ...this.currentContext,
      ...contextUpdate,
      lastUpdated: Date.now(),
    };

    // Add to history
    this.currentContext.history.push({
      timestamp: Date.now(),
      update: contextUpdate,
    });

    // Update session
    if (this.currentContext.session) {
      this.currentContext.session.lastActivity = Date.now();
    }

    // Trigger context-aware tool updates
    await this.notifyContextChange();
    
    return this.currentContext;
  }

  /**
   * Track tool usage
   */
  trackToolUsage(toolName, args, result) {
    const usage = this.currentContext.toolUsage.get(toolName) || {
      count: 0,
      lastUsed: null,
      avgDuration: 0,
      errors: 0,
    };

    usage.count++;
    usage.lastUsed = Date.now();
    
    if (result.error) {
      usage.errors++;
    }

    this.currentContext.toolUsage.set(toolName, usage);
    
    // Add to session
    if (this.currentContext.session) {
      this.currentContext.session.toolsUsed.add(toolName);
    }
  }

  /**
   * Get current context
   */
  getCurrentContext() {
    return this.currentContext;
  }

  /**
   * Get context summary
   */
  getContextSummary() {
    const toolUsageArray = Array.from(this.currentContext.toolUsage.entries())
      .map(([tool, usage]) => ({ tool, ...usage }))
      .sort((a, b) => b.count - a.count);

    return {
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.currentContext.timestamp,
      projectPath: this.currentContext.project?.path,
      framework: this.currentContext.project?.framework,
      workflowType: this.currentContext.workflow?.type,
      clientType: this.currentContext.client,
      goalsCount: this.currentContext.goals.length,
      historyLength: this.currentContext.history.length,
      topTools: toolUsageArray.slice(0, 5),
      filesModified: this.currentContext.session?.filesModified.size || 0,
    };
  }

  /**
   * Create checkpoint
   */
  createCheckpoint(description = '') {
    const checkpoint = {
      id: this.generateSessionId(),
      timestamp: Date.now(),
      description,
      context: JSON.parse(JSON.stringify(this.currentContext)),
    };

    if (this.currentContext.session) {
      this.currentContext.session.checkpoints.push(checkpoint);
    }

    return checkpoint;
  }

  /**
   * Restore from checkpoint
   */
  restoreCheckpoint(checkpointId) {
    const checkpoint = this.currentContext.session?.checkpoints.find(
      cp => cp.id === checkpointId
    );

    if (checkpoint) {
      this.currentContext = checkpoint.context;
      return true;
    }

    return false;
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return createHash('sha256')
      .update(`${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Notify context change (placeholder for future implementation)
   */
  async notifyContextChange() {
    // This would notify tools that context has changed
    // For now, just log
    if (this.currentContext.session) {
      console.log(`Context updated for session ${this.sessionId}`);
    }
  }

  /**
   * Export context for persistence
   */
  exportContext() {
    return {
      sessionId: this.sessionId,
      context: this.currentContext,
      timestamp: Date.now(),
    };
  }

  /**
   * Import context from export
   */
  importContext(exportedContext) {
    this.sessionId = exportedContext.sessionId;
    this.currentContext = exportedContext.context;
    return true;
  }
}