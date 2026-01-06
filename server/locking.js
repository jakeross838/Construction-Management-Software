/**
 * Entity Locking Module
 * Prevent concurrent editing conflicts with timed locks
 */

const { supabase } = require('../config');
const { AppError, lockedError } = require('./errors');

// Lock duration in minutes
const LOCK_DURATION_MINUTES = 5;

// ============================================================
// LOCK OPERATIONS
// ============================================================

/**
 * Attempt to acquire a lock on an entity
 * @param {string} entityType - Type of entity ('invoice', 'vendor', etc.)
 * @param {string} entityId - UUID of the entity
 * @param {string} lockedBy - Username of who is acquiring the lock
 * @returns {Promise<Object>} { success: boolean, lock?: Object, error?: AppError }
 */
async function acquireLock(entityType, entityId, lockedBy) {
  // First, cleanup any expired locks
  await cleanupExpiredLocks();

  // Check for existing lock
  const { data: existingLock } = await supabase
    .from('v2_entity_locks')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .single();

  if (existingLock) {
    // Check if it's our own lock (allow refresh)
    if (existingLock.locked_by === lockedBy) {
      // Refresh the lock
      const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
      const { data: refreshed, error } = await supabase
        .from('v2_entity_locks')
        .update({ expires_at: expiresAt.toISOString(), locked_at: new Date().toISOString() })
        .eq('id', existingLock.id)
        .select()
        .single();

      if (error) {
        return { success: false, error: new AppError('DATABASE_ERROR', 'Failed to refresh lock') };
      }

      return { success: true, lock: refreshed, refreshed: true };
    }

    // Someone else has the lock
    return {
      success: false,
      error: lockedError(existingLock.locked_by, existingLock.expires_at),
      existingLock
    };
  }

  // Create new lock
  const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
  const { data: newLock, error } = await supabase
    .from('v2_entity_locks')
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      locked_by: lockedBy,
      expires_at: expiresAt.toISOString()
    })
    .select()
    .single();

  if (error) {
    // Possible race condition - someone else got the lock first
    if (error.code === '23505') { // Unique constraint violation
      const { data: raceLock } = await supabase
        .from('v2_entity_locks')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .single();

      if (raceLock) {
        return {
          success: false,
          error: lockedError(raceLock.locked_by, raceLock.expires_at),
          existingLock: raceLock
        };
      }
    }
    return { success: false, error: new AppError('DATABASE_ERROR', 'Failed to create lock') };
  }

  return { success: true, lock: newLock, created: true };
}

/**
 * Release a lock on an entity
 * @param {string} lockId - UUID of the lock to release
 * @param {string} releasedBy - Username releasing the lock (must match locked_by)
 * @returns {Promise<Object>} { success: boolean, error?: AppError }
 */
async function releaseLock(lockId, releasedBy) {
  // Get the lock first to verify ownership
  const { data: lock } = await supabase
    .from('v2_entity_locks')
    .select('*')
    .eq('id', lockId)
    .single();

  if (!lock) {
    return { success: false, error: new AppError('LOCK_NOT_FOUND', 'Lock not found') };
  }

  // Only the lock owner can release (or admin)
  if (lock.locked_by !== releasedBy) {
    return {
      success: false,
      error: new AppError('VALIDATION_FAILED', 'Only the lock owner can release it')
    };
  }

  const { error } = await supabase
    .from('v2_entity_locks')
    .delete()
    .eq('id', lockId);

  if (error) {
    return { success: false, error: new AppError('DATABASE_ERROR', 'Failed to release lock') };
  }

  return { success: true };
}

/**
 * Release a lock by entity (not lock ID)
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} releasedBy
 * @returns {Promise<Object>}
 */
async function releaseLockByEntity(entityType, entityId, releasedBy) {
  const { data: lock } = await supabase
    .from('v2_entity_locks')
    .select('id, locked_by')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .single();

  if (!lock) {
    return { success: true }; // No lock to release
  }

  if (lock.locked_by !== releasedBy) {
    return {
      success: false,
      error: new AppError('VALIDATION_FAILED', 'Only the lock owner can release it')
    };
  }

  return releaseLock(lock.id, releasedBy);
}

/**
 * Check if an entity is locked
 * @param {string} entityType
 * @param {string} entityId
 * @returns {Promise<Object>} { isLocked: boolean, lock?: Object }
 */
async function checkLock(entityType, entityId) {
  // Cleanup expired locks first
  await cleanupExpiredLocks();

  const { data: lock } = await supabase
    .from('v2_entity_locks')
    .select('*')
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .single();

  if (lock) {
    return {
      isLocked: true,
      lock: {
        id: lock.id,
        lockedBy: lock.locked_by,
        lockedAt: lock.locked_at,
        expiresAt: lock.expires_at,
        remainingMs: new Date(lock.expires_at) - new Date()
      }
    };
  }

  return { isLocked: false };
}

/**
 * Force release a lock (admin operation)
 * @param {string} entityType
 * @param {string} entityId
 * @param {string} adminUser
 * @returns {Promise<Object>}
 */
async function forceReleaseLock(entityType, entityId, adminUser) {
  const { data: lock, error } = await supabase
    .from('v2_entity_locks')
    .delete()
    .eq('entity_type', entityType)
    .eq('entity_id', entityId)
    .select()
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
    return { success: false, error: new AppError('DATABASE_ERROR', 'Failed to force release lock') };
  }

  // Log the force release
  if (lock) {
    console.log(`[LOCK] Force released: ${entityType}/${entityId} by ${adminUser} (was locked by ${lock.locked_by})`);
  }

  return { success: true, wasLocked: !!lock };
}

/**
 * Cleanup all expired locks
 * @returns {Promise<number>} Number of locks cleaned up
 */
async function cleanupExpiredLocks() {
  const { data, error } = await supabase
    .from('v2_entity_locks')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select();

  if (error) {
    console.error('Failed to cleanup expired locks:', error);
    return 0;
  }

  if (data && data.length > 0) {
    console.log(`[LOCK] Cleaned up ${data.length} expired lock(s)`);
  }

  return data?.length || 0;
}

/**
 * Get all active locks (admin/debugging)
 * @returns {Promise<Array>}
 */
async function getAllLocks() {
  await cleanupExpiredLocks();

  const { data, error } = await supabase
    .from('v2_entity_locks')
    .select('*')
    .order('locked_at', { ascending: false });

  if (error) {
    console.error('Failed to get locks:', error);
    return [];
  }

  return data || [];
}

/**
 * Middleware to check lock before editing
 * Attach to routes that modify entities
 */
function requireLock(entityType, getEntityId) {
  return async (req, res, next) => {
    const entityId = typeof getEntityId === 'function' ? getEntityId(req) : req.params[getEntityId || 'id'];
    const user = req.body.performed_by || req.body.locked_by || 'unknown';

    const lockCheck = await checkLock(entityType, entityId);

    if (lockCheck.isLocked && lockCheck.lock.lockedBy !== user) {
      return res.status(409).json(lockedError(lockCheck.lock.lockedBy, lockCheck.lock.expiresAt).toJSON());
    }

    // Attach lock info to request
    req.entityLock = lockCheck;
    next();
  };
}

module.exports = {
  acquireLock,
  releaseLock,
  releaseLockByEntity,
  checkLock,
  forceReleaseLock,
  cleanupExpiredLocks,
  getAllLocks,
  requireLock,
  LOCK_DURATION_MINUTES
};
