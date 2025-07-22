/**
 * Environment Configuration Validator
 * Validates environment configurations for security, completeness, and best practices
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, basename, extname } from 'path';

const execAsync = promisify(exec);

/**
 * Environment Configuration Validator Tool
 */
export const envConfigValidatorTool = {
  name: 'environment_config_validator',
  description: 'Validates environment configurations for security, completeness, and best practices. Supports .env files, Docker configs, Kubernetes manifests, and cloud configurations.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory to validate',
        default: '.',
      },
      configPath: {
        type: 'string',
        description: 'Specific path to configuration file to validate',
      },
      configType: {
        type: 'string',
        enum: ['auto', 'dotenv', 'docker', 'kubernetes', 'docker-compose', 'terraform', 'cloudformation', 'helm'],
        default: 'auto',
        description: 'Type of configuration to validate',
      },
      environment: {
        type: 'string',
        enum: ['development', 'staging', 'production', 'test'],
        default: 'production',
        description: 'Target environment for validation rules',
      },
      strictness: {
        type: 'string',
        enum: ['lenient', 'standard', 'strict', 'enterprise'],
        default: 'standard',
        description: 'Validation strictness level',
      },
      checkSecurity: {
        type: 'boolean',
        default: true,
        description: 'Perform security-focused validation',
      },
      checkCompleteness: {
        type: 'boolean',
        default: true,
        description: 'Check for missing required configurations',
      },
      checkBestPractices: {
        type: 'boolean',
        default: true,
        description: 'Validate against configuration best practices',
      },
      validateSecrets: {
        type: 'boolean',
        default: true,
        description: 'Validate secret management practices',
      },
      category: {
        type: 'string',
        enum: ['security', 'completeness', 'performance', 'compliance', 'all'],
        default: 'all',
        description: 'Focus on specific validation category',
      },
      format: {
        type: 'string',
        enum: ['detailed', 'summary', 'checklist'],
        default: 'detailed',
        description: 'Output format for validation results',
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
 * Handle environment configuration validation
 */
export async function handleEnvConfigValidator(request) {
  try {
    const { 
      projectPath = '.',
      configPath,
      configType = 'auto',
      environment = 'production',
      strictness = 'standard',
      checkSecurity = true,
      checkCompleteness = true,
      checkBestPractices = true,
      validateSecrets = true,
      category = 'all',
      format = 'detailed',
      limit = 50,
      offset = 0,
    } = request.params;

    // Discover configuration files
    const configs = await discoverConfigFiles(projectPath, configPath, configType);
    
    if (configs.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '❌ No configuration files found to validate',
        }],
      };
    }

    const analysis = {
      projectPath,
      environment,
      strictness,
      configs: [],
      issues: [],
      security: {
        secrets: [],
        vulnerabilities: [],
        recommendations: [],
      },
      completeness: {
        missing: [],
        recommendations: [],
      },
      bestPractices: {
        violations: [],
        recommendations: [],
      },
      compliance: {
        score: 100,
        violations: [],
      },
      summary: {
        totalConfigs: configs.length,
        totalIssues: 0,
        securityIssues: 0,
        completenessIssues: 0,
        bestPracticeViolations: 0,
      },
    };

    // Validate each configuration file
    for (const config of configs) {
      await validateConfigFile(config, analysis, {
        environment,
        strictness,
        checkSecurity,
        checkCompleteness,
        checkBestPractices,
        validateSecrets,
        category,
      });
    }

    // Generate validation recommendations
    generateValidationRecommendations(analysis);

    // Calculate compliance score
    calculateComplianceScore(analysis);

    // Filter and paginate
    const filteredIssues = analysis.issues.slice(offset, offset + limit);

    // Build response
    const response = buildValidationResponse(analysis, filteredIssues, format, {
      offset,
      limit,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[EnvConfigValidator] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Environment configuration validation failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Discover configuration files in project
 */
async function discoverConfigFiles(projectPath, configPath, configType) {
  const configs = [];
  
  if (configPath && existsSync(configPath)) {
    // Specific config file provided
    const content = readFileSync(configPath, 'utf8');
    const detectedType = detectConfigType(configPath, content);
    
    configs.push({
      path: configPath,
      type: detectedType,
      content,
      size: statSync(configPath).size,
    });
    
    return configs;
  }

  // Auto-discover configuration files
  const configPatterns = [
    // Environment files
    { pattern: '.env', type: 'dotenv' },
    { pattern: '.env.local', type: 'dotenv' },
    { pattern: '.env.development', type: 'dotenv' },
    { pattern: '.env.staging', type: 'dotenv' },
    { pattern: '.env.production', type: 'dotenv' },
    { pattern: '.env.test', type: 'dotenv' },
    { pattern: 'config/.env*', type: 'dotenv' },
    
    // Docker
    { pattern: 'Dockerfile', type: 'docker' },
    { pattern: 'Dockerfile.*', type: 'docker' },
    { pattern: 'docker-compose.yml', type: 'docker-compose' },
    { pattern: 'docker-compose.yaml', type: 'docker-compose' },
    { pattern: 'docker-compose.*.yml', type: 'docker-compose' },
    
    // Kubernetes
    { pattern: 'k8s/*.yml', type: 'kubernetes' },
    { pattern: 'k8s/*.yaml', type: 'kubernetes' },
    { pattern: 'kubernetes/*.yml', type: 'kubernetes' },
    { pattern: 'manifests/*.yml', type: 'kubernetes' },
    
    // Helm
    { pattern: 'charts/*/values.yaml', type: 'helm' },
    { pattern: 'helm/*/values.yaml', type: 'helm' },
    { pattern: 'values.yaml', type: 'helm' },
    
    // Cloud configurations
    { pattern: 'terraform/*.tf', type: 'terraform' },
    { pattern: '*.tf', type: 'terraform' },
    { pattern: 'cloudformation/*.yml', type: 'cloudformation' },
    { pattern: '*.cloudformation.yml', type: 'cloudformation' },
    
    // Application configs
    { pattern: 'config.json', type: 'json' },
    { pattern: 'app.json', type: 'json' },
    { pattern: 'config.yml', type: 'yaml' },
    { pattern: 'application.yml', type: 'yaml' },
  ];

  for (const { pattern, type } of configPatterns) {
    if (configType !== 'auto' && configType !== type) continue;
    
    try {
      const files = await findConfigFiles(projectPath, pattern);
      
      for (const filePath of files) {
        const content = readFileSync(filePath, 'utf8');
        const detectedType = detectConfigType(filePath, content);
        
        configs.push({
          path: filePath,
          type: detectedType,
          content,
          size: statSync(filePath).size,
        });
      }
    } catch (error) {
      // Skip patterns that don't match or can't be read
      continue;
    }
  }

  return configs;
}

/**
 * Find configuration files matching pattern
 */
async function findConfigFiles(basePath, pattern) {
  const files = [];
  
  if (pattern.includes('*')) {
    // Handle wildcard patterns
    const parts = pattern.split('/');
    let currentPath = basePath;
    
    // For simplicity, handle basic patterns
    if (pattern.startsWith('.env')) {
      const envFiles = readdirSync(basePath).filter(f => f.startsWith('.env'));
      files.push(...envFiles.map(f => join(basePath, f)));
    } else if (pattern.includes('/')) {
      // Handle directory patterns
      const dir = parts[0];
      const filePattern = parts[1];
      const dirPath = join(basePath, dir);
      
      if (existsSync(dirPath)) {
        const dirFiles = readdirSync(dirPath);
        const extension = filePattern.split('.').pop();
        
        for (const file of dirFiles) {
          if (file.endsWith(`.${extension}`)) {
            files.push(join(dirPath, file));
          }
        }
      }
    }
  } else {
    // Exact file match
    const filePath = join(basePath, pattern);
    if (existsSync(filePath)) {
      files.push(filePath);
    }
  }
  
  return files;
}

/**
 * Detect configuration type from file path and content
 */
function detectConfigType(filePath, content) {
  const fileName = basename(filePath);
  
  if (fileName.startsWith('.env')) return 'dotenv';
  if (fileName === 'Dockerfile' || fileName.startsWith('Dockerfile.')) return 'docker';
  if (fileName.includes('docker-compose')) return 'docker-compose';
  if (fileName.includes('values.yaml') || filePath.includes('helm')) return 'helm';
  if (fileName.endsWith('.tf')) return 'terraform';
  if (fileName.includes('cloudformation')) return 'cloudformation';
  
  // Content-based detection
  if (content.includes('apiVersion:') && content.includes('kind:')) return 'kubernetes';
  if (content.includes('FROM ') && content.includes('RUN ')) return 'docker';
  if (content.includes('version:') && content.includes('services:')) return 'docker-compose';
  if (content.includes('resource ') && content.includes('provider ')) return 'terraform';
  
  // Fallback to extension
  const ext = extname(filePath).toLowerCase();
  if (['.yml', '.yaml'].includes(ext)) return 'yaml';
  if (ext === '.json') return 'json';
  
  return 'unknown';
}

/**
 * Validate configuration file
 */
async function validateConfigFile(config, analysis, options) {
  analysis.configs.push({
    path: config.path,
    type: config.type,
    size: config.size,
  });

  try {
    switch (config.type) {
      case 'dotenv':
        await validateDotEnvFile(config, analysis, options);
        break;
      case 'docker':
        await validateDockerFile(config, analysis, options);
        break;
      case 'docker-compose':
        await validateDockerCompose(config, analysis, options);
        break;
      case 'kubernetes':
        await validateKubernetesManifest(config, analysis, options);
        break;
      case 'helm':
        await validateHelmValues(config, analysis, options);
        break;
      case 'terraform':
        await validateTerraformConfig(config, analysis, options);
        break;
      case 'cloudformation':
        await validateCloudFormation(config, analysis, options);
        break;
      case 'yaml':
      case 'json':
        await validateGenericConfig(config, analysis, options);
        break;
      default:
        analysis.issues.push({
          type: 'unknown_config_type',
          severity: 'low',
          message: `Unknown configuration type: ${config.type}`,
          file: config.path,
          recommendation: 'Manual review recommended for unknown configuration types',
        });
    }
  } catch (error) {
    analysis.issues.push({
      type: 'validation_error',
      severity: 'medium',
      message: `Failed to validate ${config.path}: ${error.message}`,
      file: config.path,
      recommendation: 'Check file format and syntax',
    });
  }
}

/**
 * Validate .env files
 */
async function validateDotEnvFile(config, analysis, options) {
  const lines = config.content.split('\n');
  const variables = new Map();
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;
    
    if (!line || line.startsWith('#')) continue;
    
    const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      variables.set(key, { value, line: lineNumber });
      
      // Security checks
      if (options.checkSecurity && options.validateSecrets) {
        validateSecretValue(key, value, config.path, lineNumber, analysis);
      }
      
      // Naming convention checks
      if (options.checkBestPractices) {
        validateVariableNaming(key, config.path, lineNumber, analysis);
      }
    } else if (line.includes('=')) {
      analysis.issues.push({
        type: 'invalid_env_syntax',
        severity: 'medium',
        message: `Invalid environment variable syntax: ${line}`,
        file: config.path,
        line: lineNumber,
        recommendation: 'Use uppercase letters and underscores for variable names',
      });
    }
  }
  
  // Check for required environment variables
  if (options.checkCompleteness) {
    checkRequiredEnvVariables(variables, config.path, analysis, options.environment);
  }
}

