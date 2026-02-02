/**
 * Database Restore Script
 *
 * Restores database from a JSON backup file.
 * Includes safety checks, dry-run mode, and selective table restore.
 *
 * Usage:
 *   node scripts/restore-database.js backups/backup-2026-01-01.json
 *   node scripts/restore-database.js backup.json --dry-run
 *   node scripts/restore-database.js backup.json --tables v2_jobs,v2_invoices
 *   node scripts/restore-database.js backup.json --clear  # Clear tables before restore
 *
 * Environment Required:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for full access
 *
 * Safety:
 *   - Requires explicit confirmation (use --force to skip)
 *   - Dry-run mode shows what would be done
 *   - Selective table restore supported
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Backup directory
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const backupFile = args.find(a => !a.startsWith('--'));

  return {
    backupFile,
    dryRun: args.includes('--dry-run'),
    force: args.includes('--force'),
    clear: args.includes('--clear'),
    tables: args.includes('--tables')
      ? args[args.indexOf('--tables') + 1]?.split(',') || null
      : null,
    help: args.includes('--help') || args.includes('-h')
  };
}

/**
 * Prompt for user confirmation
 */
async function confirm(message) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    rl.question(`${message} (yes/no): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Load and validate backup file
 */
function loadBackup(filePath) {
  // Handle relative paths from backup directory
  if (!path.isAbsolute(filePath) && !fs.existsSync(filePath)) {
    filePath = path.join(BACKUP_DIR, filePath);
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Backup file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const backup = JSON.parse(content);

  // Validate backup structure
  if (!backup.version || !backup.timestamp || !backup.tables) {
    throw new Error('Invalid backup format: missing required fields');
  }

  return { backup, filePath };
}

/**
 * Clear a table before restore
 */
async function clearTable(tableName) {
  try {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) throw error;
    return true;
  } catch (err) {
    // Ignore errors for tables that don't exist
    if (err.code === '42P01') return false;
    throw err;
  }
}

/**
 * Restore data to a table
 */
async function restoreTable(tableName, records, options = {}) {
  const { dryRun, clear } = options;
  const results = {
    inserted: 0,
    updated: 0,
    errors: 0,
    skipped: 0
  };

  if (records.length === 0) {
    return results;
  }

  if (dryRun) {
    console.log(`    Would restore ${records.length} records`);
    results.inserted = records.length;
    return results;
  }

  // Clear table if requested
  if (clear) {
    await clearTable(tableName);
    console.log(`    Cleared existing data`);
  }

  // Insert records in batches of 100
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);

    try {
      const { data, error } = await supabase
        .from(tableName)
        .upsert(batch, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (error) {
        console.warn(`    Batch ${i / batchSize + 1} error: ${error.message}`);
        results.errors += batch.length;
      } else {
        results.inserted += batch.length;
      }
    } catch (err) {
      console.warn(`    Batch ${i / batchSize + 1} failed: ${err.message}`);
      results.errors += batch.length;
    }
  }

  return results;
}

/**
 * Get current database stats for comparison
 */
async function getCurrentStats(tables) {
  const stats = {};

  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (!error) {
        stats[table] = count || 0;
      }
    } catch {
      // Table doesn't exist
    }
  }

  return stats;
}

/**
 * Main restore function
 */
async function runRestore() {
  const args = parseArgs();

  if (args.help || !args.backupFile) {
    console.log(`
Database Restore Script

Usage:
  node scripts/restore-database.js <backup-file> [options]

Arguments:
  backup-file       Path to backup JSON file (required)

Options:
  --dry-run         Show what would be done without making changes
  --force           Skip confirmation prompts
  --clear           Clear tables before restoring (fresh restore)
  --tables t1,t2    Only restore specific tables (comma-separated)
  --help, -h        Show this help message

Examples:
  node scripts/restore-database.js backups/backup-2026-01-01.json
  node scripts/restore-database.js backup.json --dry-run
  node scripts/restore-database.js backup.json --tables v2_jobs,v2_invoices
  node scripts/restore-database.js backup.json --clear --force

Safety Notes:
  - By default, this uses UPSERT (insert or update)
  - Use --clear to delete existing data first
  - Always test with --dry-run before actual restore
  - Consider creating a backup before restoring
`);
    return;
  }

  console.log('='.repeat(60));
  console.log('DATABASE RESTORE');
  console.log('='.repeat(60));

  // Load backup file
  let backup, filePath;
  try {
    ({ backup, filePath } = loadBackup(args.backupFile));
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  console.log(`File: ${filePath}`);
  console.log(`Backup Date: ${backup.timestamp}`);
  console.log(`Backup Type: ${backup.type || 'full'}`);
  console.log(`Tables in backup: ${Object.keys(backup.tables).length}`);
  console.log(`Mode: ${args.dryRun ? 'DRY RUN' : 'LIVE RESTORE'}`);
  console.log(`Clear before restore: ${args.clear ? 'Yes' : 'No'}`);
  console.log('');

  // Determine which tables to restore
  const tablesToRestore = args.tables
    ? args.tables.filter(t => backup.tables[t])
    : Object.keys(backup.tables);

  if (args.tables) {
    const notFound = args.tables.filter(t => !backup.tables[t]);
    if (notFound.length > 0) {
      console.warn(`Warning: Tables not in backup: ${notFound.join(', ')}`);
    }
  }

  console.log(`Tables to restore: ${tablesToRestore.length}`);
  console.log('');

  // Calculate total records
  let totalRecords = 0;
  for (const table of tablesToRestore) {
    totalRecords += backup.tables[table]?.count || 0;
  }

  console.log(`Total records to restore: ${totalRecords.toLocaleString()}`);
  console.log('');

  // Get current database stats
  console.log('Current database state:');
  const currentStats = await getCurrentStats(tablesToRestore);
  for (const table of tablesToRestore.slice(0, 5)) {
    const backupCount = backup.tables[table]?.count || 0;
    const currentCount = currentStats[table] || 0;
    console.log(`  ${table}: ${currentCount} records (backup has ${backupCount})`);
  }
  if (tablesToRestore.length > 5) {
    console.log(`  ... and ${tablesToRestore.length - 5} more tables`);
  }
  console.log('');

  // Safety confirmation
  if (!args.dryRun && !args.force) {
    console.log('='.repeat(60));
    console.log('WARNING: This will modify your database!');
    if (args.clear) {
      console.log('WARNING: --clear flag will DELETE existing data!');
    }
    console.log('='.repeat(60));
    console.log('');

    const confirmed = await confirm('Do you want to proceed?');
    if (!confirmed) {
      console.log('Restore cancelled.');
      process.exit(0);
    }
    console.log('');
  }

  // Perform restore
  console.log('Restoring tables...');
  console.log('');

  const results = {
    tablesRestored: 0,
    totalInserted: 0,
    totalUpdated: 0,
    totalErrors: 0,
    tableResults: {}
  };

  for (const table of tablesToRestore) {
    const tableData = backup.tables[table];
    const records = tableData?.data || [];

    console.log(`  ${table} (${records.length} records)...`);

    try {
      const tableResult = await restoreTable(table, records, {
        dryRun: args.dryRun,
        clear: args.clear
      });

      results.tableResults[table] = tableResult;
      results.tablesRestored++;
      results.totalInserted += tableResult.inserted;
      results.totalUpdated += tableResult.updated;
      results.totalErrors += tableResult.errors;

      if (!args.dryRun) {
        if (tableResult.errors > 0) {
          console.log(`    Done: ${tableResult.inserted} inserted, ${tableResult.errors} errors`);
        } else {
          console.log(`    Done: ${tableResult.inserted} inserted`);
        }
      }
    } catch (err) {
      console.error(`    Failed: ${err.message}`);
      results.tableResults[table] = { error: err.message };
    }
  }

  // Summary
  console.log('');
  console.log('='.repeat(60));
  console.log(args.dryRun ? 'DRY RUN COMPLETE' : 'RESTORE COMPLETE');
  console.log('='.repeat(60));
  console.log(`Tables processed: ${results.tablesRestored}`);
  console.log(`Records ${args.dryRun ? 'would be ' : ''}inserted/updated: ${results.totalInserted}`);

  if (results.totalErrors > 0) {
    console.log(`Errors: ${results.totalErrors}`);
  }

  if (args.dryRun) {
    console.log('');
    console.log('This was a dry run. No changes were made.');
    console.log('Remove --dry-run to perform the actual restore.');
  }

  return results;
}

// Export for API use
module.exports = { runRestore, loadBackup, BACKUP_DIR };

// Run if called directly
if (require.main === module) {
  runRestore()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Restore failed:', err);
      process.exit(1);
    });
}
