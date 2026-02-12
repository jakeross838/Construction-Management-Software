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
const { getBuilderId } = require('../core/multi-tenant');
const { requirePermission } = require('../middleware/auth');
const { broadcastNotification, broadcastDrawUpdate } = require('../core/realtime');
// Storage and pdf-stamper functions removed - using unified stampInvoice instead
const ExcelJS = require('exceljs');
const { PDFDocument } = require('pdf-lib');
const { downloadPDF } = require('../core/storage');

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

// Helper: Log change order activity (local copy for CO billing routes)
async function logCOActivity(changeOrderId, action, performedBy, details = {}) {
  try {
    await supabase
      .from('v2_job_co_activity')
      .insert({
        change_order_id: changeOrderId,
        action,
        performed_by: performedBy,
        details
      });
  } catch (err) {
    logger.error('Failed to log CO activity', { component: 'change-order', error: err.message });
  }
}

// Helper: Get or create draft draw for a job
async function getOrCreateDraftDraw(jobId, createdBy = 'System') {
  try {
    // Try to find existing draft draw for this job
    const { data: existingDraft } = await supabase
      .from('v2_draws')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .single();

    if (existingDraft) {
      return existingDraft;
    }

    // No draft exists, create a new one
    // Get next draw number for this job and previous draw's period_end
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('draw_number, period_end')
      .eq('job_id', jobId)
      .order('draw_number', { ascending: false })
      .limit(1);

    const nextNumber = (draws?.[0]?.draw_number || 0) + 1;

    // Calculate period_start: day after previous draw's period_end, or today if first draw
    let periodStart = new Date().toISOString().split('T')[0];
    if (draws?.[0]?.period_end) {
      const prevEnd = new Date(draws[0].period_end);
      prevEnd.setDate(prevEnd.getDate() + 1);
      periodStart = prevEnd.toISOString().split('T')[0];
    }

    // Create new draft draw
    const { data: newDraw, error } = await supabase
      .from('v2_draws')
      .insert({
        job_id: jobId,
        draw_number: nextNumber,
        status: 'draft',
        period_start: periodStart,
        period_end: new Date().toISOString().split('T')[0],
        total_amount: 0
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logDrawActivity(newDraw.id, 'created', createdBy, { auto_created: true });

    logger.info('Auto-created draw', { component: 'draw', drawNumber: nextNumber, jobId });
    return newDraw;
  } catch (err) {
    logger.error('Error getting/creating draft draw', { component: 'draw', error: err.message });
    throw err;
  }
}

// Helper: Add invoice to draw (creates draw_allocations from invoice_allocations)
async function addInvoiceToDraw(invoiceId, drawId, performedBy = 'System') {
  try {
    // Get invoice allocations
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select('cost_code_id, amount, notes')
      .eq('invoice_id', invoiceId);

    if (!allocations || allocations.length === 0) {
      throw new Error('Invoice has no allocations');
    }

    // Link invoice to draw
    const { error: linkError } = await supabase
      .from('v2_draw_invoices')
      .insert({ draw_id: drawId, invoice_id: invoiceId });

    if (linkError && !linkError.message?.includes('duplicate')) {
      throw linkError;
    }

    // Create draw_allocations (copy from invoice_allocations)
    for (const alloc of allocations) {
      const { error: allocError } = await supabase
        .from('v2_draw_allocations')
        .upsert({
          draw_id: drawId,
          invoice_id: invoiceId,
          cost_code_id: alloc.cost_code_id,
          amount: alloc.amount,
          notes: alloc.notes,
          created_by: performedBy
        }, { onConflict: 'draw_id,invoice_id,cost_code_id' });

      if (allocError) {
        logger.error('Error creating draw allocation', { component: 'draw', error: allocError.message });
      }
    }

    // Update draw total
    await updateDrawTotal(drawId);

    // Log activity
    const totalAmount = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    await logDrawActivity(drawId, 'invoice_added', performedBy, {
      invoice_id: invoiceId,
      amount: totalAmount
    });

    return true;
  } catch (err) {
    logger.error('Error adding invoice to draw', { component: 'draw', error: err.message });
    throw err;
  }
}

// Helper: Remove invoice from draw
async function removeInvoiceFromDraw(invoiceId, drawId, performedBy = 'System') {
  try {
    // Get the amount being removed for logging
    const { data: allocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    const totalAmount = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Remove draw_allocations
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    // Remove from draw_invoices
    await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    // Update draw total
    await updateDrawTotal(drawId);

    // Log activity
    await logDrawActivity(drawId, 'invoice_removed', performedBy, {
      invoice_id: invoiceId,
      amount: totalAmount
    });

    return true;
  } catch (err) {
    logger.error('Error removing invoice from draw', { component: 'draw', error: err.message });
    throw err;
  }
}

// Helper function for currency formatting (Excel)
function formatCurrency(amount) {
  return parseFloat(amount) || 0;
}

// Helper to format money for PDF (with $ and commas)
function formatMoneyPDF(amount) {
  const num = parseFloat(amount) || 0;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ============================================================
// LIST ENDPOINTS
// ============================================================

// List all draws
router.get('/', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);

    let query = supabase
      .from('v2_draws')
      .select(`
        *,
        job:v2_jobs(id, name),
        invoices:v2_draw_invoices(
          invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(name))
        )
      `)
      .order('created_at', { ascending: false });

    // Filter by builder if authenticated
    if (builderId) query = query.eq('builder_id', builderId);

    const { data, error } = await query;

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
    const builderId = getBuilderId(req);

    let drawQuery = supabase
      .from('v2_draws')
      .select(`*, job:v2_jobs(id, name, address, client_name, contract_amount)`)
      .eq('id', drawId);

    if (builderId) drawQuery = drawQuery.eq('builder_id', builderId);

    const { data: draw, error: drawError } = await drawQuery.single();

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
          id, invoice_number, invoice_date, amount, status, pdf_url, pdf_stamped_url, deleted_at,
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

    // Deduplicate invoices and filter out soft-deleted ones
    const seenInvoiceIds = new Set();
    const invoices = drawInvoices?.map(di => di.invoice).filter(inv => {
      if (!inv || seenInvoiceIds.has(inv.id) || inv.deleted_at) return false;
      seenInvoiceIds.add(inv.id);
      return true;
    }).map(inv => ({
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
router.patch('/:id', requirePermission('canSubmitDraw'), validate(schemas.drawUpdate), asyncHandler(async (req, res) => {
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
router.post('/:id/add-invoices', requirePermission('canSubmitDraw'), validateRequest({
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
      // Insert all draw_invoices first (using upsert to handle potential duplicates)
      const { error: insertError } = await supabase
        .from('v2_draw_invoices')
        .upsert(
          invoice_ids.map(id => ({ draw_id: drawId, invoice_id: id })),
          { onConflict: 'draw_id,invoice_id', ignoreDuplicates: true }
        );

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
router.post('/:id/remove-invoice', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
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

// Bulk remove invoices from draw
router.post('/:id/remove-invoices', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
  const drawId = req.params.id;
  const { invoice_ids, performed_by = 'System' } = req.body;

  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    return res.status(400).json({ error: 'invoice_ids array is required' });
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

  let removedCount = 0;

  for (const invoice_id of invoice_ids) {
    try {
      // Get invoice with allocations
      const { data: invoice } = await supabase
        .from('v2_invoices')
        .select('id, invoice_number, job:v2_jobs(id, name)')
        .eq('id', invoice_id)
        .single();

      if (!invoice) continue;

      // Get draw allocations for budget updates
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
          }
        }
      }

      // Remove from draw
      await supabase.from('v2_draw_allocations').delete().eq('draw_id', drawId).eq('invoice_id', invoice_id);
      await supabase.from('v2_draw_invoices').delete().eq('draw_id', drawId).eq('invoice_id', invoice_id);

      // Update invoice status
      await supabase.from('v2_invoices').update({ status: 'approved' }).eq('id', invoice_id);

      // Re-stamp
      try {
        await stampInvoice(invoice_id, { force: true });
      } catch (stampErr) {
        logger.error('Re-stamping failed', { component: 'Draw', invoiceId: invoice_id, error: stampErr.message });
      }

      await logActivity(invoice_id, 'removed_from_draw', performed_by, { draw_number: draw.draw_number });
      removedCount++;
    } catch (err) {
      logger.error('Failed to remove invoice from draw', { invoiceId: invoice_id, error: err.message });
    }
  }

  await logDrawActivity(drawId, 'invoices_bulk_removed', performed_by, { count: removedCount });
  const newTotal = await updateDrawTotal(drawId);

  res.json({ success: true, removed_count: removedCount, new_total: newTotal });
}));

// Reorder invoices within draw
router.post('/:id/reorder-invoices', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
  const drawId = req.params.id;
  const { invoice_ids } = req.body;

  if (!invoice_ids || !Array.isArray(invoice_ids)) {
    return res.status(400).json({ error: 'invoice_ids array is required' });
  }

  const { data: draw } = await supabase
    .from('v2_draws')
    .select('id, status')
    .eq('id', drawId)
    .single();

  if (!draw) return res.status(404).json({ error: 'Draw not found' });
  if (draw.status !== 'draft') {
    return res.status(400).json({ error: 'Cannot reorder invoices in non-draft draws' });
  }

  // Update sort_order for each invoice in the draw
  for (let i = 0; i < invoice_ids.length; i++) {
    await supabase
      .from('v2_draw_invoices')
      .update({ sort_order: i })
      .eq('draw_id', drawId)
      .eq('invoice_id', invoice_ids[i]);
  }

  res.json({ success: true, message: 'Invoices reordered' });
}));

// Add all approved invoices for job to draw
router.post('/:id/add-all-approved', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
  const drawId = req.params.id;
  const { performed_by = 'System' } = req.body;

  // Get draw with job
  const { data: draw } = await supabase
    .from('v2_draws')
    .select('id, job_id, status')
    .eq('id', drawId)
    .single();

  if (!draw) return res.status(404).json({ error: 'Draw not found' });
  if (draw.status !== 'draft') {
    return res.status(400).json({ error: 'Can only add invoices to draft draws' });
  }

  // Get all approved invoices for this job that are not already in a draw
  const { data: approvedInvoices } = await supabase
    .from('v2_invoices')
    .select('id')
    .eq('job_id', draw.job_id)
    .eq('status', 'approved')
    .is('deleted_at', null);

  if (!approvedInvoices || approvedInvoices.length === 0) {
    return res.json({ success: true, added_count: 0, message: 'No approved invoices to add' });
  }

  const invoice_ids = approvedInvoices.map(inv => inv.id);

  // Forward to add-invoices endpoint logic (can refactor to shared function later)
  // For now, redirect to add-invoices
  req.body.invoice_ids = invoice_ids;
  req.body.performed_by = performed_by;

  // This is a workaround - ideally extract shared logic
  res.redirect(307, `${req.baseUrl}/${drawId}/add-invoices`);
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
router.patch('/:id/submit', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
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

    // Send real-time notification
    broadcastNotification('info', `Draw #${updatedDraw.draw_number} submitted for approval`, {
      title: 'Draw Submitted',
      entityType: 'draw',
      entityId: drawId,
      link: `/draws?id=${drawId}`,
      action: 'submitted',
      performedBy: submitted_by
    });

    res.json(updatedDraw);
}));

// Unsubmit draw
router.post('/:id/unsubmit', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
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
router.patch('/:id/fund', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
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

    // Send real-time notification
    broadcastNotification('success', `Draw #${draw.draw_number} funded - $${actualFunded.toLocaleString()}`, {
      title: 'Draw Funded',
      entityType: 'draw',
      entityId: drawId,
      link: `/draws?id=${drawId}`,
      action: 'funded',
      performedBy: funded_by
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

router.delete('/:id', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    // Get draw to check status
    const { data: draw, error: fetchError } = await supabase
      .from('v2_draws')
      .select('id, status')
      .eq('id', drawId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow delete for draft draws
    if (draw.status !== 'draft') {
      return res.status(400).json({
        error: 'Only draft draws can be deleted. Use archive for submitted/funded draws.',
        status: draw.status
      });
    }

    // Remove invoices from draw (reset their status to approved)
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select('invoice_id')
      .eq('draw_id', drawId);

    if (drawInvoices && drawInvoices.length > 0) {
      const invoiceIds = drawInvoices.map(di => di.invoice_id);
      await supabase
        .from('v2_invoices')
        .update({ status: 'approved' })
        .in('id', invoiceIds)
        .eq('status', 'in_draw');
    }

    // Hard delete related records for draft draws
    await supabase.from('v2_draw_allocations').delete().eq('draw_id', drawId);
    await supabase.from('v2_draw_invoices').delete().eq('draw_id', drawId);
    await supabase.from('v2_draw_activity').delete().eq('draw_id', drawId);
    await supabase.from('v2_draws').delete().eq('id', drawId);

    res.json({ success: true, message: 'Draw deleted' });
}));

// Archive a draw (soft delete - for any status)
router.patch('/:id/archive', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    // Get draw
    const { data: draw, error: fetchError } = await supabase
      .from('v2_draws')
      .select('id, status')
      .eq('id', drawId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Set deleted_at to archive
    const { data, error } = await supabase
      .from('v2_draws')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', drawId)
      .select()
      .single();

    if (error) {
      throw new AppError('DATABASE_ERROR', error.message);
    }

    res.json({ success: true, message: 'Draw archived', draw: data });
}));

// Unarchive a draw
router.patch('/:id/unarchive', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    // Get draw (including archived)
    const { data: draw, error: fetchError } = await supabase
      .from('v2_draws')
      .select('id, status, deleted_at')
      .eq('id', drawId)
      .not('deleted_at', 'is', null)
      .single();

    if (fetchError || !draw) {
      return res.status(404).json({ error: 'Archived draw not found' });
    }

    // Clear deleted_at to unarchive
    const { data, error } = await supabase
      .from('v2_draws')
      .update({ deleted_at: null })
      .eq('id', drawId)
      .select()
      .single();

    if (error) {
      throw new AppError('DATABASE_ERROR', error.message);
    }

    res.json({ success: true, message: 'Draw unarchived', draw: data });
}));

// ============================================================
// UTILITIES
// ============================================================

router.post('/:id/recalculate', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
    const newTotal = await updateDrawTotal(req.params.id);
    res.json({ success: true, new_total: newTotal });
}));

// Repair draw allocations from source invoices
router.post('/:id/repair-allocations', requirePermission('canSubmitDraw'), asyncHandler(async (req, res) => {
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

// ============================================================
// CHANGE ORDER BILLING ON DRAWS
// ============================================================

// Get COs available to bill on a draw
router.get('/:id/available-cos', asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { data: draw } = await supabase.from('v2_draws').select('job_id').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    const { data: cos, error } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .eq('status', 'approved')
      .or('client_approved_at.not.is.null,client_approval_bypassed.eq.true');

    if (error) throw error;

    const available = (cos || []).filter(co => {
      const remaining = parseFloat(co.amount) - parseFloat(co.billed_amount || 0);
      return remaining > 0.01;
    }).map(co => ({ ...co, remaining_to_bill: parseFloat(co.amount) - parseFloat(co.billed_amount || 0) }));

    res.json(available);
}));

// Get CO billings for a specific draw
router.get('/:id/co-billings', asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { data: billings, error } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount, billed_amount)')
      .eq('draw_id', drawId);

    if (error) throw error;
    res.json(billings || []);
}));

// Add CO billing to draw
router.post('/:id/add-co-billing', asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { change_order_id, amount, added_by } = req.body;

    if (!change_order_id || amount === undefined) return res.status(400).json({ error: 'change_order_id and amount are required' });

    const billingAmount = parseFloat(amount);
    if (billingAmount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    const { data: draw } = await supabase.from('v2_draws').select('status').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    if (draw.status !== 'draft') return res.status(400).json({ error: 'Can only add CO billings to draft draws' });

    const { data: co } = await supabase
      .from('v2_job_change_orders')
      .select('amount, billed_amount, status, client_approved_at, client_approval_bypassed')
      .eq('id', change_order_id)
      .single();

    if (!co) return res.status(404).json({ error: 'Change order not found' });
    if (co.status !== 'approved') return res.status(400).json({ error: 'Change order must be approved' });
    if (!co.client_approved_at && !co.client_approval_bypassed) return res.status(400).json({ error: 'Change order requires client approval or bypass' });

    const remaining = parseFloat(co.amount) - parseFloat(co.billed_amount || 0);
    if (billingAmount > remaining + 0.01) return res.status(400).json({ error: `Amount exceeds remaining ($${remaining.toFixed(2)})` });

    const { data: existing } = await supabase
      .from('v2_job_co_draw_billings')
      .select('id, amount')
      .eq('draw_id', drawId)
      .eq('change_order_id', change_order_id)
      .single();

    if (existing) {
      const newAmount = parseFloat(existing.amount) + billingAmount;
      const { data: billing, error } = await supabase.from('v2_job_co_draw_billings').update({ amount: newAmount }).eq('id', existing.id).select().single();
      if (error) throw error;
      await logCOActivity(change_order_id, 'billed', added_by, { draw_id: drawId, amount: billingAmount });
      await updateDrawTotal(drawId);
      return res.json(billing);
    }

    const { data: billing, error } = await supabase
      .from('v2_job_co_draw_billings')
      .insert({ change_order_id, draw_id: drawId, amount: billingAmount })
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(change_order_id, 'billed', added_by, { draw_id: drawId, amount: billingAmount });
    await updateDrawTotal(drawId);
    res.status(201).json(billing);
}));

// Remove CO billing from draw
router.delete('/:id/remove-co-billing/:coId', asyncHandler(async (req, res) => {
    const { id: drawId, coId: changeOrderId } = req.params;

    const { data: draw } = await supabase.from('v2_draws').select('status').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    if (draw.status !== 'draft') return res.status(400).json({ error: 'Can only remove CO billings from draft draws' });

    const { data: billing } = await supabase.from('v2_job_co_draw_billings').select('amount').eq('draw_id', drawId).eq('change_order_id', changeOrderId).single();
    if (!billing) return res.status(404).json({ error: 'CO billing not found on this draw' });

    const { error } = await supabase.from('v2_job_co_draw_billings').delete().eq('draw_id', drawId).eq('change_order_id', changeOrderId);
    if (error) throw error;

    await logCOActivity(changeOrderId, 'billing_removed', req.body?.removed_by, { draw_id: drawId, amount: billing.amount });
    await updateDrawTotal(drawId);
    res.json({ success: true });
}));

// ============================================================
// DRAW ATTACHMENTS
// ============================================================

// List attachments for a draw
router.get('/:id/attachments', asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    const { data: attachments, error } = await supabase
      .from('v2_draw_attachments')
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .eq('draw_id', drawId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    res.json(attachments || []);
}));

