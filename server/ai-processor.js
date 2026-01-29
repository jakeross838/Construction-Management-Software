/**
 * Ross Built CMS - AI Invoice Processor
 *
 * Uses Claude AI to extract invoice data from PDFs:
 * - Vendor name, contact info, trade type
 * - Invoice number, date, amounts
 * - Job/address matching with confidence scores
 * - Line items with cost codes
 *
 * After extraction:
 * - Calculates confidence scores for each field
 * - Auto-matches to existing job (with confidence thresholds)
 * - Auto-matches or creates vendor
 * - Auto-matches or creates draft PO
 * - Sets review flags based on confidence
 * - Renames PDF with standardized convention
 */

const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../config');
const standards = require('./standards');
const logger = require('./utils/logger');
const aiLearning = require('./ai-learning');
const ocrProcessor = require('./ocr-processor');
const invoiceValidator = require('./invoice-validator');
const poMatcher = require('./po-matcher');
const priceCapture = require('./price-capture');

// Consolidated duplicate detection
const {
  checkForDuplicates,
  storePDFHash,
  generatePDFHash,
  normalizeInvoiceNumber
} = require('./duplicate-check');

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Confidence thresholds - tiered system for invoice processing decisions
const CONFIDENCE_THRESHOLDS = {
  AUTO_APPROVE: 0.95,   // High confidence - auto-accept, minimal review needed
  HUMAN_REVIEW: 0.80,   // Medium confidence - route to review queue
  NEEDS_ATTENTION: 0.70, // Low confidence - flag for investigation
  REJECT: 0.50,          // Very low - likely extraction failure

  // Legacy aliases for backward compatibility (used by findMatchingJob)
  HIGH: 0.90,    // Auto-assign, no review
  MEDIUM: 0.70,  // Auto-assign with review flag (raised from 0.60)
  LOW: 0.70      // AI-INT-01: Don't auto-assign, show picker (raised from 0.60)
};

// ============================================================
// DYNAMIC COST CODE MAPPINGS - Loaded from database
// ============================================================
// These are loaded from v2_trade_cost_mappings and v2_description_cost_mappings
// tables at startup and cached for performance. Use refreshMappings() to reload.

let TRADE_COST_CODE_MAP = {};  // trade_type -> [code1, code2, ...]
let DESCRIPTION_COST_CODE_MAP = {};  // keyword -> code
let mappingsLoaded = false;
let mappingsLoadPromise = null;

/**
 * Load cost code mappings from database
 * Caches results and only reloads when explicitly requested
 */
async function loadMappingsFromDatabase() {
  try {
    // Load trade mappings
    const { data: tradeMappings, error: tradeError } = await supabase
      .from('v2_trade_cost_mappings')
      .select('trade_type, priority, cost_code:v2_cost_codes(code)')
      .order('priority', { ascending: true });

    if (tradeError) {
      logger.error('Error loading trade mappings', { component: 'ai', error: tradeError.message });
    } else {
      TRADE_COST_CODE_MAP = {};
      for (const m of tradeMappings || []) {
        if (!TRADE_COST_CODE_MAP[m.trade_type]) {
          TRADE_COST_CODE_MAP[m.trade_type] = [];
        }
        if (m.cost_code?.code) {
          TRADE_COST_CODE_MAP[m.trade_type].push(m.cost_code.code);
        }
      }
      logger.info('Trade mappings loaded', { component: 'ai', count: Object.keys(TRADE_COST_CODE_MAP).length });
    }

    // Load description mappings
    const { data: descMappings, error: descError } = await supabase
      .from('v2_description_cost_mappings')
      .select('keyword, cost_code:v2_cost_codes(code)');

    if (descError) {
      logger.error('Error loading description mappings', { component: 'ai', error: descError.message });
    } else {
      DESCRIPTION_COST_CODE_MAP = {};
      for (const m of descMappings || []) {
        if (m.cost_code?.code) {
          DESCRIPTION_COST_CODE_MAP[m.keyword] = m.cost_code.code;
        }
      }
      logger.info('Description mappings loaded', { component: 'ai', count: Object.keys(DESCRIPTION_COST_CODE_MAP).length });
    }

    mappingsLoaded = true;
  } catch (err) {
    logger.error('Failed to load mappings', { component: 'ai', error: err.message });
  }
}

/**
 * Ensure mappings are loaded before use
 */
async function ensureMappingsLoaded() {
  if (mappingsLoaded) return;

  // Prevent multiple simultaneous loads
  if (!mappingsLoadPromise) {
    mappingsLoadPromise = loadMappingsFromDatabase();
  }
  await mappingsLoadPromise;
  mappingsLoadPromise = null;
}

/**
 * Force refresh of mappings from database
 * Call this after adding/updating mappings
 */
async function refreshMappings() {
  mappingsLoaded = false;
  await loadMappingsFromDatabase();
}

// Load mappings on module init
loadMappingsFromDatabase();

// NOTE: TRADE_COST_CODE_MAP and DESCRIPTION_COST_CODE_MAP are now loaded
// dynamically from the database tables v2_trade_cost_mappings and
// v2_description_cost_mappings. See loadMappingsFromDatabase() above.

// ============================================================
// EXTRACTION SCHEMA
// ============================================================

const INVOICE_SCHEMA = `{
  "documentType": "invoice",
  "vendor": {
    "companyName": "string, the company SENDING the invoice (NOT Ross Built)",
    "tradeType": "string: plumbing, electrical, hvac, drywall, framing, roofing, painting, flooring, tile, concrete, masonry, landscaping, pool, cabinets, countertops, windows_doors, insulation, stucco, siding, general, other",
    "address": "string or null",
    "phone": "string or null",
    "email": "string or null"
  },
  "invoiceNumber": "string, vendor's invoice reference number",
  "invoiceDate": "string, YYYY-MM-DD format",
  "dueDate": "string or null, YYYY-MM-DD format",
  "invoiceType": "string: 'standard' | 'credit_memo' | 'debit_memo' - detect from document title/header keywords",
  "job": {
    "reference": "string, the job/project reference - could be client name, PO#, project name, or address",
    "address": "string or null, street address if available",
    "clientName": "string or null, client/homeowner name if mentioned",
    "poNumber": "string or null, PO# or job reference number"
  },
  "amounts": {
    "subtotal": "number or null, before tax",
    "taxAmount": "number or null",
    "totalAmount": "number, total invoice amount"
  },
  "lineItems": [
    {
      "description": "string, work/item description",
      "costCode": "string or null, if mentioned (e.g., 09250, Drywall)",
      "quantity": "number or null",
      "unit": "string or null (SF, LF, EA, HR, LS)",
      "unitPrice": "number or null",
      "amount": "number"
    }
  ],
  "notes": "string or null, any special notes",
  "splitSuggestion": {
    "shouldSplit": "boolean, true if document appears to contain multiple separate invoices OR covers multiple jobs",
    "splitType": "string: 'multi_invoice' | 'multi_job' | null - what type of split is needed",
    "reason": "string or null, why split is suggested",
    "suggestedSplits": "array of objects describing each split - for multi_invoice: {invoiceNumber, pageHint}, for multi_job: {jobReference, amount, description}"
  },
  "extractionConfidence": {
    "vendor": "number 0-1, confidence in vendor extraction",
    "amount": "number 0-1, confidence in amount extraction",
    "invoiceNumber": "number 0-1, confidence in invoice number",
    "date": "number 0-1, confidence in date extraction",
    "job": "number 0-1, confidence in job/project extraction"
  }
}`;

// ============================================================
// PDF TEXT EXTRACTION
// ============================================================

/**
 * Extract text content from PDF buffer
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (err) {
    logger.error('PDF parse error', { component: 'ai', error: err.message });
    return null;
  }
}

/**
 * Extract data from a scanned PDF using Claude's vision capability
 * Used when pdf-parse returns empty/minimal text
 */
async function extractFromScannedPDF(pdfBuffer, schema, systemPrompt) {
  const base64PDF = pdfBuffer.toString('base64');

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: base64PDF
          }
        },
        {
          type: 'text',
          text: `Please analyze this scanned PDF document and extract all information according to this schema:\n\n${schema}\n\nReturn ONLY valid JSON, no markdown code blocks.`
        }
      ]
    }]
  });

  let jsonStr = response.content[0].text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }
  return JSON.parse(jsonStr);
}

/**
 * Extract data from an image using Claude's vision capability
 * Supports JPEG, PNG, GIF, WebP
 */
async function extractFromImage(base64Image, mediaType, schema, systemPrompt) {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: base64Image
          }
        },
        {
          type: 'text',
          text: `Please analyze this document image and extract all information according to this schema:\n\n${schema}\n\nReturn ONLY valid JSON, no markdown code blocks.`
        }
      ]
    }]
  });

  let jsonStr = response.content[0].text.trim();
  if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
  }
  return JSON.parse(jsonStr);
}

/**
 * Extract invoice data from a text document (Word, Excel)
 * Uses the existing text-based extraction with the extracted text
 */
async function extractInvoiceFromText(documentText, filename, documentType) {
  logger.info('Extracting invoice from text', { component: 'ai', documentType, chars: documentText.length });
  return await extractInvoiceData(documentText, filename);
}

/**
 * Extract invoice data from an image using Claude Vision
 */
async function extractInvoiceFromImage(base64Image, mediaType, filename) {
  logger.info('Extracting invoice from image', { component: 'ai', filename, mediaType });

  const systemPrompt = `You are an expert construction invoice processing assistant for Ross Built Custom Homes, a custom home builder in Florida.

CRITICAL IDENTIFICATION RULES:
1. Ross Built Custom Homes (or "Ross Built") is ALWAYS the general contractor being billed - NEVER the vendor
2. The VENDOR is the subcontractor/supplier company SENDING the invoice - they performed work or supplied materials
3. Look for "Bill To:", "Invoice To:", "Customer:" fields - these typically show Ross Built
4. Look for company letterhead, logo, or "From:" - this is typically the VENDOR

EXTRACTION ACCURACY REQUIREMENTS:
1. Invoice numbers: Look for "Invoice #", "Inv #", "Invoice No.", "Reference #" - extract exactly as shown
2. Amounts: Extract the TOTAL AMOUNT DUE. Look for "Total", "Amount Due", "Balance Due"
3. Dates: Convert all dates to YYYY-MM-DD format
4. Line items: Extract ALL work items with their individual amounts

JOB/PROJECT IDENTIFICATION:
Job references can appear in MANY forms. Check ALL of these locations:
1. "P.O.#" or "PO#" field - often contains client name or job reference
2. "Subject:", "Job:", "Project:", "Site:", "Location:", "Re:" fields
3. Any street address that is NOT the vendor's address
4. Client/homeowner last name

Return ONLY valid JSON, no markdown code blocks.`;

  return await extractFromImage(base64Image, mediaType, INVOICE_SCHEMA, systemPrompt);
}

// ============================================================
// AI EXTRACTION
// ============================================================

/**
 * Extract invoice data using Claude AI with confidence scores
 */
async function extractInvoiceData(pdfText, filename) {
  const prompt = `Analyze this invoice document and extract ALL information.

FILE: ${filename}

DOCUMENT CONTENTS:
${pdfText}

OUTPUT SCHEMA:
${INVOICE_SCHEMA}

IMPORTANT:
- The vendor is the company SENDING the invoice (doing the work)
- Ross Built is the contractor being billed, NOT the vendor
- Extract ALL line items with amounts
- If cost codes are mentioned (like 09250 or "Division 9"), include them
- Dates must be YYYY-MM-DD format
- Return ONLY valid JSON, no markdown

For extractionConfidence, rate each field 0-1:
- 1.0 = clearly visible and unambiguous
- 0.8-0.9 = visible but might have minor uncertainty
- 0.5-0.7 = partially visible or inferred
- 0.3-0.5 = mostly inferred from context
- 0-0.3 = not found, using defaults`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are an expert construction invoice processing assistant for Ross Built Custom Homes, a custom home builder in Florida.

CRITICAL IDENTIFICATION RULES:
1. Ross Built Custom Homes (or "Ross Built") is ALWAYS the general contractor being billed - NEVER the vendor
2. The VENDOR is the subcontractor/supplier company SENDING the invoice - they performed work or supplied materials
3. Look for "Bill To:", "Invoice To:", "Customer:" fields - these typically show Ross Built
4. Look for company letterhead, logo, or "From:" - this is typically the VENDOR

EXTRACTION ACCURACY REQUIREMENTS:
1. Invoice numbers: Look for "Invoice #", "Inv #", "Invoice No.", "Reference #" - extract exactly as shown including any prefixes like "INV-"
2. Amounts: Extract the TOTAL AMOUNT DUE, not subtotals. Look for "Total", "Amount Due", "Balance Due", "Grand Total"
3. Dates: Convert all dates to YYYY-MM-DD format. For dates like "12.19.2025", convert to "2025-12-19". Look for "Invoice Date", "Date", "Dated"
4. Line items: Extract ALL work items with their individual amounts

JOB/PROJECT IDENTIFICATION - CRITICAL:
Job references can appear in MANY forms. Check ALL of these locations:
1. "P.O.#" or "PO#" field - often contains client name or job reference (e.g., "Drummond")
2. "Subject:" line - may contain job/project name
3. "Job:", "Project:", "Site:", "Location:", "Re:" fields
4. Any street address that is NOT the vendor's address
5. Client/homeowner last name (jobs are often named after clients like "Drummond", "Smith", "Johnson")

For the job.reference field, extract the BEST identifier found - this could be:
- A client name like "Drummond" or "Smith"
- A street address like "501 74th St"
- A project name like "Drummond Change Orders"

INVOICE TYPE DETECTION:
Determine if this is a standard invoice, credit memo, or debit memo:
- Look for "Credit Memo", "Credit Note", "CM", "Refund", "Return", "Adjustment" = credit_memo
- Look for "Debit Memo", "Debit Note", "DM", "Additional Charge" = debit_memo
- NEGATIVE amounts usually indicate credit_memo
- If none of these indicators, use "standard"

SPLIT INVOICE DETECTION:
Check if this document needs to be split for either reason:

A) MULTI-INVOICE (multiple invoices in one document):
- Look for multiple distinct "Invoice #", "Invoice Number", or "Inv #" values
- Look for multiple "Total" or "Amount Due" sections with different values
- Look for section headers like "Invoice 1", "Invoice 2" or page separators
- Look for repeated vendor header/letterhead appearing multiple times
If detected: set splitType="multi_invoice", list each invoice in suggestedSplits

