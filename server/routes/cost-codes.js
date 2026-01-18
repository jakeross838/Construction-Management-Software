/**
 * Cost Codes Routes
 * Cost code management endpoints
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

module.exports = router;

