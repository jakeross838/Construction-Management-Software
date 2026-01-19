/**
 * Price Matcher Service
 * Handles matching vendor descriptions to master items and price normalization
 */

const { supabase } = require('../config');

// Common unit conversions
const UNIT_CONVERSIONS = {
  // Length
  'ft': 1,
  'feet': 1,
  'foot': 1,
  'lf': 1,
  'linear foot': 1,
  'linear feet': 1,
  'in': 1/12,
  'inch': 1/12,
  'inches': 1/12,
  'yd': 3,
  'yard': 3,
  'yards': 3,
  'm': 3.28084,
  'meter': 3.28084,
  'meters': 3.28084,

  // Area
  'sf': 1,
  'sq ft': 1,
  'sqft': 1,
  'square foot': 1,
  'square feet': 1,
  'sy': 9,
  'sq yd': 9,
  'square yard': 9,
  'square yards': 9,

  // Volume (board feet)
  'bf': 1,
  'board foot': 1,
  'board feet': 1,
  'mbf': 1000, // thousand board feet

  // Count
  'ea': 1,
  'each': 1,
  'pc': 1,
  'piece': 1,
  'pieces': 1,
  'unit': 1,
  'bundle': 1,
  'bndl': 1,
  'bag': 1,
  'box': 1,
  'roll': 1,
  'sheet': 1,
  'sht': 1,
  'pallet': 1
};

// Category keywords for matching
const CATEGORY_KEYWORDS = {
  'Lumber': ['lumber', '2x4', '2x6', '2x8', '2x10', '2x12', 'stud', 'board', 'plank', 'timber', 'pt', 'pressure treated', 'kiln dried', 'kd', 'doug fir', 'douglas fir', 'spf', 'hem fir', 'cedar', 'redwood', 'pine', 'oak'],
  'Plywood': ['plywood', 'ply', 'osb', 'sheathing', 'cdx', 'bc', 'ac', 'advantech', 'zip system', 'huber'],
  'Siding': ['siding', 'hardie', 'fiber cement', 'vinyl', 'lap siding', 'board and batten', 'shake', 'lp smartside'],
  'Trim': ['trim', 'fascia', 'soffit', 'casing', 'baseboard', 'base', 'crown', 'moulding', 'molding', 'chair rail', 'pvc trim', 'azek', 'primed'],
  'Roofing': ['shingle', 'roofing', 'felt', 'underlayment', 'ridge cap', 'flashing', 'drip edge', 'ice dam', 'ice & water'],
  'Windows': ['window', 'glazing', 'glass', 'impact', 'vinyl window'],
  'Doors': ['door', 'entry', 'interior door', 'exterior door', 'prehung', 'slab'],
  'Hardware': ['screw', 'nail', 'bolt', 'washer', 'nut', 'anchor', 'fastener', 'hinge', 'bracket', 'joist hanger', 'simpson', 'hardware', 'clip', 'hidden fastener'],
  'Decking': ['deck', 'decking', 'trex', 'timbertech', 'composite deck', 'deck board', 'deck screw', 'railing', 'baluster'],
  'Drywall': ['drywall', 'sheetrock', 'gypsum', 'gyp', 'greenboard', 'moisture resistant', 'firecode', 'type x', 'densglass'],
  'Insulation': ['insulation', 'batt', 'blown', 'spray foam', 'fiberglass', 'rockwool', 'mineral wool', 'rigid foam', 'eps', 'xps', 'polyiso'],
  'Flooring': ['flooring', 'lvp', 'lvt', 'hardwood', 'tile', 'carpet', 'laminate', 'vinyl plank'],
  'Concrete': ['concrete', 'cement', 'rebar', 'block', 'cmu', 'mortar', 'grout', 'ready mix'],
  'Electrical': ['wire', 'romex', 'conduit', 'emt', 'pvc conduit', 'breaker', 'panel', 'outlet', 'switch'],
  'Plumbing': ['pipe', 'pex', 'copper', 'pvc pipe', 'fitting', 'valve', 'faucet', 'toilet', 'sink'],
  'HVAC': ['duct', 'ductwork', 'hvac', 'flex', 'register', 'grille', 'diffuser'],
  'Paint': ['paint', 'primer', 'stain', 'sealer', 'gallon', 'quart']
};

