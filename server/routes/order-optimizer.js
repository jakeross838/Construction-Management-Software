/**
 * Order Optimizer Routes
 * API endpoints for material order optimization with vendor splitting
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const priceMatcher = require('../matching/price-matcher');

// ============================================================
// WASTE FACTORS
// ============================================================

/**
 * GET /api/order-optimizer/waste-factors
 * Get waste factors by category
 */
router.get('/waste-factors', asyncHandler(async (req, res) => {
  const { category } = req.query;

  let query = supabase
    .from('v2_waste_factors')
    .select('*')
    .order('category')
    .order('subcategory');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * POST /api/order-optimizer/waste-factors
 * Update or create a waste factor
 */
router.post('/waste-factors', asyncHandler(async (req, res) => {
  const { category, subcategory, default_waste_percent, min_waste_percent, max_waste_percent, notes } = req.body;

  if (!category || default_waste_percent === undefined) {
    throw new AppError('category and default_waste_percent are required', 400);
  }

  const { data, error } = await supabase
    .from('v2_waste_factors')
    .upsert({
      category,
      subcategory: subcategory || null,
      default_waste_percent,
      min_waste_percent,
      max_waste_percent,
      notes,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'category,subcategory'
    })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

// ============================================================
// OPTIMIZATION
// ============================================================

/**
 * POST /api/order-optimizer/optimize
 * Run optimization on a material list
 *
 * Body: {
 *   items: [{ description, quantity, unit }],
 *   job_id: optional,
 *   include_waste: boolean (default true),
 *   max_lead_days: optional,
 *   budget_limit: optional,
 *   preferred_vendors: [vendor_id] optional
 * }
 */
router.post('/optimize', asyncHandler(async (req, res) => {
  const {
    items,
    job_id,
    include_waste = true,
    max_lead_days,
    budget_limit,
    preferred_vendors
  } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('items array is required', 400);
  }

  // Get vendor delivery info
  const { data: vendors } = await supabase
    .from('v2_vendors')
    .select('id, name, delivery_fee, free_delivery_minimum, typical_lead_days, min_order_amount');

  const vendorMap = new Map(vendors.map(v => [v.id, v]));

  // Process each item
  const processedItems = [];
  let totalMatched = 0;
  let totalUnmatched = 0;

  for (const item of items) {
    const { description, quantity, unit } = item;

    // Find matching master item
    const match = await priceMatcher.findMasterItem(description);

    if (!match.masterItem) {
      totalUnmatched++;
      processedItems.push({
        input_description: description,
        input_quantity: quantity,
        input_unit: unit,
        master_item_id: null,
        match_confidence: 0,
        match_method: 'no_match',
        suggested_category: match.suggestedCategory,
        all_vendor_prices: [],
        recommended_vendor_id: null,
        recommended_price: null,
        waste_factor: 0,
        quantity_with_waste: quantity,
        extended_price: null,
        baseline_price: null,
        savings: 0
      });
      continue;
    }

    totalMatched++;

    // Get waste factor
    let wasteFactor = 0;
    if (include_waste) {
      wasteFactor = await priceMatcher.getWasteFactor(
        match.masterItem.category,
        match.masterItem.subcategory
      );
    }
    const quantityWithWaste = quantity * (1 + wasteFactor);

    // Get all vendor prices
    const { data: prices } = await supabase
      .from('v2_current_prices')
      .select('*')
      .eq('master_item_id', match.masterItem.id);

    // Filter and sort prices
    let validPrices = prices || [];

    // Filter by lead time if specified
    if (max_lead_days) {
      validPrices = validPrices.filter(p =>
        p.lead_days === null || p.lead_days <= max_lead_days
      );
    }

    // Calculate total cost for each vendor
    const vendorPrices = validPrices.map(p => {
      const vendor = vendorMap.get(p.vendor_id);
      const totalPrice = p.unit_price * quantityWithWaste;

      return {
        vendor_id: p.vendor_id,
        vendor_name: p.vendor_name,
        unit_price: p.unit_price,
        total_price: totalPrice,
        lead_days: p.lead_days,
        in_stock: p.in_stock,
        delivery_fee: vendor?.delivery_fee || 0,
        free_delivery_minimum: vendor?.free_delivery_minimum,
        is_preferred: preferred_vendors?.includes(p.vendor_id) || false
      };
    });

    // Sort by total price (preferred vendors get small bonus)
    vendorPrices.sort((a, b) => {
      const aScore = a.total_price * (a.is_preferred ? 0.98 : 1);
      const bScore = b.total_price * (b.is_preferred ? 0.98 : 1);
      return aScore - bScore;
    });

    // Calculate baseline (highest price) and savings
    const bestPrice = vendorPrices[0]?.total_price || null;
    const worstPrice = vendorPrices[vendorPrices.length - 1]?.total_price || bestPrice;

    processedItems.push({
      input_description: description,
      input_quantity: quantity,
      input_unit: unit,
      master_item_id: match.masterItem.id,
      master_item_name: match.masterItem.standard_name,
      master_item_category: match.masterItem.category,
      match_confidence: match.confidence,
      match_method: match.matchMethod,
      all_vendor_prices: vendorPrices,
      recommended_vendor_id: vendorPrices[0]?.vendor_id || null,
      recommended_vendor_name: vendorPrices[0]?.vendor_name || null,
      recommended_price: vendorPrices[0]?.unit_price || null,
      waste_factor: wasteFactor,
      quantity_with_waste: quantityWithWaste,
      extended_price: bestPrice,
      baseline_price: worstPrice,
      savings: worstPrice && bestPrice ? worstPrice - bestPrice : 0
    });
  }

  // Group by recommended vendor for delivery optimization
  const vendorGroups = new Map();
  for (const item of processedItems) {
    if (!item.recommended_vendor_id) continue;

    if (!vendorGroups.has(item.recommended_vendor_id)) {
      const vendor = vendorMap.get(item.recommended_vendor_id);
      vendorGroups.set(item.recommended_vendor_id, {
        vendor_id: item.recommended_vendor_id,
        vendor_name: item.recommended_vendor_name,
        items: [],
        subtotal: 0,
        delivery_fee: vendor?.delivery_fee || 0,
        free_delivery_minimum: vendor?.free_delivery_minimum || 0,
        min_order_amount: vendor?.min_order_amount || 0
      });
    }

    const group = vendorGroups.get(item.recommended_vendor_id);
    group.items.push(item);
    group.subtotal += item.extended_price || 0;
  }

  // Calculate delivery costs
  const vendorSplits = Array.from(vendorGroups.values()).map(group => {
    const qualifiesForFreeDelivery = group.free_delivery_minimum > 0 &&
      group.subtotal >= group.free_delivery_minimum;
    const actualDeliveryFee = qualifiesForFreeDelivery ? 0 : group.delivery_fee;
    const meetsMinimum = group.min_order_amount <= 0 || group.subtotal >= group.min_order_amount;

    return {
      ...group,
      qualifies_for_free_delivery: qualifiesForFreeDelivery,
      actual_delivery_fee: actualDeliveryFee,
      meets_minimum: meetsMinimum,
      total_with_delivery: group.subtotal + actualDeliveryFee,
      warning: !meetsMinimum
        ? `Below minimum order of $${group.min_order_amount.toFixed(2)}`
        : null
    };
  });

  // Calculate totals
  const optimizedTotal = vendorSplits.reduce((sum, v) => sum + v.total_with_delivery, 0);
  const baselineTotal = processedItems.reduce((sum, i) => sum + (i.baseline_price || 0), 0);
  const totalDeliveryFees = vendorSplits.reduce((sum, v) => sum + v.actual_delivery_fee, 0);
  const savingsAmount = baselineTotal - optimizedTotal;
  const savingsPercent = baselineTotal > 0 ? (savingsAmount / baselineTotal * 100) : 0;

  // Check budget constraint
  let budgetWarning = null;
  if (budget_limit && optimizedTotal > budget_limit) {
    budgetWarning = `Optimization exceeds budget by $${(optimizedTotal - budget_limit).toFixed(2)}`;
  }

  res.json({
    items: processedItems,
    vendor_splits: vendorSplits.sort((a, b) => b.subtotal - a.subtotal),
    summary: {
      total_items: items.length,
      matched_items: totalMatched,
      unmatched_items: totalUnmatched,
      vendor_count: vendorSplits.length,
      optimized_total: optimizedTotal,
      baseline_total: baselineTotal,
      savings_amount: savingsAmount,
      savings_percent: savingsPercent.toFixed(1),
      delivery_fees_total: totalDeliveryFees,
      budget_limit: budget_limit,
      budget_warning: budgetWarning
    }
  });
}));

/**
 * POST /api/order-optimizer/parse-list
 * Parse a pasted material list into structured items
 */
router.post('/parse-list', asyncHandler(async (req, res) => {
  const { text } = req.body;

  if (!text) {
    throw new AppError('text is required', 400);
  }

  const lines = text.split('\n').filter(l => l.trim());
  const items = [];

  for (const line of lines) {
    // Try to parse quantity and description
    // Common formats:
    // "50 2x4x8 studs"
    // "2x4x8 studs (50)"
    // "50ea 2x4x8"
    // "2x4x8 x 50"

    let quantity = 1;
    let description = line.trim();
    let unit = 'ea';

    // Pattern 1: number at start "50 2x4x8"
    const startMatch = line.match(/^(\d+(?:\.\d+)?)\s*(?:(ea|each|pc|pcs|lf|sf|sheets?|rolls?|bags?|boxes?|bundles?))?\s+(.+)$/i);
    if (startMatch) {
      quantity = parseFloat(startMatch[1]);
      unit = startMatch[2] || 'ea';
      description = startMatch[3].trim();
    }

    // Pattern 2: quantity in parens at end "2x4x8 (50)"
    const endMatch = line.match(/^(.+?)\s*\((\d+(?:\.\d+)?)\s*(?:(ea|each|pc|pcs|lf|sf))?\)$/i);
    if (endMatch && !startMatch) {
      description = endMatch[1].trim();
      quantity = parseFloat(endMatch[2]);
      unit = endMatch[3] || 'ea';
    }

    // Pattern 3: "x 50" at end "2x4x8 x 50"
    const xMatch = line.match(/^(.+?)\s+x\s*(\d+(?:\.\d+)?)\s*$/i);
    if (xMatch && !startMatch && !endMatch) {
      description = xMatch[1].trim();
      quantity = parseFloat(xMatch[2]);
    }

    // Detect category
    const category = priceMatcher.detectCategory(description);

    items.push({
      raw_line: line,
      description,
      quantity,
      unit: unit.toLowerCase(),
      detected_category: category
    });
  }

  res.json({
    items,
    total_lines: lines.length,
    parsed_count: items.length
  });
}));

// ============================================================
// SAVED ORDERS
// ============================================================

/**
 * GET /api/order-optimizer/orders
 * List saved optimized orders
 */
router.get('/orders', asyncHandler(async (req, res) => {
  const { job_id, status } = req.query;

  let query = supabase
    .from('v2_optimized_orders')
    .select('*, job:v2_jobs(name)')
    .order('created_at', { ascending: false });

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * GET /api/order-optimizer/orders/:id
 * Get a saved optimized order with line items
 */
router.get('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: order, error } = await supabase
    .from('v2_optimized_orders')
    .select('*, job:v2_jobs(name)')
    .eq('id', id)
    .single();

  if (error) throw new AppError('Order not found', 404);

  const { data: lineItems } = await supabase
    .from('v2_order_line_items')
    .select('*, master_item:v2_master_items(standard_name, category), recommended_vendor:v2_vendors(name)')
    .eq('optimized_order_id', id);

  res.json({
    ...order,
    line_items: lineItems || []
  });
}));

/**
 * POST /api/order-optimizer/orders
 * Save an optimized order
 */
router.post('/orders', asyncHandler(async (req, res) => {
  const {
    job_id,
    name,
    items,
    summary,
    include_waste,
    max_lead_days,
    budget_limit,
    notes
  } = req.body;

  if (!items || !Array.isArray(items)) {
    throw new AppError('items array is required', 400);
  }

  // Create order header
  const { data: order, error: orderError } = await supabase
    .from('v2_optimized_orders')
    .insert({
      job_id,
      name: name || `Order ${new Date().toLocaleDateString()}`,
      status: 'draft',
      total_input_items: summary?.total_items || items.length,
      matched_items: summary?.matched_items || 0,
      unmatched_items: summary?.unmatched_items || 0,
      optimized_total: summary?.optimized_total,
      baseline_total: summary?.baseline_total,
      savings_amount: summary?.savings_amount,
      savings_percent: summary?.savings_percent,
      vendor_count: summary?.vendor_count,
      include_waste,
      max_lead_days,
      budget_limit,
      notes
    })
    .select()
    .single();

  if (orderError) throw new AppError(orderError.message, 500);

  // Create line items
  const lineItems = items.map(item => ({
    optimized_order_id: order.id,
    input_description: item.input_description,
    input_quantity: item.input_quantity,
    input_unit: item.input_unit,
    master_item_id: item.master_item_id,
    match_confidence: item.match_confidence,
    match_method: item.match_method,
    recommended_vendor_id: item.recommended_vendor_id,
    recommended_price: item.recommended_price,
    all_vendor_prices: item.all_vendor_prices,
    waste_factor: item.waste_factor,
    quantity_with_waste: item.quantity_with_waste,
    extended_price: item.extended_price,
    baseline_price: item.baseline_price,
    savings: item.savings
  }));

  const { error: lineError } = await supabase
    .from('v2_order_line_items')
    .insert(lineItems);

  if (lineError) throw new AppError(lineError.message, 500);

  res.status(201).json(order);
}));

/**
 * PATCH /api/order-optimizer/orders/:id
 * Update order status
 */
router.patch('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (status) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase
    .from('v2_optimized_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

/**
 * POST /api/order-optimizer/orders/:id/create-pos
 * Generate POs from an optimized order
 */
router.post('/orders/:id/create-pos', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get the optimized order
  const { data: order } = await supabase
    .from('v2_optimized_orders')
    .select('*, job:v2_jobs(*)')
    .eq('id', id)
    .single();

  if (!order) throw new AppError('Order not found', 404);

  // Get line items grouped by vendor
  const { data: lineItems } = await supabase
    .from('v2_order_line_items')
    .select('*')
    .eq('optimized_order_id', id)
    .not('recommended_vendor_id', 'is', null);

  // Group by vendor
  const vendorGroups = new Map();
  for (const item of lineItems) {
    if (!vendorGroups.has(item.recommended_vendor_id)) {
      vendorGroups.set(item.recommended_vendor_id, []);
    }
    vendorGroups.get(item.recommended_vendor_id).push(item);
  }

  const createdPOs = [];

  // Create PO for each vendor
  for (const [vendorId, items] of vendorGroups) {
    const total = items.reduce((sum, i) => sum + (i.extended_price || 0), 0);

    // Generate PO number
    const jobIdentifier = order.job?.name?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) || 'NOJOB';
    const { count } = await supabase
      .from('v2_purchase_orders')
      .select('*', { count: 'exact', head: true })
      .eq('job_id', order.job_id);

    const poNumber = `PO-${jobIdentifier}-${String((count || 0) + 1).padStart(4, '0')}`;

    // Create PO
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .insert({
        job_id: order.job_id,
        vendor_id: vendorId,
        po_number: poNumber,
        description: `Optimized order from ${order.name}`,
        total_amount: total,
        original_amount: total,
        status: 'open',
        status_detail: 'pending',
        approval_status: 'pending',
        notes: `Created from optimized order ${order.id}`
      })
      .select()
      .single();

    if (poError) {
      console.error('PO creation error:', poError);
      continue;
    }

    // Create PO line items
    const poLineItems = items.map(item => ({
      po_id: po.id,
      description: item.input_description,
      amount: item.extended_price || 0
    }));

    await supabase.from('v2_po_line_items').insert(poLineItems);

    createdPOs.push(po);
  }

  // Update order status
  await supabase
    .from('v2_optimized_orders')
    .update({ status: 'ordered', updated_at: new Date().toISOString() })
    .eq('id', id);

  res.json({
    message: `Created ${createdPOs.length} purchase orders`,
    purchase_orders: createdPOs
  });
}));

/**
 * DELETE /api/order-optimizer/orders/:id
 * Delete an optimized order
 */
router.delete('/orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Delete line items first (cascade should handle this but be explicit)
  await supabase
    .from('v2_order_line_items')
    .delete()
    .eq('optimized_order_id', id);

  const { error } = await supabase
    .from('v2_optimized_orders')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(error.message, 500);

  res.json({ message: 'Order deleted' });
}));

module.exports = router;
