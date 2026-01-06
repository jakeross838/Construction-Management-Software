/**
 * Error Handling Module
 * Structured error codes with retry information and consistent API responses
 */

// ============================================================
// CUSTOM ERROR CLASS
// ============================================================

class AppError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // Get error config from ERROR_CODES
    const config = ERROR_CODES[code] || ERROR_CODES.UNKNOWN_ERROR;
    this.status = config.status;
    this.retry = config.retry;
    this.retryAfter = config.retryAfter;
  }

  toJSON() {
    return {
      error: true,
      code: this.code,
      message: this.message,
      details: this.details,
      retry: this.retry,
      retryAfter: this.retryAfter,
      timestamp: this.timestamp
    };
  }
}

// ============================================================
// ERROR CODES CONFIGURATION
// ============================================================

const ERROR_CODES = {
  // Validation Errors (400)
  VALIDATION_FAILED: {
    status: 400,
    retry: false,
    description: 'Input validation failed'
  },
  INVALID_TRANSITION: {
    status: 400,
    retry: false,
    description: 'Status transition not allowed'
  },
  DUPLICATE_INVOICE: {
    status: 400,
    retry: false,
    description: 'Duplicate invoice detected'
  },
  ALLOCATIONS_UNBALANCED: {
    status: 400,
    retry: false,
    description: 'Allocation amounts do not match invoice total'
  },
  MISSING_REQUIRED_FIELD: {
    status: 400,
    retry: false,
    description: 'Required field is missing'
  },
  INVALID_FIELD_VALUE: {
    status: 400,
    retry: false,
    description: 'Field value is invalid'
  },
  PRE_TRANSITION_FAILED: {
    status: 400,
    retry: false,
    description: 'Pre-transition requirements not met'
  },

  // Not Found Errors (404)
  INVOICE_NOT_FOUND: {
    status: 404,
    retry: false,
    description: 'Invoice not found'
  },
  JOB_NOT_FOUND: {
    status: 404,
    retry: false,
    description: 'Job not found'
  },
  VENDOR_NOT_FOUND: {
    status: 404,
    retry: false,
    description: 'Vendor not found'
  },
  PO_NOT_FOUND: {
    status: 404,
    retry: false,
    description: 'Purchase order not found'
  },
  DRAW_NOT_FOUND: {
    status: 404,
    retry: false,
    description: 'Draw not found'
  },
  UNDO_NOT_FOUND: {
    status: 404,
    retry: false,
    description: 'No undo entry available'
  },
  LOCK_NOT_FOUND: {
    status: 404,
    retry: false,
    description: 'Lock not found'
  },

  // Conflict Errors (409)
  ENTITY_LOCKED: {
    status: 409,
    retry: true,
    retryAfter: 5000,
    description: 'Entity is locked by another user'
  },
  VERSION_CONFLICT: {
    status: 409,
    retry: false,
    description: 'Data has been modified by another user'
  },
  UNDO_EXPIRED: {
    status: 409,
    retry: false,
    description: 'Undo window has expired'
  },
  ALREADY_IN_DRAW: {
    status: 409,
    retry: false,
    description: 'Invoice is already in a draw'
  },
  DRAW_FUNDED: {
    status: 409,
    retry: false,
    description: 'Cannot modify funded draw'
  },

  // Server Errors (500)
  AI_EXTRACTION_FAILED: {
    status: 500,
    retry: true,
    retryAfter: 2000,
    description: 'AI invoice extraction failed'
  },
  PDF_STAMP_FAILED: {
    status: 500,
    retry: true,
    retryAfter: 1000,
    description: 'PDF stamping failed'
  },
  PDF_UNSTAMP_FAILED: {
    status: 500,
    retry: true,
    retryAfter: 1000,
    description: 'PDF unstamping failed'
  },
  STORAGE_UPLOAD_FAILED: {
    status: 500,
    retry: true,
    retryAfter: 3000,
    description: 'File storage upload failed'
  },
  STORAGE_DOWNLOAD_FAILED: {
    status: 500,
    retry: true,
    retryAfter: 3000,
    description: 'File storage download failed'
  },
  DATABASE_ERROR: {
    status: 500,
    retry: true,
    retryAfter: 1000,
    description: 'Database operation failed'
  },
  UNKNOWN_ERROR: {
    status: 500,
    retry: true,
    retryAfter: 1000,
    description: 'An unexpected error occurred'
  }
};

// ============================================================
// ERROR HELPERS
// ============================================================

/**
 * Create validation error with field details
 */
function validationError(errors) {
  return new AppError('VALIDATION_FAILED', 'Validation failed', {
    fields: errors
  });
}

/**
 * Create transition error
 */
function transitionError(currentStatus, newStatus, reason) {
  return new AppError('INVALID_TRANSITION', reason || `Cannot transition from ${currentStatus} to ${newStatus}`, {
    currentStatus,
    newStatus
  });
}

/**
 * Create duplicate error
 */
function duplicateError(existingInvoice) {
  return new AppError('DUPLICATE_INVOICE', 'Duplicate invoice detected', {
    existingId: existingInvoice.id,
    existingStatus: existingInvoice.status,
    existingAmount: existingInvoice.amount
  });
}

/**
 * Create locked error
 */
function lockedError(lockedBy, expiresAt) {
  return new AppError('ENTITY_LOCKED', `Locked by ${lockedBy}`, {
    lockedBy,
    expiresAt
  });
}

/**
 * Create version conflict error
 */
function versionConflictError(expectedVersion, actualVersion, serverData) {
  return new AppError('VERSION_CONFLICT', 'Data has been modified', {
    expectedVersion,
    actualVersion,
    serverData
  });
}

/**
 * Create not found error
 */
function notFoundError(entityType, entityId) {
  const codeMap = {
    invoice: 'INVOICE_NOT_FOUND',
    job: 'JOB_NOT_FOUND',
    vendor: 'VENDOR_NOT_FOUND',
    po: 'PO_NOT_FOUND',
    draw: 'DRAW_NOT_FOUND'
  };
  const code = codeMap[entityType] || 'INVOICE_NOT_FOUND';
  return new AppError(code, `${entityType} not found`, { entityId });
}

// ============================================================
// EXPRESS ERROR MIDDLEWARE
// ============================================================

/**
 * Error handling middleware for Express
 * Place at end of middleware chain
 */
function errorMiddleware(err, req, res, next) {
  // Log error
  console.error(`[${new Date().toISOString()}] Error:`, err.message);
  if (err.stack && process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  // Handle AppError
  if (err instanceof AppError) {
    return res.status(err.status).json(err.toJSON());
  }

  // Handle Supabase/database errors
  if (err.code && typeof err.code === 'string' && err.code.startsWith('PGRST')) {
    return res.status(400).json({
      error: true,
      code: 'DATABASE_ERROR',
      message: err.message,
      details: { pgCode: err.code },
      retry: true,
      retryAfter: 1000
    });
  }

  // Handle generic errors
  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    error: true,
    code: 'UNKNOWN_ERROR',
    message: isProduction ? 'An unexpected error occurred' : err.message,
    details: isProduction ? {} : { stack: err.stack },
    retry: true,
    retryAfter: 1000
  });
}

/**
 * Async route wrapper to catch errors
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  ERROR_CODES,
  validationError,
  transitionError,
  duplicateError,
  lockedError,
  versionConflictError,
  notFoundError,
  errorMiddleware,
  asyncHandler
};