/**
 * Normalize text for matching (lowercase, remove special chars)
 */
function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extract dimensions from description (e.g., "2x4x8" -> {width: 2, height: 4, length: 8})
 */
function extractDimensions(description) {
  const dims = {};
  const normalized = normalizeText(description);

  // Match patterns like 2x4x8, 4x8, etc.
  const sizeMatch = normalized.match(/(\d+)\s*x\s*(\d+)(?:\s*x\s*(\d+))?/);
  if (sizeMatch) {
    if (sizeMatch[3]) {
      // 3D: width x height x length (e.g., 2x4x8)
      dims.width = parseFloat(sizeMatch[1]);
      dims.height = parseFloat(sizeMatch[2]);
      dims.length = parseFloat(sizeMatch[3]);
    } else {
      // 2D: width x height (e.g., 4x8 sheet)
      dims.width = parseFloat(sizeMatch[1]);
      dims.height = parseFloat(sizeMatch[2]);
    }
  }

  // Match thickness patterns like 1/2", 3/4", 5/8"
  const thicknessMatch = normalized.match(/(\d+)\s*\/\s*(\d+)\s*(?:in|inch|"|\'\')/);
  if (thicknessMatch) {
    dims.thickness = parseFloat(thicknessMatch[1]) / parseFloat(thicknessMatch[2]);
  }

  // Match decimal thickness like 0.5", 0.75"
  const decimalThickness = normalized.match(/(\d+\.?\d*)\s*(?:in|inch|"|\'\')/);
  if (decimalThickness && !dims.thickness) {
    dims.thickness = parseFloat(decimalThickness[1]);
  }

  return Object.keys(dims).length > 0 ? dims : null;
}

/**
 * Detect category from description
 */
function detectCategory(description) {
  const normalized = normalizeText(description);

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return category;
      }
    }
  }

  return 'General';
}

/**
 * Extract keywords from description for matching
 */
function extractKeywords(description) {
  const normalized = normalizeText(description);
  const words = normalized.split(' ').filter(w => w.length > 2);

  // Remove common noise words
  const noiseWords = ['the', 'and', 'for', 'with', 'per', 'each', 'from', 'this', 'that', 'our', 'your'];
  return words.filter(w => !noiseWords.includes(w));
}

/**
 * Calculate match score between two descriptions
 */
function calculateMatchScore(description1, description2) {
  const keywords1 = new Set(extractKeywords(description1));
  const keywords2 = new Set(extractKeywords(description2));

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);

  // Jaccard similarity
  return intersection.size / union.size;
}

/**
 * Find matching master item for a vendor description
 * Uses PostgreSQL full-text search for better performance at scale
 */
