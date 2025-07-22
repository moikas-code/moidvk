/**
 * Development State Machine for workflow state management
 * Tracks and manages development workflow states with intelligent transitions
 */
export class DevelopmentStateMachine {
  constructor() {
    // Define development states
    this.states = {
      INITIALIZING: 'initializing',
      ANALYZING: 'analyzing_code',
      PLANNING: 'planning_changes',
      IMPLEMENTING: 'implementing_solution',
      TESTING: 'testing_changes',
      REVIEWING: 'reviewing_quality',
      COMPLETING: 'completing_task',
      COMPLETED: 'completed',
      ERROR: 'error_state',
    };

    // Define allowed state transitions
    this.transitions = {
      [this.states.INITIALIZING]: [
        this.states.ANALYZING,
        this.states.PLANNING,
      ],
      [this.states.ANALYZING]: [
        this.states.PLANNING,
        this.states.IMPLEMENTING,
        this.states.ERROR,
      ],
      [this.states.PLANNING]: [
        this.states.IMPLEMENTING,
        this.states.ANALYZING,
        this.states.ERROR,
      ],
      [this.states.IMPLEMENTING]: [
        this.states.TESTING,
        this.states.REVIEWING,
        this.states.ANALYZING,
        this.states.ERROR,
      ],
      [this.states.TESTING]: [
        this.states.IMPLEMENTING,
        this.states.REVIEWING,
        this.states.ERROR,
      ],
      [this.states.REVIEWING]: [
        this.states.IMPLEMENTING,
        this.states.COMPLETING,
        this.states.ERROR,
      ],
      [this.states.COMPLETING]: [
        this.states.COMPLETED,
        this.states.REVIEWING,
        this.states.ERROR,
      ],
      [this.states.ERROR]: [
        this.states.ANALYZING,
        this.states.PLANNING,
        this.states.IMPLEMENTING,
      ],
      [this.states.COMPLETED]: [], // Terminal state
    };

    // State-specific actions and validations
    this.stateActions = {
      [this.states.ANALYZING]: {
        entry: ['loadContext', 'identifyPatterns', 'assessComplexity'],
        actions: ['runAnalysisTools', 'gatherMetrics', 'detectIssues'],
        exit: ['summarizeFindings', 'prepareRecommendations'],
      },
      [this.states.PLANNING]: {
        entry: ['reviewFindings', 'generateOptions', 'assessRisks'],
        actions: ['createTaskList', 'prioritizeTasks', 'estimateEffort'],
        exit: ['finalizePlan', 'allocateResources'],
      },
      [this.states.IMPLEMENTING]: {
        entry: ['loadPlan', 'prepareEnvironment', 'createCheckpoint'],
        actions: ['executeChanges', 'trackProgress', 'handleErrors'],
        exit: ['validateChanges', 'updateMetrics'],
      },
      [this.states.TESTING]: {
        entry: ['prepareTestEnvironment', 'loadTestSuite'],
        actions: ['runTests', 'collectResults', 'analyzeFailures'],
        exit: ['generateTestReport', 'updateQualityMetrics'],
      },
      [this.states.REVIEWING]: {
        entry: ['collectAllResults', 'loadQualityBaseline'],
        actions: ['performCodeReview', 'checkStandards', 'assessImpact'],
        exit: ['generateReviewReport', 'recommendActions'],
      },
    };

    // Current state tracking
    this.currentState = this.states.INITIALIZING;
    this.stateHistory = [];
    this.context = {};
    this.listeners = new Map();
  }

  /**
   * Initialize the state machine with context
   */
  async initialize(context = {}) {
    // Reset to clean state first
    this.reset();
    
    this.context = {
      ...context,
      startTime: Date.now(),
      transitions: 0,
      errors: [],
      achievements: [],
    };
    
    // Record initialization
    this.stateHistory.push({
      state: this.currentState,
      timestamp: Date.now(),
      reason: 'Initialization',
    });

    // Only transition if we're in INITIALIZING state
    if (this.currentState === this.states.INITIALIZING) {
      try {
        await this.transition(this.states.ANALYZING, {
          reason: 'Starting development workflow',
          automatic: true,
        });
      } catch (error) {
        console.warn('Failed to transition to ANALYZING:', error.message);
        // Stay in INITIALIZING state if transition fails
      }
    }

    return this.currentState;
  }

