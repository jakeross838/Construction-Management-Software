/**
 * Simple structured logger for the Construction Management Software.
 * Provides consistent logging with levels, timestamps, and context.
 *
 * Features:
 *   - Console output always (for Docker log aggregation and development)
 *   - File output in production: logs/app.log (info+), logs/error.log (error only)
 *   - Simple rotation: files exceeding 10MB are rotated to .1 backup
 *   - LOG_DIR env var to override default log directory
 *
 * Usage:
 *   const logger = require('./utils/logger');
 *   logger.info('Invoice processed', { invoiceId: '123', amount: 1000 });
 *   logger.error('Failed to process', { error: err.message });
 */

const fs = require('fs');
const path = require('path');

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Default to 'info' in production, 'debug' in development
const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL] ??
  (process.env.NODE_ENV === 'production' ? LOG_LEVELS.info : LOG_LEVELS.debug);

const isProduction = process.env.NODE_ENV === 'production';

// --- File logging setup (production only) ---

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Resolve log directory: LOG_DIR env var, or default to <project_root>/logs
const projectRoot = path.resolve(__dirname, '..', '..');
const logDir = process.env.LOG_DIR
  ? path.resolve(process.env.LOG_DIR)
  : path.join(projectRoot, 'logs');

const appLogPath = path.join(logDir, 'app.log');
const errorLogPath = path.join(logDir, 'error.log');

/**
 * Ensure the log directory exists. Called once at startup in production.
 */
function ensureLogDir() {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  } catch (err) {
    console.error(`[LOGGER] Failed to create log directory "${logDir}": ${err.message}`);
  }
}

/**
 * Rotate a log file if it exceeds MAX_FILE_SIZE.
 * Renames file.ext to file.ext.1 (overwriting any previous .1 file), then
 * the caller will write to the original path which will create a fresh file.
 * @param {string} filePath - Absolute path to the log file
 */
function rotateIfNeeded(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return;
    }
    const stats = fs.statSync(filePath);
    if (stats.size >= MAX_FILE_SIZE) {
      const rotatedPath = filePath + '.1';
      // fs.renameSync overwrites the destination on Windows and POSIX
      fs.renameSync(filePath, rotatedPath);
    }
  } catch (err) {
    // Rotation failure should never crash the app; log to console and move on
    console.error(`[LOGGER] Rotation failed for "${filePath}": ${err.message}`);
  }
}

/**
 * Append a line to a log file, rotating first if needed.
 * @param {string} filePath - Absolute path to the log file
 * @param {string} line - Formatted log line (newline will be appended)
 */
function writeToFile(filePath, line) {
  try {
    rotateIfNeeded(filePath);
    fs.appendFileSync(filePath, line + '\n', 'utf8');
  } catch (err) {
    console.error(`[LOGGER] Failed to write to "${filePath}": ${err.message}`);
  }
}

// Create the log directory at module load time if we are in production
if (isProduction) {
  ensureLogDir();
}

// --- Formatting ---

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

// --- Public API ---

/**
 * Log at debug level.
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function debug(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.debug) {
    const line = formatLog('debug', message, context);
    console.log(line);
    // Debug is below info so it never goes to app.log (info+ only)
  }
}

/**
 * Log at info level.
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function info(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.info) {
    const line = formatLog('info', message, context);
    console.log(line);
    if (isProduction) {
      writeToFile(appLogPath, line);
    }
  }
}

/**
 * Log at warn level.
 * @param {string} message - Log message
 * @param {object} context - Additional context
 */
function warn(message, context = {}) {
  if (currentLevel <= LOG_LEVELS.warn) {
    const line = formatLog('warn', message, context);
    console.warn(line);
    if (isProduction) {
      writeToFile(appLogPath, line);
    }
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
    const line = formatLog('error', message, context);
    console.error(line);
    if (isProduction) {
      writeToFile(appLogPath, line);
      writeToFile(errorLogPath, line);
    }
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

  if (level === 'error') {
    error(`${req.method} ${req.path}`, context);
  } else if (level === 'warn') {
    warn(`${req.method} ${req.path}`, context);
  } else if (currentLevel <= LOG_LEVELS.debug) {
    // Only log successful requests at debug level to reduce noise
    debug(`${req.method} ${req.path}`, context);
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