async function findMasterItem(vendorDescription, vendorId = null) {
  const normalized = normalizeText(vendorDescription);

  // 1. Check for exact alias match first
  if (vendorId) {
    const { data: exactAlias } = await supabase
      .from('v2_vendor_item_aliases')
      .select('*, master_item:v2_master_items(*)')
      .eq('vendor_id', vendorId)
      .ilike('vendor_description', vendorDescription)
      .single();

    if (exactAlias?.master_item) {
      // Increment times_matched
      await supabase
        .from('v2_vendor_item_aliases')
        .update({ times_matched: (exactAlias.times_matched || 1) + 1 })
        .eq('id', exactAlias.id);

      return {
        masterItem: exactAlias.master_item,
        confidence: exactAlias.confidence || 1.0,
        matchMethod: 'exact_alias'
      };
    }
  }

  // 2. Use full-text search on aliases (fast, indexed)
  const { data: aliasMatches } = await supabase
    .from('v2_vendor_item_aliases')
    .select('*, master_item:v2_master_items(*)')
    .textSearch('search_vector', normalized.split(' ').join(' & '), { type: 'websearch' })
    .limit(10);

  // Find best alias match by score
  let bestAliasMatch = null;
  let bestAliasScore = 0;

  for (const alias of (aliasMatches || [])) {
    const score = calculateMatchScore(vendorDescription, alias.vendor_description);
    if (score > bestAliasScore && score > 0.5) {
      bestAliasScore = score;
      bestAliasMatch = alias;
    }
  }

  if (bestAliasMatch?.master_item) {
    return {
      masterItem: bestAliasMatch.master_item,
      confidence: bestAliasScore,
      matchMethod: 'alias_fulltext'
    };
  }

  // 3. Use full-text search on master items (via database function)
  const category = detectCategory(vendorDescription);
  const searchTerms = extractKeywords(vendorDescription).join(' ');

  const { data: ftResults } = await supabase
    .rpc('search_master_items', {
      p_query: searchTerms,
      p_category: category !== 'General' ? category : null,
      p_limit: 20
    });

  if (ftResults && ftResults.length > 0) {
    // Find best match by combining FTS rank with Jaccard similarity
    let bestMatch = null;
    let bestScore = 0;

    for (const item of ftResults) {
      const nameScore = calculateMatchScore(vendorDescription, item.standard_name);
      // Combine Jaccard score with FTS rank (rank is 0-1)
      const combinedScore = (nameScore * 0.6) + (Math.min(item.rank, 1) * 0.4);

      if (combinedScore > bestScore && combinedScore > 0.3) {
        bestScore = combinedScore;
        bestMatch = item;
      }
    }

    if (bestMatch) {
      return {
        masterItem: bestMatch,
        confidence: Math.min(bestScore, 1.0),
        matchMethod: 'fulltext_search'
      };
    }
  }

  // 4. Fallback: Basic keyword search (for edge cases)
  const keywords = extractKeywords(vendorDescription);
  let query = supabase
    .from('v2_master_items')
    .select('*')
    .eq('is_active', true);

  if (category !== 'General') {
    query = query.eq('category', category);
  }

  const { data: masterItems } = await query.limit(50);

  let bestMatch = null;
  let bestScore = 0;

  for (const item of (masterItems || [])) {
    const nameScore = calculateMatchScore(vendorDescription, item.standard_name);
    const itemKeywords = new Set(item.keywords || []);
    const keywordOverlap = keywords.filter(k => itemKeywords.has(k)).length;
    const keywordBonus = keywordOverlap / Math.max(keywords.length, 1) * 0.2;
    const totalScore = nameScore + keywordBonus;

    if (totalScore > bestScore && totalScore > 0.3) {
      bestScore = totalScore;
      bestMatch = item;
    }
  }

  if (bestMatch) {
    return {
      masterItem: bestMatch,
      confidence: Math.min(bestScore, 1.0),
      matchMethod: 'keyword_match'
    };
  }

  // 5. No match found
  return {
    masterItem: null,
    confidence: 0,
    matchMethod: 'no_match',
    suggestedCategory: category,
    extractedDimensions: extractDimensions(vendorDescription),
    extractedKeywords: keywords
  };
}

/**
 * Normalize price to standard units (per each, lf, sf, bf, sheet)
 */
