/**
 * Rate Limiting Middleware
 * Protects API endpoints from abuse
 */

const rateLimit = require('express-rate-limit');

// Standard API rate limiter
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.path === '/api/health' // Don't rate limit health checks
});

// Stricter limit for AI processing (expensive operations)
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 10, // 10 AI requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI processing rate limit exceeded, please wait' }
});

// Upload rate limiter (prevent spam uploads)
const uploadLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // 20 uploads per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit exceeded, please wait' }
});

module.exports = {
  apiLimiter,
  aiLimiter,
  uploadLimiter
};
