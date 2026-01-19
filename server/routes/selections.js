/**
 * Selections/Allowances API Routes
 * Manages selection categories, allowances, catalog items, and client selections
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// SELECTION CATEGORIES
// ============================================================

/**
 * GET /api/selections/categories
 * List all active selection categories
 */
router.get('/categories', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_selection_categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) throw error;
  res.json(data);
}));

/**
 * POST /api/selections/categories
 * Create a new selection category
 */
router.post('/categories', asyncHandler(async (req, res) => {
  const { name, description, icon, display_order } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Category name is required' });
  }

  const { data, error } = await supabase
    .from('v2_selection_categories')
    .insert({
      name,
      description,
      icon,
      display_order: display_order || 50
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/selections/categories/:id
 * Update a category
 */
router.patch('/categories/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const { data, error } = await supabase
    .from('v2_selection_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Category not found' });
  }
  res.json(data);
}));

// ============================================================
// ALLOWANCES
// ============================================================

/**
 * GET /api/selections/allowances
 * List allowances with optional filters
 * Query params: job_id, category_id, status
 */
router.get('/allowances', asyncHandler(async (req, res) => {
  const { job_id, category_id, status } = req.query;

  let query = supabase
    .from('v2_allowances')
    .select(`
      *,
      job:v2_jobs(id, name),
      category:v2_selection_categories(id, name, icon)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (category_id) query = query.eq('category_id', category_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/selections/allowances/:id
 * Get a single allowance with its selections
 */
router.get('/allowances/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get allowance
  const { data: allowance, error: allowanceError } = await supabase
    .from('v2_allowances')
    .select(`
      *,
      job:v2_jobs(id, name),
      category:v2_selection_categories(id, name, icon)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (allowanceError) throw allowanceError;
  if (!allowance) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  // Get selections for this allowance
  const { data: selections, error: selectionsError } = await supabase
    .from('v2_selections')
    .select(`
      *,
      catalog_item:v2_selection_catalog(id, name, image_url)
    `)
    .eq('allowance_id', id)
    .is('deleted_at', null)
    .order('created_at');

  if (selectionsError) throw selectionsError;

  res.json({
    ...allowance,
    selections: selections || []
  });
}));

/**
 * POST /api/selections/allowances
 * Create a new allowance
 */
router.post('/allowances', asyncHandler(async (req, res) => {
  const {
    job_id,
    category_id,
    name,
    description,
    budgeted_amount,
    allowance_type,
    deadline,
    deadline_notes,
    notes
  } = req.body;

  // Validation
  if (!job_id || !category_id || !name) {
    return res.status(400).json({
      error: 'Job, category, and name are required'
    });
  }

  const { data, error } = await supabase
    .from('v2_allowances')
    .insert({
      job_id,
      category_id,
      name,
      description,
      budgeted_amount: budgeted_amount || 0,
      allowance_type: allowance_type || 'material_only',
      deadline,
      deadline_notes,
      notes
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      category:v2_selection_categories(id, name, icon)
    `)
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({
        error: 'An allowance with this name already exists for this job and category'
      });
    }
    throw error;
  }

  res.status(201).json(data);
}));

/**
 * PATCH /api/selections/allowances/:id
 * Update an allowance
 */
router.patch('/allowances/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove fields that shouldn't be directly updated
  delete updates.id;
  delete updates.created_at;
  delete updates.selected_amount;
  delete updates.variance;

  const { data, error } = await supabase
    .from('v2_allowances')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name),
      category:v2_selection_categories(id, name, icon)
    `)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/selections/allowances/:id
 * Soft delete an allowance
 */
router.delete('/allowances/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_allowances')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  res.json({ success: true, message: 'Allowance deleted' });
}));

/**
 * GET /api/selections/allowances/job/:jobId/summary
 * Get allowance summary for a job (totals, variance)
 */
router.get('/allowances/job/:jobId/summary', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await supabase
    .from('v2_allowances')
    .select('budgeted_amount, selected_amount, variance, status')
    .eq('job_id', jobId)
    .is('deleted_at', null);

  if (error) throw error;

  const summary = {
    total_budgeted: 0,
    total_selected: 0,
    total_variance: 0,
    count_pending: 0,
    count_in_progress: 0,
    count_complete: 0
  };

  (data || []).forEach(a => {
    summary.total_budgeted += parseFloat(a.budgeted_amount) || 0;
    summary.total_selected += parseFloat(a.selected_amount) || 0;
    summary.total_variance += parseFloat(a.variance) || 0;
    if (a.status === 'pending') summary.count_pending++;
    else if (a.status === 'in_progress') summary.count_in_progress++;
    else if (a.status === 'complete') summary.count_complete++;
  });

  res.json(summary);
}));

