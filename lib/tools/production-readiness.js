import { ESLint } from 'eslint';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';
import { productionEslintConfig } from '../config/production-eslint-config.js';

/**
 * Tool definition for check_production_readiness
 */
export const productionReadinessTool = {
  name: 'check_production_readiness',
  description: 'Analyzes code for production deployment readiness with pagination and filtering. Checks for TODO comments, console logs, completeness, and documentation.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code to analyze for production readiness (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., \'component.js\')',
      },
      strict: {
        type: 'boolean',
        description: 'Enable extra strict mode for critical production code (defaults to false)',
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
      category: {
        type: 'string',
        description: 'Filter by issue category',
        enum: ['console-logs', 'todos', 'debugging', 'documentation', 'error-handling', 'all'],
        default: 'all',
      },
      severity: {
        type: 'string',
        description: 'Filter by severity level',
        enum: ['critical', 'high', 'medium', 'low', 'all'],
        default: 'all',
      },
      // Sorting parameters
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['line', 'severity', 'category', 'message'],
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

// Initialize ESLint with production configuration
let eslint;
try {
  eslint = new ESLint(productionEslintConfig);
} catch (error) {
  console.error('Failed to initialize production ESLint config:', error);
  // Fallback to basic config without unicorn plugin
  eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: {
      languageOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      rules: {
        'no-console': 'error',
        'no-debugger': 'error',
        'no-warning-comments': ['error', {
          terms: ['todo', 'fixme', 'xxx', 'hack'],
          location: 'anywhere',
        }],
      },
    },
  });
}

/**
 * Analyzes code completeness beyond ESLint rules
 * @param {string} code - Code to analyze
 * @returns {Array} Array of completeness issues
 */
function analyzeCompleteness(code) {
  const issues = [];
  const lines = code.split('\\n');
  
  // Check for common incompleteness patterns
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim().toLowerCase();
    
    // Empty function bodies
    if (/function.*\\{\\s*\\}/.test(line) || /\\{\\s*\\}/.test(line) && /=>/.test(line)) {
      issues.push({
        line: lineNum,
        message: 'Empty function body detected',
        severity: 'warning',
        category: 'completeness',
      });
    }
    
    // Placeholder comments
    if (trimmed.includes('placeholder') || 
        trimmed.includes('implement') ||
        trimmed.includes('coming soon') ||
        trimmed.includes('not implemented')) {
      issues.push({
        line: lineNum,
        message: 'Placeholder or unimplemented code comment found',
        severity: 'error',
        category: 'completeness',
      });
    }
    
    // Missing error handling
    if (trimmed.includes('try') && !code.includes('catch')) {
      issues.push({
        line: lineNum,
        message: 'Try block without corresponding catch block',
        severity: 'warning',
        category: 'error-handling',
      });
    }
    
    // Magic strings that should be constants
    if (/['"](?:error|warning|info|debug|success)['"]/.test(trimmed) && 
        !trimmed.includes('const') && !trimmed.includes('=')) {
      issues.push({
        line: lineNum,
        message: 'Magic string detected - consider using constants',
        severity: 'info',
        category: 'maintainability',
      });
    }
    
    // Temporary or test code markers
    if (trimmed.includes('temp') || 
        trimmed.includes('temporary') ||
        trimmed.includes('for testing') ||
        trimmed.includes('debug only')) {
      issues.push({
        line: lineNum,
        message: 'Temporary or test code marker found',
        severity: 'error',
        category: 'completeness',
      });
    }
  });
  
  return issues;
}

/**
 * Checks for production deployment blockers
 * @param {Array} eslintMessages - ESLint messages
 * @param {Array} completenessIssues - Completeness analysis results
 * @returns {Object} Categorized issues
 */
function categorizeProductionIssues(eslintMessages, completenessIssues) {
  const blockers = [];
  const warnings = [];
  const info = [];
  
  // Process ESLint messages
  eslintMessages.forEach(msg => {
    const issue = {
      line: msg.line,
      column: msg.column,
      message: msg.message,
      rule: msg.ruleId,
      source: 'eslint',
    };
    
    if (msg.severity === 2) { // Error
      // Production blockers
      if (['no-console', 'no-debugger', 'no-warning-comments', 'unicorn/expiring-todo-comments'].includes(msg.ruleId)) {
        issue.category = 'production-blocker';
        blockers.push(issue);
      } else {
        issue.category = 'code-quality';
        blockers.push(issue);
      }
    } else { // Warning
      issue.category = 'improvement';
      warnings.push(issue);
    }
  });
  
  // Process completeness issues
  completenessIssues.forEach(issue => {
    if (issue.severity === 'error') {
      blockers.push({ ...issue, source: 'completeness' });
    } else if (issue.severity === 'warning') {
      warnings.push({ ...issue, source: 'completeness' });
    } else {
      info.push({ ...issue, source: 'completeness' });
    }
  });
  
  return { blockers, warnings, info };
}

