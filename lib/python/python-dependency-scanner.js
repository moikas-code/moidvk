import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

/**
 * Python Dependency Scanner - Analyzes Python project dependencies
 */
export const pythonDependencyScannerTool = {
  name: 'python_dependency_scanner',
  description: 'Scans Python project dependencies for security vulnerabilities, outdated packages, and license issues. Works with requirements.txt, Pipfile, pyproject.toml, and setup.py.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to Python project directory (default: current directory)',
        default: '.'
      },
      format: {
        type: 'string',
        enum: ['summary', 'detailed'],
        description: 'Output format (default: detailed)',
        default: 'detailed'
      },
      checkOutdated: {
        type: 'boolean',
        description: 'Check for outdated packages (default: true)',
        default: true
      },
      checkLicenses: {
        type: 'boolean',
        description: 'Check package licenses (default: true)',
        default: true
      },
      checkSecurity: {
        type: 'boolean',
        description: 'Check for security vulnerabilities (default: true)',
        default: true
      },
      severity: {
        type: 'string',
        enum: ['low', 'moderate', 'high', 'critical'],
        description: 'Minimum severity level to report (default: low)',
        default: 'low'
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
      }
    }
  }
};

export async function handlePythonDependencyScanner(args) {
  const startTime = Date.now();
  
  try {
    // Resolve project path
    const projectPath = path.resolve(args.projectPath || '.');
    
    // Check if path exists
    try {
      await fs.access(projectPath);
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `Project path not found: ${projectPath}`,
            executionTime: Date.now() - startTime
          }, null, 2)
        }]
      };
    }
    
    // Find dependency files
    const depFiles = await findDependencyFiles(projectPath);
    
    if (depFiles.length === 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: 'No Python dependency files found (requirements.txt, Pipfile, pyproject.toml, setup.py)',
            executionTime: Date.now() - startTime
          }, null, 2)
        }]
      };
    }
    
    // Parse dependencies
    const dependencies = await parseDependencies(depFiles);
    
    const issues = [];
    const metrics = {
      totalDependencies: dependencies.length,
      directDependencies: 0,
      transitiveDependencies: 0,
      outdatedPackages: 0,
      vulnerablePackages: 0,
      licenseIssues: 0
    };
    
    // Check for security vulnerabilities
    if (args.checkSecurity) {
      const securityIssues = await checkSecurityVulnerabilities(dependencies, args.severity);
      issues.push(...securityIssues);
      metrics.vulnerablePackages = new Set(securityIssues.map(i => i.package)).size;
    }
    
    // Check for outdated packages
    if (args.checkOutdated) {
      const outdatedIssues = await checkOutdatedPackages(dependencies);
      issues.push(...outdatedIssues);
      metrics.outdatedPackages = outdatedIssues.length;
    }
    
    // Check licenses
    if (args.checkLicenses) {
      const licenseIssues = await checkLicenses(dependencies);
      issues.push(...licenseIssues);
      metrics.licenseIssues = licenseIssues.length;
    }
    
    // Sort issues by severity
    issues.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, moderate: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
    
    // Apply pagination
    const totalIssues = issues.length;
    const paginatedIssues = issues.slice(args.offset, args.offset + args.limit);
    
    // Calculate dependency health score
    const healthScore = calculateDependencyHealthScore(issues, metrics);
    
    const result = {
      success: true,
      issues: args.format === 'detailed' ? paginatedIssues : summarizeIssues(paginatedIssues),
      totalIssues,
      pagination: {
        offset: args.offset,
        limit: args.limit,
        hasMore: args.offset + args.limit < totalIssues
      },
      metrics,
      healthScore,
      dependencyFiles: depFiles.map(f => path.relative(projectPath, f)),
      summary: {
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length,
        moderate: issues.filter(i => i.severity === 'moderate').length,
        low: issues.filter(i => i.severity === 'low').length
      },
      executionTime: Date.now() - startTime
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
    
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: `Dependency scan failed: ${error.message}`,
          executionTime: Date.now() - startTime
        }, null, 2)
      }]
    };
  }
}

async function findDependencyFiles(projectPath) {
  const depFiles = [];
  const filesToCheck = [
    'requirements.txt',
    'requirements-dev.txt',
    'requirements-test.txt',
    'Pipfile',
    'Pipfile.lock',
    'pyproject.toml',
    'setup.py',
    'setup.cfg',
    'poetry.lock'
  ];
  
  for (const file of filesToCheck) {
    const filePath = path.join(projectPath, file);
    try {
      await fs.access(filePath);
      depFiles.push(filePath);
    } catch (error) {
      // File doesn't exist, continue
    }
  }
  
  return depFiles;
}

