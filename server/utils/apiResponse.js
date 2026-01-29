/**
 * API Response Standardization Utility
 * Provides consistent response formats across all endpoints
 */

/**
 * Standard success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {Object} options - Additional options
 * @param {string} options.message - Optional success message
 * @param {Object} options.meta - Optional metadata (pagination, etc.)
 * @param {number} options.status - HTTP status code (default: 200)
 */
function success(res, data, options = {}) {
  const { message, meta, status = 200 } = options;

  const response = {
    success: true,
    data
  };

  if (message) {
    response.message = message;
  }

  if (meta) {
    response.meta = meta;
  }

  return res.status(status).json(response);
}

/**
 * Standard created response (201)
 * @param {Object} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} message - Optional message
 */
function created(res, data, message = 'Resource created successfully') {
  return success(res, data, { status: 201, message });
}

/**
 * Standard error response
 * @param {Object} res - Express response object
 * @param {string} error - Error message
 * @param {Object} options - Additional options
 * @param {number} options.status - HTTP status code (default: 400)
 * @param {string} options.code - Error code for client handling
 * @param {*} options.details - Additional error details
 */
function error(res, errorMessage, options = {}) {
  const { status = 400, code, details } = options;

  const response = {
    success: false,
    error: errorMessage
  };

  if (code) {
    response.code = code;
  }

  if (details) {
    response.details = details;
  }

  return res.status(status).json(response);
}

/**
 * Standard not found response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource type that wasn't found
 * @param {string} id - Resource identifier
 */
function notFound(res, resource, id) {
  return error(res, `${resource} not found`, {
    status: 404,
    code: 'NOT_FOUND',
    details: { resource, id }
  });
}

/**
 * Standard validation error response
 * @param {Object} res - Express response object
 * @param {Array|Object} errors - Validation errors
 */
function validationError(res, errors) {
  return error(res, 'Validation failed', {
    status: 400,
    code: 'VALIDATION_FAILED',
    details: Array.isArray(errors) ? errors : [errors]
  });
}

/**
 * Standard unauthorized response
 * @param {Object} res - Express response object
 * @param {string} message - Optional custom message
 */
function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, {
    status: 401,
    code: 'UNAUTHORIZED'
  });
}

/**
 * Standard forbidden response
 * @param {Object} res - Express response object
 * @param {string} message - Optional custom message
 */
function forbidden(res, message = 'Access denied') {
  return error(res, message, {
    status: 403,
    code: 'FORBIDDEN'
  });
}

/**
 * Standard conflict response (e.g., duplicate)
 * @param {Object} res - Express response object
 * @param {string} message - Conflict message
 * @param {*} details - Conflict details
 */
function conflict(res, message, details) {
  return error(res, message, {
    status: 409,
    code: 'CONFLICT',
    details
  });
}

/**
 * Standard server error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (defaults to generic)
 */
function serverError(res, message = 'Internal server error') {
  return error(res, message, {
    status: 500,
    code: 'SERVER_ERROR'
  });
}

/**
 * Paginated list response
 * @param {Object} res - Express response object
 * @param {Array} items - List of items
 * @param {Object} pagination - Pagination info
 * @param {number} pagination.page - Current page
 * @param {number} pagination.limit - Items per page
 * @param {number} pagination.total - Total items
 */
function paginated(res, items, pagination) {
  const { page = 1, limit = 50, total } = pagination;
  const totalPages = Math.ceil(total / limit);

  return success(res, items, {
    meta: {
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages
      }
    }
  });
}

/**
 * Express middleware to add response helpers to res object
 */
function responseHelpers(req, res, next) {
  res.apiSuccess = (data, options) => success(res, data, options);
  res.apiCreated = (data, message) => created(res, data, message);
  res.apiError = (msg, options) => error(res, msg, options);
  res.apiNotFound = (resource, id) => notFound(res, resource, id);
  res.apiValidationError = (errors) => validationError(res, errors);
  res.apiUnauthorized = (msg) => unauthorized(res, msg);
  res.apiForbidden = (msg) => forbidden(res, msg);
  res.apiConflict = (msg, details) => conflict(res, msg, details);
  res.apiServerError = (msg) => serverError(res, msg);
  res.apiPaginated = (items, pagination) => paginated(res, items, pagination);
  next();
}

module.exports = {
  success,
  created,
  error,
  notFound,
  validationError,
  unauthorized,
  forbidden,
  conflict,
  serverError,
  paginated,
  responseHelpers
};
