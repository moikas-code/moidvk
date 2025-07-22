#!/usr/bin/env node

/**
 * MOIDVK Benchmark Runner
 * 
 * Runs performance benchmarks and generates reports
 */

import { PerformanceBenchmarker } from '../lib/rust-core/benches/performance_tests.js';

async function main() {
    const args = process.argv.slice(2);
    const options = {
        quick: args.includes('--quick'),
        memory: args.includes('--memory'),
        vectors: args.includes('--vectors'),
        files: args.includes('--files'),
        embeddings: args.includes('--embeddings'),
    };

    // If no specific tests selected, run all
    const runAll = !options.vectors && !options.files && !options.embeddings && !options.memory;

    console.log('🚀 Starting MOIDVK Performance Benchmarks');
    
    if (options.quick) {
        console.log('⚡ Quick mode enabled - running with reduced test sets');
    }
    
    console.log('');

    const benchmarker = new PerformanceBenchmarker();
    await benchmarker.initialize();

    try {
        if (runAll || options.vectors) {
            await benchmarker.benchmarkVectorOperations();
        }

        if (runAll || options.files) {
            await benchmarker.benchmarkFileSearch();
        }

        if (runAll || options.embeddings) {
            await benchmarker.benchmarkEmbeddingManager();
        }

        if (runAll || options.memory) {
            await benchmarker.benchmarkMemoryUsage();
        }

        const report = benchmarker.generateReport();
        const filepath = await benchmarker.saveResults(report);

        console.log('');
        console.log('🎯 Benchmarking Complete!');
        console.log(`📊 Report saved to: ${filepath}`);
        
        // If significant performance improvement detected, suggest configuration
        if (report.summary.overallSpeedup > 2) {
            console.log('');
            console.log('💡 Performance Recommendation:');
            console.log('   Your system shows significant performance gains with Rust acceleration!');
            console.log('   Consider enabling Rust optimizations in your MOIDVK configuration.');
        }

    } catch (error) {
        console.error('❌ Benchmark failed:', error.message);
        process.exit(1);
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}