/**
 * Validate Docker configurations
 */
async function validateDockerFile(config, analysis, options) {
  const lines = config.content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineNumber = i + 1;
    
    if (!line || line.startsWith('#')) continue;
    
    // Security checks
    if (options.checkSecurity) {
      validateDockerSecurity(line, config.path, lineNumber, analysis);
    }
    
    // Best practices
    if (options.checkBestPractices) {
      validateDockerBestPractices(line, config.path, lineNumber, analysis);
    }
  }
}

/**
 * Validate Docker Compose
 */
async function validateDockerCompose(config, analysis, options) {
  try {
    const yamlData = parseSimpleYAML(config.content);
    
    if (yamlData.services) {
      for (const [serviceName, serviceConfig] of Object.entries(yamlData.services)) {
        validateDockerComposeService(serviceName, serviceConfig, config.path, analysis, options);
      }
    }
  } catch (error) {
    analysis.issues.push({
      type: 'yaml_parse_error',
      severity: 'high',
      message: `Failed to parse Docker Compose YAML: ${error.message}`,
      file: config.path,
      recommendation: 'Check YAML syntax and structure',
    });
  }
}

/**
 * Validate Kubernetes manifests
 */
async function validateKubernetesManifest(config, analysis, options) {
  try {
    const yamlData = parseSimpleYAML(config.content);
    
    if (options.checkSecurity) {
      validateKubernetesSecurity(yamlData, config.path, analysis);
    }
    
    if (options.checkBestPractices) {
      validateKubernetesBestPractices(yamlData, config.path, analysis);
    }
  } catch (error) {
    analysis.issues.push({
      type: 'yaml_parse_error',
      severity: 'high',
      message: `Failed to parse Kubernetes YAML: ${error.message}`,
      file: config.path,
      recommendation: 'Check YAML syntax and Kubernetes schema',
    });
  }
}

