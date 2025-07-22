/**
 * Container Security Scanner
 * Analyzes Docker containers and configurations for security vulnerabilities and best practices
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname, basename } from 'path';

const execAsync = promisify(exec);

/**
 * Container Security Scanner Tool
 */
export const containerSecurityTool = {
  name: 'container_security_scanner',
  description: 'Analyzes Docker containers and configurations for security vulnerabilities, best practices, and compliance issues.',
  inputSchema: {
    type: 'object',
    properties: {
      projectPath: {
        type: 'string',
        description: 'Path to the project directory (defaults to current directory)',
        default: '.',
      },
      dockerfilePath: {
        type: 'string',
        description: 'Path to Dockerfile (auto-detected if not specified)',
      },
      dockerComposePath: {
        type: 'string',
        description: 'Path to docker-compose.yml (auto-detected if not specified)',
      },
      imageName: {
        type: 'string',
        description: 'Docker image name to analyze (optional)',
      },
      scanType: {
        type: 'string',
        enum: ['dockerfile', 'compose', 'image', 'all'],
        default: 'all',
        description: 'Type of container security scan to perform',
      },
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical', 'all'],
        default: 'medium',
        description: 'Minimum severity level to report',
      },
      includeCompliance: {
        type: 'boolean',
        default: true,
        description: 'Include compliance checks (CIS, NIST)',
      },
      checkBaseImages: {
        type: 'boolean',
        default: true,
        description: 'Check for vulnerable base images',
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
 * Handle container security analysis
 */
export async function handleContainerSecurity(request) {
  try {
    const { 
      projectPath = '.',
      dockerfilePath,
      dockerComposePath,
      imageName,
      scanType = 'all',
      severity = 'medium',
      includeCompliance = true,
      checkBaseImages = true,
      limit = 50,
      offset = 0,
    } = request.params;

    // Discover container files
    const containerFiles = await discoverContainerFiles(projectPath, {
      dockerfilePath,
      dockerComposePath,
    });

    if (containerFiles.length === 0 && !imageName) {
      return {
        content: [{
          type: 'text',
          text: '❌ No container files found (Dockerfile, docker-compose.yml) and no image specified',
        }],
      };
    }

    const analysis = {
      project: projectPath,
      scanType,
      containerFiles,
      vulnerabilities: [],
      bestPractices: [],
      compliance: [],
      baseImages: [],
    };

    // Perform different types of scans based on scanType
    if (scanType === 'dockerfile' || scanType === 'all') {
      for (const file of containerFiles.filter(f => f.type === 'dockerfile')) {
        await analyzeDockerfile(file, analysis, { severity, includeCompliance, checkBaseImages });
      }
    }

    if (scanType === 'compose' || scanType === 'all') {
      for (const file of containerFiles.filter(f => f.type === 'compose')) {
        await analyzeDockerCompose(file, analysis, { severity, includeCompliance });
      }
    }

    if ((scanType === 'image' || scanType === 'all') && imageName) {
      await analyzeDockerImage(imageName, analysis, { severity });
    }

    // Filter by severity
    const filteredVulnerabilities = filterBySeverity(analysis.vulnerabilities, severity);
    const filteredBestPractices = filterBySeverity(analysis.bestPractices, severity);
    const filteredCompliance = filterBySeverity(analysis.compliance, severity);

    // Combine all issues for pagination
    const allIssues = [
      ...filteredVulnerabilities,
      ...filteredBestPractices,
      ...filteredCompliance,
    ];

    const paginatedIssues = allIssues.slice(offset, offset + limit);

    // Build response
    const response = {
      analysis: {
        project: projectPath,
        scanType,
        filesAnalyzed: containerFiles.length,
        totalIssues: allIssues.length,
      },
      containerFiles,
      vulnerabilities: filteredVulnerabilities,
      bestPractices: filteredBestPractices,
      compliance: includeCompliance ? filteredCompliance : [],
      baseImages: checkBaseImages ? analysis.baseImages : [],
      summary: {
        critical: allIssues.filter(i => i.severity === 'critical').length,
        high: allIssues.filter(i => i.severity === 'high').length,
        medium: allIssues.filter(i => i.severity === 'medium').length,
        low: allIssues.filter(i => i.severity === 'low').length,
      },
      pagination: {
        offset,
        limit,
        total: allIssues.length,
        hasMore: offset + limit < allIssues.length,
      },
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };

  } catch (error) {
    console.error('[ContainerSecurity] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Container security analysis failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Discover container files in the project
 */
async function discoverContainerFiles(projectPath, options = {}) {
  const files = [];
  
  // Look for Dockerfiles
  const dockerfileNames = [
    'Dockerfile',
    'dockerfile',
    'Dockerfile.prod',
    'Dockerfile.dev',
    'Dockerfile.test',
  ];

  if (options.dockerfilePath) {
    dockerfileNames.unshift(options.dockerfilePath);
  }

  for (const filename of dockerfileNames) {
    const fullPath = join(projectPath, filename);
    if (existsSync(fullPath)) {
      files.push({
        type: 'dockerfile',
        path: fullPath,
        name: filename,
        size: require('fs').statSync(fullPath).size,
      });
    }
  }

  // Look for docker-compose files
  const composeNames = [
    'docker-compose.yml',
    'docker-compose.yaml',
    'docker-compose.prod.yml',
    'docker-compose.dev.yml',
    'docker-compose.override.yml',
  ];

  if (options.dockerComposePath) {
    composeNames.unshift(options.dockerComposePath);
  }

  for (const filename of composeNames) {
    const fullPath = join(projectPath, filename);
    if (existsSync(fullPath)) {
      files.push({
        type: 'compose',
        path: fullPath,
        name: filename,
        size: require('fs').statSync(fullPath).size,
      });
    }
  }

  return files;
}

/**
 * Analyze Dockerfile for security issues
 */
async function analyzeDockerfile(file, analysis, options) {
  try {
    const content = readFileSync(file.path, 'utf8');
    const lines = content.split('\n');

    let currentUser = 'root';
    let exposedPorts = [];
    let baseImage = null;
    let hasHealthCheck = false;
    let copiesWithRoot = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      // Skip comments and empty lines
      if (trimmed.startsWith('#') || !trimmed) return;

      const instruction = trimmed.split(' ')[0].toUpperCase();
      const args = trimmed.substring(instruction.length).trim();

      switch (instruction) {
        case 'FROM':
          baseImage = args;
          if (options.checkBaseImages) {
            checkBaseImageSecurity(args, analysis, file.path, lineNumber);
          }
          break;

        case 'USER':
          currentUser = args;
          if (args === 'root' || args === '0') {
            analysis.bestPractices.push({
              type: 'user_privileges',
              severity: 'high',
              message: 'Running as root user is not recommended',
              file: file.path,
              line: lineNumber,
              recommendation: 'Create and use a non-root user',
              instruction: trimmed,
            });
          }
          break;

        case 'EXPOSE':
          const ports = args.split(' ').map(p => p.trim());
          exposedPorts.push(...ports);
          
          ports.forEach(port => {
            const portNum = parseInt(port.split('/')[0]);
            if (portNum < 1024 && currentUser !== 'root') {
              analysis.vulnerabilities.push({
                type: 'privileged_port',
                severity: 'medium',
                message: `Exposing privileged port ${port} without root user`,
                file: file.path,
                line: lineNumber,
                recommendation: 'Use ports above 1024 or ensure proper privileges',
                instruction: trimmed,
              });
            }
          });
          break;

        case 'COPY':
        case 'ADD':
          if (currentUser === 'root') {
            copiesWithRoot = true;
          }
          
          // Check for dangerous ADD usage
          if (instruction === 'ADD' && args.includes('http')) {
            analysis.vulnerabilities.push({
              type: 'unsafe_add',
              severity: 'medium',
              message: 'ADD with URLs can be dangerous',
              file: file.path,
              line: lineNumber,
              recommendation: 'Use COPY for local files, RUN wget/curl for remote files',
              instruction: trimmed,
            });
          }
          
          // Check for overly broad COPY
          if (args.startsWith('. ') || args.startsWith('./ ')) {
            analysis.bestPractices.push({
              type: 'broad_copy',
              severity: 'low',
              message: 'Copying entire context may include unnecessary files',
              file: file.path,
              line: lineNumber,
              recommendation: 'Use .dockerignore or copy specific files/directories',
              instruction: trimmed,
            });
          }
          break;

        case 'RUN':
          checkRunInstruction(args, analysis, file.path, lineNumber, trimmed);
          break;

        case 'WORKDIR':
          if (!args.startsWith('/')) {
            analysis.bestPractices.push({
              type: 'relative_workdir',
              severity: 'low',
              message: 'WORKDIR should use absolute paths',
              file: file.path,
              line: lineNumber,
              recommendation: 'Use absolute path for WORKDIR',
              instruction: trimmed,
            });
          }
          break;

        case 'HEALTHCHECK':
          hasHealthCheck = true;
          break;
      }
    });

    // Check if health check is missing
    if (!hasHealthCheck) {
      analysis.bestPractices.push({
        type: 'missing_healthcheck',
        severity: 'low',
        message: 'No HEALTHCHECK instruction found',
        file: file.path,
        recommendation: 'Add HEALTHCHECK instruction for better container monitoring',
      });
    }

    // Check if files are copied as root
    if (copiesWithRoot) {
      analysis.bestPractices.push({
        type: 'root_file_operations',
        severity: 'medium',
        message: 'Files copied as root user',
        file: file.path,
        recommendation: 'Set proper user before copying files or use --chown flag',
      });
    }

    // Store base image info
    if (baseImage) {
      analysis.baseImages.push({
        image: baseImage,
        file: file.path,
        status: 'analyzed',
      });
    }

  } catch (error) {
    analysis.vulnerabilities.push({
      type: 'parse_error',
      severity: 'medium',
      message: `Failed to parse Dockerfile: ${error.message}`,
      file: file.path,
    });
  }
}

/**
 * Check RUN instruction for security issues
 */
function checkRunInstruction(args, analysis, filePath, lineNumber, instruction) {
  // Check for package manager usage without update
  if (args.includes('apt-get install') && !args.includes('apt-get update')) {
    analysis.bestPractices.push({
      type: 'package_manager',
      severity: 'medium',
      message: 'apt-get install without update may install outdated packages',
      file: filePath,
      line: lineNumber,
      recommendation: 'Combine apt-get update && apt-get install in single RUN',
      instruction,
    });
  }

  // Check for missing cleanup
  if ((args.includes('apt-get') || args.includes('yum') || args.includes('apk')) &&
      !args.includes('clean') && !args.includes('rm -rf')) {
    analysis.bestPractices.push({
      type: 'package_cleanup',
      severity: 'low',
      message: 'Package manager usage without cleanup',
      file: filePath,
      line: lineNumber,
      recommendation: 'Clean up package cache to reduce image size',
      instruction,
    });
  }

  // Check for curl/wget without signature verification
  if ((args.includes('curl') || args.includes('wget')) && 
      !args.includes('--gpg') && !args.includes('--verify')) {
    analysis.vulnerabilities.push({
      type: 'unverified_download',
      severity: 'medium',
      message: 'Downloading files without signature verification',
      file: filePath,
      line: lineNumber,
      recommendation: 'Verify downloaded files with GPG or checksums',
      instruction,
    });
  }

  // Check for sudo usage
  if (args.includes('sudo')) {
    analysis.vulnerabilities.push({
      type: 'sudo_usage',
      severity: 'high',
      message: 'sudo usage in container is not recommended',
      file: filePath,
      line: lineNumber,
      recommendation: 'Use proper USER instruction instead of sudo',
      instruction,
    });
  }

  // Check for password in command
  if (args.includes('password=') || args.includes('--password')) {
    analysis.vulnerabilities.push({
      type: 'hardcoded_credentials',
      severity: 'critical',
      message: 'Hardcoded credentials found in RUN instruction',
      file: filePath,
      line: lineNumber,
      recommendation: 'Use build args or secrets for sensitive data',
      instruction,
    });
  }
}

/**
 * Check base image security
 */
function checkBaseImageSecurity(baseImage, analysis, filePath, lineNumber) {
  const vulnerableImages = {
    'ubuntu:latest': 'Using latest tag is not recommended for production',
    'centos:latest': 'Using latest tag is not recommended for production',
    'debian:latest': 'Using latest tag is not recommended for production',
    'node:latest': 'Using latest tag is not recommended for production',
    'python:latest': 'Using latest tag is not recommended for production',
  };

  // Check for latest tag usage
  if (baseImage.includes(':latest') || !baseImage.includes(':')) {
    analysis.bestPractices.push({
      type: 'latest_tag',
      severity: 'medium',
      message: 'Using latest tag or no tag specified',
      file: filePath,
      line: lineNumber,
      recommendation: 'Pin to specific version tag for reproducible builds',
      baseImage,
    });
  }

  // Check for known vulnerable base images
  if (vulnerableImages[baseImage]) {
    analysis.vulnerabilities.push({
      type: 'vulnerable_base',
      severity: 'medium',
      message: vulnerableImages[baseImage],
      file: filePath,
      line: lineNumber,
      recommendation: 'Use specific version tags and regularly update base images',
      baseImage,
    });
  }

  // Check for minimal base images
  const heavyImages = ['ubuntu', 'centos', 'debian'];
  const imageBase = baseImage.split(':')[0];
  if (heavyImages.some(heavy => imageBase.includes(heavy))) {
    analysis.bestPractices.push({
      type: 'heavy_base_image',
      severity: 'low',
      message: 'Consider using minimal base images like alpine',
      file: filePath,
      line: lineNumber,
      recommendation: 'Use alpine-based images for smaller attack surface',
      baseImage,
    });
  }
}

/**
 * Analyze Docker Compose file
 */
async function analyzeDockerCompose(file, analysis, options) {
  try {
    const content = readFileSync(file.path, 'utf8');
    
    // Simple YAML parsing for docker-compose
    const lines = content.split('\n');
    let currentService = null;
    let inVolumes = false;
    let inPorts = false;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      const lineNumber = index + 1;

      if (trimmed.startsWith('#') || !trimmed) return;

      // Detect service definition
      if (line.match(/^\s+\w+:/) && line.indexOf(':') > 0) {
        currentService = trimmed.split(':')[0];
        inVolumes = false;
        inPorts = false;
      }

      // Check for privileged mode
      if (trimmed.includes('privileged: true')) {
        analysis.vulnerabilities.push({
          type: 'privileged_container',
          severity: 'critical',
          message: 'Container running in privileged mode',
          file: file.path,
          line: lineNumber,
          service: currentService,
          recommendation: 'Avoid privileged mode, use specific capabilities instead',
        });
      }

      // Check for host network mode
      if (trimmed.includes('network_mode: host') || trimmed.includes('network_mode: "host"')) {
        analysis.vulnerabilities.push({
          type: 'host_network',
          severity: 'high',
          message: 'Container using host network mode',
          file: file.path,
          line: lineNumber,
          service: currentService,
          recommendation: 'Use bridge networking instead of host mode',
        });
      }

      // Check for volume mounts
      if (trimmed === 'volumes:') {
        inVolumes = true;
      } else if (inVolumes && trimmed.startsWith('-')) {
        const volume = trimmed.substring(1).trim();
        if (volume.includes(':/') && !volume.includes(':ro')) {
          analysis.bestPractices.push({
            type: 'writable_volume',
            severity: 'medium',
            message: 'Volume mounted as writable',
            file: file.path,
            line: lineNumber,
            service: currentService,
            recommendation: 'Consider read-only mounts where possible (:ro)',
            volume,
          });
        }

        // Check for dangerous volume mounts
        if (volume.includes('/var/run/docker.sock')) {
          analysis.vulnerabilities.push({
            type: 'docker_socket_mount',
            severity: 'critical',
            message: 'Docker socket mounted in container',
            file: file.path,
            line: lineNumber,
            service: currentService,
            recommendation: 'Avoid mounting Docker socket unless absolutely necessary',
          });
        }
      }

      // Check for port bindings
      if (trimmed === 'ports:') {
        inPorts = true;
      } else if (inPorts && trimmed.startsWith('-')) {
        const port = trimmed.substring(1).trim();
        if (port.includes('0.0.0.0:') || (!port.includes(':') && port.match(/^\d+$/))) {
          analysis.vulnerabilities.push({
            type: 'exposed_port',
            severity: 'medium',
            message: 'Port exposed to all interfaces',
            file: file.path,
            line: lineNumber,
            service: currentService,
            recommendation: 'Bind to specific interfaces (127.0.0.1) if not needed externally',
            port,
          });
        }
      }

      // Check for environment variables with secrets
      if (trimmed.includes('PASSWORD=') || trimmed.includes('SECRET=') || trimmed.includes('API_KEY=')) {
        analysis.vulnerabilities.push({
          type: 'hardcoded_secrets',
          severity: 'critical',
          message: 'Hardcoded secrets in environment variables',
          file: file.path,
          line: lineNumber,
          service: currentService,
          recommendation: 'Use Docker secrets or external secret management',
        });
      }
    });

  } catch (error) {
    analysis.vulnerabilities.push({
      type: 'parse_error',
      severity: 'medium',
      message: `Failed to parse Docker Compose file: ${error.message}`,
      file: file.path,
    });
  }
}

/**
 * Analyze Docker image (requires Docker)
 */
async function analyzeDockerImage(imageName, analysis, options) {
  try {
    // Check if Docker is available
    await execAsync('docker --version');

    // Get image information
    const { stdout } = await execAsync(`docker inspect ${imageName}`);
    const imageInfo = JSON.parse(stdout)[0];

    // Check image configuration
    const config = imageInfo.Config || {};

    // Check if running as root
    if (config.User === '' || config.User === 'root' || config.User === '0') {
      analysis.vulnerabilities.push({
        type: 'root_user',
        severity: 'high',
        message: 'Image configured to run as root user',
        image: imageName,
        recommendation: 'Configure image to run as non-root user',
      });
    }

    // Check exposed ports
    if (config.ExposedPorts) {
      Object.keys(config.ExposedPorts).forEach(port => {
        const portNum = parseInt(port.split('/')[0]);
        if (portNum < 1024) {
          analysis.bestPractices.push({
            type: 'privileged_port',
            severity: 'medium',
            message: `Image exposes privileged port ${port}`,
            image: imageName,
            recommendation: 'Use non-privileged ports (>1024) when possible',
          });
        }
      });
    }

    // Check for health check
    if (!config.Healthcheck) {
      analysis.bestPractices.push({
        type: 'no_healthcheck',
        severity: 'low',
        message: 'Image has no health check configured',
        image: imageName,
        recommendation: 'Add health check for better container monitoring',
      });
    }

  } catch (error) {
    analysis.vulnerabilities.push({
      type: 'image_analysis_error',
      severity: 'low',
      message: `Could not analyze image: ${error.message}`,
      image: imageName,
      recommendation: 'Ensure Docker is available and image exists',
    });
  }
}

/**
 * Filter issues by severity
 */
function filterBySeverity(issues, minSeverity) {
  if (minSeverity === 'all') return issues;

  const severityLevels = {
    'low': 1,
    'medium': 2,
    'high': 3,
    'critical': 4,
  };

  const minLevel = severityLevels[minSeverity] || 2;
  return issues.filter(issue => (severityLevels[issue.severity] || 2) >= minLevel);
}