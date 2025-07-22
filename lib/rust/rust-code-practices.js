import { spawn } from 'child_process';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { validateRustCode, sanitizeRustFilename, validateRustToolOptions, mapRustSeverity } from '../utils/rust-validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for rust_code_practices
 */
export const rustCodePracticesTool = {
  name: 'rust_code_practices',
  description: 'Analyzes Rust code for best practices using clippy with pagination and filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Rust code snippet to analyze (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., \'main.rs\')',
      },
      edition: {
        type: 'string',
        description: 'Rust edition (2015, 2018, 2021, 2024)',
        enum: ['2015', '2018', '2021', '2024'],
        default: '2021',
      },
      level: {
        type: 'string',
        description: 'Default lint level',
        enum: ['allow', 'warn', 'deny', 'forbid'],
        default: 'warn',
      },
      pedantic: {
        type: 'boolean',
        description: 'Enable pedantic lints (more strict)',
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
      category: {
        type: 'string',
        description: 'Filter by lint category',
        enum: ['correctness', 'suspicious', 'style', 'complexity', 'perf', 'pedantic', 'restriction', 'all'],
        default: 'all',
      },
      // Sorting parameters
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['line', 'severity', 'name', 'message'],
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
 * Runs clippy on Rust code
 * @param {string} code - The Rust code to analyze
 * @param {Object} options - Analysis options
 * @returns {Promise<Object>} Clippy output
 */
async function runClippy(code, options) {
  // Create a temporary file for the code
  const tempFile = join(tmpdir(), `rust_${randomBytes(8).toString('hex')}.rs`);
  
  try {
    // Write code to temporary file
    await writeFile(tempFile, code, 'utf8');
    
    // Build clippy arguments
    const args = [
      'clippy',
      '--quiet',
      '--message-format=json',
      '--edition', options.edition,
      '--', 
      '-W', 'clippy::all',
      '-W', 'clippy::correctness',
      '-W', 'clippy::suspicious',
      '-W', 'clippy::style',
      '-W', 'clippy::complexity',
      '-W', 'clippy::perf',
    ];
    
    if (options.pedantic) {
      args.push('-W', 'clippy::pedantic');
    }
    
    // Add deny for errors
    if (options.level === 'deny' || options.level === 'forbid') {
      args.push('-D', 'warnings');
    }
    
    return new Promise((resolve, reject) => {
      const cargo = spawn('cargo', args, {
        cwd: tmpdir(),
        env: {
          ...process.env,
          CARGO_TARGET_DIR: join(tmpdir(), 'rust-target'),
          RUSTFLAGS: '--cap-lints allow', // Prevent external crate warnings
        },
      });
      
      let stdout = '';
      let stderr = '';
      
      cargo.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      cargo.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      cargo.on('close', (code) => {
        resolve({ stdout, stderr, exitCode: code });
      });
      
      cargo.on('error', (error) => {
        reject(error);
      });
    });
  } finally {
    // Clean up temporary file
    try {
      await unlink(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Parses clippy JSON output
 * @param {string} output - Raw clippy output
 * @returns {Array} Parsed lint messages
 */
function parseClippyOutput(output) {
  const messages = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    try {
      const json = JSON.parse(line);
      
      // Filter for compiler messages with lint information
      if (json.reason === 'compiler-message' && json.message) {
        const msg = json.message;
        
        // Extract primary span information
        const primarySpan = msg.spans?.find(span => span.is_primary) || msg.spans?.[0];
        
        if (primarySpan) {
          messages.push({
            line: primarySpan.line_start,
            column: primarySpan.column_start,
            endLine: primarySpan.line_end,
            endColumn: primarySpan.column_end,
            severity: msg.level,
            message: msg.message,
            code: msg.code?.code || 'unknown',
            explanation: msg.children?.map(child => child.message).join(' ') || '',
            suggestion: msg.suggested_replacement,
            category: extractCategory(msg.code?.code),
          });
        }
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }
  
  return messages;
}

/**
 * Extracts lint category from clippy lint name
 * @param {string} lintName - The lint name (e.g., 'clippy::needless_return')
 * @returns {string} Category name
 */
function extractCategory(lintName) {
  if (!lintName || !lintName.startsWith('clippy::')) {
    return 'other';
  }
  
  // Common clippy categories
  const categoryPatterns = {
    correctness: ['correctness', 'wrong', 'invalid', 'broken'],
    suspicious: ['suspicious', 'confusing', 'unclear'],
    style: ['style', 'convention', 'naming'],
    complexity: ['complexity', 'cognitive', 'needless', 'redundant'],
    perf: ['perf', 'slow', 'inefficient'],
    pedantic: ['pedantic', 'allow'],
    restriction: ['restriction', 'disallowed'],
  };
  
  const lint = lintName.toLowerCase();
  
  for (const [category, patterns] of Object.entries(categoryPatterns)) {
    if (patterns.some(pattern => lint.includes(pattern))) {
      return category;
    }
  }
  
  return 'style'; // Default category
}

/**
 * Filters messages based on criteria
 * @param {Array} messages - All messages
 * @param {string} severity - Severity filter
 * @param {string} category - Category filter
 * @returns {Array} Filtered messages
 */
function filterMessages(messages, severity, category) {
  return messages.filter(msg => {
    // Filter by severity
    if (severity !== 'all') {
      const msgSeverity = mapRustSeverity(msg.severity);
      if (severity !== msgSeverity) return false;
    }
    
    // Filter by category
    if (category !== 'all' && msg.category !== category) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sorts messages based on criteria
 * @param {Array} messages - Messages to sort
 * @param {string} sortBy - Sort field
 * @param {string} sortOrder - Sort order
 * @returns {Array} Sorted messages
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
      case 'name':
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
      // Numeric comparison
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      // String comparison
      const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortOrder === 'asc' ? result : -result;
    }
  });
  
  return sorted;
}

/**
 * Handles the rust_code_practices tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleRustCodePractices(args) {
  const {
    code,
    filename,
    edition = '2021',
    level = 'warn',
    pedantic = false,
    limit = 50,
    offset = 0,
    severity = 'all',
    category = 'all',
    sortBy = 'line',
    sortOrder = 'asc'
  } = args;
  
  // Validate input
  const validation = validateRustCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeRustFilename(filename);
  const options = validateRustToolOptions({ edition, level, pedantic });
  
  try {
    // Check if cargo is available
    try {
      await withTimeout(
        new Promise((resolve, reject) => {
          spawn('cargo', ['--version']).on('close', code => {
            code === 0 ? resolve() : reject(new Error('Cargo not found'));
          });
        }),
        5000,
        'Cargo check'
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: Cargo (Rust toolchain) is not installed or not in PATH.\n\nPlease install Rust from https://rustup.rs/',
        }],
      };
    }
    
    // Run clippy analysis
    const clippyPromise = runClippy(code, options);
    const result = await withTimeout(clippyPromise, LINT_TIMEOUT_MS, 'Clippy analysis');
    
    // Parse clippy output
    const allMessages = parseClippyOutput(result.stdout);
    
    if (allMessages.length === 0 && result.exitCode === 0) {
      return {
        content: [{
          type: 'text',
          text: `✅ The Rust code follows best practices with no clippy warnings detected${pedantic ? ' (pedantic mode)' : ''}.`,
        }],
      };
    }
    
    // Apply filtering
    let filteredMessages = filterMessages(allMessages, severity, category);
    
    // Apply sorting
    filteredMessages = sortMessages(filteredMessages, sortBy, sortOrder);
    
    // Apply pagination
    const totalIssues = filteredMessages.length;
    const paginatedMessages = filteredMessages.slice(offset, offset + limit);
    const hasMore = offset + limit < totalIssues;
    
    // Count by severity
    const errorCount = allMessages.filter(m => m.severity === 'error').length;
    const warningCount = allMessages.filter(m => m.severity === 'warning').length;
    
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
          category,
        },
        edition,
        pedantic,
      },
      issues: paginatedMessages.map(msg => ({
        line: msg.line,
        column: msg.column,
        endLine: msg.endLine,
        endColumn: msg.endColumn,
        severity: mapRustSeverity(msg.severity),
        message: msg.message,
        code: msg.code,
        category: msg.category,
        explanation: msg.explanation,
        suggestion: msg.suggestion,
      }))
    };
    
    if (hasMore) {
      response.summary.nextOffset = offset + limit;
    }
    
    let output = '🦀 Rust Code Analysis Results (Clippy):\n';
    output += `Found ${errorCount} error(s) and ${warningCount} warning(s) total\n`;
    output += `Showing ${paginatedMessages.length} of ${totalIssues} filtered issues\n`;
    output += `Edition: ${edition}${pedantic ? ', Pedantic mode' : ''}\n\n`;
    
    if (paginatedMessages.length > 0) {
      const errors = paginatedMessages.filter(msg => mapRustSeverity(msg.severity) === 'error');
      const warnings = paginatedMessages.filter(msg => mapRustSeverity(msg.severity) === 'warning');
      
      if (errors.length > 0) {
        output += '❌ Errors (must fix):\n';
        errors.forEach(msg => {
          output += `  Line ${msg.line}:${msg.column} - ${msg.message} (${msg.code})\n`;
          if (msg.explanation) {
            output += `    → ${msg.explanation}\n`;
          }
        });
        output += '\n';
      }
      
      if (warnings.length > 0) {
        output += '⚠️  Warnings (should fix):\n';
        warnings.forEach(msg => {
          output += `  Line ${msg.line}:${msg.column} - ${msg.message} (${msg.code})\n`;
          if (msg.suggestion) {
            output += `    → Suggestion: ${msg.suggestion}\n`;
          }
        });
      }
    }
    
    output += '\n💡 Suggestions:\n';
    output += '- Fix all errors to ensure code correctness\n';
    output += '- Address warnings to improve code quality and performance\n';
    output += '- Run \'cargo clippy --fix\' locally for automatic fixes\n';
    if (!pedantic) {
      output += '- Use pedantic=true for more strict linting';
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
    console.error('Error analyzing Rust code:', error);
    
    let errorMessage = 'An error occurred while analyzing the code.';
    
    if (error.message === 'Clippy analysis timeout exceeded') {
      errorMessage = 'Analysis timed out. The code might be too complex.';
    } else if (error.message.includes('could not compile')) {
      errorMessage = 'The code contains compilation errors. Please fix syntax errors first.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\nPlease ensure the code is valid Rust.`,
      }],
    };
  }
}