// ============================================================
// SELECTION CATALOG
// ============================================================

/**
 * GET /api/selections/catalog
 * List catalog items with optional filters
 * Query params: category_id, vendor_id, search
 */
router.get('/catalog', asyncHandler(async (req, res) => {
  const { category_id, vendor_id, search } = req.query;

  let query = supabase
    .from('v2_selection_catalog')
    .select(`
      *,
      category:v2_selection_categories(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('is_active', true)
    .order('name');

  if (category_id) query = query.eq('category_id', category_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (search) query = query.ilike('name', `%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/selections/catalog/:id
 * Get a single catalog item
 */
router.get('/catalog/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_selection_catalog')
    .select(`
      *,
      category:v2_selection_categories(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Catalog item not found' });
  }
  res.json(data);
}));

/**
 * POST /api/selections/catalog
 * Add item to catalog
 */
router.post('/catalog', asyncHandler(async (req, res) => {
  const {
    category_id,
    vendor_id,
    name,
    description,
    model_number,
    sku,
    unit_price,
    unit,
    image_url,
    spec_sheet_url
  } = req.body;

  if (!category_id || !name) {
    return res.status(400).json({ error: 'Category and name are required' });
  }

  const { data, error } = await supabase
    .from('v2_selection_catalog')
    .insert({
      category_id,
      vendor_id,
      name,
      description,
      model_number,
      sku,
      unit_price,
      unit: unit || 'each',
      image_url,
      spec_sheet_url
    })
    .select(`
      *,
      category:v2_selection_categories(id, name),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/selections/catalog/:id
 * Update a catalog item
 */
router.patch('/catalog/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('v2_selection_catalog')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      category:v2_selection_categories(id, name),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Catalog item not found' });
  }
  res.json(data);
}));

/**
 * DELETE /api/selections/catalog/:id
 * Deactivate a catalog item
 */
router.delete('/catalog/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_selection_catalog')
    .update({ is_active: false })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Catalog item not found' });
  }

  res.json({ success: true, message: 'Catalog item deactivated' });
}));

// ============================================================
// SELECTIONS (Client choices)
// ============================================================

/**
 * GET /api/selections/items
 * List selections with optional filters
 * Query params: allowance_id, status
 */
