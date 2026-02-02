/**
 * Document Intelligence Routes
 *
 * Phase 6 Document Management API endpoints:
 * - Text extraction from PDFs
 * - Full-text document search
 * - Expiration tracking and alerts
 */

const express = require('express');
const router = express.Router();
const { asyncHandler, AppError } = require('../core/errors');
const {
  extractTextFromPDF,
  processDocumentIntelligence,
  searchDocuments,
  getExpiringDocuments,
  getActiveAlerts,
  acknowledgeAlert,
  dismissAlert,
  generateDailyAlerts,
  scheduleExpirationAlerts
} = require('../services/document-intelligence');
const { supabase } = require('../../config');

// ============================================================
// TEXT EXTRACTION
// ============================================================

/**
 * POST /api/document-intelligence/:id/extract
 * Trigger text extraction and processing for a document
 */
router.post('/:id/extract', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { force } = req.body;

  // Check if document exists
  const { data: doc, error: docError } = await supabase
    .from('v2_documents')
    .select('id, status, file_url, mime_type')
    .eq('id', id)
    .single();

  if (docError || !doc) {
    throw new AppError('NOT_FOUND', 'Document not found');
  }

  // Check if already processed (unless force is true)
  if (!force) {
    const { data: existing } = await supabase
      .from('v2_document_metadata')
      .select('id, extracted_at')
      .eq('document_id', id)
      .single();

    if (existing && existing.extracted_at) {
      return res.json({
        success: true,
        message: 'Document already processed',
        extractedAt: existing.extracted_at,
        hint: 'Use force=true to re-extract'
      });
    }
  }

  // Process the document
  const result = await processDocumentIntelligence(id);

  res.json({
    success: true,
    result
  });
}));

/**
 * GET /api/document-intelligence/:id/metadata
 * Get extracted metadata for a document
 */
router.get('/:id/metadata', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_document_metadata')
    .select('*')
    .eq('document_id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  if (!data) {
    return res.json({ metadata: null, message: 'No metadata found. Run extraction first.' });
  }

  res.json({ metadata: data });
}));

/**
 * PATCH /api/document-intelligence/:id/metadata
 * Update document metadata (expiration date, type, etc.)
 */
router.patch('/:id/metadata', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    expiration_date,
    expiration_type,
    expiration_notes,
    alert_days_before,
    ai_suggested_tags
  } = req.body;

  const updateData = {
    updated_at: new Date().toISOString()
  };

  if (expiration_date !== undefined) updateData.expiration_date = expiration_date;
  if (expiration_type !== undefined) updateData.expiration_type = expiration_type;
  if (expiration_notes !== undefined) updateData.expiration_notes = expiration_notes;
  if (alert_days_before !== undefined) updateData.alert_days_before = alert_days_before;
  if (ai_suggested_tags !== undefined) updateData.ai_suggested_tags = ai_suggested_tags;

  const { data, error } = await supabase
    .from('v2_document_metadata')
    .update(updateData)
    .eq('document_id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Reschedule alerts if expiration date changed
  if (expiration_date) {
    // Clear existing alerts first
    await supabase
      .from('v2_document_alerts')
      .delete()
      .eq('document_id', id)
      .in('alert_type', ['expiring_soon', 'expired']);

    // Schedule new alerts
    await scheduleExpirationAlerts(id, expiration_date, alert_days_before);
  }

  res.json({ success: true, metadata: data });
}));

// ============================================================
// FULL-TEXT SEARCH
// ============================================================

/**
 * GET /api/document-intelligence/search
 * Full-text search across document content
 */
router.get('/search', asyncHandler(async (req, res) => {
  const { q, job_id, category, expiration_type, limit = 50 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json({ results: [], message: 'Query must be at least 2 characters' });
  }

  const results = await searchDocuments(q, {
    jobId: job_id,
    category,
    expirationType: expiration_type,
    limit: parseInt(limit)
  });

  res.json({
    success: true,
    query: q,
    count: results.length,
    results
  });
}));

