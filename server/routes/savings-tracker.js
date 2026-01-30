/**
 * Savings Tracker Routes
 * API endpoints for tracking historical savings from optimized orders
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============================================================
// SAVINGS SUMMARY
// ============================================================

/**
 * GET /api/savings/summary
 * Get overall savings summary
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();

  const startOfYear = `${targetYear}-01-01`;
  const endOfYear = `${targetYear}-12-31`;

  // Get YTD savings
  const { data: ytdData } = await supabase
    .from('v2_savings_log')
    .select('total_spent, baseline_cost, savings_amount')
    .gte('order_date', startOfYear)
    .lte('order_date', endOfYear);

  const ytdSavings = ytdData?.reduce((sum, s) => sum + parseFloat(s.savings_amount || 0), 0) || 0;
  const ytdSpent = ytdData?.reduce((sum, s) => sum + parseFloat(s.total_spent || 0), 0) || 0;
  const ytdBaseline = ytdData?.reduce((sum, s) => sum + parseFloat(s.baseline_cost || 0), 0) || 0;
  const ytdOrders = ytdData?.length || 0;

  // Get last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: last30Data } = await supabase
    .from('v2_savings_log')
    .select('savings_amount, total_spent')
    .gte('order_date', thirtyDaysAgo.toISOString().split('T')[0]);

  const last30Savings = last30Data?.reduce((sum, s) => sum + parseFloat(s.savings_amount || 0), 0) || 0;
  const last30Spent = last30Data?.reduce((sum, s) => sum + parseFloat(s.total_spent || 0), 0) || 0;

  // Get all-time totals
  const { data: allTimeData } = await supabase
    .from('v2_savings_log')
    .select('savings_amount, total_spent');

  const allTimeSavings = allTimeData?.reduce((sum, s) => sum + parseFloat(s.savings_amount || 0), 0) || 0;
  const allTimeSpent = allTimeData?.reduce((sum, s) => sum + parseFloat(s.total_spent || 0), 0) || 0;

  res.json({
    ytd: {
      savings_amount: ytdSavings,
      total_spent: ytdSpent,
      baseline_cost: ytdBaseline,
      savings_percent: ytdBaseline > 0 ? ((ytdSavings / ytdBaseline) * 100).toFixed(1) : 0,
      order_count: ytdOrders,
      year: targetYear
    },
    last_30_days: {
      savings_amount: last30Savings,
      total_spent: last30Spent,
      savings_percent: last30Spent > 0 ? ((last30Savings / (last30Spent + last30Savings)) * 100).toFixed(1) : 0
    },
    all_time: {
      savings_amount: allTimeSavings,
      total_spent: allTimeSpent,
      order_count: allTimeData?.length || 0
    }
  });
}));

/**
 * GET /api/savings/by-job
 * Get savings grouped by job
 */
