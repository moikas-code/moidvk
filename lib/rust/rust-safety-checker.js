import { validateRustCode, sanitizeRustFilename, hasUnsafeCode, extractCrateDependencies } from '../utils/rust-validation.js';

/**
 * Tool definition for rust_safety_checker
 */
export const rustSafetyCheckerTool = {
  name: 'rust_safety_checker',
  description: 'Analyzes Rust code for memory safety issues, unsafe usage, and ownership violations. Provides safety score and recommendations.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Rust code to analyze for safety (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., \'main.rs\')',
      },
      strict: {
        type: 'boolean',
        description: 'Enable strict safety checks (no unsafe allowed)',
        default: false,
      },
    },
    required: ['code'],
  },
};

/**
 * Safety rules for Rust code
 */
const safetyRules = [
  {
    id: 'no-unsafe-blocks',
    name: 'No Unsafe Blocks',
    description: 'Avoid unsafe blocks unless absolutely necessary',
    severity: 'critical',
    check: (code) => {
      const unsafeMatches = code.match(/\bunsafe\s*\{/g);
      return {
        passed: !unsafeMatches,
        violations: unsafeMatches ? unsafeMatches.length : 0,
        locations: findLocations(code, /\bunsafe\s*\{/g),
      };
    },
  },
  {
    id: 'no-raw-pointers',
    name: 'No Raw Pointers',
    description: 'Avoid raw pointer usage (*const T, *mut T)',
    severity: 'high',
    check: (code) => {
      const rawPointers = code.match(/\*\s*(const|mut)\s+\w+/g);
      return {
        passed: !rawPointers,
        violations: rawPointers ? rawPointers.length : 0,
        locations: findLocations(code, /\*\s*(const|mut)\s+\w+/g),
      };
    },
  },
  {
    id: 'no-unwrap-panic',
    name: 'No Unwrap/Expect in Production',
    description: 'Avoid unwrap() and expect() that can panic',
    severity: 'high',
    check: (code) => {
      const unwraps = code.match(/\.(unwrap|expect)\s*\(/g);
      return {
        passed: !unwraps,
        violations: unwraps ? unwraps.length : 0,
        locations: findLocations(code, /\.(unwrap|expect)\s*\(/g),
      };
    },
  },
  {
    id: 'no-panic-macro',
    name: 'No Panic Macros',
    description: 'Avoid panic!(), todo!(), unreachable!(), unimplemented!()',
    severity: 'high',
    check: (code) => {
      const panicMacros = code.match(/\b(panic!|todo!|unreachable!|unimplemented!)\s*\(/g);
      return {
        passed: !panicMacros,
        violations: panicMacros ? panicMacros.length : 0,
        locations: findLocations(code, /\b(panic!|todo!|unreachable!|unimplemented!)\s*\(/g),
      };
    },
  },
  {
    id: 'proper-error-handling',
    name: 'Proper Error Handling',
    description: 'Use Result<T, E> for error handling',
    severity: 'medium',
    check: (code) => {
      // Check for functions that should return Result
      const fnWithoutResult = code.match(/fn\s+\w+\s*\([^)]*\)\s*(?!->.*Result)/g);
      const hasIoOps = /std::(fs|io)|File::|read_|write_/.test(code);
      
      return {
        passed: !hasIoOps || !fnWithoutResult,
        violations: hasIoOps && fnWithoutResult ? fnWithoutResult.length : 0,
        locations: hasIoOps ? findLocations(code, /fn\s+\w+\s*\([^)]*\)\s*(?!->.*Result)/g) : [],
      };
    },
  },
  {
    id: 'no-mem-transmute',
    name: 'No Memory Transmutation',
    description: 'Avoid std::mem::transmute',
    severity: 'critical',
    check: (code) => {
      const transmutes = code.match(/mem::transmute|std::mem::transmute/g);
      return {
        passed: !transmutes,
        violations: transmutes ? transmutes.length : 0,
        locations: findLocations(code, /mem::transmute|std::mem::transmute/g),
      };
    },
  },
  {
    id: 'bounded-recursion',
    name: 'Bounded Recursion',
    description: 'Recursive functions should have clear termination conditions',
    severity: 'medium',
    check: (code) => {
      // Simple heuristic: look for functions that call themselves
      const fnNames = [...code.matchAll(/fn\s+(\w+)\s*\(/g)].map(m => m[1]);
      const recursiveFns = fnNames.filter(name => {
        const selfCallRegex = new RegExp(`\\b${name}\\s*\\(`);
        return selfCallRegex.test(code);
      });
      
      return {
        passed: recursiveFns.length === 0,
        violations: recursiveFns.length,
        locations: recursiveFns.map(fn => ({ line: 0, column: 0, function: fn })),
      };
    },
  },
  {
    id: 'no-global-mutable',
    name: 'No Global Mutable State',
    description: 'Avoid static mut variables',
    severity: 'high',
    check: (code) => {
      const staticMut = code.match(/static\s+mut\s+/g);
      return {
        passed: !staticMut,
        violations: staticMut ? staticMut.length : 0,
        locations: findLocations(code, /static\s+mut\s+/g),
      };
    },
  },
  {
    id: 'lifetime-annotations',
    name: 'Explicit Lifetime Annotations',
    description: 'Complex references should have explicit lifetimes',
    severity: 'low',
    check: (code) => {
      // Check for functions with multiple reference parameters without lifetimes
      const multiRefFns = code.match(/fn\s+\w+\s*\([^)]*&[^')]*&[^)]*\)/g);
      const withoutLifetimes = multiRefFns?.filter(fn => !fn.includes("'")) || [];
      
      return {
        passed: withoutLifetimes.length === 0,
        violations: withoutLifetimes.length,
        locations: findLocations(code, /fn\s+\w+\s*\([^)]*&[^')]*&[^)]*\)/g),
      };
    },
  },
  {
    id: 'no-integer-overflow',
    name: 'Checked Integer Operations',
    description: 'Use checked arithmetic operations to prevent overflow',
    severity: 'medium',
    check: (code) => {
      // Look for direct arithmetic on integers without checked_ methods
      const uncheckedOps = code.match(/\b(u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize)\s*[+\-*]\s*\d+/g);
      const hasChecked = code.includes('checked_') || code.includes('saturating_') || code.includes('wrapping_');
      
      return {
        passed: !uncheckedOps || hasChecked,
        violations: uncheckedOps && !hasChecked ? uncheckedOps.length : 0,
        locations: !hasChecked ? findLocations(code, /\b(u8|u16|u32|u64|u128|usize|i8|i16|i32|i64|i128|isize)\s*[+\-*]\s*\d+/g) : [],
      };
    },
  },
];

/**
 * Find line and column locations of matches
 * @param {string} code - The code to search
 * @param {RegExp} pattern - Pattern to find
 * @returns {Array} Array of {line, column} objects
 */
function findLocations(code, pattern) {
  const locations = [];
  const lines = code.split('\n');
  let lineOffset = 0;
  
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    const linePattern = new RegExp(pattern.source, pattern.flags.replace('g', ''));
    let match;
    
    while ((match = linePattern.exec(line)) !== null) {
      locations.push({
        line: lineNum + 1,
        column: match.index + 1,
      });
    }
    
    lineOffset += line.length + 1;
  }
  
  return locations;
}

/**
 * Calculate safety score
 * @param {Array} results - Rule check results
 * @returns {number} Safety score 0-100
 */
function calculateSafetyScore(results) {
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
 * Handles the rust_safety_checker tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleRustSafetyChecker(args) {
  const { code, filename, strict = false } = args;
  
  // Validate input
  const validation = validateRustCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeRustFilename(filename);
  
  try {
    // Run safety checks
    const results = safetyRules.map(rule => ({
      ...rule,
      ...rule.check(code),
    }));
    
    // Filter results based on strict mode
    const relevantResults = strict 
      ? results 
      : results.filter(r => r.severity !== 'low');
    
    const violations = relevantResults.filter(r => !r.passed);
    const safetyScore = calculateSafetyScore(relevantResults);
    
    // Check for unsafe code usage
    const hasUnsafe = hasUnsafeCode(code);
    const dependencies = extractCrateDependencies(code);
    
    let output = '🛡️ Rust Safety Analysis Results:\n\n';
    output += `Safety Score: ${safetyScore}/100 ${getSafetyEmoji(safetyScore)}\n`;
    output += `Mode: ${strict ? 'Strict' : 'Standard'}\n`;
    output += `Unsafe code detected: ${hasUnsafe ? 'Yes ⚠️' : 'No ✅'}\n`;
    
    if (dependencies.length > 0) {
      output += `External dependencies: ${dependencies.join(', ')}\n`;
    }
    
    output += '\n';
    
    if (violations.length === 0) {
      output += '✅ All safety checks passed!\n';
    } else {
      output += `Found ${violations.length} safety issue(s):\n\n`;
      
      // Group by severity
      const bySeverity = {
        critical: violations.filter(v => v.severity === 'critical'),
        high: violations.filter(v => v.severity === 'high'),
        medium: violations.filter(v => v.severity === 'medium'),
        low: violations.filter(v => v.severity === 'low'),
      };
      
      for (const [severity, items] of Object.entries(bySeverity)) {
        if (items.length > 0) {
          output += `${getSeverityEmoji(severity)} ${severity.toUpperCase()} (${items.length}):\n`;
          
          items.forEach(item => {
            output += `\n  ${item.name}:\n`;
            output += `  ${item.description}\n`;
            output += `  Violations: ${item.violations}\n`;
            
            if (item.locations.length > 0 && item.locations[0].line) {
              output += '  Locations:\n';
              item.locations.slice(0, 5).forEach(loc => {
                output += `    - Line ${loc.line}, Column ${loc.column}\n`;
              });
              if (item.locations.length > 5) {
                output += `    ... and ${item.locations.length - 5} more\n`;
              }
            }
          });
        }
      }
    }
    
    output += '\n💡 Recommendations:\n';
    
    if (safetyScore === 100) {
      output += '- Excellent! Your code follows Rust safety best practices.\n';
      output += '- Consider adding property-based tests for additional confidence.\n';
    } else if (safetyScore >= 80) {
      output += '- Good safety practices overall.\n';
      output += '- Address the critical and high severity issues first.\n';
      output += '- Consider using `#[deny(unsafe_code)]` attribute.\n';
    } else if (safetyScore >= 60) {
      output += '- Several safety concerns need attention.\n';
      output += '- Replace unwrap() with proper error handling using ? operator.\n';
      output += '- Avoid unsafe blocks unless absolutely necessary.\n';
      output += '- Use Result<T, E> for fallible operations.\n';
    } else {
      output += '- Significant safety improvements needed.\n';
      output += '- Eliminate all unsafe code if possible.\n';
      output += '- Replace panic!() with Result-based error handling.\n';
      output += '- Consider using `clippy::restriction` lints.\n';
      output += '- Review the Rust safety guidelines and ownership rules.\n';
    }
    
    // Include summary data
    const summary = {
      safetyScore,
      totalChecks: relevantResults.length,
      passed: relevantResults.filter(r => r.passed).length,
      violations: violations.length,
      hasUnsafeCode: hasUnsafe,
      dependencies: dependencies.length,
      severityCounts: {
        critical: violations.filter(v => v.severity === 'critical').length,
        high: violations.filter(v => v.severity === 'high').length,
        medium: violations.filter(v => v.severity === 'medium').length,
        low: violations.filter(v => v.severity === 'low').length,
      },
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
    console.error('Error analyzing Rust safety:', error);
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: Failed to analyze Rust code safety. ${error.message}`,
      }],
    };
  }
}

/**
 * Get emoji for safety score
 * @param {number} score - Safety score
 * @returns {string} Emoji
 */
function getSafetyEmoji(score) {
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