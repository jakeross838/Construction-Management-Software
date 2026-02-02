/**
 * Cursor-based Pagination Utilities
 *
 * Provides cursor pagination for real-time tables, which handles insertions/deletions
 * better than offset pagination by avoiding page drift.
 *
 * A cursor encodes the last item's sort values (id, created_at, etc.) as base64 JSON.
 * When fetching the next page, we use these values to query items after the cursor.
 */

/**
 * Encode cursor data to a base64 string
 * @param {Object} data - Cursor data containing sort values
 * @returns {string} Base64 encoded cursor string
 * @example
 * encodeCursor({ id: 'uuid-123', created_at: '2025-01-15T10:30:00Z' })
 * // Returns: 'eyJpZCI6InV1aWQtMTIzIiwiY3JlYXRlZF9hdCI6IjIwMjUtMDEtMTVUMTA6MzA6MDBaIn0='
 */
function encodeCursor(data) {
  if (!data || typeof data !== 'object') {
    return null;
  }
  try {
    const json = JSON.stringify(data);
    return Buffer.from(json, 'utf-8').toString('base64');
  } catch (err) {
    return null;
  }
}

/**
 * Decode a base64 cursor string back to cursor data
 * @param {string} cursor - Base64 encoded cursor string
 * @returns {Object|null} Decoded cursor data, or null if invalid
 * @example
 * decodeCursor('eyJpZCI6InV1aWQtMTIzIn0=')
 * // Returns: { id: 'uuid-123' }
 */
function decodeCursor(cursor) {
  if (!cursor || typeof cursor !== 'string') {
    return null;
  }
  try {
    const json = Buffer.from(cursor, 'base64').toString('utf-8');
    const data = JSON.parse(json);
    return typeof data === 'object' ? data : null;
  } catch (err) {
    return null;
  }
}

/**
 * Build cursor from the last item in a result set
 * @param {Object} item - The last item from the current page
 * @param {string[]} sortFields - Fields used for sorting (determines cursor content)
 * @returns {string|null} Encoded cursor string
 * @example
 * buildCursorFromItem(
 *   { id: 'abc', created_at: '2025-01-15T10:30:00Z', status: 'active' },
 *   ['created_at', 'id']
 * )
 * // Returns cursor encoding { created_at: '2025-01-15T10:30:00Z', id: 'abc' }
 */
function buildCursorFromItem(item, sortFields = ['created_at', 'id']) {
  if (!item) return null;

  const cursorData = {};
  for (const field of sortFields) {
    if (item[field] !== undefined) {
      cursorData[field] = item[field];
    }
  }

  // Must have at least one cursor value
  if (Object.keys(cursorData).length === 0) {
    return null;
  }

  return encodeCursor(cursorData);
}

/**
 * Apply cursor-based pagination to a Supabase query
 *
 * This function modifies the query to filter items after the cursor position.
 * For descending sorts, it uses < operator; for ascending, it uses > operator.
 *
 * @param {Object} query - Supabase query builder
 * @param {string|null} cursor - Encoded cursor string (null for first page)
 * @param {number} limit - Number of items to fetch
 * @param {Object} options - Ordering options
 * @param {string} options.orderBy - Primary sort field (default: 'created_at')
 * @param {boolean} options.ascending - Sort direction (default: false = descending)
 * @param {string} options.secondaryOrderBy - Secondary sort field for tie-breaking (default: 'id')
 * @returns {Object} Modified Supabase query
 *
 * @example
 * // First page (no cursor)
 * let query = supabase.from('v2_invoices').select('*');
 * query = applyCursorPagination(query, null, 50, { orderBy: 'created_at', ascending: false });
 *
 * // Subsequent page (with cursor)
 * query = applyCursorPagination(query, nextCursor, 50, { orderBy: 'created_at', ascending: false });
 */