// Upload attachment to draw
router.post('/:id/attachments', asyncHandler(async (req, res) => {
    const drawId = req.params.id;
    const { file_name, file_url, file_size, attachment_type, vendor_id, notes, uploaded_by } = req.body;

    if (!file_name || !file_url) {
      return res.status(400).json({ error: 'file_name and file_url are required' });
    }

    // Get draw info
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow attachments on draft or submitted draws (not funded)
    if (['funded', 'partially_funded', 'overfunded'].includes(draw.status)) {
      return res.status(400).json({ error: 'Cannot add attachments to a funded draw' });
    }

    const { data: attachment, error } = await supabase
      .from('v2_draw_attachments')
      .insert({
        draw_id: drawId,
        file_name,
        file_url,
        file_size: file_size || null,
        attachment_type: attachment_type || 'other',
        vendor_id: vendor_id || null,
        notes: notes || null,
        uploaded_by: uploaded_by || 'System'
      })
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .single();

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'attachment_added', uploaded_by || 'System', {
      attachment_id: attachment.id,
      file_name,
      attachment_type: attachment_type || 'other'
    });

    res.json(attachment);
}));

// Delete attachment from draw
router.delete('/:id/attachments/:attachmentId', asyncHandler(async (req, res) => {
    const { id: drawId, attachmentId } = req.params;
    const { deleted_by } = req.body || {};

    // Get draw info
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow deletion on draft or submitted draws (not funded)
    if (['funded', 'partially_funded', 'overfunded'].includes(draw.status)) {
      return res.status(400).json({ error: 'Cannot remove attachments from a funded draw' });
    }

    // Get attachment info for logging
    const { data: attachment } = await supabase
      .from('v2_draw_attachments')
      .select('file_name, attachment_type')
      .eq('id', attachmentId)
      .eq('draw_id', drawId)
      .single();

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const { error } = await supabase
      .from('v2_draw_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('draw_id', drawId);

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'attachment_removed', deleted_by || 'System', {
      attachment_id: attachmentId,
      file_name: attachment.file_name,
      attachment_type: attachment.attachment_type
    });

    res.json({ success: true });
}));

