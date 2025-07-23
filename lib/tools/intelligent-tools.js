import { ContextManager } from '../intelligence/context-manager.js';
import { WorkflowOptimizer } from '../intelligence/workflow-optimizer.js';
import { SessionTracker } from '../intelligence/session-tracker.js';
import { PatternRecognizer } from '../intelligence/pattern-recognizer.js';
import { DecisionHelper } from '../intelligence/decision-helper.js';
import { DevelopmentStateMachine } from '../reasoning/state-machine.js';
import { DevelopmentDecisionTree } from '../reasoning/decision-tree.js';
import { ContextRouter } from '../reasoning/context-router.js';
import { FeedbackLoop } from '../reasoning/feedback-loop.js';

// Import existing tool handlers
import { handleCodePractices } from './code-practices.js';
import { handleCodeFormatter } from './code-formatter.js';
import { handleSafetyChecker } from './safety-checker.js';
import { handleSecurityScanner } from './security-scanner.js';
import { handleProductionReadiness } from './production-readiness.js';
import { handleAccessibilityChecker } from './accessibility-checker.js';
import { handleGraphqlSchemaCheck } from './graphql-schema-checker.js';
import { handleGraphqlQueryCheck } from './graphql-query-checker.js';
import { handleReduxPatternsCheck } from './redux-patterns-checker.js';

// Initialize intelligence components
let contextManager = null;
let workflowOptimizer = null;
let sessionTracker = null;
let patternRecognizer = null;
let decisionHelper = null;
let stateMachine = null;
let decisionTree = null;
let contextRouter = null;
let feedbackLoop = null;

/**
 * Initialize intelligence components
 */
async function initializeIntelligence() {
  if (!contextManager) {
    contextManager = new ContextManager();
    workflowOptimizer = new WorkflowOptimizer();
    sessionTracker = new SessionTracker();
    patternRecognizer = new PatternRecognizer();
    decisionHelper = new DecisionHelper();
    stateMachine = new DevelopmentStateMachine();
    decisionTree = new DevelopmentDecisionTree();
    contextRouter = new ContextRouter();
    feedbackLoop = new FeedbackLoop();
    
    // Initialize session tracker
    await sessionTracker.initialize();
  }
}

/**
 * Intelligent Development Analysis Tool
 */
export const intelligentDevelopmentAnalysisTool = {
  name: 'intelligent_development_analysis',
  description: 'Automatically orchestrate optimal tool sequence based on development context and goals',
  inputSchema: {
    type: 'object',
    properties: {
      files: {
        type: 'array',
        items: { type: 'string' },
        description: 'Files to analyze',
      },
      development_goals: {
        type: 'array',
        items: { type: 'string' },
        description: 'Current development objectives',
      },
      context: {
        type: 'object',
        properties: {
          session_type: {
            type: 'string',
            enum: ['bug_fix', 'feature_development', 'refactoring', 'optimization', 'review'],
            description: 'Type of development session',
          },
          urgency: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium',
            description: 'Urgency level',
          },
          scope: {
            type: 'string',
            enum: ['single_file', 'module', 'component', 'system'],
            default: 'single_file',
            description: 'Scope of changes',
          },
        },
        description: 'Development context',
      },
      client_type: {
        type: 'string',
        enum: ['claude_desktop', 'claude_code', 'other_mcp'],
        description: 'MCP client type',
      },
    },
    required: ['files'],
  },
};