/**
 * Validate other configuration types (simplified)
 */
async function validateHelmValues(config, analysis, options) {
  // Helm values validation would go here
  analysis.issues.push({
    type: 'partial_validation',
    severity: 'low',
    message: 'Helm values validation not fully implemented',
    file: config.path,
    recommendation: 'Use helm lint for comprehensive validation',
  });
}

async function validateTerraformConfig(config, analysis, options) {
  // Terraform validation would go here
  analysis.issues.push({
    type: 'partial_validation',
    severity: 'low',
    message: 'Terraform validation not fully implemented',
    file: config.path,
    recommendation: 'Use terraform validate for syntax checking',
  });
}

async function validateCloudFormation(config, analysis, options) {
  // CloudFormation validation would go here
  analysis.issues.push({
    type: 'partial_validation',
    severity: 'low',
    message: 'CloudFormation validation not fully implemented',
    file: config.path,
    recommendation: 'Use AWS CLI cloudformation validate-template',
  });
}

async function validateGenericConfig(config, analysis, options) {
  // Generic YAML/JSON validation
  if (config.type === 'json') {
    try {
      JSON.parse(config.content);
    } catch (error) {
      analysis.issues.push({
        type: 'json_syntax_error',
        severity: 'high',
        message: `Invalid JSON syntax: ${error.message}`,
        file: config.path,
        recommendation: 'Fix JSON syntax errors',
      });
    }
  }
}

