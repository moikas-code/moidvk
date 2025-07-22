import { spawn } from 'child_process';
import { writeFile, unlink, readFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { validateGoCode, sanitizeGoFilename, detectGoVersion } from '../utils/go-validation.js';
import { withTimeout, FORMAT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for go_formatter
 */
export const goFormatterTool = {
  name: 'go_formatter',
  description:
    'Formats Go code using gofmt and goimports. Can organize imports, fix formatting, and check without modifying.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Go code to format (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename to provide context (e.g., \'main.go\')',
      },
      check: {
        type: 'boolean',
        description:
          'If true, only checks if formatting is needed without returning formatted code',
        default: false,
      },
      tool: {
        type: 'string',
        description: 'Formatting tool to use',
        enum: ['gofmt', 'goimports', 'gofumpt'],
        default: 'goimports',
      },
      // gofmt options
      simplify: {
        type: 'boolean',
        description: 'Apply simplification rules (gofmt -s)',
        default: true,
      },
      tabWidth: {
        type: 'number',
        description: 'Tab width for formatting',
        default: 8,
        minimum: 1,
        maximum: 16,
      },
      // goimports options
      local: {
        type: 'string',
        description: 'Local import prefix for goimports',
      },
      // Module context
      modulePath: {
        type: 'string',
        description: 'Go module path for import resolution',
      },
      goVersion: {
        type: 'string',
        description: 'Go version to target',
        enum: ['1.19', '1.20', '1.21', '1.22', '1.23'],
        default: '1.21',
      },
    },
    required: ['code'],
  },
};

/**
 * Runs gofmt on Go code
 * @param {string} code - The Go code to format
 * @param {Object} options - Formatting options
 * @returns {Promise<Object>} Gofmt output
 */
async function runGofmt(code, options) {
  return new Promise((resolve, reject) => {
    const args = [];

    if (options.check) {
      args.push('-d'); // Show diff instead of rewriting
    }

    if (options.simplify) {
      args.push('-s'); // Apply simplification rules
    }

    if (options.tabWidth && options.tabWidth !== 8) {
      args.push('-tabwidth', options.tabWidth.toString());
    }

    const process = spawn('gofmt', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          formatted: stdout || options.code, // If no output, code was already formatted
          diff: options.check ? stdout : null,
          needsFormatting: options.check ? stdout.length > 0 : false,
        });
      } else {
        reject(new Error(`gofmt failed: ${stderr}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });

    // Send code to stdin
    process.stdin.write(code);
    process.stdin.end();
  });
}

/**
 * Runs goimports on Go code
 * @param {string} code - The Go code to format
 * @param {string} tempDir - Temporary directory path
 * @param {string} filename - Go filename
 * @param {Object} options - Formatting options
 * @returns {Promise<Object>} Goimports output
 */
async function runGoimports(code, tempDir, filename, options) {
  const tempFile = join(tempDir, filename);

  try {
    // Write code to temporary file (goimports works better with files)
    await writeFile(tempFile, code, 'utf8');

    return new Promise((resolve, reject) => {
      const args = [];

      if (options.check) {
        args.push('-d'); // Show diff
      } else {
        args.push('-w'); // Write result to file
      }

      if (options.local) {
        args.push('-local', options.local);
      }

      args.push(tempFile);

      const process = spawn('goimports', args, {
        cwd: tempDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/go/bin` },
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', async (code) => {
        if (code === 0) {
          let formatted = code;
          let needsFormatting = false;

          if (options.check) {
            // In check mode, stdout contains the diff
            needsFormatting = stdout.length > 0;
            formatted = code; // Keep original
          } else {
            // Read the formatted file
            try {
              formatted = await readFile(tempFile, 'utf8');
              needsFormatting = formatted !== code;
            } catch {
              formatted = code;
            }
          }

          resolve({
            success: true,
            formatted,
            diff: options.check ? stdout : null,
            needsFormatting,
          });
        } else {
          reject(new Error(`goimports failed: ${stderr}`));
        }
      });

      process.on('error', (error) => {
        reject(error);
      });
    });
  } finally {
    // Cleanup will be handled by the main function
  }
}

/**
 * Runs gofumpt on Go code (if available)
 * @param {string} code - The Go code to format
 * @param {Object} options - Formatting options
 * @returns {Promise<Object>} Gofumpt output
 */
