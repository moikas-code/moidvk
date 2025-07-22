import { readFile, writeFile, mkdir, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { homedir } from 'os';

/**
 * Session Tracker for cross-MCP session continuity
 * Manages development sessions with persistence and progress tracking
 */
export class SessionTracker {
  constructor() {
    this.sessions = new Map();
    this.currentSessionId = null;
    this.sessionStorePath = join(homedir(), '.moidvk', 'sessions');
    this.maxSessionAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  }

  /**
   * Initialize session tracker
   */
  async initialize() {
    try {
      // Ensure session storage directory exists
      await mkdir(this.sessionStorePath, { recursive: true });
      
      // Load existing sessions
      await this.loadSessions();
      
      // Clean up old sessions
      await this.cleanupOldSessions();
    } catch (error) {
      console.error('Failed to initialize session tracker:', error.message);
    }
  }

  /**
   * Create a new development session
   */
  async createSession(options = {}) {
    const { goals = [], context = {}, clientType = 'unknown' } = options;
    
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      timestamp: Date.now(),
      startTime: Date.now(),
      lastActivity: Date.now(),
      clientType,
      goals: goals.map(g => ({
        id: this.generateId(),
        description: g,
        status: 'pending',
        createdAt: Date.now(),
        completedAt: null,
      })),
      context,
      state: 'active',
      progress: 0,
      achievements: [],
      checkpoints: [],
      filesModified: [],
      toolsUsed: new Map(),
      qualityMetrics: {
        initialScore: null,
        currentScore: null,
        improvements: [],
      },
      insights: [],
      errors: [],
    };

    this.sessions.set(sessionId, session);
    this.currentSessionId = sessionId;
    
    // Persist session
    await this.saveSession(session);
    
    return session;
  }

  /**
   * Resume an existing session
   */
  async resumeSession(sessionId) {
    if (!this.sessions.has(sessionId)) {
      // Try to load from disk
      const loaded = await this.loadSession(sessionId);
      if (!loaded) {
        throw new Error(`Session ${sessionId} not found`);
      }
    }

    const session = this.sessions.get(sessionId);
    session.lastActivity = Date.now();
    session.state = 'active';
    this.currentSessionId = sessionId;
    
    // Update session
    await this.saveSession(session);
    
    return session;
  }

  /**
   * Create a checkpoint in the current session
   */
  async createCheckpoint(sessionId = null) {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      throw new Error('No active session');
    }

    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    const checkpoint = {
      id: this.generateId(),
      timestamp: Date.now(),
      progress: this.calculateProgress(session),
      filesModified: [...session.filesModified],
      qualityScore: session.qualityMetrics.currentScore,
      state: session.state,
      achievements: [...session.achievements],
    };

    session.checkpoints.push(checkpoint);
    session.lastActivity = Date.now();
    
    // Persist session
    await this.saveSession(session);
    
    return checkpoint;
  }

  /**
   * Analyze a session
   */
  async analyzeSession(sessionId = null) {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      throw new Error('No active session');
    }

    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    const duration = this.formatDuration(Date.now() - session.startTime);
    const progress = this.calculateProgress(session);
    const productivityScore = this.calculateProductivityScore(session);
    const toolsUsed = this.getTopTools(session);
    const qualityTrend = this.analyzeQualityTrend(session);
    const achievements = this.identifyAchievements(session);
    const optimizations = this.suggestOptimizations(session);

    return {
      sessionId: id,
      duration,
      progress,
      productivityScore,
      toolsUsed,
      qualityTrend,
      achievements,
      optimizations,
      goals: session.goals,
      filesModified: session.filesModified.length,
      checkpoints: session.checkpoints.length,
      errors: session.errors.length,
    };
  }

  /**
   * Export session data
   */
  async exportSession(sessionId = null, format = 'json') {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      throw new Error('No active session');
    }

    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    // Convert Maps to objects for serialization
    const exportData = {
      ...session,
      toolsUsed: Object.fromEntries(session.toolsUsed),
      exportedAt: Date.now(),
      version: '1.0',
    };

    if (format === 'json') {
      return JSON.stringify(exportData, null, 2);
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Import session data
   */
  async importSession(data, format = 'json') {
    let sessionData;
    
    if (format === 'json') {
      sessionData = typeof data === 'string' ? JSON.parse(data) : data;
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }

    // Convert objects back to Maps
    if (sessionData.toolsUsed && !(sessionData.toolsUsed instanceof Map)) {
      sessionData.toolsUsed = new Map(Object.entries(sessionData.toolsUsed));
    }

    // Generate new ID if importing
    const newId = this.generateSessionId();
    sessionData.id = newId;
    sessionData.importedAt = Date.now();
    sessionData.originalId = sessionData.id;

    this.sessions.set(newId, sessionData);
    
    // Persist imported session
    await this.saveSession(sessionData);
    
    return sessionData;
  }

  /**
   * Update session goals
   */
  async updateGoals(goals, sessionId = null) {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      throw new Error('No active session');
    }

    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    // Add new goals
    for (const goal of goals) {
      if (!session.goals.find(g => g.description === goal)) {
        session.goals.push({
          id: this.generateId(),
          description: goal,
          status: 'pending',
          createdAt: Date.now(),
          completedAt: null,
        });
      }
    }

    session.lastActivity = Date.now();
    await this.saveSession(session);
    
    return session.goals;
  }

  /**
   * Mark goal as completed
   */
  async completeGoal(goalId, sessionId = null) {
    const id = sessionId || this.currentSessionId;
    if (!id) {
      throw new Error('No active session');
    }

    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    const goal = session.goals.find(g => g.id === goalId);
    if (goal) {
      goal.status = 'completed';
      goal.completedAt = Date.now();
      
      // Check for achievements
      this.checkAchievements(session);
      
      session.lastActivity = Date.now();
      await this.saveSession(session);
    }

    return goal;
  }

  /**
   * Track tool usage
   */
  async trackToolUsage(toolName, duration, success = true, sessionId = null) {
    const id = sessionId || this.currentSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (!session) return;

    const usage = session.toolsUsed.get(toolName) || {
      count: 0,
      totalDuration: 0,
      avgDuration: 0,
      successCount: 0,
      failureCount: 0,
    };

    usage.count++;
    usage.totalDuration += duration;
    usage.avgDuration = usage.totalDuration / usage.count;
    
    if (success) {
      usage.successCount++;
    } else {
      usage.failureCount++;
    }

    session.toolsUsed.set(toolName, usage);
    session.lastActivity = Date.now();
    
    // Don't await to avoid blocking
    this.saveSession(session).catch(console.error);
  }

  /**
   * Track file modification
   */
  async trackFileModification(filePath, action = 'modified', sessionId = null) {
    const id = sessionId || this.currentSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (!session) return;

    const existing = session.filesModified.find(f => f.path === filePath);
    if (existing) {
      existing.actions.push({ action, timestamp: Date.now() });
      existing.lastModified = Date.now();
    } else {
      session.filesModified.push({
        path: filePath,
        firstModified: Date.now(),
        lastModified: Date.now(),
        actions: [{ action, timestamp: Date.now() }],
      });
    }

    session.lastActivity = Date.now();
    
    // Don't await to avoid blocking
    this.saveSession(session).catch(console.error);
  }

  /**
   * Update quality metrics
   */
  async updateQualityMetrics(metrics, sessionId = null) {
    const id = sessionId || this.currentSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (!session) return;

    if (session.qualityMetrics.initialScore === null) {
      session.qualityMetrics.initialScore = metrics.score;
    }
    
    session.qualityMetrics.currentScore = metrics.score;
    session.qualityMetrics.improvements.push({
      timestamp: Date.now(),
      score: metrics.score,
      issues: metrics.issues || 0,
      tool: metrics.tool,
    });

    session.lastActivity = Date.now();
    
    // Don't await to avoid blocking
    this.saveSession(session).catch(console.error);
  }

  /**
   * Add insight to session
   */
  async addInsight(insight, sessionId = null) {
    const id = sessionId || this.currentSessionId;
    if (!id) return;

    const session = this.sessions.get(id);
    if (!session) return;

    session.insights.push({
      id: this.generateId(),
      timestamp: Date.now(),
      type: insight.type || 'general',
      message: insight.message,
      data: insight.data || {},
    });

    session.lastActivity = Date.now();
    
    // Don't await to avoid blocking
    this.saveSession(session).catch(console.error);
  }

  /**
   * Helper methods
   */

  calculateProgress(session) {
    if (session.goals.length === 0) return 0;
    
    const completed = session.goals.filter(g => g.status === 'completed').length;
    return Math.round((completed / session.goals.length) * 100);
  }

  calculateProductivityScore(session) {
    let score = 50; // Base score
    
    // Goal completion
    const progress = this.calculateProgress(session);
    score += progress * 0.3;
    
    // Tool efficiency (success rate)
    let totalSuccess = 0;
    let totalCount = 0;
    session.toolsUsed.forEach(usage => {
      totalSuccess += usage.successCount;
      totalCount += usage.count;
    });
    
    if (totalCount > 0) {
      const successRate = totalSuccess / totalCount;
      score += successRate * 20;
    }
    
    // Quality improvement
    if (session.qualityMetrics.initialScore && session.qualityMetrics.currentScore) {
      const improvement = session.qualityMetrics.currentScore - session.qualityMetrics.initialScore;
      score += Math.max(0, improvement * 0.5);
    }
    
    // Checkpoint usage (indicates good practice)
    score += Math.min(10, session.checkpoints.length * 2);
    
    return Math.min(100, Math.round(score));
  }

  getTopTools(session) {
    const tools = Array.from(session.toolsUsed.entries())
      .map(([name, usage]) => ({ name, ...usage }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(t => t.name);
    
    return tools;
  }

  analyzeQualityTrend(session) {
    const improvements = session.qualityMetrics.improvements;
    if (improvements.length < 2) return 'insufficient_data';
    
    const recent = improvements.slice(-5);
    const avgRecent = recent.reduce((sum, i) => sum + i.score, 0) / recent.length;
    const avgInitial = improvements.slice(0, Math.min(5, Math.floor(improvements.length / 2)))
      .reduce((sum, i) => sum + i.score, 0) / Math.min(5, Math.floor(improvements.length / 2));
    
    if (avgRecent > avgInitial + 5) return 'improving';
    if (avgRecent < avgInitial - 5) return 'declining';
    return 'stable';
  }

  identifyAchievements(session) {
    const achievements = [...session.achievements];
    
    // Check for new achievements
    if (session.goals.filter(g => g.status === 'completed').length >= 5) {
      if (!achievements.includes('goal_crusher')) {
        achievements.push('goal_crusher');
      }
    }
    
    if (session.qualityMetrics.currentScore >= 90) {
      if (!achievements.includes('quality_champion')) {
        achievements.push('quality_champion');
      }
    }
    
    if (session.filesModified.length >= 10) {
      if (!achievements.includes('prolific_developer')) {
        achievements.push('prolific_developer');
      }
    }
    
    return achievements;
  }

  suggestOptimizations(session) {
    const suggestions = [];
    
    // Tool usage patterns
    const mostUsedTool = Array.from(session.toolsUsed.entries())
      .sort(([, a], [, b]) => b.count - a.count)[0];
    
    if (mostUsedTool && mostUsedTool[1].failureCount > mostUsedTool[1].successCount * 0.2) {
      suggestions.push(`Consider reviewing usage of ${mostUsedTool[0]} - high failure rate detected`);
    }
    
    // Quality trends
    if (this.analyzeQualityTrend(session) === 'declining') {
      suggestions.push('Code quality is declining - consider running comprehensive checks');
    }
    
    // Session duration
    const duration = Date.now() - session.startTime;
    if (duration > 4 * 60 * 60 * 1000 && session.checkpoints.length === 0) {
      suggestions.push('Long session without checkpoints - consider creating checkpoints regularly');
    }
    
    // Incomplete goals
    const pendingGoals = session.goals.filter(g => g.status === 'pending').length;
    if (pendingGoals > 5) {
      suggestions.push('Many pending goals - consider prioritizing or breaking down tasks');
    }
    
    return suggestions;
  }

  checkAchievements(session) {
    const newAchievements = this.identifyAchievements(session);
    
    // Add new achievements
    for (const achievement of newAchievements) {
      if (!session.achievements.includes(achievement)) {
        session.achievements.push(achievement);
        
        // Add insight
        this.addInsight({
          type: 'achievement',
          message: `Achievement unlocked: ${achievement}`,
          data: { achievement },
        }, session.id);
      }
    }
  }

  formatDuration(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h ${minutes % 60}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Persistence methods
   */

  async saveSession(session) {
    try {
      const filePath = join(this.sessionStorePath, `${session.id}.json`);
      
      // Convert Maps to objects for serialization
      const data = {
        ...session,
        toolsUsed: Object.fromEntries(session.toolsUsed),
      };
      
      await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error(`Failed to save session ${session.id}:`, error.message);
    }
  }

  async loadSession(sessionId) {
    try {
      const filePath = join(this.sessionStorePath, `${sessionId}.json`);
      const data = JSON.parse(await readFile(filePath, 'utf8'));
      
      // Convert objects back to Maps
      if (data.toolsUsed && !(data.toolsUsed instanceof Map)) {
        data.toolsUsed = new Map(Object.entries(data.toolsUsed));
      }
      
      this.sessions.set(sessionId, data);
      return data;
    } catch (error) {
      return null;
    }
  }

  async loadSessions() {
    try {
      const files = await readdir(this.sessionStorePath);
      const sessionFiles = files.filter(f => f.endsWith('.json'));
      
      for (const file of sessionFiles) {
        const sessionId = file.replace('.json', '');
        await this.loadSession(sessionId);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error.message);
    }
  }

  async cleanupOldSessions() {
    const now = Date.now();
    const toDelete = [];
    
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > this.maxSessionAge) {
        toDelete.push(id);
      }
    }
    
    for (const id of toDelete) {
      this.sessions.delete(id);
      try {
        const filePath = join(this.sessionStorePath, `${id}.json`);
        await unlink(filePath);
      } catch (error) {
        // Ignore errors
      }
    }
  }

  /**
   * Get active sessions
   */
  getActiveSessions() {
    const active = [];
    const now = Date.now();
    
    for (const [id, session] of this.sessions) {
      if (session.state === 'active' && now - session.lastActivity < 60 * 60 * 1000) {
        active.push({
          id,
          clientType: session.clientType,
          goals: session.goals.map(g => g.description),
          progress: this.calculateProgress(session),
          lastActivity: session.lastActivity,
        });
      }
    }
    
    return active;
  }
}