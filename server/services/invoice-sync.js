/**
 * Invoice Sync Service
 * Ensures invoice allocations are properly reflected in PO billed amounts
 */

const { supabase } = require('../../config');
const logger = require('../utils/logger');

/**
 * Recalculate billed amount for a specific PO line item
 * Sums all invoice allocations linked to this PO/cost code
 */
async function recalculatePOLineBilled(poId, costCodeId) {
  if (!poId || !costCodeId) {
    logger.warn('Missing poId or costCodeId in recalculatePOLineBilled');
    return null;
  }

  try {
    // Get all invoice allocations for this PO/cost code
    // Only count invoices that are approved or later (in_draw, paid)
    const { data: allocations, error: allocError } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount,
        invoice:v2_invoices!inner(id, po_id, status, deleted_at)
      `)
      .eq('cost_code_id', costCodeId)
      .eq('invoice.po_id', poId)
      .is('invoice.deleted_at', null)
      .in('invoice.status', ['approved', 'in_draw', 'paid']);

    if (allocError) throw allocError;

    const totalBilled = (allocations || [])
      .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Update PO line item
    const { error: updateError } = await supabase
      .from('v2_po_line_items')
      .update({ invoiced_amount: totalBilled })
      .eq('po_id', poId)
      .eq('cost_code_id', costCodeId);

    if (updateError) throw updateError;

    logger.info('Recalculated PO line billed amount', {
      component: 'InvoiceSync',
      poId,
      costCodeId,
      totalBilled,
    });

    return totalBilled;
  } catch (error) {
    logger.error('Failed to recalculate PO line billed', {
      component: 'InvoiceSync',
      poId,
      costCodeId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Recalculate total billed for entire PO
 */
async function recalculatePOTotalBilled(poId) {
  try {
    // Sum all invoiced_amount from line items
    const { data: lineItems, error: liError } = await supabase
      .from('v2_po_line_items')
      .select('invoiced_amount')
      .eq('po_id', poId);

    if (liError) throw liError;

    const totalBilled = (lineItems || [])
      .reduce((sum, li) => sum + parseFloat(li.invoiced_amount || 0), 0);

    // Get PO current amount
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .select('current_amount')
      .eq('id', poId)
      .single();

    if (poError) throw poError;

    const currentAmount = parseFloat(po?.current_amount || 0);
    const remainingAmount = currentAmount - totalBilled;

    // Update PO totals
    await supabase
      .from('v2_purchase_orders')
      .update({
        invoiced_amount: totalBilled,
        remaining_amount: Math.max(0, remainingAmount),
      })
      .eq('id', poId);

    logger.info('Recalculated PO total billed', {
      component: 'InvoiceSync',
      poId,
      totalBilled,
      remainingAmount,
    });

    return { totalBilled, remainingAmount };
  } catch (error) {
    logger.error('Failed to recalculate PO total billed', {
      component: 'InvoiceSync',
      poId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Sync invoice allocations to PO
 * Call this when allocations change
 */
async function syncInvoiceToPO(invoiceId) {
  try {
    // Get invoice with allocations
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .select(`
        id, po_id, status,
        allocations:v2_invoice_allocations(cost_code_id, amount)
      `)
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice?.po_id) {
      logger.info('Invoice has no PO, skipping sync', { invoiceId });
      return;
    }

    // Get unique cost codes from allocations
    const costCodeIds = [...new Set(
      (invoice.allocations || [])
        .map(a => a.cost_code_id)
        .filter(Boolean)
    )];

    // Recalculate each cost code's billed amount
    for (const costCodeId of costCodeIds) {
      await recalculatePOLineBilled(invoice.po_id, costCodeId);
    }

    // Recalculate PO total
    await recalculatePOTotalBilled(invoice.po_id);

    logger.info('Synced invoice to PO', {
      component: 'InvoiceSync',
      invoiceId,
      poId: invoice.po_id,
      costCodeCount: costCodeIds.length,
    });
  } catch (error) {
    logger.error('Failed to sync invoice to PO', {
      component: 'InvoiceSync',
      invoiceId,
      error: error.message,
    });
  }
}

/**
 * Handle invoice status change
 * Recalculate PO billed amounts when invoice is approved/denied/deleted
 */
async function handleInvoiceStatusChange(invoiceId, newStatus, oldStatus) {
  // Only sync if transitioning to/from billable status
  const billableStatuses = ['approved', 'in_draw', 'paid'];
  const wasBillable = billableStatuses.includes(oldStatus);
  const isBillable = billableStatuses.includes(newStatus);

  if (wasBillable !== isBillable) {
    await syncInvoiceToPO(invoiceId);
  }
}

/**
 * Handle invoice deletion
 */
async function handleInvoiceDeleted(invoiceId, poId) {
  if (poId) {
    // Need to recalculate all cost codes for this PO
    // since we don't have the allocations anymore
    try {
      // Get all line items for the PO
      const { data: lineItems } = await supabase
        .from('v2_po_line_items')
        .select('cost_code_id')
        .eq('po_id', poId);

      for (const li of (lineItems || [])) {
        if (li.cost_code_id) {
          await recalculatePOLineBilled(poId, li.cost_code_id);
        }
      }

      await recalculatePOTotalBilled(poId);
    } catch (error) {
      logger.error('Failed to handle invoice deletion', {
        component: 'InvoiceSync',
        invoiceId,
        poId,
        error: error.message,
      });
    }
  }
}

/**
 * Recalculate all billed amounts for a PO
 * Use this for full reconciliation
 */
async function syncPOBilled(poId) {
  try {
    // Get all line items
    const { data: lineItems, error: liError } = await supabase
      .from('v2_po_line_items')
      .select('cost_code_id')
      .eq('po_id', poId);

    if (liError) throw liError;

    // Recalculate each
    for (const li of (lineItems || [])) {
      if (li.cost_code_id) {
        await recalculatePOLineBilled(poId, li.cost_code_id);
      }
    }

    // Recalculate total
    return await recalculatePOTotalBilled(poId);
  } catch (error) {
    logger.error('Failed to sync PO billed', {
      component: 'InvoiceSync',
      poId,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  recalculatePOLineBilled,
  recalculatePOTotalBilled,
  syncInvoiceToPO,
  handleInvoiceStatusChange,
  handleInvoiceDeleted,
  syncPOBilled,
};
