/**
 * Health Check Routes
 * Liveness, readiness, and detailed system status endpoints.
 *
 * Endpoints:
 *   GET /           - Quick liveness probe
 *   GET /ready      - Readiness probe (DB, storage, Redis)
 *   GET /detailed   - Full system status (memory, CPU, versions, metrics)
 */

const express = require('express');
const router = express.Router();
const path = require('path');
const { supabase } = require('../../config');
const monitor = require('../core/monitor');

// Load app version once at startup
let appVersion = 'unknown';
try {
  const pkg = require(path.join(__dirname, '..', '..', 'package.json'));
  appVersion = pkg.version || 'unknown';
} catch (_) {
  // package.json not available; leave as 'unknown'
}

// ============================================================
// GET / - Liveness probe
// ============================================================

router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime()
  });
});

// ============================================================
// GET /ready - Readiness probe
// ============================================================

router.get('/ready', async (req, res) => {
  const checks = {};
  let hasCriticalFailure = false;

  // --- Database check (critical) ---
  try {
    const start = Date.now();
    const { count, error } = await supabase
      .from('v2_jobs')
      .select('*', { count: 'exact', head: true });

    const responseTime = Date.now() - start;

    if (error) {
      checks.database = { status: 'error', responseTime, error: error.message };
      hasCriticalFailure = true;
    } else {
      checks.database = { status: 'ok', responseTime, jobCount: count };
    }
  } catch (err) {
    checks.database = { status: 'error', error: err.message };
    hasCriticalFailure = true;
  }

  // --- Storage check (critical) ---
  try {
    const start = Date.now();
    const { data, error } = await supabase.storage.listBuckets();
    const responseTime = Date.now() - start;

    if (error) {
      checks.storage = { status: 'error', responseTime, error: error.message };
      hasCriticalFailure = true;
    } else {
      checks.storage = {
        status: 'ok',
        responseTime,
        bucketCount: data ? data.length : 0
      };
    }
  } catch (err) {
    checks.storage = { status: 'error', error: err.message };
    hasCriticalFailure = true;
  }

  // --- Redis check (optional - only if REDIS_URL is configured) ---
  if (process.env.REDIS_URL) {
    try {
      const cache = require('../services/cache');
      const start = Date.now();
      const healthy = await cache.isHealthy();
      const responseTime = Date.now() - start;

      checks.redis = {
        status: healthy ? 'ok' : 'error',
        responseTime
      };
      if (!healthy) {
        checks.redis.error = 'Redis PING failed';
      }
    } catch (err) {
      checks.redis = { status: 'error', error: err.message };
      // Redis is not critical -- do not set hasCriticalFailure
    }
  } else {
    checks.redis = { status: 'skipped', reason: 'REDIS_URL not configured' };
  }

  const overallStatus = hasCriticalFailure ? 'not_ready' : 'ready';
  const statusCode = hasCriticalFailure ? 503 : 200;

  res.status(statusCode).json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checks
  });
});

// ============================================================
// GET /detailed - Full system status
// ============================================================

router.get('/detailed', (req, res) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const metrics = monitor.getMetrics();

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    system: {
      nodeVersion: process.version,
      appVersion,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      uptime: process.uptime()
    },
    memory: {
      rss: memUsage.rss,
      heapTotal: memUsage.heapTotal,
      heapUsed: memUsage.heapUsed,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers,
      // Human-readable MB values
      rssMB: Math.round(memUsage.rss / 1024 / 1024 * 100) / 100,
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024 * 100) / 100,
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024 * 100) / 100
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system,
      // Microseconds to seconds
      userSeconds: Math.round(cpuUsage.user / 1e6 * 100) / 100,
      systemSeconds: Math.round(cpuUsage.system / 1e6 * 100) / 100
    },
    requests: {
      total: metrics.requestCounts.total,
      success: metrics.requestCounts['2xx'],
      clientErrors: metrics.requestCounts['4xx'],
      serverErrors: metrics.requestCounts['5xx'],
      avgResponseTimeMs: metrics.avgResponseTimeMs,
      activeConnections: metrics.activeConnections
    }
  });
});

module.exports = router;
