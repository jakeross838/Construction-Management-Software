/**
 * Executive Dashboard Routes
 * Company-wide KPIs and high-level metrics for executive overview
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const logger = require('../utils/logger');

// ============================================================
// EXECUTIVE SUMMARY
// ============================================================

/**
 * GET /api/executive/summary
 * Returns high-level company KPIs
 */
router.get('/summary', asyncHandler(async (req, res) => {
  // Get job counts by status
  const { data: jobs, error: jobsError } = await supabase
    .from('v2_jobs')
    .select('id, status, contract_amount');

  if (jobsError) {
    logger.error('Failed to fetch jobs for executive summary', { error: jobsError.message });
    throw new AppError('DATABASE_ERROR', jobsError.message);
  }

  const jobCounts = {
    active: 0,
    completed: 0,
    on_hold: 0,
    planning: 0,
    total: 0
  };

  let totalRevenue = 0;

  (jobs || []).forEach(job => {
    jobCounts.total++;
    const status = (job.status || 'active').toLowerCase().replace('-', '_');
    if (jobCounts[status] !== undefined) {
      jobCounts[status]++;
    } else {
      jobCounts.active++; // Default to active for unknown statuses
    }
    totalRevenue += parseFloat(job.contract_amount || 0);
  });

  // Get pending invoices (needs_approval and approved but not in draw)
  const { data: pendingInvoices, error: invoicesError } = await supabase
    .from('v2_invoices')
    .select('id, amount, status')
    .in('status', ['needs_approval', 'approved'])
    .is('deleted_at', null);

  if (invoicesError) {
    logger.error('Failed to fetch pending invoices', { error: invoicesError.message });
    throw new AppError('DATABASE_ERROR', invoicesError.message);
  }

  const invoicesPending = {
    count: (pendingInvoices || []).length,
    amount: (pendingInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0)
  };

  // Get AR outstanding (client invoices that are sent, partial, or overdue)
  // First check if v2_client_invoices table exists
  let arOutstanding = { count: 0, amount: 0 };
  try {
    const { data: clientInvoices, error: arError } = await supabase
      .from('v2_client_invoices')
      .select('id, balance_due, status')
      .in('status', ['sent', 'partial', 'overdue'])
      .is('deleted_at', null);

    if (!arError && clientInvoices) {
      arOutstanding = {
        count: clientInvoices.length,
        amount: clientInvoices.reduce((sum, inv) => sum + parseFloat(inv.balance_due || 0), 0)
      };
    }
  } catch (err) {
    // Table may not exist, log but continue
    logger.warn('v2_client_invoices table not available', { error: err.message });
  }

  // Get total committed (sum of open PO amounts)
  const { data: openPOs, error: posError } = await supabase
    .from('v2_purchase_orders')
    .select('id, total_amount, status')
    .eq('status', 'open')
    .is('deleted_at', null);

  if (posError) {
    logger.error('Failed to fetch open POs', { error: posError.message });
    throw new AppError('DATABASE_ERROR', posError.message);
  }

  const totalCommitted = {
    count: (openPOs || []).length,
    amount: (openPOs || []).reduce((sum, po) => sum + parseFloat(po.total_amount || 0), 0)
  };

  res.json({
    total_jobs: jobCounts,
    total_revenue: totalRevenue,
    total_invoices_pending: invoicesPending,
    total_ar_outstanding: arOutstanding,
    total_committed: totalCommitted
  });
}));

// ============================================================
// JOBS SUMMARY
// ============================================================

/**
 * GET /api/executive/jobs-summary
 * Returns job portfolio overview with financial metrics
 */
