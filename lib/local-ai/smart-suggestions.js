/**
 * Smart Suggestions Generator
 * Provides proactive development assistance based on context and patterns
 */

import { getSemanticSearch } from './semantic-search.js';

export class SmartSuggestionsGenerator {
  constructor() {
    this.semanticSearch = null;
    this.initialized = false;
    this.suggestionCache = new Map();
    this.contextHistory = [];
    this.maxHistoryLength = 50;
    
    // Suggestion types and their generators
    this.suggestionTypes = {
      next_steps: this.generateNextStepSuggestions.bind(this),
      code_improvements: this.generateCodeImprovements.bind(this),
      bug_prevention: this.generateBugPreventionSuggestions.bind(this),
      performance: this.generatePerformanceSuggestions.bind(this),
      architecture: this.generateArchitectureSuggestions.bind(this),
      testing: this.generateTestingSuggestions.bind(this),
      documentation: this.generateDocumentationSuggestions.bind(this),
      refactoring: this.generateRefactoringSuggestions.bind(this),
      security: this.generateSecuritySuggestions.bind(this),
      best_practices: this.generateBestPracticeSuggestions.bind(this),
    };
    
    // Pattern-based suggestion rules
    this.suggestionRules = {
      missing_tests: {
        pattern: /^(?!.*\.test\.|.*\.spec\.).*\.(js|ts|jsx|tsx)$/,
        suggestion: 'Consider adding unit tests for this module',
        priority: 'high',
      },
      large_function: {
        pattern: /function.*\{[\s\S]{500,}\}/,
        suggestion: 'This function might be too large. Consider breaking it down',
        priority: 'medium',
      },
      missing_error_handling: {
        pattern: /\.catch\s*\(\s*\)/,
        suggestion: 'Empty catch block detected. Add proper error handling',
        priority: 'high',
      },
      console_logs: {
        pattern: /console\.(log|warn|error|debug)/,
        suggestion: 'Remove console statements before production',
        priority: 'low',
      },
      todo_comments: {
        pattern: /\/\/\s*(TODO|FIXME|HACK|XXX)/i,
        suggestion: 'Address TODO comments before committing',
        priority: 'medium',
      },
      hardcoded_values: {
        pattern: /(api_key|password|secret)\s*=\s*["'][\w]+["']/i,
        suggestion: 'Move sensitive values to environment variables',
        priority: 'critical',
      },
      unused_imports: {
        pattern: /import\s+{\s*([^}]+)\s*}\s+from/,
        suggestion: 'Check for unused imports to reduce bundle size',
        priority: 'low',
      },
      long_lines: {
        pattern: /^.{120,}$/m,
        suggestion: 'Consider breaking long lines for better readability',
        priority: 'low',
      },
    };
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.semanticSearch = getSemanticSearch();
      await this.semanticSearch.initialize();
      this.initialized = true;
    } catch (error) {
      console.warn('SmartSuggestionsGenerator: Semantic search initialization failed:', error.message);
      // Continue without semantic search
      this.initialized = true;
    }
  }
  
  /**
   * Generate suggestions based on context
   */
  async generateSuggestions(options = {}) {
    const {
      context = {},
      files = [],
      recentActions = [],
      currentState = 'idle',
      requestedTypes = ['next_steps', 'code_improvements'],
      maxSuggestions = 10,
    } = options;
    
    await this.initialize();
    
    // Update context history
    this.updateContextHistory({
      timestamp: Date.now(),
      context,
      files,
      recentActions,
      currentState,
    });
    
    // Check cache
    const cacheKey = this.generateCacheKey(options);
    if (this.suggestionCache.has(cacheKey)) {
      const cached = this.suggestionCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 5 * 60 * 1000) { // 5 min cache
        return cached.suggestions;
      }
    }
    
    // Generate suggestions
    const suggestions = [];
    
    for (const type of requestedTypes) {
      if (this.suggestionTypes[type]) {
        const typeSuggestions = await this.suggestionTypes[type]({
          context,
          files,
          recentActions,
          currentState,
          history: this.contextHistory,
        });
        suggestions.push(...typeSuggestions);
      }
    }
    
    // Sort and limit suggestions
    const sortedSuggestions = this.prioritizeSuggestions(suggestions)
      .slice(0, maxSuggestions);
    
    // Cache results
    this.suggestionCache.set(cacheKey, {
      suggestions: sortedSuggestions,
      timestamp: Date.now(),
    });
    
    return sortedSuggestions;
  }
  
  /**
   * Generate next step suggestions
   */
  async generateNextStepSuggestions({ context, recentActions, currentState }) {
    const suggestions = [];
    
    // Based on current state
    if (currentState === 'bug_fixing') {
      suggestions.push({
        type: 'next_step',
        action: 'run_tests',
        description: 'Run tests to verify the bug fix',
        priority: 'high',
        confidence: 0.9,
        context: 'After fixing a bug, always verify with tests',
      });
    }
    
    // Based on recent actions
    if (recentActions.some(a => a.tool === 'create_file')) {
      suggestions.push({
        type: 'next_step',
        action: 'create_tests',
        description: 'Create unit tests for the new file',
        priority: 'high',
        confidence: 0.8,
        context: 'New files should have corresponding tests',
      });
    }
    
    if (recentActions.some(a => a.tool === 'update_file' && a.significant)) {
      suggestions.push({
        type: 'next_step',
        action: 'check_impacts',
        description: 'Check for impacts on dependent modules',
        priority: 'medium',
        confidence: 0.7,
        context: 'Significant changes may affect other parts',
      });
    }
    
    // Based on project state
    if (context.uncommittedChanges > 10) {
      suggestions.push({
        type: 'next_step',
        action: 'commit_changes',
        description: 'Consider committing your changes',
        priority: 'medium',
        confidence: 0.8,
        context: 'Multiple uncommitted changes detected',
      });
    }
    
    return suggestions;
  }
  
  /**
   * Generate code improvement suggestions
   */
  async generateCodeImprovements({ files, context }) {
    const suggestions = [];
    
    for (const file of files) {
      // Apply pattern-based rules
      for (const [ruleName, rule] of Object.entries(this.suggestionRules)) {
        if (file.content && rule.pattern.test(file.content)) {
          suggestions.push({
            type: 'code_improvement',
            file: file.path,
            rule: ruleName,
            description: rule.suggestion,
            priority: rule.priority,
            confidence: 0.8,
            line: this.findLineNumber(file.content, rule.pattern),
          });
        }
      }
      
      // File-specific suggestions
      if (file.path.endsWith('.js') || file.path.endsWith('.ts')) {
        if (!file.content?.includes('use strict') && !file.path.includes('.test.')) {
          suggestions.push({
            type: 'code_improvement',
            file: file.path,
            description: 'Consider adding "use strict" directive',
            priority: 'low',
            confidence: 0.6,
          });
        }
      }
      
      // Complexity-based suggestions
      const complexity = this.estimateComplexity(file.content);
      if (complexity > 20) {
        suggestions.push({
          type: 'code_improvement',
          file: file.path,
          description: 'High complexity detected. Consider refactoring',
          priority: 'medium',
          confidence: 0.7,
          metric: { complexity },
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Generate bug prevention suggestions
   */
  async generateBugPreventionSuggestions({ files, recentActions }) {
    const suggestions = [];
    
    // Check for common bug patterns
    for (const file of files) {
      if (!file.content) continue;
      
      // Null/undefined checks
      if (file.content.match(/\.\w+\s*\(/g) && !file.content.includes('?.')) {
        suggestions.push({
          type: 'bug_prevention',
          file: file.path,
          description: 'Consider using optional chaining (?.) for safer property access',
          priority: 'medium',
          confidence: 0.7,
        });
      }
      
      // Array bounds
      if (file.content.includes('[') && !file.content.includes('length')) {
        suggestions.push({
          type: 'bug_prevention',
          file: file.path,
          description: 'Ensure array bounds are checked before access',
          priority: 'medium',
          confidence: 0.6,
        });
      }
      
      // Type safety
      if (file.path.endsWith('.js') && file.content.includes('function')) {
        suggestions.push({
          type: 'bug_prevention',
          file: file.path,
          description: 'Consider migrating to TypeScript for better type safety',
          priority: 'low',
          confidence: 0.5,
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Generate performance suggestions
   */
  async generatePerformanceSuggestions({ files }) {
    const suggestions = [];
    
    for (const file of files) {
      if (!file.content) continue;
      
      // Nested loops
      if (file.content.match(/for.*\{[\s\S]*?for.*\{/)) {
        suggestions.push({
          type: 'performance',
          file: file.path,
          description: 'Nested loops detected. Consider optimization',
          priority: 'medium',
          confidence: 0.7,
        });
      }
      
      // Large arrays
      if (file.content.includes('.map(') && file.content.includes('.filter(')) {
        suggestions.push({
          type: 'performance',
          file: file.path,
          description: 'Multiple array operations. Consider combining for efficiency',
          priority: 'low',
          confidence: 0.6,
        });
      }
      
      // Repeated calculations
      if (file.content.match(/Math\.\w+\([^)]+\)/g)?.length > 5) {
        suggestions.push({
          type: 'performance',
          file: file.path,
          description: 'Consider caching repeated calculations',
          priority: 'low',
          confidence: 0.5,
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Generate architecture suggestions
   */
  async generateArchitectureSuggestions({ context, files }) {
    const suggestions = [];
    
    // Check for architectural patterns
    const hasLargeFiles = files.some(f => f.size > 10000);
    if (hasLargeFiles) {
      suggestions.push({
        type: 'architecture',
        description: 'Large files detected. Consider splitting into smaller modules',
        priority: 'medium',
        confidence: 0.8,
        files: files.filter(f => f.size > 10000).map(f => f.path),
      });
    }
    
    // Check for proper separation of concerns
    const mixedConcerns = files.filter(f => 
      f.content?.includes('database') && 
      f.content?.includes('render')
    );
    
    if (mixedConcerns.length > 0) {
      suggestions.push({
        type: 'architecture',
        description: 'Consider separating data access from presentation logic',
        priority: 'medium',
        confidence: 0.7,
        files: mixedConcerns.map(f => f.path),
      });
    }
    
    return suggestions;
  }
  
  /**
   * Generate testing suggestions
   */
  async generateTestingSuggestions({ files, context }) {
    const suggestions = [];
    
    // Find untested files
    const sourceFiles = files.filter(f => 
      (f.path.endsWith('.js') || f.path.endsWith('.ts')) &&
      !f.path.includes('.test.') &&
      !f.path.includes('.spec.') &&
      !f.path.includes('test/')
    );
    
    const testFiles = files.filter(f => 
      f.path.includes('.test.') || f.path.includes('.spec.')
    );
    
    for (const sourceFile of sourceFiles) {
      const hasTest = testFiles.some(t => 
        t.path.includes(sourceFile.path.replace(/\.(js|ts)$/, ''))
      );
      
      if (!hasTest && sourceFile.content?.includes('export')) {
        suggestions.push({
          type: 'testing',
          file: sourceFile.path,
          description: 'No test file found for this module',
          priority: 'high',
          confidence: 0.9,
          action: 'create_test_file',
        });
      }
    }
    
    // Check test coverage
    for (const testFile of testFiles) {
      if (testFile.content && !testFile.content.includes('describe')) {
        suggestions.push({
          type: 'testing',
          file: testFile.path,
          description: 'Test file missing test suites',
          priority: 'high',
          confidence: 0.8,
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Generate documentation suggestions
   */
  async generateDocumentationSuggestions({ files }) {
    const suggestions = [];
    
    for (const file of files) {
      if (!file.content) continue;
      
      // Check for JSDoc comments
      const functions = file.content.match(/function\s+\w+\s*\([^)]*\)/g) || [];
      const jsdocs = file.content.match(/\/\*\*[\s\S]*?\*\//g) || [];
      
      if (functions.length > jsdocs.length && functions.length > 2) {
        suggestions.push({
          type: 'documentation',
          file: file.path,
          description: 'Missing JSDoc comments for functions',
          priority: 'low',
          confidence: 0.7,
          metric: {
            functions: functions.length,
            documented: jsdocs.length,
          },
        });
      }
      
      // Check for README
      if (file.path === 'README.md' && file.content.length < 100) {
        suggestions.push({
          type: 'documentation',
          file: file.path,
          description: 'README file seems incomplete',
          priority: 'medium',
          confidence: 0.8,
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Generate refactoring suggestions
   */
  async generateRefactoringSuggestions({ files }) {
    const suggestions = [];
    
    for (const file of files) {
      if (!file.content) continue;
      
      // Duplicate code detection (simple)
      const lines = file.content.split('\n');
      const duplicates = this.findDuplicateBlocks(lines);
      
      if (duplicates.length > 0) {
        suggestions.push({
          type: 'refactoring',
          file: file.path,
          description: 'Duplicate code blocks detected',
          priority: 'medium',
          confidence: 0.7,
          duplicates: duplicates.length,
        });
      }
      
      // Long parameter lists
      const longParams = file.content.match(/function.*\([^)]{50,}\)/g);
      if (longParams) {
        suggestions.push({
          type: 'refactoring',
          file: file.path,
          description: 'Consider using object parameters for functions with many arguments',
          priority: 'low',
          confidence: 0.6,
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Generate security suggestions
   */
  async generateSecuritySuggestions({ files }) {
    const suggestions = [];
    
    for (const file of files) {
      if (!file.content) continue;
      
      // SQL injection risks
      if (file.content.includes('query') && file.content.includes('${')) {
        suggestions.push({
          type: 'security',
          file: file.path,
          description: 'Potential SQL injection risk. Use parameterized queries',
          priority: 'critical',
          confidence: 0.8,
        });
      }
      
      // XSS risks
      if (file.content.includes('innerHTML') || file.content.includes('dangerouslySetInnerHTML')) {
        suggestions.push({
          type: 'security',
          file: file.path,
          description: 'Potential XSS risk. Sanitize user input',
          priority: 'high',
          confidence: 0.8,
        });
      }
      
      // Hardcoded secrets
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*["'][^"']{20,}/i,
        /password\s*[:=]\s*["'][^"']+/i,
        /secret\s*[:=]\s*["'][^"']{10,}/i,
      ];
      
      for (const pattern of secretPatterns) {
        if (pattern.test(file.content)) {
          suggestions.push({
            type: 'security',
            file: file.path,
            description: 'Hardcoded secrets detected. Use environment variables',
            priority: 'critical',
            confidence: 0.9,
          });
          break;
        }
      }
    }
    
    return suggestions;
  }
  
  /**
   * Generate best practice suggestions
   */
  async generateBestPracticeSuggestions({ files, context }) {
    const suggestions = [];
    
    // Check for common best practices
    for (const file of files) {
      if (!file.content) continue;
      
      // Error handling
      if (file.content.includes('async') && !file.content.includes('try')) {
        suggestions.push({
          type: 'best_practice',
          file: file.path,
          description: 'Async functions should have error handling',
          priority: 'medium',
          confidence: 0.7,
        });
      }
      
      // Consistent naming
      if (file.content.match(/[a-z]+_[a-z]+/) && file.content.match(/[a-z]+[A-Z]/)) {
        suggestions.push({
          type: 'best_practice',
          file: file.path,
          description: 'Inconsistent naming conventions detected',
          priority: 'low',
          confidence: 0.6,
        });
      }
    }
    
    return suggestions;
  }
  
  /**
   * Prioritize suggestions based on various factors
   */
  prioritizeSuggestions(suggestions) {
    const priorityWeights = {
      critical: 10,
      high: 8,
      medium: 5,
      low: 2,
    };
    
    return suggestions.sort((a, b) => {
      const scoreA = (priorityWeights[a.priority] || 0) * (a.confidence || 0.5);
      const scoreB = (priorityWeights[b.priority] || 0) * (b.confidence || 0.5);
      return scoreB - scoreA;
    });
  }
  
  /**
   * Update context history
   */
  updateContextHistory(entry) {
    this.contextHistory.push(entry);
    if (this.contextHistory.length > this.maxHistoryLength) {
      this.contextHistory.shift();
    }
  }
  
  /**
   * Generate cache key for suggestions
   */
  generateCacheKey(options) {
    const { context, files, currentState, requestedTypes } = options;
    const fileKeys = files.map(f => `${f.path}:${f.size}`).sort().join(',');
    return `${currentState}:${requestedTypes.join(',')}:${fileKeys}:${context.projectType || 'unknown'}`;
  }
  
  /**
   * Find line number for pattern match
   */
  findLineNumber(content, pattern) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (pattern.test(lines[i])) {
        return i + 1;
      }
    }
    return null;
  }
  
  /**
   * Estimate code complexity
   */
  estimateComplexity(content) {
    if (!content) return 0;
    
    let complexity = 1;
    
    // Count decision points
    const decisionPatterns = [
      /if\s*\(/g,
      /else\s+if\s*\(/g,
      /switch\s*\(/g,
      /case\s+/g,
      /while\s*\(/g,
      /for\s*\(/g,
      /\?\s*[^:]+\s*:/g, // ternary
      /&&/g,
      /\|\|/g,
    ];
    
    for (const pattern of decisionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }
  
  /**
   * Find duplicate code blocks
   */
  findDuplicateBlocks(lines, minBlockSize = 5) {
    const duplicates = [];
    const blockMap = new Map();
    
    for (let i = 0; i < lines.length - minBlockSize; i++) {
      const block = lines.slice(i, i + minBlockSize).join('\n').trim();
      if (block.length < 50) continue; // Skip small blocks
      
      if (blockMap.has(block)) {
        duplicates.push({
          lines: [blockMap.get(block), i],
          size: minBlockSize,
        });
      } else {
        blockMap.set(block, i);
      }
    }
    
    return duplicates;
  }
  
  /**
   * Get suggestion history for learning
   */
  getSuggestionHistory() {
    return {
      totalSuggestions: this.suggestionCache.size,
      recentContext: this.contextHistory.slice(-10),
      cacheSize: this.suggestionCache.size,
    };
  }
  
  /**
   * Clear caches
   */
  clearCaches() {
    this.suggestionCache.clear();
    this.contextHistory = [];
  }
}