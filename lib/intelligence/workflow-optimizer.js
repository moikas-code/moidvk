/**
 * Workflow Optimizer for intelligent tool sequencing
 * Determines optimal tool execution order based on context and goals
 */
export class WorkflowOptimizer {
  constructor() {
    // Define tool dependencies and relationships
    this.toolDependencies = new Map([
      ['check_production_readiness', ['check_code_practices', 'check_safety_rules']],
      ['check_graphql_query', ['check_graphql_schema']],
      ['format_code', ['check_code_practices']],
    ]);

    // Define tool categories and their typical order
    this.toolCategories = {
      analysis: ['check_code_practices', 'check_safety_rules', 'check_accessibility'],
      security: ['scan_security_vulnerabilities', 'check_production_readiness'],
      formatting: ['format_code'],
      validation: ['check_graphql_schema', 'check_graphql_query', 'check_redux_patterns'],
      search: ['search_files', 'search_in_files', 'find_similar_files'],
    };

    // Define workflow patterns
    this.workflowPatterns = {
      bug_fix: ['analysis', 'search', 'formatting'],
      feature_development: ['search', 'analysis', 'formatting', 'validation'],
      refactoring: ['analysis', 'search', 'formatting', 'validation'],
      optimization: ['analysis', 'security', 'validation'],
      review: ['analysis', 'security', 'validation'],
    };

    // Tool execution strategies
    this.strategies = {
      comprehensive: 'Run all relevant tools for thorough analysis',
      quick: 'Run minimal set of tools for quick feedback',
      focused: 'Run only tools specific to the task',
      iterative: 'Run tools iteratively based on results',
    };
  }

  /**
   * Generate optimal tool sequence based on context
   */
  async generateOptimalSequence(options = {}) {
    const { files = [], context = {}, goals = [] } = options;
    
    // Determine workflow type
    const workflowType = this.detectWorkflowType(context, goals);
    
    // Get base sequence from workflow pattern
    const baseSequence = this.getWorkflowSequence(workflowType);
    
    // Customize sequence based on files and context
    const customizedSequence = this.customizeSequence(baseSequence, files, context);
    
    // Optimize for dependencies
    const optimizedSequence = this.optimizeDependencies(customizedSequence);
    
    // Add reasoning for each tool
    const sequenceWithReasoning = this.addToolReasoning(optimizedSequence, context);
    
    return {
      workflowType,
      strategy: this.selectStrategy(context),
      sequence: sequenceWithReasoning,
      estimatedDuration: this.estimateDuration(sequenceWithReasoning),
      confidence: this.calculateConfidence(context, sequenceWithReasoning),
    };
  }

  /**
   * Detect workflow type from context and goals
   */
  detectWorkflowType(context, goals) {
    // Check goals for keywords
    const goalText = goals.join(' ').toLowerCase();
    
    if (goalText.includes('bug') || goalText.includes('fix') || goalText.includes('error')) {
      return 'bug_fix';
    }
    if (goalText.includes('feature') || goalText.includes('add') || goalText.includes('implement')) {
      return 'feature_development';
    }
    if (goalText.includes('refactor') || goalText.includes('clean') || goalText.includes('improve')) {
      return 'refactoring';
    }
    if (goalText.includes('optimize') || goalText.includes('performance') || goalText.includes('speed')) {
      return 'optimization';
    }
    if (goalText.includes('review') || goalText.includes('check') || goalText.includes('audit')) {
      return 'review';
    }
    
    // Default based on session context
    return context.sessionContext?.session_type || 'feature_development';
  }

  /**
   * Get workflow sequence for a given type
   */
  getWorkflowSequence(workflowType) {
    const pattern = this.workflowPatterns[workflowType] || this.workflowPatterns.feature_development;
    const tools = [];
    
    for (const category of pattern) {
      const categoryTools = this.toolCategories[category] || [];
      tools.push(...categoryTools);
    }
    
    return tools;
  }

  /**
   * Customize sequence based on files and context
   */
  customizeSequence(baseSequence, files, context) {
    const customSequence = [...baseSequence];
    
    // Add file-specific tools
    for (const file of files) {
      if (file.endsWith('.graphql')) {
        if (!customSequence.includes('check_graphql_schema')) {
          customSequence.push('check_graphql_schema');
        }
        if (!customSequence.includes('check_graphql_query')) {
          customSequence.push('check_graphql_query');
        }
      }
      
      if (file.includes('redux') || file.includes('store')) {
        if (!customSequence.includes('check_redux_patterns')) {
          customSequence.push('check_redux_patterns');
        }
      }
      
      if (file.endsWith('.html') || file.endsWith('.jsx') || file.endsWith('.tsx')) {
        if (!customSequence.includes('check_accessibility')) {
          customSequence.push('check_accessibility');
        }
      }
    }
    
    // Add context-specific tools
    if (context.sessionContext?.urgency === 'critical') {
      // Prioritize security and production readiness
      if (!customSequence.includes('scan_security_vulnerabilities')) {
        customSequence.unshift('scan_security_vulnerabilities');
      }
      if (!customSequence.includes('check_production_readiness')) {
        customSequence.unshift('check_production_readiness');
      }
    }
    
    // Remove duplicates while preserving order
    return [...new Set(customSequence)];
  }

