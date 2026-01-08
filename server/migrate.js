/**
 * Database Migration Runner
 * Automatically runs pending migrations via Supabase Management API
 *
 * Usage:
 *   node server/migrate.js          # Run pending migrations
 *   node server/migrate.js --status # Show migration status
 *   node server/migrate.js --force  # Re-run all migrations
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PROJECT_REF = 'sorghqcpeamdfbvysafj';
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const MIGRATIONS_DIR = path.join(__dirname, '..', 'database');

async function runSQL(sql) {
  if (!ACCESS_TOKEN) {
    throw new Error('SUPABASE_ACCESS_TOKEN not set in .env');
  }

  const response = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + ACCESS_TOKEN,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: sql })
  });

  const result = await response.json();
  if (response.status >= 400) {
    throw new Error(result.message || result.error || 'SQL execution failed');
  }
  return result;
}

async function ensureMigrationsTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations() {
  try {
    const result = await runSQL('SELECT name FROM schema_migrations ORDER BY name');
    return result.map(r => r.name);
  } catch (err) {
    return [];
  }
}

function getMigrationFiles() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.startsWith('migration-') && f.endsWith('.sql'))
    .sort();
  return files;
}

async function runMigration(filename) {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filepath, 'utf8');

  // Split by semicolons but be careful with strings
  const statements = sql
    .split(/;(?=(?:[^']*'[^']*')*[^']*$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`  Running ${statements.length} statements...`);

  for (const statement of statements) {
    if (statement.length > 0) {
      try {
        await runSQL(statement);
      } catch (err) {
        // Ignore "already exists" errors for idempotent migrations
        if (!err.message.includes('already exists') &&
            !err.message.includes('duplicate key')) {
          throw err;
        }
      }
    }
  }

  // Record migration as applied
  await runSQL(`INSERT INTO schema_migrations (name) VALUES ('${filename}') ON CONFLICT (name) DO NOTHING`);
}

async function showStatus() {
  console.log('\n=== Migration Status ===\n');

  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();

  for (const file of files) {
    const status = applied.includes(file) ? '✓' : '○';
    console.log(`  ${status} ${file}`);
  }

  const pending = files.filter(f => !applied.includes(f));
  console.log(`\n  Applied: ${applied.length}/${files.length}`);
  if (pending.length > 0) {
    console.log(`  Pending: ${pending.length}`);
  }
  console.log('');
}

async function migrate(force = false) {
  console.log('\n=== Database Migration ===\n');

  await ensureMigrationsTable();

  const applied = force ? [] : await getAppliedMigrations();
  const files = getMigrationFiles();
  const pending = files.filter(f => !applied.includes(f));

  if (pending.length === 0) {
    console.log('  No pending migrations.\n');
    return;
  }

  console.log(`  Found ${pending.length} pending migration(s):\n`);

  for (const file of pending) {
    console.log(`  → ${file}`);
    try {
      await runMigration(file);
      console.log(`    ✓ Applied successfully\n`);
    } catch (err) {
      console.error(`    ✗ Failed: ${err.message}\n`);
      throw err;
    }
  }

  console.log('  All migrations applied!\n');
}

// CLI handling
const args = process.argv.slice(2);

if (args.includes('--status')) {
  showStatus().catch(console.error);
} else if (args.includes('--force')) {
  migrate(true).catch(console.error);
} else {
  migrate().catch(console.error);
}

module.exports = { migrate, runSQL };
