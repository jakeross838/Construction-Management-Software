/**
 * Ross Built CMS - AI Purchase Order Processor
 *
 * Uses Claude AI to extract PO data from proposals, quotes, and estimates:
 * - Vendor name, contact info, trade type
 * - Job/address matching
 * - Line items with descriptions and amounts (critical for invoice matching)
 * - Suggested cost codes based on descriptions
 *
 * After extraction:
 * - Matches or creates vendor
 * - Matches to existing job
 * - Creates draft PO with line items
 */

const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../config');
const standards = require('./standards');

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Confidence thresholds
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.90,
  MEDIUM: 0.70,
  LOW: 0.50
};

// ============================================================
// EXTRACTION SCHEMA FOR PROPOSALS/QUOTES
// ============================================================

const PO_EXTRACTION_SCHEMA = `{
  "documentType": "proposal | quote | estimate | bid | invoice",
  "vendor": {
    "companyName": "string, the company SENDING the proposal/quote (from letterhead/header)",
    "tradeType": "string: plumbing, electrical, hvac, drywall, framing, roofing, painting, flooring, tile, concrete, masonry, landscaping, pool, cabinets, countertops, windows_doors, insulation, stucco, siding, appliances, general, other",
    "address": "string or null - vendor's business address",
    "phone": "string or null",
    "email": "string or null"
  },
  "documentNumber": "string or null, proposal/quote/estimate reference number",
  "documentDate": "string, YYYY-MM-DD format",
  "validUntil": "string or null, YYYY-MM-DD format - expiration date if mentioned",
  "job": {
    "reference": "string, the job/project reference - could be client name, project name, or address",
    "address": "string or null, job site street address (NOT vendor address)",
    "clientName": "string or null, client/homeowner name if mentioned"
  },
  "amounts": {
    "subtotal": "number or null, before tax",
    "taxAmount": "number or null",
    "totalAmount": "number, total proposal/quote amount - MUST equal sum of line items"
  },
  "lineItems": [
    {
      "title": "string - SHORT title for the line item (e.g., 'Kitchen Cabinets', 'Master Bath', 'Hardware Allowance'). Max 50 chars.",
      "costType": "string - one of: 'Materials', 'Labor', 'Materials & Labor', 'Allowance', 'Delivery', 'Other'",
      "description": "string - DETAILED description that helps match future invoices. Include specifics like cabinet style, dimensions, finish, model numbers, etc.",
      "quantity": "number or null",
      "unit": "string or null (SF, LF, EA, HR, LS, SET)",
      "unitPrice": "number or null",
      "amount": "number - the line item subtotal/price"
    }
  ],
  "scopeOfWork": "string or null, overall description of work to be performed",
  "notes": "string or null, any special notes, terms, or conditions",
  "extractionConfidence": {
    "vendor": "number 0-1",
    "amount": "number 0-1",
    "job": "number 0-1",
    "lineItems": "number 0-1"
  }
}`;

// ============================================================
// PDF/IMAGE EXTRACTION
// ============================================================

/**
 * Extract text content from PDF buffer
 */
async function extractTextFromPDF(pdfBuffer) {
  try {
    const data = await pdfParse(pdfBuffer);
    return data.text;
  } catch (err) {
    console.error('[AI-PO] PDF parse error:', err.message);
    return null;
  }
}

/**
 * Check if PDF is likely scanned (minimal text)
 */
function isLikelyScannedPDF(pdfText) {
  if (!pdfText) return true;
  const alphanumeric = pdfText.replace(/[^a-zA-Z0-9]/g, '');
  return alphanumeric.length < 100;
}

/**
 * Extract data from PDF using Claude Vision (for scanned documents)
 */
