/**
 * Undo System Module
 * Provides timed undo capability for invoice operations
 */

const { supabase } = require('../config');
const { AppError } = require('./errors');

// Undo window in seconds
const UNDO_WINDOW_SECONDS = 30;

// ============================================================
// UNDO OPERATIONS
// ============================================================

/**
 * Create an undo snapshot before making changes
 * @param {string} entityType - Type of entity ('invoice', 'allocation', etc.)
 * @param {string} entityId - UUID of the entity
 * @param {string} action - Action being performed ('approved', 'edited', 'deleted', etc.)
 * @param {Object} previousState - State before the change
 * @param {string} performedBy - Username performing the action
 * @returns {Promise<Object>} { success: boolean, undoEntry?: Object }
 */
async function createUndoSnapshot(entityType, entityId, action, previousState, performedBy) {
  const expiresAt = new Date(Date.now() + UNDO_WINDOW_SECONDS * 1000);

  // Remove any existing undo entries for this entity (only one undo at a time)
  await supabase
    .from('v2_undo_queue')
    .update({ undone: true })
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('undone', false);

  const { data: undoEntry, error } = await supabase
    .from('v2_undo_queue')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      action,
      previous_state: previousState,
      performed_by: performedBy,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create undo snapshot:', error);
    return { success: false, error: new AppError('DATABASE_ERROR', 'Failed to create undo snapshot') };
  }

  return {
    success: true,
    undoEntry,
    expiresAt,
    remainingMs: UNDO_WINDOW_SECONDS * 1000
  };
}

/**
 * Get available undo entry for an entity
 * @param {string} entityType
 * @param {string} entityId
 * @returns {Promise<Object>} { available: boolean, undoEntry?: Object, remainingMs?: number }
 */
async function getAvailableUndo(entityType, entityId) {
  // Cleanup expired entries first
  await cleanupExpiredUndo();

  const { data: undoEntry } = await supabase
    .from('v2_undo_queue')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .eq('undone', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!undoEntry) {
    return { available: false };
  }

  const remainingMs = new Date(undoEntry.expires_at) - new Date();

  return {
    available: true,
    undoEntry,
    remainingMs,
    expiresAt: undoEntry.expires_at,
    action: undoEntry.action,
    performedBy: undoEntry.performed_by
  };
}

/**
 * Execute an undo operation
 * @param {string} undoId - UUID of the undo entry
 * @param {string} performedBy - Username performing the undo
 * @returns {Promise<Object>} { success: boolean, restoredState?: Object }
 */
async function executeUndo(undoId, performedBy) {
  // Get the undo entry
  const { data: undoEntry, error: getError } = await supabase
    .from('v2_undo_queue')
    .select('*')
    .eq('id', undoId)
    .single();

  if (getError || !undoEntry) {
    return { success: false, error: new AppError('UNDO_NOT_FOUND', 'Undo entry not found') };
  }

  // Check if already undone
  if (undoEntry.undone) {
    return { success: false, error: new AppError('UNDO_NOT_FOUND', 'This action has already been undone') };
  }

  // Check if expired
  if (new Date(undoEntry.expires_at) < new Date()) {
    return { success: false, error: new AppError('UNDO_EXPIRED', 'Undo window has expired') };
  }

  const { entity_type, entity_id, previous_state, action } = undoEntry;

  // Restore the previous state based on entity type
  let restoreResult;
  switch (entity_type) {
    case 'invoice':
      restoreResult = await restoreInvoice(entity_id, previous_state, action);
      break;
    case 'allocation':
      restoreResult = await restoreAllocations(entity_id, previous_state);
      break;
    default:
      return { success: false, error: new AppError('VALIDATION_FAILED', `Unknown entity type: ${entity_type}`) };
  }

  if (!restoreResult.success) {
    return restoreResult;
  }

  // Mark as undone
  await supabase
    .from('v2_undo_queue')
    .update({ undone: true })
    .eq('id', undoId);

  // Log the undo action
  if (entity_type === 'invoice') {
    await logActivity(entity_id, 'undone', performedBy, {
      original_action: action,
      restored_state: previous_state
    });
  }

  return {
    success: true,
    restoredState: previous_state,
    undoneAction: action,
    entityType: entity_type,
    entityId: entity_id
  };
}

/**
 * Restore invoice to previous state
 */
