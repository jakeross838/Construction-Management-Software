#!/usr/bin/env node
/**
 * Ross Built CMS - Push Script
 * Cross-platform script to commit and push changes
 */

const { execSync } = require('child_process');
const readline = require('readline');
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

function runCapture(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: 'pipe' }).trim();
  } catch (err) {
    return '';
  }
}

function run(cmd) {
  execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('');
  log('========================================', 'cyan');
  log('   Ross Built CMS - Push Changes', 'cyan');
  log('========================================', 'cyan');
  console.log('');

  // Step 1: Check for changes
  log('[1/3] Checking for changes...', 'dim');
  const status = runCapture('git status --porcelain');

  if (!status) {
    log('     No changes to commit', 'dim');
    console.log('');

    // Check if we need to push existing commits
    const ahead = runCapture('git rev-list origin/main..HEAD --count');
    if (ahead && parseInt(ahead) > 0) {
      log(`     ${ahead} local commit(s) to push`, 'yellow');
      console.log('');
      log('[2/3] Pushing to GitHub...', 'dim');
      run('git push origin main');
      console.log('');
      log('Push complete!', 'green');
    } else {
      log('     Nothing to push', 'dim');
    }
    return;
  }

  // Step 2: Show changes
  console.log('');
  log('[2/3] Changes to commit:', 'dim');
  console.log(status);
  console.log('');

  // Get commit message
  const msg = await prompt('Enter commit message (or "skip" to push existing): ');

  if (msg.toLowerCase() !== 'skip' && msg.trim()) {
    // Commit
    console.log('');
    run('git add .');
    try {
      execSync(`git commit -m "${msg.replace(/"/g, '\\"')}"`, {
        encoding: 'utf8',
        stdio: 'inherit'
      });
    } catch (err) {
      log('ERROR: Commit failed', 'red');
      process.exit(1);
    }
  }

  // Step 3: Push
  console.log('');
  log('[3/3] Pushing to GitHub...', 'dim');
  try {
    run('git push origin main');
  } catch (err) {
    log('');
    log('ERROR: Push failed. Run "npm run sync" first to pull changes.', 'red');
    process.exit(1);
  }

  console.log('');
  log('----------------------------------------', 'dim');
  log('Push complete! Safe to switch computers.', 'green');
  log('----------------------------------------', 'dim');
  console.log('');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
