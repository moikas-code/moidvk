/**
 * Validation utilities for Python code analysis
 */

const MAX_CODE_SIZE = 100 * 1024; // 100KB limit

/**
 * Validates Python code input
 * @param {string} code - The Python code to validate
 * @returns {Object} Validation result with valid flag and error if invalid
 */
export function validatePythonCode(code) {
  if (typeof code !== 'string') {
    return {
      valid: false,
      error: {
        content: [{
          type: 'text',
          text: '❌ Error: Code must be a string.',
        }],
      },
    };
  }
  
  if (code.length === 0) {
    return {
      valid: false,
      error: {
        content: [{
          type: 'text',
          text: '❌ Error: Code cannot be empty.',
        }],
      },
    };
  }
  
  if (code.length > MAX_CODE_SIZE) {
    return {
      valid: false,
      error: {
        content: [{
          type: 'text',
          text: `❌ Error: Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB.`,
        }],
      },
    };
  }
  
  return { valid: true };
}

/**
 * Sanitizes Python filename
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizePythonFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'code.py';
  }
  
  // Remove any path components and keep only the filename
  const baseName = filename.split(/[/\\]/).pop();
  
  // Ensure it has a Python extension
  if (!baseName.match(/\.(py|pyw|pyi)$/i)) {
    return baseName + '.py';
  }
  
  return baseName;
}

/**
 * Detects Python version from code
 * @param {string} code - The Python code
 * @returns {string} Python version (2 or 3)
 */
export function detectPythonVersion(code) {
  // Python 3 specific syntax
  if (code.match(/\bprint\s*\(/)) return '3';
  if (code.match(/\basync\s+def\b/)) return '3';
  if (code.match(/\bf"[^"]*\{[^}]*\}[^"]*"/)) return '3'; // f-strings
  if (code.match(/\b@\w+\.setter\b/)) return '3'; // property setters
  if (code.match(/\bnonlocal\b/)) return '3';
  
  // Python 2 specific syntax
  if (code.match(/\bprint\s+[^(]/)) return '2';
  if (code.match(/\bxrange\s*\(/)) return '2';
  if (code.match(/\bunicode\s*\(/)) return '2';
  
  // Default to Python 3
  return '3';
}

/**
 * Validates Python tool options
 * @param {Object} options - Tool options to validate
 * @returns {Object} Validated options with defaults
 */
export function validatePythonToolOptions(options) {
  const validated = {
    pythonVersion: '3',
    lineLength: 88, // Black default
    target: null,
    ...options
  };
  
  // Validate Python version
  if (!['2', '3'].includes(validated.pythonVersion)) {
    validated.pythonVersion = '3';
  }
  
  // Validate line length
  if (validated.lineLength < 50 || validated.lineLength > 200) {
    validated.lineLength = 88;
  }
  
  return validated;
}

/**
 * Maps Python severity levels to MCP severity
 * @param {string} pythonLevel - Python lint level
 * @returns {string} MCP severity level
 */
export function mapPythonSeverity(pythonLevel) {
  const severityMap = {
    'error': 'error',
    'warning': 'warning',
    'info': 'info',
    'convention': 'info',
    'refactor': 'warning',
    'fatal': 'error'
  };
  
  return severityMap[pythonLevel.toLowerCase()] || 'warning';
}

/**
 * Extracts import statements from Python code
 * @param {string} code - The Python code
 * @returns {Array<string>} List of imported modules
 */
export function extractPythonImports(code) {
  const imports = new Set();
  
  // Match import statements
  const importMatches = code.matchAll(/^\s*import\s+(\w+)/gm);
  for (const match of importMatches) {
    imports.add(match[1]);
  }
  
  // Match from imports
  const fromImports = code.matchAll(/^\s*from\s+(\w+)/gm);
  for (const match of fromImports) {
    imports.add(match[1]);
  }
  
  return Array.from(imports);
}

/**
 * Checks if code uses type hints
 * @param {string} code - The Python code
 * @returns {boolean} True if type hints are used
 */
export function hasTypeHints(code) {
  // Check for function annotations
  if (/def\s+\w+\s*\([^)]*:\s*\w+/.test(code)) return true;
  
  // Check for return type annotations
  if (/\)\s*->\s*\w+/.test(code)) return true;
  
  // Check for variable annotations
  if (/:\s*\w+\s*=/.test(code)) return true;
  
  return false;
}

/**
 * Gets Python file type from filename
 * @param {string} filename - The filename
 * @returns {string} File type (module, test, setup, __init__)
 */
export function getPythonFileType(filename) {
  if (!filename) return 'module';
  
  const name = filename.toLowerCase();
  
  if (name === '__init__.py') return '__init__';
  if (name === 'setup.py') return 'setup';
  if (name.includes('test_') || name.includes('_test.py')) return 'test';
  if (name === '__main__.py') return '__main__';
  if (name === 'conftest.py') return 'conftest';
  
  return 'module';
}

/**
 * Extracts docstrings from Python code
 * @param {string} code - The Python code
 * @returns {Array} Array of docstring objects with line numbers
 */
export function extractDocstrings(code) {
  const docstrings = [];
  const lines = code.split('\n');
  
  // Match triple-quoted strings after function/class definitions
  const tripleQuoteRegex = /^(\s*)(""""|''')/;
  let inDocstring = false;
  let currentDocstring = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const prevLine = i > 0 ? lines[i - 1] : '';
    
    // Check if this starts a docstring
    if (!inDocstring && tripleQuoteRegex.test(line)) {
      // Check if previous line was a function or class definition
      if (prevLine.match(/^\s*(def|class)\s+\w+/)) {
        inDocstring = true;
        currentDocstring = {
          startLine: i + 1,
          type: prevLine.includes('def') ? 'function' : 'class',
          content: line
        };
      }
    } else if (inDocstring) {
      currentDocstring.content += '\n' + line;
      
      // Check if this ends the docstring
      if (tripleQuoteRegex.test(line)) {
        currentDocstring.endLine = i + 1;
        docstrings.push(currentDocstring);
        inDocstring = false;
        currentDocstring = null;
      }
    }
  }
  
  return docstrings;
}