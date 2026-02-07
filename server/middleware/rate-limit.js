/**
 * Rate Limiting Middleware
 *
 * Per-user and per-IP rate limiting for API protection.
 * Uses Redis when REDIS_URL is set, falls back to in-memory storage.
 */

const Redis = require('ioredis');

// ---------------------------------------------------------------------------
// Storage backend
// ---------------------------------------------------------------------------

let redisClient = null;
let useRedis = false;

if (process.env.REDIS_URL) {
  try {
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true
    });

    redisClient.on('error', (err) => {
      console.error('[RateLimit] Redis error:', err.message);
      // On persistent failure the middleware falls through to in-memory
    });

    // Attempt to connect synchronously-ish so we can log the outcome at
    // startup.  The connect() promise is intentionally consumed here and
    // a failure simply disables Redis.
    redisClient.connect()
      .then(() => {
        useRedis = true;
        console.log('[RateLimit] Using Redis store');
      })
      .catch((err) => {
        console.warn('[RateLimit] Redis connect failed, falling back to in-memory:', err.message);
        redisClient = null;
        useRedis = false;
      });
  } catch (err) {
    console.warn('[RateLimit] Could not create Redis client, falling back to in-memory:', err.message);
    redisClient = null;
  }
} else {
  console.log('[RateLimit] REDIS_URL not set, using in-memory store');
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

/**
 * Rate limit storage (in-memory fallback)
 * Structure: Map<key, { count: number, resetTime: number }>
 */
const rateLimitStore = new Map();

/**
 * Cleanup interval (1 minute)
 */
const CLEANUP_INTERVAL = 60 * 1000;

/**
 * Clean up expired entries from the in-memory rate limit store
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetTime <= now) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[RateLimit] Cleaned up ${cleaned} expired entries. Store size: ${rateLimitStore.size}`);
  }
}

// Start cleanup interval (only matters for in-memory mode but is harmless
// when Redis is active)
const cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);

// Prevent the timer from keeping Node.js running
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

// ---------------------------------------------------------------------------
// Rate limit configurations
// ---------------------------------------------------------------------------

const RATE_LIMITS = {
  standard: {
    windowMs: 60 * 1000, // 1 minute
    max: 100,
    message: 'Too many requests, please try again later'
  },
  auth: {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'Too many authentication attempts, please try again later'
  },
  upload: {
    windowMs: 60 * 1000, // 1 minute
    max: 20,
    message: 'Upload rate limit exceeded, please wait'
  },
  ai: {
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: 'AI processing rate limit exceeded, please wait'
  }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract user identifier from request
 * Uses user ID if authenticated, falls back to IP address
 *
 * @param {import('express').Request} req - Express request object
 * @returns {string} User identifier
 */
function getUserIdentifier(req) {
  // Check for authenticated user (from auth middleware or header)
  // Common patterns: req.user, req.userId, x-user-id header
  if (req.user?.id) {
    return `user:${req.user.id}`;
  }

  if (req.userId) {
    return `user:${req.userId}`;
  }

  // Check for user ID in headers (e.g., from Supabase auth)
  const userIdHeader = req.headers['x-user-id'] || req.headers['x-supabase-user-id'];
  if (userIdHeader) {
    return `user:${userIdHeader}`;
  }

  // Check for API key (for machine-to-machine requests)
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    // Use hash of API key to avoid storing the full key
    return `apikey:${hashString(apiKey)}`;
  }

  // Fall back to IP address
  const ip = getClientIP(req);
  return `ip:${ip}`;
}

/**
 * Get client IP address from request
 * Handles proxies and load balancers
 *
 * @param {import('express').Request} req - Express request object
 * @returns {string} Client IP address
 */
function getClientIP(req) {
  // Check X-Forwarded-For header (from proxies/load balancers)
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    // Take the first IP in the chain (original client)
    const ips = forwardedFor.split(',').map(ip => ip.trim());
    return ips[0];
  }

  // Check X-Real-IP header
  const realIP = req.headers['x-real-ip'];
  if (realIP) {
    return realIP;
  }

  // Fall back to socket address
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Simple string hash function
 *
 * @param {string} str - String to hash
 * @returns {string} Hash string
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

// ---------------------------------------------------------------------------
// Redis-backed rate limit check
// ---------------------------------------------------------------------------

const REDIS_KEY_PREFIX = 'rl:';

