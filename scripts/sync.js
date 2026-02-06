#!/usr/bin/env node
/**
 * Ross Built CMS - Sync Script
 * Cross-platform script to sync with GitHub when switching computers
 */

const { execSync, spawnSync } = require('child_process');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function run(cmd, options = {}) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: options.silent ? 'pipe' : 'inherit', ...options });
  } catch (err) {
    if (options.ignoreError) return err.stdout || '';
    throw err;
  }
}

function runCapture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (err) {
    return '';
  }
}

console.log('');
log('========================================', 'cyan');
log('   Ross Built CMS - Sync', 'cyan');
log('========================================', 'cyan');
console.log('');

// Step 1: Check for uncommitted changes
log('[1/5] Checking for local changes...', 'dim');
const status = runCapture('git status --porcelain');
if (status) {
  log('');
  log('WARNING: You have uncommitted local changes!', 'yellow');
  console.log('');
  console.log(status);
  console.log('');
  log('Consider committing or stashing before syncing.', 'yellow');
  log('Continuing anyway...', 'dim');
}

// Step 2: Fetch from GitHub
console.log('');
log('[2/5] Fetching from GitHub...', 'dim');
run('git fetch origin', { silent: true });

const behind = runCapture('git rev-list HEAD..origin/main --count');
if (behind && parseInt(behind) > 0) {
  log(`     ${behind} new commit(s) available`, 'green');
} else {
  log('     Already up to date', 'dim');
}

// Step 3: Get current package.json hash before pull
const pkgHashBefore = runCapture('git rev-parse HEAD:package.json 2>/dev/null || echo none');
const clientPkgHashBefore = runCapture('git rev-parse HEAD:client/package.json 2>/dev/null || echo none');

// Step 4: Pull changes
console.log('');
log('[3/5] Pulling latest changes...', 'dim');
try {
  run('git pull origin main');
} catch (err) {
  log('');
  log('ERROR: Git pull failed. Resolve conflicts manually.', 'red');
  process.exit(1);
}

// Step 5: Check if package.json changed
console.log('');
log('[4/5] Checking dependencies...', 'dim');
const pkgHashAfter = runCapture('git rev-parse HEAD:package.json 2>/dev/null || echo none');
const clientPkgHashAfter = runCapture('git rev-parse HEAD:client/package.json 2>/dev/null || echo none');

const rootPkgChanged = pkgHashBefore !== pkgHashAfter;
const clientPkgChanged = clientPkgHashBefore !== clientPkgHashAfter;

if (rootPkgChanged || clientPkgChanged) {
  log('     Dependencies changed - running npm install...', 'yellow');
  console.log('');

  if (rootPkgChanged) {
    log('     Installing root dependencies...', 'dim');
    run('npm install');
  }

  if (clientPkgChanged) {
    log('     Installing client dependencies...', 'dim');
    run('npm install', { cwd: path.join(projectRoot, 'client') });
  }
} else {
  log('     No dependency changes', 'dim');
}

// Done
console.log('');
log('[5/5] Sync complete!', 'green');
console.log('');
log('----------------------------------------', 'dim');
log('Ready to work. Start server with:', 'dim');
log('  npm start', 'cyan');
log('----------------------------------------', 'dim');
console.log('');
