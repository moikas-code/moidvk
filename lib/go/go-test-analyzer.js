import { validateGoCode, sanitizeGoFilename, getGoFileType } from '../utils/go-validation.js';

/**
 * Tool definition for go_test_analyzer
 */
export const goTestAnalyzerTool = {
  name: 'go_test_analyzer',
  description:
    'Analyzes Go test code for quality, coverage, best practices, and identifies missing tests. Evaluates test structure, naming conventions, and suggests improvements.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Go test code to analyze (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "main_test.go")',
      },
      sourceCode: {
        type: 'string',
        description: 'Optional source code to analyze test coverage against',
      },
      // Analysis options
      focus: {
        type: 'string',
        description: 'Focus area for analysis',
        enum: ['coverage', 'structure', 'performance', 'naming', 'all'],
        default: 'all',
      },
      testType: {
        type: 'string',
        description: 'Type of tests to analyze',
        enum: ['unit', 'integration', 'benchmark', 'example', 'all'],
        default: 'all',
      },
      severity: {
        type: 'string',
        description: 'Minimum severity level to report',
        enum: ['info', 'warning', 'error', 'all'],
        default: 'all',
      },
      // Pagination
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return',
        default: 50,
        minimum: 1,
        maximum: 500,
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination',
        default: 0,
        minimum: 0,
      },
      // Sorting
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['severity', 'line', 'category', 'testType'],
        default: 'severity',
      },
      sortOrder: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
    required: ['code'],
  },
};

/**
 * Test analysis patterns and rules
 */
