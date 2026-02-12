/**
 * Jobs Routes
 * Job management and specs endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { extractSpecsFromPlans, extractSpecsFromMultipleDocuments } = require('../ai/document-processor');
const { asyncHandler, AppError, notFoundError, validateRequest } = require('../core/errors');
const { validate, schemas } = require('../middleware/validate');
const {
  createValidationError,
  createValidationWarning,
  createDetailedFixHint,
  formatAmount
} = require('../matching/validation-errors');
const { tables, getBuilderId } = require('../core/multi-tenant');
const { hasPermission } = require('../middleware/auth');
const { triggerWebhooks } = require('./webhooks');
const { cacheResponse } = require('../middleware/cache');
const cache = require('../services/cache');
const logger = require('../utils/logger');
const { port } = require('../../config');
const { reconcileJob } = require('../services/reconciliation');

// Cache TTL constants
const JOBS_LIST_CACHE_TTL = 60; // 1 minute for jobs list (changes more frequently)

/**
 * Invalidate jobs cache
 */
async function invalidateJobsCache() {
  await cache.invalidatePattern('response:/api/jobs*');
}

// Create a new job
router.post('/', validate(schemas.jobCreate), asyncHandler(async (req, res) => {
  const {
    name, address, status,
    // Client fields - accept both 'client' and 'client_name'
    client, client_name,
    // Financials
    contract_amount, budget_amount, target_margin, retainage_percent, percent_complete,
    // Dates
    start_date, end_date,
    // Team
    project_manager, site_supervisor, architect, engineer,
    // Client contact
    client_email, client_phone, client_cell,
    // Specs
    square_footage, bedrooms, bathrooms, half_baths, stories, garage_spaces,
    construction_type, architectural_style,
    // Notes
    notes
  } = req.body;
  const builderId = getBuilderId(req);

  // Build job data object, only including non-empty fields
  const jobData = {
    name,
    status: status || 'active'
  };

  // Handle client name - accept either 'client' or 'client_name'
  const clientValue = client || client_name;
  if (clientValue) {
    jobData.client = clientValue;
    jobData.client_name = clientValue;
  }

  // Optional string fields
  if (address) jobData.address = address;
  if (project_manager) jobData.project_manager = project_manager;
  if (site_supervisor) jobData.site_supervisor = site_supervisor;
  if (architect) jobData.architect = architect;
  if (engineer) jobData.engineer = engineer;
  if (client_email) jobData.client_email = client_email;
  if (client_phone) jobData.client_phone = client_phone;
  if (client_cell) jobData.client_cell = client_cell;
  if (construction_type) jobData.construction_type = construction_type;
  if (architectural_style) jobData.architectural_style = architectural_style;
  if (notes) jobData.notes = notes;

  // Numeric fields (allow 0)
  if (contract_amount !== undefined && contract_amount !== null) jobData.contract_amount = contract_amount;
  if (budget_amount !== undefined && budget_amount !== null) jobData.budget_amount = budget_amount;
  if (target_margin !== undefined && target_margin !== null) jobData.target_margin = target_margin;
  if (retainage_percent !== undefined && retainage_percent !== null) jobData.retainage_percent = retainage_percent;
  if (percent_complete !== undefined && percent_complete !== null) jobData.percent_complete = percent_complete;
  if (square_footage !== undefined && square_footage !== null) jobData.square_footage = square_footage;
  if (bedrooms !== undefined && bedrooms !== null) jobData.bedrooms = bedrooms;
  if (bathrooms !== undefined && bathrooms !== null) jobData.bathrooms = bathrooms;
  if (half_baths !== undefined && half_baths !== null) jobData.half_baths = half_baths;
  if (stories !== undefined && stories !== null) jobData.stories = stories;
  if (garage_spaces !== undefined && garage_spaces !== null) jobData.garage_spaces = garage_spaces;

  // Date fields
  if (start_date) jobData.start_date = start_date;
  if (end_date) jobData.end_date = end_date;

  // Add builder_id if authenticated
  if (builderId) {
    jobData.builder_id = builderId;
  }

  const { data, error } = await supabase
    .from('v2_jobs')
    .insert(jobData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity
  const activityData = {
    job_id: data.id,
    action: 'created',
    performed_by: req.body.created_by || req.user?.email || 'User',
    notes: `Job "${name}" created`
  };
  if (builderId) activityData.builder_id = builderId;

  await supabase.from('v2_job_activity').insert(activityData);

  // Trigger webhook for job creation
  if (builderId) {
    triggerWebhooks(builderId, 'job.created', data.id, {
      id: data.id,
      name: data.name,
      address: data.address,
      client_name: data.client_name,
      contract_amount: data.contract_amount,
      status: data.status,
      created_at: data.created_at,
    }).catch(() => {}); // Fire and forget
  }

  // Invalidate jobs cache
  await invalidateJobsCache();

  res.status(201).json(data);
}));

// Helper function to enrich jobs with budget data
async function enrichJobsWithBudgetData(jobs, builderId) {
  if (!jobs || jobs.length === 0) return jobs;

  const jobIds = jobs.map(j => j.id);

  // Fetch budget lines for all jobs in one query
  let budgetQuery = supabase
    .from('v2_budget_lines')
    .select('job_id, original_amount, revised_amount, committed_amount, actual_amount')
    .in('job_id', jobIds)
    .is('deleted_at', null);

  if (builderId) {
    budgetQuery = budgetQuery.eq('builder_id', builderId);
  }

  const { data: budgetLines } = await budgetQuery;

  // Calculate totals per job
  const budgetTotals = {};
  for (const line of (budgetLines || [])) {
    if (!budgetTotals[line.job_id]) {
      budgetTotals[line.job_id] = {
        budget_amount: 0,
        committed_amount: 0,
        actual_amount: 0
      };
    }
    budgetTotals[line.job_id].budget_amount += parseFloat(line.revised_amount || line.original_amount || 0);
    budgetTotals[line.job_id].committed_amount += parseFloat(line.committed_amount || 0);
    budgetTotals[line.job_id].actual_amount += parseFloat(line.actual_amount || 0);
  }

  // Merge budget data into jobs
  return jobs.map(job => ({
    ...job,
    budget_amount: budgetTotals[job.id]?.budget_amount || 0,
    committed_amount: budgetTotals[job.id]?.committed_amount || 0,
    actual_amount: budgetTotals[job.id]?.actual_amount || 0
  }));
}

// Get all jobs (with optional pagination, cached for 1 minute)
router.get('/', cacheResponse(JOBS_LIST_CACHE_TTL), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { page, limit, status } = req.query;
  const usePagination = page !== undefined || limit !== undefined;

  let query = supabase
    .from('v2_jobs')
    .select('*', usePagination ? { count: 'exact' } : undefined)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Filter by builder (mandatory)
  query = query.eq('builder_id', builderId);

  // PM scoping: if user can't view all jobs, filter to assigned jobs only
  if (req.user && !hasPermission(req.user.role, 'canViewAllJobs')) {
    const { data: assignedJobs } = await supabase
      .from('v2_job_users')
      .select('job_id')
      .eq('user_id', req.user.id);
    const jobIds = (assignedJobs || []).map(j => j.job_id);
    if (jobIds.length > 0) {
      query = query.in('id', jobIds);
    } else {
      // No assignments = no jobs visible
      return res.json(usePagination ? { data: [], meta: { page: 1, limit: 50, total: 0, totalPages: 0, hasMore: false } } : []);
    }
  }

  // Filter by status if provided
  if (status) {
    query = query.eq('status', status);
  }

  // Apply pagination if requested
  if (usePagination) {
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
    const offset = (pageNum - 1) * limitNum;
    query = query.range(offset, offset + limitNum - 1);

    const { data, error, count } = await query;
    if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

    // Enrich jobs with budget data
    const jobsWithBudgets = await enrichJobsWithBudgetData(data || [], builderId);

    const totalPages = Math.ceil((count || 0) / limitNum);
    return res.json({
      data: jobsWithBudgets,
      meta: {
        page: pageNum,
        limit: limitNum,
        total: count || 0,
        totalPages,
        hasMore: pageNum < totalPages
      }
    });
  }

  // Return plain array for backward compatibility
  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Enrich jobs with budget data
  const jobsWithBudgets = await enrichJobsWithBudgetData(data || [], builderId);
  res.json(jobsWithBudgets);
}));

// Get single job
router.get('/:id', validate(schemas.idParam), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_jobs')
    .select('*')
    .eq('id', req.params.id)
    .is('deleted_at', null);

  // Filter by builder if authenticated
  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') throw notFoundError('job', req.params.id);
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }
  res.json(data);
}));

// Update job (basic fields, not specs)
router.patch('/:id', validate(schemas.jobUpdate), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);
  const allowedFields = ['name', 'address', 'client_name', 'contract_amount', 'status'];

  // Get current job for activity log
  let currentQuery = supabase
    .from('v2_jobs')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    currentQuery = currentQuery.eq('builder_id', builderId);
  }

  const { data: current } = await currentQuery.single();

  if (!current) throw notFoundError('job', id);

  // Build update object with only allowed fields
  const updates = {};
  const changes = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined && req.body[field] !== current[field]) {
      updates[field] = req.body[field];
      changes[field] = { old: current[field], new: req.body[field] };
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.json(current); // No changes
  }

  updates.updated_at = new Date().toISOString();

  let updateQuery = supabase
    .from('v2_jobs')
    .update(updates)
    .eq('id', id);

  if (builderId) {
    updateQuery = updateQuery.eq('builder_id', builderId);
  }

  const { data, error } = await updateQuery.select().single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity
  const action = updates.status ? 'status_changed' : 'updated';
  const activityData = {
    job_id: id,
    action,
    performed_by: req.body.updated_by || req.user?.email || 'User',
    field_changes: changes,
    previous_status: updates.status ? current.status : null,
    new_status: updates.status || null
  };
  if (builderId) activityData.builder_id = builderId;

  await supabase.from('v2_job_activity').insert(activityData);

  // Trigger webhook for job update
  if (builderId) {
    triggerWebhooks(builderId, 'job.updated', data.id, {
      id: data.id,
      name: data.name,
      address: data.address,
      client_name: data.client_name,
      contract_amount: data.contract_amount,
      status: data.status,
      changes,
      updated_at: data.updated_at,
    }).catch(() => {});
  }

  // Invalidate jobs cache
  await invalidateJobsCache();

  res.json(data);
}));

// Soft delete job (invalidates cache)
router.delete('/:id', validateRequest({
  params: { id: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  // Verify job exists
  let currentQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    currentQuery = currentQuery.eq('builder_id', builderId);
  }

  const { data: current } = await currentQuery.single();

  if (!current) throw notFoundError('job', id);

  // Soft delete
  let deleteQuery = supabase
    .from('v2_jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (builderId) {
    deleteQuery = deleteQuery.eq('builder_id', builderId);
  }

  const { error } = await deleteQuery;

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity
  const activityData = {
    job_id: id,
    action: 'deleted',
    performed_by: req.body.deleted_by || req.user?.email || 'User',
    notes: `Job "${current.name}" archived`
  };
  if (builderId) activityData.builder_id = builderId;

  await supabase.from('v2_job_activity').insert(activityData);

  // Trigger webhook for job deletion
  if (builderId) {
    triggerWebhooks(builderId, 'job.deleted', id, {
      id,
      name: current.name,
      deleted_at: new Date().toISOString(),
    }).catch(() => {});
  }

  res.json({ success: true, message: 'Job archived' });
}));

// Get job activity history
router.get('/:id/activity', validateRequest({
  params: { id: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_job_activity')
    .select('*')
    .eq('job_id', req.params.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
}));

// Get purchase orders for a specific job
router.get('/:id/purchase-orders', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_purchase_orders')
    .select(`
      id,
      po_number,
      description,
      total_amount,
      status,
      vendor:v2_vendors(id, name)
    `)
    .eq('job_id', req.params.id)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Flatten vendor name for easier frontend use
  const result = (data || []).map(po => ({
    ...po,
    vendor_name: po.vendor?.name || null
  }));

  res.json(result);
}));

