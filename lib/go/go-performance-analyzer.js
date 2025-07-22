import { validateGoCode, sanitizeGoFilename } from '../utils/go-validation.js';

/**
 * Tool definition for go_performance_analyzer
 */
export const goPerformanceAnalyzerTool = {
  name: 'go_performance_analyzer',
  description:
    'Analyzes Go code for performance issues, inefficient patterns, and optimization opportunities. Identifies memory allocations, inefficient algorithms, and suggests improvements.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Go code to analyze for performance issues (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "main.go")',
      },
      // Analysis options
      focus: {
        type: 'string',
        description: 'Focus area for analysis',
        enum: ['memory', 'cpu', 'io', 'concurrency', 'all'],
        default: 'all',
      },
      severity: {
        type: 'string',
        description: 'Minimum severity level to report',
        enum: ['info', 'warning', 'error', 'all'],
        default: 'all',
      },
      category: {
        type: 'string',
        description: 'Filter by performance category',
        enum: ['allocation', 'loops', 'strings', 'collections', 'goroutines', 'io', 'all'],
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
        enum: ['severity', 'line', 'category', 'impact'],
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
 * Performance analysis patterns and rules
 */
const PERFORMANCE_PATTERNS = {
  allocation: [
    {
      pattern: /make\(\[\].*,\s*0\s*,\s*\d+\)/,
      message: 'Consider pre-allocating slice with known capacity',
      severity: 'warning',
      impact: 'medium',
      suggestion: 'Use make([]Type, 0, capacity) or make([]Type, length)',
    },
    {
      pattern: /append\(.*\.\.\.\)/,
      message: 'Variadic append may cause multiple allocations',
      severity: 'info',
      impact: 'low',
      suggestion: 'Consider using copy() for large slices',
    },
    {
      pattern: /\+.*string.*\+/,
      message: 'String concatenation with + is inefficient for multiple strings',
      severity: 'warning',
      impact: 'medium',
      suggestion: 'Use strings.Builder or fmt.Sprintf for multiple concatenations',
    },
    {
      pattern: /new\(\w+\)/,
      message: 'Consider using composite literal instead of new()',
      severity: 'info',
      impact: 'low',
      suggestion: 'Use &Type{} instead of new(Type)',
    },
  ],
  loops: [
    {
      pattern: /for\s+.*range.*{[\s\S]*?len\(/,
      message: 'Avoid len() calls inside range loops',
      severity: 'warning',
      impact: 'medium',
      suggestion: 'Cache length outside loop or use range directly',
    },
    {
      pattern: /for\s+i\s*:=\s*0;\s*i\s*<\s*len\(/,
      message: 'Consider using range instead of index-based loop',
      severity: 'info',
      impact: 'low',
      suggestion: 'Use for i, v := range slice instead',
    },
    {
      pattern: /for.*{[\s\S]*?append\(/,
      message: 'Appending in loop may cause multiple reallocations',
      severity: 'warning',
      impact: 'high',
      suggestion: 'Pre-allocate slice with estimated capacity',
    },
  ],
  strings: [
    {
      pattern: /strings\.Replace\(.*,.*,.*,\s*-1\s*\)/,
      message: 'Use strings.ReplaceAll() instead of strings.Replace(..., -1)',
      severity: 'info',
      impact: 'low',
      suggestion: 'strings.ReplaceAll() is more readable and potentially faster',
    },
    {
      pattern: /fmt\.Sprintf\("%s",/,
      message: 'Unnecessary fmt.Sprintf for simple string conversion',
      severity: 'info',
      impact: 'low',
      suggestion: 'Use direct string conversion or string() cast',
    },
    {
      pattern: /regexp\.MustCompile.*for.*range/,
      message: 'Compiling regex inside loop is inefficient',
      severity: 'error',
      impact: 'high',
      suggestion: 'Compile regex outside loop and reuse',
    },
  ],
  collections: [
    {
      pattern: /delete\(.*map.*\).*for.*range/,
      message: 'Deleting from map while iterating may be inefficient',
      severity: 'warning',
      impact: 'medium',
      suggestion: 'Collect keys first, then delete in separate loop',
    },
    {
      pattern: /make\(map\[.*\]\w+\)/,
      message: 'Consider specifying initial capacity for large maps',
      severity: 'info',
      impact: 'low',
      suggestion: 'Use make(map[K]V, capacity) for better performance',
    },
  ],
  goroutines: [
    {
      pattern: /go\s+func\(\)/,
      message: 'Anonymous goroutine - consider using worker pool for many operations',
      severity: 'info',
      impact: 'medium',
      suggestion: 'Use worker pool pattern for better resource management',
    },
    {
      pattern: /time\.Sleep.*for.*range/,
      message: 'Sleep in loop may indicate inefficient polling',
      severity: 'warning',
      impact: 'medium',
      suggestion: 'Consider using channels or context for coordination',
    },
  ],
  io: [
    {
      pattern: /ioutil\.ReadFile/,
      message: 'ioutil.ReadFile is deprecated, use os.ReadFile',
      severity: 'warning',
      impact: 'low',
      suggestion: 'Use os.ReadFile (Go 1.16+) for better performance',
    },
    {
      pattern: /json\.Marshal.*for.*range/,
      message: 'JSON marshaling in loop is expensive',
      severity: 'warning',
      impact: 'high',
      suggestion: 'Batch operations or use streaming JSON encoder',
    },
  ],
};

/**
 * Analyzes Go code for performance issues using pattern matching
 * @param {string} code - Go code to analyze
 * @param {string} filename - Filename for context
 * @param {string} focus - Focus area for analysis
 * @returns {Array} Performance issues found
 */
function analyzePerformancePatterns(code, filename, focus) {
  const issues = [];
  const lines = code.split('\n');

  // Determine which categories to analyze
  const categoriesToAnalyze =
    focus === 'all' ? Object.keys(PERFORMANCE_PATTERNS) : getCategoriesForFocus(focus);

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const context = getLineContext(lines, lineNum, 3); // 3 lines of context

    for (const category of categoriesToAnalyze) {
      const patterns = PERFORMANCE_PATTERNS[category] || [];

      for (const rule of patterns) {
        if (rule.pattern.test(line) || rule.pattern.test(context)) {
          issues.push({
            tool: 'performance-analyzer',
            severity: rule.severity,
            category,
            impact: rule.impact,
            line: lineNum + 1,
            column: line.search(rule.pattern) + 1,
            message: rule.message,
            suggestion: rule.suggestion,
            code: `perf-${category}`,
            file: filename,
            context: context.trim(),
          });
        }
      }
    }
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
    memory: ['allocation', 'collections'],
    cpu: ['loops', 'strings', 'collections'],
    io: ['io', 'strings'],
    concurrency: ['goroutines'],
  };

  return focusMap[focus] || Object.keys(PERFORMANCE_PATTERNS);
}

/**
 * Gets context lines around a specific line
 * @param {Array} lines - All lines
 * @param {number} lineNum - Target line number
 * @param {number} contextSize - Number of context lines
 * @returns {string} Context string
 */
function getLineContext(lines, lineNum, contextSize) {
  const start = Math.max(0, lineNum - contextSize);
  const end = Math.min(lines.length, lineNum + contextSize + 1);
  return lines.slice(start, end).join('\n');
}

/**
 * Analyzes Go code for complexity issues
 * @param {string} code - Go code to analyze
 * @param {string} filename - Filename for context
 * @returns {Array} Complexity issues found
 */
function analyzeComplexity(code, filename) {
  const issues = [];
  const lines = code.split('\n');

  // Analyze cyclomatic complexity (simplified)
  let currentFunction = null;
  let branchCount = 0;
  let functionStartLine = 0;

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum].trim();

    // Function start
    const funcMatch = line.match(/func\s+(\w+)/);
    if (funcMatch) {
      if (currentFunction && branchCount > 10) {
        issues.push({
          tool: 'complexity-analyzer',
          severity: 'warning',
          category: 'complexity',
          impact: 'high',
          line: functionStartLine + 1,
          column: 1,
          message: `Function '${currentFunction}' has high cyclomatic complexity (${branchCount})`,
          suggestion: 'Consider breaking down into smaller functions',
          code: 'high-complexity',
          file: filename,
        });
      }

      currentFunction = funcMatch[1];
      branchCount = 1; // Base complexity
      functionStartLine = lineNum;
    }

    // Count branching statements
    if (/\b(if|for|switch|case|select)\b/.test(line)) {
      branchCount++;
    }
  }

  // Check last function
  if (currentFunction && branchCount > 10) {
    issues.push({
      tool: 'complexity-analyzer',
      severity: 'warning',
      category: 'complexity',
      impact: 'high',
      line: functionStartLine + 1,
      column: 1,
      message: `Function '${currentFunction}' has high cyclomatic complexity (${branchCount})`,
      suggestion: 'Consider breaking down into smaller functions',
      code: 'high-complexity',
      file: filename,
    });
  }

  return issues;
}

/**
 * Analyzes Go code for memory allocation patterns
 * @param {string} code - Go code to analyze
 * @param {string} filename - Filename for context
 * @returns {Array} Memory allocation issues
 */
function analyzeMemoryPatterns(code, filename) {
  const issues = [];
  const lines = code.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    // Check for potential memory leaks
    if (/go\s+func/.test(line) && !/defer/.test(line)) {
      const nextLines = lines.slice(lineNum, lineNum + 5).join('\n');
      if (
        !/defer.*close|defer.*cancel/.test(nextLines) &&
        /(chan|http\.Client|sql\.DB)/.test(nextLines)
      ) {
        issues.push({
          tool: 'memory-analyzer',
          severity: 'warning',
          category: 'memory',
          impact: 'high',
          line: lineNum + 1,
          column: 1,
          message: 'Potential resource leak in goroutine',
          suggestion: 'Ensure resources are properly closed with defer',
          code: 'resource-leak',
          file: filename,
        });
      }
    }

    // Check for large struct copying
    if (/=.*\w+{/.test(line) && line.length > 100) {
      issues.push({
        tool: 'memory-analyzer',
        severity: 'info',
        category: 'memory',
        impact: 'medium',
        line: lineNum + 1,
        column: 1,
        message: 'Large struct literal - consider using pointer',
        suggestion: 'Use &StructType{...} to avoid copying',
        code: 'large-struct-copy',
        file: filename,
      });
    }
  }

  return issues;
}

/**
 * Filters and sorts performance issues
 * @param {Array} issues - Raw performance issues
 * @param {Object} options - Filter and sort options
 * @returns {Object} Filtered and sorted results
 */
function filterAndSortIssues(issues, options) {
  let filtered = [...issues];

  // Filter by severity
  if (options.severity !== 'all') {
    filtered = filtered.filter((issue) => issue.severity === options.severity);
  }

  // Filter by category
  if (options.category !== 'all') {
    filtered = filtered.filter((issue) => issue.category === options.category);
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
      case 'impact':
        const impactOrder = { high: 3, medium: 2, low: 1 };
        aVal = impactOrder[a.impact] || 0;
        bVal = impactOrder[b.impact] || 0;
        break;
      case 'line':
        aVal = a.line;
        bVal = b.line;
        break;
      case 'category':
        aVal = a.category;
        bVal = b.category;
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
 * Main performance analysis function
 * @param {Object} args - Analysis arguments
 * @returns {Promise<Object>} Performance analysis results
 */
async function analyzeGoPerformance(args) {
  const {
    code,
    filename = 'main.go',
    focus = 'all',
    severity = 'all',
    category = 'all',
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

  try {
    // Run different types of performance analysis
    const allIssues = [];

    // Pattern-based analysis
    const patternIssues = analyzePerformancePatterns(code, safeFilename, focus);
    allIssues.push(...patternIssues);

    // Complexity analysis
    const complexityIssues = analyzeComplexity(code, safeFilename);
    allIssues.push(...complexityIssues);

    // Memory pattern analysis
    const memoryIssues = analyzeMemoryPatterns(code, safeFilename);
    allIssues.push(...memoryIssues);

    // Filter and sort results
    const result = filterAndSortIssues(allIssues, {
      severity,
      category,
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
      severityBreakdown: {},
      categoryBreakdown: {},
      impactBreakdown: {},
    };

    // Calculate breakdowns
    for (const issue of allIssues) {
      summary.severityBreakdown[issue.severity] =
        (summary.severityBreakdown[issue.severity] || 0) + 1;
      summary.categoryBreakdown[issue.category] =
        (summary.categoryBreakdown[issue.category] || 0) + 1;
      summary.impactBreakdown[issue.impact] = (summary.impactBreakdown[issue.impact] || 0) + 1;
    }

    // Format output
    let output = '# Go Performance Analysis Results\n\n';
    output += `**File**: ${safeFilename}\n`;
    output += `**Focus**: ${focus}\n`;
    output += `**Analysis Date**: ${new Date().toISOString()}\n\n`;

    output += '## Summary\n';
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

    output += '\n### Impact Breakdown\n';
    for (const [impact, count] of Object.entries(summary.impactBreakdown)) {
      const icon = impact === 'high' ? '🔴' : impact === 'medium' ? '🟡' : '🔵';
      output += `- ${icon} **${impact}**: ${count}\n`;
    }

    if (result.issues.length > 0) {
      output += '\n## Performance Issues\n\n';

      for (const issue of result.issues) {
        const severityIcon =
          issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';
        const impactIcon = issue.impact === 'high' ? '⚡' : issue.impact === 'medium' ? '⚠️' : 'ℹ️';

        output += `### ${severityIcon} ${impactIcon} Line ${issue.line}:${issue.column} - ${issue.category}\n`;
        output += `**Tool**: ${issue.tool}\n`;
        output += `**Severity**: ${issue.severity}\n`;
        output += `**Impact**: ${issue.impact}\n`;
        output += `**Message**: ${issue.message}\n`;

        if (issue.suggestion) {
          output += `**Suggestion**: ${issue.suggestion}\n`;
        }

        if (issue.context) {
          output += `**Context**:\n\`\`\`go\n${issue.context}\n\`\`\`\n`;
        }

        output += '\n';
      }
    } else {
      output += '\n## ✅ No Performance Issues Found\n\n';
      output += 'Great! Your Go code appears to be well-optimized.\n\n';
    }

    // Add performance recommendations
    output += '## 🚀 Performance Recommendations\n\n';
    if (summary.totalIssues > 0) {
      output += '- **High Impact**: Address these first for maximum performance gain\n';
      output += '- **Memory Issues**: Focus on reducing allocations and preventing leaks\n';
      output += '- **Loop Optimizations**: Pre-allocate slices and avoid repeated calculations\n';
      output += '- **String Operations**: Use strings.Builder for multiple concatenations\n';
    } else {
      output += '- Consider profiling with `go tool pprof` for runtime analysis\n';
      output += '- Use `go test -bench` to benchmark critical functions\n';
      output += '- Monitor memory usage with `go tool trace`\n';
    }

    output += '- Run `go build -gcflags="-m"` to see compiler optimizations\n';
    output += '- Use `go vet` for additional static analysis\n';

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      summary,
      issues: result.issues,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: Go performance analysis failed\n\nDetails: ${error.message}`,
        },
      ],
    };
  }
}
export { analyzeGoPerformance };