B) MULTI-JOB (one invoice covering multiple jobs/projects):
- Look for multiple different job references, addresses, or client names
- Look for line items grouped by job (e.g., "Drummond: $5000" then "Crews: $3000")
- Look for multiple PO numbers referencing different jobs
- Look for sections labeled with different project names
If detected: set splitType="multi_job", list each job with amount in suggestedSplits

Set splitSuggestion.shouldSplit to true if EITHER multi-invoice OR multi-job is detected.

TRADE TYPE IDENTIFICATION:
Determine trade type from line item descriptions:
- "Electrical", "wiring", "panel", "circuit" = electrical
- "Plumbing", "pipe", "drain", "fixture" = plumbing
- "HVAC", "AC", "air conditioning", "ductwork" = hvac
- "Drywall", "sheetrock", "gypsum" = drywall
- "Framing", "lumber", "studs" = framing
etc.

CONFIDENCE SCORING GUIDELINES:
- 0.95-1.0: Field is clearly visible, unambiguous, professional format
- 0.80-0.94: Field is visible but has minor formatting issues or slight ambiguity
- 0.60-0.79: Field is partially visible, requires some inference
- 0.40-0.59: Field is mostly inferred from context clues
- 0.00-0.39: Field not found or highly uncertain

Return ONLY valid JSON, no markdown code blocks or explanations.`,
      messages: [{ role: 'user', content: prompt }]
    });

    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const data = JSON.parse(jsonStr);
    return normalizeExtractedData(data);
  } catch (err) {
    throw new Error(`AI extraction failed: ${err.message}`);
  }
}

/**
 * Normalize extracted data
 */
function normalizeExtractedData(data) {
  const normalized = { ...data };

  // Normalize vendor
  if (normalized.vendor) {
    if (normalized.vendor.companyName) {
      normalized.vendor.companyName = standards.toTitleCase(normalized.vendor.companyName);
    }
    if (normalized.vendor.phone) {
      normalized.vendor.phone = standards.normalizePhone(normalized.vendor.phone);
    }
    if (normalized.vendor.email) {
      normalized.vendor.email = normalized.vendor.email.toLowerCase();
    }
    if (normalized.vendor.tradeType && !standards.validValues.tradeTypes.includes(normalized.vendor.tradeType)) {
      normalized.vendor.tradeType = 'other';
    }
  }

  // Normalize dates
  if (normalized.invoiceDate) {
    normalized.invoiceDate = standards.normalizeDate(normalized.invoiceDate);
  }
  if (normalized.dueDate) {
    normalized.dueDate = standards.normalizeDate(normalized.dueDate);
  }

  // Default invoice date
  if (!normalized.invoiceDate) {
    normalized.invoiceDate = new Date().toISOString().split('T')[0];
  }

  // Normalize job address
  if (normalized.job?.address) {
    normalized.job.address = standards.normalizeAddress(normalized.job.address);
  }

  // Flatten amounts
  if (normalized.amounts) {
    normalized.totalAmount = normalized.amounts.totalAmount;
    normalized.subtotal = normalized.amounts.subtotal;
    normalized.taxAmount = normalized.amounts.taxAmount;
  }

  // Normalize invoice type - detect credits from negative amounts
  const validInvoiceTypes = ['standard', 'credit_memo', 'debit_memo'];
  if (!normalized.invoiceType || !validInvoiceTypes.includes(normalized.invoiceType)) {
    // Auto-detect credit from negative amount
    if (normalized.totalAmount && parseFloat(normalized.totalAmount) < 0) {
      normalized.invoiceType = 'credit_memo';
    } else {
      normalized.invoiceType = 'standard';
    }
  }

  // Default confidence scores if not provided - calculate based on data quality
  if (!normalized.extractionConfidence) {
    normalized.extractionConfidence = {
      vendor: calculateVendorConfidence(normalized.vendor),
      amount: calculateAmountConfidence(normalized.totalAmount, normalized.amounts),
      invoiceNumber: calculateInvoiceNumberConfidence(normalized.invoiceNumber),
      date: calculateDateConfidence(normalized.invoiceDate),
      job: calculateJobConfidence(normalized.job)
    };
  }

  return normalized;
}

// ============================================================
// CONFIDENCE CALCULATION HELPERS
// ============================================================

/**
 * Calculate vendor confidence based on data quality
 */
function calculateVendorConfidence(vendor) {
  if (!vendor?.companyName) return 0.25;

  let confidence = 0.6; // Base confidence if we have a name

  // Boost for longer, more specific names (less likely to be misread)
  if (vendor.companyName.length > 10) confidence += 0.08;
  if (vendor.companyName.length > 20) confidence += 0.05;

  // Boost for having additional contact info (more reliable extraction)
  if (vendor.phone) confidence += 0.07;
  if (vendor.email) confidence += 0.08;
  if (vendor.address) confidence += 0.05;

  // Boost for specific trade type (not 'other')
  if (vendor.tradeType && vendor.tradeType !== 'other') confidence += 0.06;

  return Math.min(confidence, 0.98);
}

/**
 * Calculate amount confidence based on data quality
 */
function calculateAmountConfidence(totalAmount, amounts) {
  if (!totalAmount && totalAmount !== 0) return 0.3;

  let confidence = 0.7; // Base confidence if we have an amount

  // Boost if we have matching subtotal + tax = total (internally consistent)
  if (amounts?.subtotal && amounts?.taxAmount) {
    const calculated = (amounts.subtotal || 0) + (amounts.taxAmount || 0);
    if (Math.abs(calculated - totalAmount) < 0.01) {
      confidence += 0.15; // High boost for internally consistent amounts
    }
  }

  // Boost for reasonable amount ranges
  if (totalAmount > 100 && totalAmount < 500000) confidence += 0.05;

  // Slight penalty for round numbers (might be estimates)
  if (totalAmount % 100 === 0 && totalAmount > 1000) confidence -= 0.03;

  return Math.min(Math.max(confidence, 0.4), 0.98);
}

/**
 * Calculate invoice number confidence based on format
 */
function calculateInvoiceNumberConfidence(invoiceNumber) {
  if (!invoiceNumber) return 0.2;

  let confidence = 0.65; // Base confidence

  const inv = String(invoiceNumber);

  // Boost for standard invoice number patterns
  if (/^INV[-_]?\d+$/i.test(inv)) confidence += 0.18;
  else if (/^\d{4,10}$/.test(inv)) confidence += 0.12; // Pure numeric
  else if (/^[A-Z]{2,4}[-_]?\d{3,}$/i.test(inv)) confidence += 0.15; // PREFIX-123
  else if (inv.length >= 4 && inv.length <= 20) confidence += 0.08;

  // Penalty for very short or very long (likely OCR error)
  if (inv.length < 3) confidence -= 0.15;
  if (inv.length > 25) confidence -= 0.1;

  // Penalty for suspicious characters
  if (/[^\w\-_#\/]/.test(inv)) confidence -= 0.08;

  return Math.min(Math.max(confidence, 0.25), 0.97);
}

/**
 * Calculate date confidence based on format and validity
 */
function calculateDateConfidence(dateStr) {
  if (!dateStr) return 0.3;

  let confidence = 0.7; // Base confidence

  // Check if it's a valid date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return 0.25;

  const now = new Date();
  const diffDays = Math.abs((now - date) / (1000 * 60 * 60 * 24));

  // Boost for dates within reasonable range (last 90 days to 30 days future)
  if (diffDays <= 90) confidence += 0.12;
  else if (diffDays <= 180) confidence += 0.05;
  else if (diffDays > 365) confidence -= 0.15; // Penalty for very old dates

  // Boost for standard format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) confidence += 0.08;

  return Math.min(Math.max(confidence, 0.3), 0.96);
}

/**
 * Calculate job reference confidence based on data quality
 */
function calculateJobConfidence(job) {
  if (!job) return 0.2;

  let confidence = 0.5; // Base confidence

  // Boost for different types of references
  if (job.address) {
    confidence += 0.15;
    // Extra boost for street number (more specific)
    if (/\d+/.test(job.address)) confidence += 0.08;
  }

  if (job.clientName) {
    confidence += 0.12;
    // Extra boost for longer names
    if (job.clientName.length > 5) confidence += 0.05;
  }

  if (job.poNumber) confidence += 0.1;
  if (job.reference) confidence += 0.08;

  // Multiple references increase confidence
  const refCount = [job.address, job.clientName, job.poNumber, job.reference].filter(Boolean).length;
  if (refCount >= 2) confidence += 0.1;

  return Math.min(confidence, 0.95);
}

// ============================================================
// SMART JOB DETECTION - SCAN TEXT FOR KNOWN JOBS
// ============================================================

/**
 * Scan raw text and filename for known job names/addresses
 * This is a fallback when AI extraction fails to find the job reference
 * @param {string} rawText - The raw extracted text from the document
 * @param {string} filename - Original filename (may contain job hints)
 * @returns {Object} { job, confidence, matchedText, matchStrategy }
 */
async function scanTextForKnownJobs(rawText, filename = '') {
  // Get all active jobs
  const { data: jobs, error } = await supabase
    .from('v2_jobs')
    .select('id, name, address, client_name, status')
    .eq('status', 'active');

  if (error || !jobs || jobs.length === 0) {
    return null;
  }

  // Normalize text for searching (lowercase, remove extra whitespace)
  const normalizedText = (rawText || '').toLowerCase().replace(/\s+/g, ' ');
  const normalizedFilename = (filename || '').toLowerCase().replace(/[_-]/g, ' ');
  const combinedText = `${normalizedFilename} ${normalizedText}`;

  // AI-INT-02: Extract specific regions from invoice text for targeted searching
  const shipToSection = extractSection(normalizedText, ['ship to', 'deliver to', 'job site', 'project site'], 150);
  const projectSection = extractSection(normalizedText, ['project:', 'project name', 'job:', 'job name', 'job #'], 100);
  const customerSection = extractSection(normalizedText, ['customer:', 'bill to:', 'sold to:', 'client:'], 100);

  let bestMatch = null;
  let bestConfidence = 0;
  let matchedText = '';
  let matchStrategy = '';

  for (const job of jobs) {
    // Extract search patterns from job
    const jobName = (job.name || '').toLowerCase();
    const jobAddress = (job.address || '').toLowerCase();
    const clientName = (job.client_name || '').toLowerCase();

    // Extract client name from job name (e.g., "Drummond-501 74th St" -> "drummond")
    const nameParts = jobName.split(/[-–\s]+/);
    const clientFromName = nameParts[0] || '';

    // Extract street number and name from address (e.g., "501 74th St" -> "501", "74th")
    const addressMatch = jobAddress.match(/(\d+)\s+(.+)/);
    const streetNumber = addressMatch ? addressMatch[1] : '';
    const streetName = addressMatch ? addressMatch[2].split(/\s+/)[0] : '';

    // Also extract from job name if it contains address
    const nameAddressMatch = jobName.match(/(\d+)\s+(\d+\w*)\s*(st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|way|blvd)/i);
    const nameStreetNumber = nameAddressMatch ? nameAddressMatch[1] : '';
    const nameStreetNum2 = nameAddressMatch ? nameAddressMatch[2] : '';

    // Search strategies with confidence scores
    const strategies = [
      // Strategy 1: Exact client name match (highest confidence)
      { pattern: clientFromName, confidence: 0.95, strategy: 'client_name_exact', minLength: 3 },

      // Strategy 2: Full job name match
      { pattern: jobName, confidence: 0.98, strategy: 'job_name_exact', minLength: 5 },

      // Strategy 3: Address match
      { pattern: jobAddress, confidence: 0.92, strategy: 'address_exact', minLength: 5 },

      // Strategy 4: Street number + partial street name
      { pattern: `${streetNumber} ${streetName}`, confidence: 0.88, strategy: 'street_match', minLength: 4 },
      { pattern: `${nameStreetNumber} ${nameStreetNum2}`, confidence: 0.88, strategy: 'name_street_match', minLength: 4 },

      // Strategy 5: Just the street number (if unique enough)
      { pattern: streetNumber, confidence: 0.70, strategy: 'street_number', minLength: 3 },
      { pattern: nameStreetNumber, confidence: 0.70, strategy: 'name_street_number', minLength: 3 },

      // Strategy 6: Client name variations
      { pattern: clientName, confidence: 0.90, strategy: 'client_name_db', minLength: 3 },
    ];

    for (const { pattern, confidence, strategy, minLength } of strategies) {
      if (!pattern || pattern.length < minLength) continue;

      // Check if pattern exists in combined text
      if (combinedText.includes(pattern)) {
        // Boost confidence if found in filename (more intentional)
        let adjustedConfidence = confidence;
        let sectionMatch = '';

        if (normalizedFilename.includes(pattern)) {
          adjustedConfidence = Math.min(confidence + 0.05, 0.99);
          sectionMatch = '_filename';
        }

        // AI-INT-02: Boost confidence if found in ship-to or project section
        if (shipToSection.includes(pattern)) {
          adjustedConfidence = Math.min(adjustedConfidence + 0.08, 0.99);
          sectionMatch += '_ship_to';
        }
        if (projectSection.includes(pattern)) {
          adjustedConfidence = Math.min(adjustedConfidence + 0.07, 0.99);
          sectionMatch += '_project';
        }
        if (customerSection.includes(pattern)) {
          adjustedConfidence = Math.min(adjustedConfidence + 0.05, 0.99);
          sectionMatch += '_customer';
        }

        if (adjustedConfidence > bestConfidence) {
          bestConfidence = adjustedConfidence;
          bestMatch = job;
          matchedText = pattern;
          matchStrategy = strategy + sectionMatch;
        }
      }

      // Also check for word boundary matches (e.g., "Drummond" not "Drummonder")
      const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(pattern)}\\b`, 'i');
      if (wordBoundaryRegex.test(combinedText)) {
        const adjustedConfidence = Math.min(confidence + 0.03, 0.99);
        if (adjustedConfidence > bestConfidence) {
          bestConfidence = adjustedConfidence;
          bestMatch = job;
          matchedText = pattern;
          matchStrategy = strategy + '_word_boundary';
        }
      }
    }
  }

  // AI-INT-01: Raised threshold from 0.5 to 0.70 to reduce false positives
  if (bestMatch && bestConfidence >= 0.70) {
    return {
      job: {
        id: bestMatch.id,
        name: bestMatch.name,
        address: bestMatch.address,
        client_name: bestMatch.client_name
      },
      confidence: bestConfidence,
      matchedText,
      matchStrategy,
      possibleMatches: [{
        id: bestMatch.id,
        name: bestMatch.name,
        confidence: bestConfidence,
        matchType: matchStrategy
      }]
    };
  }

  return null;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * AI-INT-02: Extract text section following a header keyword
 * @param {string} text - Full text to search
 * @param {Array} headers - Array of header keywords to look for
 * @param {number} chars - Number of characters to extract after header
 * @returns {string} Extracted section text
 */
