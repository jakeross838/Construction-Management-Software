/**
 * Simple structured logger for the Construction Management Software.
 * Provides consistent logging with levels, timestamps, and context.
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Invoice processed', { invoiceId: '123', amount: 1000 });
 *   logger.error('Failed to process', { error: err.message });
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Default to 'info' in production, 'debug' in development
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ??
  (process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug);

/**
 * Format a log message with timestamp and context.
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {object} context - Additional context
 * @returns {string} Formatted log line
 */
function formatLog(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const contextStr = Object.keys(context).length > 0
    ? ' ' + JSON.stringify(context)
    : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${contextStr}`;
}

/**
 * Log at debug level.
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function debug(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.debug) {
    console.log(formatLog('debug', message, context));
  }
}

/**
 * Log at info level.
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function info(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.info) {
    console.log(formatLog('info', message, context));
  }
}

/**
 * Log at warn level.
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function warn(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.warn) {
    console.warn(formatLog('warn', message, context));
  }
}

/**
 * Log at error level.
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function error(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.error) {
    // Include stack trace if error object provided
    if (context.error instanceof Error) {
      context = {
        ...context,
        error: context.error.message,
        stack: context.error.stack
      };
    }
    console.error(formatLog('error', message, context));
  }
}

/**
 * Create a child logger with preset context.
 * @param {object} baseContext - Context to include in all logs
 * @returns {object} Logger with preset context
 */
function child(baseContext = {}) {
  return {
    debug: (msg, ctx = {}) => debug(msg, { ...baseContext, ...ctx }),
    info: (msg, ctx = {}) => info(msg, { ...baseContext, ...ctx }),
    warn: (msg, ctx = {}) => warn(msg, { ...baseContext, ...ctx }),
    error: (msg, ctx = {}) => error(msg, { ...baseContext, ...ctx })
  };
}

/**
 * Log an HTTP request (for middleware use).
 * @param {object} req - Express request object
 * @param {object} res - Express response object
 * @param {number} duration - Request duration in ms
 */
function httpRequest(req, res, duration) {
  const level = res.statusCode >= 500 ? 'error' :
                res.statusCode >= 400 ? 'warn' : 'info';

  const context = {
    method: req.method,
    path: req.path,
    status: res.statusCode,
    duration: `${duration}ms`
  };

  if (level === 'error' || level === 'warn') {
    console[level === 'error' ? 'error' : 'warn'](formatLog(level, `${req.method} ${req.path}`, context));
  } else if (currentLevel <= LOG_LEVELS.debug) {
    // Only log successful requests at debug level to reduce noise
    console.log(formatLog('debug', `${req.method} ${req.path}`, context));
  }
}

module.exports = {
  debug,
  info,
  warn,
  error,
  child,
  httpRequest,
  LOG_LEVELS
};
