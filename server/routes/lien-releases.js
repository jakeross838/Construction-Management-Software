/**
 * Lien Release Routes
 * All lien release management endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { asyncHandler } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const { uploadPDF } = require('../core/storage');

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// Helper: Log lien release activity
async function logLienReleaseActivity(lienReleaseId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_lien_release_activity').insert({
      lien_release_id: lienReleaseId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Failed to log lien release activity:', err);
  }
}

// ============================================================
// LIST & GET ENDPOINTS
// ============================================================

// List lien releases with filters
router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, vendor_id, draw_id, status, search, limit = 100 } = req.query;

  let query = supabase
    .from('v2_lien_releases')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      draw:v2_draws(id, draw_number, status)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (job_id) query = query.eq('job_id', job_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (draw_id) query = query.eq('draw_id', draw_id);
  if (status && status !== 'all') query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;

  // Apply search filter client-side (for vendor/job names)
  let filtered = data || [];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(lr =>
      (lr.vendor?.name || '').toLowerCase().includes(q) ||
      (lr.job?.name || '').toLowerCase().includes(q) ||
      (lr.signer_name || '').toLowerCase().includes(q)
    );
  }

  res.json(filtered);
}));

// Get single lien release with details
router.get('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lien_releases')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      vendor:v2_vendors(id, name),
      draw:v2_draws(id, draw_number, status, job_id)
    `)
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Lien release not found' });
  }

  // Get activity log
  const { data: activity } = await supabase
    .from('v2_lien_release_activity')
    .select('*')
    .eq('lien_release_id', id)
    .order('created_at', { ascending: false });

  res.json({ ...data, activity: activity || [] });
}));

// ============================================================
// UPLOAD & PROCESS ENDPOINTS
// ============================================================

// Simple upload (no AI processing)
router.post('/upload', upload.single('pdf'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  const { job_id, vendor_id, release_type, amount, through_date, release_date, notes, uploaded_by } = req.body;

  // Validate release_type
  const validTypes = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'];
  if (!release_type || !validTypes.includes(release_type)) {
    return res.status(400).json({ error: 'Invalid release_type. Must be one of: ' + validTypes.join(', ') });
  }

  // Upload PDF
  const filename = `lien-releases/${Date.now()}_${req.file.originalname}`;
  const uploadResult = await uploadPDF(req.file.buffer, filename, job_id);

  // Create record
  const { data: release, error } = await supabase
    .from('v2_lien_releases')
    .insert({
      builder_id: builderId,
      job_id: job_id || null,
      vendor_id: vendor_id || null,
      release_type,
      amount: amount ? parseFloat(amount) : null,
      through_date: through_date || null,
      release_date: release_date || null,
      pdf_url: uploadResult.url,
      notes,
      uploaded_by,
      status: 'received'
    })
    .select()
    .single();

  if (error) throw error;

  await logLienReleaseActivity(release.id, 'uploaded', uploaded_by || 'System', {
    filename: req.file.originalname
  });

  res.json({ success: true, lien_release: release });
}));

// AI-powered lien release processing
router.post('/process', upload.single('pdf'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  const { uploaded_by } = req.body;
  const pdfBuffer = req.file.buffer;
  const originalFilename = req.file.originalname;
  const companyName = req.builder?.name || 'your company';

  // Import and use the lien release processor
  const { processLienRelease } = require('../ai/processor');
  const result = await processLienRelease(pdfBuffer, originalFilename, companyName);

  if (!result.success) {
    return res.status(422).json({
      error: 'Processing failed',
      messages: result.messages
    });
  }

  // Upload PDF
  const jobId = result.matchedJob?.id;
  const filename = `lien-releases/${Date.now()}_${originalFilename}`;
  const uploadResult = await uploadPDF(pdfBuffer, filename, jobId);

  // Create lien release record
  const { data: release, error } = await supabase
    .from('v2_lien_releases')
    .insert({
      builder_id: builderId,
      job_id: jobId || null,
      vendor_id: result.vendor?.id || null,
      release_type: result.extracted.releaseType || 'conditional_progress',
      release_date: result.extracted.releaseDate || null,
      through_date: result.extracted.throughDate || null,
      amount: result.extracted.amount || null,
      pdf_url: uploadResult.url,
      ai_processed: true,
      ai_confidence: result.ai_confidence || null,
      ai_extracted_data: result.ai_extracted_data || null,
      needs_review: result.needs_review || false,
      review_flags: result.review_flags || null,
      notary_name: result.extracted.notary?.name || null,
      notary_county: result.extracted.notary?.county || null,
      notary_expiration: result.extracted.notary?.expiration || null,
      signer_name: result.extracted.signer?.name || null,
      signer_title: result.extracted.signer?.title || null,
      notes: result.messages.join('\n'),
      uploaded_by,
      status: 'received'
    })
    .select()
    .single();

  if (error) throw error;

  await logLienReleaseActivity(release.id, 'ai_processed', uploaded_by || 'AI Processor', {
    originalFilename,
    vendorMatched: !!result.vendor,
    jobMatched: !!result.matchedJob,
    confidence: result.ai_confidence?.overall
  });

  res.json({
    success: true,
    lien_release: release,
    processing: {
      extracted: result.extracted,
      matchedJob: result.matchedJob,
      vendor: result.vendor,
      messages: result.messages
    }
  });
}));

// ============================================================
// UPDATE & DELETE ENDPOINTS
// ============================================================

// Update lien release
router.patch('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const {
    job_id, vendor_id, draw_id, release_type, release_date, through_date,
    amount, status, notes, signer_name, signer_title,
    notary_name, notary_county, notary_expiration, updated_by
  } = req.body;

  // Get current record
  const { data: current, error: fetchError } = await supabase
    .from('v2_lien_releases')
    .select('*')
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !current) {
    return res.status(404).json({ error: 'Lien release not found' });
  }

  // Build update object (only include provided fields)
  const updates = { version: current.version + 1 };
  if (job_id !== undefined) updates.job_id = job_id;
  if (vendor_id !== undefined) updates.vendor_id = vendor_id;
  if (draw_id !== undefined) updates.draw_id = draw_id;
  if (release_type !== undefined) updates.release_type = release_type;
  if (release_date !== undefined) updates.release_date = release_date;
  if (through_date !== undefined) updates.through_date = through_date;
  if (amount !== undefined) updates.amount = amount;
  if (status !== undefined) {
    updates.status = status;
    if (status === 'verified') {
      updates.verified_at = new Date().toISOString();
      updates.verified_by = updated_by;
    }
  }
  if (notes !== undefined) updates.notes = notes;
  if (signer_name !== undefined) updates.signer_name = signer_name;
  if (signer_title !== undefined) updates.signer_title = signer_title;
  if (notary_name !== undefined) updates.notary_name = notary_name;
  if (notary_county !== undefined) updates.notary_county = notary_county;
  if (notary_expiration !== undefined) updates.notary_expiration = notary_expiration;

  const { data: updated, error: updateError } = await supabase
    .from('v2_lien_releases')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      draw:v2_draws(id, draw_number, status)
    `)
    .single();

  if (updateError) throw updateError;

  await logLienReleaseActivity(id, 'updated', updated_by || 'System', { updates });

  res.json({ success: true, lien_release: updated });
}));

// Delete lien release (soft delete)
router.delete('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { deleted_by } = req.body;

  const { data, error } = await supabase
    .from('v2_lien_releases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw error;

  await logLienReleaseActivity(id, 'deleted', deleted_by || 'System', {});

  res.json({ success: true });
}));

// ============================================================
// DRAW ATTACHMENT ENDPOINTS
// ============================================================

// Attach lien release to draw
router.post('/:id/attach-to-draw', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { draw_id, attached_by } = req.body;

  if (!draw_id) {
    return res.status(400).json({ error: 'draw_id is required' });
  }

  // Verify draw exists
  const { data: draw, error: drawError } = await supabase
    .from('v2_draws')
    .select('id, draw_number, job_id')
    .eq('id', draw_id)
    .eq('builder_id', builderId)
    .single();

  if (drawError || !draw) {
    return res.status(404).json({ error: 'Draw not found' });
  }

  // Update lien release
  const { data: updated, error } = await supabase
    .from('v2_lien_releases')
    .update({
      draw_id,
      status: 'attached',
      job_id: draw.job_id  // Also update job_id to match draw's job
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      draw:v2_draws(id, draw_number, status)
    `)
    .single();

  if (error) throw error;

  await logLienReleaseActivity(id, 'attached_to_draw', attached_by || 'System', {
    draw_id,
    draw_number: draw.draw_number
  });

  res.json({ success: true, lien_release: updated });
}));

// Detach lien release from draw
router.post('/:id/detach-from-draw', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { detached_by } = req.body;

  // Get current release to log the draw it's being detached from
  const { data: current } = await supabase
    .from('v2_lien_releases')
    .select('draw_id')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  const { data: updated, error } = await supabase
    .from('v2_lien_releases')
    .update({
      draw_id: null,
      status: 'verified'
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw error;

  await logLienReleaseActivity(id, 'detached_from_draw', detached_by || 'System', {
    previous_draw_id: current?.draw_id
  });

  res.json({ success: true, lien_release: updated });
}));

// ============================================================
// ACTIVITY & SUGGESTIONS
// ============================================================

// Get lien release activity
router.get('/:id/activity', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lien_release_activity')
    .select('*')
    .eq('lien_release_id', id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json(data || []);
}));

// Get suggested draws for a lien release
// Suggests draws based on vendor, job, and date matching
router.get('/:id/suggested-draws', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  // Get the lien release
  const { data: lienRelease, error: lrError } = await supabase
    .from('v2_lien_releases')
    .select('vendor_id, job_id, through_date')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (lrError || !lienRelease) {
    return res.status(404).json({ error: 'Lien release not found' });
  }

  // Get all draft draws (only suggest draft draws that can accept releases)
  const { data: draws, error: drawError } = await supabase
    .from('v2_draws')
    .select(`
      id,
      draw_number,
      period_end,
      status,
      total_amount,
      job_id,
      job:v2_jobs(id, name)
    `)
    .eq('builder_id', builderId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  if (drawError) throw drawError;

  // For each draw, check if the vendor has invoices in it
  const suggestedDraws = [];

  for (const draw of (draws || [])) {
    let score = 0;
    const reasons = [];

    // Check if same job
    if (lienRelease.job_id && draw.job_id === lienRelease.job_id) {
      score += 50;
      reasons.push('Same job');
    }

    // Check if vendor has invoices in this draw
    const { data: vendorInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices!inner(vendor_id)
      `)
      .eq('draw_id', draw.id)
      .eq('invoice.vendor_id', lienRelease.vendor_id);

    if (vendorInvoices && vendorInvoices.length > 0) {
      score += 40;
      reasons.push(`Vendor has ${vendorInvoices.length} invoice(s) in draw`);
    }

    // Check date proximity
    if (lienRelease.through_date && draw.period_end) {
      const lrDate = new Date(lienRelease.through_date);
      const drawDate = new Date(draw.period_end);
      const daysDiff = Math.abs((lrDate - drawDate) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 7) {
        score += 10;
        reasons.push('Dates within 7 days');
      } else if (daysDiff <= 30) {
        score += 5;
        reasons.push('Dates within 30 days');
      }
    }

    // Only include if there's some relevance
    if (score > 0) {
      suggestedDraws.push({
        draw_id: draw.id,
        draw_number: draw.draw_number,
        job_name: draw.job?.name || 'Unknown Job',
        period_end: draw.period_end,
        total_amount: draw.total_amount,
        score,
        reasons
      });
    }
  }

  // Sort by score descending
  suggestedDraws.sort((a, b) => b.score - a.score);

  res.json(suggestedDraws.slice(0, 5)); // Return top 5 suggestions
}));

module.exports = router;
