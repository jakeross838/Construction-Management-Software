/**
 * Labor Bids Routes
 * API endpoints for labor bid tracking, comparison, and subcontractor analysis
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// LABOR CATEGORIES
// ============================================================

/**
 * GET /api/labor-bids/categories
 * Get all labor categories (trades) with their specs
 */
router.get('/categories', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { active_only = 'true' } = req.query;

  let query = supabase
    .from('v2_labor_categories')
    .select('*')
    .eq('builder_id', builderId)
    .order('sort_order');

  if (active_only === 'true') {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * GET /api/labor-bids/categories/:id
 * Get a single category with its specifications and scope templates
 */
router.get('/categories/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const [categoryResult, specsResult, templatesResult] = await Promise.all([
    supabase.from('v2_labor_categories').select('*').eq('id', id).eq('builder_id', builderId).single(),
    supabase.from('v2_labor_specifications').select('*').eq('category_id', id).eq('builder_id', builderId).eq('is_active', true).order('spec_type').order('sort_order'),
    supabase.from('v2_scope_templates').select('*').eq('category_id', id).eq('builder_id', builderId).eq('is_active', true).order('sort_order')
  ]);

  if (categoryResult.error) throw new AppError('Category not found', 404);

  res.json({
    ...categoryResult.data,
    specifications: specsResult.data || [],
    scope_templates: templatesResult.data || []
  });
}));

// ============================================================
// LABOR SPECIFICATIONS
// ============================================================

/**
 * GET /api/labor-bids/specifications
 * Get labor specifications (finish levels, materials, etc.)
 */
