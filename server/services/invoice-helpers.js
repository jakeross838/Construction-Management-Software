/**
 * Invoice Helpers - Shared utility functions for invoice operations
 */

const { supabase } = require('../../config');
const logger = require('../utils/logger');
const {
  uploadStampedPDFById,
  downloadPDF,
  extractStoragePath,
  acquireStampLock,
  releaseStampLock
} = require('../core/storage');
const {
  stampApproval,
  stampInDraw,
  stampPaid,
  stampNeedsReview,
  stampReadyForApproval
} = require('../documents/pdf-stamper');

async function logActivity(invoiceId, action, performedBy, details = {}) {
  await supabase.from('v2_invoice_activity').insert({
    invoice_id: invoiceId,
    action,
    performed_by: performedBy,
    details
  });
}

// ============================================================
// PO LINE ITEM HELPERS
// ============================================================

/**
 * Update PO line items' invoiced_amount when allocations change.
 * Optimized: Batches all queries instead of N+1 pattern.
 */
async function updatePOLineItemsForAllocations(poId, allocations, add = true) {
  if (!poId || !allocations || allocations.length === 0) return;

  // Fetch all PO line items for this PO in one query
  const { data: allLineItems } = await supabase
    .from('v2_po_line_items')
    .select('id, invoiced_amount, cost_code_id')
    .eq('po_id', poId);

  if (!allLineItems || allLineItems.length === 0) return;

  // Build a map for quick lookup
  const lineItemsById = new Map(allLineItems.map(li => [li.id, li]));
  const lineItemsByCostCode = new Map(allLineItems.map(li => [li.cost_code_id, li]));

  // Calculate updates needed
  const updates = new Map(); // lineItemId -> new amount

  for (const alloc of allocations) {
    let poLineItem = null;

    // Priority 1: Direct po_line_item_id link
    if (alloc.po_line_item_id) {
      poLineItem = lineItemsById.get(alloc.po_line_item_id);
    }

    // Priority 2: Fall back to cost code matching
    if (!poLineItem) {
      const costCodeId = alloc.cost_code_id || alloc.cost_code?.id;
      if (costCodeId) {
        poLineItem = lineItemsByCostCode.get(costCodeId);
      }
    }

    if (poLineItem) {
      const currentAmount = updates.has(poLineItem.id)
        ? updates.get(poLineItem.id)
        : (parseFloat(poLineItem.invoiced_amount) || 0);
      const allocAmount = parseFloat(alloc.amount) || 0;
      const newAmount = add
        ? currentAmount + allocAmount
        : Math.max(0, currentAmount - allocAmount);
      updates.set(poLineItem.id, newAmount);
    }
  }

  // Batch update all line items (use Promise.all for parallel execution)
  if (updates.size > 0) {
    await Promise.all(
      Array.from(updates.entries()).map(([lineItemId, newAmount]) =>
        supabase
          .from('v2_po_line_items')
          .update({ invoiced_amount: newAmount })
          .eq('id', lineItemId)
      )
    );
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
 * Groups allocations by PO and updates the PO's total invoiced amount.
 */
async function updatePOInvoicedAmounts(allocations) {
  // Group allocations by PO
  const byPO = {};
  for (const alloc of allocations) {
    if (!alloc.po_id) continue;
    if (!byPO[alloc.po_id]) byPO[alloc.po_id] = 0;
    byPO[alloc.po_id] += parseFloat(alloc.amount) || 0;
  }

  // Update each PO's line items
  for (const [poId, totalAmount] of Object.entries(byPO)) {
    // Also update PO line items if po_line_item_id is specified
    const poAllocations = allocations.filter(a => a.po_id === poId);
    await updatePOLineItemsForAllocations(poId, poAllocations, true);
  }
}

/**
 * Update CO invoiced amounts when allocations are linked to COs.
 * Groups allocations by CO and updates the CO's invoiced_amount.
 * Optimized: Batches all queries instead of N+1 pattern.
 */
async function updateCOInvoicedAmounts(allocations) {
  // Get unique CO IDs
  const coIds = [...new Set(allocations.filter(a => a.change_order_id).map(a => a.change_order_id))];
  if (coIds.length === 0) return;

  // Fetch all allocations for these COs in one query
  const { data: allCOAllocations } = await supabase
    .from('v2_invoice_allocations')
    .select('change_order_id, amount')
    .in('change_order_id', coIds);

  // Group and sum allocations by CO
  const totalsByCO = new Map();
  for (const alloc of (allCOAllocations || [])) {
    const current = totalsByCO.get(alloc.change_order_id) || 0;
    totalsByCO.set(alloc.change_order_id, current + (parseFloat(alloc.amount) || 0));
  }

  // Batch update all COs in parallel
  await Promise.all(
    coIds.map(coId =>
      supabase
        .from('v2_job_change_orders')
        .update({ invoiced_amount: totalsByCO.get(coId) || 0 })
        .eq('id', coId)
    )
  );
}

/**
 * PO-INT-01: Recalculate PO line item invoiced_amount from actual allocations.
 * Only counts allocations from approved/in_draw/paid invoices.
 * Handles duplicate cost codes by using po_line_item_id first, then proportional distribution.
 */
async function recalculatePOLineItemInvoiced(poId, costCodeId = null) {
  const validStatuses = ['approved', 'in_draw', 'paid'];

  // Get all line items for this PO
  let query = supabase
    .from('v2_po_line_items')
    .select('id, cost_code_id, amount, invoiced_amount')
    .eq('po_id', poId);

  if (costCodeId) {
    query = query.eq('cost_code_id', costCodeId);
  }

  const { data: lineItems, error: liError } = await query;
  if (liError || !lineItems) return;

  // Get all allocations for this PO from valid invoices
  const { data: allAllocations } = await supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code_id,
      po_line_item_id,
      invoice:v2_invoices!inner(status)
    `)
    .eq('po_id', poId);

  const validAllocations = (allAllocations || [])
    .filter(a => validStatuses.includes(a.invoice?.status));

  // Separate allocations with direct line item links vs cost-code-only
  const directLinked = validAllocations.filter(a => a.po_line_item_id);
  const costCodeOnly = validAllocations.filter(a => !a.po_line_item_id);

  // Group cost-code-only allocations by cost_code_id
  const costCodeAllocMap = {};
  for (const alloc of costCodeOnly) {
    const ccId = alloc.cost_code_id;
    if (!costCodeAllocMap[ccId]) costCodeAllocMap[ccId] = 0;
    costCodeAllocMap[ccId] += parseFloat(alloc.amount || 0);
  }

  // Count how many line items share each cost code (for proportional distribution)
  const costCodeLineItems = {};
  for (const li of lineItems) {
    const ccId = li.cost_code_id;
    if (!costCodeLineItems[ccId]) costCodeLineItems[ccId] = [];
    costCodeLineItems[ccId].push(li);
  }

  for (const li of lineItems) {
    // Sum directly-linked allocations for this line item
    const directTotal = directLinked
      .filter(a => a.po_line_item_id === li.id)
      .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // For cost-code-only allocations, distribute proportionally if multiple line items share the cost code
    let costCodeTotal = 0;
    const ccId = li.cost_code_id;
    const totalForCostCode = costCodeAllocMap[ccId] || 0;
    if (totalForCostCode > 0) {
      const siblings = costCodeLineItems[ccId] || [];
      if (siblings.length === 1) {
        costCodeTotal = totalForCostCode;
      } else {
        // Proportional distribution based on line item amount
        const siblingTotal = siblings.reduce((s, sib) => s + (parseFloat(sib.amount) || 0), 0);
        const liAmount = parseFloat(li.amount) || 0;
        costCodeTotal = siblingTotal > 0 ? (liAmount / siblingTotal) * totalForCostCode : 0;
      }
    }

    const totalInvoiced = Math.round((directTotal + costCodeTotal) * 100) / 100;

    // Update line item
    const { error: updateError } = await supabase
      .from('v2_po_line_items')
      .update({ invoiced_amount: totalInvoiced })
      .eq('id', li.id);

    if (updateError) {
      logger.error('Failed to update PO line item', { component: 'po-sync', lineItemId: li.id, error: updateError.message });
    } else {
      logger.debug('Updated PO line item invoiced amount', { component: 'po-sync', lineItemId: li.id, invoicedAmount: totalInvoiced.toFixed(2) });
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
    logger.error('Failed to update CO', { component: 'co-sync', coId, error: updateError.message });
  } else {
    logger.debug('Updated CO invoiced amount', { component: 'co-sync', coId, invoicedAmount: totalInvoiced.toFixed(2) });
  }
}

/**
 * UNIFIED STAMP INVOICE FUNCTION
 *
 * This is the single source of truth for all PDF stamping.
 * - Always stamps from ORIGINAL pdf_url (never accumulates)
 * - Uses fixed path: {job_id}/{invoice_id}_stamped.pdf
 * - Includes locking to prevent concurrent stamp operations
 * - Updates pdf_stamped_url in database
 *
 * @param {string} invoiceId - Invoice ID to stamp
 * @param {object} options - Optional overrides
 * @param {boolean} options.force - Force stamp even if locked
 * @returns {Promise<string|null>} - Stamped URL or null
 */
async function stampInvoice(invoiceId, options = {}) {
  const { force = false } = options;

  // Acquire lock to prevent concurrent stamping
  if (!force && !acquireStampLock(invoiceId)) {
    logger.debug('Skipping - already being stamped', { component: 'stamp', invoiceId });
    return null;
  }

  try {
    // Fetch full invoice data
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
      logger.warn('Invoice not found for stamping', { component: 'stamp', invoiceId });
      return null;
    }

    if (!invoice.pdf_url) {
      logger.debug('No PDF to stamp', { component: 'stamp', invoiceId });
      return null;
    }

    // Extract storage path from ORIGINAL pdf_url (never use pdf_stamped_url)
    const storagePath = extractStoragePath(invoice.pdf_url);
    if (!storagePath) {
      logger.error('Could not extract path from pdf_url', { component: 'stamp', invoiceId, pdfUrl: invoice.pdf_url });
      return null;
    }

    // Download ORIGINAL PDF
    let pdfBuffer;
    try {
      pdfBuffer = await downloadPDF(storagePath);
    } catch (downloadErr) {
      logger.error('Failed to download original PDF', { component: 'stamp', invoiceId, error: downloadErr.message });
      return null;
    }

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Get cost codes formatted for stamp
    const costCodesForStamp = (invoice.allocations || []).map(a => ({
      code: a.cost_code?.code || '',
      name: a.cost_code?.name || '',
      amount: parseFloat(a.amount) || 0
    })).filter(cc => cc.code);

    let stampedBuffer = null;

    // Apply stamp based on current status
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
        // Get PO billing info
        let poTotal = null;
        let poBilledToDate = 0;
        let poLinkedAmount = null; // Amount of THIS invoice allocated to the PO

        // Helper to check if cost code is a CO code (ends with 'C')
        const isCOCostCode = (code) => code && /C$/i.test(code.trim());

        if (invoice.po?.id) {
          poTotal = parseFloat(invoice.po.total_amount);

          // Calculate how much of THIS invoice is linked to the PO
          // CO cost code allocations NEVER count toward PO billing (they're CO work)
          poLinkedAmount = (invoice.allocations || []).reduce((sum, alloc) => {
            const costCode = alloc.cost_code?.code;
            const isCO = isCOCostCode(costCode);

            // CO allocations never count toward PO billing, regardless of po_id
            if (isCO) {
              return sum;
            }
            // Non-CO allocations count if explicitly PO-linked OR invoice is PO-linked
            if (alloc.po_id === invoice.po.id || alloc.po_line_item_id || true) {
              return sum + parseFloat(alloc.amount || 0);
            }
            return sum;
          }, 0);

          // Get prior invoices billed against this PO (need to sum their PO-linked allocations too)
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
            // Sum the PO-linked allocations from prior invoices (exclude CO allocations)
            poBilledToDate = priorInvoices.reduce((sum, inv) => {
              if (inv.allocations && inv.allocations.length > 0) {
                // Count only non-CO allocations (CO work doesn't bill against PO)
                return sum + inv.allocations.reduce((s, a) => {
                  const costCode = a.cost_code?.code;
                  const isCO = isCOCostCode(costCode);
                  // CO allocations never count toward PO billing
                  if (isCO) {
                    return s;
                  }
                  return s + parseFloat(a.amount || 0);
                }, 0);
              }
              // Fall back to full invoice amount if no allocations (legacy data)
              return sum + parseFloat(inv.amount || 0);
            }, 0);
          }
        }

        // Check if this is a partial approval
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
        // No stamp for other statuses (received, denied, split, etc.)
        logger.debug('No stamp for status', { component: 'stamp', invoiceId, status: invoice.status });
        return null;
    }

    if (!stampedBuffer) {
      return null;
    }

    // Upload to FIXED path: {job_id}/{invoice_id}_stamped.pdf
    const uploadResult = await uploadStampedPDFById(
      stampedBuffer,
      invoiceId,
      invoice.job_id
    );

    if (uploadResult?.url) {
      // Update invoice with new stamped URL
      await supabase
        .from('v2_invoices')
        .update({ pdf_stamped_url: uploadResult.url })
        .eq('id', invoiceId);

      logger.info('Invoice stamped successfully', { component: 'stamp', invoiceId, url: uploadResult.url });
      return uploadResult.url;
    }

    return null;
  } catch (err) {
    logger.error('Error stamping invoice', { component: 'stamp', invoiceId, error: err.message });
    return null;
  } finally {
    // Always release lock
    releaseStampLock(invoiceId);
  }
}

// Alias for backwards compatibility
const restampInvoice = stampInvoice;

/**
 * Check if all children of a split parent have reached terminal states
 * If so, mark the parent as 'reconciled'
 *
 * Terminal states: paid, denied, deleted (via deleted_at)
 *
 * @param {string} parentInvoiceId - Parent invoice ID to check
 */
async function checkSplitReconciliation(parentInvoiceId) {
  if (!parentInvoiceId) return;

  try {
    // Get parent to verify it's a split parent
    const { data: parent } = await supabase
      .from('v2_invoices')
      .select('id, is_split_parent, status')
      .eq('id', parentInvoiceId)
      .single();

    if (!parent || !parent.is_split_parent) return;
    if (parent.status === 'reconciled') return; // Already reconciled

    // Get all children (including soft-deleted ones)
    const { data: children } = await supabase
      .from('v2_invoices')
      .select('id, status, deleted_at')
      .eq('parent_invoice_id', parentInvoiceId);

    if (!children || children.length === 0) return;

    // Check if all children are in terminal states
    const terminalStatuses = ['paid', 'denied'];
    const allTerminal = children.every(child =>
      child.deleted_at !== null || terminalStatuses.includes(child.status)
    );

    if (allTerminal) {
      // Calculate summary stats
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

      logger.info('Reconciled parent invoice', { component: 'split', parentInvoiceId, paidCount, deniedCount, deletedCount });
    }
  } catch (err) {
    logger.error('Reconciliation check failed', { component: 'split', parentInvoiceId, error: err.message });
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
    logger.error('Error fetching allocations', { component: 'cleanup', error: fetchError.message });
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
    logger.error('Error deleting allocations', { component: 'cleanup', error: deleteError.message });
    return { success: false, error: deleteError.message };
  }

  logger.info('Removed allocations for invoice', { component: 'cleanup', invoiceId, count: allocations.length });
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
      logger.warn('Failed to update billed_amount', { component: 'recalc', jobId, costCodeId, error: error.message });
    } else {
      logger.debug('Updated billed_amount', { component: 'recalc', jobId, costCodeId, totalBilled: totalBilled.toFixed(2) });
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
    logger.error('Operation failed, rolling back', { component: 'rollback', error: error.message });

    // Roll back in reverse order
    for (let i = completed.length - 1; i >= 0; i--) {
      try {
        if (completed[i].op.rollback) {
          await completed[i].op.rollback(completed[i].result);
        }
      } catch (rollbackError) {
        logger.error('Rollback operation failed', { component: 'rollback', error: rollbackError.message });
      }
    }

    return { success: false, error: error.message };
  }
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
  cleanupInvoiceAllocations,
  recalculateBilledAmounts,
  executeWithRollback
};
