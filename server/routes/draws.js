/**
 * Draw Routes
 * All draw management endpoints including G702/G703 functionality
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const { logActivity, checkSplitReconciliation, stampInvoice } = require('../services/invoice-helpers');
const { asyncHandler, AppError, notFoundError, validateRequest } = require('../core/errors');
const { validate, schemas } = require('../middleware/validate');
// Storage and pdf-stamper functions removed - using unified stampInvoice instead

// Helper: Log draw activity
async function logDrawActivity(drawId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_draw_activity').insert({
      draw_id: drawId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    logger.error('Failed to log draw activity', { component: 'Draw', drawId, error: err.message });
  }
}

// Helper: Update draw total
async function updateDrawTotal(drawId) {
  const { data: allocations } = await supabase
    .from('v2_draw_allocations')
    .select('amount')
    .eq('draw_id', drawId);

  const total = allocations?.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0) || 0;

  // Also get CO billings
  const { data: coBillings } = await supabase
    .from('v2_job_co_draw_billings')
    .select('amount')
    .eq('draw_id', drawId);

  const coTotal = coBillings?.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0) || 0;

  await supabase.from('v2_draws').update({ total_amount: total + coTotal }).eq('id', drawId);

  return total + coTotal;
}

/**
 * PO-INT-04: Detect CO billing overlap between manual billings and allocations
 * Returns warnings for any COs that have both manual and allocated billings
 */
async function detectCOBillingOverlap(drawId, jobId) {
  const warnings = [];

  // Get manual CO billings for this draw
  const { data: manualBillings } = await supabase
    .from('v2_job_co_draw_billings')
    .select('change_order_id, amount')
    .eq('draw_id', drawId);

  const manualByCO = {};
  (manualBillings || []).forEach(b => {
    manualByCO[b.change_order_id] = (manualByCO[b.change_order_id] || 0) + parseFloat(b.amount || 0);
  });

  // Get invoice allocations linked to COs in this draw
  const { data: drawInvoices } = await supabase
    .from('v2_draw_invoices')
    .select('invoice_id')
    .eq('draw_id', drawId);

  const invoiceIds = (drawInvoices || []).map(di => di.invoice_id);

  if (invoiceIds.length > 0) {
    const { data: invoiceAllocs } = await supabase
      .from('v2_invoice_allocations')
      .select('change_order_id, amount')
      .in('invoice_id', invoiceIds)
      .not('change_order_id', 'is', null);

    const allocByCO = {};
    (invoiceAllocs || []).forEach(a => {
      allocByCO[a.change_order_id] = (allocByCO[a.change_order_id] || 0) + parseFloat(a.amount || 0);
    });

    // Check for overlap
    for (const coId of Object.keys(manualByCO)) {
      if (allocByCO[coId]) {
        warnings.push({
          change_order_id: coId,
          manual_amount: manualByCO[coId],
          allocated_amount: allocByCO[coId],
          message: `CO has both manual billing ($${manualByCO[coId].toFixed(2)}) and invoice allocations ($${allocByCO[coId].toFixed(2)}) in this draw - potential double-count`
        });
      }
    }
  }

  return warnings;
}

/**
 * DRW-INT-03: Validate draw allocations match source invoice allocations
 * Returns array of mismatches if any drift detected
 */
async function validateDrawAllocations(drawId) {
  const mismatches = [];

  // Get all draw allocations
  const { data: drawAllocs } = await supabase
    .from('v2_draw_allocations')
    .select('invoice_id, cost_code_id, amount')
    .eq('draw_id', drawId);

  if (!drawAllocs || drawAllocs.length === 0) return mismatches;

  // Group draw allocations by invoice
  const drawAllocsByInvoice = {};
  for (const da of drawAllocs) {
    if (!drawAllocsByInvoice[da.invoice_id]) {
      drawAllocsByInvoice[da.invoice_id] = [];
    }
    drawAllocsByInvoice[da.invoice_id].push(da);
  }

  // Compare each invoice's draw allocations to its source allocations
  for (const [invoiceId, drawInvoiceAllocs] of Object.entries(drawAllocsByInvoice)) {
    const { data: sourceAllocs } = await supabase
      .from('v2_invoice_allocations')
      .select('cost_code_id, amount')
      .eq('invoice_id', invoiceId);

    // Sum by cost code for comparison
    const drawByCode = {};
    for (const da of drawInvoiceAllocs) {
      drawByCode[da.cost_code_id] = (drawByCode[da.cost_code_id] || 0) + parseFloat(da.amount || 0);
    }

    const sourceByCode = {};
    for (const sa of (sourceAllocs || [])) {
      sourceByCode[sa.cost_code_id] = (sourceByCode[sa.cost_code_id] || 0) + parseFloat(sa.amount || 0);
    }

    // Check for differences
    const allCodes = new Set([...Object.keys(drawByCode), ...Object.keys(sourceByCode)]);
    for (const codeId of allCodes) {
      const drawAmt = drawByCode[codeId] || 0;
      const sourceAmt = sourceByCode[codeId] || 0;
      if (Math.abs(drawAmt - sourceAmt) > 0.01) {
        mismatches.push({
          invoice_id: invoiceId,
          cost_code_id: codeId,
          draw_amount: drawAmt,
          source_amount: sourceAmt,
          difference: drawAmt - sourceAmt
        });
      }
    }
  }

  return mismatches;
}

// ============================================================
// LIST ENDPOINTS
// ============================================================

