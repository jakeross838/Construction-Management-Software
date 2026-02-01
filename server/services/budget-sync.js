/**
 * Budget Sync Service
 * Ensures PO/CO changes are properly reflected in budget committed amounts
 */

const { supabase } = require('../../config');
const logger = require('../utils/logger');

/**
 * Recalculate committed amount for a specific cost code in a job
 * Sums all PO line items + approved CO line items for that cost code
 */
async function recalculateCommittedForCostCode(jobId, costCodeId) {
  if (!jobId || !costCodeId) {
    logger.warn('Missing jobId or costCodeId in recalculateCommittedForCostCode');
    return null;
  }

  try {
    // Get all active PO line items for this job/cost code
    const { data: poLineItems, error: poError } = await supabase
      .from('v2_po_line_items')
      .select(`
        amount,
        po:v2_purchase_orders!inner(id, job_id, status, deleted_at)
      `)
      .eq('cost_code_id', costCodeId)
      .is('po.deleted_at', null)
      .neq('po.status', 'cancelled');

    if (poError) throw poError;

    // Filter to only this job's POs and sum
    const poTotal = (poLineItems || [])
      .filter(li => li.po?.job_id === jobId)
      .reduce((sum, li) => sum + parseFloat(li.amount || 0), 0);

    // Get approved CO line items for this job/cost code
    const { data: coLineItems, error: coError } = await supabase
      .from('v2_change_order_line_items')
      .select(`
        amount,
        change_order:v2_po_change_orders!inner(
          id,
          status,
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

    const totalCommitted = poTotal + coTotal;

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
        .update({ committed_amount: totalCommitted })
        .eq('id', budgetLine.id);
    } else {
      // Create budget line if it doesn't exist
      await supabase
        .from('v2_budget_lines')
        .insert({
          job_id: jobId,
          cost_code_id: costCodeId,
          budgeted_amount: 0,
          committed_amount: totalCommitted,
          billed_amount: 0,
          paid_amount: 0,
        });
    }

    logger.info('Recalculated committed amount', {
      component: 'BudgetSync',
      jobId,
      costCodeId,
      poTotal,
      coTotal,
      totalCommitted,
    });

    return totalCommitted;
  } catch (error) {
    logger.error('Failed to recalculate committed amount', {
      component: 'BudgetSync',
      jobId,
      costCodeId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Sync all cost codes affected by a PO
 */
async function syncPOToBudget(poId) {
  try {
    // Get PO with job and line items
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .select(`
        id, job_id, status,
        line_items:v2_po_line_items(cost_code_id)
      `)
      .eq('id', poId)
      .single();

    if (poError || !po) {
      logger.warn('PO not found for budget sync', { poId });
      return;
    }

    // Get unique cost codes
    const costCodeIds = [...new Set(
      (po.line_items || [])
        .map(li => li.cost_code_id)
        .filter(Boolean)
    )];

    // Recalculate each cost code
    for (const costCodeId of costCodeIds) {
      await recalculateCommittedForCostCode(po.job_id, costCodeId);
    }

    logger.info('Synced PO to budget', {
      component: 'BudgetSync',
      poId,
      costCodeCount: costCodeIds.length,
    });
  } catch (error) {
    logger.error('Failed to sync PO to budget', {
      component: 'BudgetSync',
      poId,
      error: error.message,
    });
  }
}

/**
 * Sync CO to budget when approved/unapproved
 */
async function syncCOToBudget(changeOrderId) {
  try {
    // Get CO with PO job and line items
    const { data: co, error: coError } = await supabase
      .from('v2_po_change_orders')
      .select(`
        id, status,
        po:v2_purchase_orders(id, job_id),
        line_items:v2_change_order_line_items(cost_code_id)
      `)
      .eq('id', changeOrderId)
      .single();

    if (coError || !co?.po?.job_id) {
      logger.warn('CO or PO not found for budget sync', { changeOrderId });
      return;
    }

    // Get unique cost codes
    const costCodeIds = [...new Set(
      (co.line_items || [])
        .map(li => li.cost_code_id)
        .filter(Boolean)
    )];

    // Recalculate each cost code
    for (const costCodeId of costCodeIds) {
      await recalculateCommittedForCostCode(co.po.job_id, costCodeId);
    }

    logger.info('Synced CO to budget', {
      component: 'BudgetSync',
      changeOrderId,
      costCodeCount: costCodeIds.length,
    });
  } catch (error) {
    logger.error('Failed to sync CO to budget', {
      component: 'BudgetSync',
      changeOrderId,
      error: error.message,
    });
  }
}

/**
 * Recalculate all committed amounts for a job
 * Use this for full reconciliation
 */
async function syncJobBudget(jobId) {
  try {
    // Get all cost codes used in POs for this job
    const { data: poLines, error: poError } = await supabase
      .from('v2_po_line_items')
      .select(`
        cost_code_id,
        po:v2_purchase_orders!inner(job_id, deleted_at, status)
      `)
      .eq('po.job_id', jobId)
      .is('po.deleted_at', null)
      .neq('po.status', 'cancelled');

    if (poError) throw poError;

    // Get all cost codes used in COs for this job
    const { data: coLines, error: coError } = await supabase
      .from('v2_change_order_line_items')
      .select(`
        cost_code_id,
        change_order:v2_po_change_orders!inner(
          po:v2_purchase_orders!inner(job_id, deleted_at)
        )
      `)
      .eq('change_order.po.job_id', jobId)
      .is('change_order.po.deleted_at', null);

    if (coError) throw coError;

    // Combine all cost codes
    const allCostCodes = new Set([
      ...(poLines || []).map(li => li.cost_code_id),
      ...(coLines || []).map(li => li.cost_code_id),
    ].filter(Boolean));

    // Recalculate each
    for (const costCodeId of allCostCodes) {
      await recalculateCommittedForCostCode(jobId, costCodeId);
    }

    logger.info('Full job budget sync complete', {
      component: 'BudgetSync',
      jobId,
      costCodeCount: allCostCodes.size,
    });

    return { synced: allCostCodes.size };
  } catch (error) {
    logger.error('Failed to sync job budget', {
      component: 'BudgetSync',
      jobId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Handle PO cancellation - remove all commitments
 */
async function handlePOCancelled(poId) {
  return syncPOToBudget(poId);
}

/**
 * Handle PO line item changes
 */
async function handlePOLineItemChange(poId, costCodeId) {
  try {
    const { data: po } = await supabase
      .from('v2_purchase_orders')
      .select('job_id')
      .eq('id', poId)
      .single();

    if (po?.job_id && costCodeId) {
      await recalculateCommittedForCostCode(po.job_id, costCodeId);
    }
  } catch (error) {
    logger.error('Failed to handle PO line item change', {
      component: 'BudgetSync',
      poId,
      costCodeId,
      error: error.message,
    });
  }
}

module.exports = {
  recalculateCommittedForCostCode,
  syncPOToBudget,
  syncCOToBudget,
  syncJobBudget,
  handlePOCancelled,
  handlePOLineItemChange,
};
