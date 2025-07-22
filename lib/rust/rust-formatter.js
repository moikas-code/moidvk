import { spawn } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { validateRustCode, sanitizeRustFilename, detectRustEdition } from '../utils/rust-validation.js';
import { withTimeout, FORMAT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for rust_formatter
 */
export const rustFormatterTool = {
  name: 'rust_formatter',
  description: 'Formats Rust code using rustfmt. Supports various style configurations and can check without modifying.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Rust code to format (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename to provide context (e.g., \'main.rs\')',
      },
      check: {
        type: 'boolean',
        description: 'If true, only checks if formatting is needed without returning formatted code',
        default: false,
      },
      edition: {
        type: 'string',
        description: 'Rust edition (auto-detected if not specified)',
        enum: ['2015', '2018', '2021', '2024'],
      },
      // Style options
      indent_style: {
        type: 'string',
        description: 'Indentation style',
        enum: ['Visual', 'Block'],
        default: 'Block',
      },
      use_small_heuristics: {
        type: 'string',
        description: 'Heuristics for formatting decisions',
        enum: ['Default', 'Off', 'Max'],
        default: 'Default',
      },
      max_width: {
        type: 'number',
        description: 'Maximum line width',
        default: 100,
        minimum: 50,
        maximum: 200,
      },
      tab_spaces: {
        type: 'number',
        description: 'Number of spaces per tab',
        default: 4,
        minimum: 2,
        maximum: 8,
      },
      newline_style: {
        type: 'string',
        description: 'Newline style',
        enum: ['Auto', 'Unix', 'Windows'],
        default: 'Auto',
      },
    },
    required: ['code'],
  },
};

/**
 * Runs rustfmt on Rust code
 * @param {string} code - The Rust code to format
 * @param {Object} options - Formatting options
 * @returns {Promise<Object>} Rustfmt output
 */
async function runRustfmt(code, options) {
  // Create a temporary file for the code
  const tempFile = join(tmpdir(), `rust_fmt_${randomBytes(8).toString('hex')}.rs`);
  
  try {
    // Write code to temporary file
    await writeFile(tempFile, code, 'utf8');
    
    // Build rustfmt arguments
    const args = ['fmt', '--emit', 'files'];
    
    if (options.check) {
      args.push('--check');
    }
    
    // Add edition if specified
    if (options.edition) {
      args.push('--edition', options.edition);
    }
    
    // Build config items
    const configItems = [];
    
    if (options.indent_style) {
      configItems.push(`indent_style="${options.indent_style}"`);
    }
    
    if (options.use_small_heuristics) {
      configItems.push(`use_small_heuristics="${options.use_small_heuristics}"`);
    }
    
    if (options.max_width) {
      configItems.push(`max_width=${options.max_width}`);
    }
    
    if (options.tab_spaces) {
      configItems.push(`tab_spaces=${options.tab_spaces}`);
    }
    
    if (options.newline_style) {
      configItems.push(`newline_style="${options.newline_style}"`);
    }
    
    // Add config if any items specified
    if (configItems.length > 0) {
      args.push('--config', configItems.join(','));
    }
    
    // Add the file path
    args.push('--', tempFile);
    
    return new Promise((resolve, reject) => {
      const cargo = spawn('cargo', args, {
        cwd: tmpdir(),
      });
      
      let stdout = '';
      let stderr = '';
      
      cargo.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      cargo.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      cargo.on('close', async (code) => {
        try {
          // Read the potentially formatted file
          const formattedCode = await readFile(tempFile, 'utf8');
          resolve({ 
            stdout, 
            stderr, 
            exitCode: code, 
            formattedCode,
            changed: formattedCode !== code 
          });
        } catch (error) {
          resolve({ stdout, stderr, exitCode: code });
        }
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
 * Handles the rust_formatter tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleRustFormatter(args) {
  const {
    code,
    filename,
    check = false,
    edition,
    indent_style = 'Block',
    use_small_heuristics = 'Default',
    max_width = 100,
    tab_spaces = 4,
    newline_style = 'Auto',
  } = args;
  
  // Validate input
  const validation = validateRustCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeRustFilename(filename);
  const detectedEdition = edition || detectRustEdition(code);
  
  try {
    // Check if cargo/rustfmt is available
    try {
      await withTimeout(
        new Promise((resolve, reject) => {
          spawn('cargo', ['fmt', '--version']).on('close', code => {
            code === 0 ? resolve() : reject(new Error('rustfmt not found'));
          });
        }),
        5000,
        'rustfmt check'
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: rustfmt is not installed or not in PATH.\n\nPlease install rustfmt with: rustup component add rustfmt',
        }],
      };
    }
    
    // Format options
    const options = {
      check,
      edition: detectedEdition,
      indent_style,
      use_small_heuristics,
      max_width,
      tab_spaces,
      newline_style,
    };
    
    // Run rustfmt
    const formatPromise = runRustfmt(code, options);
    const result = await withTimeout(formatPromise, FORMAT_TIMEOUT_MS, 'Formatting');
    
    if (check) {
      // Check mode - just report if formatting is needed
      const needsFormatting = result.exitCode !== 0;
      
      return {
        content: [{
          type: 'text',
          text: needsFormatting
            ? '⚠️  Code needs formatting. Run without \'check\' flag to format.'
            : '✅ Code is already properly formatted.',
        }],
      };
    }
    
    // Format mode - return formatted code
    if (result.exitCode !== 0 && !result.formattedCode) {
      // rustfmt failed
      let errorMessage = 'Failed to format code.';
      
      if (result.stderr.includes('error:')) {
        // Extract error message
        const errorMatch = result.stderr.match(/error:\s*(.+)/);
        if (errorMatch) {
          errorMessage = `Syntax error: ${errorMatch[1]}`;
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${errorMessage}\n\nPlease ensure the code is valid Rust syntax.`,
        }],
      };
    }
    
    const formatted = result.formattedCode || code;
    const changed = formatted !== code;
    
    let output = '🎨 Rust Code Formatting Results:\n\n';
    
    if (!changed) {
      output += '✅ Code is already properly formatted.\n';
    } else {
      output += '✅ Code formatted successfully!\n\n';
      output += 'Formatting settings:\n';
      output += `  Edition: ${detectedEdition}\n`;
      output += `  Max width: ${max_width}\n`;
      output += `  Tab spaces: ${tab_spaces}\n`;
      output += `  Indent style: ${indent_style}\n`;
      output += '\nFormatted code:\n';
      output += '```rust\n';
      output += formatted;
      output += '```\n';
    }
    
    return {
      content: [{
        type: 'text',
        text: output,
      }],
    };
  } catch (error) {
    console.error('Error formatting Rust code:', error);
    
    let errorMessage = 'An error occurred while formatting the code.';
    
    if (error.message === 'Formatting timeout exceeded') {
      errorMessage = 'Formatting timed out. The code might be too complex.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\nPlease ensure rustfmt is installed and the code is valid.`,
      }],
    };
  }
}