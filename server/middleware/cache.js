/**
 * Cache Middleware
 * Express middleware for caching GET endpoint responses
 *
 * Usage:
 *   const { cacheResponse } = require('./middleware/cache');
 *   router.get('/items', cacheResponse(300), asyncHandler(async (req, res) => { ... }));
 */

const cache = require('../services/cache');

/**
 * Cache response middleware for GET endpoints
 * Generates cache key from URL + query params
 * Returns cached response if available, otherwise caches successful responses
 *
 * @param {number} ttlSeconds - Time to live in seconds (default: 300 = 5 minutes)
 * @param {Object} options - Additional options
 * @param {string} options.keyPrefix - Custom key prefix (default: 'response')
 * @param {Function} options.keyGenerator - Custom key generator function(req) => string
 * @param {Function} options.shouldCache - Function(req, res) => boolean to determine if should cache
 * @returns {Function} Express middleware
 */
function cacheResponse(ttlSeconds = 300, options = {}) {
  const {
    keyPrefix = 'response',
    keyGenerator = null,
    shouldCache = null
  } = options;

  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    let cacheKey;
    if (keyGenerator) {
      cacheKey = keyGenerator(req);
    } else {
      // Default key generation from URL path and query params
      const path = req.originalUrl || req.url;
      cacheKey = `${keyPrefix}:${path}`;
    }

    try {
      // Check cache first
      const cached = await cache.get(cacheKey);
      if (cached !== null) {
        // Set cache header for debugging
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', cacheKey);
        return res.json(cached);
      }

      // Cache miss - capture response
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);

      // Override json method to cache successful responses
      res.json = (body) => {
        // Only cache successful responses (2xx status)
        const statusCode = res.statusCode || 200;
        const isSuccess = statusCode >= 200 && statusCode < 300;

        // Check custom shouldCache if provided
        const cacheThis = shouldCache ? shouldCache(req, res) : isSuccess;

        if (cacheThis) {
          // Cache in background - don't block response
          cache.set(cacheKey, body, ttlSeconds).catch(err => {
            console.error('[CacheMiddleware] Failed to cache response:', err.message);
          });
        }

        // Call original json
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error('[CacheMiddleware] Error:', err.message);
      // On error, just proceed without caching
      next();
    }
  };
}

/**
 * Cache invalidation middleware
 * Invalidates cache entries when data is modified
 *
 * @param {string|string[]} patterns - Pattern(s) to invalidate (e.g., 'list:jobs:*')
 * @returns {Function} Express middleware
 */
function invalidateCache(patterns) {
  const patternList = Array.isArray(patterns) ? patterns : [patterns];

  return async (req, res, next) => {
    // Store original json/send methods
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    const invalidate = async () => {
      // Only invalidate on successful modifications
      const statusCode = res.statusCode || 200;
      if (statusCode >= 200 && statusCode < 300) {
        for (const pattern of patternList) {
          // Resolve dynamic patterns (e.g., 'entity:${id}')
          let resolvedPattern = pattern;
          if (pattern.includes('${')) {
            resolvedPattern = pattern.replace(/\$\{(\w+)\}/g, (match, key) => {
              return req.params[key] || req.body?.[key] || '*';
            });
          }

          await cache.invalidatePattern(resolvedPattern).catch(err => {
            console.error('[CacheMiddleware] Failed to invalidate:', err.message);
          });
        }
      }
    };

    res.json = (body) => {
      invalidate();
      return originalJson(body);
    };

    res.send = (body) => {
      invalidate();
      return originalSend(body);
    };

    next();
  };
}

/**
 * Create entity-specific cache middleware factory
 * @param {string} entityName - Entity name for key prefix (e.g., 'jobs', 'cost-codes')
 * @returns {Object} - Object with cache and invalidate methods
 */
function createEntityCache(entityName) {
  const listKey = `list:${entityName}`;
  const entityKey = `entity:${entityName}`;

  return {
    /**
     * Cache list endpoint response
     * @param {number} ttlSeconds - TTL in seconds
     */
    cacheList: (ttlSeconds = 300) => cacheResponse(ttlSeconds, {
      keyPrefix: listKey
    }),

    /**
     * Cache single entity response
     * @param {number} ttlSeconds - TTL in seconds
     */
    cacheEntity: (ttlSeconds = 300) => cacheResponse(ttlSeconds, {
      keyGenerator: (req) => `${entityKey}:${req.params.id}`
    }),

    /**
     * Invalidate all list caches for this entity
     */
    invalidateList: () => invalidateCache(`${listKey}:*`),

    /**
     * Invalidate specific entity cache
     */
    invalidateEntity: () => invalidateCache(`${entityKey}:\${id}`),

    /**
     * Invalidate both list and entity caches
     */
    invalidateAll: () => invalidateCache([`${listKey}:*`, `${entityKey}:*`])
  };
}

module.exports = {
  cacheResponse,
  invalidateCache,
  createEntityCache
};
