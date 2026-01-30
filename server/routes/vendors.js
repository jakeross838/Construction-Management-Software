/**
 * Vendors Routes
 * Vendor management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError, validateRequest } = require('../core/errors');
const { calculateVendorSimilarity } = require('../services/standards');
const { validate, schemas } = require('../middleware/validate');

// Check for similar vendors (used before create)
router.get('/check-duplicate', asyncHandler(async (req, res) => {
  const { name, threshold = 75 } = req.query;

  if (!name || name.trim().length < 2) {
    return res.json({ matches: [] });
  }

  const searchName = name.trim();

  // Get all active vendors
  const { data: vendors, error } = await supabase
    .from('v2_vendors')
    .select('id, name, email, phone, trade')
    .is('deleted_at', null);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Find similar vendors using standards.calculateVendorSimilarity
  const matches = [];
  for (const vendor of vendors || []) {
    const similarity = calculateVendorSimilarity(searchName, vendor.name);
    if (similarity >= parseInt(threshold)) {
      matches.push({
        ...vendor,
        similarity: Math.round(similarity)
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  res.json({
    query: name,
    threshold: parseInt(threshold),
    matches: matches.slice(0, 5) // Top 5 matches
  });
}));

// Get all vendors
router.get('/', asyncHandler(async (req, res) => {
  const { search, trade, include_deleted } = req.query;

  let query = supabase
    .from('v2_vendors')
    .select('*');

  // Filter deleted unless explicitly requested
  if (include_deleted !== 'true') {
    query = query.is('deleted_at', null);
  }

  // Server-side search
  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }

  // Trade filter
  if (trade) {
    query = query.eq('trade', trade);
  }

  const { data, error } = await query.order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Create vendor (with duplicate warning)
router.post('/', validate(schemas.vendorCreate), asyncHandler(async (req, res) => {
  const { name, skip_duplicate_check } = req.body;

  // Check for duplicates unless explicitly skipped
  if (!skip_duplicate_check) {
    const { data: vendors } = await supabase
      .from('v2_vendors')
      .select('id, name, email, phone, trade')
      .is('deleted_at', null);

    const duplicates = [];
    for (const vendor of vendors || []) {
      const similarity = calculateVendorSimilarity(name.trim(), vendor.name);
      if (similarity >= 75) {
        duplicates.push({ ...vendor, similarity: Math.round(similarity) });
      }
    }

    if (duplicates.length > 0) {
      return res.status(409).json({
        error: 'DUPLICATE_WARNING',
        message: 'Similar vendor(s) already exist',
        duplicates: duplicates.sort((a, b) => b.similarity - a.similarity).slice(0, 3),
        hint: 'Set skip_duplicate_check: true to create anyway'
      });
    }
  }

  // Create the vendor (strip skip_duplicate_check from data)
  const { skip_duplicate_check: _, ...vendorData } = req.body;
  const { data, error } = await supabase
    .from('v2_vendors')
    .insert(vendorData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Update vendor
router.patch('/:id', validate(schemas.vendorUpdate), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_vendors')
    .update(req.body)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Soft delete vendor
router.delete('/:id', validate(schemas.idParam), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check vendor exists and not already deleted
  const { data: vendor, error: findError } = await supabase
    .from('v2_vendors')
    .select('id, name, deleted_at')
    .eq('id', id)
    .single();

  if (findError || !vendor) {
    throw notFoundError('vendor', id);
  }

  if (vendor.deleted_at) {
    throw new AppError('ALREADY_DELETED', 'Vendor is already deleted', { vendor_id: id });
  }

  // Soft delete
  const { data, error } = await supabase
    .from('v2_vendors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  res.json({ success: true, deleted: data });
}));

// Get all documents for a vendor
router.get('/:id/documents', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include_history } = req.query;

  let query = supabase
    .from('v2_vendor_documents')
    .select('*')
    .eq('vendor_id', id)
    .order('created_at', { ascending: false });

  // By default only current docs
  if (include_history !== 'true') {
    query = query.eq('is_current', true);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
}));

// Get vendor details with stats
router.get('/:id/details', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get vendor
  const { data: vendor, error: vendorError } = await supabase
    .from('v2_vendors')
    .select('*')
    .eq('id', id)
    .single();

  if (vendorError || !vendor) {
    throw notFoundError('vendor', id);
  }

  // Get invoice count and total
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('amount, status')
    .eq('vendor_id', id)
    .is('deleted_at', null);

  const stats = {
    invoice_count: invoices?.length || 0,
    total_billed: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0)
  };

  res.json({ ...vendor, stats });
}));

// ============================================================
// PHASE 74: TRADE SCORECARDS
// ============================================================

// Get vendor leaderboard
router.get('/leaderboard', asyncHandler(async (req, res) => {
  const { limit = 50, trade } = req.query;

  let query = supabase
    .from('v2_vendor_leaderboard')
    .select('*')
    .limit(parseInt(limit));

  // Trade filter would need to be added if we add trade to scorecards
  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
}));

// Compare multiple vendors
router.post('/compare', asyncHandler(async (req, res) => {
  const { vendor_ids } = req.body;

  if (!vendor_ids || !Array.isArray(vendor_ids) || vendor_ids.length < 2) {
    throw new AppError('VALIDATION_ERROR', 'At least 2 vendor_ids required');
  }

  const { data, error } = await supabase
    .rpc('compare_vendors', { p_vendor_ids: vendor_ids });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
}));

// Get vendor scorecard
router.get('/:id/scorecard', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: scorecard, error } = await supabase
    .from('v2_vendor_scorecards')
    .select('*')
    .eq('vendor_id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  // Return default scorecard if none exists
  if (!scorecard) {
    return res.json({
      vendor_id: id,
      overall_score: 50,
      quality_score: 50,
      speed_score: 50,
      reliability_score: 50,
      communication_score: 50,
      value_score: 50,
      total_jobs: 0,
      completed_jobs: 0,
      active_jobs: 0,
      on_time_percent: 0,
      on_budget_percent: 0,
      callback_rate: 0,
      avg_punch_items: 0,
      total_contract_value: 0,
      total_change_orders: 0,
      change_order_percent: 0,
      trend_direction: 'stable',
      preferred_vendor: false
    });
  }

  res.json(scorecard);
}));

// Force recalculate scorecard
router.post('/:id/scorecard/recalculate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .rpc('recalculate_vendor_scorecard', { p_vendor_id: id });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Fetch updated scorecard
  const { data: scorecard } = await supabase
    .from('v2_vendor_scorecards')
    .select('*')
    .eq('vendor_id', id)
    .single();

  res.json({ success: true, scorecard });
}));

// Toggle preferred vendor status
router.patch('/:id/scorecard/preferred', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { preferred, certified_by, notes } = req.body;

  // Upsert scorecard with preferred status
  const updateData = {
    vendor_id: id,
    preferred_vendor: preferred === true,
    updated_at: new Date().toISOString()
  };

  if (preferred) {
    updateData.certified_date = new Date().toISOString().split('T')[0];
    if (certified_by) updateData.certified_by = certified_by;
  }
  if (notes !== undefined) updateData.notes = notes;

  const { data, error } = await supabase
    .from('v2_vendor_scorecards')
    .upsert(updateData, { onConflict: 'vendor_id' })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Get vendor reviews
router.get('/:id/reviews', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  const { data, error } = await supabase
    .from('v2_vendor_reviews')
    .select(`
      *,
      job:v2_jobs(id, name),
      po:v2_purchase_orders(id, po_number)
    `)
    .eq('vendor_id', id)
    .order('review_date', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
}));

// Create vendor review
router.post('/:id/reviews', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const reviewData = {
    vendor_id: id,
    ...req.body
  };

  const { data, error } = await supabase
    .from('v2_vendor_reviews')
    .insert(reviewData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Scorecard will auto-update via trigger
  res.json(data);
}));

// Update vendor review
router.patch('/reviews/:reviewId', asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const { data, error } = await supabase
    .from('v2_vendor_reviews')
    .update(req.body)
    .eq('id', reviewId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Delete vendor review
router.delete('/reviews/:reviewId', asyncHandler(async (req, res) => {
  const { reviewId } = req.params;

  const { error } = await supabase
    .from('v2_vendor_reviews')
    .delete()
    .eq('id', reviewId);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ success: true });
}));

// Get vendor incidents
router.get('/:id/incidents', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50, include_resolved } = req.query;

  let query = supabase
    .from('v2_vendor_incidents')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('vendor_id', id)
    .order('incident_date', { ascending: false })
    .limit(parseInt(limit));

  // Filter unresolved only by default
  if (include_resolved !== 'true') {
    query = query.is('resolved_date', null);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
}));

// Create vendor incident
router.post('/:id/incidents', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const incidentData = {
    vendor_id: id,
    ...req.body
  };

  const { data, error } = await supabase
    .from('v2_vendor_incidents')
    .insert(incidentData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Scorecard will auto-update via trigger
  res.json(data);
}));

// Update vendor incident (e.g., resolve it)
router.patch('/incidents/:incidentId', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;

  const { data, error } = await supabase
    .from('v2_vendor_incidents')
    .update(req.body)
    .eq('id', incidentId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Delete vendor incident
router.delete('/incidents/:incidentId', asyncHandler(async (req, res) => {
  const { incidentId } = req.params;

  const { error } = await supabase
    .from('v2_vendor_incidents')
    .delete()
    .eq('id', incidentId);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ success: true });
}));

// Get trade metrics (benchmarks)
router.get('/trades/metrics', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_trade_metrics')
    .select('*')
    .order('trade_name');

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
}));

module.exports = router;

