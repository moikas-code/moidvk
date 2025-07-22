import { spawn } from 'child_process';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { isValidGoModule } from '../utils/go-validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for go_dependency_scanner
 */
export const goDependencyScannerTool = {
  name: 'go_dependency_scanner',
  description:
    'Scans Go module dependencies for vulnerabilities, license issues, outdated packages, and provides dependency analysis. Works with go.mod and go.sum files.',
  inputSchema: {
    type: 'object',
    properties: {
      goMod: {
        type: 'string',
        description: 'The go.mod file content to analyze',
      },
      goSum: {
        type: 'string',
        description: 'Optional go.sum file content for integrity verification',
      },
      // Analysis options
      scanType: {
        type: 'string',
        description: 'Type of dependency scan to perform',
        enum: ['vulnerabilities', 'licenses', 'outdated', 'all'],
        default: 'all',
      },
      severity: {
        type: 'string',
        description: 'Minimum severity level for vulnerabilities',
        enum: ['low', 'medium', 'high', 'critical', 'all'],
        default: 'medium',
      },
      includeIndirect: {
        type: 'boolean',
        description: 'Include indirect dependencies in analysis',
        default: true,
      },
      // Filtering
      category: {
        type: 'string',
        description: 'Filter by issue category',
        enum: ['security', 'license', 'maintenance', 'compatibility', 'all'],
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
        enum: ['severity', 'package', 'category', 'version'],
        default: 'severity',
      },
      sortOrder: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
    required: ['goMod'],
  },
};

/**
 * Parses go.mod file content
 * @param {string} goModContent - go.mod file content
 * @returns {Object} Parsed module information
 */
function parseGoMod(goModContent) {
  const lines = goModContent.split('\n');
  const module = {
    name: '',
    goVersion: '',
    dependencies: [],
    replacements: [],
    exclusions: [],
  };

  let inRequireBlock = false;
  let inReplaceBlock = false;
  let inExcludeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Module name
    const moduleMatch = trimmed.match(/^module\s+(.+)$/);
    if (moduleMatch) {
      module.name = moduleMatch[1];
      continue;
    }

    // Go version
    const goMatch = trimmed.match(/^go\s+(.+)$/);
    if (goMatch) {
      module.goVersion = goMatch[1];
      continue;
    }

    // Block starts
    if (trimmed === 'require (') {
      inRequireBlock = true;
      continue;
    }
    if (trimmed === 'replace (') {
      inReplaceBlock = true;
      continue;
    }
    if (trimmed === 'exclude (') {
      inExcludeBlock = true;
      continue;
    }

    // Block ends
    if (trimmed === ')') {
      inRequireBlock = false;
      inReplaceBlock = false;
      inExcludeBlock = false;
      continue;
    }

    // Dependencies
    if (inRequireBlock || trimmed.startsWith('require ')) {
      const depMatch = trimmed.match(/^(?:require\s+)?([^\s]+)\s+([^\s]+)(?:\s+\/\/\s*(.*))?$/);
      if (depMatch) {
        module.dependencies.push({
          name: depMatch[1],
          version: depMatch[2],
          indirect: depMatch[3] === 'indirect',
          comment: depMatch[3] || '',
        });
      }
    }

    // Replacements
    if (inReplaceBlock || trimmed.startsWith('replace ')) {
      const replaceMatch = trimmed.match(
        /^(?:replace\s+)?([^\s]+)(?:\s+([^\s]+))?\s+=>\s+([^\s]+)(?:\s+([^\s]+))?$/,
      );
      if (replaceMatch) {
        module.replacements.push({
          original: replaceMatch[1],
          originalVersion: replaceMatch[2] || '',
          replacement: replaceMatch[3],
          replacementVersion: replaceMatch[4] || '',
        });
      }
    }

    // Exclusions
    if (inExcludeBlock || trimmed.startsWith('exclude ')) {
      const excludeMatch = trimmed.match(/^(?:exclude\s+)?([^\s]+)\s+([^\s]+)$/);
      if (excludeMatch) {
        module.exclusions.push({
          name: excludeMatch[1],
          version: excludeMatch[2],
        });
      }
    }
  }

  return module;
}

/**
 * Runs go list to get dependency information
 * @param {string} projectPath - Path to the Go project
 * @param {boolean} includeIndirect - Include indirect dependencies
 * @returns {Promise<Array>} Dependency information
 */
