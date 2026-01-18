/**
 * Vendors Routes
 * Vendor management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError } = require('../errors');

// Get all vendors
router.get('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_vendors')
    .select('*')
    .order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Create vendor
router.post('/', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_vendors')
    .insert(req.body)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Update vendor
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_vendors')
    .update(req.body)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data);
}));

// Get vendor details with stats
router.get('/:id/details', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get vendor
  const { data: vendor, error: vendorError } = await supabase
    .from('v2_vendors')
    .select('*')
    .eq('id', id)
    .single();

  if (vendorError || !vendor) {
    throw notFoundError('vendor', id);
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
}));

module.exports = router;

