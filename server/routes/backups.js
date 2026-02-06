/**
 * Backup Routes
 * API endpoints for database backup management
 *
 * GET  /api/backups         - List available backups
 * POST /api/backups         - Trigger manual backup
 * GET  /api/backups/:id     - Get backup details
 * GET  /api/backups/:id/download - Download backup file
 * DELETE /api/backups/:id   - Delete backup
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { asyncHandler, AppError } = require('../core/errors');
const { requireAdmin } = require('../middleware/auth');

// Protect all backup routes - admin only
router.use(requireAdmin);

// Import backup utilities
const BACKUP_DIR = path.join(__dirname, '..', '..', 'backups');

/**
 * Ensure backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Get list of backup files with metadata
 */
function listBackupFiles() {
  ensureBackupDir();

  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup-') && f.endsWith('.json'))
    .map(fileName => {
      const filePath = path.join(BACKUP_DIR, fileName);
      const stats = fs.statSync(filePath);

      // Extract timestamp from filename
      const match = fileName.match(/backup-(.+)\.json/);
      const timestamp = match ? match[1].replace(/-/g, ':').replace(/T/g, 'T') : null;

      // Try to read backup metadata
      let backupMeta = null;
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const backup = JSON.parse(content);
        backupMeta = {
          type: backup.type || 'full',
          tableCount: Object.keys(backup.tables || {}).length,
          timestamp: backup.timestamp
        };
      } catch {
        // Ignore parsing errors
      }

      return {
        id: fileName.replace('.json', ''),
        fileName,
        timestamp: backupMeta?.timestamp || timestamp,
        type: backupMeta?.type || 'unknown',
        tableCount: backupMeta?.tableCount || 0,
        size: stats.size,
        sizeFormatted: formatFileSize(stats.size),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime
      };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Newest first

  return files;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * GET /api/backups
 * List all available backups
 */
router.get('/', asyncHandler(async (req, res) => {
  const backups = listBackupFiles();

  // Get last backup metadata
  let lastBackupMeta = null;
  try {
    const metaPath = path.join(BACKUP_DIR, 'backup-meta.json');
    if (fs.existsSync(metaPath)) {
      lastBackupMeta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    }
  } catch {
    // Ignore errors
  }

  res.json({
    backups,
    count: backups.length,
    totalSize: backups.reduce((sum, b) => sum + b.size, 0),
    totalSizeFormatted: formatFileSize(backups.reduce((sum, b) => sum + b.size, 0)),
    lastBackup: lastBackupMeta?.lastBackup,
    backupDir: BACKUP_DIR
  });
}));

/**
 * POST /api/backups
 * Trigger a new backup
 */
router.post('/', asyncHandler(async (req, res) => {
  const { type = 'full', tables, upload = false, retain } = req.body;

  // Import and run backup
  const { runBackup } = require('../../scripts/backup-database');

  // Override process.argv for the backup script
  const originalArgv = process.argv;
  process.argv = ['node', 'backup-database.js'];

  if (type === 'incremental') {
    process.argv.push('--incremental');
  }

  if (upload) {
    process.argv.push('--upload');
  }

  if (retain) {
    process.argv.push('--retain', String(retain));
  }

  if (tables && tables.length > 0) {
    process.argv.push('--tables', tables.join(','));
  }

  try {
    const result = await runBackup();

    // Restore original argv
    process.argv = originalArgv;

    res.json({
      success: true,
      message: 'Backup completed successfully',
      backup: {
        fileName: result.fileName,
        path: result.path,
        stats: result.stats
      }
    });
  } catch (err) {
    process.argv = originalArgv;
    throw new AppError(500, 'Backup failed', { error: err.message });
  }
}));

/**
 * GET /api/backups/:id
 * Get details of a specific backup
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fileName = id.endsWith('.json') ? id : `${id}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'Backup not found', { id });
  }

  const stats = fs.statSync(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  const backup = JSON.parse(content);

  // Get table summaries without full data
  const tableSummaries = {};
  for (const [table, data] of Object.entries(backup.tables || {})) {
    tableSummaries[table] = {
      count: data.count || 0,
      hasData: (data.data?.length || 0) > 0
    };
  }

  res.json({
    id: id,
    fileName,
    version: backup.version,
    timestamp: backup.timestamp,
    type: backup.type || 'full',
    supabaseUrl: backup.supabaseUrl,
    tables: tableSummaries,
    tableCount: Object.keys(tableSummaries).length,
    totalRecords: Object.values(tableSummaries).reduce((sum, t) => sum + t.count, 0),
    size: stats.size,
    sizeFormatted: formatFileSize(stats.size),
    createdAt: stats.birthtime,
    modifiedAt: stats.mtime
  });
}));

/**
 * GET /api/backups/:id/download
 * Download a backup file
 */
router.get('/:id/download', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fileName = id.endsWith('.json') ? id : `${id}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'Backup not found', { id });
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}));

/**
 * DELETE /api/backups/:id
 * Delete a backup file
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const fileName = id.endsWith('.json') ? id : `${id}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'Backup not found', { id });
  }

  // Get file info before deletion
  const stats = fs.statSync(filePath);

  fs.unlinkSync(filePath);

  res.json({
    success: true,
    message: 'Backup deleted',
    deleted: {
      id,
      fileName,
      size: stats.size
    }
  });
}));

