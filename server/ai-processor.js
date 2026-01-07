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

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.90,    // Auto-assign, no review
  MEDIUM: 0.60,  // Auto-assign with review flag
  LOW: 0.60      // Don't auto-assign, show picker
};

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
  "invoiceDate": "string, YYYY-MM-DD",
  "dueDate": "string or null, YYYY-MM-DD",
  "job": {
    "address": "string, the job site / project address",
    "city": "string, default Holmes Beach",
    "state": "FL"
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
  "extractionConfidence": {
    "vendor": "number 0-1, confidence in vendor extraction",
    "amount": "number 0-1, confidence in amount extraction",
    "invoiceNumber": "number 0-1, confidence in invoice number",
    "date": "number 0-1, confidence in date extraction",
    "job": "number 0-1, confidence in job/address extraction"
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
1. Invoice numbers: Look for "Invoice #", "Inv #", "Invoice No.", "Reference #" - extract exactly as shown
2. Amounts: Extract the TOTAL AMOUNT DUE, not subtotals. Look for "Total", "Amount Due", "Balance Due", "Grand Total"
3. Dates: Convert all dates to YYYY-MM-DD format. Look for "Invoice Date", "Date", "Dated"
4. Job/Project: Look for "Job:", "Project:", "Site:", "Location:", "Re:" or any street address that's NOT the vendor's address
5. Line items: Extract ALL work items with their individual amounts

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

  // Default confidence scores if not provided
  if (!normalized.extractionConfidence) {
    normalized.extractionConfidence = {
      vendor: 0.5,
      amount: 0.5,
      invoiceNumber: 0.5,
      date: 0.5,
      job: 0.5
    };
  }

  return normalized;
}

// ============================================================
// JOB MATCHING WITH CONFIDENCE
// ============================================================

/**
 * Find matching job by address with confidence scoring
 * @returns {Object} { job: Object|null, confidence: number, possibleMatches: Array }
 */
async function findMatchingJob(jobAddress) {
  if (!jobAddress) {
    return { job: null, confidence: 0, possibleMatches: [], reason: 'no_address' };
  }

  const { data: jobs, error } = await supabase
    .from('v2_jobs')
    .select('id, name, address, client_name, status');

  if (error || !jobs || jobs.length === 0) {
    return { job: null, confidence: 0, possibleMatches: [], reason: 'no_jobs_found' };
  }

  const normalizedSearch = normalizeForMatch(jobAddress);
  const searchWords = jobAddress.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const searchNum = jobAddress.match(/\d+/)?.[0];

  const matches = [];

  for (const job of jobs) {
    const normalizedJobAddress = normalizeForMatch(job.address || '');
    const normalizedJobName = normalizeForMatch(job.name || '');
    const jobNum = (job.address || job.name).match(/\d+/)?.[0];

    let confidence = 0;
    let matchType = '';

    // Exact match on normalized address
    if (normalizedJobAddress === normalizedSearch) {
      confidence = 0.98;
      matchType = 'exact_address';
    }
    // Exact match on job name
    else if (normalizedJobName === normalizedSearch) {
      confidence = 0.95;
      matchType = 'exact_name';
    }
    // Contains match
    else if (normalizedJobAddress.includes(normalizedSearch) || normalizedSearch.includes(normalizedJobAddress)) {
      confidence = 0.85;
      matchType = 'contains';
    }
    // Street number match
    else if (searchNum && jobNum && searchNum === jobNum) {
      // Check if street name also matches
      const jobWords = (job.address || job.name).toLowerCase().split(/\s+/);
      const streetMatches = searchWords.filter(w => jobWords.some(jw => jw.includes(w) || w.includes(jw)));
      if (streetMatches.length > 0) {
        confidence = 0.75 + (0.15 * streetMatches.length / searchWords.length);
        matchType = 'street_match';
      } else {
        confidence = 0.55;
        matchType = 'number_only';
      }
    }
    // Client name match
    else if (job.client_name && normalizedSearch.includes(normalizeForMatch(job.client_name))) {
      confidence = 0.50;
      matchType = 'client_name';
    }
    // Partial word matches
    else {
      const jobWords = (job.address || job.name).toLowerCase().split(/\s+/);
      const wordMatches = searchWords.filter(w => jobWords.some(jw => jw === w));
      if (wordMatches.length >= 2) {
        confidence = 0.40 + (0.1 * wordMatches.length);
        matchType = 'partial_words';
      }
    }

    if (confidence > 0.30) {
      matches.push({
        id: job.id,
        name: job.name,
        address: job.address,
        client_name: job.client_name,
        confidence: Math.min(confidence, 1),
        matchType
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

// ============================================================
// VENDOR MATCHING / CREATION
// ============================================================

/**
 * Find or create vendor with confidence
 */
async function findOrCreateVendor(vendorData) {
  if (!vendorData?.companyName) {
    return { vendor: null, confidence: 0, isNew: false };
  }

  const normalizedName = normalizeForMatch(vendorData.companyName);

  // Try to find existing vendor
  const { data: vendors } = await supabase
    .from('v2_vendors')
    .select('id, name, email, phone');

  if (vendors) {
    for (const vendor of vendors) {
      const normalizedVendorName = normalizeForMatch(vendor.name);

      // Exact match
      if (normalizedVendorName === normalizedName) {
        return { vendor, confidence: 0.98, isNew: false };
      }

      // Fuzzy match using Levenshtein
      const distance = levenshteinDistance(normalizedVendorName, normalizedName);
      const maxLen = Math.max(normalizedVendorName.length, normalizedName.length);
      const similarity = 1 - (distance / maxLen);

      if (similarity > 0.85) {
        return { vendor, confidence: similarity, isNew: false };
      }
    }
  }

  // Create new vendor
  const { data: newVendor, error } = await supabase
    .from('v2_vendors')
    .insert({
      name: vendorData.companyName,
      email: vendorData.email || null,
      phone: vendorData.phone || null
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create vendor:', error.message);
    return { vendor: null, confidence: 0, isNew: false, error: error.message };
  }

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

  // Create draft PO
  const { count } = await supabase
    .from('v2_purchase_orders')
    .select('*', { count: 'exact', head: true })
    .eq('job_id', jobId);

  const sequence = (count || 0) + 1;
  const poNumber = standards.generatePONumber(jobName || 'Job', sequence);

  const totalAmount = invoiceData.totalAmount || invoiceData.amounts?.totalAmount || 0;

  const { data: newPO, error } = await supabase
    .from('v2_purchase_orders')
    .insert({
      job_id: jobId,
      vendor_id: vendorId,
      po_number: poNumber,
      description: `Auto-generated from Invoice ${invoiceData.invoiceNumber || 'N/A'}`,
      total_amount: totalAmount,
      status: 'open'
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create PO:', error.message);
    return null;
  }

  // Create line items from invoice
  if (invoiceData.lineItems?.length > 0) {
    const lineItems = invoiceData.lineItems.map(li => ({
      po_id: newPO.id,
      description: li.description,
      amount: li.amount || 0,
      invoiced_amount: 0
    }));

    await supabase.from('v2_po_line_items').insert(lineItems);
  }

  return { po: newPO, isNew: true, poNumber };
}

// ============================================================
// DUPLICATE DETECTION
// ============================================================

/**
 * Check for possible duplicate invoices
 */
async function checkForDuplicates(vendorId, invoiceNumber, amount) {
  if (!vendorId) return { isDuplicate: false, possibleDuplicates: [] };

  const { data: existing } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, status, created_at, vendor:v2_vendors(name)')
    .eq('vendor_id', vendorId)
    .is('deleted_at', null);

  if (!existing || existing.length === 0) {
    return { isDuplicate: false, possibleDuplicates: [] };
  }

  const possibleDuplicates = [];

  for (const inv of existing) {
    // Exact invoice number match
    if (inv.invoice_number && inv.invoice_number.toLowerCase() === invoiceNumber?.toLowerCase()) {
      possibleDuplicates.push({
        ...inv,
        matchReason: 'exact_invoice_number',
        confidence: 0.99
      });
      continue;
    }

    // Same amount (within 1%)
    const invAmount = parseFloat(inv.amount);
    const newAmount = parseFloat(amount);
    if (Math.abs(invAmount - newAmount) / newAmount < 0.01) {
      possibleDuplicates.push({
        ...inv,
        matchReason: 'same_amount',
        confidence: 0.60
      });
    }
  }

  possibleDuplicates.sort((a, b) => b.confidence - a.confidence);

  return {
    isDuplicate: possibleDuplicates.some(d => d.confidence > 0.95),
    possibleDuplicates
  };
}

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
      po_matches: []
    },
    messages: []
  };

  try {
    // 1. Extract text from PDF
    const pdfText = await extractTextFromPDF(pdfBuffer);
    if (!pdfText || pdfText.length < 50) {
      results.messages.push('Could not extract text from PDF - may be scanned/image');
      results.review_flags.push('low_text_quality');
    }

    // Store raw text for audit
    results.ai_extracted_data = { raw_text: pdfText?.substring(0, 5000) || '' };

    // 2. AI extraction
    results.messages.push('Extracting invoice data with AI...');
    const extracted = await extractInvoiceData(pdfText || '', originalFilename);
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

    // 3. Set AI confidence scores
    const aiConf = extracted.extractionConfidence || {};
    results.ai_confidence = {
      vendor: aiConf.vendor || 0.5,
      job: aiConf.job || 0.5,
      amount: aiConf.amount || 0.5,
      invoice_number: aiConf.invoiceNumber || 0.5,
      date: aiConf.date || 0.5,
      overall: 0
    };

    // Calculate overall confidence
    const confValues = Object.values(results.ai_confidence).filter(v => typeof v === 'number');
    results.ai_confidence.overall = confValues.reduce((a, b) => a + b, 0) / confValues.length;

    results.messages.push(`Extracted: ${extracted.vendor?.companyName || 'Unknown vendor'}, $${extracted.totalAmount || 0}`);

    // 4. Match job with confidence
    const jobAddress = extracted.job?.address;
    if (jobAddress) {
      const jobMatch = await findMatchingJob(jobAddress);
      results.ai_confidence.job = jobMatch.confidence;
      results.suggestions.possible_jobs = jobMatch.possibleMatches;

      if (jobMatch.confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
        // High confidence - auto-assign
        results.matchedJob = jobMatch.job;
        results.messages.push(`Matched to job: ${jobMatch.job.name} (${Math.round(jobMatch.confidence * 100)}% confidence)`);
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
        results.messages.push(`No matching job found for: ${jobAddress}`);
      }
    } else {
      results.needs_review = true;
      results.review_flags.push('missing_job_reference');
      results.messages.push('No job address found on invoice');
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
        results.messages.push(poResult.isNew
          ? `Created draft PO: ${poResult.poNumber || poResult.po.po_number}`
          : `Matched PO: ${poResult.po.po_number}`);
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
// EXPORTS
// ============================================================

module.exports = {
  processInvoice,
  extractTextFromPDF,
  extractInvoiceData,
  findMatchingJob,
  findOrCreateVendor,
  findOrCreatePO,
  checkForDuplicates,
  CONFIDENCE_THRESHOLDS
};