  /**
   * Optimize sequence based on tool dependencies
   */
  optimizeDependencies(sequence) {
    const optimized = [];
    const processed = new Set();
    
    const processTool = (tool) => {
      if (processed.has(tool)) return;
      
      // Process dependencies first
      const deps = this.toolDependencies.get(tool) || [];
      for (const dep of deps) {
        if (sequence.includes(dep)) {
          processTool(dep);
        }
      }
      
      // Then process the tool itself
      optimized.push(tool);
      processed.add(tool);
    };
    
    // Process all tools in sequence
    for (const tool of sequence) {
      processTool(tool);
    }
    
    return optimized;
  }

  /**
   * Add reasoning for each tool in the sequence
   */
  addToolReasoning(sequence, context) {
    return sequence.map((toolName, index) => {
      const reasoning = this.getToolReasoning(toolName, context, index, sequence);
      const parameters = this.getToolParameters(toolName, context);
      
      return {
        name: toolName,
        state: this.getToolState(toolName),
        reasoning,
        parameters,
        priority: this.getToolPriority(toolName, context),
        dependencies: this.toolDependencies.get(toolName) || [],
      };
    });
  }

  /**
   * Get reasoning for why a tool should be run
   */
  getToolReasoning(toolName, context, index, sequence) {
    const reasons = [];
    
    // Base reasoning
    switch (toolName) {
      case 'check_code_practices':
        reasons.push('Establish code quality baseline');
        break;
      case 'check_safety_rules':
        reasons.push('Ensure safety-critical compliance');
        break;
      case 'scan_security_vulnerabilities':
        reasons.push('Identify security risks early');
        break;
      case 'check_production_readiness':
        reasons.push('Verify deployment readiness');
        break;
      case 'format_code':
        reasons.push('Maintain consistent code style');
        break;
      case 'check_accessibility':
        reasons.push('Ensure ADA compliance');
        break;
      case 'check_graphql_schema':
        reasons.push('Validate GraphQL schema design');
        break;
      case 'check_graphql_query':
        reasons.push('Optimize GraphQL queries');
        break;
      case 'check_redux_patterns':
        reasons.push('Ensure Redux best practices');
        break;
    }
    
    // Context-specific reasoning
    if (context.sessionContext?.urgency === 'critical' && 
        ['scan_security_vulnerabilities', 'check_production_readiness'].includes(toolName)) {
      reasons.push('Critical urgency requires immediate security validation');
    }
    
    // Dependency reasoning
    const deps = this.toolDependencies.get(toolName) || [];
    if (deps.length > 0) {
      const ranDeps = deps.filter(dep => sequence.slice(0, index).includes(dep));
      if (ranDeps.length > 0) {
        reasons.push(`Building on results from ${ranDeps.join(', ')}`);
      }
    }
    
    return reasons.join('. ');
  }

  /**
   * Get tool parameters based on context
   */
  getToolParameters(toolName, context) {
    const params = {};
    
    // Set production mode for critical or production contexts
    if (context.sessionContext?.urgency === 'critical' || 
        context.sessionContext?.session_type === 'review') {
      params.production = true;
    }
    
    // Set strict mode for certain contexts
    if (context.sessionContext?.session_type === 'review' ||
        context.sessionContext?.urgency === 'critical') {
      params.strict = true;
    }
    
    // Tool-specific parameters
    switch (toolName) {
      case 'check_code_practices':
        params.severity = context.sessionContext?.urgency === 'critical' ? 'error' : 'all';
        break;
      case 'scan_security_vulnerabilities':
        params.production = context.sessionContext?.urgency !== 'low';
        break;
      case 'check_accessibility':
        params.standard = context.sessionContext?.urgency === 'critical' ? 'AAA' : 'AA';
        break;
    }
    
    return params;
  }

  /**
   * Get state for tool execution - FIXED: All tools now map to valid states
   */
  getToolState(toolName) {
    // Map tools to development states - FIXED to ensure valid transitions
    const toolStateMap = {
      // Analysis tools - can transition from analyzing_code
      'search_files': 'analyzing_code',
      'search_in_files': 'analyzing_code',
      'check_code_practices': 'analyzing_code',
      'check_safety_rules': 'analyzing_code',
      'check_accessibility': 'analyzing_code',
      'check_graphql_schema': 'analyzing_code',
      'check_graphql_query': 'analyzing_code',
      'check_redux_patterns': 'analyzing_code',
      'scan_security_vulnerabilities': 'analyzing_code', // FIXED: Changed from testing_changes
      'check_production_readiness': 'analyzing_code', // FIXED: Changed from reviewing_quality
      
      // Implementation tools - can transition from analyzing_code
      'format_code': 'implementing_solution',
    };
    
    return toolStateMap[toolName] || 'analyzing_code';
  }

