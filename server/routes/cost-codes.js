/**
 * Cost Codes Routes
 * Cost code management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Get all cost codes
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_cost_codes')
      .select('*')
      .order('code');

    if (error) throw error;
    res.json({ costCodes: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

