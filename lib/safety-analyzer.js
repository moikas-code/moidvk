import * as parser from '@babel/parser';
import * as babelTraverse from '@babel/traverse';

// Handle different module formats
const traverse = babelTraverse.default || babelTraverse;

// Constants for NASA JPL Power of 10 Rules
const MAX_FUNCTION_LINES = 60;
const MIN_ASSERTIONS_PER_FUNCTION = 2;
const MAX_NESTING_DEPTH = 3;
const CRITICAL_PENALTY = 20;
const WARNING_PENALTY = 5;
const INFO_PENALTY = 1;
const MAX_SCORE = 100;

// NASA JPL Power of 10 Safety Rules Analyzer for JavaScript
export class SafetyAnalyzer {
  constructor() {
    // Assert: Constructor must initialize all properties
    if (!this) {
      throw new TypeError('Invalid constructor context');
    }
    
    this.violations = [];
    this.currentFunction = null;
    this.functionCallStack = [];
    this.globalScope = new Set();
    this.ignoredReturns = [];
    this.filename = '';
  }

  analyze(code, filename = 'code.js') {
    // Assert: Input validation
    if (typeof code !== 'string') {
      throw new TypeError('Code must be a string');
    }
    if (typeof filename !== 'string') {
      throw new TypeError('Filename must be a string');
    }

    this.violations = [];
    this.currentFunction = null;
    this.functionCallStack = [];
    this.globalScope.clear();
    this.ignoredReturns = [];
    this.filename = filename;

    try {
      // Parse code into AST
      const ast = parser.parse(code, {
        sourceType: 'module',
        plugins: ['typescript', 'jsx'],
        errorRecovery: true,
      });

      // Traverse AST and check for violations
      traverse(ast, {
        // Track function boundaries
        FunctionDeclaration: {
          enter: (path) => this.enterFunction(path),
          exit: (path) => this.exitFunction(path),
        },
        FunctionExpression: {
          enter: (path) => this.enterFunction(path),
          exit: (path) => this.exitFunction(path),
        },
        ArrowFunctionExpression: {
          enter: (path) => this.enterFunction(path),
          exit: (path) => this.exitFunction(path),
        },

        // Check for recursion
        CallExpression: (path) => this.checkRecursion(path),

        // Check loops
        WhileStatement: (path) => this.checkLoopBounds(path, 'while'),
        ForStatement: (path) => this.checkLoopBounds(path, 'for'),
        DoWhileStatement: (path) => this.checkLoopBounds(path, 'do-while'),
        ForInStatement: (path) => this.checkLoopBounds(path, 'for-in'),
        ForOfStatement: (path) => this.checkLoopBounds(path, 'for-of'),

        // Check variable scope
        VariableDeclaration: (path) => this.checkVariableScope(path),

        // Check assertions
        IfStatement: (path) => this.checkAssertions(path),
        ConditionalExpression: (path) => this.checkAssertions(path),

        // Check return value usage
        ExpressionStatement: (path) => this.checkReturnValueUsage(path),

        // Check nesting depth
        MemberExpression: (path) => this.checkNestingDepth(path),
      });

      return this.generateReport();
    } catch (error) {
      return {
        success: false,
        error: `Failed to analyze ${this.filename}: ${error.message}`,
        violations: [],
      };
    }
  }

  enterFunction(path) {
    // Assert: Path must be valid
    if (!path || !path.node) {
      throw new Error('Invalid function path');
    }

    const node = path.node;
    const name = node.id?.name || '<anonymous>';
    const start = node.loc?.start || { line: 0 };
    const end = node.loc?.end || { line: 0 };
    
    this.currentFunction = {
      name,
      node,
      path,
      startLine: start.line,
      endLine: end.line,
      assertions: 0,
      hasReturn: node.type === 'ArrowFunctionExpression' && node.expression,
    };

    // Check function length
    const lines = this.currentFunction.endLine - this.currentFunction.startLine + 1;
    if (lines > MAX_FUNCTION_LINES) {
      this.addViolation(
        'function-length',
        `Function '${name}' is ${lines} lines long (max: ${MAX_FUNCTION_LINES} lines)`,
        start.line,
        'critical',
      );
    }

    this.functionCallStack.push(name);
  }

