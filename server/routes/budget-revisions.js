/**
 * Budget Revisions Routes
 * Tracks budget revision history and forecast comparisons
 */

const express = require('express');
const router = express.Router({ mergeParams: true }); // mergeParams to access :jobId from parent
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// GET /api/jobs/:jobId/budget/revisions
// List all revisions for a job
// ============================================================
router.get('/', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const builderId = getBuilderId(req);

  // Verify job exists
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();
  if (jobError || !job) throw notFoundError('job', jobId);

  // Get all revisions
  const { data, error } = await supabase
    .from('v2_budget_revisions')
    .select(`
      id,
      revision_number,
      revision_date,
      revised_by,
      reason,
      notes,
      previous_total,
      new_total,
      created_at
    `)
    .eq('job_id', jobId)
    .order('revision_number', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Calculate change amounts
  const revisions = (data || []).map(r => ({
    ...r,
    change_amount: parseFloat(r.new_total || 0) - parseFloat(r.previous_total || 0)
  }));

  res.json({
    job_id: jobId,
    job_name: job.name,
    revisions,
    total_revisions: revisions.length
  });
}));

// ============================================================
// GET /api/jobs/:jobId/budget/revisions/:id
// Get a specific revision with line item details
// ============================================================
router.get('/:id', asyncHandler(async (req, res) => {
  const { jobId, id } = req.params;
  const builderId = getBuilderId(req);

  // Verify job exists
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();
  if (jobError || !job) throw notFoundError('job', jobId);

  // Get the revision
  const { data: revision, error: revError } = await supabase
    .from('v2_budget_revisions')
    .select('*')
    .eq('id', id)
    .eq('job_id', jobId)
    .single();

  if (revError || !revision) throw notFoundError('budget revision', id);

  // Get line items with cost code details
  const { data: lines, error: linesError } = await supabase
    .from('v2_budget_revision_lines')
    .select(`
      id,
      cost_code_id,
      previous_amount,
      new_amount,
      change_amount,
      change_reason,
      created_at,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('revision_id', id)
    .order('created_at');

  if (linesError) throw new AppError('DATABASE_ERROR', linesError.message, { code: linesError.code });

  res.json({
    revision: {
      ...revision,
      change_amount: parseFloat(revision.new_total || 0) - parseFloat(revision.previous_total || 0)
    },
    lines: lines || [],
    job: {
      id: jobId,
      name: job.name
    }
  });
}));

// ============================================================
// POST /api/jobs/:jobId/budget/revisions
// Create a new revision (snapshots current state, applies changes)
// ============================================================
router.post('/', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { reason, notes, revised_by, changes } = req.body;
  const builderId = getBuilderId(req);

  if (!changes || !Array.isArray(changes) || changes.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'changes array is required with at least one change');
  }

  // Verify job exists
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();
  if (jobError || !job) throw notFoundError('job', jobId);

  // Get current budget lines
  const { data: currentLines, error: blError } = await supabase
    .from('v2_budget_lines')
    .select('id, cost_code_id, budgeted_amount')
    .eq('job_id', jobId);

  if (blError) throw new AppError('DATABASE_ERROR', blError.message, { code: blError.code });

  const currentByCC = {};
  let previousTotal = 0;
  (currentLines || []).forEach(bl => {
    currentByCC[bl.cost_code_id] = parseFloat(bl.budgeted_amount || 0);
    previousTotal += parseFloat(bl.budgeted_amount || 0);
  });

  // Get next revision number
  const { data: lastRev, error: lastRevError } = await supabase
    .from('v2_budget_revisions')
    .select('revision_number')
    .eq('job_id', jobId)
    .order('revision_number', { ascending: false })
    .limit(1)
    .single();

  const nextRevNumber = lastRevError ? 1 : (lastRev.revision_number + 1);

  // Calculate new total
  let newTotal = previousTotal;
  const lineChanges = [];

  for (const change of changes) {
    const { cost_code_id, new_amount, change_reason } = change;
    if (!cost_code_id) {
      throw new AppError('VALIDATION_FAILED', 'cost_code_id is required for each change');
    }

    const prevAmount = currentByCC[cost_code_id] || 0;
    const newAmt = parseFloat(new_amount || 0);

    // Only include if there's actually a change
    if (Math.abs(newAmt - prevAmount) > 0.001) {
      lineChanges.push({
        cost_code_id,
        previous_amount: prevAmount,
        new_amount: newAmt,
        change_reason: change_reason || null
      });

      newTotal = newTotal - prevAmount + newAmt;
    }
  }

  if (lineChanges.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'No actual changes detected in the provided changes');
  }

  // Create the revision
  const { data: revision, error: revError } = await supabase
    .from('v2_budget_revisions')
    .insert({
      job_id: jobId,
      revision_number: nextRevNumber,
      revision_date: new Date().toISOString().split('T')[0],
      revised_by: revised_by || 'User',
      reason: reason || null,
      notes: notes || null,
      previous_total: previousTotal,
      new_total: newTotal
    })
    .select()
    .single();

  if (revError) throw new AppError('DATABASE_ERROR', revError.message, { code: revError.code });

  // Create revision lines
  const linesToInsert = lineChanges.map(lc => ({
    revision_id: revision.id,
    cost_code_id: lc.cost_code_id,
    previous_amount: lc.previous_amount,
    new_amount: lc.new_amount,
    change_reason: lc.change_reason
  }));

  const { error: linesError } = await supabase
    .from('v2_budget_revision_lines')
    .insert(linesToInsert);

  if (linesError) throw new AppError('DATABASE_ERROR', linesError.message, { code: linesError.code });

  // Apply changes to budget_lines
  for (const lc of lineChanges) {
    const existingLine = currentLines?.find(bl => bl.cost_code_id === lc.cost_code_id);

    if (existingLine) {
      // Update existing line
      await supabase
        .from('v2_budget_lines')
        .update({ budgeted_amount: lc.new_amount })
        .eq('id', existingLine.id);
    } else {
      // Create new budget line
      await supabase
        .from('v2_budget_lines')
        .insert({
          job_id: jobId,
          cost_code_id: lc.cost_code_id,
          budgeted_amount: lc.new_amount
        });
    }
  }

  // Log activity
  await supabase.from('v2_job_activity').insert({
    job_id: jobId,
    action: 'budget_revised',
    performed_by: revised_by || 'User',
    notes: `Budget revision #${nextRevNumber}: ${reason || 'No reason specified'}. Change: $${(newTotal - previousTotal).toFixed(2)}`
  });

  res.status(201).json({
    success: true,
    revision: {
      ...revision,
      change_amount: newTotal - previousTotal
    },
    lines_changed: lineChanges.length,
    message: `Budget revision #${nextRevNumber} created with ${lineChanges.length} line changes`
  });
}));

