import { exec } from 'child_process';
import { promisify } from 'util';
import { validatePythonCode } from '../utils/python-validation.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Python Security Scanner using Bandit
 */
export const pythonSecurityScannerTool = {
  name: 'python_security_scanner',
  description: 'Scans Python code for security vulnerabilities using Bandit. Detects common security issues like SQL injection, hardcoded passwords, and insecure functions.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Python code to scan for security issues (max 100KB)'
      },
      filename: {
        type: 'string',
        description: 'Optional filename for context (e.g., "app.py")'
      },
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'all'],
        description: 'Minimum severity level to report (default: all)',
        default: 'all'
      },
      confidence: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'all'],
        description: 'Minimum confidence level to report (default: all)',
        default: 'all'
      },
      tests: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific tests to run (e.g., ["B201", "B301"])'
      },
      skips: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tests to skip (e.g., ["B404", "B603"])'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50)',
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
      category: {
        type: 'string',
        enum: ['crypto', 'injection', 'misc', 'all'],
        description: 'Filter by vulnerability category',
        default: 'all'
      }
    },
    required: ['code']
  }
};

export async function handlePythonSecurityScanner(args) {
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

    // Check if bandit is available
    try {
      await execAsync('bandit --version', { timeout: 5000 });
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'Bandit is not installed. Please install it with: pip install bandit',
            executionTime: Date.now() - startTime
          }, null, 2)
        }]
      };
    }

    // Create temporary file
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bandit-'));
    const tempFile = path.join(tempDir, args.filename || 'temp.py');
    
    try {
      await fs.writeFile(tempFile, args.code, 'utf8');

      // Build bandit command
      const banditArgs = [
        '-f', 'json',
        '--exit-zero'  // Don't exit with error code
      ];

      // Add severity filter
      if (args.severity && args.severity !== 'all') {
        const severityMap = { low: 'll', medium: 'lm', high: 'lmh' };
        banditArgs.push('-' + severityMap[args.severity]);
      }

      // Add confidence filter
      if (args.confidence && args.confidence !== 'all') {
        const confidenceMap = { low: 'ii', medium: 'im', high: 'imh' };
        banditArgs.push('-' + confidenceMap[args.confidence]);
      }

      // Add specific tests
      if (args.tests && args.tests.length > 0) {
        banditArgs.push('-t', args.tests.join(','));
      }

      // Add skips
      if (args.skips && args.skips.length > 0) {
        banditArgs.push('-s', args.skips.join(','));
      }

      const command = `bandit ${banditArgs.join(' ')} "${tempFile}"`;
      
      // Run bandit
      const result = await execAsync(command, {
        timeout: 30000,
        maxBuffer: 1024 * 1024 * 10 // 10MB
      });

      // Parse JSON output
      const banditOutput = JSON.parse(result.stdout);
      let issues = banditOutput.results || [];

      // Filter by category if specified
      if (args.category && args.category !== 'all') {
        issues = issues.filter(issue => {
          const testId = issue.test_id;
          const categoryMap = {
            crypto: ['B303', 'B304', 'B305', 'B306', 'B307', 'B308', 'B309', 'B310', 'B311', 'B312', 'B313', 'B314', 'B315', 'B316', 'B317', 'B318', 'B319', 'B320', 'B321', 'B322', 'B323', 'B324', 'B325'],
            injection: ['B601', 'B602', 'B603', 'B604', 'B605', 'B606', 'B607', 'B608', 'B609', 'B610', 'B611'],
            misc: ['B101', 'B102', 'B103', 'B104', 'B105', 'B106', 'B107', 'B108', 'B109', 'B110', 'B111', 'B112', 'B113']
          };
          
          return categoryMap[args.category]?.includes(testId) || false;
        });
      }

      // Transform issues to our format
      const formattedIssues = issues.map(issue => ({
        line: issue.line_number,
        column: issue.col_offset,
        severity: issue.issue_severity.toLowerCase(),
        confidence: issue.issue_confidence.toLowerCase(),
        message: issue.issue_text,
        testId: issue.test_id,
        testName: issue.test_name,
        cwe: issue.issue_cwe ? `CWE-${issue.issue_cwe.id}` : null,
        moreInfo: issue.more_info,
        code: issue.code,
        category: categorizeIssue(issue.test_id)
      }));

      // Sort by severity and line number
      formattedIssues.sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        return a.line - b.line;
      });

      // Apply pagination
      const totalIssues = formattedIssues.length;
      const paginatedIssues = formattedIssues.slice(args.offset, args.offset + args.limit);

      // Calculate security score
      const securityScore = calculateSecurityScore(formattedIssues);

      // Get metrics from bandit
      const metrics = banditOutput.metrics || {};

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            issues: paginatedIssues,
            totalIssues,
            pagination: {
              offset: args.offset,
              limit: args.limit,
              hasMore: args.offset + args.limit < totalIssues
            },
            metrics: {
              securityScore,
              linesOfCode: metrics._totals?.loc || 0,
              filesScanned: 1,
              executionTime: Date.now() - startTime
            },
            summary: {
              high: formattedIssues.filter(i => i.severity === 'high').length,
              medium: formattedIssues.filter(i => i.severity === 'medium').length,
              low: formattedIssues.filter(i => i.severity === 'low').length,
              byCategory: {
                crypto: formattedIssues.filter(i => i.category === 'crypto').length,
                injection: formattedIssues.filter(i => i.category === 'injection').length,
                misc: formattedIssues.filter(i => i.category === 'misc').length
              }
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
          error: `Security scan failed: ${error.message}`,
          executionTime: Date.now() - startTime
        }, null, 2)
      }]
    };
  }
}

function categorizeIssue(testId) {
  if (testId.startsWith('B3')) return 'crypto';
  if (testId.startsWith('B6')) return 'injection';
  return 'misc';
}

function calculateSecurityScore(issues) {
  if (issues.length === 0) return 100;
  
  let score = 100;
  const penalties = {
    high: 20,
    medium: 10,
    low: 5
  };
  
  for (const issue of issues) {
    score -= penalties[issue.severity] || 0;
  }
  
  return Math.max(0, score);
}