router.get('/specifications', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { category_id, spec_type } = req.query;

  let query = supabase
    .from('v2_labor_specifications')
    .select('*, category:v2_labor_categories(name)')
    .eq('builder_id', builderId)
    .eq('is_active', true)
    .order('category_id')
    .order('spec_type')
    .order('sort_order');

  if (category_id) {
    query = query.eq('category_id', category_id);
  }

  if (spec_type) {
    query = query.eq('spec_type', spec_type);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * POST /api/labor-bids/specifications
 * Create a new specification
 */
router.post('/specifications', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { category_id, spec_type, spec_name, spec_description, price_multiplier, is_default, sort_order } = req.body;

  if (!category_id || !spec_type || !spec_name) {
    throw new AppError('category_id, spec_type, and spec_name are required', 400);
  }

  const { data, error } = await supabase
    .from('v2_labor_specifications')
    .insert({
      builder_id: builderId,
      category_id,
      spec_type,
      spec_name,
      spec_description: spec_description || null,
      price_multiplier: price_multiplier || 1.0,
      is_default: is_default || false,
      sort_order: sort_order || 0
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

// ============================================================
// SCOPE TEMPLATES
// ============================================================

/**
 * GET /api/labor-bids/scope-templates
 * Get standard scope items by trade
 */
router.get('/scope-templates', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { category_id, standard_only } = req.query;

  let query = supabase
    .from('v2_scope_templates')
    .select('*, category:v2_labor_categories(name)')
    .eq('builder_id', builderId)
    .eq('is_active', true)
    .order('category_id')
    .order('sort_order');

  if (category_id) {
    query = query.eq('category_id', category_id);
  }

  if (standard_only === 'true') {
    query = query.eq('is_standard', true);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

// ============================================================
// LABOR BIDS
// ============================================================

/**
 * GET /api/labor-bids/bids
 * List labor bids with filters
 */
router.get('/bids', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, vendor_id, category_id, status, limit = 100, offset = 0 } = req.query;
  const limitInt = Math.min(parseInt(limit) || 100, 500);
  const offsetInt = parseInt(offset) || 0;

  let query = supabase
    .from('v2_labor_bids')
    .select(`
      *,
      job:v2_jobs(id, name, conditioned_sf),
      vendor:v2_vendors(id, name),
      category:v2_labor_categories(id, name, code, primary_metric)
    `)
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false })
    .range(offsetInt, offsetInt + limitInt - 1);

  let countQuery = supabase
    .from('v2_labor_bids')
    .select('*', { count: 'exact', head: true })
    .eq('builder_id', builderId);

  if (job_id) {
    query = query.eq('job_id', job_id);
    countQuery = countQuery.eq('job_id', job_id);
  }

  if (vendor_id) {
    query = query.eq('vendor_id', vendor_id);
    countQuery = countQuery.eq('vendor_id', vendor_id);
  }

  if (category_id) {
    query = query.eq('category_id', category_id);
    countQuery = countQuery.eq('category_id', category_id);
  }

  if (status && status !== 'all') {
    query = query.eq('status', status);
    countQuery = countQuery.eq('status', status);
  }

  const [{ data, error }, { count }] = await Promise.all([query, countQuery]);
  if (error) throw new AppError(error.message, 500);

  res.json({
    bids: data || [],
    pagination: {
      total: count || 0,
      limit: limitInt,
      offset: offsetInt,
      hasMore: (offsetInt + limitInt) < (count || 0)
    }
  });
}));

/**
 * GET /api/labor-bids/bids/:id
 * Get a single bid with all details
 */
router.get('/bids/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  // Get bid with related data
  const { data: bid, error } = await supabase
    .from('v2_labor_bids')
    .select(`
      *,
      job:v2_jobs(id, name, conditioned_sf, total_sf, job_type),
      vendor:v2_vendors(id, name),
      category:v2_labor_categories(id, name, code, primary_metric, typical_low, typical_high)
    `)
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (error) throw new AppError('Bid not found', 404);

  // Get bid items
  const { data: items } = await supabase
    .from('v2_labor_bid_items')
    .select('*, scope_template:v2_scope_templates(item_name, is_standard)')
    .eq('bid_id', id)
    .eq('builder_id', builderId)
    .order('sort_order');

  // Get bid specs
  const { data: specs } = await supabase
    .from('v2_labor_bid_specs')
    .select('*, spec:v2_labor_specifications(spec_type, spec_name, price_multiplier)')
    .eq('bid_id', id)
    .eq('builder_id', builderId);

  // Get vendor performance for this category
  const { data: performance } = await supabase
    .from('v2_sub_performance')
    .select('*')
    .eq('vendor_id', bid.vendor_id)
    .eq('category_id', bid.category_id)
    .eq('builder_id', builderId)
    .single();

  // Get other bids for comparison
  const { data: otherBids } = await supabase
    .from('v2_labor_bids')
    .select('id, vendor_id, total_amount, normalized_amount, status, is_lowest, vendor:v2_vendors(name)')
    .eq('builder_id', builderId)
    .eq('job_id', bid.job_id)
    .eq('category_id', bid.category_id)
    .neq('id', id)
    .order('total_amount');

  res.json({
    ...bid,
    items: items || [],
    specs: specs || [],
    vendor_performance: performance || null,
    comparison_bids: otherBids || []
  });
}));

/**
 * POST /api/labor-bids/bids
 * Create a new labor bid
 */
router.post('/bids', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    job_id,
    vendor_id,
    category_id,
    bid_number,
    bid_date,
    valid_until,
    base_amount,
    alternates_amount,
    scope_notes,
    inclusions,
    exclusions,
    scope_score,
    payment_terms,
    warranty_terms,
    lead_time_days,
    duration_days,
    pdf_url,
    notes,
    items,
    spec_ids
  } = req.body;

  if (!job_id || !vendor_id || !category_id || base_amount === undefined) {
    throw new AppError('job_id, vendor_id, category_id, and base_amount are required', 400);
  }

  // Create the bid
  const { data: bid, error } = await supabase
    .from('v2_labor_bids')
    .insert({
      builder_id: builderId,
      job_id,
      vendor_id,
      category_id,
      bid_number,
      bid_date: bid_date || new Date().toISOString().split('T')[0],
      valid_until,
      base_amount,
      alternates_amount: alternates_amount || 0,
      scope_notes,
      inclusions: inclusions || [],
      exclusions: exclusions || [],
      scope_score,
      payment_terms,
      warranty_terms,
      lead_time_days,
      duration_days,
      pdf_url,
      notes,
      status: 'received'
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  // Add items if provided
  if (items && Array.isArray(items) && items.length > 0) {
    const bidItems = items.map((item, index) => ({
      builder_id: builderId,
      bid_id: bid.id,
      scope_template_id: item.scope_template_id || null,
      description: item.description,
      amount: item.amount || null,
      is_included: item.is_included !== false,
      is_alternate: item.is_alternate || false,
      notes: item.notes || null,
      sort_order: item.sort_order ?? index
    }));

    await supabase.from('v2_labor_bid_items').insert(bidItems);
  }

  // Add specs if provided
  if (spec_ids && Array.isArray(spec_ids) && spec_ids.length > 0) {
    const bidSpecs = spec_ids.map(spec_id => ({
      builder_id: builderId,
      bid_id: bid.id,
      spec_id
    }));

    await supabase.from('v2_labor_bid_specs').insert(bidSpecs);
  }

  // Return the full bid
  const { data: fullBid } = await supabase
    .from('v2_labor_bids')
    .select('*, job:v2_jobs(name), vendor:v2_vendors(name), category:v2_labor_categories(name)')
    .eq('id', bid.id)
    .eq('builder_id', builderId)
    .single();

  res.status(201).json(fullBid);
}));

