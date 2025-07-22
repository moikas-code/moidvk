/**
 * Context Router for intelligent context switching
 * Routes decisions and actions based on changing development context
 */
export class ContextRouter {
  constructor() {
    // Define context types and their characteristics
    this.contextTypes = {
      exploration: {
        characteristics: ['searching', 'reading', 'analyzing'],
        tools: ['search_files', 'search_in_files', 'find_similar_files'],
        pace: 'measured',
      },
      implementation: {
        characteristics: ['writing', 'modifying', 'creating'],
        tools: ['update_file', 'create_file', 'format_code'],
        pace: 'focused',
      },
      validation: {
        characteristics: ['testing', 'checking', 'verifying'],
        tools: ['check_code_practices', 'check_production_readiness', 'scan_security_vulnerabilities'],
        pace: 'thorough',
      },
      debugging: {
        characteristics: ['fixing', 'investigating', 'diagnosing'],
        tools: ['search_in_files', 'check_code_practices', 'read_file'],
        pace: 'investigative',
      },
      review: {
        characteristics: ['reviewing', 'auditing', 'assessing'],
        tools: ['check_code_practices', 'check_accessibility', 'check_production_readiness'],
        pace: 'comprehensive',
      },
    };

    // Context switching rules
    this.switchingRules = {
      'exploration->implementation': {
        conditions: ['sufficient_understanding', 'clear_approach'],
        preparation: ['create_checkpoint', 'document_findings'],
      },
      'implementation->validation': {
        conditions: ['changes_complete', 'no_syntax_errors'],
        preparation: ['save_progress', 'prepare_test_environment'],
      },
      'validation->debugging': {
        conditions: ['test_failures', 'unexpected_behavior'],
        preparation: ['capture_error_context', 'identify_failure_points'],
      },
      'debugging->implementation': {
        conditions: ['root_cause_identified', 'fix_approach_clear'],
        preparation: ['document_fix_approach', 'create_test_case'],
      },
    };

    // Current context tracking
    this.currentContext = null;
    this.contextHistory = [];
    this.contextMetrics = new Map();
  }

  /**
   * Detect current context from activity
   */
  detectContext(activity) {
    const indicators = {
      exploration: 0,
      implementation: 0,
      validation: 0,
      debugging: 0,
      review: 0,
    };

    // Analyze recent tools used
    const recentTools = activity.recentTools || [];
    for (const tool of recentTools) {
      for (const [contextType, config] of Object.entries(this.contextTypes)) {
        if (config.tools.includes(tool)) {
          indicators[contextType]++;
        }
      }
    }

    // Analyze actions
    const actions = activity.actions || [];
    for (const action of actions) {
      for (const [contextType, config] of Object.entries(this.contextTypes)) {
        if (config.characteristics.some(char => action.includes(char))) {
          indicators[contextType] += 0.5;
        }
      }
    }

    // Find dominant context
    let maxScore = 0;
    let detectedContext = 'exploration';
    
    for (const [context, score] of Object.entries(indicators)) {
      if (score > maxScore) {
        maxScore = score;
        detectedContext = context;
      }
    }

    return {
      context: detectedContext,
      confidence: maxScore > 0 ? Math.min(maxScore / 5, 1) : 0.3,
      indicators,
    };
  }

  /**
   * Route to appropriate context
   */
  async routeContext(currentActivity, targetGoal) {
    // Detect current context
    const detection = this.detectContext(currentActivity);
    const fromContext = this.currentContext || detection.context;
    
    // Determine target context
    const toContext = this.determineTargetContext(targetGoal, currentActivity);
    
    // Check if context switch is needed
    if (fromContext === toContext) {
      return {
        action: 'continue',
        context: fromContext,
        reason: 'Already in appropriate context',
      };
    }

    // Validate context switch
    const validation = await this.validateContextSwitch(fromContext, toContext, currentActivity);
    if (!validation.allowed) {
      return {
        action: 'block',
        context: fromContext,
        reason: validation.reason,
        suggestions: validation.suggestions,
      };
    }

    // Prepare for context switch
    const preparation = await this.prepareContextSwitch(fromContext, toContext);
    
    // Execute context switch
    const result = await this.executeContextSwitch(fromContext, toContext, preparation);
    
    return result;
  }

