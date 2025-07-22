/**
 * JavaScript/TypeScript Test Analyzer
 * Analyzes test files for coverage, quality, and best practices using ESLint and AST analysis
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import * as parser from '@babel/parser';
import traverse from '@babel/traverse';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

const execAsync = promisify(exec);

/**
 * JavaScript/TypeScript Test Analyzer Tool
 */
export const jsTestAnalyzerTool = {
  name: 'js_test_analyzer',
  description: 'Analyzes JavaScript/TypeScript test files for coverage, quality, and best practices. Detects missing tests, test smells, and provides coverage metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript/TypeScript test code to analyze (max 100KB)',
      },
      filename: {
        type: 'string', 
        description: 'Optional filename for context (e.g., "component.test.js")',
      },
      framework: {
        type: 'string',
        enum: ['auto', 'jest', 'vitest', 'mocha', 'jasmine'],
        default: 'auto',
        description: 'Test framework (default: auto-detect)',
      },
      category: {
        type: 'string',
        enum: ['structure', 'coverage', 'quality', 'performance', 'all'],
        default: 'all',
        description: 'Filter by issue category',
      },
      includeMetrics: {
        type: 'boolean',
        default: true,
        description: 'Include detailed test metrics (default: true)',
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
    required: ['code'],
  },
};

/**
 * Handle JavaScript/TypeScript test analysis
 */
