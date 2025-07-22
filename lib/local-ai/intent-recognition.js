/**
 * Intent Recognition for understanding development intentions
 * Analyzes user input and context to determine development intent
 */
export class IntentRecognition {
  constructor() {
    // Define intent patterns
    this.intentPatterns = {
      // Implementation intents
      implement_feature: {
        keywords: ['add', 'implement', 'create', 'build', 'develop', 'new feature'],
        patterns: [/add\s+\w+\s+feature/i, /implement\s+\w+/i, /create\s+new\s+\w+/i],
        context_indicators: ['feature/', 'components/', 'modules/'],
      },
      
      // Fixing intents
      fix_bug: {
        keywords: ['fix', 'bug', 'error', 'issue', 'broken', 'crash', 'fail'],
        patterns: [/fix\s+\w+\s+bug/i, /resolve\s+issue/i, /debug\s+\w+/i],
        context_indicators: ['error', 'exception', 'failed'],
      },
      
      // Refactoring intents
      refactor_code: {
        keywords: ['refactor', 'clean', 'improve', 'reorganize', 'restructure'],
        patterns: [/refactor\s+\w+/i, /clean\s+up\s+\w+/i, /improve\s+code/i],
        context_indicators: ['legacy', 'old', 'messy'],
      },
      
      // Optimization intents
      optimize_performance: {
        keywords: ['optimize', 'performance', 'speed', 'faster', 'efficiency'],
        patterns: [/optimize\s+\w+/i, /improve\s+performance/i, /make\s+\w+\s+faster/i],
        context_indicators: ['slow', 'bottleneck', 'latency'],
      },
      
      // Review intents
      review_code: {
        keywords: ['review', 'check', 'audit', 'inspect', 'analyze', 'validate'],
        patterns: [/review\s+code/i, /code\s+review/i, /check\s+\w+/i],
        context_indicators: ['pull request', 'pr', 'merge'],
      },
      
      // Testing intents
      write_tests: {
        keywords: ['test', 'testing', 'unit test', 'integration test', 'coverage'],
        patterns: [/write\s+tests?/i, /add\s+tests?/i, /test\s+\w+/i],
        context_indicators: ['test/', 'spec/', '__tests__/'],
      },
      
      // Documentation intents
      update_docs: {
        keywords: ['document', 'documentation', 'docs', 'readme', 'comment'],
        patterns: [/update\s+docs/i, /add\s+documentation/i, /document\s+\w+/i],
        context_indicators: ['docs/', 'README', '.md'],
      },
      
      // Search intents
      find_code: {
        keywords: ['find', 'search', 'locate', 'where', 'look for'],
        patterns: [/find\s+\w+/i, /search\s+for\s+\w+/i, /where\s+is\s+\w+/i],
        context_indicators: ['?', 'location', 'file'],
      },
      
      // Understanding intents
      understand_code: {
        keywords: ['understand', 'explain', 'how', 'what', 'why', 'purpose'],
        patterns: [/how\s+does\s+\w+\s+work/i, /what\s+is\s+\w+/i, /explain\s+\w+/i],
        context_indicators: ['?', 'explanation', 'understanding'],
      },
    };

    // Intent confidence thresholds
    this.confidenceThresholds = {
      high: 0.8,
      medium: 0.6,
      low: 0.4,
    };

    // Intent history for learning
    this.intentHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * Recognize intent from input and context
   */
  recognizeIntent(input, context = {}) {
    const normalizedInput = input.toLowerCase();
    const intents = [];

    // Check each intent pattern
    for (const [intentType, config] of Object.entries(this.intentPatterns)) {
      const score = this.calculateIntentScore(normalizedInput, config, context);
      
      if (score > this.confidenceThresholds.low) {
        intents.push({
          type: intentType,
          confidence: score,
          matched_keywords: this.getMatchedKeywords(normalizedInput, config),
          matched_patterns: this.getMatchedPatterns(normalizedInput, config),
          context_support: this.getContextSupport(context, config),
        });
      }
    }

    // Sort by confidence
    intents.sort((a, b) => b.confidence - a.confidence);

    // Get primary and secondary intents
    const primary = intents[0] || null;
    const secondary = intents.slice(1, 3);

    // Record in history
    this.recordIntent(input, primary, context);

    return {
      primary_intent: primary,
      secondary_intents: secondary,
      confidence_level: this.getConfidenceLevel(primary?.confidence),
      suggestions: this.generateSuggestions(primary, secondary, context),
      ambiguity: this.detectAmbiguity(intents),
    };
  }

  /**
   * Calculate intent score
   */
  calculateIntentScore(input, config, context) {
    let score = 0;
    let factors = 0;

    // Keyword matching (40% weight)
    const keywordScore = this.calculateKeywordScore(input, config.keywords);
    score += keywordScore * 0.4;
    factors++;

    // Pattern matching (30% weight)
    const patternScore = this.calculatePatternScore(input, config.patterns);
    score += patternScore * 0.3;
    factors++;

    // Context support (30% weight)
    const contextScore = this.calculateContextScore(context, config.context_indicators);
    score += contextScore * 0.3;
    factors++;

    // Historical bias (bonus up to 10%)
    const historicalBonus = this.getHistoricalBonus(config);
    score += historicalBonus * 0.1;

    return Math.min(1, score);
  }

  /**
   * Calculate keyword score
   */
  calculateKeywordScore(input, keywords) {
    if (!keywords || keywords.length === 0) return 0;

    let matches = 0;
    let totalWeight = 0;

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const weight = keyword.split(' ').length; // Multi-word keywords weighted higher
      
      if (input.includes(keywordLower)) {
        matches += weight;
      }
      totalWeight += weight;
    }

    return matches / totalWeight;
  }

