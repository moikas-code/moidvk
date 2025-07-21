import { LocalEmbeddingManager } from '../filesystem/embedding-manager.js';
import { createKBMCPAdapter } from '../integration/kb-mcp-adapter.js';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

/**
 * Semantic Search for development context
 * Enhanced code search using local embeddings with development awareness
 */
export class SemanticSearch {
  constructor(config = {}) {
    this.embeddingManager = null;
    this.kbAdapter = null;
    this.searchCache = new Map();
    this.supportedExtensions = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'];
    this.config = {
      enableKBMCPIntegration: config.enableKBMCPIntegration !== false,
      hybridSearchThreshold: config.hybridSearchThreshold || 0.7,
      ...config
    };
  }

  /**
   * Initialize semantic search
   */
  async initialize() {
    if (!this.embeddingManager) {
      this.embeddingManager = new LocalEmbeddingManager();
      await this.embeddingManager.initialize();
    }

    // Initialize KB-MCP adapter if enabled
    if (this.config.enableKBMCPIntegration && !this.kbAdapter) {
      try {
        this.kbAdapter = createKBMCPAdapter({
          enableIntelligentRouting: true,
          enableCaching: true
        });
        
        // Test connection
        await this.kbAdapter.init();
        console.log('[SemanticSearch] KB-MCP integration enabled');
      } catch (error) {
        console.warn('[SemanticSearch] KB-MCP integration failed, falling back to local search:', error.message);
        this.kbAdapter = null;
      }
    }
  }

  /**
   * Search with semantic understanding
   */
  async search(options) {
    const { 
      query, 
      type = 'similar_code', 
      context = null, 
      maxResults = 10,
      useLocalEmbeddings = true,
      searchPath = '.',
      contextAware = true,
      includeAnalysis = true
    } = options;

    await this.initialize();

    // Decide whether to use KB-MCP or local embeddings
    const useKBMCP = this.shouldUseKBMCP(query, type, context);
    
    let results;
    if (useKBMCP && this.kbAdapter) {
      try {
        // Use KB-MCP for enhanced semantic search
        const kbResult = await this.kbAdapter.enhancedSemanticSearch(query, {
          searchType: type,
          maxResults,
          contextAware,
          includeAnalysis,
          searchPath
        });
        
        if (kbResult.success) {
          results = await this.mergeKBResults(kbResult.data, query, type, context);
        } else {
          // Fallback to local search
          results = await this.performLocalSearch(options);
        }
      } catch (error) {
        console.warn('[SemanticSearch] KB-MCP search failed, falling back to local:', error.message);
        results = await this.performLocalSearch(options);
      }
    } else {
      // Use local embeddings
      results = await this.performLocalSearch(options);
    }

    return results;
  }

  /**
   * Perform local embedding-based search
   */
  async performLocalSearch(options) {
    const { 
      query, 
      type = 'similar_code', 
      context = null, 
      maxResults = 10,
      searchPath = '.'
    } = options;

    // Generate query embedding
    const queryEmbedding = await this.embeddingManager.generateEmbedding(query, 'query');

    // Get file embeddings based on search type
    const fileEmbeddings = await this.getFileEmbeddings(searchPath, type, context);

    // Find similar files using high-performance vector operations
    const results = await this.embeddingManager.findSimilar(
      queryEmbedding.vector,
      fileEmbeddings,
      maxResults * 2, // Get more initially for filtering
      0.3 // Lower threshold for broader results
    );

    // Enhance results based on search type
    const enhancedResults = await this.enhanceResults(results, type, context, query);

    // Filter and sort based on development context
    const finalResults = this.filterAndSortResults(enhancedResults, type, context, maxResults);

    return finalResults;
  }

  /**
   * Decide whether to use KB-MCP for search
   */
  shouldUseKBMCP(query, type, context) {
    if (!this.kbAdapter) return false;
    
    // Use KB-MCP for complex queries
    if (query.length > 50) return true;
    
    // Use KB-MCP for specific search types that benefit from graph intelligence
    const kbBeneficialTypes = ['related_patterns', 'bug_hunt', 'optimization_targets', 'refactor_candidates'];
    if (kbBeneficialTypes.includes(type)) return true;
    
    // Use KB-MCP when context awareness is important
    if (context && (context.scope === 'system' || context.urgency === 'high')) return true;
    
    return false;
  }

