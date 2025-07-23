#!/usr/bin/env bun

/**
 * Verify that MCP handlers work with both parameter formats
 */

import { handleCodePractices } from '../lib/tools/code-practices.js';
import { handleCodeFormatter } from '../lib/tools/code-formatter.js';
import { handleSafetyChecker } from '../lib/tools/safety-checker.js';

async function testHandlers() {
  console.log('🧪 Testing MCP handler parameter fix...\n');

  const testCode = `
const test = () => {
  console.log("Testing");
  var unused = 5;
}`;

  // Test 1: Direct args format (legacy)
  console.log('📝 Test 1: Direct args format');
  try {
    const result1 = await handleCodePractices({
      code: testCode,
      filename: 'test.js',
      limit: 5
    });
    console.log('✅ handleCodePractices (direct args): SUCCESS');
  } catch (error) {
    console.log('❌ handleCodePractices (direct args): FAILED -', error.message);
  }

  // Test 2: Params wrapper format (MCP protocol)
  console.log('\n📝 Test 2: Params wrapper format');
  try {
    const result2 = await handleCodePractices({
      params: {
        code: testCode,
        filename: 'test.js',
        limit: 5
      }
    });
    console.log('✅ handleCodePractices (params wrapper): SUCCESS');
  } catch (error) {
    console.log('❌ handleCodePractices (params wrapper): FAILED -', error.message);
  }

  // Test 3: Code formatter
  console.log('\n📝 Test 3: Code formatter with both formats');
  try {
    const result3a = await handleCodeFormatter({
      code: 'const x=1;console.log(x);',
      filename: 'test.js'
    });
    console.log('✅ handleCodeFormatter (direct args): SUCCESS');

    const result3b = await handleCodeFormatter({
      params: {
        code: 'const x=1;console.log(x);',
        filename: 'test.js'
      }
    });
    console.log('✅ handleCodeFormatter (params wrapper): SUCCESS');
  } catch (error) {
    console.log('❌ handleCodeFormatter: FAILED -', error.message);
  }

  // Test 4: Safety checker
  console.log('\n📝 Test 4: Safety checker with both formats');
  try {
    const result4a = await handleSafetyChecker({
      code: testCode,
      filename: 'test.js'
    });
    console.log('✅ handleSafetyChecker (direct args): SUCCESS');

    const result4b = await handleSafetyChecker({
      params: {
        code: testCode,
        filename: 'test.js'
      }
    });
    console.log('✅ handleSafetyChecker (params wrapper): SUCCESS');
  } catch (error) {
    console.log('❌ handleSafetyChecker: FAILED -', error.message);
  }

  console.log('\n✨ All tests completed!');
}

testHandlers().catch(console.error);