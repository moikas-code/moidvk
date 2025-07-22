import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { validateGoCode, sanitizeGoFilename } from '../utils/go-validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for go_security_scanner
 */
export const goSecurityScannerTool = {
  name: 'go_security_scanner',
  description:
    'Scans Go code for security vulnerabilities using govulncheck and security-focused static analysis. Detects common security issues, vulnerable dependencies, and unsafe patterns.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Go code to scan for security issues (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "main.go")',
      },
      goMod: {
        type: 'string',
        description: 'Optional go.mod content for dependency analysis',
      },
      goSum: {
        type: 'string',
        description: 'Optional go.sum content for dependency verification',
      },
      // Security scan options
      tools: {
        type: 'array',
        description: 'Security tools to run',
        items: {
          type: 'string',
          enum: ['govulncheck', 'staticcheck-security', 'gosec-patterns', 'unsafe-analysis'],
        },
        default: ['govulncheck', 'staticcheck-security', 'unsafe-analysis'],
      },
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical', 'all'],
        description: 'Minimum severity level to report',
        default: 'all',
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'all'],
        description: 'Minimum confidence level to report',
        default: 'medium',
      },
      category: {
        type: 'string',
        enum: ['crypto', 'injection', 'memory', 'network', 'filesystem', 'all'],
        description: 'Filter by vulnerability category',
        default: 'all',
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
      // Sorting
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['severity', 'confidence', 'line', 'category'],
        default: 'severity',
      },
      sortOrder: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
    required: ['code'],
  },
};

/**
 * Security issue categories and patterns
 */
const SECURITY_PATTERNS = {
  crypto: {
    patterns: [/crypto\/md5|crypto\/sha1/, /math\/rand/, /crypto\/des/, /crypto\/rc4/],
    description: 'Cryptographic vulnerabilities',
  },
  injection: {
    patterns: [
      /exec\.Command|os\/exec/,
      /database\/sql.*Query/,
      /fmt\.Sprintf.*%s/,
      /template\.HTML/,
    ],
    description: 'Injection vulnerabilities',
  },
  memory: {
    patterns: [/unsafe\./, /reflect\.UnsafeAddr/, /syscall\.Syscall/],
    description: 'Memory safety issues',
  },
  network: {
    patterns: [/http\.DefaultTransport/, /tls\.Config.*InsecureSkipVerify/, /net\/http.*Client/],
    description: 'Network security issues',
  },
  filesystem: {
    patterns: [/os\.OpenFile/, /ioutil\.WriteFile/, /filepath\.Join/, /os\.Create/],
    description: 'File system security issues',
  },
};

/**
 * Runs govulncheck for dependency vulnerability scanning
 * @param {string} projectPath - Path to the Go project
 * @returns {Promise<Array>} Vulnerability findings
 */
