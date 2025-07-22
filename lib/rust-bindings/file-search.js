/**
 * High-performance file search with Rust backend and JavaScript fallback
 * 
 * This module provides a unified interface for file operations that automatically
 * falls back to JavaScript implementations if the Rust module is unavailable.
 */

import { readdir, stat } from 'fs/promises';
import { join, basename, extname, dirname } from 'path';
import { createReadStream } from 'fs';

let rustCore = null;
let useRust = false;

// Attempt to load Rust module
try {
    rustCore = require('../../lib/rust-core/index.node');
    useRust = true;
    console.log('[MOIDVK] Rust file search loaded successfully');
} catch (error) {
    console.warn('[MOIDVK] Rust file search unavailable, using JavaScript fallback:', error.message);
    useRust = false;
}

/**
 * JavaScript fallback implementation for file search
 */
class JavaScriptFileSearch {
    constructor(config = {}) {
        this.config = {
            maxResults: config.maxResults || 10000,
            useParallel: false, // Limited in JavaScript
            includeHidden: config.includeHidden || false,
            followSymlinks: config.followSymlinks || false,
            maxDepth: config.maxDepth || 20,
            caseSensitive: config.caseSensitive || false,
        };
    }

    async findFilesByPattern(rootPath, pattern, excludePatterns = []) {
        const results = [];
        const regex = this.createPatternRegex(pattern);
        const excludeRegexes = excludePatterns.map(p => this.createPatternRegex(p));

        await this.walkDirectory(rootPath, '', regex, excludeRegexes, results, 0);
        
        return results.slice(0, this.config.maxResults);
    }

    async searchTextInFiles(rootPath, searchText, filePatterns = null, maxMatchesPerFile = 100) {
        const results = [];
        const fileRegexes = filePatterns ? filePatterns.map(p => this.createPatternRegex(p)) : null;
        const searchRegex = new RegExp(
            searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
            this.config.caseSensitive ? 'g' : 'gi'
        );

        await this.walkDirectoryForText(rootPath, '', searchRegex, fileRegexes, results, maxMatchesPerFile, 0);
        
        return results.slice(0, this.config.maxResults);
    }

    async getDirectoryStats(path) {
        const stats = {
            total_files: 0,
            total_directories: 0,
            total_size: 0,
            largest_file_size: 0,
        };

        await this.walkDirectoryForStats(path, '', stats, 0);
        
        return stats;
    }

    async findDuplicateFiles(path) {
        const sizeGroups = new Map();
        
        await this.walkDirectoryForSizes(path, '', sizeGroups, 0);
        
        // Only process files with same size
        const duplicates = new Map();
        const crypto = await import('crypto');
        
        for (const [size, paths] of sizeGroups.entries()) {
            if (paths.length > 1) {
                const hashGroups = new Map();
                
                for (const filePath of paths) {
                    try {
                        const hash = await this.hashFile(filePath, crypto);
                        if (!hashGroups.has(hash)) {
                            hashGroups.set(hash, []);
                        }
                        hashGroups.get(hash).push(filePath);
                    } catch (error) {
                        // Skip files that can't be hashed
                    }
                }
                
                for (const [hash, hashPaths] of hashGroups.entries()) {
                    if (hashPaths.length > 1) {
                        duplicates.set(hash, hashPaths);
                    }
                }
            }
        }
        
        return Object.fromEntries(duplicates);
    }

    createPatternRegex(pattern) {
        // Convert glob pattern to regex
        const regexPattern = pattern
            .replace(/\./g, '\\.')
            .replace(/\*/g, '.*')
            .replace(/\?/g, '.');
        
        const flags = this.config.caseSensitive ? '' : 'i';
        return new RegExp(`^${regexPattern}$`, flags);
    }

    async walkDirectory(dirPath, relativePath, regex, excludeRegexes, results, depth) {
        if (depth > this.config.maxDepth || results.length >= this.config.maxResults) {
            return;
        }

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!this.config.includeHidden && entry.name.startsWith('.')) {
                    continue;
                }

