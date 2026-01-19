/**
 * Invoice Helpers - Shared utility functions for invoice operations
 */

const { supabase } = require('../../config');
const {
  uploadPDF,
  uploadStampedPDF,
  uploadStampedPDFById,
  downloadPDF,
  extractStoragePath,
  acquireStampLock,
  releaseStampLock
} = require('../storage');
const {
  stampApproval,
  stampInDraw,
  stampPaid,
  stampPartiallyPaid,
  stampPartiallyBilled,
  stampSplit,
  stampNeedsReview,
  stampReadyForApproval
} = require('../pdf-stamper');

/**
 * Log activity for an invoice
 */
async function logActivity(invoiceId, action, performedBy, details = {}) {
  await supabase.from('v2_invoice_activity').insert({
    invoice_id: invoiceId,
    action,
    performed_by: performedBy,
    details
  });
}

/**
 * Update PO line items' invoiced_amount when allocations change.
 */
async function updatePOLineItemsForAllocations(poId, allocations, add = true) {
  if (!poId || !allocations || allocations.length === 0) return;

  for (const alloc of allocations) {
    let poLineItem = null;

    // Priority 1: Direct po_line_item_id link
    if (alloc.po_line_item_id) {
      const { data } = await supabase
        .from('v2_po_line_items')
        .select('id, invoiced_amount')
        .eq('id', alloc.po_line_item_id)
        .eq('po_id', poId)
        .single();
      poLineItem = data;
    }

    // Priority 2: Fall back to cost code matching
    if (!poLineItem) {
      const costCodeId = alloc.cost_code_id || alloc.cost_code?.id;
      if (costCodeId) {
        const { data } = await supabase
          .from('v2_po_line_items')
          .select('id, invoiced_amount')
          .eq('po_id', poId)
          .eq('cost_code_id', costCodeId)
          .single();
        poLineItem = data;
      }
    }

    if (poLineItem) {
      const currentAmount = parseFloat(poLineItem.invoiced_amount) || 0;
      const allocAmount = parseFloat(alloc.amount) || 0;
      const newAmount = add
        ? currentAmount + allocAmount
        : Math.max(0, currentAmount - allocAmount);

      await supabase
        .from('v2_po_line_items')
        .update({ invoiced_amount: newAmount })
        .eq('id', poLineItem.id);
    }
  }
}

/**
 * Sync PO line items when allocations change on an invoice.
 */
async function syncPOLineItemsOnAllocationChange(invoice, oldAllocations, newAllocations, oldPoId = null) {
  const billableStatuses = ['approved', 'in_draw', 'paid'];
  if (!billableStatuses.includes(invoice.status)) return;

  const effectiveOldPoId = oldPoId || invoice.po_id;

  if (effectiveOldPoId && effectiveOldPoId !== invoice.po_id) {
    await updatePOLineItemsForAllocations(effectiveOldPoId, oldAllocations, false);
  }

  if (invoice.po_id) {
    if (effectiveOldPoId === invoice.po_id) {
      await updatePOLineItemsForAllocations(invoice.po_id, oldAllocations, false);
    }
    await updatePOLineItemsForAllocations(invoice.po_id, newAllocations, true);
  }
}

/**
 * Update PO invoiced amounts when allocations are linked to POs.
 */
async function updatePOInvoicedAmounts(allocations) {
  const byPO = {};
  for (const alloc of allocations) {
    if (!alloc.po_id) continue;
    if (!byPO[alloc.po_id]) byPO[alloc.po_id] = 0;
    byPO[alloc.po_id] += parseFloat(alloc.amount) || 0;
  }

  for (const [poId, totalAmount] of Object.entries(byPO)) {
    const poAllocations = allocations.filter(a => a.po_id === poId);
    await updatePOLineItemsForAllocations(poId, poAllocations, true);
  }
}

/**
 * Update CO invoiced amounts when allocations are linked to COs.
 * PO-INT-02: Only count allocations from approved/in_draw/paid invoices
 */
