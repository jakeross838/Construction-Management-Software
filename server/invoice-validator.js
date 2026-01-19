/**
 * Invoice Validator Module
 *
 * Stage 2 of the two-stage invoice extraction pipeline.
 * Performs programmatic cross-field validation after AI extraction.
 *
 * Features:
 * - Amount validation (line items sum, subtotal + tax = total)
 * - Date validation (reasonable range, format)
 * - Vendor validation (name, contact info, trade type)
 * - Invoice number validation (format, OCR error detection/correction)
 * - Cross-field consistency checks
 * - OCR error auto-corrections
 */

const { supabase } = require('../config');

// ============================================================
// OCR ERROR CORRECTION PATTERNS
// ============================================================

/**
 * Common OCR misreads and their corrections
 */
const OCR_CORRECTIONS = {
  invoiceNumber: [
    // O → 0 when adjacent to digits
    { pattern: /[oO](?=\d)/g, replacement: '0', description: 'O → 0 (before digit)' },
    { pattern: /(?<=\d)[oO]/g, replacement: '0', description: 'O → 0 (after digit)' },
    // l/I → 1 when adjacent to digits
    { pattern: /[lI](?=\d)/g, replacement: '1', description: 'l/I → 1 (before digit)' },
    { pattern: /(?<=\d)[lI]/g, replacement: '1', description: 'l/I → 1 (after digit)' },
    // S → 5 when surrounded by digits
    { pattern: /(?<=\d)S(?=\d)/gi, replacement: '5', description: 'S → 5 (between digits)' },
    // B → 8 when surrounded by digits
    { pattern: /(?<=\d)B(?=\d)/gi, replacement: '8', description: 'B → 8 (between digits)' },
    // Remove accidental spaces in invoice numbers
    { pattern: /(\d)\s+(\d)/g, replacement: '$1$2', description: 'Remove space between digits' },
    // Remove leading/trailing whitespace
    { pattern: /^\s+|\s+$/g, replacement: '', description: 'Trim whitespace' }
  ],
  amount: [
    // Remove currency symbols and formatting
    { pattern: /\$/g, replacement: '', description: 'Remove $ symbol' },
    { pattern: /,/g, replacement: '', description: 'Remove commas' },
    // O → 0 in amounts
    { pattern: /[oO]/g, replacement: '0', description: 'O → 0 in amount' },
    // Remove spaces
    { pattern: /\s/g, replacement: '', description: 'Remove spaces' }
  ],
  date: [
    // Normalize various date separators to dashes
    { pattern: /(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/g, replacement: normalizeDate, description: 'Normalize date format' },
    { pattern: /(\d{4})[.\/](\d{1,2})[.\/](\d{1,2})/g, replacement: '$1-$2-$3', description: 'Normalize ISO date format' }
  ]
};

/**
 * Normalize date to YYYY-MM-DD format
 */
function normalizeDate(match, p1, p2, p3) {
  // Determine if first part is month or year based on value
  const first = parseInt(p1);
  const second = parseInt(p2);
  const third = parseInt(p3);

  // If third part is 4 digits, it's the year (MM/DD/YYYY or DD/MM/YYYY)
  if (p3.length === 4) {
    // Assume MM/DD/YYYY (US format) - common in construction invoices
    const month = String(first).padStart(2, '0');
    const day = String(second).padStart(2, '0');
    return `${third}-${month}-${day}`;
  }

  // Otherwise assume YYYY-MM-DD already
  return match;
}

// ============================================================
// OCR CORRECTION FUNCTIONS
// ============================================================

/**
 * Apply OCR corrections to a value
 * Returns the corrected value and a log of all corrections applied
 *
 * @param {string} value - Original value to correct
 * @param {string} type - Type of correction ('invoiceNumber', 'amount', 'date')
 * @returns {Object} { corrected: string, original: string, corrections: string[], wasModified: boolean }
 */
function applyOCRCorrections(value, type) {
  const result = {
    corrected: value || '',
    original: value || '',
    corrections: [],
    wasModified: false
  };

  if (!value || !OCR_CORRECTIONS[type]) {
    return result;
  }

  let current = String(value);

  for (const rule of OCR_CORRECTIONS[type]) {
    const before = current;
    if (typeof rule.replacement === 'function') {
      current = current.replace(rule.pattern, rule.replacement);
    } else {
      current = current.replace(rule.pattern, rule.replacement);
    }

    if (before !== current) {
      result.corrections.push({
        description: rule.description,
        before: before,
        after: current
      });
      console.log(`[OCR] ${type}: ${rule.description} - "${before}" → "${current}"`);
    }
  }

  result.corrected = current;
  result.wasModified = result.original !== result.corrected;

  if (result.wasModified) {
    console.log(`[OCR] ${type} final: "${result.original}" → "${result.corrected}" (${result.corrections.length} corrections)`);
  }

  return result;
}

/**
 * Correct amount value (remove formatting, fix OCR errors)
 * @param {string|number} amount - Amount to correct
 * @returns {Object} { corrected: number, original: any, corrections: string[], wasModified: boolean }
 */
function correctAmount(amount) {
  const result = {
    corrected: 0,
    original: amount,
    corrections: [],
    wasModified: false
  };

  if (amount === null || amount === undefined) {
    return result;
  }

  // If already a number, just return it
  if (typeof amount === 'number') {
    result.corrected = amount;
    return result;
  }

  // Apply string corrections
  let amountStr = String(amount);
  const originalStr = amountStr;

  // Apply OCR corrections for amounts
  for (const rule of OCR_CORRECTIONS.amount) {
    const before = amountStr;
    amountStr = amountStr.replace(rule.pattern, rule.replacement);
    if (before !== amountStr) {
      result.corrections.push(rule.description);
    }
  }

  // Parse the corrected string
  const parsed = parseFloat(amountStr);
  if (!isNaN(parsed)) {
    result.corrected = parsed;
    result.wasModified = originalStr !== amountStr;

    if (result.wasModified) {
      console.log(`[OCR] amount: "${originalStr}" → ${result.corrected} (${result.corrections.join(', ')})`);
    }
  }

  return result;
}

// ============================================================
// AMOUNT VALIDATION
// ============================================================

/**
 * Validate invoice amounts for consistency
 * @param {Object} extracted - Extracted invoice data
 * @returns {Object} { valid: boolean, issues: string[], corrections: Object }
 */
function validateAmounts(extracted) {
  const result = { valid: true, issues: [], corrections: {}, score: 1.0 };

  const totalAmount = parseFloat(extracted.totalAmount || extracted.amounts?.totalAmount || 0);
  const subtotal = parseFloat(extracted.subtotal || extracted.amounts?.subtotal || 0);
  const taxAmount = parseFloat(extracted.taxAmount || extracted.amounts?.taxAmount || 0);
  const lineItems = extracted.lineItems || [];

  // Check 1: Line items should sum to total (within 1% tolerance)
  if (lineItems.length > 0) {
    const lineItemSum = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const diff = Math.abs(lineItemSum - totalAmount);
    const tolerance = Math.abs(totalAmount * 0.01); // 1% tolerance

    if (diff > tolerance && diff > 0.01) {
      result.issues.push(`Line items total ($${lineItemSum.toFixed(2)}) differs from invoice total ($${totalAmount.toFixed(2)}) by $${diff.toFixed(2)}`);
      result.score -= 0.15;
      result.valid = false;
    }
  }

  // Check 2: Subtotal + Tax = Total (within $0.01 tolerance)
  if (subtotal > 0 && taxAmount >= 0) {
    const calculated = subtotal + taxAmount;
    const diff = Math.abs(calculated - totalAmount);

    if (diff > 0.01) {
      result.issues.push(`Subtotal ($${subtotal.toFixed(2)}) + Tax ($${taxAmount.toFixed(2)}) = $${calculated.toFixed(2)}, but total is $${totalAmount.toFixed(2)}`);
      result.score -= 0.1;

      // Auto-correct if difference is small (likely rounding)
      if (diff < 1.00) {
        result.corrections.totalAmount = calculated;
        result.issues.push(`Auto-corrected total from $${totalAmount.toFixed(2)} to $${calculated.toFixed(2)}`);
      }
    }
  }

  // Check 3: Flag negative amounts (credit memo detection)
  if (totalAmount < 0) {
    result.issues.push(`Negative total amount ($${totalAmount.toFixed(2)}) - likely a credit memo`);
    // Don't penalize score for credits - they're valid
    if (extracted.invoiceType !== 'credit_memo') {
      result.corrections.invoiceType = 'credit_memo';
      result.issues.push('Auto-set invoice type to credit_memo based on negative amount');
    }
  }

  // Check 4: Sanity check - amount should be reasonable for construction
  if (totalAmount > 0) {
    if (totalAmount < 10) {
      result.issues.push(`Unusually low amount ($${totalAmount.toFixed(2)}) - verify this is correct`);
      result.score -= 0.05;
    } else if (totalAmount > 1000000) {
      result.issues.push(`Very high amount ($${totalAmount.toFixed(2)}) - verify this is correct`);
      result.score -= 0.05;
    }
  }

  result.score = Math.max(0, result.score);
  return result;
}

// ============================================================
// DATE VALIDATION
// ============================================================

/**
 * AI-INT-03: Check if a date string is actually valid (not just parseable)
 * JavaScript Date() accepts invalid dates like "2024-05-34" by overflowing
 * This function validates that day/month are actually valid
 *
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if date is valid, false if invalid
 */
function isValidDate(dateStr) {
  if (!dateStr) return false;

  // Try to parse the date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  // Check if the date overflowed by comparing input to output
  // If input was "2024-05-34", Date creates June 3, 2024 (overflow)
  const parts = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (parts) {
    const [, year, month, day] = parts;
    const parsedYear = date.getFullYear();
    const parsedMonth = date.getMonth() + 1; // 0-indexed
    const parsedDay = date.getDate();

    // If parsed date differs from input, it overflowed
    if (parseInt(year) !== parsedYear ||
        parseInt(month) !== parsedMonth ||
        parseInt(day) !== parsedDay) {
      return false;
    }

    // Also validate month is 1-12 and day is 1-31 directly
    if (parseInt(month) < 1 || parseInt(month) > 12) return false;
    if (parseInt(day) < 1 || parseInt(day) > 31) return false;
  }

  // Check for MM/DD/YYYY format
  const usFormatParts = dateStr.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (usFormatParts) {
    const [, month, day, year] = usFormatParts;

    // Basic sanity: month 1-12, day 1-31
    if (parseInt(month) < 1 || parseInt(month) > 12) return false;
    if (parseInt(day) < 1 || parseInt(day) > 31) return false;

    // Days in month validation
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    if (parseInt(day) > daysInMonth) return false;
  }

  return true;
}

/**
 * Validate invoice dates
 * @param {Object} extracted - Extracted invoice data
 * @returns {Object} { valid: boolean, issues: string[], corrections: Object }
 */
function validateDates(extracted) {
  const result = { valid: true, issues: [], corrections: {}, score: 1.0 };

  const invoiceDate = extracted.invoiceDate;
  const dueDate = extracted.dueDate;
  const now = new Date();

  // Check 1: Invoice date exists and is valid
  if (!invoiceDate) {
    result.issues.push('Missing invoice date');
    result.score -= 0.2;
    result.valid = false;
  } else if (!isValidDate(invoiceDate)) {
    // AI-INT-03: Robust date validation - reject impossible dates like "2024-05-34"
    result.issues.push(`Invalid invoice date (impossible date): ${invoiceDate}`);
    result.corrections.invoiceDate = null;
    result.score -= 0.2;
    result.valid = false;
  } else {
    const invDate = new Date(invoiceDate);

    if (isNaN(invDate.getTime())) {
      result.issues.push(`Invalid invoice date format: ${invoiceDate}`);
      result.score -= 0.2;
      result.valid = false;
    } else {
      const daysDiff = Math.floor((now - invDate) / (1000 * 60 * 60 * 24));

      // Invoice date should be within reasonable range
      // Past 180 days to 30 days in future
      if (daysDiff > 180) {
        result.issues.push(`Invoice date (${invoiceDate}) is ${daysDiff} days old - unusually old`);
        result.score -= 0.1;
      } else if (daysDiff < -30) {
        result.issues.push(`Invoice date (${invoiceDate}) is ${Math.abs(daysDiff)} days in the future - likely incorrect`);
        result.score -= 0.15;
        result.valid = false;
      } else if (daysDiff < -7) {
        result.issues.push(`Invoice date (${invoiceDate}) is ${Math.abs(daysDiff)} days in the future - verify`);
        result.score -= 0.05;
      }
    }
  }

  // Check 2: Due date validation (if present)
  if (dueDate) {
    const dueDateObj = new Date(dueDate);
    const invDateObj = new Date(invoiceDate);

    if (!isNaN(dueDateObj.getTime()) && !isNaN(invDateObj.getTime())) {
      // Due date should be after invoice date
      if (dueDateObj < invDateObj) {
        result.issues.push(`Due date (${dueDate}) is before invoice date (${invoiceDate})`);
        result.score -= 0.1;
      }

      // Due date shouldn't be too far in the future (typical terms are 30-90 days)
      const daysUntilDue = Math.floor((dueDateObj - invDateObj) / (1000 * 60 * 60 * 24));
      if (daysUntilDue > 180) {
        result.issues.push(`Due date is ${daysUntilDue} days after invoice date - unusually long payment terms`);
        result.score -= 0.05;
      }
    }
  }

  result.score = Math.max(0, result.score);
  return result;
}

// ============================================================
// VENDOR VALIDATION
// ============================================================

/**
 * Valid trade types for construction vendors
 */
const VALID_TRADE_TYPES = [
  'plumbing', 'electrical', 'hvac', 'drywall', 'framing', 'roofing',
  'painting', 'flooring', 'tile', 'concrete', 'masonry', 'landscaping',
  'pool', 'cabinets', 'countertops', 'windows_doors', 'insulation',
  'stucco', 'siding', 'general', 'other'
];

/**
 * Validate vendor information
 * @param {Object} extracted - Extracted invoice data
 * @returns {Object} { valid: boolean, issues: string[], corrections: Object }
 */
function validateVendor(extracted) {
  const result = { valid: true, issues: [], corrections: {}, score: 1.0 };

  const vendor = extracted.vendor || {};
  const companyName = vendor.companyName || '';

  // Check 1: Company name exists and has reasonable length
  if (!companyName || companyName.trim().length === 0) {
    result.issues.push('Missing vendor company name');
    result.score -= 0.3;
    result.valid = false;
  } else if (companyName.length < 3) {
    result.issues.push(`Vendor name too short: "${companyName}"`);
    result.score -= 0.15;
  } else if (companyName.length > 100) {
    result.issues.push(`Vendor name unusually long (${companyName.length} chars)`);
    result.score -= 0.05;
  }

  // Check 2: Phone format validation (if present)
  if (vendor.phone) {
    const phoneDigits = vendor.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 11) {
      result.issues.push(`Invalid phone number format: ${vendor.phone}`);
      result.score -= 0.05;
    }
  }

  // Check 3: Email format validation (if present)
  if (vendor.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(vendor.email)) {
      result.issues.push(`Invalid email format: ${vendor.email}`);
      result.score -= 0.05;
    }
  }

  // Check 4: Trade type validation
  if (vendor.tradeType) {
    const normalizedTrade = vendor.tradeType.toLowerCase().trim();
    if (!VALID_TRADE_TYPES.includes(normalizedTrade)) {
      result.issues.push(`Unrecognized trade type: ${vendor.tradeType}`);
      result.corrections.tradeType = 'other';
      result.score -= 0.05;
    }
  }

  // Check 5: Vendor name shouldn't be "Ross Built" (that's the customer, not vendor)
  if (companyName.toLowerCase().includes('ross built')) {
    result.issues.push('Vendor name contains "Ross Built" - this is likely the customer, not vendor');
    result.score -= 0.3;
    result.valid = false;
  }

  // AI-INT-04: Detect if vendor name looks like a job/customer name
  // Common patterns that suggest customer confusion:
  const jobPatterns = [
    /\d+\s+(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|way|blvd)/i,  // Address pattern
    /^[A-Z][a-z]+-\d+/,  // "Drummond-501" pattern (client-address)
    /^(mr|mrs|ms|dr)\.\s/i,  // Personal titles
    /residence|home|property/i  // Property references
  ];

  const looksLikeJob = jobPatterns.some(pattern => pattern.test(companyName));
  if (looksLikeJob) {
    result.issues.push(`Vendor name "${companyName}" looks like a job/address reference - may be customer, not vendor`);
    result.score -= 0.25;
    result.valid = false;
  }

  // Check if vendor name contains common job client names
  const suspiciousClientNames = ['drummond', 'crews', 'smith residence', 'johnson home'];
  const lowerName = companyName.toLowerCase();
  if (suspiciousClientNames.some(client => lowerName.includes(client) && lowerName.length < 30)) {
    result.issues.push(`Vendor name may be confused with known client: "${companyName}"`);
    result.score -= 0.2;
  }

  // AI-INT-04: Check for positive vendor indicators (boost confidence)
  const vendorIndicators = [
    /\b(inc|llc|corp|ltd|co|company|services|contractors|construction|supply|supplies)\b/i,
    /\b(plumbing|electrical|hvac|roofing|painting|flooring|carpentry)\b/i
  ];

  const hasVendorIndicator = vendorIndicators.some(pattern => pattern.test(companyName));
  if (hasVendorIndicator) {
    // Boost score if name looks like a business
    result.score = Math.min(result.score + 0.1, 1.0);
  }

  result.score = Math.max(0, result.score);
  return result;
}

