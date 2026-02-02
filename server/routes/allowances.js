/**
 * Allowances API Routes
 * Manages construction allowances and owner selections
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// ALLOWANCES
// ============================================================

/**
 * GET /api/allowances
 * List allowances with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, category, over_budget } = req.query;

  let query = supabase
    .from('v2_allowances')
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);

  // Note: over_budget filter needs to be done post-query since variance is calculated

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/allowances/stats
 * Get allowance statistics for a job
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id is required' });
  }

  const { data, error } = await supabase
    .from('v2_allowances')
    .select('status, budgeted_amount, spent_amount, category')
    .eq('job_id', job_id)
    .is('deleted_at', null);

  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    total_budgeted: 0,
    total_spent: 0,
    total_variance: 0,
    by_status: {},
    by_category: {},
    over_budget_count: 0
  };

  (data || []).forEach(a => {
    const budgeted = parseFloat(a.budgeted_amount) || 0;
    const spent = parseFloat(a.spent_amount) || 0;
    const variance = budgeted - spent;

    stats.total_budgeted += budgeted;
    stats.total_spent += spent;
    stats.total_variance += variance;

    if (!stats.by_status[a.status]) stats.by_status[a.status] = 0;
    stats.by_status[a.status]++;

    if (a.category) {
      if (!stats.by_category[a.category]) stats.by_category[a.category] = 0;
      stats.by_category[a.category]++;
    }

    if (variance < 0) stats.over_budget_count++;
  });

  res.json(stats);
}));

/**
 * GET /api/allowances/:id
 * Get a single allowance with selections
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get allowance
  const { data: allowance, error: allowanceError } = await supabase
    .from('v2_allowances')
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (allowanceError) throw allowanceError;
  if (!allowance) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  // Get selections linked to this allowance
  const { data: selections } = await supabase
    .from('selections')
    .select('*')
    .eq('allowance_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  res.json({
    ...allowance,
    selections: selections || []
  });
}));

/**
 * POST /api/allowances
 * Create a new allowance
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    cost_code_id,
    name,
    description,
    category,
    budgeted_amount,
    requires_owner_approval,
    selection_due_date,
    notes,
    internal_notes,
    created_by
  } = req.body;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id is required' });
  }

  const { data, error } = await supabase
    .from('v2_allowances')
    .insert({
      job_id,
      cost_code_id: cost_code_id || null,
      name: name || '',
      description,
      category,
      budgeted_amount: budgeted_amount || 0,
      spent_amount: 0,
      status: 'open',
      requires_owner_approval: requires_owner_approval !== false,
      selection_due_date,
      notes,
      internal_notes,
      created_by: created_by || 'System'
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/allowances/:id
 * Update an allowance
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.variance_amount; // Generated column
  delete updates.job_id;

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('v2_allowances')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  res.json(data);
}));

/**
 * POST /api/allowances/:id/approve
 * Owner approval for an allowance
 */
router.post('/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  const { data, error } = await supabase
    .from('v2_allowances')
    .update({
      owner_approved_at: new Date().toISOString(),
      owner_approved_by: approved_by || 'Owner',
      status: 'selected',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  res.json(data);
}));

/**
 * POST /api/allowances/:id/order
 * Mark allowance as ordered
 */
router.post('/:id/order', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { expected_delivery } = req.body;

  const { data, error } = await supabase
    .from('v2_allowances')
    .update({
      status: 'ordered',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  res.json(data);
}));

/**
 * POST /api/allowances/:id/receive
 * Mark allowance as received
 */
router.post('/:id/receive', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_allowances')
    .update({
      status: 'received',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  res.json(data);
}));

/**
 * POST /api/allowances/:id/install
 * Mark allowance as installed
 */
router.post('/:id/install', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_allowances')
    .update({
      status: 'installed',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  res.json(data);
}));

/**
 * POST /api/allowances/:id/close
 * Close an allowance
 */