// Validate all PO totals for a job
router.get('/:id/validate-po-totals', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // 1. Fetch all POs for this job (non-deleted, non-cancelled)
  const { data: pos, error: posError } = await supabase
    .from('v2_purchase_orders')
    .select('id, po_number, job_id, original_amount, change_order_total, total_amount, status, status_detail')
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .not('status', 'eq', 'cancelled');

  if (posError) throw new AppError('DATABASE_ERROR', posError.message, { code: posError.code });

  if (!pos || pos.length === 0) {
    return res.json({
      job_id: jobId,
      valid: true,
      summary: {
        pos_checked: 0,
        pos_with_errors: 0,
        pos_with_warnings: 0,
        total_co_discrepancy: 0,
        total_vpo_untracked: 0
      },
      po_results: [],
      errors: [],
      warnings: []
    });
  }

  const poIds = pos.map(p => p.id);

  // 2. Fetch all approved COs for these POs
  const { data: allCOs } = await supabase
    .from('v2_change_orders')
    .select('id, po_id, change_order_number, amount_change, status')
    .in('po_id', poIds)
    .eq('status', 'approved');

  // 3. Fetch all approved VPOs for these POs
  const { data: allVPOs } = await supabase
    .from('v2_verbal_purchase_orders')
    .select('id, po_id, vpo_number, amount, status')
    .in('po_id', poIds)
    .eq('status', 'approved');

  // Group COs and VPOs by PO
  const cosByPO = {};
  const vposByPO = {};
  (allCOs || []).forEach(co => {
    if (!cosByPO[co.po_id]) cosByPO[co.po_id] = [];
    cosByPO[co.po_id].push(co);
  });
  (allVPOs || []).forEach(vpo => {
    if (!vposByPO[vpo.po_id]) vposByPO[vpo.po_id] = [];
    vposByPO[vpo.po_id].push(vpo);
  });

  // 4. Run validation for each PO
  const allErrors = [];
  const allWarnings = [];
  const poResults = [];

  for (const po of pos) {
    const poCOs = cosByPO[po.id] || [];
    const poVPOs = vposByPO[po.id] || [];

    const calculatedCOTotal = poCOs.reduce((sum, co) => sum + parseFloat(co.amount_change || 0), 0);
    const calculatedVPOTotal = poVPOs.reduce((sum, vpo) => sum + parseFloat(vpo.amount || 0), 0);

    const storedOriginal = parseFloat(po.original_amount || 0);
    const storedCOTotal = parseFloat(po.change_order_total || 0);
    const storedTotal = parseFloat(po.total_amount || 0);
    const expectedTotal = storedOriginal + calculatedCOTotal;

    const poErrors = [];
    const poWarnings = [];

    // Check CO total mismatch
    const coDiscrepancy = storedCOTotal - calculatedCOTotal;
    if (Math.abs(coDiscrepancy) > 0.01) {
      const err = {
        type: 'CO_TOTAL_MISMATCH',
        severity: 'error',
        po_id: po.id,
        po_number: po.po_number,
        details: {
          stored_co_total: storedCOTotal,
          calculated_co_total: calculatedCOTotal,
          discrepancy: coDiscrepancy,
          approved_co_count: poCOs.length
        },
        fix_hint: 'Recalculate change_order_total by summing all approved CO amount_changes'
      };
      poErrors.push(err);
      allErrors.push(err);
    }

    // Check PO total mismatch
    const totalDiscrepancy = storedTotal - expectedTotal;
    if (Math.abs(totalDiscrepancy) > 0.01) {
      const err = {
        type: 'PO_TOTAL_MISMATCH',
        severity: 'error',
        po_id: po.id,
        po_number: po.po_number,
        details: {
          stored_total: storedTotal,
          expected_total: expectedTotal,
          original_amount: storedOriginal,
          co_total: calculatedCOTotal,
          discrepancy: totalDiscrepancy
        },
        fix_hint: 'Recalculate total_amount as original_amount + sum of approved CO amounts'
      };
      poErrors.push(err);
      allErrors.push(err);
    }

    // Report VPOs not tracked
    if (calculatedVPOTotal > 0) {
      const warn = {
        type: 'VPO_NOT_TRACKED',
        severity: 'warning',
        po_id: po.id,
        po_number: po.po_number,
        details: {
          vpo_total: calculatedVPOTotal,
          approved_vpo_count: poVPOs.length
        },
        fix_hint: 'VPOs exist but may not be reflected in PO totals'
      };
      poWarnings.push(warn);
      allWarnings.push(warn);
    }

    poResults.push({
      po_id: po.id,
      po_number: po.po_number,
      valid: poErrors.length === 0,
      error_count: poErrors.length,
      warning_count: poWarnings.length,
      co_discrepancy: Math.abs(coDiscrepancy) > 0.01 ? coDiscrepancy : 0
    });
  }

  // 5. Calculate summary
  const summary = {
    pos_checked: pos.length,
    pos_with_errors: poResults.filter(r => r.error_count > 0).length,
    pos_with_warnings: poResults.filter(r => r.warning_count > 0).length,
    total_co_discrepancy: poResults.reduce((sum, r) => sum + Math.abs(r.co_discrepancy), 0),
    total_vpo_untracked: allWarnings.filter(w => w.type === 'VPO_NOT_TRACKED')
      .reduce((sum, w) => sum + (w.details?.vpo_total || 0), 0)
  };

  res.json({
    job_id: jobId,
    valid: allErrors.length === 0,
    summary,
    po_results: poResults,
    errors: allErrors,
    warnings: allWarnings
  });
}));

// Get job budget accuracy report with variance analysis
router.get('/:id/budget-accuracy', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // 1. Verify job exists and get name
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null)
    .single();

  if (jobError?.code === 'PGRST116' || !job) throw notFoundError('job', jobId);
  if (jobError) throw new AppError('DATABASE_ERROR', jobError.message);

  // 2. Fetch all budget lines with cost code details
  const { data: budgetLines, error: blError } = await supabase
    .from('v2_budget_lines')
    .select(`
      id, job_id, cost_code_id,
      budgeted_amount, committed_amount, billed_amount, paid_amount,
      cost_code:v2_cost_codes(id, code, name)
    `)
    .eq('job_id', jobId);

  if (blError) throw new AppError('DATABASE_ERROR', blError.message, { code: blError.code });

  // 3. Calculate variance for each cost code
  const errors = [];
  const warnings = [];
  const byCostCode = (budgetLines || []).map(bl => {
    const budgeted = parseFloat(bl.budgeted_amount || 0);
    const committed = parseFloat(bl.committed_amount || 0);
    const billed = parseFloat(bl.billed_amount || 0);
    const paid = parseFloat(bl.paid_amount || 0);

    const varianceCommitted = committed - budgeted;
    const varianceBilled = billed - budgeted;
    const remainingToCommit = budgeted - committed;
    const remainingToBill = committed - billed;
    const percentCommitted = budgeted > 0 ? (committed / budgeted) * 100 : 0;

    // Determine status
    let status = 'ok';
    const costCode = bl.cost_code?.code || 'Unknown';
    const costCodeName = bl.cost_code?.name || 'Unknown';

    if (billed > committed + 0.01) {
      status = 'over_billed';
      const excess = billed - committed;
      errors.push(createValidationError('OVER_BILLED', {
        cost_code: costCode,
        cost_code_id: bl.cost_code_id,
        cost_code_name: costCodeName,
        message: `Cost code ${costCode} billed ${formatAmount(excess)} more than committed`,
        fix_hint: createDetailedFixHint('OVER_BILLED', { cost_code: costCode, excess }),
        details: {
          budgeted,
          committed,
          billed,
          excess
        }
      }));
    } else if (committed > budgeted + 0.01) {
      status = 'over_committed';
      const excess = committed - budgeted;
      errors.push(createValidationError('OVER_COMMITTED', {
        cost_code: costCode,
        cost_code_id: bl.cost_code_id,
        cost_code_name: costCodeName,
        message: `Cost code ${costCode} committed ${formatAmount(excess)} over budget`,
        fix_hint: createDetailedFixHint('OVER_COMMITTED', { cost_code: costCode, excess }),
        details: {
          budgeted,
          committed,
          excess,
          percent_over: ((committed / budgeted - 1) * 100).toFixed(1)
        }
      }));
    } else if (percentCommitted > 90) {
      status = 'approaching';
      const remaining = budgeted - committed;
      warnings.push(createValidationWarning('APPROACHING_LIMIT', {
        cost_code: costCode,
        cost_code_id: bl.cost_code_id,
        cost_code_name: costCodeName,
        message: `Cost code ${costCode} is ${percentCommitted.toFixed(1)}% committed (${formatAmount(remaining)} remaining)`,
        details: {
          budgeted,
          committed,
          percent_committed: percentCommitted,
          remaining
        }
      }));
    }

    return {
      cost_code_id: bl.cost_code_id,
      cost_code: bl.cost_code?.code || 'Unknown',
      cost_code_name: bl.cost_code?.name || 'Unknown',
      budgeted,
      committed,
      billed,
      paid,
      variance_committed: varianceCommitted,
      variance_billed: varianceBilled,
      remaining_to_commit: remainingToCommit,
      remaining_to_bill: remainingToBill,
      percent_committed: percentCommitted,
      status
    };
  });

  // 4. Calculate job-level summary
  const summary = byCostCode.reduce((acc, cc) => {
    acc.total_budgeted += cc.budgeted;
    acc.total_committed += cc.committed;
    acc.total_billed += cc.billed;
    acc.total_paid += cc.paid;
    return acc;
  }, { total_budgeted: 0, total_committed: 0, total_billed: 0, total_paid: 0 });

  summary.overall_variance_committed = summary.total_committed - summary.total_budgeted;
  summary.overall_variance_billed = summary.total_billed - summary.total_budgeted;
  summary.percent_committed = summary.total_budgeted > 0
    ? (summary.total_committed / summary.total_budgeted) * 100
    : 0;
  summary.percent_billed = summary.total_budgeted > 0
    ? (summary.total_billed / summary.total_budgeted) * 100
    : 0;
  summary.cost_codes_over_committed = errors.filter(e => e.type === 'OVER_COMMITTED').length;
  summary.cost_codes_over_billed = errors.filter(e => e.type === 'OVER_BILLED').length;
  summary.cost_codes_approaching_limit = warnings.filter(w => w.type === 'APPROACHING_LIMIT').length;

  // 5. What-if analysis for pending COs/VPOs
  // Get all POs for this job
  const { data: jobPOs } = await supabase
    .from('v2_purchase_orders')
    .select('id')
    .eq('job_id', jobId)
    .is('deleted_at', null);

  const poIds = (jobPOs || []).map(p => p.id);

  // Get pending COs with line items
  let pendingCOs = [];
  let pendingCOLineItems = [];
  if (poIds.length > 0) {
    const { data: cos } = await supabase
      .from('v2_change_orders')
      .select('id, po_id, change_order_number, amount_change')
      .in('po_id', poIds)
      .eq('status', 'pending');
    pendingCOs = cos || [];

    if (pendingCOs.length > 0) {
      const coIds = pendingCOs.map(co => co.id);
      const { data: lineItems } = await supabase
        .from('v2_change_order_line_items')
        .select('change_order_id, cost_code_id, amount')
        .in('change_order_id', coIds);
      pendingCOLineItems = lineItems || [];
    }
  }

  // Get pending VPOs (no line items - job-level only)
  let pendingVPOs = [];
  if (poIds.length > 0) {
    const { data: vpos } = await supabase
      .from('v2_verbal_purchase_orders')
      .select('id, po_id, vpo_number, amount')
      .in('po_id', poIds)
      .eq('status', 'pending');
    pendingVPOs = vpos || [];
  }

  // Calculate pending amounts by cost code
  const pendingByCostCode = {};
  pendingCOLineItems.forEach(li => {
    if (li.cost_code_id) {
      if (!pendingByCostCode[li.cost_code_id]) {
        pendingByCostCode[li.cost_code_id] = 0;
      }
      pendingByCostCode[li.cost_code_id] += parseFloat(li.amount || 0);
    }
  });

  const pendingCOTotal = pendingCOs.reduce((sum, co) => sum + parseFloat(co.amount_change || 0), 0);
  const pendingVPOTotal = pendingVPOs.reduce((sum, vpo) => sum + parseFloat(vpo.amount || 0), 0);

  // Build pending_changes by cost code
  const pendingChangesByCostCode = byCostCode
    .filter(cc => pendingByCostCode[cc.cost_code_id] && pendingByCostCode[cc.cost_code_id] > 0)
    .map(cc => {
      const pendingAmount = pendingByCostCode[cc.cost_code_id] || 0;
      const projectedCommitted = cc.committed + pendingAmount;
      const wouldExceedBudget = projectedCommitted > cc.budgeted + 0.01;
      return {
        cost_code_id: cc.cost_code_id,
        cost_code: cc.cost_code,
        cost_code_name: cc.cost_code_name,
        pending_amount: pendingAmount,
        current_committed: cc.committed,
        projected_committed: projectedCommitted,
        budgeted: cc.budgeted,
        would_exceed_budget: wouldExceedBudget,
        projected_variance: projectedCommitted - cc.budgeted
      };
    });

  // Build what_if_approved warnings
  const whatIfWarnings = pendingChangesByCostCode
    .filter(p => p.would_exceed_budget)
    .map(p => {
      const excess = p.projected_committed - p.budgeted;
      return createValidationWarning('WOULD_EXCEED_BUDGET', {
        cost_code: p.cost_code,
        cost_code_id: p.cost_code_id,
        cost_code_name: p.cost_code_name,
        message: `Approving pending COs would exceed budget by ${formatAmount(excess)} for ${p.cost_code} ${p.cost_code_name}`,
        fix_hint: createDetailedFixHint('WOULD_EXCEED_BUDGET', {
          pending_count: pendingCOs.length,
          pending_amount: p.pending_amount,
          excess
        }),
        details: {
          budgeted: p.budgeted,
          current_committed: p.current_committed,
          pending_amount: p.pending_amount,
          projected_committed: p.projected_committed,
          excess
        }
      });
    });

  const projectedTotalCommitted = summary.total_committed + pendingCOTotal;

  res.json({
    job_id: jobId,
    job_name: job.name,
    valid: errors.length === 0,
    summary,
    by_cost_code: byCostCode,
    errors,
    warnings,
    pending_changes: {
      pending_co_count: pendingCOs.length,
      pending_co_total: pendingCOTotal,
      pending_vpo_count: pendingVPOs.length,
      pending_vpo_total: pendingVPOTotal,
      by_cost_code: pendingChangesByCostCode
    },
    what_if_approved: {
      projected_total_committed: projectedTotalCommitted,
      projected_total_variance: projectedTotalCommitted - summary.total_budgeted,
      cost_codes_would_exceed: whatIfWarnings.length,
      warnings: whatIfWarnings
    }
  });
}));

