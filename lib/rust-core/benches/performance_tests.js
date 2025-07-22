#!/usr/bin/env node

/**
 * MOIDVK Performance Benchmarks
 * 
 * Comprehensive performance testing for Rust vs JavaScript implementations
 * Tests vector operations, file search, and overall system performance
 */

import { performance } from 'perf_hooks';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { VectorOperations, runPerformanceBenchmarks, getRustInfo } from '../rust-bindings/index.js';
import { FileSearch } from '../rust-bindings/file-search.js';
import { LocalEmbeddingManager } from '../filesystem/embedding-manager.js';

const BENCHMARK_RESULTS_DIR = join(process.cwd(), 'benchmark-results');

class PerformanceBenchmarker {
    constructor() {
        this.results = {
            timestamp: new Date().toISOString(),
            system: {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                rustInfo: null,
            },
            benchmarks: {},
        };
    }

    async initialize() {
        // Get Rust availability info
        this.results.system.rustInfo = getRustInfo();
        
        // Create results directory
        await mkdir(BENCHMARK_RESULTS_DIR, { recursive: true });
        
        console.log('🚀 MOIDVK Performance Benchmarks');
        console.log('=================================');
        console.log(`Platform: ${process.platform} ${process.arch}`);
        console.log(`Node.js: ${process.version}`);
        console.log(`Rust Available: ${this.results.system.rustInfo.available ? '✅' : '❌'}`);
        if (this.results.system.rustInfo.available) {
            console.log(`Performance Mode: ${this.results.system.rustInfo.performanceMode}`);
        }
        console.log('');
    }

    /**
     * Benchmark vector operations performance
     */
    async benchmarkVectorOperations() {
        console.log('📊 Benchmarking Vector Operations...');
        
        const tests = [
            { size: 512, count: 1000, name: 'Small Embeddings (512D x 1K)' },
            { size: 768, count: 5000, name: 'Medium Embeddings (768D x 5K)' },
            { size: 1024, count: 10000, name: 'Large Embeddings (1024D x 10K)' },
        ];

        const vectorResults = {};

        for (const test of tests) {
            console.log(`  Testing: ${test.name}`);
            
            // Generate test data
            const queryVector = Array.from({ length: test.size }, () => Math.random());
            const testVectors = Array.from({ length: test.count }, () => 
                Array.from({ length: test.size }, () => Math.random())
            );

            // Test Rust implementation
            const rustOps = new VectorOperations({ useSimd: true, useParallel: true });
            const rustResults = await this.timeOperation(
                'Rust Vector Operations',
                async () => {
                    await rustOps.batchCosineSimilarity(queryVector, testVectors);
                }
            );

            // Test JavaScript fallback
            const jsOps = new VectorOperations({ useRust: false });
            const jsResults = await this.timeOperation(
                'JavaScript Vector Operations',
                async () => {
                    await jsOps.batchCosineSimilarity(queryVector, testVectors);
                }
            );

            vectorResults[test.name] = {
                rust: rustResults,
                javascript: jsResults,
                speedup: jsResults.duration / rustResults.duration,
                vectorSize: test.size,
                vectorCount: test.count,
            };

            console.log(`    Rust: ${rustResults.duration}ms`);
            console.log(`    JavaScript: ${jsResults.duration}ms`);
            console.log(`    Speedup: ${vectorResults[test.name].speedup.toFixed(2)}x`);
            console.log('');
        }

        this.results.benchmarks.vectorOperations = vectorResults;
    }