function extractSection(text, headers, chars = 100) {
  for (const header of headers) {
    const idx = text.indexOf(header);
    if (idx !== -1) {
      const start = idx + header.length;
      const end = Math.min(start + chars, text.length);
      return text.slice(start, end).trim();
    }
  }
  return '';
}

// ============================================================
// JOB MATCHING WITH CONFIDENCE
// ============================================================

/**
 * Find matching job by reference (client name, address, or PO number) with confidence scoring
 * Uses fuzzy matching with Soundex for misspelling tolerance
 * @param {Object} jobData - { reference, address, clientName, poNumber }
 * @returns {Object} { job: Object|null, confidence: number, possibleMatches: Array }
 */
async function findMatchingJob(jobData) {
  // Handle both old string format and new object format
  const searchTerms = typeof jobData === 'string'
    ? { reference: jobData, address: jobData }
    : jobData || {};

  const { reference, address, clientName, poNumber } = searchTerms;

  // Build list of search terms to try
  const searchStrings = [reference, address, clientName, poNumber].filter(Boolean);

  if (searchStrings.length === 0) {
    return { job: null, confidence: 0, possibleMatches: [], reason: 'no_reference' };
  }

  // LEARNING: Check learned mappings first before fuzzy matching
  const learnedMatch = await aiLearning.findBestLearnedMapping('job', searchStrings);
  if (learnedMatch && learnedMatch.confidence >= 0.85) {
    // High confidence learned match - use it directly
    const { data: learnedJob } = await supabase
      .from('v2_jobs')
      .select('id, name, address, client_name, status')
      .eq('id', learnedMatch.matched_id)
      .single();

    if (learnedJob) {
      logger.info('Used learned job mapping', { component: 'ai-learning', searchString: searchStrings[0], jobName: learnedJob.name, confidence: Math.round(learnedMatch.confidence * 100), timesUsed: learnedMatch.times_used });
      return {
        job: {
          id: learnedJob.id,
          name: learnedJob.name,
          address: learnedJob.address,
          client_name: learnedJob.client_name
        },
        confidence: learnedMatch.confidence,
        possibleMatches: [{
          id: learnedJob.id,
          name: learnedJob.name,
          confidence: learnedMatch.confidence,
          matchType: 'learned_mapping'
        }],
        matchType: 'learned_mapping'
      };
    }
  }

  const { data: jobs, error } = await supabase
    .from('v2_jobs')
    .select('id, name, address, client_name, status');

  if (error || !jobs || jobs.length === 0) {
    return { job: null, confidence: 0, possibleMatches: [], reason: 'no_jobs_found' };
  }

  const matches = [];

  for (const job of jobs) {
    // Extract client name from job name (e.g., "Drummond-501 74th St" -> "Drummond")
    const jobNameParts = (job.name || '').split(/[-–]/);
    const jobClientFromName = jobNameParts[0]?.trim() || '';

    // Build list of job identifiers to match against
    const jobIdentifiers = [
      job.name,
      job.address,
      job.client_name,
      jobClientFromName
    ].filter(Boolean);

    let bestConfidence = 0;
    let bestMatchType = '';

    // Try each search term against each job identifier
    for (const searchTerm of searchStrings) {
      for (const jobId of jobIdentifiers) {
        // Use fuzzy matching with phonetic awareness
        const fuzzyScore = fuzzyMatchScore(searchTerm, jobId);

        // Determine match type based on what matched
        let matchType = 'fuzzy';
        if (fuzzyScore >= 0.95) {
          matchType = jobId === jobClientFromName ? 'client_name_exact' : 'exact_match';
        } else if (fuzzyScore >= 0.85) {
          matchType = jobId === jobClientFromName ? 'client_name_fuzzy' : 'high_similarity';
        } else if (fuzzyScore >= 0.70) {
          matchType = 'phonetic_match';
        } else if (fuzzyScore >= 0.50) {
          matchType = 'partial_match';
        }

        // Boost score if matching client name specifically (most common case)
        let adjustedScore = fuzzyScore;
        if (jobId === jobClientFromName && fuzzyScore > 0.6) {
          adjustedScore = Math.min(fuzzyScore + 0.1, 0.99);
          matchType = 'client_name_' + matchType;
        }

        if (adjustedScore > bestConfidence) {
          bestConfidence = adjustedScore;
          bestMatchType = matchType;
        }
      }

      // Special case: Check Soundex match on client name for severe misspellings
      // e.g., "Drumond" vs "Drummond" or "Krews" vs "Crews"
      const searchSoundex = soundex(searchTerm);
      const clientSoundex = soundex(jobClientFromName);

      if (searchSoundex && clientSoundex && searchSoundex === clientSoundex) {
        // Soundex match - check string similarity to determine confidence
        const simRatio = similarityRatio(searchTerm, jobClientFromName);
        const soundexConfidence = 0.70 + (simRatio * 0.25); // 70-95% based on similarity

        if (soundexConfidence > bestConfidence) {
          bestConfidence = soundexConfidence;
          bestMatchType = 'soundex_match';
        }
      }
    }

    if (bestConfidence > 0.35) {
      matches.push({
        id: job.id,
        name: job.name,
        address: job.address,
        client_name: job.client_name,
        confidence: Math.min(bestConfidence, 0.99),
        matchType: bestMatchType
      });
    }
  }

  // Sort by confidence
  matches.sort((a, b) => b.confidence - a.confidence);

  // Return results
  if (matches.length === 0) {
    return { job: null, confidence: 0, possibleMatches: [], reason: 'no_match' };
  }

  const bestMatch = matches[0];
  return {
    job: bestMatch.confidence >= CONFIDENCE_THRESHOLDS.LOW ? {
      id: bestMatch.id,
      name: bestMatch.name,
      address: bestMatch.address,
      client_name: bestMatch.client_name
    } : null,
    confidence: bestMatch.confidence,
    possibleMatches: matches.slice(0, 5),
    matchType: bestMatch.matchType
  };
}

function normalizeForMatch(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

// ============================================================
// COST CODE SUGGESTION
// ============================================================

/**
 * Suggest cost codes based on trade type
 * Uses database mappings (v2_trade_cost_mappings) for dynamic configuration
 * @param {string} tradeType - The vendor's trade type
 * @param {number} amount - Total invoice amount
 * @returns {Promise<Array>} Array of suggested cost code allocations
 */
async function suggestCostCodes(tradeType, amount) {
  if (!tradeType) {
    return [];
  }

  // Ensure mappings are loaded from database
  await ensureMappingsLoaded();

  // Use the cached mappings from TRADE_COST_CODE_MAP (loaded from v2_trade_cost_mappings)
  const normalizedTrade = tradeType.toLowerCase();
  if (!TRADE_COST_CODE_MAP[normalizedTrade]) {
    return [];
  }

  const suggestedCodes = TRADE_COST_CODE_MAP[normalizedTrade];

  // Fetch the actual cost code records
  const { data: costCodes, error } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .in('code', suggestedCodes);

  if (error || !costCodes || costCodes.length === 0) {
    return [];
  }

  // Return first cost code (primary) with full amount
  // User can adjust the split later if needed
  return [{
    cost_code_id: costCodes[0].id,
    code: costCodes[0].code,
    name: costCodes[0].name,
    amount: amount,
    suggested: true,
    source: 'trade_mapping'
  }];
}

/**
 * Suggest cost code for a line item description
 * Uses keyword matching against DESCRIPTION_COST_CODE_MAP (loaded from database)
 * Enhanced with fuzzy matching for typos/variations (CCL-01)
 * @param {string} description - Line item description
 * @param {string} tradeType - Vendor trade type (for combined scoring)
 * @returns {Promise<Object|null>} Cost code suggestion { id, code, name, confidence, matchType }
 */
async function suggestCostCodeForDescription(description, tradeType = null) {
  if (!description) return null;

  // Ensure mappings are loaded from database
  await ensureMappingsLoaded();

  const desc = description.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;
  let confidence = 0.6;
  let matchType = 'none';

  // Check keyword mappings with exact and fuzzy matching
  for (const [keyword, code] of Object.entries(DESCRIPTION_COST_CODE_MAP)) {
    // Exact include match (preferred)
    if (desc.includes(keyword)) {
      const score = keyword.length * 1.0;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = code;
        confidence = keyword.length > 10 ? 0.9 : 0.75;
        matchType = 'exact';
      }
    } else {
      // CCL-01: Fuzzy match for typos/variations
      // Compare keyword against words in description
      const descWords = desc.split(/\s+/);
      for (const word of descWords) {
        if (word.length >= 4) { // Only compare meaningful words
          const sim = similarityRatio(word, keyword);
          if (sim > 0.85) {
            const score = keyword.length * sim;
            if (score > bestScore * 0.9) { // Allow fuzzy to compete
              bestScore = score;
              bestMatch = code;
              confidence = 0.7 * sim;
              matchType = 'fuzzy';
            }
            break; // Found fuzzy match for this keyword
          }
        }
      }
    }
  }

  // CCL-01: Integrate vendor trade type with description matching
  // Key insight: Vendor trade should be the PRIMARY signal for specialized trades
  // A cabinet vendor billing for "countertop supports" is doing cabinet work, not countertop work
  if (tradeType && TRADE_COST_CODE_MAP[tradeType]) {
    const tradeCodes = TRADE_COST_CODE_MAP[tradeType];
    const tradeCode = Array.isArray(tradeCodes) ? tradeCodes[0] : tradeCodes;
    const allTradeCodes = Array.isArray(tradeCodes) ? tradeCodes : [tradeCodes];

    // Check if vendor trade is a specialized trade (not generic)
    const isSpecializedTrade = !['general', 'other'].includes(tradeType.toLowerCase());

    if (!bestMatch || bestScore < 6) {
      // No strong description match - use trade
      bestMatch = tradeCode;
      confidence = 0.85;
      matchType = 'trade';
      logger.debug('Using vendor trade for cost code', { component: 'ai', tradeType, tradeCode, description });
    } else if (allTradeCodes.includes(bestMatch)) {
      // Trade and description agree (description matches one of vendor's trade codes) - boost confidence
      confidence = Math.min(confidence + 0.1, 0.95);
      matchType += '+trade';
      logger.debug('Trade/description agreement', { component: 'ai', tradeType, description, costCode: bestMatch, confidence: confidence.toFixed(2) });
    } else if (isSpecializedTrade && bestScore < 15) {
      // Trade and description disagree, but vendor is specialized and description match isn't very strong
      // PREFER VENDOR TRADE - a cabinet vendor's "countertop supports" is cabinet work
      logger.debug('Overriding description match with vendor trade', { component: 'ai', originalMatch: bestMatch, tradeCode, tradeType, description });
      bestMatch = tradeCode;
      confidence = 0.80;
      matchType = 'trade_override';
    }
    // Only keep description match if it's very strong (bestScore >= 15) or vendor is generic
  }

  if (!bestMatch) return null;

  // Fetch the actual cost code record
  const { data: costCode, error } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .eq('code', bestMatch)
    .single();

  if (error || !costCode) {
    logger.warn('Cost code not found in database', { component: 'ai', code: bestMatch });
    return null;
  }

  return {
    id: costCode.id,
    code: costCode.code,
    name: costCode.name,
    confidence,
    matchType // CCL-01: Include match type for debugging
  };
}

/**
 * Suggest cost codes for all line items in an invoice
 * @param {Array} lineItems - Array of line items with description and amount
 * @param {string} tradeType - Vendor trade type (fallback)
 * @returns {Promise<Array>} Line items with suggested cost codes
 */
async function suggestCostCodesForLineItems(lineItems, tradeType = null) {
  if (!lineItems || lineItems.length === 0) return [];

  const results = [];

  for (const item of lineItems) {
    const suggestion = await suggestCostCodeForDescription(item.description, tradeType);
    results.push({
      ...item,
      suggestedCostCode: suggestion
    });
  }

  return results;
}

/**
 * Calculate Levenshtein distance for fuzzy matching
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length, n = str2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(dp[i - 1][j - 1], dp[i][j - 1], dp[i - 1][j]) + 1;
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity ratio (0-1) between two strings
 * Higher = more similar
 */
function similarityRatio(str1, str2) {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  if (s1 === s2) return 1;

  const distance = levenshteinDistance(s1, s2);
  const maxLen = Math.max(s1.length, s2.length);
  return maxLen === 0 ? 1 : 1 - (distance / maxLen);
}

/**
 * Generate Soundex code for phonetic matching
 * Handles common misspellings like "Drumond" vs "Drummond"
 */
function soundex(str) {
  if (!str) return '';

  const s = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length === 0) return '';

  const codes = {
    B: 1, F: 1, P: 1, V: 1,
    C: 2, G: 2, J: 2, K: 2, Q: 2, S: 2, X: 2, Z: 2,
    D: 3, T: 3,
    L: 4,
    M: 5, N: 5,
    R: 6
  };

  let result = s[0];
  let prevCode = codes[s[0]] || 0;

  for (let i = 1; i < s.length && result.length < 4; i++) {
    const code = codes[s[i]];
    if (code && code !== prevCode) {
      result += code;
      prevCode = code;
    } else if (!code) {
      prevCode = 0;
    }
  }

  return result.padEnd(4, '0');
}

/**
 * Extract key tokens from a string for matching
 * Handles variations like "501 74th St" vs "501 74th Street"
 */
function extractMatchTokens(str) {
  if (!str) return { numbers: [], words: [], soundexCodes: [] };

  const normalized = str.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const tokens = normalized.split(/\s+/).filter(t => t.length > 0);

  const numbers = tokens.filter(t => /^\d+$/.test(t));
  const words = tokens.filter(t => /^[a-z]+$/.test(t) && t.length > 2);
  const soundexCodes = words.map(w => soundex(w));

  return { numbers, words, soundexCodes };
}

