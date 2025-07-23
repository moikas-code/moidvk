/**
 * Debug test for destructuring parser issue
 * Testing different JavaScript syntax patterns that might cause parsing errors
 */

import { handleJSTestAnalyzer } from '../lib/tools/js-test-analyzer.js';
import { handleBundleAnalyzer } from '../lib/tools/bundle-analyzer.js';
import { handleJSPerformanceAnalyzer } from '../lib/tools/js-performance-analyzer.js';

// Test cases with different destructuring patterns
const testCases = [
  {
    name: 'Simple destructuring',
    code: `
const { a, b } = obj;
const [x, y] = arr;
`,
  },
  {
    name: 'Nested destructuring',
    code: `
const { a: { b } } = obj;
const [x, [y, z]] = arr;
`,
  },
  {
    name: 'Default values',
    code: `
const { a = 1, b = 2 } = obj;
const [x = 10, y = 20] = arr;
`,
  },
  {
    name: 'Rest patterns',
    code: `
const { a, ...rest } = obj;
const [first, ...remaining] = arr;
`,
  },
  {
    name: 'Import destructuring',
    code: `
import { describe, test, expect } from 'vitest';
const { someFunction } = require('module');
`,
  },
  {
    name: 'Function parameter destructuring',
    code: `
function test({ a, b }) {
  return a + b;
}

const arrow = ({ x, y }) => x * y;
`,
  },
  {
    name: 'Complex test structure',
    code: `
import { describe, test, expect } from 'vitest';

describe('Component tests', () => {
  test('should work', () => {
    const { result } = render(<Component />);
    expect(result).toBeDefined();
  });
});
`,
  },
];

async function debugDestructuringIssue() {
  console.log('🔍 Debugging destructuring parser issue...\n');

  for (const testCase of testCases) {
    console.log(`\n📝 Testing: ${testCase.name}`);
    console.log('Code:', testCase.code.trim());

    // Test with js_test_analyzer
    try {
      console.log('\n🧪 Testing with js_test_analyzer...');
      const result = await handleJSTestAnalyzer({
        params: {
          code: testCase.code,
          filename: 'test.js',
        },
      });
      console.log('✅ js_test_analyzer: SUCCESS');
      console.log('Result:', result.content[0].text.substring(0, 100) + '...');
    } catch (error) {
      console.log('❌ js_test_analyzer: FAILED -', error.message);
    }

    // Test with js_performance_analyzer
    try {
      console.log('🚀 Testing with js_performance_analyzer...');
      const result = await handleJSPerformanceAnalyzer({
        params: {
          code: testCase.code,
          filename: 'test.js',
        },
      });
      console.log('✅ js_performance_analyzer: SUCCESS');
      console.log('Result:', result.content[0].text.substring(0, 100) + '...');
    } catch (error) {
      console.log('❌ js_performance_analyzer: FAILED -', error.message);
    }

    // Test with js_performance_analyzer
    try {
      console.log('🚀 Testing with js_performance_analyzer...');
      const result = await moidvk_js_performance_analyzer({
        params: {
          code: testCase.code,
          filename: 'test.js',
        },
      });
      console.log('✅ js_performance_analyzer: SUCCESS');
    } catch (error) {
      console.log('❌ js_performance_analyzer: FAILED -', error.message);
    }

    console.log('─'.repeat(50));
  }

  // Test bundle analyzer with project path
  console.log('\n📦 Testing bundle_size_analyzer with current project...');
  try {
    const result = await handleBundleAnalyzer({
      params: {
        projectPath: '/home/moika/Documents/code/moidvk',
        entryPoint: 'server.js',
      },
    });
    console.log('✅ bundle_size_analyzer: SUCCESS');
    console.log('Result:', result.content[0].text.substring(0, 100) + '...');
  } catch (error) {
    console.log('❌ bundle_size_analyzer: FAILED -', error.message);
  }
}

// Run the debug test
debugDestructuringIssue().catch(console.error);