/**
 * Batch fix validation errors for a job
 * POST /api/jobs/:id/fix-validation-errors
 * Body: { error_type, fix_action, performed_by }
 */
router.post('/:id/fix-validation-errors', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;
  const { error_type, fix_action, performed_by } = req.body;

  if (!error_type || !fix_action) {
    throw new AppError('VALIDATION_FAILED', 'error_type and fix_action are required');
  }

  const results = { fixed: 0, failed: 0, details: [] };

  if (error_type === 'ORPHANED_PO_ALLOCATION' && fix_action === 'remove') {
    // Get all invoices for job
    const { data: invoices, error: invError } = await supabase
      .from('v2_invoices')
      .select('id')
      .eq('job_id', jobId)
      .is('deleted_at', null);

    if (invError) {
      throw new AppError('DATABASE_ERROR', `Failed to fetch invoices: ${invError.message}`);
    }

    // Get all valid PO IDs for job
    const { data: validPOs, error: poError } = await supabase
      .from('v2_purchase_orders')
      .select('id')
      .eq('job_id', jobId)
      .is('deleted_at', null);

    if (poError) {
      throw new AppError('DATABASE_ERROR', `Failed to fetch POs: ${poError.message}`);
    }

    const validPOIds = new Set((validPOs || []).map(p => p.id));

    for (const invoice of (invoices || [])) {
      // Find orphaned allocations
      const { data: allocations, error: allocError } = await supabase
        .from('v2_invoice_allocations')
        .select('id, po_id')
        .eq('invoice_id', invoice.id)
        .not('po_id', 'is', null);

      if (allocError) {
        results.failed++;
        results.details.push({ invoice_id: invoice.id, action: 'failed', error: allocError.message });
        continue;
      }

      for (const alloc of (allocations || [])) {
        if (alloc.po_id && !validPOIds.has(alloc.po_id)) {
          // Orphaned - remove it
          const { error: deleteError } = await supabase
            .from('v2_invoice_allocations')
            .delete()
            .eq('id', alloc.id);

          if (deleteError) {
            results.failed++;
            results.details.push({ invoice_id: invoice.id, allocation_id: alloc.id, action: 'failed', error: deleteError.message });
          } else {
            results.fixed++;
            results.details.push({ invoice_id: invoice.id, allocation_id: alloc.id, action: 'removed' });
          }
        }
      }
    }
  }

  if (error_type === 'PO_TOTAL_MISMATCH' && fix_action === 'recalculate') {
    // Get all POs for job
    const { data: pos, error: poError } = await supabase
      .from('v2_purchase_orders')
      .select('id')
      .eq('job_id', jobId)
      .is('deleted_at', null);

    if (poError) {
      throw new AppError('DATABASE_ERROR', `Failed to fetch POs: ${poError.message}`);
    }

    for (const po of (pos || [])) {
      try {
        // Recalculate each PO
        const { data: approvedCOs, error: coError } = await supabase
          .from('v2_change_orders')
          .select('amount_change')
          .eq('po_id', po.id)
          .eq('status', 'approved');

        if (coError) throw coError;

        const coTotal = (approvedCOs || []).reduce((sum, co) => sum + parseFloat(co.amount_change || 0), 0);

        const { data: poData, error: poDataError } = await supabase
          .from('v2_purchase_orders')
          .select('original_amount')
          .eq('id', po.id)
          .single();

        if (poDataError) throw poDataError;

        const expectedTotal = (parseFloat(poData.original_amount) || 0) + coTotal;

        const { error: updateError } = await supabase
          .from('v2_purchase_orders')
          .update({
            change_order_total: coTotal,
            total_amount: expectedTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', po.id);

        if (updateError) throw updateError;

        results.fixed++;
        results.details.push({ po_id: po.id, action: 'recalculated' });
      } catch (err) {
        results.failed++;
        results.details.push({ po_id: po.id, action: 'failed', error: err.message });
      }
    }
  }

  // Log batch activity
  try {
    await supabase.from('v2_job_activity').insert({
      job_id: jobId,
      action: 'batch_fix',
      performed_by: performed_by || 'System',
      notes: JSON.stringify({ error_type, fix_action, results })
    });
  } catch (logError) {
    console.error('Failed to log batch fix activity:', logError.message);
  }

  res.json({
    success: results.failed === 0,
    job_id: jobId,
    error_type,
    fix_action,
    results
  });
}));

// Get job budget
router.get('/:id/budget', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Get budget lines
  const { data: budgetLines, error: budgetError } = await supabase
    .from('v2_budget_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId);

  if (budgetError) throw new AppError('DATABASE_ERROR', budgetError.message, { code: budgetError.code });

  // Get invoices for this job
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('amount, status')
    .eq('job_id', jobId)
    .in('status', ['approved', 'in_draw', 'paid']);

  // Get allocations
  const { data: allocations } = await supabase
    .from('v2_invoice_allocations')
    .select('cost_code_id, amount')
    .in('invoice_id', invoices?.map(i => i.id) || []);

  // Calculate totals
  const totals = {
    budgeted: 0,
    committed: 0,
    billed: 0,
    paid: 0
  };

  (budgetLines || []).forEach(bl => {
    totals.budgeted += parseFloat(bl.budgeted_amount || 0);
    totals.committed += parseFloat(bl.committed_amount || 0);
    totals.billed += parseFloat(bl.billed_amount || 0);
    totals.paid += parseFloat(bl.paid_amount || 0);
  });

  res.json({
    budget_lines: budgetLines || [],
    totals
  });
}));

// Create a budget line
router.post('/:id/budget', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const { cost_code_id, budgeted_amount, notes } = req.body;

  // Validate required fields
  if (!cost_code_id) {
    throw new AppError('VALIDATION_ERROR', 'cost_code_id is required');
  }
  if (budgeted_amount === undefined || budgeted_amount === null) {
    throw new AppError('VALIDATION_ERROR', 'budgeted_amount is required');
  }

  // Check if job exists
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new AppError('NOT_FOUND', 'Job not found');
  }

  // Check if budget line already exists for this job/cost code
  const { data: existing } = await supabase
    .from('v2_budget_lines')
    .select('id')
    .eq('job_id', jobId)
    .eq('cost_code_id', cost_code_id)
    .single();

  if (existing) {
    throw new AppError('DUPLICATE_ENTRY', 'Budget line already exists for this job and cost code');
  }

  // Create budget line
  const { data, error } = await supabase
    .from('v2_budget_lines')
    .insert({
      job_id: jobId,
      cost_code_id,
      budgeted_amount: parseFloat(budgeted_amount),
      notes: notes || null
    })
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.status(201).json(data);
}));

// Update a budget line
router.patch('/:id/budget/:lineId', asyncHandler(async (req, res) => {
  const { id: jobId, lineId } = req.params;
  const { budgeted_amount, notes } = req.body;

  // Build update object with only provided fields
  const updates = {};
  if (budgeted_amount !== undefined) {
    updates.budgeted_amount = parseFloat(budgeted_amount);
  }
  if (notes !== undefined) {
    updates.notes = notes;
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No fields to update');
  }

  // Verify the budget line belongs to this job
  const { data: existing, error: existingError } = await supabase
    .from('v2_budget_lines')
    .select('id, job_id')
    .eq('id', lineId)
    .single();

  if (existingError || !existing) {
    throw new AppError('NOT_FOUND', 'Budget line not found');
  }

  if (existing.job_id !== jobId) {
    throw new AppError('FORBIDDEN', 'Budget line does not belong to this job');
  }

  // Update budget line
  const { data, error } = await supabase
    .from('v2_budget_lines')
    .update(updates)
    .eq('id', lineId)
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.json(data);
}));

// Delete a budget line
router.delete('/:id/budget/:lineId', asyncHandler(async (req, res) => {
  const { id: jobId, lineId } = req.params;

  // Verify the budget line belongs to this job
  const { data: existing, error: existingError } = await supabase
    .from('v2_budget_lines')
    .select('id, job_id, committed_amount, billed_amount')
    .eq('id', lineId)
    .single();

  if (existingError || !existing) {
    throw new AppError('NOT_FOUND', 'Budget line not found');
  }

  if (existing.job_id !== jobId) {
    throw new AppError('FORBIDDEN', 'Budget line does not belong to this job');
  }

  // Warn if there are committed or billed amounts
  const committed = parseFloat(existing.committed_amount || 0);
  const billed = parseFloat(existing.billed_amount || 0);
  if (committed > 0 || billed > 0) {
    // Soft delete by setting deleted_at
    const { error } = await supabase
      .from('v2_budget_lines')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', lineId);

    if (error) {
      throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
    }

    res.json({
      message: 'Budget line archived (has committed/billed amounts)',
      soft_deleted: true
    });
    return;
  }

  // Hard delete if no committed or billed amounts
  const { error } = await supabase
    .from('v2_budget_lines')
    .delete()
    .eq('id', lineId);

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.json({ message: 'Budget line deleted', soft_deleted: false });
}));

// Get draws for a job
router.get('/:id/draws', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_draws')
    .select(`
      *,
      invoices:v2_draw_invoices(
        invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(name))
      )
    `)
    .eq('job_id', req.params.id)
    .order('draw_number', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Get CO billings for all draws
  const drawIds = data.map(d => d.id);
  const { data: coBillings } = drawIds.length > 0 ? await supabase
    .from('v2_job_co_draw_billings')
    .select('draw_id, amount')
    .in('draw_id', drawIds) : { data: [] };

  // Calculate totals for each draw
  const drawsWithTotals = data.map(draw => {
    const invoiceTotal = draw.invoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
    const invoiceCount = draw.invoices?.length || 0;
    const coTotal = (coBillings || [])
      .filter(b => b.draw_id === draw.id)
      .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    return {
      ...draw,
      total_amount: invoiceTotal + coTotal,
      invoice_total: invoiceTotal,
      invoice_count: invoiceCount,
      co_total: coTotal
    };
  });

  res.json(drawsWithTotals);
}));

