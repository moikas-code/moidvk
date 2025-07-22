/**
 * Validation utilities for Go code analysis
 */

const MAX_CODE_SIZE = 100 * 1024; // 100KB limit

/**
 * Validates Go code input
 * @param {string} code - The Go code to validate
 * @returns {Object} Validation result with valid flag and error if invalid
 */
export function validateGoCode(code) {
  if (typeof code !== 'string') {
    return {
      valid: false,
      error: {
        content: [
          {
            type: 'text',
            text: '❌ Error: Code must be a string.',
          },
        ],
      },
    };
  }

  if (code.length === 0) {
    return {
      valid: false,
      error: {
        content: [
          {
            type: 'text',
            text: '❌ Error: Code cannot be empty.',
          },
        ],
      },
    };
  }

  if (code.length > MAX_CODE_SIZE) {
    return {
      valid: false,
      error: {
        content: [
          {
            type: 'text',
            text: `❌ Error: Code exceeds maximum size of ${MAX_CODE_SIZE / 1024}KB.`,
          },
        ],
      },
    };
  }

  return { valid: true };
}

/**
 * Sanitizes Go filename
 * @param {string} filename - The filename to sanitize
 * @returns {string} Sanitized filename
 */
export function sanitizeGoFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return 'main.go';
  }

  // Remove any path components and keep only the filename
  const baseName = filename.split(/[/\\]/).pop();

  // Ensure it has a Go extension
  if (!baseName.match(/\.(go|mod|sum)$/i)) {
    return baseName + '.go';
  }

  return baseName;
}

/**
 * Detects Go version from code or defaults
 * @param {string} code - The Go code
 * @returns {string} Go version
 */
export function detectGoVersion(code) {
  // Check for go directive in go.mod content
  const goDirectiveMatch = code.match(/^go\s+(\d+\.\d+(?:\.\d+)?)/m);
  if (goDirectiveMatch) {
    return goDirectiveMatch[1];
  }

  // Check for build constraints with Go version
  const buildConstraintMatch = code.match(/\/\/\s*\+build\s+go(\d+\.\d+)/);
  if (buildConstraintMatch) {
    return buildConstraintMatch[1];
  }

  // Default to Go 1.21 (current stable)
  return '1.21';
}

/**
 * Validates Go tool options
 * @param {Object} options - Tool options to validate
 * @returns {Object} Validated options with defaults
 */
export function validateGoToolOptions(options) {
  const validated = {
    goVersion: '1.21',
    buildTags: [],
    goos: '',
    goarch: '',
    cgoEnabled: true,
    modules: true,
    ...options,
  };

  // Validate Go version
  const validVersions = ['1.19', '1.20', '1.21', '1.22', '1.23'];
  if (!validVersions.includes(validated.goVersion)) {
    validated.goVersion = '1.21';
  }

  // Ensure buildTags is an array
  if (!Array.isArray(validated.buildTags)) {
    validated.buildTags = [];
  }

  // Validate GOOS if provided
  const validGOOS = [
    'linux',
    'windows',
    'darwin',
    'freebsd',
    'openbsd',
    'netbsd',
    'dragonfly',
    'plan9',
    'solaris',
    'android',
    'ios',
    'js',
    'wasip1',
  ];
  if (validated.goos && !validGOOS.includes(validated.goos)) {
    validated.goos = '';
  }

  // Validate GOARCH if provided
  const validGOARCH = [
    '386',
    'amd64',
    'arm',
    'arm64',
    'ppc64',
    'ppc64le',
    's390x',
    'mips',
    'mipsle',
    'mips64',
    'mips64le',
    'riscv64',
    'wasm',
  ];
  if (validated.goarch && !validGOARCH.includes(validated.goarch)) {
    validated.goarch = '';
  }

  return validated;
}

/**
 * Maps Go severity levels to MCP severity
 * @param {string} goLevel - Go tool severity level
 * @returns {string} MCP severity level
 */
