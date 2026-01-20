/**
 * Standardized Validation Error Helpers
 *
 * Provides consistent error/warning structures for all validation endpoints.
 * Every error includes:
 * - type: Error type constant
 * - severity: 'error' or 'warning'
 * - message: What went wrong (human readable)
 * - fix_hint: How to fix it (actionable guidance)
 * - details: Relevant context (IDs, amounts, discrepancies)
 */

// Default error messages for each error type
const ERROR_MESSAGES = {
  // Linkage errors
  ORPHANED_PO_ALLOCATION: 'Allocation references a PO that no longer exists or was deleted',
  ORPHANED_LINE_ITEM_ALLOCATION: 'Allocation references a PO line item that no longer exists',
  ORPHANED_CO_ALLOCATION: 'Allocation references a change order that no longer exists or was deleted',
  DRAW_STATUS_MISMATCH: 'Invoice is in a draw but has incorrect status',
  ALLOCATION_SUM_EXCEEDS_INVOICE: 'Total allocations exceed the invoice amount',
  INVOICE_PO_NO_ALLOCATIONS: 'Invoice is linked to a PO but has no cost code allocations',

  // PO total errors
  CO_TOTAL_MISMATCH: "PO change order total doesn't match sum of approved COs",
  PO_TOTAL_MISMATCH: "PO total amount doesn't match original plus change orders",
  VPO_NOT_TRACKED: 'Approved VPOs exist but may not be reflected in PO totals',
  CO_NOT_IN_BUDGET: 'Change order amounts not reflected in budget committed amount',

  // Budget errors
  OVER_COMMITTED: 'Committed amount exceeds budgeted amount for this cost code',
  OVER_BILLED: 'Billed amount exceeds committed amount for this cost code',
  APPROACHING_LIMIT: 'Committed amount is approaching budget limit (90%+)',
  WOULD_EXCEED_BUDGET: 'Approving pending COs would exceed budget for this cost code'
};

// Default fix hints for each error type
const FIX_HINTS = {
  // Linkage errors
  ORPHANED_PO_ALLOCATION: 'Remove this allocation or reassign it to a valid PO',
  ORPHANED_LINE_ITEM_ALLOCATION: 'Update allocation to use a valid line item ID, or remove the line item reference',
  ORPHANED_CO_ALLOCATION: 'Update allocation to use a valid change order ID, or remove the CO reference',
  DRAW_STATUS_MISMATCH: "Remove invoice from draw or change invoice status to 'approved'",
  ALLOCATION_SUM_EXCEEDS_INVOICE: 'Reduce allocation amounts so total equals invoice amount',
  INVOICE_PO_NO_ALLOCATIONS: 'Add allocations to distribute the invoice amount across cost codes',

  // PO total errors
  CO_TOTAL_MISMATCH: 'Recalculate change_order_total by summing all approved CO amount_changes',
  PO_TOTAL_MISMATCH: 'Recalculate total_amount as original_amount + sum of approved CO amounts',
  VPO_NOT_TRACKED: 'Review if VPOs should be included in change_order_total',
  CO_NOT_IN_BUDGET: 'Ensure budget line exists for this cost code and includes CO amounts in committed_amount',

  // Budget errors
  OVER_COMMITTED: 'Increase budget amount, reduce PO amounts, or reassign to different cost code',
  OVER_BILLED: 'Review invoices to ensure correct allocation, or add more PO coverage',
  APPROACHING_LIMIT: 'Monitor this cost code - consider increasing budget or reviewing upcoming invoices',
  WOULD_EXCEED_BUDGET: 'Increase budget before approving pending COs, or reduce CO amounts'
};

/**
 * Get default message for an error type
 * @param {string} type - Error type constant
 * @returns {string} Default message
 */
function getDefaultMessage(type) {
  return ERROR_MESSAGES[type] || 'Validation error detected';
}

/**
 * Get default fix hint for an error type
 * @param {string} type - Error type constant
 * @returns {string} Default fix hint
 */
function getDefaultFixHint(type) {
  return FIX_HINTS[type] || 'Review the data and correct any inconsistencies';
}

