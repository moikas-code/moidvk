/**
 * License Compliance Scanner
 * Analyzes project dependencies for license compatibility and compliance issues
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, basename } from 'path';

const execAsync = promisify(exec);

/**
 * License Compliance Scanner Tool
 */
export const licenseComplianceScannerTool = {
  name: 'license_compliance_scanner',
  description: 'Scans project dependencies for license compatibility, compliance issues, and potential legal risks. Supports npm, pip, cargo, and other package managers.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory to scan',
        default: '.',
      },
      packageManager: {
        type: 'string',
        enum: ['auto', 'npm', 'yarn', 'pnpm', 'bun', 'pip', 'pipenv', 'poetry', 'cargo'],
        default: 'auto',
        description: 'Package manager to use (auto-detect if not specified)',
      },
      projectLicense: {
        type: 'string',
        description: 'Your project\'s license (e.g., "MIT", "Apache-2.0") for compatibility checking',
      },
      strictness: {
        type: 'string',
        enum: ['lenient', 'standard', 'strict', 'enterprise'],
        default: 'standard',
        description: 'License compliance strictness level',
      },
      includeDev: {
        type: 'boolean',
        default: false,
        description: 'Include development dependencies in scan',
      },
      checkCompatibility: {
        type: 'boolean',
        default: true,
        description: 'Check license compatibility with project license',
      },
      flagRiskyLicenses: {
        type: 'boolean',
        default: true,
        description: 'Flag licenses with potential legal risks',
      },
      generateReport: {
        type: 'boolean',
        default: true,
        description: 'Generate detailed compliance report',
      },
      format: {
        type: 'string',
        enum: ['detailed', 'summary', 'csv', 'json'],
        default: 'detailed',
        description: 'Output format for the scan results',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 100)',
        default: 100,
        minimum: 1,
        maximum: 1000,
      },
      offset: {
        type: 'number',
        description: 'Starting index for pagination (default: 0)',
        default: 0,
        minimum: 0,
      },
    },
    required: [],
  },
};

/**
 * Handle license compliance scanning
 */