router.get('/jobs-summary', asyncHandler(async (req, res) => {
  const { status } = req.query;

  // Get all jobs with their details
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name, status, contract_amount, address, client_name, created_at');

  if (status && status !== 'all') {
    jobQuery = jobQuery.eq('status', status);
  }

  const { data: jobs, error: jobsError } = await jobQuery;

  if (jobsError) {
    logger.error('Failed to fetch jobs', { error: jobsError.message });
    throw new AppError('DATABASE_ERROR', jobsError.message);
  }

  // For each job, calculate billed amount from approved/in_draw/paid invoices
  const jobSummaries = await Promise.all((jobs || []).map(async (job) => {
    // Get total billed (invoices in approved, in_draw, or paid status)
    const { data: invoices, error: invError } = await supabase
      .from('v2_invoices')
      .select('amount, status')
      .eq('job_id', job.id)
      .in('status', ['approved', 'in_draw', 'paid'])
      .is('deleted_at', null);

    if (invError) {
      logger.warn('Failed to fetch invoices for job', { jobId: job.id, error: invError.message });
    }

    const billedAmount = (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const contractAmount = parseFloat(job.contract_amount || 0);
    const percentComplete = contractAmount > 0 ? (billedAmount / contractAmount) * 100 : 0;

    return {
      id: job.id,
      name: job.name,
      status: job.status,
      address: job.address,
      client_name: job.client_name,
      contract_amount: contractAmount,
      billed_amount: billedAmount,
      percent_complete: Math.round(percentComplete * 10) / 10, // Round to 1 decimal
      remaining: contractAmount - billedAmount,
      created_at: job.created_at
    };
  }));

  // Sort by contract amount descending
  jobSummaries.sort((a, b) => b.contract_amount - a.contract_amount);

  // Calculate totals
  const totals = {
    total_contract: jobSummaries.reduce((sum, j) => sum + j.contract_amount, 0),
    total_billed: jobSummaries.reduce((sum, j) => sum + j.billed_amount, 0),
    total_remaining: jobSummaries.reduce((sum, j) => sum + j.remaining, 0),
    job_count: jobSummaries.length
  };

  totals.overall_percent_complete = totals.total_contract > 0
    ? Math.round((totals.total_billed / totals.total_contract) * 1000) / 10
    : 0;

  res.json({
    jobs: jobSummaries,
    totals
  });
}));

// ============================================================
// CASH POSITION
// ============================================================

/**
 * GET /api/executive/cash-position
 * Returns AR/AP summary and aging buckets
 */
router.get('/cash-position', asyncHandler(async (req, res) => {
  const today = new Date();

  // ---- AR (Accounts Receivable) ----
  // Get client invoices with outstanding balances
  let arTotal = 0;
  const arAging = {
    current: 0,      // 0-30 days
    days_30: 0,      // 31-60 days
    days_60: 0,      // 61-90 days
    days_90_plus: 0  // 90+ days
  };

  try {
    const { data: clientInvoices, error: arError } = await supabase
      .from('v2_client_invoices')
      .select('id, balance_due, due_date, invoice_date, status')
      .in('status', ['sent', 'partial', 'overdue'])
      .is('deleted_at', null);

    if (!arError && clientInvoices) {
      clientInvoices.forEach(inv => {
        const balance = parseFloat(inv.balance_due || 0);
        arTotal += balance;

        // Calculate days past due based on due_date or invoice_date
        const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
        const daysPast = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

        if (daysPast <= 30) {
          arAging.current += balance;
        } else if (daysPast <= 60) {
          arAging.days_30 += balance;
        } else if (daysPast <= 90) {
          arAging.days_60 += balance;
        } else {
          arAging.days_90_plus += balance;
        }
      });
    }
  } catch (err) {
    logger.warn('v2_client_invoices table not available for cash position', { error: err.message });
  }

  // ---- AP (Accounts Payable) ----
  // Get vendor invoices that are approved but not yet paid
  const { data: vendorInvoices, error: apError } = await supabase
    .from('v2_invoices')
    .select('id, amount, due_date, invoice_date, status')
    .in('status', ['approved', 'in_draw'])
    .is('deleted_at', null);

  if (apError) {
    logger.error('Failed to fetch AP invoices', { error: apError.message });
    throw new AppError('DATABASE_ERROR', apError.message);
  }

  let apTotal = 0;
  const apAging = {
    current: 0,
    days_30: 0,
    days_60: 0,
    days_90_plus: 0
  };

  (vendorInvoices || []).forEach(inv => {
    const amount = parseFloat(inv.amount || 0);
    apTotal += amount;

    // Calculate days past due based on due_date or invoice_date
    const dueDate = inv.due_date ? new Date(inv.due_date) : new Date(inv.invoice_date);
    const daysPast = Math.floor((today - dueDate) / (1000 * 60 * 60 * 24));

    if (daysPast <= 30) {
      apAging.current += amount;
    } else if (daysPast <= 60) {
      apAging.days_30 += amount;
    } else if (daysPast <= 90) {
      apAging.days_60 += amount;
    } else {
      apAging.days_90_plus += amount;
    }
  });

  // Net position = AR - AP
  const netPosition = arTotal - apTotal;

  res.json({
    ar_total: arTotal,
    ap_total: apTotal,
    net_position: netPosition,
    ar_aging: arAging,
    ap_aging: apAging,
    summary: {
      ar_invoice_count: 0, // Would need separate query
      ap_invoice_count: (vendorInvoices || []).length,
      health: netPosition >= 0 ? 'positive' : 'negative'
    }
  });
}));

// ============================================================
// PIPELINE & BACKLOG
// ============================================================

/**
 * Helper: Parse budget_range to numeric midpoint value
 * @param {string} budgetRange - e.g., "under_500k", "500k_1m", "1m_2m", "2m_5m", "over_5m"
 * @returns {number} Estimated midpoint value
 */
function parseBudgetRange(budgetRange) {
  if (!budgetRange) return 0;

  const ranges = {
    'under_500k': 350000,      // Midpoint ~$350k
    '500k_1m': 750000,         // Midpoint $750k
    '1m_2m': 1500000,          // Midpoint $1.5M
    '2m_5m': 3500000,          // Midpoint $3.5M
    'over_5m': 7500000,        // Conservative estimate $7.5M
    // Alternative formats
    'under_250k': 175000,
    '250k_500k': 375000,
    '500k_750k': 625000,
    '750k_1m': 875000,
  };

  const normalized = budgetRange.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  return ranges[normalized] || 0;
}

/**
 * GET /api/executive/pipeline
 * Returns pipeline data with leads by stage, estimated values, conversion rates, and backlog
 */
router.get('/pipeline', asyncHandler(async (req, res) => {
  // Define pipeline stages (active stages, not won/lost)
  const ACTIVE_STAGES = ['inquiry', 'qualification', 'consultation', 'design_agreement', 'proposal', 'contract'];

  // ---- Get all leads for pipeline and conversion analysis ----
  const { data: leads, error: leadsError } = await supabase
    .from('v2_leads')
    .select('id, stage, outcome, budget_range, qualification_score, created_at, converted_at')
    .is('deleted_at', null);

  if (leadsError) {
    logger.error('Failed to fetch leads for pipeline', { error: leadsError.message });
    throw new AppError('DATABASE_ERROR', leadsError.message);
  }

  // ---- Get estimates (proposals) that are not yet converted ----
  const { data: estimates, error: estimatesError } = await supabase
    .from('v2_estimates')
    .select('id, status, total_amount, job_id, title, created_at')
    .is('deleted_at', null);

  if (estimatesError) {
    logger.error('Failed to fetch estimates for pipeline', { error: estimatesError.message });
    throw new AppError('DATABASE_ERROR', estimatesError.message);
  }

  // ---- Get jobs for backlog calculation ----
  const { data: jobs, error: jobsError } = await supabase
    .from('v2_jobs')
    .select('id, status, contract_amount, name, created_at');

  if (jobsError) {
    logger.error('Failed to fetch jobs for backlog', { error: jobsError.message });
    throw new AppError('DATABASE_ERROR', jobsError.message);
  }

  // ---- Calculate pipeline metrics ----
  const pipelineByStage = {};
  let totalPipelineValue = 0;

  // Initialize all active stages
  for (const stage of ACTIVE_STAGES) {
    pipelineByStage[stage] = {
      count: 0,
      estimated_value: 0,
      leads: []
    };
  }

  // Process leads
  for (const lead of (leads || [])) {
    const stage = lead.stage?.toLowerCase() || 'inquiry';

    // Only count active leads (not won/lost)
    if (!lead.outcome && ACTIVE_STAGES.includes(stage)) {
      const estimatedValue = parseBudgetRange(lead.budget_range);

      pipelineByStage[stage].count++;
      pipelineByStage[stage].estimated_value += estimatedValue;
      totalPipelineValue += estimatedValue;

      pipelineByStage[stage].leads.push({
        id: lead.id,
        qualification_score: lead.qualification_score,
        estimated_value: estimatedValue,
        created_at: lead.created_at
      });
    }
  }

  // ---- Calculate estimate-based pipeline (draft/submitted proposals) ----
  const estimatesPipeline = {
    draft: { count: 0, total_value: 0 },
    submitted: { count: 0, total_value: 0 },
    approved: { count: 0, total_value: 0 }
  };

  for (const est of (estimates || [])) {
    const status = est.status?.toLowerCase() || 'draft';
    const value = parseFloat(est.total_amount || 0);

    if (estimatesPipeline[status]) {
      estimatesPipeline[status].count++;
      estimatesPipeline[status].total_value += value;
    }
  }

  // ---- Calculate conversion rates ----
  const totalLeads = (leads || []).length;
  const wonLeads = (leads || []).filter(l => l.outcome === 'won').length;
  const lostLeads = (leads || []).filter(l => l.outcome === 'lost').length;
  const closedLeads = wonLeads + lostLeads;

  const conversionRates = {
    overall: closedLeads > 0 ? Math.round((wonLeads / closedLeads) * 1000) / 10 : 0,
    total_leads: totalLeads,
    won: wonLeads,
    lost: lostLeads,
    active: totalLeads - closedLeads
  };

  // Calculate stage-to-stage conversion rates (how many move to next stage)
  const stageConversions = {};
  for (let i = 0; i < ACTIVE_STAGES.length - 1; i++) {
    const currentStage = ACTIVE_STAGES[i];
    const nextStage = ACTIVE_STAGES[i + 1];

    // Count leads that are currently in or have passed through each stage
    const inCurrentOrLater = (leads || []).filter(l => {
      const stageIndex = ACTIVE_STAGES.indexOf(l.stage?.toLowerCase());
      return stageIndex >= i || l.outcome === 'won';
    }).length;

    const inNextOrLater = (leads || []).filter(l => {
      const stageIndex = ACTIVE_STAGES.indexOf(l.stage?.toLowerCase());
      return stageIndex >= i + 1 || l.outcome === 'won';
    }).length;

    stageConversions[`${currentStage}_to_${nextStage}`] = inCurrentOrLater > 0
      ? Math.round((inNextOrLater / inCurrentOrLater) * 1000) / 10
      : 0;
  }

  // ---- Calculate backlog (active and planning jobs not yet completed) ----
  const backlogJobs = (jobs || []).filter(j =>
    j.status === 'active' || j.status === 'planning' || j.status === 'on-hold' || j.status === 'on_hold'
  );

  const backlog = {
    total_count: backlogJobs.length,
    total_value: backlogJobs.reduce((sum, j) => sum + parseFloat(j.contract_amount || 0), 0),
    by_status: {
      active: { count: 0, value: 0 },
      planning: { count: 0, value: 0 },
      on_hold: { count: 0, value: 0 }
    }
  };

  for (const job of backlogJobs) {
    const status = (job.status || 'active').toLowerCase().replace('-', '_');
    if (backlog.by_status[status]) {
      backlog.by_status[status].count++;
      backlog.by_status[status].value += parseFloat(job.contract_amount || 0);
    }
  }

  // ---- Build weighted pipeline (probability-adjusted value) ----
  const stageProbabilities = {
    inquiry: 0.10,
    qualification: 0.20,
    consultation: 0.35,
    design_agreement: 0.50,
    proposal: 0.65,
    contract: 0.85
  };

  let weightedPipelineValue = 0;
  for (const stage of ACTIVE_STAGES) {
    const prob = stageProbabilities[stage] || 0.1;
    weightedPipelineValue += pipelineByStage[stage].estimated_value * prob;
  }

  res.json({
    pipeline: {
      by_stage: pipelineByStage,
      total_count: ACTIVE_STAGES.reduce((sum, s) => sum + pipelineByStage[s].count, 0),
      total_value: totalPipelineValue,
      weighted_value: Math.round(weightedPipelineValue)
    },
    estimates: estimatesPipeline,
    conversion_rates: {
      ...conversionRates,
      by_stage: stageConversions
    },
    backlog,
    summary: {
      total_pipeline_and_backlog: totalPipelineValue + backlog.total_value,
      pipeline_health: totalPipelineValue > backlog.total_value * 0.5 ? 'healthy' : 'needs_attention'
    }
  });
}));

module.exports = router;
