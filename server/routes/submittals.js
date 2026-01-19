/**
 * Submittals API Routes
 * Manages submittals, items, attachments, and review workflow
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// SUBMITTALS
// ============================================================

/**
 * GET /api/submittals
 * List submittals with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, type, spec_section } = req.query;

  let query = supabase
    .from('v2_submittals')
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);
  if (spec_section) query = query.ilike('spec_section', `%${spec_section}%`);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/submittals/stats
 * Get submittal statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_submittals')
    .select('status, type')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    draft: 0,
    pending_review: 0,
    approved: 0,
    approved_as_noted: 0,
    revise_resubmit: 0,
    rejected: 0
  };

  (data || []).forEach(sub => {
    if (stats[sub.status] !== undefined) stats[sub.status]++;
  });

  res.json(stats);
}));

/**
 * GET /api/submittals/:id
 * Get a single submittal with items, attachments, and log
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get submittal
  const { data: submittal, error: submittalError } = await supabase
    .from('v2_submittals')
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (submittalError) throw submittalError;
  if (!submittal) {
    return res.status(404).json({ error: 'Submittal not found' });
  }

  // Get items
  const { data: items } = await supabase
    .from('v2_submittal_items')
    .select('*')
    .eq('submittal_id', id)
    .order('item_number');

  // Get attachments
  const { data: attachments } = await supabase
    .from('v2_submittal_attachments')
    .select('*')
    .eq('submittal_id', id)
    .order('created_at');

  // Get log
  const { data: log } = await supabase
    .from('v2_submittal_log')
    .select('*')
    .eq('submittal_id', id)
    .order('created_at', { ascending: false });

  res.json({
    ...submittal,
    items: items || [],
    attachments: attachments || [],
    log: log || []
  });
}));

/**
 * POST /api/submittals
 * Create a new submittal
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    title,
    type,
    spec_section,
    cost_code_id,
    description,
    submitted_by,
    submitted_to,
    subcontractor,
    manufacturer,
    date_required,
    lead_time_days,
    notes
  } = req.body;

  if (!job_id || !title) {
    return res.status(400).json({
      error: 'Job and title are required'
    });
  }

  const { data, error } = await supabase
    .from('v2_submittals')
    .insert({
      job_id,
      title,
      type: type || 'shop_drawing',
      spec_section,
      cost_code_id,
      description,
      submitted_by: submitted_by || 'Jake Ross',
      submitted_to,
      subcontractor,
      manufacturer,
      date_required,
      lead_time_days,
      notes,
      status: 'draft'
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .single();

  if (error) throw error;

  // Log creation
  await supabase.from('v2_submittal_log').insert({
    submittal_id: data.id,
    action: 'created',
    new_status: 'draft',
    performed_by: submitted_by || 'Jake Ross'
  });

  res.status(201).json(data);
}));

/**
 * PATCH /api/submittals/:id
 * Update a submittal
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.submittal_number;

  const { data, error } = await supabase
    .from('v2_submittals')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Submittal not found' });
  }

  res.json(data);
}));

/**
 * POST /api/submittals/:id/submit
 * Submit for review
 */
router.post('/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { submitted_by } = req.body;

  // Get current submittal
  const { data: current } = await supabase
    .from('v2_submittals')
    .select('status')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('v2_submittals')
    .update({
      status: 'pending_review',
      date_submitted: new Date().toISOString().split('T')[0]
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Submittal not found' });
  }

  // Log submission
  await supabase.from('v2_submittal_log').insert({
    submittal_id: id,
    action: 'submitted',
    old_status: current?.status,
    new_status: 'pending_review',
    performed_by: submitted_by || 'Jake Ross'
  });

  res.json(data);
}));

/**
 * POST /api/submittals/:id/review
 * Review a submittal (approve, reject, etc.)
 */