// Get job financial metrics (consolidated)
router.get('/:id/metrics', validateRequest({
  params: { id: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name, contract_amount')
    .eq('id', jobId)
    .is('deleted_at', null)
    .single();

  if (jobError?.code === 'PGRST116' || !job) throw notFoundError('job', jobId);
  if (jobError) throw new AppError('DATABASE_ERROR', jobError.message);

  // Get budget totals
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('budgeted_amount, committed_amount, billed_amount, paid_amount')
    .eq('job_id', jobId);

  const budget = {
    budgeted: 0,
    committed: 0,
    billed: 0,
    paid: 0
  };
  (budgetLines || []).forEach(bl => {
    budget.budgeted += parseFloat(bl.budgeted_amount || 0);
    budget.committed += parseFloat(bl.committed_amount || 0);
    budget.billed += parseFloat(bl.billed_amount || 0);
    budget.paid += parseFloat(bl.paid_amount || 0);
  });

  // Get PO summary
  const { data: pos } = await supabase
    .from('v2_purchase_orders')
    .select('id, total_amount, status')
    .eq('job_id', jobId)
    .is('deleted_at', null);

  const poSummary = {
    total_count: pos?.length || 0,
    total_amount: 0,
    open_count: 0,
    closed_count: 0
  };
  (pos || []).forEach(po => {
    poSummary.total_amount += parseFloat(po.total_amount || 0);
    if (po.status === 'open') poSummary.open_count++;
    else if (po.status === 'closed') poSummary.closed_count++;
  });

  // Get invoice summary
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, amount, status')
    .eq('job_id', jobId)
    .is('deleted_at', null);

  const invoiceSummary = {
    total_count: invoices?.length || 0,
    total_amount: 0,
    by_status: {
      received: { count: 0, amount: 0 },
      needs_approval: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      in_draw: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 }
    }
  };
  (invoices || []).forEach(inv => {
    const amount = parseFloat(inv.amount || 0);
    invoiceSummary.total_amount += amount;
    if (invoiceSummary.by_status[inv.status]) {
      invoiceSummary.by_status[inv.status].count++;
      invoiceSummary.by_status[inv.status].amount += amount;
    }
  });

  // Get draws summary
  const { data: draws } = await supabase
    .from('v2_draws')
    .select('id, total_amount, status, funded_amount')
    .eq('job_id', jobId);

  const drawSummary = {
    total_count: draws?.length || 0,
    total_drawn: 0,
    total_funded: 0,
    draft_count: 0,
    submitted_count: 0,
    funded_count: 0
  };
  (draws || []).forEach(d => {
    drawSummary.total_drawn += parseFloat(d.total_amount || 0);
    drawSummary.total_funded += parseFloat(d.funded_amount || 0);
    if (d.status === 'draft') drawSummary.draft_count++;
    else if (d.status === 'submitted') drawSummary.submitted_count++;
    else if (d.status === 'funded') drawSummary.funded_count++;
  });

  // Calculate completion percentage
  const contractAmount = parseFloat(job.contract_amount || 0);
  const completionPercent = contractAmount > 0
    ? Math.min(100, Math.round((budget.billed / contractAmount) * 100))
    : 0;

  res.json({
    contract_amount: contractAmount,
    budget,
    purchase_orders: poSummary,
    invoices: invoiceSummary,
    draws: drawSummary,
    completion_percent: completionPercent
  });
}));

// Get job statistics
router.get('/:id/stats', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Get job
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  // Get invoices
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('amount, status')
    .eq('job_id', jobId)
    .is('deleted_at', null);

  const stats = {
    total_invoices: invoices?.length || 0,
    total_billed: 0,
    by_status: {
      received: 0,
      needs_approval: 0,
      approved: 0,
      in_draw: 0,
      paid: 0
    }
  };

  (invoices || []).forEach(inv => {
    stats.total_billed += parseFloat(inv.amount || 0);
    if (stats.by_status[inv.status] !== undefined) {
      stats.by_status[inv.status]++;
    }
  });

  res.json(stats);
}));

// ============================================================
// JOB HUB - UNIFIED DASHBOARD
// ============================================================

// Get comprehensive job hub data
router.get('/:id/hub', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Get job details
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('*')
    .eq('id', jobId)
    .is('deleted_at', null)
    .single();

  if (jobError || !job) throw notFoundError('job', jobId);

  // Run all queries in parallel
  const [
    invoicesResult,
    posResult,
    drawsResult,
    milestonesResult,
    budgetResult,
    warrantiesResult,
    punchListResult,
    contactsResult,
    contractsResult,
    activityResult
  ] = await Promise.all([
    // Invoices
    supabase
      .from('v2_invoices')
      .select('id, amount, status')
      .eq('job_id', jobId)
      .is('deleted_at', null),

    // Purchase Orders
    supabase
      .from('v2_purchase_orders')
      .select('id, total_amount, status')
      .eq('job_id', jobId)
      .is('deleted_at', null),

    // Draws
    supabase
      .from('v2_draws')
      .select('id, draw_number, total_amount, status')
      .eq('job_id', jobId),

    // Milestones
    supabase
      .from('v2_job_milestones')
      .select('id, name, status, target_date')
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .order('sort_order'),

    // Budget
    supabase
      .from('v2_budget_lines')
      .select('budgeted_amount, committed_amount, billed_amount, paid_amount')
      .eq('job_id', jobId),

    // Warranties
    supabase
      .from('v2_warranties')
      .select('id, name, status, end_date')
      .eq('job_id', jobId)
      .is('deleted_at', null),

    // Punch list
    supabase
      .from('v2_punch_list_items')
      .select('id, status, priority')
      .eq('job_id', jobId)
      .is('deleted_at', null),

    // Contacts linked to job
    supabase
      .from('v2_contact_jobs')
      .select(`
        role,
        contact:v2_contacts(id, first_name, last_name, title, email, phone)
      `)
      .eq('job_id', jobId),

    // Contracts
    supabase
      .from('v2_contracts')
      .select('id, name, contract_type, status, signature_status, contract_amount')
      .eq('job_id', jobId)
      .is('deleted_at', null),

    // Recent activity
    supabase
      .from('v2_job_activity')
      .select('action, performed_by, created_at, notes')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  const invoices = invoicesResult.data || [];
  const pos = posResult.data || [];
  const draws = drawsResult.data || [];
  const milestones = milestonesResult.data || [];
  const budgetLines = budgetResult.data || [];
  const warranties = warrantiesResult.data || [];
  const punchList = punchListResult.data || [];
  const contacts = contactsResult.data || [];
  const contracts = contractsResult.data || [];
  const activity = activityResult.data || [];

  // Calculate summaries
  const invoiceSummary = {
    total: invoices.length,
    total_amount: invoices.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0),
    needs_attention: invoices.filter(i => ['received', 'needs_approval'].includes(i.status)).length,
    approved: invoices.filter(i => i.status === 'approved').length
  };

  const poSummary = {
    total: pos.length,
    total_amount: pos.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
    open: pos.filter(p => p.status === 'open').length
  };

  const drawSummary = {
    total: draws.length,
    total_drawn: draws.reduce((sum, d) => sum + parseFloat(d.total_amount || 0), 0),
    current_draw: draws.find(d => d.status === 'draft')
  };

  const milestoneSummary = {
    total: milestones.length,
    completed: milestones.filter(m => m.status === 'completed').length,
    in_progress: milestones.filter(m => m.status === 'in_progress').length,
    upcoming: milestones.filter(m => m.status === 'pending').slice(0, 3)
  };

  const budgetSummary = {
    budgeted: budgetLines.reduce((sum, b) => sum + parseFloat(b.budgeted_amount || 0), 0),
    committed: budgetLines.reduce((sum, b) => sum + parseFloat(b.committed_amount || 0), 0),
    billed: budgetLines.reduce((sum, b) => sum + parseFloat(b.billed_amount || 0), 0),
    paid: budgetLines.reduce((sum, b) => sum + parseFloat(b.paid_amount || 0), 0)
  };

  const warrantySummary = {
    total: warranties.length,
    active: warranties.filter(w => w.status === 'active').length,
    expiring_soon: warranties.filter(w => {
      if (w.status !== 'active' || !w.end_date) return false;
      const endDate = new Date(w.end_date);
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      return endDate <= thirtyDays;
    }).length
  };

  const punchListSummary = {
    total: punchList.length,
    open: punchList.filter(p => p.status === 'open').length,
    completed: punchList.filter(p => ['completed', 'verified'].includes(p.status)).length,
    critical: punchList.filter(p => p.priority === 'critical').length
  };

  const contractSummary = {
    total: contracts.length,
    active: contracts.filter(c => c.status === 'active').length,
    pending_signature: contracts.filter(c => ['pending_signature', 'pending_internal'].includes(c.signature_status)).length,
    total_value: contracts.reduce((sum, c) => sum + parseFloat(c.contract_amount || 0), 0)
  };

  // Calculate overall progress
  const contractAmount = parseFloat(job.contract_amount || 0);
  const overallProgress = contractAmount > 0
    ? Math.min(100, Math.round((budgetSummary.billed / contractAmount) * 100))
    : (milestoneSummary.total > 0
      ? Math.round((milestoneSummary.completed / milestoneSummary.total) * 100)
      : 0);

  res.json({
    job,
    summary: {
      contract_amount: contractAmount,
      overall_progress: overallProgress,
      status: job.status
    },
    invoices: invoiceSummary,
    purchase_orders: poSummary,
    draws: drawSummary,
    milestones: milestoneSummary,
    budget: budgetSummary,
    warranties: warrantySummary,
    punch_list: punchListSummary,
    contracts: contractSummary,
    contacts: contacts.map(c => ({
      ...c.contact,
      role: c.role
    })).filter(c => c.id),
    recent_activity: activity
  });
}));

// ============================================================
// SPECS ENDPOINTS
// ============================================================

// Update job specifications
router.patch('/:id/specs', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // List of allowed spec fields (comprehensive list from migration-035 and 036)
  const allowedFields = [
      // Basic building
      'sqft_conditioned', 'sqft_total', 'sqft_garage', 'sqft_covered',
      'lot_size_sqft', 'lot_size_acres', 'bedrooms', 'bathrooms', 'half_baths',
      'stories', 'garage_spaces', 'ac_units', 'ac_tonnage', 'pool_type',
      'construction_type', 'foundation_type', 'roof_type', 'exterior_finish',
      'year_built', 'zoning', 'flood_zone', 'parcel_id', 'legal_description',
      'architect', 'engineer', 'permit_number', 'permit_date',
      'estimated_start', 'estimated_completion', 'actual_start', 'actual_completion',
      'specs_notes', 'specs_extracted_at', 'specs_source_document_id', 'specs_ai_confidence',
      'custom_specs',

      // Structural specs
      'struct_foundation_depth', 'struct_foundation_width', 'struct_pier_count',
      'struct_pier_depth', 'struct_pier_diameter', 'struct_concrete_psi',
      'struct_concrete_yards', 'struct_rebar_tons', 'struct_steel_beams',
      'struct_steel_columns', 'struct_steel_tonnage', 'struct_wood_beam_count',
      'struct_lvl_beam_count', 'struct_truss_count', 'struct_truss_span_max',
      'struct_roof_pitch', 'struct_wall_framing', 'struct_sheathing_type',
      'struct_wind_speed', 'struct_exposure_category', 'struct_seismic_category',
      'struct_live_load_floor', 'struct_live_load_roof', 'struct_notes',

      // Windows & Doors
      'windows_total_count', 'windows_impact_rated', 'windows_manufacturer',
      'windows_frame_material', 'windows_glass_type', 'windows_total_sqft', 'windows_schedule',
      'doors_exterior_count', 'doors_interior_count', 'doors_garage_count',
      'doors_garage_width', 'doors_impact_rated', 'doors_manufacturer', 'doors_schedule',

      // Room details & finishes
      'rooms_schedule', 'ceiling_height_main', 'ceiling_height_max',
      'flooring_tile_sqft', 'flooring_wood_sqft', 'flooring_carpet_sqft', 'flooring_other_sqft',
      'countertop_material', 'countertop_linear_ft', 'cabinet_linear_ft',
      'fireplace_count', 'fireplace_type',

      // Plumbing
      'plumb_fixtures_total', 'plumb_toilets', 'plumb_sinks', 'plumb_showers', 'plumb_tubs',
      'plumb_water_heater_type', 'plumb_water_heater_gallons', 'plumb_water_heater_count',
      'plumb_gas_line', 'plumb_water_source', 'plumb_sewer_type', 'plumb_pipe_material',
      'plumb_hose_bibs', 'plumb_notes',

      // Electrical
      'elec_service_amps', 'elec_panel_count', 'elec_circuits_count', 'elec_outlets_count',
      'elec_switches_count', 'elec_lighting_fixtures', 'elec_recessed_lights',
      'elec_ceiling_fans', 'elec_240v_circuits', 'elec_gfci_locations', 'elec_smoke_detectors',
      'elec_generator_ready', 'elec_solar_ready', 'elec_ev_charger_ready',
      'elec_low_voltage_runs', 'elec_notes',

      // HVAC
      'hvac_system_type', 'hvac_fuel_type', 'hvac_zones', 'hvac_duct_linear_ft',
      'hvac_return_count', 'hvac_supply_count', 'hvac_thermostat_count',
      'hvac_filter_size', 'hvac_seer_rating', 'hvac_notes',

      // Exterior & Site
      'ext_siding_sqft', 'ext_stucco_sqft', 'ext_brick_sqft', 'ext_stone_sqft',
      'ext_soffit_linear_ft', 'ext_fascia_linear_ft', 'ext_gutter_linear_ft',
      'ext_driveway_sqft', 'ext_driveway_material', 'ext_sidewalk_sqft',
      'ext_patio_sqft', 'ext_deck_sqft', 'ext_fence_linear_ft', 'ext_fence_type',
      'ext_retaining_wall_ft', 'ext_irrigation_zones', 'ext_pool_sqft',
      'ext_pool_equipment', 'ext_notes',

      // Roofing
      'roof_sqft', 'roof_squares', 'roof_material', 'roof_manufacturer',
      'roof_warranty_years', 'roof_underlayment', 'roof_valleys_count',
      'roof_hips_ridges_ft', 'roof_penetrations', 'roof_skylights', 'roof_notes',

      // Insulation
      'insul_wall_type', 'insul_wall_r_value', 'insul_ceiling_type',
      'insul_ceiling_r_value', 'insul_floor_type', 'insul_floor_r_value', 'insul_notes',

      // Appliances
      'appl_range_type', 'appl_oven_type', 'appl_cooktop', 'appl_vent_hood_type',
      'appl_refrigerator_type', 'appl_dishwasher', 'appl_disposal',
      'appl_microwave_type', 'appl_washer_dryer_hookup', 'appl_washer_dryer_gas', 'appl_notes',

      // Code & Permits
      'code_building_code', 'code_energy_code', 'code_occupancy_type',
      'code_construction_type', 'code_fire_sprinklers', 'code_ada_required',
      'setback_front', 'setback_rear', 'setback_left', 'setback_right',
      'lot_coverage_allowed', 'lot_coverage_actual', 'height_limit', 'height_actual',

      // Team
      'team_architect_firm', 'team_architect_phone', 'team_architect_license',
      'team_engineer_firm', 'team_engineer_phone', 'team_engineer_license',
      'team_surveyor', 'team_geotech', 'team_interior_designer',

      // Materials
      'mat_framing_bf', 'mat_drywall_sheets', 'mat_drywall_sqft',
      'mat_paint_sqft', 'mat_trim_linear_ft', 'mat_baseboard_linear_ft', 'mat_crown_linear_ft',

      // Schedules (JSONB)
      'schedule_windows', 'schedule_doors', 'schedule_rooms',
      'schedule_fixtures', 'schedule_electrical', 'schedule_equipment',
      'extracted_notes_arch', 'extracted_notes_struct', 'extracted_notes_mep'
    ];

    // Filter to only allowed fields
    const updateData = {};
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        updateData[key] = value;
      }
    }

    // Get current values for activity log
    const { data: currentJob } = await supabase
      .from('v2_jobs')
      .select('*')
      .eq('id', id)
      .single();

  if (!currentJob) {
    throw notFoundError('job', id);
  }

  // Track changes for activity log
  const fieldChanges = {};
  for (const [key, newValue] of Object.entries(updateData)) {
    const oldValue = currentJob[key];
    if (oldValue !== newValue) {
      fieldChanges[key] = { old: oldValue, new: newValue };
    }
  }

  // Update job
  const { data, error } = await supabase
    .from('v2_jobs')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity if changes were made
  if (Object.keys(fieldChanges).length > 0) {
    const action = updates.specs_extracted_at ? 'ai_extracted' : 'updated';
    try {
      await supabase.from('v2_job_specs_activity').insert({
        job_id: id,
        action,
        performed_by: updates.updated_by || 'User',
        field_changes: fieldChanges,
        source_document_id: updates.specs_source_document_id || null,
        ai_confidence: updates.specs_ai_confidence || null
      });
    } catch (actErr) {
      console.error('Failed to log specs activity:', actErr);
    }
  }

  res.json(data);
}));

