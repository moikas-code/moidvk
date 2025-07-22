/**
 * OpenAPI/REST API Validator
 * Validates OpenAPI specifications and REST API designs for best practices and compliance
 */

import { promisify } from 'util';
import { exec } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, extname } from 'path';

const execAsync = promisify(exec);

/**
 * OpenAPI/REST API Validator Tool
 */
export const openApiValidatorTool = {
  name: 'openapi_rest_validator',
  description: 'Validates OpenAPI specifications and REST API designs for compliance, security, and best practices.',
  inputSchema: {
    type: 'object',
    properties: {
      spec: {
        type: 'string',
        description: 'OpenAPI specification content (JSON or YAML)',
      },
      specPath: {
        type: 'string',
        description: 'Path to OpenAPI specification file',
      },
      version: {
        type: 'string',
        enum: ['2.0', '3.0', '3.1', 'auto'],
        default: 'auto',
        description: 'OpenAPI specification version',
      },
      validationType: {
        type: 'string',
        enum: ['syntax', 'semantic', 'security', 'best-practices', 'all'],
        default: 'all',
        description: 'Type of validation to perform',
      },
      strictness: {
        type: 'string',
        enum: ['minimal', 'standard', 'strict'],
        default: 'standard',
        description: 'Validation strictness level',
      },
      includeExamples: {
        type: 'boolean',
        default: true,
        description: 'Validate examples in the specification',
      },
      checkSecurity: {
        type: 'boolean',
        default: true,
        description: 'Perform security-focused validation',
      },
      restCompliance: {
        type: 'boolean',
        default: true,
        description: 'Check REST API design compliance',
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
 * Handle OpenAPI/REST API validation
 */
export async function handleOpenApiValidator(request) {
  try {
    const { 
      spec,
      specPath,
      version = 'auto',
      validationType = 'all',
      strictness = 'standard',
      includeExamples = true,
      checkSecurity = true,
      restCompliance = true,
      limit = 50,
      offset = 0,
    } = request.params;

    let specContent = spec;
    let filename = 'openapi.yaml';

    // Load spec from file if path provided
    if (specPath) {
      if (!existsSync(specPath)) {
        return {
          content: [{
            type: 'text',
            text: `❌ OpenAPI specification file not found: ${specPath}`,
          }],
        };
      }
      
      specContent = readFileSync(specPath, 'utf8');
      filename = specPath;
    }

    if (!specContent) {
      return {
        content: [{
          type: 'text',
          text: '❌ No OpenAPI specification provided',
        }],
      };
    }

    // Parse the specification
    let parsedSpec;
    try {
      parsedSpec = parseOpenApiSpec(specContent, filename);
    } catch (parseError) {
      return {
        content: [{
          type: 'text',
          text: `❌ Failed to parse OpenAPI specification: ${parseError.message}`,
        }],
      };
    }

    // Detect version if auto
    const detectedVersion = version === 'auto' ? detectOpenApiVersion(parsedSpec) : version;
    
    const analysis = {
      version: detectedVersion,
      filename,
      issues: [],
      metrics: {
        totalPaths: 0,
        totalOperations: 0,
        totalSchemas: 0,
        securitySchemes: 0,
        documentedOperations: 0,
        validExamples: 0,
        totalExamples: 0,
      },
      security: {
        hasAuth: false,
        vulnerabilities: [],
        recommendations: [],
      },
      restCompliance: {
        score: 100,
        violations: [],
      },
    };

    // Perform different types of validation
    if (validationType === 'syntax' || validationType === 'all') {
      await validateSyntax(parsedSpec, analysis, { strictness });
    }

    if (validationType === 'semantic' || validationType === 'all') {
      await validateSemantics(parsedSpec, analysis, { strictness, includeExamples });
    }

    if ((validationType === 'security' || validationType === 'all') && checkSecurity) {
      await validateSecurity(parsedSpec, analysis, { strictness });
    }

    if ((validationType === 'best-practices' || validationType === 'all') && restCompliance) {
      await validateRestCompliance(parsedSpec, analysis, { strictness });
    }

    // Filter and paginate issues
    const filteredIssues = analysis.issues.slice(offset, offset + limit);

    // Calculate overall score
    const overallScore = calculateApiScore(analysis);

    // Build response
    const response = {
      validation: {
        version: detectedVersion,
        type: validationType,
        strictness,
        filename,
        score: overallScore,
      },
      metrics: analysis.metrics,
      issues: filteredIssues,
      security: checkSecurity ? analysis.security : undefined,
      restCompliance: restCompliance ? analysis.restCompliance : undefined,
      summary: {
        totalIssues: analysis.issues.length,
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
    console.error('[OpenApiValidator] Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ OpenAPI validation failed: ${error.message}`,
      }],
    };
  }
}

/**
 * Parse OpenAPI specification (JSON or YAML)
 */
function parseOpenApiSpec(content, filename) {
  const isYaml = filename.endsWith('.yaml') || filename.endsWith('.yml') || 
                 content.trim().startsWith('openapi:') || content.trim().startsWith('swagger:');
  
  if (isYaml) {
    // Simple YAML parsing for OpenAPI (in production, use a proper YAML parser)
    return parseSimpleYaml(content);
  } else {
    return JSON.parse(content);
  }
}

/**
 * Simple YAML parser for OpenAPI specs
 */
function parseSimpleYaml(yamlContent) {
  // This is a simplified YAML parser for demonstration
  // In production, use a proper YAML library like 'js-yaml'
  
  const lines = yamlContent.split('\n');
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
        // Try to parse as number or boolean
        if (cleanValue === 'true') current[cleanKey] = true;
        else if (cleanValue === 'false') current[cleanKey] = false;
        else if (!isNaN(cleanValue)) current[cleanKey] = Number(cleanValue);
        else current[cleanKey] = cleanValue.replace(/^['"]|['"]$/g, '');
      } else {
        // Object or array
        current[cleanKey] = {};
        stack.push(current[cleanKey]);
        currentIndent = indent;
      }
    }
  }
  
  return result;
}

/**
 * Detect OpenAPI version from spec
 */
function detectOpenApiVersion(spec) {
  if (spec.openapi) {
    return spec.openapi.startsWith('3.1') ? '3.1' : '3.0';
  } else if (spec.swagger) {
    return '2.0';
  }
  return '3.0'; // default assumption
}

/**
 * Validate OpenAPI syntax
 */
async function validateSyntax(spec, analysis, options) {
  // Check required root properties
  if (!spec.openapi && !spec.swagger) {
    analysis.issues.push({
      type: 'syntax',
      severity: 'critical',
      message: 'Missing required "openapi" or "swagger" version field',
      path: '/',
      recommendation: 'Add version field (e.g., "openapi": "3.0.0")',
    });
  }

  if (!spec.info) {
    analysis.issues.push({
      type: 'syntax',
      severity: 'critical',
      message: 'Missing required "info" object',
      path: '/',
      recommendation: 'Add info object with title and version',
    });
  } else {
    if (!spec.info.title) {
      analysis.issues.push({
        type: 'syntax',
        severity: 'high',
        message: 'Missing required "title" in info object',
        path: '/info',
        recommendation: 'Add descriptive title for the API',
      });
    }

    if (!spec.info.version) {
      analysis.issues.push({
        type: 'syntax',
        severity: 'high',
        message: 'Missing required "version" in info object',
        path: '/info',
        recommendation: 'Add version field (e.g., "1.0.0")',
      });
    }
  }

  if (!spec.paths) {
    analysis.issues.push({
      type: 'syntax',
      severity: 'critical',
      message: 'Missing required "paths" object',
      path: '/',
      recommendation: 'Add paths object with API endpoints',
    });
    return;
  }

  // Validate paths structure
  validatePathsStructure(spec.paths, analysis, options);
  
  // Update metrics
  analysis.metrics.totalPaths = Object.keys(spec.paths || {}).length;
  analysis.metrics.totalSchemas = Object.keys(spec.components?.schemas || spec.definitions || {}).length;
}

/**
 * Validate paths structure
 */
function validatePathsStructure(paths, analysis, options) {
  let totalOperations = 0;
  let documentedOperations = 0;

  for (const [path, pathItem] of Object.entries(paths)) {
    // Validate path format
    if (!path.startsWith('/')) {
      analysis.issues.push({
        type: 'syntax',
        severity: 'high',
        message: `Path "${path}" must start with "/"`,
        path: `/paths/${path}`,
        recommendation: 'Ensure all paths start with forward slash',
      });
    }

    // Check for path parameters format
    const pathParams = path.match(/{[^}]+}/g) || [];
    pathParams.forEach(param => {
      if (!param.match(/^{[a-zA-Z_][a-zA-Z0-9_]*}$/)) {
        analysis.issues.push({
          type: 'syntax',
          severity: 'medium',
          message: `Invalid path parameter format: ${param}`,
          path: `/paths/${path}`,
          recommendation: 'Use valid parameter names (alphanumeric and underscore only)',
        });
      }
    });

    // Validate operations
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
    for (const [method, operation] of Object.entries(pathItem)) {
      if (httpMethods.includes(method.toLowerCase())) {
        totalOperations++;
        
        if (operation.summary || operation.description) {
          documentedOperations++;
        } else if (options.strictness !== 'minimal') {
          analysis.issues.push({
            type: 'documentation',
            severity: 'medium',
            message: `Operation ${method.toUpperCase()} ${path} missing summary/description`,
            path: `/paths/${path}/${method}`,
            recommendation: 'Add summary or description to document the operation',
          });
        }

        // Validate operation structure
        validateOperation(path, method, operation, analysis, options);
      }
    }
  }

  analysis.metrics.totalOperations = totalOperations;
  analysis.metrics.documentedOperations = documentedOperations;
}

/**
 * Validate individual operation
 */
function validateOperation(path, method, operation, analysis, options) {
  // Check for operationId uniqueness (would need to track globally)
  if (!operation.operationId && options.strictness === 'strict') {
    analysis.issues.push({
      type: 'best-practices',
      severity: 'low',
      message: `Operation ${method.toUpperCase()} ${path} missing operationId`,
      path: `/paths/${path}/${method}`,
      recommendation: 'Add unique operationId for better code generation',
    });
  }

  // Validate responses
  if (!operation.responses) {
    analysis.issues.push({
      type: 'syntax',
      severity: 'critical',
      message: `Operation ${method.toUpperCase()} ${path} missing responses`,
      path: `/paths/${path}/${method}`,
      recommendation: 'Add responses object with at least success response',
    });
  } else {
    validateResponses(path, method, operation.responses, analysis, options);
  }

  // Validate parameters
  if (operation.parameters) {
    validateParameters(path, method, operation.parameters, analysis, options);
  }

  // Check for request body in appropriate methods
  if (['post', 'put', 'patch'].includes(method.toLowerCase()) && !operation.requestBody && !operation.parameters?.some(p => p.in === 'body')) {
    if (options.strictness !== 'minimal') {
      analysis.issues.push({
        type: 'best-practices',
        severity: 'medium',
        message: `${method.toUpperCase()} operation typically requires request body`,
        path: `/paths/${path}/${method}`,
        recommendation: 'Consider adding requestBody for data modification operations',
      });
    }
  }
}

/**
 * Validate responses
 */
function validateResponses(path, method, responses, analysis, options) {
  const statusCodes = Object.keys(responses);
  
  // Check for success response
  const hasSuccess = statusCodes.some(code => code.startsWith('2') || code === 'default');
  if (!hasSuccess) {
    analysis.issues.push({
      type: 'best-practices',
      severity: 'high',
      message: `Operation ${method.toUpperCase()} ${path} missing success response`,
      path: `/paths/${path}/${method}/responses`,
      recommendation: 'Add at least one 2xx success response',
    });
  }

  // Check for error responses
  const hasErrorResponse = statusCodes.some(code => code.startsWith('4') || code.startsWith('5'));
  if (!hasErrorResponse && options.strictness !== 'minimal') {
    analysis.issues.push({
      type: 'best-practices',
      severity: 'low',
      message: `Operation ${method.toUpperCase()} ${path} missing error responses`,
      path: `/paths/${path}/${method}/responses`,
      recommendation: 'Add common error responses (400, 401, 404, 500)',
    });
  }

  // Validate individual responses
  for (const [statusCode, response] of Object.entries(responses)) {
    if (!response.description && statusCode !== 'default') {
      analysis.issues.push({
        type: 'syntax',
        severity: 'medium',
        message: `Response ${statusCode} missing required description`,
        path: `/paths/${path}/${method}/responses/${statusCode}`,
        recommendation: 'Add description explaining when this response occurs',
      });
    }
  }
}

/**
 * Validate parameters
 */
function validateParameters(path, method, parameters, analysis, options) {
  const paramNames = new Set();
  
  parameters.forEach((param, index) => {
    // Check for duplicate parameter names
    const paramKey = `${param.name}-${param.in}`;
    if (paramNames.has(paramKey)) {
      analysis.issues.push({
        type: 'syntax',
        severity: 'high',
        message: `Duplicate parameter "${param.name}" in ${param.in}`,
        path: `/paths/${path}/${method}/parameters/${index}`,
        recommendation: 'Ensure parameter names are unique within their location',
      });
    }
    paramNames.add(paramKey);

    // Validate required fields
    if (!param.name) {
      analysis.issues.push({
        type: 'syntax',
        severity: 'critical',
        message: 'Parameter missing required "name" field',
        path: `/paths/${path}/${method}/parameters/${index}`,
        recommendation: 'Add name field to parameter',
      });
    }

    if (!param.in) {
      analysis.issues.push({
        type: 'syntax',
        severity: 'critical',
        message: 'Parameter missing required "in" field',
        path: `/paths/${path}/${method}/parameters/${index}`,
        recommendation: 'Add "in" field (query, header, path, cookie)',
      });
    }

    if (param.in === 'path' && !param.required) {
      analysis.issues.push({
        type: 'syntax',
        severity: 'high',
        message: `Path parameter "${param.name}" must be required`,
        path: `/paths/${path}/${method}/parameters/${index}`,
        recommendation: 'Set required: true for path parameters',
      });
    }
  });
}

/**
 * Validate semantic aspects
 */
async function validateSemantics(spec, analysis, options) {
  // Check for consistent naming conventions
  validateNamingConventions(spec, analysis);
  
  // Validate examples if present
  if (options.includeExamples) {
    validateExamples(spec, analysis);
  }
  
  // Check for proper HTTP status code usage
  validateHttpStatusCodes(spec, analysis);
  
  // Validate schema references
  validateSchemaReferences(spec, analysis);
}

/**
 * Validate naming conventions
 */
function validateNamingConventions(spec, analysis) {
  // Check path naming (kebab-case is common)
  for (const path of Object.keys(spec.paths || {})) {
    const segments = path.split('/').filter(s => s && !s.startsWith('{'));
    segments.forEach(segment => {
      if (segment.includes('_') || /[A-Z]/.test(segment)) {
        analysis.issues.push({
          type: 'best-practices',
          severity: 'low',
          message: `Path segment "${segment}" should use kebab-case`,
          path: `/paths/${path}`,
          recommendation: 'Use kebab-case for path segments (e.g., /user-profiles)',
        });
      }
    });
  }

  // Check schema property naming (camelCase is common)
  const schemas = spec.components?.schemas || spec.definitions || {};
  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (schema.properties) {
      for (const propName of Object.keys(schema.properties)) {
        if (propName.includes('-') || propName.includes('_')) {
          analysis.issues.push({
            type: 'best-practices',
            severity: 'low',
            message: `Property "${propName}" should use camelCase`,
            path: `/components/schemas/${schemaName}/properties/${propName}`,
            recommendation: 'Use camelCase for property names (e.g., firstName)',
          });
        }
      }
    }
  }
}

/**
 * Validate examples
 */
function validateExamples(spec, analysis) {
  // This would validate examples against schemas
  // For now, just count examples
  let totalExamples = 0;
  let validExamples = 0;

  // Count examples in schemas
  const schemas = spec.components?.schemas || spec.definitions || {};
  for (const schema of Object.values(schemas)) {
    if (schema.example) {
      totalExamples++;
      validExamples++; // Assume valid for now
    }
  }

  analysis.metrics.totalExamples = totalExamples;
  analysis.metrics.validExamples = validExamples;
}

/**
 * Validate HTTP status codes
 */
function validateHttpStatusCodes(spec, analysis) {
  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation.responses) continue;

      for (const statusCode of Object.keys(operation.responses)) {
        if (statusCode === 'default') continue;

        // Check for invalid status codes
        if (!/^[1-5]\d{2}$/.test(statusCode) && statusCode !== 'default') {
          analysis.issues.push({
            type: 'semantic',
            severity: 'medium',
            message: `Invalid HTTP status code: ${statusCode}`,
            path: `/paths/${path}/${method}/responses/${statusCode}`,
            recommendation: 'Use valid HTTP status codes (100-599)',
          });
        }

        // Check for inappropriate status codes for methods
        const methodUpper = method.toUpperCase();
        if (methodUpper === 'POST' && statusCode === '200') {
          analysis.issues.push({
            type: 'best-practices',
            severity: 'low',
            message: 'POST operations typically return 201 for resource creation',
            path: `/paths/${path}/${method}/responses/${statusCode}`,
            recommendation: 'Consider using 201 Created for successful POST operations',
          });
        }
      }
    }
  }
}

