// Production-ready ESLint configuration with stricter rules
import unicornPlugin from 'eslint-plugin-unicorn';

export const productionEslintConfig = {
  overrideConfigFile: true,
  overrideConfig: {
    plugins: {
      unicorn: unicornPlugin,
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        fetch: 'readonly',
        // Note: console removed from globals for production
      },
    },
    rules: {
      // Error prevention (stricter)
      'no-unused-vars': 'error',
      'no-undef': 'error',
      'no-console': 'error', // Strict: no console statements in production
      'no-debugger': 'error',
      'no-alert': 'error',
      
      // Production readiness
      'no-warning-comments': ['error', {
        terms: ['todo', 'fixme', 'xxx', 'hack', 'bug', 'broken', 'unfinished'],
        location: 'anywhere',
      }],
      'no-unreachable': 'error',
      'no-empty': 'error',
      'no-empty-function': ['error', {
        allow: ['arrowFunctions', 'functions', 'methods'],
      }],
      
      // Best practices (stricter)
      'prefer-const': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['error', 'all'],
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'warn',
      'consistent-return': 'error',
      
      // Error handling requirements
      'no-throw-literal': 'error',
      'prefer-promise-reject-errors': 'error',
      
      // Code style (strict)
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      
      // Security and performance (strict)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-return-await': 'error',
      'no-script-url': 'error',
      
      // Documentation requirements (valid-jsdoc deprecated in ESLint v9)
      // Using stricter built-in rules instead
      
      // Code complexity
      'complexity': ['warn', 10],
      'max-depth': ['warn', 4],
      'max-lines-per-function': ['warn', {
        max: 60,
        skipBlankLines: true,
        skipComments: true,
      }],
      
      // Import/export validation
      'no-duplicate-imports': 'error',
      'no-useless-rename': 'error',
      
      // Async/await best practices
      'require-await': 'error',
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      
      // Prevent common mistakes
      'no-implicit-coercion': 'error',
      'no-magic-numbers': ['warn', {
        ignore: [-1, 0, 1, 2],
        ignoreArrayIndexes: true,
        enforceConst: true,
      }],
      'no-nested-ternary': 'error',
      'no-unneeded-ternary': 'error',
      
      // Unicorn plugin rules for production readiness
      'unicorn/expiring-todo-comments': 'error',
      'unicorn/no-abusive-eslint-disable': 'error',
      'unicorn/no-console-spaces': 'error',
      'unicorn/prefer-type-error': 'error',
    },
  },
};