export async function handleJSTestAnalyzer(request) {
  try {
    const { 
      code, 
      filename = 'test.js',
      framework = 'auto',
      category = 'all',
      includeMetrics = true,
      limit = 50,
      offset = 0,
    } = request.params;

    if (!code) {
      return {
        content: [{
          type: 'text',
          text: '❌ No code provided for analysis',
        }],
      };
    }

    if (code.length > 100000) {
      return {
        content: [{
          type: 'text',
          text: '❌ Code too large (max 100KB)',
        }],
      };
    }

    // Detect test framework
    const detectedFramework = framework === 'auto' ? detectTestFramework(code) : framework;
    
    // Parse the code
    let ast;
    try {
      ast = parseCode(code, filename);
    } catch (parseError) {
      return {
        content: [{
          type: 'text',
          text: `❌ Parse error: ${parseError.message}`,
        }],
      };
    }

    // Analyze the test code
    const analysis = analyzeTestCode(ast, code, detectedFramework);
    
    // Filter by category
    const filteredIssues = filterByCategory(analysis.issues, category);
    
    // Apply pagination
    const paginatedIssues = filteredIssues.slice(offset, offset + limit);
    
    // Build response
    const response = {
      framework: detectedFramework,
      filename,
      metrics: includeMetrics ? analysis.metrics : null,
      issues: paginatedIssues,
      summary: {
        totalIssues: filteredIssues.length,
        issuesByCategory: getIssuesByCategory(filteredIssues),
        testQualityScore: calculateTestQualityScore(analysis),
      },
      pagination: {
        offset,
        limit,
        total: filteredIssues.length,
        hasMore: offset + limit < filteredIssues.length,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[JSTestAnalyzer] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Analysis failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Detect test framework from code
 */
function detectTestFramework(code) {
  if (code.includes('describe(') || code.includes('test(') || code.includes('it(')) {
    if (code.includes('expect(') && code.includes('.toBe(')) return 'jest';
    if (code.includes('vi.') || code.includes('vitest')) return 'vitest';
    if (code.includes('assert')) return 'mocha';
  }
  if (code.includes('jasmine')) return 'jasmine';
  return 'unknown';
}

/**
 * Parse JavaScript/TypeScript code into AST
 */
function parseCode(code, filename) {
  const isTypeScript = filename.endsWith('.ts') || filename.endsWith('.tsx');
  
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
 * Analyze test code structure and quality
 */
function analyzeTestCode(ast, code, framework) {
  const analysis = {
    metrics: {
      testSuites: 0,
      testCases: 0,
      assertions: 0,
      asyncTests: 0,
      setupTeardownBlocks: 0,
      mocks: 0,
      codeLines: code.split('\n').length,
      testCoverage: 0,
    },
    issues: [],
    patterns: {
      hasDescribeBlocks: false,
      hasBeforeAfterHooks: false,
      usesAsyncAwait: false,
      usesMocking: false,
      hasNestedDescribes: false,
    },
  };

  let currentDescribeDepth = 0;
  
  traverse(ast, {
    CallExpression(path) {
      const callee = path.node.callee;
      
      // Test suite detection
      if (callee.type === 'Identifier') {
        const name = callee.name;
        
        if (name === 'describe' || name === 'context') {
          analysis.metrics.testSuites++;
          analysis.patterns.hasDescribeBlocks = true;
          
          // Check for nested describes
          if (currentDescribeDepth > 0) {
            analysis.patterns.hasNestedDescribes = true;
          }
          
          // Check describe block structure
          checkDescribeBlock(path, analysis);
        }
        
        if (name === 'test' || name === 'it' || name === 'should') {
          analysis.metrics.testCases++;
          checkTestCase(path, analysis, framework);
        }
        
        if (name === 'expect' || name === 'assert') {
          analysis.metrics.assertions++;
        }
        
        if (['beforeEach', 'beforeAll', 'afterEach', 'afterAll', 'before', 'after'].includes(name)) {
          analysis.metrics.setupTeardownBlocks++;
          analysis.patterns.hasBeforeAfterHooks = true;
        }
        
        if (['mock', 'spy', 'stub', 'vi.mock', 'jest.mock'].includes(name) || 
            (callee.type === 'MemberExpression' && 
             (callee.object.name === 'jest' || callee.object.name === 'vi'))) {
          analysis.metrics.mocks++;
          analysis.patterns.usesMocking = true;
        }
      }
    },
    
    enter(path) {
      if (path.node.type === 'CallExpression' && 
          path.node.callee.name === 'describe') {
        currentDescribeDepth++;
      }
    },
    
    exit(path) {
      if (path.node.type === 'CallExpression' && 
          path.node.callee.name === 'describe') {
        currentDescribeDepth--;
      }
    },
    
    AwaitExpression() {
      analysis.patterns.usesAsyncAwait = true;
    },
    
    FunctionExpression(path) {
      if (path.node.async) {
        analysis.metrics.asyncTests++;
      }
    },
    
    ArrowFunctionExpression(path) {
      if (path.node.async) {
        analysis.metrics.asyncTests++;
      }
    },
  });
  
  // Add structural analysis
  addStructuralAnalysis(analysis, code);
  
  // Add quality issues
  addQualityIssues(analysis, code, framework);
  
  return analysis;
}

/**
 * Check describe block quality
 */
function checkDescribeBlock(path, analysis) {
  const args = path.node.arguments;
  
  if (args.length === 0) {
    analysis.issues.push({
      type: 'structure',
      severity: 'high',
      message: 'Empty describe block',
      line: path.node.loc?.start.line,
      category: 'structure',
    });
  }
  
  if (args[0] && args[0].type === 'StringLiteral') {
    const description = args[0].value;
    if (description.length < 3) {
      analysis.issues.push({
        type: 'quality',
        severity: 'medium',
        message: 'Describe block description too short',
        line: path.node.loc?.start.line,
        category: 'quality',
      });
    }
  }
}

/**
 * Check test case quality
 */
function checkTestCase(path, analysis, framework) {
  const args = path.node.arguments;
  
  if (args.length < 2) {
    analysis.issues.push({
      type: 'structure',
      severity: 'high',
      message: 'Test case missing description or function',
      line: path.node.loc?.start.line,
      category: 'structure',
    });
    return;
  }
  
  const testFunction = args[1];
  if (!testFunction || (testFunction.type !== 'FunctionExpression' && testFunction.type !== 'ArrowFunctionExpression')) {
    analysis.issues.push({
      type: 'structure',
      severity: 'high',
      message: 'Test case must have a function',
      line: path.node.loc?.start.line,
      category: 'structure',
    });
  }
  
  // Check test description
  if (args[0] && args[0].type === 'StringLiteral') {
    const description = args[0].value;
    if (description.length < 10) {
      analysis.issues.push({
        type: 'quality',
        severity: 'low',
        message: 'Test description could be more descriptive',
        line: path.node.loc?.start.line,
        category: 'quality',
      });
    }
  }
  
  // Check for async test without await
  if (testFunction && testFunction.async) {
    const functionBody = testFunction.body;
    let hasAwait = false;
    
    traverse(functionBody, {
      AwaitExpression() {
        hasAwait = true;
      }
    });
    
    if (!hasAwait) {
      analysis.issues.push({
        type: 'performance',
        severity: 'medium',
        message: 'Async test function without await statement',
        line: path.node.loc?.start.line,
        category: 'performance',
      });
    }
  }
}

/**
 * Add structural analysis
 */
function addStructuralAnalysis(analysis, code) {
  const lines = code.split('\n');
  
  // Check for test file naming
  if (!analysis.patterns.hasDescribeBlocks && analysis.metrics.testCases > 0) {
    analysis.issues.push({
      type: 'structure',
      severity: 'medium',
      message: 'Tests should be organized in describe blocks',
      category: 'structure',
    });
  }
  
  // Check test to assertion ratio
  if (analysis.metrics.testCases > 0) {
    const assertionRatio = analysis.metrics.assertions / analysis.metrics.testCases;
    if (assertionRatio < 1) {
      analysis.issues.push({
        type: 'coverage',
        severity: 'high',
        message: 'Tests should have at least one assertion each',
        category: 'coverage',
      });
    }
  }
  
  // Check for setup/teardown balance
  if (analysis.metrics.testCases > 5 && !analysis.patterns.hasBeforeAfterHooks) {
    analysis.issues.push({
      type: 'structure',
      severity: 'low',
      message: 'Consider using beforeEach/afterEach for test setup',
      category: 'structure',
    });
  }
  
  // Check for large test files
  if (lines.length > 500) {
    analysis.issues.push({
      type: 'structure',
      severity: 'medium',
      message: 'Test file is very large, consider splitting',
      category: 'structure',
    });
  }
}

/**
 * Add quality issues
 */
function addQualityIssues(analysis, code, framework) {
  const lines = code.split('\n');
  
  // Check for commented out tests
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('// it(') || trimmed.startsWith('// test(') || 
        trimmed.startsWith('//it(') || trimmed.startsWith('//test(')) {
      analysis.issues.push({
        type: 'quality',
        severity: 'medium',
        message: 'Commented out test found',
        line: index + 1,
        category: 'quality',
      });
    }
  });
  
  // Check for skip/only patterns
  if (code.includes('.skip(') || code.includes('.only(')) {
    analysis.issues.push({
      type: 'quality',
      severity: 'high',
      message: 'Test skip/only patterns found - should not be committed',
      category: 'quality',
    });
  }
  
  // Check for console.log in tests
  lines.forEach((line, index) => {
    if (line.includes('console.log') && !line.trim().startsWith('//')) {
      analysis.issues.push({
        type: 'quality',
        severity: 'low',
        message: 'Console.log found in test - consider removing',
        line: index + 1,
        category: 'quality',
      });
    }
  });
  
  // Check for proper error testing
  if (code.includes('throw') && !code.includes('toThrow')) {
    analysis.issues.push({
      type: 'coverage',
      severity: 'medium',
      message: 'Error throwing code without proper error assertions',
      category: 'coverage',
    });
  }
  
  // Framework-specific checks
  if (framework === 'jest') {
    if (!code.includes('expect(') && analysis.metrics.testCases > 0) {
      analysis.issues.push({
        type: 'quality',
        severity: 'high',
        message: 'Jest tests should use expect() assertions',
        category: 'quality',
      });
    }
  }
}

/**
 * Filter issues by category
 */
function filterByCategory(issues, category) {
  if (category === 'all') return issues;
  return issues.filter(issue => issue.category === category);
}

/**
 * Get issues grouped by category
 */
function getIssuesByCategory(issues) {
  const categories = {};
  issues.forEach(issue => {
    categories[issue.category] = (categories[issue.category] || 0) + 1;
  });
  return categories;
}

/**
 * Calculate test quality score (0-100)
 */
function calculateTestQualityScore(analysis) {
  let score = 100;
  
  // Deduct points for critical issues
  analysis.issues.forEach(issue => {
    switch (issue.severity) {
      case 'high':
        score -= 10;
        break;
      case 'medium':
        score -= 5;
        break;
      case 'low':
        score -= 2;
        break;
    }
  });
  
  // Bonus points for good practices
  if (analysis.patterns.hasDescribeBlocks) score += 5;
  if (analysis.patterns.hasBeforeAfterHooks) score += 5;
  if (analysis.patterns.usesMocking) score += 3;
  
  // Test coverage considerations
  if (analysis.metrics.testCases > 0) {
    const assertionRatio = analysis.metrics.assertions / analysis.metrics.testCases;
    if (assertionRatio >= 2) score += 10;
    else if (assertionRatio >= 1) score += 5;
  }
  
  return Math.max(0, Math.min(100, score));
}