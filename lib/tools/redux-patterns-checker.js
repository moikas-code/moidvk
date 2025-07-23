import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import { validateCode, sanitizeFilename } from '../utils/validation.js';
import { withTimeout, LINT_TIMEOUT_MS } from '../utils/timeout.js';

/**
 * Tool definition for check_redux_patterns
 */
export const reduxPatternsCheckerTool = {
  name: 'check_redux_patterns',
  description:
    'Analyzes Redux code for best practices, anti-patterns, and performance issues with pagination and filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The Redux code to analyze (max 100KB)',
      },
      filename: {
        type: 'string',
        description: 'Optional filename for better context (e.g., "store.js", "reducer.js")',
      },
      codeType: {
        type: 'string',
        description: 'Type of Redux code being analyzed',
        enum: ['reducer', 'action', 'store', 'selector', 'middleware', 'component', 'auto'],
        default: 'auto',
      },
      strict: {
        type: 'boolean',
        description: 'Enable strict mode for production Redux code (default: false)',
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
        enum: ['mutation', 'performance', 'best-practices', 'anti-patterns', 'structure', 'all'],
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
    required: ['code'],
  },
};

/**
 * Handles the check_redux_patterns tool call
 */
export async function handleReduxPatternsCheck(args) {
  const {
    code,
    filename,
    codeType = 'auto',
    strict = false,
    limit = 50,
    offset = 0,
    severity = 'all',
    category = 'all',
    sortBy = 'severity',
    sortOrder = 'desc',
  } = args.params || args;

  // Validate input
  const validation = validateCode(code);
  if (!validation.valid) {
    return validation.error;
  }

  const safeFilename = sanitizeFilename(filename);
  const detectedCodeType = codeType === 'auto' ? detectCodeType(code, safeFilename) : codeType;

  try {
    const analysisPromise = analyzeReduxPatterns(code, detectedCodeType, strict);
    const allIssues = await withTimeout(
      analysisPromise,
      LINT_TIMEOUT_MS,
      'Redux Patterns Analysis',
    );

    if (allIssues.length === 0) {
      const modeText = strict ? ' (strict mode)' : '';
      const response = {
        summary: {
          detectedCodeType,
          totalIssues: 0,
          filteredIssues: 0,
          returnedIssues: 0,
          limit,
          offset,
          hasMore: false,
          sortBy,
          sortOrder,
          filters: { severity, category },
          severityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
          categoryBreakdown: {},
        },
        issues: [],
      };

      return {
        content: [
          {
            type: 'text',
            text: `✅ Redux ${detectedCodeType} follows best practices with no issues detected${modeText}.`,
          },
          {
            type: 'text',
            text: JSON.stringify(response, null, 2),
          },
        ],
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
        detectedCodeType,
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
          category,
        },
        severityBreakdown: getSeverityBreakdown(allIssues),
        categoryBreakdown: getCategoryBreakdown(allIssues),
      },
      issues: paginatedIssues,
    };

    if (hasMore) {
      response.summary.nextOffset = offset + limit;
    }

    let output = `🔍 Redux ${detectedCodeType} Analysis Results${modeText}:\n`;
    output += `Found ${allIssues.length} total issues\n`;
    output += `Showing ${paginatedIssues.length} of ${totalIssues} filtered issues\n\n`;

    if (paginatedIssues.length > 0) {
      const criticalIssues = paginatedIssues.filter((issue) => issue.severity === 'critical');
      const highIssues = paginatedIssues.filter((issue) => issue.severity === 'high');
      const mediumIssues = paginatedIssues.filter((issue) => issue.severity === 'medium');
      const lowIssues = paginatedIssues.filter((issue) => issue.severity === 'low');

      if (criticalIssues.length > 0) {
        output += '🚨 Critical Issues:\n';
        criticalIssues.forEach((issue) => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
          if (issue.suggestion) output += `    Suggestion: ${issue.suggestion}\n`;
        });
        output += '\n';
      }

      if (highIssues.length > 0) {
        output += '❌ High Priority Issues:\n';
        highIssues.forEach((issue) => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
          if (issue.suggestion) output += `    Suggestion: ${issue.suggestion}\n`;
        });
        output += '\n';
      }

      if (mediumIssues.length > 0) {
        output += '⚠️  Medium Priority Issues:\n';
        mediumIssues.forEach((issue) => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
          if (issue.suggestion) output += `    Suggestion: ${issue.suggestion}\n`;
        });
        output += '\n';
      }

      if (lowIssues.length > 0) {
        output += '💡 Low Priority Issues:\n';
        lowIssues.forEach((issue) => {
          output += `  ${issue.type}: ${issue.message}\n`;
          if (issue.location) output += `    Location: ${issue.location}\n`;
          if (issue.suggestion) output += `    Suggestion: ${issue.suggestion}\n`;
        });
      }
    }

    output += '\n💡 Redux Best Practices:\n';
    output += '- Keep reducers pure and avoid side effects\n';
    output += '- Use Redux Toolkit for modern Redux development\n';
    output += '- Normalize state shape for better performance\n';
    output += '- Use selectors to encapsulate state access\n';
    output += '- Avoid deeply nested state structures\n';
    output += '- Use actionCreators for consistent action creation\n';

    if (strict) {
      output += '\n- Strict mode enforces production-ready Redux patterns\n';
      output += '- Ensure all state updates are immutable\n';
      output += '- Implement proper error handling in async actions\n';
      output += '- Use TypeScript for better type safety';
    }

    return {
      content: [
        {
          type: 'text',
          text: output,
        },
        {
          type: 'text',
          text: JSON.stringify(response, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error('Error analyzing Redux patterns:', error);

    let errorMessage = 'An error occurred while analyzing Redux patterns.';

    if (error.message === 'Redux Patterns Analysis timeout exceeded') {
      errorMessage = 'Analysis timed out. The code might be too complex.';
    } else if (error.message.includes('SyntaxError')) {
      errorMessage = 'The code contains syntax errors and cannot be analyzed.';
    }

    return {
      content: [
        {
          type: 'text',
          text: `❌ Error: ${errorMessage}\n\nPlease ensure the code is valid JavaScript/TypeScript.`,
        },
      ],
    };
  }
}

/**
 * Detect the type of Redux code
 */
function detectCodeType(code, filename) {
  if (filename) {
    if (filename.includes('reducer')) return 'reducer';
    if (filename.includes('action')) return 'action';
    if (filename.includes('store')) return 'store';
    if (filename.includes('selector')) return 'selector';
    if (filename.includes('middleware')) return 'middleware';
  }

  // Analyze code patterns
  if (code.includes('createReducer') || code.includes('createSlice')) return 'reducer';
  if (code.includes('createAction') || code.includes('createAsyncThunk')) return 'action';
  if (code.includes('configureStore') || code.includes('createStore')) return 'store';
  if (code.includes('useSelector') || code.includes('connect')) return 'component';
  if (code.includes('createSelector')) return 'selector';

  return 'reducer'; // Default assumption
}

/**
 * Analyze Redux patterns for issues
 */
async function analyzeReduxPatterns(code, codeType, strict) {
  const issues = [];

  // Check if this is Redux Toolkit code
  const isReduxToolkitCode =
    code.includes('createSlice') ||
    code.includes('createAsyncThunk') ||
    code.includes('@reduxjs/toolkit');

  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
    });

    traverse(ast, {
      // Check for direct state mutations (but ignore Redux Toolkit createSlice)
      AssignmentExpression(path) {
        const left = path.node.left;
        if (isStateMutation(left) && !isInReduxToolkitSlice(path)) {
          issues.push({
            type: 'DirectMutation',
            message: 'Direct state mutation detected',
            severity: 'critical',
            category: 'mutation',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'no-direct-mutation',
            suggestion: 'Use immutable update patterns or Redux Toolkit',
          });
        }
      },

      // Check for synchronous side effects in reducers
      CallExpression(path) {
        const callee = path.node.callee;

        // Check for console.log, fetch, etc. in reducers (but ignore thunks)
        if (codeType === 'reducer' && isSideEffect(callee) && !isInAsyncThunk(path)) {
          issues.push({
            type: 'SideEffect',
            message: `Side effect detected in reducer: ${getCallName(callee)}`,
            severity: 'high',
            category: 'anti-patterns',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'no-side-effects',
            suggestion: 'Move side effects to middleware or action creators',
          });
        }

        // Check for deprecated Redux patterns
        if (callee.name === 'createStore' && !path.scope.hasBinding('legacy')) {
          issues.push({
            type: 'DeprecatedAPI',
            message: 'createStore is deprecated, use Redux Toolkit instead',
            severity: 'medium',
            category: 'best-practices',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'use-redux-toolkit',
            suggestion: 'Use configureStore from Redux Toolkit',
          });
        }
      },

      // Check for large switch statements and missing default case in reducers
      SwitchStatement(path) {
        if (path.node.cases.length > 10) {
          issues.push({
            type: 'LargeSwitchStatement',
            message: `Switch statement has ${path.node.cases.length} cases, consider refactoring`,
            severity: 'medium',
            category: 'structure',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'switch-statement-size',
            suggestion:
              'Consider using Redux Toolkit createSlice or splitting into smaller reducers',
          });
        }

        if (codeType === 'reducer' && !hasDefaultCase(path.node)) {
          issues.push({
            type: 'MissingDefaultCase',
            message: 'Reducer switch statement missing default case',
            severity: 'medium',
            category: 'best-practices',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'reducer-default-case',
            suggestion: 'Add default case that returns current state',
          });
        }
      },

      // Check for complex nested state updates and non-serializable state
      ObjectExpression(path) {
        const depth = getObjectDepth(path.node);
        if (depth > 3 && isInReducer(path)) {
          issues.push({
            type: 'DeepNesting',
            message: `Deep state nesting detected (${depth} levels)`,
            severity: 'medium',
            category: 'structure',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'avoid-deep-nesting',
            suggestion: 'Consider normalizing state structure',
          });
        }

        // Check for non-serializable state (but ignore Redux Toolkit patterns)
        if (!isReduxToolkitCode && hasNonSerializableValues(path.node)) {
          issues.push({
            type: 'NonSerializableState',
            message: 'Non-serializable value detected in state',
            severity: 'high',
            category: 'anti-patterns',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'serializable-state',
            suggestion: 'Ensure all state values are serializable (no functions, dates, etc.)',
          });
        }
      },

      // Check for synchronous actions that should be async
      FunctionDeclaration(path) {
        if (isActionCreator(path.node) && hasAsyncOperations(path)) {
          issues.push({
            type: 'SyncAsyncMismatch',
            message: 'Action creator contains async operations but is not async',
            severity: 'high',
            category: 'anti-patterns',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'async-action-creator',
            suggestion: 'Use createAsyncThunk or redux-thunk for async actions',
          });
        }
      },

      // Check for missing error handling in async actions
      TryStatement(path) {
        if (codeType === 'action' && !hasProperErrorHandling(path.node)) {
          issues.push({
            type: 'MissingErrorHandling',
            message: 'Async action missing proper error handling',
            severity: strict ? 'high' : 'medium',
            category: 'best-practices',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'error-handling',
            suggestion: 'Add proper error handling and dispatch error actions',
          });
        }
      },

      // Check for unused actions
      VariableDeclarator(path) {
        if (isActionDefinition(path.node) && !isActionUsed(path.node, ast)) {
          issues.push({
            type: 'UnusedAction',
            message: `Action "${path.node.id.name}" is defined but never used`,
            severity: 'low',
            category: 'best-practices',
            location: `Line ${path.node.loc?.start.line || 'unknown'}`,
            rule: 'unused-action',
            suggestion: 'Remove unused action or add it to exports',
          });
        }
      },
    });
  } catch (error) {
    issues.push({
      type: 'ParseError',
      message: `Failed to parse code: ${error.message}`,
      severity: 'critical',
      category: 'syntax',
      location: 'Unknown',
      rule: 'valid-syntax',
    });
  }

  return issues;
}

