import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { validatePythonCode, sanitizePythonFilename, validatePythonToolOptions, mapPythonSeverity } from '../utils/python-validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for python_code_analyzer
 */
export const pythonCodeAnalyzerTool = {
  name: 'python_code_analyzer',
  description: 'Analyzes Python code for best practices, style issues, and potential bugs using Ruff - an extremely fast Python linter.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Python code to analyze (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., \'main.py\')',
      },
      pythonVersion: {
        type: 'string',
        description: 'Python version (2 or 3)',
        enum: ['2', '3'],
        default: '3',
      },
      // Rule selection
      select: {
        type: 'array',
        description: 'Specific rules to enable (e.g., ["E", "F", "I"])',
        items: { type: 'string' },
        default: ['E', 'F', 'W', 'C90', 'I', 'N', 'UP', 'YTT', 'ANN', 'S', 'B', 'A', 'C4', 'DTZ', 'T10', 'ISC', 'ICN', 'PIE', 'T20', 'PT', 'Q', 'RET', 'SIM', 'TID', 'ARG', 'ERA', 'PD', 'PGH', 'PL', 'TRY', 'NPY', 'RUF'],
      },
      ignore: {
        type: 'array',
        description: 'Rules to ignore',
        items: { type: 'string' },
        default: [],
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
      // Filtering
      severity: {
        type: 'string',
        description: 'Filter by severity',
        enum: ['error', 'warning', 'all'],
        default: 'all',
      },
      category: {
        type: 'string',
        description: 'Filter by category',
        enum: ['style', 'error', 'bug', 'security', 'performance', 'all'],
        default: 'all',
      },
      // Sorting
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['line', 'severity', 'code', 'message'],
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
 * Maps Ruff rule codes to categories
 * @param {string} code - Ruff rule code
 * @returns {string} Category
 */
function getRuleCategory(code) {
  if (!code) return 'other';
  
  // Extract the prefix
  const prefix = code.match(/^[A-Z]+/)?.[0] || '';
  
  const categoryMap = {
    'E': 'style',      // pycodestyle errors
    'W': 'style',      // pycodestyle warnings
    'F': 'error',      // Pyflakes
    'C90': 'complexity', // mccabe
    'I': 'style',      // isort
    'N': 'style',      // pep8-naming
    'UP': 'style',     // pyupgrade
    'YTT': 'bug',      // flake8-2020
    'ANN': 'style',    // flake8-annotations
    'S': 'security',   // flake8-bandit
    'B': 'bug',        // flake8-bugbear
    'A': 'bug',        // flake8-builtins
    'C4': 'style',     // flake8-comprehensions
    'DTZ': 'bug',      // flake8-datetimez
    'T10': 'style',    // flake8-debugger
    'ISC': 'style',    // flake8-implicit-str-concat
    'ICN': 'style',    // flake8-import-conventions
    'PIE': 'style',    // flake8-pie
    'T20': 'style',    // flake8-print
    'PT': 'style',     // flake8-pytest-style
    'Q': 'style',      // flake8-quotes
    'RET': 'style',    // flake8-return
    'SIM': 'style',    // flake8-simplify
    'TID': 'style',    // flake8-tidy-imports
    'ARG': 'style',    // flake8-unused-arguments
    'ERA': 'style',    // eradicate
    'PD': 'style',     // pandas-vet
    'PGH': 'style',    // pygrep-hooks
    'PL': 'error',     // Pylint
    'TRY': 'style',    // tryceratops
    'NPY': 'style',    // NumPy-specific
    'RUF': 'style',    // Ruff-specific
  };
  
  return categoryMap[prefix] || 'other';
}

/**
 * Runs Ruff on Python code
 * @param {string} code - The Python code to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Ruff output
 */
async function runRuff(code, options) {
  // Create a temporary file
  const tempFile = join(tmpdir(), `python_${randomBytes(8).toString('hex')}.py`);
  
  try {
    // Write code to temporary file
    await writeFile(tempFile, code, 'utf8');
    
    // Build ruff arguments
    const args = ['check', tempFile, '--output-format', 'json'];
    
    // Add selected rules
    if (options.select && options.select.length > 0) {
      args.push('--select', options.select.join(','));
    }
    
    // Add ignored rules
    if (options.ignore && options.ignore.length > 0) {
      args.push('--ignore', options.ignore.join(','));
    }
    
    // Add target version
    if (options.pythonVersion === '2') {
      args.push('--target-version', 'py27');
    } else {
      args.push('--target-version', 'py311');
    }
    
    return new Promise((resolve, reject) => {
      const ruff = spawn('ruff', args);
      
      let stdout = '';
      let stderr = '';
      
      ruff.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      ruff.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      ruff.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code });
      });
      
      ruff.on('error', (error) => {
        reject(error);
      });
    });
  } finally {
    // Clean up
    try {
      await unlink(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Parses Ruff JSON output
 * @param {string} output - Raw Ruff output
 * @returns {Array} Parsed messages
 */
function parseRuffOutput(output) {
  try {
    const data = JSON.parse(output);
    
    if (!Array.isArray(data)) {
      return [];
    }
    
    return data.map(issue => ({
      line: issue.location?.row || 1,
      column: issue.location?.column || 1,
      endLine: issue.end_location?.row || issue.location?.row || 1,
      endColumn: issue.end_location?.column || issue.location?.column || 1,
      severity: issue.message?.includes('error') ? 'error' : 'warning',
      message: issue.message || '',
      code: issue.code || '',
      category: getRuleCategory(issue.code),
      fix: issue.fix || null,
      url: issue.url || null,
    }));
  } catch (error) {
    // Fallback to text parsing
    const issues = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^(.+):(\d+):(\d+):\s+([A-Z]\d+)\s+(.+)$/);
      if (match) {
        issues.push({
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          code: match[4],
          message: match[5],
          severity: 'warning',
          category: getRuleCategory(match[4]),
        });
      }
    }
    
    return issues;
  }
}

/**
 * Filters issues based on criteria
 * @param {Array} issues - All issues
 * @param {string} severity - Severity filter
 * @param {string} category - Category filter
 * @returns {Array} Filtered issues
 */
function filterIssues(issues, severity, category) {
  return issues.filter(issue => {
    if (severity !== 'all' && issue.severity !== severity) {
      return false;
    }
    if (category !== 'all' && issue.category !== category) {
      return false;
    }
    return true;
  });
}

/**
 * Sorts issues based on criteria
 * @param {Array} issues - Issues to sort
 * @param {string} sortBy - Sort field
 * @param {string} sortOrder - Sort order
 * @returns {Array} Sorted issues
 */
function sortIssues(issues, sortBy, sortOrder) {
  const sorted = [...issues];
  
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
      case 'code':
        aValue = a.code;
        bValue = b.code;
        break;
      case 'message':
        aValue = a.message.toLowerCase();
        bValue = b.message.toLowerCase();
        break;
      default:
        aValue = a.line;
        bValue = b.line;
    }
    
    if (sortBy === 'line') {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === 'asc' ? result : -result;
    }
  });
  
  return sorted;
}