// ============================================================
// GET /api/jobs/:jobId/budget/compare
// Compare two revisions (or current vs revision)
// Query params: revision1, revision2 (optional - current if not provided)
// ============================================================
router.get('/compare', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { revision1, revision2 } = req.query;
  const builderId = getBuilderId(req);

  // Verify job exists
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();
  if (jobError || !job) throw notFoundError('job', jobId);

  // Helper to get budget state at a revision
  const getBudgetAtRevision = async (revisionId) => {
    if (!revisionId) {
      // Get current budget
      const { data, error } = await supabase
        .from('v2_budget_lines')
        .select(`
          cost_code_id,
          budgeted_amount,
          cost_code:v2_cost_codes(id, code, name, category)
        `)
        .eq('job_id', jobId);

      if (error) throw new AppError('DATABASE_ERROR', error.message);

      return {
        label: 'Current',
        revision_number: null,
        lines: (data || []).map(bl => ({
          cost_code_id: bl.cost_code_id,
          cost_code: bl.cost_code?.code,
          cost_code_name: bl.cost_code?.name,
          category: bl.cost_code?.category,
          amount: parseFloat(bl.budgeted_amount || 0)
        })),
        total: (data || []).reduce((sum, bl) => sum + parseFloat(bl.budgeted_amount || 0), 0)
      };
    }

    // Get revision data
    const { data: revision, error: revError } = await supabase
      .from('v2_budget_revisions')
      .select('*')
      .eq('id', revisionId)
      .eq('job_id', jobId)
      .single();

    if (revError || !revision) throw notFoundError('budget revision', revisionId);

    const { data: lines, error: linesError } = await supabase
      .from('v2_budget_revision_lines')
      .select(`
        cost_code_id,
        new_amount,
        cost_code:v2_cost_codes(id, code, name, category)
      `)
      .eq('revision_id', revisionId);

    if (linesError) throw new AppError('DATABASE_ERROR', linesError.message);

    return {
      label: `Revision #${revision.revision_number}`,
      revision_number: revision.revision_number,
      revision_date: revision.revision_date,
      lines: (lines || []).map(l => ({
        cost_code_id: l.cost_code_id,
        cost_code: l.cost_code?.code,
        cost_code_name: l.cost_code?.name,
        category: l.cost_code?.category,
        amount: parseFloat(l.new_amount || 0)
      })),
      total: parseFloat(revision.new_total || 0)
    };
  };

  const state1 = await getBudgetAtRevision(revision1);
  const state2 = await getBudgetAtRevision(revision2);

  // Build comparison
  const allCostCodes = new Set([
    ...state1.lines.map(l => l.cost_code_id),
    ...state2.lines.map(l => l.cost_code_id)
  ]);

  const comparison = [];
  for (const ccId of allCostCodes) {
    const line1 = state1.lines.find(l => l.cost_code_id === ccId);
    const line2 = state2.lines.find(l => l.cost_code_id === ccId);

    const amount1 = line1?.amount || 0;
    const amount2 = line2?.amount || 0;
    const variance = amount2 - amount1;

    comparison.push({
      cost_code_id: ccId,
      cost_code: line1?.cost_code || line2?.cost_code,
      cost_code_name: line1?.cost_code_name || line2?.cost_code_name,
      category: line1?.category || line2?.category,
      [state1.label.toLowerCase().replace(/[^a-z0-9]/g, '_')]: amount1,
      [state2.label.toLowerCase().replace(/[^a-z0-9]/g, '_')]: amount2,
      variance,
      variance_percent: amount1 > 0 ? ((variance / amount1) * 100).toFixed(2) : null
    });
  }

  res.json({
    job_id: jobId,
    job_name: job.name,
    comparing: {
      from: state1.label,
      to: state2.label
    },
    summary: {
      from_total: state1.total,
      to_total: state2.total,
      total_variance: state2.total - state1.total,
      total_variance_percent: state1.total > 0
        ? (((state2.total - state1.total) / state1.total) * 100).toFixed(2)
        : null
    },
    comparison: comparison.filter(c => Math.abs(c.variance) > 0.001)
  });
}));

