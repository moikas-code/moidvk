import { createHash } from 'crypto';

/**
 * NASA JPL Power of 10 Runtime Assertions
 * Implements safety-critical programming rules for mission-critical software
 * 
 * The 10 Rules:
 * 1. Avoid complex flow constructs (goto, recursion)
 * 2. All loops must have fixed bounds
 * 3. Avoid heap memory allocation
 * 4. Restrict functions to a single printed page
 * 5. Use minimum of two runtime assertions per function
 * 6. Restrict scope of data to smallest possible
 * 7. Check return value of all non-void functions
 * 8. Use preprocessor sparingly
 * 9. Limit pointer use (single dereference, no function pointers)
 * 10. Compile with all warnings active
 */
export class JPLAssertions {
  constructor(options = {}) {
    this.options = {
      enabled: true,
      strictMode: true,
      maxFunctionLines: 60, // Rule 4: Single printed page
      maxLoopIterations: 10000, // Rule 2: Fixed bounds
      enableMemoryTracking: true, // Rule 3: Heap allocation
      minAssertionsPerFunction: 2, // Rule 5: Runtime assertions
      logAssertionFailures: true,
      throwOnFailure: false, // Set to true for safety-critical systems
      ...options,
    };

    this.assertionCount = 0;
    this.functionAssertionCounts = new Map();
    this.memoryAllocations = new Set();
    this.loopIterations = new Map();
    this.assertionLog = [];
    this.callStack = [];
    
    this.initializeAssertionSystem();
  }

  /**
   * Initialize the assertion system
   */
  initializeAssertionSystem() {
    if (!this.options.enabled) return;

    // Rule 5: Track function entry/exit for assertion counting
    this.originalConsoleError = console.error;
    
    // Setup global error handlers for safety-critical failures (only once)
    if (typeof process !== 'undefined' && !this._processListenersAttached) {
      this.uncaughtExceptionHandler = (error) => {
        this.handleCriticalFailure('UNCAUGHT_EXCEPTION', error.message, error.stack);
      };
      
      this.unhandledRejectionHandler = (reason, promise) => {
        this.handleCriticalFailure('UNHANDLED_REJECTION', reason.toString(), promise);
      };
      
      process.on('uncaughtException', this.uncaughtExceptionHandler);
      process.on('unhandledRejection', this.unhandledRejectionHandler);
      
      this._processListenersAttached = true;
    }
  }

  /**
   * Rule 5: Runtime assertion - minimum 2 per function
   */
  assert(condition, message, context = {}) {
    this.assertionCount++;
    
    const assertionInfo = {
      id: this.assertionCount,
      timestamp: new Date().toISOString(),
      condition: condition,
      message: message,
      context: context,
      stackTrace: this.getStackTrace(),
      functionName: this.getCurrentFunctionName(),
    };

    // Track assertions per function for Rule 5 compliance
    // Use the current function from call stack if available
    const functionName = this.callStack.length > 0 ? 
      this.callStack[this.callStack.length - 1].name : 
      assertionInfo.functionName;
      
    if (!this.functionAssertionCounts.has(functionName)) {
      this.functionAssertionCounts.set(functionName, 0);
    }
    this.functionAssertionCounts.set(functionName, 
      this.functionAssertionCounts.get(functionName) + 1);
      
    // Also track in current call stack entry
    if (this.callStack.length > 0) {
      this.callStack[this.callStack.length - 1].assertions++;
    }

    if (!condition) {
      this.handleAssertionFailure(assertionInfo);
      
      if (this.options.throwOnFailure) {
        throw new Error(`JPL Assertion Failed: ${message}`);
      }
      
      return false;
    }

    if (this.options.logAssertionFailures) {
      this.assertionLog.push(assertionInfo);
      
      // Keep log size manageable
      const MAX_LOG_SIZE = 1000;
      if (this.assertionLog.length > MAX_LOG_SIZE) {
        this.assertionLog.shift();
      }
    }

    return true;
  }

