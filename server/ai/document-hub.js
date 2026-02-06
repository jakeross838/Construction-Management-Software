/**
 * AI Document Intelligence Hub
 *
 * Central AI processing system that:
 * 1. Accepts any document type
 * 2. Classifies the document using AI
 * 3. Extracts all relevant data
 * 4. Routes to all applicable systems
 * 5. Supports review/confirm workflow
 */

const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const sharp = require('sharp');
const pdfParse = require('pdf-parse');
const { createCanvas } = require('canvas');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
/**
 * Download file and prepare for Claude API
 * - Images: convert to base64 for vision
 * - PDFs: extract text OR images depending on content
 */
async function prepareDocumentForVision(fileUrl, mimeType) {
  logger.info('Preparing document for vision', { component: 'ai-hub', mimeType });

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error('Failed to download file: ' + response.status);
  }
  const buffer = Buffer.from(await response.arrayBuffer());

  // Handle images directly
  if (mimeType && mimeType.startsWith('image/')) {
    logger.debug('Processing image directly', { component: 'ai-hub' });
    const base64 = buffer.toString('base64');
    return [{
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType,
        data: base64
      }
    }];
  }

  // Handle PDFs - try text extraction first, then images
  if (mimeType === 'application/pdf') {
    logger.debug('Processing PDF', { component: 'ai-hub' });
    return await processPDF(buffer);
  }

  // Fallback
  logger.debug('Unknown type, attempting as image', { component: 'ai-hub' });
  const base64 = buffer.toString('base64');
  return [{
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: base64
    }
  }];
}

/**
 * Process PDF - render pages as images AND extract text for best results
 * Sends both visual and text content to Claude for comprehensive analysis
 */
async function processPDF(pdfBuffer) {
  const content = [];

  try {
    // Step 1: Extract text from PDF
    let extractedText = '';
    let numPages = 0;
    try {
      const pdfData = await pdfParse(pdfBuffer);
      extractedText = pdfData.text.trim();
      numPages = pdfData.numpages;
      logger.info('Extracted text from PDF', { component: 'ai-hub', chars: extractedText.length, pages: numPages });
    } catch (textErr) {
      logger.debug('Text extraction failed', { component: 'ai-hub', error: textErr.message });
    }

    // Step 2: Render PDF pages as images
    const renderedImages = await renderPDFPages(pdfBuffer);

    if (renderedImages.length > 0) {
      logger.info('Rendered PDF pages as images', { component: 'ai-hub', pages: renderedImages.length });
      content.push(...renderedImages);
    }

    // Step 3: Add extracted text if available
    if (extractedText.length > 50) {
      content.push({
        type: 'text',
        text: '[Extracted Text from PDF - ' + numPages + ' page(s)]\n\n' + extractedText
      });
    }

    // If we got nothing, try embedded image extraction as fallback
    if (content.length === 0) {
      logger.debug('No rendered content, trying embedded image extraction', { component: 'ai-hub' });
      return await extractPDFImages(pdfBuffer);
    }

    return content;

  } catch (err) {
    logger.error('PDF processing error', { component: 'ai-hub', error: err.message });
    // Last resort fallback
    return await extractPDFImages(pdfBuffer);
  }
}

/**
 * Render PDF pages as images using canvas
 */
async function renderPDFPages(pdfBuffer) {
  const images = [];

  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true
    });

    const pdf = await loadingTask.promise;
    const maxPages = Math.min(pdf.numPages, 5); // Limit to 5 pages

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);

        // Set scale for good quality (1.5x for readability)
        const scale = 1.5;
        const viewport = page.getViewport({ scale });

        // Create canvas
        const canvas = createCanvas(viewport.width, viewport.height);
        const context = canvas.getContext('2d');

        // Render page to canvas
        await page.render({
          canvasContext: context,
          viewport: viewport
        }).promise;

        // Convert to PNG buffer
        const pngBuffer = canvas.toBuffer('image/png');
        const base64 = pngBuffer.toString('base64');

        images.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: base64
          }
        });

        logger.debug('Rendered page', { component: 'ai-hub', pageNum, width: Math.round(viewport.width), height: Math.round(viewport.height) });

      } catch (pageErr) {
        logger.debug('Could not render page', { component: 'ai-hub', pageNum, error: pageErr.message });
      }
    }

  } catch (err) {
    logger.error('PDF render error', { component: 'ai-hub', error: err.message });
  }

  return images;
}