router.get('/items', asyncHandler(async (req, res) => {
  const { allowance_id, status } = req.query;

  let query = supabase
    .from('v2_selections')
    .select(`
      *,
      allowance:v2_allowances(id, name, job_id),
      catalog_item:v2_selection_catalog(id, name, image_url)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (allowance_id) query = query.eq('allowance_id', allowance_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/selections/items/:id
 * Get a single selection with history
 */
router.get('/items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get selection
  const { data: selection, error: selectionError } = await supabase
    .from('v2_selections')
    .select(`
      *,
      allowance:v2_allowances(id, name, job_id, budgeted_amount),
      catalog_item:v2_selection_catalog(id, name, image_url)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (selectionError) throw selectionError;
  if (!selection) {
    return res.status(404).json({ error: 'Selection not found' });
  }

  // Get status history
  const { data: history, error: historyError } = await supabase
    .from('v2_selection_status_history')
    .select('*')
    .eq('selection_id', id)
    .order('changed_at', { ascending: false });

  if (historyError) throw historyError;

  res.json({
    ...selection,
    status_history: history || []
  });
}));

/**
 * POST /api/selections/items
 * Create a new selection
 */
router.post('/items', asyncHandler(async (req, res) => {
  const {
    allowance_id,
    catalog_item_id,
    name,
    description,
    model_number,
    vendor_name,
    quantity,
    unit,
    unit_price,
    markup_percent,
    image_url,
    client_notes,
    internal_notes
  } = req.body;

  // Validation
  if (!allowance_id || !name || unit_price === undefined) {
    return res.status(400).json({
      error: 'Allowance, name, and unit price are required'
    });
  }

  // Calculate prices
  const qty = parseFloat(quantity) || 1;
  const price = parseFloat(unit_price) || 0;
  const total_price = qty * price;
  const markup = parseFloat(markup_percent) || 0;
  const markup_amount = total_price * (markup / 100);
  const final_price = total_price + markup_amount;

  const { data, error } = await supabase
    .from('v2_selections')
    .insert({
      allowance_id,
      catalog_item_id,
      name,
      description,
      model_number,
      vendor_name,
      quantity: qty,
      unit: unit || 'each',
      unit_price: price,
      total_price,
      markup_percent: markup,
      markup_amount,
      final_price,
      image_url,
      client_notes,
      internal_notes
    })
    .select(`
      *,
      allowance:v2_allowances(id, name, job_id)
    `)
    .single();

  if (error) throw error;

  // Record initial status
  await supabase.from('v2_selection_status_history').insert({
    selection_id: data.id,
    to_status: 'pending',
    notes: 'Selection created'
  });

  res.status(201).json(data);
}));

/**
 * PATCH /api/selections/items/:id
 * Update a selection
 */
router.patch('/items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove protected fields
  delete updates.id;
  delete updates.created_at;
  delete updates.allowance_id;

  // Recalculate prices if needed
  if (updates.quantity !== undefined || updates.unit_price !== undefined || updates.markup_percent !== undefined) {
    // Get current values
    const { data: current } = await supabase
      .from('v2_selections')
      .select('quantity, unit_price, markup_percent')
      .eq('id', id)
      .single();

    const qty = updates.quantity !== undefined ? parseFloat(updates.quantity) : parseFloat(current.quantity);
    const price = updates.unit_price !== undefined ? parseFloat(updates.unit_price) : parseFloat(current.unit_price);
    const markup = updates.markup_percent !== undefined ? parseFloat(updates.markup_percent) : parseFloat(current.markup_percent) || 0;

    updates.quantity = qty;
    updates.unit_price = price;
    updates.total_price = qty * price;
    updates.markup_percent = markup;
    updates.markup_amount = updates.total_price * (markup / 100);
    updates.final_price = updates.total_price + updates.markup_amount;
  }

  const { data, error } = await supabase
    .from('v2_selections')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      allowance:v2_allowances(id, name, job_id)
    `)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Selection not found' });
  }

  res.json(data);
}));

/**
 * POST /api/selections/items/:id/status
 * Change selection status
 */
router.post('/items/:id/status', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes, changed_by } = req.body;

  const validStatuses = ['pending', 'selected', 'approved', 'ordered', 'installed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  // Get current selection
  const { data: current, error: fetchError } = await supabase
    .from('v2_selections')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError) throw fetchError;
  if (!current) {
    return res.status(404).json({ error: 'Selection not found' });
  }

  const oldStatus = current.status;

  // Build update object with timestamps
  const update = { status };
  const now = new Date().toISOString();

  if (status === 'selected' && !current.selected_at) {
    update.selected_at = now;
    update.selected_by = changed_by;
  } else if (status === 'approved' && !current.approved_at) {
    update.approved_at = now;
    update.approved_by = changed_by;
  } else if (status === 'ordered' && !current.ordered_at) {
    update.ordered_at = now;
  } else if (status === 'installed' && !current.installed_at) {
    update.installed_at = now;
  }

  // Update selection
  const { data, error } = await supabase
    .from('v2_selections')
    .update(update)
    .eq('id', id)
    .select(`
      *,
      allowance:v2_allowances(id, name, job_id)
    `)
    .single();

  if (error) throw error;

  // Record status change
  await supabase.from('v2_selection_status_history').insert({
    selection_id: id,
    from_status: oldStatus,
    to_status: status,
    changed_by,
    notes
  });

  res.json(data);
}));

/**
 * DELETE /api/selections/items/:id
 * Soft delete a selection
 */
router.delete('/items/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_selections')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Selection not found' });
  }

  res.json({ success: true, message: 'Selection deleted' });
}));

/**
 * POST /api/selections/items/:id/create-co
 * Create change order from selection overage
 */
router.post('/items/:id/create-co', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { markup_percent, description, created_by } = req.body;

  // Get selection with allowance
  const { data: selection, error: selectionError } = await supabase
    .from('v2_selections')
    .select(`
      *,
      allowance:v2_allowances(id, name, job_id, budgeted_amount, category:v2_selection_categories(name))
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (selectionError) throw selectionError;
  if (!selection) {
    return res.status(404).json({ error: 'Selection not found' });
  }

  // Calculate overage
  const budget = parseFloat(selection.allowance.budgeted_amount) || 0;
  const selected = parseFloat(selection.final_price) || 0;
  const overage = selected - budget;

  if (overage <= 0) {
    return res.status(400).json({
      error: 'No overage to create change order. Selection is within budget.'
    });
  }

  // Apply markup
  const markup = parseFloat(markup_percent) || 0;
  const coAmount = overage * (1 + markup / 100);

  // Find associated PO for the job (if any)
  const { data: pos } = await supabase
    .from('v2_purchase_orders')
    .select('id')
    .eq('job_id', selection.allowance.job_id)
    .is('deleted_at', null)
    .limit(1);

  const poId = pos && pos.length > 0 ? pos[0].id : null;

  if (!poId) {
    return res.status(400).json({
      error: 'No purchase order found for this job. Create a PO first.'
    });
  }

  // Create change order
  const { data: co, error: coError } = await supabase
    .from('v2_change_orders')
    .insert({
      po_id: poId,
      co_number: `CO-SEL-${Date.now().toString(36).toUpperCase()}`,
      title: `${selection.allowance.category?.name || 'Selection'} Upgrade - ${selection.name}`,
      description: description || `Allowance overage for ${selection.allowance.name}: ${selection.name}`,
      amount: coAmount,
      status: 'pending',
      reason: 'client_upgrade',
      created_by
    })
    .select()
    .single();

  if (coError) throw coError;

  // Link CO to selection
  await supabase
    .from('v2_selections')
    .update({ change_order_id: co.id })
    .eq('id', id);

  res.status(201).json({
    change_order: co,
    overage,
    markup_applied: markup,
    final_amount: coAmount
  });
}));