/**
 * Check and increment rate limit via Redis using INCR + EXPIRE.
 * Returns { count, ttl } where ttl is seconds until the key expires.
 *
 * @param {string} key - Rate limit key
 * @param {number} windowMs - Window in milliseconds
 * @returns {Promise<{ count: number, ttl: number }>}
 */
async function redisIncrement(key, windowMs) {
  const redisKey = `${REDIS_KEY_PREFIX}${key}`;
  const windowSec = Math.ceil(windowMs / 1000);

  // INCR is atomic; if the key does not exist it is set to 0 first.
  const count = await redisClient.incr(redisKey);

  if (count === 1) {
    // First request in this window -- set expiry
    await redisClient.expire(redisKey, windowSec);
  }

  // Fetch TTL so we can compute reset time accurately
  const ttl = await redisClient.ttl(redisKey);

  return { count, ttl: ttl > 0 ? ttl : windowSec };
}

// ---------------------------------------------------------------------------
// Core middleware factory
// ---------------------------------------------------------------------------

/**
 * Create rate limiting middleware
 *
 * @param {Object} options - Rate limit options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message when limit exceeded
 * @param {string} [options.type] - Type identifier for the rate limit key
 * @param {Function} [options.skip] - Function to skip rate limiting
 * @param {Function} [options.keyGenerator] - Custom key generator function
 * @returns {import('express').RequestHandler} Express middleware
 */