                const fullPath = join(dirPath, entry.name);
                const relPath = relativePath ? join(relativePath, entry.name) : entry.name;

                // Check exclude patterns
                if (excludeRegexes.some(excludeRegex => excludeRegex.test(relPath))) {
                    continue;
                }

                if (entry.isFile() && regex.test(entry.name)) {
                    const stats = await stat(fullPath);
                    results.push({
                        path: relPath,
                        name: entry.name,
                        size: stats.size,
                        lastModified: Math.floor(stats.mtime.getTime() / 1000),
                        fileType: 'file',
                        extension: extname(entry.name) || null,
                    });
                } else if (entry.isDirectory()) {
                    await this.walkDirectory(fullPath, relPath, regex, excludeRegexes, results, depth + 1);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
    }

    async walkDirectoryForText(dirPath, relativePath, searchRegex, fileRegexes, results, maxMatchesPerFile, depth) {
        if (depth > this.config.maxDepth || results.length >= this.config.maxResults) {
            return;
        }

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!this.config.includeHidden && entry.name.startsWith('.')) {
                    continue;
                }

                const fullPath = join(dirPath, entry.name);
                const relPath = relativePath ? join(relativePath, entry.name) : entry.name;

                if (entry.isFile()) {
                    // Check file pattern filter
                    if (fileRegexes && !fileRegexes.some(regex => regex.test(entry.name))) {
                        continue;
                    }

                    // Skip binary files
                    const ext = extname(entry.name).toLowerCase();
                    const binaryExts = ['.exe', '.dll', '.so', '.dylib', '.bin', '.jpg', '.png', '.gif', '.pdf', '.zip'];
                    if (binaryExts.includes(ext)) {
                        continue;
                    }

                    await this.searchInFile(fullPath, relPath, searchRegex, results, maxMatchesPerFile);
                } else if (entry.isDirectory()) {
                    await this.walkDirectoryForText(fullPath, relPath, searchRegex, fileRegexes, results, maxMatchesPerFile, depth + 1);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
    }

    async searchInFile(filePath, relativePath, searchRegex, results, maxMatches) {
        try {
            const { readFile } = await import('fs/promises');
            const content = await readFile(filePath, 'utf8');
            const lines = content.split('\n');
            
            let matchCount = 0;
            
            for (let lineIdx = 0; lineIdx < lines.length && matchCount < maxMatches; lineIdx++) {
                const line = lines[lineIdx];
                let match;
                let matchesInLine = 0;
                
                // Reset regex for each line
                searchRegex.lastIndex = 0;
                
                while ((match = searchRegex.exec(line)) !== null && matchCount < maxMatches) {
                    results.push({
                        filePath: relativePath,
                        lineNumber: lineIdx + 1,
                        lineContent: line,
                        column: match.index,
                        matchLength: match[0].length,
                        matchesInLine: 0, // Will be updated
                    });
                    
                    matchCount++;
                    matchesInLine++;
                    
                    // Prevent infinite loop for global regex
                    if (!searchRegex.global) break;
                }
                
                // Update matchesInLine for all matches from this line
                if (matchesInLine > 0) {
                    const startIdx = results.length - matchesInLine;
                    for (let i = startIdx; i < results.length; i++) {
                        results[i].matchesInLine = matchesInLine;
                    }
                }
            }
        } catch (error) {
            // Skip files that can't be read
        }
    }

    async walkDirectoryForStats(dirPath, relativePath, stats, depth) {
        if (depth > this.config.maxDepth) {
            return;
        }

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!this.config.includeHidden && entry.name.startsWith('.')) {
                    continue;
                }

                const fullPath = join(dirPath, entry.name);
                
                if (entry.isFile()) {
                    const fileStats = await stat(fullPath);
                    stats.total_files++;
                    stats.total_size += fileStats.size;
                    if (fileStats.size > stats.largest_file_size) {
                        stats.largest_file_size = fileStats.size;
                    }
                } else if (entry.isDirectory()) {
                    stats.total_directories++;
                    const relPath = relativePath ? join(relativePath, entry.name) : entry.name;
                    await this.walkDirectoryForStats(fullPath, relPath, stats, depth + 1);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
    }

