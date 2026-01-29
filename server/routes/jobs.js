/**
 * Jobs Routes
 * Job management and specs endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { extractSpecsFromPlans, extractSpecsFromMultipleDocuments } = require('../ai-document-processor');
const { asyncHandler, AppError, notFoundError, validateRequest } = require('../errors');
const { validate, schemas } = require('../middleware/validate');
const {
  createValidationError,
  createValidationWarning,
  createDetailedFixHint,
  formatAmount
} = require('../validation-errors');

// Create a new job
router.post('/', validate(schemas.jobCreate), asyncHandler(async (req, res) => {
  const { name, address, client_name, contract_amount, status } = req.body;

  const { data, error } = await supabase
    .from('v2_jobs')
    .insert({
      name,
      address,
      client_name,
      contract_amount: contract_amount || null,
      status: status || 'active'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity
  await supabase.from('v2_job_activity').insert({
    job_id: data.id,
    action: 'created',
    performed_by: req.body.created_by || 'User',
    notes: `Job "${name}" created`
  });

  res.status(201).json(data);
}));

// Get all jobs
router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_jobs')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Get single job
router.get('/:id', validate(schemas.idParam), asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_jobs')
    .select('*')
    .eq('id', req.params.id)
    .is('deleted_at', null)
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw notFoundError('job', req.params.id);
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }
  res.json(data);
}));

// Update job (basic fields, not specs)
router.patch('/:id', validate(schemas.jobUpdate), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowedFields = ['name', 'address', 'client_name', 'contract_amount', 'status'];

  // Get current job for activity log
  const { data: current } = await supabase
    .from('v2_jobs')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

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

  const { data, error } = await supabase
    .from('v2_jobs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity
  const action = updates.status ? 'status_changed' : 'updated';
  await supabase.from('v2_job_activity').insert({
    job_id: id,
    action,
    performed_by: req.body.updated_by || 'User',
    field_changes: changes,
    previous_status: updates.status ? current.status : null,
    new_status: updates.status || null
  });

  res.json(data);
}));

// Soft delete job
router.delete('/:id', validateRequest({
  params: { id: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Verify job exists
  const { data: current } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!current) throw notFoundError('job', id);

  // Soft delete
  const { error } = await supabase
    .from('v2_jobs')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Log activity
  await supabase.from('v2_job_activity').insert({
    job_id: id,
    action: 'deleted',
    performed_by: req.body.deleted_by || 'User',
    notes: `Job "${current.name}" archived`
  });

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

module.exports = router;

