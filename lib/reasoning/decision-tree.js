/**
 * Decision Tree for rule-based decision making
 * Implements a flexible decision tree for development workflow decisions
 */
export class DevelopmentDecisionTree {
  constructor() {
    // Define decision nodes
    this.decisionNodes = {
      // Root decision: What type of task?
      root: {
        name: 'task_type_decision',
        condition: (context) => context.taskType || 'unknown',
        branches: {
          'bug_fix': 'bug_fix_workflow',
          'feature_development': 'feature_workflow',
          'refactoring': 'refactor_workflow',
          'optimization': 'optimization_workflow',
          'review': 'review_workflow',
          'unknown': 'analyze_task',
        },
        confidence_threshold: 0.7,
      },

      // Analyze task to determine type
      analyze_task: {
        name: 'analyze_task',
        condition: (context) => {
          const indicators = this.analyzeTaskIndicators(context);
          return indicators.mostLikely;
        },
        branches: {
          'bug_fix': 'bug_fix_workflow',
          'feature_development': 'feature_workflow',
          'refactoring': 'refactor_workflow',
          'optimization': 'optimization_workflow',
          'review': 'review_workflow',
        },
        confidence_threshold: 0.6,
      },

      // Bug fix workflow decisions
      bug_fix_workflow: {
        name: 'bug_fix_severity',
        condition: (context) => context.bugSeverity || this.assessBugSeverity(context),
        branches: {
          'critical': 'critical_bug_fix',
          'high': 'high_priority_bug_fix',
          'medium': 'standard_bug_fix',
          'low': 'low_priority_bug_fix',
        },
        confidence_threshold: 0.8,
      },

      critical_bug_fix: {
        name: 'critical_bug_actions',
        condition: () => 'immediate_action',
        branches: {
          'immediate_action': {
            actions: [
              'create_hotfix_branch',
              'minimal_code_analysis',
              'focused_fix_implementation',
              'critical_testing',
              'expedited_review',
              'emergency_deployment',
            ],
            tools: ['check_code_practices', 'check_production_readiness'],
            priority: 'critical',
          },
        },
        terminal: true,
      },

      // Feature development workflow
      feature_workflow: {
        name: 'feature_complexity',
        condition: (context) => this.assessFeatureComplexity(context),
        branches: {
          'high': 'complex_feature_workflow',
          'medium': 'standard_feature_workflow',
          'low': 'simple_feature_workflow',
        },
        confidence_threshold: 0.7,
      },

      complex_feature_workflow: {
        name: 'complex_feature_actions',
        condition: () => 'phased_approach',
        branches: {
          'phased_approach': {
            actions: [
              'detailed_analysis',
              'architecture_review',
              'create_design_doc',
              'prototype_implementation',
              'incremental_development',
              'comprehensive_testing',
              'performance_validation',
              'security_review',
            ],
            tools: [
              'search_files',
              'check_code_practices',
              'check_safety_rules',
              'check_accessibility',
              'scan_security_vulnerabilities',
              'check_production_readiness',
            ],
            priority: 'high',
          },
        },
        terminal: true,
      },

      // Code quality decisions
      code_quality_check: {
        name: 'code_quality_analysis',
        condition: (context) => {
          const score = context.analysis?.qualityScore || 0;
          if (score < 50) return 'poor';
          if (score < 70) return 'needs_improvement';
          if (score < 90) return 'good';
          return 'excellent';
        },
        branches: {
          'poor': 'major_refactoring_required',
          'needs_improvement': 'targeted_improvements',
          'good': 'minor_optimizations',
          'excellent': 'maintain_quality',
        },
        confidence_threshold: 0.85,
      },

      // Security concern decisions
      security_concerns: {
        name: 'security_analysis',
        condition: (context) => {
          const issues = context.analysis?.security?.issues || [];
          if (issues.some(i => i.severity === 'critical')) return 'critical_security';
          if (issues.length > 5) return 'multiple_issues';
          if (issues.length > 0) return 'minor_issues';
          return 'secure';
        },
        branches: {
          'critical_security': 'immediate_security_review',
          'multiple_issues': 'comprehensive_security_fix',
          'minor_issues': 'standard_security_fix',
          'secure': 'continue_workflow',
        },
        confidence_threshold: 0.9,
      },

      immediate_security_review: {
        name: 'critical_security_actions',
        condition: () => 'security_lockdown',
        branches: {
          'security_lockdown': {
            actions: [
              'halt_current_work',
              'security_audit',
              'vulnerability_assessment',
              'patch_critical_issues',
              'security_testing',
              'penetration_testing',
              'security_documentation',
            ],
            tools: ['scan_security_vulnerabilities', 'check_production_readiness'],
            priority: 'critical',
            notify: ['security_team', 'project_lead'],
          },
        },
        terminal: true,
      },

      // Performance optimization decisions
      performance_issues: {
        name: 'performance_analysis',
        condition: (context) => {
          const metrics = context.analysis?.performance || {};
          if (metrics.score < 30) return 'severe';
          if (metrics.score < 60) return 'moderate';
          if (metrics.score < 80) return 'minor';
          return 'optimal';
        },
        branches: {
          'severe': 'major_performance_overhaul',
          'moderate': 'targeted_optimization',
          'minor': 'quick_optimizations',
          'optimal': 'monitor_performance',
        },
        confidence_threshold: 0.75,
      },

      // Tool selection decisions
      tool_selection: {
        name: 'select_appropriate_tools',
        condition: (context) => {
          if (context.fileTypes?.includes('.graphql')) return 'graphql_tools';
          if (context.fileTypes?.includes('.jsx') || context.fileTypes?.includes('.html')) return 'ui_tools';
          if (context.scope === 'security') return 'security_tools';
          return 'standard_tools';
        },
        branches: {
          'graphql_tools': {
            tools: ['check_graphql_schema', 'check_graphql_query'],
            additional: ['check_code_practices'],
          },
          'ui_tools': {
            tools: ['check_accessibility', 'check_code_practices'],
            additional: ['format_code'],
          },
          'security_tools': {
            tools: ['scan_security_vulnerabilities', 'check_production_readiness'],
            additional: ['check_safety_rules'],
          },
          'standard_tools': {
            tools: ['check_code_practices', 'format_code'],
            additional: ['check_production_readiness'],
          },
        },
        terminal: true,
      },
    };

    // Decision history for learning
    this.decisionHistory = [];
    this.maxHistorySize = 500;

    // Confidence adjustments based on history
    this.confidenceAdjustments = new Map();
  }

