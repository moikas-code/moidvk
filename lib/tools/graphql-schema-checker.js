import { buildSchema, validateSchema, parse, GraphQLError } from 'graphql';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for check_graphql_schema
 */
export const graphqlSchemaCheckerTool = {
  name: 'check_graphql_schema',
  description: 'Analyzes GraphQL schema for best practices, design patterns, and security vulnerabilities with pagination and filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      schema: {
        type: 'string',
        description: 'The GraphQL schema definition to analyze (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., "schema.graphql")',
      },
      strict: {
        type: 'boolean',
        description: 'Enable strict mode for production schema validation (default: false)',
        default: false,
      },
      // Pagination parameters
      limit: {
        type: 'number',
        description: 'Maximum number of issues to return (default: 50, max: 500)',
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
      // Filtering parameters
      severity: {
        type: 'string',
        description: 'Filter by severity level',
        enum: ['critical', 'high', 'medium', 'low', 'all'],
        default: 'all',
      },
      category: {
        type: 'string',
        description: 'Filter by issue category',
        enum: ['syntax', 'design', 'security', 'performance', 'naming', 'all'],
        default: 'all',
      },
      // Sorting parameters
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['line', 'severity', 'category', 'type'],
        default: 'severity',
      },
      sortOrder: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
    required: ['schema'],
  },
};

/**
 * Handles the check_graphql_schema tool call
 * @param {Object} args - Tool arguments
 * @param {string} args.schema - GraphQL schema to analyze
 * @param {string} args.filename - Optional filename
 * @param {boolean} args.strict - Enable strict mode
 * @param {number} args.limit - Pagination limit
 * @param {number} args.offset - Pagination offset
 * @param {string} args.severity - Severity filter
 * @param {string} args.category - Category filter
 * @param {string} args.sortBy - Sort field
 * @param {string} args.sortOrder - Sort order
 * @returns {Object} MCP response
 */
export async function handleGraphqlSchemaCheck(args) {
  const { 
    schema, 
    filename, 
    strict = false,
    limit = 50,
    offset = 0,
    severity = 'all',
    category = 'all',
    sortBy = 'severity',
    sortOrder = 'desc'
  } = args;
  
  // Validate input
  const validation = validateCode(schema);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeFilename(filename);
  
  try {
    const analysisPromise = analyzeGraphQLSchema(schema, strict);
    const allIssues = await withTimeout(analysisPromise, LINT_TIMEOUT_MS, "GraphQL Schema Analysis");
    
    if (allIssues.length === 0) {
      const modeText = strict ? ' (strict mode)' : '';
      const response = {
        summary: {
          totalIssues: 0,
          filteredIssues: 0,
          returnedIssues: 0,
          limit,
          offset,
          hasMore: false,
          sortBy,
          sortOrder,
          filters: { severity, category },
          severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 }
        },
        issues: []
      };
      
      return {
        content: [{
          type: 'text',
          text: `✅ GraphQL schema follows best practices with no issues detected${modeText}.`,
        }, {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        }],
      };
    }

    // Apply filtering
    let filteredIssues = filterIssues(allIssues, severity, category);
    
    // Apply sorting
    filteredIssues = sortIssues(filteredIssues, sortBy, sortOrder);
    
    // Apply pagination
    const totalIssues = filteredIssues.length;
    const paginatedIssues = filteredIssues.slice(offset, offset + limit);
    const hasMore = offset + limit < totalIssues;
    
    const modeText = strict ? ' (Strict Mode)' : '';
    const response = {
      summary: {
        totalIssues: allIssues.length,
        filteredIssues: totalIssues,
        returnedIssues: paginatedIssues.length,
        limit,
        offset,
        hasMore,
        sortBy,
        sortOrder,
        filters: {
          severity,
          category
        },
        severityBreakdown: getSeverityBreakdown(allIssues)
      },
      issues: paginatedIssues
    };
    
    if (hasMore) {
      response.summary.nextOffset = offset + limit;
    }
    
    let output = `🔍 GraphQL Schema Analysis Results${modeText}:\n`;
    output += `Found ${allIssues.length} total issues\n`;
    output += `Showing ${paginatedIssues.length} of ${totalIssues} filtered issues\n\n`;
    
    if (paginatedIssues.length > 0) {
      const criticalIssues = paginatedIssues.filter(issue => issue.severity === 'critical');
      const highIssues = paginatedIssues.filter(issue => issue.severity === 'high');
      const mediumIssues = paginatedIssues.filter(issue => issue.severity === 'medium');
      const lowIssues = paginatedIssues.filter(issue => issue.severity === 'low');
      
      if (criticalIssues.length > 0) {
        output += '🚨 Critical Issues:\n';
        criticalIssues.forEach(issue => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
        });
        output += '\n';
      }
      
      if (highIssues.length > 0) {
        output += '❌ High Priority Issues:\n';
        highIssues.forEach(issue => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
        });
        output += '\n';
      }
      
      if (mediumIssues.length > 0) {
        output += '⚠️  Medium Priority Issues:\n';
        mediumIssues.forEach(issue => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
        });
        output += '\n';
      }
      
      if (lowIssues.length > 0) {
        output += '💡 Low Priority Issues:\n';
        lowIssues.forEach(issue => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
        });
      }
    }
    
    output += '\n💡 GraphQL Best Practices:\n';
    output += '- Use descriptive field and type names\n';
    output += '- Implement proper input validation\n';
    output += '- Consider query depth and complexity limits\n';
    output += '- Use non-nullable fields appropriately\n';
    output += '- Document your schema with descriptions\n';
    
    if (strict) {
      output += '\n- Strict mode enforces production-ready schema standards\n';
      output += '- Ensure all security best practices are implemented\n';
      output += '- Consider schema federation and versioning strategies';
    }

    return {
      content: [{
        type: 'text',
        text: output,
      }, {
        type: 'text',
        text: JSON.stringify(response, null, 2),
      }],
    };
  } catch (error) {
    console.error('Error analyzing GraphQL schema:', error);
    
    // Sanitize error messages
    let errorMessage = 'An error occurred while analyzing the GraphQL schema.';
    
    if (error.message === 'GraphQL Schema Analysis timeout exceeded') {
      errorMessage = 'Analysis timed out. The schema might be too complex.';
    } else if (error.message.includes('Syntax Error')) {
      errorMessage = 'The schema contains syntax errors and cannot be analyzed.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\nPlease ensure the schema is valid GraphQL.`,
      }],
    };
  }
}