  /**
   * Transition to a new state
   */
  async transition(newState, metadata = {}) {
    const transitionRecord = {
      from: this.currentState,
      to: newState,
      timestamp: Date.now(),
      metadata,
      success: false,
    };

    try {
      // Validate transition
      const validation = await this.validateTransition(this.currentState, newState, this.context);
      if (!validation.valid) {
        throw new Error(`Invalid transition: ${validation.reason}`);
      }

      // Execute exit actions for current state
      await this.executeStateActions(this.currentState, 'exit');

      // Update state
      const previousState = this.currentState;
      this.currentState = newState;
      this.context.transitions++;

      // Execute entry actions for new state
      await this.executeStateActions(newState, 'entry');

      // Record successful transition
      transitionRecord.success = true;
      transitionRecord.reasoning = validation.reasoning;
      this.stateHistory.push(transitionRecord);

      // Notify listeners
      await this.notifyListeners('transition', {
        from: previousState,
        to: newState,
        context: this.context,
      });

      // Execute automatic actions if needed
      if (metadata.automatic) {
        await this.executeStateActions(newState, 'actions');
      }

      return {
        success: true,
        state: newState,
        actions: await this.getAvailableActions(newState),
      };
    } catch (error) {
      // Handle transition error
      transitionRecord.error = error.message;
      this.stateHistory.push(transitionRecord);
      this.context.errors.push({
        timestamp: Date.now(),
        state: this.currentState,
        error: error.message,
      });

      // Notify listeners of error
      await this.notifyListeners('error', {
        state: this.currentState,
        error: error.message,
      });

      // Attempt recovery
      if (this.currentState !== this.states.ERROR) {
        await this.transition(this.states.ERROR, {
          reason: error.message,
          previousState: this.currentState,
        });
      }

      throw error;
    }
  }

  /**
   * Validate a state transition
   */
  async validateTransition(fromState, toState, context) {
    // Allow staying in the same state (no-op transition)
    if (fromState === toState) {
      return {
        valid: true,
        reason: 'No state change needed',
      };
    }
    
    // Check if transition is allowed
    const allowedTransitions = this.transitions[fromState] || [];
    if (!allowedTransitions.includes(toState)) {
      return {
        valid: false,
        reason: `Transition from ${fromState} to ${toState} is not allowed`,
      };
    }

    // State-specific validation
    const validation = await this.performStateValidation(fromState, toState, context);
    if (!validation.valid) {
      return validation;
    }

    // Generate reasoning for the transition
    const reasoning = this.generateTransitionReasoning(fromState, toState, context);

    return {
      valid: true,
      reasoning,
    };
  }

  /**
   * Perform state-specific validation
   */
  async performStateValidation(fromState, toState, context) {
    // Validate based on specific state requirements
    switch (toState) {
      case this.states.IMPLEMENTING:
        if (!context.plan || context.plan.tasks?.length === 0) {
          return {
            valid: false,
            reason: 'Cannot implement without a plan',
          };
        }
        break;

      case this.states.TESTING:
        if (!context.changes || context.changes.length === 0) {
          return {
            valid: false,
            reason: 'No changes to test',
          };
        }
        break;

      case this.states.COMPLETING:
        if (context.failedTests > 0) {
          return {
            valid: false,
            reason: 'Cannot complete with failing tests',
          };
        }
        if (context.criticalIssues > 0) {
          return {
            valid: false,
            reason: 'Cannot complete with critical issues',
          };
        }
        break;

      case this.states.COMPLETED:
        if (!context.allTasksComplete) {
          return {
            valid: false,
            reason: 'Not all tasks are complete',
          };
        }
        break;
    }

    return { valid: true };
  }

  /**
   * Generate reasoning for state transition
   */
  generateTransitionReasoning(fromState, toState, context) {
    const reasons = [];

    // Add state-specific reasoning
    switch (toState) {
      case this.states.ANALYZING:
        reasons.push('Need to analyze code before making changes');
        if (context.errors?.length > 0) {
          reasons.push('Recovering from error state');
        }
        break;

      case this.states.PLANNING:
        if (context.findings?.length > 0) {
          reasons.push(`Found ${context.findings.length} issues that need planning`);
        }
        reasons.push('Creating action plan based on analysis');
        break;

      case this.states.IMPLEMENTING:
        reasons.push(`Ready to implement ${context.plan?.tasks?.length || 0} planned tasks`);
        break;

      case this.states.TESTING:
        reasons.push('Changes complete, validating implementation');
        break;

      case this.states.REVIEWING:
        if (fromState === this.states.TESTING) {
          reasons.push('Tests passed, performing final review');
        } else {
          reasons.push('Reviewing changes before testing');
        }
        break;

      case this.states.COMPLETING:
        reasons.push('All validations passed, finalizing task');
        break;

      case this.states.ERROR:
        reasons.push(`Error encountered: ${context.lastError}`);
        break;
    }

    return reasons.join('. ');
  }