// Get specs activity history
router.get('/:id/specs/activity', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_job_specs_activity')
    .select('*')
    .eq('job_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
}));

// ============================================================
// AI EXTRACTION ENDPOINT
// ============================================================

// Extract specs from a single plan document using AI
router.post('/extract-specs', asyncHandler(async (req, res) => {
  const { job_id, document_id, document_url } = req.body;

  if (!job_id || !document_url) {
    throw new AppError('VALIDATION_FAILED', 'job_id and document_url are required');
  }

  // Call AI processor
  const result = await extractSpecsFromPlans(document_url, document_id);

  res.json({
    success: true,
    specs: result.specs,
    confidence: result.confidence || result.specs?._confidence || 0.5,
    document_id: document_id,
    notes: result.specs?._notes || null,
    pages_analyzed: result.specs?._pages_analyzed || null
  });
}));

// Extract specs from ALL plan documents for a job
router.post('/:id/extract-all-specs', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Get all plan documents for this job
  const { data: plans, error: plansError } = await supabase
    .from('v2_documents')
    .select('id, name, file_url')
    .eq('job_id', jobId)
    .eq('category', 'plans')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (plansError) throw new AppError('DATABASE_ERROR', plansError.message, { code: plansError.code });

  if (!plans || plans.length === 0) {
    throw notFoundError('plan documents', jobId);
  }

  console.log(`[SpecExtractor] Analyzing ${plans.length} plan documents for job ${jobId}`);

  // Extract specs from all plans
  const documents = plans.map(p => ({
    id: p.id,
    name: p.name,
    url: p.file_url
  }));

  const result = await extractSpecsFromMultipleDocuments(documents);

  res.json({
    success: true,
    specs: result.specs,
    confidence: result.confidence,
    documents_analyzed: plans.length,
    document_names: plans.map(p => p.name),
    notes: result.specs?._notes || null
  });
}));

// ============================================================
// JOB MILESTONES / TIMELINE
// ============================================================

// Get milestones for a job
router.get('/:id/milestones', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;

  let query = supabase
    .from('v2_job_milestones')
    .select('*')
    .eq('job_id', id)
    .is('deleted_at', null)
    .order('sort_order')
    .order('target_date');

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate overall progress
  const total = data?.length || 0;
  const completed = data?.filter(m => m.status === 'completed').length || 0;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  res.json({
    milestones: data || [],
    summary: {
      total,
      completed,
      pending: data?.filter(m => m.status === 'pending').length || 0,
      in_progress: data?.filter(m => m.status === 'in_progress').length || 0,
      delayed: data?.filter(m => m.status === 'delayed').length || 0,
      progress_percent: progressPercent
    }
  });
}));

// Get milestone timeline summary for a job
router.get('/:id/timeline', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name, estimated_start, estimated_completion, actual_start, actual_completion, phase_current')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (jobError || !job) throw notFoundError('job', id);

  // Get milestones
  const { data: milestones, error } = await supabase
    .from('v2_job_milestones')
    .select('*')
    .eq('job_id', id)
    .is('deleted_at', null)
    .order('sort_order')
    .order('target_date');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Group by phase
  const phases = {};
  (milestones || []).forEach(m => {
    const phase = m.phase_number || 0;
    if (!phases[phase]) {
      phases[phase] = { milestones: [], completed: 0, total: 0 };
    }
    phases[phase].milestones.push(m);
    phases[phase].total++;
    if (m.status === 'completed') phases[phase].completed++;
  });

  // Calculate phase progress
  Object.keys(phases).forEach(p => {
    phases[p].progress_percent = phases[p].total > 0
      ? Math.round((phases[p].completed / phases[p].total) * 100)
      : 0;
  });

  const total = milestones?.length || 0;
  const completed = milestones?.filter(m => m.status === 'completed').length || 0;

  res.json({
    job,
    timeline: {
      start_date: job.actual_start || job.estimated_start,
      end_date: job.actual_completion || job.estimated_completion,
      current_phase: job.phase_current,
      overall_progress: total > 0 ? Math.round((completed / total) * 100) : 0,
      phases,
      milestones: milestones || []
    }
  });
}));

// Create a milestone
router.post('/:id/milestones', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    milestone_type,
    target_date,
    phase_number,
    depends_on_id,
    assigned_to,
    sort_order,
    notes,
    created_by
  } = req.body;

  if (!name || !milestone_type) {
    throw new AppError('VALIDATION_FAILED', 'Name and milestone type are required');
  }

  const { data, error } = await supabase
    .from('v2_job_milestones')
    .insert({
      job_id: id,
      name,
      description,
      milestone_type,
      target_date,
      phase_number,
      depends_on_id,
      assigned_to,
      sort_order: sort_order || 0,
      notes,
      created_by: created_by || 'User',
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ milestone: data });
}));

// Update a milestone
router.patch('/:jobId/milestones/:milestoneId', asyncHandler(async (req, res) => {
  const { milestoneId } = req.params;
  const updates = { ...req.body };

  delete updates.id;
  delete updates.job_id;
  delete updates.created_at;
  delete updates.deleted_at;

  // If marking as completed, set completed_at
  if (updates.status === 'completed' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
    updates.progress_percent = 100;
  }

  const { data, error } = await supabase
    .from('v2_job_milestones')
    .update(updates)
    .eq('id', milestoneId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw notFoundError('milestone', milestoneId);

  res.json({ milestone: data });
}));

// Complete a milestone
router.post('/:jobId/milestones/:milestoneId/complete', asyncHandler(async (req, res) => {
  const { milestoneId } = req.params;
  const { completion_notes, completed_by, actual_date } = req.body;

  const { data, error } = await supabase
    .from('v2_job_milestones')
    .update({
      status: 'completed',
      progress_percent: 100,
      actual_date: actual_date || new Date().toISOString().split('T')[0],
      completed_at: new Date().toISOString(),
      completed_by: completed_by || 'User',
      completion_notes
    })
    .eq('id', milestoneId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw notFoundError('milestone', milestoneId);

  // Update job milestone progress
  const { data: allMilestones } = await supabase
    .from('v2_job_milestones')
    .select('status')
    .eq('job_id', data.job_id)
    .is('deleted_at', null);

  const total = allMilestones?.length || 0;
  const completed = allMilestones?.filter(m => m.status === 'completed').length || 0;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  await supabase
    .from('v2_jobs')
    .update({ milestone_progress: progressPercent })
    .eq('id', data.job_id);

  res.json({ milestone: data });
}));

// Delete a milestone (soft)
router.delete('/:jobId/milestones/:milestoneId', asyncHandler(async (req, res) => {
  const { milestoneId } = req.params;

  const { data, error } = await supabase
    .from('v2_job_milestones')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', milestoneId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw notFoundError('milestone', milestoneId);

  res.json({ success: true });
}));

// Bulk create milestones from template
router.post('/:id/milestones/bulk', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { milestones, created_by } = req.body;

  if (!Array.isArray(milestones) || milestones.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'Milestones array is required');
  }

  const toInsert = milestones.map((m, idx) => ({
    job_id: id,
    name: m.name,
    description: m.description,
    milestone_type: m.milestone_type || 'custom',
    target_date: m.target_date,
    phase_number: m.phase_number,
    sort_order: m.sort_order ?? idx,
    assigned_to: m.assigned_to,
    notes: m.notes,
    created_by: created_by || 'User',
    status: 'pending'
  }));

  const { data, error } = await supabase
    .from('v2_job_milestones')
    .insert(toInsert)
    .select();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ milestones: data, count: data.length });
}));

// ============================================================
// JOB SPECIFICATIONS (Performance Intelligence)
// ============================================================

// Get job specifications for performance tracking
router.get('/:id/specifications', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_job_specifications')
    .select('*')
    .eq('job_id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  // If no specs exist, return empty with job info
  if (!data) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('id, name')
      .eq('id', id)
      .single();

    if (!job) throw notFoundError('job', id);

    return res.json({
      job_id: id,
      job_name: job.name,
      specifications: null,
      message: 'No specifications set for this job'
    });
  }

  res.json(data);
}));

// Create or update job specifications
router.post('/:id/specifications', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (jobError || !job) throw notFoundError('job', id);

  // Define allowed specification fields
  const allowedFields = [
    // Square Footages
    'total_sf', 'garage_sf', 'porch_sf', 'deck_sf',
    // Room Counts
    'bedroom_count', 'bathroom_count', 'half_bath_count',
    // Trade-specific metrics
    'tile_sf', 'hardwood_sf', 'carpet_sf', 'drywall_sf', 'paint_sf',
    'roofing_squares', 'exterior_siding_sf', 'concrete_yards', 'linear_ft_trim',
    'window_count', 'door_count', 'exterior_door_count',
    // Plumbing
    'plumbing_fixture_count',
    // Electrical
    'electrical_outlet_count', 'electrical_switch_count', 'electrical_fixture_count',
    // HVAC
    'hvac_tonnage', 'hvac_zone_count',
    // Complexity factors
    'stories', 'has_basement', 'has_pool', 'is_custom_home', 'complexity_rating',
    // Notes
    'notes'
  ];

  // Build specification data
  const specData = { job_id: id };
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      specData[field] = req.body[field];
    }
  }

  // Check if specs already exist
  const { data: existing } = await supabase
    .from('v2_job_specifications')
    .select('id')
    .eq('job_id', id)
    .single();

  let data, error;

  if (existing) {
    // Update existing
    specData.updated_at = new Date().toISOString();
    const result = await supabase
      .from('v2_job_specifications')
      .update(specData)
      .eq('job_id', id)
      .select()
      .single();
    data = result.data;
    error = result.error;
  } else {
    // Insert new
    const result = await supabase
      .from('v2_job_specifications')
      .insert(specData)
      .select()
      .single();
    data = result.data;
    error = result.error;
  }

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity
  await supabase.from('v2_job_activity').insert({
    job_id: id,
    action: existing ? 'specifications_updated' : 'specifications_created',
    performed_by: req.body.updated_by || 'User',
    notes: 'Job specifications for performance tracking updated'
  });

  res.status(existing ? 200 : 201).json(data);
}));