/**
 * Helper functions for pattern detection
 */
function isStateMutation(node) {
  if (node.type === 'MemberExpression') {
    return node.object.name === 'state' && node.property.name;
  }
  return false;
}

function isSideEffect(node) {
  if (node.type === 'MemberExpression') {
    const sideEffects = [
      'console',
      'fetch',
      'localStorage',
      'sessionStorage',
      'document',
      'window',
    ];
    return sideEffects.includes(node.object.name);
  }
  if (node.type === 'Identifier') {
    const sideEffects = ['fetch', 'setTimeout', 'setInterval', 'alert'];
    return sideEffects.includes(node.name);
  }
  return false;
}

function getCallName(node) {
  if (node.type === 'MemberExpression') {
    return `${node.object.name}.${node.property.name}`;
  }
  return node.name || 'unknown';
}

function hasDefaultCase(switchNode) {
  return switchNode.cases.some((caseNode) => caseNode.test === null);
}

function getObjectDepth(node, depth = 0) {
  if (node.type !== 'ObjectExpression') return depth;

  let maxDepth = depth;
  node.properties.forEach((prop) => {
    if (prop.value && prop.value.type === 'ObjectExpression') {
      maxDepth = Math.max(maxDepth, getObjectDepth(prop.value, depth + 1));
    }
  });

  return maxDepth;
}

