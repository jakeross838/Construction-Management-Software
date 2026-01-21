/**
 * Company P&L Routes
 * Company-wide profit and loss dashboard
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// DASHBOARD
// ============================================================

// Get P&L dashboard data
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  // Get YTD P&L
  const { data: ytd, error: ytdError } = await supabase
    .rpc('get_ytd_pnl', { p_year: parseInt(year) });

  if (ytdError) throw new AppError('DATABASE_ERROR', ytdError.message);

  // Get monthly trend
  const { data: trend, error: trendError } = await supabase
    .from('v2_pnl_monthly_trend')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(12);

  if (trendError) throw new AppError('DATABASE_ERROR', trendError.message);

  // Get current period P&L
  const { data: currentPeriod } = await supabase
    .from('v2_financial_periods')
    .select('id, name, start_date, end_date')
    .eq('status', 'open')
    .single();

  let currentPnl = null;
  if (currentPeriod) {
    const { data } = await supabase
      .rpc('calculate_company_pnl', {
        p_start_date: currentPeriod.start_date,
        p_end_date: currentPeriod.end_date
      });
    currentPnl = data?.[0];
  }

  // Get job breakdown for current period
  const { data: jobBreakdown } = await supabase
    .from('v2_job_profitability_current')
    .select('job_id, job_name, total_contract, total_cost, gross_profit, net_profit, net_margin')
    .order('net_profit', { ascending: false })
    .limit(10);

  res.json({
    ytd: ytd?.[0] || {},
    current_period: currentPeriod,
    current_pnl: currentPnl,
    monthly_trend: trend || [],
    top_jobs: jobBreakdown || []
  });
}));

// ============================================================
// P&L CALCULATIONS
// ============================================================

// Calculate P&L for a date range
router.get('/calculate', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    throw new AppError('VALIDATION_FAILED', 'start_date and end_date are required');
  }

  const { data, error } = await supabase
    .rpc('calculate_company_pnl', {
      p_start_date: start_date,
      p_end_date: end_date
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data?.[0] || {});
}));

// Get YTD P&L
router.get('/ytd', asyncHandler(async (req, res) => {
  const { year = new Date().getFullYear() } = req.query;

  const { data, error } = await supabase
    .rpc('get_ytd_pnl', { p_year: parseInt(year) });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data?.[0] || {});
}));

// ============================================================
// SNAPSHOTS
// ============================================================

// Get all P&L snapshots
router.get('/snapshots', asyncHandler(async (req, res) => {
  const { year } = req.query;

  let query = supabase
    .from('v2_pnl_snapshots')
    .select(`
      *,
      period:v2_financial_periods(id, name, start_date, end_date)
    `)
    .order('snapshot_date', { ascending: false });

  if (year) {
    query = query.gte('snapshot_date', `${year}-01-01`)
                 .lte('snapshot_date', `${year}-12-31`);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get snapshot for a specific period
router.get('/period/:periodId', asyncHandler(async (req, res) => {
  const { periodId } = req.params;

  const { data, error } = await supabase
    .from('v2_pnl_snapshots')
    .select(`
      *,
      period:v2_financial_periods(id, name, start_date, end_date)
    `)
    .eq('period_id', periodId)
    .single();

  if (error && error.code !== 'PGRST116') throw new AppError('DATABASE_ERROR', error.message);

  // If no snapshot, calculate live
  if (!data) {
    const { data: period } = await supabase
      .from('v2_financial_periods')
      .select('*')
      .eq('id', periodId)
      .single();

    if (!period) {
      throw new AppError('NOT_FOUND', 'Period not found');
    }

    const { data: calculated } = await supabase
      .rpc('calculate_company_pnl', {
        p_start_date: period.start_date,
        p_end_date: period.end_date
      });

    res.json({
      ...calculated?.[0],
      period,
      is_snapshot: false
    });
    return;
  }

  res.json({ ...data, is_snapshot: true });
}));

// Create P&L snapshot for a period
router.post('/snapshot', asyncHandler(async (req, res) => {
  const { period_id, created_by } = req.body;

  if (!period_id) {
    throw new AppError('VALIDATION_FAILED', 'period_id is required');
  }

  const { data, error } = await supabase
    .rpc('create_pnl_snapshot', {
      p_period_id: period_id,
      p_created_by: created_by || null
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ snapshot_id: data, success: true });
}));

// ============================================================
// MONTHLY TREND
// ============================================================

// Get monthly P&L trend
router.get('/trend', asyncHandler(async (req, res) => {
  const { months = 12 } = req.query;

  const { data, error } = await supabase
    .from('v2_pnl_monthly_trend')
    .select('*')
    .order('start_date', { ascending: false })
    .limit(parseInt(months));

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data?.reverse() || []);
}));

// ============================================================
// BREAKDOWN REPORTS
// ============================================================

// Revenue breakdown by job
router.get('/revenue/by-job', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  // Get draws grouped by job
  let query = supabase
    .from('v2_draws')
    .select(`
      total_amount,
      job:v2_jobs(id, name, client_name)
    `)
    .in('status', ['submitted', 'funded']);

  if (start_date) query = query.gte('submitted_at', start_date);
  if (end_date) query = query.lte('submitted_at', end_date);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Group by job
  const byJob = {};
  data?.forEach(d => {
    const jobId = d.job?.id;
    if (!jobId) return;

    if (!byJob[jobId]) {
      byJob[jobId] = {
        job_id: jobId,
        job_name: d.job.name,
        client_name: d.job.client_name,
        total_revenue: 0
      };
    }
    byJob[jobId].total_revenue += parseFloat(d.total_amount || 0);
  });

  const result = Object.values(byJob).sort((a, b) => b.total_revenue - a.total_revenue);
  res.json(result);
}));

// Cost breakdown by category
router.get('/costs/by-category', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  // Get invoice allocations grouped by cost code category
  let query = supabase
    .from('v2_invoice_allocations')
    .select(`
      amount,
      cost_code:v2_cost_codes(category),
      invoice:v2_invoices(invoice_date, status)
    `)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  const { data: invoiceData, error: invError } = await query;
  if (invError) throw new AppError('DATABASE_ERROR', invError.message);

  // Get labor costs
  let laborQuery = supabase
    .from('v2_timesheets')
    .select('total_cost, work_date')
    .eq('status', 'approved')
    .is('deleted_at', null);

  if (start_date) laborQuery = laborQuery.gte('work_date', start_date);
  if (end_date) laborQuery = laborQuery.lte('work_date', end_date);

  const { data: laborData, error: laborError } = await laborQuery;
  if (laborError) throw new AppError('DATABASE_ERROR', laborError.message);

  const categories = {
    'Materials': 0,
    'Supplies': 0,
    'Labor': 0,
    'Subcontractor': 0,
    'Equipment': 0,
    'Other': 0
  };

  // Filter and sum invoice allocations
  invoiceData?.forEach(ia => {
    if (start_date && ia.invoice?.invoice_date < start_date) return;
    if (end_date && ia.invoice?.invoice_date > end_date) return;

    const category = ia.cost_code?.category || 'Other';
    if (categories[category] !== undefined) {
      categories[category] += parseFloat(ia.amount || 0);
    } else {
      categories['Other'] += parseFloat(ia.amount || 0);
    }
  });

  // Add labor
  laborData?.forEach(t => {
    categories['Labor'] += parseFloat(t.total_cost || 0);
  });

  const result = Object.entries(categories).map(([category, amount]) => ({
    category,
    amount,
    percent: 0
  }));

  const total = result.reduce((sum, r) => sum + r.amount, 0);
  result.forEach(r => {
    r.percent = total > 0 ? r.amount / total : 0;
  });

  res.json(result.sort((a, b) => b.amount - a.amount));
}));

// Margin analysis by job
router.get('/margins/by-job', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_job_profitability_current')
    .select('*')
    .order('net_margin', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate averages
  const avgGrossMargin = data?.length > 0
    ? data.reduce((sum, j) => sum + parseFloat(j.gross_margin || 0), 0) / data.length
    : 0;

  const avgNetMargin = data?.length > 0
    ? data.reduce((sum, j) => sum + parseFloat(j.net_margin || 0), 0) / data.length
    : 0;

  res.json({
    jobs: data || [],
    avg_gross_margin: avgGrossMargin,
    avg_net_margin: avgNetMargin
  });
}));

// ============================================================
// COMPARISON
// ============================================================

// Compare periods
router.get('/compare', asyncHandler(async (req, res) => {
  const { period1_id, period2_id } = req.query;

  if (!period1_id || !period2_id) {
    throw new AppError('VALIDATION_FAILED', 'period1_id and period2_id are required');
  }

  const { data: p1, error: e1 } = await supabase
    .from('v2_pnl_snapshots')
    .select('*, period:v2_financial_periods(name)')
    .eq('period_id', period1_id)
    .single();

  const { data: p2, error: e2 } = await supabase
    .from('v2_pnl_snapshots')
    .select('*, period:v2_financial_periods(name)')
    .eq('period_id', period2_id)
    .single();

  if (e1 || e2) throw new AppError('DATABASE_ERROR', e1?.message || e2?.message);

  // Calculate variances
  const variances = {
    revenue: (p1?.total_revenue || 0) - (p2?.total_revenue || 0),
    cogs: (p1?.total_cogs || 0) - (p2?.total_cogs || 0),
    gross_profit: (p1?.gross_profit || 0) - (p2?.gross_profit || 0),
    operating_income: (p1?.operating_income || 0) - (p2?.operating_income || 0),
    net_income: (p1?.net_income || 0) - (p2?.net_income || 0)
  };

  res.json({
    period1: p1,
    period2: p2,
    variances
  });
}));

module.exports = router;