/**
 * PATCH /api/labor-bids/bids/:id
 * Update a labor bid
 */
router.patch('/bids/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const updates = { ...req.body };

  // Remove nested objects that shouldn't be updated directly
  delete updates.items;
  delete updates.spec_ids;
  delete updates.job;
  delete updates.vendor;
  delete updates.category;

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('v2_labor_bids')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * POST /api/labor-bids/bids/:id/accept
 * Accept/select a bid
 */
router.post('/bids/:id/accept', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  // Get the bid to find job/category
  const { data: bid, error: bidError } = await supabase
    .from('v2_labor_bids')
    .select('job_id, category_id')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (bidError) throw new AppError('Bid not found', 404);

  // Unselect any other bids for this job/category
  await supabase
    .from('v2_labor_bids')
    .update({ is_selected: false })
    .eq('builder_id', builderId)
    .eq('job_id', bid.job_id)
    .eq('category_id', bid.category_id);

  // Select this bid
  const { data, error } = await supabase
    .from('v2_labor_bids')
    .update({
      status: 'accepted',
      is_selected: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Bid accepted', bid: data });
}));

/**
 * POST /api/labor-bids/bids/:id/reject
 * Reject a bid
 */
router.post('/bids/:id/reject', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { reason } = req.body;

  const { data, error } = await supabase
    .from('v2_labor_bids')
    .update({
      status: 'rejected',
      notes: reason ? `Rejected: ${reason}` : null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Bid rejected', bid: data });
}));

/**
 * DELETE /api/labor-bids/bids/:id
 * Delete a bid (hard delete)
 */
router.delete('/bids/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_labor_bids')
    .delete()
    .eq('id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Bid deleted' });
}));

// ============================================================
// BID ITEMS
// ============================================================

/**
 * POST /api/labor-bids/bids/:id/items
 * Add items to a bid
 */
router.post('/bids/:id/items', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('items array is required', 400);
  }

  const bidItems = items.map((item, index) => ({
    builder_id: builderId,
    bid_id: id,
    scope_template_id: item.scope_template_id || null,
    description: item.description,
    amount: item.amount || null,
    is_included: item.is_included !== false,
    is_alternate: item.is_alternate || false,
    notes: item.notes || null,
    sort_order: item.sort_order ?? index
  }));

  const { data, error } = await supabase
    .from('v2_labor_bid_items')
    .insert(bidItems)
    .select();

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

/**
 * DELETE /api/labor-bids/items/:id
 * Remove an item from a bid
 */
router.delete('/items/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_labor_bid_items')
    .delete()
    .eq('id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Item removed' });
}));

// ============================================================
// BID SPECIFICATIONS
// ============================================================

/**
 * POST /api/labor-bids/bids/:id/specs
 * Add specifications to a bid
 */
