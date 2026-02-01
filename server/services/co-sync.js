/**
 * Change Order Sync Service
 * Ensures CO approvals are properly reflected in budget and PO totals
 */

const { supabase } = require('../../config');
const logger = require('../utils/logger');

/**
 * Recalculate CO total for a specific cost code in a job
 * Only counts approved COs
 */
async function recalculateCOAmountForCostCode(jobId, costCodeId) {
  if (!jobId || !costCodeId) {
    logger.warn('Missing jobId or costCodeId in recalculateCOAmountForCostCode');
    return null;
  }

  try {
    // Get all approved CO line items for this job/cost code
    const { data: coLineItems, error: coError } = await supabase
      .from('v2_change_order_line_items')
      .select(`
        amount,
        change_order:v2_change_orders!inner(
          id, status,
          po:v2_purchase_orders!inner(job_id, deleted_at)
        )
      `)
      .eq('cost_code_id', costCodeId);

    if (coError) throw coError;

    // Filter to approved COs for this job and sum
    const coTotal = (coLineItems || [])
      .filter(li =>
        li.change_order?.status === 'approved' &&
        li.change_order?.po?.job_id === jobId &&
        !li.change_order?.po?.deleted_at
      )
      .reduce((sum, li) => sum + parseFloat(li.amount || 0), 0);

    // Update budget line
    const { data: budgetLine, error: blError } = await supabase
      .from('v2_budget_lines')
      .select('id')
      .eq('job_id', jobId)
      .eq('cost_code_id', costCodeId)
      .single();

    if (blError && blError.code !== 'PGRST116') throw blError;

    if (budgetLine) {
      await supabase
        .from('v2_budget_lines')
        .update({ change_order_amount: coTotal })
        .eq('id', budgetLine.id);
    } else if (coTotal > 0) {
      // Create budget line if it doesn't exist and has CO amount
      await supabase
        .from('v2_budget_lines')
        .insert({
          job_id: jobId,
          cost_code_id: costCodeId,
          budgeted_amount: 0,
          committed_amount: 0,
          change_order_amount: coTotal,
          billed_amount: 0,
          paid_amount: 0,
        });
    }

    logger.info('Recalculated CO amount for cost code', {
      component: 'COSync',
      jobId,
      costCodeId,
      coTotal,
    });

    return coTotal;
  } catch (error) {
    logger.error('Failed to recalculate CO amount', {
      component: 'COSync',
      jobId,
      costCodeId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Recalculate PO totals including change orders
 */
async function recalculatePOWithCOs(poId) {
  try {
    // Get PO with original amount
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .select('id, original_amount')
      .eq('id', poId)
      .single();

    if (poError) throw poError;

    // Get all approved COs for this PO
    const { data: cos, error: coError } = await supabase
      .from('v2_change_orders')
      .select('amount_change')
      .eq('po_id', poId)
      .eq('status', 'approved');

    if (coError) throw coError;

    const coTotal = (cos || [])
      .reduce((sum, co) => sum + parseFloat(co.amount_change || 0), 0);

    const originalAmount = parseFloat(po.original_amount || 0);
    const currentAmount = originalAmount + coTotal;

    // Get current invoiced amount to calculate remaining
    const { data: lineItems } = await supabase
      .from('v2_po_line_items')
      .select('invoiced_amount')
      .eq('po_id', poId);

    const invoicedAmount = (lineItems || [])
      .reduce((sum, li) => sum + parseFloat(li.invoiced_amount || 0), 0);

    const remainingAmount = Math.max(0, currentAmount - invoicedAmount);

    // Update PO
    await supabase
      .from('v2_purchase_orders')
      .update({
        change_order_total: coTotal,
        current_amount: currentAmount,
        remaining_amount: remainingAmount,
      })
      .eq('id', poId);

    logger.info('Recalculated PO with COs', {
      component: 'COSync',
      poId,
      originalAmount,
      coTotal,
      currentAmount,
      remainingAmount,
    });

    return { originalAmount, coTotal, currentAmount, remainingAmount };
  } catch (error) {
    logger.error('Failed to recalculate PO with COs', {
      component: 'COSync',
      poId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Sync CO to budget and PO when status changes
 */
async function syncCOToBudgetAndPO(changeOrderId) {
  try {
    // Get CO with PO and line items
    const { data: co, error: coError } = await supabase
      .from('v2_change_orders')
      .select(`
        id, status, po_id,
        po:v2_purchase_orders(id, job_id),
        line_items:v2_change_order_line_items(cost_code_id)
      `)
      .eq('id', changeOrderId)
      .single();

    if (coError || !co) {
      logger.warn('CO not found for sync', { changeOrderId });
      return;
    }

    if (!co.po?.job_id) {
      logger.warn('CO has no valid PO/job', { changeOrderId });
      return;
    }

    // Get unique cost codes from CO line items
    const costCodeIds = [...new Set(
      (co.line_items || [])
        .map(li => li.cost_code_id)
        .filter(Boolean)
    )];

    // Update budget for each cost code
    for (const costCodeId of costCodeIds) {
      await recalculateCOAmountForCostCode(co.po.job_id, costCodeId);
    }

    // Update PO totals
    await recalculatePOWithCOs(co.po_id);

    logger.info('Synced CO to budget and PO', {
      component: 'COSync',
      changeOrderId,
      poId: co.po_id,
      costCodeCount: costCodeIds.length,
    });
  } catch (error) {
    logger.error('Failed to sync CO', {
      component: 'COSync',
      changeOrderId,
      error: error.message,
    });
  }
}

/**
 * Handle CO approval
 */
async function handleCOApproved(changeOrderId) {
  return syncCOToBudgetAndPO(changeOrderId);
}

/**
 * Handle CO rejection/cancellation
 */
async function handleCORejected(changeOrderId) {
  return syncCOToBudgetAndPO(changeOrderId);
}

/**
 * Recalculate all COs for a job
 * Use this for full reconciliation
 */
async function syncJobCOs(jobId) {
  try {
    // Get all POs for this job
    const { data: pos, error: poError } = await supabase
      .from('v2_purchase_orders')
      .select('id')
      .eq('job_id', jobId)
      .is('deleted_at', null);

    if (poError) throw poError;

    // Get all CO line items for this job's POs
    const { data: coLines, error: coError } = await supabase
      .from('v2_change_order_line_items')
      .select(`
        cost_code_id,
        change_order:v2_change_orders!inner(
          po:v2_purchase_orders!inner(job_id)
        )
      `)
      .eq('change_order.po.job_id', jobId);

    if (coError) throw coError;

    // Get unique cost codes
    const costCodeIds = [...new Set(
      (coLines || [])
        .map(li => li.cost_code_id)
        .filter(Boolean)
    )];

    // Recalculate each cost code
    for (const costCodeId of costCodeIds) {
      await recalculateCOAmountForCostCode(jobId, costCodeId);
    }

    // Recalculate each PO
    for (const po of (pos || [])) {
      await recalculatePOWithCOs(po.id);
    }

    logger.info('Full job CO sync complete', {
      component: 'COSync',
      jobId,
      poCount: (pos || []).length,
      costCodeCount: costCodeIds.length,
    });

    return { posUpdated: (pos || []).length, costCodesUpdated: costCodeIds.length };
  } catch (error) {
    logger.error('Failed to sync job COs', {
      component: 'COSync',
      jobId,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  recalculateCOAmountForCostCode,
  recalculatePOWithCOs,
  syncCOToBudgetAndPO,
  handleCOApproved,
  handleCORejected,
  syncJobCOs,
};