export function mapGoSeverity(goLevel) {
  const severityMap = {
    error: 'error',
    warning: 'warning',
    info: 'info',
    note: 'info',
    suggestion: 'info',
    high: 'error',
    medium: 'warning',
    low: 'info',
  };

  return severityMap[goLevel.toLowerCase()] || 'warning';
}

/**
 * Extracts package imports from Go code
 * @param {string} code - The Go code
 * @returns {Array<string>} List of imported packages
 */
export function extractGoImports(code) {
  const imports = new Set();

  // Match single import statements
  const singleImports = code.matchAll(/import\s+"([^"]+)"/g);
  for (const match of singleImports) {
    imports.add(match[1]);
  }

  // Match import blocks
  const importBlocks = code.matchAll(/import\s*\(\s*([\s\S]*?)\s*\)/g);
  for (const block of importBlocks) {
    const importLines = block[1].split('\n');
    for (const line of importLines) {
      const importMatch = line.match(/^\s*(?:\w+\s+)?"([^"]+)"/);
      if (importMatch) {
        imports.add(importMatch[1]);
      }
    }
  }

  return Array.from(imports);
}

/**
 * Checks if code contains CGO
 * @param {string} code - The Go code
 * @returns {boolean} True if CGO is used
 */
export function hasCGO(code) {
  return /import\s+"C"/.test(code) || /#include\s+</.test(code) || /\/\*\s*#/.test(code);
}

/**
 * Checks if code contains unsafe operations
 * @param {string} code - The Go code
 * @returns {boolean} True if unsafe operations are present
 */
export function hasUnsafeCode(code) {
  return /\bunsafe\./.test(code) || /import\s+"unsafe"/.test(code);
}

/**
 * Gets Go file type from filename and content
 * @param {string} filename - The filename
 * @param {string} code - The Go code (optional)
 * @returns {string} File type (main, package, test, mod, sum)
 */
export function getGoFileType(filename, code = '') {
  if (!filename) return 'package';

  const name = filename.toLowerCase();

  if (name === 'go.mod') return 'mod';
  if (name === 'go.sum') return 'sum';
  if (name.endsWith('_test.go')) return 'test';

  // Check if it's a main package
  if (code && /package\s+main/.test(code)) {
    return 'main';
  }

  return 'package';
}

/**
 * Extracts build tags from Go code
 * @param {string} code - The Go code
 * @returns {Array<string>} List of build tags
 */
export function extractBuildTags(code) {
  const tags = new Set();

  // Match //go:build directives (new format)
  const goBuildMatches = code.matchAll(/\/\/go:build\s+(.+)/g);
  for (const match of goBuildMatches) {
    const tagExpression = match[1].trim();
    // Extract individual tags from boolean expressions
    const tagMatches = tagExpression.matchAll(/\b(\w+)\b/g);
    for (const tagMatch of tagMatches) {
      if (!['&&', '||', '!', 'and', 'or', 'not'].includes(tagMatch[1])) {
        tags.add(tagMatch[1]);
      }
    }
  }

  // Match legacy // +build directives
  const buildMatches = code.matchAll(/\/\/\s*\+build\s+(.+)/g);
  for (const match of buildMatches) {
    const tagList = match[1].trim().split(/\s+/);
    for (const tag of tagList) {
      const cleanTag = tag.replace(/^!/, ''); // Remove negation
      if (cleanTag && !cleanTag.includes(',')) {
        tags.add(cleanTag);
      }
    }
  }

  return Array.from(tags);
}

/**
 * Checks if Go code is a valid Go module
 * @param {string} code - The go.mod content
 * @returns {boolean} True if valid module
 */
export function isValidGoModule(code) {
  return /^module\s+\S+/m.test(code) && /^go\s+\d+\.\d+/m.test(code);
}

/**
 * Extracts module path from go.mod
 * @param {string} code - The go.mod content
 * @returns {string|null} Module path or null if not found
 */
export function extractModulePath(code) {
  const moduleMatch = code.match(/^module\s+(\S+)/m);
  return moduleMatch ? moduleMatch[1] : null;
}
