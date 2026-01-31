/**
 * Scope Categories Routes
 * Master list of work types with measurement units for performance tracking
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');

// Get all active scope categories
router.get('/', asyncHandler(async (req, res) => {
  const { trade, phase } = req.query;

  let query = supabase
    .from('v2_scope_categories')
    .select(`
      id,
      code,
      name,
      trade,
      primary_unit,
      secondary_unit,
      job_spec_field,
      baseline_days_per_unit,
      baseline_workers,
      phase,
      cost_code_id,
      cost_code:v2_cost_codes(id, code, name),
      is_active
    `)
    .eq('is_active', true)
    .order('trade')
    .order('name');

  if (trade) query = query.eq('trade', trade);
  if (phase) query = query.eq('phase', phase);

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ categories: data || [] });
}));

// Get single scope category by ID or code
router.get('/:idOrCode', asyncHandler(async (req, res) => {
  const { idOrCode } = req.params;

  // Check if it's a UUID or a code
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrCode);

  let query = supabase
    .from('v2_scope_categories')
    .select(`
      id,
      code,
      name,
      trade,
      primary_unit,
      secondary_unit,
      job_spec_field,
      baseline_days_per_unit,
      baseline_workers,
      phase,
      cost_code_id,
      cost_code:v2_cost_codes(id, code, name),
      is_active
    `);

  if (isUUID) {
    query = query.eq('id', idOrCode);
  } else {
    query = query.eq('code', idOrCode.toUpperCase());
  }

  const { data, error } = await query.single();

  if (error) {
    if (error.code === 'PGRST116') throw notFoundError('scope category', idOrCode);
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.json(data);
}));

// Get distinct trades
router.get('/meta/trades', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_scope_categories')
    .select('trade')
    .eq('is_active', true);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Get unique trades
  const trades = [...new Set((data || []).map(d => d.trade))].sort();
  res.json({ trades });
}));

// Get scope categories grouped by trade
router.get('/grouped/by-trade', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_scope_categories')
    .select('*')
    .eq('is_active', true)
    .order('trade')
    .order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Group by trade
  const grouped = {};
  (data || []).forEach(cat => {
    if (!grouped[cat.trade]) {
      grouped[cat.trade] = [];
    }
    grouped[cat.trade].push(cat);
  });

  res.json({ byTrade: grouped });
}));

// Create a new scope category (admin only)
router.post('/', asyncHandler(async (req, res) => {
  const {
    code,
    name,
    trade,
    primary_unit,
    secondary_unit,
    job_spec_field,
    baseline_days_per_unit,
    baseline_workers,
    phase,
    cost_code_id
  } = req.body;

  if (!code || !name || !trade || !primary_unit) {
    throw new AppError('VALIDATION_FAILED', 'code, name, trade, and primary_unit are required');
  }

  const { data, error } = await supabase
    .from('v2_scope_categories')
    .insert({
      code: code.toUpperCase(),
      name,
      trade,
      primary_unit,
      secondary_unit,
      job_spec_field,
      baseline_days_per_unit: baseline_days_per_unit || 0.01,
      baseline_workers: baseline_workers || 2,
      phase,
      cost_code_id,
      is_active: true
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('DUPLICATE_ENTRY', `Scope category with code "${code}" already exists`);
    }
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.status(201).json(data);
}));

// Update a scope category
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const allowedFields = [
    'name', 'trade', 'primary_unit', 'secondary_unit',
    'job_spec_field', 'baseline_days_per_unit', 'baseline_workers',
    'phase', 'cost_code_id', 'is_active'
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_FAILED', 'No valid fields to update');
  }

  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('v2_scope_categories')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw notFoundError('scope category', id);
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.json(data);
}));

// Delete (deactivate) a scope category
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_scope_categories')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    if (error.code === 'PGRST116') throw notFoundError('scope category', id);
    throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  }

  res.json({ success: true, message: 'Scope category deactivated' });
}));

module.exports = router;
