/**
 * Cross-Client Synchronizer
 * Enables seamless context sharing across different MCP clients
 */

import { promises as fs } from 'node:fs';
import path from 'path';
import os from 'os';

export class CrossClientSynchronizer {
  constructor() {
    this.syncDir = path.join(os.homedir(), '.moidvk', 'sync');
    this.clientStates = new Map();
    this.syncInterval = null;
    this.syncIntervalMs = 5000; // 5 seconds
    this.maxSyncAge = 30 * 60 * 1000; // 30 minutes
    
    // Client type mappings
    this.clientTypes = {
      'claude-desktop': {
        name: 'Claude Desktop',
        capabilities: ['chat', 'code', 'analysis'],
        priority: 1,
      },
      'cursor': {
        name: 'Cursor',
        capabilities: ['code', 'edit', 'debug'],
        priority: 2,
      },
      'vscode': {
        name: 'VS Code',
        capabilities: ['code', 'edit', 'debug', 'terminal'],
        priority: 3,
      },
      'cli': {
        name: 'CLI',
        capabilities: ['terminal', 'batch', 'script'],
        priority: 4,
      },
      'unknown': {
        name: 'Unknown Client',
        capabilities: [],
        priority: 10,
      },
    };
  }
  
  async initialize() {
    // Ensure sync directory exists
    await fs.mkdir(this.syncDir, { recursive: true });
    
    // Clean up old sync files
    await this.cleanupOldSyncFiles();
    
    // Start sync monitoring
    this.startSyncMonitoring();
  }
  
  /**
   * Register a client and its current state
   */
  async registerClient(clientId, clientType, state) {
    const clientInfo = {
      id: clientId,
      type: clientType,
      info: this.clientTypes[clientType] || this.clientTypes.unknown,
      state,
      lastUpdate: Date.now(),
      capabilities: this.clientTypes[clientType]?.capabilities || [],
    };
    
    this.clientStates.set(clientId, clientInfo);
    
    // Persist to sync file
    const syncFile = path.join(this.syncDir, `${clientId}.json`);
    await fs.writeFile(syncFile, JSON.stringify(clientInfo, null, 2));
    
    return clientInfo;
  }
  
  /**
   * Update client state
   */
  async updateClientState(clientId, updates) {
    const client = this.clientStates.get(clientId);
    if (!client) {
      throw new Error(`Client ${clientId} not registered`);
    }
    
    // Merge updates
    client.state = { ...client.state, ...updates };
    client.lastUpdate = Date.now();
    
    // Persist changes
    const syncFile = path.join(this.syncDir, `${clientId}.json`);
    await fs.writeFile(syncFile, JSON.stringify(client, null, 2));
    
    // Notify other clients of state change
    await this.notifyStateChange(clientId, updates);
    
    return client;
  }
  
  /**
   * Get all active clients
   */
  async getActiveClients() {
    await this.refreshClientStates();
    
    const now = Date.now();
    const activeClients = [];
    
    for (const [clientId, client] of this.clientStates) {
      if (now - client.lastUpdate < this.maxSyncAge) {
        activeClients.push(client);
      }
    }
    
    // Sort by priority
    return activeClients.sort((a, b) => 
      (a.info.priority || 10) - (b.info.priority || 10)
    );
  }
  
  /**
   * Get synchronized context across all clients
   */
  async getSynchronizedContext() {
    const clients = await this.getActiveClients();
    
    const context = {
      activeClients: clients.length,
      clients: clients.map(c => ({
        id: c.id,
        type: c.type,
        name: c.info.name,
        capabilities: c.capabilities,
      })),
      sharedState: {},
      recentActions: [],
      activeWorkflows: new Set(),
      openFiles: new Set(),
      currentFocus: null,
    };
    
    // Merge states from all clients
    for (const client of clients) {
      // Merge shared state
      Object.assign(context.sharedState, client.state.sharedState || {});
      
      // Collect recent actions
      if (client.state.recentActions) {
        context.recentActions.push(...client.state.recentActions);
      }
      
      // Collect active workflows
      if (client.state.activeWorkflow) {
        context.activeWorkflows.add(client.state.activeWorkflow);
      }
      
      // Collect open files
      if (client.state.openFiles) {
        client.state.openFiles.forEach(f => context.openFiles.add(f));
      }
      
      // Determine current focus (most recent update wins)
      if (client.state.currentFocus) {
        if (!context.currentFocus || client.lastUpdate > context.currentFocus.timestamp) {
          context.currentFocus = {
            file: client.state.currentFocus,
            client: client.id,
            timestamp: client.lastUpdate,
          };
        }
      }
    }
    
    // Sort recent actions by timestamp
    context.recentActions.sort((a, b) => b.timestamp - a.timestamp);
    context.recentActions = context.recentActions.slice(0, 50); // Keep last 50
    
    // Convert sets to arrays
    context.activeWorkflows = Array.from(context.activeWorkflows);
    context.openFiles = Array.from(context.openFiles);
    
    return context;
  }
  
