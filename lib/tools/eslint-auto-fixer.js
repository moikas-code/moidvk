import { ESLint } from 'eslint';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';
import { eslintConfig } from '../config/eslint-config.js';
import { productionEslintConfig } from '../config/production-eslint-config.js';

/**
 * Tool definition for eslint_auto_fixer
 */
export const eslintAutoFixerTool = {
  name: 'eslint_auto_fixer',
  description:
    'Automatically runs ESLint on JavaScript/TypeScript files and applies auto-fixes. Can fix code style, unused variables, and other linting issues.',
  inputSchema: {
    type: 'object',
    properties: {
      // Input options
      code: {
        type: 'string',
        description: 'JavaScript/TypeScript code to lint and fix (max 100KB)',
      },
      filePath: {
        type: 'string',
        description: 'File path to lint and fix (alternative to code parameter)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "main.js")',
      },
      // Linting options
      production: {
        type: 'boolean',
        description: 'Use stricter production ESLint config',
        default: false,
      },
      autoFix: {
        type: 'boolean',
        description: 'Automatically apply fixable ESLint rules',
        default: true,
      },
      writeToFile: {
        type: 'boolean',
        description: 'Write fixed code back to file (only works with filePath)',
        default: false,
      },
      // Filtering options
      severity: {
        type: 'string',
        description: 'Minimum severity level to report',
        enum: ['error', 'warning', 'all'],
        default: 'all',
      },
      ruleCategory: {
        type: 'string',
        description: 'Filter by rule category',
        enum: ['possible-errors', 'best-practices', 'stylistic', 'es6', 'all'],
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
      // Pagination for large files
      limit: {
        type: 'number',
        description: 'Maximum number of issues to show',
        default: 100,
        minimum: 1,
        maximum: 1000,
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination',
        default: 0,
        minimum: 0,
      },
    },
    oneOf: [{ required: ['code'] }, { required: ['filePath'] }],
  },
};

/**
 * Categorizes ESLint rules
 * @param {string} ruleId - ESLint rule ID
 * @returns {string} Rule category
 */
function categorizeRule(ruleId) {
  const categories = {
    'possible-errors': [
      'no-console',
      'no-debugger',
      'no-dupe-args',
      'no-dupe-keys',
      'no-duplicate-case',
      'no-empty',
      'no-ex-assign',
      'no-extra-boolean-cast',
      'no-extra-parens',
      'no-extra-semi',
      'no-func-assign',
      'no-inner-declarations',
      'no-invalid-regexp',
      'no-irregular-whitespace',
      'no-obj-calls',
      'no-regex-spaces',
      'no-sparse-arrays',
      'no-unexpected-multiline',
      'no-unreachable',
      'no-unsafe-finally',
      'use-isnan',
      'valid-typeof',
    ],
    'best-practices': [
      'accessor-pairs',
      'array-callback-return',
      'block-scoped-var',
      'complexity',
      'consistent-return',
      'curly',
      'default-case',
      'dot-location',
      'dot-notation',
      'eqeqeq',
      'guard-for-in',
      'no-alert',
      'no-caller',
      'no-case-declarations',
      'no-div-regex',
      'no-else-return',
      'no-empty-function',
      'no-empty-pattern',
      'no-eq-null',
      'no-eval',
      'no-extend-native',
      'no-extra-bind',
      'no-extra-label',
      'no-fallthrough',
      'no-floating-decimal',
      'no-global-assign',
      'no-implicit-coercion',
      'no-implicit-globals',
      'no-implied-eval',
      'no-invalid-this',
      'no-iterator',
      'no-labels',
      'no-lone-blocks',
      'no-loop-func',
      'no-magic-numbers',
      'no-multi-spaces',
      'no-multi-str',
      'no-new',
      'no-new-func',
      'no-new-wrappers',
      'no-octal',
      'no-octal-escape',
      'no-param-reassign',
      'no-proto',
      'no-redeclare',
      'no-restricted-properties',
      'no-return-assign',
      'no-return-await',
      'no-script-url',
      'no-self-assign',
      'no-self-compare',
      'no-sequences',
      'no-throw-literal',
      'no-unmodified-loop-condition',
      'no-unused-expressions',
      'no-unused-labels',
      'no-useless-call',
      'no-useless-concat',
      'no-useless-escape',
      'no-useless-return',
      'no-void',
      'no-warning-comments',
      'no-with',
      'prefer-promise-reject-errors',
      'radix',
      'require-await',
      'vars-on-top',
      'wrap-iife',
      'yoda',
    ],
    stylistic: [
      'array-bracket-newline',
      'array-bracket-spacing',
      'array-element-newline',
      'block-spacing',
      'brace-style',
      'camelcase',
      'capitalized-comments',
      'comma-dangle',
      'comma-spacing',
      'comma-style',
      'computed-property-spacing',
      'consistent-this',
      'eol-last',
      'func-call-spacing',
      'func-name-matching',
      'func-names',
      'func-style',
      'function-paren-newline',
      'id-blacklist',
      'id-length',
      'id-match',
      'indent',
      'jsx-quotes',
      'key-spacing',
      'keyword-spacing',
      'line-comment-position',
      'linebreak-style',
      'lines-around-comment',
      'lines-between-class-members',
      'max-depth',
      'max-len',
      'max-lines',
      'max-lines-per-function',
      'max-nested-callbacks',
      'max-params',
      'max-statements',
      'max-statements-per-line',
      'multiline-comment-style',
      'multiline-ternary',
      'new-cap',
      'new-parens',
      'newline-per-chained-call',
      'no-array-constructor',
      'no-bitwise',
      'no-continue',
      'no-inline-comments',
      'no-lonely-if',
      'no-mixed-operators',
      'no-mixed-spaces-and-tabs',
      'no-multi-assign',
      'no-multiple-empty-lines',
      'no-negated-condition',
      'no-nested-ternary',
      'no-new-object',
      'no-plusplus',
      'no-restricted-syntax',
      'no-tabs',
      'no-ternary',
      'no-trailing-spaces',
      'no-underscore-dangle',
      'no-unneeded-ternary',
      'no-whitespace-before-property',
      'nonblock-statement-body-position',
      'object-curly-newline',
      'object-curly-spacing',
      'object-property-newline',
      'one-var',
      'one-var-declaration-per-line',
      'operator-assignment',
      'operator-linebreak',
      'padded-blocks',
      'padding-line-between-statements',
      'prefer-object-spread',
      'quote-props',
      'quotes',
      'require-jsdoc',
      'semi',
      'semi-spacing',
      'semi-style',
      'sort-keys',
      'sort-vars',
      'space-before-blocks',
      'space-before-function-paren',
      'space-in-parens',
      'space-infix-ops',
      'space-unary-ops',
      'spaced-comment',
      'switch-colon-spacing',
      'template-tag-spacing',
      'unicode-bom',
      'valid-jsdoc',
      'wrap-regex',
    ],
    es6: [
      'arrow-body-style',
      'arrow-parens',
      'arrow-spacing',
      'constructor-super',
      'generator-star-spacing',
      'no-class-assign',
      'no-confusing-arrow',
      'no-const-assign',
      'no-dupe-class-members',
      'no-duplicate-imports',
      'no-new-symbol',
      'no-restricted-imports',
      'no-this-before-super',
      'no-useless-computed-key',
      'no-useless-constructor',
      'no-useless-rename',
      'no-var',
      'object-shorthand',
      'prefer-arrow-callback',
      'prefer-const',
      'prefer-destructuring',
      'prefer-numeric-literals',
      'prefer-rest-params',
      'prefer-spread',
      'prefer-template',
      'require-yield',
      'rest-spread-spacing',
      'sort-imports',
      'symbol-description',
      'template-curly-spacing',
      'yield-star-spacing',
    ],
  };

  for (const [category, rules] of Object.entries(categories)) {
    if (rules.includes(ruleId)) {
      return category;
    }
  }

  return 'other';
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
 * Filters issues based on criteria
 * @param {Array} issues - ESLint issues
 * @param {Object} options - Filter options
 * @returns {Array} Filtered issues
 */
function filterIssues(issues, options) {
  let filtered = [...issues];

  // Filter by severity
  if (options.severity !== 'all') {
    const severityLevel = options.severity === 'error' ? 2 : 1;
    filtered = filtered.filter((issue) => issue.severity >= severityLevel);
  }

  // Filter by rule category
  if (options.ruleCategory !== 'all') {
    filtered = filtered.filter((issue) => categorizeRule(issue.ruleId) === options.ruleCategory);
  }

  // Apply pagination
  const start = options.offset || 0;
  const end = start + (options.limit || 100);

  return {
    issues: filtered.slice(start, end),
    total: filtered.length,
    hasMore: end < filtered.length,
  };
}

/**
 * Formats ESLint results for output
 * @param {Array} results - ESLint results
 * @param {Object} options - Formatting options
 * @returns {string} Formatted output
 */
function formatResults(results, options) {
  let output = '# ESLint Auto-Fix Results\n\n';

  if (results.length === 0) {
    output += '✅ **No files processed**\n\n';
    return output;
  }

  const result = results[0]; // Single file result
  const {
    messages,
    output: fixedCode,
    errorCount,
    warningCount,
    fixableErrorCount,
    fixableWarningCount,
  } = result;

  // Summary
  output += '## Summary\n';
  output += `- **File**: ${result.filePath || 'inline code'}\n`;
  output += `- **Total Issues**: ${errorCount + warningCount}\n`;
  output += `- **Errors**: ${errorCount}\n`;
  output += `- **Warnings**: ${warningCount}\n`;
  output += `- **Auto-fixable**: ${fixableErrorCount + fixableWarningCount}\n\n`;

  // Show fixed code if requested and fixes were applied
  if (options.showFixed && fixedCode && (fixableErrorCount > 0 || fixableWarningCount > 0)) {
    output += '## ✅ Fixed Code\n\n';
    output += '```javascript\n';
    output += fixedCode;
    output += '\n```\n\n';
  }

  // Filter and show remaining issues
  if (options.showRemaining && messages.length > 0) {
    const filteredResult = filterIssues(messages, options);

    if (filteredResult.issues.length > 0) {
      output += '## 🔍 Remaining Issues\n\n';
      output += `Showing ${filteredResult.issues.length} of ${filteredResult.total} issues`;

      if (filteredResult.hasMore) {
        output += ` (use offset=${(options.offset || 0) + (options.limit || 100)} for more)`;
      }
      output += '\n\n';

      // Group issues by severity
      const errorIssues = filteredResult.issues.filter((issue) => issue.severity === 2);
      const warningIssues = filteredResult.issues.filter((issue) => issue.severity === 1);

      if (errorIssues.length > 0) {
        output += '### 🔴 Errors\n\n';
        for (const issue of errorIssues) {
          output += `**Line ${issue.line}:${issue.column}** - \`${issue.ruleId}\`\n`;
          output += `${issue.message}\n`;
          if (issue.fix) {
            output += `*Auto-fixable*\n`;
          }
          output += '\n';
        }
      }

      if (warningIssues.length > 0) {
        output += '### 🟡 Warnings\n\n';
        for (const issue of warningIssues) {
          output += `**Line ${issue.line}:${issue.column}** - \`${issue.ruleId}\`\n`;
          output += `${issue.message}\n`;
          if (issue.fix) {
            output += `*Auto-fixable*\n`;
          }
          output += '\n';
        }
      }
    } else {
      output += '## ✅ All Issues Fixed!\n\n';
      output += 'No remaining linting issues found.\n\n';
    }
  }

  // Recommendations
  output += '## 📋 Recommendations\n\n';

  if (errorCount > 0) {
    output += '- **Fix Errors First**: Address all errors before warnings\n';
  }

  if (fixableErrorCount > 0 || fixableWarningCount > 0) {
    output += '- **Auto-fixable Issues**: Run with `autoFix: true` to automatically fix these\n';
  }

  if (options.production) {
    output += '- **Production Mode**: Using stricter rules for production code\n';
  } else {
    output += '- **Development Mode**: Consider using `production: true` for stricter checking\n';
  }

  output += '- **IDE Integration**: Configure your editor to run ESLint on save\n';
  output += '- **Pre-commit Hooks**: Add ESLint to your git pre-commit hooks\n';

  return output;
}

/**
 * Main ESLint auto-fixer function
 * @param {Object} args - Tool arguments
 * @returns {Promise<Object>} ESLint results
 */
async function runEslintAutoFixer(args) {
  const {
    code,
    filePath,
    filename,
    production = false,
    autoFix = true,
    writeToFile = false,
    severity = 'all',
    ruleCategory = 'all',
    showFixed = true,
    showRemaining = true,
    limit = 100,
    offset = 0,
  } = args;

  try {
    // Get code content
    let sourceCode;
    let targetFilePath;

    if (filePath) {
      sourceCode = await readFileContent(filePath);
      targetFilePath = filePath;
    } else if (code) {
      // Validate code input
      const validation = validateCode(code);
      if (!validation.valid) {
        return validation.error;
      }
      sourceCode = code;
      targetFilePath = sanitizeFilename(filename) || 'inline.js';
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

    // Create ESLint instance
    const config = production ? productionEslintConfig : eslintConfig;
    const eslint = new ESLint({
      ...config,
      fix: autoFix,
    });

    // Run ESLint
    const lintPromise = eslint.lintText(sourceCode, {
      filePath: targetFilePath,
    });

    const results = await withTimeout(lintPromise, LINT_TIMEOUT_MS);

    // Write fixed code back to file if requested
    if (writeToFile && filePath && autoFix && results[0].output) {
      await writeFileContent(filePath, results[0].output);
    }

    // Format output
    const output = formatResults(results, {
      showFixed,
      showRemaining,
      severity,
      ruleCategory,
      limit,
      offset,
      production,
    });

    // Prepare response
    const result = results[0];
    const response = {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      summary: {
        filePath: targetFilePath,
        totalIssues: result.errorCount + result.warningCount,
        errors: result.errorCount,
        warnings: result.warningCount,
        fixableErrors: result.fixableErrorCount,
        fixableWarnings: result.fixableWarningCount,
        autoFixed: autoFix && (result.fixableErrorCount > 0 || result.fixableWarningCount > 0),
        writtenToFile: writeToFile && filePath && autoFix && result.output,
      },
    };

    // Include fixed code in response if available
    if (result.output) {
      response.fixedCode = result.output;
    }

    // Include remaining issues
    if (result.messages.length > 0) {
      const filteredResult = filterIssues(result.messages, {
        severity,
        ruleCategory,
        limit,
        offset,
      });
      response.remainingIssues = filteredResult.issues;
      response.totalRemainingIssues = filteredResult.total;
      response.hasMoreIssues = filteredResult.hasMore;
    }

    return response;
  } catch (error) {
    let errorMessage = 'ESLint auto-fix failed';

    if (error.message.includes('Parsing error')) {
      errorMessage = 'JavaScript/TypeScript syntax error - fix syntax before linting';
    } else if (error.message.includes('ENOENT')) {
      errorMessage = 'File not found - check the file path';
    } else if (error.message.includes('EACCES')) {
      errorMessage = 'Permission denied - check file permissions';
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
export { runEslintAutoFixer };
