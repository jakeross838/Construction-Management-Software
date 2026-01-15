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

// Update vendor
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('v2_vendors')
      .update(req.body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get vendor details with stats
router.get('/:id/details', async (req, res) => {
  try {
    const { id } = req.params;

    // Get vendor
    const { data: vendor, error: vendorError } = await supabase
      .from('v2_vendors')
      .select('*')
      .eq('id', id)
      .single();

    if (vendorError || !vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }

    // Get invoice count and total
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('amount, status')
      .eq('vendor_id', id)
      .is('deleted_at', null);

    const stats = {
      invoice_count: invoices?.length || 0,
      total_billed: (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0)
    };

    res.json({ ...vendor, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