// ============================================================
// PATCH /api/jobs/:jobId/budget/forecast
// Update forecast amounts for budget lines
// ============================================================
router.patch('/forecast', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { forecasts, updated_by } = req.body;
  const builderId = getBuilderId(req);

  if (!forecasts || !Array.isArray(forecasts) || forecasts.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'forecasts array is required');
  }

  // Verify job exists
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();
  if (jobError || !job) throw notFoundError('job', jobId);

  const results = [];
  for (const forecast of forecasts) {
    const { cost_code_id, forecast_amount } = forecast;

    if (!cost_code_id) {
      results.push({ cost_code_id, success: false, error: 'cost_code_id required' });
      continue;
    }

    // Check if budget line exists
    const { data: existing, error: existError } = await supabase
      .from('v2_budget_lines')
      .select('id')
      .eq('job_id', jobId)
      .eq('cost_code_id', cost_code_id)
      .single();

    if (existError && existError.code !== 'PGRST116') {
      results.push({ cost_code_id, success: false, error: existError.message });
      continue;
    }

    if (existing) {
      // Update existing
      const { error: updateError } = await supabase
        .from('v2_budget_lines')
        .update({ forecast_amount: parseFloat(forecast_amount || 0) })
        .eq('id', existing.id);

      if (updateError) {
        results.push({ cost_code_id, success: false, error: updateError.message });
      } else {
        results.push({ cost_code_id, success: true, action: 'updated' });
      }
    } else {
      // Create new budget line with forecast
      const { error: insertError } = await supabase
        .from('v2_budget_lines')
        .insert({
          job_id: jobId,
          cost_code_id,
          budgeted_amount: 0,
          forecast_amount: parseFloat(forecast_amount || 0)
        });

      if (insertError) {
        results.push({ cost_code_id, success: false, error: insertError.message });
      } else {
        results.push({ cost_code_id, success: true, action: 'created' });
      }
    }
  }

  // Log activity
  const successCount = results.filter(r => r.success).length;
  await supabase.from('v2_job_activity').insert({
    job_id: jobId,
    action: 'forecast_updated',
    performed_by: updated_by || 'User',
    notes: `Updated forecast for ${successCount} cost codes`
  });

  res.json({
    success: results.every(r => r.success),
    job_id: jobId,
    results,
    updated_count: successCount,
    failed_count: results.filter(r => !r.success).length
  });
}));

