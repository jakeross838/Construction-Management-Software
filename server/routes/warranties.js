/**
 * Warranties API Routes
 * Manages warranties and claims
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// WARRANTIES - LIST & STATS
// ============================================================

/**
 * GET /api/warranties
 * List warranties with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, type, category, expiring_soon } = req.query;

  let query = supabase
    .from('v2_warranties')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .order('end_date', { ascending: true });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (type) query = query.eq('type', type);
  if (category) query = query.eq('category', category);

  // Filter for warranties expiring within 90 days
  if (expiring_soon === 'true') {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    query = query.eq('status', 'active').lte('end_date', futureDate.toISOString().split('T')[0]);
  }

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/warranties/stats
 * Get warranty statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_warranties')
    .select('status, end_date')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw error;

  const today = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);

  const stats = {
    total: data?.length || 0,
    active: 0,
    expired: 0,
    claimed: 0,
    expiring_soon: 0
  };

  (data || []).forEach(w => {
    if (stats[w.status] !== undefined) stats[w.status]++;
    if (w.status === 'active' && new Date(w.end_date) <= ninetyDaysFromNow) {
      stats.expiring_soon++;
    }
  });

  res.json(stats);
}));

// ============================================================
// CLAIMS - must be before /:id routes to avoid route conflict
// ============================================================

/**
 * GET /api/warranties/:id/claims
 * List claims for a warranty
 */
router.get('/:id/claims', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;

  let query = supabase
    .from('v2_warranty_claims')
    .select('*')
    .eq('warranty_id', id)
    .order('claim_date', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data || []);
}));

/**
 * POST /api/warranties/:id/claims
 * Create a claim
 */
router.post('/:id/claims', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { issue_description, claim_date, claim_amount, created_by, notes } = req.body;

  if (!issue_description || !claim_date) {
    return res.status(400).json({
      error: 'Issue description and claim date are required'
    });
  }

  // Generate claim number
  const { count } = await supabase
    .from('v2_warranty_claims')
    .select('*', { count: 'exact', head: true })
    .eq('warranty_id', id);

  const claimNumber = `CLM-${(count || 0) + 1}`.padStart(3, '0');

  const { data, error } = await supabase
    .from('v2_warranty_claims')
    .insert({
      warranty_id: id,
      claim_number: claimNumber,
      issue_description,
      claim_date,
      claim_amount,
      created_by: created_by || 'Jake Ross',
      notes,
      status: 'submitted'
    })
    .select()
    .single();

  if (error) throw error;

  // Update warranty claim count and last claim date
  await supabase
    .from('v2_warranties')
    .update({
      claim_count: (count || 0) + 1,
      last_claim_date: claim_date,
      status: 'claimed'
    })
    .eq('id', id);

  res.status(201).json(data);
}));

/**
 * PATCH /api/warranties/:warrantyId/claims/:claimId
 * Update a claim
 */
router.patch('/:warrantyId/claims/:claimId', asyncHandler(async (req, res) => {
  const { claimId } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.claim_number;

  const { data, error } = await supabase
    .from('v2_warranty_claims')
    .update(updates)
    .eq('id', claimId)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  res.json(data);
}));

/**
 * POST /api/warranties/:warrantyId/claims/:claimId/resolve
 * Resolve a claim
 */
router.post('/:warrantyId/claims/:claimId/resolve', asyncHandler(async (req, res) => {
  const { claimId } = req.params;
  const { resolution_description, approved_amount, resolved_by } = req.body;

  const { data, error } = await supabase
    .from('v2_warranty_claims')
    .update({
      status: 'completed',
      resolution_description,
      approved_amount,
      resolution_date: new Date().toISOString().split('T')[0],
      resolved_by: resolved_by || 'Jake Ross'
    })
    .eq('id', claimId)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Claim not found' });
  }

  res.json(data);
}));

// ============================================================
// ATTACHMENTS - must be before /:id routes to avoid route conflict
// ============================================================

/**
 * POST /api/warranties/:id/attachments
 * Add attachment
 */
router.post('/:id/attachments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, file_url, file_type, file_size, attachment_type, uploaded_by } = req.body;

  if (!name || !file_url) {
    return res.status(400).json({ error: 'Name and file URL are required' });
  }

  const { data, error } = await supabase
    .from('v2_warranty_attachments')
    .insert({
      warranty_id: id,
      name,
      file_url,
      file_type,
      file_size,
      attachment_type: attachment_type || 'warranty',
      uploaded_by: uploaded_by || 'Jake Ross'
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /api/warranties/:warrantyId/attachments/:attachmentId
 * Delete attachment
 */
router.delete('/:warrantyId/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const { attachmentId } = req.params;

  const { error } = await supabase
    .from('v2_warranty_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
  res.json({ success: true, message: 'Attachment deleted' });
}));

// ============================================================
// WARRANTY CRUD - single warranty operations (/:id)
// ============================================================

/**
 * GET /api/warranties/:id
 * Get a single warranty with claims and attachments
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get warranty
  const { data: warranty, error: warrantyError } = await supabase
    .from('v2_warranties')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (warrantyError) throw warrantyError;
  if (!warranty) {
    return res.status(404).json({ error: 'Warranty not found' });
  }

  // Get claims
  const { data: claims } = await supabase
    .from('v2_warranty_claims')
    .select('*')
    .eq('warranty_id', id)
    .order('claim_date', { ascending: false });

  // Get attachments
  const { data: attachments } = await supabase
    .from('v2_warranty_attachments')
    .select('*')
    .eq('warranty_id', id)
    .order('created_at');

  res.json({
    ...warranty,
    claims: claims || [],
    attachments: attachments || []
  });
}));

/**
 * POST /api/warranties
 * Create a new warranty
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    name,
    description,
    type,
    category,
    coverage_details,
    vendor_id,
    manufacturer,
    model_number,
    serial_number,
    contact_name,
    contact_phone,
    contact_email,
    start_date,
    end_date,
    installation_date,
    notes
  } = req.body;

  if (!job_id || !name || !start_date || !end_date) {
    return res.status(400).json({
      error: 'Job, name, start date, and end date are required'
    });
  }

  const { data, error } = await supabase
    .from('v2_warranties')
    .insert({
      job_id,
      name,
      description,
      type: type || 'manufacturer',
      category,
      coverage_details,
      vendor_id: vendor_id || null,
      manufacturer,
      model_number,
      serial_number,
      contact_name,
      contact_phone,
      contact_email,
      start_date,
      end_date,
      installation_date,
      notes,
      status: 'active'
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/warranties/:id
 * Update a warranty
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.warranty_number;

  const { data, error } = await supabase
    .from('v2_warranties')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Warranty not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/warranties/:id
 * Soft delete a warranty
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_warranties')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Warranty not found' });
  }

  res.json({ success: true, message: 'Warranty deleted' });
}));

module.exports = router;
