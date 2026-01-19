/**
 * RFIs (Requests for Information) API Routes
 * Manages RFIs, responses, and attachments
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// RFIS
// ============================================================

/**
 * GET /api/rfis
 * List RFIs with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, assigned_to, priority } = req.query;

  let query = supabase
    .from('v2_rfis')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (assigned_to) query = query.eq('assigned_to', assigned_to);
  if (priority) query = query.eq('priority', priority);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/rfis/stats
 * Get RFI statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_rfis')
    .select('status, priority')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    open: 0,
    pending: 0,
    answered: 0,
    closed: 0,
    overdue: 0
  };

  (data || []).forEach(rfi => {
    if (stats[rfi.status] !== undefined) stats[rfi.status]++;
  });

  res.json(stats);
}));

/**
 * GET /api/rfis/:id
 * Get a single RFI with responses and attachments
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get RFI
  const { data: rfi, error: rfiError } = await supabase
    .from('v2_rfis')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (rfiError) throw rfiError;
  if (!rfi) {
    return res.status(404).json({ error: 'RFI not found' });
  }

  // Get responses
  const { data: responses } = await supabase
    .from('v2_rfi_responses')
    .select('*')
    .eq('rfi_id', id)
    .order('created_at', { ascending: true });

  // Get attachments
  const { data: attachments } = await supabase
    .from('v2_rfi_attachments')
    .select('*')
    .eq('rfi_id', id)
    .order('created_at');

  res.json({
    ...rfi,
    responses: responses || [],
    attachments: attachments || []
  });
}));

/**
 * POST /api/rfis
 * Create a new RFI
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    subject,
    question,
    reference_drawings,
    reference_specs,
    priority,
    assigned_to,
    due_date,
    date_required,
    submitted_by,
    notes
  } = req.body;

  if (!job_id || !subject || !question) {
    return res.status(400).json({
      error: 'Job, subject, and question are required'
    });
  }

  const { data, error } = await supabase
    .from('v2_rfis')
    .insert({
      job_id,
      subject,
      question,
      reference_drawings,
      reference_specs,
      priority: priority || 'normal',
      assigned_to,
      due_date,
      date_required,
      submitted_by: submitted_by || 'Jake Ross',
      notes,
      status: 'open'
    })
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/rfis/:id
 * Update an RFI
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.rfi_number;

  const { data, error } = await supabase
    .from('v2_rfis')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'RFI not found' });
  }

  res.json(data);
}));

/**
 * POST /api/rfis/:id/respond
 * Add a response to an RFI
 */
router.post('/:id/respond', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, response_type, responded_by } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Response content is required' });
  }

  // Add response
  const { data: response, error: responseError } = await supabase
    .from('v2_rfi_responses')
    .insert({
      rfi_id: id,
      content,
      response_type: response_type || 'response',
      responded_by: responded_by || 'Jake Ross'
    })
    .select()
    .single();

  if (responseError) throw responseError;

  // Update RFI status to answered and set response info
  const { error: updateError } = await supabase
    .from('v2_rfis')
    .update({
      status: 'answered',
      response: content,
      responded_by: responded_by || 'Jake Ross',
      responded_at: new Date().toISOString()
    })
    .eq('id', id);

  if (updateError) throw updateError;

  res.status(201).json(response);
}));

/**
 * POST /api/rfis/:id/close
 * Close an RFI
 */
router.post('/:id/close', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_rfis')
    .update({
      status: 'closed',
      closed_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'RFI not found' });
  }

  res.json(data);
}));

/**
 * POST /api/rfis/:id/reopen
 * Reopen a closed RFI
 */
router.post('/:id/reopen', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_rfis')
    .update({
      status: 'open',
      closed_at: null
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'RFI not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/rfis/:id
 * Soft delete an RFI
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_rfis')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'RFI not found' });
  }

  res.json({ success: true, message: 'RFI deleted' });
}));

// ============================================================
// ATTACHMENTS
// ============================================================

/**
 * POST /api/rfis/:id/attachments
 * Add an attachment to an RFI
 */
router.post('/:id/attachments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, file_url, file_type, file_size, attachment_type, uploaded_by } = req.body;

  if (!name || !file_url) {
    return res.status(400).json({ error: 'Name and file URL are required' });
  }

  const { data, error } = await supabase
    .from('v2_rfi_attachments')
    .insert({
      rfi_id: id,
      name,
      file_url,
      file_type,
      file_size,
      attachment_type: attachment_type || 'question',
      uploaded_by: uploaded_by || 'Jake Ross'
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /api/rfis/:rfiId/attachments/:attachmentId
 * Delete an attachment
 */
router.delete('/:rfiId/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const { attachmentId } = req.params;

  const { error } = await supabase
    .from('v2_rfi_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
  res.json({ success: true, message: 'Attachment deleted' });
}));

module.exports = router;