/**
 * Validate secret values
 */
function validateSecretValue(key, value, filePath, lineNumber, analysis) {
  // Check for hardcoded secrets
  const secretPatterns = [
    { pattern: /^[A-Za-z0-9+/]{40,}={0,2}$/, type: 'base64_encoded', risk: 'medium' },
    { pattern: /^[0-9a-fA-F]{32,}$/, type: 'hex_hash', risk: 'medium' },
    { pattern: /^sk_[a-zA-Z0-9]+$/, type: 'stripe_key', risk: 'high' },
    { pattern: /^AKIA[0-9A-Z]{16}$/, type: 'aws_access_key', risk: 'high' },
    { pattern: /^ghp_[a-zA-Z0-9]{36}$/, type: 'github_token', risk: 'high' },
  ];

  for (const { pattern, type, risk } of secretPatterns) {
    if (pattern.test(value)) {
      analysis.security.secrets.push({
        key,
        type,
        file: filePath,
        line: lineNumber,
        risk,
      });
      
      analysis.issues.push({
        type: 'hardcoded_secret',
        severity: risk === 'high' ? 'critical' : 'high',
        message: `Potential hardcoded secret: ${key} appears to contain ${type}`,
        file: filePath,
        line: lineNumber,
        secretType: type,
        recommendation: 'Use secret management system instead of hardcoded values',
      });
    }
  }

  // Check for suspicious variable names
  const suspiciousNames = ['password', 'secret', 'key', 'token', 'credential'];
  const keyLower = key.toLowerCase();
  
  if (suspiciousNames.some(name => keyLower.includes(name)) && value.length > 8) {
    analysis.security.vulnerabilities.push({
      type: 'suspicious_variable',
      key,
      file: filePath,
      line: lineNumber,
      recommendation: 'Review if this should be managed as a secret',
    });
  }
}

/**
 * Validate variable naming conventions
 */
function validateVariableNaming(key, filePath, lineNumber, analysis) {
  if (!/^[A-Z][A-Z0-9_]*$/.test(key)) {
    analysis.bestPractices.violations.push({
      type: 'naming_convention',
      message: `Environment variable ${key} should use UPPERCASE_WITH_UNDERSCORES`,
      file: filePath,
      line: lineNumber,
      recommendation: 'Use UPPERCASE_WITH_UNDERSCORES for environment variables',
    });
    
    analysis.issues.push({
      type: 'naming_convention',
      severity: 'low',
      message: `Invalid naming convention: ${key}`,
      file: filePath,
      line: lineNumber,
      recommendation: 'Use UPPERCASE_WITH_UNDERSCORES for environment variables',
    });
  }
}

/**
 * Check for required environment variables
 */
