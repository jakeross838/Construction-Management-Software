/**
 * Vendors Routes
 * Vendor management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Get all vendors
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_vendors')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create vendor
router.post('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_vendors')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

