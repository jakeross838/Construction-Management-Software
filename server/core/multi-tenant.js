/**
 * Multi-Tenant Query Helpers
 * Provides builder_id filtering for all database queries
 */

const { supabase } = require('../../config');
const { AppError } = require('./errors');

/**
 * Get the builder_id from the request
 * Throws if no builder context is available (all API routes require auth)
 */
function getBuilderId(req) {
  const id = req.user?.builderId;
  if (!id) throw new AppError(401, 'UNAUTHORIZED', 'Builder context required');
  return id;
}

/**
 * Add builder_id filter to a Supabase query
 * @param {Object} query - Supabase query builder
 * @param {string|null} builderId - The builder ID to filter by
 * @param {boolean} required - If true, throws error when builderId is null
 * @returns {Object} The query with filter applied
 */
function withBuilderFilter(query, builderId) {
  if (!builderId) {
    throw new AppError(401, 'UNAUTHORIZED', 'Builder context required');
  }
  return query.eq('builder_id', builderId);
}

/**
 * Create a builder-aware query helper for a specific table
 * @param {string} tableName - The database table name
 * @returns {Object} Helper object with query methods
 */
function createBuilderQuery(tableName) {
  return {
    /**
     * Select records filtered by builder
     */
    select(req, columns = '*', options = {}) {
      const builderId = getBuilderId(req);
      let query = supabase.from(tableName).select(columns)
        .eq('builder_id', builderId);

      // Add soft-delete filter by default
      if (options.includeSoftDeleted !== true) {
        query = query.is('deleted_at', null);
      }

      return query;
    },

    /**
     * Insert a record with builder_id
     */
    insert(req, data) {
      const builderId = getBuilderId(req);
      return supabase.from(tableName).insert({ ...data, builder_id: builderId });
    },

    /**
     * Update a record, ensuring it belongs to the builder
     */
    update(req, id, data) {
      const builderId = getBuilderId(req);
      return supabase.from(tableName).update(data).eq('id', id)
        .eq('builder_id', builderId);
    },

    /**
     * Soft delete a record, ensuring it belongs to the builder
     */
    softDelete(req, id) {
      return this.update(req, id, { deleted_at: new Date().toISOString() });
    },

    /**
     * Get a single record by ID, filtered by builder
     */
    async getById(req, id, columns = '*') {
      const builderId = getBuilderId(req);
      const { data, error } = await supabase
        .from(tableName)
        .select(columns)
        .eq('id', id)
        .eq('builder_id', builderId)
        .is('deleted_at', null)
        .single();

      return { data, error };
    },

    /**
     * Check if a record exists and belongs to the builder
     */
    async exists(req, id) {
      const { data, error } = await this.getById(req, id, 'id');
      return !error && data !== null;
    }
  };
}

/**
 * Pre-built query helpers for common tables
 */
const tables = {
  jobs: createBuilderQuery('v2_jobs'),
  vendors: createBuilderQuery('v2_vendors'),
  invoices: createBuilderQuery('v2_invoices'),
  purchaseOrders: createBuilderQuery('v2_purchase_orders'),
  draws: createBuilderQuery('v2_draws'),
  costCodes: createBuilderQuery('v2_cost_codes'),
  employees: createBuilderQuery('v2_employees'),
  estimates: createBuilderQuery('v2_estimates'),
  bids: createBuilderQuery('v2_bids'),
  leads: createBuilderQuery('v2_leads'),
  contacts: createBuilderQuery('v2_contacts'),
  contracts: createBuilderQuery('v2_contracts'),
  schedules: createBuilderQuery('v2_schedules'),
  dailyLogs: createBuilderQuery('v2_daily_logs'),
  documents: createBuilderQuery('v2_documents'),
  photos: createBuilderQuery('v2_photos'),
  inspections: createBuilderQuery('v2_inspections'),
  punchLists: createBuilderQuery('v2_punch_lists'),
  selections: createBuilderQuery('v2_selections'),
  rfis: createBuilderQuery('v2_rfis'),
  submittals: createBuilderQuery('v2_submittals'),
  tasks: createBuilderQuery('v2_tasks'),
  permits: createBuilderQuery('v2_permits'),
  warranties: createBuilderQuery('v2_warranties'),
  lienReleases: createBuilderQuery('v2_lien_releases'),
  timesheets: createBuilderQuery('v2_timesheets'),
  changeOrders: createBuilderQuery('v2_change_orders'),
  budgetLines: createBuilderQuery('v2_budget_lines'),
  expenses: createBuilderQuery('v2_expenses'),
};

/**
 * Middleware to ensure request has builder context
 * Use this on routes that require authentication
 */
function requireBuilder(req, res, next) {
  const builderId = getBuilderId(req);
  if (!builderId) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Authentication required'));
  }
  next();
}

module.exports = {
  getBuilderId,
  withBuilderFilter,
  createBuilderQuery,
  tables,
  requireBuilder,
};