// List all draws
router.get('/', asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('v2_draws')
      .select(`
        *,
        job:v2_jobs(id, name),
        invoices:v2_draw_invoices(
          invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(name))
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const drawIds = data.map(d => d.id);
    const { data: coBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('draw_id, amount')
      .in('draw_id', drawIds.length > 0 ? drawIds : ['00000000-0000-0000-0000-000000000000']);

    const drawsWithTotals = data.map(draw => {
      const invoiceTotal = draw.invoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
      const coTotal = (coBillings || [])
        .filter(b => b.draw_id === draw.id)
        .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      return {
        ...draw,
        total_amount: invoiceTotal + coTotal,
        invoice_total: invoiceTotal,
        co_total: coTotal
      };
    });

    res.json(drawsWithTotals);
}));

// Get single draw with G702/G703 data
router.get('/:id', validate(schemas.idParam), asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`*, job:v2_jobs(id, name, address, client_name, contract_amount)`)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    // DRW-INT-01: Recalculate draw total from actual allocations
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId);

    const recalculatedTotal = (drawAllocations || []).reduce(
      (sum, a) => sum + parseFloat(a.amount || 0), 0
    );

    // Also get CO billings for this draw
    const { data: coBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('amount')
      .eq('draw_id', drawId);

    const coTotal = (coBillings || []).reduce(
      (sum, b) => sum + parseFloat(b.amount || 0), 0
    );

    const calculatedTotalAmount = recalculatedTotal + coTotal;

    // Log if stored differs from calculated (data integrity check)
    if (Math.abs(parseFloat(draw.total_amount || 0) - calculatedTotalAmount) > 0.01) {
      logger.warn('Stored total differs from calculated', { component: 'Draw', drawId, storedTotal: draw.total_amount, calculatedTotal: calculatedTotalAmount });
    }

    // Get invoices in this draw
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          id, invoice_number, invoice_date, amount, status, pdf_url, pdf_stamped_url,
          vendor:v2_vendors(id, name),
          allocations:v2_invoice_allocations(
            id, amount, notes, change_order_id,
            cost_code:v2_cost_codes(id, code, name)
          )
        )
      `)
      .eq('draw_id', drawId);

    // Get budget lines
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select(`
        id, budgeted_amount, committed_amount, billed_amount, paid_amount,
        cost_code:v2_cost_codes(id, code, name)
      `)
      .eq('job_id', draw.job_id);

    // Get previous draws
    const { data: previousDraws } = await supabase
      .from('v2_draws')
      .select('id, draw_number')
      .eq('job_id', draw.job_id)
      .lt('draw_number', draw.draw_number)
      .order('draw_number', { ascending: true });

    const isCOCostCode = (code) => code && /C$/i.test(code.trim());

    // Calculate previous period totals
    let previousByCode = {};
    let previousCOByAlloc = {};
    let previousUnlinkedCO = { amount: 0, allocations: [] };

    if (previousDraws?.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`
          invoice:v2_invoices(
            allocations:v2_invoice_allocations(
              amount, cost_code_id, change_order_id,
              cost_code:v2_cost_codes(id, code, name)
            )
          )
        `)
        .in('draw_id', prevDrawIds);

      if (prevInvoices) {
        prevInvoices.forEach(di => {
          if (di.invoice?.allocations) {
            di.invoice.allocations.forEach(alloc => {
              const costCode = alloc.cost_code?.code;

              if (alloc.change_order_id) {
                if (!previousCOByAlloc[alloc.change_order_id]) previousCOByAlloc[alloc.change_order_id] = 0;
                previousCOByAlloc[alloc.change_order_id] += parseFloat(alloc.amount) || 0;
                return;
              }

              if (isCOCostCode(costCode)) {
                previousUnlinkedCO.amount += parseFloat(alloc.amount) || 0;
                return;
              }

              if (!previousByCode[alloc.cost_code_id]) previousByCode[alloc.cost_code_id] = 0;
              previousByCode[alloc.cost_code_id] += parseFloat(alloc.amount) || 0;
            });
          }
        });
      }
    }

    // Calculate this period totals
    let thisPeriodByCode = {};
    let thisPeriodCOByAlloc = {};
    let thisPeriodUnlinkedCO = { amount: 0, allocations: [] };

    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean).map(inv => ({
      ...inv,
      vendor_name: inv.vendor?.name || null,
      invoice_allocations: inv.allocations
    })) || [];
    invoices.forEach(inv => {
      if (inv.allocations) {
        inv.allocations.forEach(alloc => {
          const codeId = alloc.cost_code?.id;
          const costCode = alloc.cost_code?.code;

          if (alloc.change_order_id) {
            if (!thisPeriodCOByAlloc[alloc.change_order_id]) {
              thisPeriodCOByAlloc[alloc.change_order_id] = { amount: 0, allocations: [] };
            }
            thisPeriodCOByAlloc[alloc.change_order_id].amount += parseFloat(alloc.amount) || 0;
            thisPeriodCOByAlloc[alloc.change_order_id].allocations.push(alloc);
            return;
          }

          if (isCOCostCode(costCode)) {
            thisPeriodUnlinkedCO.amount += parseFloat(alloc.amount) || 0;
            thisPeriodUnlinkedCO.allocations.push(alloc);
            return;
          }

          if (codeId) {
            if (!thisPeriodByCode[codeId]) thisPeriodByCode[codeId] = 0;
            thisPeriodByCode[codeId] += parseFloat(alloc.amount) || 0;
          }
        });
      }
    });

    // Build G703 schedule
    const allCostCodeIds = new Set();
    (budgetLines || []).forEach(bl => { if (bl.cost_code?.id) allCostCodeIds.add(bl.cost_code.id); });
    Object.keys(previousByCode).forEach(id => allCostCodeIds.add(id));
    Object.keys(thisPeriodByCode).forEach(id => allCostCodeIds.add(id));

    const budgetByCode = {};
    (budgetLines || []).forEach(bl => { if (bl.cost_code?.id) budgetByCode[bl.cost_code.id] = bl; });

    let itemNum = 0;
    const scheduleOfValues = [...allCostCodeIds].map(codeId => {
      const bl = budgetByCode[codeId];
      const costCode = bl?.cost_code;
      if (!costCode) return null;

      const budget = parseFloat(bl?.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const totalBilled = previous + thisPeriod;
      const percentComplete = budget > 0 ? (totalBilled / budget) * 100 : (totalBilled > 0 ? 100 : 0);

      // DRW-INT-02: Include all cost codes with budget, even if 0% billed
      // Only filter out if BOTH: no current billing AND no budget AND no previous billings
      if (thisPeriod === 0 && budget === 0 && previous === 0) return null;

      itemNum++;
      return {
        item: itemNum,
        costCodeId: codeId,
        costCode: costCode.code,
        description: costCode.name,
        budget,
        scheduledValue: budget,
        previousBilled: previous,
        currentBilled: thisPeriod,
        thisPeriod,
        materialsStored: 0,
        totalBilled,
        percentComplete,
        balance: budget - totalBilled
      };
    }).filter(Boolean).sort((a, b) => (a.costCode || '').localeCompare(b.costCode || ''));

    // Calculate G702 totals
    const totalScheduled = scheduleOfValues.reduce((sum, item) => sum + item.scheduledValue, 0);
    const totalPrevious = scheduleOfValues.reduce((sum, item) => sum + item.previousBilled, 0);
    const totalThisPeriod = scheduleOfValues.reduce((sum, item) => sum + item.thisPeriod, 0);

    // Change Order data
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .eq('status', 'approved')
      .order('change_order_number', { ascending: true });

    const changeOrderTotal = (jobChangeOrders || []).reduce((sum, co) => sum + parseFloat(co.amount || 0), 0);

    // CO billings
    const { data: thisDrawCOBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount)')
      .eq('draw_id', drawId);

    let previousCOBillingsManual = [];
    if (previousDraws?.length > 0) {
      const { data: prevCO } = await supabase
        .from('v2_job_co_draw_billings')
        .select('amount, draw_id, change_order_id')
        .in('draw_id', previousDraws.map(d => d.id));
      previousCOBillingsManual = prevCO || [];
    }

    const manualCOThisPeriod = (thisDrawCOBillings || []).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    const manualCOPrevious = previousCOBillingsManual.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    const allocCOThisPeriod = Object.values(thisPeriodCOByAlloc).reduce((sum, co) => sum + co.amount, 0);
    const allocCOPrevious = Object.values(previousCOByAlloc).reduce((sum, amt) => sum + amt, 0);
    const unlinkedCOThisPeriod = thisPeriodUnlinkedCO.amount;
    const unlinkedCOPrevious = previousUnlinkedCO.amount;

    const coBilledThisPeriod = manualCOThisPeriod + allocCOThisPeriod + unlinkedCOThisPeriod;
    const coBilledPreviously = manualCOPrevious + allocCOPrevious + unlinkedCOPrevious;

    // CO Schedule of Values
    const cosWithBillingsSet = new Set();
    (jobChangeOrders || []).forEach(co => {
      const hasManualBilling = (thisDrawCOBillings || []).some(b => b.change_order_id === co.id);
      const hasAllocBilling = thisPeriodCOByAlloc[co.id]?.amount > 0;
      if (hasManualBilling || hasAllocBilling) cosWithBillingsSet.add(co.id);
    });

    const coScheduleOfValues = (jobChangeOrders || [])
      .filter(co => cosWithBillingsSet.has(co.id))
      .map((co, idx) => {
        const prevManual = previousCOBillingsManual.filter(b => b.change_order_id === co.id).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
        const thisPeriodManual = (thisDrawCOBillings || []).filter(b => b.change_order_id === co.id).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
        const prevAlloc = previousCOByAlloc[co.id] || 0;
        const thisPeriodAlloc = thisPeriodCOByAlloc[co.id]?.amount || 0;

        const prevBillings = prevManual + prevAlloc;
        const thisPeriodBilling = thisPeriodManual + thisPeriodAlloc;
        const totalBilled = prevBillings + thisPeriodBilling;
        const coAmount = parseFloat(co.amount || 0);

        return {
          itemNumber: idx + 1,
          changeOrderId: co.id,
          changeOrderNumber: co.change_order_number,
          title: co.title,
          scheduledValue: coAmount,
          coAmount,
          daysAdded: parseInt(co.days_added) || 0,
          previousBillings: prevBillings,
          thisPeriodBilling,
          totalBilled,
          percentComplete: coAmount > 0 ? Math.min((totalBilled / coAmount) * 100, 100) : 0,
          balance: coAmount - totalBilled,
          clientApproved: !!co.client_approved_at || co.client_approval_bypassed
        };
      });

    const grandTotalCompleted = totalPrevious + totalThisPeriod + coBilledPreviously + coBilledThisPeriod;
    const currentPaymentDue = totalThisPeriod + coBilledThisPeriod;
    const contractSum = parseFloat(draw.job?.contract_amount || 0);
    const contractSumToDate = contractSum + changeOrderTotal;

    // Attachments and Activity
    const { data: attachments } = await supabase
      .from('v2_draw_attachments')
      .select('*, vendor:v2_vendors(id, name)')
      .eq('draw_id', drawId)
      .order('uploaded_at', { ascending: false });

    const { data: activity } = await supabase
      .from('v2_draw_activity')
      .select('*')
      .eq('draw_id', drawId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // DRW-INT-03: Validate allocations match source invoices
    const allocationMismatches = await validateDrawAllocations(drawId);
    if (allocationMismatches.length > 0) {
      logger.warn('Found allocation mismatches', { component: 'Draw', drawId, count: allocationMismatches.length, sample: allocationMismatches.slice(0, 3) });
    }

    // PO-INT-04: Detect CO billing overlap
    const coBillingOverlap = await detectCOBillingOverlap(drawId, draw.job_id);
    if (coBillingOverlap.length > 0) {
      logger.warn('Found CO billing overlaps', { component: 'Draw', drawId, count: coBillingOverlap.length, overlaps: coBillingOverlap });
    }

    res.json({
      ...draw,
      total_amount: calculatedTotalAmount,  // Use recalculated value
      stored_total_amount: draw.total_amount,  // Keep original for debugging
      invoices,
      invoiceCount: invoices.length,
      scheduleOfValues,
      changeOrders: jobChangeOrders || [],
      changeOrderTotal,
      coScheduleOfValues,
      coBillings: thisDrawCOBillings || [],
      coBilledThisPeriod,
      coBilledPreviously,
      unlinkedCOAllocations: {
        thisPeriod: thisPeriodUnlinkedCO,
        previous: previousUnlinkedCO,
        totalThisPeriod: unlinkedCOThisPeriod,
        totalPrevious: unlinkedCOPrevious
      },
      attachments: attachments || [],
      activity: activity || [],
      validation: {
        allocation_mismatches: allocationMismatches,
        has_drift: allocationMismatches.length > 0,
        co_billing_overlap: coBillingOverlap,
        has_co_overlap: coBillingOverlap.length > 0
      },
      g702: {
        applicationNumber: draw.draw_number,
        periodTo: draw.period_end,
        contractSum,
        netChangeOrders: changeOrderTotal,
        contractSumToDate,
        totalCompletedPrevious: totalPrevious + coBilledPreviously,
        totalCompletedThisPeriod: totalThisPeriod + coBilledThisPeriod,
        materialsStored: 0,
        grandTotal: grandTotalCompleted,
        lessPreviousCertificates: totalPrevious + coBilledPreviously,
        currentPaymentDue,
        calculatedTotal: calculatedTotalAmount  // Add verification field
      }
    });
}));

