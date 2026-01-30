/**
 * Permitting Routes
 * Permit applications, inspections, and document management
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============ PERMITS ============

// Get all permits
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, type } = req.query;

  let query = supabase
    .from('v2_permits')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('permit_type', type);

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// Get permit stats
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_permits')
    .select('status, permit_type')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  const stats = {
    total: data.length,
    draft: data.filter(p => p.status === 'draft').length,
    submitted: data.filter(p => p.status === 'submitted').length,
    under_review: data.filter(p => p.status === 'under_review').length,
    approved: data.filter(p => p.status === 'approved').length,
    by_type: {}
  };

  // Count by type
  data.forEach(p => {
    if (!stats.by_type[p.permit_type]) stats.by_type[p.permit_type] = 0;
    stats.by_type[p.permit_type]++;
  });

  res.json(stats);
}));

// Get single permit with all details
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_permits')
    .select(`
      *,
      job:v2_jobs(id, name, address)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !data) throw new AppError('Permit not found', 404);

  // Get inspections
  const { data: inspections } = await supabase
    .from('v2_permit_inspections')
    .select(`
      *,
      inspector:v2_contacts(id, name, phone, email)
    `)
    .eq('permit_id', id)
    .order('scheduled_date');

  // Get documents
  const { data: documents } = await supabase
    .from('v2_permit_documents')
    .select('*')
    .eq('permit_id', id)
    .order('uploaded_at', { ascending: false });

  // Get activity
  const { data: activity } = await supabase
    .from('v2_permit_activity')
    .select('*')
    .eq('permit_id', id)
    .order('created_at', { ascending: false });

  res.json({
    ...data,
    inspections: inspections || [],
    documents: documents || [],
    activity: activity || []
  });
}));

// Create permit
router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    permit_number,
    permit_type,
    description,
    status,
    submission_date,
    expiration_date,
    issued_by,
    fee_amount,
    notes
  } = req.body;

  if (!permit_type) throw new AppError('Permit type is required', 400);

  const { data, error } = await supabase
    .from('v2_permits')
    .insert([{
      job_id,
      permit_number,
      permit_type,
      description,
      status: status || 'draft',
      submission_date,
      expiration_date,
      issued_by,
      fee_amount,
      notes
    }])
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);

  // Log activity
  await supabase.from('v2_permit_activity').insert([{
    permit_id: data.id,
    action: 'created',
    description: `Permit created: ${permit_type}`
  }]);

  res.status(201).json(data);
}));

// Update permit
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };

  // Track status changes
  const oldPermit = await supabase
    .from('v2_permits')
    .select('status')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('v2_permits')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Permit not found', 404);

  // Log status change
  if (oldPermit.data && req.body.status && oldPermit.data.status !== req.body.status) {
    await supabase.from('v2_permit_activity').insert([{
      permit_id: id,
      action: 'status_changed',
      description: `Status changed from ${oldPermit.data.status} to ${req.body.status}`
    }]);
  }

  res.json(data);
}));

// Submit permit
router.post('/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_permits')
    .update({
      status: 'submitted',
      submission_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Permit not found', 404);

  await supabase.from('v2_permit_activity').insert([{
    permit_id: id,
    action: 'submitted',
    description: 'Permit submitted for review'
  }]);

  res.json(data);
}));

// Approve permit
router.post('/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permit_number, expiration_date } = req.body;

  const { data, error } = await supabase
    .from('v2_permits')
    .update({
      status: 'approved',
      approval_date: new Date().toISOString().split('T')[0],
      permit_number: permit_number || undefined,
      expiration_date: expiration_date || undefined,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Permit not found', 404);

  await supabase.from('v2_permit_activity').insert([{
    permit_id: id,
    action: 'approved',
    description: `Permit approved${permit_number ? `: ${permit_number}` : ''}`
  }]);

  res.json(data);
}));

// Delete permit (soft)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_permits')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError(error.message, 500);

  res.json({ success: true });
}));

// ============ INSPECTIONS ============

// Get all inspections
router.get('/inspections/all', asyncHandler(async (req, res) => {
  const { status, start_date, end_date } = req.query;

  let query = supabase
    .from('v2_permit_inspections')
    .select(`
      *,
      permit:v2_permits(id, permit_number, permit_type, job:v2_jobs(id, name)),
      inspector:v2_contacts(id, name, phone, email)
    `)
    .order('scheduled_date');

  if (status) query = query.eq('status', status);
  if (start_date) query = query.gte('scheduled_date', start_date);
  if (end_date) query = query.lte('scheduled_date', end_date);

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// Schedule inspection
router.post('/:id/inspections', asyncHandler(async (req, res) => {
  const { id: permit_id } = req.params;
  const {
    inspection_type,
    description,
    scheduled_date,
    scheduled_time,
    inspector_contact_id,
    inspector_name,
    inspector_phone
  } = req.body;

  if (!inspection_type || !scheduled_date) {
    throw new AppError('Inspection type and date are required', 400);
  }

  // Get permit's job_id
  const { data: permit } = await supabase
    .from('v2_permits')
    .select('job_id')
    .eq('id', permit_id)
    .single();

  const { data, error } = await supabase
    .from('v2_permit_inspections')
    .insert([{
      permit_id,
      job_id: permit?.job_id,
      inspection_type,
      description,
      scheduled_date,
      scheduled_time,
      inspector_contact_id,
      inspector_name,
      inspector_phone
    }])
    .select(`
      *,
      inspector:v2_contacts(id, name, phone, email)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);

  await supabase.from('v2_permit_activity').insert([{
    permit_id,
    action: 'inspection_scheduled',
    description: `${inspection_type} inspection scheduled for ${scheduled_date}`
  }]);

  res.status(201).json(data);
}));

// Update inspection
router.patch('/inspections/:inspectionId', asyncHandler(async (req, res) => {
  const { inspectionId } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('v2_permit_inspections')
    .update(updates)
    .eq('id', inspectionId)
    .select(`
      *,
      inspector:v2_contacts(id, name, phone, email)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Inspection not found', 404);

  res.json(data);
}));

// Complete inspection
router.post('/inspections/:inspectionId/complete', asyncHandler(async (req, res) => {
  const { inspectionId } = req.params;
  const { status, result_notes, follow_up_required, follow_up_notes } = req.body;

  if (!status || !['passed', 'failed'].includes(status)) {
    throw new AppError('Status must be passed or failed', 400);
  }

  const { data, error } = await supabase
    .from('v2_permit_inspections')
    .update({
      status,
      result_notes,
      follow_up_required: follow_up_required || false,
      follow_up_notes,
      completed_date: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    })
    .eq('id', inspectionId)
    .select('*, permit_id')
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Inspection not found', 404);

  await supabase.from('v2_permit_activity').insert([{
    permit_id: data.permit_id,
    action: 'inspection_completed',
    description: `${data.inspection_type} inspection ${status}`
  }]);

  res.json(data);
}));

// Cancel inspection
router.post('/inspections/:inspectionId/cancel', asyncHandler(async (req, res) => {
  const { inspectionId } = req.params;

  const { data, error } = await supabase
    .from('v2_permit_inspections')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString()
    })
    .eq('id', inspectionId)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Inspection not found', 404);

  res.json(data);
}));

// ============ DOCUMENTS ============

// Upload permit document
router.post('/:id/documents', asyncHandler(async (req, res) => {
  const { id: permit_id } = req.params;
  const { document_type, name, description, file_url, file_size, mime_type, uploaded_by } = req.body;

  if (!document_type || !name) {
    throw new AppError('Document type and name are required', 400);
  }

  const { data, error } = await supabase
    .from('v2_permit_documents')
    .insert([{
      permit_id,
      document_type,
      name,
      description,
      file_url,
      file_size,
      mime_type,
      uploaded_by
    }])
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  await supabase.from('v2_permit_activity').insert([{
    permit_id,
    action: 'document_uploaded',
    description: `Document uploaded: ${name}`
  }]);

  res.status(201).json(data);
}));

// Delete permit document
router.delete('/documents/:documentId', asyncHandler(async (req, res) => {
  const { documentId } = req.params;

  const { error } = await supabase
    .from('v2_permit_documents')
    .delete()
    .eq('id', documentId);

  if (error) throw new AppError(error.message, 500);

  res.json({ success: true });
}));

module.exports = router;
