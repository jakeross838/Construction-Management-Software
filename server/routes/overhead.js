/**
 * Overhead Allocation Routes
 * Cost pool configuration and overhead calculation/allocation
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// COST POOLS
// ============================================================

// List cost pools
router.get('/cost-pools', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_cost_pools')
    .select(`
      *,
      categories:v2_cost_pool_categories(
        id,
        expense_category:v2_expense_categories(id, name, category_type)
      )
    `)
    .order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get single cost pool
router.get('/cost-pools/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_cost_pools')
    .select(`
      *,
      categories:v2_cost_pool_categories(
        id,
        expense_category:v2_expense_categories(id, name, category_type)
      )
    `)
    .eq('id', req.params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Cost pool not found' });
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data);
}));

// Create cost pool
router.post('/cost-pools', asyncHandler(async (req, res) => {
  const { name, description, allocation_method, category_ids } = req.body;

  if (!name) {
    throw new AppError('VALIDATION_FAILED', 'name is required');
  }

  // Create pool
  const { data: pool, error } = await supabase
    .from('v2_cost_pools')
    .insert({
      name,
      description,
      allocation_method: allocation_method || 'labor_hours'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Add category links if provided
  if (category_ids && category_ids.length > 0) {
    const links = category_ids.map(catId => ({
      cost_pool_id: pool.id,
      expense_category_id: catId
    }));

    await supabase.from('v2_cost_pool_categories').insert(links);
  }

  res.json(pool);
}));

// Update cost pool
router.patch('/cost-pools/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, allocation_method, is_active, category_ids } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (allocation_method !== undefined) updates.allocation_method = allocation_method;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from('v2_cost_pools')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Update category links if provided
  if (category_ids !== undefined) {
    // Remove existing links
    await supabase
      .from('v2_cost_pool_categories')
      .delete()
      .eq('cost_pool_id', id);

    // Add new links
    if (category_ids.length > 0) {
      const links = category_ids.map(catId => ({
        cost_pool_id: id,
        expense_category_id: catId
      }));
      await supabase.from('v2_cost_pool_categories').insert(links);
    }
  }

  res.json(data);
}));

// Delete cost pool
router.delete('/cost-pools/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('v2_cost_pools')
    .delete()
    .eq('id', req.params.id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// OVERHEAD RATES
// ============================================================

// Get current overhead rate
router.get('/current-rate', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_current_overhead_rate')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data || {
    period_id: null,
    period_name: 'No closed periods',
    current_overhead: 0,
    current_labor_hours: 0,
    current_rate_per_hour: 0,
    current_rate_percent: 0,
    rolling_avg_rate_per_hour: 0,
    rolling_avg_rate_percent: 0,
    rolling_periods_count: 0
  });
}));

// Get overhead rate history
router.get('/rate-history', asyncHandler(async (req, res) => {
  const { limit } = req.query;

  let query = supabase
    .from('v2_overhead_rates')
    .select(`
      *,
      period:v2_financial_periods(id, name, start_date, end_date)
    `)
    .is('cost_pool_id', null)
    .eq('is_final', true)
    .order('calculated_at', { ascending: false });

  if (limit) query = query.limit(parseInt(limit));

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Calculate overhead rate for a period (preview, not saved)
router.post('/calculate', asyncHandler(async (req, res) => {
  const { period_id } = req.body;

  if (!period_id) {
    throw new AppError('VALIDATION_FAILED', 'period_id is required');
  }

  const { data, error } = await supabase
    .rpc('calculate_period_overhead_rate', { p_period_id: period_id });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data[0] || {
    total_overhead: 0,
    total_labor_hours: 0,
    total_labor_cost: 0,
    rate_per_hour: 0,
    rate_percent: 0
  });
}));

// Get rolling average rate
router.get('/rolling-average', asyncHandler(async (req, res) => {
  const months = parseInt(req.query.months) || 12;

  const { data, error } = await supabase
    .rpc('calculate_rolling_overhead_rate', { p_months: months });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data[0] || {
    avg_rate_per_hour: 0,
    avg_rate_percent: 0,
    periods_included: 0
  });
}));

// ============================================================
// JOB ALLOCATIONS
// ============================================================

// Get allocations by job
router.get('/allocations/by-job/:jobId', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_job_overhead_allocations')
    .select(`
      *,
      period:v2_financial_periods(id, name, start_date, end_date)
    `)
    .eq('job_id', req.params.jobId)
    .eq('is_final', true)
    .is('cost_pool_id', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate totals
  const totalOverhead = data.reduce((sum, a) => sum + parseFloat(a.allocated_overhead || 0), 0);
  const totalHours = data.reduce((sum, a) => sum + parseFloat(a.job_labor_hours || 0), 0);

  res.json({
    allocations: data,
    totals: {
      total_overhead: totalOverhead,
      total_labor_hours: totalHours,
      allocation_count: data.length
    }
  });
}));

// Get allocations by period
router.get('/allocations/by-period/:periodId', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_job_overhead_allocations')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('period_id', req.params.periodId)
    .eq('is_final', true)
    .is('cost_pool_id', null)
    .order('allocated_overhead', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get job overhead summary
router.get('/job-summary', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_job_overhead_summary')
    .select('*')
    .order('total_allocated_overhead', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Preview job allocation for a period
router.post('/preview-allocation', asyncHandler(async (req, res) => {
  const { job_id, period_id } = req.body;

  if (!job_id || !period_id) {
    throw new AppError('VALIDATION_FAILED', 'job_id and period_id are required');
  }

  const { data, error } = await supabase
    .rpc('allocate_job_overhead', { p_job_id: job_id, p_period_id: period_id });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data[0] || {
    job_hours: 0,
    total_hours: 0,
    hours_percentage: 0,
    allocated_amount: 0
  });
}));

// Run allocation for a closed period
router.post('/run-allocation', asyncHandler(async (req, res) => {
  const { period_id } = req.body;

  if (!period_id) {
    throw new AppError('VALIDATION_FAILED', 'period_id is required');
  }

  // Verify period is closed
  const { data: period } = await supabase
    .from('v2_financial_periods')
    .select('status')
    .eq('id', period_id)
    .single();

  if (!period || period.status !== 'closed') {
    throw new AppError('VALIDATION_FAILED', 'Period must be closed to run allocation');
  }

  const { data, error } = await supabase
    .rpc('run_period_allocation', { p_period_id: period_id });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({
    success: true,
    jobs_allocated: data
  });
}));

// ============================================================
// DASHBOARD DATA
// ============================================================

// Get overhead dashboard data
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Current rate
  const { data: currentRate } = await supabase
    .from('v2_current_overhead_rate')
    .select('*')
    .single();

  // Rate history (last 12 periods)
  const { data: rateHistory } = await supabase
    .from('v2_overhead_rates')
    .select(`
      period_id,
      total_overhead,
      total_labor_hours,
      overhead_rate_per_hour,
      overhead_rate_percent,
      period:v2_financial_periods(name, end_date)
    `)
    .is('cost_pool_id', null)
    .eq('is_final', true)
    .order('calculated_at', { ascending: false })
    .limit(12);

  // Cost pool totals (from most recent closed period)
  const { data: poolTotals } = await supabase
    .from('v2_cost_pools')
    .select('id, name')
    .eq('is_active', true);

  // Top jobs by overhead
  const { data: topJobs } = await supabase
    .from('v2_job_overhead_summary')
    .select('*')
    .order('total_allocated_overhead', { ascending: false })
    .limit(10);

  res.json({
    current_rate: currentRate || {},
    rate_history: rateHistory || [],
    cost_pools: poolTotals || [],
    top_jobs: topJobs || []
  });
}));

// ============================================================
// SETTINGS
// ============================================================

// Get overhead settings
router.get('/settings', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_company_settings')
    .select('*')
    .like('key', 'overhead_%');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const settings = {};
  data.forEach(s => {
    let value = s.value;
    if (s.value_type === 'number') value = parseFloat(s.value);
    else if (s.value_type === 'boolean') value = s.value === 'true';
    settings[s.key] = value;
  });

  res.json(settings);
}));

// Update overhead setting
router.patch('/settings/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (!key.startsWith('overhead_')) {
    throw new AppError('VALIDATION_FAILED', 'Invalid overhead setting key');
  }

  const { data, error } = await supabase
    .from('v2_company_settings')
    .update({
      value: String(value),
      updated_at: new Date().toISOString()
    })
    .eq('key', key)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

module.exports = router;