function applyCursorPagination(query, cursor, limit, options = {}) {
  const {
    orderBy = 'created_at',
    ascending = false,
    secondaryOrderBy = 'id'
  } = options;

  // Apply ordering
  query = query.order(orderBy, { ascending });
  if (secondaryOrderBy && secondaryOrderBy !== orderBy) {
    query = query.order(secondaryOrderBy, { ascending });
  }

  // If we have a cursor, apply the filter for items after cursor position
  if (cursor) {
    const cursorData = decodeCursor(cursor);
    if (cursorData) {
      const cursorValue = cursorData[orderBy];
      const cursorId = cursorData[secondaryOrderBy];

      if (cursorValue !== undefined) {
        // For descending order, we want items with smaller values (earlier in the list)
        // For ascending order, we want items with larger values
        const operator = ascending ? 'gt' : 'lt';

        // Use a compound filter for precise cursor positioning
        // Either the primary field is strictly before/after, OR
        // the primary field is equal and the secondary field is before/after
        if (cursorId !== undefined && secondaryOrderBy) {
          // Compound cursor: (created_at < cursor_created_at) OR
          //                  (created_at = cursor_created_at AND id < cursor_id)
          query = query.or(
            `${orderBy}.${operator}.${cursorValue},` +
            `and(${orderBy}.eq.${cursorValue},${secondaryOrderBy}.${operator}.${cursorId})`
          );
        } else {
          // Simple cursor: just the primary field
          query = query[operator](orderBy, cursorValue);
        }
      }
    }
  }

  // Apply limit (fetch one extra to determine if there are more items)
  query = query.limit(limit + 1);

  return query;
}

/**
 * Process query results for cursor pagination response
 *
 * @param {Array} data - Query results (may include extra item to check hasMore)
 * @param {number} limit - Requested limit
 * @param {string[]} sortFields - Fields used for cursor (default: ['created_at', 'id'])
 * @returns {Object} Pagination response data
 * @returns {Array} return.data - Items for current page (trimmed to limit)
 * @returns {string|null} return.nextCursor - Cursor for next page, null if no more
 * @returns {boolean} return.hasMore - Whether there are more items
 *
 * @example
 * const result = processCursorResults(queryData, 50, ['created_at', 'id']);
 * // Returns: { data: [...50 items], nextCursor: 'abc123', hasMore: true }
 */
function processCursorResults(data, limit, sortFields = ['created_at', 'id']) {
  if (!Array.isArray(data)) {
    return { data: [], nextCursor: null, hasMore: false };
  }

  const hasMore = data.length > limit;
  const items = hasMore ? data.slice(0, limit) : data;

  // Build cursor from the last item
  const lastItem = items[items.length - 1];
  const nextCursor = hasMore ? buildCursorFromItem(lastItem, sortFields) : null;

  return {
    data: items,
    nextCursor,
    hasMore
  };
}

/**
 * Complete cursor pagination helper that combines query and response processing
 *
 * @param {Object} supabase - Supabase client instance
 * @param {string} table - Table name
 * @param {string} selectQuery - Supabase select query string
 * @param {Object} options - Pagination options
 * @param {string} options.cursor - Current cursor (null for first page)
 * @param {number} options.limit - Items per page (default: 50)
 * @param {string} options.orderBy - Sort field (default: 'created_at')
 * @param {boolean} options.ascending - Sort direction (default: false)
 * @param {Function} options.applyFilters - Function to apply additional filters to query
 * @returns {Promise<Object>} Pagination response
 *
 * @example
 * const result = await cursorPaginate(supabase, 'v2_invoices', '*', {
 *   cursor: req.query.cursor,
 *   limit: 50,
 *   orderBy: 'created_at',
 *   ascending: false,
 *   applyFilters: (q) => q.eq('status', 'approved').is('deleted_at', null)
 * });
 */
async function cursorPaginate(supabase, table, selectQuery, options = {}) {
  const {
    cursor = null,
    limit = 50,
    orderBy = 'created_at',
    ascending = false,
    secondaryOrderBy = 'id',
    applyFilters = (q) => q
  } = options;

  // Build base query
  let query = supabase.from(table).select(selectQuery);

  // Apply custom filters
  query = applyFilters(query);

  // Apply cursor pagination
  query = applyCursorPagination(query, cursor, limit, {
    orderBy,
    ascending,
    secondaryOrderBy
  });

  // Execute query
  const { data, error } = await query;

  if (error) {
    throw error;
  }

  // Process results
  return processCursorResults(data || [], limit, [orderBy, secondaryOrderBy]);
}

module.exports = {
  encodeCursor,
  decodeCursor,
  buildCursorFromItem,
  applyCursorPagination,
  processCursorResults,
  cursorPaginate
};