  /**
   * Make a decision based on context
   */
  async makeDecision(context, decisionType = 'root') {
    const decisionPath = [];
    let currentNode = this.decisionNodes[decisionType];
    let depth = 0;
    const maxDepth = 10;

    while (currentNode && depth < maxDepth) {
      depth++;

      // Evaluate the node
      const evaluation = await this.evaluateNode(currentNode, context);
      
      // Record the decision
      decisionPath.push({
        node: currentNode.name,
        condition: currentNode.condition.toString(),
        result: evaluation.result,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        timestamp: Date.now(),
      });

      // If terminal node or no valid branch, stop
      if (currentNode.terminal || !currentNode.branches[evaluation.result]) {
        break;
      }

      // Move to next node
      const nextNodeId = currentNode.branches[evaluation.result];
      
      // Check if next node is a decision object (terminal)
      if (typeof nextNodeId === 'object') {
        decisionPath.push({
          node: 'terminal_decision',
          result: nextNodeId,
          confidence: evaluation.confidence,
          reasoning: 'Reached terminal decision',
          timestamp: Date.now(),
        });
        break;
      }

      currentNode = this.decisionNodes[nextNodeId];
    }

    // Generate final decision
    const decision = this.generateDecision(decisionPath, context);
    
    // Record in history
    this.recordDecision(decision);

    return decision;
  }

  /**
   * Evaluate a decision node
   */
  async evaluateNode(node, context) {
    try {
      // Execute condition function
      const result = await node.condition(context);
      
      // Calculate confidence
      const baseConfidence = node.confidence_threshold || 0.7;
      const adjustedConfidence = this.adjustConfidence(node.name, baseConfidence, context);
      
      // Generate reasoning
      const reasoning = this.generateNodeReasoning(node, result, context);

      return {
        result,
        confidence: adjustedConfidence,
        reasoning,
      };
    } catch (error) {
      return {
        result: 'error',
        confidence: 0,
        reasoning: `Error evaluating node: ${error.message}`,
        error: true,
      };
    }
  }