function checkRequiredEnvVariables(variables, filePath, analysis, environment) {
  const commonRequired = {
    production: ['NODE_ENV', 'PORT', 'DATABASE_URL'],
    development: ['NODE_ENV'],
    test: ['NODE_ENV', 'TEST_DATABASE_URL'],
    staging: ['NODE_ENV', 'PORT', 'DATABASE_URL'],
  };

  const required = commonRequired[environment] || [];
  
  for (const reqVar of required) {
    if (!variables.has(reqVar)) {
      analysis.completeness.missing.push({
        variable: reqVar,
        environment,
        file: filePath,
      });
      
      analysis.issues.push({
        type: 'missing_required_variable',
        severity: 'medium',
        message: `Missing required environment variable: ${reqVar}`,
        file: filePath,
        environment,
        recommendation: `Add ${reqVar} to environment configuration`,
      });
    }
  }
}

/**
 * Validate Docker security
 */
function validateDockerSecurity(line, filePath, lineNumber, analysis) {
  const securityChecks = [
    {
      pattern: /^USER\s+root$/i,
      severity: 'high',
      message: 'Running as root user',
      recommendation: 'Use non-root user for better security',
    },
    {
      pattern: /^ADD\s+http/i,
      severity: 'medium',
      message: 'Using ADD with HTTP URL',
      recommendation: 'Use COPY or curl with verification instead',
    },
    {
      pattern: /--privileged/i,
      severity: 'critical',
      message: 'Using privileged mode',
      recommendation: 'Avoid privileged mode unless absolutely necessary',
    },
    {
      pattern: /^\s*COPY\s+.*\*.*\//,
      severity: 'low',
      message: 'Wildcard copy operation',
      recommendation: 'Be specific about copied files for security',
    },
  ];

  for (const { pattern, severity, message, recommendation } of securityChecks) {
    if (pattern.test(line)) {
      analysis.issues.push({
        type: 'docker_security',
        severity,
        message,
        file: filePath,
        line: lineNumber,
        recommendation,
      });
    }
  }
}

/**
 * Validate Docker best practices
 */
function validateDockerBestPractices(line, filePath, lineNumber, analysis) {
  const bestPracticeChecks = [
    {
      pattern: /^FROM\s+.*:latest$/i,
      severity: 'medium',
      message: 'Using latest tag',
      recommendation: 'Pin to specific version for reproducible builds',
    },
    {
      pattern: /^RUN\s+apt-get\s+update\s*$/i,
      severity: 'low',
      message: 'apt-get update without install',
      recommendation: 'Combine update and install in single RUN command',
    },
  ];

  for (const { pattern, severity, message, recommendation } of bestPracticeChecks) {
    if (pattern.test(line)) {
      analysis.issues.push({
        type: 'docker_best_practice',
        severity,
        message,
        file: filePath,
        line: lineNumber,
        recommendation,
      });
    }
  }
}

/**
 * Validate Docker Compose service
 */
function validateDockerComposeService(serviceName, serviceConfig, filePath, analysis, options) {
  if (options.checkSecurity) {
    // Check for privileged mode
    if (serviceConfig.privileged) {
      analysis.issues.push({
        type: 'privileged_service',
        severity: 'high',
        message: `Service ${serviceName} runs in privileged mode`,
        file: filePath,
        service: serviceName,
        recommendation: 'Avoid privileged mode unless absolutely necessary',
      });
    }
    
    // Check for host network mode
    if (serviceConfig.network_mode === 'host') {
      analysis.issues.push({
        type: 'host_network',
        severity: 'medium',
        message: `Service ${serviceName} uses host network`,
        file: filePath,
        service: serviceName,
        recommendation: 'Use bridge network for better isolation',
      });
    }
  }
}

/**
 * Validate Kubernetes security
 */
function validateKubernetesSecurity(yamlData, filePath, analysis) {
  if (yamlData.kind === 'Pod' || yamlData.kind === 'Deployment') {
    const spec = yamlData.spec || {};
    const template = spec.template || {};
    const podSpec = template.spec || spec;
    
    // Check for privileged containers
    if (podSpec.containers) {
      for (const container of podSpec.containers) {
        const securityContext = container.securityContext || {};
        
        if (securityContext.privileged) {
          analysis.issues.push({
            type: 'privileged_container',
            severity: 'high',
            message: `Container ${container.name} runs in privileged mode`,
            file: filePath,
            container: container.name,
            recommendation: 'Remove privileged flag unless absolutely necessary',
          });
        }
        
        if (securityContext.runAsUser === 0) {
          analysis.issues.push({
            type: 'root_user',
            severity: 'medium',
            message: `Container ${container.name} runs as root`,
            file: filePath,
            container: container.name,
            recommendation: 'Use non-root user for better security',
          });
        }
      }
    }
  }
}

/**
 * Validate Kubernetes best practices
 */
