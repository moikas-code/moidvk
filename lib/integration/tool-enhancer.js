/**
 * Tool Enhancer
 * Adds intelligence capabilities to existing tools
 */

import { ContextManager } from '../intelligence/context-manager.js';
import { PatternRecognizer } from '../intelligence/pattern-recognizer.js';
import { SmartSuggestionsGenerator } from '../local-ai/smart-suggestions.js';

export class ToolEnhancer {
  constructor() {
    this.contextManager = null;
    this.patternRecognizer = null;
    this.suggestionsGenerator = null;
    this.initialized = false;
    this.enhancedTools = new Set();
    
    // Tool enhancement configurations
    this.enhancements = {
      check_code_practices: {
        preProcess: this.enhanceCodePracticesInput.bind(this),
        postProcess: this.enhanceCodePracticesOutput.bind(this),
        contextAware: true,
        suggestions: true,
      },
      format_code: {
        preProcess: this.enhanceFormatCodeInput.bind(this),
        postProcess: this.enhanceFormatCodeOutput.bind(this),
        contextAware: true,
        suggestions: false,
      },
      check_safety_rules: {
        preProcess: this.enhanceSafetyInput.bind(this),
        postProcess: this.enhanceSafetyOutput.bind(this),
        contextAware: true,
        suggestions: true,
      },
      scan_security_vulnerabilities: {
        preProcess: this.enhanceSecurityInput.bind(this),
        postProcess: this.enhanceSecurityOutput.bind(this),
        contextAware: true,
        suggestions: true,
      },
      check_production_readiness: {
        preProcess: this.enhanceProductionInput.bind(this),
        postProcess: this.enhanceProductionOutput.bind(this),
        contextAware: true,
        suggestions: true,
      },
      read_file: {
        preProcess: this.enhanceReadFileInput.bind(this),
        postProcess: this.enhanceReadFileOutput.bind(this),
        contextAware: true,
        suggestions: false,
      },
      search_in_files: {
        preProcess: this.enhanceSearchInput.bind(this),
        postProcess: this.enhanceSearchOutput.bind(this),
        contextAware: true,
        suggestions: true,
      },
    };
  }
  
  async initialize() {
    if (this.initialized) return;
    
    try {
      this.contextManager = new ContextManager();
      await this.contextManager.initialize();
      
      this.patternRecognizer = new PatternRecognizer();
      await this.patternRecognizer.initialize();
      
      this.suggestionsGenerator = new SmartSuggestionsGenerator();
      await this.suggestionsGenerator.initialize();
      
      this.initialized = true;
    } catch (error) {
      console.warn('ToolEnhancer initialization warning:', error.message);
      // Continue without full enhancement
      this.initialized = true;
    }
  }
  
  /**
   * Wrap a tool handler with intelligence enhancements
   */
  async enhanceTool(toolName, originalHandler) {
    if (!this.enhancements[toolName]) {
      return originalHandler; // No enhancement configured
    }
    
    if (this.enhancedTools.has(toolName)) {
      return originalHandler; // Already enhanced
    }
    
    await this.initialize();
    
    const enhancement = this.enhancements[toolName];
    const enhancer = this;
    
    // Create enhanced handler
    const enhancedHandler = async function(args) {
      try {
        // Pre-process input with context
        let enhancedArgs = args;
        if (enhancement.preProcess && enhancer.initialized) {
          const context = await enhancer.getContext();
          enhancedArgs = await enhancement.preProcess(args, context);
        }
        
        // Call original handler
        const result = await originalHandler(enhancedArgs);
        
        // Post-process output with enhancements
        let enhancedResult = result;
        if (enhancement.postProcess && enhancer.initialized) {
          const context = await enhancer.getContext();
          enhancedResult = await enhancement.postProcess(result, args, context);
        }
        
        return enhancedResult;
      } catch (error) {
        // If enhancement fails, fall back to original
        console.warn(`Enhancement failed for ${toolName}:`, error.message);
        return await originalHandler(args);
      }
    };
    
    this.enhancedTools.add(toolName);
    return enhancedHandler;
  }
  
  /**
   * Get current context
   */
  async getContext() {
    if (!this.contextManager) {
      return {};
    }
    
    return this.contextManager.getCurrentContext() || {};
  }
  
