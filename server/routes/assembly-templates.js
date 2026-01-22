/**
 * Assembly Templates Routes
 * CRUD operations for reusable assembly templates and their line items
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// CATEGORIES (must be before /:id)
// ============================================================

// Get distinct categories for filter dropdown
router.get('/categories', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_assembly_templates')
    .select('category')
    .not('category', 'is', null)
    .eq('is_active', true);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Extract unique categories
  const categories = [...new Set((data || []).map(d => d.category).filter(Boolean))].sort();

  res.json(categories);
}));

// ============================================================
// LIST TEMPLATES
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { category, is_active, search } = req.query;

  let query = supabase
    .from('v2_assembly_templates')
    .select('*')
    .order('name', { ascending: true });

  // Apply filters
  if (category) {
    query = query.eq('category', category);
  }

  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true');
  }

  if (search) {
    query = query.ilike('name', `%${search}%`);
  }

  const { data: templates, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get item counts for each template
  const templateIds = (templates || []).map(t => t.id);
  let itemCounts = {};
  let totalAmounts = {};

  if (templateIds.length > 0) {
    const { data: items } = await supabase
      .from('v2_assembly_template_items')
      .select('template_id, quantity, unit_cost')
      .in('template_id', templateIds);

    // Calculate counts and totals
    for (const item of (items || [])) {
      itemCounts[item.template_id] = (itemCounts[item.template_id] || 0) + 1;
      const amount = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0);
      totalAmounts[item.template_id] = (totalAmounts[item.template_id] || 0) + amount;
    }
  }

  // Enrich templates with computed fields
  const result = (templates || []).map(t => ({
    ...t,
    item_count: itemCounts[t.id] || 0,
    total_amount: totalAmounts[t.id] || 0
  }));

  res.json(result);
}));

// ============================================================
// GET SINGLE TEMPLATE WITH ITEMS
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get template
  const { data: template, error } = await supabase
    .from('v2_assembly_templates')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !template) throw new AppError('NOT_FOUND', 'Template not found');

  // Get items with cost codes
  const { data: items } = await supabase
    .from('v2_assembly_template_items')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('template_id', id)
    .order('sort_order', { ascending: true });

  // Calculate total amount
  const totalAmount = (items || []).reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_cost) || 0);
  }, 0);

  res.json({
    ...template,
    items: items || [],
    item_count: (items || []).length,
    total_amount: totalAmount
  });
}));

// ============================================================
// CREATE TEMPLATE
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const { name, description, category, is_active, created_by } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Template name is required');
  }

  const { data: template, error } = await supabase
    .from('v2_assembly_templates')
    .insert({
      name: name.trim(),
      description: description || null,
      category: category || null,
      is_active: is_active !== false,
      created_by: created_by || 'System'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.status(201).json({
    ...template,
    item_count: 0,
    total_amount: 0
  });
}));

// ============================================================
// UPDATE TEMPLATE
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, category, is_active } = req.body;

  const updates = { updated_at: new Date().toISOString() };

  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data: template, error } = await supabase
    .from('v2_assembly_templates')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!template) throw new AppError('NOT_FOUND', 'Template not found');

  res.json(template);
}));

// ============================================================
// DELETE TEMPLATE (soft delete - set is_active = false)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Soft delete - set is_active to false
  const { data: template, error } = await supabase
    .from('v2_assembly_templates')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!template) throw new AppError('NOT_FOUND', 'Template not found');

  res.json({ success: true, message: 'Template deactivated' });
}));

// ============================================================
// TEMPLATE ITEMS - ADD
// ============================================================

router.post('/:id/items', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cost_code_id, description, quantity, unit, unit_cost } = req.body;

  // Verify template exists
  const { data: template, error: templateError } = await supabase
    .from('v2_assembly_templates')
    .select('id')
    .eq('id', id)
    .single();

  if (templateError || !template) throw new AppError('NOT_FOUND', 'Template not found');

  // Get max sort_order
  const { data: maxOrder } = await supabase
    .from('v2_assembly_template_items')
    .select('sort_order')
    .eq('template_id', id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const sortOrder = (maxOrder?.[0]?.sort_order || 0) + 1;

  const { data: item, error } = await supabase
    .from('v2_assembly_template_items')
    .insert({
      template_id: id,
      cost_code_id: cost_code_id || null,
      description: description || 'New Item',
      quantity: parseFloat(quantity) || 1,
      unit: unit || 'ea',
      unit_cost: parseFloat(unit_cost) || 0,
      sort_order: sortOrder
    })
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.status(201).json(item);
}));

// ============================================================
// TEMPLATE ITEMS - UPDATE
// ============================================================

router.patch('/:id/items/:itemId', asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;
  const { cost_code_id, description, quantity, unit, unit_cost, sort_order } = req.body;

  const updates = {};

  if (cost_code_id !== undefined) updates.cost_code_id = cost_code_id || null;
  if (description !== undefined) updates.description = description;
  if (quantity !== undefined) updates.quantity = parseFloat(quantity) || 1;
  if (unit !== undefined) updates.unit = unit;
  if (unit_cost !== undefined) updates.unit_cost = parseFloat(unit_cost) || 0;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data: item, error } = await supabase
    .from('v2_assembly_template_items')
    .update(updates)
    .eq('id', itemId)
    .eq('template_id', id)
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!item) throw new AppError('NOT_FOUND', 'Item not found');

  res.json(item);
}));

// ============================================================
// TEMPLATE ITEMS - DELETE
// ============================================================

router.delete('/:id/items/:itemId', asyncHandler(async (req, res) => {
  const { id, itemId } = req.params;

  const { data: item, error } = await supabase
    .from('v2_assembly_template_items')
    .delete()
    .eq('id', itemId)
    .eq('template_id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!item) throw new AppError('NOT_FOUND', 'Item not found');

  res.json({ success: true, message: 'Item removed' });
}));

// ============================================================
// TEMPLATE ITEMS - REORDER
// ============================================================

router.post('/:id/items/reorder', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { item_ids } = req.body;

  if (!Array.isArray(item_ids)) {
    throw new AppError('VALIDATION_ERROR', 'item_ids must be an array');
  }

  // Update sort_order for each item
  for (let i = 0; i < item_ids.length; i++) {
    await supabase
      .from('v2_assembly_template_items')
      .update({ sort_order: i + 1 })
      .eq('id', item_ids[i])
      .eq('template_id', id);
  }

  res.json({ success: true, message: 'Items reordered' });
}));

module.exports = router;
