/**
 * Jobs Routes
 * Job management and specs endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { extractSpecsFromPlans, extractSpecsFromMultipleDocuments } = require('../ai-document-processor');
const { asyncHandler, AppError, notFoundError, validateRequest } = require('../errors');

// Create a new job
router.post('/', validateRequest({
  body: { name: { required: true } }
}), asyncHandler(async (req, res) => {
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
router.get('/:id', validateRequest({ params: { id: { type: 'uuid' } } }), asyncHandler(async (req, res) => {
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
router.patch('/:id', validateRequest({
  params: { id: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
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
    if (billed > committed + 0.01) {
      status = 'over_billed';
      errors.push({
        type: 'OVER_BILLED',
        severity: 'error',
        cost_code_id: bl.cost_code_id,
        cost_code: bl.cost_code?.code || 'Unknown',
        cost_code_name: bl.cost_code?.name || 'Unknown',
        budgeted,
        committed,
        billed,
        excess: billed - committed,
        message: `Cost code ${bl.cost_code?.code} billed $${(billed - committed).toFixed(2)} more than committed`
      });
    } else if (committed > budgeted + 0.01) {
      status = 'over_committed';
      errors.push({
        type: 'OVER_COMMITTED',
        severity: 'error',
        cost_code_id: bl.cost_code_id,
        cost_code: bl.cost_code?.code || 'Unknown',
        cost_code_name: bl.cost_code?.name || 'Unknown',
        budgeted,
        committed,
        excess: committed - budgeted,
        message: `Cost code ${bl.cost_code?.code} committed $${(committed - budgeted).toFixed(2)} over budget`
      });
    } else if (percentCommitted > 90) {
      status = 'approaching';
      warnings.push({
        type: 'APPROACHING_LIMIT',
        severity: 'warning',
        cost_code_id: bl.cost_code_id,
        cost_code: bl.cost_code?.code || 'Unknown',
        cost_code_name: bl.cost_code?.name || 'Unknown',
        budgeted,
        committed,
        percent_committed: percentCommitted,
        remaining: budgeted - committed,
        message: `Cost code ${bl.cost_code?.code} is ${percentCommitted.toFixed(1)}% committed ($${(budgeted - committed).toFixed(2)} remaining)`
      });
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

  res.json({
    job_id: jobId,
    job_name: job.name,
    valid: errors.length === 0,
    summary,
    by_cost_code: byCostCode,
    errors,
    warnings
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

module.exports = router;

