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
const aiLearning = require('./ai-learning');
const ocrProcessor = require('./ocr-processor');

// Consolidated duplicate detection
const {
  checkForDuplicates,
  storePDFHash,
  generatePDFHash,
  normalizeInvoiceNumber
} = require('./duplicate-check');

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.90,    // Auto-assign, no review
  MEDIUM: 0.60,  // Auto-assign with review flag
  LOW: 0.60      // Don't auto-assign, show picker
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
      console.error('[AI] Error loading trade mappings:', tradeError.message);
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
      console.log('[AI] Loaded', Object.keys(TRADE_COST_CODE_MAP).length, 'trade mappings from database');
    }

    // Load description mappings
    const { data: descMappings, error: descError } = await supabase
      .from('v2_description_cost_mappings')
      .select('keyword, cost_code:v2_cost_codes(code)');

    if (descError) {
      console.error('[AI] Error loading description mappings:', descError.message);
    } else {
      DESCRIPTION_COST_CODE_MAP = {};
      for (const m of descMappings || []) {
        if (m.cost_code?.code) {
          DESCRIPTION_COST_CODE_MAP[m.keyword] = m.cost_code.code;
        }
      }
      console.log('[AI] Loaded', Object.keys(DESCRIPTION_COST_CODE_MAP).length, 'description mappings from database');
    }

    mappingsLoaded = true;
  } catch (err) {
    console.error('[AI] Failed to load mappings:', err.message);
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
    console.error('PDF parse error:', err.message);
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
  console.log(`[AI] Extracting invoice from ${documentType} text (${documentText.length} chars)`);
  return await extractInvoiceData(documentText, filename);
}

/**
 * Extract invoice data from an image using Claude Vision
 */
