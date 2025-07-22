/**
 * CI/CD Configuration Analyzer
 * Analyzes CI/CD pipeline configurations for best practices, security, and optimization opportunities
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

const execAsync = promisify(exec);

/**
 * CI/CD Configuration Analyzer Tool
 */
export const cicdAnalyzerTool = {
  name: 'cicd_configuration_analyzer',
  description: 'Analyzes CI/CD pipeline configurations for best practices, security issues, and optimization opportunities. Supports GitHub Actions, GitLab CI, Jenkins, and other major platforms.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory containing CI/CD configurations',
        default: '.',
      },
      configPath: {
        type: 'string',
        description: 'Specific path to CI/CD configuration file',
      },
      platform: {
        type: 'string',
        enum: ['auto', 'github-actions', 'gitlab-ci', 'jenkins', 'azure-devops', 'circleci', 'travis-ci'],
        default: 'auto',
        description: 'CI/CD platform to analyze (auto-detect if not specified)',
      },
      checkSecurity: {
        type: 'boolean',
        default: true,
        description: 'Perform security-focused analysis',
      },
      checkPerformance: {
        type: 'boolean',
        default: true,
        description: 'Analyze for performance optimizations',
      },
      checkCompliance: {
        type: 'boolean',
        default: true,
        description: 'Check compliance with best practices',
      },
      strictness: {
        type: 'string',
        enum: ['lenient', 'standard', 'strict'],
        default: 'standard',
        description: 'Analysis strictness level',
      },
      includeSecrets: {
        type: 'boolean',
        default: true,
        description: 'Analyze secret and environment variable usage',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50)',
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
    },
    required: [],
  },
};

/**
 * Handle CI/CD configuration analysis
 */
