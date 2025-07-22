/**
 * JavaScript/TypeScript Performance Analyzer
 * Analyzes JavaScript/TypeScript code for performance issues and optimization opportunities
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { existsSync, readFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const execAsync = promisify(exec);

/**
 * JavaScript/TypeScript Performance Analyzer Tool
 */
export const jsPerformanceAnalyzerTool = {
  name: 'js_performance_analyzer',
  description: 'Analyzes JavaScript/TypeScript code for performance issues, inefficient patterns, and optimization opportunities.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript/TypeScript code to analyze (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "component.js")',
      },
      projectPath: {
        type: 'string',
        description: 'Path to project directory for comprehensive analysis',
      },
      category: {
        type: 'string',
        enum: ['memory', 'cpu', 'io', 'async', 'dom', 'all'],
        default: 'all',
        description: 'Performance aspect to focus on',
      },
      focus: {
        type: 'string',
        enum: ['general', 'react', 'node', 'browser'],
        default: 'general',
        description: 'Runtime environment focus',
      },
      includeMetrics: {
        type: 'boolean',
        default: true,
        description: 'Include detailed performance metrics',
      },
      strictness: {
        type: 'string',
        enum: ['lenient', 'standard', 'strict'],
        default: 'standard',
        description: 'Analysis strictness level',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50)',
        default: 50,
        minimum: 1,
        maximum: 500,
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination (default: 0)',
        default: 0,
        minimum: 0,
      },
    },
    required: [],
  },
};

/**
 * Handle JavaScript/TypeScript performance analysis
 */