function isInReducer(path) {
  // Simple heuristic: check if we're in a function that looks like a reducer
  let current = path.scope;
  while (current) {
    if (
      current.block.type === 'FunctionDeclaration' ||
      current.block.type === 'FunctionExpression'
    ) {
      const params = current.block.params;
      if (params.length >= 2 && params[0].name === 'state' && params[1].name === 'action') {
        return true;
      }
    }
    current = current.parent;
  }
  return false;
}

function isActionCreator(node) {
  return node.id && node.id.name && node.id.name.toLowerCase().includes('action');
}

function hasAsyncOperations(path) {
  let hasAsync = false;
  path.traverse({
    CallExpression(innerPath) {
      const callee = innerPath.node.callee;
      if (
        callee.name === 'fetch' ||
        (callee.type === 'MemberExpression' && callee.property.name === 'fetch')
      ) {
        hasAsync = true;
      }
    },
  });
  return hasAsync;
}

function hasProperErrorHandling(tryNode) {
  return tryNode.handler && tryNode.handler.body.body.length > 0;
}

function isActionDefinition(node) {
  return (
    node.id &&
    node.id.name &&
    (node.id.name.toLowerCase().includes('action') ||
      (node.init &&
        node.init.type === 'CallExpression' &&
        node.init.callee.name === 'createAction'))
  );
}

