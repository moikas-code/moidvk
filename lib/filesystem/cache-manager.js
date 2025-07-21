import { readFile, writeFile, mkdir, unlink, stat, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { existsSync } from 'fs';
import crypto from 'crypto';

/**
 * Manages persistent caching with disk storage and memory optimization
 */
export class CacheManager {
  constructor(options = {}) {
    this.cacheDir = options.cacheDir || join(process.cwd(), '.cache');
    this.maxMemoryEntries = options.maxMemoryEntries || 1000;
    this.maxDiskSize = options.maxDiskSize || 100 * 1024 * 1024; // 100MB
    this.ttl = options.ttl || 24 * 60 * 60 * 1000; // 24 hours default
    this.namespace = options.namespace || 'default';
    this.memoryCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      diskWrites: 0,
      diskReads: 0,
    };
    this.initPromise = null;
  }

  /**
   * Initialize cache directory
   */
  async initialize() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initialize();
    return this.initPromise;
  }

  async _initialize() {
    const namespacedDir = join(this.cacheDir, this.namespace);
    if (!existsSync(namespacedDir)) {
      await mkdir(namespacedDir, { recursive: true });
    }
    
    // Load cache index
    await this.loadIndex();
    
    // Start periodic cleanup
    this.startCleanupTimer();
  }

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {Promise<any|null>} Cached value or null
   */
  async get(key) {
    await this.initialize();
    
    // Check memory cache first
    if (this.memoryCache.has(key)) {
      const entry = this.memoryCache.get(key);
      if (this.isValid(entry)) {
        this.stats.hits++;
        this.updateAccessTime(key);
        return entry.value;
      } else {
        this.memoryCache.delete(key);
      }
    }

    // Check disk cache
    try {
      const filePath = this.getFilePath(key);
      if (existsSync(filePath)) {
        const data = await readFile(filePath, 'utf8');
        const entry = JSON.parse(data);
        
        if (this.isValid(entry)) {
          this.stats.hits++;
          this.stats.diskReads++;
          
          // Promote to memory cache
          this.setMemoryCache(key, entry);
          this.updateAccessTime(key);
          
          return entry.value;
        } else {
          // Remove expired entry
          await this.delete(key);
        }
      }
    } catch (error) {
      // Cache read error, treat as miss
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set cache value
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {Object} options - Cache options
   */
  async set(key, value, options = {}) {
    await this.initialize();
    
    const ttl = options.ttl || this.ttl;
    const entry = {
      value,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      accessedAt: Date.now(),
      size: this.estimateSize(value),
    };

    // Set in memory cache
    this.setMemoryCache(key, entry);

    // Write to disk periodically
    if (this.shouldWriteToDisk()) {
      await this.writeToDisk(key, entry);
    }
  }

  /**
   * Delete cached value
   * @param {string} key - Cache key
   */
  async delete(key) {
    this.memoryCache.delete(key);
    
    try {
      const filePath = this.getFilePath(key);
      if (existsSync(filePath)) {
        await unlink(filePath);
      }
    } catch (error) {
      // Ignore deletion errors
    }
  }

  /**
   * Clear entire cache
   * @param {boolean} confirmed - Confirmation required
   */
  async clear(confirmed = false) {
    if (!confirmed) {
      throw new Error('Confirmation required to clear cache');
    }

    this.memoryCache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      diskWrites: 0,
      diskReads: 0,
    };

    // Clear disk cache
    const namespacedDir = join(this.cacheDir, this.namespace);
    if (existsSync(namespacedDir)) {
      const files = await readdir(namespacedDir);
      await Promise.all(
        files.map(file => unlink(join(namespacedDir, file)))
      );
    }
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    return {
      ...this.stats,
      memoryEntries: this.memoryCache.size,
      hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
      memoryUsage: this.calculateMemoryUsage(),
    };
  }

  /**
   * Private helper methods
   */

  isValid(entry) {
    return entry && entry.expiresAt > Date.now();
  }

  setMemoryCache(key, entry) {
    // Evict if necessary
    if (this.memoryCache.size >= this.maxMemoryEntries) {
      this.evictLRU();
    }
    
    this.memoryCache.set(key, entry);
  }

  evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.memoryCache) {
      if (entry.accessedAt < oldestTime) {
        oldestTime = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  updateAccessTime(key) {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.accessedAt = Date.now();
    }
  }

  getFilePath(key) {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    const subdir = hash.substring(0, 2);
    return join(this.cacheDir, this.namespace, subdir, hash);
  }

  async writeToDisk(key, entry) {
    try {
      const filePath = this.getFilePath(key);
      const dir = dirname(filePath);
      
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
      }

      await writeFile(filePath, JSON.stringify(entry), 'utf8');
      this.stats.diskWrites++;
    } catch (error) {
      // Disk write error, continue with memory cache only
    }
  }

  shouldWriteToDisk() {
    // Write to disk every 10 entries or every minute
    return this.stats.diskWrites % 10 === 0;
  }

  estimateSize(value) {
    try {
      return JSON.stringify(value).length;
    } catch {
      return 1000; // Default estimate
    }
  }

  calculateMemoryUsage() {
    let total = 0;
    for (const entry of this.memoryCache.values()) {
      total += entry.size || 0;
    }
    return total;
  }

  async loadIndex() {
    // In a more advanced implementation, load an index of cached items
    // For now, we scan on demand
  }

  startCleanupTimer() {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);
  }

  async cleanup() {
    // Remove expired entries from memory
    for (const [key, entry] of this.memoryCache) {
      if (!this.isValid(entry)) {
        this.memoryCache.delete(key);
      }
    }

    // Cleanup disk cache (in background)
    this.cleanupDisk().catch(() => {});
  }

  async cleanupDisk() {
    const namespacedDir = join(this.cacheDir, this.namespace);
    if (!existsSync(namespacedDir)) {
      return;
    }

    // Scan subdirectories
    const subdirs = await readdir(namespacedDir);
    let totalSize = 0;
    const files = [];

    for (const subdir of subdirs) {
      const subdirPath = join(namespacedDir, subdir);
      const subdirFiles = await readdir(subdirPath);
      
      for (const file of subdirFiles) {
        const filePath = join(subdirPath, file);
        const stats = await stat(filePath);
        
        files.push({
          path: filePath,
          size: stats.size,
          mtime: stats.mtime,
        });
        
        totalSize += stats.size;
      }
    }

    // Remove oldest files if over size limit
    if (totalSize > this.maxDiskSize) {
      files.sort((a, b) => a.mtime - b.mtime);
      
      while (totalSize > this.maxDiskSize && files.length > 0) {
        const file = files.shift();
        await unlink(file.path);
        totalSize -= file.size;
      }
    }
  }
}