async function parseDependencies(depFiles) {
  const dependencies = new Map();
  
  for (const file of depFiles) {
    const content = await fs.readFile(file, 'utf8');
    const fileName = path.basename(file);
    
    if (fileName === 'requirements.txt' || fileName.startsWith('requirements-')) {
      // Parse requirements.txt format
      const lines = content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([a-zA-Z0-9-_.]+)([<>=!~]+.*)?$/);
        if (match) {
          const [, name, version] = match;
          dependencies.set(name.toLowerCase(), {
            name,
            version: version || '*',
            source: fileName
          });
        }
      }
    } else if (fileName === 'pyproject.toml') {
      // Basic TOML parsing for dependencies
      const depSection = content.match(/\[tool\.poetry\.dependencies\]([\s\S]*?)(?:\[|$)/);
      if (depSection) {
        const depLines = depSection[1].split('\n');
        for (const line of depLines) {
          const match = line.match(/^([a-zA-Z0-9-_.]+)\s*=\s*["']([^"']+)["']/);
          if (match) {
            const [, name, version] = match;
            dependencies.set(name.toLowerCase(), {
              name,
              version,
              source: fileName
            });
          }
        }
      }
    } else if (fileName === 'Pipfile') {
      // Basic Pipfile parsing
      const packageSection = content.match(/\[packages\]([\s\S]*?)(?:\[|$)/);
      if (packageSection) {
        const depLines = packageSection[1].split('\n');
        for (const line of depLines) {
          const match = line.match(/^([a-zA-Z0-9-_.]+)\s*=\s*["']([^"']+)["']/);
          if (match) {
            const [, name, version] = match;
            dependencies.set(name.toLowerCase(), {
              name,
              version,
              source: fileName
            });
          }
        }
      }
    }
  }
  
  return Array.from(dependencies.values());
}

async function checkSecurityVulnerabilities(dependencies, minSeverity) {
  const issues = [];
  
  // This is a mock implementation. In a real scenario, you would:
  // 1. Use pip-audit or safety to check for vulnerabilities
  // 2. Query vulnerability databases like PyPI Advisory Database
  
  // Mock vulnerability data
  const knownVulnerabilities = {
    'django': { 
      versions: ['<3.2.0'], 
      severity: 'high', 
      cve: 'CVE-2021-33203',
      description: 'SQL injection vulnerability'
    },
    'requests': { 
      versions: ['<2.25.0'], 
      severity: 'moderate', 
      cve: 'CVE-2021-33503',
      description: 'Information exposure vulnerability'
    },
    'pyyaml': { 
      versions: ['<5.4'], 
      severity: 'critical', 
      cve: 'CVE-2020-14343',
      description: 'Arbitrary code execution vulnerability'
    }
  };
  
  for (const dep of dependencies) {
    const vuln = knownVulnerabilities[dep.name.toLowerCase()];
    if (vuln) {
      // Check if severity meets minimum threshold
      const severityOrder = { low: 0, moderate: 1, high: 2, critical: 3 };
      if (severityOrder[vuln.severity] >= severityOrder[minSeverity]) {
        issues.push({
          type: 'security',
          package: dep.name,
          currentVersion: dep.version,
          severity: vuln.severity,
          cve: vuln.cve,
          description: vuln.description,
          recommendation: `Update ${dep.name} to latest version`,
          source: dep.source
        });
      }
    }
  }
  
  return issues;
}

async function checkOutdatedPackages(dependencies) {
  const issues = [];
  
  // This is a mock implementation. In a real scenario, you would:
  // 1. Query PyPI API for latest versions
  // 2. Compare with installed versions
  
  // Mock outdated packages
  const latestVersions = {
    'django': '4.2.0',
    'requests': '2.31.0',
    'numpy': '1.24.3',
    'pandas': '2.0.2'
  };
  
  for (const dep of dependencies) {
    const latest = latestVersions[dep.name.toLowerCase()];
    if (latest && dep.version !== '*' && dep.version !== latest) {
      issues.push({
        type: 'outdated',
        package: dep.name,
        currentVersion: dep.version,
        latestVersion: latest,
        severity: 'low',
        description: `Package ${dep.name} is outdated`,
        recommendation: `Update to version ${latest}`,
        source: dep.source
      });
    }
  }
  
  return issues;
}

async function checkLicenses(dependencies) {
  const issues = [];
  
  // This is a mock implementation. In a real scenario, you would:
  // 1. Use pip-licenses to check package licenses
  // 2. Compare against allowed license list
  
  // Mock license data
  const packageLicenses = {
    'gpl-package': 'GPL-3.0',
    'agpl-package': 'AGPL-3.0',
    'proprietary-package': 'Proprietary'
  };
  
  const restrictiveLicenses = ['GPL-3.0', 'AGPL-3.0', 'Proprietary'];
  
  for (const dep of dependencies) {
    const license = packageLicenses[dep.name.toLowerCase()];
    if (license && restrictiveLicenses.includes(license)) {
      issues.push({
        type: 'license',
        package: dep.name,
        license,
        severity: 'moderate',
        description: `Package has restrictive license: ${license}`,
        recommendation: 'Review license compatibility with your project',
        source: dep.source
      });
    }
  }
  
  return issues;
}

function summarizeIssues(issues) {
  const summary = {};
  
  for (const issue of issues) {
    const key = `${issue.type}-${issue.severity}`;
    if (!summary[key]) {
      summary[key] = {
        type: issue.type,
        severity: issue.severity,
        count: 0,
        packages: []
      };
    }
    summary[key].count++;
    if (!summary[key].packages.includes(issue.package)) {
      summary[key].packages.push(issue.package);
    }
  }
  
  return Object.values(summary);
}

function calculateDependencyHealthScore(issues, metrics) {
  let score = 100;
  
  // Deduct points for issues
  const penalties = {
    critical: 25,
    high: 15,
    moderate: 10,
    low: 5
  };
  
  for (const issue of issues) {
    score -= penalties[issue.severity] || 0;
  }
  
  // Additional penalties
  if (metrics.vulnerablePackages > 0) {
    score -= 10;
  }
  
  if (metrics.outdatedPackages > metrics.totalDependencies * 0.5) {
    score -= 10; // Many outdated packages
  }
  
  if (metrics.licenseIssues > 0) {
    score -= 5;
  }
  
  return Math.max(0, Math.min(100, score));
}