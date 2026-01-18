/**
 * Price Intelligence Routes
 * API endpoints for master items, price history, and vendor price comparison
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');
const priceMatcher = require('../price-matcher');

// ============================================================
// STATS & OVERVIEW
// ============================================================

/**
 * GET /api/price-intelligence/stats
 * Get overview statistics for price intelligence
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const [
    { count: itemCount },
    { count: vendorCount },
    { count: priceCount },
    { data: savings }
  ] = await Promise.all([
    supabase.from('v2_master_items').select('*', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('v2_vendors').select('*', { count: 'exact', head: true }),
    supabase.from('v2_price_history').select('*', { count: 'exact', head: true }),
    supabase.from('v2_savings_log')
      .select('savings_amount')
      .gte('order_date', new Date(new Date().getFullYear(), 0, 1).toISOString())
  ]);

  // Calculate average confidence
  const { data: confidence } = await supabase
    .from('v2_price_confidence')
    .select('confidence_score')
    .not('confidence_score', 'is', null);

  const avgConfidence = confidence?.length > 0
    ? confidence.reduce((sum, c) => sum + parseFloat(c.confidence_score), 0) / confidence.length
    : 0;

  const totalSavings = savings?.reduce((sum, s) => sum + parseFloat(s.savings_amount || 0), 0) || 0;

  res.json({
    total_items: itemCount || 0,
    active_vendors: vendorCount || 0,
    price_points: priceCount || 0,
    total_savings_ytd: totalSavings,
    avg_confidence: avgConfidence
  });
}));

// ============================================================
// MASTER ITEMS
// ============================================================

/**
 * GET /api/price-intelligence/master-items
 * List/search master items with optional filters
 */
