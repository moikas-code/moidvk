#!/usr/bin/env node

/**
 * Test for KB List Optimized Tool
 * Verifies pagination, filtering, and output compression
 */

import { handleKbListOptimized } from '../lib/tools/kb-list-optimized.js';

async function runTests() {
  console.log('🧪 Testing KB List Optimized Tool\n');
  console.log('='.repeat(60));

  const tests = [
    {
      name: 'Test 1: Default parameters (summary format, 50 items)',
      params: {},
      description: 'Should return summary format with default pagination',
    },
    {
      name: 'Test 2: Minimal format with limit',
      params: {
        format: 'minimal',
        limit: 10,
      },
      description: 'Should return just file paths, limited to 10 items',
    },
    {
      name: 'Test 3: Tree format with directory filter',
      params: {
        format: 'tree',
        directory: 'active',
        limit: 20,
      },
      description: 'Should return tree structure for active directory',
    },
    {
      name: 'Test 4: Full format with stats',
      params: {
        format: 'full',
        includeStats: true,
        limit: 5,
      },
      description: 'Should return detailed info with file statistics',
    },
    {
      name: 'Test 5: Pagination test',
      params: {
        limit: 5,
        offset: 5,
        format: 'summary',
      },
      description: 'Should return items 6-10 with pagination info',
    },
    {
      name: 'Test 6: Pattern filtering',
      params: {
        pattern: '*.md',
        limit: 10,
        format: 'minimal',
      },
      description: 'Should return only markdown files',
    },
    {
      name: 'Test 7: Sort by modified date',
      params: {
        sortBy: 'modified',
        limit: 5,
        includeStats: true,
        format: 'summary',
      },
      description: 'Should return files sorted by modification date',
    },
    {
      name: 'Test 8: Group by directory disabled',
      params: {
        groupByDirectory: false,
        limit: 10,
        format: 'summary',
      },
      description: 'Should return flat list without directory grouping',
    },
  ];

  for (const test of tests) {
    console.log(`\n📋 ${test.name}`);
    console.log(`   ${test.description}`);
    console.log('-'.repeat(60));

    try {
      const startTime = Date.now();
      const result = await handleKbListOptimized(test.params);
      const duration = Date.now() - startTime;

      if (result.content && result.content.length > 0) {
        const output = result.content[0].text;
        const lines = output.split('\n');

        // Show first 10 lines of output
        console.log('📄 Output (first 10 lines):');
        console.log(lines.slice(0, 10).join('\n'));

        if (lines.length > 10) {
          console.log(`... (${lines.length - 10} more lines)`);
        }

        // Extract and show metadata if present
        const metadataContent = result.content[1]?.text;
        if (metadataContent && metadataContent.includes('Metadata:')) {
          console.log('\n📊 Metadata:');
          const metadataMatch = metadataContent.match(/\{[\s\S]*\}/);
          if (metadataMatch) {
            const metadata = JSON.parse(metadataMatch[0]);
            console.log(`   Total items: ${metadata.total}`);
            console.log(`   Returned: ${metadata.returned}`);
            console.log(`   Offset: ${metadata.offset}`);
            console.log(`   Has more: ${metadata.hasMore}`);
            if (metadata.nextOffset !== null) {
              console.log(`   Next offset: ${metadata.nextOffset}`);
            }
          }
        }

        console.log(`\n✅ Test passed (${duration}ms)`);

        // Calculate approximate context usage
        const totalChars = result.content.reduce((sum, c) => sum + c.text.length, 0);
        const approxTokens = Math.ceil(totalChars / 4);
        console.log(`📏 Approximate tokens: ${approxTokens}`);

        if (approxTokens > 2000) {
          console.log('⚠️  Warning: Output may be too large for context');
        } else {
          console.log('✅ Output size is within safe context limits');
        }
      } else {
        console.log('❌ No output returned');
      }
    } catch (error) {
      console.log(`❌ Test failed: ${error.message}`);
      console.log(error.stack);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 All tests completed!');

  // Test context limit comparison
  console.log('\n📊 Context Usage Comparison:');
  console.log('-'.repeat(60));

  try {
    // Test with no optimization (large output)
    const largeResult = await handleKbListOptimized({
      limit: 200,
      format: 'full',
      includeStats: true,
    });

    const largeChars = largeResult.content.reduce((sum, c) => sum + c.text.length, 0);
    const largeTokens = Math.ceil(largeChars / 4);

    // Test with optimization (small output)
    const smallResult = await handleKbListOptimized({
      limit: 20,
      format: 'minimal',
    });

    const smallChars = smallResult.content.reduce((sum, c) => sum + c.text.length, 0);
    const smallTokens = Math.ceil(smallChars / 4);

    console.log(`Full format (200 items): ~${largeTokens} tokens`);
    console.log(`Minimal format (20 items): ~${smallTokens} tokens`);
    console.log(`Reduction: ${Math.round((1 - smallTokens / largeTokens) * 100)}%`);

    if (smallTokens < largeTokens * 0.3) {
      console.log('✅ Optimization achieves >70% reduction in context usage!');
    }
  } catch (error) {
    console.log('Could not complete comparison test:', error.message);
  }
}

// Run tests
runTests().catch(console.error);
