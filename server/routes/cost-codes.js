/**
 * Cost Codes Routes
 * Cost code management endpoints including trade mappings
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const { cacheResponse, invalidateCache } = require('../middleware/cache');
const cache = require('../services/cache');

// Cache TTL constants
const LIST_CACHE_TTL = 300; // 5 minutes for cost codes list

/**
 * Invalidate cost codes cache
 */
async function invalidateCostCodesCache() {
  await cache.invalidatePattern('response:/api/cost-codes*');
}

// Get all cost codes (cached for 5 minutes)
router.get('/', cacheResponse(LIST_CACHE_TTL), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_cost_codes')
    .select('*')
    .order('code');

  // Filter by builder if authenticated
  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json({ costCodes: data });
}));

// Create cost code (invalidates cache)
router.post('/', asyncHandler(async (req, res) => {
  const { code, name, category } = req.body;
  const builderId = getBuilderId(req);

  if (!code || !name) {
    throw new AppError('VALIDATION_FAILED', 'Code and name are required');
  }

  const costCodeData = { code, name, category };
  if (builderId) costCodeData.builder_id = builderId;

  const { data, error } = await supabase
    .from('v2_cost_codes')
    .insert(costCodeData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Invalidate cost codes cache
  await invalidateCostCodesCache();

  res.json({ costCode: data });
}));

// Update cost code
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, name, category } = req.body;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_cost_codes')
    .update({ code, name, category })
    .eq('id', id);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query.select().single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Invalidate cost codes cache
  await invalidateCostCodesCache();

  res.json({ costCode: data });
}));

// Delete cost code (invalidates cache)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_cost_codes')
    .delete()
    .eq('id', id);

  if (builderId) query = query.eq('builder_id', builderId);

  const { error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Invalidate cost codes cache
  await invalidateCostCodesCache();

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