// Get draw activity
router.get('/:id/activity', asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('v2_draw_activity')
      .select('*')
      .eq('draw_id', req.params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
}));

// ============================================================
// CREATE/UPDATE ENDPOINTS
// ============================================================

// Update draw
router.patch('/:id', validate(schemas.drawUpdate), asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { draw_number, period_end, notes, g702_overrides } = req.body;

    const { data: currentDraw } = await supabase
      .from('v2_draws')
      .select('status')
      .eq('id', drawId)
      .single();

    if (currentDraw?.status !== 'draft') {
      return res.status(400).json({ error: 'Can only edit draft draws' });
    }

    const updateData = { updated_at: new Date().toISOString() };
    if (draw_number !== undefined) updateData.draw_number = draw_number;
    if (period_end !== undefined) updateData.period_end = period_end;
    if (notes !== undefined) updateData.notes = notes;
    if (g702_overrides) {
      if (g702_overrides.original_contract_sum !== undefined) updateData.g702_original_contract_override = g702_overrides.original_contract_sum;
      if (g702_overrides.net_change_orders !== undefined) updateData.g702_change_orders_override = g702_overrides.net_change_orders;
    }

    const { data, error } = await supabase.from('v2_draws').update(updateData).eq('id', drawId).select().single();
    if (error) throw error;
    res.json(data);
}));