  /**
   * Generate final decision from path
   */
  generateDecision(decisionPath, context) {
    const lastDecision = decisionPath[decisionPath.length - 1];
    const terminalResult = lastDecision.result;

    // Extract actions and tools from terminal decision
    let actions = [];
    let tools = [];
    let priority = 'medium';
    let notifications = [];

    if (typeof terminalResult === 'object') {
      actions = terminalResult.actions || [];
      tools = terminalResult.tools || [];
      priority = terminalResult.priority || 'medium';
      notifications = terminalResult.notify || [];
      
      // Add additional tools if specified
      if (terminalResult.additional) {
        tools.push(...terminalResult.additional);
      }
    }

    // Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(decisionPath);

    return {
      decision: lastDecision.node,
      path: decisionPath,
      actions,
      tools: [...new Set(tools)], // Remove duplicates
      priority,
      notifications,
      confidence: overallConfidence,
      reasoning: this.generateDecisionReasoning(decisionPath),
      recommendations: this.generateRecommendations(terminalResult, context),
      timestamp: Date.now(),
    };
  }

  /**
   * Analyze task indicators
   */
  analyzeTaskIndicators(context) {
    const indicators = {
      bug_fix: 0,
      feature_development: 0,
      refactoring: 0,
      optimization: 0,
      review: 0,
    };

    // Analyze goals and descriptions
    const text = (context.goals || []).join(' ').toLowerCase();
    
    // Bug fix indicators
    if (text.includes('fix') || text.includes('bug') || text.includes('error')) {
      indicators.bug_fix += 3;
    }
    if (text.includes('broken') || text.includes('crash') || text.includes('fail')) {
      indicators.bug_fix += 2;
    }

    // Feature indicators
    if (text.includes('add') || text.includes('implement') || text.includes('feature')) {
      indicators.feature_development += 3;
    }
    if (text.includes('new') || text.includes('create') || text.includes('build')) {
      indicators.feature_development += 2;
    }

    // Refactoring indicators
    if (text.includes('refactor') || text.includes('clean') || text.includes('improve')) {
      indicators.refactoring += 3;
    }
    if (text.includes('restructure') || text.includes('reorganize')) {
      indicators.refactoring += 2;
    }

    // Optimization indicators
    if (text.includes('optimize') || text.includes('performance') || text.includes('speed')) {
      indicators.optimization += 3;
    }
    if (text.includes('efficient') || text.includes('faster')) {
      indicators.optimization += 2;
    }

    // Review indicators
    if (text.includes('review') || text.includes('check') || text.includes('audit')) {
      indicators.review += 3;
    }

    // Find most likely
    let mostLikely = 'feature_development';
    let highestScore = 0;
    
    for (const [type, score] of Object.entries(indicators)) {
      if (score > highestScore) {
        highestScore = score;
        mostLikely = type;
      }
    }

    return {
      indicators,
      mostLikely,
      confidence: highestScore > 0 ? Math.min(highestScore / 5, 1) : 0.3,
    };
  }