function isActionUsed(node, ast) {
  // Simple check - would need more sophisticated analysis for real usage
  return true; // Placeholder
}

function hasNonSerializableValues(node) {
  // Check for function expressions, dates, etc.
  return node.properties.some((prop) => {
    // Skip extraReducers and reducers properties which legitimately have functions in Redux Toolkit
    if (prop.key && (prop.key.name === 'extraReducers' || prop.key.name === 'reducers')) {
      return false;
    }

    return (
      prop.value &&
      (prop.value.type === 'FunctionExpression' ||
        prop.value.type === 'ArrowFunctionExpression' ||
        (prop.value.type === 'NewExpression' && prop.value.callee.name === 'Date'))
    );
  });
}

/**
 * Check if we're inside a Redux Toolkit createSlice call
 */
function isInReduxToolkitSlice(path) {
  // Look up the path tree to find if we're in a Redux Toolkit context
  let currentPath = path;

  while (currentPath) {
    const node = currentPath.node;

    // Check if we're in a function that's part of createSlice reducers
    if (node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      const functionPath = currentPath;

      // Check if this function is in the reducers property of createSlice
      if (isInCreateSliceReducers(functionPath)) {
        return true;
      }

      // Check if this function is passed to addCase in extraReducers
      if (isInCreateSliceExtraReducers(functionPath)) {
        return true;
      }
    }

    currentPath = currentPath.parentPath;
  }

  return false;
}

/**
 * Check if a function is in the reducers property of createSlice
 */
