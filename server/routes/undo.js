/**
 * Undo Routes
 * Undo system endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler, notFoundError } = require('../errors');
const { getAvailableUndo, executeUndo } = require('../undo');
const { broadcastInvoiceUpdate } = require('../realtime');

// Check if undo is available
router.get('/available/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const result = await getAvailableUndo(entityType, entityId);
  res.json(result);
}));

// Execute undo for invoice
router.post('/invoices/:id', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { performed_by: performedBy = 'System' } = req.body;

  // Get available undo
  const undoInfo = await getAvailableUndo('invoice', invoiceId);
  if (!undoInfo.available) {
    throw new AppError('UNDO_NOT_FOUND', 'No undo available for this invoice');
  }

  // Execute undo
  const result = await executeUndo(undoInfo.undoEntry.id, performedBy);
  if (!result.success) {
    throw result.error;
  }

  // Get updated invoice
  const { data: updated } = await supabase
    .from('v2_invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  broadcastInvoiceUpdate(updated, 'undone', performedBy);

  res.json({
    success: true,
    invoice: updated,
    undoneAction: result.undoneAction,
    restoredState: result.restoredState
  });
}));

module.exports = router;

