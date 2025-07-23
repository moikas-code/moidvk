import { validateRustCode, sanitizeRustFilename } from '../utils/rust-validation.js';

/**
 * Tool definition for rust_performance_analyzer
 */
export const rustPerformanceAnalyzerTool = {
  name: 'rust_performance_analyzer',
  description:
    'Analyzes Rust code for performance issues, inefficient patterns, and optimization opportunities. Identifies allocations, cloning, and algorithmic improvements.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Rust code to analyze for performance (max 100KB)',
      },
      filename: {
        type: 'string',
        description: "Optional filename for context (e.g., 'main.rs')",
      },
      focus: {
        type: 'string',
        description: 'Performance aspect to focus on',
        enum: ['memory', 'cpu', 'io', 'general'],
        default: 'general',
      },
      // Filtering
      category: {
        type: 'string',
        description: 'Filter by performance category',
        enum: ['allocation', 'cloning', 'loops', 'collections', 'io', 'async', 'all'],
        default: 'all',
      },
      severity: {
        type: 'string',
        description: 'Filter by impact severity',
        enum: ['high', 'medium', 'low', 'all'],
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
    },
    required: ['code'],
  },
};

/**
 * Performance analysis rules
 */
const performanceRules = [
  {
    id: 'unnecessary-clone',
    category: 'cloning',
    name: 'Unnecessary Clone Operations',
    description: 'Avoid cloning when borrowing would suffice',
    severity: 'high',
    check: (code) => {
      const clonePatterns = /\.clone\(\)/g;
      const matches = [...code.matchAll(clonePatterns)];
      const violations = [];

      for (const match of matches) {
        const lineStart = code.lastIndexOf('\n', match.index) + 1;
        const lineEnd = code.indexOf('\n', match.index);
        const line = code.substring(lineStart, lineEnd);

        // Check if clone might be unnecessary
        if (line.includes('return') || (line.includes('= ') && !line.includes('mut'))) {
          violations.push({
            line: code.substring(0, match.index).split('\n').length,
            context: line.trim(),
            suggestion: 'Consider borrowing instead of cloning',
          });
        }
      }

      return { violations };
    },
  },
  {
    id: 'string-allocation',
    category: 'allocation',
    name: 'Excessive String Allocations',
    description: 'Minimize String allocations, use &str where possible',
    severity: 'medium',
    check: (code) => {
      const violations = [];

      // Check for String::from() or to_string() in loops
      const stringAllocPatterns = /(String::from|\.to_string)\s*\(/g;
      const matches = [...code.matchAll(stringAllocPatterns)];

      for (const match of matches) {
        // Check if in a loop context
        const before = code.substring(Math.max(0, match.index - 100), match.index);
        if (before.match(/\b(for|while|loop)\b/)) {
          violations.push({
            line: code.substring(0, match.index).split('\n').length,
            type: match[1],
            context: 'String allocation inside loop',
            suggestion: 'Pre-allocate or use &str',
          });
        }
      }

      // Check for format! in hot paths
      const formatMatches = [...code.matchAll(/format!\s*\(/g)];
      for (const match of formatMatches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          type: 'format!',
          suggestion: 'Consider write! or pre-allocated String',
        });
      }

      return { violations };
    },
  },
  {
    id: 'vec-allocation',
    category: 'allocation',
    name: 'Vector Allocation Patterns',
    description: 'Pre-allocate vectors when size is known',
    severity: 'medium',
    check: (code) => {
      const violations = [];

      // Check for Vec::new() followed by push in loops
      const vecNewPattern = /let\s+mut\s+\w+\s*=\s*Vec::new\(\)/g;
      const matches = [...code.matchAll(vecNewPattern)];

      for (const match of matches) {
        const after = code.substring(match.index, Math.min(code.length, match.index + 200));
        if (after.match(/\.push\(/)) {
          violations.push({
            line: code.substring(0, match.index).split('\n').length,
            context: 'Vec::new() followed by push',
            suggestion: 'Use Vec::with_capacity() if size is known',
          });
        }
      }

      return { violations };
    },
  },
  {
    id: 'inefficient-iteration',
    category: 'loops',
    name: 'Inefficient Iteration Patterns',
    description: 'Use iterator methods instead of manual loops',
    severity: 'medium',
    check: (code) => {
      const violations = [];

      // Check for index-based iteration
      const indexPattern = /for\s+\w+\s+in\s+0\.\.\w+\.len\(\)/g;
      const matches = [...code.matchAll(indexPattern)];

      for (const match of matches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          pattern: 'Index-based loop',
          suggestion: 'Use .iter() or .iter_mut() instead',
        });
      }

      // Check for collect followed by iteration
      const collectIterPattern = /\.collect\(\)[^;]*\n[^}]*\.(iter|into_iter)\(/g;
      const collectMatches = [...code.matchAll(collectIterPattern)];

      for (const match of collectMatches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          pattern: 'Collect followed by iteration',
          suggestion: 'Chain iterators instead of collecting intermediate results',
        });
      }

      return { violations };
    },
  },
  {
    id: 'hashmap-performance',
    category: 'collections',
    name: 'HashMap Performance',
    description: 'Optimize HashMap usage',
    severity: 'medium',
    check: (code) => {
      const violations = [];

      // Check for repeated HashMap lookups
      const getPattern = /(\w+)\.get\([^)]+\)[^;]*\n[^}]*\1\.get\(/g;
      const matches = [...code.matchAll(getPattern)];

      for (const match of matches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          pattern: 'Repeated HashMap lookups',
          suggestion: 'Store the result of get() in a variable',
        });
      }

      // Check for contains_key followed by get
      const containsGetPattern = /\.contains_key\([^)]+\)[^}]*\.get\(/g;
      const containsMatches = [...code.matchAll(containsGetPattern)];

      for (const match of containsMatches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          pattern: 'contains_key followed by get',
          suggestion: 'Use entry() API or match on get()',
        });
      }

      return { violations };
    },
  },
  {
    id: 'boxing-overhead',
    category: 'allocation',
    name: 'Unnecessary Boxing',
    description: 'Avoid Box when stack allocation is sufficient',
    severity: 'low',
    check: (code) => {
      const violations = [];

      // Check for Box::new with small types
      const boxPattern = /Box::new\(([^)]+)\)/g;
      const matches = [...code.matchAll(boxPattern)];

      for (const match of matches) {
        const content = match[1];
        // Check if it's a simple value or small struct
        if (content.match(/^\d+$|^"[^"]+"|^true|^false/)) {
          violations.push({
            line: code.substring(0, match.index).split('\n').length,
            value: content,
            suggestion: 'Consider stack allocation for small values',
          });
        }
      }

      return { violations };
    },
  },
  {
    id: 'async-performance',
    category: 'async',
    name: 'Async Performance Issues',
    description: 'Optimize async code patterns',
    severity: 'high',
    check: (code) => {
      const violations = [];

      // Check for blocking operations in async
      const blockingInAsync =
        /async[^{]*\{[^}]*\b(std::thread::sleep|\.read_to_string|\.write_all)\(/g;
      const matches = [...code.matchAll(blockingInAsync)];

      for (const match of matches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          operation: match[1],
          suggestion: 'Use async alternatives (tokio::time::sleep, async IO)',
        });
      }

      // Check for unnecessary await
      const unnecessaryAwait = /\.await\s*\??\s*;?\s*\n\s*\}/g;
      const awaitMatches = [...code.matchAll(unnecessaryAwait)];

      for (const match of awaitMatches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          pattern: 'Await at end of function',
          suggestion: 'Return the future directly without awaiting',
        });
      }

      return { violations };
    },
  },
  {
    id: 'io-buffering',
    category: 'io',
    name: 'I/O Buffering',
    description: 'Use buffered I/O for better performance',
    severity: 'high',
    check: (code) => {
      const violations = [];

      // Check for unbuffered file operations
      const fileReadPattern = /File::open[^;]*\n[^}]*\.read/g;
      const matches = [...code.matchAll(fileReadPattern)];

      for (const match of matches) {
        if (!match[0].includes('BufReader')) {
          violations.push({
            line: code.substring(0, match.index).split('\n').length,
            pattern: 'Unbuffered file read',
            suggestion: 'Use BufReader for file operations',
          });
        }
      }

      // Check for line-by-line writing
      const writePattern = /for[^{]*\{[^}]*\.write|\.write_all/g;
      const writeMatches = [...code.matchAll(writePattern)];

      for (const match of writeMatches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          pattern: 'Multiple writes in loop',
          suggestion: 'Use BufWriter to batch writes',
        });
      }

      return { violations };
    },
  },
  {
    id: 'regex-compilation',
    category: 'cpu',
    name: 'Regex Compilation',
    description: 'Compile regex once, not in loops',
    severity: 'high',
    check: (code) => {
      const violations = [];

      // Check for Regex::new in loops or functions
      const regexInLoop = /(?:for|while|loop)[^{]*\{[^}]*Regex::new/g;
      const matches = [...code.matchAll(regexInLoop)];

      for (const match of matches) {
        violations.push({
          line: code.substring(0, match.index).split('\n').length,
          context: 'Regex compilation in loop',
          suggestion: 'Use lazy_static or OnceCell for regex compilation',
        });
      }

      return { violations };
    },
  },
];

