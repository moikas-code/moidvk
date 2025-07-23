import { withTimeout } from '../utils/timeout.js';

/**
 * Tool definition for scan_security_vulnerabilities
 */
export const securityScannerTool = {
  name: 'scan_security_vulnerabilities',
  description: 'Scans project dependencies for security vulnerabilities using bun audit (delegates to NPM) or npm audit. Returns vulnerability report with remediation suggestions.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Optional project path to scan (defaults to current directory)',
      },
      severity: {
        type: 'string',
        enum: ['low', 'moderate', 'high', 'critical'],
        description: 'Minimum severity level to report (defaults to all)',
      },
      production: {
        type: 'boolean',
        description: 'Scan only production dependencies (defaults to false)',
      },
      format: {
        type: 'string',
        enum: ['summary', 'detailed'],
        description: 'Output format (defaults to detailed)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of vulnerabilities to return (default: 50, max: 500)',
        default: 50,
        minimum: 1,
        maximum: 500,
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination (default: 0)',
        default: 0,
        minimum: 0,
      },
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['severity', 'package', 'title'],
        default: 'severity',
      },
      sortOrder: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
    required: [],
  },
};

// Timeout for audit commands
const AUDIT_TIMEOUT_MS = 30000; // 30 seconds

// Severity levels for filtering
const SEVERITY_LEVELS = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

/**
 * Detects available package manager and lockfile
 * @param {string} projectPath - Project directory path
 * @returns {Promise<{manager: string, lockfile: string}>}
 */
async function detectPackageManager(projectPath = '.') {
  try {
    // Check for bun.lock (Bun)
    await Bun.file(`${projectPath}/bun.lock`).text();
    return { manager: 'bun', lockfile: 'bun.lock' };
  } catch {
    try {
      // Check for package-lock.json (npm)
      await Bun.file(`${projectPath}/package-lock.json`).text();
      return { manager: 'npm', lockfile: 'package-lock.json' };
    } catch {
      try {
        // Check for yarn.lock (yarn)
        await Bun.file(`${projectPath}/yarn.lock`).text();
        return { manager: 'yarn', lockfile: 'yarn.lock' };
      } catch {
        // Default to bun if no lockfile found
        return { manager: 'bun', lockfile: 'none' };
      }
    }
  }
}

/**
 * Runs audit command and returns parsed JSON
 * @param {string} manager - Package manager to use
 * @param {string} projectPath - Project directory
 * @param {boolean} production - Production only flag
 * @returns {Promise<Object>} Audit results
 */
