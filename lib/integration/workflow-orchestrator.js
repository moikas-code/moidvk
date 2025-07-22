/**
 * Workflow Orchestrator
 * Combines all intelligent components to orchestrate complex development workflows
 */

import { ContextManager } from '../intelligence/context-manager.js';
import { WorkflowOptimizer } from '../intelligence/workflow-optimizer.js';
import { SessionTracker } from '../intelligence/session-tracker.js';
import { PatternRecognizer } from '../intelligence/pattern-recognizer.js';
import { DecisionHelper } from '../intelligence/decision-helper.js';
import { DevelopmentStateMachine } from '../reasoning/state-machine.js';
import { DecisionTree } from '../reasoning/decision-tree.js';
import { ContextRouter } from '../reasoning/context-router.js';
import { FeedbackLoop } from '../reasoning/feedback-loop.js';
import { SemanticSearch } from '../local-ai/semantic-search.js';
import { IntentRecognizer } from '../local-ai/intent-recognition.js';
import { KnowledgeGraph } from '../local-ai/knowledge-graph.js';
import { SmartSuggestionsGenerator } from '../local-ai/smart-suggestions.js';
import { CrossClientSynchronizer } from './cross-client-sync.js';
import { ToolEnhancer } from './tool-enhancer.js';

export class WorkflowOrchestrator {
  constructor() {
    this.components = {
      context: null,
      optimizer: null,
      session: null,
      patterns: null,
      decisions: null,
      stateMachine: null,
      decisionTree: null,
      router: null,
      feedback: null,
      search: null,
      intent: null,
      graph: null,
      suggestions: null,
      sync: null,
      enhancer: null,
    };
    
    this.initialized = false;
    this.activeWorkflows = new Map();
    this.workflowHistory = [];
    this.maxHistorySize = 100;
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize all components
      this.components.context = new ContextManager();
      await this.components.context.initialize();
      
      this.components.optimizer = new WorkflowOptimizer();
      this.components.session = new SessionTracker();
      this.components.patterns = new PatternRecognizer();
      await this.components.patterns.initialize();
      
      this.components.decisions = new DecisionHelper();
      this.components.stateMachine = new DevelopmentStateMachine();
      this.components.decisionTree = new DecisionTree();
      this.components.router = new ContextRouter();
      this.components.feedback = new FeedbackLoop();
      
      this.components.search = new SemanticSearch();
      await this.components.search.initialize();
      
      this.components.intent = new IntentRecognizer();
      await this.components.intent.initialize();
      
      this.components.graph = new KnowledgeGraph();
      this.components.suggestions = new SmartSuggestionsGenerator();
      await this.components.suggestions.initialize();
      
      this.components.sync = new CrossClientSynchronizer();
      await this.components.sync.initialize();
      
      this.components.enhancer = new ToolEnhancer();
      await this.components.enhancer.initialize();
      
      this.initialized = true;
    } catch (error) {
      console.warn('WorkflowOrchestrator initialization warning:', error.message);
      // Continue with partial initialization
      this.initialized = true;
    }
  }
  
  /**
   * Start a new workflow
   */
  async startWorkflow(options = {}) {
    const {
      type = 'general',
      goals = [],
      context = {},
      clientType = 'unknown',
      sessionId = null,
    } = options;
    
    await this.initialize();
    
    // Create workflow instance
    const workflow = {
      id: this.generateWorkflowId(),
      type,
      goals,
      context,
      clientType,
      sessionId,
      startTime: Date.now(),
      status: 'active',
      steps: [],
      results: [],
      metrics: {
        toolsUsed: 0,
        stateTransitions: 0,
        suggestionsGenerated: 0,
        patternsRecognized: 0,
        decisionsМade: 0,
      },
    };
    
    // Initialize context
    await this.components.context.initializeContext(clientType, context.projectPath || '.', sessionId);
    
    // Create or update session
    if (sessionId) {
      await this.components.session.updateSession(sessionId, { goals });
    } else {
      const session = await this.components.session.createSession({ goals, context, clientType });
      workflow.sessionId = session.id;
    }
    
    // Initialize state machine
    await this.components.stateMachine.initialize(this.components.context.getCurrentContext());
    
    // Register with sync
    await this.components.sync.registerClient(workflow.id, clientType, {
      activeWorkflow: type,
      goals,
      currentFocus: context.currentFile,
    });
    
    this.activeWorkflows.set(workflow.id, workflow);
    
    return workflow;
  }
  
  /**
   * Execute a workflow step
   */
  async executeStep(workflowId, step) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    const stepResult = {
      id: this.generateStepId(),
      type: step.type,
      input: step.input,
      startTime: Date.now(),
      status: 'running',
      results: [],
      errors: [],
    };
    
    workflow.steps.push(stepResult);
    
    try {
      switch (step.type) {
        case 'analyze':
          stepResult.results = await this.executeAnalysisStep(workflow, step);
          break;
        
        case 'optimize':
          stepResult.results = await this.executeOptimizationStep(workflow, step);
          break;
        
        case 'decide':
          stepResult.results = await this.executeDecisionStep(workflow, step);
          break;
        
        case 'search':
          stepResult.results = await this.executeSearchStep(workflow, step);
          break;
        
        case 'suggest':
          stepResult.results = await this.executeSuggestionStep(workflow, step);
          break;
        
        case 'coordinate':
          stepResult.results = await this.executeCoordinationStep(workflow, step);
          break;
        
        case 'execute_tools':
          stepResult.results = await this.executeToolsStep(workflow, step);
          break;
        
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }
      
      stepResult.status = 'completed';
      stepResult.endTime = Date.now();
      
      // Update metrics
      this.updateWorkflowMetrics(workflow, stepResult);
      
      // Record feedback
      await this.components.feedback.recordOutcome({
        workflowId,
        stepId: stepResult.id,
        success: true,
        duration: stepResult.endTime - stepResult.startTime,
        resultsCount: stepResult.results.length,
      });
      
    } catch (error) {
      stepResult.status = 'failed';
      stepResult.errors.push({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now(),
      });
      
      // Record failure
      await this.components.feedback.recordOutcome({
        workflowId,
        stepId: stepResult.id,
        success: false,
        error: error.message,
      });
    }
    
    return stepResult;
  }
  
  /**
   * Execute analysis step
   */
  async executeAnalysisStep(workflow, step) {
    const results = [];
    
    // Analyze project context
    const context = await this.components.context.getCurrentContext();
    results.push({
      type: 'context_analysis',
      data: context,
    });
    
    // Recognize patterns
    const patterns = await this.components.patterns.recognizePatterns({
      context,
      recentActions: workflow.steps.slice(-10),
    });
    results.push({
      type: 'pattern_recognition',
      data: patterns,
    });
    workflow.metrics.patternsRecognized += patterns.length;
    
    // Analyze intent
    if (step.input.query) {
      const intent = await this.components.intent.recognizeIntent(step.input.query);
      results.push({
        type: 'intent_analysis',
        data: intent,
      });
    }
    
    // Build knowledge graph
    if (step.input.buildGraph) {
      const graph = await this.components.graph.buildFromProject(context.project);
      results.push({
        type: 'knowledge_graph',
        data: {
          nodes: graph.nodes.size,
          edges: graph.edges.length,
          insights: await this.components.graph.getInsights(),
        },
      });
    }
    
    return results;
  }
  
  /**
   * Execute optimization step
   */
  async executeOptimizationStep(workflow, step) {
    const results = [];
    
    // Generate optimal tool sequence
    const sequence = await this.components.optimizer.generateOptimalSequence({
      files: step.input.files || [],
      context: workflow.context,
      goals: workflow.goals,
    });
    
    results.push({
      type: 'tool_sequence',
      data: sequence,
    });
    
    // Optimize based on patterns
    const patterns = await this.components.patterns.getRecentPatterns();
    const optimizations = this.components.optimizer.optimizeBasedOnPatterns(patterns);
    
    results.push({
      type: 'pattern_optimizations',
      data: optimizations,
    });
    
    return results;
  }
  
  /**
   * Execute decision step
   */
  async executeDecisionStep(workflow, step) {
    const results = [];
    
    // Make decision using decision tree
    const decision = await this.components.decisionTree.makeDecision(
      workflow.context,
      step.input.decisionType || 'development_approach'
    );
    
    results.push({
      type: 'decision_tree',
      data: decision,
    });
    workflow.metrics.decisionsМade++;
    
    // Get recommendations from decision helper
    const recommendations = await this.components.decisions.getRecommendations({
      context: workflow.context,
      goals: workflow.goals,
      currentState: await this.components.stateMachine.getCurrentState(),
    });
    
    results.push({
      type: 'recommendations',
      data: recommendations,
    });
    
    // Route based on context
    const route = await this.components.router.route({
      context: workflow.context,
      intent: step.input.intent,
      capabilities: step.input.capabilities || [],
    });
    
    results.push({
      type: 'context_route',
      data: route,
    });
    
    return results;
  }
  
  /**
   * Execute search step
   */
  async executeSearchStep(workflow, step) {
    const results = [];
    
    // Perform semantic search
    const searchResults = await this.components.search.search({
      query: step.input.query,
      type: step.input.searchType || 'similar_code',
      searchPath: step.input.searchPath || '.',
      maxResults: step.input.maxResults || 10,
      context: workflow.context,
    });
    
    results.push({
      type: 'semantic_search',
      data: searchResults,
    });
    
    // Search in knowledge graph
    if (this.components.graph.nodes.size > 0) {
      const graphResults = await this.components.graph.searchRelated(
        step.input.query,
        step.input.relationTypes
      );
      
      results.push({
        type: 'graph_search',
        data: graphResults,
      });
    }
    
    return results;
  }
  
  /**
   * Execute suggestion step
   */
  async executeSuggestionStep(workflow, step) {
    const results = [];
    
    // Generate smart suggestions
    const suggestions = await this.components.suggestions.generateSuggestions({
      context: workflow.context,
      files: step.input.files || [],
      recentActions: workflow.steps.slice(-5).map(s => ({
        tool: s.type,
        timestamp: s.startTime,
      })),
      currentState: await this.components.stateMachine.getCurrentState(),
      requestedTypes: step.input.suggestionTypes || ['next_steps', 'code_improvements'],
    });
    
    results.push({
      type: 'smart_suggestions',
      data: suggestions,
    });
    workflow.metrics.suggestionsGenerated += suggestions.length;
    
    // Get decision helper recommendations
    const helperSuggestions = await this.components.decisions.getRecommendations({
      context: workflow.context,
      goals: workflow.goals,
    });
    
    results.push({
      type: 'decision_recommendations',
      data: helperSuggestions,
    });
    
    return results;
  }
  
  /**
   * Execute coordination step
   */
  async executeCoordinationStep(workflow, step) {
    const results = [];
    
    // Get synchronized context
    const syncContext = await this.components.sync.getSynchronizedContext();
    results.push({
      type: 'sync_context',
      data: syncContext,
    });
    
    // Share artifact if specified
    if (step.input.artifact) {
      const shared = await this.components.sync.shareArtifact({
        type: step.input.artifact.type,
        source: workflow.id,
        content: step.input.artifact.content,
        metadata: step.input.artifact.metadata,
      });
      
      results.push({
        type: 'shared_artifact',
        data: shared,
      });
    }
    
    // Coordinate action if specified
    if (step.input.coordination) {
      const coordination = await this.components.sync.coordinateAction({
        type: step.input.coordination.type,
        initiator: workflow.id,
        target: step.input.coordination.target,
        payload: step.input.coordination.payload,
      });
      
      results.push({
        type: 'coordination_request',
        data: coordination,
      });
    }
    
    return results;
  }
  
  /**
   * Execute tools step
   */
  async executeToolsStep(workflow, step) {
    const results = [];
    const { tools = [], sequential = false } = step.input;
    
    // Update state machine
    await this.components.stateMachine.transition('IMPLEMENTING');
    workflow.metrics.stateTransitions++;
    
    if (sequential) {
      // Execute tools sequentially
      for (const tool of tools) {
        const result = await this.executeTool(tool, workflow);
        results.push(result);
        
        // Update context after each tool
        await this.components.context.updateToolUsage(tool.name);
        workflow.metrics.toolsUsed++;
      }
    } else {
      // Execute tools in parallel
      const promises = tools.map(tool => this.executeTool(tool, workflow));
      const toolResults = await Promise.all(promises);
      results.push(...toolResults);
      
      // Update context
      for (const tool of tools) {
        await this.components.context.updateToolUsage(tool.name);
      }
      workflow.metrics.toolsUsed += tools.length;
    }
    
    // Record patterns
    await this.components.patterns.recordEvent({
      type: 'tool_execution',
      tools: tools.map(t => t.name),
      sequential,
      workflowType: workflow.type,
      timestamp: Date.now(),
    });
    
    return results;
  }
  
  /**
   * Execute a single tool
   */
  async executeTool(tool, workflow) {
    // This would integrate with actual tool handlers
    // For now, return a mock result
    return {
      tool: tool.name,
      args: tool.args,
      result: {
        success: true,
        output: `Executed ${tool.name}`,
      },
      timestamp: Date.now(),
    };
  }
  
  /**
   * Complete a workflow
   */
  async completeWorkflow(workflowId, summary = {}) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }
    
    workflow.status = 'completed';
    workflow.endTime = Date.now();
    workflow.duration = workflow.endTime - workflow.startTime;
    workflow.summary = summary;
    
    // Update session
    if (workflow.sessionId) {
      await this.components.session.updateSession(workflow.sessionId, {
        lastActivity: Date.now(),
        completedWorkflows: 1,
      });
    }
    
    // Record in history
    this.workflowHistory.push({
      id: workflow.id,
      type: workflow.type,
      duration: workflow.duration,
      metrics: workflow.metrics,
      summary: workflow.summary,
      timestamp: workflow.endTime,
    });
    
    // Trim history
    if (this.workflowHistory.length > this.maxHistorySize) {
      this.workflowHistory.shift();
    }
    
    // Clean up
    this.activeWorkflows.delete(workflowId);
    
    // Update state machine
    await this.components.stateMachine.transition('COMPLETED');
    
    return workflow;
  }
  
  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (!workflow) {
      return null;
    }
    
    return {
      id: workflow.id,
      type: workflow.type,
      status: workflow.status,
      duration: Date.now() - workflow.startTime,
      steps: workflow.steps.length,
      lastStep: workflow.steps[workflow.steps.length - 1],
      metrics: workflow.metrics,
    };
  }
  
  /**
   * Get active workflows
   */
  getActiveWorkflows() {
    return Array.from(this.activeWorkflows.values()).map(w => ({
      id: w.id,
      type: w.type,
      status: w.status,
      duration: Date.now() - w.startTime,
      goals: w.goals,
    }));
  }
  
  /**
   * Update workflow metrics
   */
  updateWorkflowMetrics(workflow, stepResult) {
    // Update based on step type and results
    if (stepResult.type === 'suggest') {
      const suggestions = stepResult.results.find(r => r.type === 'smart_suggestions');
      if (suggestions) {
        workflow.metrics.suggestionsGenerated += suggestions.data.length;
      }
    }
  }
  
  /**
   * Generate workflow ID
   */
  generateWorkflowId() {
    return `wf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Generate step ID
   */
  generateStepId() {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get workflow insights
   */
  async getWorkflowInsights() {
    const insights = {
      activeWorkflows: this.activeWorkflows.size,
      totalCompleted: this.workflowHistory.length,
      averageDuration: 0,
      commonPatterns: [],
      toolUsageStats: {},
      successRate: 0,
    };
    
    if (this.workflowHistory.length > 0) {
      // Calculate average duration
      const totalDuration = this.workflowHistory.reduce((sum, w) => sum + w.duration, 0);
      insights.averageDuration = totalDuration / this.workflowHistory.length;
      
      // Get common patterns
      insights.commonPatterns = await this.components.patterns.getCommonPatterns();
      
      // Calculate tool usage stats
      for (const workflow of this.workflowHistory) {
        for (const [tool, count] of Object.entries(workflow.metrics)) {
          insights.toolUsageStats[tool] = (insights.toolUsageStats[tool] || 0) + count;
        }
      }
      
      // Calculate success rate
      const successful = this.workflowHistory.filter(w => w.summary?.success).length;
      insights.successRate = successful / this.workflowHistory.length;
    }
    
    return insights;
  }
}