async function updateCOInvoicedAmounts(allocations) {
  const validStatuses = ['approved', 'in_draw', 'paid'];
  const byCO = {};
  for (const alloc of allocations) {
    if (!alloc.change_order_id) continue;
    if (!byCO[alloc.change_order_id]) byCO[alloc.change_order_id] = 0;
    byCO[alloc.change_order_id] += parseFloat(alloc.amount) || 0;
  }

  for (const coId of Object.keys(byCO)) {
    // PO-INT-02: Only count allocations from invoices with valid status
    const { data: allCOAllocations } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount,
        invoice:v2_invoices!inner(status)
      `)
      .eq('change_order_id', coId);

    const totalInvoiced = (allCOAllocations || [])
      .filter(a => validStatuses.includes(a.invoice?.status))
      .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0);

    await supabase
      .from('v2_job_change_orders')
      .update({ invoiced_amount: totalInvoiced })
      .eq('id', coId);

    console.log(`[CO-SYNC] Updated CO ${coId} invoiced_amount: $${totalInvoiced.toFixed(2)}`);
  }
}

/**
 * PO-INT-01: Recalculate PO line item invoiced_amount from actual allocations.
 * Only counts allocations from approved/in_draw/paid invoices.
 */
async function recalculatePOLineItemInvoiced(poId, costCodeId = null) {
  const validStatuses = ['approved', 'in_draw', 'paid'];

  // Get all line items for this PO
  let query = supabase
    .from('v2_po_line_items')
    .select('id, cost_code_id, invoiced_amount')
    .eq('po_id', poId);

  if (costCodeId) {
    query = query.eq('cost_code_id', costCodeId);
  }

  const { data: lineItems, error: liError } = await query;
  if (liError || !lineItems) return;

  for (const li of lineItems) {
    // Sum all allocations linked to this PO and cost code
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount,
        invoice:v2_invoices!inner(status)
      `)
      .eq('po_id', poId)
      .eq('cost_code_id', li.cost_code_id);

    // Only count allocations from approved/in_draw/paid invoices
    const totalInvoiced = (allocations || [])
      .filter(a => validStatuses.includes(a.invoice?.status))
      .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Update line item
    const { error: updateError } = await supabase
      .from('v2_po_line_items')
      .update({ invoiced_amount: totalInvoiced })
      .eq('id', li.id);

    if (updateError) {
      console.error(`[PO-SYNC] Failed to update PO line item ${li.id}:`, updateError.message);
    } else {
      console.log(`[PO-SYNC] Updated PO line item ${li.id} invoiced_amount: $${totalInvoiced.toFixed(2)}`);
    }
  }
}

/**
 * PO-INT-02: Recalculate CO invoiced_amount from allocations.
 * Only counts allocations from approved/in_draw/paid invoices.
 */
async function recalculateCOInvoiced(coId) {
  const validStatuses = ['approved', 'in_draw', 'paid'];

  // Sum all allocations linked to this CO from valid invoices
  const { data: allocations } = await supabase
    .from('v2_invoice_allocations')
    .select(`
      amount,
      invoice:v2_invoices!inner(status)
    `)
    .eq('change_order_id', coId);

  const totalInvoiced = (allocations || [])
    .filter(a => validStatuses.includes(a.invoice?.status))
    .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

  // Update CO
  const { error: updateError } = await supabase
    .from('v2_job_change_orders')
    .update({ invoiced_amount: totalInvoiced })
    .eq('id', coId);

  if (updateError) {
    console.error(`[CO-SYNC] Failed to update CO ${coId}:`, updateError.message);
  } else {
    console.log(`[CO-SYNC] Updated CO ${coId} invoiced_amount: $${totalInvoiced.toFixed(2)}`);
  }
}

/**
 * UNIFIED STAMP INVOICE FUNCTION
 * Single source of truth for all PDF stamping.
 */