  /**
   * Calculate pattern score
   */
  calculatePatternScore(input, patterns) {
    if (!patterns || patterns.length === 0) return 0;

    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return 1; // Full score for pattern match
      }
    }

    return 0;
  }

  /**
   * Calculate context score
   */
  calculateContextScore(context, indicators) {
    if (!indicators || indicators.length === 0 || !context) return 0.5; // Neutral

    let score = 0;
    let checks = 0;

    // Check current file
    if (context.currentFile) {
      for (const indicator of indicators) {
        if (context.currentFile.includes(indicator)) {
          score += 1;
        }
      }
      checks++;
    }

    // Check recent files
    if (context.recentFiles) {
      let fileMatches = 0;
      for (const file of context.recentFiles) {
        for (const indicator of indicators) {
          if (file.includes(indicator)) {
            fileMatches++;
            break;
          }
        }
      }
      score += fileMatches / context.recentFiles.length;
      checks++;
    }

    // Check session type
    if (context.sessionType) {
      // Map session types to intents
      const sessionIntentMap = {
        bug_fix: 'fix_bug',
        feature_development: 'implement_feature',
        refactoring: 'refactor_code',
        optimization: 'optimize_performance',
        review: 'review_code',
      };
      
      if (sessionIntentMap[context.sessionType] === indicators) {
        score += 1;
        checks++;
      }
    }

    return checks > 0 ? score / checks : 0.5;
  }

  /**
   * Get matched keywords
   */
  getMatchedKeywords(input, config) {
    const matched = [];
    
    for (const keyword of config.keywords || []) {
      if (input.includes(keyword.toLowerCase())) {
        matched.push(keyword);
      }
    }
    
    return matched;
  }

  /**
   * Get matched patterns
   */
  getMatchedPatterns(input, config) {
    const matched = [];
    
    for (const pattern of config.patterns || []) {
      if (pattern.test(input)) {
        matched.push(pattern.source);
      }
    }
    
    return matched;
  }

  /**
   * Get context support
   */
  getContextSupport(context, config) {
    const support = [];
    
    if (context.currentFile) {
      for (const indicator of config.context_indicators || []) {
        if (context.currentFile.includes(indicator)) {
          support.push(`Current file contains '${indicator}'`);
        }
      }
    }
    
    if (context.sessionType) {
      const sessionIntentMap = {
        bug_fix: 'fix_bug',
        feature_development: 'implement_feature',
        refactoring: 'refactor_code',
        optimization: 'optimize_performance',
        review: 'review_code',
      };
      
      if (sessionIntentMap[context.sessionType] === config) {
        support.push(`Session type is ${context.sessionType}`);
      }
    }
    
    return support;
  }

  /**
   * Get historical bonus
   */
  getHistoricalBonus(config) {
    const recentIntents = this.intentHistory.slice(-20);
    const matchCount = recentIntents.filter(h => h.intent?.type === config).length;
    
    return Math.min(matchCount / 20, 1);
  }

  /**
   * Get confidence level
   */
  getConfidenceLevel(confidence) {
    if (!confidence) return 'none';
    if (confidence >= this.confidenceThresholds.high) return 'high';
    if (confidence >= this.confidenceThresholds.medium) return 'medium';
    if (confidence >= this.confidenceThresholds.low) return 'low';
    return 'very_low';
  }

  /**
   * Generate suggestions based on intent
   */
  generateSuggestions(primary, secondary, context) {
    const suggestions = [];

    if (!primary) {
      suggestions.push('Could you clarify what you want to do?');
      suggestions.push('Try using keywords like: implement, fix, refactor, optimize, or review');
      return suggestions;
    }

    // Primary intent suggestions
    const intentSuggestions = {
      implement_feature: [
        'Start by searching for similar implementations',
        'Create a plan with specific tasks',
        'Consider the impact on existing code',
      ],
      fix_bug: [
        'First, reproduce the issue',
        'Search for error messages in the codebase',
        'Check recent changes that might have caused it',
      ],
      refactor_code: [
        'Identify code smells and anti-patterns',
        'Ensure tests exist before refactoring',
        'Break down into small, safe changes',
      ],
      optimize_performance: [
        'Profile to identify bottlenecks',
        'Measure before and after changes',
        'Consider algorithmic improvements',
      ],
      review_code: [
        'Check for code quality issues',
        'Verify security best practices',
        'Ensure proper test coverage',
      ],
      write_tests: [
        'Start with critical path tests',
        'Aim for high code coverage',
        'Include edge cases',
      ],
      update_docs: [
        'Keep documentation close to code',
        'Include examples and use cases',
        'Update API documentation',
      ],
      find_code: [
        'Use semantic search for better results',
        'Search by functionality, not just names',
        'Look for similar patterns',
      ],
      understand_code: [
        'Start with high-level architecture',
        'Trace through key functions',
        'Check tests for usage examples',
      ],
    };

    suggestions.push(...(intentSuggestions[primary.type] || []));

    // Add context-specific suggestions
    if (context.hasFailingTests) {
      suggestions.push('Fix failing tests before proceeding');
    }
    
    if (context.hasSecurityIssues) {
      suggestions.push('Address security vulnerabilities first');
    }

    return suggestions;
  }

  /**
   * Detect ambiguity in intent recognition
   */
  detectAmbiguity(intents) {
    if (intents.length === 0) {
      return { level: 'high', reason: 'No clear intent detected' };
    }

    if (intents.length === 1) {
      return { level: 'none', reason: 'Single clear intent' };
    }

    const topConfidence = intents[0].confidence;
    const secondConfidence = intents[1]?.confidence || 0;

    if (topConfidence - secondConfidence < 0.2) {
      return { 
        level: 'medium', 
        reason: 'Multiple similar confidence intents',
        alternatives: intents.slice(0, 3).map(i => i.type),
      };
    }

    return { level: 'low', reason: 'Clear primary intent with alternatives' };
  }

  /**
   * Record intent for learning
   */
  recordIntent(input, intent, context) {
    this.intentHistory.push({
      timestamp: Date.now(),
      input: input.substring(0, 100), // Limit stored length
      intent: intent ? { type: intent.type, confidence: intent.confidence } : null,
      context: {
        sessionType: context.sessionType,
        hasFiles: !!context.currentFile,
      },
    });

    // Maintain max history size
    if (this.intentHistory.length > this.maxHistorySize) {
      this.intentHistory.shift();
    }
  }

  /**
   * Get intent insights
   */
  getIntentInsights() {
    const insights = {
      totalIntents: this.intentHistory.length,
      intentDistribution: {},
      averageConfidence: 0,
      ambiguousIntents: 0,
      trends: [],
    };

    if (this.intentHistory.length === 0) return insights;

    // Calculate distribution
    let totalConfidence = 0;
    for (const record of this.intentHistory) {
      if (record.intent) {
        const type = record.intent.type;
        insights.intentDistribution[type] = (insights.intentDistribution[type] || 0) + 1;
        totalConfidence += record.intent.confidence;
      } else {
        insights.ambiguousIntents++;
      }
    }

    insights.averageConfidence = totalConfidence / (this.intentHistory.length - insights.ambiguousIntents);

    // Detect trends
    const recentIntents = this.intentHistory.slice(-20);
    const commonRecent = this.getMostCommonIntent(recentIntents);
    const commonOverall = this.getMostCommonIntent(this.intentHistory);

    if (commonRecent !== commonOverall) {
      insights.trends.push(`Recent shift towards ${commonRecent} intents`);
    }

    return insights;
  }

  /**
   * Get most common intent
   */
  getMostCommonIntent(history) {
    const counts = {};
    
    for (const record of history) {
      if (record.intent) {
        counts[record.intent.type] = (counts[record.intent.type] || 0) + 1;
      }
    }

    let maxCount = 0;
    let mostCommon = null;
    
    for (const [type, count] of Object.entries(counts)) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = type;
      }
    }

    return mostCommon;
  }

  /**
   * Suggest intent clarification
   */
  suggestClarification(input, recognizedIntent) {
    const clarifications = [];

    if (!recognizedIntent || recognizedIntent.confidence < this.confidenceThresholds.medium) {
      clarifications.push({
        question: 'What would you like to do?',
        options: [
          'Implement a new feature',
          'Fix a bug',
          'Refactor existing code',
          'Optimize performance',
          'Review code quality',
        ],
      });
    } else if (recognizedIntent.type === 'fix_bug') {
      clarifications.push({
        question: 'Can you provide more details about the bug?',
        options: [
          'Error message or stack trace',
          'Steps to reproduce',
          'When it started occurring',
          'Affected functionality',
        ],
      });
    } else if (recognizedIntent.type === 'implement_feature') {
      clarifications.push({
        question: 'What kind of feature are you implementing?',
        options: [
          'User interface component',
          'API endpoint',
          'Database functionality',
          'Business logic',
          'Integration with external service',
        ],
      });
    }

    return clarifications;
  }
}