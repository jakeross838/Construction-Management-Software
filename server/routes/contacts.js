/**
 * Contacts Routes
 * CRM contact management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../errors');

// ============================================================
// STATS (must be before /:id route)
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { data: contacts } = await supabase
    .from('v2_contacts')
    .select('id, contact_role, status')
    .is('deleted_at', null);

  const stats = {
    total: contacts?.length || 0,
    by_role: {},
    by_status: {}
  };

  for (const contact of (contacts || [])) {
    stats.by_role[contact.contact_role] = (stats.by_role[contact.contact_role] || 0) + 1;
    stats.by_status[contact.status] = (stats.by_status[contact.status] || 0) + 1;
  }

  res.json(stats);
}));

// ============================================================
// CRUD OPERATIONS
// ============================================================

// Get all contacts
router.get('/', asyncHandler(async (req, res) => {
  const { search, role, status, company_id } = req.query;

  let query = supabase
    .from('v2_contacts')
    .select(`
      *,
      company:v2_companies(id, name)
    `)
    .is('deleted_at', null);

  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`);
  }
  if (role) query = query.eq('contact_role', role);
  if (status) query = query.eq('status', status);
  if (company_id) query = query.eq('company_id', company_id);

  const { data, error } = await query.order('last_name').order('first_name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ contacts: data });
}));

// Get single contact with related data
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: contact, error } = await supabase
    .from('v2_contacts')
    .select(`
      *,
      company:v2_companies(id, name, company_type)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !contact) {
    throw new AppError('NOT_FOUND', 'Contact not found');
  }

  // Get linked jobs
  const { data: contactJobs } = await supabase
    .from('v2_contact_jobs')
    .select(`
      role,
      job:v2_jobs(id, name, status)
    `)
    .eq('contact_id', id);

  res.json({
    contact: {
      ...contact,
      jobs: contactJobs?.map(cj => ({ ...cj.job, role: cj.role })) || []
    }
  });
}));

// Create contact
router.post('/', asyncHandler(async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    mobile,
    title,
    company_id,
    contact_role,
    is_primary,
    preferred_contact,
    address,
    city,
    state,
    zip,
    notes
  } = req.body;

  if (!first_name || !last_name) {
    throw new AppError('VALIDATION_FAILED', 'First name and last name are required');
  }

  const { data, error } = await supabase
    .from('v2_contacts')
    .insert({
      first_name,
      last_name,
      email,
      phone,
      mobile,
      title,
      company_id: company_id || null,
      contact_role: contact_role || 'other',
      is_primary: is_primary || false,
      preferred_contact: preferred_contact || 'email',
      address,
      city,
      state,
      zip,
      notes
    })
    .select(`
      *,
      company:v2_companies(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ contact: data });
}));

// Update contact
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.id;
  delete updates.created_at;
  delete updates.deleted_at;

  const { data, error } = await supabase
    .from('v2_contacts')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      company:v2_companies(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Contact not found');

  res.json({ contact: data });
}));

// Delete contact (soft)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_contacts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Contact not found');

  res.json({ success: true });
}));

// ============================================================
// JOB LINKING
// ============================================================

// Link contact to job
router.post('/:id/jobs', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { job_id, role } = req.body;

  if (!job_id) {
    throw new AppError('VALIDATION_FAILED', 'Job ID is required');
  }

  const { data, error } = await supabase
    .from('v2_contact_jobs')
    .insert({
      contact_id: id,
      job_id,
      role
    })
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('DUPLICATE', 'Contact is already linked to this job');
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.status(201).json({ link: data });
}));

// Unlink contact from job
router.delete('/:id/jobs/:jobId', asyncHandler(async (req, res) => {
  const { id, jobId } = req.params;

  const { error } = await supabase
    .from('v2_contact_jobs')
    .delete()
    .eq('contact_id', id)
    .eq('job_id', jobId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

module.exports = router;
