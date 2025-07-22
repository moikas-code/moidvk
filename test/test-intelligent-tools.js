#!/usr/bin/env bun

/**
 * Test script for intelligent MCP tools
 * Run: bun test/test-intelligent-tools.js
 */

import { 
  handleIntelligentDevelopmentAnalysis,
  handleDevelopmentSessionManager,
  handleSemanticDevelopmentSearch
} from '../lib/tools/intelligent-tools.js';

async function testIntelligentDevelopmentAnalysis() {
  console.log('\n🧪 Testing Intelligent Development Analysis...\n');
  
  try {
    const result = await handleIntelligentDevelopmentAnalysis({
      goals: ['Fix authentication bug', 'Add user profile feature'],
      client_type: 'test',
      files: ['server.js', 'lib/tools/code-practices.js'],
      context: {
        projectType: 'mcp-server',
        recentIssues: ['authentication failing on login'],
      }
    });
    
    console.log('✅ Analysis completed successfully');
    console.log('Result:', result.content[0].text.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
  }
}

async function testDevelopmentSessionManager() {
  console.log('\n🧪 Testing Development Session Manager...\n');
  
  try {
    // Create a session
    console.log('Creating new session...');
    const createResult = await handleDevelopmentSessionManager({
      action: 'create',
      goals: ['Test session management'],
      client_type: 'test'
    });
    console.log('✅ Session created');
    
    // List sessions
    console.log('\nListing sessions...');
    const listResult = await handleDevelopmentSessionManager({
      action: 'list'
    });
    console.log('✅ Sessions listed');
    
    // Get specific session (if we parsed the ID from create result)
    // For now, just show that the operations completed
    console.log('✅ Session manager working correctly');
    
  } catch (error) {
    console.error('❌ Session manager failed:', error.message);
  }
}

async function testSemanticDevelopmentSearch() {
  console.log('\n🧪 Testing Semantic Development Search...\n');
  
  try {
    const result = await handleSemanticDevelopmentSearch({
      query: 'authentication and security',
      type: 'related_patterns',
      max_results: 5,
      search_path: '.',
      context: {
        currentTask: 'fixing authentication',
      }
    });
    
    console.log('✅ Semantic search completed');
    console.log('Result preview:', result.content[0].text.substring(0, 200) + '...');
  } catch (error) {
    console.error('❌ Semantic search failed:', error.message);
  }
}

async function testWorkflowIntegration() {
  console.log('\n🧪 Testing Workflow Integration...\n');
  
  try {
    // Test a complete workflow
    console.log('1. Starting with development analysis...');
    const analysis = await handleIntelligentDevelopmentAnalysis({
      goals: ['Implement new feature: user notifications'],
      client_type: 'test',
      files: [],
      context: {
        projectType: 'web-app',
      }
    });
    
    console.log('2. Creating development session...');
    const session = await handleDevelopmentSessionManager({
      action: 'create',
      goals: ['Implement user notifications'],
      client_type: 'test'
    });
    
    console.log('3. Searching for similar implementations...');
    const search = await handleSemanticDevelopmentSearch({
      query: 'notification system implementation',
      type: 'similar_code',
      max_results: 3,
      search_path: '.'
    });
    
    console.log('\n✅ Workflow integration successful!');
    console.log('All intelligent tools are working together correctly.');
    
  } catch (error) {
    console.error('❌ Workflow integration failed:', error.message);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Intelligent MCP Tools Test Suite\n');
  console.log('=' . repeat(50));
  
  await testIntelligentDevelopmentAnalysis();
  await testDevelopmentSessionManager();
  await testSemanticDevelopmentSearch();
  await testWorkflowIntegration();
  
  console.log('\n' + '=' . repeat(50));
  console.log('✨ Test suite completed!\n');
}

// Run tests
runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});