/**
 * Calculate performance impact score
 * @param {Array} results - Analysis results
 * @returns {number} Score from 0-100 (100 = optimal)
 */
function calculatePerformanceScore(results) {
  const weights = {
    high: 20,
    medium: 10,
    low: 5,
  };

  let totalImpact = 0;
  let maxImpact = results.length * weights.high;

  results.forEach((result) => {
    const violationCount = result.violations.length;
    const impact = violationCount * weights[result.severity];
    totalImpact += impact;
  });

  if (maxImpact === 0) return 100;

  const score = Math.max(0, 100 - (totalImpact / maxImpact) * 100);
  return Math.round(score);
}

/**
 * Handles the rust_performance_analyzer tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleRustPerformanceAnalyzer(args) {
  const {
    code,
    filename,
    focus = 'general',
    category = 'all',
    severity = 'all',
    limit = 50,
    offset = 0,
  } = args.params || args;

  // Validate input
  const validation = validateRustCode(code);
  if (!validation.valid) {
    return validation.error;
  }

  const safeFilename = sanitizeRustFilename(filename);

  try {
    // Run performance analysis
    const results = performanceRules.map((rule) => {
      const { violations } = rule.check(code);
      return {
        ...rule,
        violations,
        violationCount: violations.length,
      };
    });

    // Calculate performance score
    const performanceScore = calculatePerformanceScore(results);

    // Filter results by focus area
    let focusedResults = results;
    if (focus !== 'general') {
      const focusMap = {
        memory: ['allocation', 'cloning'],
        cpu: ['loops', 'cpu'],
        io: ['io', 'async'],
      };

      const focusCategories = focusMap[focus] || [];
      focusedResults = results.filter((r) => focusCategories.includes(r.category));
    }

    // Filter by category and severity
    let filteredResults = focusedResults.filter((result) => {
      if (result.violations.length === 0) return false;
      if (category !== 'all' && result.category !== category) return false;
      if (severity !== 'all' && result.severity !== severity) return false;
      return true;
    });

    // Flatten violations for pagination
    const allViolations = [];
    filteredResults.forEach((result) => {
      result.violations.forEach((violation) => {
        allViolations.push({
          ...violation,
          rule: result.name,
          category: result.category,
          severity: result.severity,
          description: result.description,
        });
      });
    });

    // Apply pagination
    const totalViolations = allViolations.length;
    const paginatedViolations = allViolations.slice(offset, offset + limit);
    const hasMore = offset + limit < totalViolations;

    // Format output
    let output = '⚡ Rust Performance Analysis Results:\n\n';
    output += `Performance Score: ${performanceScore}/100 ${getScoreEmoji(performanceScore)}\n`;
    output += `Focus: ${focus.charAt(0).toUpperCase() + focus.slice(1)}\n`;
    output += `Total issues found: ${totalViolations}\n\n`;

    // Group by category for better readability
    const byCategory = {};

    if (paginatedViolations.length === 0) {
      output += '✅ No performance issues detected!\n';
      output += 'Your code follows performance best practices.\n';
    } else {
      output += `Showing ${paginatedViolations.length} of ${totalViolations} issues:\n\n`;
      paginatedViolations.forEach((violation) => {
        if (!byCategory[violation.category]) {
          byCategory[violation.category] = [];
        }
        byCategory[violation.category].push(violation);
      });

      for (const [cat, violations] of Object.entries(byCategory)) {
        output += `\n📊 ${cat.toUpperCase()} (${violations.length} issues):\n`;

        violations.forEach((violation) => {
          output += `\n  ${getSeverityEmoji(violation.severity)} ${violation.rule}\n`;
          output += `  Line ${violation.line}: ${violation.description}\n`;

          if (violation.context) {
            output += `  Context: ${violation.context}\n`;
          }

          if (violation.pattern) {
            output += `  Pattern: ${violation.pattern}\n`;
          }

          if (violation.suggestion) {
            output += `  💡 ${violation.suggestion}\n`;
          }
        });
      }
    }

    output += '\n\n🚀 Performance Optimization Tips:\n';

    if (performanceScore >= 90) {
      output += '- Excellent performance characteristics!\n';
      output += '- Consider profiling with cargo flamegraph for micro-optimizations\n';
      output += '- Use cargo bench for performance regression testing\n';
    } else if (performanceScore >= 70) {
      output += '- Good performance, with room for improvement\n';
      output += '- Focus on high-severity issues first\n';
      output += '- Consider using #[inline] for small, hot functions\n';
      output += '- Profile allocations with valgrind or heaptrack\n';
    } else if (performanceScore >= 50) {
      output += '- Several performance improvements needed\n';
      output += '- Reduce allocations in hot paths\n';
      output += '- Use borrowing instead of cloning where possible\n';
      output += '- Consider zero-copy parsing for I/O operations\n';
      output += '- Review algorithm complexity\n';
    } else {
      output += '⚠️  Significant performance optimization needed:\n';
      output += '- Eliminate allocations in loops\n';
      output += '- Use appropriate data structures\n';
      output += '- Implement proper I/O buffering\n';
      output += '- Consider algorithmic improvements\n';
      output += '- Profile with cargo-profiling tools\n';
    }

    // Add focus-specific recommendations
    if (focus === 'memory') {
      output += '\n📦 Memory-specific recommendations:\n';
      output += '- Use Cow<str> for potentially borrowed strings\n';
      output += '- Consider arena allocators for temporary objects\n';
      output += '- Use smallvec for small collections\n';
    } else if (focus === 'cpu') {
      output += '\n🔥 CPU-specific recommendations:\n';
      output += '- Enable link-time optimization (LTO)\n';
      output += '- Use SIMD operations where applicable\n';
      output += '- Consider parallel iterators with rayon\n';
    } else if (focus === 'io') {
      output += '\n💾 I/O-specific recommendations:\n';
      output += '- Use memory-mapped files for large data\n';
      output += '- Implement async I/O with tokio or async-std\n';
      output += '- Batch operations to reduce syscalls\n';
    }

    // Summary data
    const summary = {
      performanceScore,
      focus,
      totalIssues: totalViolations,
      returnedIssues: paginatedViolations.length,
      hasMore,
      categoryCounts: Object.entries(byCategory).reduce((acc, [cat, items]) => {
        acc[cat] = items.length;
        return acc;
      }, {}),
      severityCounts: {
        high: allViolations.filter((v) => v.severity === 'high').length,
        medium: allViolations.filter((v) => v.severity === 'medium').length,
        low: allViolations.filter((v) => v.severity === 'low').length,
      },
    };

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
        {
          type: 'text',
          text: JSON.stringify(summary, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('Error analyzing performance:', error);

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: Failed to analyze performance. ${error.message}`,
        },
      ],
    };
  }
}

/**
 * Get emoji for performance score
 * @param {number} score - Performance score
 * @returns {string} Emoji
 */
function getScoreEmoji(score) {
  if (score >= 90) return '🟢';
  if (score >= 70) return '🟡';
  if (score >= 50) return '🟠';
  return '🔴';
}

/**
 * Get emoji for severity
 * @param {string} severity - Severity level
 * @returns {string} Emoji
 */
function getSeverityEmoji(severity) {
  const emojis = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };
  return emojis[severity] || '•';
}