function validateKubernetesBestPractices(yamlData, filePath, analysis) {
  // Check for resource limits
  if (yamlData.kind === 'Pod' || yamlData.kind === 'Deployment') {
    const spec = yamlData.spec || {};
    const template = spec.template || {};
    const podSpec = template.spec || spec;
    
    if (podSpec.containers) {
      for (const container of podSpec.containers) {
        if (!container.resources || !container.resources.limits) {
          analysis.issues.push({
            type: 'missing_resource_limits',
            severity: 'medium',
            message: `Container ${container.name} lacks resource limits`,
            file: filePath,
            container: container.name,
            recommendation: 'Set CPU and memory limits for predictable resource usage',
          });
        }
      }
    }
  }
}

/**
 * Simple YAML parser for basic structure
 */
function parseSimpleYAML(content) {
  // This is a very basic YAML parser - in production use a proper library
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
 * Generate validation recommendations
 */
function generateValidationRecommendations(analysis) {
  const recommendations = [];

  if (analysis.security.secrets.length > 0) {
    recommendations.push({
      category: 'security',
      priority: 'critical',
      title: 'Secret Management',
      description: `${analysis.security.secrets.length} potential secrets found in configuration`,
      actions: [
        'Use environment-specific secret management (AWS Secrets Manager, Azure Key Vault, etc.)',
        'Implement secret rotation policies',
        'Remove hardcoded secrets from configuration files',
        'Use secret scanning tools in CI/CD pipeline',
      ],
    });
  }

  if (analysis.completeness.missing.length > 0) {
    recommendations.push({
      category: 'completeness',
      priority: 'high',
      title: 'Missing Configuration',
      description: `${analysis.completeness.missing.length} required configuration variables missing`,
      actions: [
        'Add missing environment variables',
        'Create environment-specific configuration templates',
        'Implement configuration validation in application startup',
        'Document required configuration variables',
      ],
    });
  }

  if (analysis.bestPractices.violations.length > 5) {
    recommendations.push({
      category: 'best_practices',
      priority: 'medium',
      title: 'Configuration Best Practices',
      description: `${analysis.bestPractices.violations.length} best practice violations found`,
      actions: [
        'Implement configuration linting in development workflow',
        'Create configuration style guide for team',
        'Use configuration validation tools',
        'Regular configuration audits',
      ],
    });
  }

  analysis.recommendations = recommendations;
}

/**
 * Calculate compliance score
 */
function calculateComplianceScore(analysis) {
  let score = 100;
  
  // Deduct points for issues
  analysis.issues.forEach(issue => {
    switch (issue.severity) {
      case 'critical': score -= 25; break;
      case 'high': score -= 15; break;
      case 'medium': score -= 8; break;
      case 'low': score -= 3; break;
    }
  });
  
  analysis.compliance.score = Math.max(0, Math.min(100, score));
  
  // Update summary
  analysis.summary.totalIssues = analysis.issues.length;
  analysis.summary.securityIssues = analysis.issues.filter(i => 
    ['hardcoded_secret', 'docker_security', 'privileged_container'].includes(i.type)
  ).length;
  analysis.summary.completenessIssues = analysis.issues.filter(i => 
    i.type === 'missing_required_variable'
  ).length;
  analysis.summary.bestPracticeViolations = analysis.issues.filter(i => 
    ['naming_convention', 'docker_best_practice'].includes(i.type)
  ).length;
}

/**
 * Build validation response
 */
function buildValidationResponse(analysis, filteredIssues, format, options) {
  const base = {
    analysis: {
      projectPath: analysis.projectPath,
      environment: analysis.environment,
      strictness: analysis.strictness,
      complianceScore: analysis.compliance.score,
    },
    summary: analysis.summary,
    configs: analysis.configs,
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
      security: {
        secretsFound: analysis.security.secrets.length,
        vulnerabilities: analysis.security.vulnerabilities.length,
      },
      completeness: {
        missingVariables: analysis.completeness.missing.length,
      },
    };
  }

  if (format === 'detailed') {
    return {
      ...base,
      security: analysis.security,
      completeness: analysis.completeness,
      bestPractices: analysis.bestPractices,
      recommendations: analysis.recommendations,
    };
  }

  if (format === 'checklist') {
    const checklist = analysis.issues.map(issue => ({
      checked: false,
      severity: issue.severity,
      description: issue.message,
      file: issue.file,
      action: issue.recommendation,
    }));
    
    return {
      format: 'checklist',
      items: checklist,
      summary: base.summary,
    };
  }

  return base;
}