/**
 * POST /api/backups/:id/restore
 * Restore from a backup (dry-run by default)
 */
router.post('/:id/restore', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { dryRun = true, tables, clear = false, force = false } = req.body;

  const fileName = id.endsWith('.json') ? id : `${id}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    throw new AppError(404, 'Backup not found', { id });
  }

  // Safety check - require explicit confirmation for live restore
  if (!dryRun && !force) {
    throw new AppError(400, 'Live restore requires force=true confirmation', {
      hint: 'Set force=true in the request body to confirm you want to modify the database'
    });
  }

  // Import restore utilities
  const { loadBackup } = require('../../scripts/restore-database');
  const { supabase } = require('../../config');

  const { backup } = loadBackup(filePath);

  // Determine tables to restore
  const tablesToRestore = tables
    ? tables.filter(t => backup.tables[t])
    : Object.keys(backup.tables);

  const results = {
    dryRun,
    tablesProcessed: 0,
    recordsProcessed: 0,
    errors: [],
    tableResults: {}
  };

  for (const table of tablesToRestore) {
    const records = backup.tables[table]?.data || [];
    const count = records.length;

    if (dryRun) {
      results.tableResults[table] = {
        wouldRestore: count,
        status: 'dry-run'
      };
      results.recordsProcessed += count;
    } else {
      try {
        // Clear table if requested
        if (clear) {
          await supabase
            .from(table)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000');
        }

        // Insert in batches
        const batchSize = 100;
        let inserted = 0;
        let errors = 0;

        for (let i = 0; i < records.length; i += batchSize) {
          const batch = records.slice(i, i + batchSize);
          const { error } = await supabase
            .from(table)
            .upsert(batch, { onConflict: 'id' });

          if (error) {
            errors += batch.length;
            results.errors.push({ table, error: error.message });
          } else {
            inserted += batch.length;
          }
        }

        results.tableResults[table] = {
          restored: inserted,
          errors,
          cleared: clear
        };
        results.recordsProcessed += inserted;
      } catch (err) {
        results.errors.push({ table, error: err.message });
        results.tableResults[table] = { error: err.message };
      }
    }

    results.tablesProcessed++;
  }

  res.json({
    success: results.errors.length === 0,
    message: dryRun
      ? 'Dry run complete - no changes made'
      : `Restore complete - ${results.recordsProcessed} records processed`,
    ...results
  });
}));

module.exports = router;