// ============================================================
// EXPORT ENDPOINTS
// ============================================================

// Export Draw as Excel (G702/G703/PCCO)
router.get('/:id/export/excel', asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    // Get draw with full data
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`*, job:v2_jobs(id, name, address, client_name, contract_amount)`)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    // Get invoices in this draw
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          id, invoice_number, invoice_date, amount,
          vendor:v2_vendors(name),
          allocations:v2_invoice_allocations(amount, po_line_item_id, cost_code:v2_cost_codes(id, code, name))
        )
      `)
      .eq('draw_id', drawId);

    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];

    // Get budget lines for scheduled values
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select(`*, cost_code:v2_cost_codes(id, code, name)`)
      .eq('job_id', draw.job_id);

    // Get previous draws' allocations
    const { data: previousDraws } = await supabase
      .from('v2_draws')
      .select('id')
      .eq('job_id', draw.job_id)
      .lt('draw_number', draw.draw_number);

    let previousByCode = {};
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`invoice:v2_invoices(allocations:v2_invoice_allocations(amount, cost_code_id, po_line_item_id))`)
        .in('draw_id', prevDrawIds);

      prevInvoices?.forEach(di => {
        di.invoice?.allocations?.forEach(alloc => {
          previousByCode[alloc.cost_code_id] = (previousByCode[alloc.cost_code_id] || 0) + parseFloat(alloc.amount || 0);
        });
      });
    }

    // Calculate this period by cost code
    let thisPeriodByCode = {};
    invoices.forEach(inv => {
      inv.allocations?.forEach(alloc => {
        const codeId = alloc.cost_code?.id;
        if (codeId) {
          thisPeriodByCode[codeId] = (thisPeriodByCode[codeId] || 0) + parseFloat(alloc.amount || 0);
        }
      });
    });

    // Get job change orders (approved ones billable to client)
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .in('status', ['approved'])
      .order('change_order_number');

    // Get CO billings for this draw
    const { data: coBillingsThisDraw } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount)')
      .eq('draw_id', drawId);

    // Get previous draws' CO billings
    let previousCOBillings = {};
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevCOBillings } = await supabase
        .from('v2_job_co_draw_billings')
        .select('change_order_id, amount')
        .in('draw_id', prevDrawIds);

      prevCOBillings?.forEach(b => {
        previousCOBillings[b.change_order_id] = (previousCOBillings[b.change_order_id] || 0) + parseFloat(b.amount || 0);
      });
    }

    // Calculate CO totals
    const approvedCOTotal = (jobChangeOrders || [])
      .filter(co => co.client_approved_at || co.client_approval_bypassed)
      .reduce((sum, co) => sum + parseFloat(co.amount || 0), 0);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ross Built CMS';
    workbook.created = new Date();

    // ========== G702 Sheet ==========
    const g702 = workbook.addWorksheet('G702');
    g702.columns = [
      { width: 5 }, { width: 50 }, { width: 20 }
    ];

    // Header
    g702.addRow(['', 'AIA DOCUMENT G702 - APPLICATION AND CERTIFICATE FOR PAYMENT', '']);
    g702.addRow(['']);
    g702.addRow(['', `TO OWNER: ${draw.job?.client_name || '-'}`, `APPLICATION NO: ${draw.draw_number}`]);
    g702.addRow(['', `PROJECT: ${draw.job?.name || '-'}`, `PERIOD TO: ${draw.period_end || '-'}`]);
    g702.addRow(['', `FROM CONTRACTOR: ${req.builder?.name || 'Your Company'}`, '']);
    g702.addRow(['']);

    const contractSum = parseFloat(draw.job?.contract_amount) || 0;
    const changeOrders = approvedCOTotal;
    const contractSumToDate = contractSum + changeOrders;

    // Build G703 data for calculations
    const g703Data = (budgetLines || []).map((bl, idx) => {
      const codeId = bl.cost_code?.id;
      const scheduled = parseFloat(bl.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const total = previous + thisPeriod;
      return { scheduled, previous, thisPeriod, total, balance: scheduled - total };
    });

    const totals = g703Data.reduce((acc, item) => ({
      scheduled: acc.scheduled + item.scheduled,
      previous: acc.previous + item.previous,
      thisPeriod: acc.thisPeriod + item.thisPeriod,
      total: acc.total + item.total
    }), { scheduled: 0, previous: 0, thisPeriod: 0, total: 0 });

    const previousCertificates = totals.previous;
    const currentPaymentDue = totals.thisPeriod;
    const balanceToFinish = contractSumToDate - totals.total;

    g702.addRow(['1.', 'ORIGINAL CONTRACT SUM', formatCurrency(contractSum)]);
    g702.addRow(['2.', 'Net change by Change Orders', formatCurrency(changeOrders)]);
    g702.addRow(['3.', 'CONTRACT SUM TO DATE (Line 1 + 2)', formatCurrency(contractSumToDate)]);
    g702.addRow(['4.', 'TOTAL COMPLETED & STORED TO DATE', formatCurrency(totals.total)]);
    g702.addRow(['5.', 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', formatCurrency(previousCertificates)]);
    g702.addRow(['6.', 'CURRENT PAYMENT DUE', formatCurrency(currentPaymentDue)]);
    g702.addRow(['7.', 'BALANCE TO FINISH', formatCurrency(balanceToFinish)]);

    // Style G702
    g702.getRow(1).font = { bold: true, size: 14 };
    g702.getRow(15).font = { bold: true };
    g702.getColumn(3).numFmt = '$#,##0.00';

    // ========== G703 Sheet ==========
    const g703 = workbook.addWorksheet('G703');
    g703.columns = [
      { header: 'Item', width: 6 },
      { header: 'Description of Work', width: 35 },
      { header: 'Scheduled Value', width: 15 },
      { header: 'Previous', width: 15 },
      { header: 'This Period', width: 15 },
      { header: 'Materials', width: 12 },
      { header: 'Total', width: 15 },
      { header: '%', width: 8 },
      { header: 'Balance', width: 15 }
    ];

    // Add header row
    g703.addRow(['A', 'B', 'C', 'D (Previous)', 'D (This Period)', 'E', 'F', 'G', 'H']);
    g703.getRow(1).font = { bold: true };
    g703.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Add data rows
    (budgetLines || []).forEach((bl, idx) => {
      const codeId = bl.cost_code?.id;
      const scheduled = parseFloat(bl.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const materials = 0;
      const total = previous + thisPeriod + materials;
      const percent = scheduled > 0 ? (total / scheduled) : 0;
      const balance = scheduled - total;

      if (scheduled > 0 || thisPeriod > 0) {
        g703.addRow([
          idx + 1,
          `${bl.cost_code?.code} - ${bl.cost_code?.name}`,
          scheduled,
          previous,
          thisPeriod,
          materials,
          total,
          percent,
          balance
        ]);
      }
    });

    // Add totals row
    const totalsRow = g703.addRow([
      '', 'GRAND TOTAL',
      totals.scheduled, totals.previous, totals.thisPeriod, 0, totals.total,
      totals.scheduled > 0 ? totals.total / totals.scheduled : 0,
      totals.scheduled - totals.total
    ]);
    totalsRow.font = { bold: true };
    totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Format currency columns
    [3, 4, 5, 6, 7, 9].forEach(col => {
      g703.getColumn(col).numFmt = '$#,##0.00';
    });
    g703.getColumn(8).numFmt = '0.0%';

    // ========== PCCO Sheet (Change Orders) ==========
    const pcco = workbook.addWorksheet('PCCO');
    pcco.columns = [
      { header: 'CO #', width: 8 },
      { header: 'Title', width: 30 },
      { header: 'Description', width: 40 },
      { header: 'Reason', width: 15 },
      { header: 'Amount', width: 15 },
      { header: 'Status', width: 15 },
      { header: 'Previous Billed', width: 15 },
      { header: 'This Period', width: 15 },
      { header: 'Total Billed', width: 15 },
      { header: 'Balance', width: 15 }
    ];

    pcco.addRow(['CHANGE ORDER LOG']);
    pcco.mergeCells('A1:J1');
    pcco.getRow(1).font = { bold: true, size: 14 };
    pcco.addRow(['']);

    // Header row
    const headerRow = pcco.addRow(['CO #', 'Title', 'Description', 'Reason', 'Amount', 'Status', 'Previous Billed', 'This Period', 'Total Billed', 'Balance']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Build CO billing map for this draw
    const thisDrawCOBillings = {};
    (coBillingsThisDraw || []).forEach(b => {
      thisDrawCOBillings[b.change_order_id] = parseFloat(b.amount || 0);
    });

    if (!jobChangeOrders || jobChangeOrders.length === 0) {
      pcco.addRow(['', 'No change orders for this job.', '', '', '', '', '', '', '', '']);
    } else {
      (jobChangeOrders || []).forEach(co => {
        const coAmount = parseFloat(co.amount) || 0;
        const previousBilled = previousCOBillings[co.id] || 0;
        const thisPeriod = thisDrawCOBillings[co.id] || 0;
        const totalBilled = previousBilled + thisPeriod;
        const balance = coAmount - totalBilled;

        let status = co.status;
        if (co.client_approved_at) status = 'Client Approved';
        else if (co.client_approval_bypassed) status = 'Bypassed';

        pcco.addRow([
          `CO-${String(co.change_order_number).padStart(3, '0')}`,
          co.title || '',
          co.description || '',
          co.reason || '',
          coAmount,
          status,
          previousBilled,
          thisPeriod,
          totalBilled,
          balance
        ]);
      });

      // Totals row
      const coTotals = (jobChangeOrders || []).reduce((acc, co) => {
        const coAmount = parseFloat(co.amount) || 0;
        const previousBilled = previousCOBillings[co.id] || 0;
        const thisPeriod = thisDrawCOBillings[co.id] || 0;
        return {
          amount: acc.amount + coAmount,
          previous: acc.previous + previousBilled,
          thisPeriod: acc.thisPeriod + thisPeriod,
          total: acc.total + previousBilled + thisPeriod
        };
      }, { amount: 0, previous: 0, thisPeriod: 0, total: 0 });

      const coTotalsRow = pcco.addRow([
        '', 'TOTALS', '', '', coTotals.amount, '',
        coTotals.previous, coTotals.thisPeriod, coTotals.total,
        coTotals.amount - coTotals.total
      ]);
      coTotalsRow.font = { bold: true };
      coTotalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    }

    // Format currency columns
    [5, 7, 8, 9, 10].forEach(col => {
      pcco.getColumn(col).numFmt = '$#,##0.00';
    });

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Draw_${draw.draw_number}_${draw.job?.name?.replace(/\s+/g, '_') || 'Job'}_G702_G703.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
}));

// Export Draw as PDF (G702/G703 + Invoice PDFs)
router.get('/:id/export/pdf', asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    // Get draw info with job details
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`*, job:v2_jobs(id, name, client_name, address, contract_amount)`)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    const jobId = draw.job_id;

    // Get invoices with allocations and stamped PDFs
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`invoice:v2_invoices(id, invoice_number, amount, pdf_stamped_url, vendor:v2_vendors(name), allocations:v2_invoice_allocations(cost_code_id, amount))`)
      .eq('draw_id', drawId);

    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];

    // Get budget lines for G703
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select(`*, cost_code:v2_cost_codes(id, code, name)`)
      .eq('job_id', jobId)
      .order('cost_code(code)');

    // Get all draws for this job to calculate previous billings
    const { data: allDraws } = await supabase
      .from('v2_draws')
      .select(`id, draw_number, total_amount, status`)
      .eq('job_id', jobId)
      .order('draw_number');

    // Get all invoice allocations for previous draws
    const previousDrawIds = allDraws?.filter(d => d.draw_number < draw.draw_number).map(d => d.id) || [];
    let previousAllocations = [];
    if (previousDrawIds.length > 0) {
      const { data: prevDrawInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`invoice:v2_invoices(allocations:v2_invoice_allocations(cost_code_id, amount))`)
        .in('draw_id', previousDrawIds);
      previousAllocations = prevDrawInvoices?.flatMap(di => di.invoice?.allocations || []) || [];
    }

    // Get job change orders (PCCOs) for net change calculation
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('amount, status')
      .eq('job_id', jobId)
      .eq('status', 'approved');

    // Calculate G702 values
    const contractAmount = parseFloat(draw.job?.contract_amount) || 0;
    const netChangeOrders = jobChangeOrders?.reduce((sum, co) => sum + (parseFloat(co.amount) || 0), 0) || 0;
    const contractSumToDate = contractAmount + netChangeOrders;

    // Use override values if set
    const originalContractSum = draw.g702_original_contract_override != null
      ? parseFloat(draw.g702_original_contract_override)
      : contractAmount;
    const changeOrdersAmount = draw.g702_change_orders_override != null
      ? parseFloat(draw.g702_change_orders_override)
      : netChangeOrders;

    // Calculate previous completed amounts
    const previousCompleted = previousDrawIds.length > 0
      ? allDraws.filter(d => d.draw_number < draw.draw_number).reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
      : 0;

    const thisDrawAmount = parseFloat(draw.total_amount) || 0;
    const totalCompletedToDate = previousCompleted + thisDrawAmount;
    const lessPreviousCertificates = previousCompleted;
    const currentPaymentDue = thisDrawAmount;
    const balanceToFinish = (originalContractSum + changeOrdersAmount) - totalCompletedToDate;

    // Build G703 data by cost code
    const g703Data = [];
    const costCodeMap = new Map();

    // Sum up allocations by cost code for current draw
    const currentAllocations = invoices.flatMap(inv => inv.allocations || []);
    currentAllocations.forEach(alloc => {
      const existing = costCodeMap.get(alloc.cost_code_id) || { current: 0 };
      existing.current += parseFloat(alloc.amount) || 0;
      costCodeMap.set(alloc.cost_code_id, existing);
    });

    // Sum up previous allocations by cost code
    previousAllocations.forEach(alloc => {
      const existing = costCodeMap.get(alloc.cost_code_id) || { current: 0 };
      existing.previous = (existing.previous || 0) + (parseFloat(alloc.amount) || 0);
      costCodeMap.set(alloc.cost_code_id, existing);
    });

    // Build G703 rows from budget lines (only include rows with budget or billings)
    let itemNum = 1;
    budgetLines?.forEach(bl => {
      const ccId = bl.cost_code_id;
      const allocData = costCodeMap.get(ccId) || { current: 0, previous: 0 };
      const scheduledValue = parseFloat(bl.budgeted_amount) || 0;
      const previousBillings = allocData.previous || 0;
      const currentBillings = allocData.current || 0;
      const totalBilled = previousBillings + currentBillings;

      // Skip rows with no budget and no billings
      if (scheduledValue === 0 && totalBilled === 0) return;

      const percentComplete = scheduledValue > 0 ? (totalBilled / scheduledValue) * 100 : 0;
      const balance = scheduledValue - totalBilled;

      g703Data.push({
        itemNum: itemNum++,
        costCode: bl.cost_code?.code || '',
        description: bl.cost_code?.name || '',
        scheduledValue,
        previousBillings,
        currentBillings,
        materialsStored: 0,
        totalBilled,
        percentComplete,
        balance
      });
    });

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();

    // ============ G702 PAGE (Portrait) ============
    const g702Page = mergedPdf.addPage([612, 792]); // Letter size portrait
    const g702Height = g702Page.getHeight();
    let y = g702Height - 40;

    // Header
    g702Page.drawText('AIA DOCUMENT G702 - APPLICATION AND CERTIFICATE FOR PAYMENT', { x: 50, y, size: 11 });
    y -= 25;

    g702Page.drawText('TO OWNER:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.client_name || '-', { x: 120, y, size: 9 });
    y -= 15;

    g702Page.drawText('PROJECT:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.name || '-', { x: 120, y, size: 9 });
    y -= 15;

    g702Page.drawText('ADDRESS:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.address || '-', { x: 120, y, size: 9 });

    // Right side header
    g702Page.drawText('APPLICATION NO:', { x: 380, y: g702Height - 65, size: 9 });
    g702Page.drawText(String(draw.draw_number), { x: 480, y: g702Height - 65, size: 9 });
    g702Page.drawText('PERIOD TO:', { x: 380, y: g702Height - 80, size: 9 });
    g702Page.drawText(draw.period_end || '-', { x: 480, y: g702Height - 80, size: 9 });

    y -= 30;
    g702Page.drawText('FROM CONTRACTOR:', { x: 50, y, size: 9 });
    g702Page.drawText(req.builder?.name || 'Your Company', { x: 160, y, size: 9 });

    // G702 Line Items Table
    y -= 40;
    const tableStartY = y;
    const lineHeight = 22;

    const g702Lines = [
      { num: '1.', label: 'ORIGINAL CONTRACT SUM', value: formatMoneyPDF(originalContractSum) },
      { num: '2.', label: 'Net change by Change Orders', value: formatMoneyPDF(changeOrdersAmount) },
      { num: '3.', label: 'CONTRACT SUM TO DATE (Line 1 + 2)', value: formatMoneyPDF(originalContractSum + changeOrdersAmount) },
      { num: '4.', label: 'TOTAL COMPLETED & STORED TO DATE (Column G on G703)', value: formatMoneyPDF(totalCompletedToDate) },
      { num: '5.', label: 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', value: formatMoneyPDF(lessPreviousCertificates) },
      { num: '6.', label: 'CURRENT PAYMENT DUE', value: formatMoneyPDF(currentPaymentDue) },
      { num: '7.', label: 'BALANCE TO FINISH (Line 3 less Line 4)', value: formatMoneyPDF(balanceToFinish) },
    ];

    g702Lines.forEach((line, idx) => {
      const lineY = tableStartY - (idx * lineHeight);
      g702Page.drawText(line.num, { x: 50, y: lineY, size: 10 });
      g702Page.drawText(line.label, { x: 75, y: lineY, size: 10 });
      g702Page.drawText(line.value, { x: 480, y: lineY, size: 10 });
    });

    // Notes section if present
    if (draw.notes) {
      y = tableStartY - (g702Lines.length * lineHeight) - 30;
      g702Page.drawText('NOTES:', { x: 50, y, size: 9 });
      y -= 15;
      // Truncate long notes
      const notesText = draw.notes.length > 200 ? draw.notes.substring(0, 200) + '...' : draw.notes;
      g702Page.drawText(notesText, { x: 50, y, size: 9 });
    }

    // Footer
    g702Page.drawText('Generated by Ross Built CMS', { x: 50, y: 50, size: 8 });
    g702Page.drawText(new Date().toLocaleDateString(), { x: 50, y: 38, size: 8 });

    // ============ G703 PAGES (Landscape, multi-page support) ============
    const colX = [30, 55, 130, 220, 300, 380, 460, 540, 610, 680];
    const headers = ['#', 'Code', 'Description', 'Scheduled', 'Previous', 'This Period', 'Materials', 'Total', '%', 'Balance'];
    const rowHeight = 14;
    const g703Width = 792;
    const g703Height = 612;
    let grandTotals = { scheduled: 0, previous: 0, current: 0, materials: 0, total: 0, balance: 0 };

    // Helper function to create a new G703 page with headers
    function createG703Page(pageNum) {
      const page = mergedPdf.addPage([792, 612]); // Letter size landscape
      // Header
      page.drawText('AIA DOCUMENT G703 - CONTINUATION SHEET (SCHEDULE OF VALUES)', { x: 50, y: g703Height - 30, size: 11 });
      page.drawText(`Application #${draw.draw_number}`, { x: 50, y: g703Height - 45, size: 9 });
      page.drawText(`Period To: ${draw.period_end || '-'}`, { x: 200, y: g703Height - 45, size: 9 });
      page.drawText(`Project: ${draw.job?.name || '-'}`, { x: 400, y: g703Height - 45, size: 9 });
      if (pageNum > 1) {
        page.drawText(`(Page ${pageNum})`, { x: 700, y: g703Height - 30, size: 9 });
      }
      // Table headers
      const headerY = g703Height - 70;
      headers.forEach((h, i) => {
        page.drawText(h, { x: colX[i], y: headerY, size: 8 });
      });
      // Line under headers
      page.drawLine({
        start: { x: 25, y: headerY - 5 },
        end: { x: g703Width - 25, y: headerY - 5 },
        thickness: 0.5
      });
      return { page, rowY: headerY - 20 };
    }

    // Create first G703 page
    let g703PageNum = 1;
    let { page: currentG703Page, rowY } = createG703Page(g703PageNum);

    // Render all rows with pagination
    g703Data.forEach((row, idx) => {
      // Check if we need a new page
      if (rowY < 60) {
        // Add footer to current page
        currentG703Page.drawText('Generated by Ross Built CMS', { x: 50, y: 25, size: 8 });
        currentG703Page.drawText('(continued)', { x: g703Width - 100, y: 25, size: 8 });
        // Create new page
        g703PageNum++;
        const newPage = createG703Page(g703PageNum);
        currentG703Page = newPage.page;
        rowY = newPage.rowY;
      }

      currentG703Page.drawText(String(row.itemNum), { x: colX[0], y: rowY, size: 7 });
      currentG703Page.drawText(row.costCode.substring(0, 8), { x: colX[1], y: rowY, size: 7 });
      currentG703Page.drawText(row.description.substring(0, 15), { x: colX[2], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.scheduledValue).substring(0, 12), { x: colX[3], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.previousBillings).substring(0, 12), { x: colX[4], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.currentBillings).substring(0, 12), { x: colX[5], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.materialsStored).substring(0, 10), { x: colX[6], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.totalBilled).substring(0, 12), { x: colX[7], y: rowY, size: 7 });
      currentG703Page.drawText(row.percentComplete.toFixed(0) + '%', { x: colX[8], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.balance).substring(0, 12), { x: colX[9], y: rowY, size: 7 });

      grandTotals.scheduled += row.scheduledValue;
      grandTotals.previous += row.previousBillings;
      grandTotals.current += row.currentBillings;
      grandTotals.total += row.totalBilled;
      grandTotals.balance += row.balance;

      rowY -= rowHeight;
    });

    // Grand totals row on last page
    rowY -= 5;
    currentG703Page.drawLine({
      start: { x: 25, y: rowY + 10 },
      end: { x: g703Width - 25, y: rowY + 10 },
      thickness: 0.5
    });

    currentG703Page.drawText('GRAND TOTAL', { x: colX[2], y: rowY, size: 8 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.scheduled).substring(0, 12), { x: colX[3], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.previous).substring(0, 12), { x: colX[4], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.current).substring(0, 12), { x: colX[5], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.total).substring(0, 12), { x: colX[7], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.balance).substring(0, 12), { x: colX[9], y: rowY, size: 7 });

    // Footer on last page
    currentG703Page.drawText('Generated by Ross Built CMS', { x: 50, y: 25, size: 8 });
    currentG703Page.drawText(new Date().toLocaleDateString(), { x: g703Width - 100, y: 25, size: 8 });

    // ============ INVOICE COVER PAGE ============
    if (invoices.length > 0) {
      const invoiceCoverPage = mergedPdf.addPage([612, 792]);
      const icHeight = invoiceCoverPage.getHeight();

      invoiceCoverPage.drawText('ATTACHED INVOICES', { x: 50, y: icHeight - 60, size: 18 });
      invoiceCoverPage.drawText(`Draw #${draw.draw_number} - ${draw.job?.name || ''}`, { x: 50, y: icHeight - 85, size: 12 });

      let listY = icHeight - 130;
      invoices.forEach((inv, idx) => {
        if (listY < 80) return;
        const amount = parseFloat(inv.amount) || 0;
        invoiceCoverPage.drawText(
          `${idx + 1}. ${inv.vendor?.name || 'Unknown'} - Invoice #${inv.invoice_number || 'N/A'} - ${formatMoneyPDF(amount)}`,
          { x: 60, y: listY, size: 10 }
        );
        listY -= 20;
      });

      invoiceCoverPage.drawText('Generated by Ross Built CMS', { x: 50, y: 40, size: 8 });
    }

    // ============ APPEND INVOICE PDFs ============
    for (const inv of invoices) {
      if (inv.pdf_stamped_url) {
        try {
          const urlParts = inv.pdf_stamped_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
            const pdfBuffer = await downloadPDF(storagePath);
            const invoicePdf = await PDFDocument.load(pdfBuffer);
            const pages = await mergedPdf.copyPages(invoicePdf, invoicePdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
          }
        } catch (pdfErr) {
          logger.error('Failed to fetch PDF for invoice', { component: 'export', invoiceId: inv.id, error: pdfErr.message });
        }
      }
    }

    const pdfBytes = await mergedPdf.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Draw_${draw.draw_number}_${draw.job?.name?.replace(/\s+/g, '_') || 'Job'}_G702_G703.pdf`);
    res.send(Buffer.from(pdfBytes));
}));

// ============================================================
// LIEN RELEASES FOR DRAWS
// ============================================================

// Get lien releases for a draw
router.get('/:id/lien-releases', asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    const { data, error } = await supabase
      .from('v2_lien_releases')
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .eq('draw_id', drawId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
}));

// Get lien release coverage status for a draw
// Shows which vendors have invoices but are missing lien releases
router.get('/:id/lien-release-coverage', asyncHandler(async (req, res) => {
    const drawId = req.params.id;

    // Get all invoices in this draw with their vendors
    const { data: drawInvoices, error: invError } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          id,
          vendor_id,
          amount,
          vendor:v2_vendors(id, name)
        )
      `)
      .eq('draw_id', drawId);

    if (invError) throw invError;

    // Get all lien releases attached to this draw
    const { data: lienReleases, error: lrError } = await supabase
      .from('v2_lien_releases')
      .select('vendor_id')
      .eq('draw_id', drawId)
      .is('deleted_at', null);

    if (lrError) throw lrError;

    // Build vendor coverage map
    const vendorLienReleaseSet = new Set((lienReleases || []).map(lr => lr.vendor_id));

    // Group invoices by vendor
    const vendorInvoices = {};
    for (const di of (drawInvoices || [])) {
      if (!di.invoice) continue;
      const vendorId = di.invoice.vendor_id;
      const vendorName = di.invoice.vendor?.name || 'Unknown Vendor';

      if (!vendorInvoices[vendorId]) {
        vendorInvoices[vendorId] = {
          vendor_id: vendorId,
          vendor_name: vendorName,
          invoice_count: 0,
          total_amount: 0,
          has_lien_release: vendorLienReleaseSet.has(vendorId)
        };
      }
      vendorInvoices[vendorId].invoice_count++;
      vendorInvoices[vendorId].total_amount += parseFloat(di.invoice.amount || 0);
    }

    const coverage = Object.values(vendorInvoices);
    const totalVendors = coverage.length;
    const vendorsWithRelease = coverage.filter(v => v.has_lien_release).length;
    const vendorsMissingRelease = coverage.filter(v => !v.has_lien_release);

    res.json({
      total_vendors: totalVendors,
      vendors_with_release: vendorsWithRelease,
      vendors_missing_release: vendorsMissingRelease.length,
      coverage_percent: totalVendors > 0 ? Math.round((vendorsWithRelease / totalVendors) * 100) : 100,
      is_complete: vendorsMissingRelease.length === 0,
      vendors: coverage,
      missing_vendors: vendorsMissingRelease
    });
}));

module.exports = router;
module.exports.logDrawActivity = logDrawActivity;
module.exports.updateDrawTotal = updateDrawTotal;
module.exports.getOrCreateDraftDraw = getOrCreateDraftDraw;
module.exports.addInvoiceToDraw = addInvoiceToDraw;
module.exports.removeInvoiceFromDraw = removeInvoiceFromDraw;
