import { SafetyAnalyzer } from '../safety-analyzer.js';
import { validateCode, sanitizeFilename } from '../utils/validation.js';

/**
 * Tool definition for check_safety_rules
 */
export const safetyCheckerTool = {
  name: 'check_safety_rules',
  description: 'Analyzes JavaScript code against NASA JPL\'s Power of 10 safety-critical programming rules. Returns violations and a safety score (0-100).',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code to analyze for safety violations (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., \'critical.js\')',
      },
    },
    required: ['code'],
  },
};

/**
 * Handles the check_safety_rules tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.code - Code to analyze
 * @param {string} args.filename - Optional filename
 * @returns {Object} MCP response
 */
export async function handleSafetyChecker(args) {
  const { code, filename } = args;
  
  // Validate input
  const validation = validateCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeFilename(filename);
  
  try {
    const analyzer = new SafetyAnalyzer();
    const result = analyzer.analyze(code, safeFilename);
    
    const { violations, score, summary } = result;
    
    let output = '🚀 NASA JPL Safety Analysis Results:\n';
    output += `Safety Score: ${score}/100 `;
    
    if (score >= 80) {
      output += '✅ (Safe for production)\n';
    } else if (score >= 60) {
      output += '⚠️  (Needs improvements)\n';
    } else {
      output += '❌ (Critical issues found)\n';
    }
    
    output += `\n📊 Summary:\n`;
    output += `- Critical violations: ${summary.critical}\n`;
    output += `- Warnings: ${summary.warnings}\n`;
    output += `- Info issues: ${summary.info}\n\n`;
    
    if (violations.length === 0) {
      output += '🎉 No safety violations detected! Code meets NASA JPL standards.\n';
    } else {
      // Group violations by severity
      const critical = violations.filter(v => v.severity === 'critical');
      const warnings = violations.filter(v => v.severity === 'warning');
      const info = violations.filter(v => v.severity === 'info');
      
      if (critical.length > 0) {
        output += '🚨 Critical Violations (must fix):\n';
        critical.forEach(v => {
          const location = v.line ? ` (line ${v.line})` : '';
          output += `  • ${v.message}${location}\n`;
        });
        output += '\n';
      }
      
      if (warnings.length > 0) {
        output += '⚠️  Warnings (should fix):\n';
        warnings.forEach(v => {
          const location = v.line ? ` (line ${v.line})` : '';
          output += `  • ${v.message}${location}\n`;
        });
        output += '\n';
      }
      
      if (info.length > 0) {
        output += 'ℹ️  Informational (consider fixing):\n';
        info.forEach(v => {
          const location = v.line ? ` (line ${v.line})` : '';
          output += `  • ${v.message}${location}\n`;
        });
        output += '\n';
      }
    }
    
    output += '📚 NASA JPL Power of 10 Rules:\n';
    output += '1. Avoid complex flow constructs (goto, recursion)\n';
    output += '2. Give all loops fixed bounds\n';
    output += '3. Avoid heap memory allocation\n';
    output += '4. Restrict functions to a single printed page (~60 lines)\n';
    output += '5. Use minimum of 2 runtime assertions per function\n';
    output += '6. Restrict data scope to smallest possible\n';
    output += '7. Check return value of all non-void functions\n';
    output += '8. Use preprocessor sparingly\n';
    output += '9. Limit pointer use to single dereference\n';
    output += '10. Compile with all warnings; address before release\n';
    
    return {
      content: [{
        type: 'text',
        text: output,
      }],
    };
  } catch (error) {
    console.error('Error analyzing safety rules:', error);
    
    let errorMessage = 'An error occurred while analyzing safety rules.';
    
    if (error.message.includes('Unexpected token') || error.message.includes('SyntaxError')) {
      errorMessage = 'The code contains syntax errors and cannot be analyzed.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\nPlease ensure the code is valid JavaScript.`,
      }],
    };
  }
}