    /**
     * Benchmark file search operations
     */
    async benchmarkFileSearch() {
        console.log('🔍 Benchmarking File Search Operations...');
        
        const searchTests = [
            { pattern: '*.js', name: 'JavaScript Files' },
            { pattern: '**/*.ts', name: 'TypeScript Files (Recursive)' },
            { pattern: '**/package.json', name: 'Package Files (Deep Search)' },
        ];

        const fileResults = {};

        for (const test of searchTests) {
            console.log(`  Testing: ${test.name}`);
            
            // Test Rust implementation
            const rustSearch = new FileSearch({ useRust: true, useParallel: true });
            const rustResults = await this.timeOperation(
                'Rust File Search',
                async () => {
                    await rustSearch.findFilesByPattern('.', test.pattern, ['node_modules/**']);
                }
            );

            // Test JavaScript fallback
            const jsSearch = new FileSearch({ useRust: false });
            const jsResults = await this.timeOperation(
                'JavaScript File Search',
                async () => {
                    await jsSearch.findFilesByPattern('.', test.pattern, ['node_modules/**']);
                }
            );

            fileResults[test.name] = {
                rust: rustResults,
                javascript: jsResults,
                speedup: jsResults.duration / rustResults.duration,
                pattern: test.pattern,
            };

            console.log(`    Rust: ${rustResults.duration}ms`);
            console.log(`    JavaScript: ${jsResults.duration}ms`);
            console.log(`    Speedup: ${fileResults[test.name].speedup.toFixed(2)}x`);
            console.log('');
        }

        this.results.benchmarks.fileSearch = fileResults;
    }

    /**
     * Benchmark embedding manager performance
     */
    async benchmarkEmbeddingManager() {
        console.log('🧠 Benchmarking Embedding Manager...');
        
        const embeddingManager = new LocalEmbeddingManager({
            useSimd: true,
            useParallel: true,
        });

        await embeddingManager.initialize();

        // Test embedding generation
        const testTexts = [
            'function calculateSum(a, b) { return a + b; }',
            'const express = require("express"); const app = express();',
            'import React from "react"; export default function Component() {}',
            'class UserService { async findById(id) { return await db.users.findOne(id); } }',
        ];

        const embeddingResults = await this.timeOperation(
            'Embedding Generation',
            async () => {
                const embeddings = await embeddingManager.generateBatchEmbeddings(
                    testTexts.map((text, i) => ({ content: text, path: `test${i}.js` }))
                );
                return embeddings;
            }
        );

        // Test similarity search
        if (embeddingResults.result && embeddingResults.result.length > 0) {
            const searchResults = await this.timeOperation(
                'Similarity Search',
                async () => {
                    const queryVector = embeddingResults.result[0].vector;
                    const vectors = embeddingResults.result.map(r => ({ path: r.path, vector: r.vector }));
                    return await embeddingManager.findSimilar(queryVector, vectors, 10, 0.5);
                }
            );

            this.results.benchmarks.embeddingManager = {
                generation: embeddingResults,
                search: searchResults,
                textCount: testTexts.length,
            };

            console.log(`    Generation: ${embeddingResults.duration}ms`);
            console.log(`    Search: ${searchResults.duration}ms`);
        }

        console.log('');
    }

    /**
     * Run memory usage tests
     */
    async benchmarkMemoryUsage() {
        console.log('💾 Benchmarking Memory Usage...');
        
        const initialMemory = process.memoryUsage();
        
        // Large vector operations test
        const largeVectors = Array.from({ length: 5000 }, () => 
            Array.from({ length: 1024 }, () => Math.random())
        );
        
        const rustOps = new VectorOperations({ useSimd: true, useParallel: true });
        const queryVector = Array.from({ length: 1024 }, () => Math.random());
        
        const memoryBefore = process.memoryUsage();
        await rustOps.batchCosineSimilarity(queryVector, largeVectors);
        const memoryAfter = process.memoryUsage();
        
        this.results.benchmarks.memoryUsage = {
            initial: initialMemory,
            before: memoryBefore,
            after: memoryAfter,
            peakIncrease: {
                rss: memoryAfter.rss - memoryBefore.rss,
                heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
                heapTotal: memoryAfter.heapTotal - memoryBefore.heapTotal,
            },
        };

        console.log(`    Peak RSS increase: ${(this.results.benchmarks.memoryUsage.peakIncrease.rss / 1024 / 1024).toFixed(2)} MB`);
        console.log(`    Peak heap increase: ${(this.results.benchmarks.memoryUsage.peakIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB`);
        console.log('');
    }

    /**
     * Time an operation and return results
     */
    async timeOperation(name, operation) {
        const start = performance.now();
        const memoryBefore = process.memoryUsage();
        
        let result;
        let error = null;
        
        try {
            result = await operation();
        } catch (err) {
            error = err.message;
        }
        
        const end = performance.now();
        const memoryAfter = process.memoryUsage();
        
        return {
            name,
            duration: end - start,
            memoryDelta: {
                rss: memoryAfter.rss - memoryBefore.rss,
                heapUsed: memoryAfter.heapUsed - memoryBefore.heapUsed,
            },
            result,
            error,
        };
    }

