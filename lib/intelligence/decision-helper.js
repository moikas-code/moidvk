/**
 * Decision Helper for smart development recommendations
 * Provides intelligent suggestions based on context and patterns
 */
export class DecisionHelper {
  constructor() {
    // Decision rules for different scenarios
    this.decisionRules = {
      toolSelection: {
        fileType: {
          '.js': ['check_code_practices', 'format_code', 'check_safety_rules'],
          '.jsx': ['check_code_practices', 'format_code', 'check_accessibility'],
          '.ts': ['check_code_practices', 'format_code', 'check_safety_rules'],
          '.tsx': ['check_code_practices', 'format_code', 'check_accessibility'],
          '.graphql': ['check_graphql_schema', 'check_graphql_query'],
          '.html': ['check_accessibility'],
          '.css': ['format_code'],
        },
        taskType: {
          'bug_fix': {
            priority: ['search_in_files', 'check_code_practices', 'format_code'],
            optional: ['check_production_readiness'],
          },
          'feature_development': {
            priority: ['check_code_practices', 'format_code', 'check_safety_rules'],
            optional: ['check_accessibility', 'scan_security_vulnerabilities'],
          },
          'refactoring': {
            priority: ['check_code_practices', 'search_files', 'format_code'],
            optional: ['check_production_readiness', 'check_safety_rules'],
          },
          'optimization': {
            priority: ['check_code_practices', 'check_production_readiness'],
            optional: ['scan_security_vulnerabilities'],
          },
        },
      },
      
      fixPriority: {
        security: 1,
        safety: 2,
        functionality: 3,
        performance: 4,
        style: 5,
      },
    };

    // Recommendation templates
    this.recommendationTemplates = {
      highSeverityIssue: {
        template: 'Critical {issueType} found in {location}. Immediate action required: {action}',
        priority: 'critical',
      },
      codeQualityImprovement: {
        template: 'Code quality can be improved by {action}. This will enhance {benefits}',
        priority: 'medium',
      },
      performanceOptimization: {
        template: 'Performance optimization opportunity: {action}. Expected improvement: {impact}',
        priority: 'low',
      },
    };

    // Decision history for learning
    this.decisionHistory = [];
    this.feedbackData = new Map();
  }