/**
 * Smart fuzzy match between two strings with context awareness
 * Returns confidence score 0-1
 */
function fuzzyMatchScore(search, target) {
  if (!search || !target) return 0;

  const searchNorm = normalizeForMatch(search);
  const targetNorm = normalizeForMatch(target);

  // Exact match
  if (searchNorm === targetNorm) return 1.0;

  // One contains the other
  if (searchNorm.includes(targetNorm) || targetNorm.includes(searchNorm)) {
    const ratio = Math.min(searchNorm.length, targetNorm.length) / Math.max(searchNorm.length, targetNorm.length);
    return 0.85 + (ratio * 0.1);
  }

  // Token-based matching
  const searchTokens = extractMatchTokens(search);
  const targetTokens = extractMatchTokens(target);

  let score = 0;
  let factors = 0;

  // Number matching (addresses) - very important
  if (searchTokens.numbers.length > 0 && targetTokens.numbers.length > 0) {
    const numberMatches = searchTokens.numbers.filter(n => targetTokens.numbers.includes(n));
    if (numberMatches.length > 0) {
      score += 0.4 * (numberMatches.length / Math.max(searchTokens.numbers.length, targetTokens.numbers.length));
      factors += 0.4;
    }
  }

  // Soundex matching (phonetic - catches misspellings)
  if (searchTokens.soundexCodes.length > 0 && targetTokens.soundexCodes.length > 0) {
    const soundexMatches = searchTokens.soundexCodes.filter(s => targetTokens.soundexCodes.includes(s));
    if (soundexMatches.length > 0) {
      score += 0.35 * (soundexMatches.length / Math.max(searchTokens.soundexCodes.length, targetTokens.soundexCodes.length));
      factors += 0.35;
    }
  }

  // Direct word matching
  if (searchTokens.words.length > 0 && targetTokens.words.length > 0) {
    const wordMatches = searchTokens.words.filter(w =>
      targetTokens.words.some(tw => similarityRatio(w, tw) > 0.8)
    );
    if (wordMatches.length > 0) {
      score += 0.25 * (wordMatches.length / Math.max(searchTokens.words.length, targetTokens.words.length));
      factors += 0.25;
    }
  }

  // Overall string similarity as fallback
  const overallSimilarity = similarityRatio(searchNorm, targetNorm);
  if (overallSimilarity > 0.6) {
    score += overallSimilarity * 0.3;
    factors += 0.3;
  }

  return factors > 0 ? Math.min(score / factors * (factors + 0.2), 0.95) : overallSimilarity * 0.5;
}

// ============================================================
// VENDOR MATCHING / CREATION
// ============================================================

/**
 * Find or create vendor with confidence
 * Uses fuzzy matching with Soundex for misspelling tolerance
 */
async function findOrCreateVendor(vendorData) {
  if (!vendorData?.companyName) {
    return { vendor: null, confidence: 0, isNew: false };
  }

  // LEARNING: Check learned mappings first
  const learnedMatch = await aiLearning.findLearnedMapping('vendor', vendorData.companyName);
  if (learnedMatch && learnedMatch.confidence >= 0.85) {
    const { data: learnedVendor } = await supabase
      .from('v2_vendors')
      .select('id, name, email, phone, trade')
      .eq('id', learnedMatch.matched_id)
      .single();

    if (learnedVendor) {
      logger.info('Used learned vendor mapping', { component: 'ai-learning', input: vendorData.companyName, vendorName: learnedVendor.name, confidence: Math.round(learnedMatch.confidence * 100) });
      // Enrich vendor with any new info from this invoice
      await aiLearning.enrichVendorFromInvoice(learnedVendor.id, vendorData);
      return { vendor: learnedVendor, confidence: learnedMatch.confidence, isNew: false, matchType: 'learned_mapping' };
    }
  }

  // Check vendor aliases (learned from corrections)
  const aliasMatch = await aiLearning.findVendorByAlias(vendorData.companyName);
  if (aliasMatch) {
    const { data: aliasVendor } = await supabase
      .from('v2_vendors')
      .select('id, name, email, phone, trade')
      .eq('id', aliasMatch.vendor_id)
      .single();

    if (aliasVendor) {
      logger.info('Vendor alias match', { component: 'vendor', input: vendorData.companyName, vendorName: aliasVendor.name });
      // Enrich vendor with any new info from this invoice
      await aiLearning.enrichVendorFromInvoice(aliasVendor.id, vendorData);
      return { vendor: aliasVendor, confidence: 0.95, isNew: false, matchType: 'alias_match' };
    }
  }

  // Try to find existing vendor using improved matching from standards.js
  const { data: vendors } = await supabase
    .from('v2_vendors')
    .select('id, name, email, phone, trade');

  if (vendors && vendors.length > 0) {
    // Use standards.findBestVendorMatch which handles LLC, Inc, Co removal and better normalization
    // Threshold lowered to 65 to catch variations like "TNT Paint" vs "TNT Painting"
    const match = standards.findBestVendorMatch(vendorData.companyName, vendors, 65);

    if (match) {
      logger.info('Vendor fuzzy match', { component: 'vendor', input: vendorData.companyName, vendorName: match.vendor.name, similarity: match.score });
      // Enrich vendor with any new info from this invoice
      await aiLearning.enrichVendorFromInvoice(match.vendor.id, vendorData);
      return {
        vendor: match.vendor,
        confidence: match.score / 100,
        isNew: false,
        matchType: 'fuzzy_match'
      };
    }
  }

  // Create new vendor with canonical name (normalized)
  const canonicalName = standards.getCanonicalVendorName(vendorData.companyName);

  const { data: newVendor, error } = await supabase
    .from('v2_vendors')
    .insert({
      name: canonicalName,
      email: vendorData.email || null,
      phone: vendorData.phone || null,
      last_invoice_date: new Date().toISOString().split('T')[0],
      invoice_count: 1
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create vendor', { component: 'vendor', error: error.message });
    return { vendor: null, confidence: 0, isNew: false, error: error.message };
  }

  logger.info('New vendor created', { component: 'vendor', vendorName: canonicalName, original: vendorData.companyName });
  return { vendor: newVendor, confidence: 1.0, isNew: true };
}

// ============================================================
// PO MATCHING / CREATION
// ============================================================

/**
 * Find matching PO using multi-signal scoring
 * Uses po-matcher module for intelligent matching across vendor, amount, date, and items
 *
 * @param {string} jobId - Job ID to search within
 * @param {string} vendorId - Vendor ID (if already matched)
 * @param {Object} invoiceData - Extracted invoice data
 * @param {string} jobName - Job name (for logging)
 * @returns {Object|null} Match result with PO, confidence, and match details
 */
async function findOrCreatePO(jobId, vendorId, invoiceData, jobName) {
  if (!jobId) return null;

  // Use multi-signal PO matching
  const matchResult = await poMatcher.findMatchingPO(invoiceData, jobId, vendorId);

  if (matchResult.match) {
    return {
      po: matchResult.match,
      isNew: false,
      matchConfidence: matchResult.confidence,
      matchBreakdown: matchResult.breakdown,
      needsReview: matchResult.needsReview,
      explanation: matchResult.explanation,
      candidates: matchResult.candidates
    };
  }

  // No auto-match found - return match info for review
  if (matchResult.candidates && matchResult.candidates.length > 0) {
    return {
      po: null,
      isNew: false,
      matchConfidence: matchResult.confidence,
      candidates: matchResult.candidates,
      needsReview: true,
      explanation: matchResult.explanation
    };
  }

  // No candidates found
  return null;
}
// Note: Duplicate detection functions moved to ./duplicate-check.js for consolidation

// ============================================================
// TWO-STAGE EXTRACTION PIPELINE
// ============================================================

/**
 * Extract raw invoice data (Stage 1)
 * Focuses on accurate data extraction using Claude Vision for all PDFs
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} - Raw extracted data with extraction confidence
 */
async function extractInvoiceRaw(pdfBuffer, filename) {
  const result = {
    success: false,
    extracted: null,
    extractionConfidence: {},
    extractionMethod: 'unknown',
    messages: []
  };

  try {
    // Always use vision mode for PDFs (better layout understanding)
    result.messages.push('Using Claude Vision for extraction...');
    result.extractionMethod = 'vision';

    const systemPrompt = `You are an expert construction invoice processing assistant for Ross Built Custom Homes, a custom home builder in Florida.

CRITICAL IDENTIFICATION RULES:
1. Ross Built Custom Homes (or "Ross Built") is ALWAYS the general contractor being billed - NEVER the vendor
2. The VENDOR is the subcontractor/supplier company SENDING the invoice - they performed work or supplied materials
3. Look for "Bill To:", "Invoice To:", "Customer:" fields - these typically show Ross Built
4. Look for company letterhead, logo, or "From:" - this is typically the VENDOR

EXTRACTION ACCURACY REQUIREMENTS:
1. Invoice numbers: Look for "Invoice #", "Inv #", "Invoice No.", "Reference #" - extract exactly as shown
2. Amounts: Extract the TOTAL AMOUNT DUE. Look for "Total", "Amount Due", "Balance Due"
3. Dates: Convert all dates to YYYY-MM-DD format
4. Line items: Extract ALL work items with their individual amounts

JOB/PROJECT IDENTIFICATION:
Job references can appear in MANY forms. Check ALL of these locations:
1. "P.O.#" or "PO#" field - often contains client name or job reference
2. "Subject:", "Job:", "Project:", "Site:", "Location:", "Re:" fields
3. Any street address that is NOT the vendor's address
4. Client/homeowner last name

Focus on ACCURATE extraction. Validation will happen in Stage 2.
Return ONLY valid JSON, no markdown code blocks.`;

    const base64PDF = pdfBuffer.toString('base64');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64PDF
            }
          },
          {
            type: 'text',
            text: `Please analyze this invoice PDF and extract all information according to this schema:\n\n${INVOICE_SCHEMA}\n\nReturn ONLY valid JSON, no markdown code blocks.`
          }
        ]
      }]
    });

    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const extracted = JSON.parse(jsonStr);
    result.extracted = normalizeExtractedData(extracted);
    result.extractionConfidence = result.extracted.extractionConfidence || {};
    result.success = true;
    result.messages.push('Extraction complete');

  } catch (err) {
    result.success = false;
    result.messages.push(`Extraction error: ${err.message}`);
    logger.error('Stage 1 extraction error', { component: 'ai', error: err.message, stack: err.stack });
  }

  return result;
}

/**
 * Validate and enrich extracted data (Stage 2)
 * Calls invoice-validator for programmatic validation
 *
 * @param {Object} rawExtracted - Raw extracted data from Stage 1
 * @returns {Promise<Object>} - Validated data with corrections and issues
 */
async function validateAndEnrich(rawExtracted) {
  const result = {
    data: { ...rawExtracted },
    validationScore: 1.0,
    issues: [],
    corrections: {},
    validationBreakdown: {}
  };

  try {
    // Run validation
    const validation = await invoiceValidator.validateExtraction(rawExtracted);

    result.validationScore = validation.confidence;
    result.issues = validation.issues;
    result.corrections = validation.corrections;
    result.validationBreakdown = validation.breakdown;

    // Apply safe auto-corrections to data
    if (validation.corrections.invoiceNumber) {
      result.data.invoiceNumber = validation.corrections.invoiceNumber;
    }
    if (validation.corrections.totalAmount !== undefined) {
      result.data.totalAmount = validation.corrections.totalAmount;
      if (result.data.amounts) {
        result.data.amounts.totalAmount = validation.corrections.totalAmount;
      }
    }
    if (validation.corrections.invoiceType) {
      result.data.invoiceType = validation.corrections.invoiceType;
    }
    if (validation.corrections.tradeType && result.data.vendor) {
      result.data.vendor.tradeType = validation.corrections.tradeType;
    }

  } catch (err) {
    result.issues.push(`Validation error: ${err.message}`);
    result.validationScore = 0.5; // Penalize for validation failure
    logger.error('Stage 2 validation error', { component: 'ai', error: err.message, stack: err.stack });
  }

  return result;
}

/**
 * Calculate final confidence from extraction and validation scores
 * Weighted combination favoring extraction but penalizing validation failures
 *
 * @param {number} extractionConfidence - Overall extraction confidence (0-1)
 * @param {number} validationScore - Validation score (0-1)
 * @returns {number} - Combined confidence score (0-1)
 */
function calculateFinalConfidence(extractionConfidence, validationScore) {
  // Extraction is 60%, validation is 40%
  const extractionWeight = 0.60;
  const validationWeight = 0.40;

  // Handle missing values
  const extConf = extractionConfidence || 0.5;
  const valScore = validationScore || 0.5;

  // Calculate weighted average
  let finalConfidence = (extConf * extractionWeight) + (valScore * validationWeight);

  // Apply penalty if validation found critical issues (score < 0.6)
  if (valScore < 0.6) {
    finalConfidence *= 0.9; // 10% penalty
  }

  return Math.round(finalConfidence * 100) / 100;
}

/**
 * Process invoice using two-stage extraction pipeline
 *
 * Stage 1: Raw extraction using Claude Vision
 * Stage 2: Programmatic validation with cross-field checks
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} filename - Original filename
 * @returns {Promise<Object>} - Processing results with combined confidence
 */
