/**
 * Pattern Recognizer for identifying development patterns
 * Analyzes code and behavior patterns to provide intelligent suggestions
 */
export class PatternRecognizer {
  constructor() {
    // Common code patterns and their implications
    this.codePatterns = {
      // Anti-patterns
      callback_hell: {
        pattern: /callback\s*\([^)]*\)\s*{\s*[^}]*callback\s*\(/,
        type: 'anti-pattern',
        severity: 'high',
        suggestion: 'Consider using async/await or promises',
      },
      god_object: {
        pattern: /class\s+\w+\s*{[\s\S]{5000,}/,
        type: 'anti-pattern',
        severity: 'medium',
        suggestion: 'Consider breaking down large classes into smaller, focused components',
      },
      magic_numbers: {
        pattern: /(?:if|while|for|return)\s*\([^)]*\b\d{2,}\b/,
        type: 'anti-pattern',
        severity: 'low',
        suggestion: 'Extract magic numbers into named constants',
      },
      
      // Good patterns
      async_await: {
        pattern: /async\s+\w+\s*\([^)]*\)\s*{[\s\S]*await/,
        type: 'good-pattern',
        category: 'modern-js',
      },
      error_handling: {
        pattern: /try\s*{[\s\S]*}\s*catch\s*\([^)]*\)\s*{/,
        type: 'good-pattern',
        category: 'error-handling',
      },
      destructuring: {
        pattern: /(?:const|let)\s*{[^}]+}\s*=/,
        type: 'good-pattern',
        category: 'modern-js',
      },
    };

    // Development workflow patterns
    this.workflowPatterns = {
      test_driven: {
        indicators: ['test files created before implementation', 'frequent test runs'],
        benefits: ['higher code quality', 'better design', 'fewer bugs'],
      },
      iterative_refinement: {
        indicators: ['multiple small commits', 'gradual improvement', 'frequent formatting'],
        benefits: ['maintainable code', 'easier reviews', 'better history'],
      },
      exploratory: {
        indicators: ['many file searches', 'reading before writing', 'similar file lookups'],
        benefits: ['better understanding', 'consistent patterns', 'fewer mistakes'],
      },
    };

    // File organization patterns
    this.organizationPatterns = {
      feature_based: {
        structure: ['features/', 'components/', 'shared/'],
        benefits: ['scalable', 'modular', 'easy to navigate'],
      },
      layer_based: {
        structure: ['controllers/', 'services/', 'models/', 'views/'],
        benefits: ['clear separation', 'traditional', 'well-understood'],
      },
      domain_driven: {
        structure: ['domains/', 'infrastructure/', 'application/'],
        benefits: ['business-focused', 'maintainable', 'testable'],
      },
    };

    // Tool usage patterns
    this.toolUsagePatterns = new Map();
    
    // Pattern history for learning
    this.patternHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Analyze code for patterns
   */
  analyzeCodePatterns(code, filePath = '') {
    const detectedPatterns = [];
    
    // Check for code patterns
    for (const [name, pattern] of Object.entries(this.codePatterns)) {
      if (pattern.pattern.test(code)) {
        detectedPatterns.push({
          name,
          type: pattern.type,
          severity: pattern.severity || 'info',
          suggestion: pattern.suggestion || null,
          category: pattern.category || 'general',
          location: this.findPatternLocation(code, pattern.pattern),
        });
      }
    }
    
    // Analyze complexity
    const complexity = this.analyzeComplexity(code);
    if (complexity.cyclomatic > 10) {
      detectedPatterns.push({
        name: 'high_complexity',
        type: 'complexity',
        severity: 'medium',
        suggestion: 'Consider breaking down complex functions',
        metrics: complexity,
      });
    }
    
    // Analyze code style consistency
    const stylePatterns = this.analyzeStylePatterns(code);
    detectedPatterns.push(...stylePatterns);
    
    // Store in history
    this.addToHistory({
      filePath,
      patterns: detectedPatterns,
      timestamp: Date.now(),
    });
    
    return {
      patterns: detectedPatterns,
      summary: this.summarizePatterns(detectedPatterns),
      recommendations: this.generateRecommendations(detectedPatterns),
    };
  }

  /**
   * Analyze workflow patterns from tool usage
   */
  analyzeWorkflowPatterns(toolHistory) {
    const patterns = [];
    
    // Analyze tool sequence patterns
    const sequences = this.extractToolSequences(toolHistory);
    
    // Check for test-driven development
    if (this.detectTDDPattern(sequences)) {
      patterns.push({
        type: 'test_driven',
        confidence: 0.8,
        evidence: 'Test tools used before implementation tools',
      });
    }
    
    // Check for iterative refinement
    if (this.detectIterativePattern(sequences)) {
      patterns.push({
        type: 'iterative_refinement',
        confidence: 0.7,
        evidence: 'Multiple format and check cycles detected',
      });
    }
    
    // Check for exploratory development
    if (this.detectExploratoryPattern(sequences)) {
      patterns.push({
        type: 'exploratory',
        confidence: 0.75,
        evidence: 'Extensive search and analysis before implementation',
      });
    }
    
    return patterns;
  }

  /**
   * Analyze project organization patterns
   */
  analyzeOrganizationPatterns(projectStructure) {
    const patterns = [];
    const directories = projectStructure.directories || [];
    
    // Check for feature-based organization
    if (directories.includes('features') || directories.includes('modules')) {
      patterns.push({
        type: 'feature_based',
        confidence: 0.8,
        match: directories.filter(d => ['features', 'modules', 'components'].includes(d)),
      });
    }
    
    // Check for layer-based organization
    const layerDirs = ['controllers', 'services', 'models', 'views', 'routes'];
    const matchedLayers = directories.filter(d => layerDirs.includes(d));
    if (matchedLayers.length >= 2) {
      patterns.push({
        type: 'layer_based',
        confidence: 0.7 + (matchedLayers.length * 0.05),
        match: matchedLayers,
      });
    }
    
    // Check for domain-driven design
    if (directories.includes('domains') || directories.includes('domain')) {
      patterns.push({
        type: 'domain_driven',
        confidence: 0.85,
        match: directories.filter(d => d.includes('domain')),
      });
    }
    
    return patterns;
  }

  /**
   * Identify recurring patterns across sessions
   */
  identifyRecurringPatterns(sessions) {
    const recurring = new Map();
    
    // Aggregate patterns across sessions
    for (const session of sessions) {
      const patterns = session.patterns || [];
      for (const pattern of patterns) {
        const key = `${pattern.type}_${pattern.name}`;
        const count = recurring.get(key) || 0;
        recurring.set(key, count + 1);
      }
    }
    
    // Find most common patterns
    const sorted = Array.from(recurring.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);
    
    return sorted.map(([key, count]) => {
      const [type, name] = key.split('_');
      return {
        type,
        name,
        frequency: count,
        percentage: (count / sessions.length) * 100,
      };
    });
  }

  /**
   * Predict next likely actions based on patterns
   */
  predictNextActions(currentContext, patternHistory) {
    const predictions = [];
    
    // Analyze current state
    const currentTools = currentContext.toolUsage || [];
    const lastTool = currentTools[currentTools.length - 1];
    
    // Common sequences
    const sequences = {
      'check_code_practices': ['format_code', 'check_production_readiness'],
      'search_files': ['read_file', 'update_file'],
      'check_graphql_schema': ['check_graphql_query'],
      'format_code': ['check_code_practices'],
    };
    
    if (lastTool && sequences[lastTool]) {
      for (const nextTool of sequences[lastTool]) {
        predictions.push({
          action: `Run ${nextTool}`,
          tool: nextTool,
          confidence: 0.7,
          reasoning: `Common sequence: ${lastTool} → ${nextTool}`,
        });
      }
    }
    
    // Based on detected patterns
    if (currentContext.patterns) {
      for (const pattern of currentContext.patterns) {
        if (pattern.type === 'anti-pattern' && pattern.severity === 'high') {
          predictions.push({
            action: 'Fix anti-pattern',
            target: pattern.name,
            confidence: 0.8,
            reasoning: pattern.suggestion,
          });
        }
      }
    }
    
    return predictions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Helper methods
   */

  findPatternLocation(code, pattern) {
    const match = code.match(pattern);
    if (!match) return null;
    
    const lines = code.substring(0, match.index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
      snippet: match[0].substring(0, 100),
    };
  }

  analyzeComplexity(code) {
    // Simple cyclomatic complexity calculation
    let complexity = 1; // Base complexity
    
    // Count decision points
    const decisionPatterns = [
      /\bif\s*\(/g,
      /\belse\s+if\s*\(/g,
      /\bfor\s*\(/g,
      /\bwhile\s*\(/g,
      /\bcase\s+/g,
      /\bcatch\s*\(/g,
      /\?\s*[^:]+:/g, // ternary
    ];
    
    for (const pattern of decisionPatterns) {
      const matches = code.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    // Count functions
    const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>)/g;
    const functions = code.match(functionPattern);
    const functionCount = functions ? functions.length : 0;
    
    return {
      cyclomatic: complexity,
      functions: functionCount,
      linesOfCode: code.split('\n').length,
      avgComplexityPerFunction: functionCount > 0 ? complexity / functionCount : complexity,
    };
  }

  analyzeStylePatterns(code) {
    const patterns = [];
    
    // Check indentation consistency
    const indentations = code.match(/^[ \t]+/gm) || [];
    const usesSpaces = indentations.some(i => i.includes(' '));
    const usesTabs = indentations.some(i => i.includes('\t'));
    
    if (usesSpaces && usesTabs) {
      patterns.push({
        name: 'mixed_indentation',
        type: 'style',
        severity: 'low',
        suggestion: 'Use consistent indentation (spaces or tabs, not both)',
      });
    }
    
    // Check quote consistency
    const singleQuotes = (code.match(/'/g) || []).length;
    const doubleQuotes = (code.match(/"/g) || []).length;
    
    if (singleQuotes > 0 && doubleQuotes > 0) {
      const ratio = Math.min(singleQuotes, doubleQuotes) / Math.max(singleQuotes, doubleQuotes);
      if (ratio > 0.3) {
        patterns.push({
          name: 'mixed_quotes',
          type: 'style',
          severity: 'low',
          suggestion: 'Use consistent quote style',
        });
      }
    }
    
    return patterns;
  }

  extractToolSequences(toolHistory) {
    const sequences = [];
    const windowSize = 3;
    
    for (let i = 0; i <= toolHistory.length - windowSize; i++) {
      sequences.push(toolHistory.slice(i, i + windowSize).map(t => t.tool));
    }
    
    return sequences;
  }

  detectTDDPattern(sequences) {
    return sequences.some(seq => 
      seq.includes('check_code_practices') && 
      seq.indexOf('test') < seq.indexOf('implement')
    );
  }

  detectIterativePattern(sequences) {
    let formatCheckCycles = 0;
    
    for (const seq of sequences) {
      if (seq.includes('format_code') && seq.includes('check_code_practices')) {
        formatCheckCycles++;
      }
    }
    
    return formatCheckCycles >= 3;
  }

  detectExploratoryPattern(sequences) {
    const searchTools = ['search_files', 'search_in_files', 'find_similar_files'];
    let searchCount = 0;
    
    for (const seq of sequences) {
      searchCount += seq.filter(t => searchTools.includes(t)).length;
    }
    
    return searchCount >= 5;
  }

  summarizePatterns(patterns) {
    const summary = {
      total: patterns.length,
      byType: {},
      bySeverity: {},
      topIssues: [],
    };
    
    // Count by type
    for (const pattern of patterns) {
      summary.byType[pattern.type] = (summary.byType[pattern.type] || 0) + 1;
      
      if (pattern.severity) {
        summary.bySeverity[pattern.severity] = (summary.bySeverity[pattern.severity] || 0) + 1;
      }
    }
    
    // Get top issues
    summary.topIssues = patterns
      .filter(p => p.type === 'anti-pattern' || p.severity === 'high')
      .slice(0, 3)
      .map(p => ({
        name: p.name,
        suggestion: p.suggestion,
      }));
    
    return summary;
  }

  generateRecommendations(patterns) {
    const recommendations = [];
    const seen = new Set();
    
    for (const pattern of patterns) {
      if (pattern.suggestion && !seen.has(pattern.suggestion)) {
        recommendations.push({
          priority: pattern.severity === 'high' ? 'high' : 'medium',
          action: pattern.suggestion,
          pattern: pattern.name,
          impact: this.estimateImpact(pattern),
        });
        seen.add(pattern.suggestion);
      }
    }
    
    // Sort by priority and impact
    return recommendations.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'high' ? -1 : 1;
      }
      return b.impact.score - a.impact.score;
    });
  }

  estimateImpact(pattern) {
    const impacts = {
      callback_hell: { score: 8, areas: ['readability', 'maintainability', 'testing'] },
      god_object: { score: 7, areas: ['maintainability', 'testing', 'reusability'] },
      magic_numbers: { score: 4, areas: ['readability', 'maintainability'] },
      high_complexity: { score: 9, areas: ['testing', 'bugs', 'maintainability'] },
      mixed_indentation: { score: 3, areas: ['readability', 'consistency'] },
      mixed_quotes: { score: 2, areas: ['consistency'] },
    };
    
    return impacts[pattern.name] || { score: 5, areas: ['quality'] };
  }

  addToHistory(entry) {
    this.patternHistory.push(entry);
    
    // Maintain max size
    if (this.patternHistory.length > this.maxHistorySize) {
      this.patternHistory.shift();
    }
  }

  /**
   * Learn from pattern history
   */
  learnFromHistory() {
    // Analyze frequency of patterns
    const frequency = new Map();
    
    for (const entry of this.patternHistory) {
      for (const pattern of entry.patterns) {
        const key = pattern.name;
        frequency.set(key, (frequency.get(key) || 0) + 1);
      }
    }
    
    // Update pattern weights based on frequency
    // This could be used to adjust pattern detection sensitivity
    return {
      mostCommon: Array.from(frequency.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5),
      totalAnalyzed: this.patternHistory.length,
    };
  }
}