async function restoreInvoice(invoiceId, previousState, originalAction) {
  // Fields that can be restored
  const restorableFields = [
    'status', 'job_id', 'vendor_id', 'po_id', 'invoice_number',
    'invoice_date', 'due_date', 'amount', 'notes',
    'coded_at', 'coded_by', 'approved_at', 'approved_by',
    'denied_at', 'denied_by', 'denial_reason',
    'pdf_stamped_url', 'needs_review', 'review_flags'
  ];

  const updateData = {};
  for (const field of restorableFields) {
    if (previousState.hasOwnProperty(field)) {
      updateData[field] = previousState[field];
    }
  }

  // Special handling for approval undo - need to unstamp PDF
  if (originalAction === 'approved' && previousState.status !== 'approved') {
    updateData.pdf_stamped_url = null;
  }

  const { data, error } = await supabase
    .from('v2_invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .select()
    .single();

  if (error) {
    console.error('Failed to restore invoice:', error);
    return { success: false, error: new AppError('DATABASE_ERROR', 'Failed to restore invoice') };
  }

  // Handle side effects based on original action
  if (originalAction === 'approved') {
    // Reverse budget updates
    await reverseBudgetUpdates(invoiceId, previousState);
  }

  return { success: true, restored: data };
}

/**
 * Restore allocations to previous state
 */
async function restoreAllocations(invoiceId, previousAllocations) {
  // Delete current allocations
  await supabase
    .from('v2_invoice_allocations')
    .delete()
    .eq('invoice_id', invoiceId);

  // Restore previous allocations
  if (previousAllocations && previousAllocations.length > 0) {
    const allocsToInsert = previousAllocations.map(a => ({
      invoice_id: invoiceId,
      cost_code_id: a.cost_code_id,
      amount: a.amount,
      notes: a.notes
    }));

    const { error } = await supabase
      .from('v2_invoice_allocations')
      .insert(allocsToInsert);

    if (error) {
      console.error('Failed to restore allocations:', error);
      return { success: false, error: new AppError('DATABASE_ERROR', 'Failed to restore allocations') };
    }
  }

  return { success: true };
}

/**
 * Reverse budget updates when undoing approval
 */
async function reverseBudgetUpdates(invoiceId, previousState) {
  // Get invoice with allocations
  const { data: invoice } = await supabase
    .from('v2_invoices')
    .select(`
      job_id,
      po_id,
      allocations:v2_invoice_allocations(amount, cost_code_id)
    `)
    .eq('id', invoiceId)
    .single();

  if (!invoice?.allocations || !invoice.job_id) return;

  // Reverse billed_amount in budget lines
  for (const alloc of invoice.allocations) {
    if (!alloc.cost_code_id) continue;

    const { data: budgetLine } = await supabase
      .from('v2_budget_lines')
      .select('id, billed_amount')
      .eq('job_id', invoice.job_id)
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

  // Reverse PO line items if applicable
  if (invoice.po_id) {
    for (const alloc of invoice.allocations) {
      if (!alloc.cost_code_id) continue;

      const { data: poLineItem } = await supabase
        .from('v2_po_line_items')
        .select('id, invoiced_amount')
        .eq('po_id', invoice.po_id)
        .eq('cost_code_id', alloc.cost_code_id)
        .single();

      if (poLineItem) {
        const newInvoiced = Math.max(0, (parseFloat(poLineItem.invoiced_amount) || 0) - parseFloat(alloc.amount));
        await supabase
          .from('v2_po_line_items')
          .update({ invoiced_amount: newInvoiced })
          .eq('id', poLineItem.id);
      }
    }
  }
}

/**
 * Cleanup expired undo entries
 */
async function cleanupExpiredUndo() {
  const { data, error } = await supabase
    .from('v2_undo_queue')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .eq('undone', false)
    .select();

  if (error) {
    console.error('Failed to cleanup expired undo entries:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Log activity helper
 */
async function logActivity(invoiceId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_invoice_activity').insert({
      invoice_id: invoiceId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
}

/**
 * Get recent undo entries for a user
 */
async function getRecentUndos(performedBy, limit = 10) {
  await cleanupExpiredUndo();

  const { data } = await supabase
    .from('v2_undo_queue')
    .select('*')
    .eq('performed_by', performedBy)
    .eq('undone', false)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  return (data || []).map(u => ({
    ...u,
    remainingMs: new Date(u.expires_at) - new Date()
  }));
}

module.exports = {
  createUndoSnapshot,
  getAvailableUndo,
  executeUndo,
  cleanupExpiredUndo,
  getRecentUndos,
  UNDO_WINDOW_SECONDS
};