// ============================================================
// INVOICE MANAGEMENT
// ============================================================

// Add invoices to draw
router.post('/:id/add-invoices', validateRequest({
  params: { id: { type: 'uuid' } },
  body: { invoice_ids: { required: true } }
}), asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { invoice_ids } = req.body;
    let missingBudgetLines = null;
    const processedInvoices = [];

    // GUARDRAIL: Validate that all invoices have allocations before adding to draw
    const { data: invoicesToValidate } = await supabase
      .from('v2_invoices')
      .select(`
        id, invoice_number, amount,
        allocations:v2_invoice_allocations(id, amount)
      `)
      .in('id', invoice_ids);

    const invoicesWithoutAllocations = [];
    for (const inv of (invoicesToValidate || [])) {
      const allocSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      if (allocSum === 0) {
        invoicesWithoutAllocations.push(inv.invoice_number || inv.id);
      }
    }

    if (invoicesWithoutAllocations.length > 0) {
      return res.status(400).json({
        error: 'Cannot add invoices without allocations to draw',
        message: `The following invoices have no cost code allocations: ${invoicesWithoutAllocations.join(', ')}. Please allocate these invoices to cost codes before adding to a draw.`,
        invoices_missing_allocations: invoicesWithoutAllocations
      });
    }

    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('id', drawId)
      .single();

    try {
      // Insert all draw_invoices first
      const { error: insertError } = await supabase
        .from('v2_draw_invoices')
        .insert(invoice_ids.map(id => ({ draw_id: drawId, invoice_id: id })));

      if (insertError) throw insertError;

    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select(`
        id, amount, pdf_url, job_id, billed_amount, billable_amount, non_billable_reason,
        allocations:v2_invoice_allocations(id, amount, cost_code_id, notes)
      `)
      .in('id', invoice_ids);

    const partialInvoices = [];
    const fullyBilledInvoices = [];
    const nonBillableInvoices = [];

    for (const inv of invoices) {
      const invoiceAmount = parseFloat(inv.amount || 0);
      // Use billable_amount if set, otherwise use full amount
      const effectiveBillableAmount = inv.billable_amount !== null
        ? parseFloat(inv.billable_amount)
        : invoiceAmount;

      // Skip non-billable invoices from draw (but still mark them as processed)
      if (effectiveBillableAmount === 0) {
        nonBillableInvoices.push({
          id: inv.id,
          amount: invoiceAmount,
          reason: inv.non_billable_reason || 'non-billable'
        });
        // Update status but don't add to draw
        await supabase.from('v2_invoices').update({
          status: 'paid', // Non-billable goes straight to paid (absorbed)
          fully_billed_at: new Date().toISOString()
        }).eq('id', inv.id);
        // Remove from draw_invoices since we just inserted it
        await supabase.from('v2_draw_invoices').delete()
          .eq('draw_id', drawId)
          .eq('invoice_id', inv.id);
        await logActivity(inv.id, 'non_billable_absorbed', 'System', {
          amount: invoiceAmount,
          reason: inv.non_billable_reason
        });
        continue;
      }

      const previouslyBilled = parseFloat(inv.billed_amount || 0);
      const currentAllocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      // Cap allocation to billable amount
      const cappedAllocationSum = Math.min(currentAllocationSum, effectiveBillableAmount - previouslyBilled);
      const newBilledTotal = previouslyBilled + cappedAllocationSum;
      const isCredit = invoiceAmount < 0;
      // Check against billable amount, not total amount
      const isFullyBilled = isCredit
        ? newBilledTotal <= effectiveBillableAmount + 0.01
        : newBilledTotal >= effectiveBillableAmount - 0.01;

      // Copy allocations to draw_allocations
      // If partially billable, scale allocations proportionally
      const allocationTotal = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      const billableRatio = (effectiveBillableAmount < allocationTotal && allocationTotal > 0)
        ? effectiveBillableAmount / allocationTotal
        : 1.0;

      for (const alloc of (inv.allocations || [])) {
        // Scale allocation amount by billable ratio if invoice is partially billable
        const billableAllocAmount = parseFloat(alloc.amount || 0) * billableRatio;
        await supabase.from('v2_draw_allocations').upsert({
          draw_id: drawId,
          invoice_id: inv.id,
          cost_code_id: alloc.cost_code_id,
          amount: billableAllocAmount,
          notes: billableRatio < 1 ? `${alloc.notes || ''} (Partial: ${Math.round(billableRatio * 100)}% billable)`.trim() : alloc.notes,
          created_by: 'System'
        }, { onConflict: 'draw_id,invoice_id,cost_code_id' });
      }

      // Re-stamp PDF with full stamp chain (approval + in_draw)
      // Uses unified stampInvoice which properly layers stamps
      try {
        await stampInvoice(inv.id, { force: true });
      } catch (stampErr) {
        logger.error('IN DRAW stamp failed', { component: 'Draw', invoiceId: inv.id, error: stampErr.message });
      }

      const cappedBilledTotal = isCredit
        ? Math.max(newBilledTotal, invoiceAmount)
        : Math.min(newBilledTotal, invoiceAmount);

      const updateData = { billed_amount: cappedBilledTotal };

      if (isFullyBilled) {
        updateData.status = 'in_draw';
        updateData.fully_billed_at = new Date().toISOString();
        fullyBilledInvoices.push(inv.id);

        await logActivity(inv.id, 'added_to_draw', 'System', {
          draw_number: draw?.draw_number,
          fully_billed: true
        });
      } else {
        // Partial allocation: send back for approval with remaining billable amount
        updateData.status = 'needs_approval';
        partialInvoices.push({
          id: inv.id,
          billed: cappedAllocationSum,
          remaining: effectiveBillableAmount - newBilledTotal
        });

        await logActivity(inv.id, 'partial_billed', 'System', {
          draw_number: draw?.draw_number,
          remaining_amount: effectiveBillableAmount - newBilledTotal,
          sent_back_for: 'approval'
        });
      }

      await supabase.from('v2_invoices').update(updateData).eq('id', inv.id);

      // Track this invoice as processed for potential rollback
      processedInvoices.push(inv.id);

      // Update budget billed_amount for each allocation
      if (inv.job_id && inv.allocations && inv.allocations.length > 0) {
        for (const alloc of inv.allocations) {
          if (!alloc.cost_code_id) continue;

          const { data: budgetLine } = await supabase
            .from('v2_budget_lines')
            .select('id, billed_amount')
            .eq('job_id', inv.job_id)
            .eq('cost_code_id', alloc.cost_code_id)
            .single();

          if (budgetLine) {
            const newBilled = (parseFloat(budgetLine.billed_amount) || 0) + parseFloat(alloc.amount);
            await supabase
              .from('v2_budget_lines')
              .update({ billed_amount: newBilled })
              .eq('id', budgetLine.id);
          } else {
            // Budget line must exist before invoicing
            // Log warning but don't fail the operation
            logger.warn('No budget line found', { component: 'Draw', jobId: inv.job_id, costCodeId: alloc.cost_code_id });
            // Collect for response so user knows
            if (!missingBudgetLines) missingBudgetLines = [];
            missingBudgetLines.push({
              invoice_id: inv.id,
              cost_code_id: alloc.cost_code_id,
              amount: alloc.amount
            });
          }
        }
      }
    }

    // Clear allocations for partial invoices
    for (const partial of partialInvoices) {
      await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', partial.id);
    }

    await updateDrawTotal(drawId);

    res.json({
      success: true,
      fully_billed: fullyBilledInvoices.length,
      partial_billed: partialInvoices.length,
      non_billable: nonBillableInvoices.length,
      partial_invoices: partialInvoices,
      non_billable_invoices: nonBillableInvoices,
      warnings: missingBudgetLines ? {
        missing_budget_lines: missingBudgetLines,
        message: 'Some allocations could not update budget because no budget line exists. Please add budget for these cost codes.'
      } : undefined
    });

    } catch (err) {
      logger.error('Add to draw error', { component: 'ADD-TO-DRAW', drawId, error: err.message });

      // Rollback: Remove all inserted draw_invoices and draw_allocations
      if (processedInvoices.length > 0 || invoice_ids.length > 0) {
        try {
          await supabase.from('v2_draw_invoices')
            .delete()
            .eq('draw_id', drawId)
            .in('invoice_id', invoice_ids);

          await supabase.from('v2_draw_allocations')
            .delete()
            .eq('draw_id', drawId)
            .in('invoice_id', invoice_ids);

          logger.info('Rolled back draw_invoices and draw_allocations', { component: 'ADD-TO-DRAW', drawId });
        } catch (rollbackErr) {
          logger.error('Rollback failed', { component: 'ADD-TO-DRAW', drawId, error: rollbackErr.message });
        }
      }

      throw err; // Re-throw so asyncHandler sends error response
    }
}));