// Update job specifications (partial update)
router.patch('/:id/specifications', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if specs exist
  const { data: existing, error: existingError } = await supabase
    .from('v2_job_specifications')
    .select('*')
    .eq('job_id', id)
    .single();

  if (existingError && existingError.code === 'PGRST116') {
    throw new AppError('NOT_FOUND', 'Job specifications not found. Use POST to create.');
  }

  // Define allowed fields
  const allowedFields = [
    'total_sf', 'garage_sf', 'porch_sf', 'deck_sf',
    'bedroom_count', 'bathroom_count', 'half_bath_count',
    'tile_sf', 'hardwood_sf', 'carpet_sf', 'drywall_sf', 'paint_sf',
    'roofing_squares', 'exterior_siding_sf', 'concrete_yards', 'linear_ft_trim',
    'window_count', 'door_count', 'exterior_door_count',
    'plumbing_fixture_count',
    'electrical_outlet_count', 'electrical_switch_count', 'electrical_fixture_count',
    'hvac_tonnage', 'hvac_zone_count',
    'stories', 'has_basement', 'has_pool', 'is_custom_home', 'complexity_rating',
    'notes'
  ];

  // Build update data
  const updates = { updated_at: new Date().toISOString() };
  const changes = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined && req.body[field] !== existing[field]) {
      updates[field] = req.body[field];
      changes[field] = { old: existing[field], new: req.body[field] };
    }
  }

  if (Object.keys(changes).length === 0) {
    return res.json(existing); // No changes
  }

  const { data, error } = await supabase
    .from('v2_job_specifications')
    .update(updates)
    .eq('job_id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity
  await supabase.from('v2_job_activity').insert({
    job_id: id,
    action: 'specifications_updated',
    performed_by: req.body.updated_by || 'User',
    field_changes: changes
  });

  res.json(data);
}));

// Get scope estimates for a job based on specifications
router.get('/:id/scope-estimates', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Use the view we created
  const { data, error } = await supabase
    .from('v2_scope_estimates')
    .select('*')
    .eq('job_id', id)
    .gt('scope_quantity', 0);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Calculate totals
  const totalDays = (data || []).reduce((sum, e) => sum + (parseFloat(e.estimated_days) || 0), 0);

  res.json({
    job_id: id,
    estimates: data || [],
    summary: {
      total_scopes: (data || []).length,
      total_estimated_days: Math.ceil(totalDays)
    }
  });
}));

// ============================================================
// SYNC/RECONCILIATION ENDPOINTS
// ============================================================

const budgetSync = require('../services/budget-sync');
const invoiceSync = require('../services/invoice-sync');
const coSync = require('../services/co-sync');
const scheduleSync = require('../services/schedule-sync');

/**
 * POST /api/jobs/:id/sync-budget
 * Recalculate all committed amounts for a job
 */
router.post('/:id/sync-budget', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await budgetSync.syncJobBudget(id);

  res.json({
    success: true,
    message: `Synced ${result.synced} cost codes`,
    ...result,
  });
}));

/**
 * POST /api/jobs/:id/sync-cos
 * Recalculate all CO amounts for a job
 */
router.post('/:id/sync-cos', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const result = await coSync.syncJobCOs(id);

  res.json({
    success: true,
    message: `Synced ${result.posUpdated} POs and ${result.costCodesUpdated} cost codes`,
    ...result,
  });
}));

/**
 * POST /api/jobs/:id/sync-schedule
 * Recalculate all schedule task progress for a job
 */
router.post('/:id/sync-schedule', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const results = await scheduleSync.syncJobSchedule(id);

  res.json({
    success: true,
    message: `Updated ${results.length} tasks`,
    tasks: results,
  });
}));

/**
 * GET /api/jobs/:id/schedule-progress
 * Get schedule progress summary for a job
 */
router.get('/:id/schedule-progress', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const summary = await scheduleSync.getJobScheduleProgress(id);

  res.json(summary);
}));

/**
 * POST /api/jobs/:id/sync-all
 * Full reconciliation - sync budget, COs, and schedule
 */
router.post('/:id/sync-all', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const budgetResult = await budgetSync.syncJobBudget(id);
  const coResult = await coSync.syncJobCOs(id);
  const scheduleResults = await scheduleSync.syncJobSchedule(id);

  res.json({
    success: true,
    message: 'Full reconciliation complete',
    budget: budgetResult,
    changeOrders: coResult,
    schedule: { tasksUpdated: scheduleResults.length },
  });
}));

// ============================================================
// JOB LOCATIONS (for QR code scanning) - Phase 5 Mobile
// ============================================================

/**
 * GET /api/jobs/:id/locations
 * Get all locations for a job
 */
router.get('/:id/locations', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: locations, error } = await supabase
    .from('v2_job_locations')
    .select('*')
    .eq('job_id', id)
    .order('floor', { ascending: true, nullsFirst: true })
    .order('room', { ascending: true, nullsFirst: true })
    .order('name', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(locations || []);
}));

/**
 * POST /api/jobs/:id/locations
 * Create a new location with auto-generated QR code
 */
router.post('/:id/locations', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, floor, room, qr_code } = req.body;

  if (!name) {
    throw new AppError('VALIDATION_ERROR', 'Location name is required');
  }

  // Get job to create QR code
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', id)
    .single();

  if (jobError || !job) {
    throw new AppError('NOT_FOUND', 'Job not found');
  }

  // Generate QR code if not provided
  let finalQrCode = qr_code;
  if (!finalQrCode) {
    // Create a unique QR code based on job + location name
    const jobPrefix = job.name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 12).toUpperCase();
    const locationPart = name.replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
    const baseName = `${jobPrefix}-${locationPart}`;

    // Check for uniqueness and add suffix if needed
    let counter = 0;
    finalQrCode = baseName;
    let exists = true;

    while (exists) {
      const { data: existing } = await supabase
        .from('v2_job_locations')
        .select('id')
        .eq('qr_code', finalQrCode)
        .single();

      if (!existing) {
        exists = false;
      } else {
        counter++;
        finalQrCode = `${baseName}-${counter}`;
      }
    }
  }

  const { data: location, error } = await supabase
    .from('v2_job_locations')
    .insert({
      job_id: id,
      name,
      description: description || null,
      floor: floor || null,
      room: room || null,
      qr_code: finalQrCode
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new AppError('VALIDATION_ERROR', 'QR code already exists');
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.status(201).json(location);
}));

/**
 * PATCH /api/jobs/:jobId/locations/:locationId
 * Update a location
 */
router.patch('/:jobId/locations/:locationId', asyncHandler(async (req, res) => {
  const { locationId } = req.params;
  const { name, description, floor, room } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (floor !== undefined) updates.floor = floor;
  if (room !== undefined) updates.room = room;

  const { data: location, error } = await supabase
    .from('v2_job_locations')
    .update(updates)
    .eq('id', locationId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(location);
}));

/**
 * DELETE /api/jobs/:jobId/locations/:locationId
 * Delete a location
 */
router.delete('/:jobId/locations/:locationId', asyncHandler(async (req, res) => {
  const { locationId } = req.params;

  const { error } = await supabase
    .from('v2_job_locations')
    .delete()
    .eq('id', locationId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: 'Location deleted' });
}));

// ============================================================
// Job Team Management
// ============================================================

// Get job team members
router.get('/:id/team', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_job_users')
    .select(`
      id,
      role,
      created_at,
      user:v2_users (
        id, email, first_name, last_name, role, avatar_url
      )
    `)
    .eq('job_id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(data || []);
}));

