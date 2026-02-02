/**
 * Estimate Assemblies Routes
 * Assembly-based estimating with reusable component packages
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============================================================
// HELPER: Calculate assembly totals from components
// ============================================================

function calculateAssemblyTotals(components) {
  const parsed = Array.isArray(components) ? components : [];
  let laborCost = 0;
  let materialCost = 0;

  for (const comp of parsed) {
    const cost = parseFloat(comp.unit_cost || 0);
    const qty = parseFloat(comp.quantity_formula || 1);
    const amount = cost * qty;

    if (comp.is_labor) {
      laborCost += amount;
    } else {
      materialCost += amount;
    }
  }

  return {
    labor_cost: laborCost,
    material_cost: materialCost,
    base_cost: laborCost + materialCost
  };
}

// ============================================================
// STATS (must be before /:id)
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { category } = req.query;

  let query = supabase
    .from('v2_estimate_assemblies')
    .select('id, category, base_cost, usage_count, is_active');

  if (category) {
    query = query.eq('category', category);
  }

  const { data: assemblies, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total: assemblies.length,
    active: 0,
    inactive: 0,
    by_category: {},
    total_usage: 0,
    avg_base_cost: 0
  };

  let totalCost = 0;
  for (const a of assemblies) {
    if (a.is_active) stats.active++;
    else stats.inactive++;

    stats.by_category[a.category || 'Uncategorized'] =
      (stats.by_category[a.category || 'Uncategorized'] || 0) + 1;

    stats.total_usage += a.usage_count || 0;
    totalCost += parseFloat(a.base_cost || 0);
  }

  stats.avg_base_cost = assemblies.length > 0 ? totalCost / assemblies.length : 0;

  res.json(stats);
}));

// ============================================================
// CATEGORIES (must be before /:id)
// ============================================================

router.get('/categories', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_estimate_assemblies')
    .select('category')
    .not('category', 'is', null)
    .eq('is_active', true);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const categories = [...new Set((data || []).map(d => d.category).filter(Boolean))].sort();

  res.json(categories);
}));

// ============================================================
// LIST ASSEMBLIES
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { category, unit_type, is_active, search, tag } = req.query;

  let query = supabase
    .from('v2_estimate_assemblies')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  // Apply filters
  if (category) {
    query = query.eq('category', category);
  }

  if (unit_type) {
    query = query.eq('unit_type', unit_type);
  }

  if (is_active !== undefined) {
    query = query.eq('is_active', is_active === 'true');
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (tag) {
    query = query.contains('tags', [tag]);
  }

  const { data: assemblies, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Add component counts
  const result = (assemblies || []).map(a => {
    const components = Array.isArray(a.components) ? a.components : [];
    return {
      ...a,
      component_count: components.length
    };
  });

  res.json(result);
}));

// ============================================================
// GET SINGLE ASSEMBLY WITH COMPONENTS
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: assembly, error } = await supabase
    .from('v2_estimate_assemblies')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !assembly) throw new AppError('NOT_FOUND', 'Assembly not found');

  // Parse components and add cost codes if referenced
  const components = Array.isArray(assembly.components) ? assembly.components : [];
  const costCodeIds = components
    .map(c => c.cost_code_id)
    .filter(Boolean);

  let costCodes = {};
  if (costCodeIds.length > 0) {
    const { data: codes } = await supabase
      .from('v2_cost_codes')
      .select('id, code, name, category')
      .in('id', costCodeIds);

    for (const cc of (codes || [])) {
      costCodes[cc.id] = cc;
    }
  }

  // Enrich components with cost code details
  const enrichedComponents = components.map(c => ({
    ...c,
    cost_code: c.cost_code_id ? costCodes[c.cost_code_id] : null
  }));

  res.json({
    ...assembly,
    components: enrichedComponents,
    component_count: components.length
  });
}));

// ============================================================
// CREATE ASSEMBLY
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    unit_type,
    components,
    tags,
    created_by
  } = req.body;

  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Assembly name is required');
  }

  // Calculate totals from components
  const totals = calculateAssemblyTotals(components || []);

  const { data: assembly, error } = await supabase
    .from('v2_estimate_assemblies')
    .insert({
      name: name.trim(),
      description: description || null,
      category: category || null,
      unit_type: unit_type || 'each',
      base_cost: totals.base_cost,
      labor_cost: totals.labor_cost,
      material_cost: totals.material_cost,
      components: components || [],
      tags: tags || [],
      is_active: true,
      created_by: created_by || 'System'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.status(201).json({
    ...assembly,
    component_count: (components || []).length
  });
}));

// ============================================================
// UPDATE ASSEMBLY
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    category,
    unit_type,
    components,
    tags,
    is_active
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };

  if (name !== undefined) updates.name = name.trim();
  if (description !== undefined) updates.description = description;
  if (category !== undefined) updates.category = category;
  if (unit_type !== undefined) updates.unit_type = unit_type;
  if (tags !== undefined) updates.tags = tags;
  if (is_active !== undefined) updates.is_active = is_active;

  // If components changed, recalculate totals
  if (components !== undefined) {
    updates.components = components;
    const totals = calculateAssemblyTotals(components);
    updates.base_cost = totals.base_cost;
    updates.labor_cost = totals.labor_cost;
    updates.material_cost = totals.material_cost;
  }

  const { data: assembly, error } = await supabase
    .from('v2_estimate_assemblies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!assembly) throw new AppError('NOT_FOUND', 'Assembly not found');

  res.json({
    ...assembly,
    component_count: (assembly.components || []).length
  });
}));

// ============================================================
// DELETE ASSEMBLY (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Soft delete by setting is_active to false
  const { data: assembly, error } = await supabase
    .from('v2_estimate_assemblies')
    .update({
      is_active: false,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!assembly) throw new AppError('NOT_FOUND', 'Assembly not found');

  res.json({ success: true, message: 'Assembly deactivated' });
}));

// ============================================================
// APPLY ASSEMBLY TO ESTIMATE
// ============================================================

router.post('/:id/apply', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    estimate_id,
    quantity,
    cost_multiplier,
    notes,
    applied_by
  } = req.body;

  if (!estimate_id) {
    throw new AppError('VALIDATION_ERROR', 'estimate_id is required');
  }

  // Get the assembly
  const { data: assembly, error: assemblyError } = await supabase
    .from('v2_estimate_assemblies')
    .select('*')
    .eq('id', id)
    .single();

  if (assemblyError || !assembly) {
    throw new AppError('NOT_FOUND', 'Assembly not found');
  }

  // Verify estimate exists
  const { data: estimate, error: estimateError } = await supabase
    .from('v2_estimates')
    .select('id, status')
    .eq('id', estimate_id)
    .is('deleted_at', null)
    .single();

  if (estimateError || !estimate) {
    throw new AppError('NOT_FOUND', 'Estimate not found');
  }

  if (estimate.status !== 'draft') {
    throw new AppError('VALIDATION_ERROR', 'Can only apply assemblies to draft estimates');
  }

  const qty = parseFloat(quantity) || 1;
  const multiplier = parseFloat(cost_multiplier) || 1;
  const components = Array.isArray(assembly.components) ? assembly.components : [];

  // Get the max sort_order for existing lines
  const { data: maxSort } = await supabase
    .from('v2_estimate_lines')
    .select('sort_order')
    .eq('estimate_id', estimate_id)
    .order('sort_order', { ascending: false })
    .limit(1);

  let sortOrder = (maxSort?.[0]?.sort_order || 0) + 1;

  // Create estimate lines from assembly components
  const linesToInsert = [];
  const generatedLineIds = [];

  for (const comp of components) {
    const compQty = parseFloat(comp.quantity_formula || 1) * qty;
    const unitCost = parseFloat(comp.unit_cost || 0) * multiplier;
    const amount = compQty * unitCost;

    linesToInsert.push({
      estimate_id: estimate_id,
      cost_code_id: comp.cost_code_id || null,
      description: `[${assembly.name}] ${comp.description || 'Component'}`,
      quantity: compQty,
      unit: assembly.unit_type,
      unit_cost: unitCost,
      amount: amount,
      notes: notes || `Applied from assembly: ${assembly.name}`,
      sort_order: sortOrder++
    });
  }

  // Insert all lines
  if (linesToInsert.length > 0) {
    const { data: insertedLines, error: insertError } = await supabase
      .from('v2_estimate_lines')
      .insert(linesToInsert)
      .select('id');

    if (insertError) {
      throw new AppError('DATABASE_ERROR', insertError.message);
    }

    for (const line of (insertedLines || [])) {
      generatedLineIds.push(line.id);
    }
  }

  // Record the application
  const { data: application, error: appError } = await supabase
    .from('v2_estimate_assembly_applications')
    .insert({
      estimate_id: estimate_id,
      assembly_id: id,
      quantity: qty,
      cost_multiplier: multiplier,
      notes: notes || null,
      applied_by: applied_by || 'System',
      generated_line_ids: generatedLineIds
    })
    .select()
    .single();

  if (appError) {
    throw new AppError('DATABASE_ERROR', appError.message);
  }

  // Increment usage count
  await supabase
    .from('v2_estimate_assemblies')
    .update({
      usage_count: (assembly.usage_count || 0) + 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', id);

  // Update estimate total
  const { data: lines } = await supabase
    .from('v2_estimate_lines')
    .select('amount')
    .eq('estimate_id', estimate_id);

  const total = (lines || []).reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

  await supabase
    .from('v2_estimates')
    .update({
      total_amount: total,
      updated_at: new Date().toISOString()
    })
    .eq('id', estimate_id);

  res.status(201).json({
    success: true,
    message: `Applied ${assembly.name} (${linesToInsert.length} lines created)`,
    application_id: application.id,
    lines_created: linesToInsert.length,
    generated_line_ids: generatedLineIds,
    new_estimate_total: total
  });
}));

// ============================================================
// DUPLICATE ASSEMBLY
// ============================================================

router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, created_by } = req.body;

  // Get original assembly
  const { data: original, error: fetchError } = await supabase
    .from('v2_estimate_assemblies')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !original) {
    throw new AppError('NOT_FOUND', 'Assembly not found');
  }

  // Create duplicate
  const { data: duplicate, error: insertError } = await supabase
    .from('v2_estimate_assemblies')
    .insert({
      name: name || `${original.name} (Copy)`,
      description: original.description,
      category: original.category,
      unit_type: original.unit_type,
      base_cost: original.base_cost,
      labor_cost: original.labor_cost,
      material_cost: original.material_cost,
      components: original.components,
      tags: original.tags,
      is_active: true,
      usage_count: 0,
      created_by: created_by || 'System'
    })
    .select()
    .single();

  if (insertError) {
    throw new AppError('DATABASE_ERROR', insertError.message);
  }

  res.status(201).json({
    ...duplicate,
    component_count: (duplicate.components || []).length
  });
}));

// ============================================================
// GET APPLICATIONS FOR AN ESTIMATE
// ============================================================

router.get('/applications/by-estimate/:estimateId', asyncHandler(async (req, res) => {
  const { estimateId } = req.params;

  const { data: applications, error } = await supabase
    .from('v2_estimate_assembly_applications')
    .select(`
      *,
      assembly:v2_estimate_assemblies(id, name, category, unit_type, base_cost)
    `)
    .eq('estimate_id', estimateId)
    .order('applied_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(applications || []);
}));

module.exports = router;