async function runGoList(projectPath, includeIndirect) {
  return new Promise((resolve, reject) => {
    const args = ['list', '-m'];
    if (includeIndirect) {
      args.push('-u', 'all');
    } else {
      args.push('-u');
    }

    const process = spawn('go', args, {
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
      if (code === 0) {
        const dependencies = [];
        const lines = stdout.split('\n').filter((line) => line.trim());

        for (const line of lines) {
          const parts = line.split(' ');
          if (parts.length >= 2) {
            dependencies.push({
              name: parts[0],
              currentVersion: parts[1],
              latestVersion: parts[2] || parts[1],
              hasUpdate: parts[2] && parts[2] !== parts[1],
            });
          }
        }

        resolve(dependencies);
      } else {
        reject(new Error(`go list failed: ${stderr}`));
      }
    });

    process.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Analyzes dependencies for various issues
 * @param {Object} module - Parsed module information
 * @param {Array} dependencyInfo - Dependency information from go list
 * @param {string} scanType - Type of scan to perform
 * @returns {Array} Dependency issues found
 */
function analyzeDependencies(module, dependencyInfo, scanType) {
  const issues = [];

  // Create a map for quick lookup
  const depInfoMap = new Map();
  for (const dep of dependencyInfo) {
    depInfoMap.set(dep.name, dep);
  }

  for (const dep of module.dependencies) {
    const info = depInfoMap.get(dep.name);

    // Check for outdated dependencies
    if ((scanType === 'all' || scanType === 'outdated') && info && info.hasUpdate) {
      issues.push({
        tool: 'dependency-scanner',
        severity: 'info',
        category: 'maintenance',
        package: dep.name,
        currentVersion: dep.version,
        latestVersion: info.latestVersion,
        message: `Package '${dep.name}' has an update available`,
        suggestion: `Update to version ${info.latestVersion}`,
        code: 'outdated-dependency',
        type: 'outdated',
      });
    }

    // Check for known problematic patterns
    if (scanType === 'all' || scanType === 'vulnerabilities') {
      const securityIssues = checkSecurityPatterns(dep);
      issues.push(...securityIssues);
    }

    // Check for license issues (simplified)
    if (scanType === 'all' || scanType === 'licenses') {
      const licenseIssues = checkLicensePatterns(dep);
      issues.push(...licenseIssues);
    }
  }

  // Check for dependency conflicts
  const conflictIssues = checkDependencyConflicts(module);
  issues.push(...conflictIssues);

  return issues;
}

/**
 * Checks for security patterns in dependencies
 * @param {Object} dependency - Dependency object
 * @returns {Array} Security issues
 */
function checkSecurityPatterns(dependency) {
  const issues = [];

  // Known vulnerable patterns (simplified - in real implementation, use vulnerability database)
  const vulnerablePatterns = [
    {
      pattern: /^github\.com\/.*\/.*@v0\.0\.0-/,
      message: 'Dependency uses development version (v0.0.0-*)',
      severity: 'medium',
      suggestion: 'Use a stable release version',
    },
    {
      pattern: /^github\.com\/.*\/.*@.*-\w{12}$/,
      message: 'Dependency uses commit hash instead of version tag',
      severity: 'low',
      suggestion: 'Use semantic version tags when available',
    },
  ];

  const fullName = `${dependency.name}@${dependency.version}`;

  for (const vuln of vulnerablePatterns) {
    if (vuln.pattern.test(fullName)) {
      issues.push({
        tool: 'security-scanner',
        severity: vuln.severity,
        category: 'security',
        package: dependency.name,
        currentVersion: dependency.version,
        message: vuln.message,
        suggestion: vuln.suggestion,
        code: 'security-pattern',
        type: 'security',
      });
    }
  }

  return issues;
}

/**
 * Checks for license-related issues
 * @param {Object} dependency - Dependency object
 * @returns {Array} License issues
 */
function checkLicensePatterns(dependency) {
  const issues = [];

  // Known license concerns (simplified)
  const licensePatterns = [
    {
      pattern: /^github\.com\/.*gpl.*/i,
      message: 'Package may use GPL license - verify compatibility',
      severity: 'warning',
      suggestion: 'Review license compatibility with your project',
    },
  ];

  for (const license of licensePatterns) {
    if (license.pattern.test(dependency.name)) {
      issues.push({
        tool: 'license-scanner',
        severity: license.severity,
        category: 'license',
        package: dependency.name,
        currentVersion: dependency.version,
        message: license.message,
        suggestion: license.suggestion,
        code: 'license-concern',
        type: 'license',
      });
    }
  }

  return issues;
}

/**
 * Checks for dependency conflicts
 * @param {Object} module - Parsed module information
 * @returns {Array} Conflict issues
 */
function checkDependencyConflicts(module) {
  const issues = [];

  // Check for duplicate dependencies with different versions
  const depVersions = new Map();

  for (const dep of module.dependencies) {
    const baseName = dep.name.split('/').slice(0, 3).join('/'); // Get base package path

    if (depVersions.has(baseName)) {
      const existing = depVersions.get(baseName);
      if (existing.version !== dep.version) {
        issues.push({
          tool: 'conflict-scanner',
          severity: 'warning',
          category: 'compatibility',
          package: dep.name,
          currentVersion: dep.version,
          message: `Potential version conflict with ${existing.name}@${existing.version}`,
          suggestion: 'Ensure compatible versions or use replace directive',
          code: 'version-conflict',
          type: 'conflict',
        });
      }
    } else {
      depVersions.set(baseName, dep);
    }
  }

  return issues;
}

/**
 * Creates a temporary Go module for dependency analysis
 * @param {string} projectPath - Project directory
 * @param {string} goMod - go.mod content
 * @param {string} goSum - go.sum content
 */
async function createDependencyProject(projectPath, goMod, goSum) {
  // Write go.mod
  await writeFile(join(projectPath, 'go.mod'), goMod, 'utf8');

  // Write go.sum if provided
  if (goSum) {
    await writeFile(join(projectPath, 'go.sum'), goSum, 'utf8');
  }

  // Create a dummy main.go to make it a valid module
  const dummyMain = `package main

import "fmt"

func main() {
    fmt.Println("Dependency analysis")
}`;
  await writeFile(join(projectPath, 'main.go'), dummyMain, 'utf8');
}

/**
 * Filters and sorts dependency issues
 * @param {Array} issues - Raw dependency issues
 * @param {Object} options - Filter and sort options
 * @returns {Object} Filtered and sorted results
 */
function filterAndSortIssues(issues, options) {
  let filtered = [...issues];

  // Filter by severity
  if (options.severity !== 'all') {
    const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    const minSeverity = severityOrder[options.severity] || 1;
    filtered = filtered.filter((issue) => severityOrder[issue.severity] >= minSeverity);
  }

  // Filter by category
  if (options.category !== 'all') {
    filtered = filtered.filter((issue) => issue.category === options.category);
  }

  // Sort issues
  filtered.sort((a, b) => {
    let aVal, bVal;

    switch (options.sortBy) {
      case 'severity':
        const severityOrder = { low: 1, medium: 2, high: 3, critical: 4 };
        aVal = severityOrder[a.severity] || 0;
        bVal = severityOrder[b.severity] || 0;
        break;
      case 'package':
        aVal = a.package;
        bVal = b.package;
        break;
      case 'category':
        aVal = a.category;
        bVal = b.category;
        break;
      case 'version':
        aVal = a.currentVersion;
        bVal = b.currentVersion;
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
    issues: filtered.slice(start, end),
    total: filtered.length,
    hasMore: end < filtered.length,
  };
}

/**
 * Main dependency scanning function
 * @param {Object} args - Dependency scan arguments
 * @returns {Promise<Object>} Dependency scan results
 */
async function scanGoDependencies(args) {
  const {
    goMod,
    goSum,
    scanType = 'all',
    severity = 'medium',
    includeIndirect = true,
    category = 'all',
    limit = 50,
    offset = 0,
    sortBy = 'severity',
    sortOrder = 'desc',
  } = args;

  // Validate go.mod content
  if (!isValidGoModule(goMod)) {
    return {
      content: [
        {
          type: 'text',
          text: '❌ Error: Invalid go.mod file format. Must contain module and go directives.',
        },
      ],
    };
  }

  // Parse go.mod
  const module = parseGoMod(goMod);

  // Create temporary directory
  const tempId = randomBytes(8).toString('hex');
  const tempDir = join(tmpdir(), `go-deps-${tempId}`);

  try {
    await mkdir(tempDir, { recursive: true });
    await createDependencyProject(tempDir, goMod, goSum);

    // Get dependency information
    let dependencyInfo = [];
    try {
      dependencyInfo = await withTimeout(runGoList(tempDir, includeIndirect), LINT_TIMEOUT_MS);
    } catch (error) {
      // Continue with static analysis if go list fails
      console.warn('go list failed, continuing with static analysis:', error.message);
    }

    // Analyze dependencies
    const issues = analyzeDependencies(module, dependencyInfo, scanType);

    // Filter and sort results
    const result = filterAndSortIssues(issues, {
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
      module: {
        name: module.name,
        goVersion: module.goVersion,
        totalDependencies: module.dependencies.length,
        directDependencies: module.dependencies.filter((d) => !d.indirect).length,
        indirectDependencies: module.dependencies.filter((d) => d.indirect).length,
      },
      scanType,
      severityBreakdown: {},
      categoryBreakdown: {},
      typeBreakdown: {},
    };

    // Calculate breakdowns
    for (const issue of issues) {
      summary.severityBreakdown[issue.severity] =
        (summary.severityBreakdown[issue.severity] || 0) + 1;
      summary.categoryBreakdown[issue.category] =
        (summary.categoryBreakdown[issue.category] || 0) + 1;
      summary.typeBreakdown[issue.type] = (summary.typeBreakdown[issue.type] || 0) + 1;
    }

    // Format output
    let output = '# Go Dependency Scan Results\n\n';
    output += `**Module**: ${module.name}\n`;
    output += `**Go Version**: ${module.goVersion}\n`;
    output += `**Scan Type**: ${scanType}\n`;
    output += `**Scan Date**: ${new Date().toISOString()}\n\n`;

    output += '## Module Summary\n';
    output += `- **Total Dependencies**: ${summary.module.totalDependencies}\n`;
    output += `- **Direct Dependencies**: ${summary.module.directDependencies}\n`;
    output += `- **Indirect Dependencies**: ${summary.module.indirectDependencies}\n`;

    if (module.replacements.length > 0) {
      output += `- **Replacements**: ${module.replacements.length}\n`;
    }
    if (module.exclusions.length > 0) {
      output += `- **Exclusions**: ${module.exclusions.length}\n`;
    }

    output += '\n## Analysis Summary\n';
    output += `- **Total Issues**: ${summary.totalIssues}\n`;
    output += `- **Showing**: ${summary.issuesShown} (offset: ${offset})\n`;

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

    if (result.issues.length > 0) {
      output += '\n## Dependency Issues\n\n';

      for (const issue of result.issues) {
        const severityIcon =
          issue.severity === 'critical'
            ? '🔴'
            : issue.severity === 'high'
              ? '🟠'
              : issue.severity === 'medium'
                ? '🟡'
                : '🔵';

        output += `### ${severityIcon} ${issue.package}\n`;
        output += `**Tool**: ${issue.tool}\n`;
        output += `**Severity**: ${issue.severity}\n`;
        output += `**Category**: ${issue.category}\n`;
        output += `**Current Version**: ${issue.currentVersion}\n`;

        if (issue.latestVersion) {
          output += `**Latest Version**: ${issue.latestVersion}\n`;
        }

        output += `**Message**: ${issue.message}\n`;

        if (issue.suggestion) {
          output += `**Suggestion**: ${issue.suggestion}\n`;
        }

        output += '\n';
      }
    } else {
      output += '\n## ✅ No Dependency Issues Found\n\n';
      output += 'Great! Your dependencies appear to be up-to-date and secure.\n\n';
    }

    // Add dependency recommendations
    output += '## 📦 Dependency Recommendations\n\n';
    if (summary.totalIssues > 0) {
      output += '- **Security Issues**: Address immediately to prevent vulnerabilities\n';
      output += '- **Outdated Packages**: Update to latest stable versions\n';
      output += '- **License Issues**: Review license compatibility with your project\n';
    } else {
      output += '- Keep dependencies updated regularly\n';
      output += '- Monitor for security advisories\n';
    }

    output += '- Run `go mod tidy` to clean up unused dependencies\n';
    output += '- Use `go get -u` to update to latest versions\n';
    output += '- Consider `go mod why <package>` to understand dependency usage\n';
    output += '- Use `go list -m -u all` to check for available updates\n';

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
      ],
      summary,
      issues: result.issues,
      module: summary.module,
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: Go dependency scan failed\n\nDetails: ${error.message}`,
        },
      ],
    };
  } finally {
    // Cleanup
    try {
      await unlink(join(tempDir, 'go.mod'));
      await unlink(join(tempDir, 'main.go'));
      if (goSum) {
        await unlink(join(tempDir, 'go.sum'));
      }
    } catch (cleanupError) {
      // Ignore cleanup errors
    }
  }
}
export { scanGoDependencies };