/**
 * Validate schema references
 */
function validateSchemaReferences(spec, analysis) {
  const schemas = new Set(Object.keys(spec.components?.schemas || spec.definitions || {}));
  
  // Simple reference validation (would need recursive traversal in production)
  const specString = JSON.stringify(spec);
  const references = specString.match(/"\$ref":\s*"[^"]+"/g) || [];
  
  references.forEach(ref => {
    const refPath = ref.match(/"([^"]+)"/)[1];
    if (refPath.includes('#/components/schemas/') || refPath.includes('#/definitions/')) {
      const schemaName = refPath.split('/').pop();
      if (!schemas.has(schemaName)) {
        analysis.issues.push({
          type: 'semantic',
          severity: 'high',
          message: `Reference to undefined schema: ${schemaName}`,
          path: 'various',
          recommendation: `Define schema "${schemaName}" or fix reference`,
        });
      }
    }
  });
}

/**
 * Validate security aspects
 */
async function validateSecurity(spec, analysis, options) {
  analysis.security.hasAuth = !!(spec.components?.securitySchemes || spec.securityDefinitions);
  analysis.metrics.securitySchemes = Object.keys(spec.components?.securitySchemes || spec.securityDefinitions || {}).length;

  // Check for global security
  if (!spec.security && !analysis.security.hasAuth) {
    analysis.security.vulnerabilities.push({
      type: 'missing_security',
      severity: 'critical',
      message: 'API has no security schemes defined',
      recommendation: 'Add authentication/authorization mechanisms',
    });
  }

  // Check for HTTPS requirement
  if (spec.schemes && spec.schemes.includes('http') && !spec.schemes.includes('https')) {
    analysis.security.vulnerabilities.push({
      type: 'insecure_transport',
      severity: 'high',
      message: 'API allows HTTP connections',
      recommendation: 'Require HTTPS for all connections',
    });
  }

  // Check for sensitive data in examples
  const specString = JSON.stringify(spec).toLowerCase();
  const sensitivePatterns = ['password', 'token', 'key', 'secret'];
  sensitivePatterns.forEach(pattern => {
    if (specString.includes(`"${pattern}":`)) {
      analysis.security.vulnerabilities.push({
        type: 'sensitive_data_exposure',
        severity: 'medium',
        message: `Possible sensitive data in specification: ${pattern}`,
        recommendation: 'Avoid including sensitive data in API specifications',
      });
    }
  });

  // Security recommendations
  if (analysis.metrics.securitySchemes === 0) {
    analysis.security.recommendations.push('Implement authentication (OAuth 2.0, API keys, etc.)');
  }
  
  analysis.security.recommendations.push('Use HTTPS for all API communications');
  analysis.security.recommendations.push('Implement proper authorization checks');
  analysis.security.recommendations.push('Validate all input parameters');
}