export async function handleCICDAnalyzer(request) {
  try {
    const { 
      projectPath = '.',
      configPath,
      platform = 'auto',
      checkSecurity = true,
      checkPerformance = true,
      checkCompliance = true,
      strictness = 'standard',
      includeSecrets = true,
      limit = 50,
      offset = 0,
    } = request.params;

    // Discover CI/CD configurations
    const configs = await discoverCICDConfigs(projectPath, configPath, platform);
    
    if (configs.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '❌ No CI/CD configuration files found',
        }],
      };
    }

    const analysis = {
      platform: configs[0].platform,
      configFiles: configs,
      issues: [],
      security: {
        secrets: [],
        vulnerabilities: [],
        recommendations: [],
      },
      performance: {
        optimizations: [],
        bottlenecks: [],
      },
      compliance: {
        score: 100,
        violations: [],
        bestPractices: [],
      },
      metrics: {
        totalJobs: 0,
        totalSteps: 0,
        estimatedDuration: 0,
        parallelizationScore: 0,
      },
    };

    // Analyze each configuration file
    for (const config of configs) {
      await analyzeCICDConfig(config, analysis, {
        checkSecurity,
        checkPerformance,
        checkCompliance,
        strictness,
        includeSecrets,
      });
    }

    // Generate overall recommendations
    generateCICDRecommendations(analysis);

    // Calculate scores
    calculateCICDScores(analysis);

    // Filter and paginate
    const filteredIssues = analysis.issues.slice(offset, offset + limit);

    // Build response
    const response = {
      analysis: {
        platform: analysis.platform,
        configFiles: configs.length,
        totalIssues: analysis.issues.length,
      },
      configs: analysis.configFiles,
      issues: filteredIssues,
      security: checkSecurity ? analysis.security : null,
      performance: checkPerformance ? analysis.performance : null,
      compliance: checkCompliance ? analysis.compliance : null,
      metrics: analysis.metrics,
      summary: {
        critical: analysis.issues.filter(i => i.severity === 'critical').length,
        high: analysis.issues.filter(i => i.severity === 'high').length,
        medium: analysis.issues.filter(i => i.severity === 'medium').length,
        low: analysis.issues.filter(i => i.severity === 'low').length,
      },
      pagination: {
        offset,
        limit,
        total: analysis.issues.length,
        hasMore: offset + limit < analysis.issues.length,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[CICDAnalyzer] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ CI/CD analysis failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Discover CI/CD configuration files
 */
async function discoverCICDConfigs(projectPath, configPath, platform) {
  const configs = [];
  
  if (configPath && existsSync(configPath)) {
    // Specific config file provided
    const content = readFileSync(configPath, 'utf8');
    const detectedPlatform = detectPlatform(configPath, content);
    
    configs.push({
      path: configPath,
      platform: detectedPlatform,
      content,
      size: statSync(configPath).size,
    });
    
    return configs;
  }
  
  // Auto-discover configurations
  const cicdPaths = [
    // GitHub Actions
    { pattern: '.github/workflows/*.yml', platform: 'github-actions' },
    { pattern: '.github/workflows/*.yaml', platform: 'github-actions' },
    
    // GitLab CI
    { pattern: '.gitlab-ci.yml', platform: 'gitlab-ci' },
    { pattern: '.gitlab-ci.yaml', platform: 'gitlab-ci' },
    
    // Jenkins
    { pattern: 'Jenkinsfile', platform: 'jenkins' },
    { pattern: 'jenkins.yml', platform: 'jenkins' },
    
    // Azure DevOps
    { pattern: 'azure-pipelines.yml', platform: 'azure-devops' },
    { pattern: '.azure/azure-pipelines.yml', platform: 'azure-devops' },
    
    // CircleCI
    { pattern: '.circleci/config.yml', platform: 'circleci' },
    
    // Travis CI
    { pattern: '.travis.yml', platform: 'travis-ci' },
    
    // Generic
    { pattern: 'ci.yml', platform: 'generic' },
    { pattern: 'pipeline.yml', platform: 'generic' },
  ];
  
  for (const { pattern, platform: configPlatform } of cicdPaths) {
    if (platform !== 'auto' && platform !== configPlatform) continue;
    
    try {
      if (pattern.includes('*')) {
        // Handle wildcard patterns
        const [dirPath, filePattern] = pattern.split('/').slice(-2);
        const fullDirPath = join(projectPath, pattern.substring(0, pattern.lastIndexOf('/')));
        
        if (existsSync(fullDirPath)) {
          const files = readdirSync(fullDirPath);
          const extension = filePattern.split('.').pop();
          
          for (const file of files) {
            if (file.endsWith(`.${extension}`)) {
              const filePath = join(fullDirPath, file);
              const content = readFileSync(filePath, 'utf8');
              
              configs.push({
                path: filePath,
                platform: configPlatform,
                content,
                size: statSync(filePath).size,
              });
            }
          }
        }
      } else {
        // Single file pattern
        const filePath = join(projectPath, pattern);
        if (existsSync(filePath)) {
          const content = readFileSync(filePath, 'utf8');
          
          configs.push({
            path: filePath,
            platform: configPlatform,
            content,
            size: statSync(filePath).size,
          });
        }
      }
    } catch (error) {
      // Skip files we can't read
      continue;
    }
  }
  
  return configs;
}

/**
 * Detect CI/CD platform from file path and content
 */
function detectPlatform(filePath, content) {
  if (filePath.includes('.github/workflows')) return 'github-actions';
  if (filePath.includes('.gitlab-ci')) return 'gitlab-ci';
  if (filePath.includes('Jenkinsfile')) return 'jenkins';
  if (filePath.includes('azure-pipelines')) return 'azure-devops';
  if (filePath.includes('.circleci')) return 'circleci';
  if (filePath.includes('.travis')) return 'travis-ci';
  
  // Content-based detection
  if (content.includes('runs-on:') || content.includes('uses:')) return 'github-actions';
  if (content.includes('script:') && content.includes('stage:')) return 'gitlab-ci';
  if (content.includes('pipeline {') || content.includes('node {')) return 'jenkins';
  if (content.includes('trigger:') && content.includes('pool:')) return 'azure-devops';
  if (content.includes('version: 2') && content.includes('workflows:')) return 'circleci';
  
  return 'generic';
}

/**
 * Analyze CI/CD configuration
 */
async function analyzeCICDConfig(config, analysis, options) {
  try {
    const parsed = parseConfig(config.content, config.platform);
    
    // Platform-specific analysis
    switch (config.platform) {
      case 'github-actions':
        await analyzeGitHubActions(parsed, config, analysis, options);
        break;
      case 'gitlab-ci':
        await analyzeGitLabCI(parsed, config, analysis, options);
        break;
      case 'jenkins':
        await analyzeJenkins(parsed, config, analysis, options);
        break;
      case 'azure-devops':
        await analyzeAzureDevOps(parsed, config, analysis, options);
        break;
      case 'circleci':
        await analyzeCircleCI(parsed, config, analysis, options);
        break;
      case 'travis-ci':
        await analyzeTravisCI(parsed, config, analysis, options);
        break;
      default:
        await analyzeGenericCI(parsed, config, analysis, options);
    }
    
    // Common analysis across platforms
    await analyzeCommonPatterns(config, analysis, options);
    
  } catch (error) {
    analysis.issues.push({
      type: 'parse_error',
      severity: 'high',
      message: `Failed to parse configuration: ${error.message}`,
      file: config.path,
      recommendation: 'Check configuration syntax',
    });
  }
}

/**
 * Parse configuration based on format
 */
function parseConfig(content, platform) {
  try {
    // Simple YAML parsing (in production, use proper YAML parser)
    if (platform === 'jenkins' && content.includes('pipeline {')) {
      // Jenkinsfile is Groovy, not YAML
      return { raw: content, type: 'groovy' };
    }
    
    return parseSimpleYAML(content);
  } catch (error) {
    return { raw: content, parseError: error.message };
  }
}

/**
 * Simple YAML parser for CI/CD configs
 */
function parseSimpleYAML(content) {
  const lines = content.split('\n');
  const result = {};
  const stack = [result];
  let currentIndent = 0;
  
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    
    const indent = line.match(/^\s*/)[0].length;
    const content = line.trim();
    
    if (content.includes(':')) {
      const [key, value] = content.split(':', 2);
      const cleanKey = key.trim();
      const cleanValue = value?.trim() || '';
      
      // Adjust stack based on indentation
      while (stack.length > 1 && indent <= currentIndent) {
        stack.pop();
        currentIndent -= 2;
      }
      
      const current = stack[stack.length - 1];
      
      if (cleanValue) {
        current[cleanKey] = cleanValue;
      } else {
        current[cleanKey] = {};
        stack.push(current[cleanKey]);
        currentIndent = indent;
      }
    }
  }
  
  return result;
}

/**
 * Analyze GitHub Actions
 */
async function analyzeGitHubActions(parsed, config, analysis, options) {
  const content = config.content;
  
  // Count jobs and steps
  const jobs = Object.keys(parsed.jobs || {});
  analysis.metrics.totalJobs += jobs.length;
  
  for (const jobName of jobs) {
    const job = parsed.jobs[jobName];
    const steps = job.steps || [];
    analysis.metrics.totalSteps += steps.length;
    
    // Check for long-running jobs
    if (steps.length > 20) {
      analysis.issues.push({
        type: 'long_job',
        severity: 'medium',
        message: `Job '${jobName}' has many steps (${steps.length})`,
        file: config.path,
        job: jobName,
        recommendation: 'Consider breaking into multiple jobs or using job matrices',
      });
    }
  }
  
  // Security checks
  if (options.checkSecurity) {
    // Check for third-party actions without version pinning
    const actionPattern = /uses:\s*([^@\s]+)(?:@([^\s]+))?/g;
    let match;
    
    while ((match = actionPattern.exec(content)) !== null) {
      const [, action, version] = match;
      
      if (!version || version === 'main' || version === 'master') {
        analysis.security.vulnerabilities.push({
          type: 'unpinned_action',
          severity: 'medium',
          message: `Action '${action}' not pinned to specific version`,
          file: config.path,
          action,
          recommendation: 'Pin actions to specific commit SHA or semantic version',
        });
      }
    }
    
    // Check for secrets in workflow files
    if (options.includeSecrets) {
      analyzeSecretsUsage(content, config, analysis);
    }
  }
  
  // Performance checks
  if (options.checkPerformance) {
    // Check for missing caching
    if (!content.includes('actions/cache') && 
        (content.includes('npm install') || content.includes('pip install'))) {
      analysis.performance.bottlenecks.push({
        type: 'missing_cache',
        severity: 'medium',
        message: 'Missing dependency caching',
        file: config.path,
        recommendation: 'Add actions/cache to cache dependencies',
      });
    }
    
    // Check for inefficient checkout
    if (content.includes('actions/checkout') && !content.includes('fetch-depth')) {
      analysis.performance.optimizations.push({
        type: 'shallow_checkout',
        priority: 'low',
        message: 'Consider shallow checkout for faster clone',
        file: config.path,
        recommendation: 'Add fetch-depth: 1 for shallow checkout',
      });
    }
  }
}

/**
 * Analyze GitLab CI
 */
async function analyzeGitLabCI(parsed, config, analysis, options) {
  const content = config.content;
  
  // Count stages and jobs
  const stages = parsed.stages || [];
  const jobs = Object.keys(parsed).filter(key => 
    !['stages', 'variables', 'before_script', 'after_script', 'image'].includes(key)
  );
  
  analysis.metrics.totalJobs += jobs.length;
  
  // Check for missing stages
  if (stages.length === 0) {
    analysis.issues.push({
      type: 'missing_stages',
      severity: 'medium',
      message: 'No stages defined in GitLab CI',
      file: config.path,
      recommendation: 'Define stages for better pipeline organization',
    });
  }
  
  // Security checks
  if (options.checkSecurity) {
    // Check for privileged mode
    if (content.includes('privileged: true')) {
      analysis.security.vulnerabilities.push({
        type: 'privileged_runner',
        severity: 'high',
        message: 'Using privileged Docker mode',
        file: config.path,
        recommendation: 'Avoid privileged mode unless absolutely necessary',
      });
    }
  }
}

/**
 * Analyze Jenkins pipeline
 */
async function analyzeJenkins(parsed, config, analysis, options) {
  const content = config.content;
  
  // Basic Jenkinsfile analysis
  if (content.includes('pipeline {')) {
    // Declarative pipeline
    const stageMatches = content.match(/stage\s*\(\s*['"][^'"]+['"]\s*\)/g) || [];
    analysis.metrics.totalJobs += stageMatches.length;
    
    if (stageMatches.length === 0) {
      analysis.issues.push({
        type: 'no_stages',
        severity: 'high',
        message: 'No stages defined in Jenkins pipeline',
        file: config.path,
        recommendation: 'Define stages for pipeline structure',
      });
    }
  }
  
  // Security checks
  if (options.checkSecurity) {
    if (content.includes('sh ') && !content.includes('returnStatus')) {
      analysis.security.vulnerabilities.push({
        type: 'shell_injection_risk',
        severity: 'medium',
        message: 'Shell commands without return status checking',
        file: config.path,
        recommendation: 'Use returnStatus or returnStdout for safer shell execution',
      });
    }
  }
}

/**
 * Analyze Azure DevOps
 */
async function analyzeAzureDevOps(parsed, config, analysis, options) {
  const content = config.content;
  
  // Count jobs and steps
  const jobs = parsed.jobs || [];
  analysis.metrics.totalJobs += Array.isArray(jobs) ? jobs.length : 1;
  
  // Check for missing pool specification
  if (!parsed.pool && !content.includes('pool:')) {
    analysis.issues.push({
      type: 'missing_pool',
      severity: 'medium',
      message: 'No agent pool specified',
      file: config.path,
      recommendation: 'Specify agent pool for consistent builds',
    });
  }
}

/**
 * Analyze CircleCI
 */
async function analyzeCircleCI(parsed, config, analysis, options) {
  const content = config.content;
  
  // Check version
  if (!parsed.version || parsed.version < 2) {
    analysis.issues.push({
      type: 'outdated_version',
      severity: 'high',
      message: 'Using outdated CircleCI version',
      file: config.path,
      recommendation: 'Upgrade to CircleCI 2.1 for latest features',
    });
  }
  
  // Count jobs
  const jobs = parsed.jobs || {};
  analysis.metrics.totalJobs += Object.keys(jobs).length;
}

/**
 * Analyze Travis CI
 */
async function analyzeTravisCI(parsed, config, analysis, options) {
  const content = config.content;
  
  // Check for deprecated features
  if (content.includes('sudo:')) {
    analysis.issues.push({
      type: 'deprecated_feature',
      severity: 'medium',
      message: 'Using deprecated sudo configuration',
      file: config.path,
      recommendation: 'Use containerized builds instead',
    });
  }
}

/**
 * Analyze generic CI configuration
 */
async function analyzeGenericCI(parsed, config, analysis, options) {
  // Basic analysis for unknown CI platforms
  const content = config.content;
  
  if (content.length < 50) {
    analysis.issues.push({
      type: 'minimal_config',
      severity: 'low',
      message: 'Very minimal CI configuration',
      file: config.path,
      recommendation: 'Consider adding more comprehensive build steps',
    });
  }
}

/**
 * Analyze common patterns across all platforms
 */
async function analyzeCommonPatterns(config, analysis, options) {
  const content = config.content;
  
  // Check for hardcoded values
  const hardcodedPatterns = [
    { pattern: /https?:\/\/[^\s]+/, message: 'Hardcoded URL', recommendation: 'Use environment variables for URLs' },
    { pattern: /\/[a-zA-Z0-9\/]+\.(com|org|net)/, message: 'Hardcoded domain', recommendation: 'Use environment variables for domains' },
    { pattern: /[0-9]+\.[0-9]+\.[0-9]+/, message: 'Hardcoded version', recommendation: 'Use variables for version numbers' },
  ];
  
  for (const { pattern, message, recommendation } of hardcodedPatterns) {
    if (pattern.test(content)) {
      analysis.issues.push({
        type: 'hardcoded_value',
        severity: 'low',
        message,
        file: config.path,
        recommendation,
      });
    }
  }
  
  // Check for missing error handling
  if (!content.includes('try') && !content.includes('catch') && 
      (content.includes('curl') || content.includes('wget'))) {
    analysis.issues.push({
      type: 'missing_error_handling',
      severity: 'medium',
      message: 'External commands without error handling',
      file: config.path,
      recommendation: 'Add error handling for external commands',
    });
  }
  
  // Check for excessive logging
  const debugLines = (content.match(/echo|print|debug|verbose/gi) || []).length;
  if (debugLines > 10) {
    analysis.issues.push({
      type: 'excessive_logging',
      severity: 'low',
      message: `Many debug/logging statements (${debugLines})`,
      file: config.path,
      recommendation: 'Consider reducing debug output for cleaner logs',
    });
  }
}

/**
 * Analyze secrets usage
 */
function analyzeSecretsUsage(content, config, analysis) {
  // GitHub Actions secrets pattern
  const secretsPattern = /\$\{\{\s*secrets\.([A-Z_]+)\s*\}\}/g;
  let match;
  
  while ((match = secretsPattern.exec(content)) !== null) {
    const secretName = match[1];
    
    analysis.security.secrets.push({
      name: secretName,
      file: config.path,
      type: 'github_secret',
    });
    
    // Check for common insecure secret names
    const insecureNames = ['PASSWORD', 'TOKEN', 'KEY', 'SECRET'];
    if (insecureNames.some(name => secretName.includes(name)) && secretName.length < 10) {
      analysis.security.vulnerabilities.push({
        type: 'generic_secret_name',
        severity: 'low',
        message: `Generic secret name: ${secretName}`,
        file: config.path,
        recommendation: 'Use more specific secret names',
      });
    }
  }
  
  // Environment variables that might contain secrets
  const envPattern = /\$\{?([A-Z_]+)\}?/g;
  const suspiciousEnvVars = [];
  
  while ((match = envPattern.exec(content)) !== null) {
    const varName = match[1];
    if (['API_KEY', 'SECRET', 'PASSWORD', 'TOKEN'].some(secret => varName.includes(secret))) {
      suspiciousEnvVars.push(varName);
    }
  }
  
  if (suspiciousEnvVars.length > 0) {
    analysis.security.recommendations.push({
      type: 'secret_management',
      message: `Found ${suspiciousEnvVars.length} potential secrets in environment variables`,
      recommendation: 'Use secure secret management instead of environment variables',
      variables: suspiciousEnvVars,
    });
  }
}

/**
 * Generate CI/CD recommendations
 */
function generateCICDRecommendations(analysis) {
  const recommendations = [];
  
  // Based on platform
  switch (analysis.platform) {
    case 'github-actions':
      recommendations.push({
        category: 'security',
        title: 'GitHub Actions Security',
        items: [
          'Pin action versions to specific commits',
          'Use GITHUB_TOKEN instead of personal tokens when possible',
          'Minimize repository permissions for GITHUB_TOKEN',
        ],
      });
      break;
      
    case 'gitlab-ci':
      recommendations.push({
        category: 'performance',
        title: 'GitLab CI Optimization',
        items: [
          'Use GitLab CI cache for dependencies',
          'Leverage parallel jobs with needs keyword',
          'Use Docker layer caching for faster builds',
        ],
      });
      break;
  }
  
  // General recommendations
  recommendations.push({
    category: 'best_practices',
    title: 'CI/CD Best Practices',
    items: [
      'Use fail-fast strategies to reduce build times',
      'Implement proper error handling and notifications',
      'Use matrix builds for testing multiple configurations',
      'Keep build logs clean and informative',
    ],
  });
  
  analysis.recommendations = recommendations;
}

/**
 * Calculate CI/CD scores
 */
function calculateCICDScores(analysis) {
  // Compliance score
  let complianceScore = 100;
  
  analysis.issues.forEach(issue => {
    switch (issue.severity) {
      case 'critical': complianceScore -= 20; break;
      case 'high': complianceScore -= 15; break;
      case 'medium': complianceScore -= 8; break;
      case 'low': complianceScore -= 3; break;
    }
  });
  
  analysis.compliance.score = Math.max(0, complianceScore);
  
  // Parallelization score (simple heuristic)
  if (analysis.metrics.totalJobs > 1) {
    analysis.metrics.parallelizationScore = Math.min(100, analysis.metrics.totalJobs * 20);
  }
  
  // Estimate duration (very rough)
  analysis.metrics.estimatedDuration = analysis.metrics.totalSteps * 2; // 2 minutes per step average
}