  /**
   * Determine target context based on goal
   */
  determineTargetContext(goal, activity) {
    // Simple keyword matching for now
    const goalText = goal.toLowerCase();
    
    if (goalText.includes('implement') || goalText.includes('create') || goalText.includes('add')) {
      return 'implementation';
    }
    if (goalText.includes('test') || goalText.includes('validate') || goalText.includes('check')) {
      return 'validation';
    }
    if (goalText.includes('fix') || goalText.includes('debug') || goalText.includes('investigate')) {
      return 'debugging';
    }
    if (goalText.includes('review') || goalText.includes('audit') || goalText.includes('assess')) {
      return 'review';
    }
    
    return 'exploration';
  }

  /**
   * Validate context switch
   */
  async validateContextSwitch(from, to, activity) {
    const ruleKey = `${from}->${to}`;
    const rules = this.switchingRules[ruleKey];
    
    if (!rules) {
      // No specific rules, allow switch
      return { allowed: true };
    }

    // Check conditions
    const unmetConditions = [];
    for (const condition of rules.conditions) {
      if (!this.checkCondition(condition, activity)) {
        unmetConditions.push(condition);
      }
    }

    if (unmetConditions.length > 0) {
      return {
        allowed: false,
        reason: `Cannot switch from ${from} to ${to}: missing ${unmetConditions.join(', ')}`,
        suggestions: this.getSuggestions(unmetConditions),
      };
    }

    return { allowed: true };
  }

  /**
   * Check specific condition
   */
  checkCondition(condition, activity) {
    switch (condition) {
      case 'sufficient_understanding':
        return activity.filesAnalyzed >= 3 || activity.searchesPerformed >= 2;
      
      case 'clear_approach':
        return activity.plan && activity.plan.tasks?.length > 0;
      
      case 'changes_complete':
        return activity.pendingChanges === 0;
      
      case 'no_syntax_errors':
        return !activity.syntaxErrors || activity.syntaxErrors === 0;
      
      case 'test_failures':
        return activity.testFailures > 0;
      
      case 'root_cause_identified':
        return activity.rootCause !== null;
      
      default:
        return true;
    }
  }

  /**
   * Get suggestions for unmet conditions
   */
  getSuggestions(conditions) {
    const suggestions = [];
    
    for (const condition of conditions) {
      switch (condition) {
        case 'sufficient_understanding':
          suggestions.push('Analyze more files to understand the codebase better');
          suggestions.push('Use search tools to find relevant code patterns');
          break;
        
        case 'clear_approach':
          suggestions.push('Create a plan with specific tasks before implementing');
          break;
        
        case 'changes_complete':
          suggestions.push('Complete pending changes before validation');
          break;
        
        case 'no_syntax_errors':
          suggestions.push('Fix syntax errors before proceeding');
          break;
      }
    }
    
    return suggestions;
  }

  /**
   * Prepare for context switch
   */
  async prepareContextSwitch(from, to) {
    const ruleKey = `${from}->${to}`;
    const rules = this.switchingRules[ruleKey];
    const preparations = [];

    if (rules?.preparation) {
      for (const prep of rules.preparation) {
        const result = await this.executePreparation(prep);
        preparations.push({
          action: prep,
          result,
        });
      }
    }

    // Update metrics
    this.updateContextMetrics(from);

    return preparations;
  }

  /**
   * Execute preparation action
   */
  async executePreparation(action) {
    switch (action) {
      case 'create_checkpoint':
        return { checkpoint: Date.now() };
      
      case 'document_findings':
        return { documented: true };
      
      case 'save_progress':
        return { saved: true };
      
      case 'prepare_test_environment':
        return { testEnvReady: true };
      
      case 'capture_error_context':
        return { errorContext: 'captured' };
      
      case 'identify_failure_points':
        return { failurePoints: [] };
      
      default:
        return { executed: action };
    }
  }

