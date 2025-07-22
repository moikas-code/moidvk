#!/usr/bin/env bun

/**
 * Test script for the upgraded embedding model
 * Verifies Xenova/all-mpnet-base-v2 model functionality
 */

import { LocalEmbeddingManager } from '../lib/filesystem/embedding-manager.js';

async function testEmbeddingUpgrade() {
  console.log('🧪 Testing Upgraded Embedding Model: Xenova/all-mpnet-base-v2\n');
  
  const testCases = [
    {
      name: 'Code Similarity Test',
      texts: [
        'function authenticate(username, password) { return checkCredentials(username, password); }',
        'function login(user, pass) { return validateUser(user, pass); }',
        'function calculateTotal(items) { return items.reduce((sum, item) => sum + item.price, 0); }'
      ],
      expectedSimilar: [0, 1], // First two should be similar
    },
    {
      name: 'Semantic Understanding Test',
      texts: [
        'This function handles user authentication and security',
        'Security and authentication management for users',
        'Calculate the sum of all numbers in an array'
      ],
      expectedSimilar: [0, 1], // First two should be similar
    }
  ];
  
  try {
    // Initialize embedding manager
    console.log('Initializing embedding manager...');
    const embeddingManager = new LocalEmbeddingManager({
      device: 'webgpu', // Test WebGPU acceleration
      quantization: 'q8' // Test Q8 quantization
    });
    
    await embeddingManager.initialize();
    console.log('✅ Embedding manager initialized successfully\n');
    
    // Test each case
    for (const testCase of testCases) {
      console.log(`📋 ${testCase.name}:`);
      
      // Generate embeddings
      const embeddings = [];
      for (let i = 0; i < testCase.texts.length; i++) {
        const embedding = await embeddingManager.generateEmbedding(
          testCase.texts[i], 
          `test-${i}.js`
        );
        embeddings.push(embedding.vector);
        console.log(`  - Generated embedding for text ${i + 1} (dimension: ${embedding.vector.length})`);
      }
      
      // Calculate similarities
      console.log('\n  Similarity scores:');
      for (let i = 0; i < embeddings.length; i++) {
        for (let j = i + 1; j < embeddings.length; j++) {
          const similarity = cosineSimilarity(embeddings[i], embeddings[j]);
          const isExpectedSimilar = 
            (testCase.expectedSimilar.includes(i) && testCase.expectedSimilar.includes(j));
          const status = isExpectedSimilar && similarity > 0.7 ? '✅' : 
            !isExpectedSimilar && similarity < 0.5 ? '✅' : '⚠️';
          
          console.log(`    Text ${i + 1} vs Text ${j + 1}: ${(similarity * 100).toFixed(1)}% ${status}`);
        }
      }
      console.log('');
    }
    
    // Test performance metrics
    console.log('📊 Performance Metrics:');
    const startTime = Date.now();
    const testText = 'function example() { return "performance test"; }';
    
    for (let i = 0; i < 10; i++) {
      await embeddingManager.generateEmbedding(testText, `perf-test-${i}.js`);
    }
    
    const duration = Date.now() - startTime;
    console.log(`  - Generated 10 embeddings in ${duration}ms (${(duration / 10).toFixed(1)}ms per embedding)`);
    console.log(`  - Model: ${embeddingManager.modelName}`);
    console.log(`  - Configuration: WebGPU=${embeddingManager.pipelineConfig.device}, Quantization=${embeddingManager.pipelineConfig.quantization}`);
    
    console.log('\n✨ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(vec1, vec2) {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    normA += vec1[i] * vec1[i];
    normB += vec2[i] * vec2[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Run the test
testEmbeddingUpgrade().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});