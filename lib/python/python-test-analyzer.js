import { exec } from 'child_process';
import { promisify } from 'util';
import { validatePythonCode } from '../utils/python-validation.js';

const execAsync = promisify(exec);

/**
 * Python Test Analyzer - Analyzes test coverage and quality
 */
export const pythonTestAnalyzerTool = {
  name: 'python_test_analyzer',
  description: 'Analyzes Python test files for coverage, quality, and best practices. Detects missing tests, test smells, and provides coverage metrics.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Python test code to analyze (max 100KB)'
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "test_main.py")'
      },
      framework: {
        type: 'string',
        enum: ['pytest', 'unittest', 'auto'],
        description: 'Test framework (default: auto-detect)',
        default: 'auto'
      },
      includeMetrics: {
        type: 'boolean',
        description: 'Include detailed test metrics (default: true)',
        default: true
      },
      category: {
        type: 'string',
        enum: ['structure', 'coverage', 'quality', 'performance', 'all'],
        description: 'Filter by issue category',
        default: 'all'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50)',
        minimum: 1,
        maximum: 500,
        default: 50
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination (default: 0)',
        minimum: 0,
        default: 0
      }
    },
    required: ['code']
  }
};

export async function handlePythonTestAnalyzer(args) {
  const startTime = Date.now();
  
  try {
    // Validate input
    const validation = validatePythonCode(args.code);
    if (!validation.isValid) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Invalid Python code: ${validation.error}`,
            executionTime: Date.now() - startTime
          }, null, 2)
        }]
      };
    }

    // Detect test framework
    const framework = args.framework === 'auto' ? detectTestFramework(args.code) : args.framework;
    
    // Analyze test code
    const issues = [];
    const metrics = analyzeTestMetrics(args.code, framework);
    
    // Check for test structure issues
    if (args.category === 'all' || args.category === 'structure') {
      issues.push(...checkTestStructure(args.code, framework));
    }
    
    // Check for coverage issues
    if (args.category === 'all' || args.category === 'coverage') {
      issues.push(...checkTestCoverage(args.code));
    }
    
    // Check for quality issues
    if (args.category === 'all' || args.category === 'quality') {
      issues.push(...checkTestQuality(args.code, framework));
    }
    
    // Check for performance issues
    if (args.category === 'all' || args.category === 'performance') {
      issues.push(...checkTestPerformance(args.code));
    }
    
    // Sort issues by line number
    issues.sort((a, b) => a.line - b.line);
    
    // Apply pagination
    const totalIssues = issues.length;
    const paginatedIssues = issues.slice(args.offset, args.offset + args.limit);
    
    // Calculate test quality score
    const qualityScore = calculateTestQualityScore(issues, metrics);
    
    const result = {
      success: true,
      issues: paginatedIssues,
      totalIssues,
      pagination: {
        offset: args.offset,
        limit: args.limit,
        hasMore: args.offset + args.limit < totalIssues
      },
      framework,
      summary: {
        structure: issues.filter(i => i.category === 'structure').length,
        coverage: issues.filter(i => i.category === 'coverage').length,
        quality: issues.filter(i => i.category === 'quality').length,
        performance: issues.filter(i => i.category === 'performance').length
      },
      qualityScore,
      executionTime: Date.now() - startTime
    };
    
    if (args.includeMetrics) {
      result.metrics = metrics;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Test analysis failed: ${error.message}`,
          executionTime: Date.now() - startTime
        }, null, 2)
      }]
    };
  }
}

function detectTestFramework(code) {
  if (code.includes('import pytest') || code.includes('from pytest')) {
    return 'pytest';
  }
  if (code.includes('import unittest') || code.includes('from unittest')) {
    return 'unittest';
  }
  return 'pytest'; // Default to pytest
}