async function runAuditCommand(manager, projectPath = '.', production = false) {
  const prodFlag = production ? ' --production' : '';
  let command;
  
  switch (manager) {
    case 'bun':
      command = `cd "${projectPath}" && bun audit --json${prodFlag}`;
      break;
    case 'npm':
      command = `cd "${projectPath}" && npm audit --json${prodFlag}`;
      break;
    case 'yarn':
      command = `cd "${projectPath}" && yarn audit --json${prodFlag}`;
      break;
    default:
      throw new Error(`Unsupported package manager: ${manager}`);
  }

  const proc = Bun.spawn(['sh', '-c', command], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const auditPromise = new Promise(async (resolve, reject) => {
    try {
      const result = await proc.exited;
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      
      if (result === 0 || stdout.trim()) {
        // Parse JSON output
        try {
          const data = JSON.parse(stdout);
          resolve(data);
        } catch (parseError) {
          // If JSON parsing fails, return raw output
          resolve({ raw: stdout, stderr });
        }
      } else {
        reject(new Error(stderr || 'Audit command failed'));
      }
    } catch (error) {
      reject(error);
    }
  });

  return await withTimeout(auditPromise, AUDIT_TIMEOUT_MS, 'Security audit');
}

/**
 * Parses audit results and formats vulnerabilities
 * @param {Object} auditData - Raw audit data
 * @param {string} manager - Package manager used
 * @param {string} minSeverity - Minimum severity filter
 * @returns {Object} Formatted vulnerability data
 */
function parseAuditResults(auditData, manager, minSeverity = 'low') {
  const result = {
    vulnerabilities: [],
    summary: {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      total: 0,
    },
    fixCommands: [],
    hasVulnerabilities: false,
  };

  try {
    if (manager === 'npm' && auditData.vulnerabilities) {
      // Parse npm audit format
      const vulnerabilities = auditData.vulnerabilities;
      
      for (const [packageName, vulnData] of Object.entries(vulnerabilities)) {
        if (vulnData.severity) {
          const severity = vulnData.severity;
          result.summary[severity]++;
          result.summary.total++;
          
          // Filter by minimum severity
          if (SEVERITY_LEVELS[severity] >= SEVERITY_LEVELS[minSeverity]) {
            result.vulnerabilities.push({
              package: packageName,
              severity,
              title: vulnData.title || 'Unknown vulnerability',
              url: vulnData.url || '',
              range: vulnData.range || '',
              fixAvailable: vulnData.fixAvailable || false,
            });
          }
        }
      }
      
      result.hasVulnerabilities = result.summary.total > 0;
      
      if (result.hasVulnerabilities) {
        result.fixCommands.push('npm audit fix');
        if (result.summary.critical > 0 || result.summary.high > 0) {
          result.fixCommands.push('npm audit fix --force');
        }
      }
    } else if (manager === 'bun') {
      // Parse bun audit format (similar to npm but may have differences)
      if (auditData.vulnerabilities) {
        // Handle bun-specific format when vulnerabilities exist
        result.hasVulnerabilities = Object.keys(auditData.vulnerabilities).length > 0;
      } else if (Object.keys(auditData).length === 0) {
        // Empty object means no vulnerabilities
        result.hasVulnerabilities = false;
      }
      
      if (result.hasVulnerabilities) {
        result.fixCommands.push('bun audit fix');
      }
    }
  } catch (error) {
    console.error('Error parsing audit results:', error);
  }

  return result;
}

/**
 * Apply pagination and sorting to vulnerability data
 * @param {Object} vulnData - Parsed vulnerability data
 * @param {Object} options - Pagination and sorting options
 * @returns {Object} Paginated and sorted vulnerability data
 */
function applyPaginationAndSorting(vulnData, options) {
  const { limit, offset, sortBy, sortOrder } = options;
  const { vulnerabilities, ...rest } = vulnData;
  
  // Sort vulnerabilities
  const sortedVulnerabilities = [...vulnerabilities].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'severity':
        const aSeverity = SEVERITY_LEVELS[a.severity] || 0;
        const bSeverity = SEVERITY_LEVELS[b.severity] || 0;
        comparison = aSeverity - bSeverity;
        break;
      case 'package':
        comparison = a.package.localeCompare(b.package);
        break;
      case 'title':
        comparison = (a.title || '').localeCompare(b.title || '');
        break;
      default:
        comparison = 0;
    }
    
    return sortOrder === 'desc' ? -comparison : comparison;
  });
  
  // Apply pagination
  const totalVulnerabilities = sortedVulnerabilities.length;
  const paginatedVulnerabilities = sortedVulnerabilities.slice(offset, offset + limit);
  const hasMore = offset + limit < totalVulnerabilities;
  const nextOffset = hasMore ? offset + limit : null;
  
  return {
    ...rest,
    vulnerabilities: paginatedVulnerabilities,
    pagination: {
      offset,
      limit,
      totalVulnerabilities,
      hasMore,
      nextOffset,
      currentPage: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(totalVulnerabilities / limit)
    }
  };
}

/**
 * Formats the vulnerability report for display
 * @param {Object} vulnData - Parsed vulnerability data
 * @param {string} format - Output format
 * @param {string} manager - Package manager used
 * @param {Object} options - Pagination and sorting options
 * @returns {string} Formatted report
 */
