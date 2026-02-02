/**
 * Plan Sets Routes
 * Drawing version control, sheet management, distributions, and markups
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit for large drawings
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/tiff',
      'image/webp',
      'application/dxf',
      'application/dwg',
      'image/vnd.dwg',
      'application/acad',
      'application/x-acad',
      'application/autocad_dwg'
    ];
    // Also allow by extension for CAD files
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (allowedTypes.includes(file.mimetype) || ['pdf', 'jpg', 'jpeg', 'png', 'tiff', 'tif', 'webp', 'dxf', 'dwg'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Allowed: PDF, images, DWG, DXF'));
    }
  }
});

const STORAGE_BUCKET = 'invoices'; // Reuse existing bucket
const PLAN_SET_PREFIX = 'plan-sets';

// Valid disciplines
const DISCIPLINES = ['architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape', 'interior', 'general', 'other'];

// Valid statuses
const STATUSES = ['current', 'superseded', 'archived'];

// Valid recipient types
const RECIPIENT_TYPES = ['vendor', 'client', 'internal', 'consultant', 'building_dept', 'other'];

// Valid markup types
const MARKUP_TYPES = ['revision_cloud', 'comment', 'dimension', 'arrow', 'text', 'rectangle', 'circle', 'line', 'highlight', 'callout'];

// ============================================================
// ACTIVITY LOGGING
// ============================================================

async function logPlanSetActivity(planSetId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_plan_set_activity').insert({
      plan_set_id: planSetId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Failed to log plan set activity:', err);
  }
}

// ============================================================
// STATS ENDPOINT (must be before /:id)
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_plan_sets')
    .select('id, status, total_sheets');

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: planSets, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total: planSets?.length || 0,
    current: 0,
    superseded: 0,
    archived: 0,
    total_sheets: 0
  };

  for (const ps of (planSets || [])) {
    stats[ps.status] = (stats[ps.status] || 0) + 1;
    stats.total_sheets += ps.total_sheets || 0;
  }

  // Get distribution stats
  if (job_id) {
    const planSetIds = (planSets || []).map(ps => ps.id);
    const { data: distributions } = await supabase
      .from('v2_plan_distributions')
      .select('id, viewed_at, acknowledged_at')
      .in('plan_set_id', planSetIds);

    stats.distributions = {
      total: distributions?.length || 0,
      viewed: distributions?.filter(d => d.viewed_at).length || 0,
      acknowledged: distributions?.filter(d => d.acknowledged_at).length || 0
    };
  }

  res.json(stats);
}));

// ============================================================
// LIST PLAN SETS
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, search, include_superseded } = req.query;

  let query = supabase
    .from('v2_plan_sets')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .order('created_at', { ascending: false });

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  if (status) {
    query = query.eq('status', status);
  } else if (include_superseded !== 'true') {
    // By default, don't show superseded versions
    query = query.neq('status', 'superseded');
  }

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get sheet counts for each plan set
  const planSetIds = (data || []).map(ps => ps.id);
  const { data: sheetCounts } = await supabase
    .from('v2_plan_sheets')
    .select('plan_set_id')
    .in('plan_set_id', planSetIds);

  const sheetCountMap = {};
  (sheetCounts || []).forEach(sheet => {
    sheetCountMap[sheet.plan_set_id] = (sheetCountMap[sheet.plan_set_id] || 0) + 1;
  });

  // Get distribution counts
  const { data: distCounts } = await supabase
    .from('v2_plan_distributions')
    .select('plan_set_id')
    .in('plan_set_id', planSetIds);

  const distCountMap = {};
  (distCounts || []).forEach(dist => {
    distCountMap[dist.plan_set_id] = (distCountMap[dist.plan_set_id] || 0) + 1;
  });

  const result = (data || []).map(ps => ({
    ...ps,
    sheet_count: sheetCountMap[ps.id] || 0,
    distribution_count: distCountMap[ps.id] || 0
  }));

  res.json(result);
}));

// ============================================================
// GET SINGLE PLAN SET
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: planSet, error } = await supabase
    .from('v2_plan_sets')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      parent:v2_plan_sets!v2_plan_sets_parent_plan_set_id_fkey(id, name, version)
    `)
    .eq('id', id)
    .single();

  if (error || !planSet) throw new AppError('NOT_FOUND', 'Plan set not found');

  // Get sheets
  const { data: sheets } = await supabase
    .from('v2_plan_sheets')
    .select('*')
    .eq('plan_set_id', id)
    .order('sort_order')
    .order('sheet_number');

  // Get activity
  const { data: activity } = await supabase
    .from('v2_plan_set_activity')
    .select('*')
    .eq('plan_set_id', id)
    .order('created_at', { ascending: false })
    .limit(50);

  // Get child versions (if this plan set has been superseded)
  const { data: childVersions } = await supabase
    .from('v2_plan_sets')
    .select('id, name, version, status, created_at')
    .eq('parent_plan_set_id', id)
    .order('version', { ascending: false });

  planSet.sheets = sheets || [];
  planSet.activity = activity || [];
  planSet.child_versions = childVersions || [];

  res.json(planSet);
}));

// ============================================================
// CREATE PLAN SET
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    name,
    description,
    issue_date,
    notes,
    created_by
  } = req.body;

  if (!job_id) throw new AppError('VALIDATION_ERROR', 'Job is required');
  if (!name) throw new AppError('VALIDATION_ERROR', 'Name is required');

  // Get the next version number for this job/name combination
  const { data: existing } = await supabase
    .from('v2_plan_sets')
    .select('version')
    .eq('job_id', job_id)
    .ilike('name', name)
    .order('version', { ascending: false })
    .limit(1);

  const nextVersion = (existing?.[0]?.version || 0) + 1;

  const { data: planSet, error } = await supabase
    .from('v2_plan_sets')
    .insert({
      job_id,
      name,
      version: nextVersion,
      description: description || null,
      issue_date: issue_date || new Date().toISOString().split('T')[0],
      notes: notes || null,
      status: 'current',
      created_by: created_by || 'System'
    })
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logPlanSetActivity(planSet.id, 'created', created_by || 'System', { name, version: nextVersion });

  res.status(201).json(planSet);
}));

// ============================================================
// UPDATE PLAN SET
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    description,
    issue_date,
    status,
    notes,
    updated_by
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (issue_date !== undefined) updates.issue_date = issue_date;
  if (notes !== undefined) updates.notes = notes;

  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      throw new AppError('VALIDATION_ERROR', `Invalid status. Allowed: ${STATUSES.join(', ')}`);
    }
    updates.status = status;
  }

  const { data: planSet, error } = await supabase
    .from('v2_plan_sets')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!planSet) throw new AppError('NOT_FOUND', 'Plan set not found');

  await logPlanSetActivity(id, 'updated', updated_by || 'System', { updates });

  res.json(planSet);
}));

// ============================================================
// DELETE PLAN SET
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;

  // Get plan set info for logging
  const { data: planSet, error: fetchError } = await supabase
    .from('v2_plan_sets')
    .select('name, version')
    .eq('id', id)
    .single();

  if (fetchError || !planSet) throw new AppError('NOT_FOUND', 'Plan set not found');

  // Delete the plan set (cascades to sheets, distributions, etc.)
  const { error } = await supabase
    .from('v2_plan_sets')
    .delete()
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: `Plan set "${planSet.name}" v${planSet.version} deleted` });
}));

// ============================================================
// CREATE NEW VERSION (copies sheets from parent)
// ============================================================

router.post('/:id/new-version', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description, issue_date, notes, created_by } = req.body;

  // Get the parent plan set
  const { data: parent, error: parentError } = await supabase
    .from('v2_plan_sets')
    .select('*')
    .eq('id', id)
    .single();

  if (parentError || !parent) throw new AppError('NOT_FOUND', 'Plan set not found');

  // Mark parent as superseded
  await supabase
    .from('v2_plan_sets')
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('id', id);

  // Create new version
  const newVersion = parent.version + 1;
  const { data: newPlanSet, error: createError } = await supabase
    .from('v2_plan_sets')
    .insert({
      builder_id: parent.builder_id,
      job_id: parent.job_id,
      name: parent.name,
      version: newVersion,
      description: description || parent.description,
      issue_date: issue_date || new Date().toISOString().split('T')[0],
      notes: notes || parent.notes,
      status: 'current',
      parent_plan_set_id: id,
      total_sheets: parent.total_sheets,
      created_by: created_by || 'System'
    })
    .select()
    .single();

  if (createError) throw new AppError('DATABASE_ERROR', createError.message);

  // Copy sheets from parent
  const { data: parentSheets } = await supabase
    .from('v2_plan_sheets')
    .select('*')
    .eq('plan_set_id', id)
    .order('sort_order');

  if (parentSheets && parentSheets.length > 0) {
    const newSheets = parentSheets.map(sheet => ({
      plan_set_id: newPlanSet.id,
      sheet_number: sheet.sheet_number,
      sheet_name: sheet.sheet_name,
      discipline: sheet.discipline,
      file_url: sheet.file_url,
      thumbnail_url: sheet.thumbnail_url,
      revision: sheet.revision,
      revision_date: sheet.revision_date,
      revision_notes: sheet.revision_notes,
      page_size: sheet.page_size,
      scale: sheet.scale,
      sort_order: sheet.sort_order
    }));

    await supabase.from('v2_plan_sheets').insert(newSheets);
  }

  // Log activity
  await logPlanSetActivity(newPlanSet.id, 'version_created', created_by || 'System', {
    parent_id: id,
    parent_version: parent.version,
    new_version: newVersion,
    sheets_copied: parentSheets?.length || 0
  });

  await logPlanSetActivity(id, 'superseded', created_by || 'System', {
    new_version_id: newPlanSet.id,
    new_version: newVersion
  });

  // Fetch complete plan set with job info
  const { data: completePlanSet } = await supabase
    .from('v2_plan_sets')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', newPlanSet.id)
    .single();

  res.status(201).json(completePlanSet);
}));

// ============================================================
// GET SHEETS
// ============================================================

router.get('/:id/sheets', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { discipline } = req.query;

  let query = supabase
    .from('v2_plan_sheets')
    .select('*')
    .eq('plan_set_id', id)
    .order('sort_order')
    .order('sheet_number');

  if (discipline) {
    query = query.eq('discipline', discipline);
  }

  const { data: sheets, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get markup counts for each sheet
  const sheetIds = (sheets || []).map(s => s.id);
  const { data: markupCounts } = await supabase
    .from('v2_plan_markups')
    .select('sheet_id, resolved')
    .in('sheet_id', sheetIds);

  const markupCountMap = {};
  (markupCounts || []).forEach(m => {
    if (!markupCountMap[m.sheet_id]) {
      markupCountMap[m.sheet_id] = { total: 0, unresolved: 0 };
    }
    markupCountMap[m.sheet_id].total++;
    if (!m.resolved) {
      markupCountMap[m.sheet_id].unresolved++;
    }
  });

  const result = (sheets || []).map(sheet => ({
    ...sheet,
    markup_count: markupCountMap[sheet.id]?.total || 0,
    unresolved_markups: markupCountMap[sheet.id]?.unresolved || 0
  }));

  res.json(result);
}));

// ============================================================
// ADD SHEET
// ============================================================

router.post('/:id/sheets', upload.single('file'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    sheet_number,
    sheet_name,
    discipline,
    revision,
    revision_date,
    revision_notes,
    page_size,
    scale,
    sort_order,
    created_by
  } = req.body;

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'File is required');
  if (!sheet_number) throw new AppError('VALIDATION_ERROR', 'Sheet number is required');
  if (!sheet_name) throw new AppError('VALIDATION_ERROR', 'Sheet name is required');

  // Verify plan set exists
  const { data: planSet, error: psError } = await supabase
    .from('v2_plan_sets')
    .select('id, name, job_id')
    .eq('id', id)
    .single();

  if (psError || !planSet) throw new AppError('NOT_FOUND', 'Plan set not found');

  // Validate discipline
  if (discipline && !DISCIPLINES.includes(discipline)) {
    throw new AppError('VALIDATION_ERROR', `Invalid discipline. Allowed: ${DISCIPLINES.join(', ')}`);
  }

  // Upload file to storage
  const uniqueId = Date.now().toString();
  const ext = req.file.originalname.split('.').pop();
  const storagePath = `${PLAN_SET_PREFIX}/${planSet.job_id}/${id}/${uniqueId}_${sheet_number}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });

  if (uploadError) throw new AppError('STORAGE_ERROR', uploadError.message);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  // Get max sort_order if not provided
  let finalSortOrder = parseInt(sort_order) || 0;
  if (!sort_order) {
    const { data: maxOrder } = await supabase
      .from('v2_plan_sheets')
      .select('sort_order')
      .eq('plan_set_id', id)
      .order('sort_order', { ascending: false })
      .limit(1);
    finalSortOrder = (maxOrder?.[0]?.sort_order || 0) + 1;
  }

  // Create sheet record
  const { data: sheet, error: sheetError } = await supabase
    .from('v2_plan_sheets')
    .insert({
      plan_set_id: id,
      sheet_number,
      sheet_name,
      discipline: discipline || 'general',
      file_url: urlData.publicUrl,
      revision: revision || 'A',
      revision_date: revision_date || null,
      revision_notes: revision_notes || null,
      page_size: page_size || null,
      scale: scale || null,
      sort_order: finalSortOrder
    })
    .select()
    .single();

  if (sheetError) throw new AppError('DATABASE_ERROR', sheetError.message);

  // Update plan set sheet count
  await supabase.rpc('increment_plan_set_sheets', { plan_set_id: id }).catch(() => {
    // If RPC doesn't exist, update manually
    supabase
      .from('v2_plan_sets')
      .update({
        total_sheets: supabase.raw('total_sheets + 1'),
        updated_at: new Date().toISOString()
      })
      .eq('id', id);
  });

  await logPlanSetActivity(id, 'sheet_added', created_by || 'System', {
    sheet_id: sheet.id,
    sheet_number,
    sheet_name
  });

  res.status(201).json(sheet);
}));

// ============================================================
// UPDATE SHEET
// ============================================================

router.patch('/:id/sheets/:sheetId', asyncHandler(async (req, res) => {
  const { id, sheetId } = req.params;
  const {
    sheet_number,
    sheet_name,
    discipline,
    revision,
    revision_date,
    revision_notes,
    page_size,
    scale,
    sort_order,
    updated_by
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };

  if (sheet_number !== undefined) updates.sheet_number = sheet_number;
  if (sheet_name !== undefined) updates.sheet_name = sheet_name;
  if (revision !== undefined) updates.revision = revision;
  if (revision_date !== undefined) updates.revision_date = revision_date;
  if (revision_notes !== undefined) updates.revision_notes = revision_notes;
  if (page_size !== undefined) updates.page_size = page_size;
  if (scale !== undefined) updates.scale = scale;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  if (discipline !== undefined) {
    if (!DISCIPLINES.includes(discipline)) {
      throw new AppError('VALIDATION_ERROR', `Invalid discipline. Allowed: ${DISCIPLINES.join(', ')}`);
    }
    updates.discipline = discipline;
  }

  const { data: sheet, error } = await supabase
    .from('v2_plan_sheets')
    .update(updates)
    .eq('id', sheetId)
    .eq('plan_set_id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!sheet) throw new AppError('NOT_FOUND', 'Sheet not found');

  await logPlanSetActivity(id, 'sheet_updated', updated_by || 'System', {
    sheet_id: sheetId,
    updates
  });

  res.json(sheet);
}));

// ============================================================
// DELETE SHEET
// ============================================================

router.delete('/:id/sheets/:sheetId', asyncHandler(async (req, res) => {
  const { id, sheetId } = req.params;
  const { deleted_by } = req.body;

  const { data: sheet, error } = await supabase
    .from('v2_plan_sheets')
    .delete()
    .eq('id', sheetId)
    .eq('plan_set_id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!sheet) throw new AppError('NOT_FOUND', 'Sheet not found');

  // Delete file from storage (best effort)
  try {
    const urlParts = sheet.file_url.split('/');
    const storagePath = urlParts.slice(urlParts.indexOf(PLAN_SET_PREFIX)).join('/');
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
  } catch (e) {
    console.error('Failed to delete sheet file:', e);
  }

  await logPlanSetActivity(id, 'sheet_removed', deleted_by || 'System', {
    sheet_id: sheetId,
    sheet_number: sheet.sheet_number,
    sheet_name: sheet.sheet_name
  });

  res.json({ success: true, message: 'Sheet deleted' });
}));

// ============================================================
// UPLOAD THUMBNAIL FOR SHEET
// ============================================================

router.post('/:id/sheets/:sheetId/thumbnail', upload.single('thumbnail'), asyncHandler(async (req, res) => {
  const { id, sheetId } = req.params;

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'Thumbnail file is required');

  // Verify sheet exists
  const { data: sheet, error: sheetError } = await supabase
    .from('v2_plan_sheets')
    .select('id, plan_set_id')
    .eq('id', sheetId)
    .eq('plan_set_id', id)
    .single();

  if (sheetError || !sheet) throw new AppError('NOT_FOUND', 'Sheet not found');

  // Get plan set for job_id
  const { data: planSet } = await supabase
    .from('v2_plan_sets')
    .select('job_id')
    .eq('id', id)
    .single();

  // Upload thumbnail
  const uniqueId = Date.now().toString();
  const storagePath = `${PLAN_SET_PREFIX}/${planSet.job_id}/${id}/thumbnails/${uniqueId}_${sheetId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: true
    });

  if (uploadError) throw new AppError('STORAGE_ERROR', uploadError.message);

  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  // Update sheet with thumbnail URL
  const { data: updatedSheet, error: updateError } = await supabase
    .from('v2_plan_sheets')
    .update({
      thumbnail_url: urlData.publicUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', sheetId)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  res.json(updatedSheet);
}));

// ============================================================
// GET DISTRIBUTIONS
// ============================================================

router.get('/:id/distributions', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: distributions, error } = await supabase
    .from('v2_plan_distributions')
    .select('*')
    .eq('plan_set_id', id)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Enrich with vendor info if recipient_type is vendor
  const vendorIds = (distributions || [])
    .filter(d => d.recipient_type === 'vendor' && d.recipient_id)
    .map(d => d.recipient_id);

  let vendorMap = {};
  if (vendorIds.length > 0) {
    const { data: vendors } = await supabase
      .from('v2_vendors')
      .select('id, name, email')
      .in('id', vendorIds);
    vendorMap = Object.fromEntries((vendors || []).map(v => [v.id, v]));
  }

  const result = (distributions || []).map(d => ({
    ...d,
    vendor: d.recipient_type === 'vendor' && d.recipient_id ? vendorMap[d.recipient_id] : null
  }));

  res.json(result);
}));

// ============================================================
// CREATE DISTRIBUTION (send to recipients)
// ============================================================

router.post('/:id/distribute', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    recipients,  // Array of { recipient_type, recipient_id?, recipient_email, recipient_name, recipient_company }
    delivery_method,
    notes,
    sent_by
  } = req.body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'At least one recipient is required');
  }

  // Verify plan set exists
  const { data: planSet, error: psError } = await supabase
    .from('v2_plan_sets')
    .select('id, name, version')
    .eq('id', id)
    .single();

  if (psError || !planSet) throw new AppError('NOT_FOUND', 'Plan set not found');

  // Create distribution records
  const distributionRecords = recipients.map(r => {
    if (!RECIPIENT_TYPES.includes(r.recipient_type)) {
      throw new AppError('VALIDATION_ERROR', `Invalid recipient type: ${r.recipient_type}`);
    }
    return {
      plan_set_id: id,
      recipient_type: r.recipient_type,
      recipient_id: r.recipient_id || null,
      recipient_email: r.recipient_email || null,
      recipient_name: r.recipient_name || null,
      recipient_company: r.recipient_company || null,
      sent_at: new Date().toISOString(),
      delivery_method: delivery_method || 'email',
      notes: notes || null,
      sent_by: sent_by || 'System'
    };
  });

  const { data: distributions, error } = await supabase
    .from('v2_plan_distributions')
    .insert(distributionRecords)
    .select();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logPlanSetActivity(id, 'distributed', sent_by || 'System', {
    recipient_count: recipients.length,
    delivery_method: delivery_method || 'email',
    recipients: recipients.map(r => r.recipient_name || r.recipient_email)
  });

  res.status(201).json({
    success: true,
    message: `Plan set distributed to ${recipients.length} recipient(s)`,
    distributions
  });
}));

// ============================================================
// UPDATE DISTRIBUTION (mark viewed/acknowledged)
// ============================================================

router.patch('/distributions/:distributionId', asyncHandler(async (req, res) => {
  const { distributionId } = req.params;
  const { viewed_at, acknowledged_at, download_count } = req.body;

  const updates = {};
  if (viewed_at) updates.viewed_at = viewed_at;
  if (acknowledged_at) updates.acknowledged_at = acknowledged_at;
  if (download_count !== undefined) updates.download_count = download_count;

  const { data: distribution, error } = await supabase
    .from('v2_plan_distributions')
    .update(updates)
    .eq('id', distributionId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!distribution) throw new AppError('NOT_FOUND', 'Distribution not found');

  res.json(distribution);
}));

// ============================================================
// DELETE DISTRIBUTION
// ============================================================

router.delete('/distributions/:distributionId', asyncHandler(async (req, res) => {
  const { distributionId } = req.params;

  const { data: distribution, error } = await supabase
    .from('v2_plan_distributions')
    .delete()
    .eq('id', distributionId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!distribution) throw new AppError('NOT_FOUND', 'Distribution not found');

  res.json({ success: true, message: 'Distribution record deleted' });
}));

// ============================================================
// GET SHEET MARKUPS
// ============================================================

router.get('/sheets/:sheetId/markups', asyncHandler(async (req, res) => {
  const { sheetId } = req.params;
  const { markup_type, resolved } = req.query;

  let query = supabase
    .from('v2_plan_markups')
    .select('*')
    .eq('sheet_id', sheetId)
    .order('created_at', { ascending: false });

  if (markup_type) {
    query = query.eq('markup_type', markup_type);
  }

  if (resolved !== undefined) {
    query = query.eq('resolved', resolved === 'true');
  }

  const { data: markups, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(markups || []);
}));

// ============================================================
// CREATE MARKUP
// ============================================================

router.post('/sheets/:sheetId/markups', asyncHandler(async (req, res) => {
  const { sheetId } = req.params;
  const {
    markup_type,
    markup_data,
    revision,
    created_by
  } = req.body;

  if (!markup_type) throw new AppError('VALIDATION_ERROR', 'Markup type is required');
  if (!MARKUP_TYPES.includes(markup_type)) {
    throw new AppError('VALIDATION_ERROR', `Invalid markup type. Allowed: ${MARKUP_TYPES.join(', ')}`);
  }

  // Verify sheet exists and get plan_set_id for logging
  const { data: sheet, error: sheetError } = await supabase
    .from('v2_plan_sheets')
    .select('id, plan_set_id, sheet_number')
    .eq('id', sheetId)
    .single();

  if (sheetError || !sheet) throw new AppError('NOT_FOUND', 'Sheet not found');

  const { data: markup, error } = await supabase
    .from('v2_plan_markups')
    .insert({
      sheet_id: sheetId,
      markup_type,
      markup_data: markup_data || {},
      revision: revision || null,
      created_by: created_by || 'System'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logPlanSetActivity(sheet.plan_set_id, 'markup_added', created_by || 'System', {
    sheet_id: sheetId,
    sheet_number: sheet.sheet_number,
    markup_type,
    markup_id: markup.id
  });

  res.status(201).json(markup);
}));

// ============================================================
// UPDATE MARKUP
// ============================================================

router.patch('/markups/:markupId', asyncHandler(async (req, res) => {
  const { markupId } = req.params;
  const {
    markup_type,
    markup_data,
    revision,
    resolved,
    resolved_by,
    updated_by
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };

  if (markup_type !== undefined) {
    if (!MARKUP_TYPES.includes(markup_type)) {
      throw new AppError('VALIDATION_ERROR', `Invalid markup type. Allowed: ${MARKUP_TYPES.join(', ')}`);
    }
    updates.markup_type = markup_type;
  }
  if (markup_data !== undefined) updates.markup_data = markup_data;
  if (revision !== undefined) updates.revision = revision;
  if (resolved !== undefined) {
    updates.resolved = resolved;
    if (resolved) {
      updates.resolved_at = new Date().toISOString();
      updates.resolved_by = resolved_by || updated_by || 'System';
    } else {
      updates.resolved_at = null;
      updates.resolved_by = null;
    }
  }

  const { data: markup, error } = await supabase
    .from('v2_plan_markups')
    .update(updates)
    .eq('id', markupId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!markup) throw new AppError('NOT_FOUND', 'Markup not found');

  res.json(markup);
}));

// ============================================================
// DELETE MARKUP
// ============================================================

router.delete('/markups/:markupId', asyncHandler(async (req, res) => {
  const { markupId } = req.params;

  const { data: markup, error } = await supabase
    .from('v2_plan_markups')
    .delete()
    .eq('id', markupId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!markup) throw new AppError('NOT_FOUND', 'Markup not found');

  res.json({ success: true, message: 'Markup deleted' });
}));

// ============================================================
// GET VERSION HISTORY
// ============================================================

router.get('/:id/versions', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get the current plan set
  const { data: current, error: currentError } = await supabase
    .from('v2_plan_sets')
    .select('id, name, job_id, parent_plan_set_id')
    .eq('id', id)
    .single();

  if (currentError || !current) throw new AppError('NOT_FOUND', 'Plan set not found');

  // Find the root of the version chain
  let rootId = id;
  let checkId = current.parent_plan_set_id;
  while (checkId) {
    rootId = checkId;
    const { data: parent } = await supabase
      .from('v2_plan_sets')
      .select('id, parent_plan_set_id')
      .eq('id', checkId)
      .single();
    checkId = parent?.parent_plan_set_id;
  }

  // Get all versions in this chain
  const { data: versions, error } = await supabase
    .from('v2_plan_sets')
    .select('id, name, version, status, issue_date, total_sheets, created_at, created_by')
    .eq('job_id', current.job_id)
    .eq('name', current.name)
    .order('version', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(versions || []);
}));

// ============================================================
// GET ACTIVITY
// ============================================================

router.get('/:id/activity', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 50 } = req.query;

  const { data: activity, error } = await supabase
    .from('v2_plan_set_activity')
    .select('*')
    .eq('plan_set_id', id)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(activity || []);
}));

module.exports = router;