// ============================================================
// INVOICE NUMBER VALIDATION
// ============================================================

/**
 * Validate and potentially correct invoice number
 * @param {Object} extracted - Extracted invoice data
 * @returns {Object} { valid: boolean, issues: string[], corrections: Object }
 */
function validateInvoiceNumber(extracted) {
  const result = { valid: true, issues: [], corrections: {}, score: 1.0 };

  let invoiceNumber = extracted.invoiceNumber || '';
  const originalInvoiceNumber = invoiceNumber;

  // Check 1: Invoice number exists
  if (!invoiceNumber || invoiceNumber.trim().length === 0) {
    result.issues.push('Missing invoice number');
    result.score -= 0.2;
    result.valid = false;
    return result;
  }

  // Apply OCR corrections
  const corrections = [];
  for (const rule of OCR_CORRECTIONS.invoiceNumber) {
    const before = invoiceNumber;
    invoiceNumber = invoiceNumber.replace(rule.pattern, rule.replacement);
    if (before !== invoiceNumber) {
      corrections.push(rule.description);
    }
  }

  if (corrections.length > 0) {
    result.corrections.invoiceNumber = invoiceNumber;
    result.corrections.originalInvoiceNumber = originalInvoiceNumber;
    result.issues.push(`Applied OCR corrections: ${corrections.join(', ')}`);
    // Small penalty for needing corrections
    result.score -= 0.05;
  }

  // Check 2: Reasonable length
  if (invoiceNumber.length < 2) {
    result.issues.push(`Invoice number too short: "${invoiceNumber}"`);
    result.score -= 0.1;
  } else if (invoiceNumber.length > 50) {
    result.issues.push(`Invoice number unusually long (${invoiceNumber.length} chars)`);
    result.score -= 0.05;
  }

  // Check 3: Check for suspicious characters that suggest OCR errors
  const suspiciousChars = invoiceNumber.match(/[^a-zA-Z0-9\-_#\/\s.]/g);
  if (suspiciousChars) {
    result.issues.push(`Invoice number contains suspicious characters: ${suspiciousChars.join('')}`);
    result.score -= 0.1;
  }

  // Check 4: Common OCR error patterns that weren't auto-fixed
  if (/[oO].*\d|\d.*[oO]/.test(invoiceNumber)) {
    result.issues.push('Invoice number may contain O/0 confusion - verify');
    result.score -= 0.05;
  }

  if (/[lI].*\d|\d.*[lI]/.test(invoiceNumber)) {
    result.issues.push('Invoice number may contain l/I/1 confusion - verify');
    result.score -= 0.05;
  }

  result.score = Math.max(0, result.score);
  return result;
}

// ============================================================
// CROSS-FIELD CONSISTENCY VALIDATION
// ============================================================

/**
 * Validate consistency across multiple fields
 * @param {Object} extracted - Extracted invoice data
 * @returns {Object} { valid: boolean, issues: string[], corrections: Object }
 */
async function validateConsistency(extracted) {
  const result = { valid: true, issues: [], corrections: {}, score: 1.0 };

  // Check 1: Credit memo should have negative amount
  if (extracted.invoiceType === 'credit_memo') {
    const totalAmount = parseFloat(extracted.totalAmount || extracted.amounts?.totalAmount || 0);
    if (totalAmount > 0) {
      result.issues.push('Invoice type is credit_memo but amount is positive');
      result.score -= 0.1;
    }
  }

  // Check 2: Line items should sum reasonably close to total
  const lineItems = extracted.lineItems || [];
  if (lineItems.length > 0) {
    const totalAmount = parseFloat(extracted.totalAmount || extracted.amounts?.totalAmount || 0);
    const lineItemSum = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const percentDiff = totalAmount > 0 ? Math.abs((lineItemSum - totalAmount) / totalAmount) : 0;

    if (percentDiff > 0.1 && Math.abs(lineItemSum - totalAmount) > 10) {
      result.issues.push(`Line items total ($${lineItemSum.toFixed(2)}) differs significantly from invoice total ($${totalAmount.toFixed(2)})`);
      result.score -= 0.1;
    }
  }

  // Check 3: Job reference should have at least one identifier
  const job = extracted.job || {};
  const hasJobRef = job.reference || job.address || job.clientName || job.poNumber;
  if (!hasJobRef) {
    result.issues.push('No job reference found (no client name, address, or PO number)');
    result.score -= 0.1;
  }

  // Check 4: If PO number is referenced, verify it exists (optional async check)
  if (job.poNumber && typeof supabase !== 'undefined') {
    try {
      const { data: po } = await supabase
        .from('v2_purchase_orders')
        .select('id, po_number')
        .ilike('po_number', `%${job.poNumber}%`)
        .limit(1)
        .single();

      if (!po) {
        result.issues.push(`Referenced PO "${job.poNumber}" not found in system`);
        result.score -= 0.05;
      }
    } catch (err) {
      // Ignore lookup errors - PO may be new
    }
  }

  // Check 5: Vendor trade should match line item descriptions (basic heuristic)
  if (extracted.vendor?.tradeType && lineItems.length > 0) {
    const trade = extracted.vendor.tradeType.toLowerCase();
    const descriptions = lineItems.map(i => (i.description || '').toLowerCase()).join(' ');

    // Simple keyword check for common trades
    const tradeKeywords = {
      'electrical': ['electrical', 'wire', 'panel', 'circuit', 'outlet'],
      'plumbing': ['plumb', 'pipe', 'drain', 'fixture', 'faucet'],
      'hvac': ['hvac', 'ac', 'air condition', 'duct', 'heat'],
      'drywall': ['drywall', 'sheetrock', 'gypsum'],
      'painting': ['paint', 'primer', 'coat'],
      'flooring': ['floor', 'carpet', 'hardwood', 'laminate'],
      'roofing': ['roof', 'shingle', 'tile', 'underlayment']
    };

    if (tradeKeywords[trade]) {
      const hasKeyword = tradeKeywords[trade].some(kw => descriptions.includes(kw));
      if (!hasKeyword) {
        result.issues.push(`Trade type "${trade}" may not match line item descriptions`);
        result.score -= 0.03;
      }
    }
  }

  result.score = Math.max(0, result.score);
  return result;
}

// ============================================================
// MAIN VALIDATION FUNCTION
// ============================================================

/**
 * Perform complete validation on extracted invoice data
 * @param {Object} extracted - Extracted invoice data from Stage 1
 * @returns {Object} { isValid: boolean, confidence: number, issues: string[], corrections: Object, breakdown: Object }
 */
async function validateExtraction(extracted) {
  const result = {
    isValid: true,
    confidence: 0,
    issues: [],
    corrections: {},
    breakdown: {
      amounts: null,
      dates: null,
      vendor: null,
      invoiceNumber: null,
      consistency: null
    },
    autoCorrectionsApplied: []
  };

  // Run all validations
  result.breakdown.amounts = validateAmounts(extracted);
  result.breakdown.dates = validateDates(extracted);
  result.breakdown.vendor = validateVendor(extracted);
  result.breakdown.invoiceNumber = validateInvoiceNumber(extracted);
  result.breakdown.consistency = await validateConsistency(extracted);

  // Aggregate results
  const validations = Object.values(result.breakdown);

  // Collect all issues
  for (const v of validations) {
    if (v && v.issues) {
      result.issues.push(...v.issues);
    }
  }

  // Collect all corrections
  for (const v of validations) {
    if (v && v.corrections) {
      Object.assign(result.corrections, v.corrections);
    }
  }

  // Track auto-corrections applied
  if (result.corrections.invoiceNumber) {
    result.autoCorrectionsApplied.push({
      field: 'invoiceNumber',
      original: result.corrections.originalInvoiceNumber,
      corrected: result.corrections.invoiceNumber
    });
  }
  if (result.corrections.totalAmount) {
    result.autoCorrectionsApplied.push({
      field: 'totalAmount',
      original: extracted.totalAmount || extracted.amounts?.totalAmount,
      corrected: result.corrections.totalAmount
    });
  }
  if (result.corrections.invoiceType) {
    result.autoCorrectionsApplied.push({
      field: 'invoiceType',
      original: extracted.invoiceType,
      corrected: result.corrections.invoiceType
    });
  }

  // Calculate overall validity
  result.isValid = validations.every(v => v === null || v.valid !== false);

  // Calculate confidence score (weighted average)
  const weights = {
    amounts: 0.30,      // Amount accuracy is critical
    dates: 0.15,        // Date accuracy important
    vendor: 0.25,       // Vendor identification important
    invoiceNumber: 0.15, // Invoice number for duplicate detection
    consistency: 0.15   // Cross-field consistency
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (result.breakdown[key]) {
      weightedSum += result.breakdown[key].score * weight;
      totalWeight += weight;
    }
  }

  result.confidence = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  result.confidence = Math.round(result.confidence * 100) / 100; // Round to 2 decimals

  return result;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  validateExtraction,
  validateAmounts,
  validateDates,
  validateVendor,
  validateInvoiceNumber,
  validateConsistency,
  applyOCRCorrections,
  correctAmount,
  isValidDate,
  OCR_CORRECTIONS,
  VALID_TRADE_TYPES
};