  /**
   * Share a development artifact across clients
   */
  async shareArtifact(artifact) {
    const {
      type, // 'code', 'analysis', 'suggestion', 'error', 'result'
      source, // Client ID that created the artifact
      content,
      metadata = {},
    } = artifact;
    
    const sharedArtifact = {
      id: this.generateId(),
      type,
      source,
      content,
      metadata,
      timestamp: Date.now(),
    };
    
    // Save to shared artifacts
    const artifactFile = path.join(
      this.syncDir, 
      'artifacts', 
      `${sharedArtifact.id}.json`
    );
    
    await fs.mkdir(path.dirname(artifactFile), { recursive: true });
    await fs.writeFile(artifactFile, JSON.stringify(sharedArtifact, null, 2));
    
    // Notify clients
    await this.notifyArtifactShared(sharedArtifact);
    
    return sharedArtifact;
  }
  
  /**
   * Get shared artifacts
   */
  async getSharedArtifacts(options = {}) {
    const { type, source, since, limit = 20 } = options;
    
    const artifactsDir = path.join(this.syncDir, 'artifacts');
    
    try {
      const files = await fs.readdir(artifactsDir);
      const artifacts = [];
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const content = await fs.readFile(
          path.join(artifactsDir, file), 
          'utf-8'
        );
        const artifact = JSON.parse(content);
        
        // Apply filters
        if (type && artifact.type !== type) continue;
        if (source && artifact.source !== source) continue;
        if (since && artifact.timestamp < since) continue;
        
        artifacts.push(artifact);
      }
      
      // Sort by timestamp descending
      artifacts.sort((a, b) => b.timestamp - a.timestamp);
      
      return artifacts.slice(0, limit);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
  
  /**
   * Coordinate action across clients
   */
  async coordinateAction(action) {
    const {
      type, // 'file_edit', 'tool_run', 'analysis', etc.
      initiator, // Client ID initiating the action
      target, // Target client IDs (optional, defaults to all)
      payload,
    } = action;
    
    const coordination = {
      id: this.generateId(),
      type,
      initiator,
      target: target || 'all',
      payload,
      status: 'pending',
      timestamp: Date.now(),
      responses: [],
    };
    
    // Save coordination request
    const coordFile = path.join(
      this.syncDir,
      'coordinations',
      `${coordination.id}.json`
    );
    
    await fs.mkdir(path.dirname(coordFile), { recursive: true });
    await fs.writeFile(coordFile, JSON.stringify(coordination, null, 2));
    
    // Notify target clients
    await this.notifyCoordinationRequest(coordination);
    
    return coordination;
  }
  
  /**
   * Respond to coordination request
   */
  async respondToCoordination(coordinationId, clientId, response) {
    const coordFile = path.join(
      this.syncDir,
      'coordinations',
      `${coordinationId}.json`
    );
    
    try {
      const content = await fs.readFile(coordFile, 'utf-8');
      const coordination = JSON.parse(content);
      
      // Add response
      coordination.responses.push({
        clientId,
        response,
        timestamp: Date.now(),
      });
      
      // Update status if all expected responses received
      const activeClients = await this.getActiveClients();
      const expectedResponses = coordination.target === 'all' 
        ? activeClients.filter(c => c.id !== coordination.initiator).length
        : coordination.target.length;
      
      if (coordination.responses.length >= expectedResponses) {
        coordination.status = 'completed';
      }
      
      // Save updated coordination
      await fs.writeFile(coordFile, JSON.stringify(coordination, null, 2));
      
      return coordination;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Coordination ${coordinationId} not found`);
      }
      throw error;
    }
  }
  
  /**
   * Start monitoring for sync updates
   */
  startSyncMonitoring() {
    if (this.syncInterval) return;
    
    this.syncInterval = setInterval(async () => {
      try {
        await this.refreshClientStates();
        await this.cleanupOldSyncFiles();
      } catch (error) {
        console.warn('Sync monitoring error:', error.message);
      }
    }, this.syncIntervalMs);
  }
  
  /**
   * Stop sync monitoring
   */
  stopSyncMonitoring() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
  
  /**
   * Refresh client states from disk
   */
  async refreshClientStates() {
    try {
      const files = await fs.readdir(this.syncDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const clientId = file.replace('.json', '');
        const content = await fs.readFile(
          path.join(this.syncDir, file), 
          'utf-8'
        );
        const clientInfo = JSON.parse(content);
        
        // Only include if not too old
        if (Date.now() - clientInfo.lastUpdate < this.maxSyncAge) {
          this.clientStates.set(clientId, clientInfo);
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Error refreshing client states:', error.message);
      }
    }
  }
  
  /**
   * Clean up old sync files
   */
  async cleanupOldSyncFiles() {
    const now = Date.now();
    const dirs = [this.syncDir, path.join(this.syncDir, 'artifacts'), path.join(this.syncDir, 'coordinations')];
    
    for (const dir of dirs) {
      try {
        const files = await fs.readdir(dir);
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          const filePath = path.join(dir, file);
          const stats = await fs.stat(filePath);
          
          if (now - stats.mtime.getTime() > this.maxSyncAge) {
            await fs.unlink(filePath);
          }
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          console.warn(`Error cleaning up ${dir}:`, error.message);
        }
      }
    }
  }
  
  /**
   * Notify clients of state change
   */
  async notifyStateChange(clientId, changes) {
    // In a real implementation, this could use IPC, webhooks, or file watching
    // For now, we'll create a notification file
    const notification = {
      type: 'state_change',
      source: clientId,
      changes,
      timestamp: Date.now(),
    };
    
    const notifFile = path.join(
      this.syncDir,
      'notifications',
      `${Date.now()}-${clientId}.json`
    );
    
    await fs.mkdir(path.dirname(notifFile), { recursive: true });
    await fs.writeFile(notifFile, JSON.stringify(notification, null, 2));
  }
  
  /**
   * Notify clients of shared artifact
   */
  async notifyArtifactShared(artifact) {
    const notification = {
      type: 'artifact_shared',
      artifact,
      timestamp: Date.now(),
    };
    
    const notifFile = path.join(
      this.syncDir,
      'notifications',
      `${Date.now()}-artifact.json`
    );
    
    await fs.mkdir(path.dirname(notifFile), { recursive: true });
    await fs.writeFile(notifFile, JSON.stringify(notification, null, 2));
  }
  
  /**
   * Notify clients of coordination request
   */
  async notifyCoordinationRequest(coordination) {
    const notification = {
      type: 'coordination_request',
      coordination,
      timestamp: Date.now(),
    };
    
    const notifFile = path.join(
      this.syncDir,
      'notifications',
      `${Date.now()}-coord.json`
    );
    
    await fs.mkdir(path.dirname(notifFile), { recursive: true });
    await fs.writeFile(notifFile, JSON.stringify(notification, null, 2));
  }
  
  /**
   * Get pending notifications for a client
   */
  async getNotifications(clientId, since = 0) {
    const notifDir = path.join(this.syncDir, 'notifications');
    const notifications = [];
    
    try {
      const files = await fs.readdir(notifDir);
      
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        
        const timestamp = parseInt(file.split('-')[0]);
        if (timestamp <= since) continue;
        
        const content = await fs.readFile(
          path.join(notifDir, file),
          'utf-8'
        );
        const notification = JSON.parse(content);
        
        // Filter by relevance to client
        if (notification.source && notification.source === clientId) continue;
        if (notification.coordination?.initiator === clientId) continue;
        
        notifications.push(notification);
      }
      
      return notifications.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }
  
  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Clean up and close
   */
  async close() {
    this.stopSyncMonitoring();
    this.clientStates.clear();
  }
}