router.post('/:id/close', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if over budget
  const { data: existing } = await supabase
    .from('v2_allowances')
    .select('budgeted_amount, spent_amount')
    .eq('id', id)
    .single();

  const variance = existing ? (parseFloat(existing.budgeted_amount) || 0) - (parseFloat(existing.spent_amount) || 0) : 0;
  const status = variance < 0 ? 'over_budget' : 'closed';

  const { data, error } = await supabase
    .from('v2_allowances')
    .update({
      status,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Allowance not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/allowances/:id
 * Soft delete an allowance
 */
router.delete('/:id', asyncHandler(async (req, res) => {
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

// ============================================================
// ALLOWANCE CATEGORIES
// ============================================================

/**
 * GET /api/allowances/categories
 * Get available allowance categories
 */
router.get('/categories/list', asyncHandler(async (req, res) => {
  const categories = [
    { value: 'appliances', label: 'Appliances' },
    { value: 'flooring', label: 'Flooring' },
    { value: 'tile', label: 'Tile' },
    { value: 'countertops', label: 'Countertops' },
    { value: 'cabinets', label: 'Cabinets' },
    { value: 'lighting', label: 'Lighting' },
    { value: 'plumbing_fixtures', label: 'Plumbing Fixtures' },
    { value: 'hardware', label: 'Hardware' },
    { value: 'paint', label: 'Paint' },
    { value: 'landscaping', label: 'Landscaping' },
    { value: 'window_treatments', label: 'Window Treatments' },
    { value: 'other', label: 'Other' }
  ];

  res.json(categories);
}));

// ============================================================
// BULK OPERATIONS
// ============================================================

/**
 * POST /api/allowances/bulk
 * Create multiple allowances at once
 */
router.post('/bulk', asyncHandler(async (req, res) => {
  const { job_id, allowances } = req.body;

  if (!job_id || !Array.isArray(allowances) || allowances.length === 0) {
    return res.status(400).json({ error: 'job_id and allowances array are required' });
  }

  const toInsert = allowances.map(a => ({
    job_id,
    cost_code_id: a.cost_code_id || null,
    name: a.name || '',
    description: a.description,
    category: a.category,
    budgeted_amount: a.budgeted_amount || 0,
    spent_amount: 0,
    status: 'open',
    requires_owner_approval: a.requires_owner_approval !== false,
    selection_due_date: a.selection_due_date,
    notes: a.notes,
    created_by: a.created_by || 'System'
  }));

  const { data, error } = await supabase
    .from('v2_allowances')
    .insert(toInsert)
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name, category)
    `);

  if (error) throw error;
  res.status(201).json({ success: true, allowances: data });
}));

/**
 * GET /api/allowances/summary/:jobId
 * Get allowance summary for a job (for owner portal)
 */
router.get('/summary/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { data, error } = await supabase
    .from('v2_allowances')
    .select(`
      id,
      name,
      category,
      budgeted_amount,
      spent_amount,
      status,
      selection_due_date,
      owner_approved_at
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('category', { ascending: true });

  if (error) throw error;

  // Group by category
  const byCategory = {};
  (data || []).forEach(a => {
    const cat = a.category || 'other';
    const budgeted = parseFloat(a.budgeted_amount) || 0;
    const spent = parseFloat(a.spent_amount) || 0;
    const variance = budgeted - spent;

    if (!byCategory[cat]) {
      byCategory[cat] = {
        allowances: [],
        total_budgeted: 0,
        total_spent: 0,
        total_variance: 0
      };
    }
    byCategory[cat].allowances.push({ ...a, variance_amount: variance });
    byCategory[cat].total_budgeted += budgeted;
    byCategory[cat].total_spent += spent;
    byCategory[cat].total_variance += variance;
  });

  res.json({
    total_allowances: data?.length || 0,
    by_category: byCategory
  });
}));

module.exports = router;