/**
 * Extract embedded images from PDF (for scanned documents)
 */
async function extractPDFImages(pdfBuffer) {
  const images = [];

  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer),
      useSystemFonts: true,
      disableFontFace: true
    });

    const pdf = await loadingTask.promise;
    const numPages = Math.min(pdf.numPages, 5);
    logger.info('Checking PDF for images', { component: 'ai-hub', totalPages: pdf.numPages });

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const ops = await page.getOperatorList();

      for (let i = 0; i < ops.fnArray.length; i++) {
        if (ops.fnArray[i] === pdfjsLib.OPS.paintImageXObject) {
          const imgName = ops.argsArray[i][0];
          try {
            const img = await page.objs.get(imgName);
            if (img && img.data && img.width && img.height) {
              const width = img.width;
              const height = img.height;
              const channels = Math.round(img.data.length / (width * height));

              if (channels >= 1 && channels <= 4) {
                const imageBuffer = await sharp(Buffer.from(img.data), {
                  raw: { width, height, channels }
                }).png().toBuffer();

                images.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: imageBuffer.toString('base64')
                  }
                });
                logger.debug('Extracted image from page', { component: 'ai-hub', pageNum, width, height });
              }
            }
          } catch (imgErr) {
            // Silently continue - some images may not be extractable
          }
        }
      }
    }

    if (images.length > 0) {
      logger.info('Extracted images from PDF', { component: 'ai-hub', count: images.length });
      return images;
    }

    // If no images found, return a message about the PDF
    logger.warn('No extractable content from PDF', { component: 'ai-hub' });
    throw new Error('Could not extract content from PDF. The file may be empty or corrupted.');

  } catch (err) {
    logger.error('PDF image extraction error', { component: 'ai-hub', error: err.message });
    throw new Error('PDF processing failed: ' + err.message);
  }
}




// Document types and their descriptions for classification
const DOCUMENT_TYPES = {
  invoice: 'A bill for goods or services rendered, typically includes invoice number, amounts, line items',
  quote: 'A price estimate or quotation from a vendor, typically includes validity period and lead times',
  proposal: 'A detailed proposal for work, includes scope, pricing, terms, and often warranty info',
  spec_sheet: 'Product specification sheet with technical details, dimensions, requirements',
  delivery_receipt: 'Proof of delivery document showing what was delivered, when, and condition',
  warranty_doc: 'Warranty documentation covering terms, duration, and claim procedures',
  change_order: 'A change to an existing contract or PO, with pricing and scope changes',
  contract: 'A formal agreement between parties',
  purchase_order: 'A document authorizing a purchase from a vendor'
};

const DEFAULT_COMPANY_NAME = 'your company';

/**
 * Build system context for AI with dynamic company name
 * @param {string} companyName - The builder's company name
 * @returns {string} The system context prompt
 */
function buildSystemContext(companyName) {
  const cn = companyName || DEFAULT_COMPANY_NAME;
  return `You are an AI assistant for ${cn}'s construction management system.
You analyze uploaded documents and extract structured data.

SYSTEM DATA MODEL:
- Jobs: Construction projects with name, address, client, contract amount
- Vendors: Companies that supply materials or labor
- Invoices: Bills with vendor, amount, line items, job/PO references
- Purchase Orders (POs): Authorization to buy from vendor with line items by cost code
- Catalog: Product database with pricing, specs, labor hours, lead times
- Price Intelligence: Historical pricing by vendor and product
- Schedule: Project timeline with tasks, dependencies, lead times
- Daily Logs: Daily job site records with crew, deliveries, work completed
- Knowledge Base: Installation warnings, requirements, quality checks per product
- Trade Scorecards: Performance metrics for trades/vendors

EXTRACTION GUIDELINES:
- Extract ALL relevant data, not just what's explicitly labeled
- Normalize vendor names (remove Inc., LLC, etc. for matching)
- Parse dates in ISO format (YYYY-MM-DD)
- Extract line items with as much detail as possible
- Identify job references (addresses, job names, project numbers)
- Identify PO references for invoice matching
- Note lead times, warranty terms, permit requirements when present
- Flag any quality concerns, damage notes, or issues`;
}


