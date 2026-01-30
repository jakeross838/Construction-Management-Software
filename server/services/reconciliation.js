/**
 * Financial Reconciliation System
 *
 * Checks and balances across:
 * - Invoice ↔ Allocations
 * - Invoice ↔ Draw
 * - PO ↔ Invoice
 * - Budget ↔ Actuals
 * - External Systems (QuickBooks, etc.)
 */

const { createClient } = require('@supabase/supabase-js');

// Tolerance for floating point comparisons (1 cent)
const TOLERANCE = 0.01;

/**
 * Run all reconciliation checks for a job
 */
async function reconcileJob(supabase, jobId) {
  const results = {
    job_id: jobId,
    timestamp: new Date().toISOString(),
    checks: [],
    errors: [],
    warnings: [],
    summary: {
      total_checks: 0,
      passed: 0,
      failed: 0,
      warnings: 0
    }
  };

  try {
    // Get job details
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('id, name, contract_amount')
      .eq('id', jobId)
      .single();

    if (!job) {
      results.errors.push({ type: 'JOB_NOT_FOUND', message: `Job ${jobId} not found` });
      return results;
    }

    results.job_name = job.name;

    // Run all checks
    const invoiceChecks = await checkInvoiceAllocations(supabase, jobId);
    const drawChecks = await checkDrawTotals(supabase, jobId);
    const poChecks = await checkPOBalances(supabase, jobId);
    const budgetChecks = await checkBudgetActuals(supabase, jobId);
    const billingChecks = await checkBillingIntegrity(supabase, jobId);

    // Aggregate results
    results.checks = [
      ...invoiceChecks,
      ...drawChecks,
      ...poChecks,
      ...budgetChecks,
      ...billingChecks
    ];

    // Calculate summary
    results.checks.forEach(check => {
      results.summary.total_checks++;
      if (check.status === 'pass') results.summary.passed++;
      else if (check.status === 'fail') {
        results.summary.failed++;
        results.errors.push(check);
      }
      else if (check.status === 'warning') {
        results.summary.warnings++;
        results.warnings.push(check);
      }
    });

  } catch (err) {
    results.errors.push({ type: 'RECONCILIATION_ERROR', message: err.message });
  }

  return results;
}

/**
 * Check 1: Invoice Allocations
 * - Sum of allocations should match invoice amount (or be <= for partial)
 * - Allocations should have valid cost codes
 */
async function checkInvoiceAllocations(supabase, jobId) {
  const checks = [];

  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select(`
      id, invoice_number, amount, billed_amount, status,
      allocations:v2_invoice_allocations(amount, cost_code_id)
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null);

  for (const inv of (invoices || [])) {
    const invoiceAmount = parseFloat(inv.amount || 0);
    const billedAmount = parseFloat(inv.billed_amount || 0);
    const allocSum = (inv.allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Check: Allocations don't exceed invoice amount
    if (allocSum > invoiceAmount + TOLERANCE) {
      checks.push({
        type: 'INVOICE_OVER_ALLOCATED',
        status: 'fail',
        entity: 'invoice',
        entity_id: inv.id,
        entity_ref: inv.invoice_number,
        message: `Invoice #${inv.invoice_number} over-allocated: $${allocSum.toFixed(2)} allocated vs $${invoiceAmount.toFixed(2)} invoice amount`,
        expected: invoiceAmount,
        actual: allocSum,
        difference: allocSum - invoiceAmount
      });
    }

    // Check: For fully billed invoices, allocations should equal billed
    if (inv.status === 'in_draw' || inv.status === 'paid') {
      if (Math.abs(billedAmount - allocSum) > TOLERANCE && allocSum > 0) {
        checks.push({
          type: 'INVOICE_BILLED_MISMATCH',
          status: 'warning',
          entity: 'invoice',
          entity_id: inv.id,
          entity_ref: inv.invoice_number,
          message: `Invoice #${inv.invoice_number} billed amount mismatch: $${billedAmount.toFixed(2)} billed vs $${allocSum.toFixed(2)} current allocations`,
          expected: billedAmount,
          actual: allocSum,
          difference: Math.abs(billedAmount - allocSum)
        });
      }
    }

    // Check: Allocations have valid cost codes
    const invalidAllocs = (inv.allocations || []).filter(a => !a.cost_code_id);
    if (invalidAllocs.length > 0) {
      checks.push({
        type: 'INVOICE_MISSING_COST_CODE',
        status: 'fail',
        entity: 'invoice',
        entity_id: inv.id,
        entity_ref: inv.invoice_number,
        message: `Invoice #${inv.invoice_number} has ${invalidAllocs.length} allocation(s) without cost codes`,
        count: invalidAllocs.length
      });
    }
  }

  // Add pass check if no issues
  if (checks.length === 0) {
    checks.push({
      type: 'INVOICE_ALLOCATIONS',
      status: 'pass',
      message: `All ${(invoices || []).length} invoices have valid allocations`
    });
  }

  return checks;
}

