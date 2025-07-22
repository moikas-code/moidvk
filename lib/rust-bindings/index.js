/**
 * MOIDVK Rust Bindings - High-performance core operations
 * 
 * This module provides a unified interface to high-performance Rust implementations
 * with automatic fallback to JavaScript when Rust is unavailable.
 */

export { VectorOperations, quickCosineSimilarity, benchmarkVectorOperations, defaultVectorOps } from './vector-ops.js';
export { FileSearch, quickFindFiles, benchmarkFileSearch, defaultFileSearch } from './file-search.js';

let rustCore = null;
let rustAvailable = false;

// Attempt to load the native Rust module
try {
    rustCore = require('../rust-core/index.node');
    rustAvailable = true;
    console.log('[MOIDVK] Rust core module loaded successfully');
} catch (error) {
    console.warn('[MOIDVK] Rust core module unavailable, using JavaScript fallbacks:', error.message);
    rustAvailable = false;
}

/**
 * Get information about Rust availability and performance
 */
export function getRustInfo() {
    const info = {
        available: rustAvailable,
        performanceMode: rustAvailable ? 'high' : 'standard',
        modules: {
            vectorOps: rustAvailable,
            fileSearch: rustAvailable,
            textProcessing: rustAvailable,
            securityUtils: rustAvailable,
        }
    };

    if (rustAvailable && rustCore) {
        try {
            info.version = rustCore.getVersion();
            info.performanceInfo = JSON.parse(rustCore.getPerformanceInfo());
        } catch (error) {
            console.warn('[MOIDVK] Failed to get Rust performance info:', error.message);
        }
    }

    return info;
}

/**
 * Initialize Rust core (if available)
 */
export async function initializeRustCore() {
    if (!rustAvailable || !rustCore) {
        return {
            success: false,
            message: 'Rust core not available',
            fallback: true,
        };
    }

    try {
        const result = rustCore.initializeRustCore();
        return {
            success: true,
            message: result,
            fallback: false,
            info: getRustInfo(),
        };
    } catch (error) {
        return {
            success: false,
            message: error.message,
            fallback: true,
        };
    }
}

/**
 * Run comprehensive performance benchmarks
 */
export async function runPerformanceBenchmarks() {
    const results = {
        timestamp: new Date().toISOString(),
        rustAvailable,
        benchmarks: {},
    };

    try {
        // Vector operations benchmark
        const { benchmarkVectorOperations } = await import('./vector-ops.js');
        results.benchmarks.vectorOps = await benchmarkVectorOperations(1000, 1000);
    } catch (error) {
        results.benchmarks.vectorOps = { error: error.message };
    }

    try {
        // File search benchmark (if we have a test directory)
        const { benchmarkFileSearch } = await import('./file-search.js');
        results.benchmarks.fileSearch = await benchmarkFileSearch('.', '*');
    } catch (error) {
        results.benchmarks.fileSearch = { error: error.message };
    }

    // Calculate overall performance improvement
    if (results.benchmarks.vectorOps && results.benchmarks.vectorOps.speedup) {
        results.overallSpeedup = results.benchmarks.vectorOps.speedup;
    }

    return results;
}

/**
 * Get recommended configuration based on system capabilities
 */
export function getRecommendedConfig() {
    const info = getRustInfo();
    
    return {
        useRust: info.available,
        vectorOps: {
            useSimd: info.available && info.performanceInfo?.simd_support,
            useParallel: info.available,
            batchSize: info.available ? 1000 : 100,
        },
        fileSearch: {
            useParallel: info.available,
            maxResults: info.available ? 10000 : 1000,
            maxDepth: 20,
        },
        embedding: {
            cacheSize: info.available ? 10000 : 1000,
            batchProcessing: info.available,
        }
    };
}

// Export the native module for direct access (if available)
export { rustCore };

export default {
    getRustInfo,
    initializeRustCore,
    runPerformanceBenchmarks,
    getRecommendedConfig,
    rustAvailable,
    rustCore,
};