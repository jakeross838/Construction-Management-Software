/**
 * Business Dashboard Routes
 * Company-wide metrics, burn rate analysis, and profit projections
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============ JOB TIMELINE & CONTRACT HEALTH ============

// Get all jobs with timeline and contract health metrics
router.get('/jobs/health', asyncHandler(async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('v2_jobs')
    .select(`
      id, name, status, contract_amount, created_at,
      start_date, projected_end_date, actual_end_date
    `)
    .is('deleted_at', null);

  if (status) query = query.eq('status', status);

  const { data: jobs, error } = await query;
  if (error) throw new AppError(error.message, 500);

  // Get invoice totals per job
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('job_id, amount, status')
    .is('deleted_at', null)
    .in('job_id', jobs.map(j => j.id));

  // Get PO totals per job
  const { data: pos } = await supabase
    .from('v2_purchase_orders')
    .select('job_id, total_amount')
    .is('deleted_at', null)
    .in('job_id', jobs.map(j => j.id));

  // Get budget lines per job
  const { data: budgets } = await supabase
    .from('v2_budget_lines')
    .select('job_id, budgeted_amount, committed_amount, billed_amount, paid_amount')
    .in('job_id', jobs.map(j => j.id));

  // Calculate metrics for each job
  const jobsWithHealth = jobs.map(job => {
    const jobInvoices = (invoices || []).filter(i => i.job_id === job.id);
    const jobPOs = (pos || []).filter(p => p.job_id === job.id);
    const jobBudget = (budgets || []).filter(b => b.job_id === job.id);

    const totalInvoiced = jobInvoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totalPaid = jobInvoices
      .filter(i => i.status === 'paid')
      .reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const totalPOAmount = jobPOs.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
    const totalBudget = jobBudget.reduce((sum, b) => sum + parseFloat(b.budgeted_amount || 0), 0);
    const totalCommitted = jobBudget.reduce((sum, b) => sum + parseFloat(b.committed_amount || 0), 0);

    const contractAmount = parseFloat(job.contract_amount) || 0;
    const contractRemaining = contractAmount - totalInvoiced;
    const profit = contractAmount - totalCommitted;
    const profitMargin = contractAmount > 0 ? (profit / contractAmount) * 100 : 0;

    // Calculate burn rate (per day)
    const startDate = job.start_date ? new Date(job.start_date) : new Date(job.created_at);
    const daysSinceStart = Math.max(1, Math.floor((Date.now() - startDate) / (1000 * 60 * 60 * 24)));
    const burnRate = totalInvoiced / daysSinceStart;

    // Estimate completion date based on burn rate
    let estimatedCompletion = null;
    if (burnRate > 0 && contractRemaining > 0) {
      const daysRemaining = contractRemaining / burnRate;
      estimatedCompletion = new Date(Date.now() + daysRemaining * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    return {
      ...job,
      metrics: {
        contract_amount: contractAmount,
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        contract_remaining: contractRemaining,
        total_budget: totalBudget,
        total_committed: totalCommitted,
        total_po_amount: totalPOAmount,
        profit,
        profit_margin: profitMargin,
        burn_rate_daily: burnRate,
        days_active: daysSinceStart,
        estimated_completion: estimatedCompletion
      }
    };
  });

  res.json(jobsWithHealth);
}));

// ============ BURN RATE ANALYSIS ============

// Get burn rate analysis across all jobs
router.get('/burn-rate', asyncHandler(async (req, res) => {
  const { period } = req.query; // weekly, monthly
  const periodDays = period === 'weekly' ? 7 : 30;

  // Get active jobs
  const { data: jobs } = await supabase
    .from('v2_jobs')
    .select('id, name, contract_amount, start_date, created_at')
    .eq('status', 'active')
    .is('deleted_at', null);

  // Get invoices with dates
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('job_id, amount, invoice_date, created_at')
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false });

  // Calculate burn rate per job
  const burnRates = jobs.map(job => {
    const jobInvoices = (invoices || []).filter(i => i.job_id === job.id);

    // Group by period
    const periodStart = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
    const recentInvoices = jobInvoices.filter(i => {
      const date = new Date(i.invoice_date || i.created_at);
      return date >= periodStart;
    });

    const recentTotal = recentInvoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const burnRate = recentTotal / periodDays;

    const totalSpent = jobInvoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
    const contractAmount = parseFloat(job.contract_amount) || 0;

    return {
      job_id: job.id,
      job_name: job.name,
      contract_amount: contractAmount,
      total_spent: totalSpent,
      recent_spend: recentTotal,
      burn_rate_daily: burnRate,
      burn_rate_period: recentTotal,
      percent_spent: contractAmount > 0 ? (totalSpent / contractAmount) * 100 : 0,
      remaining: contractAmount - totalSpent
    };
  });

  // Calculate company-wide burn rate
  const totalBurnRate = burnRates.reduce((sum, j) => sum + j.burn_rate_daily, 0);
  const totalContract = burnRates.reduce((sum, j) => sum + j.contract_amount, 0);
  const totalSpent = burnRates.reduce((sum, j) => sum + j.total_spent, 0);

  res.json({
    period: period || 'monthly',
    period_days: periodDays,
    jobs: burnRates,
    company_totals: {
      total_contract_value: totalContract,
      total_spent: totalSpent,
      total_burn_rate_daily: totalBurnRate,
      total_burn_rate_period: totalBurnRate * periodDays,
      percent_spent: totalContract > 0 ? (totalSpent / totalContract) * 100 : 0,
      remaining: totalContract - totalSpent
    }
  });
}));

// ============ COMPANY-WIDE METRICS ============

// Get company-wide dashboard metrics
router.get('/metrics', asyncHandler(async (req, res) => {
  // Get jobs by status
  const { data: jobs } = await supabase
    .from('v2_jobs')
    .select('id, name, status, contract_amount')
    .is('deleted_at', null);

  const activeJobs = jobs.filter(j => j.status === 'active');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const onHoldJobs = jobs.filter(j => j.status === 'on_hold');

  const totalContractValue = jobs.reduce((sum, j) => sum + parseFloat(j.contract_amount || 0), 0);
  const activeContractValue = activeJobs.reduce((sum, j) => sum + parseFloat(j.contract_amount || 0), 0);

  // Get invoice stats
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, amount, status')
    .is('deleted_at', null);

  const totalInvoiced = invoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
  const pendingApproval = invoices.filter(i => i.status === 'needs_approval');
  const pendingPayment = invoices.filter(i => ['approved', 'in_draw'].includes(i.status));

  // Get PO stats
  const { data: pos } = await supabase
    .from('v2_purchase_orders')
    .select('id, total_amount, status')
    .is('deleted_at', null);

  const totalPOValue = pos.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);
  const openPOs = pos.filter(p => p.status === 'open');

  // Get draw stats
  const { data: draws } = await supabase
    .from('v2_draws')
    .select('id, total_amount, funded_amount, status')
    .is('deleted_at', null);

  const totalDrawn = draws.reduce((sum, d) => sum + parseFloat(d.total_amount || 0), 0);
  const totalFunded = draws.reduce((sum, d) => sum + parseFloat(d.funded_amount || 0), 0);
  const pendingDraws = draws.filter(d => d.status === 'submitted');

  // Get leads/pipeline
  const { data: leads } = await supabase
    .from('v2_leads')
    .select('id, status, estimated_value')
    .is('deleted_at', null);

  const openLeads = leads?.filter(l => !['won', 'lost'].includes(l.status)) || [];
  const pipelineValue = openLeads.reduce((sum, l) => sum + parseFloat(l.estimated_value || 0), 0);

  // Get crew capacity (if crew scheduling is set up)
  const { data: crew } = await supabase
    .from('v2_crew_members')
    .select('id')
    .eq('is_active', true)
    .is('deleted_at', null);

  const { data: pendingRequests } = await supabase
    .from('v2_work_requests')
    .select('id')
    .eq('status', 'pending')
    .is('deleted_at', null);

  res.json({
    jobs: {
      total: jobs.length,
      active: activeJobs.length,
      completed: completedJobs.length,
      on_hold: onHoldJobs.length,
      total_contract_value: totalContractValue,
      active_contract_value: activeContractValue
    },
    financials: {
      total_invoiced: totalInvoiced,
      pending_approval_count: pendingApproval.length,
      pending_approval_value: pendingApproval.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0),
      pending_payment_count: pendingPayment.length,
      pending_payment_value: pendingPayment.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0),
      total_po_value: totalPOValue,
      open_po_count: openPOs.length,
      open_po_value: openPOs.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0)
    },
    draws: {
      total_drawn: totalDrawn,
      total_funded: totalFunded,
      pending_count: pendingDraws.length,
      pending_value: pendingDraws.reduce((sum, d) => sum + parseFloat(d.total_amount || 0), 0)
    },
    pipeline: {
      lead_count: openLeads.length,
      pipeline_value: pipelineValue
    },
    capacity: {
      crew_count: crew?.length || 0,
      pending_work_requests: pendingRequests?.length || 0
    }
  });
}));

// ============ PROFIT PROJECTIONS ============

// Get profit projections across jobs
router.get('/profit', asyncHandler(async (req, res) => {
  // Get active and completed jobs
  const { data: jobs } = await supabase
    .from('v2_jobs')
    .select('id, name, status, contract_amount')
    .in('status', ['active', 'completed'])
    .is('deleted_at', null);

  // Get committed costs from budget lines
  const { data: budgets } = await supabase
    .from('v2_budget_lines')
    .select('job_id, budgeted_amount, committed_amount, billed_amount, paid_amount')
    .in('job_id', jobs.map(j => j.id));

  // Get change orders (additional revenue/cost)
  const { data: changeOrders } = await supabase
    .from('v2_change_orders')
    .select('job_id, amount, status')
    .in('status', ['approved', 'completed'])
    .in('job_id', jobs.map(j => j.id));

  // Calculate profit per job
  const jobProfits = jobs.map(job => {
    const jobBudget = (budgets || []).filter(b => b.job_id === job.id);
    const jobCOs = (changeOrders || []).filter(co => co.job_id === job.id);

    const contractAmount = parseFloat(job.contract_amount) || 0;
    const changeOrderValue = jobCOs.reduce((sum, co) => sum + parseFloat(co.amount || 0), 0);
    const revisedContractAmount = contractAmount + changeOrderValue;

    const totalBudget = jobBudget.reduce((sum, b) => sum + parseFloat(b.budgeted_amount || 0), 0);
    const totalCommitted = jobBudget.reduce((sum, b) => sum + parseFloat(b.committed_amount || 0), 0);
    const totalBilled = jobBudget.reduce((sum, b) => sum + parseFloat(b.billed_amount || 0), 0);
    const totalPaid = jobBudget.reduce((sum, b) => sum + parseFloat(b.paid_amount || 0), 0);

    // Project final cost based on committed + remaining budget ratio
    const percentBilled = totalBudget > 0 ? totalBilled / totalBudget : 0;
    const projectedCost = totalCommitted + (totalBudget - totalCommitted) * 0.9; // Assume 90% of uncommitted budget will be spent

    const projectedProfit = revisedContractAmount - projectedCost;
    const actualProfit = revisedContractAmount - totalPaid;
    const profitMargin = revisedContractAmount > 0 ? (projectedProfit / revisedContractAmount) * 100 : 0;

    return {
      job_id: job.id,
      job_name: job.name,
      status: job.status,
      original_contract: contractAmount,
      change_orders: changeOrderValue,
      revised_contract: revisedContractAmount,
      total_budget: totalBudget,
      total_committed: totalCommitted,
      total_billed: totalBilled,
      total_paid: totalPaid,
      projected_cost: projectedCost,
      projected_profit: projectedProfit,
      actual_profit: actualProfit,
      profit_margin: profitMargin
    };
  });

  // Calculate company totals
  const totalRevenue = jobProfits.reduce((sum, j) => sum + j.revised_contract, 0);
  const totalProjectedCost = jobProfits.reduce((sum, j) => sum + j.projected_cost, 0);
  const totalProjectedProfit = jobProfits.reduce((sum, j) => sum + j.projected_profit, 0);
  const totalActualProfit = jobProfits.reduce((sum, j) => sum + j.actual_profit, 0);

  res.json({
    jobs: jobProfits,
    company_totals: {
      total_revenue: totalRevenue,
      total_projected_cost: totalProjectedCost,
      total_projected_profit: totalProjectedProfit,
      total_actual_profit: totalActualProfit,
      overall_margin: totalRevenue > 0 ? (totalProjectedProfit / totalRevenue) * 100 : 0
    }
  });
}));

// ============ HISTORICAL TRENDS ============

// Get historical data for charts
router.get('/trends', asyncHandler(async (req, res) => {
  const { months = 6 } = req.query;
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  // Get invoices by month
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('amount, invoice_date, status, created_at')
    .gte('created_at', startDate.toISOString())
    .is('deleted_at', null)
    .order('created_at');

  // Get draws by month
  const { data: draws } = await supabase
    .from('v2_draws')
    .select('total_amount, funded_amount, status, created_at')
    .gte('created_at', startDate.toISOString())
    .order('created_at');

  // Group by month
  const monthlyData = {};
  const now = new Date();

  for (let i = 0; i < parseInt(months); i++) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = {
      month: key,
      invoices_count: 0,
      invoices_amount: 0,
      draws_count: 0,
      draws_amount: 0,
      funded_amount: 0
    };
  }

  (invoices || []).forEach(inv => {
    const date = new Date(inv.invoice_date || inv.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[key]) {
      monthlyData[key].invoices_count++;
      monthlyData[key].invoices_amount += parseFloat(inv.amount || 0);
    }
  });

  (draws || []).forEach(draw => {
    const date = new Date(draw.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (monthlyData[key]) {
      monthlyData[key].draws_count++;
      monthlyData[key].draws_amount += parseFloat(draw.total_amount || 0);
      monthlyData[key].funded_amount += parseFloat(draw.funded_amount || 0);
    }
  });

  // Convert to sorted array
  const trends = Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));

  res.json(trends);
}));

module.exports = router;