async function stampInvoice(invoiceId, options = {}) {
  const { force = false } = options;

  if (!force && !acquireStampLock(invoiceId)) {
    console.log('[STAMP] Skipping - already being stamped:', invoiceId);
    return null;
  }

  try {
    const { data: invoice, error: fetchError } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, description, total_amount),
        allocations:v2_invoice_allocations(
          amount,
          cost_code_id,
          po_id,
          po_line_item_id,
          cost_code:v2_cost_codes(code, name)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      console.error('[STAMP] Invoice not found:', invoiceId);
      return null;
    }

    if (!invoice.pdf_url) {
      console.log('[STAMP] No PDF to stamp:', invoiceId);
      return null;
    }

    const storagePath = extractStoragePath(invoice.pdf_url);
    if (!storagePath) {
      console.error('[STAMP] Could not extract path from pdf_url:', invoice.pdf_url);
      return null;
    }

    let pdfBuffer;
    try {
      pdfBuffer = await downloadPDF(storagePath);
    } catch (downloadErr) {
      console.error('[STAMP] Failed to download original PDF:', downloadErr.message);
      return null;
    }

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const costCodesForStamp = (invoice.allocations || []).map(a => ({
      code: a.cost_code?.code || '',
      name: a.cost_code?.name || '',
      amount: parseFloat(a.amount) || 0
    })).filter(cc => cc.code);

    let stampedBuffer = null;
    const isCOCostCode = (code) => code && /C$/i.test(code.trim());

    switch (invoice.status) {
      case 'needs_review':
        stampedBuffer = await stampNeedsReview(pdfBuffer, {
          date: dateStr,
          vendorName: invoice.vendor?.name,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          flags: invoice.review_flags || []
        });
        break;

      case 'ready_for_approval':
        stampedBuffer = await stampReadyForApproval(pdfBuffer, {
          date: dateStr,
          codedBy: invoice.coded_by,
          jobName: invoice.job?.name,
          vendorName: invoice.vendor?.name,
          amount: invoice.amount,
          costCodes: costCodesForStamp
        });
        break;

      case 'approved':
      case 'in_draw':
      case 'paid': {
        let poTotal = null;
        let poBilledToDate = 0;
        let poLinkedAmount = null;

        if (invoice.po?.id) {
          poTotal = parseFloat(invoice.po.total_amount);

          poLinkedAmount = (invoice.allocations || []).reduce((sum, alloc) => {
            const costCode = alloc.cost_code?.code;
            if (isCOCostCode(costCode)) return sum;
            return sum + parseFloat(alloc.amount || 0);
          }, 0);

          const { data: priorInvoices } = await supabase
            .from('v2_invoices')
            .select(`
              id,
              amount,
              allocations:v2_invoice_allocations(
                amount,
                po_id,
                po_line_item_id,
                cost_code:v2_cost_codes(code)
              )
            `)
            .eq('po_id', invoice.po.id)
            .neq('id', invoiceId)
            .in('status', ['approved', 'in_draw', 'paid']);

          if (priorInvoices) {
            poBilledToDate = priorInvoices.reduce((sum, inv) => {
              if (inv.allocations && inv.allocations.length > 0) {
                return sum + inv.allocations.reduce((s, a) => {
                  const costCode = a.cost_code?.code;
                  if (isCOCostCode(costCode)) return s;
                  return s + parseFloat(a.amount || 0);
                }, 0);
              }
              return sum + parseFloat(inv.amount || 0);
            }, 0);
          }
        }

        const isPartialApproval = invoice.review_flags?.includes('partial_approval');

        stampedBuffer = await stampApproval(pdfBuffer, {
          status: 'APPROVED',
          date: invoice.approved_at ? new Date(invoice.approved_at).toLocaleDateString() : dateStr,
          approvedBy: invoice.approved_by,
          vendorName: invoice.vendor?.name,
          invoiceNumber: invoice.invoice_number,
          jobName: invoice.job?.name,
          costCodes: costCodesForStamp,
          amount: parseFloat(invoice.amount),
          poNumber: invoice.po?.po_number,
          poDescription: invoice.po?.description,
          poTotal,
          poBilledToDate,
          poLinkedAmount,
          isPartial: isPartialApproval
        });

        // Add IN DRAW stamp if applicable (for in_draw OR paid status - paid invoices were in a draw)
        if (invoice.status === 'in_draw' || invoice.status === 'paid') {
          const { data: drawInvoice } = await supabase
            .from('v2_draw_invoices')
            .select('draw:v2_draws(draw_number)')
            .eq('invoice_id', invoiceId)
            .single();

          if (drawInvoice?.draw?.draw_number) {
            stampedBuffer = await stampInDraw(stampedBuffer, drawInvoice.draw.draw_number);
          }
        }

        // Add PAID stamp if applicable
        if (invoice.status === 'paid' && invoice.paid_at) {
          const paidDate = new Date(invoice.paid_at).toLocaleDateString();
          stampedBuffer = await stampPaid(stampedBuffer, paidDate);
        }
        break;
      }

      default:
        console.log('[STAMP] No stamp for status:', invoice.status);
        return null;
    }

    if (!stampedBuffer) return null;

    const uploadResult = await uploadStampedPDFById(
      stampedBuffer,
      invoiceId,
      invoice.job_id
    );

    if (uploadResult?.url) {
      await supabase
        .from('v2_invoices')
        .update({ pdf_stamped_url: uploadResult.url })
        .eq('id', invoiceId);

      console.log('[STAMP] Success:', invoiceId, '->', uploadResult.url);
      return uploadResult.url;
    }

    return null;
  } catch (err) {
    console.error('[STAMP] Error stamping invoice:', invoiceId, err.message);
    return null;
  } finally {
    releaseStampLock(invoiceId);
  }
}