/**
 * Validate REST compliance
 */
async function validateRestCompliance(spec, analysis, options) {
  let score = 100;
  const violations = [];

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      const methodUpper = method.toUpperCase();
      
      // Check for proper HTTP method usage
      if (methodUpper === 'GET' && operation.requestBody) {
        violations.push({
          type: 'http_method_misuse',
          severity: 'medium',
          message: `GET ${path} should not have request body`,
          path: `/paths/${path}/${method}`,
          recommendation: 'Use query parameters for GET requests',
        });
        score -= 5;
      }

      if (['DELETE', 'GET', 'HEAD'].includes(methodUpper) && operation.requestBody) {
        violations.push({
          type: 'http_method_misuse',
          severity: 'medium',
          message: `${methodUpper} ${path} should not have request body`,
          path: `/paths/${path}/${method}`,
          recommendation: `${methodUpper} operations should not include request bodies`,
        });
        score -= 5;
      }

      // Check for proper resource naming
      if (path.includes('/get') || path.includes('/post') || path.includes('/delete')) {
        violations.push({
          type: 'resource_naming',
          severity: 'low',
          message: `Path "${path}" includes HTTP method in URL`,
          path: `/paths/${path}`,
          recommendation: 'Use HTTP methods instead of including them in the path',
        });
        score -= 2;
      }

      // Check for proper status codes
      if (operation.responses) {
        const statusCodes = Object.keys(operation.responses);
        
        if (methodUpper === 'POST' && !statusCodes.includes('201') && statusCodes.includes('200')) {
          violations.push({
            type: 'status_code_usage',
            severity: 'low',
            message: `POST ${path} returns 200 instead of 201`,
            path: `/paths/${path}/${method}/responses`,
            recommendation: 'Use 201 Created for successful resource creation',
          });
          score -= 2;
        }

        if (methodUpper === 'DELETE' && statusCodes.includes('200') && !statusCodes.includes('204')) {
          violations.push({
            type: 'status_code_usage',
            severity: 'low',
            message: `DELETE ${path} could return 204 No Content`,
            path: `/paths/${path}/${method}/responses`,
            recommendation: 'Consider 204 No Content for successful DELETE operations',
          });
          score -= 1;
        }
      }
    }

    // Check for proper resource hierarchy
    const pathSegments = path.split('/').filter(s => s);
    if (pathSegments.length > 6) {
      violations.push({
        type: 'resource_hierarchy',
        severity: 'low',
        message: `Path "${path}" is deeply nested`,
        path: `/paths/${path}`,
        recommendation: 'Consider flattening resource hierarchy',
      });
      score -= 1;
    }
  }

  analysis.restCompliance.score = Math.max(0, score);
  analysis.restCompliance.violations = violations;
  analysis.issues.push(...violations);
}

/**
 * Calculate overall API score
 */
function calculateApiScore(analysis) {
  let score = 100;
  
  // Deduct points for issues
  analysis.issues.forEach(issue => {
    switch (issue.severity) {
      case 'critical': score -= 15; break;
      case 'high': score -= 10; break;
      case 'medium': score -= 5; break;
      case 'low': score -= 2; break;
    }
  });
  
  // Factor in documentation coverage
  if (analysis.metrics.totalOperations > 0) {
    const docCoverage = analysis.metrics.documentedOperations / analysis.metrics.totalOperations;
    if (docCoverage < 0.8) {
      score *= (0.5 + docCoverage * 0.5); // Penalize poor documentation
    }
  }
  
  // Factor in security
  if (analysis.security.vulnerabilities.length > 0) {
    score *= 0.8; // Security issues significantly impact score
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}