  /**
   * Assess bug severity
   */
  assessBugSeverity(context) {
    if (context.error?.includes('crash') || context.error?.includes('data loss')) {
      return 'critical';
    }
    if (context.error?.includes('security') || context.affectedUsers > 1000) {
      return 'high';
    }
    if (context.functionalityBroken) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Assess feature complexity
   */
  assessFeatureComplexity(context) {
    let complexity = 0;

    // File count
    if (context.estimatedFiles > 10) complexity += 3;
    else if (context.estimatedFiles > 5) complexity += 2;
    else complexity += 1;

    // Dependencies
    if (context.requiresNewDependencies) complexity += 2;
    if (context.affectsExistingAPIs) complexity += 2;

    // Testing requirements
    if (context.requiresIntegrationTests) complexity += 1;
    if (context.requiresE2ETests) complexity += 1;

    // Determine level
    if (complexity >= 7) return 'high';
    if (complexity >= 4) return 'medium';
    return 'low';
  }

  /**
   * Adjust confidence based on history
   */
  adjustConfidence(nodeName, baseConfidence, context) {
    // Get historical success rate for this node
    const key = `${nodeName}_${context.taskType || 'unknown'}`;
    const adjustment = this.confidenceAdjustments.get(key) || 0;
    
    // Apply adjustment
    const adjusted = baseConfidence + adjustment;
    
    // Ensure within bounds
    return Math.max(0.1, Math.min(0.99, adjusted));
  }

  /**
   * Generate reasoning for node evaluation
   */
  generateNodeReasoning(node, result, context) {
    const reasons = [];

    // Node-specific reasoning
    switch (node.name) {
      case 'task_type_decision':
        reasons.push(`Identified task type as ${result} based on context`);
        break;
      
      case 'bug_fix_severity':
        reasons.push(`Bug severity assessed as ${result}`);
        if (context.affectedUsers) {
          reasons.push(`Affects ${context.affectedUsers} users`);
        }
        break;
      
      case 'feature_complexity':
        reasons.push(`Feature complexity determined to be ${result}`);
        if (context.estimatedFiles) {
          reasons.push(`Estimated to affect ${context.estimatedFiles} files`);
        }
        break;
      
      case 'code_quality_analysis':
        reasons.push(`Code quality is ${result}`);
        if (context.analysis?.qualityScore) {
          reasons.push(`Quality score: ${context.analysis.qualityScore}`);
        }
        break;
    }

    return reasons.join('. ');
  }

  /**
   * Calculate overall confidence
   */
  calculateOverallConfidence(decisionPath) {
    if (decisionPath.length === 0) return 0;

    // Calculate weighted average based on depth
    let totalWeight = 0;
    let weightedSum = 0;

    decisionPath.forEach((decision, index) => {
      const weight = 1 / (index + 1); // Earlier decisions have more weight
      totalWeight += weight;
      weightedSum += decision.confidence * weight;
    });

    return weightedSum / totalWeight;
  }

  /**
   * Generate decision reasoning
   */
  generateDecisionReasoning(decisionPath) {
    const keyDecisions = decisionPath
      .filter(d => d.confidence > 0.7)
      .map(d => `${d.node}: ${d.result} (${Math.round(d.confidence * 100)}% confidence)`)
      .join(' → ');

    return `Decision path: ${keyDecisions}`;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(terminalResult, context) {
    const recommendations = [];

    if (terminalResult?.priority === 'critical') {
      recommendations.push('Focus on critical items first');
      recommendations.push('Minimize scope to essential changes only');
    }

    if (terminalResult?.tools?.includes('scan_security_vulnerabilities')) {
      recommendations.push('Pay special attention to security findings');
    }

    if (context.firstTime) {
      recommendations.push('Consider creating a backup before making changes');
    }

    return recommendations;
  }

  /**
   * Record decision in history
   */
  recordDecision(decision) {
    this.decisionHistory.push({
      ...decision,
      timestamp: Date.now(),
    });

    // Maintain max size
    if (this.decisionHistory.length > this.maxHistorySize) {
      this.decisionHistory.shift();
    }
  }

  /**
   * Learn from decision outcomes
   */
  learnFromOutcome(decisionId, outcome) {
    const decision = this.decisionHistory.find(d => 
      Math.abs(d.timestamp - decisionId) < 1000
    );

    if (!decision) return;

    // Update confidence adjustments based on outcome
    decision.path.forEach(step => {
      const key = `${step.node}_${step.result}`;
      const current = this.confidenceAdjustments.get(key) || 0;
      
      if (outcome.success) {
        // Increase confidence for successful paths
        this.confidenceAdjustments.set(key, Math.min(current + 0.02, 0.2));
      } else {
        // Decrease confidence for failed paths
        this.confidenceAdjustments.set(key, Math.max(current - 0.05, -0.2));
      }
    });
  }

  /**
   * Get decision statistics
   */
  getDecisionStats() {
    const stats = {
      totalDecisions: this.decisionHistory.length,
      decisionTypes: {},
      averageConfidence: 0,
      averagePathLength: 0,
    };

    if (this.decisionHistory.length === 0) return stats;

    let totalConfidence = 0;
    let totalPathLength = 0;

    this.decisionHistory.forEach(decision => {
      // Count decision types
      const type = decision.decision;
      stats.decisionTypes[type] = (stats.decisionTypes[type] || 0) + 1;
      
      // Sum confidence and path length
      totalConfidence += decision.confidence;
      totalPathLength += decision.path.length;
    });

    stats.averageConfidence = totalConfidence / this.decisionHistory.length;
    stats.averagePathLength = totalPathLength / this.decisionHistory.length;

    return stats;
  }

  /**
   * Export decision tree for visualization
   */
  exportTree() {
    const nodes = [];
    const edges = [];

    // Convert nodes
    for (const [id, node] of Object.entries(this.decisionNodes)) {
      nodes.push({
        id,
        label: node.name,
        type: node.terminal ? 'terminal' : 'decision',
      });

      // Add edges
      if (node.branches) {
        for (const [condition, target] of Object.entries(node.branches)) {
          if (typeof target === 'string') {
            edges.push({
              from: id,
              to: target,
              label: condition,
            });
          }
        }
      }
    }

    return { nodes, edges };
  }
}