// Alias for backwards compatibility
const restampInvoice = stampInvoice;

/**
 * Check if all children of a split parent have reached terminal states
 */
async function checkSplitReconciliation(parentInvoiceId) {
  if (!parentInvoiceId) return;

  try {
    const { data: parent } = await supabase
      .from('v2_invoices')
      .select('id, is_split_parent, status')
      .eq('id', parentInvoiceId)
      .single();

    if (!parent || !parent.is_split_parent) return;
    if (parent.status === 'reconciled') return;

    const { data: children } = await supabase
      .from('v2_invoices')
      .select('id, status, deleted_at')
      .eq('parent_invoice_id', parentInvoiceId);

    if (!children || children.length === 0) return;

    const terminalStatuses = ['paid', 'denied'];
    const allTerminal = children.every(child =>
      child.deleted_at !== null || terminalStatuses.includes(child.status)
    );

    if (allTerminal) {
      const paidCount = children.filter(c => c.status === 'paid' && !c.deleted_at).length;
      const deniedCount = children.filter(c => c.status === 'denied' && !c.deleted_at).length;
      const deletedCount = children.filter(c => c.deleted_at !== null).length;

      await supabase
        .from('v2_invoices')
        .update({
          status: 'reconciled',
          notes: `Split reconciled on ${new Date().toLocaleDateString()}\nPaid: ${paidCount}, Denied: ${deniedCount}, Deleted: ${deletedCount}`
        })
        .eq('id', parentInvoiceId);

      console.log('[SPLIT] Reconciled parent invoice:', parentInvoiceId, { paidCount, deniedCount, deletedCount });
    }
  } catch (err) {
    console.error('[SPLIT] Reconciliation check failed:', parentInvoiceId, err.message);
  }
}

/**
 * Clean up all allocations for an invoice when it is denied or deleted.
 * This reverses PO line item and CO invoiced amounts, then removes all allocations.
 */
async function cleanupInvoiceAllocations(invoiceId) {
  if (!invoiceId) return { success: true, allocations_removed: 0 };

  // Fetch all allocations for this invoice
  const { data: allocations, error: fetchError } = await supabase
    .from('v2_invoice_allocations')
    .select('id, amount, po_id, po_line_item_id, change_order_id, cost_code_id')
    .eq('invoice_id', invoiceId);

  if (fetchError) {
    console.error('[CLEANUP] Error fetching allocations:', fetchError.message);
    return { success: false, error: fetchError.message };
  }

  if (!allocations || allocations.length === 0) {
    return { success: true, allocations_removed: 0 };
  }

  // Group allocations by PO and decrement PO line item invoiced_amount
  const poAllocations = allocations.filter(a => a.po_id);
  const poGroups = {};
  for (const alloc of poAllocations) {
    if (!poGroups[alloc.po_id]) poGroups[alloc.po_id] = [];
    poGroups[alloc.po_id].push(alloc);
  }

  for (const [poId, poAllocs] of Object.entries(poGroups)) {
    await updatePOLineItemsForAllocations(poId, poAllocs, false);
  }

  // Decrement CO invoiced_amount for each CO allocation
  const coAllocations = allocations.filter(a => a.change_order_id);
  for (const alloc of coAllocations) {
    const { data: coData } = await supabase
      .from('v2_job_change_orders')
      .select('invoiced_amount')
      .eq('id', alloc.change_order_id)
      .single();

    if (coData) {
      const newAmount = Math.max(0, (parseFloat(coData.invoiced_amount) || 0) - (parseFloat(alloc.amount) || 0));
      await supabase
        .from('v2_job_change_orders')
        .update({ invoiced_amount: newAmount })
        .eq('id', alloc.change_order_id);
    }
  }

  // Delete all allocations for this invoice
  const { error: deleteError } = await supabase
    .from('v2_invoice_allocations')
    .delete()
    .eq('invoice_id', invoiceId);

  if (deleteError) {
    console.error('[CLEANUP] Error deleting allocations:', deleteError.message);
    return { success: false, error: deleteError.message };
  }

  console.log(`[CLEANUP] Removed ${allocations.length} allocations for invoice ${invoiceId}`);
  return { success: true, allocations_removed: allocations.length };
}

