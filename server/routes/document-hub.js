/**
 * Document Hub API Routes
 *
 * Endpoints for the AI Document Intelligence Hub
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const {
  processDocument,
  confirmAndRoute,
  getDocumentsPendingReview,
  getProcessingStats,
  DOCUMENT_TYPES
} = require('../ai-document-hub');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: PDF, PNG, JPEG, WebP'));
    }
  }
});


/**
 * GET /api/document-hub/types
 * Get list of supported document types
 */
router.get('/types', (req, res) => {
  res.json({
    success: true,
    types: Object.entries(DOCUMENT_TYPES).map(([type, description]) => ({
      type,
      description
    }))
  });
});


/**
 * POST /api/document-hub/upload
 * Upload a document for processing
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const { job_id, vendor_id, document_type } = req.body;

    // Upload to Supabase Storage
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    // Create document queue entry
    const { data: doc, error: docError } = await supabase
      .from('v2_document_queue')
      .insert({
        file_name: req.file.originalname,
        file_url: fileUrl,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        job_id: job_id || null,
        vendor_id: vendor_id || null,
        document_type: document_type || 'unknown',
        uploaded_by: req.body.uploaded_by || 'User',
        status: 'pending'
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to create document record: ${docError.message}`);
    }

    res.json({
      success: true,
      document: doc,
      message: 'Document uploaded successfully. Processing will begin shortly.'
    });

  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * POST /api/document-hub/process/:id
 * Trigger processing for a document
 */
router.post('/process/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await processDocument(id);

    if (result.success) {
      res.json({
        success: true,
        result
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (err) {
    console.error('Document processing error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * POST /api/document-hub/upload-and-process
 * Upload and immediately process a document
 */
router.post('/upload-and-process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file provided' });
    }

    const { job_id, vendor_id, document_type } = req.body;

    // Upload to Supabase Storage
    const fileName = `${Date.now()}-${req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const storagePath = `documents/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype
      });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage
      .from('uploads')
      .getPublicUrl(storagePath);

    const fileUrl = urlData.publicUrl;

    // Create document queue entry
    const { data: doc, error: docError } = await supabase
      .from('v2_document_queue')
      .insert({
        file_name: req.file.originalname,
        file_url: fileUrl,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        job_id: job_id || null,
        vendor_id: vendor_id || null,
        document_type: document_type || 'unknown',
        uploaded_by: req.body.uploaded_by || 'User',
        status: 'pending'
      })
      .select()
      .single();

    if (docError) {
      throw new Error(`Failed to create document record: ${docError.message}`);
    }

    // Process immediately
    const result = await processDocument(doc.id);

    res.json({
      success: result.success,
      document: doc,
      processing: result
    });

  } catch (err) {
    console.error('Upload and process error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * GET /api/document-hub/queue
 * Get documents in the queue
 */
router.get('/queue', async (req, res) => {
  try {
    const { status, document_type, job_id, limit = 50 } = req.query;

    let query = supabase
      .from('v2_document_queue')
      .select(`
        *,
        job:v2_jobs(id, name),
        vendor:v2_vendors(id, name)
      `)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (status) {
      query = query.eq('status', status);
    }
    if (document_type) {
      query = query.eq('document_type', document_type);
    }
    if (job_id) {
      query = query.eq('job_id', job_id);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({ success: true, documents: data });

  } catch (err) {
    console.error('Queue fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * GET /api/document-hub/pending-review
 * Get documents pending user review
 */
router.get('/pending-review', async (req, res) => {
  try {
    const { job_id } = req.query;
    const documents = await getDocumentsPendingReview(job_id || null);

    res.json({ success: true, documents });

  } catch (err) {
    console.error('Pending review fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * GET /api/document-hub/:id
 * Get a specific document with extraction data
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: doc, error: docError } = await supabase
      .from('v2_document_queue')
      .select(`
        *,
        job:v2_jobs(id, name),
        vendor:v2_vendors(id, name),
        extractions:v2_document_extractions(*),
        routing_logs:v2_document_routing_log(*)
      `)
      .eq('id', id)
      .single();

    if (docError) throw docError;

    res.json({ success: true, document: doc });

  } catch (err) {
    console.error('Document fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * POST /api/document-hub/:id/confirm-route
 * Confirm and route extracted data to a destination
 */
router.post('/:id/confirm-route', async (req, res) => {
  try {
    const { id } = req.params;
    const { extraction_id, destination, data, confirmed_by } = req.body;

    if (!destination || !data) {
      return res.status(400).json({
        success: false,
        error: 'Missing destination or data'
      });
    }

    const result = await confirmAndRoute(id, extraction_id, destination, data, confirmed_by || 'User');

    res.json({
      success: result.success,
      result
    });

  } catch (err) {
    console.error('Confirm route error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * POST /api/document-hub/:id/skip-route
 * Skip routing to a specific destination
 */
router.post('/:id/skip-route', async (req, res) => {
  try {
    const { id } = req.params;
    const { destination, reason } = req.body;

    await supabase
      .from('v2_document_routing_log')
      .update({
        status: 'skipped',
        error_message: reason || 'Skipped by user'
      })
      .eq('document_id', id)
      .eq('destination', destination);

    res.json({ success: true });

  } catch (err) {
    console.error('Skip route error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * GET /api/document-hub/stats
 * Get processing statistics
 */
router.get('/stats/overview', async (req, res) => {
  try {
    const stats = await getProcessingStats();

    // Also get recent activity
    const { data: recent } = await supabase
      .from('v2_document_queue')
      .select('id, file_name, document_type, status, created_at')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get counts by status
    const { data: statusCounts } = await supabase
      .from('v2_document_queue')
      .select('status')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    const counts = statusCounts?.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {}) || {};

    res.json({
      success: true,
      stats,
      recentDocuments: recent || [],
      statusCounts: counts
    });

  } catch (err) {
    console.error('Stats fetch error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


/**
 * DELETE /api/document-hub/:id
 * Delete a document from the queue
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get document to delete from storage
    const { data: doc } = await supabase
      .from('v2_document_queue')
      .select('file_url')
      .eq('id', id)
      .single();

    if (doc?.file_url) {
      // Extract path from URL and delete from storage
      const path = doc.file_url.split('/uploads/')[1];
      if (path) {
        await supabase.storage.from('uploads').remove([`documents/${path}`]);
      }
    }

    // Delete from database (cascades to extractions and routing logs)
    await supabase
      .from('v2_document_queue')
      .delete()
      .eq('id', id);

    res.json({ success: true });

  } catch (err) {
    console.error('Document delete error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});


module.exports = router;
