import { parse, validate, buildSchema, GraphQLError } from 'graphql';
import depthLimit from 'graphql-depth-limit';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for check_graphql_query
 */
export const graphqlQueryCheckerTool = {
  name: 'check_graphql_query',
  description: 'Analyzes GraphQL queries for complexity, performance, and security issues with pagination and filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The GraphQL query to analyze (max 100KB)',
      },
      schema: {
        type: 'string',
        description: 'Optional GraphQL schema to validate against',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., "query.graphql")',
      },
      maxDepth: {
        type: 'number',
        description: 'Maximum allowed query depth (default: 7)',
        default: 7,
        minimum: 1,
        maximum: 20,
      },
      maxComplexity: {
        type: 'number',
        description: 'Maximum allowed query complexity score (default: 100)',
        default: 100,
        minimum: 1,
        maximum: 1000,
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
        enum: ['complexity', 'performance', 'security', 'syntax', 'best-practices', 'all'],
        default: 'all',
      },
      // Sorting parameters
      sortBy: {
        type: 'string',
        description: 'Field to sort by',
        enum: ['line', 'severity', 'category', 'complexity'],
        default: 'severity',
      },
      sortOrder: {
        type: 'string',
        description: 'Sort order',
        enum: ['asc', 'desc'],
        default: 'desc',
      },
    },
    required: ['query'],
  },
};

/**
 * Handles the check_graphql_query tool call
 */