  exitFunction(path) {
    // Assert: Must have current function context
    if (!this.currentFunction) {
      return;
    }

    // Check assertion count
    if (this.currentFunction.assertions < MIN_ASSERTIONS_PER_FUNCTION) {
      this.addViolation(
        'insufficient-assertions',
        `Function '${this.currentFunction.name}' has only ${this.currentFunction.assertions} assertion(s) (min: ${MIN_ASSERTIONS_PER_FUNCTION})`,
        this.currentFunction.startLine,
        'warning',
      );
    }
    
    this.functionCallStack.pop();
    this.currentFunction = null;
  }

  checkRecursion(path) {
    // Assert: Path must be valid
    if (!path || !path.node) {
      return;
    }

    const callee = path.node.callee;
    
    // Direct recursion check
    if (callee.type === 'Identifier' && this.functionCallStack.includes(callee.name)) {
      this.addViolation(
        'recursion',
        `Recursive call detected in function '${callee.name}'`,
        path.node.loc?.start.line,
        'critical',
      );
    }

    // Check for indirect recursion patterns
    this.checkIndirectRecursion(path);
  }

  checkIndirectRecursion(path) {
    // Assert: Path must be valid
    if (!path || !path.node) {
      return;
    }

    // Check for setTimeout/setInterval with self-reference
    const callee = path.node.callee;
    if (callee.type === 'Identifier' && 
        (callee.name === 'setTimeout' || callee.name === 'setInterval')) {
      const firstArg = path.node.arguments[0];
      if (firstArg && this.currentFunction && 
          firstArg.type === 'Identifier' && 
          firstArg.name === this.currentFunction.name) {
        this.addViolation(
          'indirect-recursion',
          `Potential indirect recursion via ${callee.name}`,
          path.node.loc?.start.line,
          'warning',
        );
      }
    }
  }

  checkLoopBounds(path, loopType) {
    // Assert: Valid inputs
    if (!path || !path.node || typeof loopType !== 'string') {
      return;
    }

    const node = path.node;
    let hasFixedBound = false;

    switch (loopType) {
      case 'for':
        hasFixedBound = this.checkForLoopBounds(node);
        break;
      
      case 'while':
      case 'do-while':
        hasFixedBound = this.checkWhileLoopBounds(node, loopType);
        break;
      
      case 'for-in':
      case 'for-of':
        // These iterate over collections, generally safe
        hasFixedBound = true;
        break;
    }

    if (!hasFixedBound && loopType === 'for') {
      this.addViolation(
        'unbounded-loop',
        'Loop may not have fixed bounds - ensure termination condition',
        node.loc?.start.line,
        'warning',
      );
    }
  }

  checkForLoopBounds(node) {
    // Assert: Node must be valid
    if (!node || !node.test) {
      return false;
    }

    // Check if for loop has a numeric limit
    if (node.test.type === 'BinaryExpression') {
      const { right, operator } = node.test;
      if (['<', '<=', '>', '>='].includes(operator) && 
          (right.type === 'NumericLiteral' || right.type === 'Literal')) {
        return true;
      }
    }
    return false;
  }

  checkWhileLoopBounds(node, loopType) {
    // Assert: Node must be valid
    if (!node || !node.test) {
      return false;
    }

    // Check for literal true/false
    if (node.test.type === 'BooleanLiteral' && node.test.value === true) {
      this.addViolation(
        'infinite-loop',
        `Infinite ${loopType} loop detected (while(true))`,
        node.loc?.start.line,
        'critical',
      );
      return false;
    }
    
    // Harder to detect fixed bounds in while loops
    return false;
  }

  checkVariableScope(path) {
    // Assert: Path must be valid
    if (!path || !path.node) {
      return;
    }

    const node = path.node;
    
    // Check if variable is in global scope
    try {
      const isGlobal = path.scope.block.type === 'Program' || 
                       (path.scope.parent && path.scope.parent.block.type === 'Program');
      
      if (isGlobal) {
        node.declarations.forEach(decl => {
          if (decl.id.type === 'Identifier') {
            this.globalScope.add(decl.id.name);
            this.addViolation(
              'global-variable',
              `Global variable '${decl.id.name}' - restrict scope to smallest possible`,
              node.loc?.start.line,
              'warning',
            );
          }
        });
      }
    } catch (error) {
      // Skip if scope analysis fails - error is expected in some contexts
    }

    // Check for var usage (broader scope than let/const)
    if (node.kind === 'var') {
      this.addViolation(
        'var-usage',
        'Use of \'var\' - prefer \'const\' or \'let\' for better scope control',
        node.loc?.start.line,
        'warning',
      );
    }
  }