async function processInvoiceTwoStage(pdfBuffer, filename) {
  const result = {
    success: false,
    extracted: null,
    confidence: 0,
    stage1Confidence: 0,
    stage2Score: 0,
    validationIssues: [],
    autoCorrections: [],
    extractionMethod: 'two_stage',
    messages: []
  };

  try {
    // Stage 1: Raw extraction
    result.messages.push('Stage 1: Extracting invoice data with Claude Vision...');
    const stage1 = await extractInvoiceRaw(pdfBuffer, filename);

    if (!stage1.success || !stage1.extracted) {
      result.success = false;
      result.messages.push(...stage1.messages);
      result.messages.push('Stage 1 extraction failed');
      return result;
    }

    result.extracted = stage1.extracted;
    result.stage1Confidence = calculateOverallExtractionConfidence(stage1.extractionConfidence);
    result.messages.push(`Stage 1 complete: ${Math.round(result.stage1Confidence * 100)}% confidence`);
    result.messages.push(...stage1.messages);

    // Stage 2: Validation and enrichment
    result.messages.push('Stage 2: Validating extracted data...');
    const stage2 = await validateAndEnrich(stage1.extracted);

    result.extracted = stage2.data; // Use corrected data
    result.stage2Score = stage2.validationScore;
    result.validationIssues = stage2.issues;

    // Track auto-corrections
    if (stage2.corrections.invoiceNumber) {
      result.autoCorrections.push({
        field: 'invoiceNumber',
        original: stage2.corrections.originalInvoiceNumber,
        corrected: stage2.corrections.invoiceNumber,
        reason: 'OCR correction'
      });
    }
    if (stage2.corrections.totalAmount !== undefined) {
      result.autoCorrections.push({
        field: 'totalAmount',
        original: stage1.extracted.totalAmount,
        corrected: stage2.corrections.totalAmount,
        reason: 'Amount recalculation'
      });
    }
    if (stage2.corrections.invoiceType) {
      result.autoCorrections.push({
        field: 'invoiceType',
        original: stage1.extracted.invoiceType,
        corrected: stage2.corrections.invoiceType,
        reason: 'Type detection from amount'
      });
    }

    result.messages.push(`Stage 2 complete: ${Math.round(result.stage2Score * 100)}% validation score`);
    if (result.validationIssues.length > 0) {
      result.messages.push(`Found ${result.validationIssues.length} validation issue(s)`);
    }

    // Calculate final confidence
    result.confidence = calculateFinalConfidence(result.stage1Confidence, result.stage2Score);
    result.messages.push(`Final confidence: ${Math.round(result.confidence * 100)}%`);

    result.success = true;

  } catch (err) {
    result.success = false;
    result.messages.push(`Pipeline error: ${err.message}`);
    logger.error('Two-stage pipeline error', { component: 'ai', error: err.message, stack: err.stack });
  }

  return result;
}

/**
 * Calculate overall extraction confidence from individual field confidences
 */
function calculateOverallExtractionConfidence(extractionConfidence) {
  if (!extractionConfidence) return 0.5;

  const weights = {
    vendor: 0.25,
    amount: 0.30,
    invoiceNumber: 0.15,
    date: 0.15,
    job: 0.15
  };

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(weights)) {
    if (extractionConfidence[key] !== undefined) {
      weightedSum += extractionConfidence[key] * weight;
      totalWeight += weight;
    }
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
}

// ============================================================
// MAIN PROCESSING FUNCTION
// ============================================================

/**
 * Process an invoice PDF with AI
 * Now uses two-stage pipeline internally
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<object>} - Processing results with confidence scores
 */
async function processInvoice(pdfBuffer, originalFilename) {
  const results = {
    success: false,
    ai_processed: true,
    extracted: null,
    ai_extracted_data: null,
    ai_confidence: {},
    matchedJob: null,
    vendor: null,
    po: null,
    standardizedFilename: null,
    invoiceId: null,
    needs_review: false,
    review_flags: [],
    suggestions: {
      possible_jobs: [],
      possible_duplicates: [],
      po_matches: [],
      cost_codes: []      // Suggested cost code allocations
    },
    suggested_allocations: [], // Cost code allocations to auto-create
    messages: []
  };

  try {
    // 1. Extract text from PDF
    const pdfText = await extractTextFromPDF(pdfBuffer);
    const isScannedPDF = ocrProcessor.isLikelyScannedPDF(pdfText);

    // Store raw text for audit
    results.ai_extracted_data = { raw_text: pdfText?.substring(0, 5000) || '' };

    let extracted;

    // 2. AI extraction - use OCR for scanned PDFs
    if (isScannedPDF) {
      results.messages.push('Scanned PDF detected - using OCR...');
      results.review_flags.push('ocr_processed');

      try {
        // Use Vision API for OCR extraction
        extracted = await ocrProcessor.processWithOCR(pdfBuffer, originalFilename);
        results.messages.push('Successfully extracted data via OCR');
        results.ai_extracted_data.extraction_method = 'vision_ocr';
      } catch (ocrErr) {
        // OCR failed - fall back to standard extraction with whatever text we have
        logger.error('OCR failed', { component: 'ocr', error: ocrErr.message });
        results.messages.push(`OCR failed: ${ocrErr.message} - falling back to text extraction`);
        results.review_flags.push('low_text_quality');
        extracted = await extractInvoiceData(pdfText || '', originalFilename);
        results.ai_extracted_data.extraction_method = 'text_fallback';
      }
    } else {
      // Normal text-based extraction
      results.messages.push('Extracting invoice data with AI...');
      extracted = await extractInvoiceData(pdfText || '', originalFilename);
      results.ai_extracted_data.extraction_method = 'text';
    }

    results.extracted = extracted;
    results.ai_extracted_data = {
      ...results.ai_extracted_data,
      parsed_vendor_name: extracted.vendor?.companyName,
      parsed_address: extracted.job?.address,
      parsed_amount: extracted.totalAmount,
      parsed_invoice_number: extracted.invoiceNumber,
      parsed_date: extracted.invoiceDate,
      line_items: extracted.lineItems
    };

    // 3. Set AI confidence scores - use actual extracted values
    const aiConf = extracted.extractionConfidence || {};
    results.ai_confidence = {
      vendor: aiConf.vendor || 0.5,
      job: aiConf.job || 0.5,
      amount: aiConf.amount || 0.5,
      invoiceNumber: aiConf.invoiceNumber || 0.5,
      date: aiConf.date || 0.5,
      po: 0, // Will be set if PO is matched
      costCode: 0, // Will be set if cost code is suggested
      overall: 0
    };

    // Calculate overall confidence
    const confValues = Object.values(results.ai_confidence).filter(v => typeof v === 'number');
    results.ai_confidence.overall = confValues.reduce((a, b) => a + b, 0) / confValues.length;

    results.messages.push(`Extracted: ${extracted.vendor?.companyName || 'Unknown vendor'}, $${extracted.totalAmount || 0}`);

    // 4. SMART JOB MATCHING - Multi-strategy approach
    // Strategy 1: Use AI-extracted job reference
    // Strategy 2: Scan raw text/filename for known job names/addresses
    // Strategy 3: Use filename hints (e.g., "Drummond November 2025.pdf")

    let jobData = extracted.job;
    let jobMatch = null;
    let matchStrategy = 'ai_extracted';

    // First try: AI-extracted job reference
    const hasJobReference = jobData && (jobData.reference || jobData.address || jobData.clientName || jobData.poNumber);

    if (hasJobReference) {
      jobMatch = await findMatchingJob(jobData);
    }

    // If no good match from AI extraction, try scanning raw text for known job names
    if (!jobMatch || jobMatch.confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
      const textScanMatch = await scanTextForKnownJobs(
        results.ai_extracted_data?.raw_text || '',
        originalFilename
      );

      if (textScanMatch && textScanMatch.confidence > (jobMatch?.confidence || 0)) {
        jobMatch = textScanMatch;
        matchStrategy = textScanMatch.matchStrategy || 'text_scan';
        results.messages.push(`Text scan found job: "${textScanMatch.matchedText}" → ${textScanMatch.job?.name}`);
      }
    }

    // Apply job match results
    if (jobMatch && jobMatch.confidence > 0) {
      results.ai_confidence.job = jobMatch.confidence;
      results.suggestions.possible_jobs = jobMatch.possibleMatches || [];

      const searchDesc = jobMatch.matchedText || jobData?.reference || jobData?.clientName || jobData?.address || 'text scan';

      if (jobMatch.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
        // High confidence - auto-assign
        results.matchedJob = jobMatch.job;
        results.messages.push(`Matched to job: ${jobMatch.job.name} (${Math.round(jobMatch.confidence * 100)}% via ${matchStrategy})`);
      } else if (jobMatch.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
        // Medium confidence - auto-assign with review flag
        results.matchedJob = jobMatch.job;
        results.needs_review = true;
        results.review_flags.push('verify_job');
        results.messages.push(`Matched to job: ${jobMatch.job.name} (${Math.round(jobMatch.confidence * 100)}% via ${matchStrategy} - verify)`);
      } else {
        // Low confidence - don't auto-assign, show suggestions
        results.matchedJob = null;
        results.needs_review = true;
        results.review_flags.push('select_job');
        results.messages.push(`Low confidence job match (${Math.round(jobMatch.confidence * 100)}%) - manual selection required`);
      }
    } else {
      // No match found
      results.needs_review = true;
      results.review_flags.push('no_job_match');
      const searchDesc = jobData?.reference || jobData?.clientName || jobData?.address || 'no reference';
      results.messages.push(`No matching job found for: ${searchDesc}`);
    }

    // 5. Check for low confidence fields
    if (results.ai_confidence.amount < CONFIDENCE_THRESHOLDS.MEDIUM) {
      results.review_flags.push('verify_amount');
    }
    if (results.ai_confidence.date < CONFIDENCE_THRESHOLDS.MEDIUM) {
      results.review_flags.push('verify_date');
    }
    if (results.ai_confidence.vendor < CONFIDENCE_THRESHOLDS.MEDIUM) {
      results.review_flags.push('verify_vendor');
    }

    // 6. Find or create vendor
    if (extracted.vendor) {
      const vendorResult = await findOrCreateVendor(extracted.vendor);
      if (vendorResult.vendor) {
        results.vendor = vendorResult.vendor;
        results.ai_confidence.vendor = Math.max(results.ai_confidence.vendor, vendorResult.confidence);
        results.messages.push(vendorResult.isNew
          ? `Created new vendor: ${vendorResult.vendor.name}`
          : `Matched vendor: ${vendorResult.vendor.name} (${Math.round(vendorResult.confidence * 100)}%)`);
      }
    }

    // 6b. Suggest cost codes - first try line items, then fall back to trade type
    // Priority: 1) Vendor's stored trade from database, 2) AI-extracted trade from invoice
    const vendorStoredTrade = results.vendor?.trade?.toLowerCase().trim();
    const extractedTradeType = extracted.vendor?.tradeType;
    const tradeType = vendorStoredTrade || extractedTradeType;
    const invoiceAmount = extracted.totalAmount || extracted.amounts?.totalAmount || 0;

    if (vendorStoredTrade) {
      results.messages.push(`Using vendor trade: ${vendorStoredTrade} (from database)`);
    }

    // First: Try to get cost codes from line item descriptions
    let lineItemAllocations = [];
    if (extracted.lineItems?.length > 0) {
      const lineItemsWithCodes = await suggestCostCodesForLineItems(extracted.lineItems, tradeType);

      // Build allocations from line items that have suggested cost codes
      for (const item of lineItemsWithCodes) {
        if (item.suggestedCostCode) {
          lineItemAllocations.push({
            cost_code_id: item.suggestedCostCode.id,
            code: item.suggestedCostCode.code,
            name: item.suggestedCostCode.name,
            amount: item.amount || 0,
            suggested: true,
            line_item_description: item.description,
            confidence: item.suggestedCostCode.confidence
          });
        }
      }

      // Store line items with suggestions for reference
      results.ai_extracted_data.line_items_with_codes = lineItemsWithCodes;
    }

    if (lineItemAllocations.length > 0) {
      // Aggregate allocations by cost code (combine same codes)
      const aggregated = {};
      for (const alloc of lineItemAllocations) {
        if (aggregated[alloc.code]) {
          aggregated[alloc.code].amount += alloc.amount;
          aggregated[alloc.code].line_item_descriptions.push(alloc.line_item_description);
        } else {
          aggregated[alloc.code] = {
            ...alloc,
            line_item_descriptions: [alloc.line_item_description]
          };
        }
      }

      results.suggested_allocations = Object.values(aggregated);
      results.suggestions.cost_codes = results.suggested_allocations;

      // Higher confidence when we matched from line item descriptions
      const avgConfidence = lineItemAllocations.reduce((sum, a) => sum + a.confidence, 0) / lineItemAllocations.length;
      results.ai_confidence.costCode = Math.min(avgConfidence + 0.1, 0.95); // Boost for line item match

      const codeList = results.suggested_allocations.map(a => a.code).join(', ');
      results.messages.push(`Suggested cost codes from line items: ${codeList}`);
    } else if (tradeType && invoiceAmount > 0) {
      // Fallback: Use trade type to suggest cost codes (original logic)
      const suggestedCodes = await suggestCostCodes(tradeType, invoiceAmount);
      if (suggestedCodes.length > 0) {
        results.suggested_allocations = suggestedCodes;
        results.suggestions.cost_codes = suggestedCodes;
        // Cost code confidence based on trade type specificity and vendor confidence
        const highSpecificityTrades = ['electrical', 'plumbing', 'hvac'];
        const mediumSpecificityTrades = ['roofing', 'framing', 'drywall', 'concrete', 'flooring', 'tile'];
        let ccConf = 0.6; // Base
        if (highSpecificityTrades.includes(tradeType)) ccConf += 0.25;
        else if (mediumSpecificityTrades.includes(tradeType)) ccConf += 0.18;
        else if (tradeType !== 'other' && tradeType !== 'general') ccConf += 0.12;
        // Boost if vendor confidence is high (more likely correct trade)
        if (results.ai_confidence.vendor > 0.8) ccConf += 0.07;
        results.ai_confidence.costCode = Math.min(ccConf, 0.94);
        results.messages.push(`Suggested cost code: ${suggestedCodes[0].code} ${suggestedCodes[0].name} (based on ${tradeType} trade)`);
      }
    }

    // 7. Check for duplicates
    if (results.vendor) {
      const dupCheck = await checkForDuplicates(
        results.vendor.id,
        extracted.invoiceNumber,
        extracted.totalAmount
      );
      results.suggestions.possible_duplicates = dupCheck.possibleDuplicates;
      if (dupCheck.isDuplicate) {
        results.review_flags.push('possible_duplicate');
        results.needs_review = true;
        results.messages.push('WARNING: Possible duplicate invoice detected');
      }
    }

    // 7b. Check for split invoice suggestion (multi-invoice or multi-job)
    if (extracted.splitSuggestion?.shouldSplit) {
      results.ai_split_suggested = true;
      results.ai_split_data = extracted.splitSuggestion;
      results.review_flags.push('split_suggested');
      results.needs_review = true;

      const splitType = extracted.splitSuggestion.splitType;
      if (splitType === 'multi_job') {
        const jobCount = extracted.splitSuggestion.suggestedSplits?.length || 'multiple';
        results.review_flags.push('multi_job_detected');
        results.messages.push(`NOTICE: This invoice covers ${jobCount} different jobs - consider splitting by job`);
      } else if (splitType === 'multi_invoice') {
        results.messages.push(`NOTICE: This document contains multiple invoices - ${extracted.splitSuggestion.reason || 'consider splitting'}`);
      } else {
        results.messages.push(`NOTICE: This document may need splitting - ${extracted.splitSuggestion.reason || 'review suggested'}`);
      }
    }

    // 8. Find or create PO with multi-signal matching
    if (results.matchedJob && results.vendor) {
      const poResult = await findOrCreatePO(
        results.matchedJob.id,
        results.vendor.id,
        extracted,
        results.matchedJob.name
      );

      // Initialize po_match object for response
      results.po_match = {
        matched: false,
        po_id: null,
        po_number: null,
        confidence: 0,
        needs_review: false,
        explanation: '',
        breakdown: null,
        candidates: []
      };

      if (poResult) {
        // Set PO confidence from multi-signal matching
        results.ai_confidence.po = poResult.matchConfidence || 0;

        // Populate po_match details
        results.po_match.confidence = poResult.matchConfidence || 0;
        results.po_match.needs_review = poResult.needsReview || false;
        results.po_match.explanation = poResult.explanation || '';
        results.po_match.breakdown = poResult.matchBreakdown || null;
        results.po_match.candidates = poResult.candidates || [];

        if (poResult.po) {
          results.po = poResult.po;
          results.po_match.matched = true;
          results.po_match.po_id = poResult.po.id;
          results.po_match.po_number = poResult.po.po_number;
          results.suggestions.po_matches = [poResult.po];

          // Add confidence-based message
          const confPercent = Math.round((poResult.matchConfidence || 0) * 100);
          if (poResult.needsReview) {
            results.messages.push(`Matched PO: ${poResult.po.po_number} (${confPercent}% confidence - review recommended)`);
            results.review_flags.push('po_match_needs_review');
          } else {
            results.messages.push(`Matched PO: ${poResult.po.po_number} (${confPercent}% confidence)`);
          }

          // Auto-link suggested allocations to the matched PO
          if (results.suggested_allocations?.length > 0) {
            results.suggested_allocations = results.suggested_allocations.map(alloc => ({
              ...alloc,
              po_id: poResult.po.id,
              _aiLinked: true
            }));
            results.messages.push(`Auto-linked allocations to ${poResult.po.po_number}`);
          }
        } else if (poResult.candidates && poResult.candidates.length > 0) {
          // No auto-match, but candidates found
          results.suggestions.po_matches = poResult.candidates.map(c => ({
            id: c.po_id,
            po_number: c.po_number,
            score: c.score,
            explanation: c.explanation
          }));
          results.messages.push(`${poResult.candidates.length} possible PO match(es) found - review required`);
          results.review_flags.push('multiple_po_candidates');
          results.po_match.needs_review = true;
          results.po_match.explanation = poResult.explanation;
        }
      } else {
        // No match found
        results.po_match.explanation = 'No matching POs found for this vendor on this job';
        results.messages.push('No matching PO found - may need to create one');
      }
    }

    // 9. Generate standardized filename
    results.standardizedFilename = standards.generateInvoiceFilename({
      jobName: results.matchedJob?.name || 'Unknown',
      vendorName: results.vendor?.name || extracted.vendor?.companyName || 'Unknown',
      invoiceDate: extracted.invoiceDate,
      extension: originalFilename.split('.').pop() || 'pdf'
    });
    results.messages.push(`Renamed to: ${results.standardizedFilename}`);

    // 10. Capture prices from line items into Price Intelligence
    if (results.vendor?.id && extracted.lineItems?.length > 0) {
      try {
        const priceResults = await priceCapture.captureFromInvoice({
          invoiceId: results.invoiceId, // Will be set after insert
          vendorId: results.vendor.id,
          lineItems: extracted.lineItems,
          invoiceDate: extracted.invoiceDate
        });

        results.price_capture = priceResults;
        if (priceResults.captured > 0) {
          results.messages.push(`Captured ${priceResults.captured} prices for Price Intelligence`);
        }
        if (priceResults.unmatched.length > 0) {
          results.messages.push(`${priceResults.unmatched.length} items not matched to master items`);
        }
      } catch (err) {
        logger.error('Price capture error', { component: 'price-capture', error: err.message });
        // Non-fatal - don't fail invoice processing
      }
    }

    // 11. Final review status
    if (results.review_flags.length > 0) {
      results.needs_review = true;
    }

    results.success = true;

  } catch (err) {
    results.success = false;
    results.ai_processed = false;
    results.messages.push(`Error: ${err.message}`);
    results.review_flags.push('ai_extraction_failed');
    results.needs_review = true;
    logger.error('Invoice processing error', { component: 'ai', error: err.message, stack: err.stack });
  }

  return results;
}