export async function handleGraphqlQueryCheck(args) {
  const { 
    query, 
    schema,
    filename,
    maxDepth = 7,
    maxComplexity = 100,
    limit = 50,
    offset = 0,
    severity = 'all',
    category = 'all',
    sortBy = 'severity',
    sortOrder = 'desc'
  } = args;
  
  // Validate input
  const validation = validateCode(query);
  if (!validation.valid) {
    return validation.error;
  }
  
  const safeFilename = sanitizeFilename(filename);
  
  try {
    const analysisPromise = analyzeGraphQLQuery(query, schema, maxDepth, maxComplexity);
    const allIssues = await withTimeout(analysisPromise, LINT_TIMEOUT_MS, "GraphQL Query Analysis");
    
    if (allIssues.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `✅ GraphQL query follows best practices with no issues detected.`,
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
        severityBreakdown: getSeverityBreakdown(allIssues),
        queryMetrics: getQueryMetrics(allIssues)
      },
      issues: paginatedIssues
    };
    
    if (hasMore) {
      response.summary.nextOffset = offset + limit;
    }
    
    let output = `🔍 GraphQL Query Analysis Results:\n`;
    output += `Found ${allIssues.length} total issues\n`;
    output += `Showing ${paginatedIssues.length} of ${totalIssues} filtered issues\n\n`;
    
    // Display query metrics
    const metrics = response.summary.queryMetrics;
    if (metrics.depth !== undefined) {
      output += `📊 Query Metrics:\n`;
      output += `  Depth: ${metrics.depth} (max: ${maxDepth})\n`;
      output += `  Complexity: ${metrics.complexity} (max: ${maxComplexity})\n`;
      output += `  Field Count: ${metrics.fieldCount}\n\n`;
    }
    
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
          if (issue.suggestion) output += `    Suggestion: ${issue.suggestion}\n`;
        });
        output += '\n';
      }
      
      if (highIssues.length > 0) {
        output += '❌ High Priority Issues:\n';
        highIssues.forEach(issue => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
          if (issue.suggestion) output += `    Suggestion: ${issue.suggestion}\n`;
        });
        output += '\n';
      }
      
      if (mediumIssues.length > 0) {
        output += '⚠️  Medium Priority Issues:\n';
        mediumIssues.forEach(issue => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
          if (issue.suggestion) output += `    Suggestion: ${issue.suggestion}\n`;
        });
        output += '\n';
      }
      
      if (lowIssues.length > 0) {
        output += '💡 Low Priority Issues:\n';
        lowIssues.forEach(issue => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
          if (issue.suggestion) output += `    Suggestion: ${issue.suggestion}\n`;
        });
      }
    }
    
    output += '\n💡 GraphQL Query Best Practices:\n';
    output += '- Use fragments to avoid duplicating fields\n';
    output += '- Implement pagination for list queries\n';
    output += '- Keep query depth reasonable (< 10 levels)\n';
    output += '- Use field aliases to avoid conflicts\n';
    output += '- Consider query complexity and performance impact\n';
    output += '- Use variables instead of inline values\n';

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
    console.error('Error analyzing GraphQL query:', error);
    
    let errorMessage = 'An error occurred while analyzing the GraphQL query.';
    
    if (error.message === 'GraphQL Query Analysis timeout exceeded') {
      errorMessage = 'Analysis timed out. The query might be too complex.';
    } else if (error.message.includes('Syntax Error')) {
      errorMessage = 'The query contains syntax errors and cannot be analyzed.';
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error: ${errorMessage}\n\nPlease ensure the query is valid GraphQL.`,
      }],
    };
  }
}

/**
 * Analyze GraphQL query for issues
 */
async function analyzeGraphQLQuery(queryString, schemaString, maxDepth, maxComplexity) {
  const issues = [];
  
  try {
    // Parse the query
    const queryDoc = parse(queryString);
    
    // Basic syntax validation
    let schema = null;
    if (schemaString) {
      try {
        schema = buildSchema(schemaString);
        const validationErrors = validate(schema, queryDoc);
        
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
      } catch (schemaError) {
        issues.push({
          type: 'SchemaError',
          message: 'Invalid schema provided for validation',
          severity: 'medium',
          category: 'syntax',
          location: 'Schema',
          rule: 'schema-validation'
        });
      }
    }
    
    // Analyze query structure
    const queryMetrics = analyzeQueryStructure(queryDoc);
    
    // Check query depth
    if (queryMetrics.depth > maxDepth) {
      issues.push({
        type: 'DepthLimit',
        message: `Query depth (${queryMetrics.depth}) exceeds maximum allowed depth (${maxDepth})`,
        severity: queryMetrics.depth > maxDepth * 1.5 ? 'critical' : 'high',
        category: 'complexity',
        location: 'Query',
        rule: 'depth-limit',
        suggestion: 'Consider restructuring query or using fragments to reduce depth'
      });
    }
    
    // Check query complexity
    if (queryMetrics.complexity > maxComplexity) {
      issues.push({
        type: 'ComplexityLimit',
        message: `Query complexity (${queryMetrics.complexity}) exceeds maximum allowed complexity (${maxComplexity})`,
        severity: queryMetrics.complexity > maxComplexity * 1.5 ? 'critical' : 'high',
        category: 'complexity',
        location: 'Query',
        rule: 'complexity-limit',
        suggestion: 'Consider breaking query into smaller queries or using pagination'
      });
    }
    
    // Check for performance issues
    if (queryMetrics.fieldCount > 50) {
      issues.push({
        type: 'PerformanceWarning',
        message: `Query selects ${queryMetrics.fieldCount} fields, which may impact performance`,
        severity: 'medium',
        category: 'performance',
        location: 'Query',
        rule: 'field-count',
        suggestion: 'Consider selecting only necessary fields'
      });
    }
    
    // Check for missing variables (hardcoded values)
    if (queryMetrics.hasHardcodedValues && !queryMetrics.hasVariables) {
      issues.push({
        type: 'BestPractice',
        message: 'Query contains hardcoded values but no variables',
        severity: 'low',
        category: 'best-practices',
        location: 'Query',
        rule: 'use-variables',
        suggestion: 'Use variables instead of hardcoded values for better reusability'
      });
    }
    
    // Check for missing fragments in deep queries
    if (queryMetrics.depth > 5 && queryMetrics.duplicateFields > 3) {
      issues.push({
        type: 'BestPractice',
        message: 'Deep query with duplicate fields should use fragments',
        severity: 'medium',
        category: 'best-practices',
        location: 'Query',
        rule: 'use-fragments',
        suggestion: 'Use fragments to avoid duplicate field selections'
      });
    }
    
    // Check for potential N+1 problems
    if (queryMetrics.nestedLists > 2) {
      issues.push({
        type: 'PerformanceWarning',
        message: 'Query has deeply nested lists which may cause N+1 problems',
        severity: 'high',
        category: 'performance',
        location: 'Query',
        rule: 'nested-lists',
        suggestion: 'Consider using DataLoader or implementing proper batching'
      });
    }
    
    // Check for missing pagination arguments
    if (queryMetrics.listFieldsWithoutPagination > 0) {
      issues.push({
        type: 'SecurityConcern',
        message: `Query has ${queryMetrics.listFieldsWithoutPagination} list fields without pagination`,
        severity: 'medium',
        category: 'security',
        location: 'Query',
        rule: 'pagination-required',
        suggestion: 'Add pagination arguments (first, after, etc.) to list fields'
      });
    }
    
    // Store metrics for response
    issues.queryMetrics = queryMetrics;
    
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
 * Analyze query structure and calculate metrics
 */
function analyzeQueryStructure(queryDoc) {
  const metrics = {
    depth: 0,
    complexity: 0,
    fieldCount: 0,
    hasVariables: false,
    hasHardcodedValues: false,
    duplicateFields: 0,
    nestedLists: 0,
    listFieldsWithoutPagination: 0
  };
  
  const fieldNames = new Set();
  const duplicateFieldNames = new Set();
  
  function analyzeSelectionSet(selectionSet, currentDepth = 0) {
    if (!selectionSet) return;
    
    metrics.depth = Math.max(metrics.depth, currentDepth);
    
    selectionSet.selections.forEach(selection => {
      if (selection.kind === 'Field') {
        metrics.fieldCount++;
        metrics.complexity += 1;
        
        const fieldName = selection.name.value;
        if (fieldNames.has(fieldName)) {
          duplicateFieldNames.add(fieldName);
        }
        fieldNames.add(fieldName);
        
        // Check for hardcoded values in arguments
        if (selection.arguments) {
          selection.arguments.forEach(arg => {
            if (arg.value.kind !== 'Variable') {
              metrics.hasHardcodedValues = true;
            }
          });
          
          // Check for list fields without pagination
          const hasListIndicator = selection.name.value.endsWith('s') || 
                                  selection.name.value.includes('list') ||
                                  selection.name.value.includes('List');
          const hasPaginationArgs = selection.arguments.some(arg => 
            ['first', 'last', 'limit', 'offset', 'after', 'before'].includes(arg.name.value)
          );
          
          if (hasListIndicator && !hasPaginationArgs) {
            metrics.listFieldsWithoutPagination++;
          }
        }
        
        // Check for nested lists
        if (selection.selectionSet && currentDepth > 0) {
          const parentIsArray = fieldNames.has(selection.name.value + 's');
          if (parentIsArray) {
            metrics.nestedLists++;
          }
        }
        
        analyzeSelectionSet(selection.selectionSet, currentDepth + 1);
      } else if (selection.kind === 'InlineFragment') {
        analyzeSelectionSet(selection.selectionSet, currentDepth);
      } else if (selection.kind === 'FragmentSpread') {
        // Fragment analysis would require fragment definitions
        metrics.complexity += 1;
      }
    });
  }
  
  queryDoc.definitions.forEach(definition => {
    if (definition.kind === 'OperationDefinition') {
      if (definition.variableDefinitions && definition.variableDefinitions.length > 0) {
        metrics.hasVariables = true;
      }
      analyzeSelectionSet(definition.selectionSet, 1);
    }
  });
  
  metrics.duplicateFields = duplicateFieldNames.size;
  
  return metrics;
}

/**
 * Filter issues by severity and category
 */
function filterIssues(issues, severity, category) {
  return issues.filter(issue => {
    if (severity !== 'all' && issue.severity !== severity) {
      return false;
    }
    
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
      case 'complexity':
        aValue = parseInt(a.message.match(/complexity \((\d+)\)/)?.[1] || '0');
        bValue = parseInt(b.message.match(/complexity \((\d+)\)/)?.[1] || '0');
        break;
      default:
        aValue = a.severity;
        bValue = b.severity;
    }
    
    if (sortBy === 'line' || sortBy === 'severity' || sortBy === 'complexity') {
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    } else {
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
 * Extract query metrics from issues
 */
function getQueryMetrics(issues) {
  return issues.queryMetrics || {};
}