function isInCreateSliceReducers(functionPath) {
  // Based on AST analysis: ArrowFunctionExpression -> ObjectProperty -> ObjectExpression -> ObjectProperty(reducers) -> ObjectExpression -> CallExpression(createSlice)
  let parent = functionPath.parentPath; // ObjectProperty (e.g., clearError)

  if (parent?.node.type === 'ObjectProperty') {
    let obj = parent.parentPath; // ObjectExpression (the reducers object)
    if (obj?.node.type === 'ObjectExpression') {
      let reducersProp = obj.parentPath; // ObjectProperty (reducers)
      if (
        reducersProp?.node.type === 'ObjectProperty' &&
        reducersProp.node.key?.name === 'reducers'
      ) {
        let createSliceObj = reducersProp.parentPath; // ObjectExpression (createSlice config)
        if (createSliceObj?.node.type === 'ObjectExpression') {
          let createSliceCall = createSliceObj.parentPath; // CallExpression (createSlice)
          if (
            createSliceCall?.node.type === 'CallExpression' &&
            createSliceCall.node.callee?.name === 'createSlice'
          ) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Check if a function is in the extraReducers property of createSlice
 */
function isInCreateSliceExtraReducers(functionPath) {
  // Based on AST analysis, extraReducers uses builder pattern with addCase
  // We need to traverse up to find if we're in a function passed to addCase
  let currentPath = functionPath;

  while (currentPath) {
    // Look for addCase call
    if (
      currentPath.node.type === 'CallExpression' &&
      currentPath.node.callee?.type === 'MemberExpression' &&
      currentPath.node.callee.property?.name === 'addCase'
    ) {
      // Now trace back to see if this is inside extraReducers
      let searchPath = currentPath.parentPath;
      while (searchPath) {
        if (
          searchPath.node.type === 'ObjectProperty' &&
          searchPath.node.key?.name === 'extraReducers'
        ) {
          // Found extraReducers property, check if it's in createSlice
          let createSliceObj = searchPath.parentPath;
          if (createSliceObj?.node.type === 'ObjectExpression') {
            let createSliceCall = createSliceObj.parentPath;
            if (
              createSliceCall?.node.type === 'CallExpression' &&
              createSliceCall.node.callee?.name === 'createSlice'
            ) {
              return true;
            }
          }
        }
        searchPath = searchPath.parentPath;
      }
    }
    currentPath = currentPath.parentPath;
  }

  return false;
}

/**
 * Check if we're inside a createAsyncThunk call
 */
function isInAsyncThunk(path) {
  let currentPath = path;

  while (currentPath) {
    const node = currentPath.node;

    // Check if we're directly in a createAsyncThunk call
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'Identifier' &&
      node.callee.name === 'createAsyncThunk'
    ) {
      return true;
    }

    // Check if we're in the arguments of createAsyncThunk
    if (
      currentPath.parent &&
      currentPath.parent.type === 'CallExpression' &&
      currentPath.parent.callee?.type === 'Identifier' &&
      currentPath.parent.callee.name === 'createAsyncThunk'
    ) {
      return true;
    }

    currentPath = currentPath.parentPath;
  }

  return false;
}

/**
 * Check if we're in any Redux Toolkit context
 */
function isInReduxToolkitContext(path) {
  return isInitialStateInSlice(path) || isInReduxToolkitSlice(path) || isInAsyncThunk(path);
}

/**
 * Check if we're in the initialState of a createSlice
 */
function isInitialStateInSlice(path) {
  let currentPath = path;

  while (currentPath) {
    // Check if we're in the initialState property of createSlice
    if (
      currentPath.parent?.type === 'Property' &&
      currentPath.parent.key?.name === 'initialState'
    ) {
      let createSliceObj = currentPath.parentPath?.parentPath;
      if (createSliceObj?.node.type === 'ObjectExpression') {
        let createSliceCall = createSliceObj.parentPath;
        if (
          createSliceCall?.node.type === 'CallExpression' &&
          createSliceCall.node.callee?.name === 'createSlice'
        ) {
          return true;
        }
      }
    }

    currentPath = currentPath.parentPath;
  }

  return false;
}

/**
 * Filter issues by severity and category
 */
function filterIssues(issues, severity, category) {
  return issues.filter((issue) => {
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
      case 'type':
        aValue = a.type.toLowerCase();
        bValue = b.type.toLowerCase();
        break;
      default:
        aValue = a.severity;
        bValue = b.severity;
    }

    if (sortBy === 'line' || sortBy === 'severity') {
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
  issues.forEach((issue) => {
    breakdown[issue.severity] = (breakdown[issue.severity] || 0) + 1;
  });
  return breakdown;
}

/**
 * Get category breakdown for summary
 */
function getCategoryBreakdown(issues) {
  const breakdown = {};
  issues.forEach((issue) => {
    breakdown[issue.category] = (breakdown[issue.category] || 0) + 1;
  });
  return breakdown;
}