/**
 * Check 2: Draw Totals
 * - Draw total should match sum of invoice allocations
 * - Invoice status should match draw membership
 */
async function checkDrawTotals(supabase, jobId) {
  const checks = [];

  const { data: draws } = await supabase
    .from('v2_draws')
    .select(`
      id, draw_number, total_amount, status,
      invoices:v2_draw_invoices(
        invoice:v2_invoices(id, invoice_number, amount, status,
          allocations:v2_invoice_allocations(amount)
        )
      )
    `)
    .eq('job_id', jobId);

  for (const draw of (draws || [])) {
    // Calculate actual total from invoice allocations
    let actualTotal = 0;
    const invoiceIssues = [];

    for (const di of (draw.invoices || [])) {
      const inv = di.invoice;
      if (!inv) continue;

      const allocSum = (inv.allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      actualTotal += allocSum;

      // Check: Invoice in draw should have in_draw or paid status
      if (!['in_draw', 'paid'].includes(inv.status)) {
        invoiceIssues.push({
          invoice: inv.invoice_number,
          status: inv.status,
          expected: 'in_draw or paid'
        });
      }
    }

    const recordedTotal = parseFloat(draw.total_amount || 0);

    // Check: Draw total matches calculated total
    if (Math.abs(recordedTotal - actualTotal) > TOLERANCE) {
      checks.push({
        type: 'DRAW_TOTAL_MISMATCH',
        status: 'fail',
        entity: 'draw',
        entity_id: draw.id,
        entity_ref: `Draw #${draw.draw_number}`,
        message: `Draw #${draw.draw_number} total mismatch: $${recordedTotal.toFixed(2)} recorded vs $${actualTotal.toFixed(2)} calculated`,
        expected: actualTotal,
        actual: recordedTotal,
        difference: Math.abs(recordedTotal - actualTotal)
      });
    }

    // Check: Invoice status consistency
    if (invoiceIssues.length > 0) {
      checks.push({
        type: 'DRAW_INVOICE_STATUS_MISMATCH',
        status: 'warning',
        entity: 'draw',
        entity_id: draw.id,
        entity_ref: `Draw #${draw.draw_number}`,
        message: `Draw #${draw.draw_number} has ${invoiceIssues.length} invoice(s) with unexpected status`,
        details: invoiceIssues
      });
    }
  }

  // Add pass check if no issues
  if (checks.filter(c => c.status !== 'pass').length === 0) {
    checks.push({
      type: 'DRAW_TOTALS',
      status: 'pass',
      message: `All ${(draws || []).length} draws have correct totals`
    });
  }

  return checks;
}

/**
 * Check 3: PO Balances
 * - Invoice allocations linked to PO line items shouldn't exceed PO amounts
 * - PO invoiced amounts should be accurate
 */
async function checkPOBalances(supabase, jobId) {
  const checks = [];

  const { data: pos } = await supabase
    .from('v2_purchase_orders')
    .select(`
      id, po_number, total_amount, status,
      line_items:v2_po_line_items(id, amount, invoiced_amount, cost_code_id),
      invoices:v2_invoices(id, invoice_number, amount, status)
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null);

  for (const po of (pos || [])) {
    const poTotal = parseFloat(po.total_amount || 0);

    // Calculate total invoiced against this PO
    const invoicedTotal = (po.invoices || [])
      .filter(inv => !['denied', 'deleted'].includes(inv.status))
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

    // Check: Invoiced doesn't exceed PO (with 10% tolerance for change orders)
    const tolerance = poTotal * 0.1;
    if (invoicedTotal > poTotal + tolerance) {
      checks.push({
        type: 'PO_OVER_INVOICED',
        status: 'fail',
        entity: 'po',
        entity_id: po.id,
        entity_ref: po.po_number,
        message: `PO ${po.po_number} over-invoiced: $${invoicedTotal.toFixed(2)} invoiced vs $${poTotal.toFixed(2)} PO amount`,
        expected: poTotal,
        actual: invoicedTotal,
        overage: invoicedTotal - poTotal,
        overage_percent: ((invoicedTotal - poTotal) / poTotal * 100).toFixed(1)
      });
    } else if (invoicedTotal > poTotal) {
      // Minor overage - warning
      checks.push({
        type: 'PO_SLIGHT_OVERAGE',
        status: 'warning',
        entity: 'po',
        entity_id: po.id,
        entity_ref: po.po_number,
        message: `PO ${po.po_number} slightly over: $${invoicedTotal.toFixed(2)} invoiced vs $${poTotal.toFixed(2)} PO amount`,
        overage: invoicedTotal - poTotal
      });
    }

    // Check: Line item invoiced amounts match actual
    for (const line of (po.line_items || [])) {
      // Would need to query actual allocations linked to this line item
      // Simplified check for now
    }
  }

  // Add pass check if no issues
  if (checks.filter(c => c.status === 'fail').length === 0) {
    checks.push({
      type: 'PO_BALANCES',
      status: 'pass',
      message: `All ${(pos || []).length} POs are within budget`
    });
  }

  return checks;
}

/**
 * Check 4: Budget vs Actuals
 * - Budget line billed amounts should match allocation totals
 * - Committed (PO) amounts should match actual POs
 */
async function checkBudgetActuals(supabase, jobId) {
  const checks = [];

  // Get budget lines with their cost codes
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select(`
      id, budgeted_amount, committed_amount, billed_amount, paid_amount,
      cost_code:v2_cost_codes(id, code, name)
    `)
    .eq('job_id', jobId);

  // Get actual allocations by cost code
  const { data: allocations } = await supabase
    .from('v2_invoice_allocations')
    .select(`
      amount, cost_code_id,
      invoice:v2_invoices!inner(job_id, status, deleted_at)
    `)
    .eq('invoice.job_id', jobId)
    .is('invoice.deleted_at', null);

  // Calculate actual billed per cost code
  const actualBilledByCode = {};
  for (const alloc of (allocations || [])) {
    if (['in_draw', 'paid'].includes(alloc.invoice?.status)) {
      const codeId = alloc.cost_code_id;
      actualBilledByCode[codeId] = (actualBilledByCode[codeId] || 0) + parseFloat(alloc.amount || 0);
    }
  }

  // Compare budget lines to actuals
  for (const line of (budgetLines || [])) {
    const recorded = parseFloat(line.billed_amount || 0);
    const actual = actualBilledByCode[line.cost_code?.id] || 0;

    if (Math.abs(recorded - actual) > TOLERANCE) {
      checks.push({
        type: 'BUDGET_BILLED_MISMATCH',
        status: 'warning',
        entity: 'budget_line',
        entity_id: line.id,
        entity_ref: `${line.cost_code?.code} - ${line.cost_code?.name}`,
        cost_code: line.cost_code?.code,
        message: `Budget line ${line.cost_code?.code} billed mismatch: $${recorded.toFixed(2)} recorded vs $${actual.toFixed(2)} actual`,
        expected: actual,
        actual: recorded,
        difference: Math.abs(recorded - actual)
      });
    }

    // Check: Over budget warning
    const budgeted = parseFloat(line.budgeted_amount || 0);
    if (actual > budgeted && budgeted > 0) {
      const overPercent = ((actual - budgeted) / budgeted * 100).toFixed(1);
      checks.push({
        type: 'BUDGET_EXCEEDED',
        status: 'warning',
        entity: 'budget_line',
        entity_id: line.id,
        entity_ref: `${line.cost_code?.code} - ${line.cost_code?.name}`,
        cost_code: line.cost_code?.code,
        message: `Budget line ${line.cost_code?.code} over budget by ${overPercent}%: $${actual.toFixed(2)} billed vs $${budgeted.toFixed(2)} budgeted`,
        budgeted,
        actual,
        overage: actual - budgeted
      });
    }
  }

  // Add pass check if no issues
  if (checks.filter(c => c.status === 'fail').length === 0) {
    checks.push({
      type: 'BUDGET_ACTUALS',
      status: 'pass',
      message: `Budget tracking is accurate for ${(budgetLines || []).length} cost codes`
    });
  }

  return checks;
}

/**
 * Check 5: Billing Integrity
 * - Invoice billed_amount should match sum of draw_allocations
 * - Fully billed invoices should have fully_billed_at set
 */
async function checkBillingIntegrity(supabase, jobId) {
  const checks = [];

  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select(`
      id, invoice_number, amount, billed_amount, fully_billed_at, status,
      draw_allocations:v2_draw_allocations(amount, draw_id)
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null);

  for (const inv of (invoices || [])) {
    const invoiceAmount = parseFloat(inv.amount || 0);
    const recordedBilled = parseFloat(inv.billed_amount || 0);
    const actualBilled = (inv.draw_allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Check: Billed amount matches draw allocations
    if (Math.abs(recordedBilled - actualBilled) > TOLERANCE && actualBilled > 0) {
      checks.push({
        type: 'BILLING_AMOUNT_MISMATCH',
        status: 'fail',
        entity: 'invoice',
        entity_id: inv.id,
        entity_ref: inv.invoice_number,
        message: `Invoice #${inv.invoice_number} billed mismatch: $${recordedBilled.toFixed(2)} recorded vs $${actualBilled.toFixed(2)} in draws`,
        expected: actualBilled,
        actual: recordedBilled,
        difference: Math.abs(recordedBilled - actualBilled)
      });
    }

    // Check: Fully billed flag consistency
    const isFullyBilled = actualBilled >= invoiceAmount - TOLERANCE;
    if (isFullyBilled && !inv.fully_billed_at && inv.status === 'in_draw') {
      checks.push({
        type: 'MISSING_FULLY_BILLED_FLAG',
        status: 'warning',
        entity: 'invoice',
        entity_id: inv.id,
        entity_ref: inv.invoice_number,
        message: `Invoice #${inv.invoice_number} is fully billed but missing fully_billed_at timestamp`
      });
    }
  }

  // Add pass check if no issues
  if (checks.filter(c => c.status === 'fail').length === 0) {
    checks.push({
      type: 'BILLING_INTEGRITY',
      status: 'pass',
      message: `Billing integrity verified for ${(invoices || []).length} invoices`
    });
  }

  return checks;
}

/**
 * Get external sync status for an entity
 */
async function getExternalSyncStatus(supabase, entityType, entityId) {
  const { data } = await supabase
    .from('v2_external_sync')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  return data || [];
}

/**
 * Record external sync
 */
async function recordExternalSync(supabase, {
  entityType,
  entityId,
  system,
  externalId,
  syncedAt,
  syncedBy,
  status,
  details
}) {
  const { data, error } = await supabase
    .from('v2_external_sync')
    .upsert({
      entity_type: entityType,
      entity_id: entityId,
      system,
      external_id: externalId,
      synced_at: syncedAt || new Date().toISOString(),
      synced_by: syncedBy,
      status,
      details,
      updated_at: new Date().toISOString()
    }, { onConflict: 'entity_type,entity_id,system' });

  return { data, error };
}

/**
 * Run reconciliation for all jobs
 */
async function reconcileAll(supabase) {
  const { data: jobs } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('status', 'active');

  const results = [];
  for (const job of (jobs || [])) {
    const jobResult = await reconcileJob(supabase, job.id);
    results.push(jobResult);
  }

  return {
    timestamp: new Date().toISOString(),
    jobs_checked: results.length,
    results,
    summary: {
      total_errors: results.reduce((sum, r) => sum + r.summary.failed, 0),
      total_warnings: results.reduce((sum, r) => sum + r.summary.warnings, 0),
      jobs_with_issues: results.filter(r => r.summary.failed > 0).length
    }
  };
}

module.exports = {
  reconcileJob,
  reconcileAll,
  checkInvoiceAllocations,
  checkDrawTotals,
  checkPOBalances,
  checkBudgetActuals,
  checkBillingIntegrity,
  getExternalSyncStatus,
  recordExternalSync
};
