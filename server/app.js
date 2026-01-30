/**
 * Express Application Setup
 *
 * Configures Express app with middleware, static files, and base settings.
 * Routes are mounted separately in index.js.
 */

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const { requestLogger, defaultSkip } = require('./middleware/request-logger');
const { responseHelpers } = require('./utils/api-response');
const { apiLimiter, aiLimiter } = require('./middleware/rate-limit');

/**
 * Create and configure Express application
 * @returns {express.Application} Configured Express app
 */
function createApp() {
  const app = express();

  // Core middleware
  app.use(cors());
  app.use(compression()); // Gzip compression for all responses
  app.use(express.json());

  // Request logging - logs all API requests with timing
  app.use(requestLogger({ skip: defaultSkip, slowThreshold: 2000 }));

  // API response helpers - adds res.apiSuccess, res.apiError, etc.
  app.use(responseHelpers);

  // Apply rate limiting to API routes
  app.use('/api', apiLimiter);
  app.use('/api/invoices/process', aiLimiter);
  app.use('/api/ai', aiLimiter);

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

module.exports = { createApp };