// Remove invoice from draw
router.post('/:id/remove-invoice', asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { invoice_id, performed_by = 'System' } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id is required' });
    }

    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    if (draw.status !== 'draft') {
      return res.status(400).json({ error: 'Cannot remove invoices from non-draft draws' });
    }

    // Get invoice with allocations BEFORE removing from draw
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, total_amount),
        allocations:v2_invoice_allocations(id, amount, cost_code_id)
      `)
      .eq('id', invoice_id)
      .single();

    // Get draw allocations to decrement budget
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('cost_code_id, amount')
      .eq('draw_id', drawId)
      .eq('invoice_id', invoice_id);

    // Decrement budget billed_amount for each allocation
    if (invoice?.job?.id && drawAllocations && drawAllocations.length > 0) {
      for (const alloc of drawAllocations) {
        if (!alloc.cost_code_id) continue;

        const { data: budgetLine } = await supabase
          .from('v2_budget_lines')
          .select('id, billed_amount')
          .eq('job_id', invoice.job.id)
          .eq('cost_code_id', alloc.cost_code_id)
          .single();

        if (budgetLine) {
          const newBilled = Math.max(0, (parseFloat(budgetLine.billed_amount) || 0) - parseFloat(alloc.amount));
          await supabase
            .from('v2_budget_lines')
            .update({ billed_amount: newBilled })
            .eq('id', budgetLine.id);
        } else {
          // This shouldn't happen if add-invoices worked correctly
          logger.warn('No budget line found when removing invoice allocation', { component: 'Draw', jobId: invoice.job.id, costCodeId: alloc.cost_code_id });
        }
      }
    }

    await supabase.from('v2_draw_allocations').delete().eq('draw_id', drawId).eq('invoice_id', invoice_id);
    await supabase.from('v2_draw_invoices').delete().eq('draw_id', drawId).eq('invoice_id', invoice_id);

    // Update status first so stampInvoice applies correct stamp
    await supabase.from('v2_invoices').update({ status: 'approved' }).eq('id', invoice_id);

    // Re-stamp with just APPROVED (stampInvoice reads current status)
    try {
      await stampInvoice(invoice_id, { force: true });
    } catch (stampErr) {
      logger.error('Re-stamping failed', { component: 'Draw', invoiceId: invoice_id, error: stampErr.message });
    }
    await logActivity(invoice_id, 'removed_from_draw', performed_by, { draw_number: draw.draw_number });
    await logDrawActivity(drawId, 'invoice_removed', performed_by, { invoice_id, invoice_number: invoice?.invoice_number });

    const newTotal = await updateDrawTotal(drawId);

    res.json({ success: true, new_total: newTotal, draw_number: draw.draw_number });
}));

// ============================================================
// VALIDATION
// ============================================================

/**
 * GET /api/draws/:id/validate
 * Validates G703 cost code accuracy before submission
 * CCL-04: Returns validation errors (blocking) and warnings (informational)
 */
router.get('/:id/validate', asyncHandler(async (req, res) => {
  const drawId = req.params.id;
  const errors = [];
  const warnings = [];

  // Get draw with job info
  const { data: draw, error: drawError } = await supabase
    .from('v2_draws')
    .select('*, job:v2_jobs(id, name)')
    .eq('id', drawId)
    .single();

  if (drawError || !draw) {
    return res.status(404).json({ error: 'Draw not found' });
  }

  // Get all allocations for this draw
  const { data: allocations } = await supabase
    .from('v2_draw_allocations')
    .select(`
      id,
      cost_code_id,
      amount,
      cost_code:v2_cost_codes(id, code, name)
    `)
    .eq('draw_id', drawId);

  // Get budget lines for this job
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('cost_code_id, budgeted_amount')
    .eq('job_id', draw.job_id);

  const budgetCodes = new Set((budgetLines || []).map(bl => bl.cost_code_id));
  const allocByCostCode = {};

  // Check each allocation
  for (const alloc of (allocations || [])) {
    const ccId = alloc.cost_code_id;
    const amount = parseFloat(alloc.amount || 0);

    // Sum by cost code
    allocByCostCode[ccId] = (allocByCostCode[ccId] || 0) + amount;

    // Check: allocation has budget line
    if (!budgetCodes.has(ccId)) {
      const codeName = alloc.cost_code?.code || ccId;
      errors.push({
        type: 'missing_budget_line',
        cost_code_id: ccId,
        cost_code: codeName,
        amount: amount,
        message: `Cost code ${codeName} has no budget line for this job`
      });
    }
  }

  // Check: totals match
  const allocTotal = Object.values(allocByCostCode).reduce((sum, amt) => sum + amt, 0);
  const storedTotal = parseFloat(draw.total_amount || 0);
  const diff = Math.abs(allocTotal - storedTotal);

  if (diff > 0.01) {
    warnings.push({
      type: 'total_mismatch',
      calculated: allocTotal,
      stored: storedTotal,
      difference: allocTotal - storedTotal,
      message: `Draw total (${storedTotal.toFixed(2)}) doesn't match allocation sum (${allocTotal.toFixed(2)})`
    });
  }

  // Check: empty draw
  if ((allocations || []).length === 0) {
    warnings.push({
      type: 'empty_draw',
      message: 'Draw has no allocations - add invoices before submitting'
    });
  }

  res.json({
    valid: errors.length === 0,
    draw_id: drawId,
    draw_number: draw.draw_number,
    job: draw.job?.name,
    errors,
    warnings,
    summary: {
      allocation_count: (allocations || []).length,
      cost_codes_used: Object.keys(allocByCostCode).length,
      total_amount: allocTotal
    }
  });
}));