/**
 * Analyze GraphQL schema for issues
 */
async function analyzeGraphQLSchema(schemaString, strict) {
  const issues = [];
  
  try {
    // Parse the schema
    const schema = buildSchema(schemaString);
    
    // Validate the schema
    const validationErrors = validateSchema(schema);
    
    // Convert validation errors to issues
    validationErrors.forEach(error => {
      issues.push({
        type: 'ValidationError',
        message: error.message,
        severity: 'critical',
        category: 'syntax',
        location: error.locations?.[0] ? `Line ${error.locations[0].line}` : 'Unknown',
        rule: 'graphql-validation'
      });
    });
    
    // Additional schema analysis
    const typeMap = schema.getTypeMap();
    
    // Check for naming conventions
    Object.keys(typeMap).forEach(typeName => {
      const type = typeMap[typeName];
      
      // Skip built-in types
      if (typeName.startsWith('__')) return;
      
      // Check type naming conventions
      if (type.astNode?.kind === 'ObjectTypeDefinition') {
        if (!isPascalCase(typeName)) {
          issues.push({
            type: 'NamingConvention',
            message: `Type "${typeName}" should use PascalCase`,
            severity: 'medium',
            category: 'naming',
            location: `Type ${typeName}`,
            rule: 'type-naming'
          });
        }
        
        // Check for missing descriptions in strict mode
        if (strict && !type.description) {
          issues.push({
            type: 'MissingDescription',
            message: `Type "${typeName}" is missing a description`,
            severity: 'medium',
            category: 'design',
            location: `Type ${typeName}`,
            rule: 'type-description'
          });
        }
        
        // Check field naming conventions
        const fields = type.getFields();
        Object.keys(fields).forEach(fieldName => {
          const field = fields[fieldName];
          
          if (!isCamelCase(fieldName)) {
            issues.push({
              type: 'NamingConvention',
              message: `Field "${fieldName}" should use camelCase`,
              severity: 'medium',
              category: 'naming',
              location: `${typeName}.${fieldName}`,
              rule: 'field-naming'
            });
          }
          
          // Check for missing field descriptions in strict mode
          if (strict && !field.description) {
            issues.push({
              type: 'MissingDescription',
              message: `Field "${typeName}.${fieldName}" is missing a description`,
              severity: 'low',
              category: 'design',
              location: `${typeName}.${fieldName}`,
              rule: 'field-description'
            });
          }
        });
      }
      
      // Check for enum naming conventions
      if (type.astNode?.kind === 'EnumTypeDefinition') {
        if (!isPascalCase(typeName)) {
          issues.push({
            type: 'NamingConvention',
            message: `Enum "${typeName}" should use PascalCase`,
            severity: 'medium',
            category: 'naming',
            location: `Enum ${typeName}`,
            rule: 'enum-naming'
          });
        }
        
        // Check enum values
        const enumValues = type.getValues();
        enumValues.forEach(enumValue => {
          if (!isConstantCase(enumValue.name)) {
            issues.push({
              type: 'NamingConvention',
              message: `Enum value "${enumValue.name}" should use CONSTANT_CASE`,
              severity: 'medium',
              category: 'naming',
              location: `${typeName}.${enumValue.name}`,
              rule: 'enum-value-naming'
            });
          }
        });
      }
    });
    
    // Check for security issues
    const queryType = schema.getQueryType();
    if (queryType) {
      const queryFields = queryType.getFields();
      Object.keys(queryFields).forEach(fieldName => {
        const field = queryFields[fieldName];
        
        // Check for potentially expensive operations
        if (field.type.toString().includes('[') && !field.args.find(arg => arg.name === 'limit')) {
          issues.push({
            type: 'SecurityConcern',
            message: `Query field "${fieldName}" returns a list without pagination`,
            severity: 'high',
            category: 'security',
            location: `Query.${fieldName}`,
            rule: 'pagination-required'
          });
        }
      });
    }
    
    // Check for missing mutation type in strict mode
    if (strict && !schema.getMutationType()) {
      issues.push({
        type: 'DesignIssue',
        message: 'Schema is missing a Mutation type',
        severity: 'medium',
        category: 'design',
        location: 'Schema root',
        rule: 'mutation-type-required'
      });
    }
    
  } catch (error) {
    if (error instanceof GraphQLError) {
      issues.push({
        type: 'SyntaxError',
        message: error.message,
        severity: 'critical',
        category: 'syntax',
        location: error.locations?.[0] ? `Line ${error.locations[0].line}` : 'Unknown',
        rule: 'graphql-syntax'
      });
    } else {
      throw error;
    }
  }
  
  return issues;
}

