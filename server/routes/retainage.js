/**
 * Retainage Routes
 * Manages retainage tracking and release functionality
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../core/errors');
const { validateRequest } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// HELPER: Log retainage activity
// ============================================================

async function logRetainageActivity(releaseId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_retainage_release_activity').insert({
      release_id: releaseId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    logger.error('Failed to log retainage activity', {
      component: 'Retainage',
      releaseId,
      error: err.message
    });
  }
}

// ============================================================
// GET /api/retainage/job/:jobId
// Get retainage summary for a job
// ============================================================

router.get('/job/:jobId', validateRequest({
  params: { jobId: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const builderId = getBuilderId(req);

  // Verify job exists and belongs to builder
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();

  if (jobError || !job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Call the database function to get summary
  const { data, error } = await supabase
    .rpc('get_job_retainage_summary', { p_job_id: jobId });

  if (error) {
    logger.error('Failed to get retainage summary', {
      component: 'Retainage',
      jobId,
      error: error.message
    });
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({
    ...data,
    job_name: job.name
  });
}));

// ============================================================
// GET /api/retainage/job/:jobId/details
// Get detailed retainage breakdown by cost code and vendor
// ============================================================

router.get('/job/:jobId/details', validateRequest({
  params: { jobId: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const builderId = getBuilderId(req);

  // Verify job exists and belongs to builder
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();

  if (jobError || !job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Call the database function to get details
  const { data, error } = await supabase
    .rpc('get_job_retainage_details', { p_job_id: jobId });

  if (error) {
    logger.error('Failed to get retainage details', {
      component: 'Retainage',
      jobId,
      error: error.message
    });
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({
    ...data,
    job_name: job.name
  });
}));

// ============================================================
// POST /api/retainage/release
// Create a retainage release
// ============================================================

router.post('/release', validateRequest({
  body: {
    job_id: { required: true, type: 'uuid' },
    amount: { required: true, type: 'number' }
  }
}), asyncHandler(async (req, res) => {
  const {
    job_id,
    vendor_id,
    cost_code_id,
    amount,
    release_date,
    invoice_id,
    client_invoice_id,
    notes,
    created_by = 'System'
  } = req.body;
  const builderId = getBuilderId(req);

  // Validate amount is positive
  if (amount <= 0) {
    return res.status(400).json({ error: 'Release amount must be positive' });
  }

  // Verify job exists
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', job_id)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();

  if (jobError || !job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Validate vendor if provided
  if (vendor_id) {
    const { data: vendor, error: vendorError } = await supabase
      .from('v2_vendors')
      .select('id')
      .eq('id', vendor_id)
      .single();

    if (vendorError || !vendor) {
      return res.status(400).json({ error: 'Invalid vendor_id' });
    }
  }

  // Validate cost code if provided
  if (cost_code_id) {
    const { data: costCode, error: ccError } = await supabase
      .from('v2_cost_codes')
      .select('id')
      .eq('id', cost_code_id)
      .single();

    if (ccError || !costCode) {
      return res.status(400).json({ error: 'Invalid cost_code_id' });
    }
  }

  // Validate invoice if provided
  if (invoice_id) {
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .select('id')
      .eq('id', invoice_id)
      .single();

    if (invError || !invoice) {
      return res.status(400).json({ error: 'Invalid invoice_id' });
    }
  }

  // Create the retainage release
  const insertData = {
    job_id,
    vendor_id: vendor_id || null,
    cost_code_id: cost_code_id || null,
    amount,
    release_date: release_date || new Date().toISOString().split('T')[0],
    invoice_id: invoice_id || null,
    client_invoice_id: client_invoice_id || null,
    notes: notes || null,
    created_by
  };

  if (builderId) {
    insertData.builder_id = builderId;
  }

  const { data: release, error: insertError } = await supabase
    .from('v2_retainage_releases')
    .insert(insertData)
    .select(`
      *,
      vendor:v2_vendors(id, name),
      cost_code:v2_cost_codes(id, code, name),
      invoice:v2_invoices(id, invoice_number)
    `)
    .single();

  if (insertError) {
    logger.error('Failed to create retainage release', {
      component: 'Retainage',
      jobId: job_id,
      error: insertError.message
    });
    throw new AppError('DATABASE_ERROR', insertError.message);
  }

  // Log activity
  await logRetainageActivity(release.id, 'created', created_by, {
    amount,
    vendor_id,
    cost_code_id,
    job_name: job.name
  });

  logger.info('Retainage release created', {
    component: 'Retainage',
    releaseId: release.id,
    jobId: job_id,
    amount
  });

  res.status(201).json(release);
}));

// ============================================================
// GET /api/retainage/releases/:jobId
// List all retainage releases for a job
// ============================================================

router.get('/releases/:jobId', validateRequest({
  params: { jobId: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const builderId = getBuilderId(req);

  // Verify job exists
  let jobQuery = supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .is('deleted_at', null);

  if (builderId) {
    jobQuery = jobQuery.eq('builder_id', builderId);
  }

  const { data: job, error: jobError } = await jobQuery.single();

  if (jobError || !job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Get all releases for this job
  let query = supabase
    .from('v2_retainage_releases')
    .select(`
      *,
      vendor:v2_vendors(id, name),
      cost_code:v2_cost_codes(id, code, name),
      invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(name)),
      client_invoice:v2_client_invoices(id, invoice_number, amount)
    `)
    .eq('job_id', jobId)
    .order('release_date', { ascending: false });

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data: releases, error } = await query;

  if (error) {
    logger.error('Failed to list retainage releases', {
      component: 'Retainage',
      jobId,
      error: error.message
    });
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Calculate totals
  const totalReleased = releases?.reduce((sum, r) => sum + parseFloat(r.amount || 0), 0) || 0;

  res.json({
    job_id: jobId,
    job_name: job.name,
    total_released: totalReleased,
    release_count: releases?.length || 0,
    releases: releases || []
  });
}));

// ============================================================
// GET /api/retainage/release/:id
// Get a single retainage release
// ============================================================

router.get('/release/:id', validateRequest({
  params: { id: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_retainage_releases')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      cost_code:v2_cost_codes(id, code, name),
      invoice:v2_invoices(id, invoice_number, amount),
      client_invoice:v2_client_invoices(id, invoice_number, amount),
      activity:v2_retainage_release_activity(id, action, performed_by, details, created_at)
    `)
    .eq('id', id);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data: release, error } = await query.single();

  if (error || !release) {
    return res.status(404).json({ error: 'Retainage release not found' });
  }

  res.json(release);
}));

// ============================================================
// PATCH /api/retainage/release/:id
// Update a retainage release
// ============================================================

router.patch('/release/:id', validateRequest({
  params: { id: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { amount, release_date, notes, invoice_id, client_invoice_id, updated_by = 'System' } = req.body;
  const builderId = getBuilderId(req);

  // Verify release exists
  let query = supabase
    .from('v2_retainage_releases')
    .select('id, amount')
    .eq('id', id);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data: existing, error: fetchError } = await query.single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Retainage release not found' });
  }

  // Build update object
  const updateData = { updated_at: new Date().toISOString() };
  if (amount !== undefined) {
    if (amount <= 0) {
      return res.status(400).json({ error: 'Release amount must be positive' });
    }
    updateData.amount = amount;
  }
  if (release_date !== undefined) updateData.release_date = release_date;
  if (notes !== undefined) updateData.notes = notes;
  if (invoice_id !== undefined) updateData.invoice_id = invoice_id;
  if (client_invoice_id !== undefined) updateData.client_invoice_id = client_invoice_id;

  const { data: release, error: updateError } = await supabase
    .from('v2_retainage_releases')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      vendor:v2_vendors(id, name),
      cost_code:v2_cost_codes(id, code, name),
      invoice:v2_invoices(id, invoice_number)
    `)
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', updateError.message);
  }

  // Log activity
  await logRetainageActivity(id, 'updated', updated_by, {
    previous_amount: existing.amount,
    new_amount: release.amount,
    changes: Object.keys(updateData).filter(k => k !== 'updated_at')
  });

  res.json(release);
}));

// ============================================================
// DELETE /api/retainage/release/:id
// Delete a retainage release
// ============================================================

router.delete('/release/:id', validateRequest({
  params: { id: { type: 'uuid' } }
}), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleted_by = 'System' } = req.body || {};
  const builderId = getBuilderId(req);

  // Verify release exists
  let query = supabase
    .from('v2_retainage_releases')
    .select('id, job_id, amount')
    .eq('id', id);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data: existing, error: fetchError } = await query.single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Retainage release not found' });
  }

  // Delete activity first (cascade should handle this, but be explicit)
  await supabase
    .from('v2_retainage_release_activity')
    .delete()
    .eq('release_id', id);

  // Delete the release
  const { error: deleteError } = await supabase
    .from('v2_retainage_releases')
    .delete()
    .eq('id', id);

  if (deleteError) {
    throw new AppError('DATABASE_ERROR', deleteError.message);
  }

  logger.info('Retainage release deleted', {
    component: 'Retainage',
    releaseId: id,
    jobId: existing.job_id,
    amount: existing.amount,
    deletedBy: deleted_by
  });

  res.json({ success: true, message: 'Retainage release deleted' });
}));

// ============================================================
// GET /api/retainage/stats
// Get company-wide retainage statistics
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  // Get all active jobs with retainage
  let jobsQuery = supabase
    .from('v2_jobs')
    .select('id')
    .eq('status', 'active')
    .is('deleted_at', null);

  if (builderId) {
    jobsQuery = jobsQuery.eq('builder_id', builderId);
  }

  const { data: jobs } = await jobsQuery;
  const jobIds = (jobs || []).map(j => j.id);

  if (jobIds.length === 0) {
    return res.json({
      total_retainage_held: 0,
      total_retainage_released: 0,
      retainage_balance: 0,
      job_count: 0
    });
  }

  // Calculate total retainage held across all jobs
  const { data: allocations } = await supabase
    .from('v2_invoice_allocations')
    .select('amount, retainage_percent, invoice:v2_invoices!inner(job_id, status, deleted_at)')
    .in('invoice.job_id', jobIds)
    .in('invoice.status', ['approved', 'in_draw', 'paid'])
    .is('invoice.deleted_at', null);

  const totalHeld = (allocations || []).reduce((sum, a) => {
    const retPct = parseFloat(a.retainage_percent || 10) / 100;
    return sum + (parseFloat(a.amount || 0) * retPct);
  }, 0);

  // Get total released
  let releasesQuery = supabase
    .from('v2_retainage_releases')
    .select('amount')
    .in('job_id', jobIds);

  if (builderId) {
    releasesQuery = releasesQuery.eq('builder_id', builderId);
  }

  const { data: releases } = await releasesQuery;
  const totalReleased = (releases || []).reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

  res.json({
    total_retainage_held: totalHeld,
    total_retainage_released: totalReleased,
    retainage_balance: totalHeld - totalReleased,
    job_count: jobIds.length
  });
}));

module.exports = router;