// ============================================================
// STATUS TRANSITIONS
// ============================================================

// Submit draw
router.patch('/:id/submit', asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { submitted_by = 'System' } = req.body;

    // CCL-04: Run validation before allowing submit
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('*, job:v2_jobs(id, name)')
      .eq('id', drawId)
      .single();

    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    if (draw.status !== 'draft') {
      return res.status(400).json({ error: `Cannot submit a draw that is already ${draw.status}` });
    }

    // Get allocations for validation
    const { data: allocations } = await supabase
      .from('v2_draw_allocations')
      .select('cost_code_id, amount')
      .eq('draw_id', drawId);

    // Get budget lines
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select('cost_code_id')
      .eq('job_id', draw.job_id);

    const budgetCodes = new Set((budgetLines || []).map(bl => bl.cost_code_id));

    // Check for cost codes without budget lines (blocking error)
    const missingBudget = (allocations || []).filter(a => !budgetCodes.has(a.cost_code_id));
    if (missingBudget.length > 0) {
      // Get cost code details for better error message
      const missingCodeIds = [...new Set(missingBudget.map(a => a.cost_code_id))];
      const { data: costCodes } = await supabase
        .from('v2_cost_codes')
        .select('id, code, name')
        .in('id', missingCodeIds);

      const codeMap = {};
      (costCodes || []).forEach(cc => { codeMap[cc.id] = cc; });

      return res.status(400).json({
        error: 'Cannot submit draw with allocations to cost codes without budget lines',
        validation_errors: missingBudget.map(a => ({
          type: 'missing_budget_line',
          cost_code_id: a.cost_code_id,
          cost_code: codeMap[a.cost_code_id]?.code || a.cost_code_id,
          cost_code_name: codeMap[a.cost_code_id]?.name,
          amount: parseFloat(a.amount || 0)
        })),
        hint: 'Add budget lines for these cost codes or remove the allocations'
      });
    }

    const now = new Date().toISOString();
    const applicationDate = new Date().toISOString().split('T')[0];

    const { data: updatedDraw, error } = await supabase
      .from('v2_draws')
      .update({
        status: 'submitted',
        submitted_at: now,
        locked_at: now,
        application_date: applicationDate
      })
      .eq('id', drawId)
      .select()
      .single();

    if (error) throw error;

    await logDrawActivity(drawId, 'submitted', submitted_by, {
      draw_number: updatedDraw.draw_number,
      total_amount: updatedDraw.total_amount
    });

    res.json(updatedDraw);
}));

