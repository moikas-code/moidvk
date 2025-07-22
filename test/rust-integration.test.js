#!/usr/bin/env node

/**
 * MOIDVK Rust Integration Tests
 * 
 * Verify that Rust modules integrate correctly with JavaScript fallbacks
 */

import { test, expect, describe } from 'bun:test';
import { VectorOperations, getRustInfo } from '../lib/rust-bindings/index.js';
import { FileSearch } from '../lib/rust-bindings/file-search.js';
import { LocalEmbeddingManager } from '../lib/filesystem/embedding-manager.js';

describe('Rust Integration Tests', () => {
    test('getRustInfo returns valid information', () => {
        const info = getRustInfo();
        
        expect(info).toHaveProperty('available');
        expect(info).toHaveProperty('performanceMode');
        expect(info).toHaveProperty('modules');
        expect(typeof info.available).toBe('boolean');
        expect(['high', 'standard']).toContain(info.performanceMode);
    });

    test('VectorOperations can be instantiated', () => {
        const vectorOps = new VectorOperations();
        expect(vectorOps).toBeDefined();
        expect(vectorOps.getBackendInfo).toBeFunction();
    });

    test('VectorOperations cosine similarity works', async () => {
        const vectorOps = new VectorOperations();
        
        const vecA = [1, 0, 0];
        const vecB = [1, 0, 0];
        const vecC = [0, 1, 0];
        
        const similarityAB = await vectorOps.cosineSimilarity(vecA, vecB);
        const similarityAC = await vectorOps.cosineSimilarity(vecA, vecC);
        
        expect(similarityAB).toBeCloseTo(1.0, 5);
        expect(similarityAC).toBeCloseTo(0.0, 5);
    });

    test('VectorOperations batch similarity works', async () => {
        const vectorOps = new VectorOperations();
        
        const queryVector = [1, 0, 0];
        const vectors = [
            [1, 0, 0],  // Should be 1.0 similarity
            [0, 1, 0],  // Should be 0.0 similarity
            [0.7071, 0.7071, 0],  // Should be ~0.7071 similarity
        ];
        
        const similarities = await vectorOps.batchCosineSimilarity(queryVector, vectors);
        
        expect(similarities).toHaveLength(3);
        expect(similarities[0]).toBeCloseTo(1.0, 5);
        expect(similarities[1]).toBeCloseTo(0.0, 5);
        expect(similarities[2]).toBeCloseTo(0.7071, 3);
    });

    test('FileSearch can be instantiated', () => {
        const fileSearch = new FileSearch();
        expect(fileSearch).toBeDefined();
        expect(fileSearch.getBackendInfo).toBeFunction();
    });

    test('LocalEmbeddingManager uses VectorOperations', async () => {
        const embeddingManager = new LocalEmbeddingManager();
        
        expect(embeddingManager.vectorOps).toBeDefined();
        expect(embeddingManager.rustInfo).toBeDefined();
    });

    test('LocalEmbeddingManager vector operations are async', async () => {
        const embeddingManager = new LocalEmbeddingManager();
        
        const vecA = [1, 0, 0];
        const vecB = [1, 0, 0];
        
        const similarity = await embeddingManager.cosineSimilarity(vecA, vecB);
        expect(similarity).toBeCloseTo(1.0, 5);
    });

    test('Vector operations handle edge cases', async () => {
        const vectorOps = new VectorOperations();
        
        // Zero vectors
        const zeroA = [0, 0, 0];
        const zeroB = [0, 0, 0];
        const zeroSimilarity = await vectorOps.cosineSimilarity(zeroA, zeroB);
        expect(zeroSimilarity).toBe(0);
        
        // Different length vectors should handle gracefully
        try {
            const shortVec = [1, 0];
            const longVec = [1, 0, 0];
            await vectorOps.cosineSimilarity(shortVec, longVec);
        } catch (error) {
            expect(error.message).toContain('length');
        }
    });

    test('Performance mode is correctly detected', () => {
        const info = getRustInfo();
        
        if (info.available) {
            expect(info.performanceMode).toBe('high');
            expect(info.modules.vectorOps).toBe(true);
            expect(info.modules.fileSearch).toBe(true);
        } else {
            expect(info.performanceMode).toBe('standard');
            expect(info.modules.vectorOps).toBe(false);
            expect(info.modules.fileSearch).toBe(false);
        }
    });

    test('Backend info is consistent', () => {
        const vectorOps = new VectorOperations();
        const fileSearch = new FileSearch();
        const rustInfo = getRustInfo();
        
        const vectorBackend = vectorOps.getBackendInfo();
        const fileBackend = fileSearch.getBackendInfo();
        
        expect(vectorBackend.useRust).toBe(rustInfo.available);
        expect(fileBackend.useRust).toBe(rustInfo.available);
        
        if (rustInfo.available) {
            expect(vectorBackend.type).toBe('rust');
            expect(fileBackend.type).toBe('rust');
            expect(vectorBackend.performance).toBe('high');
            expect(fileBackend.performance).toBe('high');
        } else {
            expect(vectorBackend.type).toBe('javascript');
            expect(fileBackend.type).toBe('javascript');
            expect(vectorBackend.performance).toBe('standard');
            expect(fileBackend.performance).toBe('standard');
        }
    });
});