/**
 * Filter issues by severity and category
 */
function filterIssues(issues, severity, category) {
  return issues.filter(issue => {
    // Filter by severity
    if (severity !== 'all' && issue.severity !== severity) {
      return false;
    }
    
    // Filter by category
    if (category !== 'all' && issue.category !== category) {
      return false;
    }
    
    return true;
  });
}

/**
 * Sort issues based on criteria
 */
function sortIssues(issues, sortBy, sortOrder) {
  const sorted = [...issues];
  
  sorted.sort((a, b) => {
    let aValue, bValue;
    
    switch (sortBy) {
      case 'line':
        aValue = parseInt(a.location?.match(/Line (\d+)/)?.[1] || '0');
        bValue = parseInt(b.location?.match(/Line (\d+)/)?.[1] || '0');
        break;
      case 'severity':
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        aValue = severityOrder[a.severity] || 0;
        bValue = severityOrder[b.severity] || 0;
        break;
      case 'category':
        aValue = a.category.toLowerCase();
        bValue = b.category.toLowerCase();
        break;
      case 'type':
        aValue = a.type.toLowerCase();
        bValue = b.type.toLowerCase();
        break;
      default:
        aValue = a.severity;
        bValue = b.severity;
    }
    
    if (sortBy === 'line' || sortBy === 'severity') {
      // Numeric comparison
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    } else {
      // String comparison
      if (sortOrder === 'asc') {
        return aValue.localeCompare(bValue);
      } else {
        return bValue.localeCompare(aValue);
      }
    }
  });
  
  return sorted;
}

/**
 * Get severity breakdown for summary
 */
function getSeverityBreakdown(issues) {
  const breakdown = { critical: 0, high: 0, medium: 0, low: 0 };
  issues.forEach(issue => {
    breakdown[issue.severity] = (breakdown[issue.severity] || 0) + 1;
  });
  return breakdown;
}

/**
 * Check if string is PascalCase
 */
function isPascalCase(str) {
  return /^[A-Z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Check if string is camelCase
 */
function isCamelCase(str) {
  return /^[a-z][a-zA-Z0-9]*$/.test(str);
}

/**
 * Check if string is CONSTANT_CASE
 */
function isConstantCase(str) {
  return /^[A-Z][A-Z0-9_]*$/.test(str);
}