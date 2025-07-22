/**
 * Validation utilities for Rust code analysis
 */

const MAX_CODE_SIZE = 100 * 1024; // 100KB limit

/**
 * Validates Rust code input
 * @param {string} code - The Rust code to validate
 * @returns {Object} Validation result with valid flag and error if invalid
 */
export function validateRustCode(code) {
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
 * Sanitizes Rust filename
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeRustFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'code.rs';
  }
  
  // Remove any path components and keep only the filename
  const baseName = filename.split(/[/\\]/).pop();
  
  // Ensure it has a Rust extension
  if (!baseName.match(/\.(rs|toml)$/i)) {
    return baseName + '.rs';
  }
  
  return baseName;
}

/**
 * Detects Rust edition from code or defaults
 * @param {string} code - The Rust code
 * @returns {string} Edition year
 */
export function detectRustEdition(code) {
  // Check for edition attribute in code
  const editionMatch = code.match(/#!\[.*edition\s*=\s*"(\d{4})".*\]/);
  if (editionMatch) {
    return editionMatch[1];
  }
  
  // Default to 2021 edition
  return '2021';
}

/**
 * Validates Rust tool options
 * @param {Object} options - Tool options to validate
 * @returns {Object} Validated options with defaults
 */
export function validateRustToolOptions(options) {
  const validated = {
    edition: '2021',
    level: 'warn',
    target: null,
    features: [],
    ...options
  };
  
  // Validate edition
  const validEditions = ['2015', '2018', '2021', '2024'];
  if (!validEditions.includes(validated.edition)) {
    validated.edition = '2021';
  }
  
  // Validate lint level
  const validLevels = ['allow', 'warn', 'deny', 'forbid'];
  if (!validLevels.includes(validated.level)) {
    validated.level = 'warn';
  }
  
  // Ensure features is an array
  if (!Array.isArray(validated.features)) {
    validated.features = [];
  }
  
  return validated;
}

/**
 * Maps Rust severity levels to MCP severity
 * @param {string} rustLevel - Rust lint level
 * @returns {string} MCP severity level
 */
export function mapRustSeverity(rustLevel) {
  const severityMap = {
    'error': 'error',
    'warning': 'warning',
    'note': 'info',
    'help': 'info',
    'failure-note': 'error'
  };
  
  return severityMap[rustLevel.toLowerCase()] || 'warning';
}

/**
 * Extracts crate dependencies from Rust code
 * @param {string} code - The Rust code
 * @returns {Array<string>} List of external crate dependencies
 */
export function extractCrateDependencies(code) {
  const dependencies = new Set();
  
  // Match extern crate declarations
  const externCrates = code.matchAll(/extern\s+crate\s+(\w+);/g);
  for (const match of externCrates) {
    dependencies.add(match[1]);
  }
  
  // Match use statements for external crates
  const useStatements = code.matchAll(/use\s+(\w+)(::|;)/g);
  for (const match of useStatements) {
    const crate = match[1];
    // Filter out std library modules
    if (!['std', 'core', 'alloc', 'proc_macro', 'test'].includes(crate)) {
      dependencies.add(crate);
    }
  }
  
  return Array.from(dependencies);
}

/**
 * Checks if code contains unsafe blocks
 * @param {string} code - The Rust code
 * @returns {boolean} True if unsafe blocks are present
 */
export function hasUnsafeCode(code) {
  return /\bunsafe\s*\{/.test(code);
}

/**
 * Gets Rust file type from extension
 * @param {string} filename - The filename
 * @returns {string} File type (lib, bin, test, bench, build)
 */
export function getRustFileType(filename) {
  if (!filename) return 'lib';
  
  const name = filename.toLowerCase();
  
  if (name === 'build.rs') return 'build';
  if (name === 'main.rs') return 'bin';
  if (name === 'lib.rs') return 'lib';
  if (name.includes('test') || name.includes('_test.rs')) return 'test';
  if (name.includes('bench') || name.includes('_bench.rs')) return 'bench';
  if (name === 'cargo.toml') return 'manifest';
  
  return 'lib';
}