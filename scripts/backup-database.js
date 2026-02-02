/**
 * Database Backup Script
 *
 * Creates JSON exports of all v2_ tables for backup purposes.
 * Supports full backup, incremental backup, and automatic retention.
 *
 * Usage:
 *   node scripts/backup-database.js                    # Full backup to local file
 *   node scripts/backup-database.js --incremental     # Only changed data since last backup
 *   node scripts/backup-database.js --upload          # Upload to Supabase Storage
 *   node scripts/backup-database.js --retain 7        # Keep only last 7 backups
 *
 * Environment Required:
 *   SUPABASE_URL - Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key for full access
 *
 * Output:
 *   backups/backup-{timestamp}.json
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Backup directory
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Tables to backup (in dependency order for proper restore)
const TABLES = [
  // Core reference tables (no dependencies)
  'v2_cost_codes',
  'v2_vendors',
  'v2_jobs',

  // Tables with single foreign key dependencies
  'v2_budget_lines',
  'v2_purchase_orders',
  'v2_draws',
  'v2_contacts',
  'v2_leads',
  'v2_schedules',
  'v2_schedule_templates',

  // Tables with multiple dependencies
  'v2_po_line_items',
  'v2_po_activity',
  'v2_po_attachments',
  'v2_change_orders',
  'v2_invoices',
  'v2_draw_invoices',

  // Tables depending on invoices
  'v2_invoice_allocations',
  'v2_invoice_activity',
  'v2_invoice_hashes',

  // Other feature tables
  'v2_daily_logs',
  'v2_daily_log_entries',
  'v2_inspections',
  'v2_punch_list_items',
  'v2_rfis',
  'v2_submittals',
  'v2_tasks',
  'v2_selections',
  'v2_warranties',
  'v2_permits',
  'v2_photos',
  'v2_documents',

  // System tables
  'v2_entity_locks',
  'v2_undo_queue',
  'v2_approval_thresholds',
  'v2_ai_code_mappings',
  'v2_price_history',

  // Bid system
  'v2_bids',
  'v2_subcontractor_bids',

  // Estimates and proposals
  'v2_estimates',
  'v2_estimate_line_items',
  'v2_proposals'
];

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  return {
    incremental: args.includes('--incremental'),
    upload: args.includes('--upload'),
    retain: args.includes('--retain')
      ? parseInt(args[args.indexOf('--retain') + 1]) || 7
      : null,
    tables: args.includes('--tables')
      ? args[args.indexOf('--tables') + 1]?.split(',') || TABLES
      : TABLES,
    help: args.includes('--help') || args.includes('-h')
  };
}

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`Created backup directory: ${BACKUP_DIR}`);
  }
}

/**
 * Get the last backup timestamp for incremental backups
 */
function getLastBackupTimestamp() {
  try {
    const metaPath = path.join(BACKUP_DIR, 'backup-meta.json');
    if (fs.existsSync(metaPath)) {
      const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
      return meta.lastBackup;
    }
  } catch (err) {
    console.warn('Could not read backup metadata:', err.message);
  }
  return null;
}

/**
 * Save backup metadata
 */
function saveBackupMeta(timestamp, stats) {
  const metaPath = path.join(BACKUP_DIR, 'backup-meta.json');
  const meta = {
    lastBackup: timestamp,
    lastBackupStats: stats
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
}

/**
 * Fetch all records from a table
 */
async function fetchTable(tableName, sinceTimestamp = null) {
  try {
    let query = supabase.from(tableName).select('*');

    // For incremental backup, only get records updated since last backup
    if (sinceTimestamp) {
      // Try common timestamp columns
      const timestampCols = ['updated_at', 'created_at', 'modified_at'];
      for (const col of timestampCols) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .gte(col, sinceTimestamp);

          if (!error && data) {
            return { data, count: data.length, incremental: true };
          }
        } catch {
          // Column doesn't exist, try next
        }
      }
    }

    // Full table fetch (no pagination limit for backup)
    const { data, error, count } = await query;

    if (error) {
      // Table might not exist
      if (error.code === '42P01') {
        return { data: [], count: 0, skipped: true };
      }
      throw error;
    }

    return { data: data || [], count: data?.length || 0 };
  } catch (err) {
    console.warn(`  Warning: Could not backup ${tableName}: ${err.message}`);
    return { data: [], count: 0, error: err.message };
  }
}

/**
 * Upload backup to Supabase Storage
 */