// ============================================================
// EXPIRATION TRACKING
// ============================================================

/**
 * GET /api/document-intelligence/expiring
 * Get documents expiring within specified days
 */
router.get('/expiring', asyncHandler(async (req, res) => {
  const { days = 30, job_id, expiration_type } = req.query;

  const documents = await getExpiringDocuments(parseInt(days), {
    jobId: job_id,
    expirationType: expiration_type
  });

  // Group by status
  const expired = documents.filter(d => d.alert_status === 'expired');
  const expiringSoon = documents.filter(d => d.alert_status === 'expiring_soon');

  res.json({
    success: true,
    days: parseInt(days),
    summary: {
      total: documents.length,
      expired: expired.length,
      expiringSoon: expiringSoon.length
    },
    expired,
    expiringSoon,
    all: documents
  });
}));

/**
 * GET /api/document-intelligence/expiring/summary
 * Get a summary of expiring documents grouped by type
 */
router.get('/expiring/summary', asyncHandler(async (req, res) => {
  const { days = 90 } = req.query;

  const documents = await getExpiringDocuments(parseInt(days));

  // Group by type
  const byType = {};
  const byStatus = { expired: 0, expiring_soon: 0 };

  for (const doc of documents) {
    const type = doc.expiration_type || 'other';
    if (!byType[type]) {
      byType[type] = { expired: 0, expiringSoon: 0, total: 0 };
    }
    byType[type].total++;

    if (doc.alert_status === 'expired') {
      byType[type].expired++;
      byStatus.expired++;
    } else {
      byType[type].expiringSoon++;
      byStatus.expiring_soon++;
    }
  }

  res.json({
    success: true,
    days: parseInt(days),
    total: documents.length,
    byStatus,
    byType
  });
}));

// ============================================================
// ALERTS
// ============================================================

/**
 * GET /api/document-intelligence/alerts
 * Get active (unacknowledged, undismissed) alerts
 */
router.get('/alerts', asyncHandler(async (req, res) => {
  const { document_id, alert_type, limit = 100 } = req.query;

  const alerts = await getActiveAlerts({
    documentId: document_id,
    alertType: alert_type,
    limit: parseInt(limit)
  });

  // Group by severity for dashboard display
  const bySeverity = {
    critical: alerts.filter(a => a.severity === 'critical'),
    high: alerts.filter(a => a.severity === 'high'),
    medium: alerts.filter(a => a.severity === 'medium'),
    low: alerts.filter(a => a.severity === 'low')
  };

  res.json({
    success: true,
    count: alerts.length,
    bySeverity: {
      critical: bySeverity.critical.length,
      high: bySeverity.high.length,
      medium: bySeverity.medium.length,
      low: bySeverity.low.length
    },
    alerts
  });
}));

/**
 * GET /api/document-intelligence/alerts/count
 * Get count of active alerts (for badges/notifications)
 */
router.get('/alerts/count', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_document_alerts')
    .select('severity', { count: 'exact' })
    .eq('acknowledged', false)
    .eq('dismissed', false);

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Count by severity
  const counts = { critical: 0, high: 0, medium: 0, low: 0, total: data.length };
  for (const alert of data) {
    if (counts[alert.severity] !== undefined) {
      counts[alert.severity]++;
    }
  }

  res.json({
    success: true,
    ...counts
  });
}));

/**
 * PATCH /api/document-intelligence/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.patch('/alerts/:id/acknowledge', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { acknowledged_by = 'User' } = req.body;

  const alert = await acknowledgeAlert(id, acknowledged_by);

  res.json({
    success: true,
    alert
  });
}));

/**
 * PATCH /api/document-intelligence/alerts/:id/dismiss
 * Dismiss an alert (hide without acknowledging)
 */
router.patch('/alerts/:id/dismiss', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const alert = await dismissAlert(id);

  res.json({
    success: true,
    alert
  });
}));

/**
 * POST /api/document-intelligence/alerts/acknowledge-bulk
 * Acknowledge multiple alerts at once
 */
