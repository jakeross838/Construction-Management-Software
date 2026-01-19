/**
 * Price Capture Service
 * Automatically captures prices from invoices and other sources
 * Feeds data into the Price Intelligence system
 */

const { supabase } = require('../config');
const priceMatcher = require('./price-matcher');

// Cache naming conventions (refreshed every 5 minutes)
let namingConventionsCache = null;
let namingConventionsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get naming conventions from database (with caching)
 */
async function getNamingConventions() {
  const now = Date.now();
  if (namingConventionsCache && (now - namingConventionsCacheTime) < CACHE_TTL) {
    return namingConventionsCache;
  }

  const { data } = await supabase
    .from('v2_naming_conventions')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false });

  namingConventionsCache = data || [];
  namingConventionsCacheTime = now;
  return namingConventionsCache;
}

/**
 * Find the best naming convention for a description
 */
async function findNamingConvention(description, category = null) {
  const conventions = await getNamingConventions();
  const descLower = description.toLowerCase();

  for (const conv of conventions) {
    // If category specified, filter by it
    if (category && conv.category !== category) continue;

    // Check if any trigger keywords match
    const keywords = conv.trigger_keywords || [];
    for (const keyword of keywords) {
      if (descLower.includes(keyword.toLowerCase())) {
        return conv;
      }
    }
  }

  // Return null if no match (will use fallback naming)
  return null;
}

/**
 * Parse dimensions and attributes from vendor description
 */
