/**
 * Form Validation Utilities
 *
 * Provides validation rules for financial forms to prevent
 * over-allocation, over-billing, and other common errors.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
}

// =====================================================
// INVOICE VALIDATION
// =====================================================

/**
 * Validate that invoice allocations don't exceed the invoice total
 */
export function validateInvoiceAllocations(
  invoiceTotal: number,
  allocations: { amount: number }[]
): ValidationResult {
  const allocated = allocations.reduce((sum, a) => sum + (a.amount || 0), 0);

  if (allocated > invoiceTotal) {
    return {
      valid: false,
      error: `Allocations ($${allocated.toLocaleString()}) cannot exceed invoice total ($${invoiceTotal.toLocaleString()})`,
    };
  }

  if (allocated < invoiceTotal) {
    const remaining = invoiceTotal - allocated;
    return {
      valid: true,
      warning: `$${remaining.toLocaleString()} remaining to allocate`,
    };
  }

  return { valid: true };
}

/**
 * Validate that an invoice can be added to a draw
 */
export function validateInvoiceForDraw(
  invoice: { status: string; job_id: string | null },
  draw: { job_id: string; period_end?: string }
): ValidationResult {
  if (invoice.status !== 'approved') {
    return {
      valid: false,
      error: 'Only approved invoices can be added to draws',
    };
  }

  if (invoice.job_id !== draw.job_id) {
    return {
      valid: false,
      error: 'Invoice must be for the same job as the draw',
    };
  }

  return { valid: true };
}

// =====================================================
// PURCHASE ORDER VALIDATION
// =====================================================

/**
 * Validate that PO line item billing doesn't exceed the line amount
 */
export function validatePOLineBilling(
  lineAmount: number,
  currentBilled: number,
  newBillingAmount: number
): ValidationResult {
  const totalBilled = currentBilled + newBillingAmount;

  if (totalBilled > lineAmount) {
    const overBilled = totalBilled - lineAmount;
    return {
      valid: false,
      error: `Cannot bill $${newBillingAmount.toLocaleString()} - would exceed PO line by $${overBilled.toLocaleString()}`,
    };
  }

  if (totalBilled === lineAmount) {
    return {
      valid: true,
      warning: 'This will fully bill the PO line item',
    };
  }

  return { valid: true };
}

/**
 * Validate total PO billing
 */
export function validatePOTotalBilling(
  poTotal: number,
  currentBilled: number,
  newBillingAmount: number
): ValidationResult {
  const totalBilled = currentBilled + newBillingAmount;

  if (totalBilled > poTotal) {
    return {
      valid: false,
      error: `Total billing ($${totalBilled.toLocaleString()}) would exceed PO amount ($${poTotal.toLocaleString()})`,
    };
  }

  const percentBilled = (totalBilled / poTotal) * 100;
  if (percentBilled >= 90 && percentBilled < 100) {
    return {
      valid: true,
      warning: `PO will be ${percentBilled.toFixed(0)}% billed after this invoice`,
    };
  }

  return { valid: true };
}

// =====================================================
// BUDGET VALIDATION
// =====================================================

/**
 * Validate budget commitment
 */
export function validateBudgetCommitment(
  budgetedAmount: number,
  currentCommitted: number,
  newCommitment: number
): ValidationResult {
  const totalCommitted = currentCommitted + newCommitment;

  if (totalCommitted > budgetedAmount) {
    const overBudget = totalCommitted - budgetedAmount;
    return {
      valid: true, // Allow but warn
      warning: `This exceeds the budget by $${overBudget.toLocaleString()}`,
    };
  }

  const percentCommitted = (totalCommitted / budgetedAmount) * 100;
  if (percentCommitted >= 90) {
    return {
      valid: true,
      warning: `${percentCommitted.toFixed(0)}% of budget will be committed`,
    };
  }

  return { valid: true };
}

/**
 * Validate budget line amount change
 */
