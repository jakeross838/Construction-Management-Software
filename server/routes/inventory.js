/**
 * Inventory Routes
 * Material inventory management with auto-PO and price comparison
 * Phase 8 Integrations - Suppliers
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const { AppError, asyncHandler } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const standards = require('../services/standards');

// ============================================================
// INVENTORY ITEMS CRUD
// ============================================================

/**
 * Get all inventory items with optional filters
 * GET /api/inventory
 */
router.get('/', asyncHandler(async (req, res) => {
  const { category, low_stock, vendor_id, search } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_inventory_items')
    .select(`
      *,
      preferred_vendor:v2_vendors!preferred_vendor_id(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .order('name', { ascending: true });

  // Filter by builder if authenticated
  if (builderId) query = query.eq('builder_id', builderId);
  if (category) query = query.eq('category', category);
  if (vendor_id) query = query.eq('preferred_vendor_id', vendor_id);

  // Low stock filter - items at or below reorder point
  if (low_stock === 'true') {
    query = query.gt('reorder_point', 0);
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Filter low stock items in application layer for complex comparison
  let items = data || [];
  if (low_stock === 'true') {
    items = items.filter(item => item.current_quantity <= item.reorder_point);
  }

  res.json(items);
}));

/**
 * Get single inventory item
 * GET /api/inventory/:id
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_inventory_items')
    .select(`
      *,
      preferred_vendor:v2_vendors!preferred_vendor_id(id, name, email, phone),
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('id', id)
    .single();

  if (error) throw new AppError('NOT_FOUND', 'Inventory item not found');

  res.json(data);
}));

/**
 * Create inventory item
 * POST /api/inventory
 */
router.post('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const itemData = { ...req.body };

  if (builderId) itemData.builder_id = builderId;

  const { data, error } = await supabase
    .from('v2_inventory_items')
    .insert(itemData)
    .select(`
      *,
      preferred_vendor:v2_vendors!preferred_vendor_id(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  logger.info('Inventory item created', { component: 'Inventory', itemId: data.id, name: data.name });
  res.status(201).json(data);
}));

/**
 * Update inventory item
 * PATCH /api/inventory/:id
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('v2_inventory_items')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      preferred_vendor:v2_vendors!preferred_vendor_id(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  logger.info('Inventory item updated', { component: 'Inventory', itemId: id });
  res.json(data);
}));

/**
 * Delete inventory item
 * DELETE /api/inventory/:id
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check for linked transactions
  const { count } = await supabase
    .from('v2_inventory_transactions')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', id);

  if (count > 0) {
    throw new AppError('VALIDATION_FAILED', `Cannot delete item with ${count} transaction(s). Archive it instead.`);
  }

  const { error } = await supabase
    .from('v2_inventory_items')
    .delete()
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: 'Inventory item deleted' });
}));

// ============================================================
// INVENTORY ADJUSTMENTS & TRANSACTIONS
// ============================================================

/**
 * Adjust inventory quantity
 * POST /api/inventory/:id/adjust
 */
router.post('/:id/adjust', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    transaction_type = 'adjusted',
    quantity,
    job_id,
    unit_cost,
    po_id,
    invoice_id,
    notes,
    created_by = 'system'
  } = req.body;

  if (quantity === undefined || quantity === null) {
    throw new AppError('VALIDATION_FAILED', 'Quantity is required');
  }

  // Validate transaction type
  const validTypes = ['received', 'used', 'adjusted', 'returned', 'transferred'];
  if (!validTypes.includes(transaction_type)) {
    throw new AppError('VALIDATION_FAILED', `Invalid transaction type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Get current item
  const { data: item, error: fetchError } = await supabase
    .from('v2_inventory_items')
    .select('id, name, current_quantity')
    .eq('id', id)
    .single();

  if (fetchError || !item) {
    throw new AppError('NOT_FOUND', 'Inventory item not found');
  }

  // Calculate quantity change
  let quantityChange = parseFloat(quantity);
  if (transaction_type === 'used' || transaction_type === 'transferred') {
    quantityChange = -Math.abs(quantityChange);
  } else if (transaction_type === 'received' || transaction_type === 'returned') {
    quantityChange = Math.abs(quantityChange);
  }
  // 'adjusted' keeps the sign as-is

  const newQuantity = parseFloat(item.current_quantity) + quantityChange;

  // Check for negative inventory
  if (newQuantity < 0 && transaction_type !== 'adjusted') {
    throw new AppError('VALIDATION_FAILED', `Cannot reduce quantity below 0. Current: ${item.current_quantity}, Change: ${quantityChange}`);
  }

  // Create transaction record
  const totalCost = unit_cost ? Math.abs(quantityChange) * parseFloat(unit_cost) : null;

  const { data: transaction, error: txError } = await supabase
    .from('v2_inventory_transactions')
    .insert({
      item_id: id,
      job_id,
      transaction_type,
      quantity: quantityChange,
      unit_cost,
      total_cost: totalCost,
      po_id,
      invoice_id,
      notes,
      created_by
    })
    .select()
    .single();

  if (txError) throw new AppError('DATABASE_ERROR', txError.message);

  // Update inventory quantity
  const { error: updateError } = await supabase
    .from('v2_inventory_items')
    .update({
      current_quantity: newQuantity,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  logger.info('Inventory adjusted', {
    component: 'Inventory',
    itemId: id,
    itemName: item.name,
    type: transaction_type,
    quantityChange,
    newQuantity
  });

  res.json({
    success: true,
    transaction,
    previous_quantity: parseFloat(item.current_quantity),
    new_quantity: newQuantity,
    quantity_change: quantityChange
  });
}));

/**
 * Get transaction history for an item
 * GET /api/inventory/:id/transactions
 */
router.get('/:id/transactions', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50, offset = 0 } = req.query;

  const { data, error, count } = await supabase
    .from('v2_inventory_transactions')
    .select(`
      *,
      job:v2_jobs(id, name),
      po:v2_purchase_orders(id, po_number),
      invoice:v2_invoices(id, invoice_number)
    `, { count: 'exact' })
    .eq('item_id', id)
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({
    data: data || [],
    total: count,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

// ============================================================
// LOW STOCK & AUTO-PO
// ============================================================

/**
 * Get items below reorder point
 * GET /api/inventory/low-stock
 */
router.get('/low-stock', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { vendor_id } = req.query;

  let query = supabase
    .from('v2_inventory_items')
    .select(`
      *,
      preferred_vendor:v2_vendors!preferred_vendor_id(id, name, email),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .gt('reorder_point', 0)
    .order('name');

  if (builderId) query = query.eq('builder_id', builderId);
  if (vendor_id) query = query.eq('preferred_vendor_id', vendor_id);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Filter items where current_quantity <= reorder_point
  const lowStockItems = (data || []).filter(item =>
    parseFloat(item.current_quantity) <= parseFloat(item.reorder_point)
  );

  // Get best prices for each item
  const enrichedItems = await Promise.all(lowStockItems.map(async (item) => {
    const { data: prices } = await supabase
      .from('v2_vendor_prices')
      .select(`
        vendor_id,
        unit_price,
        lead_days,
        vendor:v2_vendors(id, name)
      `)
      .eq('item_id', item.id)
      .lte('effective_date', new Date().toISOString().split('T')[0])
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString().split('T')[0]}`)
      .order('unit_price', { ascending: true });

    const bestPrice = prices?.[0];

    return {
      ...item,
      shortage: parseFloat(item.reorder_point) - parseFloat(item.current_quantity),
      best_price: bestPrice ? {
        vendor_id: bestPrice.vendor_id,
        vendor_name: bestPrice.vendor?.name,
        unit_price: parseFloat(bestPrice.unit_price),
        lead_days: bestPrice.lead_days
      } : null,
      estimated_order_cost: bestPrice
        ? parseFloat(bestPrice.unit_price) * parseFloat(item.reorder_quantity)
        : null
    };
  }));

  res.json({
    items: enrichedItems,
    count: enrichedItems.length,
    total_estimated_cost: enrichedItems.reduce((sum, item) => sum + (item.estimated_order_cost || 0), 0)
  });
}));

