import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import {
  validateGoCode,
  sanitizeGoFilename,
  validateGoToolOptions,
  mapGoSeverity,
} from '../utils/go-validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for go_code_analyzer
 */
export const goCodeAnalyzerTool = {
  name: 'go_code_analyzer',
  description:
    'Analyzes Go code for best practices, style issues, potential bugs, and security vulnerabilities using go vet, staticcheck, and other Go tools.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Go code to analyze (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., \'main.go\')',
      },
      goVersion: {
        type: 'string',
        description: 'Go version to target',
        enum: ['1.19', '1.20', '1.21', '1.22', '1.23'],
        default: '1.21',
      },
      // Tool selection
      tools: {
        type: 'array',
        description: 'Analysis tools to run',
        items: {
          type: 'string',
          enum: ['vet', 'staticcheck', 'gosec', 'ineffassign', 'misspell'],
        },
        default: ['vet', 'staticcheck'],
      },
      buildTags: {
        type: 'array',
        description: 'Build tags to consider',
        items: { type: 'string' },
        default: [],
      },
      // Pagination
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return',
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
      // Filtering
      severity: {
        type: 'string',
        description: 'Filter by severity',
        enum: ['error', 'warning', 'info', 'all'],
        default: 'all',
      },
      category: {
        type: 'string',
        description: 'Filter by category',
        enum: ['correctness', 'style', 'performance', 'security', 'complexity', 'all'],
        default: 'all',
      },
      // Sorting
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['line', 'severity', 'tool', 'message'],
        default: 'line',
      },
      sortOrder: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'asc',
      },
    },
    required: ['code'],
  },
};

/**
 * Maps Go tool names to categories
 * @param {string} tool - Go tool name
 * @param {string} message - Issue message
 * @returns {string} Category
 */
function getIssueCategory(tool, message) {
  if (!tool) {return 'other';}

  const toolCategories = {
    vet: 'correctness',
    staticcheck: 'correctness',
    gosec: 'security',
    ineffassign: 'performance',
    misspell: 'style',
    gofmt: 'style',
    goimports: 'style',
  };

  // Check message content for additional categorization
  const msgLower = message.toLowerCase();
  if (msgLower.includes('security') || msgLower.includes('vulnerability')) {
    return 'security';
  }
  if (msgLower.includes('performance') || msgLower.includes('inefficient')) {
    return 'performance';
  }
  if (msgLower.includes('complexity') || msgLower.includes('cyclomatic')) {
    return 'complexity';
  }
  if (msgLower.includes('style') || msgLower.includes('format')) {
    return 'style';
  }

  return toolCategories[tool] || 'correctness';
}

/**
 * Parses go vet output
 * @param {string} output - Raw go vet output
 * @returns {Array} Parsed issues
 */
function parseGoVetOutput(output) {
  const issues = [];
  const lines = output.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    // Format: filename:line:column: message
    const match = line.match(/^([^:]+):(\d+):(?:(\d+):)?\s*(.+)$/);
    if (match) {
      const [, file, lineNum, column, message] = match;

      issues.push({
        tool: 'vet',
        severity: 'warning',
        category: getIssueCategory('vet', message),
        line: parseInt(lineNum, 10),
        column: column ? parseInt(column, 10) : 1,
        message: message.trim(),
        code: 'vet',
        file: file,
      });
    }
  }

  return issues;
}

/**
 * Parses staticcheck output
 * @param {string} output - Raw staticcheck output
 * @returns {Array} Parsed issues
 */
function parseStaticcheckOutput(output) {
  const issues = [];
  const lines = output.split('\n').filter((line) => line.trim());

  for (const line of lines) {
    // Format: filename:line:column: code: message
    const match = line.match(/^([^:]+):(\d+):(\d+):\s*([A-Z]+\d+):\s*(.+)$/);
    if (match) {
      const [, file, lineNum, column, code, message] = match;

      // Determine severity based on staticcheck code
      let severity = 'warning';
      if (code.startsWith('SA')) {severity = 'error';} // Static analysis errors
      if (code.startsWith('S1')) {severity = 'info';} // Style suggestions

      issues.push({
        tool: 'staticcheck',
        severity,
        category: getIssueCategory('staticcheck', message),
        line: parseInt(lineNum, 10),
        column: parseInt(column, 10),
        message: message.trim(),
        code,
        file,
      });
    }
  }

  return issues;
}

/**
 * Parses gosec output (JSON format)
 * @param {string} output - Raw gosec JSON output
 * @param {string} filename - Source filename for fallback
 * @returns {Array} Parsed issues
 */