// ============================================================
// GET /api/jobs/:jobId/budget/forecast-comparison
// Get budget vs forecast comparison for all cost codes
// ============================================================
router.get('/forecast-comparison', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const builderId = getBuilderId(req);

  // Verify job exists
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();
  if (jobError || !job) throw notFoundError('job', jobId);

  // Get budget lines with forecast
  const { data: lines, error } = await supabase
    .from('v2_budget_lines')
    .select(`
      id,
      cost_code_id,
      budgeted_amount,
      committed_amount,
      billed_amount,
      forecast_amount,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Calculate comparison
  const comparison = (lines || []).map(bl => {
    const budgeted = parseFloat(bl.budgeted_amount || 0);
    const committed = parseFloat(bl.committed_amount || 0);
    const billed = parseFloat(bl.billed_amount || 0);
    const forecast = parseFloat(bl.forecast_amount || 0);

    // If no forecast, use max of committed or billed as estimate
    const effectiveForecast = forecast > 0 ? forecast : Math.max(committed, billed);

    const budgetVariance = effectiveForecast - budgeted;
    const budgetVariancePercent = budgeted > 0 ? (budgetVariance / budgeted) * 100 : 0;

    return {
      cost_code_id: bl.cost_code_id,
      cost_code: bl.cost_code?.code,
      cost_code_name: bl.cost_code?.name,
      category: bl.cost_code?.category,
      budgeted,
      committed,
      billed,
      forecast: effectiveForecast,
      has_explicit_forecast: forecast > 0,
      budget_variance: budgetVariance,
      budget_variance_percent: budgetVariancePercent.toFixed(2),
      status: budgetVariance > 0 ? 'over' : budgetVariance < 0 ? 'under' : 'on_budget'
    };
  });

  // Calculate totals
  const totals = comparison.reduce((acc, c) => ({
    budgeted: acc.budgeted + c.budgeted,
    committed: acc.committed + c.committed,
    billed: acc.billed + c.billed,
    forecast: acc.forecast + c.forecast
  }), { budgeted: 0, committed: 0, billed: 0, forecast: 0 });

  totals.budget_variance = totals.forecast - totals.budgeted;
  totals.budget_variance_percent = totals.budgeted > 0
    ? ((totals.budget_variance / totals.budgeted) * 100).toFixed(2)
    : 0;

  res.json({
    job_id: jobId,
    job_name: job.name,
    totals,
    lines: comparison,
    summary: {
      over_budget_count: comparison.filter(c => c.status === 'over').length,
      under_budget_count: comparison.filter(c => c.status === 'under').length,
      on_budget_count: comparison.filter(c => c.status === 'on_budget').length,
      explicit_forecast_count: comparison.filter(c => c.has_explicit_forecast).length
    }
  });
}));

module.exports = router;
