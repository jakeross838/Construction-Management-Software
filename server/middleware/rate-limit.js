/**
 * Rate Limiting Middleware
 *
 * Per-user and per-IP rate limiting for API protection.
 * Uses in-memory storage with automatic cleanup.
 */

/**
 * Rate limit storage
 * Structure: Map<key, { count: number, resetTime: number }>
 */
const rateLimitStore = new Map();

/**
 * Cleanup interval (1 minute)
 */
const CLEANUP_INTERVAL = 60 * 1000;

/**
 * Rate limit configurations
 */
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

/**
 * Clean up expired entries from the rate limit store
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

// Start cleanup interval
const cleanupTimer = setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL);

// Prevent the timer from keeping Node.js running
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

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

  return (req, res, next) => {
    // Check if rate limiting should be skipped
    if (skip && skip(req)) {
      return next();
    }

    // Generate rate limit key
    const identifier = keyGenerator ? keyGenerator(req) : getUserIdentifier(req);
    const key = `${type}:${identifier}`;

    const now = Date.now();
    const resetTime = now + windowMs;

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || entry.resetTime <= now) {
      // Create new entry or reset expired one
      entry = { count: 1, resetTime };
      rateLimitStore.set(key, entry);
    } else {
      // Increment existing entry
      entry.count++;
    }

    // Calculate remaining requests
    const remaining = Math.max(0, max - entry.count);
    const resetTimestamp = Math.ceil(entry.resetTime / 1000);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetTimestamp);

    // Check if limit exceeded
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

/**
 * Get current rate limit stats (for monitoring/debugging)
 *
 * @returns {Object} Rate limit statistics
 */
function getRateLimitStats() {
  const stats = {
    totalEntries: rateLimitStore.size,
    entriesByType: {},
    topUsers: []
  };

  const typeCounts = {};
  const userCounts = [];

  for (const [key, value] of rateLimitStore.entries()) {
    // Extract type from key
    const type = key.split(':')[0];
    typeCounts[type] = (typeCounts[type] || 0) + 1;

    userCounts.push({ key, count: value.count, resetTime: value.resetTime });
  }

  stats.entriesByType = typeCounts;
  stats.topUsers = userCounts
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(u => ({
      identifier: u.key.replace(/^[^:]+:/, ''), // Remove type prefix
      count: u.count,
      resetAt: new Date(u.resetTime).toISOString()
    }));

  return stats;
}

/**
 * Clear rate limits for a specific user (for admin use)
 *
 * @param {string} identifier - User identifier to clear
 * @returns {number} Number of entries cleared
 */
function clearRateLimitsForUser(identifier) {
  let cleared = 0;

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
 */
function clearAllRateLimits() {
  const count = rateLimitStore.size;
  rateLimitStore.clear();
  return count;
}

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