async function uploadBackup(backupPath, fileName) {
  const bucket = 'backups';

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.find(b => b.name === bucket)) {
    await supabase.storage.createBucket(bucket, {
      public: false,
      fileSizeLimit: 104857600 // 100MB
    });
    console.log(`Created storage bucket: ${bucket}`);
  }

  const fileBuffer = fs.readFileSync(backupPath);
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBuffer, {
      contentType: 'application/json',
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload backup: ${error.message}`);
  }

  console.log(`Uploaded to Supabase Storage: ${bucket}/${fileName}`);
  return data;
}

/**
 * Apply retention policy - delete old backups
 */
function applyRetention(keepCount) {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .sort()
    .reverse(); // Newest first

  if (files.length <= keepCount) {
    console.log(`Retention: ${files.length} backups exist, keeping all (limit: ${keepCount})`);
    return;
  }

  const toDelete = files.slice(keepCount);
  for (const file of toDelete) {
    const filePath = path.join(BACKUP_DIR, file);
    fs.unlinkSync(filePath);
    console.log(`Retention: Deleted old backup ${file}`);
  }

  console.log(`Retention: Deleted ${toDelete.length} old backups, kept ${keepCount}`);
}

/**
 * Main backup function
 */
async function runBackup() {
  const args = parseArgs();

  if (args.help) {
    console.log(`
Database Backup Script

Usage:
  node scripts/backup-database.js [options]

Options:
  --incremental     Only backup data changed since last backup
  --upload          Upload backup to Supabase Storage
  --retain N        Keep only the last N backups (delete older ones)
  --tables t1,t2    Only backup specific tables (comma-separated)
  --help, -h        Show this help message

Examples:
  node scripts/backup-database.js
  node scripts/backup-database.js --upload --retain 7
  node scripts/backup-database.js --incremental
  node scripts/backup-database.js --tables v2_jobs,v2_invoices
`);
    return;
  }

  console.log('='.repeat(60));
  console.log('DATABASE BACKUP');
  console.log('='.repeat(60));
  console.log(`Mode: ${args.incremental ? 'Incremental' : 'Full'}`);
  console.log(`Upload: ${args.upload ? 'Yes' : 'No'}`);
  console.log(`Retention: ${args.retain ? `Keep last ${args.retain}` : 'No limit'}`);
  console.log('');

  ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFileName = `backup-${timestamp}.json`;
  const backupPath = path.join(BACKUP_DIR, backupFileName);

  const lastBackup = args.incremental ? getLastBackupTimestamp() : null;
  if (args.incremental && lastBackup) {
    console.log(`Incremental since: ${lastBackup}`);
  }

  console.log(`\nBacking up ${args.tables.length} tables...`);

  const backup = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    type: args.incremental ? 'incremental' : 'full',
    supabaseUrl: process.env.SUPABASE_URL,
    tables: {}
  };

  const stats = {
    totalRecords: 0,
    tablesBackedUp: 0,
    tablesSkipped: 0,
    errors: []
  };

  for (const table of args.tables) {
    process.stdout.write(`  ${table}... `);

    const result = await fetchTable(table, lastBackup);

    if (result.skipped) {
      console.log('skipped (not found)');
      stats.tablesSkipped++;
      continue;
    }

    if (result.error) {
      console.log(`error: ${result.error}`);
      stats.errors.push({ table, error: result.error });
      continue;
    }

    backup.tables[table] = {
      count: result.count,
      data: result.data
    };

    stats.totalRecords += result.count;
    stats.tablesBackedUp++;

    console.log(`${result.count} records${result.incremental ? ' (incremental)' : ''}`);
  }

  // Write backup file
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));

  const fileSizeBytes = fs.statSync(backupPath).size;
  const fileSizeMB = (fileSizeBytes / 1024 / 1024).toFixed(2);

  console.log('\n' + '='.repeat(60));
  console.log('BACKUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`File: ${backupPath}`);
  console.log(`Size: ${fileSizeMB} MB`);
  console.log(`Tables: ${stats.tablesBackedUp} backed up, ${stats.tablesSkipped} skipped`);
  console.log(`Records: ${stats.totalRecords.toLocaleString()}`);

  if (stats.errors.length > 0) {
    console.log(`Errors: ${stats.errors.length}`);
    stats.errors.forEach(e => console.log(`  - ${e.table}: ${e.error}`));
  }

  // Save metadata for incremental backups
  saveBackupMeta(backup.timestamp, stats);

  // Upload to storage if requested
  if (args.upload) {
    console.log('\nUploading to Supabase Storage...');
    try {
      await uploadBackup(backupPath, backupFileName);
    } catch (err) {
      console.error('Upload failed:', err.message);
    }
  }

  // Apply retention if requested
  if (args.retain) {
    console.log('\nApplying retention policy...');
    applyRetention(args.retain);
  }

  return {
    path: backupPath,
    fileName: backupFileName,
    stats
  };
}

// Export for API use
module.exports = { runBackup, BACKUP_DIR, TABLES };

// Run if called directly
if (require.main === module) {
  runBackup()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Backup failed:', err);
      process.exit(1);
    });
}