router.get('/master-items', asyncHandler(async (req, res) => {
  const { category, subcategory, search, active_only = 'true' } = req.query;

  let query = supabase
    .from('v2_master_items')
    .select('*')
    .order('category')
    .order('standard_name');

  if (active_only === 'true') {
    query = query.eq('is_active', true);
  }

  if (category) {
    query = query.eq('category', category);
  }

  if (subcategory) {
    query = query.eq('subcategory', subcategory);
  }

  if (search) {
    query = query.or(`standard_name.ilike.%${search}%,keywords.cs.{${search.toLowerCase()}}`);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * GET /api/price-intelligence/master-items/:id
 * Get single master item with all vendor prices
 */
router.get('/master-items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get master item
  const { data: item, error } = await supabase
    .from('v2_master_items')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw new AppError('Master item not found', 404);

  // Get current prices from all vendors
  const { data: prices } = await supabase
    .from('v2_current_prices')
    .select('*')
    .eq('master_item_id', id)
    .order('unit_price');

  // Get price history
  const { data: history } = await supabase
    .from('v2_price_history')
    .select('*, vendor:v2_vendors(name)')
    .eq('master_item_id', id)
    .order('price_date', { ascending: false })
    .limit(50);

  // Get aliases
  const { data: aliases } = await supabase
    .from('v2_vendor_item_aliases')
    .select('*, vendor:v2_vendors(name)')
    .eq('master_item_id', id);

  // Get confidence scores
  const { data: confidence } = await supabase
    .from('v2_price_confidence')
    .select('*, vendor:v2_vendors(name)')
    .eq('master_item_id', id);

  res.json({
    ...item,
    current_prices: prices || [],
    price_history: history || [],
    aliases: aliases || [],
    confidence: confidence || [],
    vendor_count: prices?.length || 0,
    best_price: prices?.[0] || null,
    worst_price: prices?.[prices.length - 1] || null
  });
}));

/**
 * POST /api/price-intelligence/master-items
 * Create a new master item
 */
router.post('/master-items', asyncHandler(async (req, res) => {
  const { category, subcategory, standard_name, standard_unit, dimensions, keywords } = req.body;

  if (!category || !standard_name || !standard_unit) {
    throw new AppError('category, standard_name, and standard_unit are required', 400);
  }

  const { data, error } = await supabase
    .from('v2_master_items')
    .insert({
      category,
      subcategory,
      standard_name,
      standard_unit,
      dimensions: dimensions || null,
      keywords: keywords || priceMatcher.extractKeywords(standard_name)
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

/**
 * PATCH /api/price-intelligence/master-items/:id
 * Update a master item
 */
router.patch('/master-items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Add updated_at
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('v2_master_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * DELETE /api/price-intelligence/master-items/:id
 * Soft delete (deactivate) a master item
 */
router.delete('/master-items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_master_items')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Item deactivated', item: data });
}));

// ============================================================
// CATEGORIES
// ============================================================

/**
 * GET /api/price-intelligence/categories
 * Get list of unique categories and subcategories with summary stats
 */
router.get('/categories', asyncHandler(async (req, res) => {
  // Get all active items with their categories
  const { data: items, error } = await supabase
    .from('v2_master_items')
    .select('id, category, subcategory')
    .eq('is_active', true);

  if (error) throw new AppError(error.message, 500);

  // Get price counts per category from price history
  const { data: prices } = await supabase
    .from('v2_price_history')
    .select('master_item_id, vendor_id')
    .in('master_item_id', items.map(i => i.id));

  // Build category summaries
  const categories = {};
  for (const item of items) {
    if (!categories[item.category]) {
      categories[item.category] = {
        subcategories: new Set(),
        itemIds: new Set(),
        vendorIds: new Set()
      };
    }
    categories[item.category].itemIds.add(item.id);
    if (item.subcategory) {
      categories[item.category].subcategories.add(item.subcategory);
    }
  }

  // Count vendors per category
  for (const price of (prices || [])) {
    const item = items.find(i => i.id === price.master_item_id);
    if (item && categories[item.category]) {
      categories[item.category].vendorIds.add(price.vendor_id);
    }
  }

  // Define preferred category order (GC-relevant first)
  const categoryOrder = [
    'Lumber', 'Plywood', 'Siding', 'Trim', 'Roofing',
    'Windows', 'Doors', 'Hardware', 'Decking',
    'Drywall', 'Insulation', 'Flooring', 'Concrete',
    'Electrical', 'Plumbing', 'HVAC', 'Paint'
  ];

  // Convert to array format with stats
  const result = Object.entries(categories).map(([category, data]) => ({
    category,
    subcategories: Array.from(data.subcategories).sort(),
    item_count: data.itemIds.size,
    vendor_count: data.vendorIds.size
  })).sort((a, b) => {
    const aIdx = categoryOrder.indexOf(a.category);
    const bIdx = categoryOrder.indexOf(b.category);
    if (aIdx === -1 && bIdx === -1) return a.category.localeCompare(b.category);
    if (aIdx === -1) return 1;
    if (bIdx === -1) return -1;
    return aIdx - bIdx;
  });

  res.json(result);
}));

// ============================================================
// CURRENT PRICES
// ============================================================

/**
 * GET /api/price-intelligence/current-prices
 * Get latest prices with optional filters
 */
router.get('/current-prices', asyncHandler(async (req, res) => {
  const { master_item_id, vendor_id, category } = req.query;

  let query = supabase
    .from('v2_current_prices')
    .select('*')
    .order('standard_name');

  if (master_item_id) {
    query = query.eq('master_item_id', master_item_id);
  }

  if (vendor_id) {
    query = query.eq('vendor_id', vendor_id);
  }

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * POST /api/price-intelligence/refresh-view
 * Refresh the materialized view for current prices
 */
router.post('/refresh-view', asyncHandler(async (req, res) => {
  const { error } = await supabase.rpc('refresh_current_prices');

  if (error) {
    // Fallback: try raw SQL
    const { error: rawError } = await supabase.rpc('refresh_current_prices');
    if (rawError) throw new AppError('Failed to refresh view: ' + rawError.message, 500);
  }

  res.json({ message: 'Current prices view refreshed' });
}));

// ============================================================
// PRICE HISTORY
// ============================================================

/**
 * GET /api/price-intelligence/price-history
 * Get price history with filters
 */
router.get('/price-history', asyncHandler(async (req, res) => {
  const { master_item_id, vendor_id, source_type, limit = 100 } = req.query;

  let query = supabase
    .from('v2_price_history')
    .select('*, master_item:v2_master_items(standard_name, category), vendor:v2_vendors(name)')
    .order('price_date', { ascending: false })
    .limit(parseInt(limit));

  if (master_item_id) {
    query = query.eq('master_item_id', master_item_id);
  }

  if (vendor_id) {
    query = query.eq('vendor_id', vendor_id);
  }

  if (source_type) {
    query = query.eq('source_type', source_type);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * POST /api/price-intelligence/price-history
 * Add a manual price point
 */
router.post('/price-history', asyncHandler(async (req, res) => {
  const {
    master_item_id,
    vendor_id,
    unit_price,
    unit,
    quantity,
    lead_days,
    in_stock,
    price_date,
    notes
  } = req.body;

  if (!master_item_id || !vendor_id || unit_price === undefined || !unit) {
    throw new AppError('master_item_id, vendor_id, unit_price, and unit are required', 400);
  }

  // Get master item for dimensions
  const { data: masterItem } = await supabase
    .from('v2_master_items')
    .select('dimensions')
    .eq('id', master_item_id)
    .single();

  const data = await priceMatcher.addPriceHistory({
    masterItemId: master_item_id,
    vendorId: vendor_id,
    sourceType: 'manual',
    sourceId: null,
    unitPrice: unit_price,
    unit,
    quantity,
    dimensions: masterItem?.dimensions,
    leadDays: lead_days,
    inStock: in_stock,
    priceDate: price_date,
    notes
  });

  res.status(201).json(data);
}));

// ============================================================
// ALIASES
// ============================================================

/**
 * GET /api/price-intelligence/aliases
 * Get vendor item aliases
 */
router.get('/aliases', asyncHandler(async (req, res) => {
  const { master_item_id, vendor_id } = req.query;

  let query = supabase
    .from('v2_vendor_item_aliases')
    .select('*, master_item:v2_master_items(standard_name, category), vendor:v2_vendors(name)')
    .order('times_matched', { ascending: false });

  if (master_item_id) {
    query = query.eq('master_item_id', master_item_id);
  }

  if (vendor_id) {
    query = query.eq('vendor_id', vendor_id);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * POST /api/price-intelligence/aliases
 * Create a vendor item alias
 */
router.post('/aliases', asyncHandler(async (req, res) => {
  const { master_item_id, vendor_id, vendor_description, vendor_sku, match_method } = req.body;

  if (!master_item_id || !vendor_id || !vendor_description) {
    throw new AppError('master_item_id, vendor_id, and vendor_description are required', 400);
  }

  const data = await priceMatcher.createAlias(
    master_item_id,
    vendor_id,
    vendor_description,
    vendor_sku,
    match_method || 'manual'
  );

  res.status(201).json(data);
}));

/**
 * GET /api/price-intelligence/aliases/match
 * Find potential matches for a vendor description
 */
router.get('/aliases/match', asyncHandler(async (req, res) => {
  const { description, vendor_id } = req.query;

  if (!description) {
    throw new AppError('description is required', 400);
  }

  const result = await priceMatcher.findMasterItem(description, vendor_id);

  res.json(result);
}));

/**
 * DELETE /api/price-intelligence/aliases/:id
 * Delete a vendor item alias
 */
router.delete('/aliases/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_vendor_item_aliases')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Alias deleted' });
}));

// ============================================================
// PRICE COMPARISON
// ============================================================

/**
 * GET /api/price-intelligence/compare/:masterItemId
 * Compare all vendor prices for a master item
 */
router.get('/compare/:masterItemId', asyncHandler(async (req, res) => {
  const { masterItemId } = req.params;
  const { unit = 'each' } = req.query;

  const comparison = await priceMatcher.compareVendorPrices(masterItemId, unit);

  res.json(comparison);
}));

/**
 * POST /api/price-intelligence/compare-bulk
 * Compare prices for multiple items at once
 */
router.post('/compare-bulk', asyncHandler(async (req, res) => {
  const { items, unit = 'each' } = req.body;

  if (!items || !Array.isArray(items)) {
    throw new AppError('items array is required', 400);
  }

  const comparisons = await Promise.all(
    items.map(async (item) => {
      if (item.master_item_id) {
        const comparison = await priceMatcher.compareVendorPrices(item.master_item_id, unit);
        return {
          ...item,
          comparison
        };
      } else if (item.description) {
        const match = await priceMatcher.findMasterItem(item.description, item.vendor_id);
        if (match.masterItem) {
          const comparison = await priceMatcher.compareVendorPrices(match.masterItem.id, unit);
          return {
            ...item,
            match,
            comparison
          };
        }
        return {
          ...item,
          match,
          comparison: null
        };
      }
      return item;
    })
  );

  res.json(comparisons);
}));

// ============================================================
// VENDOR QUOTES
// ============================================================

/**
 * GET /api/price-intelligence/quotes
 * List vendor quotes
 */
router.get('/quotes', asyncHandler(async (req, res) => {
  const { vendor_id, status } = req.query;

  let query = supabase
    .from('v2_vendor_quotes')
    .select('*, vendor:v2_vendors(name)')
    .order('created_at', { ascending: false });

  if (vendor_id) {
    query = query.eq('vendor_id', vendor_id);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * POST /api/price-intelligence/quotes
 * Record a vendor quote
 */
router.post('/quotes', asyncHandler(async (req, res) => {
  const { vendor_id, file_name, file_path, quote_date, expiration_date, total_amount, notes } = req.body;

  if (!vendor_id || !file_name) {
    throw new AppError('vendor_id and file_name are required', 400);
  }

  const { data, error } = await supabase
    .from('v2_vendor_quotes')
    .insert({
      vendor_id,
      file_name,
      file_path,
      quote_date,
      expiration_date,
      total_amount,
      notes,
      status: 'pending'
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

// ============================================================
// PRICE MATRIX VIEW
// ============================================================

/**
 * GET /api/price-intelligence/matrix
 * Get price matrix: items as rows, vendors as columns
 */
router.get('/matrix', asyncHandler(async (req, res) => {
  const { category, limit = 50 } = req.query;

  // Get items
  let itemQuery = supabase
    .from('v2_master_items')
    .select('id, standard_name, category, subcategory, standard_unit')
    .eq('is_active', true)
    .order('category')
    .order('standard_name')
    .limit(parseInt(limit));

  if (category) {
    itemQuery = itemQuery.eq('category', category);
  }

  const { data: items, error: itemError } = await itemQuery;
  if (itemError) throw new AppError(itemError.message, 500);

  if (!items || items.length === 0) {
    return res.json({ items: [], vendors: [], matrix: [] });
  }

  // Get latest prices for these items (most recent per item+vendor)
  // Using v2_price_history directly since v2_current_prices view may not exist
  const { data: allPrices, error: priceError } = await supabase
    .from('v2_price_history')
    .select('*')
    .in('master_item_id', items.map(i => i.id))
    .order('price_date', { ascending: false });

  if (priceError) throw new AppError(priceError.message, 500);

  // Get most recent price per item+vendor combination
  const latestPrices = {};
  for (const p of (allPrices || [])) {
    const key = `${p.master_item_id}-${p.vendor_id}`;
    if (!latestPrices[key]) {
      latestPrices[key] = p;
    }
  }
  const prices = Object.values(latestPrices);

  // Get unique vendors
  const vendorIds = [...new Set(prices.map(p => p.vendor_id))];
  const { data: vendors } = await supabase
    .from('v2_vendors')
    .select('id, name')
    .in('id', vendorIds);

  // Build matrix
  const matrix = items.map(item => {
    const itemPrices = prices.filter(p => p.master_item_id === item.id);
    const vendorPrices = {};

    for (const vendor of (vendors || [])) {
      const price = itemPrices.find(p => p.vendor_id === vendor.id);
      vendorPrices[vendor.id] = price ? {
        unit_price: price.unit_price,
        price_per_each: price.price_per_each,
        price_per_lf: price.price_per_lf,
        price_per_sf: price.price_per_sf,
        price_date: price.price_date,
        lead_days: price.lead_days
      } : null;
    }

    // Find best/worst
    const activePrices = itemPrices.filter(p => p.unit_price != null);
    const sortedPrices = activePrices.sort((a, b) => a.unit_price - b.unit_price);

    return {
      ...item,
      vendor_prices: vendorPrices,
      best_vendor_id: sortedPrices[0]?.vendor_id,
      best_price: sortedPrices[0]?.unit_price,
      worst_price: sortedPrices[sortedPrices.length - 1]?.unit_price,
      price_spread: sortedPrices.length > 1
        ? sortedPrices[sortedPrices.length - 1].unit_price - sortedPrices[0].unit_price
        : 0,
      vendor_count: activePrices.length
    };
  });

  res.json({
    items: matrix,
    vendors: vendors || [],
    total_items: items.length
  });
}));

module.exports = router;
