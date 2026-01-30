/**
 * Documents Routes
 * Centralized document management for jobs
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { categorizeDocument } = require('../ai/document-processor');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');

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
router.get('/', asyncHandler(async (req, res) => {
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
}));

// Get single document
router.get('/:id', asyncHandler(async (req, res) => {
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
}));

// Get document stats for a job
router.get('/stats/:jobId', asyncHandler(async (req, res) => {
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
}));

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
router.post('/categorize', upload.single('file'), asyncHandler(async (req, res) => {
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
}));

// ============================================================
// UPLOAD & CREATE
// ============================================================

// Upload document with optional AI categorization
router.post('/upload', upload.single('file'), asyncHandler(async (req, res) => {
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
}));

// ============================================================
// UPDATE & DELETE
// ============================================================

// Update document metadata
router.patch('/:id', asyncHandler(async (req, res) => {
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
}));

// Soft delete document
router.delete('/:id', asyncHandler(async (req, res) => {
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
}));

// Restore deleted document
router.post('/:id/restore', asyncHandler(async (req, res) => {
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
}));

// ============================================================
// VERSION MANAGEMENT
// ============================================================

// Helper: Find root document in version chain
async function findRootDocumentId(documentId) {
  let currentId = documentId;
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (iterations < maxIterations) {
    const { data, error } = await supabase
      .from('v2_documents')
      .select('id, parent_document_id')
      .eq('id', currentId)
      .single();

    if (error || !data) break;

    if (!data.parent_document_id) {
      // This is the root
      return data.id;
    }

    currentId = data.parent_document_id;
    iterations++;
  }

  return currentId;
}

// Get version history for a document
router.get('/:id/versions', asyncHandler(async (req, res) => {
    const { id } = req.params;

    // First get the document to check it exists
    const { data: doc, error: docError } = await supabase
      .from('v2_documents')
      .select('id, parent_document_id')
      .eq('id', id)
      .single();

    if (docError || !doc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Find the root document
    const rootId = await findRootDocumentId(id);

    // Get all versions in this chain
    const { data: versions, error } = await supabase
      .from('v2_documents')
      .select('id, version_number, file_url, file_name, file_size, mime_type, uploaded_by, created_at, is_current')
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
      .is('deleted_at', null)
      .order('version_number', { ascending: false });

    if (error) throw error;

    res.json(versions || []);
}));

// Upload new version of existing document
router.post('/:id/versions', upload.single('file'), asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { uploaded_by } = req.body;

    // Get the current document
    const { data: currentDoc, error: docError } = await supabase
      .from('v2_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !currentDoc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (currentDoc.deleted_at) {
      return res.status(400).json({ error: 'Cannot create version of deleted document' });
    }

    // Find the root document ID (for the parent_document_id)
    const rootId = await findRootDocumentId(id);

    // Get the highest version number in this chain
    const { data: versionData } = await supabase
      .from('v2_documents')
      .select('version_number')
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
      .order('version_number', { ascending: false })
      .limit(1);

    const highestVersion = versionData?.[0]?.version_number || 1;
    const newVersionNumber = highestVersion + 1;

    // Mark all current versions in the chain as not current
    await supabase
      .from('v2_documents')
      .update({ is_current: false })
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
      .eq('is_current', true);

    // Upload new file to storage
    const uniqueId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
    const storagePath = `${DOCUMENT_PREFIX}/${currentDoc.job_id}/${uniqueId}_${req.file.originalname}`;

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

    // Create new version record
    const { data: newDoc, error: insertError } = await supabase
      .from('v2_documents')
      .insert({
        job_id: currentDoc.job_id,
        name: currentDoc.name,
        description: currentDoc.description,
        category: currentDoc.category,
        file_url: urlData.publicUrl,
        file_name: req.file.originalname,
        file_size: req.file.size,
        mime_type: req.file.mimetype,
        document_date: currentDoc.document_date,
        expiration_date: currentDoc.expiration_date,
        vendor_id: currentDoc.vendor_id,
        po_id: currentDoc.po_id,
        invoice_id: currentDoc.invoice_id,
        tags: currentDoc.tags,
        uploaded_by: uploaded_by || null,
        version_number: newVersionNumber,
        parent_document_id: rootId,
        is_current: true
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Log activity
    await logDocumentActivity(newDoc.id, 'new_version', uploaded_by, {
      version_number: newVersionNumber,
      previous_version: highestVersion,
      original_document_id: rootId,
      file_name: req.file.originalname,
      file_size: req.file.size
    });

    res.status(201).json(newDoc);
}));

// Rollback to a previous version
router.post('/:id/rollback', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { performed_by } = req.body;

    // Get the target version document
    const { data: targetDoc, error: targetError } = await supabase
      .from('v2_documents')
      .select('*')
      .eq('id', id)
      .single();

    if (targetError || !targetDoc) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (targetDoc.deleted_at) {
      return res.status(400).json({ error: 'Cannot rollback to deleted document' });
    }

    if (targetDoc.is_current) {
      return res.status(400).json({ error: 'Document is already the current version' });
    }

    // Find the root document ID
    const rootId = await findRootDocumentId(id);

    // Find the current version
    const { data: currentVersionData } = await supabase
      .from('v2_documents')
      .select('id, version_number')
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`)
      .eq('is_current', true)
      .single();

    const fromVersion = currentVersionData?.version_number || 'unknown';

    // Mark all versions as not current
    await supabase
      .from('v2_documents')
      .update({ is_current: false })
      .or(`id.eq.${rootId},parent_document_id.eq.${rootId}`);

    // Mark target as current
    const { data: updatedDoc, error: updateError } = await supabase
      .from('v2_documents')
      .update({ is_current: true, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logDocumentActivity(id, 'rollback', performed_by, {
      from_version: fromVersion,
      to_version: targetDoc.version_number,
      root_document_id: rootId
    });

    res.json(updatedDoc);
}));

// ============================================================
// PHASE 75: DOCUMENT INTELLIGENCE
// ============================================================

// Get document types
router.get('/types/all', asyncHandler(async (req, res) => {
  const { category } = req.query;

  let query = supabase
    .from('v2_document_types')
    .select('*')
    .order('category')
    .order('name');

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Full-text search documents
router.get('/intelligence/search', asyncHandler(async (req, res) => {
  const { q, job_id, category, limit = 50 } = req.query;

  if (!q || q.trim().length < 2) {
    return res.json([]);
  }

  const { data, error } = await supabase
    .rpc('search_documents', {
      p_query: q,
      p_job_id: job_id || null,
      p_type_category: category || null,
      p_limit: parseInt(limit)
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Get document extractions
router.get('/:id/extractions', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_document_extractions')
    .select('*')
    .eq('document_id', id)
    .order('field_name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Add/update extractions
router.post('/:id/extractions', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { extractions } = req.body;

  if (!extractions || !Array.isArray(extractions)) {
    throw new AppError('VALIDATION_ERROR', 'extractions array required');
  }

  const extractionData = extractions.map(e => ({
    document_id: id,
    ...e
  }));

  const { data, error } = await supabase
    .from('v2_document_extractions')
    .upsert(extractionData)
    .select();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Verify extraction (with optional correction)
router.patch('/extractions/:extractionId/verify', asyncHandler(async (req, res) => {
  const { extractionId } = req.params;
  const { verified_by, corrected_value } = req.body;

  const updateData = {
    verified: true,
    verified_by,
    verified_at: new Date().toISOString()
  };

  if (corrected_value !== undefined) {
    const { data: existing } = await supabase
      .from('v2_document_extractions')
      .select('field_value')
      .eq('id', extractionId)
      .single();

    if (existing) {
      updateData.original_value = existing.field_value;
      updateData.field_value = corrected_value;
    }
  }

  const { data, error } = await supabase
    .from('v2_document_extractions')
    .update(updateData)
    .eq('id', extractionId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get contract analysis
router.get('/:id/contract-analysis', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_contract_analysis')
    .select('*')
    .eq('document_id', id)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data || null);
}));

// Save contract analysis
router.post('/:id/contract-analysis', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const analysisData = {
    document_id: id,
    ...req.body,
    analyzed_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('v2_contract_analysis')
    .upsert(analysisData, { onConflict: 'document_id' })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get document compliance for job
router.get('/compliance/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get compliance summary
  const { data: summary, error: summaryError } = await supabase
    .rpc('get_job_document_compliance', { p_job_id: jobId });

  if (summaryError) throw new AppError('DATABASE_ERROR', summaryError.message);

  // Get checklist items
  const { data: checklist, error: checklistError } = await supabase
    .from('v2_job_document_checklist')
    .select(`
      *,
      requirement:v2_document_requirements(
        *,
        document_type:v2_document_types(*)
      ),
      document:v2_documents(id, name, file_url, status)
    `)
    .eq('job_id', jobId)
    .order('status')
    .order('due_date');

  if (checklistError) throw new AppError('DATABASE_ERROR', checklistError.message);

  res.json({
    summary: summary && summary.length > 0 ? summary[0] : {
      total_required: 0,
      received: 0,
      approved: 0,
      pending: 0,
      overdue: 0,
      compliance_percent: 0
    },
    checklist: checklist || []
  });
}));

// Initialize job checklist from requirements
router.post('/compliance/:jobId/initialize', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { phase, trigger_date } = req.body;

  const { data: requirements, error: reqError } = await supabase
    .from('v2_document_requirements')
    .select('*')
    .eq('phase', phase);

  if (reqError) throw new AppError('DATABASE_ERROR', reqError.message);

  if (!requirements || requirements.length === 0) {
    return res.json({ created: 0, message: 'No requirements for this phase' });
  }

  const baseDate = trigger_date ? new Date(trigger_date) : new Date();

  const checklistItems = requirements.map(req => ({
    job_id: jobId,
    requirement_id: req.id,
    status: 'pending',
    due_date: req.due_days_offset
      ? new Date(baseDate.getTime() + req.due_days_offset * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      : null
  }));

  const { data, error } = await supabase
    .from('v2_job_document_checklist')
    .upsert(checklistItems, { onConflict: 'job_id,requirement_id' })
    .select();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ created: data.length, items: data });
}));

// Update checklist item
router.patch('/compliance/items/:itemId', asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const updateData = {
    ...req.body,
    updated_at: new Date().toISOString()
  };

  if (req.body.document_id && req.body.status !== 'pending') {
    updateData.received_date = new Date().toISOString().split('T')[0];
  }

  const { data, error } = await supabase
    .from('v2_job_document_checklist')
    .update(updateData)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get document requirements
router.get('/requirements/all', asyncHandler(async (req, res) => {
  const { phase } = req.query;

  let query = supabase
    .from('v2_document_requirements')
    .select(`
      *,
      document_type:v2_document_types(*)
    `)
    .order('phase')
    .order('trigger_event');

  if (phase) {
    query = query.eq('phase', phase);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Create requirement
router.post('/requirements', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_document_requirements')
    .insert(req.body)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Update requirement
router.patch('/requirements/:reqId', asyncHandler(async (req, res) => {
  const { reqId } = req.params;

  const { data, error } = await supabase
    .from('v2_document_requirements')
    .update(req.body)
    .eq('id', reqId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Delete requirement
router.delete('/requirements/:reqId', asyncHandler(async (req, res) => {
  const { reqId } = req.params;

  const { error } = await supabase
    .from('v2_document_requirements')
    .delete()
    .eq('id', reqId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

module.exports = router;
