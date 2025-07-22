// Shared validation utilities
export const MAX_CODE_LENGTH = 100000; // 100KB limit

/**
 * Validates input code for MCP tools
 * @param {string} code - The code to validate
 * @returns {{valid: boolean, error?: {content: Array}}} Validation result
 */
export function validateCode(code) {
  if (typeof code !== 'string') {
    return {
      valid: false,
      error: {
        content: [{
          type: 'text',
          text: '❌ Error: Code must be a string',
        }],
      },
    };
  }
  
  if (code.length > MAX_CODE_LENGTH) {
    return {
      valid: false,
      error: {
        content: [{
          type: 'text',
          text: `❌ Error: Code is too large (${Math.round(code.length / 1024)}KB). Maximum allowed size is ${Math.round(MAX_CODE_LENGTH / 1024)}KB.`,
        }],
      },
    };
  }
  
  if (code.trim().length === 0) {
    return {
      valid: false,
      error: {
        content: [{
          type: 'text',
          text: '❌ Error: No code provided',
        }],
      },
    };
  }
  
  return { valid: true };
}

/**
 * Sanitizes filename for safe usage
 * @param {string} filename - The filename to sanitize
 * @returns {string} Safe filename
 */
export function sanitizeFilename(filename) {
  if (!filename) {
    return 'code.js';
  }
  // Remove any path components, keep only the filename
  const basename = filename.split(/[/\\]/).pop() || 'code.js';
  // Ensure it has a safe extension - support more file types for accessibility testing
  return basename.match(/\.(js|jsx|mjs|cjs|ts|tsx|html|htm|css|scss|sass)$/) ? basename : 'code.js';
}