# MOIDVK Rust Integration

## Overview

MOIDVK includes high-performance Rust implementations for computationally intensive operations, with automatic fallback to JavaScript when Rust is unavailable. This hybrid approach ensures both performance and compatibility.

## Architecture

### Core Components

1. **Rust Core Library** (`lib/rust-core/`)
   - High-performance SIMD-accelerated vector operations
   - Parallel file search and text processing
   - Security utilities with path validation
   - Native Node.js bindings using NAPI

2. **JavaScript Bindings** (`lib/rust-bindings/`)
   - Unified interface with automatic fallback
   - Performance benchmarking and monitoring
   - Configuration management

3. **Integration Layer**
   - Seamless integration with existing tools
   - Async/await compatibility
   - Error handling and graceful degradation

## Performance Improvements

### Vector Operations
- **10-50x faster** cosine similarity calculations using SIMD
- **Batch processing** for multiple vector comparisons
- **Parallel computation** using Rayon for multi-core systems
- **Memory-efficient** operations reducing GC pressure

### File Search Operations
- **5-10x faster** file system traversal
- **Parallel directory walking** using multiple threads
- **Advanced pattern matching** with Aho-Corasick algorithm
- **Optimized I/O** with async file operations

### Embedding Operations
- **Real-time similarity search** with thousands of embeddings
- **Reduced memory allocation** and improved cache locality
- **Hardware acceleration** when available (AVX2, SSE)

## Installation and Setup

### Requirements
- **Rust 1.70+** (optional, for compilation)
- **Node.js 16+** with native module support
- **Platform-specific build tools** (varies by OS)

### Automatic Setup
```bash
npm install
# Rust modules are built automatically during postinstall
# Falls back to JavaScript if Rust compilation fails
```

### Manual Build
```bash
# Build Rust core library
npm run build:rust

# Build Node.js bindings
npm run build:napi

# Build everything
npm run build:all
```

## Usage

### Vector Operations

```javascript
import { VectorOperations } from './lib/rust-bindings/vector-ops.js';

// Create with high-performance settings
const vectorOps = new VectorOperations({
  useSimd: true,        // Enable SIMD acceleration
  useParallel: true,    // Enable parallel processing
  similarityThreshold: 0.7
});

// Calculate cosine similarity
const similarity = await vectorOps.cosineSimilarity(vecA, vecB);

// Batch similarity calculation
const similarities = await vectorOps.batchCosineSimilarity(queryVector, vectors);

// Find most similar vectors
const results = await vectorOps.findSimilarVectors(query, vectors, paths, topK);
```

### File Search Operations

```javascript
import { FileSearch } from './lib/rust-bindings/file-search.js';

const fileSearch = new FileSearch({
  maxResults: 10000,
  useParallel: true,
  includeHidden: false,
  maxDepth: 20
});

// Find files by pattern
const files = await fileSearch.findFilesByPattern('.', '**/*.js', ['node_modules/**']);

// Search text in files
const matches = await fileSearch.searchTextInFiles('.', 'function', ['*.js', '*.ts']);

// Get directory statistics
const stats = await fileSearch.getDirectoryStats('./src');
```

### Embedding Manager with Rust Acceleration

```javascript
import { LocalEmbeddingManager } from './lib/filesystem/embedding-manager.js';

const embeddingManager = new LocalEmbeddingManager({
  useSimd: true,
  useParallel: true,
  similarityThreshold: 0.7
});

await embeddingManager.initialize();

// Generate embeddings (uses Transformers.js)
const embedding = await embeddingManager.generateEmbedding(content, filePath);

// Find similar files (uses Rust acceleration)
const similar = await embeddingManager.findSimilar(queryVector, embeddings, 10, 0.7);
```

## Configuration

### Performance Settings

```javascript
// Get recommended configuration for current system
import { getRecommendedConfig } from './lib/rust-bindings/index.js';

const config = getRecommendedConfig();
// {
//   useRust: true,
//   vectorOps: { useSimd: true, useParallel: true, batchSize: 1000 },
//   fileSearch: { useParallel: true, maxResults: 10000 },
//   embedding: { cacheSize: 10000, batchProcessing: true }
// }
```

### Runtime Information

```javascript
import { getRustInfo } from './lib/rust-bindings/index.js';

const info = getRustInfo();
console.log('Rust available:', info.available);
console.log('Performance mode:', info.performanceMode);
console.log('SIMD support:', info.performanceInfo?.simd_support);
```

## Benchmarking

### Running Benchmarks

```bash
# Full benchmark suite
npm run benchmark

# Quick benchmarks
npm run benchmark:quick

# Specific benchmarks
npm run benchmark:vectors
npm run benchmark:files
npm run benchmark:memory
```

### Benchmark Results