// ============================================================
// LIEN RELEASE PROCESSING
// ============================================================

const LIEN_RELEASE_SCHEMA = `{
  "documentType": "lien_release",
  "releaseType": "string: conditional_progress, unconditional_progress, conditional_final, unconditional_final",
  "vendor": {
    "companyName": "string, the company releasing the lien (subcontractor/supplier)",
    "address": "string or null"
  },
  "job": {
    "reference": "string or null, project/job name, client name, or address",
    "address": "string or null, property address",
    "owner": "string or null, property owner name"
  },
  "customer": "string or null, who the release is made to (usually Ross Built)",
  "amount": "number or null, the payment amount being released",
  "throughDate": "string or null, YYYY-MM-DD format - date through which work/payment is covered",
  "releaseDate": "string or null, YYYY-MM-DD format - date the release was signed",
  "signer": {
    "name": "string or null, name of person signing",
    "title": "string or null, title/position of signer"
  },
  "notary": {
    "name": "string or null, notary public name",
    "county": "string or null, county of notarization",
    "expiration": "string or null, YYYY-MM-DD format - notary commission expiration"
  },
  "extractionConfidence": {
    "vendor": "number 0-1",
    "releaseType": "number 0-1",
    "amount": "number 0-1",
    "job": "number 0-1",
    "dates": "number 0-1"
  }
}`;

/**
 * Extract lien release data using Claude AI
 */