/**
 * Generate auto-POs for low stock items
 * POST /api/inventory/auto-po
 * Groups items by preferred vendor and creates draft POs
 */
router.post('/auto-po', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, created_by = 'system', dry_run = false } = req.body;

  // Get low stock items
  let query = supabase
    .from('v2_inventory_items')
    .select(`
      *,
      preferred_vendor:v2_vendors!preferred_vendor_id(id, name)
    `)
    .gt('reorder_point', 0)
    .gt('reorder_quantity', 0)
    .not('preferred_vendor_id', 'is', null);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data: items, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Filter low stock items
  const lowStockItems = (items || []).filter(item =>
    parseFloat(item.current_quantity) <= parseFloat(item.reorder_point)
  );

  if (lowStockItems.length === 0) {
    return res.json({
      success: true,
      message: 'No items below reorder point',
      pos_created: 0,
      pos: []
    });
  }

  // Group by preferred vendor
  const itemsByVendor = {};
  for (const item of lowStockItems) {
    const vendorId = item.preferred_vendor_id;
    if (!itemsByVendor[vendorId]) {
      itemsByVendor[vendorId] = {
        vendor_id: vendorId,
        vendor_name: item.preferred_vendor?.name || 'Unknown',
        items: []
      };
    }

    // Get best price for this item from this vendor
    const { data: vendorPrice } = await supabase
      .from('v2_vendor_prices')
      .select('unit_price, lead_days')
      .eq('vendor_id', vendorId)
      .eq('item_id', item.id)
      .lte('effective_date', new Date().toISOString().split('T')[0])
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString().split('T')[0]}`)
      .lte('min_quantity', item.reorder_quantity)
      .order('unit_price', { ascending: true })
      .limit(1)
      .single();

    itemsByVendor[vendorId].items.push({
      item_id: item.id,
      item_name: item.name,
      sku: item.sku,
      quantity: parseFloat(item.reorder_quantity),
      unit_price: vendorPrice?.unit_price ? parseFloat(vendorPrice.unit_price) : null,
      cost_code_id: item.cost_code_id,
      current_quantity: parseFloat(item.current_quantity),
      reorder_point: parseFloat(item.reorder_point)
    });
  }

  // If dry run, just return what would be created
  if (dry_run) {
    const preview = Object.values(itemsByVendor).map(group => ({
      vendor_id: group.vendor_id,
      vendor_name: group.vendor_name,
      line_items: group.items.length,
      total_amount: group.items.reduce((sum, item) =>
        sum + (item.unit_price ? item.quantity * item.unit_price : 0), 0),
      items: group.items
    }));

    return res.json({
      success: true,
      dry_run: true,
      preview,
      vendors_count: preview.length,
      items_count: lowStockItems.length,
      total_estimated_cost: preview.reduce((sum, v) => sum + v.total_amount, 0)
    });
  }

  // Create POs for each vendor group
  const createdPOs = [];

  for (const group of Object.values(itemsByVendor)) {
    // Get job for PO number generation
    let jobData = null;
    if (job_id) {
      const { data } = await supabase
        .from('v2_jobs')
        .select('id, name')
        .eq('id', job_id)
        .single();
      jobData = data;
    }

    // Count existing POs for numbering
    let poNumber;
    if (jobData) {
      const { count } = await supabase
        .from('v2_purchase_orders')
        .select('*', { count: 'exact', head: true })
        .eq('job_id', job_id);
      poNumber = standards.generatePONumber(jobData.name, (count || 0) + createdPOs.length + 1);
    } else {
      poNumber = `AUTO-${Date.now().toString(36).toUpperCase()}`;
    }

    // Calculate total
    const totalAmount = group.items.reduce((sum, item) =>
      sum + (item.unit_price ? item.quantity * item.unit_price : 0), 0);

    // Create PO
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .insert({
        builder_id: builderId,
        job_id: job_id || null,
        vendor_id: group.vendor_id,
        po_number: poNumber,
        description: `Auto-generated restock order for ${group.items.length} item(s)`,
        total_amount: totalAmount,
        original_amount: totalAmount,
        status: 'open',
        status_detail: 'pending',
        approval_status: 'pending',
        notes: `Generated by auto-PO system at ${new Date().toISOString()}`
      })
      .select()
      .single();

    if (poError) {
      logger.error('Failed to create auto-PO', { component: 'Inventory', vendorId: group.vendor_id, error: poError.message });
      continue;
    }

    // Create line items
    const lineItems = group.items.map(item => ({
      po_id: po.id,
      description: `${item.item_name}${item.sku ? ` (${item.sku})` : ''} - Restock`,
      amount: item.unit_price ? item.quantity * item.unit_price : 0,
      cost_code_id: item.cost_code_id
    }));

    const { error: liError } = await supabase
      .from('v2_po_line_items')
      .insert(lineItems);

    if (liError) {
      logger.error('Failed to create auto-PO line items', { component: 'Inventory', poId: po.id, error: liError.message });
    }

    // Track in auto-PO queue
    await supabase
      .from('v2_auto_po_queue')
      .insert({
        builder_id: builderId,
        vendor_id: group.vendor_id,
        po_id: po.id,
        status: 'created',
        items: group.items,
        total_amount: totalAmount
      });

    createdPOs.push({
      po_id: po.id,
      po_number: po.po_number,
      vendor_id: group.vendor_id,
      vendor_name: group.vendor_name,
      line_items_count: group.items.length,
      total_amount: totalAmount,
      items: group.items
    });

    logger.info('Auto-PO created', {
      component: 'Inventory',
      poId: po.id,
      poNumber: po.po_number,
      vendorId: group.vendor_id,
      itemCount: group.items.length,
      totalAmount
    });
  }

  res.json({
    success: true,
    pos_created: createdPOs.length,
    pos: createdPOs,
    total_amount: createdPOs.reduce((sum, po) => sum + po.total_amount, 0)
  });
}));

// ============================================================
// PRICE COMPARISON
// ============================================================

/**
 * Get all prices for an inventory item across vendors
 * GET /api/inventory/:id/prices
 */
router.get('/:id/prices', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity = 1 } = req.query;

  // Get item info
  const { data: item, error: itemError } = await supabase
    .from('v2_inventory_items')
    .select('id, name, sku, preferred_vendor_id')
    .eq('id', id)
    .single();

  if (itemError || !item) {
    throw new AppError('NOT_FOUND', 'Inventory item not found');
  }

  // Get all current prices for this item
  const today = new Date().toISOString().split('T')[0];
  const { data: prices, error } = await supabase
    .from('v2_vendor_prices')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone)
    `)
    .eq('item_id', id)
    .lte('effective_date', today)
    .or(`expires_at.is.null,expires_at.gt.${today}`)
    .lte('min_quantity', parseFloat(quantity))
    .order('unit_price', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const pricesWithTotals = (prices || []).map(price => ({
    ...price,
    is_preferred: price.vendor_id === item.preferred_vendor_id,
    total_price: parseFloat(price.unit_price) * parseFloat(quantity),
    vendor_name: price.vendor?.name
  }));

  const bestPrice = pricesWithTotals[0];
  const preferredVendorPrice = pricesWithTotals.find(p => p.is_preferred);

  res.json({
    item: {
      id: item.id,
      name: item.name,
      sku: item.sku
    },
    quantity: parseFloat(quantity),
    prices: pricesWithTotals,
    best_price: bestPrice ? {
      vendor_id: bestPrice.vendor_id,
      vendor_name: bestPrice.vendor_name,
      unit_price: parseFloat(bestPrice.unit_price),
      total_price: bestPrice.total_price,
      lead_days: bestPrice.lead_days
    } : null,
    preferred_vendor_price: preferredVendorPrice ? {
      vendor_id: preferredVendorPrice.vendor_id,
      vendor_name: preferredVendorPrice.vendor_name,
      unit_price: parseFloat(preferredVendorPrice.unit_price),
      total_price: preferredVendorPrice.total_price,
      lead_days: preferredVendorPrice.lead_days,
      savings_vs_preferred: 0
    } : null,
    potential_savings: bestPrice && preferredVendorPrice && bestPrice.vendor_id !== preferredVendorPrice.vendor_id
      ? preferredVendorPrice.total_price - bestPrice.total_price
      : 0
  });
}));