  /**
   * Enhance code practices input
   */
  async enhanceCodePracticesInput(args, context) {
    const enhanced = { ...args };
    
    // Add context-based severity adjustments
    if (context.workflow === 'bug_fix') {
      enhanced.severity = 'all'; // Show all issues during bug fixes
    } else if (context.workflow === 'production_deploy') {
      enhanced.severity = 'error'; // Only critical issues for deploy
    }
    
    // Add file context
    if (args.filename && context.recentFiles) {
      const relatedFiles = context.recentFiles.filter(f => 
        f.includes(args.filename.replace(/\.[^.]+$/, ''))
      );
      enhanced._context = { relatedFiles };
    }
    
    return enhanced;
  }
  
  /**
   * Enhance code practices output
   */
  async enhanceCodePracticesOutput(result, originalArgs, context) {
    const enhanced = { ...result };
    
    // Parse issues from result
    const content = result.content?.[0]?.text || '';
    const hasIssues = content.includes('❌') || content.includes('⚠️');
    
    if (hasIssues && this.suggestionsGenerator) {
      // Generate fix suggestions
      const suggestions = await this.suggestionsGenerator.generateSuggestions({
        context,
        requestedTypes: ['code_improvements', 'next_steps'],
        files: [{
          path: originalArgs.filename || 'unknown',
          content: originalArgs.code,
        }],
      });
      
      if (suggestions.length > 0) {
        // Add suggestions to output
        const suggestionText = '\n\n📡 **Intelligent Suggestions:**\n' +
          suggestions.slice(0, 3).map(s => 
            `• ${s.description} (${s.priority} priority)`
          ).join('\n');
        
        enhanced.content = [{
          type: 'text',
          text: content + suggestionText,
        }];
      }
    }
    
    // Track patterns
    if (this.patternRecognizer && hasIssues) {
      await this.patternRecognizer.recordEvent({
        type: 'code_quality_issue',
        tool: 'check_code_practices',
        file: originalArgs.filename,
        timestamp: Date.now(),
      });
    }
    
    return enhanced;
  }
  
  /**
   * Enhance format code input
   */
  async enhanceFormatCodeInput(args, context) {
    const enhanced = { ...args };
    
    // Use project-specific formatting rules if available
    if (context.project?.formatting) {
      enhanced._contextualRules = context.project.formatting;
    }
    
    return enhanced;
  }
  
  /**
   * Enhance format code output
   */
  async enhanceFormatCodeOutput(result, originalArgs, context) {
    // Track formatting patterns
    if (this.patternRecognizer) {
      await this.patternRecognizer.recordEvent({
        type: 'code_formatted',
        tool: 'format_code',
        file: originalArgs.filename,
        timestamp: Date.now(),
      });
    }
    
    return result;
  }
  
  /**
   * Enhance safety checker input
   */
  async enhanceSafetyInput(args, context) {
    const enhanced = { ...args };
    
    // Stricter checks for critical components
    if (context.isCriticalComponent) {
      enhanced._strictMode = true;
    }
    
    return enhanced;
  }
  
  /**
   * Enhance safety checker output
   */
  async enhanceSafetyOutput(result, originalArgs, context) {
    const enhanced = { ...result };
    const content = result.content?.[0]?.text || '';
    
    // Add context-specific safety recommendations
    if (content.includes('violations found') && context.workflow === 'feature_development') {
      const warning = '\n\n⚠️ **Context Alert:** Safety violations in new feature code. ' +
        'Consider addressing these before integration.';
      
      enhanced.content = [{
        type: 'text',
        text: content + warning,
      }];
    }
    
    return enhanced;
  }
  
  /**
   * Enhance security scanner input
   */
  async enhanceSecurityInput(args, context) {
    const enhanced = { ...args };
    
    // Add severity filter based on deployment stage
    if (context.deploymentStage === 'development') {
      enhanced.severity = enhanced.severity || 'high'; // Focus on high/critical
    }
    
    return enhanced;
  }
  
  /**
   * Enhance security scanner output
   */
  async enhanceSecurityOutput(result, originalArgs, context) {
    const enhanced = { ...result };
    const content = result.content?.[0]?.text || '';
    
    if (content.includes('vulnerabilities found') && this.suggestionsGenerator) {
      // Generate remediation suggestions
      const suggestions = await this.suggestionsGenerator.generateSuggestions({
        context,
        requestedTypes: ['security', 'next_steps'],
        maxSuggestions: 5,
      });
      
      if (suggestions.length > 0) {
        const suggestionText = '\n\n🔐 **Security Recommendations:**\n' +
          suggestions.map(s => `• ${s.description}`).join('\n');
        
        enhanced.content = [{
          type: 'text',
          text: content + suggestionText,
        }];
      }
    }
    
    return enhanced;
  }
  