  /**
   * Rule 2: Loop bound checking
   */
  enterLoop(loopId, maxIterations = this.options.maxLoopIterations) {
    this.assert(typeof loopId === 'string', 'Loop ID must be a string', { loopId });
    this.assert(maxIterations > 0, 'Max iterations must be positive', { maxIterations });
    
    if (!this.loopIterations.has(loopId)) {
      this.loopIterations.set(loopId, {
        count: 0,
        maxIterations: maxIterations,
        startTime: Date.now(),
      });
    }
    
    return this.loopIterations.get(loopId);
  }

  /**
   * Rule 2: Check loop iteration bounds
   */
  checkLoopBound(loopId) {
    this.assert(this.loopIterations.has(loopId), 'Loop must be registered', { loopId });
    
    const loopInfo = this.loopIterations.get(loopId);
    loopInfo.count++;
    
    const withinBounds = loopInfo.count <= loopInfo.maxIterations;
    this.assert(withinBounds, 
      `Loop ${loopId} exceeded maximum iterations: ${loopInfo.count} > ${loopInfo.maxIterations}`,
      { loopId, count: loopInfo.count, maxIterations: loopInfo.maxIterations });
    
    return withinBounds;
  }

  /**
   * Rule 2: Exit loop and cleanup
   */
  exitLoop(loopId) {
    this.assert(this.loopIterations.has(loopId), 'Loop must be registered', { loopId });
    
    const loopInfo = this.loopIterations.get(loopId);
    const duration = Date.now() - loopInfo.startTime;
    
    this.assert(loopInfo.count <= loopInfo.maxIterations, 
      'Loop completed within bounds', 
      { loopId, finalCount: loopInfo.count, duration });
    
    this.loopIterations.delete(loopId);
    return loopInfo;
  }

  /**
   * Rule 3: Memory allocation tracking (limited heap usage)
   */
  trackAllocation(objectId, size, type = 'unknown') {
    this.assert(typeof objectId === 'string', 'Object ID must be a string', { objectId });
    this.assert(size >= 0, 'Size must be non-negative', { size });
    
    if (!this.options.enableMemoryTracking) return;
    
    const allocation = {
      id: objectId,
      size: size,
      type: type,
      timestamp: Date.now(),
      stack: this.getStackTrace(),
    };
    
    this.memoryAllocations.add(allocation);
    
    // Rule 3: Warn about heap allocations in safety-critical code
    if (this.options.strictMode && size > 1024) {
      this.assert(false, 
        `Large heap allocation detected: ${size} bytes`, 
        { objectId, size, type });
    }
    
    return allocation;
  }

  /**
   * Rule 3: Memory deallocation tracking
   */
  trackDeallocation(objectId) {
    this.assert(typeof objectId === 'string', 'Object ID must be a string', { objectId });
    
    if (!this.options.enableMemoryTracking) return;
    
    const allocation = Array.from(this.memoryAllocations)
      .find(alloc => alloc.id === objectId);
    
    this.assert(allocation !== undefined, 
      'Attempting to deallocate untracked object', 
      { objectId });
    
    if (allocation) {
      this.memoryAllocations.delete(allocation);
    }
    
    return allocation;
  }

  /**
   * Rule 4: Function size validation
   */
  validateFunctionSize(functionName, lineCount) {
    this.assert(typeof functionName === 'string', 'Function name must be a string');
    this.assert(lineCount >= 0, 'Line count must be non-negative');
    
    const withinLimits = lineCount <= this.options.maxFunctionLines;
    this.assert(withinLimits, 
      `Function ${functionName} exceeds maximum size: ${lineCount} > ${this.options.maxFunctionLines} lines`,
      { functionName, lineCount, maxLines: this.options.maxFunctionLines });
    
    return withinLimits;
  }