// ============================================================
// VENDOR PRICES MANAGEMENT
// ============================================================

/**
 * Add or update vendor price for an item
 * POST /api/inventory/:id/prices
 */
router.post('/:id/prices', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vendor_id, unit_price, min_quantity = 1, sku, lead_days, effective_date, expires_at, notes } = req.body;

  if (!vendor_id || unit_price === undefined) {
    throw new AppError('VALIDATION_FAILED', 'vendor_id and unit_price are required');
  }

  // Verify item exists
  const { data: item, error: itemError } = await supabase
    .from('v2_inventory_items')
    .select('id')
    .eq('id', id)
    .single();

  if (itemError || !item) {
    throw new AppError('NOT_FOUND', 'Inventory item not found');
  }

  // Check for existing price at same min_quantity (update if exists)
  const { data: existing } = await supabase
    .from('v2_vendor_prices')
    .select('id')
    .eq('item_id', id)
    .eq('vendor_id', vendor_id)
    .eq('min_quantity', min_quantity)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString().split('T')[0]}`)
    .single();

  let result;
  if (existing) {
    // Update existing price
    const { data, error } = await supabase
      .from('v2_vendor_prices')
      .update({
        unit_price,
        sku,
        lead_days,
        effective_date: effective_date || new Date().toISOString().split('T')[0],
        expires_at,
        notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new AppError('DATABASE_ERROR', error.message);
    result = data;
  } else {
    // Insert new price
    const { data, error } = await supabase
      .from('v2_vendor_prices')
      .insert({
        item_id: id,
        vendor_id,
        unit_price,
        min_quantity,
        sku,
        lead_days,
        effective_date: effective_date || new Date().toISOString().split('T')[0],
        expires_at,
        notes
      })
      .select()
      .single();

    if (error) throw new AppError('DATABASE_ERROR', error.message);
    result = data;
  }

  logger.info('Vendor price updated', {
    component: 'Inventory',
    itemId: id,
    vendorId: vendor_id,
    unitPrice: unit_price
  });

  res.json(result);
}));

/**
 * Delete a vendor price
 * DELETE /api/inventory/:id/prices/:priceId
 */
router.delete('/:id/prices/:priceId', asyncHandler(async (req, res) => {
  const { id, priceId } = req.params;

  const { error } = await supabase
    .from('v2_vendor_prices')
    .delete()
    .eq('id', priceId)
    .eq('item_id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: 'Vendor price deleted' });
}));

// ============================================================
// INVENTORY STATISTICS
// ============================================================

/**
 * Get inventory statistics
 * GET /api/inventory/stats
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  let query = supabase.from('v2_inventory_items').select('id, current_quantity, reorder_point, category');
  if (builderId) query = query.eq('builder_id', builderId);

  const { data: items, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const allItems = items || [];
  const lowStockItems = allItems.filter(item =>
    parseFloat(item.current_quantity) <= parseFloat(item.reorder_point) && parseFloat(item.reorder_point) > 0
  );

  // Categories breakdown
  const categories = {};
  for (const item of allItems) {
    const cat = item.category || 'Uncategorized';
    if (!categories[cat]) {
      categories[cat] = { count: 0, low_stock: 0 };
    }
    categories[cat].count++;
    if (parseFloat(item.current_quantity) <= parseFloat(item.reorder_point) && parseFloat(item.reorder_point) > 0) {
      categories[cat].low_stock++;
    }
  }

  res.json({
    total_items: allItems.length,
    low_stock_count: lowStockItems.length,
    categories
  });
}));

// ============================================================
// BULK OPERATIONS
// ============================================================

/**
 * Bulk import inventory items
 * POST /api/inventory/bulk-import
 */
router.post('/bulk-import', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { items } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'items array is required');
  }

  const results = {
    success: 0,
    failed: 0,
    errors: []
  };

  for (const item of items) {
    try {
      const itemData = { ...item };
      if (builderId) itemData.builder_id = builderId;

      const { error } = await supabase
        .from('v2_inventory_items')
        .insert(itemData);

      if (error) throw error;
      results.success++;
    } catch (err) {
      results.failed++;
      results.errors.push({
        item: item.name || item.sku || 'Unknown',
        error: err.message
      });
    }
  }

  res.json({
    success: results.success > 0,
    imported: results.success,
    failed: results.failed,
    errors: results.errors.slice(0, 10)  // Limit error list
  });
}));

/**
 * Perform inventory count (bulk adjust)
 * POST /api/inventory/count
 */
router.post('/count', asyncHandler(async (req, res) => {
  const { items, counted_by = 'system' } = req.body;

  if (!items || !Array.isArray(items)) {
    throw new AppError('VALIDATION_FAILED', 'items array is required');
  }

  const results = {
    adjusted: 0,
    unchanged: 0,
    errors: []
  };

  for (const { item_id, counted_quantity } of items) {
    try {
      // Get current quantity
      const { data: item } = await supabase
        .from('v2_inventory_items')
        .select('id, name, current_quantity')
        .eq('id', item_id)
        .single();

      if (!item) {
        results.errors.push({ item_id, error: 'Item not found' });
        continue;
      }

      const currentQty = parseFloat(item.current_quantity);
      const newQty = parseFloat(counted_quantity);
      const difference = newQty - currentQty;

      if (Math.abs(difference) < 0.001) {
        results.unchanged++;
        continue;
      }

      // Create adjustment transaction
      await supabase
        .from('v2_inventory_transactions')
        .insert({
          item_id,
          transaction_type: 'adjusted',
          quantity: difference,
          notes: `Physical count adjustment. Counted: ${newQty}, Previous: ${currentQty}`,
          created_by: counted_by
        });

      // Update quantity and last count date
      await supabase
        .from('v2_inventory_items')
        .update({
          current_quantity: newQty,
          last_count_date: new Date().toISOString().split('T')[0],
          updated_at: new Date().toISOString()
        })
        .eq('id', item_id);

      results.adjusted++;
    } catch (err) {
      results.errors.push({ item_id, error: err.message });
    }
  }

  res.json({
    success: true,
    adjusted: results.adjusted,
    unchanged: results.unchanged,
    errors: results.errors
  });
}));

module.exports = router;
