/**
 * Comprehensive Audit Completion Tool
 * Performs complete repository audit and generates readiness report
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export const auditCompletionTool = {
  name: 'audit_completion',
  description:
    'Performs comprehensive repository audit and generates complete readiness report for version bumps and releases',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory to audit (defaults to current directory)',
        default: '.',
      },
      auditType: {
        type: 'string',
        enum: ['release', 'security', 'quality', 'complete'],
        description: 'Type of audit to perform',
        default: 'complete',
      },
      generateReport: {
        type: 'boolean',
        description: 'Generate detailed audit report file',
        default: true,
      },
      fixIssues: {
        type: 'boolean',
        description: 'Automatically fix issues where possible',
        default: false,
      },
      targetVersion: {
        type: 'string',
        description: 'Target version for release readiness check (e.g., "2.1.5")',
      },
      strictMode: {
        type: 'boolean',
        description: 'Enable strict mode for production-ready validation',
        default: true,
      },
    },
  },
};

export async function handleAuditCompletion(args) {
  const {
    projectPath = '.',
    auditType = 'complete',
    generateReport = true,
    fixIssues = false,
    targetVersion,
    strictMode = true,
  } = args;

  try {
    const auditResults = await performComprehensiveAudit({
      projectPath,
      auditType,
      fixIssues,
      targetVersion,
      strictMode,
    });

    if (generateReport) {
      await generateAuditReport(auditResults, projectPath);
    }

    return {
      content: [
        {
          type: 'text',
          text: formatAuditResults(auditResults),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: `Audit completion failed: ${error.message}`,
              timestamp: new Date().toISOString(),
            },
            null,
            2,
          ),
        },
      ],
    };
  }
}

async function performComprehensiveAudit({
  projectPath,
  auditType,
  fixIssues,
  targetVersion,
  strictMode,
}) {
  const results = {
    timestamp: new Date().toISOString(),
    projectPath,
    auditType,
    targetVersion,
    strictMode,
    overall: {
      score: 0,
      status: 'unknown',
      readyForRelease: false,
      criticalIssues: 0,
      warnings: 0,
      recommendations: [],
    },
    sections: {},
  };

  // 1. Version Consistency Check
  if (auditType === 'complete' || auditType === 'release') {
    results.sections.versionConsistency = await auditVersionConsistency(
      projectPath,
      targetVersion,
      fixIssues,
    );
  }

  // 2. Security Audit
  if (auditType === 'complete' || auditType === 'security') {
    results.sections.security = await auditSecurity(projectPath, strictMode);
  }

  // 3. Code Quality Audit
  if (auditType === 'complete' || auditType === 'quality') {
    results.sections.codeQuality = await auditCodeQuality(projectPath, strictMode);
  }

  // 4. Test Coverage and Status
  if (auditType === 'complete' || auditType === 'quality') {
    results.sections.testing = await auditTesting(projectPath);
  }

  // 5. Documentation Audit
  if (auditType === 'complete') {
    results.sections.documentation = await auditDocumentation(projectPath);
  }

  // 6. CI/CD and Release Readiness
  if (auditType === 'complete' || auditType === 'release') {
    results.sections.cicd = await auditCICD(projectPath);
  }

  // 7. Dependencies and Licensing
  if (auditType === 'complete' || auditType === 'security') {
    results.sections.dependencies = await auditDependencies(projectPath);
  }

  // 8. Git State and Repository Health
  if (auditType === 'complete' || auditType === 'release') {
    results.sections.repository = await auditRepository(projectPath);
  }

  // Calculate overall score and status
  calculateOverallScore(results);

  return results;
}

async function auditVersionConsistency(projectPath, targetVersion, fixIssues) {
  const result = {
    score: 0,
    status: 'fail',
    issues: [],
    fixes: [],
  };

  try {
    const packageJsonPath = join(projectPath, 'package.json');
    const readmePath = join(projectPath, 'README.md');

    let packageJson = {};
    let readmeContent = '';
    let gitTags = [];

    // Read package.json
    if (existsSync(packageJsonPath)) {
      packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    } else {
      result.issues.push('package.json not found');
      return result;
    }

    // Read README
    if (existsSync(readmePath)) {
      readmeContent = readFileSync(readmePath, 'utf8');
    }

    // Get git tags
    try {
      const gitTagOutput = execSync('git tag --sort=-version:refname', {
        cwd: projectPath,
        encoding: 'utf8',
      });
      gitTags = gitTagOutput
        .trim()
        .split('\n')
        .filter((tag) => tag);
    } catch (error) {
      result.issues.push('Failed to read git tags');
    }

    const packageVersion = packageJson.version;
    const latestTag = gitTags[0];

    // Extract version from README badge
    const versionBadgeMatch = readmeContent.match(/version-([^-]+)-/);
    const readmeVersion = versionBadgeMatch ? versionBadgeMatch[1] : null;

    // Check consistency
    let consistentVersions = 0;
    const totalChecks = 3;

    if (packageVersion) {
      result.packageVersion = packageVersion;
      consistentVersions++;
    } else {
      result.issues.push('No version in package.json');
    }

    if (readmeVersion) {
      result.readmeVersion = readmeVersion;
      if (readmeVersion === packageVersion) {
        consistentVersions++;
      } else {
        result.issues.push(
          `README version (${readmeVersion}) doesn't match package.json (${packageVersion})`,
        );
        if (fixIssues && packageVersion) {
          // Fix README version
          const newReadmeContent = readmeContent.replace(
            /version-[^-]+-/,
            `version-${packageVersion}-`,
          );
          writeFileSync(readmePath, newReadmeContent);
          result.fixes.push(`Updated README version to ${packageVersion}`);
        }
      }
    } else {
      result.issues.push('No version badge found in README');
    }

    if (latestTag) {
      result.latestTag = latestTag;
      const tagVersion = latestTag.replace(/^v/, '');
      if (tagVersion === packageVersion) {
        consistentVersions++;
      } else {
        result.issues.push(
          `Latest git tag (${latestTag}) doesn't match package.json (${packageVersion})`,
        );
      }
    } else {
      result.issues.push('No git tags found');
    }

    // Check target version
    if (targetVersion) {
      result.targetVersion = targetVersion;
      if (packageVersion !== targetVersion) {
        result.issues.push(
          `Current version (${packageVersion}) doesn't match target (${targetVersion})`,
        );
        if (fixIssues) {
          // Update package.json version
          packageJson.version = targetVersion;
          writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          result.fixes.push(`Updated package.json version to ${targetVersion}`);
        }
      }
    }

    result.score = Math.round((consistentVersions / totalChecks) * 100);
    result.status = result.score >= 80 ? 'pass' : result.score >= 60 ? 'warning' : 'fail';
  } catch (error) {
    result.issues.push(`Version consistency check failed: ${error.message}`);
  }

  return result;
}

async function auditSecurity(projectPath, strictMode) {
  const result = {
    score: 100,
    status: 'pass',
    vulnerabilities: [],
    issues: [],
  };

  try {
    // Run security audit
    try {
      const auditOutput = execSync('bun audit --json', {
        cwd: projectPath,
        encoding: 'utf8',
      });
      const auditData = JSON.parse(auditOutput);

      if (auditData.vulnerabilities && auditData.vulnerabilities.length > 0) {
        result.vulnerabilities = auditData.vulnerabilities;
        result.score = Math.max(0, 100 - auditData.vulnerabilities.length * 10);
        result.status = auditData.vulnerabilities.some((v) => v.severity === 'critical')
          ? 'fail'
          : 'warning';
      }
    } catch (error) {
      // Try npm audit as fallback
      try {
        const npmAuditOutput = execSync('npm audit --json', {
          cwd: projectPath,
          encoding: 'utf8',
        });
        const npmAuditData = JSON.parse(npmAuditOutput);

        if (npmAuditData.vulnerabilities) {
          const vulnCount = Object.keys(npmAuditData.vulnerabilities).length;
          if (vulnCount > 0) {
            result.vulnerabilities = Object.values(npmAuditData.vulnerabilities);
            result.score = Math.max(0, 100 - vulnCount * 10);
            result.status = 'warning';
          }
        }
      } catch (npmError) {
        result.issues.push('Security audit failed - no package manager available');
        result.score = strictMode ? 0 : 80;
        result.status = strictMode ? 'fail' : 'warning';
      }
    }
  } catch (error) {
    result.issues.push(`Security audit failed: ${error.message}`);
    result.score = strictMode ? 0 : 50;
    result.status = 'fail';
  }

  return result;
}

async function auditCodeQuality(projectPath, strictMode) {
  const result = {
    score: 0,
    status: 'unknown',
    linting: { passed: false, errors: 0, warnings: 0 },
    formatting: { consistent: false },
    issues: [],
  };

  try {
    // Check for linting
    try {
      execSync('bun run lint', { cwd: projectPath, stdio: 'pipe' });
      result.linting.passed = true;
      result.score += 50;
    } catch (error) {
      const output = error.stdout?.toString() || error.stderr?.toString() || '';
      const errorMatch = output.match(/(\d+) error/);
      const warningMatch = output.match(/(\d+) warning/);

      result.linting.errors = errorMatch ? parseInt(errorMatch[1]) : 0;
      result.linting.warnings = warningMatch ? parseInt(warningMatch[1]) : 0;

      if (result.linting.errors === 0) {
        result.score += 40;
      } else if (result.linting.errors < 5) {
        result.score += 20;
      }
    }

    // Check for type checking (if TypeScript)
    try {
      execSync('bun run type-check', { cwd: projectPath, stdio: 'pipe' });
      result.score += 30;
    } catch (error) {
      // TypeScript errors found or no type-check script
      result.issues.push('Type checking failed or not configured');
      if (strictMode) {
        result.score = Math.max(0, result.score - 20);
      }
    }

    // Basic file structure checks
    const requiredFiles = ['package.json', 'README.md', 'LICENSE'];
    const existingFiles = requiredFiles.filter((file) => existsSync(join(projectPath, file)));
    result.score += (existingFiles.length / requiredFiles.length) * 20;

    result.status = result.score >= 80 ? 'pass' : result.score >= 60 ? 'warning' : 'fail';
  } catch (error) {
    result.issues.push(`Code quality audit failed: ${error.message}`);
    result.status = 'fail';
  }

  return result;
}

async function auditTesting(projectPath) {
  const result = {
    score: 0,
    status: 'unknown',
    testsExist: false,
    testsPassing: false,
    passRate: 0,
    totalTests: 0,
    passingTests: 0,
    issues: [],
  };

  try {
    // Check if tests exist
    const packageJsonPath = join(projectPath, 'package.json');
    if (existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
      if (packageJson.scripts && packageJson.scripts.test) {
        result.testsExist = true;
        result.score += 30;

        // Run tests
        try {
          const testOutput = execSync('bun test', {
            cwd: projectPath,
            encoding: 'utf8',
            stdio: 'pipe',
          });

          // Parse test results
          const passMatch = testOutput.match(/(\d+) pass/);
          const failMatch = testOutput.match(/(\d+) fail/);

          result.passingTests = passMatch ? parseInt(passMatch[1]) : 0;
          const failingTests = failMatch ? parseInt(failMatch[1]) : 0;
          result.totalTests = result.passingTests + failingTests;

          if (result.totalTests > 0) {
            result.passRate = (result.passingTests / result.totalTests) * 100;
            result.testsPassing = result.passRate === 100;

            if (result.passRate >= 95) {
              result.score += 70;
            } else if (result.passRate >= 80) {
              result.score += 50;
            } else if (result.passRate >= 60) {
              result.score += 30;
            } else {
              result.score += 10;
            }
          }
        } catch (error) {
          result.issues.push('Tests failed to run or some tests are failing');
          result.score += 20; // Some credit for having tests
        }
      } else {
        result.issues.push('No test script found in package.json');
      }
    }

    result.status = result.score >= 80 ? 'pass' : result.score >= 60 ? 'warning' : 'fail';
  } catch (error) {
    result.issues.push(`Testing audit failed: ${error.message}`);
    result.status = 'fail';
  }

  return result;
}

async function auditDocumentation(projectPath) {
  const result = {
    score: 0,
    status: 'unknown',
    files: {},
    issues: [],
  };

  try {
    const docFiles = [
      { name: 'README.md', weight: 40, required: true },
      { name: 'LICENSE', weight: 20, required: true },
      { name: 'CHANGELOG.md', weight: 15, required: false },
      { name: 'CONTRIBUTING.md', weight: 10, required: false },
      { name: 'docs/', weight: 15, required: false, isDir: true },
    ];

    for (const docFile of docFiles) {
      const filePath = join(projectPath, docFile.name);
      const exists = existsSync(filePath);

      result.files[docFile.name] = {
        exists,
        required: docFile.required,
        weight: docFile.weight,
      };

      if (exists) {
        result.score += docFile.weight;

        if (docFile.name === 'README.md') {
          // Check README quality
          const content = readFileSync(filePath, 'utf8');
          if (content.length < 500) {
            result.issues.push('README.md is quite short - consider adding more details');
            result.score -= 10;
          }
          if (!content.includes('## Installation') && !content.includes('# Installation')) {
            result.issues.push('README.md missing installation instructions');
            result.score -= 5;
          }
        }
      } else if (docFile.required) {
        result.issues.push(`Required file ${docFile.name} is missing`);
        result.score -= docFile.weight / 2;
      }
    }

    result.status = result.score >= 80 ? 'pass' : result.score >= 60 ? 'warning' : 'fail';
  } catch (error) {
    result.issues.push(`Documentation audit failed: ${error.message}`);
    result.status = 'fail';
  }

  return result;
}

async function auditCICD(projectPath) {
  const result = {
    score: 0,
    status: 'unknown',
    workflows: [],
    issues: [],
  };

  try {
    const githubWorkflowsPath = join(projectPath, '.github', 'workflows');

    if (existsSync(githubWorkflowsPath)) {
      const workflowFiles = execSync('ls', {
        cwd: githubWorkflowsPath,
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));

      result.workflows = workflowFiles;
      result.score += Math.min(workflowFiles.length * 20, 80);

      // Check for essential workflows
      const hasCI = workflowFiles.some((f) => f.includes('ci') || f.includes('test'));
      const hasRelease = workflowFiles.some((f) => f.includes('release') || f.includes('publish'));

      if (hasCI) result.score += 10;
      if (hasRelease) result.score += 10;

      if (!hasCI) result.issues.push('No CI workflow found');
      if (!hasRelease) result.issues.push('No release workflow found');
    } else {
      result.issues.push('No GitHub workflows found');
    }

    result.status = result.score >= 80 ? 'pass' : result.score >= 40 ? 'warning' : 'fail';
  } catch (error) {
    result.issues.push(`CI/CD audit failed: ${error.message}`);
    result.status = 'fail';
  }

  return result;
}

async function auditDependencies(projectPath) {
  const result = {
    score: 100,
    status: 'pass',
    outdated: [],
    issues: [],
  };

  try {
    // Check for outdated dependencies
    try {
      const outdatedOutput = execSync('bun outdated --json', {
        cwd: projectPath,
        encoding: 'utf8',
      });
      const outdatedData = JSON.parse(outdatedOutput);

      if (outdatedData && Object.keys(outdatedData).length > 0) {
        result.outdated = Object.keys(outdatedData);
        result.score = Math.max(50, 100 - result.outdated.length * 5);
        result.status = result.outdated.length > 10 ? 'warning' : 'pass';
      }
    } catch (error) {
      // Outdated check failed, but not critical
      result.issues.push('Could not check for outdated dependencies');
      result.score = 90;
    }
  } catch (error) {
    result.issues.push(`Dependencies audit failed: ${error.message}`);
    result.status = 'warning';
    result.score = 70;
  }

  return result;
}

async function auditRepository(projectPath) {
  const result = {
    score: 0,
    status: 'unknown',
    gitStatus: 'unknown',
    uncommittedFiles: [],
    issues: [],
  };

  try {
    // Check git status
    try {
      const gitStatusOutput = execSync('git status --porcelain', {
        cwd: projectPath,
        encoding: 'utf8',
      });

      if (gitStatusOutput.trim()) {
        result.uncommittedFiles = gitStatusOutput.trim().split('\n');
        result.gitStatus = 'dirty';
        result.issues.push(`${result.uncommittedFiles.length} uncommitted files found`);
        result.score = 60;
      } else {
        result.gitStatus = 'clean';
        result.score = 100;
      }
    } catch (error) {
      result.issues.push('Not a git repository or git command failed');
      result.score = 50;
    }

    result.status = result.score >= 80 ? 'pass' : result.score >= 60 ? 'warning' : 'fail';
  } catch (error) {
    result.issues.push(`Repository audit failed: ${error.message}`);
    result.status = 'fail';
  }

  return result;
}

function calculateOverallScore(results) {
  const sections = results.sections;
  const weights = {
    versionConsistency: 20,
    security: 25,
    codeQuality: 20,
    testing: 15,
    documentation: 10,
    cicd: 5,
    dependencies: 3,
    repository: 2,
  };

  let totalScore = 0;
  let totalWeight = 0;
  let criticalIssues = 0;
  let warnings = 0;

  for (const [sectionName, sectionResult] of Object.entries(sections)) {
    if (sectionResult && typeof sectionResult.score === 'number') {
      const weight = weights[sectionName] || 1;
      totalScore += sectionResult.score * weight;
      totalWeight += weight;

      if (sectionResult.status === 'fail') {
        criticalIssues++;
      } else if (sectionResult.status === 'warning') {
        warnings++;
      }
    }
  }

  results.overall.score = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0;
  results.overall.criticalIssues = criticalIssues;
  results.overall.warnings = warnings;

  // Determine overall status
  if (criticalIssues > 0 || results.overall.score < 60) {
    results.overall.status = 'fail';
    results.overall.readyForRelease = false;
  } else if (warnings > 2 || results.overall.score < 80) {
    results.overall.status = 'warning';
    results.overall.readyForRelease = false;
  } else {
    results.overall.status = 'pass';
    results.overall.readyForRelease = true;
  }

  // Generate recommendations
  generateRecommendations(results);
}

function generateRecommendations(results) {
  const recommendations = [];

  if (results.sections.versionConsistency?.score < 80) {
    recommendations.push(
      '🔴 CRITICAL: Fix version consistency across package.json, README, and git tags',
    );
  }

  if (results.sections.security?.vulnerabilities?.length > 0) {
    recommendations.push('🔴 CRITICAL: Address security vulnerabilities in dependencies');
  }

  if (results.sections.testing?.passRate < 95) {
    recommendations.push('🟡 Fix failing tests before release');
  }

  if (results.sections.repository?.gitStatus === 'dirty') {
    recommendations.push('🟡 Commit or revert uncommitted changes');
  }

  if (results.sections.codeQuality?.linting?.errors > 0) {
    recommendations.push('🟡 Fix linting errors');
  }

  if (!results.sections.documentation?.files?.['CHANGELOG.md']?.exists) {
    recommendations.push('📝 Add CHANGELOG.md for version history');
  }

  if (results.overall.readyForRelease) {
    recommendations.push('✅ Repository is ready for release!');
  } else {
    recommendations.push('❌ Repository needs fixes before release');
  }

  results.overall.recommendations = recommendations;
}

async function generateAuditReport(results, projectPath) {
  const reportPath = join(projectPath, 'AUDIT_REPORT.md');
  const report = `# Comprehensive Audit Report

**Generated**: ${results.timestamp}
**Project**: ${results.projectPath}
**Audit Type**: ${results.auditType}
**Target Version**: ${results.targetVersion || 'N/A'}

## 📊 Overall Results

- **Score**: ${results.overall.score}/100
- **Status**: ${results.overall.status.toUpperCase()}
- **Ready for Release**: ${results.overall.readyForRelease ? '✅ YES' : '❌ NO'}
- **Critical Issues**: ${results.overall.criticalIssues}
- **Warnings**: ${results.overall.warnings}

## 🎯 Recommendations

${results.overall.recommendations.map((rec) => `- ${rec}`).join('\n')}

## 📋 Detailed Results

${Object.entries(results.sections)
  .map(
    ([name, section]) => `
### ${name.charAt(0).toUpperCase() + name.slice(1)}

- **Score**: ${section.score}/100
- **Status**: ${section.status.toUpperCase()}
${section.issues?.length > 0 ? `- **Issues**: ${section.issues.length}\n${section.issues.map((issue) => `  - ${issue}`).join('\n')}` : ''}
${section.fixes?.length > 0 ? `- **Fixes Applied**: ${section.fixes.length}\n${section.fixes.map((fix) => `  - ${fix}`).join('\n')}` : ''}
`,
  )
  .join('\n')}

---
*Report generated by MOIDVK Audit Completion Tool*
`;

  writeFileSync(reportPath, report);
  console.log(`📄 Audit report saved to: ${reportPath}`);
}

function formatAuditResults(results) {
  const statusEmoji = {
    pass: '✅',
    warning: '⚠️',
    fail: '❌',
    unknown: '❓',
  };

  return `🔍 **MOIDVK Comprehensive Audit Results**

## 📊 Overall Assessment
${statusEmoji[results.overall.status]} **Status**: ${results.overall.status.toUpperCase()}
📈 **Score**: ${results.overall.score}/100
🚀 **Ready for Release**: ${results.overall.readyForRelease ? '✅ YES' : '❌ NO'}
🚨 **Critical Issues**: ${results.overall.criticalIssues}
⚠️ **Warnings**: ${results.overall.warnings}

## 🎯 Key Recommendations
${results.overall.recommendations.map((rec) => `${rec}`).join('\n')}

## 📋 Section Breakdown
${Object.entries(results.sections)
  .map(([name, section]) => `**${name}**: ${statusEmoji[section.status]} ${section.score}/100`)
  .join('\n')}

${
  results.overall.readyForRelease
    ? '🎉 **Congratulations!** Your repository is ready for release.'
    : '🔧 **Action Required**: Please address the issues above before releasing.'
}

---
*Audit completed at ${results.timestamp}*
*Target version: ${results.targetVersion || 'Not specified'}*`;
}
