import { LocalEmbeddingManager } from '../lib/filesystem/embedding-manager.js';
import { test, expect } from 'bun:test';
import { join } from 'path';
import { rm } from 'fs/promises';

test('EmbeddingManager uses EmbeddingCacheManager correctly', async () => {
  const testCacheDir = join(process.cwd(), '.test-embedding-cache');
  
  // Clean up any existing test cache
  try {
    await rm(testCacheDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore if doesn't exist
  }

  const manager = new LocalEmbeddingManager({
    cacheDir: testCacheDir,
    maxCacheSize: 10,
  });

  // Initialize the manager
  await manager.initialize();

  // Test single embedding with caching
  const content = 'This is a test sentence for embedding generation.';
  const filePath = '/test/file.txt';

  // First call - should not be cached
  const result1 = await manager.generateEmbedding(content, filePath);
  expect(result1.cached).toBe(false);
  expect(result1.vector).toBeInstanceOf(Array);
  expect(result1.vector.length).toBe(384);

  // Second call with same content - should be cached
  const result2 = await manager.generateEmbedding(content, filePath);
  expect(result2.cached).toBe(true);
  expect(result2.vector).toEqual(result1.vector);

  // Test batch embeddings
  const items = [
    { content: 'First test content', path: '/test/file1.txt' },
    { content: 'Second test content', path: '/test/file2.txt' },
    { content: content, path: filePath }, // This one should be cached
  ];

  const batchResults = await manager.generateBatchEmbeddings(items);
  expect(batchResults).toHaveLength(3);
  
  // The third item should be cached
  expect(batchResults[2].cached).toBe(true);
  expect(batchResults[2].vector).toEqual(result1.vector);

  // Test cache stats
  const stats = manager.getCacheStats();
  expect(stats).toHaveProperty('hits');
  expect(stats).toHaveProperty('misses');
  expect(stats).toHaveProperty('memoryEntries');
  expect(stats).toHaveProperty('hitRate');

  // Test clear cache
  await manager.clearCache();
  
  // After clearing, the same content should not be cached
  const result3 = await manager.generateEmbedding(content, filePath);
  expect(result3.cached).toBe(false);

  // Cleanup
  await manager.cleanup();
  
  // Clean up test cache directory
  try {
    await rm(testCacheDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}, 30000); // 30 second timeout for model download if needed