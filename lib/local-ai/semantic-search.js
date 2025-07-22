/**
 * Enhanced Semantic Search Integration
 * Integrates MOIDVK's local semantic search capabilities with KB-MCP when available
 */

import { VectorOperations } from '../../index.js';
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

const nodeProcess = process;

/**
 * Enhanced Semantic Search with KB-MCP Integration
 */
export class EnhancedSemanticSearch {
  constructor(options = {}) {
    this.config = {
      embeddingModel: 'local',
      vectorDimensions: 768,
      searchThreshold: 0.7,
      maxResults: 10,
      cacheEnabled: true,
      cacheDir: join(nodeProcess.cwd(), '.moidvk', 'embeddings'),
      cacheTTL: 24 * 60 * 60 * 1000, // 24 hours
      ...options
    };
    
    this.vectorOps = null;
    this.embeddingCache = new Map();
    this.initialized = false;
    
    // KB-MCP integration
    this.kbMcpAdapter = null;
    this.useKBMCP = false;
  }
  
  /**
   * Initialize the semantic search system
   */
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize Rust vector operations
      this.vectorOps = new VectorOperations();
      
      // Create cache directory
      await this.ensureCacheDirectory();
      
      // Load existing cache
      await this.loadCache();
      
      // Try to initialize KB-MCP integration
      await this.initializeKBMCPIntegration();
      