async function extractFromScannedPDF(pdfBuffer, systemPrompt) {
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
          text: `Please analyze this document and extract all information according to this schema:\n\n${PO_EXTRACTION_SCHEMA}\n\nCRITICAL: Extract EVERY line item with a price as a separate entry. Each room/area with a price should be its own line item. Return ONLY valid JSON, no markdown code blocks.`
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
 * Extract data from image using Claude Vision
 */
async function extractFromImage(base64Image, mediaType, systemPrompt) {
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
          text: `Please analyze this document image and extract all information according to this schema:\n\n${PO_EXTRACTION_SCHEMA}\n\nCRITICAL: Extract EVERY line item with a price as a separate entry. Each room/area with a price should be its own line item. Return ONLY valid JSON, no markdown code blocks.`
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

// ============================================================
// AI EXTRACTION
// ============================================================

const SYSTEM_PROMPT = `You are an expert construction document processing assistant for Ross Built Custom Homes, a custom home builder in Florida.

DOCUMENT IDENTIFICATION:
1. This is a PROPOSAL, QUOTE, ESTIMATE, or BID from a subcontractor/supplier
2. The VENDOR is the company providing the quote - they will perform work or supply materials
3. Ross Built (or the homeowner) is the RECIPIENT who will approve and pay

CRITICAL - LINE ITEM EXTRACTION:
This is the MOST IMPORTANT part. Line items will be used to match against future invoices for payment verification.

Each line item MUST have these fields:
- title: Short name (max 50 chars) like "Kitchen Cabinets", "Master Bath", "Hardware Allowance"
- costType: One of "Materials", "Labor", "Materials & Labor", "Allowance", "Delivery", "Other"
- description: DETAILED description with specifics (style, finish, dimensions, model numbers if available)
- amount: The dollar amount for this line

Rules for line items:
1. Extract EVERY item that has an associated price/amount as a SEPARATE line item
2. Use "title" for the short name, "description" for details

3. Examples of GOOD extraction:
   If document shows "Kitchen .............. $49,944.00"
   Extract as:
   {
     "title": "Kitchen Cabinets",
     "costType": "Materials & Labor",
     "description": "Kitchen cabinetry including base cabinets, wall cabinets, and installation per drawings",
     "amount": 49944.00
   }

4. Examples for different cost types:
   - "Materials" - product/material only, no labor
   - "Labor" - installation/work only, no materials
   - "Materials & Labor" - combined (most cabinet/trade proposals)
   - "Allowance" - hardware allowance, fixture allowance, etc.
   - "Delivery" - shipping/delivery charges
   - "Other" - permits, fees, etc.

5. Include ALL priced items:
   - Each room/area with a price = separate line item
   - Hardware allowances
   - Delivery charges
   - Installation/labor (if separate)
   - Tax (if itemized)

6. The sum of all line item amounts should equal the total amount

VENDOR EXTRACTION:
- Company name from letterhead, logo, or header (NOT Ross Built)
- Full address, phone, email if available
- Trade type based on what they're selling/installing

JOB/PROJECT IDENTIFICATION:
- Look for job site address (different from vendor address)
- Client/homeowner name
- Project name or reference number

Return ONLY valid JSON, no markdown code blocks.`;

/**
 * Extract PO data from text using Claude AI
 */
async function extractPOData(documentText, filename) {
  const prompt = `Analyze this proposal/quote document and extract ALL information.

FILE: ${filename}

DOCUMENT CONTENTS:
${documentText}

OUTPUT SCHEMA:
${PO_EXTRACTION_SCHEMA}

CRITICAL INSTRUCTIONS:
1. Extract EVERY priced item as a separate line item
2. Use clear descriptions: "[Room/Area] - [Item Type]"
3. The vendor is the company SENDING the proposal/quote
4. Dates must be YYYY-MM-DD format
5. Total amount should equal sum of line items
6. Return ONLY valid JSON, no markdown`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
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
  }

  // Normalize dates
  if (normalized.documentDate) {
    normalized.documentDate = standards.normalizeDate(normalized.documentDate);
  }
  if (normalized.validUntil) {
    normalized.validUntil = standards.normalizeDate(normalized.validUntil);
  }

  // Default date
  if (!normalized.documentDate) {
    normalized.documentDate = new Date().toISOString().split('T')[0];
  }

  // Flatten amounts
  if (normalized.amounts) {
    normalized.totalAmount = normalized.amounts.totalAmount;
    normalized.subtotal = normalized.amounts.subtotal;
    normalized.taxAmount = normalized.amounts.taxAmount;
  }

  // Ensure line items have proper structure
  if (normalized.lineItems) {
    normalized.lineItems = normalized.lineItems.map(li => {
      // Map costType to cost_type for consistency
      let cost_type = li.costType || li.cost_type || '';
      // Normalize cost type values
      const validCostTypes = ['Materials', 'Labor', 'Materials & Labor', 'Allowance', 'Delivery', 'Other'];
      if (!validCostTypes.includes(cost_type)) {
        // Try to infer from description/title
        const text = ((li.title || '') + ' ' + (li.description || '')).toLowerCase();
        if (text.includes('labor') && text.includes('material')) cost_type = 'Materials & Labor';
        else if (text.includes('labor') || text.includes('install')) cost_type = 'Labor';
        else if (text.includes('allowance')) cost_type = 'Allowance';
        else if (text.includes('delivery') || text.includes('shipping')) cost_type = 'Delivery';
        else cost_type = 'Materials & Labor'; // Default for most trade proposals
      }

      return {
        ...li,
        title: li.title || li.description || 'Unnamed Item',
        description: li.description || '',
        cost_type: cost_type,
        amount: parseFloat(li.amount) || 0
      };
    });
  }

  // Default confidence scores if not provided
  if (!normalized.extractionConfidence) {
    normalized.extractionConfidence = {
      vendor: 0.7,
      amount: 0.8,
      job: 0.5,
      lineItems: 0.7
    };
  }

  return normalized;
}

// ============================================================
// JOB MATCHING - ENHANCED WITH FUZZY MATCHING
// ============================================================

/**
 * Find matching job from extracted data using fuzzy matching
 * Returns best match with alternates for user selection
 *
 * Matching strategies (priority order):
 * 1. Exact client name match (0.95)
 * 2. Address number + street match (0.90)
 * 3. Fuzzy client name match (scaled by similarity)
 * 4. Reference contains job identifier (0.70)
 *
 * @param {Object} jobData - Extracted job data with reference, clientName, address
 * @returns {Object|null} Match result with job, confidence, matchStrategy, and alternates
 */
async function findMatchingJob(jobData) {
  if (!jobData) return null;

  // Include on_hold jobs (not just active) per plan
  const { data: jobs, error } = await supabase
    .from('v2_jobs')
    .select('id, name, address, client_name, status')
    .in('status', ['active', 'on_hold']);

  if (error || !jobs?.length) return null;

  const candidates = [];
  const searchAddress = standards.normalizeAddressForComparison(jobData.address);
  const searchClient = (jobData.clientName || '').toLowerCase().trim();
  const searchRef = (jobData.reference || '').toLowerCase().trim();

  for (const job of jobs) {
    const jobName = (job.name || '').toLowerCase();
    const jobAddress = standards.normalizeAddressForComparison(job.address);
    const jobClient = (job.client_name || '').toLowerCase().trim();
    const clientFromName = jobName.split(/[-–\s]+/)[0];

    let score = 0;
    let matchStrategy = '';

    // Strategy 1: Exact client name match (highest priority)
    if (searchClient && (jobClient === searchClient || clientFromName === searchClient)) {
      score = 0.95;
      matchStrategy = 'exact_client';
    }

    // Strategy 2: Address number + street match
    if (!score && searchAddress && jobAddress) {
      const searchNum = standards.extractStreetNumber(searchAddress);
      const jobNum = standards.extractStreetNumber(jobAddress);

      if (searchNum && jobNum && searchNum === jobNum) {
        // Same street number - check street name similarity
        const streetSim = standards.similarityRatio(searchAddress, jobAddress);
        if (streetSim > 0.7) {
          score = 0.90;
          matchStrategy = 'address_match';
        }
      }
    }

    // Strategy 3: Fuzzy client name match
    if (!score && searchClient) {
      const clientSim = standards.similarityRatio(searchClient, clientFromName);
      if (clientSim > 0.8) {
        score = clientSim * 0.85; // Scale to max ~0.85
        matchStrategy = 'fuzzy_client';
      }
    }

    // Strategy 4: Reference contains job identifier
    if (!score && searchRef) {
      const refSim = standards.similarityRatio(searchRef, jobName);
      if (refSim > 0.6 || searchRef.includes(clientFromName)) {
        score = 0.70;
        matchStrategy = 'reference_match';
      }
    }

    if (score > 0) {
      candidates.push({ job, score, matchStrategy });
    }
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  if (candidates.length > 0) {
    const best = candidates[0];
    return {
      job: best.job,
      confidence: best.score,
      matchStrategy: best.matchStrategy,
      alternates: candidates.slice(1, 3) // Top 2 alternates
    };
  }

  return null;
}

// ============================================================
// VENDOR MATCHING
// ============================================================

/**
 * Find or create vendor from extracted data
 */
async function findOrCreateVendor(vendorData) {
  if (!vendorData?.companyName) {
    return { vendor: null, isNew: false, confidence: 0 };
  }

  const vendorName = vendorData.companyName.trim();

  // Search for existing vendor
  const { data: vendors, error } = await supabase
    .from('v2_vendors')
    .select('*')
    .or(`name.ilike.%${vendorName}%,name.ilike.%${vendorName.split(' ')[0]}%`);

  if (!error && vendors?.length > 0) {
    // Find best match
    const exactMatch = vendors.find(v =>
      v.name.toLowerCase() === vendorName.toLowerCase()
    );

    if (exactMatch) {
      return { vendor: exactMatch, isNew: false, confidence: 0.98 };
    }

    // Partial match
    const partialMatch = vendors.find(v =>
      v.name.toLowerCase().includes(vendorName.toLowerCase().split(' ')[0])
    );

    if (partialMatch) {
      return { vendor: partialMatch, isNew: false, confidence: 0.85 };
    }
  }

  // Create new vendor
  const newVendor = {
    name: vendorName,
    phone: vendorData.phone || null,
    email: vendorData.email || null,
    address: vendorData.address || null,
    trade: vendorData.tradeType || 'other'
  };

  const { data: created, error: createError } = await supabase
    .from('v2_vendors')
    .insert(newVendor)
    .select()
    .single();

  if (createError) {
    console.error('[AI-PO] Failed to create vendor:', createError.message);
    return { vendor: null, isNew: false, confidence: 0 };
  }

  return { vendor: created, isNew: true, confidence: 0.95 };
}

// ============================================================
// COST CODE SUGGESTIONS - DATABASE-DRIVEN
// ============================================================

/**
 * Suggest cost codes for line items based on:
 * 1. Learned mappings (highest priority - from user corrections)
 * 2. Cost code keywords (from database)
 * 3. Trade type defaults
 *
 * @param {Array} lineItems - Line items with descriptions
 * @param {string} tradeType - Vendor trade type for context
 * @param {string} jobId - Optional job ID for future job-specific patterns
 * @returns {Array} Line items with cost_code_id, cost_code_confidence, cost_code_match_reason
 */
async function suggestCostCodes(lineItems, tradeType, jobId = null) {
  // 1. Load cost codes with keywords and trade_types
  const { data: costCodes, error } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category, keywords, trade_types');

  if (error || !costCodes?.length) {
    console.log('[AI-PO] No cost codes loaded');
    return lineItems;
  }

  console.log(`[AI-PO] Loaded ${costCodes.length} cost codes, trade: ${tradeType}`);

  // 2. Load learned mappings for this trade (highest confidence first)
  const { data: mappings } = await supabase
    .from('v2_cost_code_mappings')
    .select('description_pattern, cost_code_id, confidence')
    .or(`vendor_trade.eq.${tradeType || 'general'},vendor_trade.is.null`)
    .order('confidence', { ascending: false });

  console.log(`[AI-PO] Loaded ${mappings?.length || 0} learned mappings`);

  // 3. For each line item, find best match
  return lineItems.map(item => {
    const desc = (item.description || '').toLowerCase();
    const title = (item.title || '').toLowerCase();
    const searchText = `${title} ${desc}`;

    let matchedCode = null;
    let matchConfidence = 0;
    let matchReason = '';

    // Priority 1: Try learned mappings (highest confidence)
    if (mappings?.length > 0) {
      for (const mapping of mappings) {
        const pattern = mapping.description_pattern.toLowerCase();
        if (searchText.includes(pattern) || pattern.includes(searchText.substring(0, 30))) {
          const cc = costCodes.find(c => c.id === mapping.cost_code_id);
          if (cc) {
            matchedCode = cc;
            matchConfidence = parseFloat(mapping.confidence) || 0.80;
            matchReason = 'learned_pattern';
            break;
          }
        }
      }
    }

    // Priority 2: Try cost code keywords from database
    if (!matchedCode) {
      for (const cc of costCodes) {
        if (cc.keywords?.length > 0) {
          const matchedKeyword = cc.keywords.find(kw =>
            searchText.includes(kw.toLowerCase())
          );
          if (matchedKeyword) {
            matchedCode = cc;
            matchConfidence = 0.75;
            matchReason = `keyword: ${matchedKeyword}`;
            break;
          }
        }
      }
    }

    // Priority 3: Try trade type default
    if (!matchedCode && tradeType) {
      const tradeMatch = costCodes.find(cc =>
        cc.trade_types?.includes(tradeType)
      );
      if (tradeMatch) {
        matchedCode = tradeMatch;
        matchConfidence = 0.60;
        matchReason = `trade_default: ${tradeType}`;
      }
    }

    if (matchedCode) {
      console.log(`[AI-PO] Line "${item.description}" -> ${matchedCode.code} ${matchedCode.name} (${matchReason}, ${Math.round(matchConfidence * 100)}%)`);
    }

    return {
      ...item,
      cost_code_id: matchedCode?.id || null,
      cost_code: matchedCode?.code || null,
      cost_code_name: matchedCode?.name || null,
      cost_code_confidence: matchConfidence,
      cost_code_match_reason: matchReason
    };
  });
}

/**
 * Learn a cost code mapping from user correction
 * Saves the mapping for future use with confidence boost
 *
 * @param {string} description - Line item description
 * @param {string} costCodeId - Correct cost code UUID
 * @param {string} vendorTrade - Vendor trade type for context
 * @returns {Promise<boolean>} Success indicator
 */
async function learnCostCodeMapping(description, costCodeId, vendorTrade = null) {
  if (!description || !costCodeId) {
    console.log('[AI-PO] Cannot learn mapping: missing description or costCodeId');
    return false;
  }

  // Extract key phrase from description (first 50 chars, normalized)
  const pattern = description.toLowerCase().trim().substring(0, 50);

  console.log(`[AI-PO] Learning mapping: "${pattern}" -> ${costCodeId} (trade: ${vendorTrade})`);

  // Try to upsert mapping
  const { data: existing } = await supabase
    .from('v2_cost_code_mappings')
    .select('id, usage_count')
    .eq('description_pattern', pattern)
    .eq('vendor_trade', vendorTrade)
    .maybeSingle();

  if (existing) {
    // Update existing mapping - increment usage
    const { error } = await supabase
      .from('v2_cost_code_mappings')
      .update({
        cost_code_id: costCodeId,
        usage_count: existing.usage_count + 1,
        confidence: Math.min(0.99, 0.80 + (existing.usage_count * 0.01)),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id);

    if (error) {
      console.error('[AI-PO] Failed to update mapping:', error.message);
      return false;
    }
    console.log(`[AI-PO] Updated existing mapping (usage: ${existing.usage_count + 1})`);
  } else {
    // Create new mapping
    const { error } = await supabase
      .from('v2_cost_code_mappings')
      .insert({
        description_pattern: pattern,
        cost_code_id: costCodeId,
        vendor_trade: vendorTrade,
        confidence: 0.85,
        usage_count: 1
      });

    if (error) {
      console.error('[AI-PO] Failed to create mapping:', error.message);
      return false;
    }
    console.log('[AI-PO] Created new mapping');
  }

  return true;
}

// ============================================================
// MAIN PROCESSING FUNCTION
// ============================================================

/**
 * Process a document to create a PO
 *
 * @param {Buffer} fileBuffer - File buffer (PDF or image)
 * @param {string} filename - Original filename
 * @param {string} mimeType - File MIME type
 * @returns {Promise<object>} - Processing results
 */
async function processPODocument(fileBuffer, filename, mimeType = 'application/pdf') {
  const results = {
    success: false,
    extracted: null,
    matchedJob: null,
    vendor: null,
    po: null,
    messages: [],
    confidence: {}
  };

  try {
    let extracted;
    const isPDF = mimeType === 'application/pdf';
    const isImage = mimeType.startsWith('image/');

    // 1. Extract data from document
    if (isPDF) {
      const pdfText = await extractTextFromPDF(fileBuffer);
      const isScanned = isLikelyScannedPDF(pdfText);

      if (isScanned) {
        results.messages.push('Scanned PDF detected - using vision AI...');
        extracted = await extractFromScannedPDF(fileBuffer, SYSTEM_PROMPT);
      } else {
        results.messages.push('Extracting data from PDF...');
        extracted = await extractPOData(pdfText, filename);
      }
    } else if (isImage) {
      results.messages.push('Extracting data from image...');
      const base64 = fileBuffer.toString('base64');
      extracted = await extractFromImage(base64, mimeType, SYSTEM_PROMPT);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    results.extracted = extracted;
    results.confidence = extracted.extractionConfidence || {};

    const lineCount = extracted.lineItems?.length || 0;
    results.messages.push(`Extracted: ${extracted.vendor?.companyName || 'Unknown'}, $${extracted.totalAmount || 0}, ${lineCount} line items`);

    // 2. Match job
    if (extracted.job) {
      const jobMatch = await findMatchingJob(extracted.job);
      if (jobMatch) {
        results.matchedJob = jobMatch.job;
        results.confidence.job = jobMatch.confidence;
        results.messages.push(`Matched job: ${jobMatch.job.name} (${Math.round(jobMatch.confidence * 100)}%)`);
      } else {
        results.messages.push('No matching job found - manual selection required');
      }
    }

    // 3. Find or create vendor
    if (extracted.vendor) {
      const vendorResult = await findOrCreateVendor(extracted.vendor);
      if (vendorResult.vendor) {
        results.vendor = vendorResult.vendor;
        results.confidence.vendor = vendorResult.confidence;
        results.messages.push(vendorResult.isNew
          ? `Created vendor: ${vendorResult.vendor.name}`
          : `Matched vendor: ${vendorResult.vendor.name}`);
      }
    }

    // 4. Suggest cost codes for line items
    if (extracted.lineItems?.length > 0) {
      const tradeType = extracted.vendor?.tradeType || results.vendor?.trade;
      results.lineItems = await suggestCostCodes(
        extracted.lineItems,
        tradeType,
        results.matchedJob?.id
      );

      const withCodes = results.lineItems.filter(li => li.cost_code).length;
      results.messages.push(`Assigned cost codes to ${withCodes}/${results.lineItems.length} line items`);
    }

    // 5. Create draft PO if we have enough data
    if (results.matchedJob && results.vendor) {
      const poResult = await createDraftPO(results);
      if (poResult.success) {
        results.po = poResult.po;
        results.messages.push(`Created draft PO: ${poResult.po.po_number}`);
      } else {
        results.messages.push(`Failed to create PO: ${poResult.error}`);
      }
    } else {
      results.messages.push('Insufficient data for auto-PO creation - review required');
    }

    results.success = true;
  } catch (err) {
    console.error('[AI-PO] Processing error:', err);
    results.messages.push(`Error: ${err.message}`);
  }

  return results;
}

/**
 * Create a draft PO from extracted data
 */
async function createDraftPO(data) {
  try {
    const { matchedJob, vendor, extracted, lineItems } = data;

    // Generate PO number
    const { count } = await supabase
      .from('v2_purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', matchedJob.id);

    const sequence = (count || 0) + 1;
    const poNumber = standards.generatePONumber(matchedJob.name, sequence);

    // Calculate total from line items
    const totalAmount = (lineItems || extracted.lineItems || [])
      .reduce((sum, li) => sum + (parseFloat(li.amount) || 0), 0);

    // Create PO
    const poData = {
      job_id: matchedJob.id,
      vendor_id: vendor.id,
      po_number: poNumber,
      description: extracted.scopeOfWork || `${vendor.name} - ${extracted.vendor?.tradeType || 'Work'}`,
      total_amount: totalAmount,
      original_amount: totalAmount,
      status: 'draft',
      status_detail: 'pending',
      approval_status: 'pending',
      scope_of_work: extracted.scopeOfWork || null,
      notes: extracted.notes || null
    };

    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .insert(poData)
      .select()
      .single();

    if (poError) throw poError;

    // Create line items
    const itemsToCreate = lineItems || extracted.lineItems || [];
    if (itemsToCreate.length > 0) {
      const poLineItems = itemsToCreate.map(li => ({
        po_id: po.id,
        cost_code_id: li.cost_code_id || null,
        title: li.title || li.description || 'Unnamed Item',
        description: li.description || '',
        cost_type: li.cost_type || 'Materials & Labor',
        amount: parseFloat(li.amount) || 0
      }));

      const { error: liError } = await supabase
        .from('v2_po_line_items')
        .insert(poLineItems);

      if (liError) {
        console.error('[AI-PO] Failed to create line items:', liError.message);
      }
    }

    // Log activity
    await supabase.from('v2_po_activity').insert({
      po_id: po.id,
      action: 'created',
      details: {
        source: 'ai_processor',
        document: extracted.documentNumber || 'proposal',
        line_items: itemsToCreate.length
      }
    });

    return { success: true, po };
  } catch (err) {
    console.error('[AI-PO] Create PO error:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  processPODocument,
  extractPOData,
  findMatchingJob,
  findOrCreateVendor,
  suggestCostCodes,
  learnCostCodeMapping,
  createDraftPO,
  CONFIDENCE_THRESHOLDS
};