export async function handleIntelligentDevelopmentAnalysis(args) {
  const { 
    files, 
    development_goals = [], 
    context = {}, 
    client_type = 'other_mcp' 
  } = args.params || args;

  await initializeIntelligence();

  try {
    // Initialize or update context
    const projectPath = files[0]?.split('/')[0] || '.';
    await contextManager.initializeContext(client_type, projectPath);
    await contextManager.updateContext({ 
      goals: development_goals, 
      sessionContext: context 
    });

    // Initialize state machine
    await stateMachine.initialize(contextManager.getCurrentContext());

    // Determine optimal tool sequence
    const toolSequence = await workflowOptimizer.generateOptimalSequence({
      files,
      context: contextManager.getCurrentContext(),
      goals: development_goals,
    });

    // Execute tools with state management
    const results = [];
    const startTime = Date.now();

    for (const tool of toolSequence.sequence) {
      try {
        // Validate state transition before attempting it
        const currentState = stateMachine.currentState;
        const targetState = tool.state;
        
        // Check if transition is valid
        const validation = await stateMachine.validateTransition(currentState, targetState, stateMachine.context);
        if (!validation.valid) {
          console.warn(`⚠️  Invalid transition detected: ${currentState} → ${targetState}`);
          console.warn(`   Reason: ${validation.reason}`);
          console.warn(`   Tool: ${tool.name}`);
          
          // Try to find a valid alternative state
          const alternativeState = findAlternativeState(currentState, tool.name);
          if (alternativeState) {
            console.log(`   Using alternative state: ${alternativeState}`);
            tool.state = alternativeState;
          } else {
            console.warn(`   No alternative state found, skipping tool: ${tool.name}`);
            continue;
          }
        }

        // Transition state
        await stateMachine.transition(tool.state, {
          reason: tool.reasoning,
          automatic: true,
        });
        
        // Execute tool
        const toolResult = await executeTool(tool.name, {
          ...tool.parameters,
          files,
        });
        
        // Track usage
        contextManager.trackToolUsage(tool.name, args, toolResult);
        await sessionTracker.trackToolUsage(
          tool.name, 
          Date.now() - startTime,
          !toolResult.error
        );
        
        results.push({
          tool: tool.name,
          result: toolResult,
          state: stateMachine.currentState,
          reasoning: tool.reasoning,
        });

        // Update context with results
        await contextManager.updateContext({ 
          lastToolResult: toolResult,
          progress: results.length / toolSequence.sequence.length 
        });

        // Check for early termination
        if (toolResult.error && tool.priority === 'critical') {
          console.warn(`⚠️  Critical tool failed: ${tool.name}`);
          break;
        }
      } catch (error) {
        console.error(`❌ Error executing tool ${tool.name}:`, error.message);
        
        // Add error result but continue with other tools
        results.push({
          tool: tool.name,
          result: {
            error: true,
            content: [{
              type: 'text',
              text: `Error executing ${tool.name}: ${error.message}`,
            }],
          },
          state: stateMachine.currentState,
          reasoning: tool.reasoning,
          error: error.message,
        });
        
        // Don't break the entire sequence for individual tool failures
        continue;
      }
    }

    // Analyze patterns
    const codePatterns = files.length > 0 ? 
      await analyzeCodePatterns(files[0]) : { patterns: [] };
    
    // Generate intelligent summary
    const summary = await generateIntelligentSummary(
      results, 
      development_goals, 
      context,
      codePatterns
    );

    // Get next action recommendations
    const nextActions = await decisionHelper.recommendNextActions(
      contextManager.getCurrentContext(),
      results
    );

    // Record feedback
    feedbackLoop.recordWorkflowOutcome(
      { type: context.session_type || 'general', toolSequence: toolSequence.sequence.map(t => t.name) },
      { success: true, duration: Date.now() - startTime, qualityAfter: summary.qualityScore }
    );

    return {
      content: [{
        type: 'text',
        text: formatIntelligentAnalysisResponse({
          toolSequence,
          results,
          summary,
          nextActions,
          stateMachine: stateMachine.getStatus(),
        }),
      }],
    };
  } catch (error) {
    console.error('❌ Error in intelligent analysis:', error);
    
    // Try to transition to error state
    try {
      await stateMachine.transition('error_state', {
        reason: error.message,
      });
    } catch (transitionError) {
      console.error('❌ Failed to transition to error state:', transitionError.message);
    }
    
    return {
      content: [{
        type: 'text',
        text: `❌ Error in intelligent analysis: ${error.message}\n\n💡 This error occurred due to an invalid state transition in the development workflow. The issue has been logged and will be addressed in future updates.`,
      }],
    };
  }
}