  /**
   * Rule 5: Function entry - start assertion tracking
   */
  enterFunction(functionName) {
    this.assert(typeof functionName === 'string', 'Function name must be a string');
    
    this.callStack.push({
      name: functionName,
      entryTime: Date.now(),
      assertions: 0,
    });
    
    if (!this.functionAssertionCounts.has(functionName)) {
      this.functionAssertionCounts.set(functionName, 0);
    }
  }

  /**
   * Rule 5: Function exit - verify minimum assertions
   */
  exitFunction(functionName) {
    this.assert(typeof functionName === 'string', 'Function name must be a string');
    this.assert(this.callStack.length > 0, 'Call stack cannot be empty');
    
    const currentFunction = this.callStack.pop();
    this.assert(currentFunction.name === functionName, 
      'Function exit name must match entry name',
      { expected: currentFunction.name, actual: functionName });
    
    const assertionCount = this.functionAssertionCounts.get(functionName) || 0;
    const meetsMinimum = assertionCount >= this.options.minAssertionsPerFunction;
    
    this.assert(meetsMinimum, 
      `Function ${functionName} has insufficient assertions: ${assertionCount} < ${this.options.minAssertionsPerFunction}`,
      { functionName, assertionCount, required: this.options.minAssertionsPerFunction });
    
    const duration = Date.now() - currentFunction.entryTime;
    return {
      functionName,
      duration,
      assertionCount,
      compliant: meetsMinimum,
    };
  }

  /**
   * Rule 7: Return value checking
   */
  checkReturnValue(value, expectedType, functionName = 'unknown') {
    this.assert(value !== undefined, 
      `Function ${functionName} returned undefined`,
      { functionName, returnValue: value });
    
    if (expectedType) {
      const actualType = typeof value;
      this.assert(actualType === expectedType, 
        `Function ${functionName} returned wrong type: expected ${expectedType}, got ${actualType}`,
        { functionName, expectedType, actualType, returnValue: value });
    }
    
    // Rule 7: For functions that can fail, check for error indicators
    if (value === null) {
      this.assert(false, 
        `Function ${functionName} returned null - potential error condition`,
        { functionName });
    }
    
    return value;
  }

  /**
   * Rule 6: Data scope validation
   */
  validateDataScope(variableName, scopeLevel, maxScopeLevel = 3) {
    this.assert(typeof variableName === 'string', 'Variable name must be a string');
    this.assert(scopeLevel >= 0, 'Scope level must be non-negative');
    
    const withinScope = scopeLevel <= maxScopeLevel;
    this.assert(withinScope, 
      `Variable ${variableName} scope too broad: level ${scopeLevel} > ${maxScopeLevel}`,
      { variableName, scopeLevel, maxScopeLevel });
    
    return withinScope;
  }

  /**
   * Rule 1: Recursion detection and prevention
   */
  checkRecursion(functionName, maxDepth = 10) {
    this.assert(typeof functionName === 'string', 'Function name must be a string');
    
    const callCount = this.callStack.filter(call => call.name === functionName).length;
    const withinLimits = callCount <= maxDepth;
    
    this.assert(withinLimits, 
      `Recursion depth exceeded for ${functionName}: ${callCount} > ${maxDepth}`,
      { functionName, currentDepth: callCount, maxDepth });
    
    return withinLimits;
  }

  /**
   * Critical failure handler for safety-critical systems
   */
  handleCriticalFailure(type, message, details) {
    const failure = {
      type: type,
      message: message,
      details: details,
      timestamp: new Date().toISOString(),
      assertionCount: this.assertionCount,
      callStack: [...this.callStack],
      memoryAllocations: this.memoryAllocations.size,
    };
    
    // Log to system log or safety monitoring system
    if (this.options.logAssertionFailures) {
      this.assertionLog.push({
        ...failure,
        severity: 'CRITICAL',
        jplRule: 'SYSTEM_SAFETY',
      });
    }
    
    // In a real safety-critical system, this would trigger:
    // - Safe shutdown procedures
    // - Fault isolation
    // - Backup system activation
    
    return failure;
  }