/**
 * Classify a document type using AI
 */
async function classifyDocument(fileUrl, fileName, mimeType) {
  const typeDescriptions = Object.entries(DOCUMENT_TYPES)
    .map(([type, desc]) => '- ' + type + ': ' + desc)
    .join('\n');

  // Prepare document for vision API
  const imageContent = await prepareDocumentForVision(fileUrl, mimeType);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: [
        ...imageContent,
        {
          type: 'text',
          text: `Classify this document into one of these types:
${typeDescriptions}

File name: ${fileName}

Return ONLY a JSON object:
{
  "document_type": "invoice|quote|proposal|spec_sheet|delivery_receipt|warranty_doc|change_order|contract|purchase_order|unknown",
  "confidence": 0.0 to 1.0,
  "reasoning": "Brief explanation"
}`
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
 * Extract data from document based on its type
 */
async function extractDocumentData(fileUrl, mimeType, documentType, extractionTemplate, companyName) {
  const schema = extractionTemplate?.extraction_schema || {};

  // Prepare document for vision API
  const imageContent = await prepareDocumentForVision(fileUrl, mimeType);

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system: buildSystemContext(companyName),
    messages: [{
      role: 'user',
      content: [
        ...imageContent,
        {
          type: 'text',
          text: `Extract all data from this ${documentType} document.

Expected fields (extract all that are present):
${JSON.stringify(schema, null, 2)}

Also extract any additional relevant information not in the schema.

Return ONLY valid JSON with the extracted data. Use null for fields not found.
Include a "_metadata" field with:
{
  "_metadata": {
    "extraction_notes": "Any notes about the extraction",
    "confidence": 0.0 to 1.0,
    "missing_fields": ["fields that couldn't be extracted"],
    "additional_data": { "any extra relevant data found" }
  }
}`
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
 * Determine routing destinations based on extracted data
 */
async function determineRouting(documentType, extractedData, routingRules) {
  const destinations = [];

  // Apply routing rules from template
  for (const [dest, rules] of Object.entries(routingRules || {})) {
    const destData = {};
    let hasData = false;

    for (const field of rules.fields || []) {
      if (extractedData[field] !== undefined && extractedData[field] !== null) {
        destData[field] = extractedData[field];
        hasData = true;
      }
    }

    if (hasData) {
      destinations.push({
        destination: dest,
        data: destData,
        auto_route: rules.auto_route || false,
        status: 'pending'
      });
    }
  }

  return destinations;
}


/**
 * Process a document through the full pipeline
 */
async function processDocument(documentId, companyName) {
  logger.info('Processing document', { component: 'ai-hub', documentId });
  const startTime = Date.now();

  try {
    // Get document from queue
    const { data: doc, error: docError } = await supabase
      .from('v2_document_queue')
      .select('*')
      .eq('id', documentId)
      .single();

    if (docError || !doc) {
      throw new Error(`Document not found: ${documentId}`);
    }

    // Update status to processing
    await supabase
      .from('v2_document_queue')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', documentId);

    // Step 1: Classify document if not already classified
    let docType = doc.document_type;
    let confidence = doc.ai_confidence;

    if (!docType || docType === 'unknown') {
      logger.debug('Classifying document', { component: 'ai-hub' });
      const classification = await classifyDocument(doc.file_url, doc.file_name, doc.mime_type);
      docType = classification.document_type;
      confidence = classification.confidence;

      await supabase
        .from('v2_document_queue')
        .update({
          document_type: docType,
          ai_confidence: confidence,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId);
    }

    // Get extraction template for this document type
    const { data: template } = await supabase
      .from('v2_extraction_templates')
      .select('*')
      .eq('document_type', docType)
      .eq('is_active', true)
      .single();

    // Step 2: Extract data
    logger.debug('Extracting data from document', { component: 'ai-hub', docType });
    const extractedData = await extractDocumentData(doc.file_url, doc.mime_type, docType, template, companyName);

    // Step 3: Determine routing
    const routingDestinations = await determineRouting(docType, extractedData, template?.routing_rules);

    // Step 4: Store extraction
    const extractionTime = Date.now() - startTime;
    const { data: extraction, error: extError } = await supabase
      .from('v2_document_extractions')
      .insert({
        document_id: documentId,
        extracted_data: extractedData,
        model_used: 'claude-sonnet-4-20250514',
        extraction_time_ms: extractionTime,
        routing_destinations: routingDestinations
      })
      .select()
      .single();

    if (extError) throw extError;

    // Step 5: Update document status
    await supabase
      .from('v2_document_queue')
      .update({
        status: 'extracted',
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    // Step 6: Auto-route if applicable
    const autoRouteResults = await autoRouteExtractedData(documentId, extraction.id, routingDestinations);

    logger.info('Document processed', { component: 'ai-hub', extractionTime, destinations: routingDestinations.length });

    return {
      success: true,
      documentId,
      documentType: docType,
      confidence,
      extractedData,
      routingDestinations,
      autoRouteResults,
      processingTimeMs: extractionTime
    };

  } catch (err) {
    logger.error('Error processing document', { component: 'ai-hub', error: err.message, stack: err.stack });

    await supabase
      .from('v2_document_queue')
      .update({
        status: 'failed',
        error_message: err.message,
        updated_at: new Date().toISOString()
      })
      .eq('id', documentId);

    return {
      success: false,
      documentId,
      error: err.message
    };
  }
}


/**
 * Auto-route data to destinations that don't require review
 */
async function autoRouteExtractedData(documentId, extractionId, destinations) {
  const results = [];

  for (const dest of destinations) {
    if (!dest.auto_route) continue;

    try {
      const result = await routeToDestination(documentId, extractionId, dest.destination, dest.data);
      results.push({ destination: dest.destination, ...result });
    } catch (err) {
      results.push({ destination: dest.destination, success: false, error: err.message });
    }
  }

  return results;
}


/**
 * Route extracted data to a specific destination
 */
async function routeToDestination(documentId, extractionId, destination, data) {
  logger.debug('Routing to destination', { component: 'ai-hub', destination });

  let result = { success: false };

  switch (destination) {
    case 'invoices':
      result = await routeToInvoices(data);
      break;
    case 'catalog':
      result = await routeToCatalog(data);
      break;
    case 'pricing':
      result = await routeToPricing(data);
      break;
    case 'schedule':
      result = await routeToSchedule(data);
      break;
    case 'knowledge':
      result = await routeToKnowledge(data);
      break;
    case 'daily_logs':
      result = await routeToDailyLogs(data);
      break;
    case 'trade_scorecards':
      result = await routeToTradeScorecard(data);
      break;
    default:
      result = { success: false, error: `Unknown destination: ${destination}` };
  }

  // Log the routing
  await supabase
    .from('v2_document_routing_log')
    .insert({
      document_id: documentId,
      extraction_id: extractionId,
      destination,
      destination_record_id: result.recordId || null,
      destination_record_type: result.recordType || null,
      routed_data: data,
      status: result.success ? 'success' : 'failed',
      error_message: result.error || null,
      auto_routed: true
    });

  return result;
}


/**
 * Route to Price Intelligence
 * Creates master items and price history for tracking vendor pricing
 */
async function routeToPricing(data) {
  const results = [];

  // Get or create vendor
  let vendorId = null;
  if (data.vendor_name) {
    const { data: vendor } = await supabase
      .from('v2_vendors')
      .select('id')
      .ilike('name', `%${data.vendor_name.replace(/\s+(Inc|LLC|Corp|Co)\.?$/i, '').trim()}%`)
      .limit(1)
      .single();

    vendorId = vendor?.id;
  }

  // Add price history for each line item
  for (const item of data.line_items || []) {
    if (!item.unit_price) continue;

    // Detect category from description
    const category = detectCategory(item.description);

    // Create new master item for this line item (user approved the routing)
    const keywords = item.description.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2);

    const { data: newItem, error: createError } = await supabase
      .from('v2_master_items')
      .insert({
        category: category,
        standard_name: item.description.substring(0, 200),
        standard_unit: item.unit || 'lot',
        original_description: item.description,
        keywords: keywords.slice(0, 20),
        created_by_ai: true,
        review_status: 'pending',
        source_vendor_id: vendorId
      })
      .select('id')
      .single();

    if (newItem) {
      // Insert price history for the new item
      const { error: priceError } = await supabase
        .from('v2_price_history')
        .insert({
          master_item_id: newItem.id,
          vendor_id: vendorId,
          unit_price: item.unit_price,
          unit: item.unit || 'lot',
          quantity: item.quantity || 1,
          price_date: new Date().toISOString().split('T')[0],
          source_type: 'ai_document_hub'
        });

      results.push({
        item: item.description,
        category: category,
        created: true,
        priceRecorded: !priceError
      });
    } else {
      results.push({
        item: item.description,
        created: false,
        error: createError?.message
      });
    }
  }

  return {
    success: true,
    recordType: 'v2_price_history',
    itemsProcessed: results.length,
    results
  };
}

/**
 * Detect category from item description
 */
function detectCategory(description) {
  const desc = description.toLowerCase();

  if (desc.includes('cabinet') || desc.includes('cabinetry') || desc.includes('drawer') || desc.includes('pantry') || desc.includes('vanity')) {
    return 'Cabinets';
  }
  if (desc.includes('plywood') || desc.includes('sheathing') || desc.includes('osb')) {
    return 'Plywood';
  }
  if (desc.includes('lumber') || desc.includes('stud') || desc.includes('2x4') || desc.includes('2x6') || desc.includes('lvl')) {
    return 'Lumber';
  }
  if (desc.includes('door') || desc.includes('entry')) {
    return 'Doors';
  }
  if (desc.includes('window')) {
    return 'Windows';
  }
  if (desc.includes('tile') || desc.includes('flooring') || desc.includes('hardwood') || desc.includes('lvp') || desc.includes('carpet')) {
    return 'Flooring';
  }
  if (desc.includes('paint') || desc.includes('stain')) {
    return 'Paint';
  }
  if (desc.includes('plumbing') || desc.includes('faucet') || desc.includes('toilet') || desc.includes('sink') || desc.includes('shower')) {
    return 'Plumbing';
  }
  if (desc.includes('electric') || desc.includes('outlet') || desc.includes('switch') || desc.includes('panel') || desc.includes('wire')) {
    return 'Electrical';
  }
  if (desc.includes('hvac') || desc.includes('air condition') || desc.includes('furnace') || desc.includes('duct')) {
    return 'HVAC';
  }
  if (desc.includes('roof') || desc.includes('shingle') || desc.includes('underlayment')) {
    return 'Roofing';
  }
  if (desc.includes('siding') || desc.includes('hardie') || desc.includes('vinyl')) {
    return 'Siding';
  }
  if (desc.includes('trim') || desc.includes('molding') || desc.includes('baseboard') || desc.includes('crown')) {
    return 'Trim';
  }
  if (desc.includes('hardware') || desc.includes('hinge') || desc.includes('knob') || desc.includes('pull')) {
    return 'Hardware';
  }
  if (desc.includes('appliance') || desc.includes('refrigerator') || desc.includes('oven') || desc.includes('dishwasher')) {
    return 'Appliances';
  }
  if (desc.includes('counter') || desc.includes('granite') || desc.includes('quartz') || desc.includes('marble')) {
    return 'Countertops';
  }
  if (desc.includes('insulation') || desc.includes('batt') || desc.includes('foam')) {
    return 'Insulation';
  }
  if (desc.includes('drywall') || desc.includes('sheetrock') || desc.includes('gypsum')) {
    return 'Drywall';
  }
  if (desc.includes('concrete') || desc.includes('rebar') || desc.includes('foundation')) {
    return 'Concrete';
  }
  if (desc.includes('deck') || desc.includes('trex') || desc.includes('composite')) {
    return 'Decking';
  }
  if (desc.includes('labor') || desc.includes('install') || desc.includes('hour')) {
    return 'Labor';
  }

  return 'General';
}


/**
 * Route to Catalog
 */
async function routeToCatalog(data) {
  // This creates suggestions, not auto-inserts (requires review)
  const suggestions = [];

  for (const item of data.line_items || []) {
    suggestions.push({
      name: item.description,
      unit_price: item.unit_price,
      unit: item.unit,
      lead_time_days: item.lead_time_days,
      labor_hours: item.labor_hours
    });
  }

  // If spec sheet data
  if (data.product_name) {
    suggestions.push({
      name: data.product_name,
      model_number: data.model_number,
      sku: data.sku,
      description: data.description,
      specifications: data.specifications,
      warranty_months: data.warranty_months
    });
  }

  return {
    success: true,
    suggestions,
    requiresReview: true
  };
}


/**
 * Route to Schedule (lead time updates)
 */
async function routeToSchedule(data) {
  const updates = [];

  // If we have delivery date, that's actual data
  if (data.delivery_date) {
    updates.push({
      type: 'actual_delivery',
      date: data.delivery_date,
      items: data.items_delivered || data.line_items
    });
  }

  // If we have lead time info
  if (data.lead_time_days) {
    updates.push({
      type: 'lead_time',
      days: data.lead_time_days
    });
  }

  return {
    success: true,
    updates,
    requiresReview: true
  };
}


/**
 * Route to Knowledge Base
 */
async function routeToKnowledge(data) {
  const knowledge = [];

  if (data.installation_requirements) {
    knowledge.push({
      type: 'installation_requirement',
      content: data.installation_requirements
    });
  }

  if (data.rough_in_requirements) {
    knowledge.push({
      type: 'rough_in',
      content: data.rough_in_requirements
    });
  }

  if (data.warranty_terms || data.coverage_details) {
    knowledge.push({
      type: 'warranty',
      content: data.warranty_terms || data.coverage_details,
      months: data.warranty_months
    });
  }

  if (data.permit_requirements) {
    knowledge.push({
      type: 'permit',
      content: data.permit_requirements
    });
  }

  return {
    success: true,
    knowledge,
    requiresReview: true
  };
}


/**
 * Route to Daily Logs
 */
async function routeToDailyLogs(data) {
  // This would add delivery info to today's daily log
  return {
    success: true,
    delivery: {
      date: data.delivery_date,
      vendor: data.vendor_name,
      items: data.items_delivered
    },
    requiresReview: true
  };
}


/**
 * Route to Trade Scorecards
 */
async function routeToTradeScorecard(data) {
  const events = [];

  // Delivery performance
  if (data.delivery_date && data.vendor_name) {
    events.push({
      type: 'delivery',
      vendor: data.vendor_name,
      date: data.delivery_date,
      on_time: true, // Would need expected date to calculate
      damage_noted: !!data.damage_notes
    });
  }

  return {
    success: true,
    events,
    requiresReview: true
  };
}


/**
 * Route to Invoices (creates draft invoice)
 */
async function routeToInvoices(data) {
  // This should use the existing invoice processor
  // For now, return data for review
  return {
    success: true,
    invoice: {
      vendor_name: data.vendor_name,
      invoice_number: data.invoice_number,
      invoice_date: data.invoice_date,
      due_date: data.due_date,
      amount: data.total_amount,
      line_items: data.line_items,
      job_reference: data.job_reference,
      po_reference: data.po_reference
    },
    requiresReview: true
  };
}


/**
 * Manually confirm and route extracted data
 */
async function confirmAndRoute(documentId, extractionId, destination, data, confirmedBy) {
  const result = await routeToDestination(documentId, extractionId, destination, data);

  // Update routing log with confirmation
  await supabase
    .from('v2_document_routing_log')
    .update({
      confirmed_by: confirmedBy,
      confirmed_at: new Date().toISOString(),
      auto_routed: false
    })
    .eq('document_id', documentId)
    .eq('destination', destination);

  // Check if all destinations are routed
  const { data: routingLogs } = await supabase
    .from('v2_document_routing_log')
    .select('status')
    .eq('document_id', documentId);

  const allRouted = routingLogs?.every(log => log.status === 'success' || log.status === 'skipped');

  if (allRouted) {
    await supabase
      .from('v2_document_queue')
      .update({ status: 'routed', updated_at: new Date().toISOString() })
      .eq('id', documentId);
  }

  return result;
}


/**
 * Get documents pending review
 */
async function getDocumentsPendingReview(jobId = null) {
  let query = supabase
    .from('v2_documents_pending_review')
    .select('*')
    .order('created_at', { ascending: false });

  if (jobId) {
    query = query.eq('job_id', jobId);
  }

  const { data, error } = await query;
  return error ? [] : data;
}


/**
 * Get document processing stats
 */
async function getProcessingStats() {
  const { data } = await supabase
    .from('v2_document_processing_stats')
    .select('*');

  return data || [];
}


module.exports = {
  processDocument,
  classifyDocument,
  extractDocumentData,
  confirmAndRoute,
  getDocumentsPendingReview,
  getProcessingStats,
  DOCUMENT_TYPES
};
