/**
 * Closeout API Routes
 * Manages project closeout: packages, punch lists, inspections, documents, lien waivers
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { getUserName } = require('../utils/shared');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ============================================================
// CLOSEOUT PACKAGES
// ============================================================

/**
 * GET /api/closeout/packages
 * List closeout packages with optional filters
 */
router.get('/packages', asyncHandler(async (req, res) => {
  const { job_id, status } = req.query;

  let query = supabase
    .from('v2_closeout_packages')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/closeout/packages/:id
 * Get a single closeout package with all related data
 */
router.get('/packages/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: pkg, error } = await supabase
    .from('v2_closeout_packages')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  if (!pkg) {
    return res.status(404).json({ error: 'Closeout package not found' });
  }

  // Get punch list items
  const { data: punchList } = await supabase
    .from('v2_punch_list_items')
    .select(`*, vendor:v2_vendors(id, name)`)
    .eq('closeout_package_id', id)
    .is('deleted_at', null)
    .order('created_at');

  // Get inspections
  const { data: inspections } = await supabase
    .from('v2_final_inspections')
    .select('*')
    .eq('closeout_package_id', id)
    .is('deleted_at', null)
    .order('scheduled_date');

  // Get documents
  const { data: documents } = await supabase
    .from('v2_closeout_documents')
    .select(`*, vendor:v2_vendors(id, name)`)
    .eq('closeout_package_id', id)
    .is('deleted_at', null)
    .order('document_type');

  // Get lien waivers
  const { data: lienWaivers } = await supabase
    .from('v2_lien_waivers')
    .select(`*, vendor:v2_vendors(id, name)`)
    .eq('closeout_package_id', id)
    .is('deleted_at', null)
    .order('created_at');

  // Get checklist items
  const { data: checklist } = await supabase
    .from('v2_closeout_checklist_items')
    .select('*')
    .eq('closeout_package_id', id)
    .order('sort_order');

  res.json({
    ...pkg,
    punch_list: punchList || [],
    inspections: inspections || [],
    documents: documents || [],
    lien_waivers: lienWaivers || [],
    checklist: checklist || []
  });
}));

/**
 * POST /api/closeout/packages
 * Create a new closeout package
 */
router.post('/packages', asyncHandler(async (req, res) => {
  const { job_id, name, description, target_completion_date, notes, created_by } = req.body;

  if (!job_id || !name) {
    return res.status(400).json({ error: 'Job and name are required' });
  }

  const { data, error } = await supabase
    .from('v2_closeout_packages')
    .insert({
      job_id,
      name,
      description,
      target_completion_date,
      notes,
      created_by: getUserName(req),
      status: 'draft'
    })
    .select(`*, job:v2_jobs(id, name)`)
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/closeout/packages/:id
 * Update a closeout package
 */
router.patch('/packages/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.package_number;

  const { data, error } = await supabase
    .from('v2_closeout_packages')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`*, job:v2_jobs(id, name)`)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Closeout package not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/closeout/packages/:id
 * Soft delete a closeout package
 */
router.delete('/packages/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_closeout_packages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Closeout package not found' });
  }

  res.json({ success: true, message: 'Closeout package deleted' });
}));

// ============================================================
// PUNCH LIST ITEMS
// ============================================================

/**
 * GET /api/closeout/punch-list
 * List punch list items with optional filters
 */
router.get('/punch-list', asyncHandler(async (req, res) => {
  const { job_id, status, priority, category, assigned_vendor_id, closeout_package_id } = req.query;

  let query = supabase
    .from('v2_punch_list_items')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (priority) query = query.eq('priority', priority);
  if (category) query = query.eq('category', category);
  if (assigned_vendor_id) query = query.eq('assigned_vendor_id', assigned_vendor_id);
  if (closeout_package_id) query = query.eq('closeout_package_id', closeout_package_id);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/closeout/punch-list/stats
 * Get punch list statistics
 */
router.get('/punch-list/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_punch_list_items')
    .select('status, priority')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    open: 0,
    in_progress: 0,
    completed: 0,
    verified: 0,
    critical: 0,
    high: 0
  };

  (data || []).forEach(item => {
    if (stats[item.status] !== undefined) stats[item.status]++;
    if (item.priority === 'critical') stats.critical++;
    if (item.priority === 'high') stats.high++;
  });

  res.json(stats);
}));

/**
 * GET /api/closeout/punch-list/:id
 * Get a single punch list item with photos
 */