async function extractInvoiceFromImage(base64Image, mediaType, filename) {
  console.log(`[AI] Extracting invoice from image: ${filename} (${mediaType})`);

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
      console.log(`[AI Learning] Used learned job mapping: "${searchStrings[0]}" → "${learnedJob.name}" (${Math.round(learnedMatch.confidence * 100)}%, used ${learnedMatch.times_used}x)`);
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
 * @param {string} description - Line item description
 * @param {string} tradeType - Vendor trade type (fallback)
 * @returns {Promise<Object|null>} Cost code suggestion { id, code, name, confidence }
 */
async function suggestCostCodeForDescription(description, tradeType = null) {
  if (!description) return null;

  // Ensure mappings are loaded from database
  await ensureMappingsLoaded();

  const desc = description.toLowerCase();
  let bestMatch = null;
  let bestMatchLength = 0;
  let confidence = 0.6;

  // Find longest matching keyword (more specific = better match)
  for (const [keyword, code] of Object.entries(DESCRIPTION_COST_CODE_MAP)) {
    if (desc.includes(keyword) && keyword.length > bestMatchLength) {
      bestMatch = code;
      bestMatchLength = keyword.length;
    }
  }

  // PRIORITY: If vendor trade is known AND either:
  // 1. No description match found, OR
  // 2. Description match is too short/generic (less than 6 chars keyword)
  // Then use trade-based cost codes instead
  if (tradeType && TRADE_COST_CODE_MAP[tradeType]) {
    const tradeCode = TRADE_COST_CODE_MAP[tradeType][0];

    // Use trade-based code if no match or weak match
    if (!bestMatch || bestMatchLength < 6) {
      bestMatch = tradeCode;
      confidence = 0.85; // High confidence when using known vendor trade
      console.log(`[AI] Using vendor trade "${tradeType}" → ${tradeCode} (description match was weak: "${description}")`);
    }
  }

  if (!bestMatch) return null;

  // Fetch the actual cost code record
  const { data: costCode, error } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .eq('code', bestMatch)
    .single();

  if (error || !costCode) {
    console.log(`[AI] Cost code ${bestMatch} not found in database`);
    return null;
  }

  return {
    id: costCode.id,
    code: costCode.code,
    name: costCode.name,
    confidence: bestMatchLength > 10 ? 0.9 : bestMatchLength > 5 ? 0.75 : confidence
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
      console.log(`[AI Learning] Used learned vendor mapping: "${vendorData.companyName}" → "${learnedVendor.name}" (${Math.round(learnedMatch.confidence * 100)}%)`);
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
      console.log(`[Vendor Alias] "${vendorData.companyName}" → "${aliasVendor.name}" (alias match)`);
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
      console.log(`[Vendor Match] "${vendorData.companyName}" → "${match.vendor.name}" (${match.score}% similarity)`);
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
    console.error('Failed to create vendor:', error.message);
    return { vendor: null, confidence: 0, isNew: false, error: error.message };
  }

  console.log(`[Vendor Created] New vendor: "${canonicalName}" (from "${vendorData.companyName}")`);
  return { vendor: newVendor, confidence: 1.0, isNew: true };
}

// ============================================================
// PO MATCHING / CREATION
// ============================================================

/**
 * Find existing PO or create draft PO
 */
async function findOrCreatePO(jobId, vendorId, invoiceData, jobName) {
  if (!jobId || !vendorId) return null;

  // Look for existing open PO for this vendor/job
  // NOTE: We no longer auto-create POs because they require cost codes on line items.
  // POs should be created manually with proper cost codes, then invoices linked to them.
  const { data: existingPOs } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('job_id', jobId)
    .eq('vendor_id', vendorId)
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (existingPOs && existingPOs.length > 0) {
    return { po: existingPOs[0], isNew: false };
  }

  // Don't auto-create POs - they require cost codes which aren't available at this stage
  // User should create PO manually with cost codes, then link invoice to it
  return null;
}
// Note: Duplicate detection functions moved to ./duplicate-check.js for consolidation

// ============================================================
// MAIN PROCESSING FUNCTION
// ============================================================

/**
 * Process an invoice PDF with AI
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
        console.error('[OCR] Failed:', ocrErr.message);
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

    // 4. Match job with confidence - use full job object with reference, address, clientName, poNumber
    const jobData = extracted.job;
    const hasJobReference = jobData && (jobData.reference || jobData.address || jobData.clientName || jobData.poNumber);

    if (hasJobReference) {
      const jobMatch = await findMatchingJob(jobData);
      results.ai_confidence.job = jobMatch.confidence;
      results.suggestions.possible_jobs = jobMatch.possibleMatches;

      const searchDesc = jobData.reference || jobData.clientName || jobData.address || 'unknown';
      results.messages.push(`Job reference found: "${searchDesc}"`);

      if (jobMatch.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
        // High confidence - auto-assign
        results.matchedJob = jobMatch.job;
        results.messages.push(`Matched to job: ${jobMatch.job.name} (${Math.round(jobMatch.confidence * 100)}% confidence via ${jobMatch.matchType})`);
      } else if (jobMatch.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
        // Medium confidence - auto-assign with review flag
        results.matchedJob = jobMatch.job;
        results.needs_review = true;
        results.review_flags.push('verify_job');
        results.messages.push(`Matched to job: ${jobMatch.job.name} (${Math.round(jobMatch.confidence * 100)}% confidence - needs verification)`);
      } else if (jobMatch.confidence > 0) {
        // Low confidence - don't auto-assign, show suggestions
        results.matchedJob = null;
        results.needs_review = true;
        results.review_flags.push('select_job');
        results.messages.push(`Low confidence job match (${Math.round(jobMatch.confidence * 100)}%) - manual selection required`);
      } else {
        // No match
        results.needs_review = true;
        results.review_flags.push('no_job_match');
        results.messages.push(`No matching job found for: ${searchDesc}`);
      }
    } else {
      results.needs_review = true;
      results.review_flags.push('missing_job_reference');
      results.messages.push('No job reference found on invoice');
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

    // 8. Find or create PO
    if (results.matchedJob && results.vendor) {
      const poResult = await findOrCreatePO(
        results.matchedJob.id,
        results.vendor.id,
        extracted,
        results.matchedJob.name
      );
      if (poResult) {
        results.po = poResult.po;
        results.suggestions.po_matches = [poResult.po];
        // Set PO confidence based on match quality
        if (poResult.isNew) {
          // New PO created - confidence based on how much info we have
          let poConf = 0.65;
          if (results.matchedJob) poConf += 0.08; // Have job
          if (results.vendor) poConf += 0.08; // Have vendor
          if (extracted.totalAmount) poConf += 0.05; // Have amount
          results.ai_confidence.po = Math.min(poConf, 0.82);
        } else {
          // Matched existing PO - high confidence
          let poConf = 0.85;
          // Boost if vendor and job both match
          if (poResult.po.vendor_id === results.vendor?.id) poConf += 0.06;
          if (poResult.po.job_id === results.matchedJob?.id) poConf += 0.06;
          results.ai_confidence.po = Math.min(poConf, 0.97);
        }
        results.messages.push(poResult.isNew
          ? `Created draft PO: ${poResult.poNumber || poResult.po.po_number}`
          : `Matched PO: ${poResult.po.po_number}`);

        // Auto-link suggested allocations to the matched PO
        if (results.suggested_allocations?.length > 0 && !poResult.isNew) {
          results.suggested_allocations = results.suggested_allocations.map(alloc => ({
            ...alloc,
            po_id: poResult.po.id,
            _aiLinked: true
          }));
          results.messages.push(`Auto-linked allocations to ${poResult.po.po_number}`);
        }
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

    // 10. Final review status
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
    console.error('Invoice processing error:', err);
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
    console.error('Lien release processing error:', err);
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
    console.error('Document classification error:', err);
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
    console.error('Master document processor error:', err);
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
// PDF SPLITTING FOR COMBINED DOCUMENTS
// ============================================================

const { PDFDocument } = require('pdf-lib');

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
  processLienRelease,
  processDocument,
  processMultiPageDocument,
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
  DOCUMENT_TYPES
};
