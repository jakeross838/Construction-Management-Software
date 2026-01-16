/**
 * Documents Routes
 * Centralized document management for jobs
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { categorizeDocument } = require('../ai-document-processor');

// Configure multer for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow common document types
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/heic',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
      'text/csv'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  }
});

// Storage bucket and prefix
const STORAGE_BUCKET = 'invoices';  // Reuse existing bucket
const DOCUMENT_PREFIX = 'documents';

// Document categories
const CATEGORIES = [
  'contracts',
  'plans',
  'permits',
  'insurance',
  'proposals',
  'specs',
  'invoices',
  'warranties',
  'correspondence',
  'photos',
  'other'
];

// Helper: Log document activity
async function logDocumentActivity(documentId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_document_activity').insert({
      document_id: documentId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Failed to log document activity:', err);
  }
}

// ============================================================
// LIST & GET ENDPOINTS
// ============================================================

// List documents with filters
router.get('/', async (req, res) => {
  try {
    const { job_id, category, vendor_id, search, include_deleted } = req.query;

    let query = supabase
      .from('v2_documents')
      .select(`
        *,
        job:v2_jobs!job_id(id, name),
        vendor:v2_vendors(id, name)
      `)
      .order('created_at', { ascending: false });

    // Filter by job (required for most use cases)
    if (job_id) {
      query = query.eq('job_id', job_id);
    }

    // Filter by category
    if (category) {
      query = query.eq('category', category);
    }

    // Filter by vendor
    if (vendor_id) {
      query = query.eq('vendor_id', vendor_id);
    }

    // Exclude deleted unless requested
    if (!include_deleted) {
      query = query.is('deleted_at', null);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Apply search filter in memory (searches name, description, tags)
    let results = data;
    if (search) {
      const q = search.toLowerCase();
      results = data.filter(doc =>
        doc.name?.toLowerCase().includes(q) ||
        doc.description?.toLowerCase().includes(q) ||
        doc.file_name?.toLowerCase().includes(q) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single document
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('v2_documents')
      .select(`
        *,
        job:v2_jobs!job_id(id, name, address),
        vendor:v2_vendors(id, name),
        po:v2_purchase_orders(id, po_number),
        invoice:v2_invoices(id, invoice_number)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Document not found' });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get document stats for a job
router.get('/stats/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const { data, error } = await supabase
      .from('v2_documents')
      .select('category')
      .eq('job_id', jobId)
      .is('deleted_at', null);

    if (error) throw error;

    // Count by category
    const byCategory = {};
    CATEGORIES.forEach(cat => byCategory[cat] = 0);

    data.forEach(doc => {
      if (byCategory[doc.category] !== undefined) {
        byCategory[doc.category]++;
      } else {
        byCategory.other++;
      }
    });

    // Check for expiring documents (next 30 days)
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data: expiring } = await supabase
      .from('v2_documents')
      .select('id, name, expiration_date')
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .not('expiration_date', 'is', null)
      .lte('expiration_date', thirtyDaysFromNow.toISOString().split('T')[0])
      .gte('expiration_date', new Date().toISOString().split('T')[0]);

    res.json({
      total: data.length,
      by_category: byCategory,
      expiring_soon: expiring || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get categories list
router.get('/meta/categories', (req, res) => {
  const categoryLabels = {
    contracts: 'Contracts & Agreements',
    plans: 'Plans & Drawings',
    permits: 'Permits & Approvals',
    insurance: 'Insurance & Bonds',
    proposals: 'Proposals & Bids',
    specs: 'Specifications',
    invoices: 'Invoices & Billing',
    warranties: 'Warranties',
    correspondence: 'Correspondence',
    photos: 'Photos',
    other: 'Other'
  };

  res.json(CATEGORIES.map(id => ({ id, name: categoryLabels[id] })));
});

// ============================================================
// AI CATEGORIZATION
// ============================================================

// Analyze document and suggest category
router.post('/categorize', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const result = await categorizeDocument(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    res.json({
      category: result.category,
      confidence: result.confidence,
      suggestedName: result.suggestedName,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size
    });
  } catch (err) {
    console.error('Document categorization error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UPLOAD & CREATE
// ============================================================

// Upload document with optional AI categorization
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    let {
      job_id,
      name,
      description,
      category,
      document_date,
      expiration_date,
      vendor_id,
      po_id,
      invoice_id,
      tags,
      uploaded_by,
      auto_categorize
    } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }

    // Auto-categorize if requested or no category provided
    let aiCategorization = null;
    if (auto_categorize === 'true' || auto_categorize === true || !category) {
      try {
        aiCategorization = await categorizeDocument(
          req.file.buffer,
          req.file.mimetype,
          req.file.originalname
        );
        // Use AI category if none provided
        if (!category && aiCategorization.category) {
          category = aiCategorization.category;
        }
        // Use AI suggested name if no name provided
        if (!name && aiCategorization.suggestedName) {
          name = aiCategorization.suggestedName;
        }
      } catch (aiErr) {
        console.error('AI categorization failed, continuing with provided category:', aiErr);
      }
    }

    if (!category || !CATEGORIES.includes(category)) {
      return res.status(400).json({ error: 'Valid category is required' });
    }

    // Generate storage path: documents/{job_id}/{uuid}_{filename}
    const fileExt = req.file.originalname.split('.').pop();
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const storagePath = `${DOCUMENT_PREFIX}/${job_id}/${uniqueId}_${req.file.originalname}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(storagePath);

    // Create document record
    const { data: doc, error: insertError } = await supabase
      .from('v2_documents')
      .insert({
        job_id,
        name: name || req.file.originalname,
        description: description || null,
        category,
        file_url: urlData.publicUrl,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        document_date: document_date || null,
        expiration_date: expiration_date || null,
        vendor_id: vendor_id || null,
        po_id: po_id || null,
        invoice_id: invoice_id || null,
        tags: tags ? (typeof tags === 'string' ? JSON.parse(tags) : tags) : null,
        uploaded_by: uploaded_by || null
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log activity
    await logDocumentActivity(doc.id, 'uploaded', uploaded_by, {
      file_name: req.file.originalname,
      file_size: req.file.size,
      category,
      ai_categorized: !!aiCategorization,
      ai_confidence: aiCategorization?.confidence
    });

    // Include AI info in response
    res.status(201).json({
      ...doc,
      ai_categorization: aiCategorization ? {
        category: aiCategorization.category,
        confidence: aiCategorization.confidence,
        suggestedName: aiCategorization.suggestedName
      } : null
    });
  } catch (err) {
    console.error('Document upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UPDATE & DELETE
// ============================================================

// Update document metadata
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      category,
      document_date,
      expiration_date,
      vendor_id,
      po_id,
      invoice_id,
      tags,
      updated_by
    } = req.body;

    const updateData = { updated_at: new Date().toISOString() };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ error: 'Invalid category' });
      }
      updateData.category = category;
    }
    if (document_date !== undefined) updateData.document_date = document_date;
    if (expiration_date !== undefined) updateData.expiration_date = expiration_date;
    if (vendor_id !== undefined) updateData.vendor_id = vendor_id;
    if (po_id !== undefined) updateData.po_id = po_id;
    if (invoice_id !== undefined) updateData.invoice_id = invoice_id;
    if (tags !== undefined) updateData.tags = tags;

    const { data, error } = await supabase
      .from('v2_documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logDocumentActivity(id, 'updated', updated_by, updateData);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Soft delete document
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    const { data, error } = await supabase
      .from('v2_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logDocumentActivity(id, 'deleted', deleted_by);

    res.json({ success: true, document: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Restore deleted document
router.post('/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { restored_by } = req.body;

    const { data, error } = await supabase
      .from('v2_documents')
      .update({ deleted_at: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logDocumentActivity(id, 'restored', restored_by);

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
