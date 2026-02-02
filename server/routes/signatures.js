/**
 * E-Signatures Routes
 * Manage signature requests, capture signatures, and audit trail
 * Supports internal signatures and external providers (DocuSign, HelloSign)
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// STATS
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { document_type, document_id } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_signature_requests')
    .select('id, status, external_provider, document_type')
    .is('deleted_at', null);

  if (builderId) query = query.eq('builder_id', builderId);
  if (document_type) query = query.eq('document_type', document_type);
  if (document_id) query = query.eq('document_id', document_id);

  const { data: requests, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total: requests?.length || 0,
    by_status: {},
    by_document_type: {},
    by_provider: {},
    awaiting_signature: 0
  };

  for (const req of (requests || [])) {
    stats.by_status[req.status] = (stats.by_status[req.status] || 0) + 1;
    stats.by_document_type[req.document_type] = (stats.by_document_type[req.document_type] || 0) + 1;
    stats.by_provider[req.external_provider || 'internal'] =
      (stats.by_provider[req.external_provider || 'internal'] || 0) + 1;

    if (req.status === 'pending') {
      stats.awaiting_signature++;
    }
  }

  res.json(stats);
}));

// ============================================================
// SIGNATURE REQUESTS - LIST
// ============================================================

router.get('/requests', asyncHandler(async (req, res) => {
  const {
    document_type,
    document_id,
    status,
    external_provider,
    search,
    limit = 50,
    offset = 0
  } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_signature_requests')
    .select('*')
    .is('deleted_at', null);

  if (builderId) query = query.eq('builder_id', builderId);
  if (document_type) query = query.eq('document_type', document_type);
  if (document_id) query = query.eq('document_id', document_id);
  if (status) query = query.eq('status', status);
  if (external_provider) query = query.eq('external_provider', external_provider);
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ requests: data || [] });
}));

// ============================================================
// SIGNATURE REQUESTS - GET SINGLE
// ============================================================

router.get('/requests/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_signature_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) query = query.eq('builder_id', builderId);

  const { data: request, error } = await query.single();

  if (error || !request) {
    throw new AppError('NOT_FOUND', 'Signature request not found');
  }

  // Get associated signatures
  const { data: signatures } = await supabase
    .from('v2_signatures')
    .select('*')
    .eq('request_id', id)
    .order('signed_at', { ascending: true });

  res.json({
    request: {
      ...request,
      signatures: signatures || []
    }
  });
}));

// ============================================================
// SIGNATURE REQUESTS - CREATE
// ============================================================

router.post('/requests', asyncHandler(async (req, res) => {
  const {
    document_id,
    document_type,
    title,
    description,
    message,
    signers,
    external_provider,
    expires_at,
    original_document_url,
    created_by
  } = req.body;
  const builderId = getBuilderId(req);

  if (!document_id || !document_type || !title) {
    throw new AppError('VALIDATION_FAILED', 'Document ID, document type, and title are required');
  }

  // Validate and format signers
  const formattedSigners = (signers || []).map((signer, index) => ({
    name: signer.name,
    email: signer.email,
    role: signer.role || 'signer',
    order: signer.order ?? index + 1,
    status: 'pending',
    signed_at: null,
    signature_id: null,
    declined_at: null,
    decline_reason: null
  }));

  const requestData = {
    document_id,
    document_type,
    title,
    description,
    message,
    signers: formattedSigners,
    external_provider: external_provider || 'internal',
    expires_at,
    original_document_url,
    created_by: created_by || req.headers['x-user-name'] || 'User',
    status: 'draft'
  };

  if (builderId) requestData.builder_id = builderId;

  const { data, error } = await supabase
    .from('v2_signature_requests')
    .insert(requestData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log audit
  await supabase.from('v2_signature_audit').insert({
    request_id: data.id,
    action: 'created',
    actor_email: created_by || req.headers['x-user-email'],
    actor_name: req.headers['x-user-name'],
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    details: { document_type, document_id, signers_count: formattedSigners.length }
  });

  res.status(201).json({ request: data });
}));

// ============================================================
// SIGNATURE REQUESTS - UPDATE
// ============================================================

router.patch('/requests/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  const updatedBy = updates.updated_by || req.headers['x-user-name'] || 'User';

  // Don't allow updating certain fields
  delete updates.id;
  delete updates.created_at;
  delete updates.deleted_at;
  delete updates.updated_by;

  // Get current request
  const { data: current, error: fetchError } = await supabase
    .from('v2_signature_requests')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !current) {
    throw new AppError('NOT_FOUND', 'Signature request not found');
  }

  // Only allow updates on draft or pending requests
  if (!['draft', 'pending'].includes(current.status)) {
    throw new AppError('VALIDATION_FAILED', 'Cannot update a completed, declined, or cancelled request');
  }

  const { data, error } = await supabase
    .from('v2_signature_requests')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log audit
  await supabase.from('v2_signature_audit').insert({
    request_id: id,
    action: 'updated',
    actor_name: updatedBy,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    details: { updated_fields: Object.keys(updates) }
  });

  res.json({ request: data });
}));

// ============================================================
// SIGNATURE REQUESTS - SEND
// ============================================================

router.post('/requests/:id/send', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sent_by, message } = req.body;

  const { data: request, error: fetchError } = await supabase
    .from('v2_signature_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !request) {
    throw new AppError('NOT_FOUND', 'Signature request not found');
  }

  if (request.status !== 'draft') {
    throw new AppError('VALIDATION_FAILED', 'Request has already been sent');
  }

  if (!request.signers || request.signers.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'At least one signer is required');
  }

  const updateData = {
    status: 'pending',
    sent_at: new Date().toISOString()
  };

  if (message) updateData.message = message;

  // TODO: If external_provider is 'docusign' or 'hellosign', call external API here
  // For now, we handle internal signatures only
  if (request.external_provider && request.external_provider !== 'internal') {
    // Placeholder for external provider integration
    // Would call DocuSign/HelloSign API and get external_id, external_envelope_url
    updateData.external_status = 'sent';
  }

  const { data, error } = await supabase
    .from('v2_signature_requests')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log audit
  await supabase.from('v2_signature_audit').insert({
    request_id: id,
    action: 'sent',
    actor_email: sent_by || req.headers['x-user-email'],
    actor_name: sent_by || req.headers['x-user-name'],
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    details: { signers: request.signers.map(s => s.email) }
  });

  // TODO: Send notification emails to signers

  res.json({ request: data });
}));

// ============================================================
// SIGNATURE REQUESTS - SIGN (Internal)
// ============================================================

router.post('/requests/:id/sign', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    signer_email,
    signer_name,
    signature_type = 'drawn',
    signature_data,
    typed_name
  } = req.body;

  if (!signer_email) {
    throw new AppError('VALIDATION_FAILED', 'Signer email is required');
  }

  if (signature_type === 'drawn' && !signature_data) {
    throw new AppError('VALIDATION_FAILED', 'Signature data is required for drawn signatures');
  }

  if (signature_type === 'typed' && !typed_name) {
    throw new AppError('VALIDATION_FAILED', 'Typed name is required for typed signatures');
  }

  const { data: request, error: fetchError } = await supabase
    .from('v2_signature_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !request) {
    throw new AppError('NOT_FOUND', 'Signature request not found');
  }

  if (request.status !== 'pending') {
    throw new AppError('VALIDATION_FAILED', 'Request is not pending signatures');
  }

  // Check if this signer is in the signers list
  const signerIndex = request.signers.findIndex(
    s => s.email.toLowerCase() === signer_email.toLowerCase()
  );

  if (signerIndex === -1) {
    throw new AppError('VALIDATION_FAILED', 'Signer not found in request');
  }

  const signer = request.signers[signerIndex];

  if (signer.signed_at) {
    throw new AppError('VALIDATION_FAILED', 'This signer has already signed');
  }

  // Check signing order (if order matters)
  const previousSigners = request.signers.filter(s => s.order < signer.order);
  const allPreviousSigned = previousSigners.every(s => s.signed_at);
  if (!allPreviousSigned) {
    throw new AppError('VALIDATION_FAILED', 'Previous signers must sign first');
  }

  // Create signature record
  const { data: signature, error: sigError } = await supabase
    .from('v2_signatures')
    .insert({
      request_id: id,
      signer_email,
      signer_name: signer_name || signer.name,
      signer_role: signer.role,
      signature_type,
      signature_data,
      typed_name,
      ip_address: req.ip,
      user_agent: req.headers['user-agent']
    })
    .select()
    .single();

  if (sigError) throw new AppError('DATABASE_ERROR', sigError.message);

  // Update signer in the request
  const updatedSigners = [...request.signers];
  updatedSigners[signerIndex] = {
    ...signer,
    status: 'signed',
    signed_at: new Date().toISOString(),
    signature_id: signature.id
  };

  const { data: updatedRequest, error: updateError } = await supabase
    .from('v2_signature_requests')
    .update({ signers: updatedSigners })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Log audit
  await supabase.from('v2_signature_audit').insert({
    request_id: id,
    action: 'signed',
    actor_email: signer_email,
    actor_name: signer_name || signer.name,
    actor_role: signer.role,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    details: { signature_type, signature_id: signature.id }
  });

  res.json({
    request: updatedRequest,
    signature
  });
}));

// ============================================================
// SIGNATURE REQUESTS - DECLINE
// ============================================================

router.post('/requests/:id/decline', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signer_email, decline_reason } = req.body;

  if (!signer_email) {
    throw new AppError('VALIDATION_FAILED', 'Signer email is required');
  }

  const { data: request, error: fetchError } = await supabase
    .from('v2_signature_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !request) {
    throw new AppError('NOT_FOUND', 'Signature request not found');
  }

  if (request.status !== 'pending') {
    throw new AppError('VALIDATION_FAILED', 'Request is not pending signatures');
  }

  const signerIndex = request.signers.findIndex(
    s => s.email.toLowerCase() === signer_email.toLowerCase()
  );

  if (signerIndex === -1) {
    throw new AppError('VALIDATION_FAILED', 'Signer not found in request');
  }

  const signer = request.signers[signerIndex];

  // Update signer status
  const updatedSigners = [...request.signers];
  updatedSigners[signerIndex] = {
    ...signer,
    status: 'declined',
    declined_at: new Date().toISOString(),
    decline_reason
  };

  const { data: updatedRequest, error: updateError } = await supabase
    .from('v2_signature_requests')
    .update({
      signers: updatedSigners,
      status: 'declined'
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Log audit
  await supabase.from('v2_signature_audit').insert({
    request_id: id,
    action: 'declined',
    actor_email: signer_email,
    actor_name: signer.name,
    actor_role: signer.role,
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    details: { decline_reason }
  });

  res.json({ request: updatedRequest });
}));

// ============================================================
// SIGNATURE REQUESTS - CANCEL
// ============================================================

router.post('/requests/:id/cancel', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cancelled_by, reason } = req.body;

  const { data: request, error: fetchError } = await supabase
    .from('v2_signature_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !request) {
    throw new AppError('NOT_FOUND', 'Signature request not found');
  }

  if (['completed', 'cancelled'].includes(request.status)) {
    throw new AppError('VALIDATION_FAILED', 'Cannot cancel a completed or already cancelled request');
  }

  const { data, error } = await supabase
    .from('v2_signature_requests')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log audit
  await supabase.from('v2_signature_audit').insert({
    request_id: id,
    action: 'cancelled',
    actor_email: cancelled_by || req.headers['x-user-email'],
    actor_name: cancelled_by || req.headers['x-user-name'],
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    details: { reason }
  });

  res.json({ request: data });
}));

// ============================================================
// SIGNATURE REQUESTS - RESEND
// ============================================================

router.post('/requests/:id/resend', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { signer_email, resent_by } = req.body;

  const { data: request, error: fetchError } = await supabase
    .from('v2_signature_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !request) {
    throw new AppError('NOT_FOUND', 'Signature request not found');
  }

  if (request.status !== 'pending') {
    throw new AppError('VALIDATION_FAILED', 'Can only resend pending requests');
  }

  // TODO: Resend notification email

  // Log audit
  await supabase.from('v2_signature_audit').insert({
    request_id: id,
    action: 'resent',
    actor_email: resent_by || req.headers['x-user-email'],
    actor_name: resent_by || req.headers['x-user-name'],
    ip_address: req.ip,
    user_agent: req.headers['user-agent'],
    details: { resent_to: signer_email || 'all pending signers' }
  });

  res.json({ success: true, message: 'Reminder sent' });
}));

// ============================================================
// AUDIT TRAIL
// ============================================================

router.get('/requests/:id/audit', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  const { data, error } = await supabase
    .from('v2_signature_audit')
    .select('*')
    .eq('request_id', id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ audit: data || [] });
}));

// ============================================================
// SIGNATURE TEMPLATES
// ============================================================

router.get('/templates', asyncHandler(async (req, res) => {
  const { document_type, is_active } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_signature_templates')
    .select('*');

  if (builderId) query = query.eq('builder_id', builderId);
  if (document_type) query = query.eq('document_type', document_type);
  if (is_active !== undefined) query = query.eq('is_active', is_active === 'true');

  const { data, error } = await query.order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ templates: data || [] });
}));

router.post('/templates', asyncHandler(async (req, res) => {
  const {
    name,
    description,
    document_type,
    default_signers,
    default_message,
    default_expiration_days,
    created_by
  } = req.body;
  const builderId = getBuilderId(req);

  if (!name || !document_type) {
    throw new AppError('VALIDATION_FAILED', 'Name and document type are required');
  }

  const templateData = {
    name,
    description,
    document_type,
    default_signers: default_signers || [],
    default_message,
    default_expiration_days: default_expiration_days || 30,
    created_by: created_by || req.headers['x-user-name'] || 'User'
  };

  if (builderId) templateData.builder_id = builderId;

  const { data, error } = await supabase
    .from('v2_signature_templates')
    .insert(templateData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json({ template: data });
}));

// ============================================================
// WEBHOOK ENDPOINT FOR EXTERNAL PROVIDERS
// ============================================================

router.post('/webhook/:provider', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const payload = req.body;

  console.log(`Received ${provider} webhook:`, JSON.stringify(payload, null, 2));

  // TODO: Implement actual webhook handling for DocuSign/HelloSign
  // This would:
  // 1. Verify webhook signature
  // 2. Parse the event type
  // 3. Update the signature request status
  // 4. Update signer statuses
  // 5. Log audit events

  switch (provider) {
    case 'docusign':
      // Handle DocuSign Connect webhooks
      // https://developers.docusign.com/platform/webhooks/connect/
      break;

    case 'hellosign':
      // Handle HelloSign webhooks
      // https://developers.hellosign.com/api/reference/webhooks/
      break;

    default:
      throw new AppError('VALIDATION_FAILED', `Unknown provider: ${provider}`);
  }

  res.json({ received: true });
}));

// ============================================================
// DELETE SIGNATURE REQUEST (Soft delete)
// ============================================================

router.delete('/requests/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_signature_requests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Signature request not found');

  res.json({ success: true });
}));

// ============================================================
// VIEW TRACKING (for when signer views document)
// ============================================================

router.post('/requests/:id/view', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { viewer_email, viewer_name } = req.body;

  // Log view event
  await supabase.from('v2_signature_audit').insert({
    request_id: id,
    action: 'viewed',
    actor_email: viewer_email,
    actor_name: viewer_name,
    ip_address: req.ip,
    user_agent: req.headers['user-agent']
  });

  res.json({ success: true });
}));

module.exports = router;
