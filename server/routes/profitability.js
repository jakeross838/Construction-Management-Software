/**
 * Job Profitability Routes
 * Real-time profitability calculations and historical snapshots
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// PROFITABILITY OVERVIEW
// ============================================================

// Get current profitability for all active jobs
router.get('/summary', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_job_profitability_current')
    .select('*')
    .order('net_margin', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate totals
  const totals = data.reduce((acc, job) => ({
    total_contract: acc.total_contract + parseFloat(job.total_contract || 0),
    total_cost: acc.total_cost + parseFloat(job.total_cost || 0),
    gross_profit: acc.gross_profit + parseFloat(job.gross_profit || 0),
    net_profit: acc.net_profit + parseFloat(job.net_profit || 0)
  }), { total_contract: 0, total_cost: 0, gross_profit: 0, net_profit: 0 });

  totals.avg_gross_margin = totals.total_contract > 0
    ? totals.gross_profit / totals.total_contract
    : 0;
  totals.avg_net_margin = totals.total_contract > 0
    ? totals.net_profit / totals.total_contract
    : 0;

  res.json({
    jobs: data,
    totals
  });
}));

// Get profitability ranking
router.get('/ranking', asyncHandler(async (req, res) => {
  const { sort_by } = req.query;

  const { data, error } = await supabase
    .from('v2_job_profitability_ranking')
    .select('*')
    .order(sort_by === 'profit' ? 'profit_rank' : 'margin_rank');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// SINGLE JOB PROFITABILITY
// ============================================================

// Get profitability for a specific job
router.get('/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get real-time profitability
  const { data: profitability, error } = await supabase
    .rpc('calculate_job_profitability', { p_job_id: jobId });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get job info
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('id, name, status, client_name, address')
    .eq('id', jobId)
    .single();

  // Get direct cost breakdown
  const { data: directCosts } = await supabase
    .rpc('get_job_direct_costs', { p_job_id: jobId });

  res.json({
    job,
    profitability: profitability?.[0] || {},
    direct_costs: directCosts?.[0] || {}
  });
}));

// Get budget vs actual by cost code for a job
router.get('/job/:jobId/budget-vs-actual', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await supabase
    .from('v2_job_budget_vs_actual')
    .select('*')
    .eq('job_id', jobId)
    .order('cost_code');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate totals
  const totals = data.reduce((acc, row) => ({
    budget: acc.budget + parseFloat(row.budget || 0),
    committed: acc.committed + parseFloat(row.committed || 0),
    actual: acc.actual + parseFloat(row.actual || 0),
    variance: acc.variance + parseFloat(row.variance || 0)
  }), { budget: 0, committed: 0, actual: 0, variance: 0 });

  res.json({
    cost_codes: data,
    totals
  });
}));

// ============================================================
// COST DETAILS
// ============================================================

// Get detailed costs for a job
router.get('/job/:jobId/costs', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { start_date, end_date } = req.query;

  // Get invoices by cost code
  const { data: invoices } = await supabase
    .from('v2_invoice_allocations')
    .select(`
      amount,
      cost_code:v2_cost_codes(id, code, name, category),
      invoice:v2_invoices(id, invoice_number, invoice_date, vendor:v2_vendors(name))
    `)
    .eq('job_id', jobId);

  // Get labor by cost code
  const { data: labor } = await supabase
    .from('v2_timesheets')
    .select(`
      hours,
      overtime_hours,
      base_cost,
      burden_amount,
      total_cost,
      work_date,
      cost_code:v2_cost_codes(id, code, name),
      employee:v2_employees(id, first_name, last_name)
    `)
    .eq('job_id', jobId)
    .eq('status', 'approved')
    .is('deleted_at', null);

  // Get PO commitments
  const { data: pos } = await supabase
    .from('v2_po_line_items')
    .select(`
      amount,
      invoiced_amount,
      cost_code:v2_cost_codes(id, code, name),
      po:v2_purchase_orders(id, po_number, vendor:v2_vendors(name))
    `)
    .eq('po.job_id', jobId);

  res.json({
    invoices: invoices || [],
    labor: labor || [],
    purchase_orders: pos || []
  });
}));

// ============================================================
// SNAPSHOTS
// ============================================================

// Get profitability history for a job
router.get('/job/:jobId/history', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await supabase
    .from('v2_job_profitability_snapshots')
    .select(`
      *,
      period:v2_financial_periods(id, name, start_date, end_date)
    `)
    .eq('job_id', jobId)
    .order('snapshot_date', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Create snapshot for a job
router.post('/job/:jobId/snapshot', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { period_id } = req.body;

  if (!period_id) {
    throw new AppError('VALIDATION_FAILED', 'period_id is required');
  }

  const { data, error } = await supabase
    .rpc('create_profitability_snapshot', {
      p_job_id: jobId,
      p_period_id: period_id
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ snapshot_id: data, success: true });
}));

// Batch create snapshots for all active jobs
router.post('/snapshots/batch', asyncHandler(async (req, res) => {
  const { period_id } = req.body;

  if (!period_id) {
    throw new AppError('VALIDATION_FAILED', 'period_id is required');
  }

  // Get all active jobs
  const { data: jobs } = await supabase
    .from('v2_jobs')
    .select('id')
    .eq('status', 'active')
    .is('deleted_at', null);

  if (!jobs || jobs.length === 0) {
    return res.json({ created: 0 });
  }

  // Create snapshots for each job
  let created = 0;
  for (const job of jobs) {
    try {
      await supabase.rpc('create_profitability_snapshot', {
        p_job_id: job.id,
        p_period_id: period_id
      });
      created++;
    } catch (err) {
      console.error(`Failed to create snapshot for job ${job.id}:`, err);
    }
  }

  res.json({ created, total: jobs.length });
}));

// ============================================================
// COMPARISONS
// ============================================================

// Compare multiple jobs
router.post('/compare', asyncHandler(async (req, res) => {
  const { job_ids } = req.body;

  if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'job_ids array is required');
  }

  const comparisons = [];

  for (const jobId of job_ids) {
    const { data: profitability } = await supabase
      .rpc('calculate_job_profitability', { p_job_id: jobId });

    const { data: job } = await supabase
      .from('v2_jobs')
      .select('id, name, status')
      .eq('id', jobId)
      .single();

    if (job && profitability) {
      comparisons.push({
        job,
        profitability: profitability[0]
      });
    }
  }

  // Sort by net margin
  comparisons.sort((a, b) =>
    (b.profitability?.net_margin || 0) - (a.profitability?.net_margin || 0)
  );

  res.json(comparisons);
}));

// ============================================================
// DASHBOARD DATA
// ============================================================

// Get profitability dashboard data
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get summary
  const { data: jobs } = await supabase
    .from('v2_job_profitability_current')
    .select('*')
    .order('net_margin', { ascending: false });

  // Calculate metrics
  const totalContract = jobs?.reduce((sum, j) => sum + parseFloat(j.total_contract || 0), 0) || 0;
  const totalCost = jobs?.reduce((sum, j) => sum + parseFloat(j.total_cost || 0), 0) || 0;
  const grossProfit = jobs?.reduce((sum, j) => sum + parseFloat(j.gross_profit || 0), 0) || 0;
  const netProfit = jobs?.reduce((sum, j) => sum + parseFloat(j.net_profit || 0), 0) || 0;

  // Top and bottom performers
  const topPerformers = jobs?.slice(0, 5) || [];
  const bottomPerformers = jobs?.slice(-5).reverse() || [];

  // Jobs with negative margin
  const unprofitableJobs = jobs?.filter(j => parseFloat(j.net_margin || 0) < 0) || [];

  res.json({
    summary: {
      job_count: jobs?.length || 0,
      total_contract: totalContract,
      total_cost: totalCost,
      gross_profit: grossProfit,
      net_profit: netProfit,
      avg_gross_margin: totalContract > 0 ? grossProfit / totalContract : 0,
      avg_net_margin: totalContract > 0 ? netProfit / totalContract : 0
    },
    top_performers: topPerformers,
    bottom_performers: bottomPerformers,
    unprofitable_jobs: unprofitableJobs,
    all_jobs: jobs || []
  });
}));

module.exports = router;