router.post('/:id/review', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, review_comments, reviewed_by } = req.body;

  const validStatuses = ['approved', 'approved_as_noted', 'revise_resubmit', 'rejected'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Invalid review status. Must be: ' + validStatuses.join(', ')
    });
  }

  // Get current submittal
  const { data: current } = await supabase
    .from('v2_submittals')
    .select('status')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('v2_submittals')
    .update({
      status,
      review_comments,
      reviewed_by: reviewed_by || 'Jake Ross',
      reviewed_at: new Date().toISOString(),
      date_returned: new Date().toISOString().split('T')[0]
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Submittal not found' });
  }

  // Log review
  await supabase.from('v2_submittal_log').insert({
    submittal_id: id,
    action: 'reviewed',
    old_status: current?.status,
    new_status: status,
    comments: review_comments,
    performed_by: reviewed_by || 'Jake Ross'
  });

  res.json(data);
}));

/**
 * POST /api/submittals/:id/revise
 * Create a revision of a submittal
 */
router.post('/:id/revise', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get original submittal
  const { data: original, error: fetchError } = await supabase
    .from('v2_submittals')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw fetchError;
  if (!original) {
    return res.status(404).json({ error: 'Submittal not found' });
  }

  // Calculate next revision
  const currentRev = original.revision || 'A';
  const nextRev = String.fromCharCode(currentRev.charCodeAt(0) + 1);

  // Create new revision
  const { data, error } = await supabase
    .from('v2_submittals')
    .insert({
      job_id: original.job_id,
      submittal_number: original.submittal_number,
      revision: nextRev,
      title: original.title,
      type: original.type,
      spec_section: original.spec_section,
      cost_code_id: original.cost_code_id,
      description: original.description,
      submitted_by: original.submitted_by,
      submitted_to: original.submitted_to,
      subcontractor: original.subcontractor,
      manufacturer: original.manufacturer,
      date_required: original.date_required,
      lead_time_days: original.lead_time_days,
      notes: original.notes,
      status: 'draft'
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .single();

  if (error) throw error;

  // Log revision
  await supabase.from('v2_submittal_log').insert({
    submittal_id: data.id,
    action: 'revised',
    new_status: 'draft',
    comments: `Revision ${nextRev} created from ${currentRev}`,
    performed_by: original.submitted_by || 'Jake Ross'
  });

  res.status(201).json(data);
}));

/**
 * DELETE /api/submittals/:id
 * Soft delete a submittal
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_submittals')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Submittal not found' });
  }

  res.json({ success: true, message: 'Submittal deleted' });
}));

// ============================================================
// SUBMITTAL ITEMS
// ============================================================

/**
 * POST /api/submittals/:id/items
 * Add item to submittal
 */
router.post('/:id/items', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description, quantity, unit, manufacturer, model_number, notes } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  // Get next item number
  const { data: existing } = await supabase
    .from('v2_submittal_items')
    .select('item_number')
    .eq('submittal_id', id)
    .order('item_number', { ascending: false })
    .limit(1);

  const nextNum = (existing?.[0]?.item_number || 0) + 1;

  const { data, error } = await supabase
    .from('v2_submittal_items')
    .insert({
      submittal_id: id,
      item_number: nextNum,
      description,
      quantity: quantity || 1,
      unit,
      manufacturer,
      model_number,
      notes
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /api/submittals/:submittalId/items/:itemId
 * Delete an item
 */
router.delete('/:submittalId/items/:itemId', asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const { error } = await supabase
    .from('v2_submittal_items')
    .delete()
    .eq('id', itemId);

  if (error) throw error;
  res.json({ success: true, message: 'Item deleted' });
}));

// ============================================================
// ATTACHMENTS
// ============================================================

/**
 * POST /api/submittals/:id/attachments
 * Add an attachment to a submittal
 */
router.post('/:id/attachments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, file_url, file_type, file_size, attachment_type, uploaded_by } = req.body;

  if (!name || !file_url) {
    return res.status(400).json({ error: 'Name and file URL are required' });
  }

  const { data, error } = await supabase
    .from('v2_submittal_attachments')
    .insert({
      submittal_id: id,
      name,
      file_url,
      file_type,
      file_size,
      attachment_type: attachment_type || 'submission',
      uploaded_by: uploaded_by || 'Jake Ross'
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /api/submittals/:submittalId/attachments/:attachmentId
 * Delete an attachment
 */
router.delete('/:submittalId/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const { attachmentId } = req.params;

  const { error } = await supabase
    .from('v2_submittal_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
  res.json({ success: true, message: 'Attachment deleted' });
}));

module.exports = router;