/**
 * Create a standardized validation error object
 * @param {string} type - Error type constant (e.g., 'ORPHANED_PO_ALLOCATION')
 * @param {Object} options - Error options
 * @param {string} [options.severity='error'] - 'error' or 'warning'
 * @param {string} [options.message] - Custom message (uses default if not provided)
 * @param {string} [options.fix_hint] - Custom fix hint (uses default if not provided)
 * @param {string} [options.invoice_id] - Related invoice ID
 * @param {string} [options.invoice_number] - Related invoice number
 * @param {string} [options.po_id] - Related PO ID
 * @param {string} [options.po_number] - Related PO number
 * @param {string} [options.cost_code] - Related cost code
 * @param {string} [options.cost_code_id] - Related cost code ID
 * @param {string} [options.cost_code_name] - Related cost code name
 * @param {string} [options.allocation_id] - Related allocation ID
 * @param {Object} [options.details={}] - Additional context details
 * @returns {Object} Standardized error object
 */
function createValidationError(type, {
  severity = 'error',
  message,
  fix_hint,
  invoice_id,
  invoice_number,
  po_id,
  po_number,
  cost_code,
  cost_code_id,
  cost_code_name,
  allocation_id,
  details = {}
} = {}) {
  return {
    type,
    severity,
    message: message || getDefaultMessage(type),
    fix_hint: fix_hint || getDefaultFixHint(type),
    ...(invoice_id && { invoice_id }),
    ...(invoice_number && { invoice_number }),
    ...(po_id && { po_id }),
    ...(po_number && { po_number }),
    ...(cost_code && { cost_code }),
    ...(cost_code_id && { cost_code_id }),
    ...(cost_code_name && { cost_code_name }),
    ...(allocation_id && { allocation_id }),
    details
  };
}

/**
 * Create a standardized validation warning object
 * Convenience wrapper that sets severity to 'warning'
 * @param {string} type - Error type constant
 * @param {Object} options - Same options as createValidationError
 * @returns {Object} Standardized warning object
 */
function createValidationWarning(type, options = {}) {
  return createValidationError(type, { ...options, severity: 'warning' });
}

/**
 * Format currency amount for display in messages
 * @param {number} amount - Amount to format
 * @returns {string} Formatted currency string
 */
function formatAmount(amount) {
  return '$' + (parseFloat(amount) || 0).toFixed(2);
}

/**
 * Create a detailed fix hint with specific amounts
 * @param {string} type - Error type
 * @param {Object} context - Context for building the hint
 * @returns {string} Detailed fix hint
 */
function createDetailedFixHint(type, context) {
  switch (type) {
    case 'OVER_COMMITTED':
      return `Cost code ${context.cost_code || ''} is over budget by ${formatAmount(context.excess)}. Increase budget, reduce commitments, or reallocate to another cost code.`;

    case 'OVER_BILLED':
      return `Cost code ${context.cost_code || ''} has been billed ${formatAmount(context.excess)} more than committed. Review invoices for correct allocation or add more PO coverage.`;

    case 'WOULD_EXCEED_BUDGET':
      return `Approving ${context.pending_count || 0} pending COs (${formatAmount(context.pending_amount)}) would exceed budget by ${formatAmount(context.excess)}. Consider increasing budget first.`;

    case 'ALLOCATION_SUM_EXCEEDS_INVOICE':
      return `Allocations total ${formatAmount(context.allocation_sum)} but invoice is only ${formatAmount(context.invoice_amount)}. Reduce allocations by ${formatAmount(context.excess)}.`;

    case 'CO_TOTAL_MISMATCH':
      return `Stored CO total ${formatAmount(context.stored)} differs from calculated ${formatAmount(context.calculated)} by ${formatAmount(Math.abs(context.discrepancy))}. Recalculate change_order_total.`;

    case 'PO_TOTAL_MISMATCH':
      return `Stored total ${formatAmount(context.stored)} differs from expected ${formatAmount(context.expected)} (original + COs). Recalculate total_amount.`;

    default:
      return getDefaultFixHint(type);
  }
}

module.exports = {
  createValidationError,
  createValidationWarning,
  getDefaultMessage,
  getDefaultFixHint,
  createDetailedFixHint,
  formatAmount,
  ERROR_MESSAGES,
  FIX_HINTS
};
