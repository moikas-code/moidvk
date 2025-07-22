import { ESLint } from 'eslint';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';
import { eslintConfig } from '../config/eslint-config.js';
import { productionEslintConfig } from '../config/production-eslint-config.js';

// ESLint instances will be created per request based on production parameter

/**
 * Tool definition for check_code_practices
 */
export const codePracticesTool = {
  name: 'check_code_practices',
  description: 'Analyzes a JavaScript code snippet for best practices using ESLint with pagination and filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code snippet to analyze (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., \'example.js\')',
      },
      production: {
        type: 'boolean',
        description: 'Enable stricter production code checking (default: false)',
        default: false,
      },
      // Pagination parameters
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50, max: 500)',
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
      // Filtering parameters
      severity: {
        type: 'string',
        description: 'Filter by severity level',
        enum: ['error', 'warning', 'all'],
        default: 'all',
      },
      ruleCategory: {
        type: 'string',
        description: 'Filter by rule category',
        enum: ['possible-errors', 'best-practices', 'stylistic-issues', 'es6', 'all'],
        default: 'all',
      },
      // Sorting parameters
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['line', 'severity', 'ruleId', 'message'],
        default: 'line',
      },
      sortOrder: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'asc',
      },
    },
    required: ['code'],
  },
};

/**
 * Handles the check_code_practices tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.code - Code to analyze
 * @param {string} args.filename - Optional filename
 * @param {boolean} args.production - Enable production mode for stricter checking
 * @returns {Object} MCP response
 */