function parseGosecOutput(output, filename) {
  const issues = [];

  try {
    const data = JSON.parse(output);
    if (data.Issues) {
      for (const issue of data.Issues) {
        issues.push({
          tool: 'gosec',
          severity: mapGoSeverity(issue.severity || 'medium'),
          category: 'security',
          line: parseInt(issue.line, 10),
          column: parseInt(issue.column, 10) || 1,
          message: issue.details || 'Security issue detected',
          code: issue.rule_id || 'gosec',
          file: issue.file || filename,
        });
      }
    }
  } catch (error) {
    // Fallback to text parsing if JSON parsing fails
    const lines = output.split('\n').filter((line) => line.trim());
    for (const line of lines) {
      if (line.includes('[') && line.includes(']')) {
        const match = line.match(/\[([^\]]+)\]\s*([^:]+):(\d+):\s*(.+)/);
        if (match) {
          const [, severity, file, lineNum, message] = match;
          issues.push({
            tool: 'gosec',
            severity: mapGoSeverity(severity),
            category: 'security',
            line: parseInt(lineNum, 10),
            column: 1,
            message: message.trim(),
            code: 'gosec',
            file,
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Runs a Go analysis tool
 * @param {string} tool - Tool name
 * @param {string} projectPath - Path to the temporary project
 * @param {string} filename - Go filename
 * @param {Array} buildTags - Build tags
 * @returns {Promise<string>} Tool output
 */
async function runGoTool(tool, projectPath, filename, buildTags = []) {
  return new Promise((resolve, reject) => {
    let args = [];
    let command = '';

    switch (tool) {
      case 'vet':
        command = 'go';
        args = ['vet'];
        if (buildTags.length > 0) {
          args.push('-tags', buildTags.join(','));
        }
        args.push('./...');
        break;

      case 'staticcheck':
        command = 'staticcheck';
        args = ['./...'];
        if (buildTags.length > 0) {
          args.push('-tags', buildTags.join(','));
        }
        break;

      case 'gosec':
        command = 'gosec';
        args = ['-fmt', 'json', './...'];
        break;

      case 'ineffassign':
        command = 'ineffassign';
        args = ['./...'];
        break;

      case 'misspell':
        command = 'misspell';
        args = ['.'];
        break;

      default:
        reject(new Error(`Unknown tool: ${tool}`));
        return;
    }

    const process = spawn(command, args, {
      cwd: projectPath,
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
      // Many Go tools return non-zero exit codes when issues are found
      resolve(stdout || stderr);
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Creates a minimal Go module structure
 * @param {string} projectPath - Project directory path
 * @param {string} code - Go code to write
 * @param {string} filename - Go filename
 * @param {string} goVersion - Go version
 */
async function createGoModule(projectPath, code, filename, goVersion) {
  // Create go.mod
  const moduleName = 'temp-analysis';
  const goMod = `module ${moduleName}\n\ngo ${goVersion}\n`;
  await writeFile(join(projectPath, 'go.mod'), goMod, 'utf8');

  // Write the Go code
  await writeFile(join(projectPath, filename), code, 'utf8');
}

/**
 * Filters and sorts issues based on options
 * @param {Array} issues - Raw issues
 * @param {Object} options - Filter and sort options
 * @returns {Array} Filtered and sorted issues
 */
function filterAndSortIssues(issues, options) {
  let filtered = [...issues];

  // Filter by severity
  if (options.severity !== 'all') {
    filtered = filtered.filter((issue) => issue.severity === options.severity);
  }

  // Filter by category
  if (options.category !== 'all') {
    filtered = filtered.filter((issue) => issue.category === options.category);
  }

  // Sort issues
  filtered.sort((a, b) => {
    let aVal, bVal;

    switch (options.sortBy) {
      case 'line':
        aVal = a.line;
        bVal = b.line;
        break;
      case 'severity':
        const severityOrder = { error: 3, warning: 2, info: 1 };
        aVal = severityOrder[a.severity] || 0;
        bVal = severityOrder[b.severity] || 0;
        break;
      case 'tool':
        aVal = a.tool;
        bVal = b.tool;
        break;
      case 'message':
        aVal = a.message;
        bVal = b.message;
        break;
      default:
        aVal = a.line;
        bVal = b.line;
    }

    if (options.sortOrder === 'desc') {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    } else {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    }
  });

  // Apply pagination
  const start = options.offset || 0;
  const end = start + (options.limit || 50);

  return {
    issues: filtered.slice(start, end),
    total: filtered.length,
    hasMore: end < filtered.length,
  };
}

/**
 * Main analysis function
 * @param {Object} args - Analysis arguments
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeGoCode(args) {
  const {
    code,
    filename = 'main.go',
    goVersion = '1.21',
    tools = ['vet', 'staticcheck'],
    buildTags = [],
    limit = 50,
    offset = 0,
    severity = 'all',
    category = 'all',
    sortBy = 'line',
    sortOrder = 'asc',
  } = args;

  // Validate input
  const validation = validateGoCode(code);
  if (!validation.valid) {
    return validation.error;
  }

  const safeFilename = sanitizeGoFilename(filename);
  const options = validateGoToolOptions({
    goVersion,
    buildTags,
  });

  // Create temporary directory
  const tempId = randomBytes(8).toString('hex');
  const tempDir = join(tmpdir(), `go-analysis-${tempId}`);

  try {
    await mkdir(tempDir, { recursive: true });

    // Create Go module structure
    await createGoModule(tempDir, code, safeFilename, options.goVersion);

    // Run analysis tools
    const allIssues = [];
    const toolResults = {};

    for (const tool of tools) {
      try {
        const output = await withTimeout(
          runGoTool(tool, tempDir, safeFilename, options.buildTags),
          LINT_TIMEOUT_MS,
        );

        let issues = [];
        switch (tool) {
          case 'vet':
            issues = parseGoVetOutput(output);
            break;
          case 'staticcheck':
            issues = parseStaticcheckOutput(output);
            break;
          case 'gosec':
            issues = parseGosecOutput(output, safeFilename);
            break;
          default:
          // Generic parser for other tools
            issues = parseGoVetOutput(output);
        }

        allIssues.push(...issues);
        toolResults[tool] = {
          success: true,
          issueCount: issues.length,
        };
      } catch (error) {
        toolResults[tool] = {
          success: false,
          error: error.message,
        };
      }
    }

    // Filter and sort results
    const result = filterAndSortIssues(allIssues, {
      severity,
      category,
      sortBy,
      sortOrder,
      limit,
      offset,
    });

    // Generate summary
    const summary = {
      totalIssues: result.total,
      issuesShown: result.issues.length,
      hasMore: result.hasMore,
      toolResults,
      severityBreakdown: {},
      categoryBreakdown: {},
    };

    // Calculate breakdowns
    for (const issue of allIssues) {
      summary.severityBreakdown[issue.severity] =
        (summary.severityBreakdown[issue.severity] || 0) + 1;
      summary.categoryBreakdown[issue.category] =
        (summary.categoryBreakdown[issue.category] || 0) + 1;
    }

    // Format output
    let output = '# Go Code Analysis Results\n\n';
    output += `**File**: ${safeFilename}\n`;
    output += `**Go Version**: ${options.goVersion}\n`;
    output += `**Tools**: ${tools.join(', ')}\n\n`;

    if (options.buildTags.length > 0) {
      output += `**Build Tags**: ${options.buildTags.join(', ')}\n\n`;
    }

    output += '## Summary\n';
    output += `- **Total Issues**: ${summary.totalIssues}\n`;
    output += `- **Showing**: ${summary.issuesShown} (offset: ${offset})\n`;

    if (summary.hasMore) {
      output += `- **More Available**: Yes (use offset=${offset + limit})\n`;
    }

    output += '\n### Severity Breakdown\n';
    for (const [sev, count] of Object.entries(summary.severityBreakdown)) {
      const icon = sev === 'error' ? '🔴' : sev === 'warning' ? '🟡' : '🔵';
      output += `- ${icon} **${sev}**: ${count}\n`;
    }

    output += '\n### Category Breakdown\n';
    for (const [cat, count] of Object.entries(summary.categoryBreakdown)) {
      output += `- **${cat}**: ${count}\n`;
    }

    output += '\n### Tool Results\n';
    for (const [tool, result] of Object.entries(toolResults)) {
      const status = result.success ? '✅' : '❌';
      output += `- ${status} **${tool}**: `;
      if (result.success) {
        output += `${result.issueCount} issues found\n`;
      } else {
        output += `Failed - ${result.error}\n`;
      }
    }

    if (result.issues.length > 0) {
      output += '\n## Issues Found\n\n';

      for (const issue of result.issues) {
        const severityIcon =
          issue.severity === 'error' ? '🔴' : issue.severity === 'warning' ? '🟡' : '🔵';

        output += `### ${severityIcon} Line ${issue.line}:${issue.column} - ${issue.tool}\n`;
        output += `**Category**: ${issue.category}\n`;
        output += `**Code**: ${issue.code}\n`;
        output += `**Message**: ${issue.message}\n\n`;
      }
    } else {
      output += '\n## ✅ No Issues Found\n\n';
      output += 'Great! Your Go code looks clean according to the selected analysis tools.\n\n';
    }

    // Add recommendations
    output += '## 📋 Recommendations\n\n';
    if (summary.totalIssues > 0) {
      output += '- Address high-severity issues first (errors, then warnings)\n';
      output += '- Consider running `go fmt` to fix formatting issues\n';
      output += '- Use `go mod tidy` to clean up dependencies\n';
      if (summary.categoryBreakdown.security > 0) {
        output += '- Review security issues carefully - they may indicate vulnerabilities\n';
      }
    } else {
      output += '- Consider adding more analysis tools like `golangci-lint` for comprehensive checking\n';
      output += '- Run tests with `go test -race` to check for race conditions\n';
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      summary,
      issues: result.issues,
    };
  } catch (error) {
    let errorMessage = 'Go analysis failed';

    if (error.message.includes('go: command not found')) {
      errorMessage = 'Go is not installed or not in PATH. Please install Go.';
    } else if (error.message.includes('staticcheck: command not found')) {
      errorMessage =
        'staticcheck is not installed. Run: go install honnef.co/go/tools/cmd/staticcheck@latest';
    } else if (error.message.includes('gosec: command not found')) {
      errorMessage =
        'gosec is not installed. Run: go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest';
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
    // Cleanup
    try {
      await unlink(join(tempDir, safeFilename));
      await unlink(join(tempDir, 'go.mod'));
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}

// Export the main function
export { analyzeGoCode };
