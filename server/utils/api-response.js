/**
 * API Response Standardization Utility
 * Provides consistent response formats across all endpoints
 */

/**
 * Error codes enum for consistent error handling across the API
 * @enum {string}
 */
const ErrorCodes = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE: 'DUPLICATE',
  LOCKED: 'LOCKED',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors (5xx)
  SERVER_ERROR: 'SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Business logic errors
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  PO_CLOSED: 'PO_CLOSED',
  INVOICE_ALREADY_PAID: 'INVOICE_ALREADY_PAID',
  DRAW_ALREADY_FUNDED: 'DRAW_ALREADY_FUNDED'
};

/**
 * Standard success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data (object, array, or primitive)
 * @param {Object} [meta={}] - Optional metadata (timestamps, counts, etc.)
 * @returns {Object} Express response
 * @example
 * success(res, { id: 1, name: 'Job' });
 * success(res, invoices, { count: invoices.length });
 */
function success(res, data, meta = {}) {
  const response = {
    success: true,
    data
  };

  if (Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return res.status(200).json(response);
}

/**
 * Standard error response
 * @param {Object} res - Express response object
 * @param {string} code - Error code from ErrorCodes enum
 * @param {string} message - Human-readable error message
 * @param {Object} [details={}] - Additional error details (field errors, constraints, etc.)
 * @param {number} [status=400] - HTTP status code
 * @returns {Object} Express response
 * @example
 * error(res, ErrorCodes.NOT_FOUND, 'Invoice not found', { id: '123' }, 404);
 * error(res, ErrorCodes.VALIDATION_FAILED, 'Invalid amount', { field: 'amount', reason: 'must be positive' });
 */
function error(res, code, message, details = {}, status = 400) {
  const response = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (Object.keys(details).length > 0) {
    response.error.details = details;
  }

  return res.status(status).json(response);
}

/**
 * Paginated list response with metadata
 * @param {Object} res - Express response object
 * @param {Array} data - Array of items for current page
 * @param {number} page - Current page number (1-indexed)
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items across all pages
 * @returns {Object} Express response
 * @example
 * paginated(res, invoices, 1, 50, 150);
 * // Returns: { success: true, data: [...], meta: { page: 1, limit: 50, total: 150, totalPages: 3, hasMore: true } }
 */
function paginated(res, data, page, limit, total) {
  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    success: true,
    data,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages
    }
  });
}

/**
 * Created response (HTTP 201)
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @returns {Object} Express response
 * @example
 * created(res, { id: 'new-uuid', name: 'New Invoice' });
 */
function created(res, data) {
  return res.status(201).json({
    success: true,
    data
  });
}

/**
 * No content response (HTTP 204)
 * Used for successful operations that don't return data (e.g., DELETE)
 * @param {Object} res - Express response object
 * @returns {Object} Express response
 * @example
 * noContent(res); // Returns empty 204 response
 */
function noContent(res) {
  return res.status(204).send();
}

// ----- Convenience helpers (use the base functions internally) -----

/**
 * Not found error response (HTTP 404)
 * @param {Object} res - Express response object
 * @param {string} resource - Resource type that wasn't found
 * @param {string} [id] - Resource identifier
 * @returns {Object} Express response
 * @example
 * notFound(res, 'Invoice', 'abc-123');
 */
function notFound(res, resource, id) {
  return error(res, ErrorCodes.NOT_FOUND, `${resource} not found`, id ? { resource, id } : { resource }, 404);
}

/**
 * Validation error response (HTTP 400)
 * @param {Object} res - Express response object
 * @param {Array|Object} errors - Validation errors
 * @returns {Object} Express response
 * @example
 * validationError(res, [{ field: 'amount', message: 'Required' }]);
 * validationError(res, { field: 'email', message: 'Invalid format' });
 */
function validationError(res, errors) {
  return error(
    res,
    ErrorCodes.VALIDATION_FAILED,
    'Validation failed',
    { errors: Array.isArray(errors) ? errors : [errors] },
    400
  );
}

/**
 * Unauthorized error response (HTTP 401)
 * @param {Object} res - Express response object
 * @param {string} [message='Unauthorized'] - Custom message
 * @returns {Object} Express response
 */
function unauthorized(res, message = 'Unauthorized') {
  return error(res, ErrorCodes.UNAUTHORIZED, message, {}, 401);
}

/**
 * Forbidden error response (HTTP 403)
 * @param {Object} res - Express response object
 * @param {string} [message='Access denied'] - Custom message
 * @returns {Object} Express response
 */
function forbidden(res, message = 'Access denied') {
  return error(res, ErrorCodes.FORBIDDEN, message, {}, 403);
}

/**
 * Conflict error response (HTTP 409)
 * @param {Object} res - Express response object
 * @param {string} message - Conflict description
 * @param {Object} [details={}] - Conflict details
 * @returns {Object} Express response
 * @example
 * conflict(res, 'Invoice number already exists', { invoiceNumber: 'INV-001' });
 */
function conflict(res, message, details = {}) {
  return error(res, ErrorCodes.CONFLICT, message, details, 409);
}

/**
 * Server error response (HTTP 500)
 * @param {Object} res - Express response object
 * @param {string} [message='Internal server error'] - Error message
 * @returns {Object} Express response
 */
function serverError(res, message = 'Internal server error') {
  return error(res, ErrorCodes.SERVER_ERROR, message, {}, 500);
}

/**
 * Express middleware to add response helpers to res object
 * Attach to Express app: app.use(responseHelpers);
 * Then use: res.apiSuccess(data), res.apiError(code, message), etc.
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function responseHelpers(req, res, next) {
  res.apiSuccess = (data, meta) => success(res, data, meta);
  res.apiError = (code, message, details, status) => error(res, code, message, details, status);
  res.apiPaginated = (data, page, limit, total) => paginated(res, data, page, limit, total);
  res.apiCreated = (data) => created(res, data);
  res.apiNoContent = () => noContent(res);
  res.apiNotFound = (resource, id) => notFound(res, resource, id);
  res.apiValidationError = (errors) => validationError(res, errors);
  res.apiUnauthorized = (message) => unauthorized(res, message);
  res.apiForbidden = (message) => forbidden(res, message);
  res.apiConflict = (message, details) => conflict(res, message, details);
  res.apiServerError = (message) => serverError(res, message);
  next();
}

module.exports = {
  // Core functions (as specified in requirements)
  success,
  error,
  paginated,
  created,
  noContent,

  // Convenience helpers
  notFound,
  validationError,
  unauthorized,
  forbidden,
  conflict,
  serverError,

  // Middleware
  responseHelpers,

  // Error codes enum
  ErrorCodes
};
