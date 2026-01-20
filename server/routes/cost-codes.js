/**
 * Cost Codes Routes
 * Cost code management endpoints including trade mappings
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../errors');

// Get all cost codes
router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_cost_codes')
    .select('*')
    .order('code');

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ costCodes: data });
}));

// Create cost code
router.post('/', asyncHandler(async (req, res) => {
  const { code, name, category } = req.body;
  if (!code || !name) {
    throw new AppError('VALIDATION_FAILED', 'Code and name are required');
  }

  const { data, error } = await supabase
    .from('v2_cost_codes')
    .insert({ code, name, category })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ costCode: data });
}));

// Update cost code
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, name, category } = req.body;

  const { data, error } = await supabase
    .from('v2_cost_codes')
    .update({ code, name, category })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ costCode: data });
}));

// Delete cost code
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_cost_codes')
    .delete()
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ success: true });
}));

// ============================================================
// TRADE MAPPINGS
// ============================================================

// Get trade mappings
router.get('/trade-mappings', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_trade_mappings')
    .select(`
      id,
      trade_type,
      priority,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .order('trade_type');

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ mappings: data });
}));

// Add trade mapping
router.post('/trade-mappings', asyncHandler(async (req, res) => {
  const { trade_type, cost_code_id } = req.body;
  if (!trade_type || !cost_code_id) {
    throw new AppError('VALIDATION_FAILED', 'Trade type and cost code ID are required');
  }

  const { data, error } = await supabase
    .from('v2_trade_mappings')
    .insert({ trade_type: trade_type.toLowerCase(), cost_code_id })
    .select(`
      id,
      trade_type,
      cost_code:v2_cost_codes(id, code, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ mapping: data });
}));

// Delete trade mapping
router.delete('/trade-mappings/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_trade_mappings')
    .delete()
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ success: true });
}));

module.exports = router;