async function runGofumpt(code, options) {
  return new Promise((resolve, reject) => {
    const args = [];

    if (options.check) {
      args.push('-d'); // Show diff
    }

    const process = spawn('gofumpt', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PATH: `${process.env.PATH}:${process.env.HOME}/go/bin` },
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          formatted: stdout || options.code,
          diff: options.check ? stdout : null,
          needsFormatting: options.check ? stdout.length > 0 : false,
        });
      } else {
        reject(new Error(`gofumpt failed: ${stderr}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });

    // Send code to stdin
    process.stdin.write(code);
    process.stdin.end();
  });
}

/**
 * Creates a minimal Go module for import resolution
 * @param {string} tempDir - Temporary directory
 * @param {string} modulePath - Module path
 * @param {string} goVersion - Go version
 */
async function createGoModule(tempDir, modulePath, goVersion) {
  const modPath = modulePath || 'temp-format';
  const goMod = `module ${modPath}\n\ngo ${goVersion}\n`;
  await writeFile(join(tempDir, 'go.mod'), goMod, 'utf8');
}

/**
 * Main formatting function
 * @param {Object} args - Formatting arguments
 * @returns {Promise<Object>} Formatting results
 */
async function formatGoCode(args) {
  const {
    code,
    filename = 'main.go',
    check = false,
    tool = 'goimports',
    simplify = true,
    tabWidth = 8,
    local,
    modulePath,
    goVersion = '1.21',
  } = args;

  // Validate input
  const validation = validateGoCode(code);
  if (!validation.valid) {
    return validation.error;
  }

  const safeFilename = sanitizeGoFilename(filename);
  const detectedVersion = detectGoVersion(code) || goVersion;

  // Create temporary directory for goimports (needs file context)
  const tempId = randomBytes(8).toString('hex');
  const tempDir = join(tmpdir(), `go-format-${tempId}`);

  try {
    if (tool === 'goimports') {
      await mkdir(tempDir, { recursive: true });
      await createGoModule(tempDir, modulePath, detectedVersion);
    }

    let result;

    // Run the selected formatting tool
    switch (tool) {
      case 'gofmt':
        result = await withTimeout(
          runGofmt(code, { check, simplify, tabWidth, code }),
          FORMAT_TIMEOUT_MS,
        );
        break;

      case 'goimports':
        result = await withTimeout(
          runGoimports(code, tempDir, safeFilename, { check, local }),
          FORMAT_TIMEOUT_MS,
        );
        break;

      case 'gofumpt':
        result = await withTimeout(runGofumpt(code, { check, code }), FORMAT_TIMEOUT_MS);
        break;

      default:
        throw new Error(`Unknown formatting tool: ${tool}`);
    }

    // Generate output
    let output = '# Go Code Formatting Results\n\n';
    output += `**File**: ${safeFilename}\n`;
    output += `**Tool**: ${tool}\n`;
    output += `**Go Version**: ${detectedVersion}\n\n`;

    if (check) {
      output += '## Format Check\n\n';
      if (result.needsFormatting) {
        output += '❌ **Code needs formatting**\n\n';
        if (result.diff) {
          output += `### Diff:\n\`\`\`diff\n${result.diff}\n\`\`\`\n\n`;
        }
      } else {
        output += '✅ **Code is already properly formatted**\n\n';
      }
    } else {
      output += '## Formatted Code\n\n';
      if (result.formatted === code) {
        output += '✅ **No changes needed** - code was already properly formatted.\n\n';
      } else {
        output += '✅ **Code has been formatted**\n\n';
        output += `\`\`\`go\n${result.formatted}\n\`\`\`\n\n`;
      }
    }

    // Add tool-specific recommendations
    output += '## 📋 Recommendations\n\n';
    switch (tool) {
      case 'gofmt':
        output += '- Consider using `goimports` to also organize imports\n';
        output += '- Use `gofmt -s` to apply simplification rules\n';
        break;
      case 'goimports':
        output += '- `goimports` automatically formats code and organizes imports\n';
        output += '- Consider setting a `-local` prefix for your project imports\n';
        break;
      case 'gofumpt':
        output += '- `gofumpt` provides stricter formatting than `gofmt`\n';
        output += '- It enforces additional style rules for consistency\n';
        break;
    }

    if (local) {
      output += `- Local import prefix: \`${local}\`\n`;
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      formatted: result.formatted,
      needsFormatting: result.needsFormatting,
      tool,
      diff: result.diff,
    };
  } catch (error) {
    let errorMessage = 'Go formatting failed';

    if (error.message.includes('gofmt: command not found')) {
      errorMessage = 'gofmt is not installed. Please install Go.';
    } else if (error.message.includes('goimports: command not found')) {
      errorMessage =
        'goimports is not installed. Run: go install golang.org/x/tools/cmd/goimports@latest';
    } else if (error.message.includes('gofumpt: command not found')) {
      errorMessage = 'gofumpt is not installed. Run: go install mvdan.cc/gofumpt@latest';
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${errorMessage}\n\nDetails: ${error.message}`,
        },
      ],
    };
  } finally {
    // Cleanup temporary files
    if (tool === 'goimports') {
      try {
        await unlink(join(tempDir, safeFilename));
        await unlink(join(tempDir, 'go.mod'));
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}

// Export the main function
export { formatGoCode };