function normalizePrice(unitPrice, unit, quantity = 1, dimensions = null) {
  const normalizedUnit = normalizeText(unit);
  const result = {
    price_per_each: null,
    price_per_lf: null,
    price_per_sf: null,
    price_per_bf: null,
    price_per_sheet: null
  };

  // Direct unit matches
  if (['ea', 'each', 'pc', 'piece', 'unit'].includes(normalizedUnit)) {
    result.price_per_each = unitPrice;
  }

  if (['lf', 'ft', 'linear foot', 'linear feet', 'foot', 'feet'].includes(normalizedUnit)) {
    result.price_per_lf = unitPrice;
    // If we have length, calculate per each
    if (dimensions?.length) {
      result.price_per_each = unitPrice * dimensions.length;
    }
  }

  if (['sf', 'sq ft', 'sqft', 'square foot', 'square feet'].includes(normalizedUnit)) {
    result.price_per_sf = unitPrice;
  }

  if (['bf', 'board foot', 'board feet'].includes(normalizedUnit)) {
    result.price_per_bf = unitPrice;
  }

  if (['sheet', 'sht'].includes(normalizedUnit)) {
    result.price_per_sheet = unitPrice;
    // If we have dimensions, calculate per sf
    if (dimensions?.width && dimensions?.height) {
      const sqft = (dimensions.width * dimensions.height) / 144; // convert sq inches to sq feet
      result.price_per_sf = unitPrice / sqft;
    }
  }

  // Calculate derived prices if we have dimensions
  if (dimensions) {
    // For lumber: calculate board feet price
    if (dimensions.width && dimensions.height && dimensions.length && !result.price_per_bf) {
      // Board feet = (thickness x width x length) / 12
      // Assuming width and height are in inches, length in feet
      const boardFeet = (dimensions.width * dimensions.height * dimensions.length) / 12;
      if (result.price_per_each) {
        result.price_per_bf = result.price_per_each / boardFeet;
      }
    }

    // For sheets: calculate per sf if we have sheet price
    if (dimensions.width && dimensions.height) {
      const sqft = (dimensions.width * dimensions.height); // already in square feet for 4x8 sheets
      if (result.price_per_sheet && !result.price_per_sf) {
        result.price_per_sf = result.price_per_sheet / sqft;
      }
      if (result.price_per_sf && !result.price_per_sheet) {
        result.price_per_sheet = result.price_per_sf * sqft;
      }
    }
  }

  return result;
}

/**
 * Compare vendor prices for a master item
 */
async function compareVendorPrices(masterItemId, priceUnit = 'each') {
  const { data: prices } = await supabase
    .from('v2_current_prices')
    .select('*')
    .eq('master_item_id', masterItemId)
    .order('unit_price', { ascending: true });

  if (!prices || prices.length === 0) {
    return { prices: [], bestVendor: null, priceDifference: 0 };
  }

  // Determine which price field to use for comparison
  const priceField = `price_per_${priceUnit}`;

  // Filter to prices that have the requested unit
  const comparablePrices = prices.filter(p => p[priceField] != null);

  if (comparablePrices.length === 0) {
    // Fall back to unit_price
    return {
      prices: prices.map(p => ({
        vendor_id: p.vendor_id,
        vendor_name: p.vendor_name,
        unit_price: p.unit_price,
        unit: p.unit,
        price_date: p.price_date,
        lead_days: p.lead_days,
        in_stock: p.in_stock
      })),
      bestVendor: prices[0],
      priceDifference: prices.length > 1 ? prices[prices.length - 1].unit_price - prices[0].unit_price : 0
    };
  }

  // Sort by the requested price unit
  comparablePrices.sort((a, b) => a[priceField] - b[priceField]);

  return {
    prices: comparablePrices.map(p => ({
      vendor_id: p.vendor_id,
      vendor_name: p.vendor_name,
      unit_price: p.unit_price,
      comparable_price: p[priceField],
      unit: p.unit,
      price_date: p.price_date,
      lead_days: p.lead_days,
      in_stock: p.in_stock
    })),
    bestVendor: comparablePrices[0],
    worstVendor: comparablePrices[comparablePrices.length - 1],
    priceDifference: comparablePrices.length > 1
      ? comparablePrices[comparablePrices.length - 1][priceField] - comparablePrices[0][priceField]
      : 0,
    savingsPercent: comparablePrices.length > 1
      ? ((comparablePrices[comparablePrices.length - 1][priceField] - comparablePrices[0][priceField]) / comparablePrices[comparablePrices.length - 1][priceField] * 100).toFixed(1)
      : 0
  };
}

/**
 * Get or calculate confidence score for a master item + vendor combination
 */