  checkAssertions(path) {
    // Assert: Must have valid context
    if (!this.currentFunction || !path || !path.node) {
      return;
    }
    
    const node = path.node;
    
    // Count validation checks as assertions
    if (node.type === 'IfStatement') {
      const test = node.test;
      
      // Look for validation patterns
      if (this.isValidationCheck(test)) {
        this.currentFunction.assertions++;
      }
    }
  }

  isValidationCheck(node) {
    // Assert: Node must exist
    if (!node) {
      return false;
    }
    
    // Direct validation: if (!param) throw
    if (node.type === 'UnaryExpression' && node.operator === '!') {
      return true;
    }
    
    // Comparison validation: if (param === null)
    if (node.type === 'BinaryExpression' && 
        ['===', '!==', '==', '!=', '<', '>', '<=', '>='].includes(node.operator)) {
      return true;
    }
    
    // typeof checks: if (typeof param === 'string')
    if (node.type === 'BinaryExpression' && 
        node.left.type === 'UnaryExpression' && 
        node.left.operator === 'typeof') {
      return true;
    }
    
    return false;
  }

  checkReturnValueUsage(path) {
    // Assert: Path must be valid
    if (!path || !path.node) {
      return;
    }

    const node = path.node;
    
    // Check if expression result is ignored
    if (node.expression && node.expression.type === 'CallExpression') {
      // Check for ignored Promise/async returns
      if (this.isAsyncCall(node.expression)) {
        this.addViolation(
          'ignored-async-return',
          'Async function return value ignored - handle Promise or use await',
          node.loc?.start.line,
          'warning',
        );
      }
    }
  }

  isAsyncCall(node) {
    // Assert: Node must be valid
    if (!node || !node.callee) {
      return false;
    }

    // Simple heuristic: function names that suggest async behavior
    if (node.callee.type === 'Identifier') {
      const name = node.callee.name;
      return name.includes('fetch') || name.includes('async') || 
             name.endsWith('Async') || name.startsWith('get') ||
             name.startsWith('load');
    }
    
    // Method calls that are commonly async
    if (node.callee.type === 'MemberExpression' && 
        node.callee.property.type === 'Identifier') {
      const method = node.callee.property.name;
      return ['then', 'catch', 'finally'].includes(method);
    }
    
    return false;
  }

  checkNestingDepth(path) {
    // Assert: Path must be valid
    if (!path || !path.node) {
      return;
    }

    const node = path.node;
    let depth = 0;
    let current = node;
    
    // Count chained member expressions
    while (current && current.type === 'MemberExpression') {
      depth++;
      current = current.object;
    }
    
    if (depth > MAX_NESTING_DEPTH) {
      this.addViolation(
        'deep-nesting',
        `Deep property access chain (${depth} levels) - limit to single dereference`,
        node.loc?.start.line,
        'info',
      );
    }
  }

  addViolation(rule, message, line, severity = 'warning') {
    // Assert: Valid inputs
    if (typeof rule !== 'string' || typeof message !== 'string') {
      throw new TypeError('Invalid violation parameters');
    }
    if (!['critical', 'warning', 'info'].includes(severity)) {
      throw new TypeError('Invalid severity level');
    }

    this.violations.push({
      rule,
      message,
      line: line || 0,
      severity,
      filename: this.filename,
    });
  }

  generateReport() {
    // Assert: Violations must be an array
    if (!Array.isArray(this.violations)) {
      throw new TypeError('Invalid violations state');
    }

    const criticalCount = this.violations.filter(v => v.severity === 'critical').length;
    const warningCount = this.violations.filter(v => v.severity === 'warning').length;
    const infoCount = this.violations.filter(v => v.severity === 'info').length;
    
    // Calculate safety score (0-100)
    const score = Math.max(
      0, 
      MAX_SCORE - (criticalCount * CRITICAL_PENALTY) - 
      (warningCount * WARNING_PENALTY) - 
      (infoCount * INFO_PENALTY),
    );
    
    return {
      success: true,
      score,
      filename: this.filename,
      summary: {
        total: this.violations.length,
        critical: criticalCount,
        warning: warningCount,
        info: infoCount,
      },
      violations: this.violations.sort((a, b) => {
        // Sort by severity then line number
        const severityOrder = { critical: 0, warning: 1, info: 2 };
        if (severityOrder[a.severity] !== severityOrder[b.severity]) {
          return severityOrder[a.severity] - severityOrder[b.severity];
        }
        return a.line - b.line;
      }),
    };
  }
}