/**
 * Express Application Setup
 *
 * Configures Express app with middleware, static files, and base settings.
 * Routes are mounted separately in index.js.
 */

// Sentry must be initialized before any other imports
let Sentry;
if (process.env.SENTRY_DSN) {
  Sentry = require('@sentry/node');
  const pkg = require('../package.json');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: pkg.version,
  });
}

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { requestLogger, defaultSkip } = require('./middleware/request-logger');
const { responseHelpers } = require('./utils/api-response');
const { apiLimiter, aiLimiter, authLimiter, uploadLimiter } = require('./middleware/rate-limit');
const {
  securityHeaders,
  xssDetection,
  sqlInjectionDetection,
  bodySizeLimit
} = require('./middleware/security');

/**
 * Create and configure Express application
 * @returns {express.Application} Configured Express app
 */
function createApp() {
  const app = express();

  // Sentry request handler must be the first middleware
  if (Sentry) {
    app.use(Sentry.Handlers.requestHandler());
  }

  // Security headers (CSP, XSS protection, etc.) - apply first
  app.use(securityHeaders());

  // Request body size limits
  app.use(bodySizeLimit());

  // Core middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    credentials: true
  }));
  app.use(compression()); // Gzip compression for all responses
  app.use(express.json({ limit: '10mb' }));

  // Request logging - logs all API requests with timing
  app.use(requestLogger({ skip: defaultSkip, slowThreshold: 2000 }));

  // API response helpers - adds res.apiSuccess, res.apiError, etc.
  app.use(responseHelpers);

  // Security detection middleware for API routes (logs suspicious input)
  app.use('/api', xssDetection());
  app.use('/api', sqlInjectionDetection());

  // Apply rate limiting to API routes
  // General API rate limit (100 req/min) - skips /api/health
  app.use('/api', apiLimiter);

  // Stricter rate limits for specific endpoint types

  // Auth endpoints (10 req/min) - protects against brute force
  app.use('/api/auth', authLimiter);

  // File upload endpoints (20 req/min) - prevents upload spam
  app.use('/api/invoices/upload', uploadLimiter);
  app.use('/api/documents/upload', uploadLimiter);
  app.use('/api/photos/upload', uploadLimiter);
  app.use('/api/attachments', uploadLimiter);

  // AI processing endpoints (10 req/min) - expensive operations
  app.use('/api/invoices/process', aiLimiter);
  app.use('/api/ai', aiLimiter);
  app.use('/api/ai-estimates', aiLimiter);
  app.use('/api/document-hub/process', aiLimiter);

  // Disable caching for JS files during development
  app.use('/js', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });

  // Serve React build from client/dist
  app.use(express.static(path.join(__dirname, '../client/dist')));

  return app;
}

module.exports = { createApp, Sentry };
