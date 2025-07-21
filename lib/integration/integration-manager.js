/**
 * Integration Manager for MOIDVK
 * Manages connections and coordination between MOIDVK and external systems like KB-MCP
 */

import { createKBMCPAdapter } from './kb-mcp-adapter.js';
import { promises as fs } from 'fs';
import { join } from 'path';

// Store process reference at module level to avoid conflicts
const nodeProcess = process;

export class IntegrationManager {
  constructor(config = {}) {
    this.config = config;
    this.adapters = new Map();
    this.connectionStatus = new Map();
    this.integrationConfig = null;
    this.initialized = false;
  }

  /**
   * Initialize all integrations
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load integration configuration
      await this.loadIntegrationConfig();

      // Initialize KB-MCP adapter if enabled
      if (this.shouldEnableKBMCP()) {
        await this.initializeKBMCP();
      }

      // Initialize other adapters as needed
      await this.initializeOtherAdapters();

      this.initialized = true;
      console.log('[IntegrationManager] All integrations initialized successfully');
      
    } catch (error) {
      console.error('[IntegrationManager] Failed to initialize integrations:', error.message);
      throw error;
    }
  }

  /**
   * Load integration configuration from .mcp.json
   */
  async loadIntegrationConfig() {
    try {
      const configPath = join(nodeProcess.cwd(), '.mcp.json');
      const configData = await fs.readFile(configPath, 'utf8');
      const fullConfig = JSON.parse(configData);
      
      this.integrationConfig = {
        ...fullConfig.integration,
        moidvkServer: fullConfig.mcpServers?.moidvk?.integration,
        kbMcpServer: fullConfig.mcpServers?.['kb-mcp']?.integration
      };

      console.log('[IntegrationManager] Configuration loaded');
    } catch (error) {
      console.warn('[IntegrationManager] No integration config found, using defaults');
      this.integrationConfig = {
        bidirectional: true,
        sharedKnowledge: true,
        workflowOptimization: false,
        crossProjectInsights: false
      };
    }
  }

  /**
   * Check if KB-MCP integration should be enabled
   */
  shouldEnableKBMCP() {
    return this.integrationConfig?.moidvkServer?.kbMcp?.enabled !== false;
  }

  /**
   * Initialize KB-MCP adapter
   */
  async initializeKBMCP() {
    try {
      const kbConfig = this.integrationConfig?.moidvkServer?.kbMcp || {};
      
      const adapter = createKBMCPAdapter({
        enableIntelligentRouting: kbConfig.intelligentRouting !== false,
        enableCaching: kbConfig.caching !== false,
        enhancementThreshold: kbConfig.enhancementThreshold || 0.7,
        kbMcpPath: this.config.kbMcpPath || 'kb',
        timeout: this.config.timeout || 30000,
        maxConcurrentRequests: this.config.maxConcurrentRequests || 3
      });

      // Test connection
      await adapter.init();
      
      this.adapters.set('kb-mcp', adapter);
      this.connectionStatus.set('kb-mcp', 'connected');
      
      // Set up event handlers
      adapter.on('connected', () => {
        console.log('[IntegrationManager] KB-MCP connected');
        this.connectionStatus.set('kb-mcp', 'connected');
      });
      
      adapter.on('connectionError', (error) => {
        console.warn('[IntegrationManager] KB-MCP connection error:', error.message);
        this.connectionStatus.set('kb-mcp', 'error');
      });
      
      adapter.on('disconnected', () => {
        console.log('[IntegrationManager] KB-MCP disconnected');
        this.connectionStatus.set('kb-mcp', 'disconnected');
      });

      console.log('[IntegrationManager] KB-MCP adapter initialized');
      
    } catch (error) {
      console.warn('[IntegrationManager] KB-MCP initialization failed:', error.message);
      this.connectionStatus.set('kb-mcp', 'failed');
      // Don't throw - continue with other integrations
    }
  }

  /**
   * Initialize other adapters (placeholder for future integrations)
   */
  async initializeOtherAdapters() {
    // Placeholder for other integration adapters
    // Could include GitHub, Slack, Docker, etc.
  }

  /**
   * Get adapter by name
   */
  getAdapter(name) {
    return this.adapters.get(name);
  }

  /**
   * Get KB-MCP adapter
   */
  getKBMCPAdapter() {
    return this.adapters.get('kb-mcp');
  }

  /**
   * Check if specific integration is available
   */
  isIntegrationAvailable(name) {
    return this.connectionStatus.get(name) === 'connected';
  }

  /**
   * Get integration status
   */
  getIntegrationStatus() {
    const status = {};
    for (const [name, adapter] of this.adapters) {
      status[name] = {
        status: this.connectionStatus.get(name),
        stats: adapter.getStats ? adapter.getStats() : null
      };
    }
    return status;
  }