async function extractLienReleaseData(pdfText, filename) {
  const prompt = `Analyze this lien release/waiver document and extract ALL information.

FILE: ${filename}

DOCUMENT CONTENTS:
${pdfText}

OUTPUT SCHEMA:
${LIEN_RELEASE_SCHEMA}

CRITICAL IDENTIFICATION RULES:
1. Determine the release TYPE from the document title:
   - "CONDITIONAL" means payment has NOT yet been received
   - "UNCONDITIONAL" means payment HAS been received
   - "PROGRESS" or "PARTIAL" means ongoing work (not final)
   - "FINAL" means last/completion payment

2. The VENDOR is the company releasing/waiving their lien rights (the subcontractor/supplier)
3. Look for "Claimant", "Contractor", "Maker" - this is usually the vendor
4. Ross Built is typically the "Customer" or "Maker" being released TO

5. For AMOUNT:
   - Look for payment amount, often handwritten or typed
   - May appear after "sum of" or "amount of"
   - Watch for "$" followed by numbers

6. For THROUGH DATE:
   - Look for "through" date, "furnished through", "work performed through"
   - This is the date work/materials are covered up to

7. For JOB/PROPERTY:
   - Look for property address
   - Owner name
   - Job name/reference
   - "Job location", "Property", "Project"

FLORIDA STATUTE REFERENCE:
These often reference Florida Statute § 713.20 for lien waivers.

Return ONLY valid JSON, no markdown.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: `You are an expert construction document processor for Ross Built Custom Homes in Florida.
You specialize in analyzing lien release/waiver documents.

LIEN RELEASE TYPES:
- Conditional Progress: Payment not yet received, covers ongoing work
- Unconditional Progress: Payment received, covers ongoing work
- Conditional Final: Payment not yet received, final completion
- Unconditional Final: Payment received, final completion

The vendor/claimant is the subcontractor GIVING UP lien rights.
Ross Built is typically the party being released (the customer/owner's contractor).

Return ONLY valid JSON, no markdown code blocks.`,
      messages: [{ role: 'user', content: prompt }]
    });

    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const data = JSON.parse(jsonStr);

    // Normalize the extracted data
    if (data.vendor?.companyName) {
      data.vendor.companyName = standards.toTitleCase(data.vendor.companyName);
    }
    if (data.throughDate) {
      data.throughDate = standards.normalizeDate(data.throughDate);
    }
    if (data.releaseDate) {
      data.releaseDate = standards.normalizeDate(data.releaseDate);
    }
    if (data.notary?.expiration) {
      data.notary.expiration = standards.normalizeDate(data.notary.expiration);
    }
    if (data.job?.address) {
      data.job.address = standards.normalizeAddress(data.job.address);
    }

    // Validate release type
    const validTypes = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'];
    if (!validTypes.includes(data.releaseType)) {
      // Try to infer from keywords
      const text = pdfText.toLowerCase();
      const hasConditional = text.includes('conditional');
      const hasUnconditional = text.includes('unconditional');
      const hasFinal = text.includes('final');

      if (hasUnconditional) {
        data.releaseType = hasFinal ? 'unconditional_final' : 'unconditional_progress';
      } else {
        data.releaseType = hasFinal ? 'conditional_final' : 'conditional_progress';
      }
    }

    return data;
  } catch (err) {
    throw new Error(`AI lien release extraction failed: ${err.message}`);
  }
}

/**
 * Process a lien release PDF with AI
 *
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} originalFilename - Original filename
 * @returns {Promise<object>} - Processing results with confidence scores
 */
async function processLienRelease(pdfBuffer, originalFilename) {
  const results = {
    success: false,
    ai_processed: true,
    extracted: null,
    ai_extracted_data: null,
    ai_confidence: {},
    matchedJob: null,
    vendor: null,
    needs_review: false,
    review_flags: [],
    messages: []
  };

  try {
    // 1. Extract text from PDF
    const pdfText = await extractTextFromPDF(pdfBuffer);
    const isScannedPDF = !pdfText || pdfText.trim().length < 50;

    if (isScannedPDF) {
      results.messages.push('Scanned PDF detected - using vision extraction...');
    }

    // Store raw text for audit
    results.ai_extracted_data = { raw_text: pdfText?.substring(0, 5000) || '', scanned: isScannedPDF };

    // 2. AI extraction - use vision for scanned PDFs
    results.messages.push('Extracting lien release data with AI...');
    let extracted;

    if (isScannedPDF) {
      // Use Claude's vision capability for scanned PDFs
      const systemPrompt = `You are an expert construction document processor for Ross Built Custom Homes in Florida.
You specialize in analyzing lien release/waiver documents from scanned images.

LIEN RELEASE TYPES:
- conditional_progress: Payment not yet received, covers ongoing work
- unconditional_progress: Payment received, covers ongoing work
- conditional_final: Payment not yet received, final completion
- unconditional_final: Payment received, final completion

The vendor/claimant is the subcontractor GIVING UP lien rights.
Ross Built is typically the party being released (the customer/owner's contractor).

EXTRACTION TIPS FOR SCANNED DOCUMENTS:
- Look carefully at handwritten text for amounts and dates
- The header/title usually indicates the release type
- Vendor name is often in letterhead or at the bottom
- Job address/owner may be handwritten in blanks

Return ONLY valid JSON, no markdown code blocks.`;

      extracted = await extractFromScannedPDF(pdfBuffer, LIEN_RELEASE_SCHEMA, systemPrompt);
    } else {
      extracted = await extractLienReleaseData(pdfText || '', originalFilename);
    }

    // Normalize the extracted data (for both text and vision extraction)
    if (extracted.vendor?.companyName) {
      extracted.vendor.companyName = standards.toTitleCase(extracted.vendor.companyName);
    }
    if (extracted.throughDate) {
      extracted.throughDate = standards.normalizeDate(extracted.throughDate);
    }
    if (extracted.releaseDate) {
      extracted.releaseDate = standards.normalizeDate(extracted.releaseDate);
    }
    if (extracted.notary?.expiration) {
      extracted.notary.expiration = standards.normalizeDate(extracted.notary.expiration);
    }
    if (extracted.job?.address) {
      extracted.job.address = standards.normalizeAddress(extracted.job.address);
    }

    // Validate release type
    const validTypes = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'];
    if (!validTypes.includes(extracted.releaseType)) {
      extracted.releaseType = 'conditional_progress'; // Default
    }

    results.extracted = extracted;
    results.ai_extracted_data = {
      ...results.ai_extracted_data,
      parsed_vendor_name: extracted.vendor?.companyName,
      parsed_release_type: extracted.releaseType,
      parsed_amount: extracted.amount,
      parsed_through_date: extracted.throughDate,
      parsed_job: extracted.job
    };

    // 3. Set AI confidence scores
    const aiConf = extracted.extractionConfidence || {};
    results.ai_confidence = {
      vendor: aiConf.vendor || 0.5,
      releaseType: aiConf.releaseType || 0.7,
      amount: aiConf.amount || 0.5,
      job: aiConf.job || 0.5,
      dates: aiConf.dates || 0.5,
      overall: 0
    };

    // Calculate overall confidence
    const confValues = Object.values(results.ai_confidence).filter(v => typeof v === 'number');
    results.ai_confidence.overall = confValues.reduce((a, b) => a + b, 0) / confValues.length;

    results.messages.push(`Extracted: ${extracted.releaseType} from ${extracted.vendor?.companyName || 'Unknown vendor'}`);

    // 4. Match job if we have job data
    const jobData = extracted.job;
    const hasJobReference = jobData && (jobData.reference || jobData.address || jobData.owner);

    if (hasJobReference) {
      const jobMatch = await findMatchingJob(jobData);
      results.ai_confidence.job = jobMatch.confidence;

      const searchDesc = jobData.reference || jobData.owner || jobData.address || 'unknown';
      results.messages.push(`Job reference found: "${searchDesc}"`);

      if (jobMatch.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
        results.matchedJob = jobMatch.job;
        results.messages.push(`Matched to job: ${jobMatch.job.name} (${Math.round(jobMatch.confidence * 100)}% confidence)`);
      } else if (jobMatch.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
        results.matchedJob = jobMatch.job;
        results.needs_review = true;
        results.review_flags.push('verify_job');
        results.messages.push(`Matched to job: ${jobMatch.job.name} (${Math.round(jobMatch.confidence * 100)}% confidence - needs verification)`);
      } else if (jobMatch.confidence > 0) {
        results.matchedJob = null;
        results.needs_review = true;
        results.review_flags.push('select_job');
        results.messages.push(`Low confidence job match - manual selection required`);
      } else {
        results.needs_review = true;
        results.review_flags.push('no_job_match');
        results.messages.push(`No matching job found for: ${searchDesc}`);
      }
    } else {
      results.needs_review = true;
      results.review_flags.push('missing_job_reference');
      results.messages.push('No job reference found on lien release');
    }

    // 5. Find or create vendor
    if (extracted.vendor?.companyName) {
      const vendorResult = await findOrCreateVendor(extracted.vendor);
      if (vendorResult.vendor) {
        results.vendor = vendorResult.vendor;
        results.ai_confidence.vendor = Math.max(results.ai_confidence.vendor, vendorResult.confidence);
        results.messages.push(vendorResult.isNew
          ? `Created new vendor: ${vendorResult.vendor.name}`
          : `Matched vendor: ${vendorResult.vendor.name} (${Math.round(vendorResult.confidence * 100)}%)`);
      }
    }

    // 6. Check for missing/low confidence fields
    if (results.ai_confidence.amount < CONFIDENCE_THRESHOLDS.MEDIUM) {
      results.review_flags.push('verify_amount');
    }
    if (results.ai_confidence.vendor < CONFIDENCE_THRESHOLDS.MEDIUM) {
      results.review_flags.push('verify_vendor');
    }
    if (!extracted.throughDate) {
      results.review_flags.push('missing_through_date');
    }

    // Set needs_review if we have any review flags
    if (results.review_flags.length > 0) {
      results.needs_review = true;
    }

    results.success = true;
    results.messages.push('Lien release processing complete');

  } catch (err) {
    results.success = false;
    results.messages.push(`Processing error: ${err.message}`);
    logger.error('Lien release processing error', { component: 'ai', error: err.message, stack: err.stack });
  }

  return results;
}

// ============================================================
// MASTER DOCUMENT PROCESSOR
// ============================================================

/**
 * Document types that can be processed
 */
const DOCUMENT_TYPES = {
  INVOICE: 'invoice',
  LIEN_RELEASE: 'lien_release',
  PURCHASE_ORDER: 'purchase_order',
  QUOTE: 'quote',
  CHANGE_ORDER: 'change_order',
  INSURANCE_CERTIFICATE: 'insurance_certificate',
  CONTRACT: 'contract',
  UNKNOWN: 'unknown'
};

/**
 * Classify a document using AI
 * @param {string} pdfText - Extracted text from the PDF
 * @param {string} filename - Original filename
 * @returns {Promise<{type: string, confidence: number, reasoning: string}>}
 */
async function classifyDocument(pdfText, filename) {
  const prompt = `Analyze this construction document and determine its type.

FILENAME: ${filename}

DOCUMENT TEXT (first 3000 chars):
${pdfText.substring(0, 3000)}

DOCUMENT TYPES TO IDENTIFY:
1. "invoice" - A bill/invoice requesting payment for goods or services
   - Look for: "Invoice", "Bill To", "Amount Due", "Payment Terms", invoice numbers

2. "lien_release" - A lien waiver/release document
   - Look for: "Lien Release", "Waiver", "Conditional", "Unconditional", "Florida Statute 713"
   - Types: Conditional Progress, Unconditional Progress, Conditional Final, Unconditional Final

3. "purchase_order" - A PO authorizing work/purchase
   - Look for: "Purchase Order", "PO Number", "Authorized", "Scope of Work"

4. "quote" - An estimate or proposal for work
   - Look for: "Quote", "Estimate", "Proposal", "Bid", pricing for future work

5. "change_order" - A change to existing contract/PO
   - Look for: "Change Order", "CO #", "Amendment", "Modification", additional/reduced scope

6. "insurance_certificate" - Certificate of insurance/liability
   - Look for: "Certificate of Insurance", "COI", "Liability", "Workers Comp", "ACORD"

7. "contract" - A formal agreement/contract
   - Look for: "Agreement", "Contract", "Terms and Conditions", signatures, legal terms

8. "unknown" - Cannot determine document type

Return JSON only:
{
  "type": "invoice|lien_release|purchase_order|quote|change_order|insurance_certificate|contract|unknown",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this classification",
  "subtype": "Optional subtype (e.g., 'conditional_progress' for lien releases)"
}`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });

    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    return JSON.parse(jsonStr);
  } catch (err) {
    logger.error('Document classification error', { component: 'ai', error: err.message });
    return {
      type: DOCUMENT_TYPES.UNKNOWN,
      confidence: 0,
      reasoning: 'Classification failed: ' + err.message
    };
  }
}

/**
 * Master document processor - classifies and routes documents
 * @param {Buffer} pdfBuffer - PDF file buffer
 * @param {string} originalFilename - Original filename
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Processing result with document type and extracted data
 */
async function processDocument(pdfBuffer, originalFilename, options = {}) {
  const result = {
    success: false,
    documentType: null,
    classification: null,
    data: null,
    messages: [],
    redirect: null
  };

  try {
    // 1. Extract text from PDF
    result.messages.push('Extracting text from document...');
    const pdfText = await extractTextFromPDF(pdfBuffer);

    if (!pdfText || pdfText.length < 20) {
      result.messages.push('Warning: Low text extraction - document may be scanned/image-based');
    }

    // 2. Classify the document
    result.messages.push('Classifying document type with AI...');
    const classification = await classifyDocument(pdfText || '', originalFilename);
    result.classification = classification;
    result.documentType = classification.type;
    result.messages.push(`Identified as: ${classification.type} (${Math.round(classification.confidence * 100)}% confidence)`);
    result.messages.push(`Reasoning: ${classification.reasoning}`);

    // 3. Route to appropriate processor based on type
    switch (classification.type) {
      case DOCUMENT_TYPES.INVOICE:
        result.messages.push('Processing as invoice...');
        const invoiceResult = await processInvoice(pdfBuffer, originalFilename, options.uploadedBy);
        result.data = invoiceResult;
        result.success = invoiceResult.success;
        result.redirect = {
          page: 'index.html',
          param: 'invoice',
          id: invoiceResult.invoice?.id
        };
        if (invoiceResult.messages) {
          result.messages.push(...invoiceResult.messages);
        }
        break;

      case DOCUMENT_TYPES.LIEN_RELEASE:
        result.messages.push('Processing as lien release...');
        const lienResult = await processLienRelease(pdfBuffer, originalFilename);
        result.data = lienResult;
        result.success = lienResult.success;
        // Note: lien release needs to be saved separately - we return the extracted data
        result.redirect = {
          page: 'lien-releases.html',
          action: 'create',
          data: lienResult
        };
        if (lienResult.messages) {
          result.messages.push(...lienResult.messages);
        }
        break;

      case DOCUMENT_TYPES.PURCHASE_ORDER:
        result.messages.push('Document identified as Purchase Order');
        result.messages.push('PO import requires manual entry - extracted data provided for reference');
        result.data = {
          extracted: await extractPOData(pdfText, originalFilename),
          pdfText: pdfText?.substring(0, 2000)
        };
        result.success = true;
        result.redirect = {
          page: 'pos.html',
          action: 'create'
        };
        break;

      case DOCUMENT_TYPES.QUOTE:
        result.messages.push('Document identified as Quote/Estimate');
        result.messages.push('Quotes can be converted to POs after review');
        result.data = {
          extracted: await extractQuoteData(pdfText, originalFilename),
          pdfText: pdfText?.substring(0, 2000)
        };
        result.success = true;
        result.redirect = {
          page: 'pos.html',
          action: 'create_from_quote'
        };
        break;

      case DOCUMENT_TYPES.CHANGE_ORDER:
        result.messages.push('Document identified as Change Order');
        result.data = {
          extracted: await extractChangeOrderData(pdfText, originalFilename),
          pdfText: pdfText?.substring(0, 2000)
        };
        result.success = true;
        result.redirect = {
          page: 'pos.html',
          action: 'change_order'
        };
        break;

      case DOCUMENT_TYPES.INSURANCE_CERTIFICATE:
        result.messages.push('Document identified as Insurance Certificate');
        result.messages.push('Insurance certificates are stored for vendor compliance');
        result.data = {
          extracted: await extractInsuranceData(pdfText, originalFilename),
          pdfText: pdfText?.substring(0, 2000)
        };
        result.success = true;
        result.redirect = {
          page: 'vendors.html',
          action: 'add_insurance'
        };
        break;

      case DOCUMENT_TYPES.CONTRACT:
        result.messages.push('Document identified as Contract');
        result.data = {
          pdfText: pdfText?.substring(0, 2000)
        };
        result.success = true;
        break;

      default:
        // Default to invoice processing for construction documents
        result.messages.push('Document type unclear - attempting to process as invoice');
        result.documentType = DOCUMENT_TYPES.INVOICE;
        const fallbackResult = await processInvoice(pdfBuffer, originalFilename, options.uploadedBy);
        result.data = fallbackResult;
        result.success = fallbackResult.success;
        result.redirect = {
          page: 'index.html',
          param: 'invoice',
          id: fallbackResult.invoice?.id
        };
        if (fallbackResult.messages) {
          result.messages.push(...fallbackResult.messages);
        }
    }

    result.messages.push('Document processing complete');
    return result;

  } catch (err) {
    logger.error('Master document processor error', { component: 'ai', error: err.message, stack: err.stack });
    result.messages.push('Error: ' + err.message);
    result.success = false;
    return result;
  }
}

/**
 * Extract PO data from text (basic extraction for PO documents)
 */
async function extractPOData(pdfText, filename) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Extract purchase order information from this document:

${pdfText?.substring(0, 3000) || 'No text available'}

Return JSON:
{
  "poNumber": "PO number if found",
  "vendor": {"companyName": "vendor name", "contact": "contact person"},
  "job": {"reference": "job reference/address"},
  "amount": "total amount as number",
  "date": "PO date",
  "description": "scope of work description",
  "lineItems": [{"description": "item", "amount": 0}]
}`
      }]
    });
    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    return JSON.parse(jsonStr);
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Extract quote data from text
 */
async function extractQuoteData(pdfText, filename) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Extract quote/estimate information from this document:

${pdfText?.substring(0, 3000) || 'No text available'}

Return JSON:
{
  "quoteNumber": "quote/estimate number",
  "vendor": {"companyName": "vendor name"},
  "job": {"reference": "job reference/address"},
  "amount": "total quoted amount as number",
  "date": "quote date",
  "validUntil": "expiration date if specified",
  "description": "scope of work",
  "lineItems": [{"description": "item", "amount": 0}]
}`
      }]
    });
    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    return JSON.parse(jsonStr);
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Extract change order data from text
 */
async function extractChangeOrderData(pdfText, filename) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Extract change order information from this document:

${pdfText?.substring(0, 3000) || 'No text available'}

Return JSON:
{
  "coNumber": "change order number",
  "poNumber": "related PO number if referenced",
  "vendor": {"companyName": "vendor name"},
  "job": {"reference": "job reference/address"},
  "amount": "change amount (positive for addition, negative for deduction)",
  "date": "CO date",
  "reason": "reason for change",
  "description": "scope change description"
}`
      }]
    });
    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    return JSON.parse(jsonStr);
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Extract insurance certificate data from text
 */
async function extractInsuranceData(pdfText, filename) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{
        role: 'user',
        content: `Extract insurance certificate information from this document:

${pdfText?.substring(0, 3000) || 'No text available'}

Return JSON:
{
  "insured": {"companyName": "insured company name"},
  "insuranceCompany": "insurance provider",
  "policyNumber": "policy number",
  "effectiveDate": "policy start date",
  "expirationDate": "policy end date",
  "generalLiability": {"limit": "coverage limit amount"},
  "workersComp": {"limit": "coverage limit amount"},
  "auto": {"limit": "coverage limit amount"},
  "umbrella": {"limit": "coverage limit amount"},
  "certificateHolder": "who is listed as certificate holder"
}`
      }]
    });
    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }
    return JSON.parse(jsonStr);
  } catch (err) {
    return { error: err.message };
  }
}

// ============================================================
// MULTI-INVOICE PDF DETECTION AND SPLITTING
// ============================================================

const { PDFDocument } = require('pdf-lib');

/**
 * Analyze a multi-page PDF to detect invoice boundaries
 * Uses Claude Vision to identify where each invoice starts/ends
 * @param {Buffer} pdfBuffer - The combined PDF buffer
 * @param {string} filename - Original filename for context
 * @returns {Promise<{invoices: Array<{startPage: number, endPage: number, invoiceNumber: string, vendor: string, amount: number}>, totalPages: number}>}
 */
async function analyzeMultiInvoicePDF(pdfBuffer, filename = 'document.pdf') {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const totalPages = pdfDoc.getPageCount();

  logger.info('Analyzing PDF for invoice boundaries', { component: 'multi-invoice', totalPages });

  // For small PDFs (≤3 pages), assume single invoice
  if (totalPages <= 3) {
    logger.debug('Small document, treating as single invoice', { component: 'multi-invoice' });
    return {
      invoices: [{ startPage: 1, endPage: totalPages, invoiceNumber: null, vendor: null, amount: null }],
      totalPages,
      isMultiInvoice: false
    };
  }

  // Convert pages to images for analysis
  const pageImages = await convertPDFPagesToImages(pdfBuffer, totalPages);

  if (pageImages.length === 0) {
    logger.warn('Could not convert pages to images, treating as single invoice', { component: 'multi-invoice' });
    return {
      invoices: [{ startPage: 1, endPage: totalPages, invoiceNumber: null, vendor: null, amount: null }],
      totalPages,
      isMultiInvoice: false
    };
  }

  // Use Claude Vision to analyze pages and detect boundaries
  const boundaries = await detectInvoiceBoundaries(pageImages, filename);

  return {
    invoices: boundaries.invoices,
    totalPages,
    isMultiInvoice: boundaries.invoices.length > 1
  };
}

/**
 * Convert PDF pages to base64 images for Vision analysis
 * @param {Buffer} pdfBuffer
 * @param {number} totalPages
 * @returns {Promise<Array<{pageNumber: number, base64: string, mediaType: string}>>}
 */
