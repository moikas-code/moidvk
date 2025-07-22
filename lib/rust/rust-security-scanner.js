import { spawn } from 'child_process';
import { writeFile, unlink, readFile, access } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { randomBytes } from 'crypto';
import { validateRustCode, sanitizeRustFilename } from '../utils/rust-validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for rust_security_scanner
 */
export const rustSecurityScannerTool = {
  name: 'rust_security_scanner',
  description: 'Scans Rust project dependencies for security vulnerabilities using cargo-audit. Analyzes Cargo.lock for known security issues and provides remediation advice.',
  inputSchema: {
    type: 'object',
    properties: {
      cargoToml: {
        type: 'string',
        description: 'Cargo.toml content (optional, will create minimal if not provided)',
      },
      cargoLock: {
        type: 'string',
        description: 'Cargo.lock content for dependency analysis',
      },
      code: {
        type: 'string',
        description: 'Rust code to analyze (creates a temporary crate)',
      },
      format: {
        type: 'string',
        description: 'Output format',
        enum: ['summary', 'detailed'],
        default: 'detailed',
      },
      severity: {
        type: 'string',
        description: 'Minimum severity to report',
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'low',
      },
      // Pagination
      limit: {
        type: 'number',
        description: 'Maximum vulnerabilities to return',
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
    required: ['code'],
  },
};

/**
 * Creates a minimal Cargo.toml if not provided
 * @param {string} name - Package name
 * @returns {string} Cargo.toml content
 */
function createMinimalCargoToml(name) {
  return `[package]
name = "${name}"
version = "0.1.0"
edition = "2021"

[dependencies]
`;
}

/**
 * Parses cargo-audit JSON output
 * @param {string} output - Raw cargo-audit output
 * @returns {Object} Parsed vulnerability data
 */
function parseCargoAuditOutput(output) {
  try {
    const data = JSON.parse(output);
    
    const vulnerabilities = [];
    
    // Parse vulnerabilities from the audit output
    if (data.vulnerabilities && data.vulnerabilities.list) {
      for (const vuln of data.vulnerabilities.list) {
        vulnerabilities.push({
          id: vuln.advisory.id,
          package: vuln.package.name,
          version: vuln.package.version,
          title: vuln.advisory.title,
          description: vuln.advisory.description,
          severity: mapSeverity(vuln.advisory.cvss),
          cvss: vuln.advisory.cvss,
          date: vuln.advisory.date,
          url: vuln.advisory.url,
          categories: vuln.advisory.categories || [],
          keywords: vuln.advisory.keywords || [],
          patched_versions: vuln.versions.patched || [],
          unaffected_versions: vuln.versions.unaffected || [],
        });
      }
    }
    
    return {
      vulnerabilities,
      summary: {
        total: vulnerabilities.length,
        critical: vulnerabilities.filter(v => v.severity === 'critical').length,
        high: vulnerabilities.filter(v => v.severity === 'high').length,
        medium: vulnerabilities.filter(v => v.severity === 'medium').length,
        low: vulnerabilities.filter(v => v.severity === 'low').length,
      },
      dependencies: data.dependencies?.count || 0,
    };
  } catch (error) {
    // Fallback to text parsing if JSON fails
    return parseCargoAuditText(output);
  }
}

/**
 * Fallback text parser for cargo-audit output
 * @param {string} output - Raw text output
 * @returns {Object} Parsed vulnerability data
 */
function parseCargoAuditText(output) {
  const vulnerabilities = [];
  const lines = output.split('\n');
  
  let currentVuln = null;
  
  for (const line of lines) {
    // Look for vulnerability headers
    const vulnMatch = line.match(/^(\w+-\d{4}-\d+):\s+(.+)$/);
    if (vulnMatch) {
      if (currentVuln) {
        vulnerabilities.push(currentVuln);
      }
      currentVuln = {
        id: vulnMatch[1],
        title: vulnMatch[2],
        description: '',
        severity: 'medium',
        package: '',
        version: '',
      };
    }
    
    // Extract package info
    if (currentVuln && line.includes('Crate:')) {
      const crateMatch = line.match(/Crate:\s+(\S+)/);
      if (crateMatch) currentVuln.package = crateMatch[1];
    }
    
    if (currentVuln && line.includes('Version:')) {
      const versionMatch = line.match(/Version:\s+(\S+)/);
      if (versionMatch) currentVuln.version = versionMatch[1];
    }
  }
  
  if (currentVuln) {
    vulnerabilities.push(currentVuln);
  }
  
  return {
    vulnerabilities,
    summary: {
      total: vulnerabilities.length,
      critical: 0,
      high: 0,
      medium: vulnerabilities.length,
      low: 0,
    },
    dependencies: 0,
  };
}

/**
 * Maps CVSS score to severity level
 * @param {string|number} cvss - CVSS score
 * @returns {string} Severity level
 */
function mapSeverity(cvss) {
  if (!cvss) return 'medium';
  
  const score = typeof cvss === 'string' ? parseFloat(cvss) : cvss;
  
  if (score >= 9.0) return 'critical';
  if (score >= 7.0) return 'high';
  if (score >= 4.0) return 'medium';
  return 'low';
}

/**
 * Runs cargo-audit on a Rust project
 * @param {string} projectPath - Path to the Rust project
 * @returns {Promise<Object>} Audit results
 */
async function runCargoAudit(projectPath) {
  return new Promise((resolve, reject) => {
    const cargo = spawn('cargo', ['audit', '--json'], {
      cwd: projectPath,
      env: {
        ...process.env,
        CARGO_TERM_COLOR: 'never',
      },
    });
    
    let stdout = '';
    let stderr = '';
    
    cargo.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    cargo.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    cargo.on('close', (code) => {
      // cargo-audit returns non-zero on vulnerabilities, which is expected
      resolve({ stdout, stderr, exitCode: code });
    });
    
    cargo.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Analyzes code for direct security issues
 * @param {string} code - Rust code to analyze
 * @returns {Array} Security issues found
 */
function analyzeCodeSecurity(code) {
  const issues = [];
  
  // Check for hardcoded credentials
  const credentialPatterns = [
    /password\s*=\s*"[^"]+"/gi,
    /api_key\s*=\s*"[^"]+"/gi,
    /secret\s*=\s*"[^"]+"/gi,
    /token\s*=\s*"[^"]+"/gi,
  ];
  
  for (const pattern of credentialPatterns) {
    const matches = code.match(pattern);
    if (matches) {
      issues.push({
        type: 'hardcoded-credentials',
        severity: 'high',
        message: 'Hardcoded credentials detected',
        count: matches.length,
      });
    }
  }
  
  // Check for insecure random number generation
  if (code.includes('rand::thread_rng') && !code.includes('rand::rngs::OsRng')) {
    issues.push({
      type: 'weak-random',
      severity: 'medium',
      message: 'Consider using OsRng for cryptographic randomness',
    });
  }
  
  // Check for SQL injection risks
  if (code.match(/format!\s*\(\s*".*(?:SELECT|INSERT|UPDATE|DELETE).*\{/i)) {
    issues.push({
      type: 'sql-injection',
      severity: 'critical',
      message: 'Potential SQL injection via string formatting',
    });
  }
  
  // Check for command injection
  if (code.match(/Command::new.*format!/)) {
    issues.push({
      type: 'command-injection',
      severity: 'critical',
      message: 'Potential command injection via string formatting',
    });
  }
  
  return issues;
}

/**
 * Handles the rust_security_scanner tool call
 * @param {Object} args - Tool arguments
 * @returns {Object} MCP response
 */
export async function handleRustSecurityScanner(args) {
  const {
    cargoToml,
    cargoLock,
    code,
    format = 'detailed',
    severity = 'low',
    limit = 50,
    offset = 0,
  } = args;
  
  // Validate input
  if (code) {
    const validation = validateRustCode(code);
    if (!validation.valid) {
      return validation.error;
    }
  }
  
  // Create temporary project directory
  const tempDir = join(tmpdir(), `rust_audit_${randomBytes(8).toString('hex')}`);
  const srcDir = join(tempDir, 'src');
  
  try {
    // Check if cargo-audit is available
    try {
      await withTimeout(
        new Promise((resolve, reject) => {
          spawn('cargo', ['audit', '--version']).on('close', code => {
            code === 0 ? resolve() : reject(new Error('cargo-audit not found'));
          });
        }),
        5000,
        'cargo-audit check'
      );
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: '❌ Error: cargo-audit is not installed.\n\nInstall with: cargo install cargo-audit',
        }],
      };
    }
    
    // Create temporary project structure
    await writeFile(join(tempDir, 'Cargo.toml'), cargoToml || createMinimalCargoToml('security_scan'), 'utf8');
    
    // Create src directory
    await writeFile(join(tempDir, 'src'), '', 'utf8').catch(() => {});
    await unlink(join(tempDir, 'src')).catch(() => {});
    await writeFile(join(srcDir, ''), '', 'utf8').catch(() => {});
    await unlink(join(srcDir, '')).catch(() => {});
    
    // Ensure src directory exists
    const { mkdir } = await import('fs/promises');
    await mkdir(srcDir, { recursive: true });
    
    // Write code to main.rs
    if (code) {
      await writeFile(join(srcDir, 'main.rs'), code, 'utf8');
    } else {
      await writeFile(join(srcDir, 'main.rs'), 'fn main() {}', 'utf8');
    }
    
    // Write Cargo.lock if provided
    if (cargoLock) {
      await writeFile(join(tempDir, 'Cargo.lock'), cargoLock, 'utf8');
    }
    
    // Run cargo-audit
    const auditPromise = runCargoAudit(tempDir);
    const result = await withTimeout(auditPromise, LINT_TIMEOUT_MS, 'Security audit');
    
    // Parse audit results
    const auditData = parseCargoAuditOutput(result.stdout || result.stderr);
    
    // Analyze code for direct security issues
    const codeIssues = code ? analyzeCodeSecurity(code) : [];
    
    // Filter by severity
    const severityLevels = ['low', 'medium', 'high', 'critical'];
    const minSeverityIndex = severityLevels.indexOf(severity);
    
    let filteredVulns = auditData.vulnerabilities.filter(vuln => {
      const vulnSeverityIndex = severityLevels.indexOf(vuln.severity);
      return vulnSeverityIndex >= minSeverityIndex;
    });
    
    // Apply pagination
    const totalVulns = filteredVulns.length;
    filteredVulns = filteredVulns.slice(offset, offset + limit);
    const hasMore = offset + limit < totalVulns;
    
    // Format output
    let output = '🔒 Rust Security Scan Results:\n\n';
    
    if (codeIssues.length > 0) {
      output += '⚠️  Code Security Issues:\n';
      for (const issue of codeIssues) {
        output += `  ${getSeverityEmoji(issue.severity)} ${issue.message}\n`;
      }
      output += '\n';
    }
    
    output += `📊 Dependency Audit Summary:\n`;
    output += `  Total vulnerabilities: ${auditData.summary.total}\n`;
    output += `  Critical: ${auditData.summary.critical} | High: ${auditData.summary.high}\n`;
    output += `  Medium: ${auditData.summary.medium} | Low: ${auditData.summary.low}\n`;
    output += `  Dependencies scanned: ${auditData.dependencies}\n\n`;
    
    if (filteredVulns.length === 0 && codeIssues.length === 0) {
      output += '✅ No security vulnerabilities detected!\n';
    } else if (filteredVulns.length > 0) {
      output += `Found ${totalVulns} vulnerabilities (showing ${filteredVulns.length}):\n\n`;
      
      if (format === 'detailed') {
        for (const vuln of filteredVulns) {
          output += `${getSeverityEmoji(vuln.severity)} ${vuln.id}: ${vuln.title}\n`;
          output += `  Package: ${vuln.package} ${vuln.version}\n`;
          output += `  Severity: ${vuln.severity.toUpperCase()}${vuln.cvss ? ` (CVSS ${vuln.cvss})` : ''}\n`;
          output += `  Description: ${vuln.description?.substring(0, 200)}...\n`;
          
          if (vuln.patched_versions.length > 0) {
            output += `  Fix: Update to ${vuln.patched_versions.join(' or ')}\n`;
          }
          
          if (vuln.url) {
            output += `  More info: ${vuln.url}\n`;
          }
          
          output += '\n';
        }
      } else {
        // Summary format
        for (const vuln of filteredVulns) {
          output += `${getSeverityEmoji(vuln.severity)} ${vuln.package} ${vuln.version}: ${vuln.title}\n`;
        }
      }
    }
    
    output += '\n💡 Recommendations:\n';
    
    if (auditData.summary.critical > 0 || auditData.summary.high > 0) {
      output += '- ⚠️  Address critical and high severity vulnerabilities immediately\n';
      output += '- Run `cargo update` to get latest dependency versions\n';
    }
    
    if (codeIssues.some(i => i.type === 'hardcoded-credentials')) {
      output += '- 🔑 Move credentials to environment variables or secure vaults\n';
    }
    
    if (codeIssues.some(i => i.type === 'sql-injection')) {
      output += '- 💉 Use parameterized queries to prevent SQL injection\n';
    }
    
    output += '- 📋 Run `cargo audit fix` to automatically update vulnerable dependencies\n';
    output += '- 🔍 Consider using `cargo-deny` for more comprehensive checks\n';
    
    // Include summary data
    const summary = {
      vulnerabilities: auditData.summary,
      codeIssues: codeIssues.length,
      totalFiltered: totalVulns,
      returned: filteredVulns.length,
      offset,
      limit,
      hasMore,
      severity: severity,
    };
    
    return {
      content: [{
        type: 'text',
        text: output,
      }, {
        type: 'text',
        text: JSON.stringify(summary, null, 2),
      }],
    };
  } catch (error) {
    console.error('Error running security scan:', error);
    
    let errorMessage = 'Failed to complete security scan.';
    
    if (error.message.includes('cargo: command not found')) {
      errorMessage = 'Cargo is not installed. Please install Rust.';
    } else if (error.message.includes('cargo-audit')) {
      errorMessage = 'cargo-audit is not installed. Run: cargo install cargo-audit';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\n${error.message}`,
      }],
    };
  } finally {
    // Clean up temporary directory
    try {
      const { rm } = await import('fs/promises');
      await rm(tempDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Get emoji for severity level
 * @param {string} severity - Severity level
 * @returns {string} Emoji
 */
function getSeverityEmoji(severity) {
  const emojis = {
    critical: '🚨',
    high: '⚠️',
    medium: '⚡',
    low: 'ℹ️',
  };
  return emojis[severity] || '•';
}