  /**
   * Merge KB-MCP results with local context
   */
  async mergeKBResults(kbData, query, type, context) {
    // KB-MCP provides rich semantic context, merge with local file info
    const mergedResults = [];
    
    for (const item of kbData.results || []) {
      const enhanced = {
        ...item,
        source: 'kb-mcp',
        localContext: await this.addLocalContext(item, type),
        searchQuery: query,
        searchType: type
      };
      
      mergedResults.push(enhanced);
    }
    
    // If KB-MCP didn't provide enough results, supplement with local search
    if (mergedResults.length < 5) {
      const localResults = await this.performLocalSearch({
        query, type, context, maxResults: 10 - mergedResults.length
      });
      
      for (const localResult of localResults) {
        localResult.source = 'local';
        mergedResults.push(localResult);
      }
    }
    
    return mergedResults.slice(0, 10); // Limit to requested results
  }

  /**
   * Add local context to KB-MCP results
   */
  async addLocalContext(item, searchType) {
    if (!item.filePath) return {};
    
    try {
      const content = await readFile(item.filePath, 'utf8');
      const lines = content.split('\n');
      
      return {
        fileSize: content.length,
        lineCount: lines.length,
        extension: extname(item.filePath),
        isSupported: this.supportedExtensions.includes(extname(item.filePath))
      };
    } catch (error) {
      return { error: 'Could not read file' };
    }
  }