async function convertPDFPagesToImages(pdfBuffer, totalPages) {
  const images = [];

  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const sharp = require('sharp');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true
    });

    const pdf = await loadingTask.promise;

    // Process all pages (or limit for very large documents)
    const maxPages = Math.min(totalPages, 50);

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const ops = await page.getOperatorList();

        // Try to extract embedded images
        for (let i = 0; i < ops.fnArray.length; i++) {
          if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
            const imgName = ops.argsArray[i][0];
            try {
              const img = await page.objs.get(imgName);
              if (img && img.data && img.width > 100 && img.height > 100) {
                const width = img.width;
                const height = img.height;
                const channels = img.data.length / (width * height);

                if (channels >= 3 && channels <= 4) {
                  // Resize for faster processing (max 800px wide)
                  const imageBuffer = await sharp(Buffer.from(img.data), {
                    raw: { width, height, channels: Math.round(channels) }
                  })
                  .resize(800, null, { fit: 'inside', withoutEnlargement: true })
                  .jpeg({ quality: 70 })
                  .toBuffer();

                  images.push({
                    pageNumber: pageNum,
                    base64: imageBuffer.toString('base64'),
                    mediaType: 'image/jpeg'
                  });
                  break; // One image per page is enough
                }
              }
            } catch (imgErr) {
              // Skip problematic images
            }
          }
        }
      } catch (pageErr) {
        logger.debug('Could not process page', { component: 'multi-invoice', pageNum, error: pageErr.message });
      }
    }

    logger.info('PDF pages converted to images', { component: 'multi-invoice', converted: images.length, total: maxPages });

  } catch (err) {
    logger.error('PDF to image conversion failed', { component: 'multi-invoice', error: err.message });
  }

  return images;
}

/**
 * Use Claude Vision to detect invoice boundaries in page images
 * @param {Array} pageImages - Array of {pageNumber, base64, mediaType}
 * @param {string} filename - Original filename
 * @returns {Promise<{invoices: Array}>}
 */
async function detectInvoiceBoundaries(pageImages, filename) {
  if (pageImages.length === 0) {
    return { invoices: [{ startPage: 1, endPage: 1, invoiceNumber: null, vendor: null, amount: null }] };
  }

  // For efficiency, sample pages if there are too many
  let samplesToAnalyze = pageImages;
  if (pageImages.length > 15) {
    // Sample every Nth page plus first and last
    const step = Math.ceil(pageImages.length / 12);
    samplesToAnalyze = pageImages.filter((_, i) => i === 0 || i === pageImages.length - 1 || i % step === 0);
    logger.info('Sampling pages for analysis', { component: 'multi-invoice', sampled: samplesToAnalyze.length, total: pageImages.length });
  }

  // Build the vision request with multiple images
  const imageContent = samplesToAnalyze.map(img => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: img.mediaType,
      data: img.base64
    }
  }));

  // Add page number labels
  const pageLabels = samplesToAnalyze.map(img => `Page ${img.pageNumber}`).join(', ');

  const prompt = `You are analyzing a PDF document that may contain multiple separate invoices combined into one file.
The document has ${pageImages.length} total pages. You are seeing pages: ${pageLabels}

IMPORTANT: This is a construction/contractor invoice bundle. Each separate invoice typically has:
- A distinct vendor name/company letterhead at the top
- Its own invoice number
- Its own total amount
- May be 1-3 pages each

Analyze these pages and identify where each SEPARATE invoice starts.

Look for these boundary indicators:
1. Different company name/letterhead appearing
2. New "Invoice", "Bill", "Statement" header
3. Different invoice number format
4. Different vendor address/logo
5. Payment confirmation pages (like FPL/utility payments) are separate from invoices

Return a JSON object with this structure:
{
  "invoices": [
    {
      "startPage": 1,
      "endPage": 2,
      "vendor": "Vendor Name or Company",
      "invoiceNumber": "INV-123 or null if unclear",
      "approximateAmount": 1234.56 or null
    },
    ...more invoices...
  ],
  "confidence": 0.0-1.0,
  "notes": "Any observations about the document structure"
}

Return ONLY the JSON object, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          ...imageContent,
          { type: 'text', text: prompt }
        ]
      }]
    });

    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const result = JSON.parse(jsonStr);
    logger.info('Invoice boundaries detected', { component: 'multi-invoice', count: result.invoices?.length || 1, confidence: result.confidence || 'N/A' });

    // Validate and fill gaps in page ranges
    if (result.invoices && result.invoices.length > 0) {
      // Sort by startPage
      result.invoices.sort((a, b) => a.startPage - b.startPage);

      // Fill any gaps between detected invoices
      const filledInvoices = [];
      let lastEndPage = 0;

      for (const inv of result.invoices) {
        // If there's a gap, the previous invoice might extend further
        if (inv.startPage > lastEndPage + 1 && filledInvoices.length > 0) {
          filledInvoices[filledInvoices.length - 1].endPage = inv.startPage - 1;
        }
        filledInvoices.push(inv);
        lastEndPage = inv.endPage;
      }

      // Extend last invoice to end of document if needed
      if (filledInvoices.length > 0 && filledInvoices[filledInvoices.length - 1].endPage < pageImages.length) {
        filledInvoices[filledInvoices.length - 1].endPage = pageImages.length;
      }

      return { invoices: filledInvoices, confidence: result.confidence, notes: result.notes };
    }

    return result;

  } catch (err) {
    logger.error('Boundary detection failed', { component: 'multi-invoice', error: err.message });
    // Fall back to treating entire document as single invoice
    return {
      invoices: [{ startPage: 1, endPage: pageImages.length, invoiceNumber: null, vendor: null, amount: null }],
      confidence: 0,
      notes: 'Detection failed, treating as single invoice'
    };
  }
}

/**
 * Split a PDF by detected invoice boundaries
 * @param {Buffer} pdfBuffer - Original PDF
 * @param {Array} invoiceBoundaries - Array of {startPage, endPage, ...}
 * @returns {Promise<Array<{invoiceIndex: number, buffer: Buffer, metadata: Object}>>}
 */
async function splitPDFByInvoices(pdfBuffer, invoiceBoundaries) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const splits = [];

  for (let i = 0; i < invoiceBoundaries.length; i++) {
    const boundary = invoiceBoundaries[i];
    const newPdf = await PDFDocument.create();

    // Copy pages for this invoice (pages are 0-indexed in pdf-lib)
    const pageIndices = [];
    for (let p = boundary.startPage - 1; p < boundary.endPage; p++) {
      pageIndices.push(p);
    }

    const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach(page => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();

    splits.push({
      invoiceIndex: i + 1,
      buffer: Buffer.from(pdfBytes),
      pageRange: `${boundary.startPage}-${boundary.endPage}`,
      metadata: {
        vendor: boundary.vendor,
        invoiceNumber: boundary.invoiceNumber,
        approximateAmount: boundary.approximateAmount
      }
    });
  }

  logger.info('PDF split into separate invoices', { component: 'multi-invoice', count: splits.length });
  return splits;
}

/**
 * Process a multi-invoice PDF: analyze, split, and process each invoice
 * @param {Buffer} pdfBuffer - The combined PDF
 * @param {string} originalFilename - Original filename
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Results for all invoices
 */
async function processMultiInvoicePDF(pdfBuffer, originalFilename, options = {}) {
  const results = {
    success: true,
    isMultiInvoice: false,
    totalPages: 0,
    invoicesDetected: 0,
    invoicesProcessed: [],
    invoicesFailed: [],
    messages: []
  };

  try {
    // Step 1: Analyze the PDF for invoice boundaries
    results.messages.push('Analyzing PDF for multiple invoices...');
    const analysis = await analyzeMultiInvoicePDF(pdfBuffer, originalFilename);

    results.totalPages = analysis.totalPages;
    results.invoicesDetected = analysis.invoices.length;
    results.isMultiInvoice = analysis.isMultiInvoice;

    if (!analysis.isMultiInvoice) {
      results.messages.push('Single invoice detected, processing normally');
      // Process as single invoice
      const singleResult = await processInvoice(pdfBuffer, originalFilename);
      results.invoicesProcessed.push({
        invoiceIndex: 1,
        pageRange: `1-${analysis.totalPages}`,
        result: singleResult
      });
      return results;
    }

    results.messages.push(`Detected ${analysis.invoices.length} separate invoices`);

    // Step 2: Split the PDF by invoice boundaries
    const splits = await splitPDFByInvoices(pdfBuffer, analysis.invoices);

    // Step 3: Process each split invoice
    for (const split of splits) {
      try {
        results.messages.push(`Processing invoice ${split.invoiceIndex} (pages ${split.pageRange})...`);

        // Generate unique filename for this split
        const splitFilename = originalFilename.replace('.pdf', `_inv${split.invoiceIndex}.pdf`);

        // Process the split PDF
        const invoiceResult = await processInvoice(split.buffer, splitFilename);

        // IMPORTANT: Attach the PDF buffer to the result for upload
        invoiceResult.pdfBuffer = split.buffer;
        invoiceResult.splitFilename = splitFilename;

        // Add context from boundary detection
        if (split.metadata.vendor && !invoiceResult.vendor) {
          invoiceResult.detectedVendor = split.metadata.vendor;
        }
        if (split.metadata.invoiceNumber && invoiceResult.extracted) {
          invoiceResult.detectedInvoiceNumber = split.metadata.invoiceNumber;
        }

        results.invoicesProcessed.push({
          invoiceIndex: split.invoiceIndex,
          pageRange: split.pageRange,
          detectedMetadata: split.metadata,
          result: invoiceResult
        });

        results.messages.push(`Invoice ${split.invoiceIndex}: Processed successfully`);

      } catch (invErr) {
        results.invoicesFailed.push({
          invoiceIndex: split.invoiceIndex,
          pageRange: split.pageRange,
          error: invErr.message
        });
        results.messages.push(`Invoice ${split.invoiceIndex}: Failed - ${invErr.message}`);
      }
    }

    results.success = results.invoicesFailed.length === 0;
    results.messages.push(`Complete: ${results.invoicesProcessed.length} processed, ${results.invoicesFailed.length} failed`);

  } catch (err) {
    results.success = false;
    results.messages.push(`Analysis error: ${err.message}`);
  }

  return results;
}


// ============================================================
// PDF SPLITTING FOR COMBINED DOCUMENTS (LEGACY - PAGE BY PAGE)
// ============================================================

/**
 * Split a multi-page PDF into individual page buffers
 * @param {Buffer} pdfBuffer - The combined PDF buffer
 * @returns {Promise<Array<{pageNumber: number, buffer: Buffer}>>}
 */
async function splitPDF(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = pdfDoc.getPageCount();
  const pages = [];

  for (let i = 0; i < pageCount; i++) {
    // Create a new PDF with just this page
    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
    newPdf.addPage(copiedPage);

    const pdfBytes = await newPdf.save();
    pages.push({
      pageNumber: i + 1,
      buffer: Buffer.from(pdfBytes)
    });
  }

  return pages;
}

/**
 * Process a combined PDF document by splitting and processing each page
 * @param {Buffer} pdfBuffer - The combined PDF buffer
 * @param {string} originalFilename - Original filename
 * @param {Object} options - Processing options
 * @returns {Promise<Object>} - Results for all pages
 */
async function processMultiPageDocument(pdfBuffer, originalFilename, options = {}) {
  const results = {
    success: true,
    totalPages: 0,
    processedPages: [],
    failedPages: [],
    summary: {
      invoices: 0,
      lienReleases: 0,
      other: 0
    },
    messages: []
  };

  try {
    // Split the PDF
    results.messages.push('Splitting combined PDF...');
    const pages = await splitPDF(pdfBuffer);
    results.totalPages = pages.length;
    results.messages.push(`Found ${pages.length} pages to process`);

    // Process each page
    for (const page of pages) {
      try {
        results.messages.push(`Processing page ${page.pageNumber}...`);

        // Generate filename for this page
        const pageFilename = originalFilename.replace('.pdf', `_page${page.pageNumber}.pdf`);

        // Process with the master document processor
        const pageResult = await processDocument(page.buffer, pageFilename, options);

        if (pageResult.success) {
          results.processedPages.push({
            pageNumber: page.pageNumber,
            documentType: pageResult.documentType,
            classification: pageResult.classification,
            data: pageResult.data,
            savedRecord: pageResult.savedRecord,
            redirect: pageResult.redirect
          });

          // Update summary
          if (pageResult.documentType === DOCUMENT_TYPES.INVOICE) {
            results.summary.invoices++;
          } else if (pageResult.documentType === DOCUMENT_TYPES.LIEN_RELEASE) {
            results.summary.lienReleases++;
          } else {
            results.summary.other++;
          }

          results.messages.push(`Page ${page.pageNumber}: ${pageResult.documentType} processed successfully`);
        } else {
          results.failedPages.push({
            pageNumber: page.pageNumber,
            error: pageResult.messages?.join(', ') || 'Processing failed'
          });
          results.messages.push(`Page ${page.pageNumber}: Failed - ${pageResult.messages?.join(', ')}`);
        }
      } catch (pageErr) {
        results.failedPages.push({
          pageNumber: page.pageNumber,
          error: pageErr.message
        });
        results.messages.push(`Page ${page.pageNumber}: Error - ${pageErr.message}`);
      }
    }

    results.success = results.failedPages.length === 0;
    results.messages.push(`Processing complete: ${results.processedPages.length} succeeded, ${results.failedPages.length} failed`);

  } catch (err) {
    results.success = false;
    results.messages.push(`Split error: ${err.message}`);
  }

  return results;
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  processInvoice,
  processInvoiceTwoStage,  // New two-stage pipeline
  extractInvoiceRaw,        // Stage 1: Raw extraction
  validateAndEnrich,        // Stage 2: Validation
  calculateFinalConfidence, // Combined confidence calculation
  processLienRelease,
  processDocument,
  processMultiPageDocument,
  // Multi-invoice PDF processing
  analyzeMultiInvoicePDF,
  splitPDFByInvoices,
  processMultiInvoicePDF,
  splitPDF,
  classifyDocument,
  extractTextFromPDF,
  extractInvoiceData,
  extractInvoiceFromImage,
  extractInvoiceFromText,
  extractFromImage,
  extractLienReleaseData,
  findMatchingJob,
  findOrCreateVendor,
  findOrCreatePO,
  suggestCostCodeForDescription,
  suggestCostCodesForLineItems,
  checkForDuplicates,
  storePDFHash,
  generatePDFHash,
  normalizeInvoiceNumber,
  refreshMappings,  // Call this after updating cost code mappings
  CONFIDENCE_THRESHOLDS,
  DOCUMENT_TYPES,
  poMatcher  // Multi-signal PO matching module
};
