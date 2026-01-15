/**
 * Duplicate Invoice Detection Module
 * Consolidated logic for detecting duplicate invoices
 */

const crypto = require('crypto');
const { supabase } = require('../config');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate SHA-256 hash from PDF buffer for exact file matching
 */
function generatePDFHash(pdfBuffer) {
  return crypto.createHash('sha256').update(pdfBuffer).digest('hex');
}

/**
 * Normalize invoice number for comparison
 * Removes common variations like "INV-", "#", spaces, etc.
 */
function normalizeInvoiceNumber(invNum) {
  if (!invNum) return '';
  return invNum
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '') // Remove all non-alphanumeric
    .replace(/^(inv|invoice|no|num|#)+/g, ''); // Remove common prefixes
}

// ============================================================================
// CONFIDENCE LEVELS
// ============================================================================

const DUPLICATE_CONFIDENCE = {
  EXACT_PDF: 1.0,          // Same PDF file
  EXACT_NUMBER: 0.99,      // Same invoice number from same vendor
  AMOUNT_AND_DATE: 0.85,   // Same amount + same date
  SIMILAR_NUMBER: 0.80,    // Similar number + same amount
  SAME_JOB_NUMBER: 0.70,   // Same invoice number on same job (different vendor)
  AMOUNT_ONLY: 0.50        // Same amount only
};

// ============================================================================
// MAIN DUPLICATE CHECK FUNCTIONS
// ============================================================================

/**
 * Quick duplicate check - exact vendor + invoice number match
 * Used for invoice edits where we just need to check if changing number would create duplicate
 *
 * @param {string} vendorId - Vendor UUID
 * @param {string} invoiceNumber - Invoice number
 * @param {number} amount - Invoice amount (for response info)
 * @param {string} excludeId - Invoice ID to exclude (for edits)
 * @returns {Promise<Object>} { isDuplicate: boolean, existingInvoice?: Object, message?: string }
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
 * Comprehensive duplicate check with confidence scoring
 * Used during AI processing and upload to find potential duplicates
 *
 * @param {string} vendorId - Vendor UUID
 * @param {string} invoiceNumber - Invoice number
 * @param {number} amount - Invoice amount
 * @param {Object} options - Optional parameters
 * @param {string} options.invoiceDate - Invoice date (YYYY-MM-DD)
 * @param {Buffer} options.pdfBuffer - PDF buffer for hash comparison
 * @param {string} options.jobId - Job ID for job-scoped duplicate check
 * @param {string} options.excludeId - Invoice ID to exclude (for edits)
 * @returns {Promise<Object>} { isDuplicate, isLikelyDuplicate, possibleDuplicates[] }
 */
async function checkForDuplicates(vendorId, invoiceNumber, amount, options = {}) {
  const { invoiceDate, pdfBuffer, jobId, excludeId } = options;
  const possibleDuplicates = [];

  // 1. Check PDF hash if provided (exact file duplicate)
  if (pdfBuffer) {
    const pdfHash = generatePDFHash(pdfBuffer);
    const { data: hashMatch } = await supabase
      .from('v2_invoice_hashes')
      .select('invoice_id')
      .eq('hash', pdfHash)
      .single();

    if (hashMatch && hashMatch.invoice_id !== excludeId) {
      const { data: existingInv } = await supabase
        .from('v2_invoices')
        .select('id, invoice_number, amount, status, created_at, vendor:v2_vendors(name), job:v2_jobs(name)')
        .eq('id', hashMatch.invoice_id)
        .is('deleted_at', null)
        .single();

      if (existingInv) {
        possibleDuplicates.push({
          ...existingInv,
          matchReason: 'exact_pdf_match',
          matchDescription: 'Exact same PDF file already uploaded',
          confidence: DUPLICATE_CONFIDENCE.EXACT_PDF
        });
      }
    }
  }

  // 2. Check vendor-scoped duplicates
  if (vendorId) {
    let query = supabase
      .from('v2_invoices')
      .select('id, invoice_number, invoice_date, amount, status, created_at, vendor:v2_vendors(name), job:v2_jobs(name)')
      .eq('vendor_id', vendorId)
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: vendorInvoices } = await query;

    const normalizedNew = normalizeInvoiceNumber(invoiceNumber);
    const newAmount = parseFloat(amount) || 0;
    const newDate = invoiceDate ? new Date(invoiceDate).toISOString().split('T')[0] : null;

    for (const inv of (vendorInvoices || [])) {
      // Skip if already found as PDF match
      if (possibleDuplicates.some(d => d.id === inv.id)) continue;

      const normalizedExisting = normalizeInvoiceNumber(inv.invoice_number);
      const existingAmount = parseFloat(inv.amount) || 0;
      const existingDate = inv.invoice_date ? new Date(inv.invoice_date).toISOString().split('T')[0] : null;

      // Exact invoice number match (same vendor)
      if (normalizedNew && normalizedNew === normalizedExisting) {
        possibleDuplicates.push({
          ...inv,
          matchReason: 'exact_invoice_number',
          matchDescription: `Same invoice number "${inv.invoice_number}" from this vendor`,
          confidence: DUPLICATE_CONFIDENCE.EXACT_NUMBER
        });
        continue;
      }

      // Same amount + same date (high confidence)
      if (newAmount > 0 && Math.abs(existingAmount - newAmount) < 0.01 && newDate && existingDate === newDate) {
        possibleDuplicates.push({
          ...inv,
          matchReason: 'same_amount_and_date',
          matchDescription: `Same amount ($${newAmount.toLocaleString()}) and date (${newDate})`,
          confidence: DUPLICATE_CONFIDENCE.AMOUNT_AND_DATE
        });
        continue;
      }

      // Same amount within 1% + similar invoice number
      const amountMatch = newAmount > 0 && Math.abs(existingAmount - newAmount) / newAmount < 0.01;
      const numberSimilar = normalizedNew && normalizedExisting &&
        (normalizedNew.includes(normalizedExisting) || normalizedExisting.includes(normalizedNew));

      if (amountMatch && numberSimilar) {
        possibleDuplicates.push({
          ...inv,
          matchReason: 'similar_number_same_amount',
          matchDescription: `Similar invoice number and same amount`,
          confidence: DUPLICATE_CONFIDENCE.SIMILAR_NUMBER
        });
        continue;
      }

      // Same amount only (lower confidence)
      if (amountMatch) {
        possibleDuplicates.push({
          ...inv,
          matchReason: 'same_amount',
          matchDescription: `Same amount ($${existingAmount.toLocaleString()})`,
          confidence: DUPLICATE_CONFIDENCE.AMOUNT_ONLY
        });
      }
    }
  }

  // 3. Check job-scoped duplicates (same invoice number on same job from different vendor)
  if (jobId && invoiceNumber) {
    const normalizedNew = normalizeInvoiceNumber(invoiceNumber);

    let query = supabase
      .from('v2_invoices')
      .select('id, invoice_number, amount, status, vendor:v2_vendors(name), job:v2_jobs(name)')
      .eq('job_id', jobId)
      .neq('vendor_id', vendorId || '')
      .is('deleted_at', null);

    if (excludeId) {
      query = query.neq('id', excludeId);
    }

    const { data: jobInvoices } = await query;

    for (const inv of (jobInvoices || [])) {
      if (possibleDuplicates.some(d => d.id === inv.id)) continue;

      const normalizedExisting = normalizeInvoiceNumber(inv.invoice_number);
      if (normalizedNew && normalizedNew === normalizedExisting) {
        possibleDuplicates.push({
          ...inv,
          matchReason: 'same_number_same_job',
          matchDescription: `Same invoice number "${inv.invoice_number}" on this job (different vendor: ${inv.vendor?.name})`,
          confidence: DUPLICATE_CONFIDENCE.SAME_JOB_NUMBER
        });
      }
    }
  }

  // Sort by confidence
  possibleDuplicates.sort((a, b) => b.confidence - a.confidence);

  return {
    isDuplicate: possibleDuplicates.some(d => d.confidence >= 0.95),
    isLikelyDuplicate: possibleDuplicates.some(d => d.confidence >= 0.80),
    possibleDuplicates: possibleDuplicates.slice(0, 5) // Top 5 matches
  };
}

// ============================================================================
// PDF HASH STORAGE
// ============================================================================

/**
 * Store PDF hash for future duplicate detection
 */
async function storePDFHash(invoiceId, pdfBuffer) {
  if (!pdfBuffer || !invoiceId) return;

  const hash = generatePDFHash(pdfBuffer);

  // Upsert - update if exists, insert if not
  await supabase
    .from('v2_invoice_hashes')
    .upsert({
      invoice_id: invoiceId,
      hash,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'invoice_id'
    });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Main duplicate check functions
  checkDuplicate,           // Quick exact-match check (for edits)
  checkForDuplicates,       // Comprehensive check with confidence scoring

  // PDF hash functions
  generatePDFHash,
  storePDFHash,

  // Utility functions
  normalizeInvoiceNumber,

  // Constants
  DUPLICATE_CONFIDENCE
};