router.get('/punch-list/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: item, error } = await supabase
    .from('v2_punch_list_items')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  if (!item) {
    return res.status(404).json({ error: 'Punch list item not found' });
  }

  // Get photos
  const { data: photos } = await supabase
    .from('v2_punch_list_photos')
    .select('*')
    .eq('punch_list_item_id', id)
    .order('created_at');

  res.json({
    ...item,
    photos: photos || []
  });
}));

/**
 * POST /api/closeout/punch-list
 * Create a new punch list item
 */
router.post('/punch-list', asyncHandler(async (req, res) => {
  const {
    job_id,
    closeout_package_id,
    title,
    description,
    location,
    room,
    floor,
    category,
    priority,
    trade,
    assigned_to,
    assigned_vendor_id,
    due_date,
    estimated_cost,
    back_charge,
    notes,
    created_by
  } = req.body;

  if (!job_id || !title) {
    return res.status(400).json({ error: 'Job and title are required' });
  }

  const { data, error } = await supabase
    .from('v2_punch_list_items')
    .insert({
      job_id,
      closeout_package_id,
      title,
      description,
      location,
      room,
      floor,
      category,
      priority: priority || 'medium',
      trade,
      assigned_to,
      assigned_vendor_id,
      due_date,
      estimated_cost,
      back_charge,
      notes,
      created_by: getUserName(req),
      status: 'open'
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
 * PATCH /api/closeout/punch-list/:id
 * Update a punch list item
 */
router.patch('/punch-list/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.item_number;

  const { data, error } = await supabase
    .from('v2_punch_list_items')
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
    return res.status(404).json({ error: 'Punch list item not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/punch-list/:id/complete
 * Mark a punch list item as completed
 */
router.post('/punch-list/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { completed_by, actual_cost, notes } = req.body;

  const updateData = {
    status: 'completed',
    completed_at: new Date().toISOString(),
    completed_by: getUserName(req)
  };

  if (actual_cost !== undefined) updateData.actual_cost = actual_cost;
  if (notes) updateData.notes = notes;

  const { data, error } = await supabase
    .from('v2_punch_list_items')
    .update(updateData)
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
    return res.status(404).json({ error: 'Punch list item not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/punch-list/:id/verify
 * Verify a completed punch list item
 */
router.post('/punch-list/:id/verify', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { verified_by, notes } = req.body;

  const updateData = {
    status: 'verified',
    verified_at: new Date().toISOString(),
    verified_by: getUserName(req)
  };

  if (notes) updateData.notes = notes;

  const { data, error } = await supabase
    .from('v2_punch_list_items')
    .update(updateData)
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
    return res.status(404).json({ error: 'Punch list item not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/punch-list/:id/reject
 * Reject a completed item (send back to in_progress)
 */
router.post('/punch-list/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes } = req.body;

  const { data, error } = await supabase
    .from('v2_punch_list_items')
    .update({
      status: 'in_progress',
      verified_at: null,
      verified_by: null,
      notes: notes || null
    })
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
    return res.status(404).json({ error: 'Punch list item not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/closeout/punch-list/:id
 * Soft delete a punch list item
 */
router.delete('/punch-list/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_punch_list_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Punch list item not found' });
  }

  res.json({ success: true, message: 'Punch list item deleted' });
}));

/**
 * POST /api/closeout/punch-list/:id/photos
 * Add a photo to a punch list item
 */
router.post('/punch-list/:id/photos', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { file_url, file_name, file_type, file_size, photo_type, caption, uploaded_by } = req.body;

  if (!file_url) {
    return res.status(400).json({ error: 'File URL is required' });
  }

  const { data, error } = await supabase
    .from('v2_punch_list_photos')
    .insert({
      punch_list_item_id: id,
      file_url,
      file_name,
      file_type,
      file_size,
      photo_type: photo_type || 'issue',
      caption,
      uploaded_by: getUserName(req)
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /api/closeout/punch-list/:itemId/photos/:photoId
 * Delete a punch list photo
 */
router.delete('/punch-list/:itemId/photos/:photoId', asyncHandler(async (req, res) => {
  const { photoId } = req.params;

  const { error } = await supabase
    .from('v2_punch_list_photos')
    .delete()
    .eq('id', photoId);

  if (error) throw error;
  res.json({ success: true, message: 'Photo deleted' });
}));

// ============================================================
// FINAL INSPECTIONS
// ============================================================

/**
 * GET /api/closeout/inspections
 * List inspections with optional filters
 */
router.get('/inspections', asyncHandler(async (req, res) => {
  const { job_id, status, inspection_type, closeout_package_id } = req.query;

  let query = supabase
    .from('v2_final_inspections')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .is('deleted_at', null)
    .order('scheduled_date', { ascending: true });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (inspection_type) query = query.eq('inspection_type', inspection_type);
  if (closeout_package_id) query = query.eq('closeout_package_id', closeout_package_id);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/closeout/inspections/stats
 * Get inspection statistics
 */
router.get('/inspections/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_final_inspections')
    .select('status')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    scheduled: 0,
    passed: 0,
    failed: 0,
    conditional: 0
  };

  (data || []).forEach(insp => {
    if (stats[insp.status] !== undefined) stats[insp.status]++;
  });

  res.json(stats);
}));

/**
 * GET /api/closeout/inspections/:id
 * Get a single inspection
 */
router.get('/inspections/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_final_inspections')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Inspection not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/inspections
 * Create a new inspection
 */
router.post('/inspections', asyncHandler(async (req, res) => {
  const {
    job_id,
    closeout_package_id,
    name,
    description,
    inspection_type,
    inspector_name,
    inspector_agency,
    inspector_phone,
    inspector_email,
    scheduled_date,
    permit_number,
    notes,
    created_by
  } = req.body;

  if (!job_id || !name || !inspection_type) {
    return res.status(400).json({ error: 'Job, name, and inspection type are required' });
  }

  const { data, error } = await supabase
    .from('v2_final_inspections')
    .insert({
      job_id,
      closeout_package_id,
      name,
      description,
      inspection_type,
      inspector_name,
      inspector_agency,
      inspector_phone,
      inspector_email,
      scheduled_date,
      permit_number,
      notes,
      created_by: getUserName(req),
      status: 'scheduled'
    })
    .select(`*, job:v2_jobs(id, name)`)
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/closeout/inspections/:id
 * Update an inspection
 */
router.patch('/inspections/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.inspection_number;

  const { data, error } = await supabase
    .from('v2_final_inspections')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`*, job:v2_jobs(id, name)`)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Inspection not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/inspections/:id/record-result
 * Record the result of an inspection
 */
router.post('/inspections/:id/record-result', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    status,
    inspection_date,
    result_notes,
    conditions,
    reinspection_required,
    reinspection_date,
    certificate_number,
    certificate_url
  } = req.body;

  if (!status || !inspection_date) {
    return res.status(400).json({ error: 'Status and inspection date are required' });
  }

  const { data, error } = await supabase
    .from('v2_final_inspections')
    .update({
      status,
      inspection_date,
      result_notes,
      conditions,
      reinspection_required,
      reinspection_date,
      certificate_number,
      certificate_url
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select(`*, job:v2_jobs(id, name)`)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Inspection not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/closeout/inspections/:id
 * Soft delete an inspection
 */
router.delete('/inspections/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_final_inspections')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Inspection not found' });
  }

  res.json({ success: true, message: 'Inspection deleted' });
}));

// ============================================================
// CLOSEOUT DOCUMENTS
// ============================================================

/**
 * GET /api/closeout/documents
 * List documents with optional filters
 */
router.get('/documents', asyncHandler(async (req, res) => {
  const { job_id, status, document_type, category, closeout_package_id } = req.query;

  let query = supabase
    .from('v2_closeout_documents')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (document_type) query = query.eq('document_type', document_type);
  if (category) query = query.eq('category', category);
  if (closeout_package_id) query = query.eq('closeout_package_id', closeout_package_id);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/closeout/documents/stats
 * Get document statistics
 */
router.get('/documents/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_closeout_documents')
    .select('status, document_type')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    required: 0,
    pending: 0,
    submitted: 0,
    approved: 0,
    rejected: 0
  };

  (data || []).forEach(doc => {
    if (stats[doc.status] !== undefined) stats[doc.status]++;
  });

  res.json(stats);
}));

/**
 * GET /api/closeout/documents/:id
 * Get a single document
 */
router.get('/documents/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_closeout_documents')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/documents
 * Create a new document requirement or upload
 */
router.post('/documents', asyncHandler(async (req, res) => {
  const {
    job_id,
    closeout_package_id,
    name,
    description,
    document_type,
    category,
    file_url,
    file_name,
    file_type,
    file_size,
    vendor_id,
    due_date,
    expiration_date,
    notes,
    created_by
  } = req.body;

  if (!job_id || !name || !document_type) {
    return res.status(400).json({ error: 'Job, name, and document type are required' });
  }

  const status = file_url ? 'submitted' : 'required';

  const { data, error } = await supabase
    .from('v2_closeout_documents')
    .insert({
      job_id,
      closeout_package_id,
      name,
      description,
      document_type,
      category,
      file_url,
      file_name,
      file_type,
      file_size,
      vendor_id,
      due_date,
      expiration_date,
      notes,
      created_by: getUserName(req),
      status,
      submitted_at: file_url ? new Date().toISOString() : null,
      submitted_by: file_url ? getUserName(req) : null
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
 * PATCH /api/closeout/documents/:id
 * Update a document
 */
router.patch('/documents/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('v2_closeout_documents')
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
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/documents/:id/submit
 * Submit a document
 */
router.post('/documents/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { file_url, file_name, file_type, file_size, submitted_by } = req.body;

  if (!file_url) {
    return res.status(400).json({ error: 'File URL is required' });
  }

  const { data, error } = await supabase
    .from('v2_closeout_documents')
    .update({
      file_url,
      file_name,
      file_type,
      file_size,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by: getUserName(req)
    })
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
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/documents/:id/review
 * Review/approve/reject a document
 */
router.post('/documents/:id/review', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reviewed_by, review_notes } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Valid status (approved/rejected) is required' });
  }

  const { data, error } = await supabase
    .from('v2_closeout_documents')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: getUserName(req),
      review_notes
    })
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
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/closeout/documents/:id
 * Soft delete a document
 */
router.delete('/documents/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_closeout_documents')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Document not found' });
  }

  res.json({ success: true, message: 'Document deleted' });
}));

// ============================================================
// LIEN WAIVERS
// ============================================================

/**
 * GET /api/closeout/lien-waivers
 * List lien waivers with optional filters
 */
router.get('/lien-waivers', asyncHandler(async (req, res) => {
  const { job_id, status, waiver_type, scope, vendor_id, closeout_package_id } = req.query;

  let query = supabase
    .from('v2_lien_waivers')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (waiver_type) query = query.eq('waiver_type', waiver_type);
  if (scope) query = query.eq('scope', scope);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (closeout_package_id) query = query.eq('closeout_package_id', closeout_package_id);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/closeout/lien-waivers/stats
 * Get lien waiver statistics
 */
router.get('/lien-waivers/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_lien_waivers')
    .select('status, scope')
    .is('deleted_at', null);

  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw error;

  const stats = {
    total: data?.length || 0,
    requested: 0,
    received: 0,
    approved: 0,
    final: 0,
    progress: 0
  };

  (data || []).forEach(waiver => {
    if (stats[waiver.status] !== undefined) stats[waiver.status]++;
    if (stats[waiver.scope] !== undefined) stats[waiver.scope]++;
  });

  res.json(stats);
}));

/**
 * GET /api/closeout/lien-waivers/:id
 * Get a single lien waiver
 */
router.get('/lien-waivers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lien_waivers')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Lien waiver not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/lien-waivers
 * Create a new lien waiver request
 */
router.post('/lien-waivers', asyncHandler(async (req, res) => {
  const {
    job_id,
    closeout_package_id,
    vendor_id,
    vendor_name,
    waiver_type,
    scope,
    through_date,
    amount,
    exceptions,
    notes,
    created_by
  } = req.body;

  if (!job_id || !vendor_name) {
    return res.status(400).json({ error: 'Job and vendor name are required' });
  }

  const { data, error } = await supabase
    .from('v2_lien_waivers')
    .insert({
      job_id,
      closeout_package_id,
      vendor_id,
      vendor_name,
      waiver_type: waiver_type || 'conditional',
      scope: scope || 'progress',
      through_date,
      amount,
      exceptions,
      notes,
      created_by: getUserName(req),
      status: 'requested',
      requested_at: new Date().toISOString()
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
 * PATCH /api/closeout/lien-waivers/:id
 * Update a lien waiver
 */
router.patch('/lien-waivers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.waiver_number;

  const { data, error } = await supabase
    .from('v2_lien_waivers')
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
    return res.status(404).json({ error: 'Lien waiver not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/lien-waivers/:id/receive
 * Mark a lien waiver as received
 */
router.post('/lien-waivers/:id/receive', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { file_url, file_name } = req.body;

  const { data, error } = await supabase
    .from('v2_lien_waivers')
    .update({
      status: 'received',
      received_at: new Date().toISOString(),
      file_url,
      file_name
    })
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
    return res.status(404).json({ error: 'Lien waiver not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/lien-waivers/:id/approve
 * Approve a lien waiver
 */
router.post('/lien-waivers/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  const { data, error } = await supabase
    .from('v2_lien_waivers')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: getUserName(req)
    })
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
    return res.status(404).json({ error: 'Lien waiver not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/closeout/lien-waivers/:id
 * Soft delete a lien waiver
 */
router.delete('/lien-waivers/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lien_waivers')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Lien waiver not found' });
  }

  res.json({ success: true, message: 'Lien waiver deleted' });
}));

// ============================================================
// CHECKLIST ITEMS
// ============================================================

/**
 * POST /api/closeout/packages/:id/checklist
 * Add a checklist item to a package
 */
router.post('/packages/:id/checklist', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, category, is_required, due_date, related_type, related_id, sort_order } = req.body;

  // Get job_id from package
  const { data: pkg } = await supabase
    .from('v2_closeout_packages')
    .select('job_id')
    .eq('id', id)
    .single();

  if (!pkg) {
    return res.status(404).json({ error: 'Closeout package not found' });
  }

  const { data, error } = await supabase
    .from('v2_closeout_checklist_items')
    .insert({
      job_id: pkg.job_id,
      closeout_package_id: id,
      name,
      description,
      category,
      is_required: is_required !== false,
      due_date,
      related_type,
      related_id,
      sort_order: sort_order || 0
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/closeout/checklist/:id
 * Update a checklist item
 */
router.patch('/checklist/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('v2_closeout_checklist_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Checklist item not found' });
  }

  res.json(data);
}));

/**
 * POST /api/closeout/checklist/:id/complete
 * Mark a checklist item as completed
 */
router.post('/checklist/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { completed_by } = req.body;

  const { data, error } = await supabase
    .from('v2_closeout_checklist_items')
    .update({
      is_completed: true,
      completed_at: new Date().toISOString(),
      completed_by: getUserName(req)
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Checklist item not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/closeout/checklist/:id
 * Delete a checklist item
 */
router.delete('/checklist/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_closeout_checklist_items')
    .delete()
    .eq('id', id);

  if (error) throw error;
  res.json({ success: true, message: 'Checklist item deleted' });
}));

// ============================================================
// DASHBOARD / OVERVIEW
// ============================================================

/**
 * GET /api/closeout/dashboard
 * Get closeout dashboard statistics
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  // Get package stats
  let packageQuery = supabase
    .from('v2_closeout_packages')
    .select('status')
    .is('deleted_at', null);
  if (job_id) packageQuery = packageQuery.eq('job_id', job_id);
  const { data: packages } = await packageQuery;

  // Get punch list stats
  let punchQuery = supabase
    .from('v2_punch_list_items')
    .select('status, priority')
    .is('deleted_at', null);
  if (job_id) punchQuery = punchQuery.eq('job_id', job_id);
  const { data: punchItems } = await punchQuery;

  // Get inspection stats
  let inspQuery = supabase
    .from('v2_final_inspections')
    .select('status')
    .is('deleted_at', null);
  if (job_id) inspQuery = inspQuery.eq('job_id', job_id);
  const { data: inspections } = await inspQuery;

  // Get document stats
  let docQuery = supabase
    .from('v2_closeout_documents')
    .select('status')
    .is('deleted_at', null);
  if (job_id) docQuery = docQuery.eq('job_id', job_id);
  const { data: documents } = await docQuery;

  // Get lien waiver stats
  let waiverQuery = supabase
    .from('v2_lien_waivers')
    .select('status')
    .is('deleted_at', null);
  if (job_id) waiverQuery = waiverQuery.eq('job_id', job_id);
  const { data: waivers } = await waiverQuery;

  const stats = {
    packages: {
      total: packages?.length || 0,
      in_progress: packages?.filter(p => p.status === 'in_progress').length || 0,
      completed: packages?.filter(p => p.status === 'completed').length || 0
    },
    punch_list: {
      total: punchItems?.length || 0,
      open: punchItems?.filter(p => p.status === 'open').length || 0,
      completed: punchItems?.filter(p => ['completed', 'verified'].includes(p.status)).length || 0,
      critical: punchItems?.filter(p => p.priority === 'critical').length || 0
    },
    inspections: {
      total: inspections?.length || 0,
      scheduled: inspections?.filter(i => i.status === 'scheduled').length || 0,
      passed: inspections?.filter(i => i.status === 'passed').length || 0,
      failed: inspections?.filter(i => i.status === 'failed').length || 0
    },
    documents: {
      total: documents?.length || 0,
      pending: documents?.filter(d => ['required', 'pending'].includes(d.status)).length || 0,
      approved: documents?.filter(d => d.status === 'approved').length || 0
    },
    lien_waivers: {
      total: waivers?.length || 0,
      requested: waivers?.filter(w => w.status === 'requested').length || 0,
      approved: waivers?.filter(w => w.status === 'approved').length || 0
    }
  };

  res.json(stats);
}));

module.exports = router;