async function runGovulncheck(projectPath) {
  return new Promise((resolve, reject) => {
    const process = spawn('govulncheck', ['-json', './...'], {
      cwd: projectPath,
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

    process.on('close', () => {
      try {
        const vulnerabilities = [];
        const lines = stdout.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.finding && data.finding.osv) {
              vulnerabilities.push({
                tool: 'govulncheck',
                severity: mapVulnerabilitySeverity(data.finding.osv.database_specific?.severity),
                confidence: 'high',
                category: 'dependency',
                vulnerability: data.finding.osv.id,
                package: data.finding.osv.affected?.[0]?.package?.name || 'unknown',
                summary: data.finding.osv.summary,
                details: data.finding.osv.details,
                references: data.finding.osv.references || [],
                line: 1,
                column: 1,
              });
            }
          } catch (parseError) {
            // Skip non-JSON lines
          }
        }

        resolve(vulnerabilities);
      } catch (error) {
        reject(new Error(`govulncheck parsing failed: ${error.message}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Runs security-focused static analysis
 * @param {string} code - Go code to analyze
 * @param {string} filename - Filename for context
 * @returns {Array} Security findings
 */
function runSecurityPatternAnalysis(code, filename) {
  const findings = [];
  const lines = code.split('\n');

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const [category, config] of Object.entries(SECURITY_PATTERNS)) {
      for (const pattern of config.patterns) {
        if (pattern.test(line)) {
          findings.push({
            tool: 'security-patterns',
            severity: getPatternSeverity(category, line),
            confidence: 'medium',
            category,
            line: lineNum + 1,
            column: line.search(pattern) + 1,
            message: `Potential ${category} security issue: ${getSecurityMessage(category, line)}`,
            code: `security-${category}`,
            file: filename,
            pattern: pattern.source,
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Runs unsafe code analysis
 * @param {string} code - Go code to analyze
 * @param {string} filename - Filename for context
 * @returns {Array} Unsafe code findings
 */
function runUnsafeAnalysis(code, filename) {
  const findings = [];
  const lines = code.split('\n');

  // Check for unsafe package usage
  if (/import\s+"unsafe"/.test(code)) {
    findings.push({
      tool: 'unsafe-analysis',
      severity: 'high',
      confidence: 'high',
      category: 'memory',
      line: code.split('\n').findIndex((line) => /import\s+"unsafe"/.test(line)) + 1,
      column: 1,
      message: 'Usage of unsafe package detected - requires careful review',
      code: 'unsafe-import',
      file: filename,
    });
  }

  // Check for specific unsafe operations
  const unsafePatterns = [
    { pattern: /unsafe\.Pointer/, message: 'Unsafe pointer conversion', severity: 'high' },
    { pattern: /unsafe\.Sizeof/, message: 'Unsafe size calculation', severity: 'medium' },
    { pattern: /unsafe\.Offsetof/, message: 'Unsafe offset calculation', severity: 'medium' },
    { pattern: /unsafe\.Alignof/, message: 'Unsafe alignment calculation', severity: 'low' },
  ];

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];

    for (const { pattern, message, severity } of unsafePatterns) {
      if (pattern.test(line)) {
        findings.push({
          tool: 'unsafe-analysis',
          severity,
          confidence: 'high',
          category: 'memory',
          line: lineNum + 1,
          column: line.search(pattern) + 1,
          message,
          code: 'unsafe-operation',
          file: filename,
        });
      }
    }
  }

  return findings;
}

/**
 * Maps vulnerability severity to standard levels
 * @param {string} severity - Original severity
 * @returns {string} Mapped severity
 */
function mapVulnerabilitySeverity(severity) {
  if (!severity) {return 'medium';}

  const severityMap = {
    CRITICAL: 'critical',
    HIGH: 'high',
    MODERATE: 'medium',
    MEDIUM: 'medium',
    LOW: 'low',
  };

  return severityMap[severity.toUpperCase()] || 'medium';
}

/**
 * Gets pattern-based severity
 * @param {string} category - Security category
 * @param {string} line - Code line for context
 * @returns {string} Severity level
 */
function getPatternSeverity(category, line) {
  const severityMap = {
    crypto: 'high',
    injection: 'critical',
    memory: 'high',
    network: 'medium',
    filesystem: 'medium',
  };

  // Increase severity for certain patterns
  if (category === 'crypto' && /md5|sha1|des|rc4/.test(line.toLowerCase())) {
    return 'critical';
  }

  if (category === 'injection' && /exec\.Command|database.*Query/.test(line)) {
    return 'critical';
  }

  return severityMap[category] || 'medium';
}

/**
 * Gets security message for pattern
 * @param {string} category - Security category
 * @returns {string} Security message
 */
function getSecurityMessage(category) {
  const messages = {
    crypto: 'Weak or deprecated cryptographic function detected',
    injection: 'Potential injection vulnerability - validate inputs',
    memory: 'Unsafe memory operation - review for memory safety',
    network: 'Insecure network configuration detected',
    filesystem: 'File operation may be vulnerable to path traversal',
  };

  return messages[category] || 'Security issue detected';
}

/**
 * Creates a Go module structure for security scanning
 * @param {string} projectPath - Project directory
 * @param {string} code - Go code
 * @param {string} filename - Go filename
 * @param {string} goMod - go.mod content
 * @param {string} goSum - go.sum content
 */
async function createSecurityProject(projectPath, code, filename, goMod, goSum) {
  // Create go.mod
  const moduleName = 'security-scan';
  const defaultGoMod = goMod || `module ${moduleName}\n\ngo 1.21\n`;
  await writeFile(join(projectPath, 'go.mod'), defaultGoMod, 'utf8');

  // Create go.sum if provided
  if (goSum) {
    await writeFile(join(projectPath, 'go.sum'), goSum, 'utf8');
  }

  // Write the Go code
  await writeFile(join(projectPath, filename), code, 'utf8');
}

/**
 * Filters and sorts security findings
 * @param {Array} findings - Raw security findings
 * @param {Object} options - Filter and sort options
 * @returns {Object} Filtered and sorted results
 */
function filterAndSortFindings(findings, options) {
  let filtered = [...findings];

  // Filter by severity
  if (options.severity !== 'all') {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    const minSeverity = severityOrder[options.severity] || 1;
    filtered = filtered.filter((f) => severityOrder[f.severity] >= minSeverity);
  }

  // Filter by confidence
  if (options.confidence !== 'all') {
    const confidenceOrder = { low: 1, medium: 2, high: 3 };
    const minConfidence = confidenceOrder[options.confidence] || 1;
    filtered = filtered.filter((f) => confidenceOrder[f.confidence] >= minConfidence);
  }

  // Filter by category
  if (options.category !== 'all') {
    filtered = filtered.filter((f) => f.category === options.category);
  }

  // Sort findings
  filtered.sort((a, b) => {
    let aVal, bVal;

    switch (options.sortBy) {
      case 'severity':
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        aVal = severityOrder[a.severity] || 0;
        bVal = severityOrder[b.severity] || 0;
        break;
      case 'confidence':
        const confidenceOrder = { low: 1, medium: 2, high: 3 };
        aVal = confidenceOrder[a.confidence] || 0;
        bVal = confidenceOrder[b.confidence] || 0;
        break;
      case 'line':
        aVal = a.line;
        bVal = b.line;
        break;
      case 'category':
        aVal = a.category;
        bVal = b.category;
        break;
      default:
        aVal = a.severity;
        bVal = b.severity;
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
    findings: filtered.slice(start, end),
    total: filtered.length,
    hasMore: end < filtered.length,
  };
}

/**
 * Main security scanning function
 * @param {Object} args - Security scan arguments
 * @returns {Promise<Object>} Security scan results
 */
async function scanGoSecurity(args) {
  const {
    code,
    filename = 'main.go',
    goMod,
    goSum,
    tools = ['govulncheck', 'staticcheck-security', 'unsafe-analysis'],
    severity = 'all',
    confidence = 'medium',
    category = 'all',
    limit = 50,
    offset = 0,
    sortBy = 'severity',
    sortOrder = 'desc',
  } = args;

  // Validate input
  const validation = validateGoCode(code);
  if (!validation.valid) {
    return validation.error;
  }

  const safeFilename = sanitizeGoFilename(filename);

  // Create temporary directory
  const tempId = randomBytes(8).toString('hex');
  const tempDir = join(tmpdir(), `go-security-${tempId}`);

  try {
    await mkdir(tempDir, { recursive: true });
    await createSecurityProject(tempDir, code, safeFilename, goMod, goSum);

    // Run security analysis tools
    const allFindings = [];
    const toolResults = {};

    for (const tool of tools) {
      try {
        let findings = [];

        switch (tool) {
          case 'govulncheck':
            findings = await withTimeout(runGovulncheck(tempDir), LINT_TIMEOUT_MS);
            break;

          case 'staticcheck-security':
          // Run staticcheck with security-focused checks
            findings = runSecurityPatternAnalysis(code, safeFilename);
            break;

          case 'unsafe-analysis':
            findings = runUnsafeAnalysis(code, safeFilename);
            break;

          default:
            findings = [];
        }

        allFindings.push(...findings);
        toolResults[tool] = {
          success: true,
          findingCount: findings.length,
        };
      } catch (error) {
        toolResults[tool] = {
          success: false,
          error: error.message,
        };
      }
    }

    // Filter and sort results
    const result = filterAndSortFindings(allFindings, {
      severity,
      confidence,
      category,
      sortBy,
      sortOrder,
      limit,
      offset,
    });

    // Generate summary
    const summary = {
      totalFindings: result.total,
      findingsShown: result.findings.length,
      hasMore: result.hasMore,
      toolResults,
      severityBreakdown: {},
      categoryBreakdown: {},
      confidenceBreakdown: {},
    };

    // Calculate breakdowns
    for (const finding of allFindings) {
      summary.severityBreakdown[finding.severity] =
        (summary.severityBreakdown[finding.severity] || 0) + 1;
      summary.categoryBreakdown[finding.category] =
        (summary.categoryBreakdown[finding.category] || 0) + 1;
      summary.confidenceBreakdown[finding.confidence] =
        (summary.confidenceBreakdown[finding.confidence] || 0) + 1;
    }

    // Format output
    let output = '# Go Security Scan Results\n\n';
    output += `**File**: ${safeFilename}\n`;
    output += `**Tools**: ${tools.join(', ')}\n`;
    output += `**Scan Date**: ${new Date().toISOString()}\n\n`;

    output += '## Summary\n';
    output += `- **Total Findings**: ${summary.totalFindings}\n`;
    output += `- **Showing**: ${summary.findingsShown} (offset: ${offset})\n`;

    if (summary.hasMore) {
      output += `- **More Available**: Yes (use offset=${offset + limit})\n`;
    }

    output += '\n### Severity Breakdown\n';
    for (const [sev, count] of Object.entries(summary.severityBreakdown)) {
      const icon =
        sev === 'critical' ? '🔴' : sev === 'high' ? '🟠' : sev === 'medium' ? '🟡' : '🔵';
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
        output += `${result.findingCount} findings\n`;
      } else {
        output += `Failed - ${result.error}\n`;
      }
    }

    if (result.findings.length > 0) {
      output += '\n## Security Findings\n\n';

      for (const finding of result.findings) {
        const severityIcon =
          finding.severity === 'critical'
            ? '🔴'
            : finding.severity === 'high'
              ? '🟠'
              : finding.severity === 'medium'
                ? '🟡'
                : '🔵';

        output += `### ${severityIcon} ${finding.severity.toUpperCase()} - Line ${finding.line}:${finding.column}\n`;
        output += `**Tool**: ${finding.tool}\n`;
        output += `**Category**: ${finding.category}\n`;
        output += `**Confidence**: ${finding.confidence}\n`;

        if (finding.vulnerability) {
          output += `**Vulnerability**: ${finding.vulnerability}\n`;
          output += `**Package**: ${finding.package}\n`;
        }

        output += `**Message**: ${finding.message || finding.summary}\n`;

        if (finding.details) {
          output += `**Details**: ${finding.details}\n`;
        }

        if (finding.references && finding.references.length > 0) {
          output += '**References**:\n';
          for (const ref of finding.references.slice(0, 3)) {
            output += `- ${ref.url}\n`;
          }
        }

        output += '\n';
      }
    } else {
      output += '\n## ✅ No Security Issues Found\n\n';
      output += 'Great! No security vulnerabilities were detected in your Go code.\n\n';
    }

    // Add security recommendations
    output += '## 🔒 Security Recommendations\n\n';
    if (summary.totalFindings > 0) {
      output += '- **Critical/High**: Address immediately - these may be exploitable\n';
      output += '- **Medium**: Review and fix when possible\n';
      output += '- **Low**: Consider fixing for defense in depth\n';
      output += '- Run `go mod tidy` and `go get -u` to update dependencies\n';
      output += '- Consider using `go mod audit` for additional dependency checks\n';
    } else {
      output += '- Keep dependencies updated with `go get -u`\n';
      output += '- Run security scans regularly in CI/CD pipeline\n';
      output += '- Consider additional tools like `gosec` for comprehensive analysis\n';
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      summary,
      findings: result.findings,
    };
  } catch (error) {
    let errorMessage = 'Go security scan failed';

    if (error.message.includes('govulncheck: command not found')) {
      errorMessage =
        'govulncheck is not installed. Run: go install golang.org/x/vuln/cmd/govulncheck@latest';
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
      if (goSum) {
        await unlink(join(tempDir, 'go.sum'));
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}
export { scanGoSecurity };