      this.initialized = true;
      console.log('[EnhancedSemanticSearch] Initialized successfully');
      
    } catch (error) {
      console.warn('[EnhancedSemanticSearch] Initialization warning:', error.message);
      this.initialized = true; // Continue without full functionality
    }
  }
  
  /**
   * Initialize KB-MCP integration if available
   */
  async initializeKBMCPIntegration() {
    try {
      // This would be injected by the integration manager
      if (this.config.kbMcpAdapter) {
        this.kbMcpAdapter = this.config.kbMcpAdapter;
        this.useKBMCP = true;
        console.log('[EnhancedSemanticSearch] KB-MCP integration enabled');
      }
    } catch (error) {
      console.warn('[EnhancedSemanticSearch] KB-MCP integration failed:', error.message);
      this.useKBMCP = false;
    }
  }
  
  /**
   * Perform semantic search with automatic routing
   */
  async semanticSearch(query, options = {}) {
    await this.initialize();
    
    const searchOptions = {
      threshold: this.config.searchThreshold,
      maxResults: this.config.maxResults,
      contextAware: true,
      includeAnalysis: true,
      searchType: 'similar_code',
      ...options
    };
    
    // Try KB-MCP first if available and appropriate
    if (this.shouldUseKBMCP(query, searchOptions)) {
      try {
        const kbResult = await this.searchWithKBMCP(query, searchOptions);
        if (kbResult.success) {
          return this.enhanceKBMCPResult(kbResult, query, searchOptions);
        }
      } catch (error) {
        console.warn('[EnhancedSemanticSearch] KB-MCP search failed, falling back to local:', error.message);
      }
    }
    
    // Fallback to local search
    return await this.searchLocally(query, searchOptions);
  }
  
  /**
   * Determine if KB-MCP should be used for this search
   */
  shouldUseKBMCP(query, options) {
    if (!this.useKBMCP || !this.kbMcpAdapter) return false;
    
    // Use KB-MCP for complex queries or specific search types
    return (
      query.length > 20 ||
      options.searchType === 'related_patterns' ||
      options.searchType === 'bug_hunt' ||
      options.contextAware === true
    );
  }
  
  /**
   * Search using KB-MCP
   */
  async searchWithKBMCP(query, options) {
    try {
      return await this.kbMcpAdapter.executeKBCommand('semantic_development_search', {
        query,
        ...options
      });
    } catch (error) {
      throw new Error(`KB-MCP search failed: ${error.message}`);
    }
  }
  
  /**
   * Enhance KB-MCP results with local analysis
   */
  enhanceKBMCPResult(kbResult, query, options) {
    return {
      success: true,
      results: kbResult.data?.results || [],
      metadata: {
        source: 'kb-mcp',
        enhanced: true,
        query,
        options,
        ...kbResult.metadata
      },
      analysis: kbResult.data?.analysis || null,
      performance: kbResult.performance || null
    };
  }
  
  /**
   * Perform local semantic search
   */
  async searchLocally(query, options) {
    try {
      const queryEmbedding = await this.generateEmbedding(query);
      const results = [];
      
      // Search through cached embeddings
      for (const [fileKey, cached] of this.embeddingCache) {
        if (this.isCacheExpired(cached)) continue;
        
        const similarity = await this.calculateSimilarity(queryEmbedding, cached.embedding);
        
        if (similarity >= options.threshold) {
          results.push({
            file: cached.filePath,
            similarity,
            content: cached.content,
            metadata: cached.metadata,
            analysis: await this.analyzeMatch(cached, query, similarity)
          });
        }
      }
      
      // Sort by similarity and limit results
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, options.maxResults);
      
      return {
        success: true,
        results: sortedResults,
        metadata: {
          source: 'local',
          query,
          totalFiles: this.embeddingCache.size,
          matchesFound: results.length,
          threshold: options.threshold
        },
        performance: {
          searchTime: Date.now(),
          resultsCount: sortedResults.length
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        results: [],
        metadata: { source: 'local', query }
      };
    }
  }
  
  /**
   * Add file to search index
   */
  async indexFile(filePath, content, metadata = {}) {
    try {
      const embedding = await this.generateEmbedding(content);
      const fileKey = this.generateFileKey(filePath);
      
      const cacheEntry = {
        filePath,
        content,
        embedding,
        metadata: {
          ...metadata,
          size: content.length,
          lastModified: Date.now(),
          version: this.generateContentHash(content)
        },
        timestamp: Date.now()
      };
      
      this.embeddingCache.set(fileKey, cacheEntry);
      
      // Persist to disk cache
      if (this.config.cacheEnabled) {
        await this.saveToCache(fileKey, cacheEntry);
      }
      
      return { success: true, fileKey };
      
    } catch (error) {
      console.error('[EnhancedSemanticSearch] Failed to index file:', error.message);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Generate embedding for text
   */
  async generateEmbedding(text) {
    // Simple text vectorization (in production, use proper embedding model)
    const words = text.toLowerCase().match(/\w+/g) || [];
    const vector = new Array(this.config.vectorDimensions).fill(0);
    
    for (let i = 0; i < words.length; i++) {
      const hash = this.simpleHash(words[i]);
      const index = hash % this.config.vectorDimensions;
      vector[index] += 1;
    }
    
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map(val => val / magnitude) : vector;
  }
  
  /**
   * Calculate cosine similarity between embeddings
   */
  async calculateSimilarity(embedding1, embedding2) {
    if (!this.vectorOps) return 0;
    
    try {
      const similarities = await this.vectorOps.batchCosineSimilarity(
        embedding1,
        embedding2,
        embedding1.length
      );
      return similarities[0] || 0;
    } catch (error) {
      // Fallback to JavaScript implementation
      return this.cosineSimilarityJS(embedding1, embedding2);
    }
  }
  
  /**
   * JavaScript fallback for cosine similarity
   */
  cosineSimilarityJS(a, b) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  
  /**
   * Analyze search match
   */
  async analyzeMatch(cached, query, similarity) {
    return {
      relevanceScore: similarity,
      matchType: this.determineMatchType(cached.content, query),
      keyTerms: this.extractKeyTerms(cached.content, query),
      context: this.extractContext(cached.content, query),
      suggestions: this.generateSuggestions(cached, query, similarity)
    };
  }
  
  /**
   * Determine match type
   */
  determineMatchType(content, query) {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    
    if (contentLower.includes(queryLower)) return 'exact_match';
    if (this.hasCommonTerms(queryLower, contentLower, 0.7)) return 'high_similarity';
    if (this.hasCommonTerms(queryLower, contentLower, 0.4)) return 'moderate_similarity';
    return 'semantic_similarity';
  }
  
  /**
   * Extract key terms
   */
  extractKeyTerms(content, query) {
    const queryTerms = query.toLowerCase().match(/\w+/g) || [];
    const contentTerms = content.toLowerCase().match(/\w+/g) || [];
    
    return queryTerms.filter(term => contentTerms.includes(term));
  }
  
  /**
   * Extract context around matches
   */
  extractContext(content, query, contextLength = 100) {
    const queryLower = query.toLowerCase();
    const contentLower = content.toLowerCase();
    const index = contentLower.indexOf(queryLower);
    
    if (index !== -1) {
      const start = Math.max(0, index - contextLength);
      const end = Math.min(content.length, index + query.length + contextLength);
      return content.substring(start, end);
    }
    
    return content.substring(0, Math.min(contextLength * 2, content.length));
  }
  
  /**
   * Generate suggestions based on match
   */
  generateSuggestions(cached, query, similarity) {
    const suggestions = [];
    
    if (similarity > 0.9) {
      suggestions.push('This is a very close match to your query');
    } else if (similarity > 0.7) {
      suggestions.push('This content is highly relevant to your search');
    }
    
    if (cached.metadata.type === 'function') {
      suggestions.push('Consider reviewing the function implementation');
    }
    
    return suggestions;
  }
  
  /**
   * Check if two texts have common terms above threshold
   */
  hasCommonTerms(text1, text2, threshold) {
    const terms1 = new Set(text1.match(/\w+/g) || []);
    const terms2 = new Set(text2.match(/\w+/g) || []);
    
    const intersection = new Set([...terms1].filter(x => terms2.has(x)));
    const union = new Set([...terms1, ...terms2]);
    
    return intersection.size / union.size >= threshold;
  }
  
  /**
   * Generate file key for caching
   */
  generateFileKey(filePath) {
    return createHash('md5').update(filePath).digest('hex');
  }
  
  /**
   * Generate content hash
   */
  generateContentHash(content) {
    return createHash('md5').update(content).digest('hex');
  }
  
  /**
   * Simple hash function
   */
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  /**
   * Check if cache entry is expired
   */
  isCacheExpired(cached) {
    return Date.now() - cached.timestamp > this.config.cacheTTL;
  }
  
  /**
   * Ensure cache directory exists
   */
  async ensureCacheDirectory() {
    try {
      await fs.mkdir(this.config.cacheDir, { recursive: true });
    } catch (error) {
      console.warn('[EnhancedSemanticSearch] Failed to create cache directory:', error.message);
    }
  }
  
  /**
   * Load cache from disk
   */
  async loadCache() {
    if (!this.config.cacheEnabled) return;
    
    try {
      const cacheFile = join(this.config.cacheDir, 'embeddings.json');
      const data = await fs.readFile(cacheFile, 'utf8');
      const cached = JSON.parse(data);
      
      for (const [key, entry] of Object.entries(cached)) {
        if (!this.isCacheExpired(entry)) {
          this.embeddingCache.set(key, entry);
        }
      }
      
      console.log(`[EnhancedSemanticSearch] Loaded ${this.embeddingCache.size} cached embeddings`);
      
    } catch (error) {
      // Cache file doesn't exist or is corrupted - start fresh
      console.log('[EnhancedSemanticSearch] Starting with empty cache');
    }
  }
  
  /**
   * Save cache entry to disk
   */
  async saveToCache(fileKey, entry) {
    try {
      const cacheFile = join(this.config.cacheDir, 'embeddings.json');
      
      // Load existing cache
      let existingCache = {};
      try {
        const data = await fs.readFile(cacheFile, 'utf8');
        existingCache = JSON.parse(data);
      } catch (error) {
        // File doesn't exist - start with empty cache
      }
      
      // Add new entry
      existingCache[fileKey] = entry;
      
      // Save back to file
      await fs.writeFile(cacheFile, JSON.stringify(existingCache, null, 2));
      
    } catch (error) {
      console.warn('[EnhancedSemanticSearch] Failed to save cache:', error.message);
    }
  }
  
  /**
   * Get search statistics
   */
  getStats() {
    return {
      indexedFiles: this.embeddingCache.size,
      cacheEnabled: this.config.cacheEnabled,
      kbMcpEnabled: this.useKBMCP,
      vectorDimensions: this.config.vectorDimensions,
      searchThreshold: this.config.searchThreshold,
      cacheTTL: this.config.cacheTTL
    };
  }
  
  /**
   * Clear all caches
   */
  async clearCache() {
    this.embeddingCache.clear();
    
    if (this.config.cacheEnabled) {
      try {
        const cacheFile = join(this.config.cacheDir, 'embeddings.json');
        await fs.unlink(cacheFile);
      } catch (error) {
        // Cache file might not exist
      }
    }
  }
}

// Export singleton instance
let semanticSearchInstance = null;

export function getSemanticSearch(options = {}) {
  if (!semanticSearchInstance) {
    semanticSearchInstance = new EnhancedSemanticSearch(options);
  }
  return semanticSearchInstance;
}

export function createSemanticSearch(options = {}) {
  return new EnhancedSemanticSearch(options);
}