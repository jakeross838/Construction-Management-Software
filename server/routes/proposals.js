/**
 * Proposals API Routes
 * CRUD operations, PDF generation, and sharing
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const { generateProposalPDF } = require('../services/proposal-generator');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// GET /api/proposals - List proposals (optionally filter by job/estimate)
// ============================================================
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, estimate_id, status } = req.query;

  let query = supabase
    .from('v2_proposals')
    .select(`
      *,
      estimate:v2_estimates(id, title, total_amount),
      job:v2_jobs(id, name, address, client_name)
    `)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (estimate_id) query = query.eq('estimate_id', estimate_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    logger.error('Error fetching proposals', { component: 'Proposal', error: error.message });
    return res.status(500).json({ error: error.message });
  }

  res.json(data || []);
}));

// ============================================================
// GET /api/proposals/:id - Get single proposal with details
// ============================================================
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_proposals')
    .select(`
      *,
      estimate:v2_estimates(
        id, title, total_amount, status, notes,
        overhead_percent, overhead_amount,
        profit_percent, profit_amount,
        contingency_percent, contingency_amount
      ),
      job:v2_jobs(id, name, address, client_name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    logger.error('Error fetching proposal', { component: 'Proposal', id, error: error.message });
    return res.status(404).json({ error: 'Proposal not found' });
  }

  res.json(data);
}));

// ============================================================
// POST /api/proposals - Create new proposal from estimate
// ============================================================
router.post('/', asyncHandler(async (req, res) => {
  const {
    estimate_id,
    title,
    detail_level = 'summary',
    show_allowances = true,
    payment_terms,
    terms_text,
    created_by
  } = req.body;

  if (!estimate_id) {
    return res.status(400).json({ error: 'estimate_id is required' });
  }

  // Get estimate to get job_id
  const { data: estimate, error: estError } = await supabase
    .from('v2_estimates')
    .select('id, job_id, title')
    .eq('id', estimate_id)
    .single();

  if (estError || !estimate) {
    return res.status(404).json({ error: 'Estimate not found' });
  }

  // Get default payment terms if not provided
  let finalPaymentTerms = payment_terms;
  if (!finalPaymentTerms) {
    const { data: settings } = await supabase
      .from('v2_company_settings')
      .select('default_payment_terms')
      .single();
    finalPaymentTerms = settings?.default_payment_terms || [];
  }

  // Create proposal
  const { data, error } = await supabase
    .from('v2_proposals')
    .insert({
      estimate_id,
      job_id: estimate.job_id,
      title: title || `Proposal for ${estimate.title}`,
      detail_level,
      show_allowances,
      payment_terms: finalPaymentTerms,
      terms_text,
      created_by: created_by || 'system'
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating proposal', { component: 'Proposal', error: error.message });
    return res.status(500).json({ error: error.message });
  }

  res.status(201).json(data);
}));

// ============================================================
// POST /api/proposals/:id/generate - Generate PDF for proposal
// ============================================================
router.post('/:id/generate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get proposal with all related data
  const { data: proposal, error: propError } = await supabase
    .from('v2_proposals')
    .select(`
      *,
      estimate:v2_estimates(
        id, title, total_amount, notes,
        overhead_percent, overhead_amount,
        profit_percent, profit_amount,
        contingency_percent, contingency_amount
      ),
      job:v2_jobs(id, name, address, client_name)
    `)
    .eq('id', id)
    .single();

  if (propError || !proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  // Get estimate sections and items
  const { data: sections } = await supabase
    .from('v2_estimate_sections')
    .select('id, name, description, subtotal, sort_order')
    .eq('estimate_id', proposal.estimate_id)
    .order('sort_order');

  // Get line items for each section
  const sectionsWithItems = await Promise.all((sections || []).map(async section => {
    const { data: items } = await supabase
      .from('v2_estimate_lines')
      .select('id, description, amount, is_allowance, allowance_notes')
      .eq('section_id', section.id)
      .order('sort_order');
    return { ...section, items: items || [] };
  }));

  // If no sections, get all estimate lines as one section
  if (!sectionsWithItems || sectionsWithItems.length === 0) {
    const { data: allItems } = await supabase
      .from('v2_estimate_lines')
      .select('id, description, amount, is_allowance, allowance_notes')
      .eq('estimate_id', proposal.estimate_id)
      .order('sort_order');

    sectionsWithItems.push({
      name: 'Scope of Work',
      subtotal: proposal.estimate?.total_amount || 0,
      items: allItems || []
    });
  }

  // Get company settings
  const { data: company } = await supabase
    .from('v2_company_settings')
    .select('*')
    .single();

  // Calculate subtotal (sum of sections or total_amount)
  const subtotal = sectionsWithItems.reduce((sum, s) => sum + (parseFloat(s.subtotal) || 0), 0) ||
    proposal.estimate?.total_amount || 0;

  // Generate PDF
  const pdfBuffer = await generateProposalPDF({
    company: company || { company_name: 'Ross Built Custom Homes' },
    job: proposal.job || {},
    estimate: {
      ...proposal.estimate,
      subtotal,
      sections: sectionsWithItems
    },
    proposal: {
      proposal_number: proposal.proposal_number,
      detail_level: proposal.detail_level,
      show_allowances: proposal.show_allowances,
      payment_terms: proposal.payment_terms || [],
      terms_text: proposal.terms_text
    }
  });

  // Upload to Supabase Storage
  const storagePath = `proposals/${proposal.id}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from('proposals')
    .upload(storagePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    // Try creating bucket if it doesn't exist
    if (uploadError.message.includes('not found')) {
      await supabase.storage.createBucket('proposals', { public: false });
      await supabase.storage.from('proposals').upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true
      });
    } else {
      logger.error('Error uploading PDF', { component: 'Proposal', id, error: uploadError.message });
      return res.status(500).json({ error: 'Failed to upload PDF' });
    }
  }

  // Get public URL (we'll use signed URLs for sharing)
  const { data: urlData } = supabase.storage.from('proposals').getPublicUrl(storagePath);

  // Update proposal with PDF info
  const { data: updated, error: updateError } = await supabase
    .from('v2_proposals')
    .update({
      pdf_url: urlData.publicUrl,
      pdf_generated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    logger.error('Error updating proposal', { component: 'Proposal', id, error: updateError.message });
  }

  res.json({
    success: true,
    pdf_url: urlData.publicUrl,
    proposal: updated
  });
}));

// ============================================================
// POST /api/proposals/:id/share - Generate shareable link
// ============================================================
router.post('/:id/share', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { expires_in_days = 30 } = req.body;

  // Generate unique token
  const shareToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expires_in_days);

  // Update proposal with share token
  const { data, error } = await supabase
    .from('v2_proposals')
    .update({
      share_token: shareToken,
      share_expires_at: expiresAt.toISOString(),
      status: 'sent'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error creating share link', { component: 'Proposal', id, error: error.message });
    return res.status(500).json({ error: error.message });
  }

  // Build shareable URL
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  const shareUrl = `${baseUrl}/proposal-view.html?token=${shareToken}`;

  res.json({
    share_url: shareUrl,
    expires_at: expiresAt,
    proposal: data
  });
}));

// ============================================================
// PATCH /api/proposals/:id - Update proposal
// ============================================================
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Remove read-only fields
  delete updates.id;
  delete updates.proposal_number;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('v2_proposals')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    logger.error('Error updating proposal', { component: 'Proposal', id, error: error.message });
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
}));

// ============================================================
// DELETE /api/proposals/:id - Delete proposal
// ============================================================
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Delete from storage first
  await supabase.storage.from('proposals').remove([`proposals/${id}.pdf`]);

  // Delete from database
  const { error } = await supabase
    .from('v2_proposals')
    .delete()
    .eq('id', id);

  if (error) {
    logger.error('Error deleting proposal', { component: 'Proposal', id, error: error.message });
    return res.status(500).json({ error: error.message });
  }

  res.json({ success: true });
}));

// ============================================================
// PUBLIC ROUTES (no auth required - token-based access)
// ============================================================

// GET /api/proposals/public/:token - Get proposal by share token (client view)
router.get('/public/:token', asyncHandler(async (req, res) => {
  const { token } = req.params;

  // Find proposal by token
  const { data: proposal, error } = await supabase
    .from('v2_proposals')
    .select(`
      id, proposal_number, title, detail_level, status,
      pdf_url, share_expires_at, view_count,
      accepted_at, accepted_by_name,
      payment_terms, terms_text,
      estimate:v2_estimates(id, title, total_amount),
      job:v2_jobs(id, name, address, client_name)
    `)
    .eq('share_token', token)
    .single();

  if (error || !proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  // Check expiration
  if (proposal.share_expires_at && new Date(proposal.share_expires_at) < new Date()) {
    return res.status(410).json({ error: 'This proposal link has expired' });
  }

  // Increment view count and update last viewed (fire and forget)
  supabase
    .from('v2_proposals')
    .update({
      view_count: (proposal.view_count || 0) + 1,
      last_viewed_at: new Date().toISOString(),
      status: proposal.status === 'sent' ? 'viewed' : proposal.status
    })
    .eq('id', proposal.id)
    .then(() => {})
    .catch(err => logger.warn('Failed to update view count', { component: 'Proposal', proposalId: proposal.id, error: err.message }));

  res.json(proposal);
}));

// POST /api/proposals/public/:token/accept - Accept proposal (client action)
router.post('/public/:token/accept', asyncHandler(async (req, res) => {
  const { token } = req.params;
  const { accepted_by_name, accepted_by_email, notes } = req.body;

  // Validate required fields
  if (!accepted_by_name || !accepted_by_email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  // Simple email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(accepted_by_email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Find proposal by token
  const { data: proposal, error } = await supabase
    .from('v2_proposals')
    .select('id, estimate_id, status, share_expires_at')
    .eq('share_token', token)
    .single();

  if (error || !proposal) {
    return res.status(404).json({ error: 'Proposal not found' });
  }

  // Check expiration
  if (proposal.share_expires_at && new Date(proposal.share_expires_at) < new Date()) {
    return res.status(410).json({ error: 'This proposal link has expired' });
  }

  // Check if already accepted
  if (proposal.status === 'accepted') {
    return res.status(400).json({ error: 'This proposal has already been accepted' });
  }

  // Get client IP for audit
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Update proposal to accepted
  const { error: updateError } = await supabase
    .from('v2_proposals')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_by_name,
      accepted_by_email,
      accepted_ip: clientIP,
      acceptance_notes: notes || null
    })
    .eq('id', proposal.id);

  if (updateError) {
    logger.error('Error updating proposal', { component: 'Proposal', proposalId: proposal.id, error: updateError.message });
    return res.status(500).json({ error: 'Failed to accept proposal' });
  }

  // Update estimate status to approved (PRO-07)
  const { error: estError } = await supabase
    .from('v2_estimates')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: accepted_by_name
    })
    .eq('id', proposal.estimate_id);

  if (estError) {
    logger.error('Error updating estimate status', { component: 'Proposal', estimateId: proposal.estimate_id, error: estError.message });
    // Don't fail - proposal was accepted, estimate update is secondary
  }

  // Log activity
  await supabase
    .from('v2_estimate_activity')
    .insert({
      estimate_id: proposal.estimate_id,
      action: 'client_accepted_proposal',
      performed_by: accepted_by_name,
      details: {
        proposal_id: proposal.id,
        email: accepted_by_email,
        ip: clientIP,
        via: 'secure_link'
      }
    })
    .catch(err => logger.warn('Failed to log activity', { component: 'Proposal', error: err.message }));

  res.json({
    success: true,
    message: 'Proposal accepted successfully'
  });
}));

module.exports = router;
