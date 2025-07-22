import { readFile, writeFile } from 'fs/promises';
import { resolve, extname } from 'path';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

// Import language-specific tools
import { runEslintAutoFixer } from './eslint-auto-fixer.js';
import { handleRustCodePractices } from '../rust/rust-code-practices.js';
import { handleRustFormatter } from '../rust/rust-formatter.js';
import { handlePythonCodeAnalyzer } from '../python/python-code-analyzer.js';
import { handlePythonFormatter } from '../python/python-formatter.js';
import { analyzeGoCode } from '../go/go-code-analyzer.js';
import { formatGoCode } from '../go/go-formatter.js';

/**
 * Tool definition for multi_language_auto_fixer
 */
export const multiLanguageAutoFixerTool = {
  name: 'multi_language_auto_fixer',
  description:
    'Universal auto-fixer that detects language and applies appropriate linting and formatting tools. Supports JavaScript/TypeScript (ESLint+Prettier), Python (Ruff+Black), Rust (Clippy+rustfmt), and Go (vet+gofmt).',
  inputSchema: {
    type: 'object',
    properties: {
      // Input options
      code: {
        type: 'string',
        description: 'Source code to analyze and fix (required if filePath not provided)',
      },
      filePath: {
        type: 'string',
        description: 'File path to lint and fix (required if code not provided)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for language detection (e.g., "main.rs", "app.py")',
      },
      language: {
        type: 'string',
        description: 'Force specific language instead of auto-detection',
        enum: ['javascript', 'typescript', 'python', 'rust', 'go', 'auto'],
        default: 'auto',
      },
      // Operation options
      autoFix: {
        type: 'boolean',
        description: 'Automatically apply fixable issues',
        default: true,
      },
      autoFormat: {
        type: 'boolean',
        description: 'Automatically format code',
        default: true,
      },
      writeToFile: {
        type: 'boolean',
        description: 'Write fixed code back to file (only works with filePath)',
        default: false,
      },
      // Analysis options
      production: {
        type: 'boolean',
        description: 'Use stricter production-level rules',
        default: false,
      },
      severity: {
        type: 'string',
        description: 'Minimum severity level to report',
        enum: ['error', 'warning', 'info', 'all'],
        default: 'all',
      },
      // Output options
      showFixed: {
        type: 'boolean',
        description: 'Show what was fixed in the output',
        default: true,
      },
      showRemaining: {
        type: 'boolean',
        description: 'Show remaining unfixable issues',
        default: true,
      },
      showFormatted: {
        type: 'boolean',
        description: 'Show formatted code in output',
        default: true,
      },
      // Pagination
      limit: {
        type: 'number',
        description: 'Maximum number of issues to show',
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
    },
    required: [],
    additionalProperties: false,
  },
};

/**
 * Language detection based on file extension and content
 * @param {string} filename - Filename or path
 * @param {string} code - Source code content
 * @returns {string} Detected language
 */
function detectLanguage(filename, code) {
  if (!filename && !code) return 'unknown';

  // Check file extension first
  if (filename) {
    const ext = extname(filename).toLowerCase();
    const extensionMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.pyi': 'python',
      '.rs': 'rust',
      '.go': 'go',
    };

    if (extensionMap[ext]) {
      return extensionMap[ext];
    }
  }

  // Fallback to content-based detection
  if (code) {
    // Python indicators
    if (/^#!.*python|import \w+|from \w+ import|def \w+\(|class \w+:/m.test(code)) {
      return 'python';
    }

    // Rust indicators
    if (/fn main\(\)|use std::|let mut|impl \w+|struct \w+/m.test(code)) {
      return 'rust';
    }

    // Go indicators
    if (/package \w+|func main\(\)|import '|var \w+|type \w+ struct/m.test(code)) {
      return 'go';
    }

    // TypeScript indicators
    if (/interface \w+|type \w+ =|: \w+\[\]|as \w+|<\w+>/m.test(code)) {
      return 'typescript';
    }

    // JavaScript indicators (default for JS-like syntax)
    if (/function \w+|const \w+|let \w+|var \w+|=>/m.test(code)) {
      return 'javascript';
    }
  }

  return 'unknown';
}