router.post('/bids/:id/specs', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { spec_ids } = req.body;

  if (!spec_ids || !Array.isArray(spec_ids) || spec_ids.length === 0) {
    throw new AppError('spec_ids array is required', 400);
  }

  const bidSpecs = spec_ids.map(spec_id => ({
    builder_id: builderId,
    bid_id: id,
    spec_id
  }));

  const { data, error } = await supabase
    .from('v2_labor_bid_specs')
    .insert(bidSpecs)
    .select('*, spec:v2_labor_specifications(spec_type, spec_name, price_multiplier)');

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

/**
 * DELETE /api/labor-bids/bids/:id/specs/:specId
 * Remove a specification from a bid
 */
router.delete('/bids/:id/specs/:specId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id, specId } = req.params;

  const { error } = await supabase
    .from('v2_labor_bid_specs')
    .delete()
    .eq('bid_id', id)
    .eq('spec_id', specId)
    .eq('builder_id', builderId);

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Specification removed' });
}));

// ============================================================
// JOB METRICS
// ============================================================

/**
 * GET /api/labor-bids/jobs/:id/metrics
 * Get job metrics for bid normalization
 */
router.get('/jobs/:id/metrics', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_jobs')
    .select(`
      id, name, address, job_type,
      conditioned_sf, total_sf, lot_sf, stories,
      bedrooms, bathrooms, garage_sf, garage_bays,
      exterior_wall_sf, roof_squares, window_count, door_count,
      plumbing_fixtures, hvac_tons
    `)
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (error) throw new AppError('Job not found', 404);

  res.json(data);
}));

/**
 * PATCH /api/labor-bids/jobs/:id/metrics
 * Update job metrics
 */