// ============================================================
// STATISTICS
// ============================================================

/**
 * GET /api/selections/stats
 * Get selection statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  // Get allowances
  let allowanceQuery = supabase
    .from('v2_allowances')
    .select('budgeted_amount, selected_amount, variance, status')
    .is('deleted_at', null);

  if (job_id) allowanceQuery = allowanceQuery.eq('job_id', job_id);

  const { data: allowances, error: allowanceError } = await allowanceQuery;
  if (allowanceError) throw allowanceError;

  // Get selections
  let selectionQuery = supabase
    .from('v2_selections')
    .select('status, final_price')
    .is('deleted_at', null);

  if (job_id) {
    // Need to join through allowance
    selectionQuery = supabase
      .from('v2_selections')
      .select('status, final_price, allowance:v2_allowances!inner(job_id)')
      .is('deleted_at', null)
      .eq('allowance.job_id', job_id);
  }

  const { data: selections, error: selectionError } = await selectionQuery;
  if (selectionError) throw selectionError;

  // Calculate stats
  const stats = {
    allowances: {
      total: allowances?.length || 0,
      pending: 0,
      in_progress: 0,
      complete: 0,
      total_budgeted: 0,
      total_selected: 0,
      total_variance: 0
    },
    selections: {
      total: selections?.length || 0,
      pending: 0,
      selected: 0,
      approved: 0,
      ordered: 0,
      installed: 0,
      total_value: 0
    }
  };

  (allowances || []).forEach(a => {
    stats.allowances[a.status]++;
    stats.allowances.total_budgeted += parseFloat(a.budgeted_amount) || 0;
    stats.allowances.total_selected += parseFloat(a.selected_amount) || 0;
    stats.allowances.total_variance += parseFloat(a.variance) || 0;
  });

  (selections || []).forEach(s => {
    stats.selections[s.status]++;
    stats.selections.total_value += parseFloat(s.final_price) || 0;
  });

  res.json(stats);
}));

module.exports = router;