    async walkDirectoryForSizes(dirPath, relativePath, sizeGroups, depth) {
        if (depth > this.config.maxDepth) {
            return;
        }

        try {
            const entries = await readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                if (!this.config.includeHidden && entry.name.startsWith('.')) {
                    continue;
                }

                const fullPath = join(dirPath, entry.name);
                
                if (entry.isFile()) {
                    const fileStats = await stat(fullPath);
                    const size = fileStats.size;
                    
                    if (!sizeGroups.has(size)) {
                        sizeGroups.set(size, []);
                    }
                    sizeGroups.get(size).push(fullPath);
                } else if (entry.isDirectory()) {
                    const relPath = relativePath ? join(relativePath, entry.name) : entry.name;
                    await this.walkDirectoryForSizes(fullPath, relPath, sizeGroups, depth + 1);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
    }

    async hashFile(filePath, crypto) {
        const { readFile } = await import('fs/promises');
        const content = await readFile(filePath);
        return crypto.createHash('sha256').update(content).digest('hex');
    }
}

/**
 * Unified file search interface
 */
export class FileSearch {
    constructor(config = {}) {
        this.config = config;
        
        if (useRust && rustCore) {
            try {
                this.backend = new rustCore.FileSearch(config);
                this.backendType = 'rust';
            } catch (error) {
                console.warn('[MOIDVK] Failed to create Rust backend, falling back to JavaScript:', error.message);
                this.backend = new JavaScriptFileSearch(config);
                this.backendType = 'javascript';
            }
        } else {
            this.backend = new JavaScriptFileSearch(config);
            this.backendType = 'javascript';
        }
    }

    /**
     * Search for files by glob pattern
     */
    async findFilesByPattern(rootPath, pattern, excludePatterns) {
        return this.backend.findFilesByPattern(rootPath, pattern, excludePatterns);
    }

    /**
     * Search for text content within files
     */
    async searchTextInFiles(rootPath, searchText, filePatterns, maxMatchesPerFile) {
        return this.backend.searchTextInFiles(rootPath, searchText, filePatterns, maxMatchesPerFile);
    }

    /**
     * Get directory statistics
     */
    async getDirectoryStats(path) {
        return this.backend.getDirectoryStats(path);
    }

    /**
     * Find duplicate files using content hashing
     */
    async findDuplicateFiles(path) {
        return this.backend.findDuplicateFiles(path);
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
 * Quick file search function
 */
export async function quickFindFiles(rootPath, pattern, maxResults) {
    const config = { maxResults: maxResults || 1000 };
    const searcher = new FileSearch(config);
    return searcher.findFilesByPattern(rootPath, pattern, null);
}

/**
 * Benchmark file search performance
 */
export async function benchmarkFileSearch(rootPath, pattern) {
    const results = {};

    try {
        if (useRust && rustCore) {
            const rustResults = await rustCore.benchmarkFileSearch(rootPath, pattern);
            results.rust = rustResults;
        }
    } catch (error) {
        console.warn('[MOIDVK] Rust benchmark failed:', error.message);
    }

    // JavaScript benchmark
    const jsSearcher = new JavaScriptFileSearch();
    
    const start = Date.now();
    const jsResults = await jsSearcher.findFilesByPattern(rootPath, pattern, []);
    const jsTime = Date.now() - start;

    results.javascript = {
        time_ms: jsTime,
        results_count: jsResults.length,
    };

    // Calculate speedup if both are available
    if (results.rust && results.javascript) {
        results.speedup = results.javascript.time_ms / (results.rust.parallel_ms || results.rust.sequential_ms);
    }

    return results;
}

// Export default instance for convenience
export const defaultFileSearch = new FileSearch();

// Compatibility exports
export default FileSearch;