function formatVulnerabilityReport(vulnData, format, manager, options = {}) {
  const { vulnerabilities, summary, fixCommands, hasVulnerabilities, pagination } = vulnData;
  const { sortBy, sortOrder } = options;
  
  let output = '🔒 Security Vulnerability Scan Results:\\n\\n';
  
  // Add pagination info if available
  if (pagination) {
    output += `📄 Results: Page ${pagination.currentPage} of ${pagination.totalPages} ` +
              `(${pagination.offset + 1}-${Math.min(pagination.offset + pagination.limit, pagination.totalVulnerabilities)} ` +
              `of ${pagination.totalVulnerabilities} vulnerabilities)\\n`;
    output += `🔄 Sorted by: ${sortBy} (${sortOrder})\\n\\n`;
  }
  
  if (!hasVulnerabilities) {
    output += '✅ No security vulnerabilities found!\\n';
    output += `📊 Scanned dependencies using ${manager}${manager === 'bun' ? ' (via NPM database)' : ''}\\n`;
    output += '🛡️  Your project appears to be secure from known vulnerabilities.\\n';
    output += '📝 Note: Only packages from npm registry are scanned.\\n';
    return output;
  }
  
  // Summary section
  output += `📊 Summary: ${summary.total} vulnerabilities found\\n`;
  if (summary.critical > 0) output += `- Critical: ${summary.critical}\\n`;
  if (summary.high > 0) output += `- High: ${summary.high}\\n`;
  if (summary.moderate > 0) output += `- Moderate: ${summary.moderate}\\n`;
  if (summary.low > 0) output += `- Low: ${summary.low}\\n`;
  if (summary.info > 0) output += `- Info: ${summary.info}\\n`;
  output += '\\n';
  
  // Detailed vulnerabilities
  if (format === 'detailed' && vulnerabilities.length > 0) {
    const criticalHigh = vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high');
    const moderate = vulnerabilities.filter(v => v.severity === 'moderate');
    const lowInfo = vulnerabilities.filter(v => v.severity === 'low' || v.severity === 'info');
    
    if (criticalHigh.length > 0) {
      output += '🚨 Critical/High Vulnerabilities:\\n';
      criticalHigh.forEach(vuln => {
        output += `  • ${vuln.package} - ${vuln.title}\\n`;
        if (vuln.range) output += `    Range: ${vuln.range}\\n`;
        if (vuln.url) output += `    More info: ${vuln.url}\\n`;
      });
      output += '\\n';
    }
    
    if (moderate.length > 0) {
      output += '⚠️  Moderate Vulnerabilities:\\n';
      moderate.forEach(vuln => {
        output += `  • ${vuln.package} - ${vuln.title}\\n`;
      });
      output += '\\n';
    }
    
    if (lowInfo.length > 0 && lowInfo.length <= 5) {
      output += 'ℹ️  Low/Info Vulnerabilities:\\n';
      lowInfo.forEach(vuln => {
        output += `  • ${vuln.package} - ${vuln.title}\\n`;
      });
      output += '\\n';
    }
  }
  
  // Fix commands
  if (fixCommands.length > 0) {
    output += '⚡ Recommended Actions:\\n';
    fixCommands.forEach(cmd => {
      output += `  ${cmd}\\n`;
    });
    output += '\\n';
  }
  
  // Pagination navigation
  if (pagination && pagination.totalVulnerabilities > 0) {
    output += '\\n📄 Pagination:\\n';
    if (pagination.offset > 0) {
      const prevOffset = Math.max(0, pagination.offset - pagination.limit);
      output += `  ← Previous: offset=${prevOffset}, limit=${pagination.limit}\\n`;
    }
    if (pagination.hasMore) {
      output += `  → Next: offset=${pagination.nextOffset}, limit=${pagination.limit}\\n`;
    }
    output += `  📊 Total vulnerabilities: ${pagination.totalVulnerabilities}\\n`;
    output += '\\n';
  }
  
  // Security recommendations
  output += '🛡️  Security Best Practices:\\n';
  output += '- Run security audits regularly (weekly/monthly)\\n';
  output += '- Keep dependencies updated to latest stable versions\\n';
  output += '- Review and test fixes before deploying to production\\n';
  output += '- Consider using tools like Snyk or Dependabot for automation\\n';
  
  return output;
}

/**
 * Handles the scan_security_vulnerabilities tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleSecurityScanner(args) {
  const { 
    projectPath = '.', 
    severity = 'low', 
    production = false, 
    format = 'detailed',
    limit = 50,
    offset = 0,
    sortBy = 'severity',
    sortOrder = 'desc'
  } = args.params || args;
  
  try {
    // Detect package manager
    const { manager, lockfile } = await detectPackageManager(projectPath);
    
    if (lockfile === 'none') {
      return {
        content: [{
          type: 'text',
          text: '⚠️  No lockfile found. Install dependencies first:\\n\\n' +
                '- For Bun: bun install\\n' +
                '- For npm: npm install\\n' +
                '- For Yarn: yarn install\\n\\n' +
                'Lockfiles are required for accurate vulnerability scanning.',
        }],
      };
    }
    
    // Run audit command
    const auditData = await runAuditCommand(manager, projectPath, production);
    
    // Parse results
    const vulnData = parseAuditResults(auditData, manager, severity);
    
    // Apply sorting and pagination
    const paginatedData = applyPaginationAndSorting(vulnData, {
      limit,
      offset,
      sortBy,
      sortOrder
    });
    
    // Format report
    const report = formatVulnerabilityReport(paginatedData, format, manager, {
      limit,
      offset,
      sortBy,
      sortOrder
    });
    
    return {
      content: [{
        type: 'text',
        text: report,
      }],
    };
    
  } catch (error) {
    console.error('Error in security scanner:', error);
    
    let errorMessage = 'An error occurred while scanning for vulnerabilities.';
    
    if (error.message === 'Security audit timeout exceeded') {
      errorMessage = 'Security scan timed out. The project might be too large or network issues occurred.';
    } else if (error.message.includes('command not found')) {
      errorMessage = 'Package manager not found. Please install bun, npm, or yarn.';
    } else if (error.message.includes('ENOENT')) {
      errorMessage = 'Project directory not found. Please check the path.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\\n\\nPlease ensure you have a valid Node.js/Bun project with a lockfile.`,
      }],
    };
  }
}