// Assign a user to a job
router.post('/:id/team', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { user_id, role = 'member' } = req.body;
  const builderId = getBuilderId(req);

  if (!user_id) {
    throw new AppError('VALIDATION_ERROR', 'user_id is required');
  }

  const { data, error } = await supabase
    .from('v2_job_users')
    .upsert({
      job_id: id,
      user_id,
      role,
      builder_id: builderId
    }, { onConflict: 'job_id,user_id' })
    .select(`
      id,
      role,
      created_at,
      user:v2_users (
        id, email, first_name, last_name, role
      )
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await invalidateJobsCache();
  res.json(data);
}));

// Remove a user from a job
router.delete('/:id/team/:userId', asyncHandler(async (req, res) => {
  const { id, userId } = req.params;

  const { error } = await supabase
    .from('v2_job_users')
    .delete()
    .eq('job_id', id)
    .eq('user_id', userId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await invalidateJobsCache();
  res.json({ success: true, message: 'User removed from job' });
}));

// ============================================================
// BUDGET SUMMARY & OPERATIONS (moved from index.js)
// ============================================================

// Get full budget summary for a job (for Budget page)
router.get('/:id/budget-summary', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Get job info
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  // Get budget lines with cost code info
  const { data: budgetLines, error: budgetError } = await supabase
    .from('v2_budget_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId);

  if (budgetError) throw new AppError('DATABASE_ERROR', budgetError.message);

  // Get all cost codes (for lines without budget)
  const { data: allCostCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .order('code');

  // Get invoices that are linked to job change orders (PCCOs) - these are CO work, not base budget
  const { data: coInvoiceLinks } = await supabase
    .from('v2_change_order_invoices')
    .select(`
      invoice_id,
      change_order:v2_job_change_orders!inner(job_id)
    `)
    .eq('change_order.job_id', jobId);

  const coInvoiceIds = new Set((coInvoiceLinks || []).map(link => link.invoice_id));

  // Get allocations from all invoices for this job (include po_id to check if linked to PO)
  const { data: allocations } = await supabase
    .from('v2_invoice_allocations')
    .select(`
      amount,
      cost_code_id,
      cost_code:v2_cost_codes(id, code, name),
      invoice:v2_invoices!inner(id, job_id, status, po_id)
    `)
    .eq('invoice.job_id', jobId);

  // Filter out allocations from invoices linked to change orders (base budget only)
  const baseBudgetAllocations = (allocations || []).filter(a => !coInvoiceIds.has(a.invoice.id));

  // Get committed amounts from POs (only sent or approved POs commit to budget)
  const { data: poLines } = await supabase
    .from('v2_po_line_items')
    .select(`
      amount,
      cost_code_id,
      po:v2_purchase_orders!inner(job_id, status, status_detail, approval_status)
    `)
    .eq('po.job_id', jobId)
    .neq('po.status', 'cancelled')
    .or('status_detail.eq.sent,status_detail.eq.approved,approval_status.eq.approved', { foreignTable: 'po' });

  // Build actuals, committed, and pending by cost code
  const actualsByCostCode = {};
  const committedByCostCode = {};
  const pendingByCostCode = {};
  const poAmountByCostCode = {};

  // First, add PO line items to committed and track PO coverage
  if (poLines) {
    poLines.forEach(pl => {
      const ccId = pl.cost_code_id;
      if (!committedByCostCode[ccId]) committedByCostCode[ccId] = 0;
      if (!poAmountByCostCode[ccId]) poAmountByCostCode[ccId] = 0;
      const amount = parseFloat(pl.amount) || 0;
      committedByCostCode[ccId] += amount;
      poAmountByCostCode[ccId] += amount;
    });
  }

  // Process invoice allocations (base budget only - excludes CO invoices)
  if (baseBudgetAllocations) {
    baseBudgetAllocations.forEach(a => {
      const ccId = a.cost_code_id;
      if (!actualsByCostCode[ccId]) {
        actualsByCostCode[ccId] = { billed: 0, paid: 0, approved: 0, costCode: a.cost_code };
      }

      const amount = parseFloat(a.amount) || 0;

      if (['ready_for_approval', 'needs_review'].includes(a.invoice.status)) {
        if (!pendingByCostCode[ccId]) pendingByCostCode[ccId] = 0;
        pendingByCostCode[ccId] += amount;
      }

      if (['approved', 'in_draw'].includes(a.invoice.status)) {
        actualsByCostCode[ccId].approved += amount;
        actualsByCostCode[ccId].billed += amount;
        if (!a.invoice.po_id) {
          if (!committedByCostCode[ccId]) committedByCostCode[ccId] = 0;
          committedByCostCode[ccId] += amount;
        }
      }

      if (a.invoice.status === 'paid') {
        actualsByCostCode[ccId].paid += amount;
        actualsByCostCode[ccId].billed += amount;
        if (!a.invoice.po_id) {
          if (!committedByCostCode[ccId]) committedByCostCode[ccId] = 0;
          committedByCostCode[ccId] += amount;
        }
      }
    });
  }

  // Build budget map
  const budgetMap = {};
  (budgetLines || []).forEach(bl => {
    budgetMap[bl.cost_code_id] = {
      budgeted: parseFloat(bl.budgeted_amount) || 0,
      costCode: bl.cost_code?.code || '',
      description: bl.cost_code?.name || '',
      category: bl.cost_code?.category || 'Uncategorized',
      closedAt: bl.closed_at || null,
      closedBy: bl.closed_by || null,
      notes: bl.notes || null
    };
  });

  // Build cost code lookup for category info
  const costCodeLookup = {};
  (allCostCodes || []).forEach(cc => {
    costCodeLookup[cc.id] = cc;
  });

  // Include ALL cost codes (not just ones with activity)
  const allCostCodeIds = new Set();
  (allCostCodes || []).forEach(cc => allCostCodeIds.add(cc.id));
  Object.keys(budgetMap).forEach(id => allCostCodeIds.add(id));
  Object.keys(actualsByCostCode).forEach(id => allCostCodeIds.add(id));
  Object.keys(committedByCostCode).forEach(id => allCostCodeIds.add(id));
  Object.keys(pendingByCostCode).forEach(id => allCostCodeIds.add(id));

  // Build result lines
  const hideEmpty = req.query.hideEmpty === 'true';
  const lines = [];
  allCostCodeIds.forEach(ccId => {
    const budget = budgetMap[ccId] || {};
    const actuals = actualsByCostCode[ccId] || { billed: 0, paid: 0, approved: 0 };
    const costCodeInfo = costCodeLookup[ccId] || {};
    const costCode = budget.costCode || costCodeInfo.code || '';
    const description = budget.description || costCodeInfo.name || '';
    const category = budget.category || costCodeInfo.category || 'Uncategorized';

    const budgeted = budget.budgeted || 0;
    const committed = committedByCostCode[ccId] || 0;
    const pending = pendingByCostCode[ccId] || 0;
    const poAmount = poAmountByCostCode[ccId] || 0;
    const hasPOCoverage = poAmount > 0;
    const billed = actuals.billed;
    const paid = actuals.paid;
    const approved = actuals.approved;

    if (hideEmpty && budgeted === 0 && committed === 0 && billed === 0 && paid === 0 && pending === 0) {
      return;
    }

    let projected;
    if (budget.closedAt) {
      projected = committed + pending;
    } else {
      projected = Math.max(budgeted, committed + pending);
    }

    const variance = budgeted - committed - pending;
    const percentComplete = budgeted > 0 ? ((committed + pending) / budgeted) * 100 : 0;

    lines.push({
      costCodeId: ccId,
      costCode,
      description,
      category,
      budgeted,
      committed,
      pending,
      poAmount,
      hasPOCoverage,
      paid,
      approved,
      billed,
      projected,
      variance,
      percentComplete,
      closedAt: budget.closedAt || null,
      closedBy: budget.closedBy || null,
      notes: budget.notes || null
    });
  });

  // Sort by cost code
  lines.sort((a, b) => (a.costCode || '').localeCompare(b.costCode || ''));

  // Calculate totals
  const totals = lines.reduce((acc, line) => ({
    budgeted: acc.budgeted + line.budgeted,
    committed: acc.committed + line.committed,
    pending: acc.pending + line.pending,
    billed: acc.billed + line.billed,
    paid: acc.paid + line.paid,
    projected: acc.projected + line.projected,
    poAmount: acc.poAmount + (line.poAmount || 0),
    budgetWithPO: acc.budgetWithPO + (line.hasPOCoverage ? line.budgeted : 0),
    linesWithPO: acc.linesWithPO + (line.hasPOCoverage ? 1 : 0),
    linesClosed: acc.linesClosed + (line.closedAt ? 1 : 0),
    budgetClosed: acc.budgetClosed + (line.closedAt ? line.budgeted : 0)
  }), { budgeted: 0, committed: 0, pending: 0, billed: 0, paid: 0, projected: 0, poAmount: 0, budgetWithPO: 0, linesWithPO: 0, linesClosed: 0, budgetClosed: 0 });

  totals.variance = totals.budgeted - totals.committed - totals.pending;
  totals.remaining = totals.budgeted - totals.billed;
  totals.percentComplete = totals.budgeted > 0 ? ((totals.committed + totals.pending) / totals.budgeted) * 100 : 0;

  // PO Coverage stats
  totals.totalLines = lines.length;
  totals.poCoveragePercent = totals.budgeted > 0 ? (totals.budgetWithPO / totals.budgeted) * 100 : 0;
  totals.knownCoveragePercent = totals.budgeted > 0 ? ((totals.budgetWithPO + totals.budgetClosed) / totals.budgeted) * 100 : 0;

  // Get PO change orders for this job
  const { data: poChangeOrders } = await supabase
    .from('v2_change_orders')
    .select(`
      id, change_order_number, description, reason, amount_change, status, approved_at, created_at,
      po:v2_purchase_orders!inner(id, po_number, job_id, vendor:v2_vendors(id, name))
    `)
    .eq('po.job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  // Get job-level change orders (PCCOs - Prime Contract Change Orders)
  const { data: jobChangeOrders } = await supabase
    .from('v2_job_change_orders')
    .select('*')
    .eq('job_id', jobId)
    .order('change_order_number');

  // Calculate PO change order totals (only approved ones affect subcontract costs)
  const approvedPOCOs = (poChangeOrders || []).filter(co => co.status === 'approved');
  const poChangeOrderTotal = approvedPOCOs.reduce((sum, co) => sum + (parseFloat(co.amount_change) || 0), 0);

  // Calculate job change order totals (PCCOs - affect contract with owner)
  const approvedPCCOs = (jobChangeOrders || []).filter(co => co.status === 'approved');
  const pccoTotal = approvedPCCOs.reduce((sum, co) => sum + (parseFloat(co.amount) || 0), 0);

  // Totals
  totals.poChangeOrderTotal = poChangeOrderTotal;
  totals.changeOrderTotal = pccoTotal;
  totals.adjustedContract = (parseFloat(job?.contract_amount) || totals.budgeted) + pccoTotal;
  totals.projectedVariance = totals.budgeted - totals.projected;

  res.json({
    job,
    lines,
    totals,
    changeOrders: poChangeOrders || [],
    jobChangeOrders: jobChangeOrders || []
  });
}));

// Get cost code details (invoices, POs) for a specific job and cost code
router.get('/:jobId/cost-code/:costCodeId/details', asyncHandler(async (req, res) => {
  const { jobId, costCodeId } = req.params;

  // Get cost code info
  const { data: costCode, error: ccError } = await supabase
    .from('v2_cost_codes')
    .select('*')
    .eq('id', costCodeId)
    .single();

  if (ccError) throw new AppError('DATABASE_ERROR', ccError.message);

  // Get budget line for this job/cost code
  const { data: budgetLine } = await supabase
    .from('v2_budget_lines')
    .select('*')
    .eq('job_id', jobId)
    .eq('cost_code_id', costCodeId)
    .single();

  // Get invoices with allocations to this cost code for this job
  const { data: ccAllocations, error: allocError } = await supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      notes,
      invoice:v2_invoices!inner(
        id,
        invoice_number,
        invoice_date,
        amount,
        status,
        po_id,
        vendor:v2_vendors(id, name)
      )
    `)
    .eq('job_id', jobId)
    .eq('cost_code_id', costCodeId);

  if (allocError) throw new AppError('DATABASE_ERROR', allocError.message);

  // Get POs with line items for this cost code
  const { data: poLineItems, error: poError } = await supabase
    .from('v2_po_line_items')
    .select(`
      id,
      description,
      amount,
      invoiced_amount,
      po:v2_purchase_orders!inner(
        id,
        po_number,
        description,
        total_amount,
        status,
        status_detail,
        approval_status,
        vendor:v2_vendors(id, name)
      )
    `)
    .eq('po.job_id', jobId)
    .eq('cost_code_id', costCodeId);

  if (poError) throw new AppError('DATABASE_ERROR', poError.message);

  // Calculate totals
  let totalBilled = 0;
  let totalPaid = 0;
  const invoices = [];

  (ccAllocations || []).forEach(a => {
    if (['approved', 'in_draw', 'paid'].includes(a.invoice.status)) {
      totalBilled += parseFloat(a.amount) || 0;
    }
    if (a.invoice.status === 'paid') {
      totalPaid += parseFloat(a.amount) || 0;
    }
    invoices.push({
      id: a.invoice.id,
      invoiceNumber: a.invoice.invoice_number,
      invoiceDate: a.invoice.invoice_date,
      vendorName: a.invoice.vendor?.name || 'Unknown',
      totalAmount: parseFloat(a.invoice.amount) || 0,
      allocatedAmount: parseFloat(a.amount) || 0,
      status: a.invoice.status,
      poId: a.invoice.po_id,
      notes: a.notes
    });
  });

  // Build PO list
  let totalCommitted = 0;
  const pos = [];
  const seenPoIds = new Set();

  (poLineItems || []).forEach(pl => {
    const po = pl.po;
    if (['sent', 'approved'].includes(po.status_detail) || po.approval_status === 'approved') {
      totalCommitted += parseFloat(pl.amount) || 0;
    }

    if (!seenPoIds.has(po.id)) {
      seenPoIds.add(po.id);
      pos.push({
        id: po.id,
        poNumber: po.po_number,
        vendorName: po.vendor?.name || 'Unknown',
        description: po.description,
        totalAmount: parseFloat(po.total_amount) || 0,
        status: po.status,
        statusDetail: po.status_detail,
        lineItems: []
      });
    }

    const poEntry = pos.find(p => p.id === po.id);
    if (poEntry) {
      poEntry.lineItems.push({
        id: pl.id,
        description: pl.description,
        amount: parseFloat(pl.amount) || 0,
        invoicedAmount: parseFloat(pl.invoiced_amount) || 0
      });
    }
  });

  // Calculate line item totals for each PO (just for this cost code)
  pos.forEach(po => {
    po.costCodeAmount = po.lineItems.reduce((sum, li) => sum + li.amount, 0);
    po.costCodeInvoiced = po.lineItems.reduce((sum, li) => sum + li.invoicedAmount, 0);
  });

  res.json({
    costCode: {
      id: costCode.id,
      code: costCode.code,
      name: costCode.name,
      category: costCode.category
    },
    budget: {
      budgeted: parseFloat(budgetLine?.budgeted_amount) || 0,
      committed: totalCommitted,
      billed: totalBilled,
      paid: totalPaid,
      remaining: (parseFloat(budgetLine?.budgeted_amount) || 0) - totalBilled
    },
    invoices,
    purchaseOrders: pos
  });
}));

// Close out a budget line (lock in savings)
router.post('/:jobId/budget/:costCodeId/close', asyncHandler(async (req, res) => {
  const { jobId, costCodeId } = req.params;
  const { closed_by, notes } = req.body;

  const { data: existing } = await supabase
    .from('v2_budget_lines')
    .select('id, closed_at')
    .eq('job_id', jobId)
    .eq('cost_code_id', costCodeId)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Budget line not found' });
  }

  if (existing.closed_at) {
    return res.status(400).json({ error: 'Budget line is already closed' });
  }

  const { data, error } = await supabase
    .from('v2_budget_lines')
    .update({
      closed_at: new Date().toISOString(),
      closed_by: closed_by || 'Unknown',
      notes: notes || null
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, budgetLine: data });
}));

// Reopen a closed budget line
router.post('/:jobId/budget/:costCodeId/reopen', asyncHandler(async (req, res) => {
  const { jobId, costCodeId } = req.params;

  const { data: existing } = await supabase
    .from('v2_budget_lines')
    .select('id, closed_at')
    .eq('job_id', jobId)
    .eq('cost_code_id', costCodeId)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Budget line not found' });
  }

  if (!existing.closed_at) {
    return res.status(400).json({ error: 'Budget line is not closed' });
  }

  const { data, error } = await supabase
    .from('v2_budget_lines')
    .update({
      closed_at: null,
      closed_by: null
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, budgetLine: data });
}));

// Import budget from Excel
router.post('/:id/budget/import', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const { lines: importLines } = req.body;

  if (!importLines || !Array.isArray(importLines)) {
    return res.status(400).json({ error: 'Invalid budget data' });
  }

  // Get all cost codes
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name');

  const costCodeMap = {};
  costCodes.forEach(cc => {
    costCodeMap[cc.code] = cc;
  });

  let imported = 0;
  let created = 0;

  for (const line of importLines) {
    let costCode = costCodeMap[line.costCode];

    // Create cost code if it doesn't exist
    if (!costCode && line.costCode) {
      const { data: newCostCode, error: ccError } = await supabase
        .from('v2_cost_codes')
        .insert({
          code: line.costCode,
          name: line.description || line.costCode,
          category: 'Imported'
        })
        .select()
        .single();

      if (!ccError && newCostCode) {
        costCode = newCostCode;
        costCodeMap[line.costCode] = costCode;
        created++;
      }
    }

    if (costCode) {
      const { data: existing } = await supabase
        .from('v2_budget_lines')
        .select('id')
        .eq('job_id', jobId)
        .eq('cost_code_id', costCode.id)
        .single();

      if (existing) {
        await supabase
          .from('v2_budget_lines')
          .update({ budgeted_amount: line.budgeted || 0 })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('v2_budget_lines')
          .insert({
            job_id: jobId,
            cost_code_id: costCode.id,
            budgeted_amount: line.budgeted || 0,
            committed_amount: 0,
            billed_amount: 0,
            paid_amount: 0
          });
      }
      imported++;
    }
  }

  res.json({ success: true, imported, costCodesCreated: created });
}));