async function getConfidenceScore(masterItemId, vendorId) {
  const { data: confidence } = await supabase
    .from('v2_price_confidence')
    .select('*')
    .eq('master_item_id', masterItemId)
    .eq('vendor_id', vendorId)
    .single();

  if (confidence) {
    return confidence;
  }

  // Calculate from price history if no cached score
  const { data: history } = await supabase
    .from('v2_price_history')
    .select('source_type, price_date, unit_price')
    .eq('master_item_id', masterItemId)
    .eq('vendor_id', vendorId);

  if (!history || history.length === 0) {
    return { confidence_score: 0, invoice_count: 0, quote_count: 0, manual_count: 0 };
  }

  const counts = {
    invoice: 0,
    quote: 0,
    manual: 0
  };

  let latestDate = null;
  const prices = [];

  for (const h of history) {
    counts[h.source_type] = (counts[h.source_type] || 0) + 1;
    prices.push(h.unit_price);
    if (!latestDate || h.price_date > latestDate) {
      latestDate = h.price_date;
    }
  }

  // Calculate variance
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance = prices.length > 1
    ? prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length
    : 0;
  const coefficientOfVariation = mean > 0 ? Math.sqrt(variance) / mean : 0;

  return {
    invoice_count: counts.invoice,
    quote_count: counts.quote,
    manual_count: counts.manual,
    last_price_date: latestDate,
    price_variance: coefficientOfVariation,
    confidence_score: null // Will be calculated by the database function
  };
}

/**
 * Create a vendor alias mapping
 */
async function createAlias(masterItemId, vendorId, vendorDescription, vendorSku = null, matchMethod = 'manual') {
  const { data, error } = await supabase
    .from('v2_vendor_item_aliases')
    .upsert({
      master_item_id: masterItemId,
      vendor_id: vendorId,
      vendor_description: vendorDescription,
      vendor_sku: vendorSku,
      match_method: matchMethod,
      confidence: matchMethod === 'manual' ? 1.0 : 0.8
    }, {
      onConflict: 'vendor_id,vendor_description'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Add a price history entry
 */
async function addPriceHistory(entry) {
  const {
    masterItemId,
    vendorId,
    sourceType,
    sourceId,
    unitPrice,
    unit,
    quantity,
    dimensions,
    leadDays,
    inStock,
    priceDate,
    notes
  } = entry;

  // Normalize prices
  const normalizedPrices = normalizePrice(unitPrice, unit, quantity, dimensions);

  const { data, error } = await supabase
    .from('v2_price_history')
    .insert({
      master_item_id: masterItemId,
      vendor_id: vendorId,
      source_type: sourceType,
      source_id: sourceId,
      unit_price: unitPrice,
      unit: unit,
      quantity: quantity,
      ...normalizedPrices,
      lead_days: leadDays,
      in_stock: inStock,
      price_date: priceDate || new Date().toISOString().split('T')[0],
      notes: notes
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get waste factor for a category
 */
async function getWasteFactor(category, subcategory = null) {
  let query = supabase
    .from('v2_waste_factors')
    .select('*')
    .eq('category', category);

  if (subcategory) {
    query = query.eq('subcategory', subcategory);
  } else {
    query = query.is('subcategory', null);
  }

  const { data } = await query.single();

  if (data) {
    return data.default_waste_percent / 100; // Return as decimal
  }

  // Try category-level default
  if (subcategory) {
    const { data: categoryDefault } = await supabase
      .from('v2_waste_factors')
      .select('*')
      .eq('category', category)
      .is('subcategory', null)
      .single();

    if (categoryDefault) {
      return categoryDefault.default_waste_percent / 100;
    }
  }

  // Global default
  return 0.05; // 5%
}

module.exports = {
  normalizeText,
  extractDimensions,
  detectCategory,
  extractKeywords,
  calculateMatchScore,
  findMasterItem,
  normalizePrice,
  compareVendorPrices,
  getConfidenceScore,
  createAlias,
  addPriceHistory,
  getWasteFactor,
  CATEGORY_KEYWORDS,
  UNIT_CONVERSIONS
};
