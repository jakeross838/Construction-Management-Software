/**
 * Request Logging Middleware
 * Logs all API requests with timing, method, path, status code, and response time.
 */

const logger = require('../utils/logger');

/**
 * Generate a unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Request logging middleware
 * Logs request start and completion with timing information
 */
function requestLogger(options = {}) {
  const {
    skip = () => false,  // Function to skip logging certain requests
    logBody = false,     // Whether to log request body (be careful with sensitive data)
    slowThreshold = 1000 // Requests taking longer than this (ms) are flagged as slow
  } = options;

  return (req, res, next) => {
    // Skip if configured (e.g., health checks, static files)
    if (skip(req)) {
      return next();
    }

    const requestId = generateRequestId();
    const startTime = Date.now();

    // Attach request ID to request object for use in other middleware/handlers
    req.requestId = requestId;

    // Set correlation ID in response header for client-side debugging
    res.setHeader('X-Request-ID', requestId);

    // Log request start
    const requestLog = {
      component: 'http',
      requestId,
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
      user: req.get('x-user-name') || 'anonymous'
    };

    if (logBody && req.body && Object.keys(req.body).length > 0) {
      // Sanitize sensitive fields
      const sanitizedBody = { ...req.body };
      const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
      sensitiveFields.forEach(field => {
        if (sanitizedBody[field]) {
          sanitizedBody[field] = '[REDACTED]';
        }
      });
      requestLog.body = sanitizedBody;
    }

    logger.debug('Request started', requestLog);

    // Capture response finish
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const responseLog = {
        component: 'http',
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        duration,
        contentLength: res.get('content-length')
      };

      // Determine log level based on status code and duration
      if (res.statusCode >= 500) {
        logger.error('Request failed', responseLog);
      } else if (res.statusCode >= 400) {
        logger.warn('Request client error', responseLog);
      } else if (duration > slowThreshold) {
        logger.warn('Slow request', { ...responseLog, slow: true });
      } else {
        logger.info('Request completed', responseLog);
      }
    });

    // Capture errors
    res.on('error', (err) => {
      logger.error('Response error', {
        component: 'http',
        requestId,
        method: req.method,
        path: req.path,
        error: err.message
      });
    });

    next();
  };
}

/**
 * Default skip function - skip health checks and static assets
 */
function defaultSkip(req) {
  // Skip health checks (too noisy)
  if (req.path === '/api/health') return true;

  // Skip static files
  if (req.path.match(/\.(js|css|png|jpg|ico|svg|woff|woff2|ttf|map)$/)) return true;

  // Skip SSE connections (they stay open)
  if (req.path === '/api/realtime/events') return true;

  return false;
}

module.exports = {
  requestLogger,
  defaultSkip,
  generateRequestId
};