// Unsubmit draw
router.post('/:id/unsubmit', asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { reason, performed_by = 'System' } = req.body;

    const { data: drawInfo } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!drawInfo) return res.status(404).json({ error: 'Draw not found' });
    if (drawInfo.status !== 'submitted') {
      return res.status(400).json({ error: 'Cannot unsubmit - draw is not in submitted status' });
    }

    const { data: draw, error } = await supabase
      .from('v2_draws')
      .update({
        status: 'draft',
        locked_at: null,
        unsubmitted_at: new Date().toISOString(),
        unsubmit_reason: reason || null
      })
      .eq('id', drawId)
      .select()
      .single();

    if (error) throw error;

    await logDrawActivity(drawId, 'unsubmitted', performed_by, {
      draw_number: draw.draw_number,
      reason: reason || 'No reason provided'
    });

    res.json(draw);
}));

// Fund draw
router.patch('/:id/fund', asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { funded_amount, partial_funding_note, funded_by = 'System' } = req.body;

    const { data: drawBefore } = await supabase
      .from('v2_draws')
      .select('draw_number, total_amount, job_id, status, locked_at')
      .eq('id', drawId)
      .single();

    if (!drawBefore) return res.status(404).json({ error: 'Draw not found' });
    if (drawBefore.status === 'draft') {
      return res.status(400).json({ error: 'Cannot fund a draft draw. Submit first.' });
    }
    if (drawBefore.status === 'funded') {
      return res.status(400).json({ error: 'Draw has already been funded' });
    }

    const billedAmount = parseFloat(drawBefore.total_amount || 0);
    const actualFunded = parseFloat(funded_amount || billedAmount);
    const fundingDifference = actualFunded - billedAmount;
    const now = new Date().toISOString();

    const { data: draw, error } = await supabase
      .from('v2_draws')
      .update({
        status: 'funded',
        funded_at: now,
        funded_amount: actualFunded,
        funding_difference: fundingDifference,
        partial_funding_note: partial_funding_note || null,
        locked_at: drawBefore.locked_at || now
      })
      .eq('id', drawId)
      .select()
      .single();

    if (error) throw error;

    await logDrawActivity(drawId, 'funded', funded_by, {
      draw_number: draw.draw_number,
      billed_amount: billedAmount,
      funded_amount: actualFunded,
      funding_difference: fundingDifference
    });

    // Get draw allocations and update invoices
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('invoice_id, cost_code_id, amount')
      .eq('draw_id', drawId);

    const invoiceAllocations = {};
    for (const alloc of drawAllocations || []) {
      if (!invoiceAllocations[alloc.invoice_id]) invoiceAllocations[alloc.invoice_id] = [];
      invoiceAllocations[alloc.invoice_id].push(alloc);
    }

    const invoiceIds = Object.keys(invoiceAllocations);
    if (invoiceIds.length > 0) {
      const { data: invoices } = await supabase
        .from('v2_invoices')
        .select('id, amount, paid_amount, pdf_url, job_id, status, parent_invoice_id')
        .in('id', invoiceIds)
        .eq('status', 'in_draw');

      const paidDate = new Date().toLocaleDateString();

      for (const inv of invoices || []) {
        const invoiceAmount = parseFloat(inv.amount || 0);
        const allocsForInvoice = invoiceAllocations[inv.id] || [];
        const billedThisDraw = allocsForInvoice.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const previouslyPaid = parseFloat(inv.paid_amount || 0);
        const newPaidAmount = previouslyPaid + billedThisDraw;
        const isFullyBilled = newPaidAmount >= invoiceAmount - 0.01;

        // Update budget paid amounts
        if (inv.job_id) {
          for (const alloc of allocsForInvoice) {
            if (!alloc.cost_code_id) continue;
            const { data: budgetLine } = await supabase
              .from('v2_budget_lines')
              .select('id, paid_amount')
              .eq('job_id', inv.job_id)
              .eq('cost_code_id', alloc.cost_code_id)
              .single();

            if (budgetLine) {
              const newBudgetPaid = (parseFloat(budgetLine.paid_amount) || 0) + parseFloat(alloc.amount || 0);
              await supabase.from('v2_budget_lines').update({ paid_amount: newBudgetPaid }).eq('id', budgetLine.id);
            } else {
              logger.warn('No budget line found for paid_amount update', { component: 'DRAW FUND', jobId: inv.job_id, costCodeId: alloc.cost_code_id });
            }
          }
        }

        // Update status first so stampInvoice applies correct stamp chain
        const invoiceUpdate = { status: 'paid', paid_amount: newPaidAmount, paid_at: now };
        if (isFullyBilled) invoiceUpdate.fully_billed_at = now;
        const { error: invUpdateErr } = await supabase.from('v2_invoices').update(invoiceUpdate).eq('id', inv.id);
        if (invUpdateErr) {
          logger.error('Invoice update failed', { component: 'FUND', invoiceId: inv.id, error: invUpdateErr.message });
        } else {
          logger.info('Invoice updated to paid', { component: 'FUND', invoiceId: inv.id.substring(0,8), paidAmount: newPaidAmount });
        }

        // Stamp with full chain (approval + in_draw + paid)
        try {
          await stampInvoice(inv.id, { force: true });
        } catch (stampErr) {
          logger.error('PAID stamp failed', { component: 'FUND', invoiceId: inv.id, error: stampErr.message });
        }
        await logActivity(inv.id, 'paid', 'System', { draw_id: drawId, amount_paid_this_draw: billedThisDraw });

        if (inv.parent_invoice_id) {
          checkSplitReconciliation(inv.parent_invoice_id).catch(err => logger.error('Split reconciliation failed', { error: err.message }));
        }
      }
    }

    res.json(draw);
}));

