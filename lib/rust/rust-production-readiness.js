import { validateRustCode, sanitizeRustFilename, hasUnsafeCode, extractCrateDependencies } from '../utils/rust-validation.js';

/**
 * Tool definition for rust_production_readiness
 */
export const rustProductionReadinessTool = {
  name: 'rust_production_readiness',
  description: 'Analyzes Rust code for production deployment readiness. Checks for TODO comments, debugging code, error handling, documentation, and production best practices.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Rust code to analyze for production readiness (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., \'main.rs\')',
      },
      strict: {
        type: 'boolean',
        description: 'Enable extra strict mode for critical production code',
        default: false,
      },
      // Filtering
      category: {
        type: 'string',
        description: 'Filter by issue category',
        enum: ['debugging', 'todos', 'error-handling', 'documentation', 'logging', 'testing', 'all'],
        default: 'all',
      },
      severity: {
        type: 'string',
        description: 'Filter by severity level',
        enum: ['critical', 'high', 'medium', 'low', 'all'],
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
 * Production readiness checks
 */
const productionChecks = [
  {
    id: 'no-todos',
    category: 'todos',
    name: 'No TODO Comments',
    description: 'Remove all TODO, FIXME, HACK, and XXX comments',
    severity: 'medium',
    check: (code) => {
      const todoPatterns = /\b(TODO|FIXME|HACK|XXX)\b/gi;
      const matches = [...code.matchAll(todoPatterns)];
      return {
        passed: matches.length === 0,
        violations: matches.map(match => ({
          line: code.substring(0, match.index).split('\n').length,
          type: match[1],
          context: code.substring(match.index, match.index + 50).replace(/\n/g, ' '),
        })),
      };
    },
  },
  {
    id: 'no-debug-prints',
    category: 'debugging',
    name: 'No Debug Print Statements',
    description: 'Remove println!, eprintln!, dbg! macros used for debugging',
    severity: 'high',
    check: (code) => {
      const debugPatterns = /\b(println!|eprintln!|dbg!)\s*\(/g;
      const matches = [...code.matchAll(debugPatterns)];
      return {
        passed: matches.length === 0,
        violations: matches.map(match => ({
          line: code.substring(0, match.index).split('\n').length,
          macro: match[1],
        })),
      };
    },
  },
  {
    id: 'proper-logging',
    category: 'logging',
    name: 'Use Proper Logging Framework',
    description: 'Use log crate instead of println! for logging',
    severity: 'high',
    check: (code) => {
      const hasPrintln = /println!\s*\(/.test(code);
      const hasLogCrate = /use\s+(log|env_logger|tracing)/.test(code);
      
      return {
        passed: !hasPrintln || hasLogCrate,
        violations: hasPrintln && !hasLogCrate ? [{
          message: 'Consider using a logging framework (log, env_logger, tracing)',
        }] : [],
      };
    },
  },
  {
    id: 'no-unwrap-expect',
    category: 'error-handling',
    name: 'No Unwrap or Expect in Production',
    description: 'Replace unwrap() and expect() with proper error handling',
    severity: 'critical',
    check: (code) => {
      const unwrapPatterns = /\.(unwrap|expect)\s*\(/g;
      const matches = [...code.matchAll(unwrapPatterns)];
      
      // Filter out test code
      const nonTestMatches = matches.filter(match => {
        const lineStart = code.lastIndexOf('\n', match.index);
        const lineEnd = code.indexOf('\n', match.index);
        const line = code.substring(lineStart, lineEnd);
        return !line.includes('#[test]') && !line.includes('#[cfg(test)]');
      });
      
      return {
        passed: nonTestMatches.length === 0,
        violations: nonTestMatches.map(match => ({
          line: code.substring(0, match.index).split('\n').length,
          method: match[1],
        })),
      };
    },
  },
  {
    id: 'no-panic-macros',
    category: 'error-handling',
    name: 'No Panic Macros',
    description: 'Avoid panic!, todo!, unreachable!, unimplemented! in production',
    severity: 'critical',
    check: (code) => {
      const panicPatterns = /\b(panic!|todo!|unreachable!|unimplemented!)\s*\(/g;
      const matches = [...code.matchAll(panicPatterns)];
      return {
        passed: matches.length === 0,
        violations: matches.map(match => ({
          line: code.substring(0, match.index).split('\n').length,
          macro: match[1],
        })),
      };
    },
  },
  {
    id: 'documented-public-items',
    category: 'documentation',
    name: 'Public Items Documented',
    description: 'All public functions, structs, and modules should have documentation',
    severity: 'medium',
    check: (code) => {
      const publicItems = [...code.matchAll(/\n\s*pub\s+(fn|struct|enum|trait|mod)\s+(\w+)/g)];
      const violations = [];
      
      for (const match of publicItems) {
        const itemStart = match.index;
        // Look backwards for doc comments
        const beforeItem = code.substring(Math.max(0, itemStart - 200), itemStart);
        const hasDoc = beforeItem.match(/\/\/\/.*\n\s*$/);
        
        if (!hasDoc) {
          violations.push({
            line: code.substring(0, match.index).split('\n').length + 1,
            type: match[1],
            name: match[2],
          });
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
      };
    },
  },
  {
    id: 'error-types',
    category: 'error-handling',
    name: 'Custom Error Types',
    description: 'Use custom error types instead of string errors',
    severity: 'medium',
    check: (code) => {
      const stringErrors = [...code.matchAll(/Result<[^,]+,\s*(&str|String)>/g)];
      return {
        passed: stringErrors.length === 0,
        violations: stringErrors.map(match => ({
          line: code.substring(0, match.index).split('\n').length,
          type: match[1],
        })),
      };
    },
  },
  {
    id: 'no-hardcoded-config',
    category: 'debugging',
    name: 'No Hardcoded Configuration',
    description: 'Configuration should be externalized',
    severity: 'high',
    check: (code) => {
      const configPatterns = [
        /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, // IP addresses
        /localhost:\d+/gi,
        /127\.0\.0\.1/g,
        /http:\/\/localhost/gi,
        /password\s*=\s*"[^"]+"/gi,
        /api_key\s*=\s*"[^"]+"/gi,
      ];
      
      const violations = [];
      for (const pattern of configPatterns) {
        const matches = [...code.matchAll(pattern)];
        violations.push(...matches.map(match => ({
          line: code.substring(0, match.index).split('\n').length,
          value: match[0].substring(0, 20) + '...',
        })));
      }
      
      return {
        passed: violations.length === 0,
        violations,
      };
    },
  },
  {
    id: 'test-coverage',
    category: 'testing',
    name: 'Test Coverage',
    description: 'Code should have associated tests',
    severity: 'medium',
    check: (code) => {
      const hasFunctions = /\bfn\s+\w+/.test(code);
      const hasTests = /#\[test\]|\#\[cfg\(test\)\]/g.test(code);
      const hasTestMod = /mod\s+tests\s*\{/.test(code);
      
      return {
        passed: !hasFunctions || hasTests || hasTestMod,
        violations: hasFunctions && !hasTests && !hasTestMod ? [{
          message: 'No tests found. Consider adding unit tests.',
        }] : [],
      };
    },
  },
  {
    id: 'no-compiler-warnings',
    category: 'debugging',
    name: 'No Allow Warnings',
    description: 'Remove #[allow(warnings)] and fix all warnings',
    severity: 'high',
    check: (code) => {
      const allowWarnings = [...code.matchAll(/#\[allow\(.*warnings.*\)\]/g)];
      return {
        passed: allowWarnings.length === 0,
        violations: allowWarnings.map(match => ({
          line: code.substring(0, match.index).split('\n').length,
          directive: match[0],
        })),
      };
    },
  },
  {
    id: 'clippy-lints',
    category: 'debugging',
    name: 'Clippy Compliance',
    description: 'Code should pass clippy lints',
    severity: 'medium',
    check: (code) => {
      const allowClippy = [...code.matchAll(/#\[allow\(clippy::/g)];
      return {
        passed: allowClippy.length === 0,
        violations: allowClippy.map(match => ({
          line: code.substring(0, match.index).split('\n').length,
          message: 'Remove clippy allow directives and fix the underlying issues',
        })),
      };
    },
  },
  {
    id: 'async-error-handling',
    category: 'error-handling',
    name: 'Async Error Handling',
    description: 'Async functions should properly handle errors',
    severity: 'high',
    check: (code) => {
      const asyncFns = [...code.matchAll(/async\s+fn\s+\w+[^{]+\{/g)];
      const violations = [];
      
      for (const match of asyncFns) {
        const fnBody = code.substring(match.index);
        const bodyEnd = fnBody.indexOf('\n}');
        const body = fnBody.substring(0, bodyEnd);
        
        // Check for unwrap in async context
        if (body.includes('.unwrap()') || body.includes('.expect(')) {
          violations.push({
            line: code.substring(0, match.index).split('\n').length,
            message: 'Async function contains unwrap/expect',
          });
        }
      }
      
      return {
        passed: violations.length === 0,
        violations,
      };
    },
  },
];

/**
 * Calculates production readiness score
 * @param {Array} results - Check results
 * @returns {number} Score from 0-100
 */
function calculateReadinessScore(results) {
  const weights = {
    critical: 30,
    high: 20,
    medium: 10,
    low: 5,
  };
  
  let totalWeight = 0;
  let passedWeight = 0;
  
  results.forEach(result => {
    const weight = weights[result.severity];
    totalWeight += weight;
    if (result.passed) {
      passedWeight += weight;
    }
  });
  
  return Math.round((passedWeight / totalWeight) * 100);
}

/**
 * Filters check results
 * @param {Array} results - All check results
 * @param {string} category - Category filter
 * @param {string} severity - Severity filter
 * @returns {Array} Filtered results
 */
function filterResults(results, category, severity) {
  return results.filter(result => {
    if (category !== 'all' && result.category !== category) {
      return false;
    }
    if (severity !== 'all' && result.severity !== severity) {
      return false;
    }
    return !result.passed; // Only return failed checks
  });
}

/**
 * Handles the rust_production_readiness tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleRustProductionReadiness(args) {
  const {
    code,
    filename,
    strict = false,
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
    // Run all production checks
    const results = productionChecks.map(check => {
      const result = check.check(code);
      return {
        ...check,
        passed: result.passed,
        violationCount: result.violations?.length || 0,
        violations: result.violations || [],
      };
    });
    
    // Additional strict mode checks
    if (strict) {
      // Check for any unsafe code
      if (hasUnsafeCode(code)) {
        results.push({
          id: 'no-unsafe-strict',
          category: 'error-handling',
          name: 'No Unsafe Code (Strict)',
          description: 'Strict mode forbids any unsafe code',
          severity: 'critical',
          passed: false,
          violationCount: 1,
          violations: [{ message: 'Unsafe code detected in strict mode' }],
        });
      }
      
      // Check for external dependencies
      const deps = extractCrateDependencies(code);
      if (deps.length > 0) {
        results.push({
          id: 'audit-dependencies',
          category: 'testing',
          name: 'Audit External Dependencies',
          description: 'All external dependencies should be audited',
          severity: 'high',
          passed: false,
          violationCount: deps.length,
          violations: deps.map(dep => ({ crate: dep })),
        });
      }
    }
    
    // Calculate score before filtering
    const readinessScore = calculateReadinessScore(results);
    
    // Filter results
    const failedChecks = filterResults(results, category, severity);
    
    // Apply pagination
    const totalIssues = failedChecks.length;
    const paginatedChecks = failedChecks.slice(offset, offset + limit);
    const hasMore = offset + limit < totalIssues;
    
    // Format output
    let output = '🚀 Rust Production Readiness Analysis:\n\n';
    output += `Production Readiness Score: ${readinessScore}/100 ${getScoreEmoji(readinessScore)}\n`;
    output += `Mode: ${strict ? 'Strict' : 'Standard'}\n`;
    output += `Total checks: ${results.length}\n`;
    output += `Passed: ${results.filter(r => r.passed).length}\n`;
    output += `Failed: ${results.filter(r => !r.passed).length}\n\n`;
    
    if (paginatedChecks.length === 0) {
      output += '✅ All production readiness checks passed!\n';
    } else {
      output += `Found ${totalIssues} issue(s) (showing ${paginatedChecks.length}):\n\n`;
      
      // Group by category
      const byCategory = {};
      for (const check of paginatedChecks) {
        if (!byCategory[check.category]) {
          byCategory[check.category] = [];
        }
        byCategory[check.category].push(check);
      }
      
      for (const [cat, checks] of Object.entries(byCategory)) {
        output += `📋 ${cat.toUpperCase()} (${checks.length} issues):\n\n`;
        
        for (const check of checks) {
          output += `  ${getSeverityEmoji(check.severity)} ${check.name}\n`;
          output += `  ${check.description}\n`;
          
          if (check.violations.length > 0) {
            const showViolations = check.violations.slice(0, 3);
            for (const violation of showViolations) {
              if (violation.line) {
                output += `    Line ${violation.line}: `;
              }
              if (violation.type) {
                output += `${violation.type} `;
              }
              if (violation.macro) {
                output += `${violation.macro} `;
              }
              if (violation.message) {
                output += violation.message;
              }
              if (violation.context) {
                output += `"${violation.context}"`;
              }
              output += '\n';
            }
            
            if (check.violations.length > 3) {
              output += `    ... and ${check.violations.length - 3} more\n`;
            }
          }
          output += '\n';
        }
      }
    }
    
    output += '\n💡 Production Deployment Checklist:\n';
    
    if (readinessScore === 100) {
      output += '✅ Code is production ready!\n';
      output += '- Consider running cargo clippy --all-targets\n';
      output += '- Ensure comprehensive test coverage\n';
      output += '- Set up monitoring and alerting\n';
    } else if (readinessScore >= 80) {
      output += '- Address all critical and high severity issues\n';
      output += '- Replace println! with proper logging\n';
      output += '- Add documentation for public APIs\n';
    } else if (readinessScore >= 60) {
      output += '- Remove all unwrap() and expect() calls\n';
      output += '- Eliminate panic! macros\n';
      output += '- Add proper error handling throughout\n';
      output += '- Remove TODO comments and debug prints\n';
    } else {
      output += '⚠️  Significant work needed before production:\n';
      output += '- Implement comprehensive error handling\n';
      output += '- Remove all debugging artifacts\n';
      output += '- Add tests and documentation\n';
      output += '- Consider a full code review\n';
    }
    
    // Summary data
    const summary = {
      readinessScore,
      totalChecks: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      filteredIssues: totalIssues,
      returnedIssues: paginatedChecks.length,
      hasMore,
      categoryCounts: Object.entries(byCategory).reduce((acc, [cat, checks]) => {
        acc[cat] = checks.length;
        return acc;
      }, {}),
    };
    
    return {
      content: [{
        type: 'text',
        text: output,
      }, {
        type: 'text',
        text: JSON.stringify(summary, null, 2),
      }],
    };
  } catch (error) {
    console.error('Error analyzing production readiness:', error);
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: Failed to analyze production readiness. ${error.message}`,
      }],
    };
  }
}

/**
 * Get emoji for readiness score
 * @param {number} score - Readiness score
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
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️',
  };
  return emojis[severity] || '•';
}