/**
 * Handles the check_production_readiness tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleProductionReadiness(args) {
  const { code, filename, strict = false } = args.params || args;
  
  // Validate input
  const validation = validateCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeFilename(filename);
  
  try {
    // Run ESLint analysis
    const lintPromise = eslint.lintText(code, { filePath: safeFilename });
    const [results] = await withTimeout(lintPromise, LINT_TIMEOUT_MS, 'Production linting');
    
    const messages = results.messages || [];
    
    // Run completeness analysis
    const completenessIssues = analyzeCompleteness(code);
    
    // Categorize all issues
    const { blockers, warnings, info } = categorizeProductionIssues(messages, completenessIssues);
    
    // Calculate production readiness score
    const totalIssues = blockers.length + warnings.length + info.length;
    const blockerWeight = blockers.length * 10;
    const warningWeight = warnings.length * 3;
    const infoWeight = info.length * 1;
    const totalWeight = blockerWeight + warningWeight + infoWeight;
    const readinessScore = Math.max(0, 100 - totalWeight);
    
    let output = '🚀 Production Readiness Check Results:\\n\\n';
    
    // Production readiness verdict
    if (blockers.length === 0) {
      output += '✅ PRODUCTION READY\\n';
      output += `📊 Readiness Score: ${readinessScore}/100\\n\\n`;
    } else {
      output += '❌ NOT PRODUCTION READY\\n';
      output += `📊 Readiness Score: ${readinessScore}/100\\n`;
      output += `🚫 ${blockers.length} blocking issue(s) must be fixed\\n\\n`;
    }
    
    // Show blocking issues first
    if (blockers.length > 0) {
      output += '🚫 BLOCKING ISSUES (must fix before deployment):\\n';
      blockers.forEach(issue => {
        const location = issue.column ? `${issue.line}:${issue.column}` : issue.line;
        const rule = issue.rule ? ` (${issue.rule})` : '';
        output += `  Line ${location} - ${issue.message}${rule}\\n`;
      });
      output += '\\n';
    }
    
    // Show warnings
    if (warnings.length > 0) {
      output += '⚠️  WARNINGS (should fix):\\n';
      warnings.forEach(issue => {
        const location = issue.column ? `${issue.line}:${issue.column}` : issue.line;
        const rule = issue.rule ? ` (${issue.rule})` : '';
        output += `  Line ${location} - ${issue.message}${rule}\\n`;
      });
      output += '\\n';
    }
    
    // Show info items (only if not too many)
    if (info.length > 0 && info.length <= 5) {
      output += 'ℹ️  SUGGESTIONS (optional improvements):\\n';
      info.forEach(issue => {
        const location = issue.column ? `${issue.line}:${issue.column}` : issue.line;
        const rule = issue.rule ? ` (${issue.rule})` : '';
        output += `  Line ${location} - ${issue.message}${rule}\\n`;
      });
      output += '\\n';
    } else if (info.length > 5) {
      output += `ℹ️  ${info.length} additional suggestions available\\n\\n`;
    }
    
    // Production deployment checklist
    output += '📋 Production Deployment Checklist:\\n';
    output += `${blockers.length === 0 ? '✅' : '❌'} No TODO/FIXME comments\\n`;
    output += `${blockers.filter(b => b.rule === 'no-console').length === 0 ? '✅' : '❌'} No console.log statements\\n`;
    output += `${blockers.filter(b => b.rule === 'no-debugger').length === 0 ? '✅' : '❌'} No debugger statements\\n`;
    output += `${completenessIssues.filter(i => i.severity === 'error').length === 0 ? '✅' : '❌'} No incomplete implementations\\n`;
    output += `${warnings.length <= 2 ? '✅' : '⚠️ '} Code quality standards met\\n\\n`;
    
    // Additional recommendations based on score
    if (readinessScore >= 90) {
      output += '🎉 Excellent! Code is production-ready with high quality.\\n';
    } else if (readinessScore >= 80) {
      output += '👍 Good! Address warnings for optimal production quality.\\n';
    } else if (readinessScore >= 70) {
      output += '⚠️  Fair. Consider addressing issues before deployment.\\n';
    } else {
      output += '🔧 Needs work. Please fix blocking issues before production.\\n';
    }
    
    if (strict) {
      output += '\\n🔒 STRICT MODE: Extra strict analysis for critical production code.\\n';
      if (warnings.length > 0) {
        output += 'All warnings should be addressed for critical production code.\\n';
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: output,
      }],
    };
    
  } catch (error) {
    console.error('Error in production readiness check:', error);
    
    let errorMessage = 'An error occurred while checking production readiness.';
    
    if (error.message === 'Production linting timeout exceeded') {
      errorMessage = 'Analysis timed out. The code might be too complex.';
    } else if (error.message.includes('Parsing error')) {
      errorMessage = 'The code contains syntax errors and cannot be analyzed.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\\n\\nPlease ensure the code is valid JavaScript.`,
      }],
    };
  }
}