// ============================================================
// DELETE
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    await supabase.from('v2_draw_allocations').delete().eq('draw_id', drawId);
    await supabase.from('v2_draw_invoices').delete().eq('draw_id', drawId);
    await supabase.from('v2_draw_activity').delete().eq('draw_id', drawId);
    await supabase.from('v2_draws').delete().eq('id', drawId);

    res.json({ success: true });
}));

// ============================================================
// UTILITIES
// ============================================================

router.post('/:id/recalculate', asyncHandler(async (req, res) => {
    const newTotal = await updateDrawTotal(req.params.id);
    res.json({ success: true, new_total: newTotal });
}));

// Repair draw allocations from source invoices
router.post('/:id/repair-allocations', asyncHandler(async (req, res) => {
  const drawId = req.params.id;

  // Get draw
  const { data: draw } = await supabase
    .from('v2_draws')
    .select('status')
    .eq('id', drawId)
    .single();

  if (!draw) return res.status(404).json({ error: 'Draw not found' });
  if (draw.status !== 'draft') {
    return res.status(400).json({ error: 'Can only repair draft draws' });
  }

  // Get all invoices in this draw
  const { data: drawInvoices } = await supabase
    .from('v2_draw_invoices')
    .select('invoice_id')
    .eq('draw_id', drawId);

  if (!drawInvoices || drawInvoices.length === 0) {
    return res.json({ success: true, message: 'No invoices in draw', repaired: 0 });
  }

  let repaired = 0;

  for (const di of drawInvoices) {
    // Delete existing draw allocations for this invoice
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', di.invoice_id);

    // Get current source allocations
    const { data: sourceAllocs } = await supabase
      .from('v2_invoice_allocations')
      .select('cost_code_id, amount, notes')
      .eq('invoice_id', di.invoice_id);

    // Re-copy to draw_allocations
    if (sourceAllocs && sourceAllocs.length > 0) {
      await supabase.from('v2_draw_allocations').insert(
        sourceAllocs.map(sa => ({
          draw_id: drawId,
          invoice_id: di.invoice_id,
          cost_code_id: sa.cost_code_id,
          amount: sa.amount,
          notes: sa.notes,
          created_by: 'System (repair)'
        }))
      );
      repaired += sourceAllocs.length;
    }
  }

  // Update draw total
  await updateDrawTotal(drawId);

  await logDrawActivity(drawId, 'allocations_repaired', req.body.performed_by || 'System', {
    allocations_repaired: repaired
  });

  res.json({ success: true, repaired });
}));

router.post('/fix-legacy-status', asyncHandler(async (req, res) => {
    const { data, error } = await supabase
      .from('v2_draws')
      .update({ status: 'funded' })
      .in('status', ['partially_funded', 'overfunded'])
      .select('id, draw_number, status');

    if (error) throw error;
    res.json({ message: 'Legacy statuses fixed', updated: data?.length || 0 });
}));

module.exports = router;
module.exports.logDrawActivity = logDrawActivity;
module.exports.updateDrawTotal = updateDrawTotal;