function analyzeTestMetrics(code, framework) {
  const lines = code.split('\n');
  const metrics = {
    totalLines: lines.length,
    testCount: 0,
    assertionCount: 0,
    fixtureCount: 0,
    mockCount: 0,
    avgTestLength: 0,
    maxTestLength: 0,
    testCoverage: [],
    complexTests: []
  };
  
  let currentTest = null;
  let currentTestLines = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Count tests
    if (framework === 'pytest' && /^def test_/.test(trimmed)) {
      metrics.testCount++;
      if (currentTest) {
        metrics.avgTestLength += currentTestLines;
        metrics.maxTestLength = Math.max(metrics.maxTestLength, currentTestLines);
      }
      currentTest = trimmed.match(/def (test_\w+)/)[1];
      currentTestLines = 0;
    } else if (framework === 'unittest' && /def test/.test(trimmed)) {
      metrics.testCount++;
    }
    
    if (currentTest) {
      currentTestLines++;
    }
    
    // Count assertions
    if (/assert\s+/.test(trimmed) || /self\.assert/.test(trimmed)) {
      metrics.assertionCount++;
    }
    
    // Count fixtures (pytest)
    if (framework === 'pytest' && /@pytest\.fixture/.test(trimmed)) {
      metrics.fixtureCount++;
    }
    
    // Count mocks
    if (/mock\.|Mock\(|patch\(/.test(trimmed)) {
      metrics.mockCount++;
    }
  }
  
  if (currentTest && metrics.testCount > 0) {
    metrics.avgTestLength = Math.round((metrics.avgTestLength + currentTestLines) / metrics.testCount);
  }
  
  return metrics;
}

function checkTestStructure(code, framework) {
  const issues = [];
  const lines = code.split('\n');
  
  // Check for proper test organization
  let hasSetup = false;
  let hasTeardown = false;
  let testNames = new Set();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for duplicate test names
    const testMatch = trimmed.match(/def (test_\w+)/);
    if (testMatch) {
      const testName = testMatch[1];
      if (testNames.has(testName)) {
        issues.push({
          line: i + 1,
          severity: 'high',
          message: `Duplicate test name: ${testName}`,
          category: 'structure'
        });
      }
      testNames.add(testName);
      
      // Check for descriptive test names
      if (testName === 'test_' || testName.length < 10) {
        issues.push({
          line: i + 1,
          severity: 'medium',
          message: `Test name '${testName}' is not descriptive enough`,
          category: 'structure'
        });
      }
    }
    
    // Check for setup/teardown
    if (/def setUp|@pytest\.fixture.*scope="function"/.test(trimmed)) {
      hasSetup = true;
    }
    if (/def tearDown|yield/.test(trimmed)) {
      hasTeardown = true;
    }
    
    // Check for test classes without proper structure
    if (/^class Test/.test(trimmed) && framework === 'unittest') {
      const nextLines = lines.slice(i + 1, i + 10).join('\n');
      if (!/def setUp/.test(nextLines) && /self\./.test(nextLines)) {
        issues.push({
          line: i + 1,
          severity: 'low',
          message: 'Test class might benefit from setUp method',
          category: 'structure'
        });
      }
    }
  }
  
  return issues;
}

function checkTestCoverage(code) {
  const issues = [];
  const lines = code.split('\n');
  
  // Look for common coverage issues
  let hasEdgeCaseTests = false;
  let hasErrorTests = false;
  let hasParameterizedTests = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for edge case testing
    if (/test.*edge|test.*boundary|test.*limit/.test(trimmed.toLowerCase())) {
      hasEdgeCaseTests = true;
    }
    
    // Check for error/exception testing
    if (/test.*error|test.*exception|with pytest\.raises|assertRaises/.test(trimmed)) {
      hasErrorTests = true;
    }
    
    // Check for parameterized tests
    if (/@pytest\.mark\.parametrize|@parameterized/.test(trimmed)) {
      hasParameterizedTests = true;
    }
    
    // Check for empty test functions
    if (/^def test_/.test(trimmed)) {
      const nextLine = lines[i + 1];
      if (nextLine && /^\s*(pass|\.\.\.)\s*$/.test(nextLine)) {
        issues.push({
          line: i + 1,
          severity: 'high',
          message: 'Empty test function detected',
          category: 'coverage'
        });
      }
    }
  }
  
  // Add suggestions for missing coverage types
  if (!hasEdgeCaseTests) {
    issues.push({
      line: 0,
      severity: 'medium',
      message: 'No edge case tests detected. Consider testing boundary conditions',
      category: 'coverage'
    });
  }
  
  if (!hasErrorTests) {
    issues.push({
      line: 0,
      severity: 'medium',
      message: 'No error handling tests detected. Consider testing exception cases',
      category: 'coverage'
    });
  }
  
  return issues;
}

