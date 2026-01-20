/**
 * Intelligence Routes
 * Daily log intelligence processing and insights management
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../errors');
const {
  processDailyLogIntelligence,
  getCatalogUpdateSuggestions
} = require('../daily-log-intelligence');

// ============================================================
// PROCESS DAILY LOG INTELLIGENCE
// ============================================================

// Process a specific daily log for intelligence extraction
router.post('/daily-log/:id/process', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify daily log exists and is completed
  const { data: log, error: logError } = await supabase
    .from('v2_daily_logs')
    .select('id, status, job_id')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (logError || !log) {
    throw new AppError('NOT_FOUND', 'Daily log not found');
  }

  // Process intelligence
  const result = await processDailyLogIntelligence(id);

  res.json(result);
}));

// ============================================================
// CATALOG LABOR FEEDBACK
// ============================================================

// Get labor feedback for a catalog item
router.get('/catalog/:id/labor-feedback', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 20 } = req.query;

  const { data, error } = await supabase
    .from('v2_catalog_labor_feedback')
    .select(`
      *,
      daily_log:v2_daily_logs(log_date, job_id),
      job:v2_jobs(name)
    `)
    .eq('catalog_item_id', id)
    .order('log_date', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Get catalog items with pending update suggestions
router.get('/catalog/pending-updates', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_pending_catalog_updates')
    .select('*');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Apply labor feedback to catalog item
router.post('/catalog/:id/apply-feedback', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { new_labor_hours, applied_by } = req.body;

  if (!new_labor_hours) {
    throw new AppError('VALIDATION_ERROR', 'new_labor_hours required');
  }

  // Get current catalog item
  const { data: item, error: itemError } = await supabase
    .from('v2_selection_catalog')
    .select('id, name, labor_hours')
    .eq('id', id)
    .single();

  if (itemError || !item) {
    throw new AppError('NOT_FOUND', 'Catalog item not found');
  }

  // Update catalog item
  const { error: updateError } = await supabase
    .from('v2_selection_catalog')
    .update({
      labor_hours: new_labor_hours,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Mark feedback records as applied
  await supabase
    .from('v2_catalog_labor_feedback')
    .update({
      applied_to_catalog: true,
      applied_at: new Date().toISOString(),
      applied_by: applied_by || 'user'
    })
    .eq('catalog_item_id', id)
    .eq('applied_to_catalog', false);

  // Log the change
  await supabase
    .from('v2_intelligence_insights')
    .insert({
      source_type: 'manual',
      insight_type: 'recommendation',
      severity: 'low',
      title: `Updated labor hours for ${item.name}`,
      description: `Labor hours updated from ${item.labor_hours || 'unset'}h to ${new_labor_hours}h based on daily log feedback`,
      affected_entity_type: 'catalog_item',
      affected_entity_id: id,
      status: 'applied',
      applied_at: new Date().toISOString()
    });

  res.json({
    success: true,
    item_id: id,
    previous_hours: item.labor_hours,
    new_hours: new_labor_hours
  });
}));

// ============================================================
// SCHEDULE DURATION FEEDBACK
// ============================================================

// Get duration feedback by trade
router.get('/schedule/duration-feedback', asyncHandler(async (req, res) => {
  const { trade, job_id, limit = 50 } = req.query;

  let query = supabase
    .from('v2_schedule_duration_feedback')
    .select('*')
    .order('recorded_date', { ascending: false })
    .limit(parseInt(limit));

  if (trade) {
    query = query.eq('trade', trade);
  }

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Get trade duration summary
router.get('/schedule/trade-summary', asyncHandler(async (req, res) => {
  const { trade } = req.query;

  const { data, error } = await supabase
    .rpc('get_trade_duration_summary', { p_trade: trade || null });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// ============================================================
// PRICE INTELLIGENCE FEEDBACK
// ============================================================

// Get delivery price feedback
router.get('/pricing/delivery-feedback', asyncHandler(async (req, res) => {
  const { vendor_id, master_item_id, limit = 50 } = req.query;

  let query = supabase
    .from('v2_delivery_price_feedback')
    .select(`
      *,
      vendor:v2_vendors(name),
      master_item:v2_master_items(standard_name, category)
    `)
    .order('delivery_date', { ascending: false })
    .limit(parseInt(limit));

  if (vendor_id) {
    query = query.eq('vendor_id', vendor_id);
  }

  if (master_item_id) {
    query = query.eq('master_item_id', master_item_id);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// ============================================================
// INSIGHTS
// ============================================================

// Get all insights
router.get('/insights', asyncHandler(async (req, res) => {
  const { type, status = 'new', severity, limit = 50 } = req.query;

  let query = supabase
    .from('v2_intelligence_insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (type) {
    query = query.eq('insight_type', type);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
  }

  if (severity) {
    query = query.eq('severity', severity);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Get insight counts by status
router.get('/insights/counts', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_intelligence_insights')
    .select('status, severity')
    .in('status', ['new', 'reviewed']);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const counts = {
    new: { total: 0, high: 0, medium: 0, low: 0 },
    reviewed: { total: 0, high: 0, medium: 0, low: 0 }
  };

  for (const row of data || []) {
    counts[row.status].total++;
    counts[row.status][row.severity]++;
  }

  res.json(counts);
}));

// Update insight status
router.patch('/insights/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reviewed_by } = req.body;

  const updateData = { status };

  if (status === 'reviewed') {
    updateData.reviewed_by = reviewed_by;
    updateData.reviewed_at = new Date().toISOString();
  } else if (status === 'applied') {
    updateData.applied_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('v2_intelligence_insights')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Dismiss insight
router.post('/insights/:id/dismiss', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { dismissed_by } = req.body;

  const { data, error } = await supabase
    .from('v2_intelligence_insights')
    .update({
      status: 'dismissed',
      reviewed_by: dismissed_by,
      reviewed_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// DASHBOARD / SUMMARY
// ============================================================

// Get intelligence dashboard summary
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [
    { data: insightCounts },
    { data: pendingUpdates },
    { data: tradeSummary },
    { data: recentFeedback }
  ] = await Promise.all([
    // Insight counts
    supabase
      .from('v2_intelligence_insights')
      .select('status, insight_type, severity')
      .in('status', ['new', 'reviewed']),

    // Pending catalog updates
    supabase
      .from('v2_pending_catalog_updates')
      .select('*')
      .limit(10),

    // Trade duration summary
    supabase.rpc('get_trade_duration_summary', { p_trade: null }),

    // Recent feedback activity
    supabase
      .from('v2_catalog_labor_feedback')
      .select('id, catalog_item_id, variance_percent, log_date')
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  // Calculate insight summary
  const insightsByType = {};
  const insightsByStatus = { new: 0, reviewed: 0 };

  for (const insight of insightCounts || []) {
    insightsByStatus[insight.status]++;
    insightsByType[insight.insight_type] = (insightsByType[insight.insight_type] || 0) + 1;
  }

  res.json({
    insights: {
      by_status: insightsByStatus,
      by_type: insightsByType,
      total_pending: insightsByStatus.new + insightsByStatus.reviewed
    },
    pending_catalog_updates: pendingUpdates || [],
    trade_summary: tradeSummary || [],
    recent_feedback_count: (recentFeedback || []).length
  });
}));

module.exports = router;
