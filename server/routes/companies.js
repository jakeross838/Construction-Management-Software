/**
 * Companies Routes
 * CRM company/organization management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../errors');

// ============================================================
// STATS (must be before /:id route)
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { data: companies } = await supabase
    .from('v2_companies')
    .select('id, company_type, status')
    .is('deleted_at', null);

  const stats = {
    total: companies?.length || 0,
    by_type: {},
    by_status: {}
  };

  for (const company of (companies || [])) {
    if (company.company_type) {
      stats.by_type[company.company_type] = (stats.by_type[company.company_type] || 0) + 1;
    }
    stats.by_status[company.status] = (stats.by_status[company.status] || 0) + 1;
  }

  res.json(stats);
}));

// ============================================================
// CRUD OPERATIONS
// ============================================================

// Get all companies
router.get('/', asyncHandler(async (req, res) => {
  const { search, type, status } = req.query;

  let query = supabase
    .from('v2_companies')
    .select('*')
    .is('deleted_at', null);

  if (search) {
    query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  if (type) query = query.eq('company_type', type);
  if (status) query = query.eq('status', status);

  const { data, error } = await query.order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ companies: data });
}));

// Get single company with contacts
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: company, error } = await supabase
    .from('v2_companies')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !company) {
    throw new AppError('NOT_FOUND', 'Company not found');
  }

  // Get contacts for this company
  const { data: contacts } = await supabase
    .from('v2_contacts')
    .select('id, first_name, last_name, email, phone, title, contact_role, is_primary')
    .eq('company_id', id)
    .is('deleted_at', null)
    .order('is_primary', { ascending: false })
    .order('last_name');

  res.json({
    company: {
      ...company,
      contacts: contacts || []
    }
  });
}));

// Create company
router.post('/', asyncHandler(async (req, res) => {
  const {
    name,
    company_type,
    address,
    city,
    state,
    zip,
    phone,
    email,
    website,
    notes
  } = req.body;

  if (!name) {
    throw new AppError('VALIDATION_FAILED', 'Company name is required');
  }

  const { data, error } = await supabase
    .from('v2_companies')
    .insert({
      name,
      company_type,
      address,
      city,
      state,
      zip,
      phone,
      email,
      website,
      notes
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ company: data });
}));

// Update company
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.id;
  delete updates.created_at;
  delete updates.deleted_at;

  const { data, error } = await supabase
    .from('v2_companies')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Company not found');

  res.json({ company: data });
}));

// Delete company (soft)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if company has contacts
  const { data: contacts } = await supabase
    .from('v2_contacts')
    .select('id')
    .eq('company_id', id)
    .is('deleted_at', null)
    .limit(1);

  if (contacts && contacts.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Cannot delete company with active contacts. Remove or reassign contacts first.');
  }

  const { data, error } = await supabase
    .from('v2_companies')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Company not found');

  res.json({ success: true });
}));

// ============================================================
// COMPANY TYPES
// ============================================================

router.get('/types/list', asyncHandler(async (req, res) => {
  // Return standard company types
  res.json({
    types: [
      { value: 'client', label: 'Client' },
      { value: 'subcontractor', label: 'Subcontractor' },
      { value: 'supplier', label: 'Supplier' },
      { value: 'architect', label: 'Architect' },
      { value: 'engineer', label: 'Engineer' },
      { value: 'inspector', label: 'Inspector' },
      { value: 'lender', label: 'Lender' },
      { value: 'government', label: 'Government Agency' },
      { value: 'other', label: 'Other' }
    ]
  });
}));

module.exports = router;
