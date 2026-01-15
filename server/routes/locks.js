/**
 * Locks Routes
 * Entity locking endpoints for concurrent edit prevention
 */

const express = require('express');
const router = express.Router();
const { AppError, asyncHandler } = require('../errors');
const {
  acquireLock,
  releaseLock,
  releaseLockByEntity,
  checkLock
} = require('../locking');

// Acquire lock
router.post('/acquire', asyncHandler(async (req, res) => {
  const { entity_type, entity_id, locked_by } = req.body;

  if (!entity_type || !entity_id || !locked_by) {
    throw new AppError('VALIDATION_FAILED', 'entity_type, entity_id, and locked_by are required');
  }

  const result = await acquireLock(entity_type, entity_id, locked_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({
    success: true,
    lock: result.lock,
    refreshed: result.refreshed || false,
    created: result.created || false
  });
}));

// Release lock by ID
router.delete('/:lockId', asyncHandler(async (req, res) => {
  const { lockId } = req.params;
  const { released_by } = req.body;

  const result = await releaseLock(lockId, released_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({ success: true });
}));

// Check lock status
router.get('/check/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const result = await checkLock(entityType, entityId);
  res.json(result);
}));

// Release lock by entity
router.delete('/entity/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const { released_by } = req.body;

  const result = await releaseLockByEntity(entityType, entityId, released_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({ success: true });
}));

module.exports = router;