  /**
   * Execute state-specific actions
   */
  async executeStateActions(state, phase) {
    const actions = this.stateActions[state]?.[phase] || [];
    const results = [];

    for (const action of actions) {
      try {
        const result = await this.executeAction(action, state);
        results.push({
          action,
          success: true,
          result,
        });
      } catch (error) {
        results.push({
          action,
          success: false,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Execute a specific action
   */
  async executeAction(action, state) {
    // Notify listeners of action execution
    await this.notifyListeners('action', {
      action,
      state,
      context: this.context,
    });

    // Action implementations would go here
    // For now, return mock results
    switch (action) {
      case 'loadContext':
        return { contextLoaded: true };
      case 'identifyPatterns':
        return { patterns: ['test-driven', 'modular'] };
      case 'assessComplexity':
        return { complexity: 'medium' };
      case 'runAnalysisTools':
        return { tools: ['eslint', 'security-scan'] };
      default:
        return { executed: action };
    }
  }

  /**
   * Get available actions for current state
   */
  async getAvailableActions(state = null) {
    const targetState = state || this.currentState;
    const actions = [];

    // Get possible transitions
    const possibleStates = this.transitions[targetState] || [];
    
    for (const nextState of possibleStates) {
      const validation = await this.validateTransition(targetState, nextState, this.context);
      if (validation.valid) {
        actions.push({
          type: 'transition',
          to: nextState,
          description: this.getStateDescription(nextState),
          reasoning: validation.reasoning,
        });
      }
    }

    // Get state-specific actions
    const stateActions = this.stateActions[targetState]?.actions || [];
    for (const action of stateActions) {
      actions.push({
        type: 'action',
        name: action,
        description: this.getActionDescription(action),
        state: targetState,
      });
    }

    return actions;
  }

  /**
   * Suggest next steps based on current state and context
   */
  async suggestNextSteps(context = {}) {
    const mergedContext = { ...this.context, ...context };
    const suggestions = [];

    // Get possible transitions
    const possibleStates = this.getPossibleTransitions(this.currentState);
    
    for (const state of possibleStates) {
      const confidence = await this.calculateTransitionConfidence(state, mergedContext);
      if (confidence > 0.5) {
        suggestions.push({
          action: 'transition',
          targetState: state,
          confidence,
          reasoning: await this.getTransitionReasoning(state, mergedContext),
          estimatedDuration: this.estimateStateDuration(state),
        });
      }
    }

    // Sort by confidence
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return {
      currentState: this.currentState,
      suggestions: suggestions.slice(0, 3), // Top 3 suggestions
      context: this.getContextSummary(),
    };
  }

  /**
   * Calculate confidence for a state transition
   */
  async calculateTransitionConfidence(targetState, context) {
    let confidence = 0.6; // Base confidence

    // Adjust based on context
    switch (targetState) {
      case this.states.IMPLEMENTING:
        if (context.plan?.tasks?.length > 0) {
          confidence += 0.2;
        }
        if (context.complexity === 'low') {
          confidence += 0.1;
        }
        break;

      case this.states.TESTING:
        if (context.changes?.length > 0) {
          confidence += 0.2;
        }
        if (context.hasTests) {
          confidence += 0.1;
        }
        break;

      case this.states.REVIEWING:
        if (context.testsPassed) {
          confidence += 0.3;
        }
        break;

      case this.states.COMPLETING:
        if (context.allTasksComplete && context.qualityScore > 80) {
          confidence += 0.3;
        }
        break;
    }

    // Reduce confidence if there are recent errors
    if (context.errors?.length > 0) {
      const recentErrors = context.errors.filter(e => 
        Date.now() - e.timestamp < 300000 // 5 minutes
      );
      confidence -= recentErrors.length * 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Get transition reasoning
   */
  async getTransitionReasoning(targetState, context) {
    const reasons = [];

    // Add context-specific reasoning
    if (context.urgency === 'critical' && targetState === this.states.IMPLEMENTING) {
      reasons.push('Critical urgency requires immediate implementation');
    }

    if (context.qualityScore < 70 && targetState === this.states.REVIEWING) {
      reasons.push('Low quality score requires thorough review');
    }

    // Add state-specific reasoning
    reasons.push(this.getStateDescription(targetState));

    return reasons.join('. ');
  }

  /**
   * Get possible transitions from a state
   */
  getPossibleTransitions(state) {
    return this.transitions[state] || [];
  }

  /**
   * Estimate duration for a state
   */
  estimateStateDuration(state) {
    const baseDurations = {
      [this.states.ANALYZING]: 60,
      [this.states.PLANNING]: 30,
      [this.states.IMPLEMENTING]: 120,
      [this.states.TESTING]: 45,
      [this.states.REVIEWING]: 30,
      [this.states.COMPLETING]: 15,
    };

    const duration = baseDurations[state] || 30;
    
    // Adjust based on context
    let multiplier = 1;
    if (this.context.complexity === 'high') multiplier *= 1.5;
    if (this.context.scope === 'system') multiplier *= 2;
    if (this.context.urgency === 'critical') multiplier *= 0.7;

    return Math.round(duration * multiplier);
  }

  /**
   * Get state description
   */
  getStateDescription(state) {
    const descriptions = {
      [this.states.INITIALIZING]: 'Setting up development environment',
      [this.states.ANALYZING]: 'Analyzing code and identifying patterns',
      [this.states.PLANNING]: 'Planning implementation approach',
      [this.states.IMPLEMENTING]: 'Implementing changes',
      [this.states.TESTING]: 'Testing implementation',
      [this.states.REVIEWING]: 'Reviewing code quality',
      [this.states.COMPLETING]: 'Finalizing and cleaning up',
      [this.states.COMPLETED]: 'Task completed successfully',
      [this.states.ERROR]: 'Handling error condition',
    };

    return descriptions[state] || 'Unknown state';
  }

  /**
   * Get action description
   */
  getActionDescription(action) {
    const descriptions = {
      loadContext: 'Load project and session context',
      identifyPatterns: 'Identify code patterns and anti-patterns',
      assessComplexity: 'Assess code complexity',
      runAnalysisTools: 'Run code analysis tools',
      gatherMetrics: 'Collect code quality metrics',
      detectIssues: 'Detect potential issues',
      createTaskList: 'Create prioritized task list',
      executeChanges: 'Execute code changes',
      runTests: 'Run test suite',
      performCodeReview: 'Perform automated code review',
    };

    return descriptions[action] || action;
  }

  /**
   * Get context summary
   */
  getContextSummary() {
    return {
      duration: Date.now() - this.context.startTime,
      transitions: this.context.transitions,
      errors: this.context.errors.length,
      currentComplexity: this.context.complexity || 'unknown',
      progress: this.calculateProgress(),
    };
  }

  /**
   * Calculate overall progress
   */
  calculateProgress() {
    const stateProgress = {
      [this.states.INITIALIZING]: 0,
      [this.states.ANALYZING]: 15,
      [this.states.PLANNING]: 30,
      [this.states.IMPLEMENTING]: 50,
      [this.states.TESTING]: 70,
      [this.states.REVIEWING]: 85,
      [this.states.COMPLETING]: 95,
      [this.states.COMPLETED]: 100,
      [this.states.ERROR]: null,
    };

    return stateProgress[this.currentState] || 0;
  }

  /**
   * Register state change listener
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Remove state change listener
   */
  off(event, callback) {
    const callbacks = this.listeners.get(event) || [];
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }

  /**
   * Notify listeners of events
   */
  async notifyListeners(event, data) {
    const callbacks = this.listeners.get(event) || [];
    for (const callback of callbacks) {
      try {
        await callback(data);
      } catch (error) {
        console.error(`Error in listener for ${event}:`, error);
      }
    }
  }

  /**
   * Get state machine status
   */
  getStatus() {
    return {
      currentState: this.currentState,
      stateDescription: this.getStateDescription(this.currentState),
      possibleTransitions: this.getPossibleTransitions(this.currentState),
      progress: this.calculateProgress(),
      context: this.getContextSummary(),
      history: this.stateHistory.slice(-10), // Last 10 transitions
    };
  }

  /**
   * Reset state machine
   */
  reset() {
    this.currentState = this.states.INITIALIZING;
    this.stateHistory = [];
    this.context = {};
    return true;
  }
}