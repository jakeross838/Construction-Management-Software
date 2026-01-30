/**
 * Cash Flow & Forecasting Routes
 * Track cash inflows, outflows, and project future cash position
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============================================================
// DASHBOARD
// ============================================================

// Get cash flow dashboard
router.get('/dashboard', asyncHandler(async (req, res) => {
  // Get current cash position
  const { data: position, error: posError } = await supabase
    .from('v2_cash_position_current')
    .select('*')
    .single();

  if (posError && posError.code !== 'PGRST116') throw new AppError('DATABASE_ERROR', posError.message);

  // Get upcoming payments (next 30 days)
  const { data: payments, error: payError } = await supabase
    .from('v2_upcoming_payments')
    .select('*')
    .limit(20);

  if (payError) throw new AppError('DATABASE_ERROR', payError.message);

  // Get expected receipts
  const { data: receipts, error: recError } = await supabase
    .from('v2_expected_receipts')
    .select('*')
    .limit(20);

  if (recError) throw new AppError('DATABASE_ERROR', recError.message);

  // Get weekly forecast
  const { data: forecast, error: fcError } = await supabase
    .from('v2_cash_flow_forecasts')
    .select('*')
    .eq('period_type', 'weekly')
    .gte('period_start', new Date().toISOString().split('T')[0])
    .order('period_start')
    .limit(12);

  if (fcError) throw new AppError('DATABASE_ERROR', fcError.message);

  // Calculate summary metrics
  const summary = {
    total_receivables: parseFloat(position?.total_receivables || 0),
    total_payables: parseFloat(position?.total_payables || 0),
    overdue_receivables: parseFloat(position?.overdue_receivables || 0),
    overdue_payables: parseFloat(position?.overdue_payables || 0),
    net_position: parseFloat(position?.total_receivables || 0) - parseFloat(position?.total_payables || 0),
    payments_due_7_days: payments?.filter(p => p.urgency === 'due_soon').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0,
    payments_overdue: payments?.filter(p => p.urgency === 'overdue').reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0
  };

  res.json({
    summary,
    position: position || {},
    upcoming_payments: payments || [],
    expected_receipts: receipts || [],
    weekly_forecast: forecast || []
  });
}));

// ============================================================
// CASH POSITION
// ============================================================

// Get current cash position
router.get('/position', asyncHandler(async (req, res) => {
  const { as_of_date = new Date().toISOString().split('T')[0] } = req.query;

  const { data, error } = await supabase
    .rpc('get_cash_position', { p_as_of_date: as_of_date });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data?.[0] || {});
}));

// ============================================================
// FORECASTING
// ============================================================

// Get weekly forecast
router.get('/forecast/weekly', asyncHandler(async (req, res) => {
  const { weeks = 12, start_date } = req.query;

  const startDate = start_date || new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('v2_cash_flow_forecasts')
    .select('*')
    .eq('period_type', 'weekly')
    .gte('period_start', startDate)
    .order('period_start')
    .limit(parseInt(weeks));

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Generate new weekly forecast
router.post('/forecast/generate', asyncHandler(async (req, res) => {
  const {
    start_date = getNextMonday(),
    weeks = 12,
    opening_balance = 0
  } = req.body;

  const { data, error } = await supabase
    .rpc('create_weekly_forecast', {
      p_start_date: start_date,
      p_weeks: parseInt(weeks),
      p_opening_balance: parseFloat(opening_balance)
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ forecasts: data, count: data?.length || 0 });
}));

// Calculate projection for date range
router.get('/projection', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    throw new AppError('VALIDATION_FAILED', 'start_date and end_date are required');
  }

  const { data, error } = await supabase
    .rpc('calculate_cash_flow_projection', {
      p_start_date: start_date,
      p_end_date: end_date
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data?.[0] || {});
}));

// ============================================================
// CASH FLOW ENTRIES
// ============================================================

// Get cash flow entries
router.get('/entries', asyncHandler(async (req, res) => {
  const { start_date, end_date, type, category, job_id } = req.query;

  let query = supabase
    .from('v2_cash_flow_entries')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .order('entry_date', { ascending: false });

  if (start_date) query = query.gte('entry_date', start_date);
  if (end_date) query = query.lte('entry_date', end_date);
  if (type) query = query.eq('entry_type', type);
  if (category) query = query.eq('category', category);
  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query.limit(100);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Create cash flow entry
router.post('/entries', asyncHandler(async (req, res) => {
  const {
    entry_date,
    entry_type,
    category,
    subcategory,
    amount,
    job_id,
    vendor_id,
    description,
    reference_number,
    is_projected = false,
    is_recurring = false,
    recurrence_pattern,
    status = 'pending'
  } = req.body;

  if (!entry_date || !entry_type || !category || !amount) {
    throw new AppError('VALIDATION_FAILED', 'entry_date, entry_type, category, and amount are required');
  }

  const { data, error } = await supabase
    .from('v2_cash_flow_entries')
    .insert({
      entry_date,
      entry_type,
      category,
      subcategory,
      amount,
      job_id,
      vendor_id,
      description,
      reference_number,
      is_projected,
      is_recurring,
      recurrence_pattern,
      status
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Update entry status
router.patch('/entries/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, actual_date } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (actual_date) updates.actual_date = actual_date;

  const { data, error } = await supabase
    .from('v2_cash_flow_entries')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// PAYMENTS & RECEIPTS
// ============================================================

// Get upcoming payments
router.get('/payments/upcoming', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + parseInt(days));

  const { data, error } = await supabase
    .from('v2_upcoming_payments')
    .select('*');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Group by urgency
  const grouped = {
    overdue: data?.filter(p => p.urgency === 'overdue') || [],
    due_soon: data?.filter(p => p.urgency === 'due_soon') || [],
    upcoming: data?.filter(p => p.urgency === 'upcoming') || []
  };

  const totals = {
    overdue: grouped.overdue.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    due_soon: grouped.due_soon.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    upcoming: grouped.upcoming.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0),
    total: data?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0
  };

  res.json({ payments: grouped, totals });
}));

// Get expected receipts
router.get('/receipts/expected', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_expected_receipts')
    .select('*');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const total = data?.reduce((sum, r) => sum + parseFloat(r.total_amount || 0), 0) || 0;

  res.json({
    receipts: data || [],
    total
  });
}));

// ============================================================
// REPORTS
// ============================================================

// Cash flow by job
router.get('/reports/by-job', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.query;

  // Get draws (inflows) by job
  let drawQuery = supabase
    .from('v2_draws')
    .select('total_amount, job:v2_jobs(id, name)')
    .eq('status', 'funded');

  if (start_date) drawQuery = drawQuery.gte('funded_at', start_date);
  if (end_date) drawQuery = drawQuery.lte('funded_at', end_date);

  const { data: draws } = await drawQuery;

  // Get invoice payments (outflows) by job
  let payQuery = supabase
    .from('v2_invoices')
    .select('amount, job:v2_jobs(id, name)')
    .eq('status', 'paid');

  if (start_date) payQuery = payQuery.gte('updated_at', start_date);
  if (end_date) payQuery = payQuery.lte('updated_at', end_date);

  const { data: payments } = await payQuery;

  // Aggregate by job
  const byJob = {};

  draws?.forEach(d => {
    const jobId = d.job?.id;
    if (!jobId) return;
    if (!byJob[jobId]) {
      byJob[jobId] = { job_id: jobId, job_name: d.job.name, inflows: 0, outflows: 0 };
    }
    byJob[jobId].inflows += parseFloat(d.total_amount || 0);
  });

  payments?.forEach(p => {
    const jobId = p.job?.id;
    if (!jobId) return;
    if (!byJob[jobId]) {
      byJob[jobId] = { job_id: jobId, job_name: p.job.name, inflows: 0, outflows: 0 };
    }
    byJob[jobId].outflows += parseFloat(p.amount || 0);
  });

  const result = Object.values(byJob).map(j => ({
    ...j,
    net: j.inflows - j.outflows
  })).sort((a, b) => b.net - a.net);

  res.json(result);
}));

// Cash flow trend
router.get('/reports/trend', asyncHandler(async (req, res) => {
  const { months = 6 } = req.query;

  const { data, error } = await supabase
    .from('v2_cash_flow_forecasts')
    .select('*')
    .eq('period_type', 'weekly')
    .order('period_start', { ascending: false })
    .limit(parseInt(months) * 4);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data?.reverse() || []);
}));

// ============================================================
// UTILITIES
// ============================================================

function getNextMonday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + daysUntilMonday);
  return nextMonday.toISOString().split('T')[0];
}

module.exports = router;
