/**
 * Validation Module
 * Comprehensive validation for invoices, status transitions, and data integrity
 */

const { supabase } = require('../config');

// ============================================================
// VALIDATION RULES
// ============================================================

const VALIDATION_RULES = {
  invoice: {
    amount: {
      required: true,
      min: -10000000,  // Allow negative amounts for credit invoices/memos
      max: 10000000,
      type: 'number',
      notZero: true    // Amount cannot be exactly zero
    },
    invoice_number: {
      required: true,
      maxLength: 100,
      pattern: /^[A-Za-z0-9\-_#\s.]+$/,
      patternMessage: 'Invoice number can only contain letters, numbers, spaces, and -_#.'
    },
    invoice_date: {
      required: true,
      notFuture: true,
      notOlderThan: 365,
      type: 'date'
    },
    due_date: {
      afterInvoiceDate: true,
      type: 'date'
    }
  }
};

// ============================================================
// STATUS TRANSITIONS
// ============================================================

// Invoice Pipeline Flow:
// 1. needs_review    - Accountant reviews, full editing, job optional
// 2. ready_for_approval - PM reviews under specific job, read-only (can unlock)
// 3. approved        - Ready for draws, read-only (can unlock)
// 4. in_draw         - Added to a draw
// 5. paid            - Draw funded, archived

const STATUS_TRANSITIONS = {
  needs_review: ['ready_for_approval', 'denied', 'deleted', 'split'],
  ready_for_approval: ['approved', 'needs_review', 'denied', 'split'],
  approved: ['in_draw', 'ready_for_approval', 'needs_review'],
  in_draw: ['paid', 'approved'],
  paid: [],     // Archived - read only
  split: [],    // Split parent - container only, children are processed
  denied: ['needs_review', 'deleted'],  // Can resubmit or delete
  // Legacy statuses - map to new flow
  received: ['needs_review', 'ready_for_approval', 'denied', 'deleted', 'split'],
  needs_approval: ['approved', 'ready_for_approval', 'denied', 'needs_review']
};

// ============================================================
// PRE-TRANSITION REQUIREMENTS
// ============================================================

const PRE_TRANSITION_REQUIREMENTS = {
  needs_review: [],  // No requirements - accountant can edit freely
  ready_for_approval: ['job_id', 'vendor_id'],  // Must have job and vendor
  approved: ['job_id', 'vendor_id', 'allocations_balanced'],  // Must have allocations
  in_draw: ['draw_id'],
  paid: ['funded_draw']
};

// Statuses where editing is locked by default (need unlock button)
const LOCKED_STATUSES = ['ready_for_approval', 'approved', 'in_draw', 'paid', 'split'];

// ============================================================
// VALIDATION FUNCTIONS
// ============================================================

/**
 * Validate invoice data against rules
 * @param {Object} data - Invoice data to validate
 * @param {boolean} isPartial - If true, only validate provided fields
 * @returns {Object} { valid: boolean, errors: [] }
 */
function validateInvoice(data, isPartial = false) {
  const errors = [];
  const rules = VALIDATION_RULES.invoice;

  for (const [field, rule] of Object.entries(rules)) {
    const value = data[field];
    const hasValue = value !== undefined && value !== null && value !== '';

    // Required check (skip for partial updates if field not provided)
    if (rule.required && !isPartial && !hasValue) {
      errors.push({ field, message: `${field} is required` });
      continue;
    }

    // Skip further validation if no value
    if (!hasValue) continue;

    // Type checking
    if (rule.type === 'number') {
      const numValue = parseFloat(value);
      if (isNaN(numValue)) {
        errors.push({ field, message: `${field} must be a number` });
        continue;
      }

      if (rule.notZero && numValue === 0) {
        errors.push({ field, message: `${field} cannot be zero` });
      }
      if (rule.min !== undefined && numValue < rule.min) {
        errors.push({ field, message: `${field} must be at least ${rule.min}` });
      }
      if (rule.max !== undefined && numValue > rule.max) {
        errors.push({ field, message: `${field} cannot exceed ${rule.max}` });
      }
    }

    if (rule.type === 'date') {
      const dateValue = new Date(value);
      if (isNaN(dateValue.getTime())) {
        errors.push({ field, message: `${field} must be a valid date` });
        continue;
      }

      if (rule.notFuture) {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (dateValue > today) {
          errors.push({ field, message: `${field} cannot be in the future` });
        }
      }

      if (rule.notOlderThan && !isPartial) {
        // Only check age for new invoices, not partial updates
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - rule.notOlderThan);
        if (dateValue < cutoff) {
          errors.push({ field, message: `${field} cannot be older than ${rule.notOlderThan} days` });
        }
      }
    }

    // String validations
    if (typeof value === 'string') {
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push({ field, message: `${field} cannot exceed ${rule.maxLength} characters` });
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push({ field, message: rule.patternMessage || `${field} format is invalid` });
      }
    }
  }

  // Due date after invoice date check
  if (data.due_date && data.invoice_date) {
    const invoiceDate = new Date(data.invoice_date);
    const dueDate = new Date(data.due_date);
    if (dueDate < invoiceDate) {
      errors.push({ field: 'due_date', message: 'Due date cannot be before invoice date' });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate status transition is allowed
 * @param {string} currentStatus - Current invoice status
 * @param {string} newStatus - Desired new status
 * @returns {Object} { valid: boolean, error?: string }
 */
function validateStatusTransition(currentStatus, newStatus) {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];

  if (!allowedTransitions) {
    return { valid: false, error: `Unknown current status: ${currentStatus}` };
  }

  if (!allowedTransitions.includes(newStatus)) {
    return {
      valid: false,
      error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`
    };
  }

  return { valid: true };
}

/**
 * Validate pre-transition requirements are met
 * @param {Object} invoice - Full invoice object with relations
 * @param {string} newStatus - Desired new status
 * @param {Object} context - Additional context (draw_id, allocations, etc.)
 * @returns {Promise<Object>} { valid: boolean, errors: [], warnings: [] }
 */
async function validatePreTransition(invoice, newStatus, context = {}) {
  const errors = [];
  const warnings = [];
  const requirements = PRE_TRANSITION_REQUIREMENTS[newStatus] || [];

  for (const req of requirements) {
    switch (req) {
      case 'job_id':
        if (!invoice.job_id) {
          errors.push({ requirement: req, message: 'Invoice must be assigned to a job' });
        }
        break;

      case 'vendor_id':
        if (!invoice.vendor_id) {
          errors.push({ requirement: req, message: 'Invoice must be assigned to a vendor' });
        }
        break;

      case 'allocations_balanced':
        const allocations = context.allocations || invoice.allocations || [];
        const allocSum = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const invoiceAmount = parseFloat(invoice.amount);
        const isCredit = invoiceAmount < 0;

        if (allocations.length === 0) {
          errors.push({ requirement: req, message: 'Invoice must have at least one cost code allocation' });
        } else if (isCredit) {
          // For credit invoices: allocations sum should not be MORE negative than invoice
          // e.g., invoice = -$100, allocations can be -$100 or -$50, but not -$150
          if (allocSum < invoiceAmount - 0.01) {
            errors.push({
              requirement: req,
              message: `Credit allocation total ($${allocSum.toFixed(2)}) cannot exceed credit amount ($${invoiceAmount.toFixed(2)})`
            });
          }
        } else {
          // For standard invoices: only block over-allocation; under-allocation allowed for partial work
          if (allocSum > invoiceAmount + 0.01) {
            errors.push({
              requirement: req,
              message: `Allocation total ($${allocSum.toFixed(2)}) cannot exceed invoice amount ($${invoiceAmount.toFixed(2)})`
            });
          }
        }
        break;

      case 'draw_id':
        if (!context.draw_id) {
          errors.push({ requirement: req, message: 'Must specify a draw to add invoice to' });
        } else {
          // Verify draw exists and is not funded
          const { data: draw } = await supabase
            .from('v2_draws')
            .select('id, status')
            .eq('id', context.draw_id)
            .single();

          if (!draw) {
            errors.push({ requirement: req, message: 'Specified draw does not exist' });
          } else if (draw.status === 'funded') {
            errors.push({ requirement: req, message: 'Cannot add invoice to a funded draw' });
          }
        }
        break;

      case 'funded_draw':
        // Check if invoice is in a funded draw
        const { data: drawInvoice } = await supabase
          .from('v2_draw_invoices')
          .select('draw:v2_draws(status)')
          .eq('invoice_id', invoice.id)
          .single();

        if (!drawInvoice?.draw || drawInvoice.draw.status !== 'funded') {
          errors.push({ requirement: req, message: 'Invoice must be in a funded draw to mark as paid' });
        }
        break;
    }
  }

  // PO capacity check (soft-block with override)
  if (newStatus === 'approved' && invoice.po_id) {
    const poCheck = await validatePOCapacity(invoice.po_id, invoice.amount, invoice.id);
    if (poCheck.exceeded) {
      // If override flag not set, treat as error
      if (!context.overridePoOverage) {
        errors.push({
          requirement: 'po_capacity',
          type: 'PO_OVERAGE',
          message: `Invoice exceeds PO remaining balance by $${poCheck.overageAmount.toFixed(2)}`,
          poRemaining: poCheck.remaining,
          invoiceAmount: parseFloat(invoice.amount),
          overageAmount: poCheck.overageAmount,
          requiresOverride: true
        });
      } else {
        // Override acknowledged - add to warnings for audit
        warnings.push({
          type: 'po_exceeded_override',
          message: `PO overage of $${poCheck.overageAmount.toFixed(2)} was approved with override`
        });
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Check for duplicate invoices
 * @param {string} vendorId - Vendor UUID
 * @param {string} invoiceNumber - Invoice number
 * @param {number} amount - Invoice amount
 * @param {string} excludeId - Invoice ID to exclude (for edits)
 * @returns {Promise<Object>} { isDuplicate: boolean, existingInvoice?: Object }
 */
async function checkDuplicate(vendorId, invoiceNumber, amount, excludeId = null) {
  let query = supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, status, created_at')
    .eq('vendor_id', vendorId)
    .eq('invoice_number', invoiceNumber)
    .is('deleted_at', null);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

  const { data: existing } = await query;

  if (existing && existing.length > 0) {
    return {
      isDuplicate: true,
      existingInvoice: existing[0],
      message: `Duplicate invoice #${invoiceNumber} from this vendor already exists (${existing[0].status})`
    };
  }

  return { isDuplicate: false };
}

/**
 * Validate allocation totals match invoice amount
 * @param {Array} allocations - Array of { cost_code_id, amount }
 * @param {number} invoiceAmount - Total invoice amount (can be negative for credits)
 * @returns {Object} { valid: boolean, total: number, difference: number, error?: string, isCredit: boolean }
 */
function validateAllocations(allocations, invoiceAmount) {
  const isCredit = invoiceAmount < 0;

  if (!allocations || allocations.length === 0) {
    return {
      valid: false,
      total: 0,
      difference: Math.abs(invoiceAmount),
      error: 'At least one allocation is required',
      isCredit
    };
  }

  // Check each allocation for validity
  for (let i = 0; i < allocations.length; i++) {
    const alloc = allocations[i];
    const amount = parseFloat(alloc.amount || 0);

    // Check for missing cost code
    if (!alloc.cost_code_id) {
      return {
        valid: false,
        total: 0,
        difference: Math.abs(invoiceAmount),
        error: `Allocation ${i + 1} is missing a cost code`,
        isCredit
      };
    }

    // Check for zero amount (not allowed)
    if (isNaN(amount) || amount === 0) {
      return {
        valid: false,
        total: 0,
        difference: Math.abs(invoiceAmount),
        error: `Allocation ${i + 1} cannot have zero amount`,
        isCredit
      };
    }

    // For standard invoices: allocations must be positive
    // For credit invoices: allocations must be negative
    if (isCredit && amount > 0) {
      return {
        valid: false,
        total: 0,
        difference: Math.abs(invoiceAmount),
        error: `Credit invoice allocations must be negative (allocation ${i + 1}: $${amount})`,
        isCredit
      };
    }
    if (!isCredit && amount < 0) {
      return {
        valid: false,
        total: 0,
        difference: Math.abs(invoiceAmount),
        error: `Standard invoice allocations must be positive (allocation ${i + 1}: $${amount})`,
        isCredit
      };
    }
  }

  const total = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
  const difference = Math.abs(total - invoiceAmount);
  const valid = difference < 0.01;

  return {
    valid,
    total,
    difference,
    isCredit,
    error: valid ? null : `Allocations total $${total.toFixed(2)} but invoice is $${invoiceAmount.toFixed(2)} (difference: $${difference.toFixed(2)})`
  };
}

/**
 * Validate cost codes exist in database
 * @param {Array} costCodeIds - Array of cost code UUIDs
 * @returns {Promise<Object>} { valid: boolean, error?: string, invalidCodes?: Array }
 */
async function validateCostCodesExist(costCodeIds) {
  if (!costCodeIds || costCodeIds.length === 0) {
    return { valid: true };
  }

  const uniqueIds = [...new Set(costCodeIds.filter(id => id))];

  const { data: validCodes, error } = await supabase
    .from('v2_cost_codes')
    .select('id')
    .in('id', uniqueIds);

  if (error) {
    console.error('Error validating cost codes:', error);
    return { valid: true }; // Don't block on DB error
  }

  const validIds = new Set((validCodes || []).map(c => c.id));
  const invalidIds = uniqueIds.filter(id => !validIds.has(id));

  if (invalidIds.length > 0) {
    return {
      valid: false,
      error: `Invalid cost code(s): ${invalidIds.length} code(s) not found`,
      invalidCodes: invalidIds
    };
  }

  return { valid: true };
}

/**
 * Validate PO has capacity for invoice amount
 * @param {string} poId - PO UUID
 * @param {number} newAmount - Amount to add
 * @param {string} excludeInvoiceId - Invoice to exclude from calculation
 * @returns {Promise<Object>} { hasCapacity: boolean, remaining: number, exceeded: boolean, overageAmount: number }
 */
async function validatePOCapacity(poId, newAmount, excludeInvoiceId = null) {
  // Get PO total
  const { data: po } = await supabase
    .from('v2_purchase_orders')
    .select('total_amount')
    .eq('id', poId)
    .single();

  if (!po) {
    return { hasCapacity: true, remaining: 0, exceeded: false, overageAmount: 0 };
  }

  // Get sum of all approved+ invoices on this PO
  let query = supabase
    .from('v2_invoices')
    .select('amount')
    .eq('po_id', poId)
    .in('status', ['approved', 'in_draw', 'paid'])
    .is('deleted_at', null);

  if (excludeInvoiceId) {
    query = query.neq('id', excludeInvoiceId);
  }

  const { data: invoices } = await query;
  const billed = invoices?.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0) || 0;
  const poTotal = parseFloat(po.total_amount || 0);
  const remaining = poTotal - billed;
  const newTotal = billed + parseFloat(newAmount);
  const exceeded = newTotal > poTotal;

  return {
    hasCapacity: !exceeded,
    poTotal,
    billed,
    remaining,
    exceeded,
    overageAmount: exceeded ? newTotal - poTotal : 0
  };
}

/**
 * Generate hash for duplicate detection
 * @param {string} vendorId
 * @param {string} invoiceNumber
 * @param {number} amount
 * @returns {string}
 */
function generateInvoiceHash(vendorId, invoiceNumber, amount) {
  const normalized = `${vendorId}|${invoiceNumber.toLowerCase().trim()}|${parseFloat(amount).toFixed(2)}`;
  // Simple hash (could use crypto for production)
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

module.exports = {
  VALIDATION_RULES,
  STATUS_TRANSITIONS,
  PRE_TRANSITION_REQUIREMENTS,
  validateInvoice,
  validateStatusTransition,
  validatePreTransition,
  checkDuplicate,
  validateAllocations,
  validateCostCodesExist,
  validatePOCapacity,
  generateInvoiceHash
};