  /**
   * Enhance production readiness input
   */
  async enhanceProductionInput(args, context) {
    const enhanced = { ...args };
    
    // Auto-enable strict mode for production deployments
    if (context.deploymentStage === 'production' || context.workflow === 'production_deploy') {
      enhanced.strict = true;
    }
    
    return enhanced;
  }
  
  /**
   * Enhance production readiness output
   */
  async enhanceProductionOutput(result, originalArgs, context) {
    const enhanced = { ...result };
    const content = result.content?.[0]?.text || '';
    
    // Add deployment checklist based on issues found
    if (content.includes('issues found')) {
      const checklist = '\n\n📋 **Pre-deployment Checklist:**\n' +
        '□ Address all critical issues\n' +
        '□ Run comprehensive test suite\n' +
        '□ Review security vulnerabilities\n' +
        '□ Update documentation\n' +
        '□ Prepare rollback plan';
      
      enhanced.content = [{
        type: 'text',
        text: content + checklist,
      }];
    }
    
    return enhanced;
  }
  
  /**
   * Enhance read file input
   */
  async enhanceReadFileInput(args, context) {
    const enhanced = { ...args };
    
    // Suggest AI mode for certain file types
    if (!args.forAI && context.workflow === 'code_review') {
      const ext = args.filePath?.split('.').pop();
      if (['js', 'ts', 'jsx', 'tsx', 'py', 'java'].includes(ext)) {
        enhanced._suggestAIMode = true;
      }
    }
    
    return enhanced;
  }
  
  /**
   * Enhance read file output
   */
  async enhanceReadFileOutput(result, originalArgs, context) {
    // Track file access patterns
    if (this.patternRecognizer) {
      await this.patternRecognizer.recordEvent({
        type: 'file_accessed',
        tool: 'read_file',
        file: originalArgs.filePath,
        forAI: originalArgs.forAI,
        timestamp: Date.now(),
      });
    }
    
    // Update context with accessed file
    if (this.contextManager) {
      await this.contextManager.updateRecentFiles(originalArgs.filePath);
    }
    
    return result;
  }
  
  /**
   * Enhance search input
   */
  async enhanceSearchInput(args, context) {
    const enhanced = { ...args };
    
    // Expand search based on recent patterns
    if (this.patternRecognizer && !args.filePattern) {
      const patterns = await this.patternRecognizer.getRecentPatterns();
      const relevantPattern = patterns.find(p => 
        p.type === 'search_pattern' && p.context.similar_to === args.searchText
      );
      
      if (relevantPattern) {
        enhanced.filePattern = relevantPattern.context.effective_pattern;
      }
    }
    
    return enhanced;
  }
  
  /**
   * Enhance search output
   */
  async enhanceSearchOutput(result, originalArgs, context) {
    const enhanced = { ...result };
    const content = result.content?.[0]?.text || '';
    
    // Add search insights
    const resultCount = (content.match(/Found/g) || []).length;
    if (resultCount > 10) {
      const insight = '\n\n💡 **Search Insight:** Many results found. ' +
        'Consider refining your search with more specific terms or file patterns.';
      
      enhanced.content = [{
        type: 'text',
        text: content + insight,
      }];
    }
    
    // Track search patterns
    if (this.patternRecognizer) {
      await this.patternRecognizer.recordEvent({
        type: 'search_performed',
        tool: 'search_in_files',
        query: originalArgs.searchText,
        resultCount,
        timestamp: Date.now(),
      });
    }
    
    return enhanced;
  }
  
  /**
   * Apply enhancements to a tool suite
   */
  async enhanceToolSuite(tools, handlers) {
    const enhancedHandlers = {};
    
    for (const tool of tools) {
      const handler = handlers[tool.name];
      if (handler && this.enhancements[tool.name]) {
        enhancedHandlers[tool.name] = await this.enhanceTool(tool.name, handler);
      } else {
        enhancedHandlers[tool.name] = handler;
      }
    }
    
    return enhancedHandlers;
  }
  
  /**
   * Get enhancement statistics
   */
  getEnhancementStats() {
    return {
      initialized: this.initialized,
      enhancedTools: Array.from(this.enhancedTools),
      availableEnhancements: Object.keys(this.enhancements),
    };
  }
}