  /**
   * Execute tool with intelligent routing
   */
  async executeWithRouting(toolName, params, options = {}) {
    // Check if KB-MCP should handle this tool
    const kbAdapter = this.getKBMCPAdapter();
    if (kbAdapter && this.shouldRouteToKBMCP(toolName, params, options)) {
      try {
        return await kbAdapter.executeKBCommand(toolName, params, options);
      } catch (error) {
        console.warn(`[IntegrationManager] KB-MCP execution failed for ${toolName}, falling back to local:`, error.message);
        // Fall through to local execution
      }
    }

    // Execute locally or with other adapters
    return await this.executeLocally(toolName, params, options);
  }

  /**
   * Determine if tool should be routed to KB-MCP
   */
  shouldRouteToKBMCP(toolName, params, options) {
    if (!this.isIntegrationAvailable('kb-mcp')) return false;
    
    const preferences = this.integrationConfig?.moidvkServer?.kbMcp?.preferredTools || {};
    const preference = preferences[this.mapToolToPreference(toolName)];
    
    // Check explicit preferences
    if (preference === 'kb-mcp') return true;
    if (preference === 'moidvk') return false;
    if (preference === 'hybrid' && this.shouldUseHybridApproach(toolName, params)) return true;
    
    // Default routing logic
    const kbBeneficialTools = [
      'semantic_development_search',
      'intelligent_development_analysis',
      'analyze_project',
      'find_similar_files'
    ];
    
    return kbBeneficialTools.includes(toolName);
  }

  /**
   * Map tool name to preference category
   */
  mapToolToPreference(toolName) {
    const mapping = {
      'semantic_development_search': 'semanticSearch',
      'check_code_practices': 'codeAnalysis',
      'check_redux_patterns': 'patternDetection',
      'intelligent_development_analysis': 'projectAnalysis',
      'scan_security_vulnerabilities': 'securityScanning'
    };
    
    return mapping[toolName] || 'default';
  }

  /**
   * Determine if hybrid approach should be used
   */
  shouldUseHybridApproach(toolName, params) {
    // Use hybrid for complex queries or large projects
    if (params.query && params.query.length > 50) return true;
    if (params.recursive && params.directoryPath) return true;
    if (params.searchText && params.searchText.includes('complex')) return true;
    
    return false;
  }

  /**
   * Execute tool locally (fallback)
   */
  async executeLocally(toolName, params, options) {
    // This would delegate to MOIDVK's existing tool implementations
    // For integration, this would be connected to the actual tool handlers
    return {
      success: true,
      data: {
        message: `Local execution of ${toolName}`,
        params,
        source: 'local'
      },
      metadata: {
        source: 'local',
        tool: toolName,
        fallback: true
      }
    };
  }

  /**
   * Enhanced semantic search with automatic routing
   */
  async enhancedSemanticSearch(query, options = {}) {
    return await this.executeWithRouting('semantic_development_search', {
      query,
      ...options
    });
  }

  /**
   * Intelligent project analysis with automatic routing
   */
  async intelligentProjectAnalysis(projectPath, options = {}) {
    return await this.executeWithRouting('intelligent_development_analysis', {
      directoryPath: projectPath,
      ...options
    });
  }

  /**
   * Configuration management
   */
  async updateConfiguration(updates) {
    this.integrationConfig = { ...this.integrationConfig, ...updates };
    
    // Apply configuration changes to adapters
    for (const [name, adapter] of this.adapters) {
      if (adapter.updateConfig) {
        await adapter.updateConfig(this.integrationConfig);
      }
    }
  }

  /**
   * Health check for all integrations
   */
  async healthCheck() {
    const health = {};
    
    for (const [name, adapter] of this.adapters) {
      try {
        if (adapter.testConnection) {
          await adapter.testConnection();
          health[name] = { status: 'healthy', timestamp: new Date().toISOString() };
        } else {
          health[name] = { status: 'unknown', timestamp: new Date().toISOString() };
        }
      } catch (error) {
        health[name] = { 
          status: 'unhealthy', 
          error: error.message,
          timestamp: new Date().toISOString()
        };
      }
    }
    
    return health;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    console.log('[IntegrationManager] Shutting down integrations...');
    
    for (const [name, adapter] of this.adapters) {
      try {
        if (adapter.shutdown) {
          await adapter.shutdown();
        }
        console.log(`[IntegrationManager] ${name} adapter shut down`);
      } catch (error) {
        console.error(`[IntegrationManager] Error shutting down ${name}:`, error.message);
      }
    }
    
    this.adapters.clear();
    this.connectionStatus.clear();
    this.initialized = false;
  }
}

// Export singleton instance
let integrationManager = null;

export function getIntegrationManager(config = {}) {
  if (!integrationManager) {
    integrationManager = new IntegrationManager(config);
  }
  return integrationManager;
}

export function createIntegrationManager(config = {}) {
  return new IntegrationManager(config);
}