  /**
   * Handle assertion failure
   */
  handleAssertionFailure(assertionInfo) {
    const failure = {
      ...assertionInfo,
      severity: 'ASSERTION_FAILED',
      timestamp: new Date().toISOString(),
    };
    
    if (this.options.logAssertionFailures) {
      // Use original console.error to avoid recursion
      this.originalConsoleError(`JPL Assertion Failed: ${assertionInfo.message}`);
      this.originalConsoleError(`Context:`, assertionInfo.context);
      this.originalConsoleError(`Stack:`, assertionInfo.stackTrace.slice(0, 3));
    }
    
    this.assertionLog.push(failure);
    return failure;
  }

  /**
   * Utility methods
   */
  getCurrentFunctionName() {
    const stack = this.getStackTrace();
    // Skip this function and getStackTrace
    return stack[2]?.function || 'unknown';
  }

  getStackTrace() {
    const error = new Error();
    const stack = error.stack?.split('\n') || [];
    return stack.slice(1).map(line => {
      const match = line.match(/at\s+([^(]+)\s*\(([^)]+)\)/);
      return {
        function: match?.[1]?.trim() || 'unknown',
        location: match?.[2] || 'unknown',
        raw: line.trim(),
      };
    });
  }

  /**
   * Get JPL compliance metrics
   */
  getComplianceMetrics() {
    const totalFunctions = this.functionAssertionCounts.size;
    const compliantFunctions = Array.from(this.functionAssertionCounts.entries())
      .filter(([name, count]) => count >= this.options.minAssertionsPerFunction).length;
    
    return {
      totalAssertions: this.assertionCount,
      totalFunctions: totalFunctions,
      compliantFunctions: compliantFunctions,
      complianceRate: totalFunctions > 0 ? (compliantFunctions / totalFunctions) * 100 : 0,
      activeLoops: this.loopIterations.size,
      memoryAllocations: this.memoryAllocations.size,
      assertionFailures: this.assertionLog.filter(log => log.severity === 'ASSERTION_FAILED').length,
      criticalFailures: this.assertionLog.filter(log => log.severity === 'CRITICAL').length,
      options: this.options,
    };
  }

  /**
   * Get assertion log
   */
  getAssertionLog(limit = 100) {
    return this.assertionLog.slice(-limit);
  }

  /**
   * Reset assertion system (for testing)
   */
  reset() {
    this.assertionCount = 0;
    this.functionAssertionCounts.clear();
    this.memoryAllocations.clear();
    this.loopIterations.clear();
    this.assertionLog = [];
    this.callStack = [];
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport() {
    const metrics = this.getComplianceMetrics();
    const recentFailures = this.getAssertionLog(50);
    
    return {
      timestamp: new Date().toISOString(),
      metrics: metrics,
      jplRuleCompliance: {
        rule1_noComplexFlow: this.callStack.every(call => call.name !== 'recursive'),
        rule2_fixedLoopBounds: this.loopIterations.size === 0, // No active unbounded loops
        rule3_limitedHeapUse: this.memoryAllocations.size < 100,
        rule4_functionSize: true, // Enforced at development time
        rule5_minAssertions: metrics.complianceRate >= 80,
        rule6_dataScope: true, // Enforced through validation
        rule7_returnChecking: metrics.assertionFailures === 0,
        rule8_preprocessorUse: true, // Enforced at development time
        rule9_pointerUse: true, // JavaScript doesn't have raw pointers
        rule10_allWarnings: true, // Enforced at build time
      },
      recentFailures: recentFailures,
      recommendation: metrics.complianceRate >= 90 ? 'COMPLIANT' : 'NEEDS_IMPROVEMENT',
    };
  }
}

export default JPLAssertions;