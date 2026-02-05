/**
 * Zod Validation Middleware
 * Provides request validation using Zod schemas
 */

const { z } = require('zod');

/**
 * Validation middleware factory
 * @param {Object} schemas - Object containing body, query, params schemas
 * @returns {Function} Express middleware
 */
function validate(schemas) {
  return async (req, res, next) => {
    try {
      const errors = [];

      // Validate body
      if (schemas.body) {
        const result = schemas.body.safeParse(req.body);
        if (!result.success) {
          errors.push(...formatZodErrors(result.error, 'body'));
        } else {
          req.body = result.data; // Use parsed/transformed data
        }
      }

      // Validate query params
      if (schemas.query) {
        const result = schemas.query.safeParse(req.query);
        if (!result.success) {
          errors.push(...formatZodErrors(result.error, 'query'));
        } else {
          req.query = result.data;
        }
      }

      // Validate URL params
      if (schemas.params) {
        const result = schemas.params.safeParse(req.params);
        if (!result.success) {
          errors.push(...formatZodErrors(result.error, 'params'));
        } else {
          req.params = result.data;
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors
        });
      }

      next();
    } catch (err) {
      return res.status(500).json({
        success: false,
        error: 'Validation error',
        details: err.message
      });
    }
  };
}

/**
 * Format Zod errors into user-friendly messages
 */
function formatZodErrors(error, location) {
  // Guard against undefined or malformed error objects
  if (!error || !error.errors || !Array.isArray(error.errors)) {
    return [{
      location,
      path: '',
      message: error?.message || 'Unknown validation error',
      code: 'VALIDATION_ERROR'
    }];
  }
  return error.errors.map(err => ({
    location,
    path: err.path?.join('.') || '',
    message: err.message || 'Invalid value',
    code: err.code || 'unknown'
  }));
}

// ============================================================
// COMMON SCHEMAS
// ============================================================

// UUID validation
const uuidSchema = z.string().uuid('Invalid UUID format');

// Pagination - supports both page-based and offset-based pagination
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0)
});

// Date string (YYYY-MM-DD)
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format');

// Money amount (positive, 2 decimal places)
const moneySchema = z.coerce.number().nonnegative('Amount must be non-negative');

// Status enums - matches STATUS_TRANSITIONS in core/validation.js
const invoiceStatusSchema = z.enum([
  'needs_review', 'ready_for_approval', 'approved', 'in_draw', 'billed', 'paid',
  'denied', 'split', 'deleted',
  // Legacy statuses (still accepted for backwards compatibility)
  'received', 'needs_approval', 'archived'
]);

const poStatusSchema = z.enum(['draft', 'pending', 'approved', 'active', 'closed', 'cancelled']);

const drawStatusSchema = z.enum(['draft', 'submitted', 'funded']);

// ============================================================
// INVOICE SCHEMAS
// ============================================================

const invoiceCreateSchema = z.object({
  job_id: uuidSchema.optional(),
  vendor_id: uuidSchema.optional(),
  po_id: uuidSchema.optional(),
  invoice_number: z.string().min(1).max(100).optional(),
  invoice_date: dateSchema.optional(),
  due_date: dateSchema.optional(),
  amount: moneySchema,
  status: invoiceStatusSchema.optional().default('received'),
  notes: z.string().max(2000).optional()
});

const invoiceUpdateSchema = z.object({
  job_id: uuidSchema.optional().nullable(),
  vendor_id: uuidSchema.optional().nullable(),
  po_id: uuidSchema.optional().nullable(),
  invoice_number: z.string().min(1).max(100).optional(),
  invoice_date: dateSchema.optional(),
  due_date: dateSchema.optional(),
  amount: moneySchema.optional(),
  status: invoiceStatusSchema.optional(),
  notes: z.string().max(2000).optional().nullable()
});