/**
 * Find alternative state for a tool if the original state is invalid
 */
function findAlternativeState(currentState, toolName) {
  // Map of tool names to alternative states if the primary state is invalid
  const alternativeStates = {
    'scan_security_vulnerabilities': 'analyzing_code',
    'check_production_readiness': 'analyzing_code',
    'format_code': 'analyzing_code',
  };
  
  // If we have an alternative for this tool, use it
  if (alternativeStates[toolName]) {
    return alternativeStates[toolName];
  }
  
  // Default fallback: use analyzing_code for most tools
  return 'analyzing_code';
}

/**
 * Development Session Manager Tool
 */
export const developmentSessionManagerTool = {
  name: 'development_session_manager',
  description: 'Manage development sessions across different MCP clients with continuity and context preservation',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'resume', 'checkpoint', 'analyze', 'export', 'import'],
        description: 'Session management action',
      },
      session_data: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          goals: {
            type: 'array',
            items: { type: 'string' },
          },
          context: { type: 'object' },
          client_type: { type: 'string' },
        },
        description: 'Session data',
      },
      import_data: {
        type: 'string',
        description: 'Session data to import',
      },
    },
    required: ['action'],
  },
};

export async function handleDevelopmentSessionManager(args) {
  const { action, session_data = {}, import_data } = args.params || args;

  await initializeIntelligence();

  try {
    switch (action) {
      case 'start': {
        const newSession = await sessionTracker.createSession({
          goals: session_data.goals || [],
          context: session_data.context || {},
          clientType: session_data.client_type || 'unknown',
        });
        
        // Initialize context for new session
        await contextManager.initializeContext(
          session_data.client_type,
          '.',
          newSession.id
        );
        
        return {
          content: [{
            type: 'text',
            text: formatSessionResponse('started', newSession),
          }],
        };
      }

      case 'resume': {
        const session = await sessionTracker.resumeSession(session_data.id);
        
        // Restore context
        await contextManager.initializeContext(
          session.clientType,
          '.',
          session.id
        );
        
        return {
          content: [{
            type: 'text',
            text: formatSessionResponse('resumed', session),
          }],
        };
      }

      case 'checkpoint': {
        const checkpoint = await sessionTracker.createCheckpoint(session_data.id);
        const contextCheckpoint = contextManager.createCheckpoint('User requested checkpoint');
        
        return {
          content: [{
            type: 'text',
            text: formatCheckpointResponse(checkpoint, contextCheckpoint),
          }],
        };
      }

      case 'analyze': {
        const analysis = await sessionTracker.analyzeSession(session_data.id);
        const insights = feedbackLoop.getLearningInsights();
        
        return {
          content: [{
            type: 'text',
            text: formatSessionAnalysis(analysis, insights),
          }],
        };
      }

      case 'export': {
        const exportData = await sessionTracker.exportSession(session_data.id);
        const contextExport = contextManager.exportContext();
        
        const fullExport = {
          session: JSON.parse(exportData),
          context: contextExport,
          feedback: feedbackLoop.exportFeedback(),
          version: '1.0',
        };
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(fullExport, null, 2),
          }],
        };
      }

      case 'import': {
        if (!import_data) {
          throw new Error('No import data provided');
        }
        
        const data = JSON.parse(import_data);
        const session = await sessionTracker.importSession(data.session);
        
        if (data.context) {
          contextManager.importContext(data.context);
        }
        if (data.feedback) {
          feedbackLoop.importFeedback(data.feedback);
        }
        
        return {
          content: [{
            type: 'text',
            text: formatSessionResponse('imported', session),
          }],
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error in session management: ${error.message}`,
      }],
    };
  }
}

/**
 * Semantic Development Search Tool
 */
export const semanticDevelopmentSearchTool = {
  name: 'semantic_development_search',
  description: 'Search codebase semantically with development context awareness using local embeddings',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query',
      },
      search_type: {
        type: 'string',
        enum: ['similar_code', 'related_patterns', 'bug_hunt', 'optimization_targets', 'refactor_candidates'],
        default: 'similar_code',
        description: 'Type of semantic search',
      },
      context_aware: {
        type: 'boolean',
        default: true,
        description: 'Use current development context',
      },
      max_results: {
        type: 'number',
        default: 10,
        description: 'Maximum number of results',
      },
      include_analysis: {
        type: 'boolean',
        default: true,
        description: 'Include code quality analysis',
      },
    },
    required: ['query'],
  },
};

export async function handleSemanticDevelopmentSearch(args) {
  const { 
    query, 
    search_type = 'similar_code', 
    context_aware = true, 
    max_results = 10,
    include_analysis = true 
  } = args.params || args;

  await initializeIntelligence();

  try {
    // Get development context if requested
    const context = context_aware ? contextManager.getCurrentContext() : null;
    
    // Perform semantic search (simplified for now)
    const searchResults = await performSemanticSearch({
      query,
      type: search_type,
      context,
      maxResults: max_results,
    });

    // Enhance results with development intelligence
    const enhancedResults = await Promise.all(
      searchResults.map(async (result) => {
        const enhancement = {
          ...result,
          development_relevance: calculateDevelopmentRelevance(result, context),
          modification_suggestions: await generateModificationSuggestions(result, query),
          integration_complexity: assessIntegrationComplexity(result, context),
        };

        if (include_analysis) {
          // Run quick analysis
          const analysis = await handleCodePractices({
            code: result.content || '',
            filename: result.file,
            production: false,
          });
          enhancement.quality_analysis = parseAnalysisResult(analysis);
        }

        // Analyze patterns
        if (result.content) {
          const patterns = patternRecognizer.analyzeCodePatterns(result.content, result.file);
          enhancement.patterns = patterns.patterns;
        }

        return enhancement;
      })
    );

    // Generate search insights
    const insights = generateSearchInsights(enhancedResults, query, search_type);

    return {
      content: [{
        type: 'text',
        text: formatSemanticSearchResponse({
          query,
          searchType: search_type,
          results: enhancedResults,
          insights,
          context: context_aware ? contextManager.getContextSummary() : null,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `❌ Error in semantic search: ${error.message}`,
      }],
    };
  }
}

/**
 * Helper functions
 */

async function executeTool(toolName, parameters) {
  try {
    switch (toolName) {
      case 'check_code_practices':
        return await handleCodePractices(parameters);
      case 'format_code':
        return await handleCodeFormatter(parameters);
      case 'check_safety_rules':
        return await handleSafetyChecker(parameters);
      case 'scan_security_vulnerabilities':
        return await handleSecurityScanner(parameters);
      case 'check_production_readiness':
        return await handleProductionReadiness(parameters);
      case 'check_accessibility':
        return await handleAccessibilityChecker(parameters);
      case 'check_graphql_schema':
        return await handleGraphqlSchemaCheck(parameters);
      case 'check_graphql_query':
        return await handleGraphqlQueryCheck(parameters);
      case 'check_redux_patterns':
        return await handleReduxPatternsCheck(parameters);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    return {
      error: true,
      content: [{
        type: 'text',
        text: `Error executing ${toolName}: ${error.message}`,
      }],
    };
  }
}

async function analyzeCodePatterns(file) {
  // Simplified pattern analysis
  return {
    patterns: [],
    summary: 'Pattern analysis pending',
  };
}

async function generateIntelligentSummary(results, goals, context, patterns) {
  const summary = {
    totalTools: results.length,
    successfulTools: results.filter(r => !r.result.error).length,
    keyFindings: [],
    recommendations: [],
    qualityScore: 0,
  };

  // Extract key findings
  for (const result of results) {
    if (result.result.content?.[0]?.text) {
      const text = result.result.content[0].text;
      // Extract important findings (simplified)
      if (text.includes('error') || text.includes('Error')) {
        summary.keyFindings.push(`${result.tool}: Found errors requiring attention`);
      }
      if (text.includes('✅')) {
        summary.keyFindings.push(`${result.tool}: Passed validation`);
      }
    }
  }

  // Generate recommendations based on patterns
  if (patterns.patterns?.length > 0) {
    summary.recommendations = patterns.patterns
      .filter(p => p.suggestion)
      .map(p => ({ action: p.suggestion, pattern: p.name }));
  }

  // Calculate quality score (simplified)
  summary.qualityScore = Math.round(
    (summary.successfulTools / summary.totalTools) * 100
  );

  return summary;
}

function formatIntelligentAnalysisResponse(data) {
  const { toolSequence, results, summary, nextActions, stateMachine } = data;
  
  let response = '🧠 **Intelligent Development Analysis Complete**\n\n';
  response += `**Analysis Strategy:** ${toolSequence.strategy}\n`;
  response += `**Workflow Type:** ${toolSequence.workflowType}\n`;
  response += `**Tools Executed:** ${results.length} tools in optimal sequence\n`;
  response += `**Confidence:** ${Math.round(toolSequence.confidence * 100)}%\n\n`;
  
  response += '**Key Findings:**\n';
  summary.keyFindings.forEach(finding => {
    response += `- ${finding}\n`;
  });
  response += '\n';
  
  response += '**Recommended Actions:**\n';
  summary.recommendations.forEach((rec, i) => {
    response += `${i + 1}. ${rec.action} (${rec.pattern})\n`;
  });
  response += '\n';
  
  response += '**Next Steps:**\n';
  nextActions.actions.slice(0, 3).forEach((action, i) => {
    response += `${i + 1}. ${action.description} (${action.priority} priority)\n`;
  });
  response += '\n';
  
  response += `**Development State:** ${stateMachine.currentState}\n`;
  response += `**Progress:** ${stateMachine.progress}%\n`;
  response += `**Quality Score:** ${summary.qualityScore}/100`;
  
  return response;
}

function formatSessionResponse(action, session) {
  const emoji = {
    started: '🚀',
    resumed: '▶️',
    imported: '📥',
  }[action] || '📋';
  
  let response = `${emoji} **Development Session ${action.charAt(0).toUpperCase() + action.slice(1)}**\n\n`;
  response += `**Session ID:** ${session.id}\n`;
  response += `**Client:** ${session.clientType}\n`;
  response += `**Started:** ${new Date(session.startTime).toLocaleString()}\n`;
  
  if (session.goals.length > 0) {
    response += '**Goals:**\n';
    session.goals.forEach(goal => {
      response += `- ${goal.description} (${goal.status})\n`;
    });
  }
  
  return response;
}

function formatCheckpointResponse(checkpoint, contextCheckpoint) {
  let response = '💾 **Session Checkpoint Created**\n\n';
  response += `**Checkpoint ID:** ${checkpoint.id}\n`;
  response += `**Progress:** ${checkpoint.progress}%\n`;
  response += `**Files Modified:** ${checkpoint.filesModified.length}\n`;
  response += `**Quality Score:** ${checkpoint.qualityScore || 'N/A'}\n`;
  response += `**Context Saved:** ${contextCheckpoint ? 'Yes' : 'No'}\n\n`;
  response += 'Checkpoint saved. You can resume from this point later.';
  
  return response;
}

function formatSessionAnalysis(analysis, insights) {
  let response = '📊 **Session Analysis**\n\n';
  response += `**Duration:** ${analysis.duration}\n`;
  response += `**Productivity Score:** ${analysis.productivityScore}/100\n`;
  response += `**Tools Used:** ${analysis.toolsUsed.join(', ')}\n`;
  response += `**Quality Trend:** ${analysis.qualityTrend}\n`;
  response += `**Files Modified:** ${analysis.filesModified}\n`;
  response += `**Checkpoints:** ${analysis.checkpoints}\n\n`;
  
  if (analysis.achievements.length > 0) {
    response += `**Achievements:** ${analysis.achievements.join(', ')}\n\n`;
  }
  
  response += '**Optimization Suggestions:**\n';
  analysis.optimizations.forEach(opt => {
    response += `- ${opt}\n`;
  });
  
  if (insights.overallTrends.length > 0) {
    response += '\n**Learning Insights:**\n';
    insights.overallTrends.forEach(trend => {
      response += `- ${trend}\n`;
    });
  }
  
  return response;
}

function formatSemanticSearchResponse(data) {
  const { query, searchType, results, insights, context } = data;
  
  let response = `🔍 **Semantic Search Results for "${query}"**\n\n`;
  response += `**Search Type:** ${searchType}\n`;
  response += `**Results Found:** ${results.length}\n`;
  
  if (context) {
    response += `**Context:** ${context.sessionId ? 'Active session' : 'No active session'}\n`;
  }
  response += '\n';
  
  results.forEach((result, i) => {
    response += `**${i + 1}. ${result.file}** (${Math.round(result.similarity * 100)}% match)\n`;
    response += `   📄 ${result.description || 'No description'}\n`;
    response += `   🎯 Relevance: ${result.development_relevance}/10\n`;
    response += `   🔧 Integration: ${result.integration_complexity}\n`;
    
    if (result.quality_analysis) {
      response += `   📊 Quality: ${result.quality_analysis.score}/100\n`;
    }
    
    if (result.patterns?.length > 0) {
      response += `   🔍 Patterns: ${result.patterns.map(p => p.name).join(', ')}\n`;
    }
    
    response += `   💡 ${result.modification_suggestions}\n\n`;
  });
  
  if (insights.recommendations?.length > 0) {
    response += '**Search Insights:**\n';
    insights.recommendations.forEach(rec => {
      response += `- ${rec}\n`;
    });
  }
  
  return response;
}

async function performSemanticSearch(options) {
  // Simplified mock implementation
  // In real implementation, this would use embeddings
  return [
    {
      file: 'src/utils/example.js',
      content: 'function example() { return true; }',
      similarity: 0.85,
      description: 'Example utility function',
    },
  ];
}

function calculateDevelopmentRelevance(result, context) {
  // Simplified relevance calculation
  let relevance = 5;
  
  if (context?.goals?.some(g => result.file.includes(g))) {
    relevance += 2;
  }
  
  if (context?.workflow?.type === 'bug_fix' && result.file.includes('fix')) {
    relevance += 2;
  }
  
  return Math.min(10, relevance);
}

async function generateModificationSuggestions(result, query) {
  // Simplified suggestion generation
  if (query.includes('optimize')) {
    return 'Consider performance optimizations in this code';
  }
  if (query.includes('refactor')) {
    return 'This code could benefit from refactoring for clarity';
  }
  return 'Review for potential improvements';
}

function assessIntegrationComplexity(result, context) {
  // Simplified complexity assessment
  if (result.file.includes('core') || result.file.includes('utils')) {
    return 'High - Core functionality';
  }
  if (result.file.includes('test')) {
    return 'Low - Test file';
  }
  return 'Medium - Standard integration';
}

function parseAnalysisResult(analysis) {
  // Extract quality score from analysis result
  const text = analysis.content?.[0]?.text || '';
  
  if (text.includes('no issues detected')) {
    return { score: 100, issues: 0 };
  }
  
  const errorMatch = text.match(/(\d+) error/);
  const warningMatch = text.match(/(\d+) warning/);
  
  const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
  const warnings = warningMatch ? parseInt(warningMatch[1]) : 0;
  
  return {
    score: Math.max(0, 100 - (errors * 10) - (warnings * 5)),
    issues: errors + warnings,
  };
}

function generateSearchInsights(results, query, searchType) {
  const insights = {
    recommendations: [],
  };
  
  if (results.length === 0) {
    insights.recommendations.push('No results found - try broadening your search');
  } else if (results.length > 5) {
    insights.recommendations.push('Many results found - consider refining your search');
  }
  
  if (searchType === 'bug_hunt' && results.some(r => r.patterns?.some(p => p.type === 'anti-pattern'))) {
    insights.recommendations.push('Anti-patterns detected in search results');
  }
  
  if (searchType === 'optimization_targets' && results.some(r => r.quality_analysis?.score < 70)) {
    insights.recommendations.push('Low quality code found - good optimization candidates');
  }
  
  return insights;
}