  /**
   * Get file embeddings for search
   */
  async getFileEmbeddings(searchPath, searchType, context) {
    const cacheKey = `${searchPath}_${searchType}`;
    
    // Check cache
    if (this.searchCache.has(cacheKey)) {
      const cached = this.searchCache.get(cacheKey);
      if (Date.now() - cached.timestamp < 300000) { // 5 minutes
        return cached.embeddings;
      }
    }

    // Get relevant files based on search type
    const files = await this.getRelevantFiles(searchPath, searchType, context);
    const embeddings = [];

    for (const file of files) {
      try {
        const content = await readFile(file.path, 'utf8');
        const embedding = await this.embeddingManager.generateEmbedding(content, file.path);
        
        embeddings.push({
          path: file.path,
          relativePath: file.relativePath,
          vector: embedding.vector,
          metadata: {
            size: file.size,
            lastModified: file.lastModified,
            type: file.type,
          },
        });
      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Cache embeddings
    this.searchCache.set(cacheKey, {
      embeddings,
      timestamp: Date.now(),
    });

    return embeddings;
  }

  /**
   * Get relevant files based on search type
   */
  async getRelevantFiles(searchPath, searchType, context) {
    // This would integrate with the filesystem tools
    // For now, return mock data
    const files = [];
    
    // Filter files based on search type
    switch (searchType) {
      case 'bug_hunt':
        // Focus on recently modified files
        break;
      case 'optimization_targets':
        // Focus on larger files
        break;
      case 'refactor_candidates':
        // Focus on complex files
        break;
      case 'related_patterns':
        // Focus on similar file types
        break;
    }

    return files;
  }

  /**
   * Enhance results with development context
   */
  async enhanceResults(results, searchType, context, query) {
    const enhanced = [];

    for (const result of results) {
      const enhancement = {
        ...result,
        file: result.path,
        description: await this.generateDescription(result, searchType),
        relevanceFactors: this.calculateRelevanceFactors(result, searchType, context, query),
        suggestions: await this.generateSuggestions(result, searchType, query),
      };

      // Add search type specific enhancements
      switch (searchType) {
        case 'bug_hunt':
          enhancement.bugProbability = this.calculateBugProbability(result, context);
          enhancement.lastModified = result.metadata?.lastModified;
          break;
        
        case 'optimization_targets':
          enhancement.optimizationPotential = this.calculateOptimizationPotential(result);
          enhancement.complexity = await this.estimateComplexity(result);
          break;
        
        case 'refactor_candidates':
          enhancement.refactorScore = this.calculateRefactorScore(result, context);
          enhancement.codeSmells = await this.detectCodeSmells(result);
          break;
        
        case 'related_patterns':
          enhancement.patternMatch = this.calculatePatternMatch(result, query);
          enhancement.usage = await this.findUsagePatterns(result);
          break;
      }

      enhanced.push(enhancement);
    }

    return enhanced;
  }

  /**
   * Filter and sort results based on context
   */
  filterAndSortResults(results, searchType, context, maxResults) {
    // Apply filters based on context
    let filtered = results;

    if (context) {
      // Filter by session goals
      if (context.goals?.length > 0) {
        filtered = filtered.filter(r => 
          this.matchesGoals(r, context.goals)
        );
      }

      // Filter by workflow type
      if (context.workflow?.type) {
        filtered = filtered.filter(r => 
          this.matchesWorkflow(r, context.workflow.type)
        );
      }
    }

    // Sort based on search type
    const sorted = this.sortResults(filtered, searchType);

    // Return top results
    return sorted.slice(0, maxResults);
  }

  /**
   * Generate description for result
   */
  async generateDescription(result, searchType) {
    const descriptions = {
      similar_code: 'Similar implementation pattern',
      bug_hunt: 'Potential bug location',
      optimization_targets: 'Optimization opportunity',
      refactor_candidates: 'Refactoring candidate',
      related_patterns: 'Related code pattern',
    };

    return descriptions[searchType] || 'Related code';
  }

  /**
   * Calculate relevance factors
   */
  calculateRelevanceFactors(result, searchType, context, query) {
    const factors = {
      similarity: result.similarity || 0,
      recency: this.calculateRecencyScore(result),
      contextual: this.calculateContextualScore(result, context),
      queryMatch: this.calculateQueryMatch(result, query),
    };

    // Weight factors based on search type
    const weights = this.getSearchTypeWeights(searchType);
    
    let totalScore = 0;
    for (const [factor, score] of Object.entries(factors)) {
      totalScore += score * (weights[factor] || 0.25);
    }

    return {
      ...factors,
      total: totalScore,
    };
  }

  /**
   * Generate suggestions for result
   */
  async generateSuggestions(result, searchType, query) {
    const suggestions = {
      similar_code: 'Review for code reuse opportunities',
      bug_hunt: 'Check for error conditions and edge cases',
      optimization_targets: 'Profile and optimize performance',
      refactor_candidates: 'Simplify and improve code structure',
      related_patterns: 'Ensure consistency with this pattern',
    };

    return suggestions[searchType] || 'Review this code';
  }

  /**
   * Calculate bug probability
   */
  calculateBugProbability(result, context) {
    let probability = 0.3; // Base probability

    // Recent changes increase bug probability
    if (result.metadata?.lastModified) {
      const age = Date.now() - new Date(result.metadata.lastModified).getTime();
      if (age < 86400000) { // 24 hours
        probability += 0.3;
      } else if (age < 604800000) { // 1 week
        probability += 0.2;
      }
    }

    // Complex files more likely to have bugs
    if (result.metadata?.size > 5000) {
      probability += 0.1;
    }

    // Files mentioned in error logs
    if (context?.errors?.some(e => e.includes(result.file))) {
      probability += 0.3;
    }

    return Math.min(1, probability);
  }

  /**
   * Calculate optimization potential
   */
  calculateOptimizationPotential(result) {
    let potential = 0.5;

    // Larger files have more optimization potential
    if (result.metadata?.size > 10000) {
      potential += 0.2;
    }

    // Files with 'slow' or 'performance' in path
    if (result.file.match(/slow|performance|heavy/i)) {
      potential += 0.2;
    }

    return Math.min(1, potential);
  }

  /**
   * Calculate refactor score
   */
  calculateRefactorScore(result, context) {
    let score = 0.5;

    // Older files might need refactoring
    if (result.metadata?.lastModified) {
      const age = Date.now() - new Date(result.metadata.lastModified).getTime();
      if (age > 2592000000) { // 30 days
        score += 0.2;
      }
    }

    // Large files benefit from refactoring
    if (result.metadata?.size > 5000) {
      score += 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * Calculate pattern match
   */
  calculatePatternMatch(result, query) {
    // Simple keyword matching for now
    const keywords = query.toLowerCase().split(/\s+/);
    const fileName = result.file.toLowerCase();
    
    let matches = 0;
    for (const keyword of keywords) {
      if (fileName.includes(keyword)) {
        matches++;
      }
    }

    return matches / keywords.length;
  }

  /**
   * Estimate complexity
   */
  async estimateComplexity(result) {
    // Based on file size and type
    const size = result.metadata?.size || 0;
    
    if (size < 1000) return 'low';
    if (size < 5000) return 'medium';
    if (size < 10000) return 'high';
    return 'very high';
  }

  /**
   * Detect code smells
   */
  async detectCodeSmells(result) {
    // Simplified detection based on file characteristics
    const smells = [];

    if (result.metadata?.size > 10000) {
      smells.push('large_file');
    }

    if (result.file.includes('temp') || result.file.includes('old')) {
      smells.push('suspicious_naming');
    }

    return smells;
  }

  /**
   * Find usage patterns
   */
  async findUsagePatterns(result) {
    // Simplified pattern detection
    return {
      imports: 0,
      exports: 0,
      calls: 0,
    };
  }

  /**
   * Helper methods
   */

  calculateRecencyScore(result) {
    if (!result.metadata?.lastModified) return 0.5;
    
    const age = Date.now() - new Date(result.metadata.lastModified).getTime();
    const daysSinceModified = age / 86400000;
    
    if (daysSinceModified < 1) return 1;
    if (daysSinceModified < 7) return 0.8;
    if (daysSinceModified < 30) return 0.6;
    if (daysSinceModified < 90) return 0.4;
    return 0.2;
  }

  calculateContextualScore(result, context) {
    if (!context) return 0.5;
    
    let score = 0.5;
    
    // Files in the same module as recent changes
    if (context.session?.filesModified?.some(f => 
      result.file.startsWith(f.split('/')[0])
    )) {
      score += 0.2;
    }
    
    // Files matching session goals
    if (context.goals?.some(g => 
      result.file.toLowerCase().includes(g.toLowerCase())
    )) {
      score += 0.3;
    }
    
    return Math.min(1, score);
  }

  calculateQueryMatch(result, query) {
    const queryLower = query.toLowerCase();
    const fileLower = result.file.toLowerCase();
    
    // Direct file name match
    if (fileLower.includes(queryLower)) {
      return 1;
    }
    
    // Partial matches
    const queryTerms = queryLower.split(/\s+/);
    let matches = 0;
    
    for (const term of queryTerms) {
      if (fileLower.includes(term)) {
        matches++;
      }
    }
    
    return matches / queryTerms.length;
  }

  getSearchTypeWeights(searchType) {
    const weights = {
      similar_code: { similarity: 0.6, recency: 0.1, contextual: 0.2, queryMatch: 0.1 },
      bug_hunt: { similarity: 0.2, recency: 0.5, contextual: 0.2, queryMatch: 0.1 },
      optimization_targets: { similarity: 0.3, recency: 0.1, contextual: 0.3, queryMatch: 0.3 },
      refactor_candidates: { similarity: 0.2, recency: 0.1, contextual: 0.4, queryMatch: 0.3 },
      related_patterns: { similarity: 0.5, recency: 0.1, contextual: 0.2, queryMatch: 0.2 },
    };
    
    return weights[searchType] || weights.similar_code;
  }

  matchesGoals(result, goals) {
    return goals.some(goal => 
      result.file.toLowerCase().includes(goal.toLowerCase()) ||
      result.description?.toLowerCase().includes(goal.toLowerCase())
    );
  }

  matchesWorkflow(result, workflowType) {
    const workflowPatterns = {
      bug_fix: ['fix', 'bug', 'error', 'issue'],
      feature_development: ['feature', 'new', 'add', 'implement'],
      refactoring: ['refactor', 'clean', 'improve', 'optimize'],
      optimization: ['perf', 'optimize', 'speed', 'performance'],
      review: ['review', 'audit', 'check', 'validate'],
    };
    
    const patterns = workflowPatterns[workflowType] || [];
    return patterns.some(pattern => 
      result.file.toLowerCase().includes(pattern)
    );
  }

  sortResults(results, searchType) {
    return results.sort((a, b) => {
      // Primary sort by relevance
      const scoreA = a.relevanceFactors?.total || a.similarity || 0;
      const scoreB = b.relevanceFactors?.total || b.similarity || 0;
      
      if (Math.abs(scoreA - scoreB) > 0.1) {
        return scoreB - scoreA;
      }
      
      // Secondary sort by search type specific criteria
      switch (searchType) {
        case 'bug_hunt':
          return (b.bugProbability || 0) - (a.bugProbability || 0);
        
        case 'optimization_targets':
          return (b.optimizationPotential || 0) - (a.optimizationPotential || 0);
        
        case 'refactor_candidates':
          return (b.refactorScore || 0) - (a.refactorScore || 0);
        
        default:
          return 0;
      }
    });
  }
}