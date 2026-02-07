/**
 * Self-Monitoring Module
 * Tracks request metrics, response times, and logs periodic summaries.
 *
 * Usage:
 *   const monitor = require('./core/monitor');
 *   app.use(monitor.middleware());          // Install early in middleware chain
 *   const metrics = monitor.getMetrics();   // Retrieve current metrics
 */

const logger = require('../utils/logger').child({ module: 'monitor' });

// ============================================================
// METRICS STATE
// ============================================================

const state = {
  // Request counts by status code bucket
  statusCounts: {
    '2xx': 0,
    '3xx': 0,
    '4xx': 0,
    '5xx': 0,
    total: 0
  },

  // Rolling window of the last 100 response times (ms)
  responseTimes: [],
  RESPONSE_TIME_WINDOW: 100,

  // Tracks active in-flight requests
  activeConnections: 0,

  // Timestamp when the module was loaded (proxy for server start)
  startedAt: Date.now()
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Return the bucket key for an HTTP status code.
 * @param {number} code
 * @returns {string}
 */
function statusBucket(code) {
  if (code < 300) return '2xx';
  if (code < 400) return '3xx';
  if (code < 500) return '4xx';
  return '5xx';
}

/**
 * Record a single response time into the rolling window.
 * @param {number} ms - Duration in milliseconds
 */
function recordResponseTime(ms) {
  state.responseTimes.push(ms);
  if (state.responseTimes.length > state.RESPONSE_TIME_WINDOW) {
    state.responseTimes.shift();
  }
}

/**
 * Compute average of the rolling response-time window.
 * @returns {number} Average in ms, rounded to 2 decimals
 */
function averageResponseTime() {
  const times = state.responseTimes;
  if (times.length === 0) return 0;
  const sum = times.reduce((a, b) => a + b, 0);
  return Math.round((sum / times.length) * 100) / 100;
}

// ============================================================
// MIDDLEWARE
// ============================================================

/**
 * Express middleware that records per-request metrics.
 * Should be mounted early so it wraps all route handlers.
 *
 * @returns {Function} Express middleware
 */
function middleware() {
  return function monitorMiddleware(req, res, next) {
    const start = Date.now();
    state.activeConnections++;

    // Hook into response finish to capture metrics
    res.on('finish', () => {
      const duration = Date.now() - start;
      state.activeConnections--;

      state.statusCounts.total++;
      const bucket = statusBucket(res.statusCode);
      state.statusCounts[bucket]++;

      recordResponseTime(duration);
    });

    next();
  };
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Return a snapshot of all collected metrics.
 * @returns {object}
 */
function getMetrics() {
  return {
    requestCounts: { ...state.statusCounts },
    avgResponseTimeMs: averageResponseTime(),
    responseTimeWindow: state.responseTimes.length,
    activeConnections: state.activeConnections,
    uptimeSeconds: Math.floor((Date.now() - state.startedAt) / 1000)
  };
}

// ============================================================
// PERIODIC SUMMARY (every 5 minutes)
// ============================================================

const SUMMARY_INTERVAL_MS = 5 * 60 * 1000;

let summaryTimer = null;

function startPeriodicSummary() {
  // Avoid duplicate timers if module is re-required
  if (summaryTimer) return;

  summaryTimer = setInterval(() => {
    const m = getMetrics();
    logger.info('Periodic metrics summary', {
      totalRequests: m.requestCounts.total,
      '2xx': m.requestCounts['2xx'],
      '4xx': m.requestCounts['4xx'],
      '5xx': m.requestCounts['5xx'],
      avgResponseTimeMs: m.avgResponseTimeMs,
      activeConnections: m.activeConnections,
      uptimeSeconds: m.uptimeSeconds
    });
  }, SUMMARY_INTERVAL_MS);

  // Allow the process to exit even if the timer is still active
  if (summaryTimer.unref) {
    summaryTimer.unref();
  }
}

// Start the periodic summary on module load
startPeriodicSummary();

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  middleware,
  getMetrics
};