/**
 * Handles the python_code_analyzer tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handlePythonCodeAnalyzer(args) {
  const {
    code,
    filename,
    pythonVersion = '3',
    select = ['E', 'F', 'W', 'C90', 'I', 'N', 'UP', 'YTT', 'ANN', 'S', 'B', 'A', 'C4', 'DTZ', 'T10', 'ISC', 'ICN', 'PIE', 'T20', 'PT', 'Q', 'RET', 'SIM', 'TID', 'ARG', 'ERA', 'PD', 'PGH', 'PL', 'TRY', 'NPY', 'RUF'],
    ignore = [],
    limit = 50,
    offset = 0,
    severity = 'all',
    category = 'all',
    sortBy = 'line',
    sortOrder = 'asc',
  } = args;
  
  // Validate input
  const validation = validatePythonCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizePythonFilename(filename);
  const options = validatePythonToolOptions({ pythonVersion, select, ignore });
  
  try {
    // Check if ruff is available
    try {
      await withTimeout(
        new Promise((resolve, reject) => {
          spawn('ruff', ['--version']).on('close', code => {
            code === 0 ? resolve() : reject(new Error('Ruff not found'));
          });
        }),
        5000,
        'Ruff check'
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: Ruff is not installed.\n\nInstall with: pip install ruff',
        }],
      };
    }
    
    // Run Ruff analysis
    const ruffPromise = runRuff(code, options);
    const result = await withTimeout(ruffPromise, LINT_TIMEOUT_MS, 'Ruff analysis');
    
    // Parse output
    const allIssues = parseRuffOutput(result.stdout || result.stderr);
    
    if (allIssues.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '✅ The Python code follows best practices with no issues detected.',
        }],
      };
    }
    
    // Apply filtering
    let filteredIssues = filterIssues(allIssues, severity, category);
    
    // Apply sorting
    filteredIssues = sortIssues(filteredIssues, sortBy, sortOrder);
    
    // Apply pagination
    const totalIssues = filteredIssues.length;
    const paginatedIssues = filteredIssues.slice(offset, offset + limit);
    const hasMore = offset + limit < totalIssues;
    
    // Count by severity
    const errorCount = allIssues.filter(i => i.severity === 'error').length;
    const warningCount = allIssues.filter(i => i.severity === 'warning').length;
    
    const response = {
      summary: {
        totalIssues: allIssues.length,
        totalErrors: errorCount,
        totalWarnings: warningCount,
        filteredIssues: totalIssues,
        returnedIssues: paginatedIssues.length,
        limit,
        offset,
        hasMore,
        sortBy,
        sortOrder,
        filters: {
          severity,
          category,
        },
        pythonVersion,
      },
      issues: paginatedIssues.map(issue => ({
        line: issue.line,
        column: issue.column,
        endLine: issue.endLine,
        endColumn: issue.endColumn,
        severity: issue.severity,
        message: issue.message,
        code: issue.code,
        category: issue.category,
        fix: issue.fix,
        url: issue.url,
      }))
    };
    
    if (hasMore) {
      response.summary.nextOffset = offset + limit;
    }
    
    let output = `🐍 Python Code Analysis Results (Ruff):\n`;
    output += `Found ${errorCount} error(s) and ${warningCount} warning(s) total\n`;
    output += `Showing ${paginatedIssues.length} of ${totalIssues} filtered issues\n`;
    output += `Python version: ${pythonVersion}\n\n`;
    
    if (paginatedIssues.length > 0) {
      const errors = paginatedIssues.filter(i => i.severity === 'error');
      const warnings = paginatedIssues.filter(i => i.severity === 'warning');
      
      if (errors.length > 0) {
        output += '❌ Errors (must fix):\n';
        errors.forEach(issue => {
          output += `  Line ${issue.line}:${issue.column} - ${issue.message} (${issue.code})\n`;
          if (issue.fix) {
            output += `    → Fix available\n`;
          }
        });
        output += '\n';
      }
      
      if (warnings.length > 0) {
        output += '⚠️  Warnings (should fix):\n';
        warnings.forEach(issue => {
          output += `  Line ${issue.line}:${issue.column} - ${issue.message} (${issue.code})\n`;
        });
      }
    }
    
    output += '\n💡 Suggestions:\n';
    output += '- Fix all errors to ensure code reliability\n';
    output += '- Address warnings to improve code quality\n';
    output += '- Run \'ruff check --fix\' locally for automatic fixes\n';
    output += '- Consider enabling type checking with mypy';
    
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
    console.error('Error analyzing Python code:', error);
    
    let errorMessage = 'An error occurred while analyzing the code.';
    
    if (error.message === 'Ruff analysis timeout exceeded') {
      errorMessage = 'Analysis timed out. The code might be too complex.';
    } else if (error.message.includes('SyntaxError')) {
      errorMessage = 'The code contains syntax errors and cannot be analyzed.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\nPlease ensure the code is valid Python.`,
      }],
    };
  }
}