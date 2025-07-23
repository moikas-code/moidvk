import * as prettier from 'prettier';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout, FORMAT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for format_code
 */
export const codeFormatterTool = {
  name: 'format_code',
  description: 'Formats code using Prettier. Supports JavaScript, TypeScript, JSX, TSX, JSON, CSS, HTML, Markdown, and YAML. Automatically detects the parser from the file extension.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The code to format (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename to determine parser (e.g., \'example.js\', \'styles.css\')',
      },
      check: {
        type: 'boolean',
        description: 'If true, only checks if formatting is needed without returning formatted code',
      },
    },
    required: ['code'],
  },
};

// Parser mapping based on file extensions
const parserMap = {
  '.js': 'babel',
  '.jsx': 'babel',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.json': 'json',
  '.css': 'css',
  '.scss': 'scss',
  '.less': 'less',
  '.html': 'html',
  '.md': 'markdown',
  '.mdx': 'mdx',
  '.yml': 'yaml',
  '.yaml': 'yaml',
};

/**
 * Determines the parser based on filename
 * @param {string} filename - The filename
 * @returns {string} Parser name
 */
function getParser(filename) {
  if (!filename) return 'babel'; // Default to JavaScript
  
  const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
  return parserMap[ext] || 'babel';
}

/**
 * Handles the format_code tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.code - Code to format
 * @param {string} args.filename - Optional filename
 * @param {boolean} args.check - Check mode flag
 * @returns {Object} MCP response
 */
export async function handleCodeFormatter(args) {
  const { code, filename, check = false } = args.params || args;
  
  // Validate input
  const validation = validateCode(code);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeFilename(filename);
  const parser = getParser(safeFilename);
  
  try {
    // Try to read project's prettier config
    let config = {};
    try {
      config = await prettier.resolveConfig(process.cwd()) || {};
    } catch (e) {
      // Use defaults if no config found
    }
    
    const options = {
      ...config,
      parser,
      filepath: safeFilename,
    };
    
    if (check) {
      // Check if formatting is needed
      const checkPromise = prettier.check(code, options);
      const isFormatted = await withTimeout(checkPromise, FORMAT_TIMEOUT_MS, 'Formatting check');
      
      return {
        content: [{
          type: 'text',
          text: isFormatted 
            ? '✅ Code is already properly formatted.' 
            : '⚠️  Code needs formatting. Run without \'check\' flag to format.',
        }],
      };
    }
    
    // Format the code
    const formatPromise = prettier.format(code, options);
    const formatted = await withTimeout(formatPromise, FORMAT_TIMEOUT_MS, 'Formatting');
    
    // Check if anything changed
    const changed = formatted !== code;
    
    let output = '🎨 Code Formatting Results:\n\n';
    
    if (!changed) {
      output += '✅ Code is already properly formatted.\n';
    } else {
      output += '✅ Code formatted successfully!\n\n';
      output += 'Formatted code:\n';
      output += '```' + (parser === 'typescript' ? 'typescript' : 'javascript') + '\n';
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
    console.error('Error formatting code:', error);
    
    let errorMessage = 'An error occurred while formatting the code.';
    
    if (error.message === 'Formatting timeout exceeded') {
      errorMessage = 'Formatting timed out. The code might be too complex.';
    } else if (error.message.includes('Unexpected token') || error.message.includes('SyntaxError')) {
      errorMessage = `Syntax error in ${parser} code: ${error.message}`;
    } else if (error.message.includes('Unknown language')) {
      errorMessage = 'Unsupported file type. Please provide a valid filename or use a supported format.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\nPlease ensure the code is valid ${parser} syntax.`,
      }],
    };
  }
}