/**
 * KB-MCP Integration Adapter for MOIDVK
 * Provides bidirectional integration with KB-MCP's graph intelligence and semantic capabilities
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { join, resolve } from 'path';

// Store process reference at module level to avoid conflicts
const nodeProcess = process;

export class KBMCPAdapter extends EventEmitter {
  constructor(config = {}) {
    super();
    
    this.config = {
      kbMcpPath: config.kbMcpPath || 'kb',
      timeout: config.timeout || 30000,
      maxConcurrentRequests: config.maxConcurrentRequests || 3,
      enableCaching: config.enableCaching !== false,
      enableIntelligentRouting: config.enableIntelligentRouting !== false,
      retryAttempts: config.retryAttempts || 2,
      enhancementThreshold: config.enhancementThreshold || 0.7,
      ...config
    };

    this.activeRequests = new Map();
    this.resultCache = new Map();
    this.routingStats = new Map();
    this.connectionStatus = 'disconnected';
    
    this.init();
  }

  /**
   * Initialize the adapter and test connectivity
   */
  async init() {
    try {
      await this.testConnection();
      this.connectionStatus = 'connected';
      this.emit('connected');
    } catch (error) {
      this.connectionStatus = 'error';
      this.emit('connectionError', error);
    }
  }

  /**
   * Test connection to KB-MCP server
   */
  async testConnection() {
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.kbMcpPath, ['status'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      });

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`KB-MCP connection failed: ${stderr}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`KB-MCP spawn error: ${error.message}`));
      });
    });
  }

  /**
   * Execute KB-MCP command with intelligent routing
   */
  async executeKBCommand(command, params = {}, options = {}) {
    const requestId = `kb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      // Check cache first
      if (this.config.enableCaching && !options.skipCache) {
        const cached = this.getCachedResult(command, params);
        if (cached) {
          return {
            success: true,
            data: cached.data,
            metadata: {
              ...cached.metadata,
              cacheHit: true,
              executionTime: Date.now() - startTime
            }
          };
        }
      }

      // Check if we should route to KB-MCP or handle locally
      const routingDecision = await this.makeRoutingDecision(command, params, options);
      
      let result;
      if (routingDecision.useKBMCP) {
        result = await this.executeViaKBMCP(command, params, requestId);
      } else {
        result = await this.executeLocally(command, params, options);
      }

      // Enhance result if beneficial
      if (routingDecision.shouldEnhance && result.success) {
        result = await this.enhanceWithKBIntelligence(result, command, params);
      }

      // Cache successful results
      if (this.config.enableCaching && result.success) {
        this.cacheResult(command, params, result);
      }

      // Update routing statistics
      this.updateRoutingStats(command, routingDecision, result, Date.now() - startTime);

      return result;

    } catch (error) {
      this.emit('executionError', { requestId, command, error: error.message });
      return {
        success: false,
        error: error.message,
        metadata: {
          requestId,
          command,
          executionTime: Date.now() - startTime
        }
      };
    } finally {
      this.activeRequests.delete(requestId);
    }
  }

  /**
   * Make intelligent routing decision
   */
  async makeRoutingDecision(command, params, options) {
    const stats = this.routingStats.get(command);
    const workload = this.getCurrentWorkload();
    
    let useKBMCP = false;
    let shouldEnhance = false;
    let reasoning = 'Default local execution';

    // Check if command benefits from KB-MCP's capabilities
    const kbBeneficialCommands = [
      'semantic_development_search',
      'intelligent_development_analysis', 
      'analyze_project',
      'find_similar_files',
      'search_in_files'
    ];

    if (kbBeneficialCommands.includes(command)) {
      useKBMCP = true;
      reasoning = 'Command benefits from KB-MCP graph intelligence';
    }

    // Check complexity and size - route large/complex tasks to KB-MCP
    if (params.searchText && params.searchText.length > 100) {
      useKBMCP = true;
      reasoning = 'Complex search query routed to KB-MCP';
    }

    if (params.directoryPath && params.recursive) {
      shouldEnhance = true;
      reasoning += ' + enhancement with semantic analysis';
    }

    // Consider performance history
    if (stats && stats.kbPerformance > stats.localPerformance * 1.2) {
      useKBMCP = true;
      reasoning = 'KB-MCP historically faster for this command';
    }

    // Load balancing
    if (workload.local > 0.8 && workload.kb < 0.6) {
      useKBMCP = true;
      reasoning = 'Load balancing to KB-MCP';
    }

    // Override with explicit preferences
    if (options.preferKBMCP) {
      useKBMCP = true;
      reasoning = 'Explicit preference for KB-MCP';
    }

    if (options.preferLocal) {
      useKBMCP = false;
      reasoning = 'Explicit preference for local execution';
    }

    return {
      useKBMCP,
      shouldEnhance,
      reasoning,
      confidence: this.calculateRoutingConfidence(command, params, stats)
    };
  }

  /**
   * Execute command via KB-MCP
   */
  async executeViaKBMCP(command, params, requestId) {
    return new Promise((resolve, reject) => {
      const args = this.buildKBMCPArgs(command, params);
      
      const child = spawn(this.config.kbMcpPath, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: this.config.timeout,
        cwd: nodeProcess.cwd()
      });

      this.activeRequests.set(requestId, child);

      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        this.activeRequests.delete(requestId);
        
        if (code === 0) {
          try {
            const result = this.parseKBMCPResult(stdout);
            resolve({
              success: true,
              data: result,
              metadata: {
                source: 'kb-mcp',
                command,
                requestId
              }
            });
          } catch (parseError) {
            resolve({
              success: false,
              error: `Failed to parse KB-MCP result: ${parseError.message}`,
              rawOutput: stdout,
              metadata: { source: 'kb-mcp', command, requestId }
            });
          }
        } else {
          resolve({
            success: false,
            error: stderr || `KB-MCP command failed with code ${code}`,
            metadata: { source: 'kb-mcp', command, requestId }
          });
        }
      });

      child.on('error', (error) => {
        this.activeRequests.delete(requestId);
        resolve({
          success: false,
          error: `KB-MCP execution error: ${error.message}`,
          metadata: { source: 'kb-mcp', command, requestId }
        });
      });

      // Write input if needed
      if (params.input) {
        child.stdin?.write(JSON.stringify(params.input));
        child.stdin?.end();
      }
    });
  }

  /**
   * Execute command locally (fallback)
   */
  async executeLocally(command, params, options) {
    // This would delegate to MOIDVK's existing tool implementations
    // For now, return a placeholder that indicates local execution
    return {
      success: true,
      data: {
        message: `Local execution of ${command}`,
        params,
        note: 'This would delegate to existing MOIDVK tools'
      },
      metadata: {
        source: 'local',
        command,
        fallback: true
      }
    };
  }

  /**
   * Enhance result with KB-MCP intelligence
   */
  async enhanceWithKBIntelligence(result, command, params) {
    try {
      // Query KB-MCP for semantic enhancements
      const enhancement = await this.executeViaKBMCP('semantic_enhance', {
        data: result.data,
        context: { command, params },
        enhancementTypes: ['semantic_context', 'related_patterns', 'cross_references']
      });

      if (enhancement.success) {
        return {
          ...result,
          data: {
            ...result.data,
            kbEnhancements: enhancement.data,
            semanticContext: enhancement.data.semanticContext || [],
            relatedPatterns: enhancement.data.relatedPatterns || [],
            crossReferences: enhancement.data.crossReferences || []
          },
          metadata: {
            ...result.metadata,
            enhancedByKB: true,
            enhancementConfidence: enhancement.data.confidence || 0.7
          }
        };
      }
    } catch (error) {
      // Enhancement failed, return original result
      this.emit('enhancementError', { command, error: error.message });
    }

    return result;
  }

  /**
   * Build KB-MCP command arguments
   */
  buildKBMCPArgs(command, params) {
    const args = [];
    
    // Map MOIDVK commands to KB-MCP equivalents
    const commandMapping = {
      'semantic_development_search': ['search', '--semantic'],
      'intelligent_development_analysis': ['analyze', '--intelligent'],
      'analyze_project': ['analyze', '--project'],
      'find_similar_files': ['find', '--similar'],
      'search_in_files': ['search', '--in-files'],
      'semantic_enhance': ['enhance', '--semantic']
    };

    const kbCommand = commandMapping[command] || [command];
    args.push(...kbCommand);

    // Add parameters
    if (params.query) {
      args.push('--query', params.query);
    }
    
    if (params.directoryPath) {
      args.push('--path', params.directoryPath);
    }
    
    if (params.searchText) {
      args.push('--text', params.searchText);
    }
    
    if (params.limit) {
      args.push('--limit', params.limit.toString());
    }
    
    if (params.recursive) {
      args.push('--recursive');
    }

    // Add output format
    args.push('--format', 'json');

    return args;
  }

  /**
   * Parse KB-MCP result
   */
  parseKBMCPResult(output) {
    try {
      return JSON.parse(output);
    } catch (error) {
      // Try to extract JSON from mixed output
      const jsonMatch = output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No valid JSON found in output');
    }
  }

  /**
   * Cache management
   */
  getCachedResult(command, params) {
    const key = this.generateCacheKey(command, params);
    const cached = this.resultCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < 3600000) { // 1 hour TTL
      return cached;
    }
    
    return null;
  }

  cacheResult(command, params, result) {
    const key = this.generateCacheKey(command, params);
    this.resultCache.set(key, {
      data: result.data,
      metadata: result.metadata,
      timestamp: Date.now()
    });

    // Cleanup old cache entries
    if (this.resultCache.size > 1000) {
      this.cleanupCache();
    }
  }

  generateCacheKey(command, params) {
    const normalizedParams = JSON.stringify(params, Object.keys(params).sort());
    return `${command}_${normalizedParams}`;
  }

  cleanupCache() {
    const entries = Array.from(this.resultCache.entries());
    const sortedEntries = entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 20% of entries
    const toRemove = Math.floor(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.resultCache.delete(sortedEntries[i][0]);
    }
  }

  /**
   * Statistics and monitoring
   */
  updateRoutingStats(command, decision, result, executionTime) {
    const stats = this.routingStats.get(command) || {
      totalCalls: 0,
      kbCalls: 0,
      localCalls: 0,
      kbPerformance: 0,
      localPerformance: 0,
      successRate: 0
    };

    stats.totalCalls++;
    
    if (decision.useKBMCP) {
      stats.kbCalls++;
      stats.kbPerformance = (stats.kbPerformance * (stats.kbCalls - 1) + executionTime) / stats.kbCalls;
    } else {
      stats.localCalls++;
      stats.localPerformance = (stats.localPerformance * (stats.localCalls - 1) + executionTime) / stats.localCalls;
    }

    stats.successRate = (stats.successRate * (stats.totalCalls - 1) + (result.success ? 1 : 0)) / stats.totalCalls;

    this.routingStats.set(command, stats);
  }

  calculateRoutingConfidence(command, params, stats) {
    let confidence = 0.7; // Base confidence

    if (stats) {
      const kbSuccessRate = stats.kbCalls > 0 ? stats.successRate : 0;
      const performanceRatio = stats.kbPerformance > 0 && stats.localPerformance > 0 
        ? stats.localPerformance / stats.kbPerformance 
        : 1;
      
      confidence = Math.min(0.95, confidence + (kbSuccessRate - 0.5) + (performanceRatio - 1) * 0.1);
    }

    return Math.max(0.1, confidence);
  }

  getCurrentWorkload() {
    const totalSlots = this.config.maxConcurrentRequests;
    const activeLocal = this.activeRequests.size;
    
    return {
      local: activeLocal / totalSlots,
      kb: 0.3 // Placeholder - would need actual KB-MCP monitoring
    };
  }

  /**
   * Public API methods
   */
  
  /**
   * Enhanced semantic search with KB-MCP intelligence
   */
  async enhancedSemanticSearch(query, options = {}) {
    return await this.executeKBCommand('semantic_development_search', {
      query,
      ...options
    }, { preferKBMCP: true });
  }

  /**
   * Intelligent project analysis
   */
  async intelligentProjectAnalysis(projectPath, options = {}) {
    return await this.executeKBCommand('intelligent_development_analysis', {
      directoryPath: projectPath,
      ...options
    }, { preferKBMCP: true });
  }

  /**
   * Find semantically similar files
   */
  async findSimilarFiles(referencePath, searchPath, options = {}) {
    return await this.executeKBCommand('find_similar_files', {
      referencePath,
      searchPath,
      ...options
    }, { preferKBMCP: true });
  }

  /**
   * Enhanced file search with semantic understanding
   */
  async enhancedFileSearch(searchText, directoryPath, options = {}) {
    return await this.executeKBCommand('search_in_files', {
      searchText,
      directoryPath,
      ...options
    });
  }

  /**
   * Get integration statistics
   */
  getStats() {
    return {
      connectionStatus: this.connectionStatus,
      activeRequests: this.activeRequests.size,
      cacheSize: this.resultCache.size,
      routingStats: Object.fromEntries(this.routingStats),
      config: { ...this.config }
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    // Cancel active requests
    for (const [requestId, child] of this.activeRequests) {
      child.kill();
      this.activeRequests.delete(requestId);
    }

    // Clear caches
    this.resultCache.clear();
    this.routingStats.clear();

    this.connectionStatus = 'disconnected';
    this.emit('disconnected');
  }
}

// Export factory function for easy integration
export function createKBMCPAdapter(config = {}) {
  return new KBMCPAdapter(config);
}

// Export default configuration
export const defaultKBMCPConfig = {
  kbMcpPath: 'kb',
  timeout: 30000,
  maxConcurrentRequests: 3,
  enableCaching: true,
  enableIntelligentRouting: true,
  retryAttempts: 2,
  enhancementThreshold: 0.7
};