router.patch('/jobs/:id/metrics', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const metrics = req.body;

  // Only allow metric fields
  const allowedFields = [
    'conditioned_sf', 'total_sf', 'lot_sf', 'stories',
    'bedrooms', 'bathrooms', 'garage_sf', 'garage_bays',
    'exterior_wall_sf', 'roof_squares', 'window_count', 'door_count',
    'plumbing_fixtures', 'hvac_tons', 'job_type'
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (metrics[field] !== undefined) {
      updates[field] = metrics[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('No valid metric fields provided', 400);
  }

  const { data, error } = await supabase
    .from('v2_jobs')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

// ============================================================
// BID COMPARISON & ANALYSIS
// ============================================================

/**
 * GET /api/labor-bids/jobs/:id/comparison
 * Get bid comparison for a job
 */
router.get('/jobs/:id/comparison', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { category_id } = req.query;

  let query = supabase
    .from('v2_bid_comparison_detail')
    .select('*')
    .eq('builder_id', builderId)
    .eq('job_id', id);

  if (category_id) {
    query = query.eq('category_id', category_id);
  }

  const { data, error } = await query.order('category_name').order('total_amount');
  if (error) throw new AppError(error.message, 500);

  // Group by category
  const byCategory = {};
  for (const bid of (data || [])) {
    if (!byCategory[bid.category_name]) {
      byCategory[bid.category_name] = {
        category_id: bid.category_id,
        category_name: bid.category_name,
        primary_metric: bid.primary_metric,
        typical_low: bid.typical_low,
        typical_high: bid.typical_high,
        bids: []
      };
    }
    byCategory[bid.category_name].bids.push(bid);
  }

  // Calculate summary stats per category
  const comparison = Object.values(byCategory).map(cat => {
    const amounts = cat.bids.map(b => b.total_amount).filter(a => a > 0);
    const normalizedAmounts = cat.bids.map(b => b.normalized_amount).filter(a => a > 0);

    return {
      ...cat,
      bid_count: cat.bids.length,
      lowest_amount: amounts.length > 0 ? Math.min(...amounts) : null,
      highest_amount: amounts.length > 0 ? Math.max(...amounts) : null,
      avg_amount: amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : null,
      spread: amounts.length > 1 ? Math.max(...amounts) - Math.min(...amounts) : 0,
      lowest_normalized: normalizedAmounts.length > 0 ? Math.min(...normalizedAmounts) : null
    };
  });

  res.json(comparison);
}));

/**
 * GET /api/labor-bids/jobs/:id/analysis
 * Get bid analysis/recommendations for a job
 */
router.get('/jobs/:id/analysis', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  // Call the analysis function
  const { data, error } = await supabase.rpc('analyze_bids', { p_job_id: id, p_builder_id: builderId });

  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// ============================================================
// SUBCONTRACTOR PERFORMANCE
// ============================================================

/**
 * GET /api/labor-bids/vendors/:id/performance
 * Get performance metrics for a vendor across categories
 */
router.get('/vendors/:id/performance', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_sub_performance')
    .select('*, category:v2_labor_categories(name, code)')
    .eq('builder_id', builderId)
    .eq('vendor_id', id);

  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

/**
 * GET /api/labor-bids/performance
 * Get performance leaderboard by category
 */
router.get('/performance', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { category_id, min_jobs = 1 } = req.query;

  let query = supabase
    .from('v2_sub_performance')
    .select('*, vendor:v2_vendors(name), category:v2_labor_categories(name, code)')
    .eq('builder_id', builderId)
    .gte('total_jobs', parseInt(min_jobs))
    .order('avg_quality_score', { ascending: false });

  if (category_id) {
    query = query.eq('category_id', category_id);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// ============================================================
// LABOR HISTORY
// ============================================================

/**
 * GET /api/labor-bids/history
 * Get historical labor pricing data
 */
router.get('/history', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { category_id, vendor_id, job_type, year, limit = 100 } = req.query;

  let query = supabase
    .from('v2_labor_history')
    .select('*, job:v2_jobs(name), vendor:v2_vendors(name), category:v2_labor_categories(name)')
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (category_id) {
    query = query.eq('category_id', category_id);
  }

  if (vendor_id) {
    query = query.eq('vendor_id', vendor_id);
  }

  if (job_type) {
    query = query.eq('job_type', job_type);
  }

  if (year) {
    query = query.eq('bid_year', parseInt(year));
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

/**
 * POST /api/labor-bids/history
 * Record a completed job to labor history
 */
router.post('/history', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    job_id,
    vendor_id,
    category_id,
    bid_id,
    total_amount,
    final_amount,
    change_order_amount,
    on_budget,
    on_schedule,
    quality_score,
    would_use_again,
    notes
  } = req.body;

  if (!job_id || !vendor_id || !category_id) {
    throw new AppError('job_id, vendor_id, and category_id are required', 400);
  }

  // Get job metrics
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('conditioned_sf, total_sf, job_type')
    .eq('id', job_id)
    .eq('builder_id', builderId)
    .single();

  const bidDate = new Date();

  const { data, error } = await supabase
    .from('v2_labor_history')
    .insert({
      builder_id: builderId,
      job_id,
      vendor_id,
      category_id,
      bid_id,
      conditioned_sf: job?.conditioned_sf,
      total_sf: job?.total_sf,
      job_type: job?.job_type,
      total_amount,
      price_per_sf: job?.conditioned_sf > 0 ? total_amount / job.conditioned_sf : null,
      was_selected: true,
      final_amount,
      change_order_amount,
      on_budget,
      on_schedule,
      quality_score,
      would_use_again,
      bid_year: bidDate.getFullYear(),
      bid_month: bidDate.getMonth() + 1,
      notes
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  // Update sub performance (would need a trigger or separate logic)

  res.status(201).json(data);
}));

// ============================================================
// STATS
// ============================================================

/**
 * GET /api/labor-bids/stats
 * Get overall labor bids statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const [
    { count: bidCount },
    { count: activeJobCount },
    { count: vendorCount },
    { count: categoryCount }
  ] = await Promise.all([
    supabase.from('v2_labor_bids').select('*', { count: 'exact', head: true }).eq('builder_id', builderId),
    supabase.from('v2_labor_bids').select('*', { count: 'exact', head: true }).eq('builder_id', builderId).in('status', ['received', 'reviewing']),
    supabase.from('v2_sub_performance').select('vendor_id', { count: 'exact', head: true }).eq('builder_id', builderId),
    supabase.from('v2_labor_categories').select('*', { count: 'exact', head: true }).eq('builder_id', builderId).eq('is_active', true)
  ]);

  // Get recent bid trend
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: recentBids } = await supabase
    .from('v2_labor_bids')
    .select('id, created_at')
    .eq('builder_id', builderId)
    .gte('created_at', thirtyDaysAgo.toISOString());

  res.json({
    total_bids: bidCount || 0,
    active_bids: activeJobCount || 0,
    tracked_vendors: vendorCount || 0,
    trade_categories: categoryCount || 0,
    bids_last_30_days: recentBids?.length || 0
  });
}));

module.exports = router;
