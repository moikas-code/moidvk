/**
 * Feedback Loop for learning from development patterns
 * Tracks outcomes and adjusts recommendations based on success/failure
 */
export class FeedbackLoop {
  constructor() {
    // Pattern success tracking
    this.patternOutcomes = new Map();
    
    // Tool effectiveness tracking
    this.toolEffectiveness = new Map();
    
    // Workflow success rates
    this.workflowMetrics = new Map();
    
    // Learning parameters
    this.learningRate = 0.1;
    this.decayFactor = 0.95; // Decay old feedback over time
    this.minSampleSize = 5; // Minimum samples before considering feedback
    
    // Feedback history
    this.feedbackHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Record pattern outcome
   */
  recordPatternOutcome(pattern, outcome) {
    const key = `${pattern.type}_${pattern.name}`;
    const data = this.patternOutcomes.get(key) || {
      successes: 0,
      failures: 0,
      totalTime: 0,
      avgComplexity: 0,
      contexts: new Map(),
    };

    if (outcome.success) {
      data.successes++;
    } else {
      data.failures++;
    }

    data.totalTime += outcome.duration || 0;
    
    // Track context-specific outcomes
    const contextKey = outcome.context || 'default';
    const contextData = data.contexts.get(contextKey) || { successes: 0, failures: 0 };
    if (outcome.success) {
      contextData.successes++;
    } else {
      contextData.failures++;
    }
    data.contexts.set(contextKey, contextData);

    this.patternOutcomes.set(key, data);
    
    // Record in history
    this.addToHistory({
      type: 'pattern',
      pattern: key,
      outcome,
      timestamp: Date.now(),
    });

    return this.calculatePatternScore(key);
  }

  /**
   * Record tool effectiveness
   */
  recordToolEffectiveness(tool, context, metrics) {
    const key = `${tool}_${context.taskType || 'general'}`;
    const data = this.toolEffectiveness.get(key) || {
      uses: 0,
      totalDuration: 0,
      avgDuration: 0,
      errorRate: 0,
      successMetrics: [],
      issuesFound: 0,
      issuesFixed: 0,
    };

    data.uses++;
    data.totalDuration += metrics.duration || 0;
    data.avgDuration = data.totalDuration / data.uses;
    
    if (metrics.error) {
      data.errorRate = ((data.errorRate * (data.uses - 1)) + 1) / data.uses;
    } else {
      data.errorRate = (data.errorRate * (data.uses - 1)) / data.uses;
    }

    if (metrics.issuesFound) {
      data.issuesFound += metrics.issuesFound;
    }
    if (metrics.issuesFixed) {
      data.issuesFixed += metrics.issuesFixed;
    }

    data.successMetrics.push({
      timestamp: Date.now(),
      duration: metrics.duration,
      quality: metrics.qualityScore || null,
      issues: metrics.issuesFound || 0,
    });

    // Keep only recent metrics
    if (data.successMetrics.length > 100) {
      data.successMetrics = data.successMetrics.slice(-100);
    }

    this.toolEffectiveness.set(key, data);
    
    // Record in history
    this.addToHistory({
      type: 'tool',
      tool,
      context: context.taskType,
      metrics,
      timestamp: Date.now(),
    });

    return this.calculateToolScore(key);
  }

  /**
   * Record workflow outcome
   */
  recordWorkflowOutcome(workflow, outcome) {
    const key = workflow.type;
    const data = this.workflowMetrics.get(key) || {
      attempts: 0,
      successes: 0,
      averageDuration: 0,
      averageQualityImprovement: 0,
      commonIssues: new Map(),
      toolSequences: new Map(),
    };

    data.attempts++;
    if (outcome.success) {
      data.successes++;
    }

    // Update average duration
    data.averageDuration = ((data.averageDuration * (data.attempts - 1)) + outcome.duration) / data.attempts;

    // Track quality improvement
    if (outcome.qualityBefore && outcome.qualityAfter) {
      const improvement = outcome.qualityAfter - outcome.qualityBefore;
      data.averageQualityImprovement = 
        ((data.averageQualityImprovement * (data.attempts - 1)) + improvement) / data.attempts;
    }

    // Track common issues
    if (outcome.issues) {
      for (const issue of outcome.issues) {
        const count = data.commonIssues.get(issue) || 0;
        data.commonIssues.set(issue, count + 1);
      }
    }

    // Track successful tool sequences
    if (outcome.success && workflow.toolSequence) {
      const sequenceKey = workflow.toolSequence.join('->');
      const count = data.toolSequences.get(sequenceKey) || 0;
      data.toolSequences.set(sequenceKey, count + 1);
    }

    this.workflowMetrics.set(key, data);
    
    // Apply learning
    this.applyLearning(workflow, outcome);
    
    return {
      successRate: data.successes / data.attempts,
      recommendations: this.generateWorkflowRecommendations(key),
    };
  }

  /**
   * Apply learning from feedback
   */
  applyLearning(workflow, outcome) {
    // Adjust pattern weights based on outcome
    if (workflow.patterns) {
      for (const pattern of workflow.patterns) {
        const adjustment = outcome.success ? this.learningRate : -this.learningRate;
        this.adjustPatternWeight(pattern, adjustment);
      }
    }

    // Adjust tool preferences based on effectiveness
    if (workflow.toolSequence) {
      for (const tool of workflow.toolSequence) {
        const effectiveness = outcome.toolResults?.[tool];
        if (effectiveness) {
          this.adjustToolPreference(tool, effectiveness);
        }
      }
    }
  }

  /**
   * Calculate pattern score
   */
  calculatePatternScore(patternKey) {
    const data = this.patternOutcomes.get(patternKey);
    if (!data || data.successes + data.failures < this.minSampleSize) {
      return 0.5; // Neutral score for insufficient data
    }

    const successRate = data.successes / (data.successes + data.failures);
    const avgTime = data.totalTime / (data.successes + data.failures);
    const timeScore = 1 / (1 + avgTime / 60000); // Normalize to minutes

    // Weighted score
    return (successRate * 0.7) + (timeScore * 0.3);
  }

  /**
   * Calculate tool score
   */
  calculateToolScore(toolKey) {
    const data = this.toolEffectiveness.get(toolKey);
    if (!data || data.uses < this.minSampleSize) {
      return 0.5; // Neutral score for insufficient data
    }

    const reliabilityScore = 1 - data.errorRate;
    const speedScore = 1 / (1 + data.avgDuration / 5000); // Normalize to 5 seconds
    const effectivenessScore = data.issuesFixed / Math.max(1, data.issuesFound);

    // Weighted score
    return (reliabilityScore * 0.4) + (speedScore * 0.3) + (effectivenessScore * 0.3);
  }

  /**
   * Get recommendations based on feedback
   */
  getRecommendations(context) {
    const recommendations = [];

    // Pattern-based recommendations
    const relevantPatterns = this.getRelevantPatterns(context);
    for (const [pattern, score] of relevantPatterns) {
      if (score > 0.7) {
        recommendations.push({
          type: 'pattern',
          pattern,
          confidence: score,
          reason: 'High success rate in similar contexts',
        });
      }
    }

    // Tool-based recommendations
    const toolRecommendations = this.getToolRecommendations(context);
    recommendations.push(...toolRecommendations);

    // Workflow-based recommendations
    const workflowRecommendations = this.getWorkflowRecommendations(context);
    recommendations.push(...workflowRecommendations);

    // Sort by confidence
    return recommendations.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get relevant patterns for context
   */
  getRelevantPatterns(context) {
    const relevant = [];
    
    this.patternOutcomes.forEach((data, pattern) => {
      // Check if pattern has context-specific data
      const contextData = data.contexts.get(context.taskType || 'default');
      if (contextData && contextData.successes + contextData.failures >= this.minSampleSize) {
        const score = contextData.successes / (contextData.successes + contextData.failures);
        relevant.push([pattern, score]);
      } else if (data.successes + data.failures >= this.minSampleSize) {
        // Fall back to overall score
        const score = this.calculatePatternScore(pattern);
        relevant.push([pattern, score * 0.8]); // Slightly lower confidence
      }
    });

    return relevant;
  }

  /**
   * Get tool recommendations
   */
  getToolRecommendations(context) {
    const recommendations = [];
    
    this.toolEffectiveness.forEach((data, toolKey) => {
      const [tool, taskType] = toolKey.split('_');
      
      // Check relevance
      if (taskType === context.taskType || taskType === 'general') {
        const score = this.calculateToolScore(toolKey);
        if (score > 0.6) {
          recommendations.push({
            type: 'tool',
            tool,
            confidence: score,
            reason: `Effective for ${taskType} tasks (${Math.round(score * 100)}% score)`,
            avgDuration: data.avgDuration,
          });
        }
      }
    });

    return recommendations;
  }

  /**
   * Get workflow recommendations
   */
  getWorkflowRecommendations(context) {
    const recommendations = [];
    
    this.workflowMetrics.forEach((data, workflow) => {
      if (data.attempts >= this.minSampleSize) {
        const successRate = data.successes / data.attempts;
        
        if (successRate > 0.7) {
          // Find best tool sequence
          let bestSequence = null;
          let bestCount = 0;
          
          data.toolSequences.forEach((count, sequence) => {
            if (count > bestCount) {
              bestCount = count;
              bestSequence = sequence;
            }
          });

          recommendations.push({
            type: 'workflow',
            workflow,
            confidence: successRate,
            reason: `${Math.round(successRate * 100)}% success rate`,
            bestSequence,
            avgDuration: data.averageDuration,
            qualityImprovement: data.averageQualityImprovement,
          });
        }
      }
    });

    return recommendations;
  }

  /**
   * Generate workflow-specific recommendations
   */
  generateWorkflowRecommendations(workflowKey) {
    const data = this.workflowMetrics.get(workflowKey);
    if (!data || data.attempts < this.minSampleSize) {
      return [];
    }

    const recommendations = [];

    // Recommend best tool sequence
    if (data.toolSequences.size > 0) {
      const [bestSequence] = Array.from(data.toolSequences.entries())
        .sort(([, a], [, b]) => b - a)[0];
      recommendations.push(`Use tool sequence: ${bestSequence}`);
    }

    // Warn about common issues
    if (data.commonIssues.size > 0) {
      const topIssues = Array.from(data.commonIssues.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([issue]) => issue);
      recommendations.push(`Watch for: ${topIssues.join(', ')}`);
    }

    // Suggest improvements
    if (data.averageQualityImprovement < 5) {
      recommendations.push('Consider more thorough analysis phase');
    }

    return recommendations;
  }

  /**
   * Adjust pattern weight
   */
  adjustPatternWeight(pattern, adjustment) {
    // This would update internal weights used for recommendations
    // For now, just track the adjustment
    const key = `${pattern.type}_${pattern.name}`;
    const current = this.patternOutcomes.get(key);
    if (current) {
      // Apply adjustment logic here
    }
  }

  /**
   * Adjust tool preference
   */
  adjustToolPreference(tool, effectiveness) {
    // Update tool preference based on effectiveness
    // This influences future tool recommendations
  }

  /**
   * Add to feedback history
   */
  addToHistory(entry) {
    this.feedbackHistory.push(entry);
    
    // Maintain max size
    if (this.feedbackHistory.length > this.maxHistorySize) {
      this.feedbackHistory.shift();
    }
  }

  /**
   * Apply decay to old feedback
   */
  applyDecay() {
    // Decay pattern outcomes
    this.patternOutcomes.forEach((data, key) => {
      data.successes *= this.decayFactor;
      data.failures *= this.decayFactor;
    });

    // Decay tool effectiveness
    this.toolEffectiveness.forEach((data, key) => {
      data.uses = Math.floor(data.uses * this.decayFactor);
      data.errorRate *= this.decayFactor;
    });

    // Decay workflow metrics
    this.workflowMetrics.forEach((data, key) => {
      data.attempts = Math.floor(data.attempts * this.decayFactor);
      data.successes = Math.floor(data.successes * this.decayFactor);
    });
  }

  /**
   * Get learning insights
   */
  getLearningInsights() {
    const insights = {
      totalFeedback: this.feedbackHistory.length,
      patternInsights: [],
      toolInsights: [],
      workflowInsights: [],
      overallTrends: [],
    };

    // Pattern insights
    this.patternOutcomes.forEach((data, pattern) => {
      if (data.successes + data.failures >= this.minSampleSize) {
        const score = this.calculatePatternScore(pattern);
        insights.patternInsights.push({
          pattern,
          score,
          usage: data.successes + data.failures,
          trend: this.calculateTrend(pattern, 'pattern'),
        });
      }
    });

    // Tool insights
    this.toolEffectiveness.forEach((data, tool) => {
      if (data.uses >= this.minSampleSize) {
        const score = this.calculateToolScore(tool);
        insights.toolInsights.push({
          tool,
          score,
          usage: data.uses,
          avgDuration: data.avgDuration,
          errorRate: data.errorRate,
          trend: this.calculateTrend(tool, 'tool'),
        });
      }
    });

    // Workflow insights
    this.workflowMetrics.forEach((data, workflow) => {
      if (data.attempts >= this.minSampleSize) {
        insights.workflowInsights.push({
          workflow,
          successRate: data.successes / data.attempts,
          avgDuration: data.averageDuration,
          qualityImprovement: data.averageQualityImprovement,
          trend: this.calculateTrend(workflow, 'workflow'),
        });
      }
    });

    // Overall trends
    insights.overallTrends = this.calculateOverallTrends();

    return insights;
  }

  /**
   * Calculate trend for a metric
   */
  calculateTrend(key, type) {
    const recentHistory = this.feedbackHistory
      .filter(entry => entry.type === type && entry[type] === key)
      .slice(-20);

    if (recentHistory.length < 10) {
      return 'insufficient_data';
    }

    const firstHalf = recentHistory.slice(0, 10);
    const secondHalf = recentHistory.slice(10);

    const firstHalfSuccess = firstHalf.filter(e => e.outcome?.success).length / firstHalf.length;
    const secondHalfSuccess = secondHalf.filter(e => e.outcome?.success).length / secondHalf.length;

    if (secondHalfSuccess > firstHalfSuccess + 0.1) return 'improving';
    if (secondHalfSuccess < firstHalfSuccess - 0.1) return 'declining';
    return 'stable';
  }

  /**
   * Calculate overall trends
   */
  calculateOverallTrends() {
    const recentHistory = this.feedbackHistory.slice(-100);
    if (recentHistory.length < 50) {
      return ['Insufficient data for trend analysis'];
    }

    const trends = [];

    // Success rate trend
    const recentSuccess = recentHistory.slice(-50)
      .filter(e => e.outcome?.success).length / 50;
    const olderSuccess = recentHistory.slice(0, 50)
      .filter(e => e.outcome?.success).length / 50;

    if (recentSuccess > olderSuccess + 0.1) {
      trends.push('Overall success rate improving');
    } else if (recentSuccess < olderSuccess - 0.1) {
      trends.push('Overall success rate declining - review recent changes');
    }

    // Duration trend
    const recentDurations = recentHistory.slice(-50)
      .map(e => e.outcome?.duration || e.metrics?.duration)
      .filter(d => d);
    const avgRecentDuration = recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length;

    if (avgRecentDuration < 5000) {
      trends.push('Task completion times are excellent');
    } else if (avgRecentDuration > 15000) {
      trends.push('Task completion times could be improved');
    }

    return trends;
  }

  /**
   * Export feedback data
   */
  exportFeedback() {
    return {
      patternOutcomes: Object.fromEntries(this.patternOutcomes),
      toolEffectiveness: Object.fromEntries(this.toolEffectiveness),
      workflowMetrics: Object.fromEntries(this.workflowMetrics),
      historySize: this.feedbackHistory.length,
      exportDate: Date.now(),
    };
  }

  /**
   * Import feedback data
   */
  importFeedback(data) {
    if (data.patternOutcomes) {
      this.patternOutcomes = new Map(Object.entries(data.patternOutcomes));
    }
    if (data.toolEffectiveness) {
      this.toolEffectiveness = new Map(Object.entries(data.toolEffectiveness));
    }
    if (data.workflowMetrics) {
      this.workflowMetrics = new Map(Object.entries(data.workflowMetrics));
    }
  }
}