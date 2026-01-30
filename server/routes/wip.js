/**
 * WIP (Work-in-Progress) Schedule Routes
 * Track project progress, billings vs costs, and revenue recognition
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============================================================
// WIP OVERVIEW
// ============================================================

// Get current WIP for all active jobs
router.get('/current', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_wip_current')
    .select('*')
    .order('job_name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get WIP summary totals
router.get('/summary', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_wip_summary')
    .select('*')
    .single();

  if (error && error.code !== 'PGRST116') throw new AppError('DATABASE_ERROR', error.message);

  // Get job count
  const { count } = await supabase
    .from('v2_jobs')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active')
    .is('deleted_at', null);

  res.json({
    ...data,
    active_job_count: count || 0
  });
}));

// Get WIP dashboard data
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get current WIP for all jobs
  const { data: jobs, error } = await supabase
    .from('v2_wip_current')
    .select('*')
    .order('percent_complete', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate summary metrics
  const summary = {
    total_revised_contract: 0,
    total_earned_revenue: 0,
    total_billed: 0,
    total_cost_to_date: 0,
    total_overbilling: 0,
    total_underbilling: 0,
    total_projected_profit: 0,
    job_count: jobs?.length || 0,
    overbilled_jobs: [],
    underbilled_jobs: [],
    at_risk_jobs: []
  };

  jobs?.forEach(job => {
    summary.total_revised_contract += parseFloat(job.revised_contract || 0);
    summary.total_earned_revenue += parseFloat(job.earned_revenue || 0);
    summary.total_billed += parseFloat(job.billed_to_date || 0);
    summary.total_cost_to_date += parseFloat(job.cost_to_date || 0);
    summary.total_overbilling += parseFloat(job.overbilling || 0);
    summary.total_underbilling += parseFloat(job.underbilling || 0);
    summary.total_projected_profit += parseFloat(job.projected_final_profit || 0);

    if (parseFloat(job.overbilling || 0) > 0) {
      summary.overbilled_jobs.push(job);
    }
    if (parseFloat(job.underbilling || 0) > 0) {
      summary.underbilled_jobs.push(job);
    }
    // At risk: projected margin < 5% or negative
    if (parseFloat(job.projected_margin || 0) < 0.05) {
      summary.at_risk_jobs.push(job);
    }
  });

  summary.net_wip_position = summary.total_overbilling - summary.total_underbilling;
  summary.avg_projected_margin = summary.total_revised_contract > 0
    ? summary.total_projected_profit / summary.total_revised_contract
    : 0;

  res.json({
    summary,
    jobs: jobs || []
  });
}));

// ============================================================
// SINGLE JOB WIP
// ============================================================

// Get WIP for a specific job
router.get('/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get real-time WIP calculation
  const { data: wip, error } = await supabase
    .rpc('calculate_job_wip', { p_job_id: jobId });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get job info
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('id, name, status, client_name, contract_amount, address')
    .eq('id', jobId)
    .single();

  // Get estimate history
  const { data: estimates } = await supabase
    .from('v2_job_estimates')
    .select('*')
    .eq('job_id', jobId)
    .order('effective_date', { ascending: false });

  res.json({
    job,
    wip: wip?.[0] || {},
    estimates: estimates || []
  });
}));

// Get WIP history for a job
router.get('/job/:jobId/history', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await supabase
    .from('v2_wip_snapshots')
    .select(`
      *,
      period:v2_financial_periods(id, name, start_date, end_date)
    `)
    .eq('job_id', jobId)
    .order('snapshot_date', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// JOB ESTIMATES
// ============================================================

// Get estimates for a job
router.get('/job/:jobId/estimates', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await supabase
    .from('v2_job_estimates')
    .select('*')
    .eq('job_id', jobId)
    .order('effective_date', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Create/update job estimate
router.post('/job/:jobId/estimate', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const {
    estimate_type = 'revised',
    total_estimated_cost,
    labor_cost = 0,
    material_cost = 0,
    subcontractor_cost = 0,
    equipment_cost = 0,
    overhead_cost = 0,
    other_cost = 0,
    target_margin,
    notes,
    effective_date = new Date().toISOString().split('T')[0]
  } = req.body;

  // Calculate estimated profit
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('contract_amount')
    .eq('id', jobId)
    .single();

  const contract = parseFloat(job?.contract_amount || 0);
  const estCost = parseFloat(total_estimated_cost || 0);
  const estProfit = contract - estCost;

  const { data, error } = await supabase
    .from('v2_job_estimates')
    .insert({
      job_id: jobId,
      estimate_type,
      total_estimated_cost: estCost,
      labor_cost,
      material_cost,
      subcontractor_cost,
      equipment_cost,
      overhead_cost,
      other_cost,
      estimated_profit: estProfit,
      target_margin: target_margin || (contract > 0 ? estProfit / contract : 0),
      notes,
      effective_date
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// SNAPSHOTS
// ============================================================

// Create WIP snapshot for a job
router.post('/job/:jobId/snapshot', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { period_id, created_by } = req.body;

  if (!period_id) {
    throw new AppError('VALIDATION_FAILED', 'period_id is required');
  }

  const { data, error } = await supabase
    .rpc('create_wip_snapshot', {
      p_job_id: jobId,
      p_period_id: period_id,
      p_created_by: created_by || null
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ snapshot_id: data, success: true });
}));

// Batch create WIP snapshots for all active jobs
router.post('/snapshots/batch', asyncHandler(async (req, res) => {
  const { period_id, created_by } = req.body;

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
    return res.json({ created: 0, total: 0 });
  }

  // Create snapshots for each job
  let created = 0;
  const errors = [];

  for (const job of jobs) {
    try {
      await supabase.rpc('create_wip_snapshot', {
        p_job_id: job.id,
        p_period_id: period_id,
        p_created_by: created_by || null
      });
      created++;
    } catch (err) {
      errors.push({ job_id: job.id, error: err.message });
    }
  }

  res.json({ created, total: jobs.length, errors: errors.length > 0 ? errors : undefined });
}));

// Get snapshots for a period
router.get('/period/:periodId', asyncHandler(async (req, res) => {
  const { periodId } = req.params;

  const { data, error } = await supabase
    .from('v2_wip_snapshots')
    .select(`
      *,
      job:v2_jobs(id, name, client_name, status)
    `)
    .eq('period_id', periodId)
    .order('job(name)');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate period totals
  const totals = data?.reduce((acc, s) => ({
    total_revised_contract: acc.total_revised_contract + parseFloat(s.revised_contract || 0),
    total_earned_revenue: acc.total_earned_revenue + parseFloat(s.earned_revenue || 0),
    total_billed: acc.total_billed + parseFloat(s.billed_to_date || 0),
    total_cost_to_date: acc.total_cost_to_date + parseFloat(s.cost_to_date || 0),
    total_overbilling: acc.total_overbilling + parseFloat(s.overbilling || 0),
    total_underbilling: acc.total_underbilling + parseFloat(s.underbilling || 0),
    total_projected_profit: acc.total_projected_profit + parseFloat(s.projected_final_profit || 0)
  }), {
    total_revised_contract: 0,
    total_earned_revenue: 0,
    total_billed: 0,
    total_cost_to_date: 0,
    total_overbilling: 0,
    total_underbilling: 0,
    total_projected_profit: 0
  });

  res.json({
    snapshots: data || [],
    totals
  });
}));

// ============================================================
// REPORTS
// ============================================================

// WIP aging report
router.get('/reports/aging', asyncHandler(async (req, res) => {
  const { data: jobs, error } = await supabase
    .from('v2_wip_current')
    .select('*')
    .order('percent_complete');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Bucket by percent complete
  const buckets = {
    '0-25%': { jobs: [], total_contract: 0, total_cost: 0 },
    '26-50%': { jobs: [], total_contract: 0, total_cost: 0 },
    '51-75%': { jobs: [], total_contract: 0, total_cost: 0 },
    '76-99%': { jobs: [], total_contract: 0, total_cost: 0 },
    '100%': { jobs: [], total_contract: 0, total_cost: 0 }
  };

  jobs?.forEach(job => {
    const pct = parseFloat(job.percent_complete || 0);
    let bucket;

    if (pct >= 100) bucket = '100%';
    else if (pct >= 76) bucket = '76-99%';
    else if (pct >= 51) bucket = '51-75%';
    else if (pct >= 26) bucket = '26-50%';
    else bucket = '0-25%';

    buckets[bucket].jobs.push(job);
    buckets[bucket].total_contract += parseFloat(job.revised_contract || 0);
    buckets[bucket].total_cost += parseFloat(job.cost_to_date || 0);
  });

  res.json(buckets);
}));

// Over/Under billing report
router.get('/reports/billing', asyncHandler(async (req, res) => {
  const { data: jobs, error } = await supabase
    .from('v2_wip_current')
    .select('*');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const overbilled = jobs?.filter(j => parseFloat(j.overbilling || 0) > 0)
    .sort((a, b) => parseFloat(b.overbilling) - parseFloat(a.overbilling)) || [];

  const underbilled = jobs?.filter(j => parseFloat(j.underbilling || 0) > 0)
    .sort((a, b) => parseFloat(b.underbilling) - parseFloat(a.underbilling)) || [];

  const balanced = jobs?.filter(j =>
    parseFloat(j.overbilling || 0) === 0 && parseFloat(j.underbilling || 0) === 0
  ) || [];

  res.json({
    overbilled,
    underbilled,
    balanced,
    summary: {
      total_overbilling: overbilled.reduce((sum, j) => sum + parseFloat(j.overbilling || 0), 0),
      total_underbilling: underbilled.reduce((sum, j) => sum + parseFloat(j.underbilling || 0), 0),
      overbilled_count: overbilled.length,
      underbilled_count: underbilled.length,
      balanced_count: balanced.length
    }
  });
}));

// Profit fade report
router.get('/reports/profit-fade', asyncHandler(async (req, res) => {
  const { data: jobs, error } = await supabase
    .from('v2_wip_current')
    .select('*');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get original estimates for comparison
  const { data: estimates } = await supabase
    .from('v2_job_estimates')
    .select('job_id, total_estimated_cost, estimated_profit')
    .eq('estimate_type', 'original');

  const estimateMap = new Map();
  estimates?.forEach(e => estimateMap.set(e.job_id, e));

  // Calculate profit fade for each job
  const fadeReport = jobs?.map(job => {
    const origEstimate = estimateMap.get(job.job_id);
    const originalProfit = origEstimate?.estimated_profit ||
      (parseFloat(job.revised_contract) - parseFloat(job.estimated_cost || 0));
    const projectedProfit = parseFloat(job.projected_final_profit || 0);
    const profitFade = originalProfit - projectedProfit;
    const fadePercent = originalProfit !== 0 ? profitFade / Math.abs(originalProfit) : 0;

    return {
      ...job,
      original_profit: originalProfit,
      profit_fade: profitFade,
      fade_percent: fadePercent
    };
  }).sort((a, b) => b.profit_fade - a.profit_fade) || [];

  // Jobs losing profit
  const fadingJobs = fadeReport.filter(j => j.profit_fade > 0);
  // Jobs gaining profit
  const improvingJobs = fadeReport.filter(j => j.profit_fade < 0);

  res.json({
    all_jobs: fadeReport,
    fading_jobs: fadingJobs,
    improving_jobs: improvingJobs,
    summary: {
      total_profit_fade: fadingJobs.reduce((sum, j) => sum + j.profit_fade, 0),
      total_profit_gain: Math.abs(improvingJobs.reduce((sum, j) => sum + j.profit_fade, 0)),
      fading_count: fadingJobs.length,
      improving_count: improvingJobs.length
    }
  });
}));

module.exports = router;