function parseDescriptionAttributes(description) {
  const attrs = {};
  const text = description.toLowerCase();

  // Parse lumber dimensions (2x4, 2x6x8, etc.)
  const lumberMatch = text.match(/(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?/);
  if (lumberMatch) {
    attrs.width = lumberMatch[1];
    attrs.height = lumberMatch[2];
    if (lumberMatch[3]) {
      attrs.length = lumberMatch[3];
    }
  }

  // Parse thickness fractions (1/2", 3/4", 7/16", etc.)
  const thicknessMatch = text.match(/(\d+\/\d+)\s*(?:"|inch|in\b)/);
  if (thicknessMatch) {
    attrs.thickness = thicknessMatch[1];
  }

  // Parse R-value for insulation
  const rvalueMatch = text.match(/r[- ]?(\d+)/i);
  if (rvalueMatch) {
    attrs.rvalue = rvalueMatch[1];
  }

  // Parse weight (80#, 60lb, etc.)
  const weightMatch = text.match(/(\d+)\s*(?:#|lb|lbs|pound)/i);
  if (weightMatch) {
    attrs.weight = weightMatch[1] + '#';
  }

  // Parse rebar size (#4, #5, etc.)
  const rebarMatch = text.match(/#(\d+)\s*(?:rebar|bar)/i);
  if (rebarMatch) {
    attrs.size = '#' + rebarMatch[1];
  }

  // Detect species (SPF, Doug Fir, PT, etc.)
  if (/\bspf\b/i.test(text)) attrs.species = 'SPF';
  else if (/\bdoug(?:las)?\s*fir\b/i.test(text)) attrs.species = 'Doug Fir';
  else if (/\bhem\s*fir\b/i.test(text)) attrs.species = 'Hem Fir';
  else if (/\bcedar\b/i.test(text)) attrs.species = 'Cedar';
  else if (/\bredwood\b/i.test(text)) attrs.species = 'Redwood';
  else if (/\bpine\b/i.test(text)) attrs.species = 'Pine';

  // Detect grade
  if (/\bground\s*contact\b/i.test(text)) attrs.grade = 'Ground Contact';
  else if (/\babove\s*ground\b/i.test(text)) attrs.grade = 'Above Ground';
  else if (/\b(#1|no\.?\s*1|grade\s*1)\b/i.test(text)) attrs.grade = '#1';
  else if (/\b(#2|no\.?\s*2|grade\s*2)\b/i.test(text)) attrs.grade = '#2';

  // Detect facing for insulation
  if (/\bunfaced\b/i.test(text)) attrs.facing = 'Unfaced';
  else if (/\bkraft\s*faced\b/i.test(text)) attrs.facing = 'Kraft Faced';
  else if (/\bfoil\s*faced\b/i.test(text)) attrs.facing = 'Foil Faced';

  // Detect type for foam
  if (/\bxps\b/i.test(text)) attrs.type = 'XPS';
  else if (/\beps\b/i.test(text)) attrs.type = 'EPS';
  else if (/\bpolyiso\b/i.test(text)) attrs.type = 'Polyiso';

  // Detect style for shingles
  if (/\barchitectural\b/i.test(text)) attrs.style = 'Architectural';
  else if (/\b3[- ]?tab\b/i.test(text)) attrs.style = '3-Tab';

  // Detect brand
  if (/\badvantec?h\b/i.test(text)) attrs.brand = 'AdvanTech';
  else if (/\bzip\s*system\b/i.test(text)) attrs.brand = 'ZIP System';
  else if (/\bhuber\b/i.test(text)) attrs.brand = 'Huber';
  else if (/\bquikrete\b/i.test(text)) attrs.brand = 'Quikrete';
  else if (/\bsakrete\b/i.test(text)) attrs.brand = 'Sakrete';
  else if (/\bsimpson\b/i.test(text)) attrs.brand = 'Simpson';

  return attrs;
}

/**
 * Apply a naming pattern to generate a standardized name
 */
function applyNamingPattern(pattern, attributes) {
  let name = pattern;

  // Replace all placeholders with attributes or remove them
  name = name.replace(/\{width\}/gi, attributes.width || '');
  name = name.replace(/\{height\}/gi, attributes.height || '');
  name = name.replace(/\{length\}/gi, attributes.length || '');
  name = name.replace(/\{thickness\}/gi, attributes.thickness || '');
  name = name.replace(/\{species\}/gi, attributes.species || '');
  name = name.replace(/\{grade\}/gi, attributes.grade || '');
  name = name.replace(/\{brand\}/gi, attributes.brand || '');
  name = name.replace(/\{rvalue\}/gi, attributes.rvalue || '');
  name = name.replace(/\{facing\}/gi, attributes.facing || '');
  name = name.replace(/\{type\}/gi, attributes.type || '');
  name = name.replace(/\{style\}/gi, attributes.style || '');
  name = name.replace(/\{weight\}/gi, attributes.weight || '');
  name = name.replace(/\{size\}/gi, attributes.size || '');
  name = name.replace(/\{model\}/gi, attributes.model || '');
  name = name.replace(/\{quantity\}/gi, attributes.quantity || '');
  name = name.replace(/\{profile\}/gi, attributes.profile || '');
  name = name.replace(/\{color\}/gi, attributes.color || '');
  name = name.replace(/\{dimensions\}/gi, attributes.dimensions || '');

  // Clean up extra spaces and empty x patterns
  name = name.replace(/x\s*x/gi, 'x'); // Remove double x
  name = name.replace(/\s+/g, ' ').trim(); // Clean spaces
  name = name.replace(/^\s*x\s*/i, ''); // Remove leading x
  name = name.replace(/\s*x\s*$/i, ''); // Remove trailing x

  return name;
}

/**
 * Generate a standardized name using naming conventions
 */
async function generateStandardName(description) {
  const category = priceMatcher.detectCategory(description);
  const convention = await findNamingConvention(description, category);
  const attributes = parseDescriptionAttributes(description);

  if (convention) {
    const standardName = applyNamingPattern(convention.name_pattern, attributes);
    // If pattern produced a reasonable name, use it
    if (standardName.length > 3 && !/^\s*$/.test(standardName)) {
      return {
        name: standardName,
        category: convention.category,
        subcategory: convention.subcategory,
        unit: convention.default_unit,
        confidence: 0.8
      };
    }
  }

  // Fallback: Clean up the original description
  const fallbackName = priceMatcher.normalizeText(description)
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
    .substring(0, 100);

  return {
    name: fallbackName,
    category: category,
    subcategory: null,
    unit: detectUnit(description) || 'ea',
    confidence: 0.5
  };
}

/**
 * Find a similar existing master item (>90% similarity)
 * Uses keyword overlap and name similarity to prevent duplicates
 */
async function findSimilarMasterItem(standardName, category, keywords) {
  // Search for items in the same category
  const { data: candidates } = await supabase
    .from('v2_master_items')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .limit(100);

  if (!candidates || candidates.length === 0) return null;

  let bestMatch = null;
  let bestScore = 0;

  const nameWords = new Set(standardName.toLowerCase().split(/\s+/));
  const keywordSet = new Set(keywords.map(k => k.toLowerCase()));

  for (const item of candidates) {
    // Calculate name similarity (word overlap)
    const itemWords = new Set(item.standard_name.toLowerCase().split(/\s+/));
    const nameIntersection = [...nameWords].filter(w => itemWords.has(w)).length;
    const nameUnion = new Set([...nameWords, ...itemWords]).size;
    const nameSimilarity = nameUnion > 0 ? nameIntersection / nameUnion : 0;

    // Calculate keyword overlap
    const itemKeywords = new Set((item.keywords || []).map(k => k.toLowerCase()));
    const keywordIntersection = [...keywordSet].filter(k => itemKeywords.has(k)).length;
    const keywordUnion = new Set([...keywordSet, ...itemKeywords]).size;
    const keywordSimilarity = keywordUnion > 0 ? keywordIntersection / keywordUnion : 0;

    // Combined score (name weighted higher)
    const score = (nameSimilarity * 0.7) + (keywordSimilarity * 0.3);

    if (score > bestScore && score >= 0.85) {
      bestScore = score;
      bestMatch = { item, score };
    }
  }

  return bestMatch;
}

/**
 * Determine if an item should be auto-approved based on confidence
 * High confidence = naming convention matched with most attributes extracted
 */
function shouldAutoApprove(naming, attributes) {
  // If no naming convention matched, don't auto-approve
  if (naming.confidence < 0.8) return false;

  // Count how many key attributes were extracted
  const keyAttrs = ['width', 'height', 'length', 'thickness', 'species', 'grade', 'rvalue', 'type'];
  const extractedCount = keyAttrs.filter(k => attributes[k]).length;

  // Auto-approve if we have a good convention match and at least 2 key attributes
  return extractedCount >= 2;
}

/**
 * Auto-create a master item from an unmatched description
 * Uses naming conventions to generate standardized name
 * Checks for similar items first to prevent duplicates
 */
async function autoCreateMasterItem(description, vendorId, invoiceId) {
  // Generate standardized name using conventions
  const naming = await generateStandardName(description);

  // Extract dimensions and keywords
  const dimensions = priceMatcher.extractDimensions(description);
  const keywords = priceMatcher.extractKeywords(description);
  const attributes = parseDescriptionAttributes(description);

  // Check for similar existing item first (prevent duplicates)
  const similar = await findSimilarMasterItem(naming.name, naming.category, keywords);
  if (similar) {
    console.log(`[Price Capture] Found similar item "${similar.item.standard_name}" (${(similar.score * 100).toFixed(0)}% match) instead of creating "${naming.name}"`);
    return similar.item;
  }

  // Determine review status based on confidence
  const autoApprove = shouldAutoApprove(naming, attributes);
  const reviewStatus = autoApprove ? 'approved' : 'pending';

  // Create the master item
  const { data: newItem, error } = await supabase
    .from('v2_master_items')
    .insert({
      category: naming.category,
      subcategory: naming.subcategory,
      standard_name: naming.name,
      standard_unit: naming.unit,
      dimensions: dimensions,
      keywords: keywords,
      is_active: true,
      created_by_ai: true,
      review_status: reviewStatus,
      original_description: description,
      source_invoice_id: invoiceId,
      source_vendor_id: vendorId
    })
    .select()
    .single();

  if (error) {
    // If duplicate name, try to find existing and return it
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('v2_master_items')
        .select('*')
        .eq('standard_name', naming.name)
        .single();
      if (existing) return existing;
    }
    throw error;
  }

  console.log(`[Price Capture] Auto-created master item: "${naming.name}" from "${description}" (${reviewStatus})`);
  return newItem;
}

/**
 * Capture prices from invoice line items
 * Called when AI processes an invoice
 *
 * @param {Object} options
 * @param {string} options.invoiceId - Invoice ID (source reference)
 * @param {string} options.vendorId - Vendor ID
 * @param {Array} options.lineItems - Array of line items with description, quantity, amount
 * @param {string} options.invoiceDate - Invoice date
 * @returns {Object} Capture results with matched/unmatched items
 */
async function captureFromInvoice({ invoiceId, vendorId, lineItems, invoiceDate }) {
  if (!lineItems || lineItems.length === 0) {
    return { captured: 0, matched: [], unmatched: [], errors: [] };
  }

  const results = {
    captured: 0,
    matched: [],
    unmatched: [],
    errors: []
  };

  for (const item of lineItems) {
    try {
      // Skip items without useful data
      if (!item.description || !item.amount) continue;

      // Skip very small amounts (likely not material costs)
      if (Math.abs(item.amount) < 1) continue;

      // Try to match to a master item
      const match = await priceMatcher.findMasterItem(item.description, vendorId);

      let masterItem = match.masterItem;
      let matchConfidence = match.confidence;
      let wasAutoCreated = false;

      // If no good match, auto-create a new master item
      if (!masterItem || matchConfidence < 0.5) {
        try {
          masterItem = await autoCreateMasterItem(item.description, vendorId, invoiceId);
          matchConfidence = 0.6; // Lower confidence for auto-created items
          wasAutoCreated = true;
        } catch (createErr) {
          console.error(`[Price Capture] Failed to auto-create item: ${createErr.message}`);
          // Fall back to unmatched if creation fails
          results.unmatched.push({
            description: item.description,
            amount: item.amount,
            quantity: item.quantity || 1,
            suggestedCategory: match.suggestedCategory || 'General',
            extractedKeywords: match.extractedKeywords || [],
            confidence: match.confidence || 0,
            error: createErr.message
          });
          continue;
        }
      }

      // Now we have a master item (either matched or auto-created)
      const quantity = item.quantity || 1;
      const unitPrice = item.amount / quantity;

      // Detect unit from description or default to 'ea'
      const unit = detectUnit(item.description) || masterItem.standard_unit || 'ea';

      // Add to price history
      const priceEntry = await priceMatcher.addPriceHistory({
        masterItemId: masterItem.id,
        vendorId: vendorId,
        sourceType: 'invoice',
        sourceId: invoiceId,
        unitPrice: unitPrice,
        unit: unit,
        quantity: quantity,
        dimensions: masterItem.dimensions,
        priceDate: invoiceDate
      });

      // Create or update vendor alias for future matching
      if (match.matchMethod !== 'exact_alias') {
        await priceMatcher.createAlias(
          masterItem.id,
          vendorId,
          item.description,
          null,
          wasAutoCreated ? 'auto_created' : 'auto_invoice'
        ).catch(() => {}); // Ignore duplicate errors
      }

      results.matched.push({
        description: item.description,
        masterItem: masterItem.standard_name,
        category: masterItem.category,
        unitPrice: unitPrice,
        quantity: quantity,
        confidence: matchConfidence,
        priceId: priceEntry.id,
        autoCreated: wasAutoCreated,
        reviewStatus: wasAutoCreated ? 'pending' : 'approved'
      });
      results.captured++;

    } catch (err) {
      results.errors.push({
        description: item.description,
        error: err.message
      });
    }
  }

  return results;
}

/**
 * Detect unit from description text
 */
function detectUnit(description) {
  const text = description.toLowerCase();

  // Check for explicit units
  if (/\b(per|each|ea|pc|piece)\b/.test(text)) return 'ea';
  if (/\b(linear\s*f|lf|per\s*foot|\/ft)\b/.test(text)) return 'lf';
  if (/\b(sq\s*f|sf|per\s*sq|\/sf)\b/.test(text)) return 'sf';
  if (/\b(sheet|sht)\b/.test(text)) return 'sheet';
  if (/\b(bundle|bndl)\b/.test(text)) return 'bundle';
  if (/\b(box)\b/.test(text)) return 'box';
  if (/\b(bag)\b/.test(text)) return 'bag';
  if (/\b(roll)\b/.test(text)) return 'roll';

  return null;
}

/**
 * Get the source document for a price entry
 * Returns URL or info to view the original invoice/quote
 *
 * @param {string} priceId - Price history entry ID
 * @returns {Object} Source document info
 */
async function getPriceSource(priceId) {
  const { data: price } = await supabase
    .from('v2_price_history')
    .select('source_type, source_id')
    .eq('id', priceId)
    .single();

  if (!price || !price.source_id) {
    return { type: price?.source_type || 'manual', document: null };
  }

  if (price.source_type === 'invoice') {
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('id, invoice_number, pdf_url, vendor_id, job_id')
      .eq('id', price.source_id)
      .single();

    return {
      type: 'invoice',
      document: invoice,
      url: invoice?.pdf_url,
      label: invoice ? `Invoice #${invoice.invoice_number}` : null
    };
  }

  if (price.source_type === 'quote') {
    const { data: quote } = await supabase
      .from('v2_vendor_quotes')
      .select('id, file_name, file_path, vendor_id')
      .eq('id', price.source_id)
      .single();

    return {
      type: 'quote',
      document: quote,
      url: quote?.file_path,
      label: quote?.file_name
    };
  }

  return { type: price.source_type, document: null };
}

/**
 * Update confidence score for a master item + vendor
 */
async function updateConfidenceScore(masterItemId, vendorId) {
  // Get price history for this combination
  const { data: history } = await supabase
    .from('v2_price_history')
    .select('source_type, price_date')
    .eq('master_item_id', masterItemId)
    .eq('vendor_id', vendorId);

  if (!history || history.length === 0) return;

  const counts = { invoice: 0, quote: 0, manual: 0 };
  let latestDate = null;

  for (const h of history) {
    counts[h.source_type] = (counts[h.source_type] || 0) + 1;
    if (!latestDate || h.price_date > latestDate) {
      latestDate = h.price_date;
    }
  }

  // Calculate confidence score
  // Invoice data is most reliable, then quotes, then manual
  const totalPoints = history.length;
  const weightedScore = (counts.invoice * 1.0 + counts.quote * 0.8 + counts.manual * 0.6) / totalPoints;

  // Recency bonus (data from last 90 days gets a boost)
  const daysSinceUpdate = latestDate
    ? Math.floor((Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24))
    : 365;
  const recencyMultiplier = daysSinceUpdate < 90 ? 1.0 : daysSinceUpdate < 180 ? 0.9 : 0.8;

  const finalScore = Math.min(weightedScore * recencyMultiplier, 1.0);

  // Upsert confidence record
  await supabase
    .from('v2_price_confidence')
    .upsert({
      master_item_id: masterItemId,
      vendor_id: vendorId,
      invoice_count: counts.invoice,
      quote_count: counts.quote,
      manual_count: counts.manual,
      confidence_score: finalScore,
      last_price_date: latestDate
    }, {
      onConflict: 'master_item_id,vendor_id'
    });
}

/**
 * Suggest new master items from unmatched invoice items
 * Called periodically or on demand to review unmatched items
 */
async function getUnmatchedItemSuggestions(vendorId = null) {
  // Get invoices with unmatched items stored in ai_extracted_data
  let query = supabase
    .from('v2_invoices')
    .select('id, vendor_id, ai_extracted_data, invoice_date')
    .not('ai_extracted_data', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (vendorId) {
    query = query.eq('vendor_id', vendorId);
  }

  const { data: invoices } = await query;

  const suggestions = {};

  for (const invoice of (invoices || [])) {
    const lineItems = invoice.ai_extracted_data?.line_items || [];

    for (const item of lineItems) {
      if (!item.description) continue;

      // Try to match
      const match = await priceMatcher.findMasterItem(item.description, invoice.vendor_id);

      if (!match.masterItem || match.confidence < 0.5) {
        // This is an unmatched item - suggest as new master item
        const normalized = priceMatcher.normalizeText(item.description);
        const key = normalized.substring(0, 50); // Group similar descriptions

        if (!suggestions[key]) {
          suggestions[key] = {
            description: item.description,
            category: match.suggestedCategory || priceMatcher.detectCategory(item.description),
            keywords: match.extractedKeywords || priceMatcher.extractKeywords(item.description),
            dimensions: priceMatcher.extractDimensions(item.description),
            occurrences: 0,
            vendors: new Set(),
            totalAmount: 0
          };
        }

        suggestions[key].occurrences++;
        suggestions[key].vendors.add(invoice.vendor_id);
        suggestions[key].totalAmount += item.amount || 0;
      }
    }
  }

  // Convert to array and sort by occurrences
  return Object.values(suggestions)
    .map(s => ({
      ...s,
      vendors: Array.from(s.vendors),
      avgAmount: s.totalAmount / s.occurrences
    }))
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 50); // Top 50 suggestions
}

/**
 * Create a master item from an unmatched suggestion
 * Uses naming conventions to generate standardized name
 */
async function createMasterItemFromSuggestion(suggestion) {
  const { description, category, keywords, dimensions } = suggestion;

  // Generate standardized name using naming conventions
  const naming = await generateStandardName(description);

  // Create the master item with review_status based on whether it's manual or auto
  const { data: newItem, error } = await supabase
    .from('v2_master_items')
    .insert({
      category: naming.category || category,
      subcategory: naming.subcategory,
      standard_name: naming.name,
      standard_unit: naming.unit,
      dimensions: dimensions || priceMatcher.extractDimensions(description),
      keywords: keywords || priceMatcher.extractKeywords(description),
      is_active: true,
      created_by_ai: false, // Manual creation
      review_status: 'approved', // Manual creations are pre-approved
      original_description: description
    })
    .select()
    .single();

  if (error) {
    // If duplicate name, try to find existing and return it
    if (error.code === '23505') {
      const { data: existing } = await supabase
        .from('v2_master_items')
        .select('*')
        .eq('standard_name', naming.name)
        .single();
      if (existing) return existing;
    }
    throw error;
  }

  return newItem;
}

module.exports = {
  captureFromInvoice,
  getPriceSource,
  updateConfidenceScore,
  getUnmatchedItemSuggestions,
  createMasterItemFromSuggestion,
  autoCreateMasterItem,
  generateStandardName,
  getNamingConventions,
  findNamingConvention,
  parseDescriptionAttributes,
  applyNamingPattern,
  findSimilarMasterItem,
  shouldAutoApprove,
  detectUnit
};