function createRateLimiter(options) {
  const {
    windowMs,
    max,
    message,
    type = 'default',
    skip = null,
    keyGenerator = null
  } = options;

  return async (req, res, next) => {
    // Check if rate limiting should be skipped
    if (skip && skip(req)) {
      return next();
    }

    // Generate rate limit key
    const identifier = keyGenerator ? keyGenerator(req) : getUserIdentifier(req);
    const key = `${type}:${identifier}`;

    try {
      if (useRedis && redisClient) {
        // ---- Redis path ----
        const { count, ttl } = await redisIncrement(key, windowMs);
        const remaining = Math.max(0, max - count);
        const resetTimestamp = Math.ceil(Date.now() / 1000) + ttl;

        res.setHeader('X-RateLimit-Limit', max);
        res.setHeader('X-RateLimit-Remaining', remaining);
        res.setHeader('X-RateLimit-Reset', resetTimestamp);

        if (count > max) {
          res.setHeader('Retry-After', ttl);

          return res.status(429).json({
            error: message,
            retryAfter: ttl,
            limit: max,
            windowMs,
            resetAt: new Date(resetTimestamp * 1000).toISOString()
          });
        }

        return next();
      }
    } catch (err) {
      // Redis failed at runtime -- fall through to in-memory
      console.error('[RateLimit] Redis check failed, falling back to in-memory:', err.message);
    }

    // ---- In-memory path ----
    const now = Date.now();
    const resetTime = now + windowMs;

    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime <= now) {
      entry = { count: 1, resetTime };
      rateLimitStore.set(key, entry);
    } else {
      entry.count++;
    }

    const remaining = Math.max(0, max - entry.count);
    const resetTimestamp = Math.ceil(entry.resetTime / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimestamp);

    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

      res.setHeader('Retry-After', retryAfter);

      return res.status(429).json({
        error: message,
        retryAfter,
        limit: max,
        windowMs,
        resetAt: new Date(entry.resetTime).toISOString()
      });
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Pre-built limiters
// ---------------------------------------------------------------------------

/**
 * Standard API rate limiter
 * 100 requests per minute per user/IP
 */
const apiLimiter = createRateLimiter({
  ...RATE_LIMITS.standard,
  type: 'api',
  skip: (req) => req.path === '/api/health'
});

/**
 * Auth endpoints rate limiter
 * 10 requests per minute per user/IP
 */
const authLimiter = createRateLimiter({
  ...RATE_LIMITS.auth,
  type: 'auth'
});

/**
 * File upload rate limiter
 * 20 requests per minute per user/IP
 */
const uploadLimiter = createRateLimiter({
  ...RATE_LIMITS.upload,
  type: 'upload'
});

/**
 * AI processing rate limiter
 * 10 requests per minute per user/IP
 */
const aiLimiter = createRateLimiter({
  ...RATE_LIMITS.ai,
  type: 'ai'
});

// ---------------------------------------------------------------------------
// Utility / admin helpers
// ---------------------------------------------------------------------------

/**
 * Get current rate limit stats (for monitoring/debugging)
 *
 * @returns {Promise<Object>|Object} Rate limit statistics
 */
async function getRateLimitStats() {
  if (useRedis && redisClient) {
    try {
      const keys = await redisClient.keys(`${REDIS_KEY_PREFIX}*`);

      const stats = {
        totalEntries: keys.length,
        entriesByType: {},
        topUsers: [],
        backend: 'redis'
      };

      const typeCounts = {};
      const userCounts = [];

      // Fetch counts in a pipeline for efficiency
      if (keys.length > 0) {
        const pipeline = redisClient.pipeline();
        for (const key of keys) {
          pipeline.get(key);
          pipeline.ttl(key);
        }
        const results = await pipeline.exec();

        for (let i = 0; i < keys.length; i++) {
          const rawKey = keys[i].slice(REDIS_KEY_PREFIX.length);
          const type = rawKey.split(':')[0];
          typeCounts[type] = (typeCounts[type] || 0) + 1;

          const count = parseInt(results[i * 2][1], 10) || 0;
          const ttl = parseInt(results[i * 2 + 1][1], 10) || 0;

          userCounts.push({
            key: rawKey,
            count,
            resetTime: Date.now() + ttl * 1000
          });
        }
      }

      stats.entriesByType = typeCounts;
      stats.topUsers = userCounts
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(u => ({
          identifier: u.key.replace(/^[^:]+:/, ''),
          count: u.count,
          resetAt: new Date(u.resetTime).toISOString()
        }));

      return stats;
    } catch (err) {
      console.error('[RateLimit] Redis stats failed, falling back to in-memory:', err.message);
    }
  }

  // In-memory stats
  const stats = {
    totalEntries: rateLimitStore.size,
    entriesByType: {},
    topUsers: [],
    backend: 'memory'
  };

  const typeCounts = {};
  const userCounts = [];

  for (const [key, value] of rateLimitStore.entries()) {
    const type = key.split(':')[0];
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    userCounts.push({ key, count: value.count, resetTime: value.resetTime });
  }

  stats.entriesByType = typeCounts;
  stats.topUsers = userCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(u => ({
      identifier: u.key.replace(/^[^:]+:/, ''),
      count: u.count,
      resetAt: new Date(u.resetTime).toISOString()
    }));

  return stats;
}

/**
 * Clear rate limits for a specific user (for admin use)
 *
 * @param {string} identifier - User identifier to clear
 * @returns {Promise<number>|number} Number of entries cleared
 */
async function clearRateLimitsForUser(identifier) {
  let cleared = 0;

  if (useRedis && redisClient) {
    try {
      const keys = await redisClient.keys(`${REDIS_KEY_PREFIX}*${identifier}*`);
      if (keys.length > 0) {
        cleared = await redisClient.del(...keys);
      }
      return cleared;
    } catch (err) {
      console.error('[RateLimit] Redis clearRateLimitsForUser failed:', err.message);
    }
  }

  // In-memory fallback
  for (const key of rateLimitStore.keys()) {
    if (key.includes(identifier)) {
      rateLimitStore.delete(key);
      cleared++;
    }
  }

  return cleared;
}

/**
 * Clear all rate limits (for testing/admin use)
 *
 * @returns {Promise<number>|number} Number of entries cleared
 */
async function clearAllRateLimits() {
  if (useRedis && redisClient) {
    try {
      const keys = await redisClient.keys(`${REDIS_KEY_PREFIX}*`);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
      return keys.length;
    } catch (err) {
      console.error('[RateLimit] Redis clearAllRateLimits failed:', err.message);
    }
  }

  // In-memory fallback
  const count = rateLimitStore.size;
  rateLimitStore.clear();
  return count;
}

// ---------------------------------------------------------------------------
// Exports (same shape as original)
// ---------------------------------------------------------------------------

module.exports = {
  // Middleware
  apiLimiter,
  authLimiter,
  uploadLimiter,
  aiLimiter,

  // Factory function for custom limiters
  createRateLimiter,

  // Utilities
  getUserIdentifier,
  getClientIP,
  getRateLimitStats,
  clearRateLimitsForUser,
  clearAllRateLimits,

  // Configuration (exported for testing)
  RATE_LIMITS,

  // Store (exported for testing)
  _rateLimitStore: rateLimitStore
};