export async function handleCodePractices(args) {
  const { 
    code, 
    filename, 
    production = false,
    limit = 50,
    offset = 0,
    severity = 'all',
    ruleCategory = 'all',
    sortBy = 'line',
    sortOrder = 'asc'
  } = args;
  
  // Validate input
  const validation = validateCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeFilename(filename);
  
  // Create ESLint instance with appropriate config
  const config = production ? productionEslintConfig : eslintConfig;
  const eslint = new ESLint(config);
  
  try {
    const lintPromise = eslint.lintText(code, { filePath: safeFilename });
    const results = await withTimeout(lintPromise, LINT_TIMEOUT_MS, "Linting");
    
    const result = results[0];
    const allMessages = result?.messages || [];
    const errorCount = result?.errorCount || 0;
    const warningCount = result?.warningCount || 0;

    if (allMessages.length === 0) {
      const modeText = production ? ' (production mode)' : '';
      return {
        content: [{
          type: 'text',
          text: `✅ The code follows best practices with no issues detected${modeText}.`,
        }],
      };
    }

    // Apply filtering
    let filteredMessages = filterMessages(allMessages, severity, ruleCategory);
    
    // Apply sorting
    filteredMessages = sortMessages(filteredMessages, sortBy, sortOrder);
    
    // Apply pagination
    const totalIssues = filteredMessages.length;
    const paginatedMessages = filteredMessages.slice(offset, offset + limit);
    const hasMore = offset + limit < totalIssues;
    
    const modeText = production ? ' (Production Mode)' : '';
    const response = {
      summary: {
        totalIssues: allMessages.length,
        totalErrors: errorCount,
        totalWarnings: warningCount,
        filteredIssues: totalIssues,
        returnedIssues: paginatedMessages.length,
        limit,
        offset,
        hasMore,
        sortBy,
        sortOrder,
        filters: {
          severity,
          ruleCategory
        }
      },
      issues: paginatedMessages.map(msg => ({
        line: msg.line,
        column: msg.column,
        severity: msg.severity === 2 ? 'error' : 'warning',
        message: msg.message,
        ruleId: msg.ruleId,
        ruleCategory: getRuleCategory(msg.ruleId),
        source: msg.source
      }))
    };
    
    if (hasMore) {
      response.summary.nextOffset = offset + limit;
    }
    
    let output = `🔍 Code Analysis Results${modeText}:\n`;
    output += `Found ${errorCount} error(s) and ${warningCount} warning(s) total\n`;
    output += `Showing ${paginatedMessages.length} of ${totalIssues} filtered issues\n\n`;
    
    if (paginatedMessages.length > 0) {
      const errors = paginatedMessages.filter(msg => msg.severity === 2);
      const warnings = paginatedMessages.filter(msg => msg.severity === 1);
      
      if (errors.length > 0) {
        output += '❌ Errors (must fix):\n';
        errors.forEach(msg => {
          output += `  Line ${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})\n`;
        });
        output += '\n';
      }
      
      if (warnings.length > 0) {
        output += '⚠️  Warnings (should fix):\n';
        warnings.forEach(msg => {
          output += `  Line ${msg.line}:${msg.column} - ${msg.message} (${msg.ruleId})\n`;
        });
      }
    }
    
    output += '\n💡 Suggestions:\n';
    output += '- Fix all errors to ensure code reliability\n';
    output += '- Address warnings to improve code quality\n';
    if (production) {
      output += '\n- Production mode enforces stricter rules for deployment-ready code\n';
      output += '- Remove all console logs, debugger statements, and TODO comments\n';
      output += '- Ensure proper error handling and documentation';
    } else {
      output += '\n- Run \'eslint --fix\' locally for automatic fixes where possible\n';
      output += '- Use production=true parameter for stricter deployment checks';
    }

    return {
      content: [{
        type: 'text',
        text: output,
      }, {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  } catch (error) {
    console.error('Error analyzing code:', error);
    
    // Sanitize error messages
    let errorMessage = 'An error occurred while analyzing the code.';
    
    if (error.message === 'Linting timeout exceeded') {
      errorMessage = 'Analysis timed out. The code might be too complex.';
    } else if (error.message.includes('Parsing error')) {
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

/**
 * Filter messages by severity and rule category
 */
function filterMessages(messages, severity, ruleCategory) {
  return messages.filter(msg => {
    // Filter by severity
    if (severity !== 'all') {
      if (severity === 'error' && msg.severity !== 2) return false;
      if (severity === 'warning' && msg.severity !== 1) return false;
    }
    
    // Filter by rule category
    if (ruleCategory !== 'all') {
      const msgCategory = getRuleCategory(msg.ruleId);
      if (msgCategory !== ruleCategory) return false;
    }
    
    return true;
  });
}

/**
 * Sort messages based on criteria
 */
function sortMessages(messages, sortBy, sortOrder) {
  const sorted = [...messages];
  
  sorted.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'line':
        aValue = a.line;
        bValue = b.line;
        break;
      case 'severity':
        aValue = a.severity;
        bValue = b.severity;
        break;
      case 'ruleId':
        aValue = a.ruleId || '';
        bValue = b.ruleId || '';
        break;
      case 'message':
        aValue = a.message.toLowerCase();
        bValue = b.message.toLowerCase();
        break;
      default:
        aValue = a.line;
        bValue = b.line;
    }
    
    if (sortBy === 'line' || sortBy === 'severity') {
      // Numeric comparison
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    } else {
      // String comparison
      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    }
  });
  
  return sorted;
}

/**
 * Get rule category based on rule ID
 */
function getRuleCategory(ruleId) {
  if (!ruleId) return 'unknown';
  
  const errorRules = ['no-undef', 'no-unused-vars', 'no-unreachable', 'no-redeclare'];
  const bestPracticeRules = ['eqeqeq', 'curly', 'no-eval', 'no-implied-eval', 'no-console'];
  const stylisticRules = ['indent', 'quotes', 'semi', 'comma-spacing', 'brace-style'];
  const es6Rules = ['arrow-spacing', 'prefer-const', 'no-var', 'prefer-arrow-callback'];
  
  if (errorRules.includes(ruleId)) return 'possible-errors';
  if (bestPracticeRules.includes(ruleId)) return 'best-practices';
  if (stylisticRules.includes(ruleId)) return 'stylistic-issues';
  if (es6Rules.includes(ruleId)) return 'es6';
  
  return 'best-practices'; // Default category
}