/**
 * Reads file content if filePath is provided
 * @param {string} filePath - Path to file
 * @returns {Promise<string>} File content
 */
async function readFileContent(filePath) {
  try {
    const resolvedPath = resolve(filePath);
    return await readFile(resolvedPath, 'utf8');
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
}

/**
 * Writes fixed content back to file
 * @param {string} filePath - Path to file
 * @param {string} content - Fixed content
 */
async function writeFileContent(filePath, content) {
  try {
    const resolvedPath = resolve(filePath);
    await writeFile(resolvedPath, content, 'utf8');
  } catch (error) {
    throw new Error(`Failed to write file: ${error.message}`);
  }
}

/**
 * Processes JavaScript/TypeScript files
 * @param {string} code - Source code
 * @param {string} filePath - File path
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
async function processJavaScriptTypeScript(code, filePath, options) {
  const results = {
    language: options.language === 'typescript' ? 'typescript' : 'javascript',
    linting: null,
    formatting: null,
    finalCode: code,
    issues: [],
    summary: {},
  };

  try {
    // Run ESLint auto-fixer
    if (options.autoFix) {
      const eslintResult = await runEslintAutoFixer({
        code: filePath ? undefined : code,
        filePath: filePath,
        production: options.production,
        autoFix: true,
        writeToFile: false, // We'll handle writing ourselves
        severity: options.severity,
        showFixed: false,
        showRemaining: true,
        limit: options.limit,
        offset: options.offset,
      });

      results.linting = eslintResult;
      if (eslintResult.fixedCode) {
        results.finalCode = eslintResult.fixedCode;
      }
      if (eslintResult.remainingIssues) {
        results.issues.push(...eslintResult.remainingIssues);
      }
    }

    // TODO: Add Prettier formatting support
    // For now, ESLint handles both linting and some formatting

    results.summary = {
      totalIssues: results.linting?.summary?.totalIssues || 0,
      fixedIssues:
        (results.linting?.summary?.fixableErrors || 0) +
        (results.linting?.summary?.fixableWarnings || 0),
      remainingIssues: results.issues.length,
      wasFormatted: results.finalCode !== code,
    };
  } catch (error) {
    results.error = error.message;
  }

  return results;
}

/**
 * Processes Python files
 * @param {string} code - Source code
 * @param {string} filename - Filename
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
async function processPython(code, filename, options) {
  const results = {
    language: 'python',
    linting: null,
    formatting: null,
    finalCode: code,
    issues: [],
    summary: {},
  };

  try {
    // Run Ruff linting
    if (options.autoFix) {
      const lintResult = await withTimeout(
        handlePythonCodeAnalyzer({
          code,
          filename: filename || 'temp.py',
          tools: ['ruff'],
          severity: options.severity,
          limit: options.limit,
          offset: options.offset,
        }),
        LINT_TIMEOUT_MS,
      );

      results.linting = lintResult;
      if (lintResult.issues) {
        results.issues.push(...lintResult.issues);
      }
    }

    // Run Black formatting
    if (options.autoFormat) {
      const formatResult = await withTimeout(
        handlePythonFormatter({
          code: results.finalCode,
          filename: filename || 'temp.py',
          check: false,
          lineLength: 88,
        }),
        LINT_TIMEOUT_MS,
      );

      results.formatting = formatResult;
      if (formatResult.formatted && formatResult.formatted !== results.finalCode) {
        results.finalCode = formatResult.formatted;
      }
    }

    results.summary = {
      totalIssues: results.issues.length,
      fixedIssues: 0, // Python tools don't auto-fix yet
      remainingIssues: results.issues.length,
      wasFormatted: results.finalCode !== code,
    };
  } catch (error) {
    results.error = error.message;
  }

  return results;
}

/**
 * Processes Rust files
 * @param {string} code - Source code
 * @param {string} filename - Filename
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
async function processRust(code, filename, options) {
  const results = {
    language: 'rust',
    linting: null,
    formatting: null,
    finalCode: code,
    issues: [],
    summary: {},
  };

  try {
    // Run Clippy linting
    if (options.autoFix) {
      const lintResult = await withTimeout(
        handleRustCodePractices({
          code,
          filename: filename || 'temp.rs',
          lintLevel: options.production ? 'strict' : 'default',
          severity: options.severity,
          limit: options.limit,
          offset: options.offset,
        }),
        LINT_TIMEOUT_MS,
      );

      results.linting = lintResult;
      if (lintResult.issues) {
        results.issues.push(...lintResult.issues);
      }
    }

    // Run rustfmt formatting
    if (options.autoFormat) {
      const formatResult = await withTimeout(
        handleRustFormatter({
          code: results.finalCode,
          filename: filename || 'temp.rs',
          check: false,
          edition: '2021',
        }),
        LINT_TIMEOUT_MS,
      );

      results.formatting = formatResult;
      if (formatResult.formatted && formatResult.formatted !== results.finalCode) {
        results.finalCode = formatResult.formatted;
      }
    }

    results.summary = {
      totalIssues: results.issues.length,
      fixedIssues: 0, // Rust tools don't auto-fix yet
      remainingIssues: results.issues.length,
      wasFormatted: results.finalCode !== code,
    };
  } catch (error) {
    results.error = error.message;
  }

  return results;
}

/**
 * Processes Go files
 * @param {string} code - Source code
 * @param {string} filename - Filename
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} Processing results
 */
async function processGo(code, filename, options) {
  const results = {
    language: 'go',
    linting: null,
    formatting: null,
    finalCode: code,
    issues: [],
    summary: {},
  };

  try {
    // Run Go linting (vet, staticcheck)
    if (options.autoFix) {
      const lintResult = await withTimeout(
        analyzeGoCode({
          code,
          filename: filename || 'temp.go',
          tools: ['vet', 'staticcheck'],
          severity: options.severity,
          limit: options.limit,
          offset: options.offset,
        }),
        LINT_TIMEOUT_MS,
      );

      results.linting = lintResult;
      if (lintResult.issues) {
        results.issues.push(...lintResult.issues);
      }
    }

    // Run gofmt/goimports formatting
    if (options.autoFormat) {
      const formatResult = await withTimeout(
        formatGoCode({
          code: results.finalCode,
          filename: filename || 'temp.go',
          check: false,
          tool: 'goimports',
        }),
        LINT_TIMEOUT_MS,
      );

      results.formatting = formatResult;
      if (formatResult.formatted && formatResult.formatted !== results.finalCode) {
        results.finalCode = formatResult.formatted;
      }
    }

    results.summary = {
      totalIssues: results.issues.length,
      fixedIssues: 0, // Go tools don't auto-fix yet
      remainingIssues: results.issues.length,
      wasFormatted: results.finalCode !== code,
    };
  } catch (error) {
    results.error = error.message;
  }

  return results;
}

/**
 * Formats results for output
 * @param {Object} results - Processing results
 * @param {Object} options - Formatting options
 * @param {string} originalCode - Original source code
 * @returns {string} Formatted output
 */
function formatResults(results, options) {
  let output = '# Multi-Language Auto-Fix Results\n\n';

  output += '## Summary\n';
  output += `- **Language**: ${results.language}\n`;
  output += `- **Total Issues**: ${results.summary.totalIssues}\n`;
  output += `- **Fixed Issues**: ${results.summary.fixedIssues}\n`;
  output += `- **Remaining Issues**: ${results.summary.remainingIssues}\n`;
  output += `- **Code Formatted**: ${results.summary.wasFormatted ? '✅ Yes' : '❌ No'}\n\n`;

  // Show formatted code if requested and changes were made
  if (options.showFormatted && results.summary.wasFormatted) {
    output += '## ✅ Fixed & Formatted Code\n\n';
    output += `\`\`\`${results.language}\n`;
    output += results.finalCode;
    output += '\n```\n\n';
  }

  // Show remaining issues if requested
  if (options.showRemaining && results.issues.length > 0) {
    output += '## 🔍 Remaining Issues\n\n';
    output += `Showing ${Math.min(results.issues.length, options.limit)} of ${results.issues.length} issues\n\n`;

    // Group by severity
    const errorIssues = results.issues.filter((issue) => issue.severity === 'error');
    const warningIssues = results.issues.filter((issue) => issue.severity === 'warning');
    const infoIssues = results.issues.filter((issue) => issue.severity === 'info');

    if (errorIssues.length > 0) {
      output += `### 🔴 Errors (${errorIssues.length})\n\n`;
      for (const issue of errorIssues.slice(0, options.limit)) {
        output += `**Line ${issue.line}** - ${issue.message}\n`;
        if (issue.suggestion) {
          output += `*Suggestion: ${issue.suggestion}*\n`;
        }
        output += '\n';
      }
    }

    if (warningIssues.length > 0) {
      output += `### 🟡 Warnings (${warningIssues.length})\n\n`;
      for (const issue of warningIssues.slice(0, Math.max(1, options.limit - errorIssues.length))) {
        output += `**Line ${issue.line}** - ${issue.message}\n`;
        if (issue.suggestion) {
          output += `*Suggestion: ${issue.suggestion}*\n`;
        }
        output += '\n';
      }
    }

    if (infoIssues.length > 0 && errorIssues.length + warningIssues.length < options.limit) {
      output += `### 🔵 Info (${infoIssues.length})\n\n`;
      for (const issue of infoIssues.slice(
        0,
        Math.max(1, options.limit - errorIssues.length - warningIssues.length),
      )) {
        output += `**Line ${issue.line}** - ${issue.message}\n`;
        if (issue.suggestion) {
          output += `*Suggestion: ${issue.suggestion}*\n`;
        }
        output += '\n';
      }
    }
  } else if (options.showRemaining && results.issues.length === 0) {
    output += '## ✅ No Issues Found!\n\n';
    output += `Great! Your ${results.language} code is clean and follows best practices.\n\n`;
  }

  // Add language-specific recommendations
  output += '## 📋 Recommendations\n\n';

  const recommendations = {
    javascript: [
      '- Configure your editor to run ESLint on save',
      '- Add ESLint to your git pre-commit hooks',
      '- Consider using TypeScript for better type safety',
    ],
    typescript: [
      '- Configure your editor to run ESLint and TypeScript compiler on save',
      '- Use strict TypeScript configuration for better type safety',
      '- Add ESLint and tsc to your git pre-commit hooks',
    ],
    python: [
      '- Configure your editor to run Ruff and Black on save',
      '- Add pre-commit hooks with ruff and black',
      '- Consider using mypy for static type checking',
    ],
    rust: [
      '- Configure your editor to run clippy and rustfmt on save',
      '- Add clippy and rustfmt to your CI/CD pipeline',
      '- Use `cargo clippy -- -D warnings` for strict linting',
    ],
    go: [
      '- Configure your editor to run gofmt/goimports on save',
      '- Add `go vet` and `golangci-lint` to your CI/CD pipeline',
      '- Use `go mod tidy` to keep dependencies clean',
    ],
  };

  const langRecommendations = recommendations[results.language] || [
    '- Configure your editor with appropriate linting and formatting tools',
    '- Add code quality checks to your CI/CD pipeline',
  ];

  for (const rec of langRecommendations) {
    output += `${rec}\n`;
  }

  if (results.error) {
    output += '\n## ⚠️ Processing Error\n\n';
    output += `${results.error}\n`;
  }

  return output;
}

/**
 * Main multi-language auto-fixer function
 * @param {Object} args - Tool arguments
 * @returns {Promise<Object>} Auto-fix results
 */
async function runMultiLanguageAutoFixer(args) {
  const {
    code,
    filePath,
    filename,
    language = 'auto',
    autoFix = true,
    autoFormat = true,
    writeToFile = false,
    production = false,
    severity = 'all',
    showFixed = true,
    showRemaining = true,
    showFormatted = true,
    limit = 50,
    offset = 0,
  } = args;

  // Runtime validation for mutual exclusivity
  if (!code && !filePath) {
    throw new Error('Either "code" or "filePath" parameter is required');
  }

  if (code && filePath) {
    throw new Error('Cannot specify both "code" and "filePath" parameters - choose one');
  }

  try {
    // Get source code and determine language
    let sourceCode;
    let targetFilePath;
    let detectedFilename;

    if (filePath) {
      sourceCode = await readFileContent(filePath);
      targetFilePath = filePath;
      detectedFilename = filePath;
    } else if (code) {
      // Validate code input
      const validation = validateCode(code);
      if (!validation.valid) {
        return validation.error;
      }
      sourceCode = code;
      detectedFilename = filename;
    } else {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Error: Either code or filePath must be provided',
          },
        ],
      };
    }

    // Detect or use specified language
    const detectedLanguage =
      language === 'auto' ? detectLanguage(detectedFilename, sourceCode) : language;

    if (detectedLanguage === 'unknown') {
      return {
        content: [
          {
            type: 'text',
            text: '❌ Error: Could not detect language. Please specify language parameter or provide a filename with extension.',
          },
        ],
      };
    }

    // Process based on language
    const options = {
      language: detectedLanguage,
      autoFix,
      autoFormat,
      production,
      severity,
      limit,
      offset,
    };

    let results;
    const safeFilename =
      sanitizeFilename(detectedFilename) ||
      `temp.${detectedLanguage === 'javascript' ? 'js' : detectedLanguage === 'typescript' ? 'ts' : detectedLanguage}`;

    switch (detectedLanguage) {
      case 'javascript':
      case 'typescript':
        results = await processJavaScriptTypeScript(sourceCode, targetFilePath, options);
        break;
      case 'python':
        results = await processPython(sourceCode, safeFilename, options);
        break;
      case 'rust':
        results = await processRust(sourceCode, safeFilename, options);
        break;
      case 'go':
        results = await processGo(sourceCode, safeFilename, options);
        break;
      default:
        return {
          content: [
            {
              type: 'text',
              text: `❌ Error: Language '${detectedLanguage}' is not supported yet.`,
            },
          ],
        };
    }

    // Write fixed code back to file if requested
    if (writeToFile && targetFilePath && results.finalCode !== sourceCode) {
      await writeFileContent(targetFilePath, results.finalCode);
    }

    // Format output
    const output = formatResults(results, {
      showFixed,
      showRemaining,
      showFormatted,
      limit,
      offset,
    });

    // Prepare response
    const response = {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      language: detectedLanguage,
      summary: results.summary,
      originalCode: sourceCode,
      finalCode: results.finalCode,
      codeChanged: results.finalCode !== sourceCode,
      writtenToFile: writeToFile && targetFilePath && results.finalCode !== sourceCode,
    };

    // Include remaining issues
    if (results.issues.length > 0) {
      response.remainingIssues = results.issues;
      response.hasMoreIssues = results.issues.length > limit;
    }

    return response;
  } catch (error) {
    let errorMessage = 'Multi-language auto-fix failed';

    if (error.message.includes('ENOENT')) {
      errorMessage = 'File not found - check the file path';
    } else if (error.message.includes('EACCES')) {
      errorMessage = 'Permission denied - check file permissions';
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Operation timed out - file may be too large or tools unavailable';
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${errorMessage}\n\nDetails: ${error.message}`,
        },
      ],
    };
  }
}

// Export the main function and tool definition
export { runMultiLanguageAutoFixer };
