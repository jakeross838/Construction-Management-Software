/**
 * Cache Service
 * Redis caching with graceful fallback to in-memory Map if Redis not configured
 *
 * Usage:
 *   const cache = require('./services/cache');
 *   await cache.set('entity:123', data, 300); // 5 minute TTL
 *   const data = await cache.get('entity:123');
 *   await cache.del('entity:123');
 *   await cache.invalidatePattern('list:jobs:*');
 *
 * Cache key conventions:
 *   - entity:id         - Single entity (e.g., job:abc-123)
 *   - list:entity:hash  - List with query hash (e.g., list:jobs:status=active)
 */

let redisClient = null;
let useRedis = false;

// In-memory cache fallback
const memoryCache = new Map();
const memoryCacheExpiry = new Map();

// Stats tracking
const stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  deletes: 0,
  invalidations: 0,
  startTime: Date.now()
};

/**
 * Initialize Redis connection if REDIS_URL is configured
 */
async function initRedis() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('[Cache] REDIS_URL not configured, using in-memory cache');
    return false;
  }

  try {
    // Dynamically import ioredis only if we have a Redis URL
    const Redis = require('ioredis');

    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true
    });

    // Event handlers
    redisClient.on('connect', () => {
      console.log('[Cache] Redis connected');
    });

    redisClient.on('error', (err) => {
      console.error('[Cache] Redis error:', err.message);
      // Fall back to memory cache on error
      useRedis = false;
    });

    redisClient.on('close', () => {
      console.log('[Cache] Redis connection closed');
      useRedis = false;
    });

    // Attempt connection
    await redisClient.connect();
    useRedis = true;
    console.log('[Cache] Redis initialized successfully');
    return true;
  } catch (err) {
    console.warn('[Cache] Redis initialization failed, using in-memory cache:', err.message);
    redisClient = null;
    useRedis = false;
    return false;
  }
}

/**
 * Get a cached value
 * @param {string} key - Cache key
 * @returns {Promise<any|null>} - Cached value or null if not found
 */
async function get(key) {
  try {
    if (useRedis && redisClient) {
      const value = await redisClient.get(key);
      if (value) {
        stats.hits++;
        return JSON.parse(value);
      }
      stats.misses++;
      return null;
    }

    // Memory cache fallback
    const expiry = memoryCacheExpiry.get(key);
    if (expiry && Date.now() > expiry) {
      // Expired - clean up
      memoryCache.delete(key);
      memoryCacheExpiry.delete(key);
      stats.misses++;
      return null;
    }

    if (memoryCache.has(key)) {
      stats.hits++;
      return memoryCache.get(key);
    }

    stats.misses++;
    return null;
  } catch (err) {
    console.error('[Cache] Get error:', err.message);
    stats.misses++;
    return null;
  }
}

/**
 * Set a cached value with TTL
 * @param {string} key - Cache key
 * @param {any} value - Value to cache (will be JSON serialized)
 * @param {number} ttlSeconds - Time to live in seconds
 * @returns {Promise<boolean>} - Success status
 */
async function set(key, value, ttlSeconds = 300) {
  try {
    stats.sets++;

    if (useRedis && redisClient) {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(value));
      return true;
    }

    // Memory cache fallback
    memoryCache.set(key, value);
    memoryCacheExpiry.set(key, Date.now() + (ttlSeconds * 1000));
    return true;
  } catch (err) {
    console.error('[Cache] Set error:', err.message);
    return false;
  }
}

/**
 * Delete a cached value
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} - Success status
 */
async function del(key) {
  try {
    stats.deletes++;

    if (useRedis && redisClient) {
      await redisClient.del(key);
      return true;
    }

    // Memory cache fallback
    memoryCache.delete(key);
    memoryCacheExpiry.delete(key);
    return true;
  } catch (err) {
    console.error('[Cache] Delete error:', err.message);
    return false;
  }
}

