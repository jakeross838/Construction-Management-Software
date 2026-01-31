/**
 * Benchmarks Routes
 * Performance benchmarks for scope categories and vendors
 * Used for estimating, scheduling, and vendor comparison
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');

// ============================================================
// CATEGORY BENCHMARKS
// ============================================================

// Get all category benchmarks
router.get('/categories', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_category_benchmarks')
    .select(`
      *,
      scope_category:v2_scope_categories(
        id, code, name, trade, primary_unit, baseline_days_per_unit, phase
      )
    `)
    .order('last_calculated', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ benchmarks: data || [] });
}));

// Get benchmark for a specific scope category
router.get('/categories/:scopeId', asyncHandler(async (req, res) => {
  const { scopeId } = req.params;

  const { data, error } = await supabase
    .from('v2_category_benchmarks')
    .select(`
      *,
      scope_category:v2_scope_categories(
        id, code, name, trade, primary_unit, baseline_days_per_unit, phase
      )
    `)
    .eq('scope_category_id', scopeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No benchmark yet - return baseline from scope category
      const { data: category } = await supabase
        .from('v2_scope_categories')
        .select('id, code, name, trade, primary_unit, baseline_days_per_unit, baseline_workers, phase')
        .eq('id', scopeId)
        .single();

      if (!category) throw notFoundError('scope category', scopeId);

      return res.json({
        scope_category_id: scopeId,
        scope_category: category,
        sample_count: 0,
        avg_days_per_unit: category.baseline_days_per_unit,
        p25_days_per_unit: category.baseline_days_per_unit * 0.8,
        p50_days_per_unit: category.baseline_days_per_unit,
        p75_days_per_unit: category.baseline_days_per_unit * 1.2,
        avg_workers: category.baseline_workers,
        is_baseline: true
      });
    }
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.json({ ...data, is_baseline: false });
}));

// Trigger recalculation of category benchmarks
router.post('/categories/recalculate', asyncHandler(async (req, res) => {
  const { scope_category_id } = req.body;

  const { error } = await supabase.rpc('recalculate_category_benchmarks', {
    p_scope_category_id: scope_category_id || null
  });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  res.json({
    success: true,
    message: scope_category_id
      ? `Benchmarks recalculated for scope category ${scope_category_id}`
      : 'All category benchmarks recalculated'
  });
}));

// ============================================================
// VENDOR BENCHMARKS
// ============================================================

// Get all benchmarks for a specific vendor
router.get('/vendors/:vendorId', asyncHandler(async (req, res) => {
  const { vendorId } = req.params;

  const { data, error } = await supabase
    .from('v2_vendor_benchmarks')
    .select(`
      *,
      scope_category:v2_scope_categories(
        id, code, name, trade, primary_unit, phase
      )
    `)
    .eq('vendor_id', vendorId)
    .order('sample_count', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Get vendor name
  const { data: vendor } = await supabase
    .from('v2_vendors')
    .select('id, name')
    .eq('id', vendorId)
    .single();

  res.json({
    vendor: vendor || { id: vendorId, name: 'Unknown' },
    benchmarks: data || []
  });
}));

// Get vendor benchmark for a specific scope
router.get('/vendors/:vendorId/scope/:scopeId', asyncHandler(async (req, res) => {
  const { vendorId, scopeId } = req.params;

  const { data, error } = await supabase
    .from('v2_vendor_benchmarks')
    .select(`
      *,
      scope_category:v2_scope_categories(
        id, code, name, trade, primary_unit, phase
      )
    `)
    .eq('vendor_id', vendorId)
    .eq('scope_category_id', scopeId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw notFoundError('vendor benchmark', `${vendorId}/${scopeId}`);
    }
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.json(data);
}));

// Trigger recalculation of vendor benchmarks
router.post('/vendors/recalculate', asyncHandler(async (req, res) => {
  const { vendor_id } = req.body;

  const { error } = await supabase.rpc('recalculate_vendor_benchmarks', {
    p_vendor_id: vendor_id || null
  });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  res.json({
    success: true,
    message: vendor_id
      ? `Benchmarks recalculated for vendor ${vendor_id}`
      : 'All vendor benchmarks recalculated'
  });
}));

// ============================================================
// VENDOR COMPARISON
// ============================================================

// Compare vendors for a specific scope category
router.get('/compare', asyncHandler(async (req, res) => {
  const { scope_id, scope_code, trade, job_id } = req.query;

  if (!scope_id && !scope_code && !trade) {
    throw new AppError('VALIDATION_FAILED', 'scope_id, scope_code, or trade is required');
  }

  // Get the scope category info
  let scopeCategory = null;
  let scopeCategoryIds = [];

  if (scope_id) {
    const { data } = await supabase
      .from('v2_scope_categories')
      .select('*')
      .eq('id', scope_id)
      .single();
    scopeCategory = data;
    scopeCategoryIds = [scope_id];
  } else if (scope_code) {
    const { data } = await supabase
      .from('v2_scope_categories')
      .select('*')
      .eq('code', scope_code.toUpperCase())
      .single();
    scopeCategory = data;
    scopeCategoryIds = data ? [data.id] : [];
  } else if (trade) {
    // Get all scope categories for this trade
    const { data } = await supabase
      .from('v2_scope_categories')
      .select('*')
      .eq('trade', trade)
      .eq('is_active', true);
    scopeCategoryIds = (data || []).map(s => s.id);
  }

  if (scopeCategoryIds.length === 0) {
    throw notFoundError('scope category', scope_id || scope_code || trade);
  }

  // Get category benchmark for comparison baseline
  let categoryBenchmark = null;
  if (scopeCategory) {
    const { data } = await supabase
      .from('v2_category_benchmarks')
      .select('*')
      .eq('scope_category_id', scopeCategory.id)
      .single();
    categoryBenchmark = data;
  }

  // Get all vendor benchmarks for this scope
  const { data: vendorBenchmarks, error } = await supabase
    .from('v2_vendor_benchmarks')
    .select(`
      *,
      vendor:v2_vendors(id, name),
      scope_category:v2_scope_categories(id, code, name, trade)
    `)
    .in('scope_category_id', scopeCategoryIds)
    .order('avg_quality_score', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Get job quantity if job_id provided
  let jobQuantity = null;
  if (job_id && scopeCategory?.job_spec_field) {
    const { data: specs } = await supabase
      .from('v2_job_specifications')
      .select('*')
      .eq('job_id', job_id)
      .single();

    if (specs && specs[scopeCategory.job_spec_field]) {
      jobQuantity = specs[scopeCategory.job_spec_field];
    }
  }

  // Calculate estimated days for each vendor if we have job quantity
  const comparisons = (vendorBenchmarks || []).map(vb => {
    const estimatedDays = jobQuantity
      ? Math.ceil(jobQuantity * vb.avg_days_per_unit)
      : null;
    const estimatedCost = jobQuantity
      ? Math.round(jobQuantity * vb.avg_cost_per_unit * 100) / 100
      : null;

    return {
      vendor_id: vb.vendor_id,
      vendor_name: vb.vendor?.name || 'Unknown',
      scope_code: vb.scope_category?.code,
      scope_name: vb.scope_category?.name,
      trade: vb.scope_category?.trade,
      sample_count: vb.sample_count,
      avg_days_per_unit: vb.avg_days_per_unit,
      avg_cost_per_unit: vb.avg_cost_per_unit,
      speed_vs_category: vb.speed_vs_category,
      cost_vs_category: vb.cost_vs_category,
      avg_quality_score: vb.avg_quality_score,
      rework_rate: vb.rework_rate,
      estimated_days: estimatedDays,
      estimated_cost: estimatedCost,
      recommendation_score: calculateRecommendationScore(vb)
    };
  });

  // Sort by recommendation score
  comparisons.sort((a, b) => (b.recommendation_score || 0) - (a.recommendation_score || 0));

  res.json({
    scope_category: scopeCategory,
    category_benchmark: categoryBenchmark || {
      avg_days_per_unit: scopeCategory?.baseline_days_per_unit,
      avg_workers: scopeCategory?.baseline_workers || 2,
      sample_count: 0,
      is_baseline: true
    },
    job_quantity: jobQuantity,
    vendors: comparisons,
    recommendation: comparisons.length > 0 ? comparisons[0] : null
  });
}));

// Calculate a recommendation score (0-100) based on multiple factors
function calculateRecommendationScore(benchmark) {
  if (!benchmark || !benchmark.sample_count) return 0;

  let score = 50; // Base score

  // Quality weight: 40%
  if (benchmark.avg_quality_score) {
    score += (benchmark.avg_quality_score - 50) * 0.4;
  }

  // Speed weight: 30% (positive speed_vs_category means faster)
  if (benchmark.speed_vs_category) {
    score += Math.min(15, Math.max(-15, benchmark.speed_vs_category * 0.3));
  }

  // Cost weight: 20% (positive cost_vs_category means cheaper)
  if (benchmark.cost_vs_category) {
    score += Math.min(10, Math.max(-10, benchmark.cost_vs_category * 0.2));
  }

  // Sample count weight: 10% (more data = more confidence)
  score += Math.min(10, benchmark.sample_count);

  // Rework penalty
  if (benchmark.rework_rate) {
    score -= benchmark.rework_rate * 0.5;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ============================================================
// SCOPE PERFORMANCE RECORDS
// ============================================================

// Get performance history for a scope category
router.get('/performance/scope/:scopeId', asyncHandler(async (req, res) => {
  const { scopeId } = req.params;
  const { limit = 50 } = req.query;

  const { data, error } = await supabase
    .from('v2_scope_performance')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      po:v2_purchase_orders(id, po_number)
    `)
    .eq('scope_category_id', scopeId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ records: data || [] });
}));

// Get performance history for a vendor
router.get('/performance/vendor/:vendorId', asyncHandler(async (req, res) => {
  const { vendorId } = req.params;
  const { limit = 50 } = req.query;

  const { data, error } = await supabase
    .from('v2_scope_performance')
    .select(`
      *,
      job:v2_jobs(id, name),
      scope_category:v2_scope_categories(id, code, name, trade),
      po:v2_purchase_orders(id, po_number)
    `)
    .eq('vendor_id', vendorId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ records: data || [] });
}));

// Get performance history for a job
router.get('/performance/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await supabase
    .from('v2_scope_performance')
    .select(`
      *,
      vendor:v2_vendors(id, name),
      scope_category:v2_scope_categories(id, code, name, trade),
      po:v2_purchase_orders(id, po_number)
    `)
    .eq('job_id', jobId)
    .order('start_date', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ records: data || [] });
}));

// ============================================================
// SCHEDULE ESTIMATION
// ============================================================

// Get estimated schedule for a job based on specifications
router.get('/estimate/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { use_vendor_rates = false, vendor_ids } = req.query;

  // Get job specifications
  const { data: specs, error: specsError } = await supabase
    .from('v2_job_specifications')
    .select('*')
    .eq('job_id', jobId)
    .single();

  if (specsError && specsError.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', specsError.message);
  }

  if (!specs) {
    throw new AppError('VALIDATION_FAILED', 'Job specifications not found. Please add specs first.');
  }

  // Get all scope categories
  const { data: categories } = await supabase
    .from('v2_scope_categories')
    .select(`
      id, code, name, trade, primary_unit, job_spec_field,
      baseline_days_per_unit, baseline_workers, phase
    `)
    .eq('is_active', true)
    .order('phase')
    .order('trade');

  // Get category benchmarks
  const { data: benchmarks } = await supabase
    .from('v2_category_benchmarks')
    .select('scope_category_id, avg_days_per_unit, p50_days_per_unit, avg_workers, sample_count');

  const benchmarkMap = {};
  (benchmarks || []).forEach(b => {
    benchmarkMap[b.scope_category_id] = b;
  });

  // Get vendor benchmarks if requested
  let vendorBenchmarkMap = {};
  if (use_vendor_rates && vendor_ids) {
    const vendorIdList = vendor_ids.split(',');
    const { data: vendorBench } = await supabase
      .from('v2_vendor_benchmarks')
      .select('vendor_id, scope_category_id, avg_days_per_unit, avg_workers')
      .in('vendor_id', vendorIdList);

    (vendorBench || []).forEach(vb => {
      if (!vendorBenchmarkMap[vb.scope_category_id]) {
        vendorBenchmarkMap[vb.scope_category_id] = {};
      }
      vendorBenchmarkMap[vb.scope_category_id][vb.vendor_id] = vb;
    });
  }

  // Calculate estimates for each scope
  const estimates = [];
  let totalDays = 0;

  (categories || []).forEach(cat => {
    // Get quantity from job specs
    const quantity = cat.job_spec_field && specs[cat.job_spec_field];
    if (!quantity || quantity <= 0) return;

    // Get rate (prefer benchmark over baseline)
    const benchmark = benchmarkMap[cat.id];
    let rate = benchmark?.p50_days_per_unit || benchmark?.avg_days_per_unit || cat.baseline_days_per_unit;
    let workers = benchmark?.avg_workers || cat.baseline_workers || 2;
    let dataPoints = benchmark?.sample_count || 0;

    const estimatedDays = Math.ceil(quantity * rate);
    totalDays += estimatedDays;

    estimates.push({
      scope_category_id: cat.id,
      code: cat.code,
      name: cat.name,
      trade: cat.trade,
      phase: cat.phase,
      unit: cat.primary_unit,
      quantity,
      rate,
      estimated_days: estimatedDays,
      avg_workers: workers,
      data_points: dataPoints,
      has_benchmark: dataPoints > 0
    });
  });

  // Group by phase
  const byPhase = {
    sitework: estimates.filter(e => e.phase === 'sitework'),
    rough: estimates.filter(e => e.phase === 'rough'),
    finish: estimates.filter(e => e.phase === 'finish')
  };

  res.json({
    job_id: jobId,
    specifications: specs,
    estimates,
    by_phase: byPhase,
    summary: {
      total_estimated_days: totalDays,
      scopes_with_data: estimates.filter(e => e.has_benchmark).length,
      scopes_using_baseline: estimates.filter(e => !e.has_benchmark).length
    }
  });
}));

module.exports = router;
