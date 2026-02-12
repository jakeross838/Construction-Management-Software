/**
 * Admin Routes
 * Reconciliation, integrity checks, and admin utilities
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { requireAdmin } = require('../middleware/auth');
const { getBuilderId } = require('../core/multi-tenant');

// Protect all admin routes - admin only
router.use(requireAdmin);

// =====================================================
// RECONCILIATION & BALANCE INTEGRITY
// =====================================================

// Run full reconciliation check and optionally fix issues
router.post('/reconcile', asyncHandler(async (req, res) => {
  const { job_id, fix = false } = req.body;
  const builderId = getBuilderId(req);

  const results = {
    timestamp: new Date().toISOString(),
    issues: [],
    fixes: [],
    summary: { draws: 0, invoices: 0, budgets: 0 }
  };

  // Get jobs to process
  let jobQuery = supabase.from('v2_jobs').select('id, name').eq('builder_id', builderId);
  if (job_id) {
    jobQuery = jobQuery.eq('id', job_id);
  }
  const { data: jobs } = await jobQuery;

  for (const job of (jobs || [])) {
    // Check 1: Draw totals
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('id, draw_number, total_amount')
      .eq('job_id', job.id);

    for (const draw of (draws || [])) {
      const { data: drawInvoices } = await supabase
        .from('v2_draw_invoices')
        .select('invoice:v2_invoices(amount)')
        .eq('draw_id', draw.id);

      const calculatedTotal = (drawInvoices || []).reduce((sum, di) =>
        sum + parseFloat(di.invoice?.amount || 0), 0);
      const currentTotal = parseFloat(draw.total_amount || 0);

      if (Math.abs(currentTotal - calculatedTotal) > 0.01) {
        results.issues.push({
          type: 'DRAW_TOTAL_MISMATCH',
          job: job.name,
          draw: draw.draw_number,
          current: currentTotal,
          expected: calculatedTotal
        });

        if (fix) {
          await supabase.from('v2_draws').update({ total_amount: calculatedTotal }).eq('id', draw.id);
          results.fixes.push({ type: 'draw', id: draw.id, from: currentTotal, to: calculatedTotal });
          results.summary.draws++;
        }
      }
    }

    // Check 2: Budget amounts match allocations
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select('amount, cost_code_id, invoice:v2_invoices(status)')
      .eq('job_id', job.id);

    const actualByCode = {};
    for (const alloc of (allocations || [])) {
      const codeId = alloc.cost_code_id;
      if (!actualByCode[codeId]) actualByCode[codeId] = { billed: 0, paid: 0 };
      const amount = parseFloat(alloc.amount || 0);
      if (alloc.invoice?.status === 'in_draw') actualByCode[codeId].billed += amount;
      else if (alloc.invoice?.status === 'paid') actualByCode[codeId].paid += amount;
    }

    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select('id, cost_code_id, billed_amount, paid_amount, cost_code:v2_cost_codes(code)')
      .eq('job_id', job.id);

    for (const bl of (budgetLines || [])) {
      const actual = actualByCode[bl.cost_code_id] || { billed: 0, paid: 0 };
      const currentBilled = parseFloat(bl.billed_amount || 0);
      const currentPaid = parseFloat(bl.paid_amount || 0);

      if (Math.abs(currentBilled - actual.billed) > 0.01 || Math.abs(currentPaid - actual.paid) > 0.01) {
        results.issues.push({
          type: 'BUDGET_MISMATCH',
          job: job.name,
          cost_code: bl.cost_code?.code,
          current_billed: currentBilled,
          expected_billed: actual.billed,
          current_paid: currentPaid,
          expected_paid: actual.paid
        });

        if (fix) {
          await supabase.from('v2_budget_lines')
            .update({ billed_amount: actual.billed, paid_amount: actual.paid })
            .eq('id', bl.id);
          results.fixes.push({ type: 'budget', id: bl.id, code: bl.cost_code?.code });
          results.summary.budgets++;
        }
      }
    }
  }

  results.total_issues = results.issues.length;
  results.total_fixed = results.fixes.length;

  res.json(results);
}));

// Get integrity status for a job
router.get('/jobs/:id/integrity', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const builderId = getBuilderId(req);

  // Quick integrity check
  const checks = {
    invoices_without_allocations: 0,
    draw_total_mismatches: 0,
    budget_mismatches: 0,
    is_balanced: true
  };

  // Check invoices without allocations
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, allocations:v2_invoice_allocations(amount)')
    .eq('job_id', jobId)
    .eq('builder_id', builderId)
    .in('status', ['approved', 'in_draw', 'paid'])
    .is('deleted_at', null);

  for (const inv of (invoices || [])) {
    const allocSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    if (allocSum === 0) {
      checks.invoices_without_allocations++;
      checks.is_balanced = false;
    }
  }

  // Check draw totals
  const { data: draws } = await supabase
    .from('v2_draws')
    .select('id, total_amount')
    .eq('job_id', jobId)
    .eq('builder_id', builderId);

  for (const draw of (draws || [])) {
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

// Get all entity locks (admin debugging)
router.get('/locks', asyncHandler(async (req, res) => {
  const locking = require('../core/locking');
  const locks = await locking.getAllLocks();
  res.json({ locks, count: locks.length });
}));

// Force release a lock (admin operation)
router.delete('/locks/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const { admin_user = 'admin' } = req.body;

  const locking = require('../core/locking');
  const result = await locking.forceReleaseLock(entityType, entityId, admin_user);

  if (!result.success) {
    throw result.error;
  }

  res.json({ success: true, wasLocked: result.wasLocked });
}));

// Get system statistics
router.get('/stats', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  const [
    { count: invoiceCount },
    { count: poCount },
    { count: drawCount },
    { count: vendorCount },
    { count: jobCount }
  ] = await Promise.all([
    supabase.from('v2_invoices').select('*', { count: 'exact', head: true }).eq('builder_id', builderId).is('deleted_at', null),
    supabase.from('v2_purchase_orders').select('*', { count: 'exact', head: true }).eq('builder_id', builderId).is('deleted_at', null),
    supabase.from('v2_draws').select('*', { count: 'exact', head: true }).eq('builder_id', builderId),
    supabase.from('v2_vendors').select('*', { count: 'exact', head: true }).eq('builder_id', builderId).is('deleted_at', null),
    supabase.from('v2_jobs').select('*', { count: 'exact', head: true }).eq('builder_id', builderId)
  ]);

  res.json({
    invoices: invoiceCount || 0,
    purchase_orders: poCount || 0,
    draws: drawCount || 0,
    vendors: vendorCount || 0,
    jobs: jobCount || 0
  });
}));

module.exports = router;