  /**
   * Make tool selection decision
   */
  async recommendTools(context) {
    const recommendations = [];
    const { files = [], taskType, urgency, patterns = [] } = context;
    
    // Get base recommendations from task type
    if (taskType && this.decisionRules.toolSelection.taskType[taskType]) {
      const taskTools = this.decisionRules.toolSelection.taskType[taskType];
      
      // Add priority tools
      for (const tool of taskTools.priority) {
        recommendations.push({
          tool,
          reason: `Essential for ${taskType}`,
          priority: 'high',
          confidence: 0.9,
        });
      }
      
      // Add optional tools based on context
      if (urgency !== 'critical') {
        for (const tool of taskTools.optional) {
          recommendations.push({
            tool,
            reason: `Recommended for thorough ${taskType}`,
            priority: 'medium',
            confidence: 0.7,
          });
        }
      }
    }
    
    // Add file-specific tools
    for (const file of files) {
      const ext = this.getFileExtension(file);
      if (this.decisionRules.toolSelection.fileType[ext]) {
        for (const tool of this.decisionRules.toolSelection.fileType[ext]) {
          if (!recommendations.find(r => r.tool === tool)) {
            recommendations.push({
              tool,
              reason: `Appropriate for ${ext} files`,
              priority: 'medium',
              confidence: 0.8,
            });
          }
        }
      }
    }
    
    // Adjust based on detected patterns
    this.adjustForPatterns(recommendations, patterns);
    
    // Sort by priority and confidence
    recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.confidence - a.confidence;
    });
    
    return {
      recommendations: recommendations.slice(0, 10), // Top 10
      reasoning: this.explainRecommendations(recommendations, context),
    };
  }

  /**
   * Recommend next actions based on current state
   */
  async recommendNextActions(context, previousResults = []) {
    const actions = [];
    
    // Analyze previous results for issues
    const issues = this.extractIssues(previousResults);
    
    // Prioritize fixes
    const prioritizedIssues = this.prioritizeIssues(issues);
    
    // Generate action recommendations
    for (const issue of prioritizedIssues.slice(0, 5)) {
      const action = this.generateActionForIssue(issue, context);
      if (action) {
        actions.push(action);
      }
    }
    
    // Add proactive recommendations
    const proactiveActions = this.generateProactiveActions(context);
    actions.push(...proactiveActions);
    
    // Remove duplicates and sort
    const uniqueActions = this.deduplicateActions(actions);
    
    return {
      actions: uniqueActions,
      summary: this.summarizeActions(uniqueActions),
      estimatedTime: this.estimateActionTime(uniqueActions),
    };
  }

  /**
   * Decide on workflow approach
   */
  decideWorkflowApproach(context) {
    const { urgency, scope, experience, goals } = context;
    
    let approach = {
      strategy: 'balanced',
      pace: 'moderate',
      validation: 'standard',
      toolDepth: 'normal',
    };
    
    // Adjust for urgency
    if (urgency === 'critical') {
      approach.strategy = 'focused';
      approach.pace = 'rapid';
      approach.validation = 'minimal';
      approach.toolDepth = 'shallow';
    } else if (urgency === 'low') {
      approach.strategy = 'comprehensive';
      approach.pace = 'thorough';
      approach.validation = 'extensive';
      approach.toolDepth = 'deep';
    }
    
    // Adjust for scope
    if (scope === 'system') {
      approach.strategy = 'systematic';
      approach.validation = 'extensive';
    } else if (scope === 'single_file') {
      approach.strategy = 'focused';
      approach.pace = 'rapid';
    }
    
    // Generate specific recommendations
    const recommendations = this.generateWorkflowRecommendations(approach, context);
    
    return {
      approach,
      recommendations,
      rationale: this.explainApproach(approach, context),
    };
  }

  /**
   * Provide decision support for complex scenarios
   */
  async provideDecisionSupport(scenario, options = []) {
    const analysis = {
      scenario,
      options: [],
      recommendation: null,
      confidence: 0,
    };
    
    // Analyze each option
    for (const option of options) {
      const evaluation = await this.evaluateOption(option, scenario);
      analysis.options.push({
        ...option,
        evaluation,
        score: this.calculateOptionScore(evaluation),
      });
    }
    
    // Sort by score
    analysis.options.sort((a, b) => b.score - a.score);
    
    // Make recommendation
    if (analysis.options.length > 0) {
      const best = analysis.options[0];
      analysis.recommendation = {
        choice: best.name,
        reason: this.explainChoice(best, analysis.options),
        confidence: this.calculateConfidence(best, analysis.options),
      };
      analysis.confidence = analysis.recommendation.confidence;
    }
    
    return analysis;
  }

  /**
   * Learn from feedback
   */
  recordFeedback(decision, outcome) {
    // Record decision outcome
    this.decisionHistory.push({
      timestamp: Date.now(),
      decision,
      outcome,
      success: outcome.success || false,
    });
    
    // Update feedback data
    const key = `${decision.type}_${decision.choice}`;
    const feedback = this.feedbackData.get(key) || {
      total: 0,
      successful: 0,
      failed: 0,
    };
    
    feedback.total++;
    if (outcome.success) {
      feedback.successful++;
    } else {
      feedback.failed++;
    }
    
    this.feedbackData.set(key, feedback);
    
    // Adjust future recommendations based on feedback
    this.adjustRecommendations();
  }

  /**
   * Helper methods
   */

  getFileExtension(filePath) {
    const parts = filePath.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }

  adjustForPatterns(recommendations, patterns) {
    // Boost security tools if security patterns detected
    if (patterns.some(p => p.category === 'security')) {
      const securityTool = recommendations.find(r => 
        r.tool === 'scan_security_vulnerabilities'
      );
      if (securityTool) {
        securityTool.priority = 'high';
        securityTool.confidence = 0.95;
      }
    }
    
    // Boost formatting if style issues detected
    if (patterns.some(p => p.type === 'style')) {
      const formatTool = recommendations.find(r => r.tool === 'format_code');
      if (formatTool) {
        formatTool.priority = 'high';
        formatTool.confidence = 0.9;
      }
    }
  }

  explainRecommendations(recommendations, context) {
    const reasons = [];
    
    if (context.taskType) {
      reasons.push(`Optimized for ${context.taskType} workflow`);
    }
    
    if (context.urgency === 'critical') {
      reasons.push('Focused on critical tools due to urgency');
    }
    
    const fileTypes = new Set(context.files?.map(f => this.getFileExtension(f)) || []);
    if (fileTypes.size > 0) {
      reasons.push(`Tools selected for ${Array.from(fileTypes).join(', ')} files`);
    }
    
    return reasons.join('. ');
  }

  extractIssues(results) {
    const issues = [];
    
    for (const result of results) {
      if (result.issues) {
        issues.push(...result.issues.map(issue => ({
          ...issue,
          source: result.tool,
          timestamp: result.timestamp,
        })));
      }
    }
    
    return issues;
  }

  prioritizeIssues(issues) {
    return issues.sort((a, b) => {
      // Priority by type
      const typePriority = this.decisionRules.fixPriority;
      const aPriority = typePriority[a.type] || 999;
      const bPriority = typePriority[b.type] || 999;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      
      // Then by severity
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return (severityOrder[a.severity] || 999) - (severityOrder[b.severity] || 999);
    });
  }

  generateActionForIssue(issue, context) {
    const templates = {
      security: 'Fix security vulnerability: {description}',
      safety: 'Address safety issue: {description}',
      functionality: 'Fix functional bug: {description}',
      performance: 'Optimize performance: {description}',
      style: 'Improve code style: {description}',
    };
    
    const template = templates[issue.type] || 'Fix issue: {description}';
    const description = template.replace('{description}', issue.message || issue.description);
    
    return {
      type: 'fix',
      target: issue,
      description,
      priority: issue.severity || 'medium',
      estimatedEffort: this.estimateEffort(issue),
      tool: this.suggestToolForFix(issue),
    };
  }

  generateProactiveActions(context) {
    const actions = [];
    
    // Suggest testing if no tests run recently
    if (!context.recentTools?.includes('test')) {
      actions.push({
        type: 'validation',
        description: 'Run tests to ensure changes work correctly',
        priority: 'medium',
        estimatedEffort: 'low',
      });
    }
    
    // Suggest documentation if complex changes
    if (context.filesModified > 5) {
      actions.push({
        type: 'documentation',
        description: 'Update documentation to reflect changes',
        priority: 'low',
        estimatedEffort: 'medium',
      });
    }
    
    return actions;
  }

  deduplicateActions(actions) {
    const seen = new Set();
    const unique = [];
    
    for (const action of actions) {
      const key = `${action.type}_${action.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(action);
      }
    }
    
    return unique;
  }

  summarizeActions(actions) {
    const summary = {
      total: actions.length,
      byType: {},
      byPriority: {},
    };
    
    for (const action of actions) {
      summary.byType[action.type] = (summary.byType[action.type] || 0) + 1;
      summary.byPriority[action.priority] = (summary.byPriority[action.priority] || 0) + 1;
    }
    
    return summary;
  }

  estimateActionTime(actions) {
    const effortMap = {
      low: 5,
      medium: 15,
      high: 30,
    };
    
    let totalMinutes = 0;
    for (const action of actions) {
      totalMinutes += effortMap[action.estimatedEffort] || 10;
    }
    
    return {
      minutes: totalMinutes,
      formatted: totalMinutes < 60 ? `${totalMinutes}m` : `${Math.round(totalMinutes / 60)}h`,
    };
  }

  estimateEffort(issue) {
    if (issue.severity === 'critical' || issue.type === 'security') {
      return 'high';
    }
    if (issue.type === 'style' || issue.severity === 'low') {
      return 'low';
    }
    return 'medium';
  }

  suggestToolForFix(issue) {
    const toolMap = {
      security: 'scan_security_vulnerabilities',
      style: 'format_code',
      accessibility: 'check_accessibility',
      graphql: 'check_graphql_schema',
      redux: 'check_redux_patterns',
    };
    
    return toolMap[issue.type] || 'check_code_practices';
  }

  generateWorkflowRecommendations(approach, context) {
    const recommendations = [];
    
    if (approach.strategy === 'focused') {
      recommendations.push('Focus on critical issues first');
      recommendations.push('Skip optional validations');
    } else if (approach.strategy === 'comprehensive') {
      recommendations.push('Run all available checks');
      recommendations.push('Document findings thoroughly');
    }
    
    if (approach.pace === 'rapid') {
      recommendations.push('Use quick validation tools');
      recommendations.push('Batch similar changes together');
    } else if (approach.pace === 'thorough') {
      recommendations.push('Review each change carefully');
      recommendations.push('Create checkpoints frequently');
    }
    
    return recommendations;
  }

  explainApproach(approach, context) {
    const explanations = [];
    
    explanations.push(`Selected ${approach.strategy} strategy based on ${context.urgency || 'normal'} urgency`);
    explanations.push(`${approach.pace} pace appropriate for ${context.scope || 'module'} scope`);
    
    if (approach.validation === 'extensive') {
      explanations.push('Extensive validation recommended for quality assurance');
    }
    
    return explanations.join('. ');
  }

  async evaluateOption(option, scenario) {
    return {
      pros: option.pros || [],
      cons: option.cons || [],
      risks: this.assessRisks(option, scenario),
      benefits: this.assessBenefits(option, scenario),
      complexity: this.assessComplexity(option),
    };
  }

  calculateOptionScore(evaluation) {
    let score = 50; // Base score
    
    score += evaluation.benefits.length * 10;
    score -= evaluation.risks.length * 15;
    score += evaluation.pros.length * 5;
    score -= evaluation.cons.length * 5;
    score -= evaluation.complexity * 10;
    
    return Math.max(0, Math.min(100, score));
  }

  explainChoice(best, allOptions) {
    const reasons = [];
    
    if (best.score > 80) {
      reasons.push('Clear best choice based on analysis');
    } else if (best.score > 60) {
      reasons.push('Recommended option with good balance of benefits and risks');
    } else {
      reasons.push('Best available option among limited choices');
    }
    
    const margin = allOptions.length > 1 ? best.score - allOptions[1].score : 0;
    if (margin > 20) {
      reasons.push('Significantly better than alternatives');
    } else if (margin < 5) {
      reasons.push('Close decision - consider specific context');
    }
    
    return reasons.join('. ');
  }

  calculateConfidence(best, allOptions) {
    const margin = allOptions.length > 1 ? best.score - allOptions[1].score : 50;
    const baseConfidence = best.score / 100;
    const marginBonus = margin / 100;
    
    return Math.min(0.95, baseConfidence * 0.7 + marginBonus * 0.3);
  }

  assessRisks(option, scenario) {
    const risks = [];
    
    if (option.requiresRefactoring) {
      risks.push('May introduce bugs during refactoring');
    }
    if (option.breakingChange) {
      risks.push('Breaking change requires coordination');
    }
    if (option.performanceImpact) {
      risks.push('Potential performance impact');
    }
    
    return risks;
  }

  assessBenefits(option, scenario) {
    const benefits = [];
    
    if (option.improvesPerformance) {
      benefits.push('Performance improvement');
    }
    if (option.enhancesSecurity) {
      benefits.push('Enhanced security');
    }
    if (option.improvesMaintainability) {
      benefits.push('Better maintainability');
    }
    
    return benefits;
  }

  assessComplexity(option) {
    let complexity = 0;
    
    if (option.requiresRefactoring) complexity += 2;
    if (option.requiresNewDependencies) complexity += 1;
    if (option.affectsMultipleFiles) complexity += 1;
    if (option.requiresDataMigration) complexity += 3;
    
    return Math.min(10, complexity);
  }

  adjustRecommendations() {
    // Analyze feedback data to improve future recommendations
    const insights = [];
    
    this.feedbackData.forEach((feedback, key) => {
      const successRate = feedback.successful / feedback.total;
      if (successRate < 0.3 && feedback.total > 5) {
        insights.push({
          type: 'poor_performance',
          key,
          successRate,
          recommendation: 'Deprioritize this option',
        });
      } else if (successRate > 0.8 && feedback.total > 5) {
        insights.push({
          type: 'high_performance',
          key,
          successRate,
          recommendation: 'Prioritize this option',
        });
      }
    });
    
    return insights;
  }
}