export async function handleJSPerformanceAnalyzer(request) {
  try {
    const { 
      code,
      filename,
      projectPath,
      category = 'all',
      focus = 'general',
      includeMetrics = true,
      strictness = 'standard',
      limit = 50,
      offset = 0,
    } = request.params;

    if (!code && !projectPath) {
      return {
        content: [{
          type: 'text',
          text: '❌ Either code content or project path must be provided',
        }],
      };
    }

    const analysis = {
      category,
      focus,
      strictness,
      issues: [],
      metrics: {
        cyclomaticComplexity: 0,
        cognitiveComplexity: 0,
        functionCount: 0,
        asyncFunctionCount: 0,
        loopCount: 0,
        nestedLoopCount: 0,
        domQueryCount: 0,
        eventListenerCount: 0,
        memoryLeakRisks: 0,
        performanceScore: 0,
      },
      optimizations: [],
      benchmarks: [],
    };

    // Analyze code if provided
    if (code) {
      await analyzeCodePerformance(code, filename, analysis, {
        category,
        focus,
        strictness,
      });
    }

    // Analyze project structure if path provided
    if (projectPath) {
      await analyzeProjectPerformance(projectPath, analysis, {
        category,
        focus,
        strictness,
      });
    }

    // Generate optimization recommendations
    generateOptimizationRecommendations(analysis);

    // Calculate performance score
    analysis.metrics.performanceScore = calculatePerformanceScore(analysis);

    // Filter and paginate
    const filteredIssues = analysis.issues.slice(offset, offset + limit);

    // Build response
    const response = {
      analysis: {
        category,
        focus,
        strictness,
        performanceScore: analysis.metrics.performanceScore,
      },
      metrics: includeMetrics ? analysis.metrics : null,
      issues: filteredIssues,
      optimizations: analysis.optimizations,
      benchmarks: analysis.benchmarks.length > 0 ? analysis.benchmarks : null,
      summary: {
        totalIssues: analysis.issues.length,
        critical: analysis.issues.filter(i => i.severity === 'critical').length,
        high: analysis.issues.filter(i => i.severity === 'high').length,
        medium: analysis.issues.filter(i => i.severity === 'medium').length,
        low: analysis.issues.filter(i => i.severity === 'low').length,
      },
      pagination: {
        offset,
        limit,
        total: analysis.issues.length,
        hasMore: offset + limit < analysis.issues.length,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[JSPerformanceAnalyzer] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Performance analysis failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Analyze code performance
 */
async function analyzeCodePerformance(code, filename, analysis, options) {
  if (!code || code.length > 100000) {
    analysis.issues.push({
      type: 'input_error',
      severity: 'medium',
      message: 'Code too large or empty for analysis',
      file: filename,
    });
    return;
  }

  let ast;
  try {
    ast = parseCodeForPerformance(code, filename);
  } catch (parseError) {
    analysis.issues.push({
      type: 'parse_error',
      severity: 'high',
      message: `Failed to parse code: ${parseError.message}`,
      file: filename,
    });
    return;
  }

  // Performance analysis using AST
  await analyzeASTPerformance(ast, code, analysis, options);
  
  // Memory analysis
  if (options.category === 'memory' || options.category === 'all') {
    analyzeMemoryPatterns(ast, code, analysis, options);
  }
  
  // CPU analysis
  if (options.category === 'cpu' || options.category === 'all') {
    analyzeCPUPatterns(ast, code, analysis, options);
  }
  
  // Async analysis
  if (options.category === 'async' || options.category === 'all') {
    analyzeAsyncPatterns(ast, code, analysis, options);
  }
  
  // DOM analysis (browser focus)
  if ((options.category === 'dom' || options.category === 'all') && 
      (options.focus === 'browser' || options.focus === 'react' || options.focus === 'general')) {
    analyzeDOMPatterns(ast, code, analysis, options);
  }
}

/**
 * Parse code for performance analysis
 */
function parseCodeForPerformance(code, filename) {
  const isTypeScript = filename && (filename.endsWith('.ts') || filename.endsWith('.tsx'));
  
  return parser.parse(code, {
    sourceType: 'module',
    allowImportExportEverywhere: true,
    allowReturnOutsideFunction: true,
    plugins: [
      'jsx',
      'asyncGenerators',
      'bigInt',
      'classProperties',
      'decorators-legacy',
      'doExpressions',
      'dynamicImport',
      'exportDefaultFrom',
      'exportNamespaceFrom',
      'functionBind',
      'functionSent',
      'importMeta',
      'nullishCoalescingOperator',
      'numericSeparator',
      'objectRestSpread',
      'optionalCatchBinding',
      'optionalChaining',
      'throwExpressions',
      'topLevelAwait',
      'trailingFunctionCommas',
      ...(isTypeScript ? ['typescript'] : []),
    ],
  });
}

/**
 * Analyze AST for performance issues
 */
async function analyzeASTPerformance(ast, code, analysis, options) {
  let currentFunctionDepth = 0;
  let loopDepth = 0;
  const functionComplexity = new Map();
  
  traverse(ast, {
    Function: {
      enter(path) {
        currentFunctionDepth++;
        analysis.metrics.functionCount++;
        
        if (path.node.async) {
          analysis.metrics.asyncFunctionCount++;
        }
        
        // Calculate cyclomatic complexity for this function
        const complexity = calculateCyclomaticComplexity(path);
        const functionName = getFunctionName(path) || 'anonymous';
        functionComplexity.set(functionName, complexity);
        
        if (complexity > 10) {
          analysis.issues.push({
            type: 'high_complexity',
            severity: complexity > 20 ? 'high' : 'medium',
            message: `Function '${functionName}' has high cyclomatic complexity (${complexity})`,
            line: path.node.loc?.start.line,
            function: functionName,
            complexity,
            category: 'cpu',
            recommendation: 'Consider breaking down this function into smaller functions',
          });
        }
        
        analysis.metrics.cyclomaticComplexity = Math.max(
          analysis.metrics.cyclomaticComplexity, 
          complexity
        );
      },
      exit() {
        currentFunctionDepth--;
      }
    },
    
    // Loop analysis
    'WhileStatement|ForStatement|ForInStatement|ForOfStatement|DoWhileStatement': {
      enter(path) {
        loopDepth++;
        analysis.metrics.loopCount++;
        
        if (loopDepth > 1) {
          analysis.metrics.nestedLoopCount++;
          
          analysis.issues.push({
            type: 'nested_loops',
            severity: loopDepth > 2 ? 'high' : 'medium',
            message: `Nested loop detected (depth: ${loopDepth})`,
            line: path.node.loc?.start.line,
            category: 'cpu',
            depth: loopDepth,
            recommendation: 'Consider algorithm optimization or caching to avoid nested loops',
          });
        }
        
        // Check for potential infinite loops
        if (path.node.type === 'WhileStatement' && 
            path.node.test.type === 'BooleanLiteral' && 
            path.node.test.value === true) {
          analysis.issues.push({
            type: 'infinite_loop_risk',
            severity: 'critical',
            message: 'Potential infinite loop with while(true)',
            line: path.node.loc?.start.line,
            category: 'cpu',
            recommendation: 'Ensure there is a break condition inside the loop',
          });
        }
      },
      exit() {
        loopDepth--;
      }
    },
    
    // Array method chaining analysis
    MemberExpression(path) {
      if (path.node.property.name && 
          ['map', 'filter', 'reduce', 'forEach'].includes(path.node.property.name)) {
        
        // Check for chained array methods
        let parent = path.parent;
        let chainLength = 1;
        
        while (parent && parent.type === 'CallExpression' && 
               parent.callee.type === 'MemberExpression' &&
               ['map', 'filter', 'reduce', 'forEach'].includes(parent.callee.property.name)) {
          chainLength++;
          parent = parent.parent;
        }
        
        if (chainLength > 2) {
          analysis.issues.push({
            type: 'array_method_chaining',
            severity: 'medium',
            message: `Long array method chain (${chainLength} methods)`,
            line: path.node.loc?.start.line,
            category: 'cpu',
            chainLength,
            recommendation: 'Consider combining operations or using a single reduce',
          });
        }
      }
    },
    
    // Object creation in loops
    'NewExpression|ObjectExpression|ArrayExpression'(path) {
      if (loopDepth > 0) {
        analysis.issues.push({
          type: 'object_creation_in_loop',
          severity: 'medium',
          message: `${path.node.type} created inside loop`,
          line: path.node.loc?.start.line,
          category: 'memory',
          recommendation: 'Move object creation outside loop or use object pooling',
        });
      }
    },
    
    // Regular expression in loops
    NewExpression(path) {
      if (path.node.callee.name === 'RegExp' && loopDepth > 0) {
        analysis.issues.push({
          type: 'regex_in_loop',
          severity: 'high',
          message: 'Regular expression created inside loop',
          line: path.node.loc?.start.line,
          category: 'cpu',
          recommendation: 'Move RegExp creation outside loop',
        });
      }
    },
  });
}

/**
 * Analyze memory patterns
 */
function analyzeMemoryPatterns(ast, code, analysis, options) {
  traverse(ast, {
    // Closure analysis
    FunctionExpression(path) {
      // Check for potential memory leaks in closures
      let hasExternalRefs = false;
      let hasTimers = false;
      
      path.traverse({
        Identifier(innerPath) {
          // Check if referencing variables from outer scope
          if (innerPath.isReferencedIdentifier() && 
              !innerPath.scope.hasOwnBinding(innerPath.node.name)) {
            hasExternalRefs = true;
          }
        },
        
        CallExpression(innerPath) {
          const callee = innerPath.node.callee;
          if (callee.name === 'setTimeout' || callee.name === 'setInterval') {
            hasTimers = true;
          }
        }
      });
      
      if (hasExternalRefs && hasTimers) {
        analysis.metrics.memoryLeakRisks++;
        analysis.issues.push({
          type: 'potential_memory_leak',
          severity: 'medium',
          message: 'Closure with external references and timers',
          line: path.node.loc?.start.line,
          category: 'memory',
          recommendation: 'Ensure timers are cleared and references are nullified',
        });
      }
    },
    
    // Event listener analysis
    CallExpression(path) {
      const callee = path.node.callee;
      
      if (callee.type === 'MemberExpression' && 
          callee.property.name === 'addEventListener') {
        analysis.metrics.eventListenerCount++;
        
        // Check if there's a corresponding removeEventListener
        // This is a simplified check - would need more sophisticated analysis
        const codeStr = code.toLowerCase();
        if (!codeStr.includes('removeeventlistener')) {
          analysis.issues.push({
            type: 'unremoved_event_listener',
            severity: 'medium',
            message: 'Event listener without corresponding removal',
            line: path.node.loc?.start.line,
            category: 'memory',
            recommendation: 'Add removeEventListener in cleanup or use AbortController',
          });
        }
      }
    },
  });
}

/**
 * Analyze CPU patterns
 */
function analyzeCPUPatterns(ast, code, analysis, options) {
  traverse(ast, {
    // Synchronous operations that could block
    CallExpression(path) {
      const callee = path.node.callee;
      
      if (callee.type === 'MemberExpression') {
        const objName = callee.object.name;
        const propName = callee.property.name;
        
        // Check for synchronous file operations
        if (objName === 'fs' && propName && propName.endsWith('Sync')) {
          analysis.issues.push({
            type: 'blocking_sync_operation',
            severity: 'high',
            message: `Synchronous file operation: ${propName}`,
            line: path.node.loc?.start.line,
            category: 'cpu',
            recommendation: `Use async version: ${propName.replace('Sync', '')}`,
          });
        }
        
        // Check for expensive DOM operations
        if (propName === 'innerHTML' && options.focus !== 'node') {
          analysis.issues.push({
            type: 'expensive_dom_operation',
            severity: 'medium',
            message: 'innerHTML usage can be expensive',
            line: path.node.loc?.start.line,
            category: 'dom',
            recommendation: 'Consider using textContent or DOM methods for better performance',
          });
        }
      }
      
      // Check for JSON.parse/stringify in hot paths
      if (callee.type === 'MemberExpression' && 
          callee.object.name === 'JSON' && 
          ['parse', 'stringify'].includes(callee.property.name)) {
        
        // Simple heuristic: if it's in a loop or frequently called function
        let inLoop = false;
        let parent = path.parent;
        while (parent) {
          if (['WhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(parent.type)) {
            inLoop = true;
            break;
          }
          parent = parent.parent;
        }
        
        if (inLoop) {
          analysis.issues.push({
            type: 'json_operation_in_loop',
            severity: 'medium',
            message: `JSON.${callee.property.name} in loop`,
            line: path.node.loc?.start.line,
            category: 'cpu',
            recommendation: 'Move JSON operations outside loop or cache results',
          });
        }
      }
    },
  });
}

/**
 * Analyze async patterns
 */
function analyzeAsyncPatterns(ast, code, analysis, options) {
  traverse(ast, {
    // Async/await analysis
    AwaitExpression(path) {
      // Check for await in loops
      let inLoop = false;
      let parent = path.parent;
      while (parent) {
        if (['WhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(parent.type)) {
          inLoop = true;
          break;
        }
        parent = parent.parent;
      }
      
      if (inLoop) {
        analysis.issues.push({
          type: 'await_in_loop',
          severity: 'high',
          message: 'Await expression in loop - consider Promise.all()',
          line: path.node.loc?.start.line,
          category: 'async',
          recommendation: 'Use Promise.all() or Promise.allSettled() for concurrent execution',
        });
      }
    },
    
    // Promise chains
    CallExpression(path) {
      if (path.node.callee.type === 'MemberExpression' && 
          path.node.callee.property.name === 'then') {
        
        // Count chained .then() calls
        let chainLength = 1;
        let current = path.node;
        
        while (current.callee && current.callee.type === 'MemberExpression' &&
               current.callee.object.type === 'CallExpression' &&
               current.callee.object.callee.type === 'MemberExpression' &&
               current.callee.object.callee.property.name === 'then') {
          chainLength++;
          current = current.callee.object;
        }
        
        if (chainLength > 3) {
          analysis.issues.push({
            type: 'long_promise_chain',
            severity: 'low',
            message: `Long Promise chain (${chainLength} .then() calls)`,
            line: path.node.loc?.start.line,
            category: 'async',
            chainLength,
            recommendation: 'Consider using async/await for better readability',
          });
        }
      }
    },
  });
}

/**
 * Analyze DOM patterns
 */
function analyzeDOMPatterns(ast, code, analysis, options) {
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      
      if (callee.type === 'MemberExpression') {
        const propName = callee.property.name;
        
        // DOM query analysis
        if (['getElementById', 'getElementsByClassName', 'getElementsByTagName', 
          'querySelector', 'querySelectorAll'].includes(propName)) {
          analysis.metrics.domQueryCount++;
          
          // Check for DOM queries in loops
          let inLoop = false;
          let parent = path.parent;
          while (parent) {
            if (['WhileStatement', 'ForStatement', 'ForInStatement', 'ForOfStatement'].includes(parent.type)) {
              inLoop = true;
              break;
            }
            parent = parent.parent;
          }
          
          if (inLoop) {
            analysis.issues.push({
              type: 'dom_query_in_loop',
              severity: 'high',
              message: `DOM query (${propName}) in loop`,
              line: path.node.loc?.start.line,
              category: 'dom',
              recommendation: 'Cache DOM elements outside loop',
            });
          }
        }
        
        // Check for layout thrashing patterns
        if (['offsetWidth', 'offsetHeight', 'clientWidth', 'clientHeight',
          'scrollWidth', 'scrollHeight'].includes(propName)) {
          analysis.issues.push({
            type: 'layout_thrashing_risk',
            severity: 'medium',
            message: `Layout property access: ${propName}`,
            line: path.node.loc?.start.line,
            category: 'dom',
            recommendation: 'Batch DOM reads and writes to avoid layout thrashing',
          });
        }
      }
    },
  });
}

/**
 * Analyze project performance
 */
async function analyzeProjectPerformance(projectPath, analysis, options) {
  try {
    // This would analyze multiple files in the project
    // For now, just check for common performance anti-patterns in package.json
    const packageJsonPath = join(projectPath, 'package.json');
    
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      
      // Check for heavy dependencies
      const heavyDependencies = [
        'lodash', 'moment', 'jquery', 'bootstrap', 'angular',
      ];
      
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      for (const dep of heavyDependencies) {
        if (deps[dep]) {
          analysis.issues.push({
            type: 'heavy_dependency',
            severity: 'low',
            message: `Heavy dependency detected: ${dep}`,
            category: 'memory',
            dependency: dep,
            recommendation: `Consider lighter alternatives to ${dep}`,
          });
        }
      }
    }
  } catch (error) {
    // Ignore project analysis errors
  }
}

/**
 * Generate optimization recommendations
 */
function generateOptimizationRecommendations(analysis) {
  const optimizations = [];
  
  // Based on issues found
  const issueTypes = new Set(analysis.issues.map(i => i.type));
  
  if (issueTypes.has('nested_loops')) {
    optimizations.push({
      type: 'algorithm',
      priority: 'high',
      title: 'Algorithm Optimization',
      description: 'Nested loops detected - consider algorithmic improvements',
      techniques: [
        'Use hash maps for O(1) lookups instead of nested iteration',
        'Implement early termination conditions',
        'Consider divide-and-conquer approaches',
      ],
    });
  }
  
  if (issueTypes.has('array_method_chaining')) {
    optimizations.push({
      type: 'functional',
      priority: 'medium',
      title: 'Array Operation Optimization',
      description: 'Optimize chained array operations for better performance',
      techniques: [
        'Combine multiple operations into a single reduce',
        'Use for...of loops for simple operations',
        'Consider lazy evaluation with generators',
      ],
    });
  }
  
  if (issueTypes.has('dom_query_in_loop')) {
    optimizations.push({
      type: 'dom',
      priority: 'high',
      title: 'DOM Access Optimization',
      description: 'Minimize DOM queries and batch operations',
      techniques: [
        'Cache DOM element references',
        'Use DocumentFragment for multiple DOM insertions',
        'Implement virtual scrolling for large lists',
      ],
    });
  }
  
  if (issueTypes.has('await_in_loop')) {
    optimizations.push({
      type: 'async',
      priority: 'high',
      title: 'Async Operation Optimization',
      description: 'Improve concurrent execution of async operations',
      techniques: [
        'Use Promise.all() for independent operations',
        'Implement request batching',
        'Consider streaming for large datasets',
      ],
    });
  }
  
  analysis.optimizations = optimizations;
}

/**
 * Calculate cyclomatic complexity
 */
function calculateCyclomaticComplexity(path) {
  let complexity = 1; // Base complexity
  
  path.traverse({
    'IfStatement|ConditionalExpression|SwitchCase|WhileStatement|ForStatement|ForInStatement|ForOfStatement|DoWhileStatement'() {
      complexity++;
    },
    'LogicalExpression'(innerPath) {
      if (['&&', '||'].includes(innerPath.node.operator)) {
        complexity++;
      }
    },
    'CatchClause'() {
      complexity++;
    },
  });
  
  return complexity;
}

/**
 * Get function name from AST node
 */
function getFunctionName(path) {
  if (path.node.id?.name) return path.node.id.name;
  
  if (path.parent.type === 'VariableDeclarator' && path.parent.id?.name) {
    return path.parent.id.name;
  }
  
  if (path.parent.type === 'Property' && path.parent.key?.name) {
    return path.parent.key.name;
  }
  
  return null;
}

/**
 * Calculate overall performance score
 */
function calculatePerformanceScore(analysis) {
  let score = 100;
  
  // Deduct points for issues
  analysis.issues.forEach(issue => {
    switch (issue.severity) {
      case 'critical': score -= 20; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  });
  
  // Factor in complexity
  if (analysis.metrics.cyclomaticComplexity > 15) {
    score -= (analysis.metrics.cyclomaticComplexity - 15) * 2;
  }
  
  // Factor in nested loops
  if (analysis.metrics.nestedLoopCount > 0) {
    score -= analysis.metrics.nestedLoopCount * 10;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}