/**
 * Specialized cache manager for embeddings
 */
export class EmbeddingCacheManager extends CacheManager {
  constructor(options = {}) {
    super({
      ...options,
      namespace: options.namespace || 'embeddings',
      ttl: options.ttl || 7 * 24 * 60 * 60 * 1000, // 7 days for embeddings
    });
  }

  /**
   * Get embedding by content hash
   * @param {string} contentHash - SHA-256 hash of content
   * @param {string} filePath - File path for additional context
   */
  async getEmbedding(contentHash, filePath) {
    const key = `${filePath}:${contentHash}`;
    return this.get(key);
  }

  /**
   * Set embedding
   * @param {string} contentHash - SHA-256 hash of content
   * @param {string} filePath - File path for additional context
   * @param {number[]} vector - Embedding vector
   * @param {Object} metadata - Additional metadata
   */
  async setEmbedding(contentHash, filePath, vector, metadata = {}) {
    const key = `${filePath}:${contentHash}`;
    const value = {
      vector,
      metadata,
      contentHash,
      filePath,
    };
    
    await this.set(key, value);
  }

  /**
   * Get embeddings for multiple files
   * @param {Array<{contentHash: string, filePath: string}>} items
   * @returns {Promise<Map<string, any>>} Map of key to embedding
   */
  async getBatch(items) {
    const results = new Map();
    
    await Promise.all(
      items.map(async ({ contentHash, filePath }) => {
        const key = `${filePath}:${contentHash}`;
        const value = await this.get(key);
        if (value) {
          results.set(key, value);
        }
      })
    );
    
    return results;
  }
}

// Export a default instance for embeddings
export const defaultEmbeddingCache = new EmbeddingCacheManager();