router.post('/alerts/acknowledge-bulk', asyncHandler(async (req, res) => {
  const { alert_ids, acknowledged_by = 'User' } = req.body;

  if (!alert_ids || !Array.isArray(alert_ids) || alert_ids.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'alert_ids array is required');
  }

  const { data, error } = await supabase
    .from('v2_document_alerts')
    .update({
      acknowledged: true,
      acknowledged_by,
      acknowledged_at: new Date().toISOString()
    })
    .in('id', alert_ids)
    .select();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({
    success: true,
    acknowledged: data.length
  });
}));

// ============================================================
// ADMIN / MAINTENANCE
// ============================================================

/**
 * POST /api/document-intelligence/generate-alerts
 * Manually trigger alert generation (normally runs daily)
 */
router.post('/generate-alerts', asyncHandler(async (req, res) => {
  const result = await generateDailyAlerts();

  res.json({
    success: true,
    ...result
  });
}));

/**
 * POST /api/document-intelligence/process-batch
 * Process multiple documents for intelligence extraction
 */
router.post('/process-batch', asyncHandler(async (req, res) => {
  const { document_ids, job_id } = req.body;

  let documentsToProcess = [];

  if (document_ids && Array.isArray(document_ids)) {
    documentsToProcess = document_ids;
  } else if (job_id) {
    // Get all unprocessed documents for a job
    const { data } = await supabase
      .from('v2_documents')
      .select('id')
      .eq('job_id', job_id)
      .eq('mime_type', 'application/pdf')
      .is('deleted_at', null)
      .not('status', 'eq', 'processed')
      .limit(50);

    documentsToProcess = (data || []).map(d => d.id);
  }

  if (documentsToProcess.length === 0) {
    return res.json({ success: true, processed: 0, message: 'No documents to process' });
  }

  const results = {
    processed: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };

  for (const docId of documentsToProcess) {
    try {
      const result = await processDocumentIntelligence(docId);
      if (result.skipped) {
        results.skipped++;
      } else {
        results.processed++;
      }
    } catch (err) {
      results.failed++;
      results.errors.push({ documentId: docId, error: err.message });
    }
  }

  res.json({
    success: true,
    total: documentsToProcess.length,
    ...results
  });
}));

/**
 * GET /api/document-intelligence/stats
 * Get document intelligence statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  // Get counts
  const [
    { count: totalDocuments },
    { count: processedDocuments },
    { count: withExpiration },
    { count: activeAlerts }
  ] = await Promise.all([
    supabase.from('v2_documents').select('*', { count: 'exact', head: true }).is('deleted_at', null),
    supabase.from('v2_document_metadata').select('*', { count: 'exact', head: true }),
    supabase.from('v2_document_metadata').select('*', { count: 'exact', head: true }).not('expiration_date', 'is', null),
    supabase.from('v2_document_alerts').select('*', { count: 'exact', head: true }).eq('acknowledged', false).eq('dismissed', false)
  ]);

  // Get category breakdown
  const { data: categoryData } = await supabase
    .from('v2_document_metadata')
    .select('ai_category');

  const byCategory = {};
  for (const row of categoryData || []) {
    const cat = row.ai_category || 'other';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  // Get expiration type breakdown
  const { data: expTypeData } = await supabase
    .from('v2_document_metadata')
    .select('expiration_type')
    .not('expiration_type', 'is', null);

  const byExpirationType = {};
  for (const row of expTypeData || []) {
    const type = row.expiration_type || 'other';
    byExpirationType[type] = (byExpirationType[type] || 0) + 1;
  }

  res.json({
    success: true,
    stats: {
      documents: {
        total: totalDocuments,
        processed: processedDocuments,
        percentProcessed: totalDocuments > 0 ? Math.round((processedDocuments / totalDocuments) * 100) : 0
      },
      expiration: {
        tracked: withExpiration,
        byType: byExpirationType
      },
      alerts: {
        active: activeAlerts
      },
      categories: byCategory
    }
  });
}));

module.exports = router;