function checkTestQuality(code, framework) {
  const issues = [];
  const lines = code.split('\n');
  let currentTestStart = -1;
  let assertionCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track test boundaries
    if (/^def test_/.test(trimmed)) {
      // Check previous test
      if (currentTestStart !== -1 && assertionCount === 0) {
        issues.push({
          line: currentTestStart,
          severity: 'high',
          message: 'Test has no assertions',
          category: 'quality'
        });
      }
      currentTestStart = i + 1;
      assertionCount = 0;
    }
    
    // Count assertions in current test
    if (currentTestStart !== -1 && (/assert\s+/.test(trimmed) || /self\.assert/.test(trimmed))) {
      assertionCount++;
    }
    
    // Check for multiple assertions
    if (assertionCount > 5) {
      issues.push({
        line: i + 1,
        severity: 'low',
        message: 'Test has many assertions. Consider splitting into multiple tests',
        category: 'quality'
      });
      assertionCount = 0; // Reset to avoid duplicate warnings
    }
    
    // Check for print statements in tests
    if (/print\(/.test(trimmed) && !trimmed.startsWith('#')) {
      issues.push({
        line: i + 1,
        severity: 'low',
        message: 'Avoid print statements in tests. Use logging or assertions',
        category: 'quality'
      });
    }
    
    // Check for hard-coded values
    if (/==\s*["']\d{4,}["']|==\s*\d{6,}/.test(trimmed)) {
      issues.push({
        line: i + 1,
        severity: 'medium',
        message: 'Avoid hard-coded values in tests. Use constants or fixtures',
        category: 'quality'
      });
    }
    
    // Check for sleep statements
    if (/time\.sleep|sleep\(/.test(trimmed)) {
      issues.push({
        line: i + 1,
        severity: 'high',
        message: 'Avoid sleep in tests. Use proper synchronization or mocking',
        category: 'quality'
      });
    }
  }
  
  // Check last test
  if (currentTestStart !== -1 && assertionCount === 0) {
    issues.push({
      line: currentTestStart,
      severity: 'high',
      message: 'Test has no assertions',
      category: 'quality'
    });
  }
  
  return issues;
}

function checkTestPerformance(code) {
  const issues = [];
  const lines = code.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Check for inefficient test patterns
    if (/for.*in.*range\(\d{4,}\)/.test(trimmed)) {
      issues.push({
        line: i + 1,
        severity: 'high',
        message: 'Large loop in test. Consider using parameterized tests or reducing iterations',
        category: 'performance'
      });
    }
    
    // Check for file I/O in tests
    if (/open\(|\.read\(|\.write\(/.test(trimmed) && !/mock/.test(line.toLowerCase())) {
      issues.push({
        line: i + 1,
        severity: 'medium',
        message: 'File I/O in test. Consider using temp files or mocking',
        category: 'performance'
      });
    }
    
    // Check for network calls
    if (/requests\.|urllib\.|http\./.test(trimmed) && !/mock/.test(line.toLowerCase())) {
      issues.push({
        line: i + 1,
        severity: 'high',
        message: 'Network call in test. Use mocking for external dependencies',
        category: 'performance'
      });
    }
    
    // Check for database operations
    if (/\.execute\(|\.query\(|\.save\(|\.create\(/.test(trimmed) && !/mock/.test(line.toLowerCase())) {
      issues.push({
        line: i + 1,
        severity: 'high',
        message: 'Database operation in test. Use test database or mocking',
        category: 'performance'
      });
    }
  }
  
  return issues;
}

function calculateTestQualityScore(issues, metrics) {
  let score = 100;
  
  // Deduct points for issues
  const penalties = {
    high: 10,
    medium: 5,
    low: 2
  };
  
  for (const issue of issues) {
    score -= penalties[issue.severity] || 0;
  }
  
  // Bonus points for good practices
  if (metrics.testCount > 0) {
    const avgAssertions = metrics.assertionCount / metrics.testCount;
    if (avgAssertions >= 1 && avgAssertions <= 3) {
      score += 5; // Good assertion density
    }
    
    if (metrics.fixtureCount > 0) {
      score += 3; // Uses fixtures
    }
    
    if (metrics.avgTestLength < 20) {
      score += 2; // Concise tests
    }
  }
  
  return Math.max(0, Math.min(100, score));
}