const TEST_PATTERNS = {
  naming: [
    {
      pattern: /func\s+(test\w+)\(/i,
      check: (match) => !match[1].startsWith('Test'),
      message: 'Test function should start with "Test" (capital T)',
      severity: 'error',
      category: 'naming',
      suggestion: 'Rename to Test* for proper test discovery',
    },
    {
      pattern: /func\s+(benchmark\w+)\(/i,
      check: (match) => !match[1].startsWith('Benchmark'),
      message: 'Benchmark function should start with "Benchmark"',
      severity: 'error',
      category: 'naming',
      suggestion: 'Rename to Benchmark* for proper benchmark discovery',
    },
    {
      pattern: /func\s+(example\w+)\(/i,
      check: (match) => !match[1].startsWith('Example'),
      message: 'Example function should start with "Example"',
      severity: 'warning',
      category: 'naming',
      suggestion: 'Rename to Example* for proper example discovery',
    },
  ],
  structure: [
    {
      pattern: /func\s+Test\w+\([^)]*\)\s*{[^}]*}/,
      check: (match) =>
        !match[0].includes('t.Error') &&
        !match[0].includes('t.Fatal') &&
        !match[0].includes('assert'),
      message: 'Test function has no assertions or error reporting',
      severity: 'warning',
      category: 'structure',
      suggestion: 'Add t.Error, t.Fatal, or assertion calls',
    },
    {
      pattern: /t\.Error\(/,
      check: (_, line) =>
        line.includes('t.Fatal(') && line.indexOf('t.Error(') > line.indexOf('t.Fatal('),
      message: 't.Error after t.Fatal is unreachable',
      severity: 'error',
      category: 'structure',
      suggestion: 'Remove t.Error after t.Fatal or use t.Error instead',
    },
    {
      pattern: /func\s+Test\w+\([^)]*\)\s*{[\s\S]*?defer/,
      check: () => false, // Always report as good practice
      message: 'Good: Test uses defer for cleanup',
      severity: 'info',
      category: 'structure',
      suggestion: 'Continue using defer for proper cleanup',
    },
  ],
  coverage: [
    {
      pattern: /\/\/\s*TODO.*test/i,
      message: 'TODO comment indicates missing test',
      severity: 'warning',
      category: 'coverage',
      suggestion: 'Implement the missing test',
    },
    {
      pattern: /func\s+(\w+)\([^)]*\)\s*[^{]*{/,
      check: (match, _, allCode) => {
        const funcName = match[1];
        return (
          !funcName.startsWith('Test') &&
          !funcName.startsWith('Benchmark') &&
          !funcName.startsWith('Example') &&
          !allCode.includes(`Test${funcName}`) &&
          funcName[0] === funcName[0].toUpperCase()
        ); // Exported function
      },
      message: 'Exported function may need a test',
      severity: 'info',
      category: 'coverage',
      suggestion: 'Consider adding a test for this exported function',
    },
  ],
  performance: [
    {
      pattern: /func\s+Benchmark\w+\([^)]*\)\s*{[\s\S]*?for\s+i\s*:=\s*0;\s*i\s*<\s*b\.N/,
      check: () => false, // Always report as good
      message: 'Good: Benchmark uses proper b.N loop',
      severity: 'info',
      category: 'performance',
      suggestion: 'Continue using b.N for accurate benchmarking',
    },
    {
      pattern: /func\s+Benchmark\w+\([^)]*\)\s*{[^}]*}/,
      check: (match) => !match[0].includes('b.ResetTimer') && match[0].includes('setup'),
      message: 'Benchmark with setup should call b.ResetTimer()',
      severity: 'warning',
      category: 'performance',
      suggestion: 'Call b.ResetTimer() after setup code',
    },
    {
      pattern: /b\.StopTimer\(\)/,
      check: (_, __, ___, lineNum, lines) => {
        // Check if there's a corresponding StartTimer
        const nextLines = lines.slice(lineNum, lineNum + 10).join('\n');
        return !nextLines.includes('b.StartTimer()');
      },
      message: 'b.StopTimer() without corresponding b.StartTimer()',
      severity: 'warning',
      category: 'performance',
      suggestion: 'Add b.StartTimer() to resume timing',
    },
  ],
  tableTests: [
    {
      pattern: /tests\s*:=\s*\[\]struct\s*{/,
      check: () => false, // Always report as good
      message: 'Good: Using table-driven tests',
      severity: 'info',
      category: 'structure',
      suggestion: 'Table-driven tests are a Go best practice',
    },
    {
      pattern: /for\s+.*range\s+tests\s*{[\s\S]*?t\.Run\(/,
      check: () => false, // Always report as good
      message: 'Good: Using t.Run for subtests',
      severity: 'info',
      category: 'structure',
      suggestion: 'Subtests provide better test organization',
    },
  ],
};

/**
 * Analyzes Go test code for quality and best practices
 * @param {string} code - Go test code to analyze
 * @param {string} filename - Filename for context
 * @param {string} focus - Focus area for analysis
 * @param {string} testType - Type of tests to analyze
 * @param {string} sourceCode - Optional source code for coverage analysis
 * @returns {Array} Test quality issues found
 */
function analyzeTestQuality(code, filename, focus, _, sourceCode) {
  const issues = [];
  const lines = code.split('\n');

  // Determine which categories to analyze
  const categoriesToAnalyze =
    focus === 'all' ? Object.keys(TEST_PATTERNS) : getCategoriesForFocus(focus);

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const category of categoriesToAnalyze) {
      const patterns = TEST_PATTERNS[category] || [];

      for (const rule of patterns) {
        const match = line.match(rule.pattern);
        if (match) {
          // Apply additional checks if specified
          let shouldReport = true;
          if (rule.check) {
            shouldReport = rule.check(match, line, code, lineNum, lines);
          }

          if (shouldReport) {
            issues.push({
              tool: 'test-analyzer',
              severity: rule.severity,
              category: rule.category,
              testType: detectTestType(line),
              line: lineNum + 1,
              column: line.search(rule.pattern) + 1,
              message: rule.message,
              suggestion: rule.suggestion,
              code: `test-${rule.category}`,
              file: filename,
              context: line.trim(),
            });
          }
        }
      }
    }
  }

  // Add coverage analysis if source code is provided
  if (sourceCode && (focus === 'all' || focus === 'coverage')) {
    const coverageIssues = analyzeCoverage(code, sourceCode, filename);
    issues.push(...coverageIssues);
  }

  return issues;
}

/**
 * Gets categories to analyze based on focus area
 * @param {string} focus - Focus area
 * @returns {Array} Categories to analyze
 */
function getCategoriesForFocus(focus) {
  const focusMap = {
    coverage: ['coverage'],
    structure: ['structure', 'tableTests'],
    performance: ['performance'],
    naming: ['naming'],
  };

  return focusMap[focus] || Object.keys(TEST_PATTERNS);
}

/**
 * Detects the type of test from a line of code
 * @param {string} line - Line of code
 * @returns {string} Test type
 */
function detectTestType(line) {
  if (/func\s+Test/.test(line)) {return 'unit';}
  if (/func\s+Benchmark/.test(line)) {return 'benchmark';}
  if (/func\s+Example/.test(line)) {return 'example';}
  if (/integration/i.test(line)) {return 'integration';}
  return 'unknown';
}

/**
 * Analyzes test coverage against source code
 * @param {string} testCode - Test code
 * @param {string} sourceCode - Source code
 * @param {string} filename - Filename for context
 * @returns {Array} Coverage issues
 */
function analyzeCoverage(testCode, sourceCode, filename) {
  const issues = [];
  const sourceLines = sourceCode.split('\n');

  // Find exported functions in source code
  const exportedFunctions = [];
  for (let lineNum = 0; lineNum < sourceLines.length; lineNum++) {
    const line = sourceLines[lineNum];
    const funcMatch = line.match(/func\s+([A-Z]\w*)\(/);
    if (funcMatch) {
      exportedFunctions.push({
        name: funcMatch[1],
        line: lineNum + 1,
      });
    }
  }

  // Check if each exported function has tests
  for (const func of exportedFunctions) {
    const hasTest =
      testCode.includes(`Test${func.name}`) ||
      testCode.includes(`test${func.name}`) ||
      testCode.includes(`"${func.name}"`); // Table test case

    if (!hasTest) {
      issues.push({
        tool: 'coverage-analyzer',
        severity: 'warning',
        category: 'coverage',
        testType: 'unit',
        line: func.line,
        column: 1,
        message: `Exported function '${func.name}' has no test`,
        suggestion: `Add Test${func.name} function`,
        code: 'missing-test',
        file: filename.replace('_test.go', '.go'),
      });
    }
  }

  return issues;
}

/**
 * Analyzes test metrics and statistics
 * @param {string} code - Test code
 * @returns {Object} Test metrics
 */
function analyzeTestMetrics(code) {
  const metrics = {
    totalTests: 0,
    benchmarks: 0,
    examples: 0,
    tableTests: 0,
    subtests: 0,
    assertions: 0,
    avgTestLength: 0,
  };

  const lines = code.split('\n');
  let currentTestLength = 0;
  let inTest = false;

  for (const line of lines) {
    // Count different types of tests
    if (/func\s+Test/.test(line)) {
      metrics.totalTests++;
      inTest = true;
      currentTestLength = 0;
    } else if (/func\s+Benchmark/.test(line)) {
      metrics.benchmarks++;
    } else if (/func\s+Example/.test(line)) {
      metrics.examples++;
    }

    // Count table tests
    if (/tests\s*:=\s*\[\]struct/.test(line)) {
      metrics.tableTests++;
    }

    // Count subtests
    if (/t\.Run\(/.test(line)) {
      metrics.subtests++;
    }

    // Count assertions
    if (/t\.(Error|Fatal|Fail)/.test(line) || /assert\./.test(line)) {
      metrics.assertions++;
    }

    // Track test length
    if (inTest) {
      currentTestLength++;
      if (line.trim() === '}' && currentTestLength > 1) {
        inTest = false;
      }
    }
  }

  metrics.avgTestLength =
    metrics.totalTests > 0 ? Math.round(lines.length / metrics.totalTests) : 0;

  return metrics;
}

/**
 * Filters and sorts test issues
 * @param {Array} issues - Raw test issues
 * @param {Object} options - Filter and sort options
 * @returns {Object} Filtered and sorted results
 */
function filterAndSortIssues(issues, options) {
  let filtered = [...issues];

  // Filter by severity
  if (options.severity !== 'all') {
    filtered = filtered.filter((issue) => issue.severity === options.severity);
  }

  // Filter by test type
  if (options.testType !== 'all') {
    filtered = filtered.filter((issue) => issue.testType === options.testType);
  }

  // Sort issues
  filtered.sort((a, b) => {
    let aVal, bVal;

    switch (options.sortBy) {
      case 'severity':
        const severityOrder = { error: 3, warning: 2, info: 1 };
        aVal = severityOrder[a.severity] || 0;
        bVal = severityOrder[b.severity] || 0;
        break;
      case 'line':
        aVal = a.line;
        bVal = b.line;
        break;
      case 'category':
        aVal = a.category;
        bVal = b.category;
        break;
      case 'testType':
        aVal = a.testType;
        bVal = b.testType;
        break;
      default:
        aVal = a.severity;
        bVal = b.severity;
    }

    if (options.sortOrder === 'desc') {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    } else {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    }
  });

  // Apply pagination
  const start = options.offset || 0;
  const end = start + (options.limit || 50);

  return {
    issues: filtered.slice(start, end),
    total: filtered.length,
    hasMore: end < filtered.length,
  };
}

/**
 * Main test analysis function
 * @param {Object} args - Analysis arguments
 * @returns {Promise<Object>} Test analysis results
 */
async function analyzeGoTests(args) {
  const {
    code,
    filename = 'main_test.go',
    sourceCode,
    focus = 'all',
    testType = 'all',
    severity = 'all',
    limit = 50,
    offset = 0,
    sortBy = 'severity',
    sortOrder = 'desc',
  } = args;

  // Validate input
  const validation = validateGoCode(code);
  if (!validation.valid) {
    return validation.error;
  }

  const safeFilename = sanitizeGoFilename(filename);
  const fileType = getGoFileType(safeFilename, code);

  // Check if this is actually a test file
  if (fileType !== 'test' && !safeFilename.includes('_test.go')) {
    return {
      content: [
        {
          type: 'text',
          text: '⚠️ Warning: This does not appear to be a Go test file. Test files should end with "_test.go".',
        },
      ],
    };
  }

  try {
    // Run test quality analysis
    const issues = analyzeTestQuality(code, safeFilename, focus, testType, sourceCode);

    // Get test metrics
    const metrics = analyzeTestMetrics(code);

    // Filter and sort results
    const result = filterAndSortIssues(issues, {
      severity,
      testType,
      sortBy,
      sortOrder,
      limit,
      offset,
    });

    // Generate summary
    const summary = {
      totalIssues: result.total,
      issuesShown: result.issues.length,
      hasMore: result.hasMore,
      focus,
      metrics,
      severityBreakdown: {},
      categoryBreakdown: {},
      testTypeBreakdown: {},
    };

    // Calculate breakdowns
    for (const issue of issues) {
      summary.severityBreakdown[issue.severity] =
        (summary.severityBreakdown[issue.severity] || 0) + 1;
      summary.categoryBreakdown[issue.category] =
        (summary.categoryBreakdown[issue.category] || 0) + 1;
      summary.testTypeBreakdown[issue.testType] =
        (summary.testTypeBreakdown[issue.testType] || 0) + 1;
    }

    // Format output
    let output = '# Go Test Analysis Results\n\n';
    output += `**File**: ${safeFilename}\n`;
    output += `**Focus**: ${focus}\n`;
    output += `**Analysis Date**: ${new Date().toISOString()}\n\n`;

    output += '## Test Metrics\n';
    output += `- **Total Tests**: ${metrics.totalTests}\n`;
    output += `- **Benchmarks**: ${metrics.benchmarks}\n`;
    output += `- **Examples**: ${metrics.examples}\n`;
    output += `- **Table Tests**: ${metrics.tableTests}\n`;
    output += `- **Subtests**: ${metrics.subtests}\n`;
    output += `- **Assertions**: ${metrics.assertions}\n`;
    output += `- **Avg Test Length**: ${metrics.avgTestLength} lines\n\n`;

    output += '## Analysis Summary\n';
    output += `- **Total Issues**: ${summary.totalIssues}\n`;
    output += `- **Showing**: ${summary.issuesShown} (offset: ${offset})\n`;

    if (summary.hasMore) {
      output += `- **More Available**: Yes (use offset=${offset + limit})\n`;
    }

    output += '\n### Severity Breakdown\n';
    for (const [sev, count] of Object.entries(summary.severityBreakdown)) {
      const icon = sev === 'error' ? '🔴' : sev === 'warning' ? '🟡' : '🔵';
      output += `- ${icon} **${sev}**: ${count}\n`;
    }

    output += '\n### Category Breakdown\n';
    for (const [cat, count] of Object.entries(summary.categoryBreakdown)) {
      output += `- **${cat}**: ${count}\n`;
    }

    if (result.issues.length > 0) {
      output += '\n## Test Quality Issues\n\n';

      for (const issue of result.issues) {
        const severityIcon =
          issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';

        output += `### ${severityIcon} Line ${issue.line}:${issue.column} - ${issue.category}\n`;
        output += `**Tool**: ${issue.tool}\n`;
        output += `**Severity**: ${issue.severity}\n`;
        output += `**Test Type**: ${issue.testType}\n`;
        output += `**Message**: ${issue.message}\n`;

        if (issue.suggestion) {
          output += `**Suggestion**: ${issue.suggestion}\n`;
        }

        if (issue.context) {
          output += `**Context**: \`${issue.context}\`\n`;
        }

        output += '\n';
      }
    } else {
      output += '\n## ✅ No Test Quality Issues Found\n\n';
      output += 'Great! Your Go tests follow best practices.\n\n';
    }

    // Add test recommendations
    output += '## 🧪 Test Recommendations\n\n';

    if (metrics.totalTests === 0) {
      output += '- **No tests found**: Add test functions starting with "Test"\n';
    } else {
      output += '- **Test Coverage**: Aim for >80% coverage of exported functions\n';
    }

    if (metrics.tableTests === 0 && metrics.totalTests > 3) {
      output += '- **Table Tests**: Consider using table-driven tests for similar test cases\n';
    }

    if (metrics.subtests === 0 && metrics.totalTests > 1) {
      output += '- **Subtests**: Use t.Run() for better test organization\n';
    }

    if (metrics.benchmarks === 0) {
      output += '- **Benchmarks**: Add benchmark tests for performance-critical functions\n';
    }

    output += '- Run tests with `go test -v` for verbose output\n';
    output += '- Use `go test -cover` to check test coverage\n';
    output += '- Consider `go test -race` to detect race conditions\n';

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      summary,
      issues: result.issues,
      metrics,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: Go test analysis failed\n\nDetails: ${error.message}`,
        },
      ],
    };
  }
}
export { analyzeGoTests };