  /**
   * Execute context switch
   */
  async executeContextSwitch(from, to, preparation) {
    // Record in history
    this.contextHistory.push({
      from,
      to,
      timestamp: Date.now(),
      preparation,
    });

    // Update current context
    this.currentContext = to;

    // Get recommended actions for new context
    const recommendations = this.getContextRecommendations(to);

    return {
      action: 'switch',
      previousContext: from,
      context: to,
      preparations: preparation,
      recommendations,
      pace: this.contextTypes[to].pace,
      tools: this.contextTypes[to].tools,
    };
  }

  /**
   * Get recommendations for context
   */
  getContextRecommendations(context) {
    const recommendations = {
      exploration: [
        'Start with broad searches to understand the codebase',
        'Look for similar implementations for reference',
        'Document findings as you explore',
      ],
      implementation: [
        'Focus on one change at a time',
        'Test incrementally as you implement',
        'Follow existing code patterns',
      ],
      validation: [
        'Run comprehensive tests',
        'Check edge cases',
        'Validate against requirements',
      ],
      debugging: [
        'Isolate the problem area',
        'Use systematic debugging approach',
        'Document the root cause when found',
      ],
      review: [
        'Check against coding standards',
        'Verify security implications',
        'Assess performance impact',
      ],
    };

    return recommendations[context] || [];
  }

  /**
   * Update context metrics
   */
  updateContextMetrics(context) {
    const metrics = this.contextMetrics.get(context) || {
      timeSpent: 0,
      switches: 0,
      lastActive: null,
    };

    if (metrics.lastActive) {
      metrics.timeSpent += Date.now() - metrics.lastActive;
    }
    metrics.switches++;
    metrics.lastActive = Date.now();

    this.contextMetrics.set(context, metrics);
  }

  /**
   * Get context insights
   */
  getContextInsights() {
    const insights = {
      currentContext: this.currentContext,
      timeDistribution: {},
      switchPatterns: [],
      recommendations: [],
    };

    // Calculate time distribution
    let totalTime = 0;
    this.contextMetrics.forEach((metrics, context) => {
      totalTime += metrics.timeSpent;
    });

    this.contextMetrics.forEach((metrics, context) => {
      insights.timeDistribution[context] = {
        percentage: (metrics.timeSpent / totalTime) * 100,
        duration: metrics.timeSpent,
        switches: metrics.switches,
      };
    });

    // Analyze switch patterns
    const switchCounts = {};
    for (let i = 1; i < this.contextHistory.length; i++) {
      const pattern = `${this.contextHistory[i-1].to}->${this.contextHistory[i].to}`;
      switchCounts[pattern] = (switchCounts[pattern] || 0) + 1;
    }

    insights.switchPatterns = Object.entries(switchCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([pattern, count]) => ({ pattern, count }));

    // Generate recommendations
    if (insights.timeDistribution.exploration?.percentage > 50) {
      insights.recommendations.push('Consider moving to implementation phase');
    }
    if (insights.timeDistribution.debugging?.percentage > 40) {
      insights.recommendations.push('High debugging time - consider more thorough testing');
    }

    return insights;
  }

  /**
   * Predict next context
   */
  predictNextContext(currentActivity) {
    if (this.contextHistory.length < 2) {
      return { context: 'exploration', confidence: 0.3 };
    }

    // Look for patterns in history
    const currentContext = this.currentContext;
    const patterns = {};
    
    for (let i = 0; i < this.contextHistory.length - 1; i++) {
      if (this.contextHistory[i].to === currentContext) {
        const next = this.contextHistory[i + 1].to;
        patterns[next] = (patterns[next] || 0) + 1;
      }
    }

    // Find most likely next context
    let maxCount = 0;
    let predictedContext = currentContext;
    
    for (const [context, count] of Object.entries(patterns)) {
      if (count > maxCount) {
        maxCount = count;
        predictedContext = context;
      }
    }

    const confidence = maxCount > 0 ? Math.min(maxCount / 5, 0.9) : 0.3;

    return {
      context: predictedContext,
      confidence,
      basedOn: `${maxCount} historical transitions`,
    };
  }

  /**
   * Reset context router
   */
  reset() {
    this.currentContext = null;
    this.contextHistory = [];
    this.contextMetrics.clear();
  }
}