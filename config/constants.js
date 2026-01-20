/**
 * Centralized Configuration Constants
 * All timing, upload, and system-wide constants in one place
 */

// ============================================================
// TIMING CONSTANTS
// ============================================================

// Entity locking - how long before a lock expires
const LOCK_DURATION_MINUTES = 5;

// Undo system - how long users have to undo an action
const UNDO_WINDOW_SECONDS = 30;

// SSE heartbeat interval in milliseconds
const SSE_HEARTBEAT_MS = 30000;

// Cache TTL for price intelligence naming conventions
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================
// UPLOAD CONSTANTS
// ============================================================

// Maximum file upload size in bytes (50MB)
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

// Signed URL expiry time in seconds (1 hour)
const SIGNED_URL_EXPIRY_SECONDS = 3600;

// ============================================================
// INVOICE STATUS CONSTANTS
// ============================================================

const INVOICE_STATUS = {
  RECEIVED: 'received',
  NEEDS_APPROVAL: 'needs_approval',
  APPROVED: 'approved',
  IN_DRAW: 'in_draw',
  PAID: 'paid',
  DENIED: 'denied'
};

// Valid status transitions
const VALID_TRANSITIONS = {
  received: ['needs_approval', 'denied'],
  needs_approval: ['approved', 'denied', 'received'],
  approved: ['in_draw', 'needs_approval'],
  in_draw: ['paid', 'approved'],
  paid: [], // Terminal state
  denied: ['received'] // Can be reconsidered
};

// ============================================================
// PURCHASE ORDER STATUS CONSTANTS
// ============================================================

const PO_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
};

const PO_STATUS_DETAIL = {
  PENDING: 'pending',
  APPROVED: 'approved',
  ACTIVE: 'active',
  CLOSED: 'closed',
  CANCELLED: 'cancelled'
};

// ============================================================
// DRAW STATUS CONSTANTS
// ============================================================

const DRAW_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  FUNDED: 'funded'
};

// ============================================================
// RETAINAGE
// ============================================================

const DEFAULT_RETAINAGE_PERCENT = 10;

module.exports = {
  // Timing
  LOCK_DURATION_MINUTES,
  UNDO_WINDOW_SECONDS,
  SSE_HEARTBEAT_MS,
  PRICE_CACHE_TTL_MS,

  // Upload
  MAX_FILE_SIZE_BYTES,
  SIGNED_URL_EXPIRY_SECONDS,

  // Status constants
  INVOICE_STATUS,
  VALID_TRANSITIONS,
  PO_STATUS,
  PO_STATUS_DETAIL,
  DRAW_STATUS,

  // Other
  DEFAULT_RETAINAGE_PERCENT
};
