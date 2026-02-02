/**
 * Pagination Middleware
 *
 * Utilities to detect pagination type and standardize response format.
 * Supports both cursor-based and offset-based pagination.
 */

const { z } = require('zod');

/**
 * Pagination type enum
 * @enum {string}
 */
const PaginationType = {
  CURSOR: 'cursor',
  OFFSET: 'offset',
  NONE: 'none'
};

/**
 * Zod schema for cursor pagination query parameters
 */
const cursorPaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

/**
 * Zod schema for offset pagination query parameters
 */
const offsetPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional()
});

/**
 * Combined pagination schema that accepts either cursor or offset parameters
 */
const combinedPaginationSchema = z.object({
  // Cursor pagination
  cursor: z.string().optional(),
  // Offset pagination
  page: z.coerce.number().int().min(1).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  // Common
  limit: z.coerce.number().int().min(1).max(100).optional().default(50)
});

/**
 * Detect pagination type from request query parameters
 *
 * Priority:
 * 1. If 'cursor' is present, use cursor pagination
 * 2. If 'page' or 'offset' is present, use offset pagination
 * 3. Otherwise, no pagination (return all results)
 *
 * @param {Object} query - Express request query object
 * @returns {string} PaginationType enum value
 *
 * @example
 * detectPaginationType({ cursor: 'abc123', limit: 50 })  // 'cursor'
 * detectPaginationType({ page: 2, limit: 50 })           // 'offset'
 * detectPaginationType({ offset: 100, limit: 50 })       // 'offset'
 * detectPaginationType({})                                // 'none'
 */
function detectPaginationType(query) {
  if (query.cursor !== undefined) {
    return PaginationType.CURSOR;
  }
  if (query.page !== undefined || query.offset !== undefined) {
    return PaginationType.OFFSET;
  }
  return PaginationType.NONE;
}

/**
 * Parse pagination parameters from query
 *
 * @param {Object} query - Express request query object
 * @returns {Object} Parsed pagination parameters
 * @returns {string} return.type - PaginationType
 * @returns {string|null} return.cursor - Cursor string (cursor pagination)
 * @returns {number|null} return.page - Page number (offset pagination)
 * @returns {number} return.limit - Items per page
 * @returns {number} return.offset - Calculated offset (offset pagination)
 */
function parsePaginationParams(query) {
  const type = detectPaginationType(query);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 50));

  if (type === PaginationType.CURSOR) {
    return {
      type,
      cursor: query.cursor || null,
      limit,
      page: null,
      offset: null
    };
  }

  if (type === PaginationType.OFFSET) {
    const page = query.page ? Math.max(1, parseInt(query.page)) : null;
    const offset = query.offset !== undefined
      ? Math.max(0, parseInt(query.offset))
      : (page ? (page - 1) * limit : 0);

    return {
      type,
      cursor: null,
      limit,
      page,
      offset
    };
  }

  return {
    type: PaginationType.NONE,
    cursor: null,
    limit: null,
    page: null,
    offset: null
  };
}

/**
 * Build standardized cursor pagination response
 *
 * @param {Array} data - Items for current page
 * @param {string|null} nextCursor - Cursor for next page
 * @param {boolean} hasMore - Whether there are more items
 * @param {Object} meta - Additional metadata (optional)
 * @returns {Object} Standardized response object
 *
 * @example
 * cursorResponse([...items], 'abc123', true)
 * // Returns:
 * // {
 * //   success: true,
 * //   data: [...items],
 * //   pagination: {
 * //     type: 'cursor',
 * //     nextCursor: 'abc123',
 * //     hasMore: true
 * //   }
 * // }
 */
function cursorResponse(data, nextCursor, hasMore, meta = {}) {
  return {
    success: true,
    data,
    pagination: {
      type: PaginationType.CURSOR,
      nextCursor,
      hasMore
    },
    ...(Object.keys(meta).length > 0 ? { meta } : {})
  };
}

/**
 * Build standardized offset pagination response
 *
 * @param {Array} data - Items for current page
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @param {number} total - Total number of items
 * @param {Object} meta - Additional metadata (optional)
 * @returns {Object} Standardized response object
 *
 * @example
 * offsetResponse([...items], 1, 50, 150)
 * // Returns:
 * // {
 * //   success: true,
 * //   data: [...items],
 * //   pagination: {
 * //     type: 'offset',
 * //     page: 1,
 * //     limit: 50,
 * //     total: 150,
 * //     totalPages: 3,
 * //     hasMore: true
 * //   }
 * // }
 */
function offsetResponse(data, page, limit, total, meta = {}) {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data,
    pagination: {
      type: PaginationType.OFFSET,
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages
    },
    ...(Object.keys(meta).length > 0 ? { meta } : {})
  };
}

/**
 * Build response for non-paginated queries (backward compatibility)
 *
 * @param {Array} data - All items
 * @param {Object} meta - Additional metadata (optional)
 * @returns {Object} Response object
 */
function noPaginationResponse(data, meta = {}) {
  return {
    success: true,
    data,
    ...(Object.keys(meta).length > 0 ? { meta } : {})
  };
}

/**
 * Express middleware to add pagination helpers to req object
 *
 * Usage:
 *   app.use(paginationMiddleware);
 *
 *   router.get('/', (req, res) => {
 *     const { type, cursor, page, limit, offset } = req.pagination;
 *     // Use pagination params...
 *   });
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function paginationMiddleware(req, res, next) {
  req.pagination = parsePaginationParams(req.query);

  // Add response helpers
  res.cursorPaginated = (data, nextCursor, hasMore, meta) => {
    return res.json(cursorResponse(data, nextCursor, hasMore, meta));
  };

  res.offsetPaginated = (data, page, limit, total, meta) => {
    return res.json(offsetResponse(data, page, limit, total, meta));
  };

  next();
}

module.exports = {
  PaginationType,
  cursorPaginationSchema,
  offsetPaginationSchema,
  combinedPaginationSchema,
  detectPaginationType,
  parsePaginationParams,
  cursorResponse,
  offsetResponse,
  noPaginationResponse,
  paginationMiddleware
};