  /**
   * Get tool priority based on context
   */
  getToolPriority(toolName, context) {
    let priority = 'medium';
    
    // High priority tools for critical contexts
    if (context.sessionContext?.urgency === 'critical') {
      if (['scan_security_vulnerabilities', 'check_production_readiness', 'check_safety_rules'].includes(toolName)) {
        priority = 'high';
      }
    }
    
    // Low priority for formatting in urgent contexts
    if (context.sessionContext?.urgency === 'critical' && toolName === 'format_code') {
      priority = 'low';
    }
    
    return priority;
  }

  /**
   * Select execution strategy
   */
  selectStrategy(context) {
    if (context.sessionContext?.urgency === 'critical') {
      return 'quick';
    }
    if (context.sessionContext?.session_type === 'review') {
      return 'comprehensive';
    }
    if (context.sessionContext?.scope === 'single_file') {
      return 'focused';
    }
    
    return 'iterative';
  }

  /**
   * Estimate execution duration
   */
  estimateDuration(sequence) {
    // Rough estimates in milliseconds
    const toolDurations = {
      'check_code_practices': 2000,
      'check_safety_rules': 1500,
      'scan_security_vulnerabilities': 5000,
      'check_production_readiness': 3000,
      'format_code': 1000,
      'check_accessibility': 2500,
      'check_graphql_schema': 2000,
      'check_graphql_query': 2000,
      'check_redux_patterns': 2500,
      'search_files': 3000,
      'search_in_files': 4000,
      'find_similar_files': 5000,
    };
    
    let total = 0;
    for (const tool of sequence) {
      total += toolDurations[tool.name] || 2000;
    }
    
    return {
      milliseconds: total,
      seconds: Math.round(total / 1000),
      formatted: `${Math.round(total / 1000)}s`,
    };
  }

  /**
   * Calculate confidence in the sequence
   */
  calculateConfidence(context, sequence) {
    let confidence = 0.8; // Base confidence
    
    // Increase confidence for well-known patterns
    if (context.sessionContext?.session_type && 
        this.workflowPatterns[context.sessionContext.session_type]) {
      confidence += 0.1;
    }
    
    // Decrease confidence for ambiguous contexts
    if (!context.sessionContext?.session_type) {
      confidence -= 0.1;
    }
    
    // Increase confidence for smaller sequences
    if (sequence.length <= 5) {
      confidence += 0.05;
    }
    
    return Math.min(Math.max(confidence, 0), 1);
  }

  /**
   * Optimize sequence execution based on previous results
   */
  async optimizeBasedOnResults(sequence, previousResults) {
    const optimized = [...sequence];
    
    // Skip tools if previous tools found critical issues
    if (previousResults.some(r => r.severity === 'critical')) {
      // Remove non-essential tools
      return optimized.filter(tool => 
        ['check_safety_rules', 'scan_security_vulnerabilities', 'check_production_readiness']
          .includes(tool.name)
      );
    }
    
    // Add additional tools based on findings
    const findings = previousResults.flatMap(r => r.findings || []);
    
    if (findings.some(f => f.type === 'security')) {
      optimized.push({
        name: 'scan_security_vulnerabilities',
        reasoning: 'Security issues detected, running comprehensive scan',
        priority: 'high',
      });
    }
    
    return optimized;
  }

  /**
   * Get workflow summary
   */
  getWorkflowSummary(workflowType, sequence) {
    return {
      type: workflowType,
      description: this.getWorkflowDescription(workflowType),
      toolCount: sequence.length,
      categories: this.getToolCategories(sequence),
      estimatedDuration: this.estimateDuration(sequence),
    };
  }

  /**
   * Get workflow description
   */
  getWorkflowDescription(workflowType) {
    const descriptions = {
      bug_fix: 'Focused on identifying and fixing errors quickly',
      feature_development: 'Comprehensive analysis for new feature implementation',
      refactoring: 'Code improvement with quality and consistency checks',
      optimization: 'Performance and security focused analysis',
      review: 'Thorough code review with all quality checks',
    };
    
    return descriptions[workflowType] || 'General development workflow';
  }

  /**
   * Get categories covered by sequence
   */
  getToolCategories(sequence) {
    const categories = new Set();
    
    for (const tool of sequence) {
      for (const [category, tools] of Object.entries(this.toolCategories)) {
        if (tools.includes(tool.name)) {
          categories.add(category);
        }
      }
    }
    
    return Array.from(categories);
  }
}