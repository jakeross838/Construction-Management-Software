/**
 * Vendors Routes
 * Vendor management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError, validateRequest } = require('../errors');
const { calculateVendorSimilarity } = require('../standards');

// Check for similar vendors (used before create)
router.get('/check-duplicate', asyncHandler(async (req, res) => {
  const { name, threshold = 75 } = req.query;

  if (!name || name.trim().length < 2) {
    return res.json({ matches: [] });
  }

  const searchName = name.trim();

  // Get all active vendors
  const { data: vendors, error } = await supabase
    .from('v2_vendors')
    .select('id, name, email, phone, trade')
    .is('deleted_at', null);

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  // Find similar vendors using standards.calculateVendorSimilarity
  const matches = [];
  for (const vendor of vendors || []) {
    const similarity = calculateVendorSimilarity(searchName, vendor.name);
    if (similarity >= parseInt(threshold)) {
      matches.push({
        ...vendor,
        similarity: Math.round(similarity)
      });
    }
  }

  // Sort by similarity descending
  matches.sort((a, b) => b.similarity - a.similarity);

  res.json({
    query: name,
    threshold: parseInt(threshold),
    matches: matches.slice(0, 5) // Top 5 matches
  });
}));

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
router.post('/', validateRequest({ body: { name: { required: true } } }), asyncHandler(async (req, res) => {
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

// Soft delete vendor
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check vendor exists and not already deleted
  const { data: vendor, error: findError } = await supabase
    .from('v2_vendors')
    .select('id, name, deleted_at')
    .eq('id', id)
    .single();

  if (findError || !vendor) {
    throw notFoundError('vendor', id);
  }

  if (vendor.deleted_at) {
    throw new AppError('ALREADY_DELETED', 'Vendor is already deleted', { vendor_id: id });
  }

  // Soft delete
  const { data, error } = await supabase
    .from('v2_vendors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });

  res.json({ success: true, deleted: data });
}));

// Get all documents for a vendor
router.get('/:id/documents', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { include_history } = req.query;

  let query = supabase
    .from('v2_vendor_documents')
    .select('*')
    .eq('vendor_id', id)
    .order('created_at', { ascending: false });

  // By default only current docs
  if (include_history !== 'true') {
    query = query.eq('is_current', true);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message, { code: error.code });
  res.json(data || []);
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

