import { exec } from 'child_process';
import { promisify } from 'util';
import { validatePythonCode, detectPythonVersion } from '../utils/python-validation.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Python Type Checker using mypy
 */
export const pythonTypeCheckerTool = {
  name: 'python_type_checker',
  description: 'Type checks Python code using mypy. Detects type errors, missing type hints, and type safety issues.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Python code to type check (max 100KB)'
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "main.py")'
      },
      pythonVersion: {
        type: 'string',
        enum: ['3.7', '3.8', '3.9', '3.10', '3.11', '3.12'],
        description: 'Python version for type checking (default: auto-detect)'
      },
      strict: {
        type: 'boolean',
        description: 'Enable strict mode (default: false)'
      },
      ignoreErrors: {
        type: 'array',
        items: { type: 'string' },
        description: 'Error codes to ignore (e.g., ["import", "name-defined"])'
      },
      followImports: {
        type: 'string',
        enum: ['normal', 'silent', 'skip', 'error'],
        description: 'How to handle imports (default: "skip")'
      },
      disallowUntyped: {
        type: 'boolean',
        description: 'Disallow untyped definitions (default: false)'
      },
      checkUntyped: {
        type: 'boolean',
        description: 'Check untyped function bodies (default: true)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of errors to return (default: 50)',
        minimum: 1,
        maximum: 500,
        default: 50
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination (default: 0)',
        minimum: 0,
        default: 0
      },
      severity: {
        type: 'string',
        enum: ['error', 'warning', 'note', 'all'],
        description: 'Filter by severity level',
        default: 'all'
      }
    },
    required: ['code']
  }
};

export async function handlePythonTypeChecker(args) {
  const startTime = Date.now();
  
  try {
    // Validate input
    const validation = validatePythonCode(args.code);
    if (!validation.isValid) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Invalid Python code: ${validation.error}`,
            executionTime: Date.now() - startTime
          }, null, 2)
        }]
      };
    }

    // Detect Python version if not specified
    const pythonVersion = args.pythonVersion || detectPythonVersion(args.code);
    
    // Check if mypy is available
    try {
      await execAsync('mypy --version', { timeout: 5000 });
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'mypy is not installed. Please install it with: pip install mypy',
            executionTime: Date.now() - startTime
          }, null, 2)
        }]
      };
    }

    // Create temporary file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mypy-'));
    const tempFile = path.join(tempDir, args.filename || 'temp.py');
    
    try {
      await fs.writeFile(tempFile, args.code, 'utf8');

      // Build mypy command
      const mypyArgs = [
        `--python-version=${pythonVersion}`,
        '--show-error-codes',
        '--show-column-numbers',
        '--show-error-context',
        '--no-error-summary',
        '--no-color-output'
      ];

      if (args.strict) {
        mypyArgs.push('--strict');
      } else {
        if (args.disallowUntyped) mypyArgs.push('--disallow-untyped-defs');
        if (args.checkUntyped !== false) mypyArgs.push('--check-untyped-defs');
      }

      if (args.followImports) {
        mypyArgs.push(`--follow-imports=${args.followImports}`);
      } else {
        mypyArgs.push('--follow-imports=skip');
      }

      if (args.ignoreErrors && args.ignoreErrors.length > 0) {
        args.ignoreErrors.forEach(code => {
          mypyArgs.push(`--disable-error-code=${code}`);
        });
      }

      const command = `mypy ${mypyArgs.join(' ')} "${tempFile}"`;
      
      // Run mypy
      let output = '';
      let errors = [];
      
      try {
        const result = await execAsync(command, {
          timeout: 30000,
          maxBuffer: 1024 * 1024 * 10 // 10MB
        });
        output = result.stdout;
      } catch (error) {
        // mypy returns non-zero exit code when it finds errors
        output = error.stdout || '';
      }

      // Parse mypy output
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        // Parse mypy output format: file.py:line:col: severity: message [error-code]
        const match = line.match(/^([^:]+):(\d+):(\d+):\s*(\w+):\s*(.+?)(?:\s*\[([^\]]+)\])?$/);
        
        if (match) {
          const [, file, lineNum, column, severity, message, errorCode] = match;
          
          // Apply severity filter
          if (args.severity !== 'all' && severity.toLowerCase() !== args.severity) {
            continue;
          }
          
          errors.push({
            line: parseInt(lineNum),
            column: parseInt(column),
            severity: severity.toLowerCase(),
            message: message.trim(),
            errorCode: errorCode || 'unknown',
            context: getLineContext(args.code, parseInt(lineNum))
          });
        }
      }

      // Sort errors by line number
      errors.sort((a, b) => a.line - b.line || a.column - b.column);

      // Apply pagination
      const totalErrors = errors.length;
      const paginatedErrors = errors.slice(args.offset, args.offset + args.limit);

      // Calculate type coverage
      const typeCoverage = calculateTypeCoverage(args.code);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            errors: paginatedErrors,
            totalErrors,
            pagination: {
              offset: args.offset,
              limit: args.limit,
              hasMore: args.offset + args.limit < totalErrors
            },
            metrics: {
              typeCoverage,
              pythonVersion,
              strict: args.strict || false,
              executionTime: Date.now() - startTime
            },
            summary: {
              errors: errors.filter(e => e.severity === 'error').length,
              warnings: errors.filter(e => e.severity === 'warning').length,
              notes: errors.filter(e => e.severity === 'note').length
            }
          }, null, 2)
        }]
      };

    } finally {
      // Cleanup
      await fs.rm(tempDir, { recursive: true, force: true });
    }

  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Type checking failed: ${error.message}`,
          executionTime: Date.now() - startTime
        }, null, 2)
      }]
    };
  }
}

function getLineContext(code, lineNumber, contextLines = 2) {
  const lines = code.split('\n');
  const startLine = Math.max(1, lineNumber - contextLines);
  const endLine = Math.min(lines.length, lineNumber + contextLines);
  
  const context = [];
  for (let i = startLine - 1; i < endLine; i++) {
    context.push({
      line: i + 1,
      text: lines[i] || '',
      isError: i + 1 === lineNumber
    });
  }
  
  return context;
}

function calculateTypeCoverage(code) {
  const lines = code.split('\n');
  let typedLines = 0;
  let totalLines = 0;
  
  const typePatterns = [
    /:\s*\w+/,           // Type hints
    /->\s*\w+/,          // Return type hints
    /:\s*[A-Z]\w*\[/,    // Generic types
    /:\s*Union\[/,       // Union types
    /:\s*Optional\[/,    // Optional types
    /:\s*List\[/,        // List types
    /:\s*Dict\[/,        // Dict types
    /:\s*Tuple\[/,       // Tuple types
    /:\s*Any\b/          // Any type
  ];
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    totalLines++;
    
    if (typePatterns.some(pattern => pattern.test(line))) {
      typedLines++;
    }
  }
  
  return totalLines > 0 ? Math.round((typedLines / totalLines) * 100) : 0;
}