    /**
     * Calculate overall performance summary
     */
    calculateSummary() {
        const summary = {
            overallSpeedup: 1,
            recommendedSettings: {},
            performanceGains: {},
        };

        // Calculate average speedup from vector operations
        if (this.results.benchmarks.vectorOperations) {
            const speedups = Object.values(this.results.benchmarks.vectorOperations)
                .map(test => test.speedup)
                .filter(speedup => !isNaN(speedup) && speedup > 0);
            
            if (speedups.length > 0) {
                summary.overallSpeedup = speedups.reduce((a, b) => a + b) / speedups.length;
            }
        }

        // Calculate performance gains by operation type
        if (this.results.benchmarks.vectorOperations) {
            summary.performanceGains.vectorOperations = `${summary.overallSpeedup.toFixed(2)}x faster`;
        }

        if (this.results.benchmarks.fileSearch) {
            const fileSpeedups = Object.values(this.results.benchmarks.fileSearch)
                .map(test => test.speedup)
                .filter(speedup => !isNaN(speedup) && speedup > 0);
            
            if (fileSpeedups.length > 0) {
                const avgFileSpeedup = fileSpeedups.reduce((a, b) => a + b) / fileSpeedups.length;
                summary.performanceGains.fileSearch = `${avgFileSpeedup.toFixed(2)}x faster`;
            }
        }

        // Recommended settings
        summary.recommendedSettings = {
            useRust: this.results.system.rustInfo.available,
            useSimd: this.results.system.rustInfo.available && this.results.system.rustInfo.performanceInfo?.simd_support,
            useParallel: this.results.system.rustInfo.available,
            embeddingBatchSize: this.results.system.rustInfo.available ? 1000 : 100,
            cacheSize: this.results.system.rustInfo.available ? 10000 : 1000,
        };

        this.results.summary = summary;
    }

    /**
     * Generate performance report
     */
    generateReport() {
        this.calculateSummary();
        
        const report = {
            title: 'MOIDVK Performance Benchmark Report',
            generated: this.results.timestamp,
            ...this.results,
        };

        console.log('📋 Performance Summary');
        console.log('=====================');
        console.log(`Overall Speedup: ${this.results.summary.overallSpeedup.toFixed(2)}x`);
        console.log('Performance Gains:');
        Object.entries(this.results.summary.performanceGains).forEach(([operation, gain]) => {
            console.log(`  ${operation}: ${gain}`);
        });
        console.log('');
        console.log('Recommended Settings:');
        Object.entries(this.results.summary.recommendedSettings).forEach(([setting, value]) => {
            console.log(`  ${setting}: ${value}`);
        });
        console.log('');

        return report;
    }

    /**
     * Save results to file
     */
    async saveResults(report) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `benchmark-${timestamp}.json`;
        const filepath = join(BENCHMARK_RESULTS_DIR, filename);
        
        await writeFile(filepath, JSON.stringify(report, null, 2));
        
        console.log(`📁 Results saved to: ${filepath}`);
        
        // Also save a latest.json for easy access
        const latestPath = join(BENCHMARK_RESULTS_DIR, 'latest.json');
        await writeFile(latestPath, JSON.stringify(report, null, 2));
        
        return filepath;
    }

    /**
     * Run all benchmarks
     */
    async runAll() {
        await this.initialize();
        
        try {
            await this.benchmarkVectorOperations();
            await this.benchmarkFileSearch();
            await this.benchmarkEmbeddingManager();
            await this.benchmarkMemoryUsage();
            
            const report = this.generateReport();
            const filepath = await this.saveResults(report);
            
            console.log('✅ All benchmarks completed successfully!');
            return { success: true, report, filepath };
            
        } catch (error) {
            console.error('❌ Benchmark failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

// Export for use as module
export { PerformanceBenchmarker };

// Run benchmarks if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const benchmarker = new PerformanceBenchmarker();
    benchmarker.runAll()
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}