/**
 * Invalidate all keys matching a pattern
 * For Redis uses SCAN, for memory cache uses prefix matching
 * @param {string} pattern - Pattern to match (e.g., 'list:jobs:*')
 * @returns {Promise<number>} - Number of keys deleted
 */
async function invalidatePattern(pattern) {
  try {
    stats.invalidations++;
    let count = 0;

    if (useRedis && redisClient) {
      // Use SCAN to safely iterate through keys
      let cursor = '0';
      do {
        const [newCursor, keys] = await redisClient.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = newCursor;

        if (keys.length > 0) {
          await redisClient.del(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');

      return count;
    }

    // Memory cache fallback - convert glob pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(`^${regexPattern}$`);

    for (const key of memoryCache.keys()) {
      if (regex.test(key)) {
        memoryCache.delete(key);
        memoryCacheExpiry.delete(key);
        count++;
      }
    }

    return count;
  } catch (err) {
    console.error('[Cache] Invalidate pattern error:', err.message);
    return 0;
  }
}

/**
 * Clear all cached data
 * @returns {Promise<boolean>} - Success status
 */
async function clear() {
  try {
    if (useRedis && redisClient) {
      await redisClient.flushdb();
    } else {
      memoryCache.clear();
      memoryCacheExpiry.clear();
    }

    // Reset stats
    stats.hits = 0;
    stats.misses = 0;
    stats.sets = 0;
    stats.deletes = 0;
    stats.invalidations = 0;

    return true;
  } catch (err) {
    console.error('[Cache] Clear error:', err.message);
    return false;
  }
}

/**
 * Get cache statistics
 * @returns {Object} - Cache stats including hit rate
 */
function getStats() {
  const totalRequests = stats.hits + stats.misses;
  const hitRate = totalRequests > 0 ? (stats.hits / totalRequests) * 100 : 0;
  const uptimeSeconds = Math.floor((Date.now() - stats.startTime) / 1000);

  return {
    mode: useRedis ? 'redis' : 'memory',
    hits: stats.hits,
    misses: stats.misses,
    hitRate: parseFloat(hitRate.toFixed(2)),
    sets: stats.sets,
    deletes: stats.deletes,
    invalidations: stats.invalidations,
    uptimeSeconds,
    memoryCacheSize: memoryCache.size
  };
}

/**
 * Check if cache is healthy
 * @returns {Promise<boolean>}
 */
async function isHealthy() {
  try {
    if (useRedis && redisClient) {
      await redisClient.ping();
      return true;
    }
    // Memory cache is always healthy
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Generate a cache key from URL and query params
 * @param {string} baseKey - Base key (e.g., 'list:jobs')
 * @param {Object} params - Query parameters
 * @returns {string} - Cache key
 */
function generateKey(baseKey, params = {}) {
  if (!params || Object.keys(params).length === 0) {
    return baseKey;
  }

  // Sort keys for consistent hashing
  const sortedKeys = Object.keys(params).sort();
  const queryParts = sortedKeys
    .filter(k => params[k] !== undefined && params[k] !== '')
    .map(k => `${k}=${params[k]}`);

  if (queryParts.length === 0) {
    return baseKey;
  }

  return `${baseKey}:${queryParts.join('&')}`;
}

/**
 * Cleanup expired entries from memory cache
 * Should be called periodically to prevent memory leaks
 */
function cleanupMemoryCache() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, expiry] of memoryCacheExpiry.entries()) {
    if (now > expiry) {
      memoryCache.delete(key);
      memoryCacheExpiry.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
  }

  return cleaned;
}

// Run cleanup every 5 minutes for memory cache
setInterval(cleanupMemoryCache, 5 * 60 * 1000);

/**
 * Gracefully close Redis connection
 */
async function close() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    useRedis = false;
  }
}

// Initialize on module load (non-blocking)
initRedis().catch(() => {});

module.exports = {
  get,
  set,
  del,
  invalidatePattern,
  clear,
  getStats,
  isHealthy,
  generateKey,
  initRedis,
  close
};
