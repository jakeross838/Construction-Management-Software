/**
 * Communications Routes
 * Track calls, emails, notes, and other communications
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../errors');

// ============================================================
// STATS
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { data: comms } = await supabase
    .from('v2_communications')
    .select('id, comm_type, follow_up_date, follow_up_completed')
    .is('deleted_at', null);

  const today = new Date().toISOString().split('T')[0];

  const stats = {
    total: comms?.length || 0,
    by_type: {},
    pending_followups: 0
  };

  for (const comm of (comms || [])) {
    stats.by_type[comm.comm_type] = (stats.by_type[comm.comm_type] || 0) + 1;
    if (comm.follow_up_date && !comm.follow_up_completed && comm.follow_up_date <= today) {
      stats.pending_followups++;
    }
  }

  res.json(stats);
}));

// ============================================================
// CRUD OPERATIONS
// ============================================================

// Get all communications with filters
router.get('/', asyncHandler(async (req, res) => {
  const { contact_id, company_id, job_id, type, search, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('v2_communications')
    .select(`
      *,
      contact:v2_contacts!contact_id(id, first_name, last_name),
      company:v2_companies!company_id(id, name),
      job:v2_jobs!job_id(id, name)
    `)
    .is('deleted_at', null);

  if (contact_id) query = query.eq('contact_id', contact_id);
  if (company_id) query = query.eq('company_id', company_id);
  if (job_id) query = query.eq('job_id', job_id);
  if (type) query = query.eq('comm_type', type);

  if (search) {
    query = query.or(`subject.ilike.%${search}%,body.ilike.%${search}%,summary.ilike.%${search}%`);
  }

  const { data, error } = await query
    .order('comm_date', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ communications: data });
}));

// Get single communication
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: comm, error } = await supabase
    .from('v2_communications')
    .select(`
      *,
      contact:v2_contacts!contact_id(id, first_name, last_name, email, phone),
      company:v2_companies!company_id(id, name),
      job:v2_jobs!job_id(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !comm) {
    throw new AppError('NOT_FOUND', 'Communication not found');
  }

  res.json({ communication: comm });
}));

// Create communication
router.post('/', asyncHandler(async (req, res) => {
  const {
    comm_type,
    direction,
    subject,
    body,
    summary,
    contact_id,
    company_id,
    job_id,
    comm_date,
    duration_minutes,
    follow_up_date,
    follow_up_notes,
    created_by
  } = req.body;

  if (!comm_type) {
    throw new AppError('VALIDATION_FAILED', 'Communication type is required');
  }

  if (!contact_id && !company_id && !job_id) {
    throw new AppError('VALIDATION_FAILED', 'At least one of contact, company, or job must be specified');
  }

  const { data, error } = await supabase
    .from('v2_communications')
    .insert({
      comm_type,
      direction,
      subject,
      body,
      summary,
      contact_id: contact_id || null,
      company_id: company_id || null,
      job_id: job_id || null,
      comm_date: comm_date || new Date().toISOString(),
      duration_minutes,
      follow_up_date,
      follow_up_notes,
      created_by
    })
    .select(`
      *,
      contact:v2_contacts!contact_id(id, first_name, last_name),
      company:v2_companies!company_id(id, name),
      job:v2_jobs!job_id(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ communication: data });
}));

// Update communication
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.id;
  delete updates.created_at;
  delete updates.deleted_at;

  const { data, error } = await supabase
    .from('v2_communications')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      contact:v2_contacts!contact_id(id, first_name, last_name),
      company:v2_companies!company_id(id, name),
      job:v2_jobs!job_id(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Communication not found');

  res.json({ communication: data });
}));

// Delete communication (soft)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_communications')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Communication not found');

  res.json({ success: true });
}));

// ============================================================
// FOLLOW-UPS
// ============================================================

// Get pending follow-ups
router.get('/follow-ups/pending', asyncHandler(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('v2_communications')
    .select(`
      *,
      contact:v2_contacts!contact_id(id, first_name, last_name),
      company:v2_companies!company_id(id, name),
      job:v2_jobs!job_id(id, name)
    `)
    .is('deleted_at', null)
    .not('follow_up_date', 'is', null)
    .eq('follow_up_completed', false)
    .lte('follow_up_date', today)
    .order('follow_up_date');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ follow_ups: data });
}));

// Mark follow-up complete
router.patch('/:id/complete-followup', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_communications')
    .update({ follow_up_completed: true })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Communication not found');

  res.json({ communication: data });
}));

// ============================================================
// COMMUNICATION TYPES
// ============================================================

router.get('/types/list', asyncHandler(async (req, res) => {
  res.json({
    types: [
      { value: 'call', label: 'Phone Call', icon: 'phone' },
      { value: 'email', label: 'Email', icon: 'mail' },
      { value: 'note', label: 'Note', icon: 'file-text' },
      { value: 'meeting', label: 'Meeting', icon: 'users' },
      { value: 'text', label: 'Text Message', icon: 'message-square' },
      { value: 'other', label: 'Other', icon: 'more-horizontal' }
    ]
  });
}));

module.exports = router;