/**
 * Recalculate billed_amount for budget lines based on actual draw allocations.
 * Call this when allocations change for an invoice that's in a draw.
 *
 * @param {string} jobId - The job ID
 * @param {Array} costCodeIds - Array of cost code IDs to recalculate
 */
async function recalculateBilledAmounts(jobId, costCodeIds) {
  if (!jobId || !costCodeIds || costCodeIds.length === 0) return;

  for (const costCodeId of costCodeIds) {
    // Get sum of all draw allocations for this job/cost_code
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select(`
        amount,
        draw:v2_draws!inner(job_id)
      `)
      .eq('cost_code_id', costCodeId)
      .eq('draw.job_id', jobId);

    const totalBilled = (drawAllocations || []).reduce(
      (sum, a) => sum + parseFloat(a.amount || 0), 0
    );

    // Update budget line
    const { error } = await supabase
      .from('v2_budget_lines')
      .update({ billed_amount: totalBilled })
      .eq('job_id', jobId)
      .eq('cost_code_id', costCodeId);

    if (error) {
      console.warn(`[RECALC] Failed to update billed_amount for job=${jobId} cost_code=${costCodeId}:`, error.message);
    } else {
      console.log(`[RECALC] Updated billed_amount for job=${jobId} cost_code=${costCodeId}: $${totalBilled.toFixed(2)}`);
    }
  }
}

/**
 * Execute multiple database operations with rollback on failure.
 * Since Supabase doesn't support transactions in JS client, we track
 * operations and manually reverse on failure.
 *
 * @param {Array} operations - Array of {execute: async fn, rollback: async fn}
 * @returns {Object} { success: boolean, error?: string, results?: Array }
 */
async function executeWithRollback(operations) {
  const completed = [];

  try {
    for (const op of operations) {
      const result = await op.execute();
      completed.push({ op, result });
    }
    return { success: true, results: completed.map(c => c.result) };
  } catch (error) {
    console.error('[ROLLBACK] Operation failed, rolling back:', error.message);

    // Roll back in reverse order
    for (let i = completed.length - 1; i >= 0; i--) {
      try {
        if (completed[i].op.rollback) {
          await completed[i].op.rollback(completed[i].result);
        }
      } catch (rollbackError) {
        console.error('[ROLLBACK] Rollback operation failed:', rollbackError.message);
      }
    }

    return { success: false, error: error.message };
  }
}

/**
 * Get or create a draft draw for a job
 */
async function getOrCreateDraftDraw(jobId, createdBy = 'System') {
  // Check for existing draft draw
  const { data: existingDraw } = await supabase
    .from('v2_draws')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingDraw) {
    return existingDraw;
  }

  // Get next draw number for job
  const { data: lastDraw } = await supabase
    .from('v2_draws')
    .select('draw_number')
    .eq('job_id', jobId)
    .order('draw_number', { ascending: false })
    .limit(1)
    .single();

  const nextDrawNumber = (lastDraw?.draw_number || 0) + 1;

  // Create new draft draw
  const { data: newDraw, error } = await supabase
    .from('v2_draws')
    .insert({
      job_id: jobId,
      draw_number: nextDrawNumber,
      status: 'draft',
      period_end: new Date().toISOString().split('T')[0],
      total_amount: 0
    })
    .select()
    .single();

  if (error) throw error;

  console.log(`[DRAW] Created draft draw #${nextDrawNumber} for job ${jobId}`);
  return newDraw;
}

module.exports = {
  logActivity,
  updatePOLineItemsForAllocations,
  syncPOLineItemsOnAllocationChange,
  updatePOInvoicedAmounts,
  updateCOInvoicedAmounts,
  recalculatePOLineItemInvoiced,
  recalculateCOInvoiced,
  stampInvoice,
  restampInvoice,
  checkSplitReconciliation,
  getOrCreateDraftDraw,
  cleanupInvoiceAllocations,
  recalculateBilledAmounts,
  executeWithRollback
};
