import { spawn } from 'child_process';
import { writeFile, unlink, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { validatePythonCode, sanitizePythonFilename, detectPythonVersion } from '../utils/python-validation.js';
import { withTimeout, FORMAT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for python_formatter
 */
export const pythonFormatterTool = {
  name: 'python_formatter',
  description: 'Formats Python code using Black - the uncompromising Python code formatter. Ensures consistent code style across your Python projects.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Python code to format (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., \'main.py\')',
      },
      check: {
        type: 'boolean',
        description: 'If true, only checks if formatting is needed without returning formatted code',
        default: false,
      },
      pythonVersion: {
        type: 'string',
        description: 'Python version (auto-detected if not specified)',
        enum: ['2', '3'],
      },
      // Style options
      lineLength: {
        type: 'number',
        description: 'Maximum line length',
        default: 88,
        minimum: 50,
        maximum: 200,
      },
      skipStringNormalization: {
        type: 'boolean',
        description: 'Skip string quote normalization',
        default: false,
      },
      skipMagicTrailingComma: {
        type: 'boolean',
        description: 'Skip magic trailing comma behavior',
        default: false,
      },
      previewMode: {
        type: 'boolean',
        description: 'Enable preview mode for experimental features',
        default: false,
      },
    },
    required: ['code'],
  },
};

/**
 * Runs Black on Python code
 * @param {string} code - The Python code to format
 * @param {Object} options - Formatting options
 * @returns {Promise<Object>} Black output
 */
async function runBlack(code, options) {
  // Create a temporary file
  const tempFile = join(tmpdir(), `python_fmt_${randomBytes(8).toString('hex')}.py`);
  
  try {
    // Write code to temporary file
    await writeFile(tempFile, code, 'utf8');
    
    // Build black arguments
    const args = [tempFile];
    
    if (options.check) {
      args.push('--check');
      args.push('--diff');
    }
    
    // Add line length
    args.push('--line-length', options.lineLength.toString());
    
    // Add target version
    if (options.pythonVersion === '2') {
      args.push('--target-version', 'py27');
    } else {
      args.push('--target-version', 'py310');
    }
    
    // Add style options
    if (options.skipStringNormalization) {
      args.push('--skip-string-normalization');
    }
    
    if (options.skipMagicTrailingComma) {
      args.push('--skip-magic-trailing-comma');
    }
    
    if (options.previewMode) {
      args.push('--preview');
    }
    
    // Always output diff for comparison
    if (!options.check) {
      args.push('--quiet');
    }
    
    return new Promise((resolve, reject) => {
      const black = spawn('black', args);
      
      let stdout = '';
      let stderr = '';
      
      black.stdout.on('data', (data) => {
        stdout += data.toString();
      });
      
      black.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      black.on('close', async (exitCode) => {
        try {
          // Read the potentially formatted file
          let formattedCode = code;
          if (!options.check && exitCode === 0) {
            formattedCode = await readFile(tempFile, 'utf8');
          }
          
          resolve({
            stdout,
            stderr,
            exitCode,
            formattedCode,
            changed: exitCode === 1 || formattedCode !== code,
          });
        } catch (error) {
          resolve({ stdout, stderr, exitCode });
        }
      });
      
      black.on('error', (error) => {
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
 * Handles the python_formatter tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handlePythonFormatter(args) {
  const {
    code,
    filename,
    check = false,
    pythonVersion,
    lineLength = 88,
    skipStringNormalization = false,
    skipMagicTrailingComma = false,
    previewMode = false,
  } = args;
  
  // Validate input
  const validation = validatePythonCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizePythonFilename(filename);
  const detectedVersion = pythonVersion || detectPythonVersion(code);
  
  try {
    // Check if black is available
    try {
      await withTimeout(
        new Promise((resolve, reject) => {
          spawn('black', ['--version']).on('close', code => {
            code === 0 ? resolve() : reject(new Error('Black not found'));
          });
        }),
        5000,
        'Black check'
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: Black is not installed.\n\nInstall with: pip install black',
        }],
      };
    }
    
    // Format options
    const options = {
      check,
      pythonVersion: detectedVersion,
      lineLength,
      skipStringNormalization,
      skipMagicTrailingComma,
      previewMode,
    };
    
    // Run Black
    const formatPromise = runBlack(code, options);
    const result = await withTimeout(formatPromise, FORMAT_TIMEOUT_MS, 'Formatting');
    
    if (check) {
      // Check mode - report if formatting is needed
      const needsFormatting = result.exitCode === 1;
      
      let output = '🐍 Python Code Formatting Check (Black):\n\n';
      
      if (needsFormatting) {
        output += '⚠️  Code needs formatting. Run without \'check\' flag to format.\n\n';
        
        if (result.stdout) {
          output += 'Diff preview:\n';
          output += '```diff\n';
          output += result.stdout;
          output += '```\n';
        }
      } else {
        output += '✅ Code is already properly formatted according to Black standards.';
      }
      
      return {
        content: [{
          type: 'text',
          text: output,
        }],
      };
    }
    
    // Format mode
    if (result.exitCode !== 0 && result.exitCode !== 1) {
      // Black failed
      let errorMessage = 'Failed to format code.';
      
      if (result.stderr.includes('error:')) {
        const errorMatch = result.stderr.match(/error:\s*(.+)/);
        if (errorMatch) {
          errorMessage = `Syntax error: ${errorMatch[1]}`;
        }
      }
      
      return {
        content: [{
          type: 'text',
          text: `❌ Error: ${errorMessage}\n\nPlease ensure the code is valid Python syntax.`,
        }],
      };
    }
    
    const formatted = result.formattedCode || code;
    const changed = result.changed;
    
    let output = '🎨 Python Code Formatting Results (Black):\n\n';
    
    if (!changed) {
      output += '✅ Code is already properly formatted according to Black standards.\n';
    } else {
      output += '✅ Code formatted successfully!\n\n';
      output += 'Formatting settings:\n';
      output += `  Python version: ${detectedVersion}\n`;
      output += `  Line length: ${lineLength}\n`;
      output += `  String normalization: ${!skipStringNormalization}\n`;
      output += `  Magic trailing comma: ${!skipMagicTrailingComma}\n`;
      if (previewMode) {
        output += '  Preview mode: enabled\n';
      }
      output += '\nFormatted code:\n';
      output += '```python\n';
      output += formatted;
      output += '```\n';
    }
    
    output += '\n💡 Black enforces:\n';
    output += '- Consistent indentation (4 spaces)\n';
    output += '- Proper spacing around operators\n';
    output += '- Consistent quote usage\n';
    output += '- PEP 8 compliance with pragmatic choices';
    
    return {
      content: [{
        type: 'text',
        text: output,
      }],
    };
  } catch (error) {
    console.error('Error formatting Python code:', error);
    
    let errorMessage = 'An error occurred while formatting the code.';
    
    if (error.message === 'Formatting timeout exceeded') {
      errorMessage = 'Formatting timed out. The code might be too complex.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\nPlease ensure Black is installed and the code is valid.`,
      }],
    };
  }
}