// Export budget to Excel
router.get('/:id/budget/export', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  // Get job
  const { data: job } = await supabase
    .from('v2_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  // Get budget summary via internal fetch
  // NOTE: Depends on the budget-summary route above being accessible via the server
  const budgetRes = await fetch(`http://127.0.0.1:${port}/api/jobs/${jobId}/budget-summary`, {
    headers: req.headers.authorization ? { 'Authorization': req.headers.authorization } : {}
  });
  const budgetData = await budgetRes.json();

  // Create workbook
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Budget');

  // Header
  sheet.mergeCells('A1:I1');
  sheet.getCell('A1').value = `Budget - ${job.name}`;
  sheet.getCell('A1').font = { bold: true, size: 16 };

  // Column headers
  sheet.addRow([]);
  sheet.addRow(['Cost Code', 'Description', 'Budget', 'Committed', 'Billed', 'Paid', '%', 'Remaining', 'Variance']);
  const headerRow = sheet.getRow(3);
  headerRow.font = { bold: true };
  headerRow.eachCell(cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
  });

  // Data rows
  budgetData.lines.forEach(line => {
    const remaining = line.budgeted - line.billed;
    const bVariance = line.budgeted - line.billed;
    const pct = line.budgeted > 0 ? (line.billed / line.budgeted) * 100 : 0;

    sheet.addRow([
      line.costCode,
      line.description,
      line.budgeted,
      line.committed,
      line.billed,
      line.paid,
      pct / 100,
      remaining,
      bVariance
    ]);
  });

  // Totals row
  const totalsRow = sheet.addRow([
    'TOTAL',
    '',
    budgetData.totals.budgeted,
    budgetData.totals.committed,
    budgetData.totals.billed,
    budgetData.totals.paid,
    budgetData.totals.percentComplete / 100,
    budgetData.totals.remaining,
    budgetData.totals.budgeted - budgetData.totals.billed
  ]);
  totalsRow.font = { bold: true };

  // Format currency columns
  ['C', 'D', 'E', 'F', 'H', 'I'].forEach(col => {
    sheet.getColumn(col).numFmt = '"$"#,##0.00';
    sheet.getColumn(col).width = 15;
  });
  sheet.getColumn('G').numFmt = '0.0%';
  sheet.getColumn('A').width = 12;
  sheet.getColumn('B').width = 30;

  // Send file
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="Budget-${job.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);

  await workbook.xlsx.write(res);
  res.end();
}));

// ============================================================
// DRAW-RELATED JOB ROUTES (moved from index.js)
// ============================================================

// Get approved unbilled invoices for a job
router.get('/:id/approved-unbilled-invoices', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  const { data: invoices, error: invError } = await supabase
    .from('v2_invoices')
    .select(`
      id, invoice_number, invoice_date, amount, status, vendor_id, job_id,
      vendor:v2_vendors(id, name),
      job:v2_jobs(id, name),
      allocations:v2_invoice_allocations(id, amount, cost_code_id)
    `)
    .eq('job_id', jobId)
    .eq('status', 'approved')
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false });

  if (invError) throw new AppError('DATABASE_ERROR', invError.message);

  const totalAmount = (invoices || []).reduce((sum, inv) => {
    const allocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    return sum + (allocationSum > 0 ? allocationSum : parseFloat(inv.amount || 0));
  }, 0);

  const { data: draftDraw, error: drawError } = await supabase
    .from('v2_draws')
    .select('id, draw_number, total_amount')
    .eq('job_id', jobId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (drawError) throw new AppError('DATABASE_ERROR', drawError.message);

  res.json({
    invoices: invoices || [],
    invoice_count: (invoices || []).length,
    total_amount: totalAmount,
    existing_draft: draftDraw || null
  });
}));

// Auto-generate draw from approved invoices
router.post('/:id/auto-generate-draw', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const { invoice_ids, use_existing_draft } = req.body;

  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    return res.status(400).json({ error: 'No invoices selected' });
  }

  let draw;

  if (use_existing_draft) {
    const { data: draftDraw, error: draftError } = await supabase
      .from('v2_draws')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (draftError) throw new AppError('DATABASE_ERROR', draftError.message);
    draw = draftDraw;
  }

  if (!draw) {
    const { data: existing } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('job_id', jobId)
      .order('draw_number', { ascending: false })
      .limit(1);

    const nextNumber = existing && existing.length > 0 ? existing[0].draw_number + 1 : 1;

    const { data: newDraw, error: createError } = await supabase
      .from('v2_draws')
      .insert({
        job_id: jobId,
        draw_number: nextNumber,
        period_end: new Date().toISOString().split('T')[0],
        status: 'draft'
      })
      .select()
      .single();

    if (createError) throw new AppError('DATABASE_ERROR', createError.message);
    draw = newDraw;
  }

  let addedCount = 0;
  let totalAmount = 0;

  for (const invoiceId of invoice_ids) {
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .select('id, status, amount, allocations:v2_invoice_allocations(amount)')
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) continue;
    if (invoice.status !== 'approved') continue;

    const { data: existingLink } = await supabase
      .from('v2_draw_invoices')
      .select('id')
      .eq('draw_id', draw.id)
      .eq('invoice_id', invoiceId)
      .maybeSingle();

    if (existingLink) continue;

    const { error: linkError } = await supabase
      .from('v2_draw_invoices')
      .insert({ draw_id: draw.id, invoice_id: invoiceId });

    if (linkError) {
      logger.error('Error linking invoice to draw', { component: 'draw', error: linkError.message });
      continue;
    }

    const { error: statusError } = await supabase
      .from('v2_invoices')
      .update({ status: 'in_draw' })
      .eq('id', invoiceId);

    if (statusError) {
      logger.error('Error updating invoice status', { component: 'draw', error: statusError.message });
    }

    const allocationSum = (invoice.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    totalAmount += allocationSum > 0 ? allocationSum : parseFloat(invoice.amount || 0);
    addedCount++;
  }

  const { error: updateError } = await supabase
    .from('v2_draws')
    .update({
      total_amount: totalAmount,
      updated_at: new Date().toISOString()
    })
    .eq('id', draw.id);

  if (updateError) {
    logger.error('Error updating draw total', { component: 'draw', error: updateError.message });
  }

  res.json({
    draw_id: draw.id,
    draw_number: draw.draw_number,
    invoice_count: addedCount,
    total_amount: totalAmount,
    created_new: !use_existing_draft || !draw.id
  });
}));

// Get current draft draw for a job
// NOTE: getOrCreateDraftDraw is defined in index.js; if create=true is used,
// this route needs that helper function. For now, the create path is commented
// and only the read path is available. The helper should be extracted to a service.
router.get('/:jobId/current-draw', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { create } = req.query;

  const { data: job } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .single();

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  if (create === 'true') {
    // TODO: getOrCreateDraftDraw helper needs to be extracted to a shared service
    // For now, fall through to just return existing draft
    logger.warn('current-draw create=true called but getOrCreateDraftDraw not available in routes module', { component: 'draw', jobId });
  }

  // Just look for existing draft
  const { data: draftDraw } = await supabase
    .from('v2_draws')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'draft')
    .single();

  res.json(draftDraw || null);
}));

// ============================================================
// RECONCILIATION & INTEGRITY (moved from index.js)
// ============================================================

// Run reconciliation for a specific job
router.get('/:id/reconcile', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const startTime = Date.now();

  const results = await reconcileJob(supabase, jobId);
  results.duration_ms = Date.now() - startTime;

  // Log the reconciliation run
  await supabase.from('v2_reconciliation_log').insert({
    job_id: jobId,
    total_checks: results.summary.total_checks,
    passed: results.summary.passed,
    failed: results.summary.failed,
    warnings: results.summary.warnings,
    results: results.checks,
    errors: results.errors,
    run_by: req.query.performed_by || 'System',
    duration_ms: results.duration_ms
  });

  // Update job's last reconciled timestamp
  if (results.summary.failed === 0) {
    await supabase.from('v2_jobs')
      .update({ last_reconciled_at: new Date().toISOString() })
      .eq('id', jobId);
  }

  res.json(results);
}));

// Create financial snapshot
router.post('/:id/snapshot', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const { snapshot_type = 'manual', reference_type, reference_id, created_by = 'System' } = req.body;

  const { data, error } = await supabase.rpc('create_financial_snapshot', {
    p_job_id: jobId,
    p_snapshot_type: snapshot_type,
    p_reference_type: reference_type,
    p_reference_id: reference_id,
    p_created_by: created_by
  });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true, snapshot_id: data });
}));

// Get financial snapshots for a job
router.get('/:id/snapshots', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const { limit = 10 } = req.query;

  const { data, error } = await supabase
    .from('v2_financial_snapshots')
    .select('id, snapshot_type, reference_type, reference_id, total_contract, total_billed, total_paid, retainage_held, created_at, created_by, notes')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get integrity status for a job
router.get('/:id/integrity', asyncHandler(async (req, res) => {
  const jobId = req.params.id;

  const checks = {
    invoices_without_allocations: 0,
    draw_total_mismatches: 0,
    budget_mismatches: 0,
    is_balanced: true
  };

  // Check invoices without allocations
  const { data: intInvoices } = await supabase
    .from('v2_invoices')
    .select('id, allocations:v2_invoice_allocations(amount)')
    .eq('job_id', jobId)
    .in('status', ['approved', 'in_draw', 'paid'])
    .is('deleted_at', null);

  for (const inv of (intInvoices || [])) {
    const allocSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    if (allocSum === 0) {
      checks.invoices_without_allocations++;
      checks.is_balanced = false;
    }
  }

  // Check draw totals
  const { data: intDraws } = await supabase
    .from('v2_draws')
    .select('id, total_amount')
    .eq('job_id', jobId);

  for (const draw of (intDraws || [])) {
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select('invoice:v2_invoices(amount)')
      .eq('draw_id', draw.id);

    const calculatedTotal = (drawInvoices || []).reduce((sum, di) =>
      sum + parseFloat(di.invoice?.amount || 0), 0);

    if (Math.abs(parseFloat(draw.total_amount || 0) - calculatedTotal) > 0.01) {
      checks.draw_total_mismatches++;
      checks.is_balanced = false;
    }
  }

  res.json(checks);
}));

// ============================================================
// FUNDING SOURCES (moved from index.js)
// ============================================================

// Get available funding sources (POs and COs) for a job
router.get('/:jobId/funding-sources', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { jobId } = req.params;

  // Get open/active POs for the job
  const { data: pos, error: poError } = await supabase
    .from('v2_purchase_orders')
    .select(`
      id, po_number, vendor_id, total_amount, status, description, created_at,
      vendor:v2_vendors(id, name),
      line_items:v2_po_line_items(id, cost_code_id, amount, invoiced_amount, description, change_order_id,
        cost_code:v2_cost_codes(id, code, name)
      )
    `)
    .eq('builder_id', builderId)
    .eq('job_id', jobId)
    .in('status', ['open', 'active'])
    .is('deleted_at', null)
    .order('po_number');

  if (poError) throw new AppError('DATABASE_ERROR', poError.message);

  // Get approved COs for the job
  const { data: cos, error: coError } = await supabase
    .from('v2_job_change_orders')
    .select('id, change_order_number, title, amount, invoiced_amount, status')
    .eq('job_id', jobId)
    .in('status', ['approved', 'pending_approval'])
    .order('change_order_number');

  if (coError) throw new AppError('DATABASE_ERROR', coError.message);

  // Calculate remaining amounts
  const posWithRemaining = (pos || []).map(po => ({
    ...po,
    invoiced_total: (po.line_items || []).reduce((sum, li) => sum + parseFloat(li.invoiced_amount || 0), 0),
    remaining: parseFloat(po.total_amount || 0) - (po.line_items || []).reduce((sum, li) => sum + parseFloat(li.invoiced_amount || 0), 0)
  }));

  const cosWithRemaining = (cos || []).map(co => ({
    ...co,
    remaining: parseFloat(co.amount || 0) - parseFloat(co.invoiced_amount || 0)
  }));

  res.json({
    purchase_orders: posWithRemaining,
    change_orders: cosWithRemaining
  });
}));

module.exports = router;