const invoiceTransitionSchema = z.object({
  new_status: invoiceStatusSchema,
  reason: z.string().max(500).optional(),
  performed_by: z.string().min(1).max(100).optional(),
  allocations: z.array(z.object({
    cost_code_id: uuidSchema,
    amount: moneySchema,
    notes: z.string().max(500).optional(),
    job_id: uuidSchema.optional(),
    po_id: uuidSchema.optional(),
    po_line_item_id: uuidSchema.optional(),
    change_order_id: uuidSchema.optional(),
    pending_co: z.boolean().optional()
  })).optional(),
  draw_id: uuidSchema.optional(),
  overridePoOverage: z.boolean().optional()
});

const invoiceAllocationSchema = z.object({
  allocations: z.array(z.object({
    cost_code_id: uuidSchema,
    amount: moneySchema,
    notes: z.string().max(500).optional(),
    po_line_item_id: uuidSchema.optional(),
    change_order_id: uuidSchema.optional()
  })).min(1, 'At least one allocation required')
});

// ============================================================
// PURCHASE ORDER SCHEMAS
// ============================================================

const poLineItemSchema = z.object({
  cost_code_id: uuidSchema,
  description: z.string().max(500).optional(),
  amount: moneySchema
});

const poCreateSchema = z.object({
  job_id: uuidSchema,
  vendor_id: uuidSchema,
  description: z.string().max(1000).optional(),
  scope_of_work: z.string().max(5000).optional(),
  notes: z.string().max(2000).optional(),
  line_items: z.array(poLineItemSchema).min(1, 'At least one line item required')
});

const poUpdateSchema = z.object({
  description: z.string().max(1000).optional(),
  scope_of_work: z.string().max(5000).optional(),
  notes: z.string().max(2000).optional().nullable(),
  status: poStatusSchema.optional()
});

// ============================================================
// DRAW SCHEMAS
// ============================================================

const drawCreateSchema = z.object({
  period_end: dateSchema.optional()
});

const drawUpdateSchema = z.object({
  period_end: dateSchema.optional(),
  status: drawStatusSchema.optional(),
  draw_number: z.coerce.number().int().positive().optional(),
  notes: z.string().max(2000).optional().nullable(),
  g702_overrides: z.object({
    original_contract_sum: moneySchema.optional(),
    net_change_orders: moneySchema.optional()
  }).optional()
});

const drawAddInvoicesSchema = z.object({
  invoice_ids: z.array(uuidSchema).min(1, 'At least one invoice ID required')
});

// ============================================================
// JOB SCHEMAS
// ============================================================

// Extended status enum to match frontend options
const jobStatusSchema = z.enum([
  'planning', 'pre_construction', 'active', 'completed', 'on_hold', 'warranty', 'closed', 'cancelled'
]).optional().default('active');

const jobCreateSchema = z.object({
  // Required
  name: z.string().min(1).max(200),
  // Basic info
  address: z.string().max(500).optional().or(z.literal('')),
  client: z.string().max(200).optional().or(z.literal('')),  // Frontend uses 'client'
  client_name: z.string().max(200).optional().or(z.literal('')),  // DB uses 'client_name'
  status: jobStatusSchema,
  // Financials
  contract_amount: moneySchema.optional(),
  budget_amount: moneySchema.optional(),
  target_margin: z.coerce.number().min(0).max(100).optional(),
  retainage_percent: z.coerce.number().min(0).max(100).optional(),
  percent_complete: z.coerce.number().min(0).max(100).optional(),
  // Dates
  start_date: dateSchema.optional().or(z.literal('')),
  end_date: dateSchema.optional().or(z.literal('')),
  // Team
  project_manager: z.string().max(100).optional().or(z.literal('')),
  site_supervisor: z.string().max(100).optional().or(z.literal('')),
  architect: z.string().max(100).optional().or(z.literal('')),
  engineer: z.string().max(100).optional().or(z.literal('')),
  // Client contact
  client_email: z.string().email().optional().or(z.literal('')),
  client_phone: z.string().max(20).optional().or(z.literal('')),
  client_cell: z.string().max(20).optional().or(z.literal('')),
  // Specs
  square_footage: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().min(0).optional(),
  bathrooms: z.coerce.number().min(0).optional(),
  half_baths: z.coerce.number().min(0).optional(),
  stories: z.coerce.number().min(1).optional(),
  garage_spaces: z.coerce.number().min(0).optional(),
  construction_type: z.string().max(50).optional().or(z.literal('')),
  architectural_style: z.string().max(50).optional().or(z.literal('')),
  // Notes
  notes: z.string().max(2000).optional().or(z.literal(''))
});

const jobUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional().nullable(),
  client: z.string().max(200).optional().nullable(),
  client_name: z.string().max(200).optional().nullable(),
  status: jobStatusSchema.optional(),
  contract_amount: moneySchema.optional().nullable(),
  budget_amount: moneySchema.optional().nullable(),
  target_margin: z.coerce.number().min(0).max(100).optional().nullable(),
  retainage_percent: z.coerce.number().min(0).max(100).optional().nullable(),
  percent_complete: z.coerce.number().min(0).max(100).optional().nullable(),
  start_date: dateSchema.optional().nullable(),
  end_date: dateSchema.optional().nullable(),
  project_manager: z.string().max(100).optional().nullable(),
  site_supervisor: z.string().max(100).optional().nullable(),
  architect: z.string().max(100).optional().nullable(),
  engineer: z.string().max(100).optional().nullable(),
  client_email: z.string().email().optional().nullable().or(z.literal('')),
  client_phone: z.string().max(20).optional().nullable(),
  client_cell: z.string().max(20).optional().nullable(),
  square_footage: z.coerce.number().min(0).optional().nullable(),
  bedrooms: z.coerce.number().min(0).optional().nullable(),
  bathrooms: z.coerce.number().min(0).optional().nullable(),
  half_baths: z.coerce.number().min(0).optional().nullable(),
  stories: z.coerce.number().min(1).optional().nullable(),
  garage_spaces: z.coerce.number().min(0).optional().nullable(),
  construction_type: z.string().max(50).optional().nullable(),
  architectural_style: z.string().max(50).optional().nullable(),
  notes: z.string().max(2000).optional().nullable()
});

// ============================================================
// VENDOR SCHEMAS
// ============================================================

const vendorCreateSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  trade: z.string().max(100).optional().nullable()
});

const vendorUpdateSchema = vendorCreateSchema.partial();

// ============================================================
// QUERY SCHEMAS
// ============================================================

const invoiceQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  job_id: uuidSchema.optional(),
  vendor_id: uuidSchema.optional(),
  search: z.string().max(100).optional(),
  // Cursor pagination support
  cursor: z.string().optional()
});

const poQuerySchema = paginationSchema.extend({
  status: z.string().optional(),
  job_id: uuidSchema.optional(),
  vendor_id: uuidSchema.optional()
});

// ============================================================
// PARAM SCHEMAS
// ============================================================

const idParamSchema = z.object({
  id: uuidSchema
});

const jobIdParamSchema = z.object({
  jobId: uuidSchema
});

module.exports = {
  validate,
  formatZodErrors,
  // Common
  uuidSchema,
  paginationSchema,
  dateSchema,
  moneySchema,
  // Schemas
  schemas: {
    // Invoice
    invoiceCreate: { body: invoiceCreateSchema },
    invoiceUpdate: { body: invoiceUpdateSchema, params: idParamSchema },
    invoiceTransition: { body: invoiceTransitionSchema, params: idParamSchema },
    invoiceAllocations: { body: invoiceAllocationSchema, params: idParamSchema },
    invoiceQuery: { query: invoiceQuerySchema },
    // PO
    poCreate: { body: poCreateSchema },
    poUpdate: { body: poUpdateSchema, params: idParamSchema },
    poQuery: { query: poQuerySchema },
    // Draw
    drawCreate: { body: drawCreateSchema },
    drawUpdate: { body: drawUpdateSchema, params: idParamSchema },
    drawAddInvoices: { body: drawAddInvoicesSchema, params: idParamSchema },
    // Job
    jobCreate: { body: jobCreateSchema },
    jobUpdate: { body: jobUpdateSchema, params: idParamSchema },
    // Vendor
    vendorCreate: { body: vendorCreateSchema },
    vendorUpdate: { body: vendorUpdateSchema, params: idParamSchema },
    // Common params
    idParam: { params: idParamSchema },
    jobIdParam: { params: jobIdParamSchema }
  }
};