export function validateBudgetLineChange(
  originalAmount: number,
  newAmount: number,
  committedAmount: number
): ValidationResult {
  if (newAmount < committedAmount) {
    return {
      valid: false,
      error: `Cannot set budget below committed amount ($${committedAmount.toLocaleString()})`,
    };
  }

  const percentChange = ((newAmount - originalAmount) / originalAmount) * 100;
  if (Math.abs(percentChange) > 20) {
    return {
      valid: true,
      warning: `This is a ${percentChange > 0 ? '+' : ''}${percentChange.toFixed(0)}% change from original budget`,
    };
  }

  return { valid: true };
}

// =====================================================
// DRAW VALIDATION
// =====================================================

/**
 * Validate draw period dates
 */
export function validateDrawPeriod(
  periodStart: string | Date,
  periodEnd: string | Date
): ValidationResult {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  if (end <= start) {
    return {
      valid: false,
      error: 'Period end must be after period start',
    };
  }

  const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff > 45) {
    return {
      valid: true,
      warning: `Draw period is ${daysDiff} days - typically 30 days`,
    };
  }

  return { valid: true };
}

/**
 * Validate invoice date against draw period
 */
export function validateInvoiceDateForDraw(
  invoiceDate: string | Date,
  drawPeriodEnd: string | Date
): ValidationResult {
  const invDate = new Date(invoiceDate);
  const periodEnd = new Date(drawPeriodEnd);

  if (invDate > periodEnd) {
    return {
      valid: true, // Allow but warn
      warning: 'Invoice date is after draw period end',
    };
  }

  return { valid: true };
}

// =====================================================
// CHANGE ORDER VALIDATION
// =====================================================

/**
 * Validate change order amount
 */
export function validateChangeOrderAmount(
  amount: number,
  poOriginalAmount: number
): ValidationResult {
  const percentChange = (Math.abs(amount) / poOriginalAmount) * 100;

  if (percentChange > 25) {
    return {
      valid: true,
      warning: `This CO is ${percentChange.toFixed(0)}% of the original PO amount`,
    };
  }

  return { valid: true };
}

// =====================================================
// GENERAL VALIDATION
// =====================================================

/**
 * Validate required fields
 */
export function validateRequired(
  fields: Record<string, unknown>,
  requiredFields: string[]
): ValidationResult {
  const missing = requiredFields.filter(field => {
    const value = fields[field];
    return value === undefined || value === null || value === '';
  });

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Required fields missing: ${missing.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Validate positive number
 */
export function validatePositiveNumber(
  value: number,
  fieldName: string
): ValidationResult {
  if (isNaN(value)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  if (value < 0) {
    return {
      valid: false,
      error: `${fieldName} cannot be negative`,
    };
  }

  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: true }; // Optional field

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return {
      valid: false,
      error: 'Please enter a valid email address',
    };
  }

  return { valid: true };
}

/**
 * Validate phone format
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone) return { valid: true }; // Optional field

  // Accept various formats: 555-123-4567, (555) 123-4567, 5551234567
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 10 && cleaned.length !== 11) {
    return {
      valid: false,
      error: 'Please enter a valid phone number',
    };
  }

  return { valid: true };
}

/**
 * Validate date is not in the future
 */
export function validateNotFutureDate(
  date: string | Date,
  fieldName: string
): ValidationResult {
  const d = new Date(date);
  const today = new Date();
  today.setHours(23, 59, 59, 999);

  if (d > today) {
    return {
      valid: false,
      error: `${fieldName} cannot be in the future`,
    };
  }

  return { valid: true };
}

// =====================================================
// HELPER: Combine multiple validations
// =====================================================

export function combineValidations(
  ...results: ValidationResult[]
): ValidationResult {
  const errors = results.filter(r => !r.valid && r.error);
  const warnings = results.filter(r => r.warning);

  if (errors.length > 0) {
    return {
      valid: false,
      error: errors.map(e => e.error).join('; '),
    };
  }

  if (warnings.length > 0) {
    return {
      valid: true,
      warning: warnings.map(w => w.warning).join('; '),
    };
  }

  return { valid: true };
}