export async function handleLicenseComplianceScanner(request) {
  try {
    const { 
      projectPath = '.',
      packageManager = 'auto',
      projectLicense,
      strictness = 'standard',
      includeDev = false,
      checkCompatibility = true,
      flagRiskyLicenses = true,
      generateReport = true,
      format = 'detailed',
      limit = 100,
      offset = 0,
    } = request.params;

    // Detect project type and dependencies
    const projectAnalysis = await analyzeProjectStructure(projectPath, packageManager);
    
    if (projectAnalysis.dependencies.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '❌ No dependency files found or dependencies could not be analyzed',
        }],
      };
    }

    const analysis = {
      projectPath,
      packageManager: projectAnalysis.packageManager,
      projectLicense,
      strictness,
      dependencies: [],
      licenses: new Map(),
      issues: [],
      compatibility: {
        compatible: [],
        incompatible: [],
        unknown: [],
      },
      risks: {
        high: [],
        medium: [],
        low: [],
      },
      summary: {
        totalDependencies: 0,
        licensedDependencies: 0,
        unlicensedDependencies: 0,
        riskyLicenses: 0,
        compatibilityIssues: 0,
      },
    };

    // Analyze dependencies for each detected package manager
    for (const depFile of projectAnalysis.dependencies) {
      await analyzeDependencyFile(depFile, analysis, {
        includeDev,
        checkCompatibility,
        flagRiskyLicenses,
        strictness,
      });
    }

    // Perform license compatibility analysis
    if (checkCompatibility && projectLicense) {
      performCompatibilityAnalysis(analysis, projectLicense);
    }

    // Flag risky licenses
    if (flagRiskyLicenses) {
      flagRiskyLicensePatterns(analysis, strictness);
    }

    // Generate compliance recommendations
    generateComplianceRecommendations(analysis);

    // Calculate summary statistics
    calculateLicenseSummary(analysis);

    // Filter and paginate issues
    const filteredIssues = analysis.issues.slice(offset, offset + limit);

    // Build response based on format
    const response = buildLicenseResponse(analysis, filteredIssues, format, {
      offset,
      limit,
      generateReport,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[LicenseComplianceScanner] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ License compliance scan failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Analyze project structure to detect package managers and dependencies
 */
async function analyzeProjectStructure(projectPath, packageManager) {
  const structure = {
    packageManager: 'unknown',
    dependencies: [],
  };

  const packageFiles = [
    // JavaScript/Node.js
    { file: 'package.json', manager: 'npm', lockFiles: ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'] },
    
    // Python
    { file: 'requirements.txt', manager: 'pip' },
    { file: 'Pipfile', manager: 'pipenv', lockFiles: ['Pipfile.lock'] },
    { file: 'pyproject.toml', manager: 'poetry', lockFiles: ['poetry.lock'] },
    { file: 'setup.py', manager: 'pip' },
    
    // Rust
    { file: 'Cargo.toml', manager: 'cargo', lockFiles: ['Cargo.lock'] },
    
    // Go
    { file: 'go.mod', manager: 'go', lockFiles: ['go.sum'] },
    
    // Ruby
    { file: 'Gemfile', manager: 'bundler', lockFiles: ['Gemfile.lock'] },
    
    // PHP
    { file: 'composer.json', manager: 'composer', lockFiles: ['composer.lock'] },
  ];

  for (const { file, manager, lockFiles = [] } of packageFiles) {
    const filePath = join(projectPath, file);
    
    if (existsSync(filePath)) {
      const depInfo = {
        file: filePath,
        manager,
        content: null,
        lockFile: null,
      };

      try {
        depInfo.content = readFileSync(filePath, 'utf8');
        
        // Find corresponding lock file
        for (const lockFile of lockFiles) {
          const lockPath = join(projectPath, lockFile);
          if (existsSync(lockPath)) {
            depInfo.lockFile = lockPath;
            break;
          }
        }
        
        structure.dependencies.push(depInfo);
        
        if (structure.packageManager === 'unknown' || packageManager === manager) {
          structure.packageManager = manager;
        }
      } catch (error) {
        // Skip files we can't read
        continue;
      }
    }
  }

  return structure;
}

/**
 * Analyze a dependency file for licenses
 */
async function analyzeDependencyFile(depFile, analysis, options) {
  try {
    switch (depFile.manager) {
      case 'npm':
        await analyzeNpmDependencies(depFile, analysis, options);
        break;
      case 'pip':
        await analyzePipDependencies(depFile, analysis, options);
        break;
      case 'cargo':
        await analyzeCargoDependencies(depFile, analysis, options);
        break;
      case 'pipenv':
        await analyzePipenvDependencies(depFile, analysis, options);
        break;
      case 'poetry':
        await analyzePoetryDependencies(depFile, analysis, options);
        break;
      case 'go':
        await analyzeGoDependencies(depFile, analysis, options);
        break;
      case 'bundler':
        await analyzeGemDependencies(depFile, analysis, options);
        break;
      case 'composer':
        await analyzeComposerDependencies(depFile, analysis, options);
        break;
      default:
        // Generic analysis
        await analyzeGenericDependencies(depFile, analysis, options);
    }
  } catch (error) {
    analysis.issues.push({
      type: 'analysis_error',
      severity: 'medium',
      message: `Failed to analyze ${depFile.file}: ${error.message}`,
      file: depFile.file,
      recommendation: 'Check file format and permissions',
    });
  }
}

/**
 * Analyze npm/yarn/pnpm dependencies
 */
async function analyzeNpmDependencies(depFile, analysis, options) {
  const packageJson = JSON.parse(depFile.content);
  const deps = { ...packageJson.dependencies };
  
  if (options.includeDev && packageJson.devDependencies) {
    Object.assign(deps, packageJson.devDependencies);
  }

  // Try to get license information using npm license checker if available
  try {
    const projectDir = dirname(depFile.file);
    const { stdout } = await execAsync('npm list --json --depth=0 --prod', { 
      cwd: projectDir,
      timeout: 30000 
    });
    
    const npmData = JSON.parse(stdout);
    
    if (npmData.dependencies) {
      for (const [name, info] of Object.entries(npmData.dependencies)) {
        analysis.dependencies.push({
          name,
          version: info.version,
          license: extractLicenseFromNpmInfo(info),
          manager: 'npm',
          isDev: !packageJson.dependencies?.[name],
          path: info.path,
        });
      }
    }
  } catch (error) {
    // Fallback to basic package.json analysis
    for (const [name, version] of Object.entries(deps)) {
      analysis.dependencies.push({
        name,
        version: version.replace(/[^0-9.]/g, ''),
        license: 'unknown',
        manager: 'npm',
        isDev: !packageJson.dependencies?.[name],
      });
    }
  }
}

/**
 * Analyze pip dependencies
 */
async function analyzePipDependencies(depFile, analysis, options) {
  if (depFile.file.endsWith('requirements.txt')) {
    const lines = depFile.content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      
      const match = trimmed.match(/^([a-zA-Z0-9\-_.]+)([=<>!]+(.+))?/);
      if (match) {
        const [, name, , version] = match;
        
        analysis.dependencies.push({
          name,
          version: version || 'latest',
          license: 'unknown',
          manager: 'pip',
          isDev: false,
        });
      }
    }
  } else if (depFile.file.endsWith('setup.py')) {
    // Basic setup.py parsing
    const requiresMatch = depFile.content.match(/install_requires\s*=\s*\[(.*?)\]/s);
    if (requiresMatch) {
      const requires = requiresMatch[1];
      const packages = requires.match(/'([^']+)'/g) || [];
      
      for (const pkg of packages) {
        const name = pkg.replace(/['"]/g, '').split(/[=<>!]/)[0];
        analysis.dependencies.push({
          name,
          version: 'unknown',
          license: 'unknown',
          manager: 'pip',
          isDev: false,
        });
      }
    }
  }
}

/**
 * Analyze Cargo dependencies
 */
async function analyzeCargoDependencies(depFile, analysis, options) {
  const tomlContent = depFile.content;
  
  // Simple TOML parsing for dependencies
  const depSections = ['dependencies', 'dev-dependencies', 'build-dependencies'];
  
  for (const section of depSections) {
    const sectionMatch = tomlContent.match(new RegExp(`\\[${section}\\]([\\s\\S]*?)(?=\\[|$)`));
    if (sectionMatch) {
      const sectionContent = sectionMatch[1];
      const lines = sectionContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        
        const match = trimmed.match(/^([a-zA-Z0-9\-_]+)\s*=\s*"?([^"]+)"?/);
        if (match) {
          const [, name, version] = match;
          
          analysis.dependencies.push({
            name,
            version: version.replace(/[^0-9.]/g, ''),
            license: 'unknown',
            manager: 'cargo',
            isDev: section.includes('dev'),
          });
        }
      }
    }
  }
}

/**
 * Analyze other package managers (simplified implementations)
 */
async function analyzePipenvDependencies(depFile, analysis, options) {
  // Pipfile parsing would go here
  analysis.issues.push({
    type: 'unsupported_format',
    severity: 'low',
    message: 'Pipfile analysis not fully implemented',
    file: depFile.file,
    recommendation: 'Use pip-licenses tool for detailed analysis',
  });
}

async function analyzePoetryDependencies(depFile, analysis, options) {
  // pyproject.toml poetry parsing would go here
  analysis.issues.push({
    type: 'unsupported_format',
    severity: 'low',
    message: 'Poetry analysis not fully implemented',
    file: depFile.file,
    recommendation: 'Use poetry show command for license information',
  });
}

async function analyzeGoDependencies(depFile, analysis, options) {
  // go.mod parsing would go here
  analysis.issues.push({
    type: 'unsupported_format',
    severity: 'low',
    message: 'Go module analysis not fully implemented',
    file: depFile.file,
    recommendation: 'Use go-licenses tool for detailed analysis',
  });
}

async function analyzeGemDependencies(depFile, analysis, options) {
  // Gemfile parsing would go here
  analysis.issues.push({
    type: 'unsupported_format',
    severity: 'low',
    message: 'Ruby Gem analysis not fully implemented',
    file: depFile.file,
    recommendation: 'Use bundle exec license_finder for detailed analysis',
  });
}

async function analyzeComposerDependencies(depFile, analysis, options) {
  // composer.json parsing would go here
  analysis.issues.push({
    type: 'unsupported_format',
    severity: 'low',
    message: 'Composer analysis not fully implemented',
    file: depFile.file,
    recommendation: 'Use composer licenses command for detailed analysis',
  });
}

async function analyzeGenericDependencies(depFile, analysis, options) {
  analysis.issues.push({
    type: 'unknown_format',
    severity: 'low',
    message: `Unknown dependency file format: ${basename(depFile.file)}`,
    file: depFile.file,
    recommendation: 'Manually review licenses for this dependency file',
  });
}

/**
 * Extract license from npm package info
 */
function extractLicenseFromNpmInfo(info) {
  // This would integrate with actual npm license data
  // For now, return unknown
  return 'unknown';
}

/**
 * Perform license compatibility analysis
 */
function performCompatibilityAnalysis(analysis, projectLicense) {
  const compatibilityMatrix = getLicenseCompatibilityMatrix();
  const projectLicenseNormalized = normalizeLicenseName(projectLicense);
  
  for (const dep of analysis.dependencies) {
    const depLicenseNormalized = normalizeLicenseName(dep.license);
    
    if (depLicenseNormalized === 'unknown') {
      analysis.compatibility.unknown.push(dep);
      analysis.issues.push({
        type: 'unknown_license',
        severity: 'medium',
        message: `Unknown license for dependency: ${dep.name}`,
        dependency: dep.name,
        recommendation: 'Investigate license manually or contact package maintainer',
      });
    } else {
      const isCompatible = checkLicenseCompatibility(
        projectLicenseNormalized, 
        depLicenseNormalized, 
        compatibilityMatrix
      );
      
      if (isCompatible) {
        analysis.compatibility.compatible.push(dep);
      } else {
        analysis.compatibility.incompatible.push(dep);
        analysis.issues.push({
          type: 'license_incompatibility',
          severity: 'high',
          message: `License incompatibility: ${dep.name} (${dep.license}) incompatible with ${projectLicense}`,
          dependency: dep.name,
          projectLicense,
          dependencyLicense: dep.license,
          recommendation: 'Consider alternative package or relicense project',
        });
      }
    }
  }
}

/**
 * Flag risky license patterns
 */
function flagRiskyLicensePatterns(analysis, strictness) {
  const riskyLicenses = getRiskyLicenses(strictness);
  
  for (const dep of analysis.dependencies) {
    const licenseNormalized = normalizeLicenseName(dep.license);
    const riskLevel = riskyLicenses[licenseNormalized];
    
    if (riskLevel) {
      analysis.risks[riskLevel].push(dep);
      
      const severity = riskLevel === 'high' ? 'high' : 
                       riskLevel === 'medium' ? 'medium' : 'low';
      
      analysis.issues.push({
        type: 'risky_license',
        severity,
        message: `Risky license detected: ${dep.name} uses ${dep.license}`,
        dependency: dep.name,
        license: dep.license,
        riskLevel,
        recommendation: getRiskRecommendation(licenseNormalized, riskLevel),
      });
    }
  }
}

/**
 * Get license compatibility matrix
 */
function getLicenseCompatibilityMatrix() {
  return {
    'MIT': {
      compatible: ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC', 'Unlicense'],
      incompatible: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
    },
    'Apache-2.0': {
      compatible: ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC'],
      incompatible: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
    },
    'GPL-3.0': {
      compatible: ['GPL-3.0', 'LGPL-3.0', 'AGPL-3.0'],
      incompatible: ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'GPL-2.0'],
    },
    'BSD-3-Clause': {
      compatible: ['MIT', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', 'ISC'],
      incompatible: ['GPL-2.0', 'GPL-3.0', 'AGPL-3.0'],
    },
  };
}

/**
 * Get risky licenses based on strictness level
 */
function getRiskyLicenses(strictness) {
  const base = {
    'GPL-2.0': 'high',
    'GPL-3.0': 'high',
    'AGPL-3.0': 'high',
    'LGPL-2.1': 'medium',
    'LGPL-3.0': 'medium',
    'MPL-2.0': 'medium',
    'EPL-2.0': 'medium',
    'CDDL-1.0': 'medium',
  };

  if (strictness === 'enterprise' || strictness === 'strict') {
    return {
      ...base,
      'Copyleft': 'high',
      'WTFPL': 'medium',
      'Unlicense': 'low',
      'GPL-2.0-only': 'high',
      'GPL-3.0-only': 'high',
    };
  }

  return base;
}

/**
 * Normalize license name
 */
function normalizeLicenseName(license) {
  if (!license || license === 'unknown') return 'unknown';
  
  const normalized = license.toUpperCase()
    .replace(/\s+/g, '-')
    .replace(/[()]/g, '')
    .trim();
    
  // Common mappings
  const mappings = {
    'MIT': 'MIT',
    'APACHE-2.0': 'Apache-2.0',
    'GPL-3.0': 'GPL-3.0',
    'BSD-3-CLAUSE': 'BSD-3-Clause',
    'BSD-2-CLAUSE': 'BSD-2-Clause',
    'ISC': 'ISC',
  };

  return mappings[normalized] || normalized;
}

/**
 * Check license compatibility
 */
function checkLicenseCompatibility(projectLicense, dependencyLicense, matrix) {
  const projectMatrix = matrix[projectLicense];
  if (!projectMatrix) return true; // Unknown project license, assume compatible
  
  return projectMatrix.compatible.includes(dependencyLicense);
}

/**
 * Get risk recommendation
 */
function getRiskRecommendation(license, riskLevel) {
  const recommendations = {
    'GPL-2.0': 'GPL licenses require derivative works to be GPL licensed. Consider alternatives.',
    'GPL-3.0': 'GPL licenses require derivative works to be GPL licensed. Consider alternatives.',
    'AGPL-3.0': 'AGPL requires source code availability for network services. Avoid for web services.',
    'LGPL-2.1': 'LGPL allows dynamic linking but requires sharing modifications.',
    'MPL-2.0': 'Mozilla license requires sharing modifications to covered files.',
  };
  
  return recommendations[license] || `Review license terms carefully - ${riskLevel} risk level`;
}

/**
 * Generate compliance recommendations
 */
function generateComplianceRecommendations(analysis) {
  const recommendations = [];

  if (analysis.compatibility.incompatible.length > 0) {
    recommendations.push({
      category: 'compatibility',
      priority: 'high',
      title: 'License Compatibility Issues',
      description: `${analysis.compatibility.incompatible.length} dependencies have incompatible licenses`,
      actions: [
        'Review incompatible dependencies and consider alternatives',
        'Consult legal counsel for complex license interactions',
        'Consider dual-licensing options if applicable',
      ],
    });
  }

  if (analysis.risks.high.length > 0) {
    recommendations.push({
      category: 'risk_management',
      priority: 'high',
      title: 'High-Risk Licenses',
      description: `${analysis.risks.high.length} dependencies use high-risk licenses`,
      actions: [
        'Replace high-risk dependencies where possible',
        'Implement license compliance review process',
        'Maintain license inventory and monitoring',
      ],
    });
  }

  if (analysis.compatibility.unknown.length > 10) {
    recommendations.push({
      category: 'license_discovery',
      priority: 'medium',
      title: 'Unknown Licenses',
      description: `${analysis.compatibility.unknown.length} dependencies have unknown licenses`,
      actions: [
        'Implement automated license detection tools',
        'Manually research unknown licenses',
        'Establish policy for unknown licenses',
      ],
    });
  }

  analysis.recommendations = recommendations;
}

/**
 * Calculate license summary statistics
 */
function calculateLicenseSummary(analysis) {
  analysis.summary.totalDependencies = analysis.dependencies.length;
  analysis.summary.licensedDependencies = analysis.dependencies.filter(d => d.license !== 'unknown').length;
  analysis.summary.unlicensedDependencies = analysis.dependencies.filter(d => d.license === 'unknown').length;
  analysis.summary.riskyLicenses = analysis.risks.high.length + analysis.risks.medium.length;
  analysis.summary.compatibilityIssues = analysis.compatibility.incompatible.length;

  // Count unique licenses
  const uniqueLicenses = new Set();
  for (const dep of analysis.dependencies) {
    if (dep.license !== 'unknown') {
      uniqueLicenses.add(dep.license);
    }
  }
  analysis.summary.uniqueLicenses = uniqueLicenses.size;
}

/**
 * Build license compliance response
 */
function buildLicenseResponse(analysis, filteredIssues, format, options) {
  const base = {
    analysis: {
      projectPath: analysis.projectPath,
      packageManager: analysis.packageManager,
      projectLicense: analysis.projectLicense,
      strictness: analysis.strictness,
    },
    summary: analysis.summary,
    issues: filteredIssues,
    pagination: {
      offset: options.offset,
      limit: options.limit,
      total: analysis.issues.length,
      hasMore: options.offset + options.limit < analysis.issues.length,
    },
  };

  if (format === 'summary') {
    return {
      ...base,
      compatibility: {
        compatible: analysis.compatibility.compatible.length,
        incompatible: analysis.compatibility.incompatible.length,
        unknown: analysis.compatibility.unknown.length,
      },
      risks: {
        high: analysis.risks.high.length,
        medium: analysis.risks.medium.length,
        low: analysis.risks.low.length,
      },
    };
  }

  if (format === 'detailed') {
    return {
      ...base,
      dependencies: analysis.dependencies,
      compatibility: analysis.compatibility,
      risks: analysis.risks,
      recommendations: analysis.recommendations,
    };
  }

  if (format === 'csv') {
    const csvData = analysis.dependencies.map(dep => 
      `${dep.name},${dep.version},${dep.license},${dep.manager},${dep.isDev}`
    );
    return {
      format: 'csv',
      data: ['Name,Version,License,Manager,IsDev', ...csvData].join('\n'),
      summary: base.summary,
    };
  }

  return base; // JSON format
}