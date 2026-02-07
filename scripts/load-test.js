/**
 * Simple Load Test Script
 * Tests key API endpoints under concurrent load.
 *
 * Usage: node scripts/load-test.js [base-url] [concurrency] [duration-seconds]
 * Example: node scripts/load-test.js http://localhost:3001 20 30
 */

const http = require('http');
const https = require('https');

const BASE_URL = process.argv[2] || 'http://localhost:3001';
const CONCURRENCY = parseInt(process.argv[3]) || 20;
const DURATION_SECONDS = parseInt(process.argv[4]) || 30;

const ENDPOINTS = [
  { method: 'GET', path: '/api/health', weight: 3 },
  { method: 'GET', path: '/api/jobs', weight: 2 },
  { method: 'GET', path: '/api/invoices?limit=20', weight: 2 },
  { method: 'GET', path: '/api/vendors', weight: 1 },
  { method: 'GET', path: '/api/dashboard/stats', weight: 2 },
  { method: 'GET', path: '/api/purchase-orders?limit=20', weight: 1 },
  { method: 'GET', path: '/api/draws', weight: 1 },
];

// Build weighted endpoint list
const weightedEndpoints = [];
for (const ep of ENDPOINTS) {
  for (let i = 0; i < ep.weight; i++) {
    weightedEndpoints.push(ep);
  }
}

const stats = {
  total: 0,
  success: 0,
  errors: 0,
  statusCodes: {},
  latencies: [],
  startTime: null,
};

function pickRandom() {
  return weightedEndpoints[Math.floor(Math.random() * weightedEndpoints.length)];
}

function makeRequest(endpoint) {
  return new Promise((resolve) => {
    const url = new URL(endpoint.path, BASE_URL);
    const client = url.protocol === 'https:' ? https : http;
    const start = Date.now();

    const req = client.request(url, { method: endpoint.method, timeout: 10000 }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        const latency = Date.now() - start;
        stats.total++;
        stats.latencies.push(latency);
        stats.statusCodes[res.statusCode] = (stats.statusCodes[res.statusCode] || 0) + 1;

        if (res.statusCode >= 200 && res.statusCode < 400) {
          stats.success++;
        } else {
          stats.errors++;
        }
        resolve({ status: res.statusCode, latency, path: endpoint.path });
      });
    });

    req.on('error', (err) => {
      stats.total++;
      stats.errors++;
      stats.statusCodes['ERR'] = (stats.statusCodes['ERR'] || 0) + 1;
      resolve({ status: 'ERR', latency: Date.now() - start, error: err.message });
    });

    req.on('timeout', () => {
      req.destroy();
      stats.total++;
      stats.errors++;
      stats.statusCodes['TIMEOUT'] = (stats.statusCodes['TIMEOUT'] || 0) + 1;
      resolve({ status: 'TIMEOUT', latency: Date.now() - start });
    });

    req.end();
  });
}

async function worker(id, endTime) {
  while (Date.now() < endTime) {
    const endpoint = pickRandom();
    await makeRequest(endpoint);
  }
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

async function run() {
  console.log('='.repeat(60));
  console.log('  LOAD TEST - Ross Built CMS');
  console.log('='.repeat(60));
  console.log(`  Target:      ${BASE_URL}`);
  console.log(`  Concurrency: ${CONCURRENCY} workers`);
  console.log(`  Duration:    ${DURATION_SECONDS}s`);
  console.log(`  Endpoints:   ${ENDPOINTS.length}`);
  console.log('='.repeat(60));
  console.log();

  // Verify server is reachable
  try {
    await makeRequest({ method: 'GET', path: '/api/health' });
    // Reset stats after warmup
    stats.total = 0;
    stats.success = 0;
    stats.errors = 0;
    stats.statusCodes = {};
    stats.latencies = [];
  } catch {
    console.error(`ERROR: Cannot reach ${BASE_URL}/api/health`);
    console.error('Make sure the server is running.');
    process.exit(1);
  }

  console.log('Starting load test...\n');
  stats.startTime = Date.now();
  const endTime = Date.now() + (DURATION_SECONDS * 1000);

  // Progress reporter
  const progressInterval = setInterval(() => {
    const elapsed = ((Date.now() - stats.startTime) / 1000).toFixed(0);
    const rps = (stats.total / (elapsed || 1)).toFixed(1);
    process.stdout.write(`\r  [${elapsed}s] ${stats.total} requests | ${rps} req/s | ${stats.errors} errors`);
  }, 1000);

  // Launch workers
  const workers = [];
  for (let i = 0; i < CONCURRENCY; i++) {
    workers.push(worker(i, endTime));
  }

  await Promise.all(workers);
  clearInterval(progressInterval);

  const elapsed = (Date.now() - stats.startTime) / 1000;

  // Results
  console.log('\n\n' + '='.repeat(60));
  console.log('  RESULTS');
  console.log('='.repeat(60));
  console.log(`  Duration:       ${elapsed.toFixed(1)}s`);
  console.log(`  Total Requests: ${stats.total}`);
  console.log(`  Successful:     ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`);
  console.log(`  Errors:         ${stats.errors}`);
  console.log(`  Throughput:     ${(stats.total / elapsed).toFixed(1)} req/s`);
  console.log();
  console.log('  Latency:');
  console.log(`    Min:    ${Math.min(...stats.latencies)}ms`);
  console.log(`    Avg:    ${(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length).toFixed(0)}ms`);
  console.log(`    P50:    ${percentile(stats.latencies, 50)}ms`);
  console.log(`    P95:    ${percentile(stats.latencies, 95)}ms`);
  console.log(`    P99:    ${percentile(stats.latencies, 99)}ms`);
  console.log(`    Max:    ${Math.max(...stats.latencies)}ms`);
  console.log();
  console.log('  Status Codes:');
  for (const [code, count] of Object.entries(stats.statusCodes).sort()) {
    console.log(`    ${code}: ${count}`);
  }
  console.log('='.repeat(60));

  // Pass/fail assessment
  const avgLatency = stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length;
  const p95 = percentile(stats.latencies, 95);
  const errorRate = stats.errors / stats.total;

  console.log();
  // 401s and 429s are expected (auth required, rate limiting) - only count real errors
  const realErrors = stats.total - stats.success - (stats.statusCodes[401] || 0) - (stats.statusCodes[429] || 0);
  const realErrorRate = realErrors / stats.total;

  console.log(`  Real Errors (excl 401/429): ${realErrors}`);
  console.log();

  if (realErrorRate > 0.05) {
    console.log('  FAIL: Real error rate above 5%');
    process.exit(1);
  } else if (p95 > 5000) {
    console.log('  WARN: P95 latency above 5 seconds');
  } else if (avgLatency > 2000) {
    console.log('  WARN: Average latency above 2 seconds');
  } else {
    console.log('  PASS: All metrics within acceptable ranges');
  }
  console.log();
}

run().catch(console.error);
