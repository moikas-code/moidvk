/**
 * Test the MCP server fix for destructuring issue
 */

import { handleJSTestAnalyzer } from '../lib/tools/js-test-analyzer.js';
import { handleJSPerformanceAnalyzer } from '../lib/tools/js-performance-analyzer.js';
import { handleBundleAnalyzer } from '../lib/tools/bundle-analyzer.js';

async function testMCPFix() {
  console.log('🧪 Testing MCP server fix...\n');

  // Test js_test_analyzer
  const testCode = `
import { describe, test, expect } from 'vitest';

describe('Component tests', () => {
  test('should work', () => {
    const { result } = render(<Component />);
    expect(result).toBeDefined();
  });
});
`;

  try {
    console.log('📝 Testing js_test_analyzer with fixed params...');

    const result = await handleJSTestAnalyzer({
      params: {
        code: testCode,
        filename: 'test.js',
      },
    });

    console.log('✅ js_test_analyzer: SUCCESS');
    console.log('Result preview:', result.content[0].text.substring(0, 200) + '...');
  } catch (error) {
    console.log('❌ js_test_analyzer: FAILED -', error.message);
  }

  // Test js_performance_analyzer
  try {
    console.log('\n🚀 Testing js_performance_analyzer with fixed params...');

    const result = await handleJSPerformanceAnalyzer({
      params: {
        code: testCode,
        filename: 'test.js',
      },
    });

    console.log('✅ js_performance_analyzer: SUCCESS');
    console.log('Result preview:', result.content[0].text.substring(0, 200) + '...');
  } catch (error) {
    console.log('❌ js_performance_analyzer: FAILED -', error.message);
  }

  // Test bundle_size_analyzer
  try {
    console.log('\n📦 Testing bundle_size_analyzer with fixed params...');

    const result = await handleBundleAnalyzer({
      params: {
        projectPath: '/home/moika/Documents/code/moidvk',
        entryPoint: 'server.js',
      },
    });

    console.log('✅ bundle_size_analyzer: SUCCESS');
    console.log('Result preview:', result.content[0].text.substring(0, 200) + '...');
  } catch (error) {
    console.log('❌ bundle_size_analyzer: FAILED -', error.message);
  }
}

testMCPFix().catch(console.error);