Benchmarks automatically generate detailed reports including:
- **Performance comparisons** (Rust vs JavaScript)
- **Memory usage analysis**
- **Speedup calculations**
- **Recommended settings** for your system

Results are saved to `benchmark-results/` directory.

### Expected Performance Gains

| Operation | Typical Speedup | Best Case | Use Case |
|-----------|----------------|-----------|----------|
| Vector Similarity | 10-25x | 50x | Semantic search |
| Batch Operations | 15-30x | 60x | Large embedding sets |
| File Search | 5-8x | 15x | Pattern matching |
| Text Processing | 3-7x | 12x | Content analysis |

## Troubleshooting

### Rust Compilation Issues

If Rust compilation fails during installation:

1. **Install Rust**: Visit [rustup.rs](https://rustup.rs/) for installation
2. **Check version**: Ensure Rust 1.70+ is installed
3. **Platform tools**: Install platform-specific build tools
4. **Manual build**: Try `npm run build:rust` for detailed error messages

The system will automatically fall back to JavaScript implementations.

### Performance Issues

1. **Check Rust availability**:
   ```javascript
   const info = getRustInfo();
   console.log('Rust available:', info.available);
   ```

2. **Verify SIMD support**:
   ```javascript
   console.log('SIMD support:', info.performanceInfo?.simd_support);
   ```

3. **Run benchmarks** to verify performance:
   ```bash
   npm run benchmark:quick
   ```

### Memory Issues

For large datasets:
1. **Reduce batch sizes** in vector operations
2. **Enable streaming** for file operations
3. **Use pagination** for search results
4. **Monitor memory usage** with benchmark tools

## API Reference

### VectorOperations Class

#### Constructor
```javascript
new VectorOperations(config)
```
- `config.useSimd` - Enable SIMD acceleration (default: true)
- `config.useParallel` - Enable parallel processing (default: true)
- `config.similarityThreshold` - Default similarity threshold (default: 0.7)

#### Methods

**`async cosineSimilarity(vecA, vecB)`**
- Calculate cosine similarity between two vectors
- Returns: `Promise<number>` (0-1 similarity score)

**`async batchCosineSimilarity(queryVector, vectors)`**
- Calculate similarities for multiple vectors in parallel
- Returns: `Promise<number[]>` (array of similarity scores)

**`async findSimilarVectors(queryVector, vectors, paths, topK)`**
- Find most similar vectors from a collection
- Returns: `Promise<Array<{path, similarity, index}>>` (sorted results)

**`async normalizeVector(vector)`**
- Normalize vector to unit length
- Returns: `Promise<number[]>` (normalized vector)

**`vectorNorm(vector)`**
- Calculate L2 norm of vector
- Returns: `number` (vector magnitude)

### FileSearch Class

#### Constructor
```javascript
new FileSearch(config)
```
- `config.maxResults` - Maximum results to return (default: 10000)
- `config.useParallel` - Enable parallel search (default: true)
- `config.includeHidden` - Include hidden files (default: false)
- `config.maxDepth` - Maximum directory depth (default: 20)

#### Methods

**`async findFilesByPattern(rootPath, pattern, excludePatterns)`**
- Find files matching glob patterns
- Returns: `Promise<Array<FileInfo>>` (file metadata)

**`async searchTextInFiles(rootPath, searchText, filePatterns, maxMatchesPerFile)`**
- Search for text content within files
- Returns: `Promise<Array<Match>>` (search results with context)

**`async getDirectoryStats(path)`**
- Get directory statistics
- Returns: `Promise<Stats>` (file counts, sizes, etc.)

## Development

### Adding New Rust Modules

1. **Create Rust module** in `lib/rust-core/src/`
2. **Add NAPI bindings** for Node.js compatibility
3. **Create JavaScript wrapper** in `lib/rust-bindings/`
4. **Add fallback implementation** for when Rust is unavailable
5. **Write tests** and benchmarks
6. **Update documentation**

### Building and Testing

```bash
# Development build
npm run build:rust:debug

# Run integration tests
npm test

# Run benchmarks
npm run benchmark

# Check code quality
npm run lint
```

## Future Improvements

### Planned Features
- **WebAssembly support** for browser compatibility
- **GPU acceleration** using compute shaders
- **Advanced caching** with persistent storage
- **Distributed processing** for large datasets

### Performance Targets
- **100x speedup** for large vector operations
- **Real-time search** in million-file codebases
- **Sub-millisecond** similarity calculations
- **Memory usage reduction** by 50%

## Contributing

When contributing to Rust integration:

1. **Maintain compatibility** with JavaScript fallbacks
2. **Add comprehensive tests** for new features
3. **Include benchmarks** to measure performance
4. **Update documentation** with examples
5. **Follow Rust best practices** for safety and performance

## License

Rust integration code is licensed under MIT, same as the rest of MOIDVK.