router.get('/by-job', asyncHandler(async (req, res) => {
  const { year, limit = 20 } = req.query;

  let query = supabase
    .from('v2_savings_log')
    .select('job_id, total_spent, baseline_cost, savings_amount, job:v2_jobs(name)');

  if (year) {
    query = query
      .gte('order_date', `${year}-01-01`)
      .lte('order_date', `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  // Group by job
  const jobSavings = new Map();
  for (const entry of (data || [])) {
    const jobId = entry.job_id || 'unassigned';
    if (!jobSavings.has(jobId)) {
      jobSavings.set(jobId, {
        job_id: entry.job_id,
        job_name: entry.job?.name || 'Unassigned',
        total_spent: 0,
        baseline_cost: 0,
        savings_amount: 0,
        order_count: 0
      });
    }
    const job = jobSavings.get(jobId);
    job.total_spent += parseFloat(entry.total_spent || 0);
    job.baseline_cost += parseFloat(entry.baseline_cost || 0);
    job.savings_amount += parseFloat(entry.savings_amount || 0);
    job.order_count++;
  }

  // Sort by savings amount and limit
  const result = Array.from(jobSavings.values())
    .map(job => ({
      ...job,
      savings_percent: job.baseline_cost > 0
        ? ((job.savings_amount / job.baseline_cost) * 100).toFixed(1)
        : 0
    }))
    .sort((a, b) => b.savings_amount - a.savings_amount)
    .slice(0, parseInt(limit));

  res.json(result);
}));

/**
 * GET /api/savings/by-category
 * Get savings grouped by material category
 */
router.get('/by-category', asyncHandler(async (req, res) => {
  const { year } = req.query;

  let query = supabase
    .from('v2_savings_log')
    .select('savings_by_category, order_date');

  if (year) {
    query = query
      .gte('order_date', `${year}-01-01`)
      .lte('order_date', `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  // Aggregate by category
  const categorySavings = new Map();
  for (const entry of (data || [])) {
    const categories = entry.savings_by_category || {};
    for (const [category, values] of Object.entries(categories)) {
      if (!categorySavings.has(category)) {
        categorySavings.set(category, {
          category,
          total_spent: 0,
          baseline_cost: 0,
          savings_amount: 0
        });
      }
      const cat = categorySavings.get(category);
      cat.total_spent += parseFloat(values.spent || 0);
      cat.baseline_cost += parseFloat(values.baseline || 0);
      cat.savings_amount += parseFloat(values.savings || 0);
    }
  }

  const result = Array.from(categorySavings.values())
    .map(cat => ({
      ...cat,
      savings_percent: cat.baseline_cost > 0
        ? ((cat.savings_amount / cat.baseline_cost) * 100).toFixed(1)
        : 0
    }))
    .sort((a, b) => b.savings_amount - a.savings_amount);

  res.json(result);
}));

/**
 * GET /api/savings/by-period
 * Get savings over time (monthly)
 */
router.get('/by-period', asyncHandler(async (req, res) => {
  const { year, granularity = 'month' } = req.query;
  const targetYear = year || new Date().getFullYear();

  const { data, error } = await supabase
    .from('v2_savings_log')
    .select('order_date, total_spent, baseline_cost, savings_amount')
    .gte('order_date', `${targetYear}-01-01`)
    .lte('order_date', `${targetYear}-12-31`)
    .order('order_date');

  if (error) throw new AppError(error.message, 500);

  // Group by month
  const periods = new Map();
  for (const entry of (data || [])) {
    const date = new Date(entry.order_date);
    let periodKey;

    if (granularity === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      periodKey = weekStart.toISOString().split('T')[0];
    } else {
      periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    if (!periods.has(periodKey)) {
      periods.set(periodKey, {
        period: periodKey,
        total_spent: 0,
        baseline_cost: 0,
        savings_amount: 0,
        order_count: 0
      });
    }

    const period = periods.get(periodKey);
    period.total_spent += parseFloat(entry.total_spent || 0);
    period.baseline_cost += parseFloat(entry.baseline_cost || 0);
    period.savings_amount += parseFloat(entry.savings_amount || 0);
    period.order_count++;
  }

  // Fill in missing months
  if (granularity === 'month') {
    for (let month = 1; month <= 12; month++) {
      const key = `${targetYear}-${String(month).padStart(2, '0')}`;
      if (!periods.has(key)) {
        periods.set(key, {
          period: key,
          total_spent: 0,
          baseline_cost: 0,
          savings_amount: 0,
          order_count: 0
        });
      }
    }
  }

  const result = Array.from(periods.values())
    .map(p => ({
      ...p,
      savings_percent: p.baseline_cost > 0
        ? ((p.savings_amount / p.baseline_cost) * 100).toFixed(1)
        : 0
    }))
    .sort((a, b) => a.period.localeCompare(b.period));

  res.json(result);
}));

/**
 * GET /api/savings/recent
 * Get recent savings entries
 */
router.get('/recent', asyncHandler(async (req, res) => {
  const { limit = 20 } = req.query;

  const { data, error } = await supabase
    .from('v2_savings_log')
    .select('*, job:v2_jobs(name), optimized_order:v2_optimized_orders(name), po:v2_purchase_orders(po_number)')
    .order('order_date', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

// ============================================================
// LOG SAVINGS
// ============================================================

/**
 * POST /api/savings/log
 * Log a savings entry
 */
router.post('/log', asyncHandler(async (req, res) => {
  const {
    job_id,
    optimized_order_id,
    po_id,
    order_date,
    total_spent,
    baseline_cost,
    savings_by_category,
    savings_by_vendor,
    notes
  } = req.body;

  if (total_spent === undefined || baseline_cost === undefined) {
    throw new AppError('total_spent and baseline_cost are required', 400);
  }

  const savingsAmount = baseline_cost - total_spent;
  const savingsPercent = baseline_cost > 0 ? (savingsAmount / baseline_cost * 100) : 0;

  const { data, error } = await supabase
    .from('v2_savings_log')
    .insert({
      job_id,
      optimized_order_id,
      po_id,
      order_date: order_date || new Date().toISOString().split('T')[0],
      total_spent,
      baseline_cost,
      savings_amount: savingsAmount,
      savings_percent: savingsPercent.toFixed(2),
      savings_by_category,
      savings_by_vendor,
      notes
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

/**
 * DELETE /api/savings/log/:id
 * Delete a savings entry
 */
router.delete('/log/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_savings_log')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Savings entry deleted' });
}));

// ============================================================
// SAVINGS GOALS
// ============================================================

/**
 * GET /api/savings/goals
 * Get savings goals and progress
 */
router.get('/goals', asyncHandler(async (req, res) => {
  const currentYear = new Date().getFullYear();

  // Get YTD savings
  const { data: ytdData } = await supabase
    .from('v2_savings_log')
    .select('savings_amount, total_spent')
    .gte('order_date', `${currentYear}-01-01`);

  const ytdSavings = ytdData?.reduce((sum, s) => sum + parseFloat(s.savings_amount || 0), 0) || 0;
  const ytdSpent = ytdData?.reduce((sum, s) => sum + parseFloat(s.total_spent || 0), 0) || 0;

  // Example goals (could be stored in settings table)
  const goals = {
    annual_savings_target: 50000,
    savings_rate_target: 8, // 8%
    monthly_order_target: 10
  };

  const currentMonth = new Date().getMonth() + 1;
  const monthsRemaining = 12 - currentMonth;
  const projectedAnnualSavings = ytdSavings * (12 / currentMonth);

  res.json({
    goals,
    progress: {
      ytd_savings: ytdSavings,
      ytd_spent: ytdSpent,
      current_savings_rate: ytdSpent > 0 ? ((ytdSavings / (ytdSpent + ytdSavings)) * 100).toFixed(1) : 0,
      projected_annual: projectedAnnualSavings,
      on_track_for_goal: projectedAnnualSavings >= goals.annual_savings_target,
      savings_to_goal: goals.annual_savings_target - ytdSavings,
      required_monthly_savings: monthsRemaining > 0
        ? ((goals.annual_savings_target - ytdSavings) / monthsRemaining).toFixed(2)
        : 0
    }
  });
}));

module.exports = router;
