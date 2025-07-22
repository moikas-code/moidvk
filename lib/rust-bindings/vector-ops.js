/**
 * High-performance vector operations with Rust backend and JavaScript fallback
 *
 * This module provides a unified interface for vector operations that automatically
 * falls back to JavaScript implementations if the Rust module is unavailable.
 */

let rustCore = null;
let useRust = false;

// Attempt to load Rust module
try {
  // Try to load the native Rust module
  rustCore = require('../../lib/rust-core/index.node');
  useRust = true;
  console.log('[MOIDVK] Rust vector operations loaded successfully');
} catch (error) {
  console.warn(
    '[MOIDVK] Rust vector operations unavailable, using JavaScript fallback:',
    error.message,
  );
  useRust = false;
}

/**
 * JavaScript fallback implementation for vector operations
 */
class JavaScriptVectorOps {
  constructor(config = {}) {
    this.config = {
      useSimd: false, // Not available in JavaScript
      useParallel: false, // Limited in JavaScript
      similarityThreshold: config.similarityThreshold || 0.7,
    };
  }

  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same length');
    }

    if (vecA.length === 0) {
      return 0.0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0.0;
    }

    return dotProduct / (normA * normB);
  }

  batchCosineSimilarity(queryVector, vectors) {
    return vectors.map((vec) => this.cosineSimilarity(queryVector, vec));
  }

  findSimilarVectors(queryVector, vectors, paths, topK) {
    const similarities = this.batchCosineSimilarity(queryVector, vectors);

    const results = similarities
      .map((similarity, index) => ({
        index,
        path: paths[index],
        similarity,
      }))
      .filter((result) => result.similarity >= this.config.similarityThreshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);

    return results;
  }

  normalizeVector(vector) {
    const norm = this.vectorNorm(vector);
    if (norm === 0) {
      throw new Error('Cannot normalize zero vector');
    }
    return vector.map((val) => val / norm);
  }

  vectorNorm(vector) {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  }

  pairwiseDistances(vectors) {
    const n = vectors.length;
    const distances = Array(n)
      .fill()
      .map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== j) {
          distances[i][j] = 1.0 - this.cosineSimilarity(vectors[i], vectors[j]);
        }
      }
    }

    return distances;
  }

  createCacheKey(vector) {
    // Simple hash function for JavaScript fallback
    const str = vector.join(',');
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Unified vector operations interface
 */
export class VectorOperations {
  constructor(config = {}) {
    this.config = config;

    if (useRust && rustCore) {
      try {
        this.backend = new rustCore.VectorOperations(config);
        this.backendType = 'rust';
      } catch (error) {
        console.warn(
          '[MOIDVK] Failed to create Rust backend, falling back to JavaScript:',
          error.message,
        );
        this.backend = new JavaScriptVectorOps(config);
        this.backendType = 'javascript';
      }
    } else {
      this.backend = new JavaScriptVectorOps(config);
      this.backendType = 'javascript';
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  async cosineSimilarity(vecA, vecB) {
    return this.backend.cosineSimilarity(vecA, vecB);
  }

  /**
   * Calculate cosine similarity for multiple vector pairs in parallel
   */
  async batchCosineSimilarity(queryVector, vectors) {
    if (this.backendType === 'rust') {
      // Convert array of arrays to flattened array for Rust backend
      if (vectors.length === 0) return [];

      const vectorSize = vectors[0].length;
      const flatVectors = vectors.flat();

      return this.backend.batchCosineSimilarity(queryVector, flatVectors, vectorSize);
    } else {
      return this.backend.batchCosineSimilarity(queryVector, vectors);
    }
  }

  /**
   * Find the most similar vectors from a collection
   */
  async findSimilarVectors(queryVector, vectors, paths, topK) {
    return this.backend.findSimilarVectors(queryVector, vectors, paths, topK);
  }

  /**
   * Normalize a vector to unit length
   */
  async normalizeVector(vector) {
    return this.backend.normalizeVector(vector);
  }

  /**
   * Calculate the L2 norm (magnitude) of a vector
   */
  vectorNorm(vector) {
    return this.backend.vectorNorm(vector);
  }

  /**
   * Compute pairwise distances between all vectors in a collection
   */
  async pairwiseDistances(vectors) {
    return this.backend.pairwiseDistances(vectors);
  }

  /**
   * Create embeddings cache key from vector
   */
  createCacheKey(vector) {
    return this.backend.createCacheKey(vector);
  }

  /**
   * Get information about the current backend
   */
  getBackendInfo() {
    return {
      type: this.backendType,
      useRust: useRust,
      available: this.backendType === 'rust',
      performance: this.backendType === 'rust' ? 'high' : 'standard',
    };
  }
}

/**
 * Quick cosine similarity calculation
 */
export async function quickCosineSimilarity(vecA, vecB) {
  const ops = new VectorOperations();
  return ops.cosineSimilarity(vecA, vecB);
}

/**
 * Benchmark vector operations performance
 */
export async function benchmarkVectorOperations(vectorSize = 1000, numVectors = 1000) {
  const results = {};

  try {
    if (useRust && rustCore) {
      const rustResults = await rustCore.benchmarkVectorOperations(vectorSize, numVectors);
      results.rust = rustResults;
    }
  } catch (error) {
    console.warn('[MOIDVK] Rust benchmark failed:', error.message);
  }

  // JavaScript benchmark
  const jsOps = new JavaScriptVectorOps();
  const queryVector = Array.from({ length: vectorSize }, (_, i) => i / vectorSize);
  const vectors = Array.from({ length: numVectors }, (_, i) =>
    Array.from({ length: vectorSize }, (_, j) => (i + j) / vectorSize),
  );

  const start = Date.now();
  jsOps.batchCosineSimilarity(queryVector, vectors);
  const jsTime = Date.now() - start;

  results.javascript = {
    time_ms: jsTime,
    ops_per_second: numVectors / (jsTime / 1000),
  };

  // Calculate speedup if both are available
  if (results.rust && results.javascript) {
    results.speedup =
      results.javascript.time_ms /
      (results.rust.simd_parallel_ms || results.rust.scalar_sequential_ms);
  }

  return results;
}

// Export default instance for convenience
export const defaultVectorOps = new VectorOperations();

// Compatibility exports
export default VectorOperations;
