/**
 * Draw Routes
 * All draw management endpoints including G702/G703 functionality
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { logActivity, checkSplitReconciliation } = require('../services/invoiceHelpers');
const {
  uploadStampedPDFById,
  downloadPDF,
  extractStoragePath
} = require('../storage');
const {
  stampApproval,
  stampInDraw,
  stampPaid
} = require('../pdf-stamper');

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
    console.error('Failed to log draw activity:', err);
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

// ============================================================
// LIST ENDPOINTS
// ============================================================

// List all draws
router.get('/', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single draw with G702/G703 data
router.get('/:id', async (req, res) => {
  try {
    const drawId = req.params.id;

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

    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];
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

      if (thisPeriod === 0) return null;

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

    res.json({
      ...draw,
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
        currentPaymentDue
      }
    });
  } catch (err) {
    console.error('Error fetching draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get draw activity
router.get('/:id/activity', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_draw_activity')
      .select('*')
      .eq('draw_id', req.params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CREATE/UPDATE ENDPOINTS
// ============================================================

// Update draw
router.patch('/:id', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// INVOICE MANAGEMENT
// ============================================================

// Add invoices to draw
router.post('/:id/add-invoices', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { invoice_ids } = req.body;

    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('id', drawId)
      .single();

    await supabase
      .from('v2_draw_invoices')
      .insert(invoice_ids.map(id => ({ draw_id: drawId, invoice_id: id })));

    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select(`
        id, amount, pdf_url, job_id, billed_amount,
        allocations:v2_invoice_allocations(id, amount, cost_code_id, notes)
      `)
      .in('id', invoice_ids);

    const partialInvoices = [];
    const fullyBilledInvoices = [];

    for (const inv of invoices) {
      const invoiceAmount = parseFloat(inv.amount || 0);
      const previouslyBilled = parseFloat(inv.billed_amount || 0);
      const currentAllocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      const newBilledTotal = previouslyBilled + currentAllocationSum;
      const isCredit = invoiceAmount < 0;
      const isFullyBilled = isCredit
        ? newBilledTotal <= invoiceAmount + 0.01
        : newBilledTotal >= invoiceAmount - 0.01;

      // Copy allocations to draw_allocations
      for (const alloc of (inv.allocations || [])) {
        await supabase.from('v2_draw_allocations').upsert({
          draw_id: drawId,
          invoice_id: inv.id,
          cost_code_id: alloc.cost_code_id,
          amount: alloc.amount,
          notes: alloc.notes,
          created_by: 'System'
        }, { onConflict: 'draw_id,invoice_id,cost_code_id' });
      }

      // Stamp PDF
      if (inv.pdf_url) {
        try {
          const storagePath = extractStoragePath(inv.pdf_url);
          if (storagePath) {
            const pdfBuffer = await downloadPDF(storagePath);
            const stampedBuffer = await stampInDraw(pdfBuffer, draw?.draw_number || 1);
            await uploadStampedPDFById(stampedBuffer, inv.id, inv.job_id);
          }
        } catch (stampErr) {
          console.error('IN DRAW stamp failed:', inv.id, stampErr.message);
        }
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
        updateData.status = 'needs_review';
        partialInvoices.push({
          id: inv.id,
          billed: currentAllocationSum,
          remaining: invoiceAmount - newBilledTotal
        });

        await logActivity(inv.id, 'partial_billed', 'System', {
          draw_number: draw?.draw_number,
          remaining_amount: invoiceAmount - newBilledTotal
        });
      }

      await supabase.from('v2_invoices').update(updateData).eq('id', inv.id);

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
            // Create budget line if doesn't exist
            await supabase
              .from('v2_budget_lines')
              .insert({
                job_id: inv.job_id,
                cost_code_id: alloc.cost_code_id,
                budgeted_amount: 0,
                committed_amount: 0,
                billed_amount: parseFloat(alloc.amount) || 0,
                paid_amount: 0
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
      partial_invoices: partialInvoices
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove invoice from draw
router.post('/:id/remove-invoice', async (req, res) => {
  try {
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
        }
      }
    }

    await supabase.from('v2_draw_allocations').delete().eq('draw_id', drawId).eq('invoice_id', invoice_id);
    await supabase.from('v2_draw_invoices').delete().eq('draw_id', drawId).eq('invoice_id', invoice_id);

    // Re-stamp with just APPROVED
    if (invoice?.pdf_url) {
      try {
        const storagePath = extractStoragePath(invoice.pdf_url);
        if (storagePath) {
          const pdfBuffer = await downloadPDF(storagePath);
          const stampedBuffer = await stampApproval(pdfBuffer, {
            status: 'APPROVED',
            date: new Date().toLocaleDateString(),
            approvedBy: invoice.approved_by || performed_by,
            vendorName: invoice.vendor?.name,
            invoiceNumber: invoice.invoice_number,
            jobName: invoice.job?.name,
            amount: invoice.amount,
            poNumber: invoice.po?.po_number,
            poTotal: invoice.po?.total_amount
          });
          await uploadStampedPDFById(stampedBuffer, invoice_id, invoice.job?.id);
        }
      } catch (stampErr) {
        console.error('Re-stamping failed:', stampErr.message);
      }
    }

    await supabase.from('v2_invoices').update({ status: 'approved' }).eq('id', invoice_id);
    await logActivity(invoice_id, 'removed_from_draw', performed_by, { draw_number: draw.draw_number });
    await logDrawActivity(drawId, 'invoice_removed', performed_by, { invoice_id, invoice_number: invoice?.invoice_number });

    const newTotal = await updateDrawTotal(drawId);

    res.json({ success: true, new_total: newTotal, draw_number: draw.draw_number });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATUS TRANSITIONS
// ============================================================

// Submit draw
router.patch('/:id/submit', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { submitted_by = 'System' } = req.body;

    const { data: drawInfo } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!drawInfo) return res.status(404).json({ error: 'Draw not found' });
    if (drawInfo.status !== 'draft') {
      return res.status(400).json({ error: `Cannot submit a draw that is already ${drawInfo.status}` });
    }

    const now = new Date().toISOString();

    const { data: draw, error } = await supabase
      .from('v2_draws')
      .update({ status: 'submitted', submitted_at: now, locked_at: now })
      .eq('id', drawId)
      .select()
      .single();

    if (error) throw error;

    await logDrawActivity(drawId, 'submitted', submitted_by, {
      draw_number: draw.draw_number,
      total_amount: draw.total_amount
    });

    res.json(draw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unsubmit draw
router.post('/:id/unsubmit', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fund draw
router.patch('/:id/fund', async (req, res) => {
  try {
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
            }
          }
        }

        // Stamp as PAID
        if (inv.pdf_url) {
          try {
            const storagePath = extractStoragePath(inv.pdf_url);
            if (storagePath) {
              const pdfBuffer = await downloadPDF(storagePath);
              const stampedBuffer = await stampPaid(pdfBuffer, paidDate);
              await uploadStampedPDFById(stampedBuffer, inv.id, inv.job_id);
            }
          } catch (stampErr) {
            console.error('PAID stamp failed:', inv.id, stampErr.message);
          }
        }

        const invoiceUpdate = { status: 'paid', paid_amount: newPaidAmount };
        if (isFullyBilled) invoiceUpdate.fully_billed_at = now;

        await supabase.from('v2_invoices').update(invoiceUpdate).eq('id', inv.id);
        await logActivity(inv.id, 'paid', 'System', { draw_id: drawId, amount_paid_this_draw: billedThisDraw });

        if (inv.parent_invoice_id) {
          checkSplitReconciliation(inv.parent_invoice_id).catch(console.error);
        }
      }
    }

    res.json(draw);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE
// ============================================================

router.delete('/:id', async (req, res) => {
  try {
    const drawId = req.params.id;

    await supabase.from('v2_draw_allocations').delete().eq('draw_id', drawId);
    await supabase.from('v2_draw_invoices').delete().eq('draw_id', drawId);
    await supabase.from('v2_draw_activity').delete().eq('draw_id', drawId);
    await supabase.from('v2_draws').delete().eq('id', drawId);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UTILITIES
// ============================================================

router.post('/:id/recalculate', async (req, res) => {
  try {
    const newTotal = await updateDrawTotal(req.params.id);
    res.json({ success: true, new_total: newTotal });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/fix-legacy-status', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_draws')
      .update({ status: 'funded' })
      .in('status', ['partially_funded', 'overfunded'])
      .select('id, draw_number, status');

    if (error) throw error;
    res.json({ message: 'Legacy statuses fixed', updated: data?.length || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.logDrawActivity = logDrawActivity;
module.exports.updateDrawTotal = updateDrawTotal;
