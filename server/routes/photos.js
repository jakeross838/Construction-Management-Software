/**
 * Photos Routes
 * Job progress documentation through photos with metadata and entity linking
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// Multer for photo uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  }
});

const STORAGE_BUCKET = 'invoices';
const PHOTO_PREFIX = 'photos';

// ============================================================
// ACTIVITY LOGGING HELPER
// ============================================================

async function logPhotoActivity(photoId, action, performedBy, details = {}, builderId = null) {
  await supabase.from('v2_photo_activity').insert({
    photo_id: photoId,
    action,
    performed_by: performedBy,
    details,
    builder_id: builderId
  });
}

// ============================================================
// STATS ENDPOINT (must be before /:id)
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id } = req.query;

  let query = supabase
    .from('v2_photos')
    .select('id, category, taken_at')
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: photos, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total: photos.length,
    by_category: {},
    by_month: {}
  };

  for (const photo of photos) {
    // Count by category
    const cat = photo.category || 'progress';
    stats.by_category[cat] = (stats.by_category[cat] || 0) + 1;

    // Count by month
    if (photo.taken_at) {
      const monthKey = photo.taken_at.substring(0, 7); // YYYY-MM
      stats.by_month[monthKey] = (stats.by_month[monthKey] || 0) + 1;
    }
  }

  res.json(stats);
}));

// ============================================================
// LIST PHOTOS
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, category, search, start_date, end_date, entity_type, entity_id, limit = 50, offset = 0 } = req.query;

  let query = supabase
    .from('v2_photos')
    .select(`
      *,
      job:v2_jobs(id, name),
      links:v2_photo_links(id, entity_type, entity_id)
    `, { count: 'exact' })
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .order('taken_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (category) query = query.eq('category', category);
  if (search) query = query.ilike('caption', `%${search}%`);
  if (start_date) query = query.gte('taken_at', start_date);
  if (end_date) query = query.lte('taken_at', end_date);

  // Apply pagination
  query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  const { data, count, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // If filtering by entity, filter in memory (Supabase doesn't support nested array filtering well)
  let filteredData = data || [];
  if (entity_type && entity_id) {
    filteredData = filteredData.filter(photo =>
      photo.links?.some(link => link.entity_type === entity_type && link.entity_id === entity_id)
    );
  }

  res.json({
    data: filteredData,
    count: entity_type && entity_id ? filteredData.length : count
  });
}));

// ============================================================
// GET PHOTOS BY ENTITY
// ============================================================

router.get('/by-entity/:entityType/:entityId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { entityType, entityId } = req.params;

  // Validate entity type
  const validTypes = ['inspection', 'punch_item', 'daily_log'];
  if (!validTypes.includes(entityType)) {
    throw new AppError('VALIDATION_ERROR', `Invalid entity type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Get photo links for this entity
  const { data: links, error: linkError } = await supabase
    .from('v2_photo_links')
    .select('photo_id')
    .eq('builder_id', builderId)
    .eq('entity_type', entityType)
    .eq('entity_id', entityId);

  if (linkError) throw new AppError('DATABASE_ERROR', linkError.message);

  if (!links || links.length === 0) {
    return res.json([]);
  }

  const photoIds = links.map(l => l.photo_id);

  // Get the photos
  const { data: photos, error: photoError } = await supabase
    .from('v2_photos')
    .select(`
      *,
      job:v2_jobs(id, name),
      links:v2_photo_links(id, entity_type, entity_id)
    `)
    .eq('builder_id', builderId)
    .in('id', photoIds)
    .is('deleted_at', null)
    .order('taken_at', { ascending: false, nullsFirst: false });

  if (photoError) throw new AppError('DATABASE_ERROR', photoError.message);

  res.json(photos || []);
}));

// ============================================================
// GET SINGLE PHOTO
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: photo, error } = await supabase
    .from('v2_photos')
    .select(`
      *,
      job:v2_jobs(id, name, address)
    `)
    .eq('builder_id', builderId)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !photo) throw new AppError('NOT_FOUND', 'Photo not found');

  // Get links
  const { data: links } = await supabase
    .from('v2_photo_links')
    .select('*')
    .eq('builder_id', builderId)
    .eq('photo_id', id);

  // Get activity
  const { data: activity } = await supabase
    .from('v2_photo_activity')
    .select('*')
    .eq('builder_id', builderId)
    .eq('photo_id', id)
    .order('created_at', { ascending: false });

  photo.links = links || [];
  photo.activity = activity || [];

  res.json(photo);
}));

// ============================================================
// UPLOAD PHOTO
// ============================================================

router.post('/', upload.single('file'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, caption, location, category, taken_at, latitude, longitude, uploaded_by } = req.body;

  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'No file uploaded');
  }

  if (!job_id) {
    throw new AppError('VALIDATION_ERROR', 'Job ID is required');
  }

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('builder_id', builderId)
    .eq('id', job_id)
    .single();

  if (jobError || !job) {
    throw new AppError('NOT_FOUND', 'Job not found');
  }

  const file = req.file;

  // Create storage path
  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `${PHOTO_PREFIX}/${job_id}/${timestamp}_${safeName}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (uploadError) throw new AppError('STORAGE_ERROR', uploadError.message);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  // Create photo record
  const { data: photo, error: dbError } = await supabase
    .from('v2_photos')
    .insert({
      job_id,
      file_url: urlData.publicUrl,
      file_name: file.originalname,
      caption: caption || null,
      location: location || null,
      category: category || 'progress',
      taken_at: taken_at || null,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      uploaded_by: uploaded_by || 'system',
      builder_id: builderId
    })
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (dbError) throw new AppError('DATABASE_ERROR', dbError.message);

  // Log activity
  await logPhotoActivity(photo.id, 'photo_uploaded', uploaded_by || 'system', {
    file_name: file.originalname,
    category: category || 'progress'
  }, builderId);

  res.status(201).json(photo);
}));

// ============================================================
// UPDATE PHOTO METADATA
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { caption, location, category, taken_at, updated_by } = req.body;

  // Build update object with only provided fields
  const updates = {};
  if (caption !== undefined) updates.caption = caption;
  if (location !== undefined) updates.location = location;
  if (category !== undefined) updates.category = category;
  if (taken_at !== undefined) updates.taken_at = taken_at;

  if (Object.keys(updates).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No fields to update');
  }

  const { data: photo, error } = await supabase
    .from('v2_photos')
    .update(updates)
    .eq('builder_id', builderId)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!photo) throw new AppError('NOT_FOUND', 'Photo not found');

  await logPhotoActivity(id, 'photo_updated', updated_by || 'system', { updates }, builderId);

  res.json(photo);
}));

// ============================================================
// DELETE PHOTO (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { deleted_by } = req.body;

  const { data: photo, error } = await supabase
    .from('v2_photos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('builder_id', builderId)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!photo) throw new AppError('NOT_FOUND', 'Photo not found');

  await logPhotoActivity(id, 'photo_deleted', deleted_by || 'system', {
    file_name: photo.file_name
  }, builderId);

  res.json({ success: true, message: 'Photo deleted' });
}));

// ============================================================
// LINK PHOTO TO ENTITY
// ============================================================

router.post('/:id/links', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { entity_type, entity_id, created_by } = req.body;

  if (!entity_type || !entity_id) {
    throw new AppError('VALIDATION_ERROR', 'entity_type and entity_id are required');
  }

  // Validate entity type
  const validTypes = ['inspection', 'punch_item', 'daily_log'];
  if (!validTypes.includes(entity_type)) {
    throw new AppError('VALIDATION_ERROR', `Invalid entity type. Must be one of: ${validTypes.join(', ')}`);
  }

  // Verify photo exists
  const { data: photo, error: photoError } = await supabase
    .from('v2_photos')
    .select('id')
    .eq('builder_id', builderId)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (photoError || !photo) {
    throw new AppError('NOT_FOUND', 'Photo not found');
  }

  // Create link
  const { data: link, error: linkError } = await supabase
    .from('v2_photo_links')
    .insert({
      photo_id: id,
      entity_type,
      entity_id,
      builder_id: builderId
    })
    .select()
    .single();

  if (linkError) {
    if (linkError.code === '23505') { // Unique constraint violation
      throw new AppError('VALIDATION_ERROR', 'Photo is already linked to this entity');
    }
    throw new AppError('DATABASE_ERROR', linkError.message);
  }

  await logPhotoActivity(id, 'photo_linked', created_by || 'system', {
    entity_type,
    entity_id
  }, builderId);

  res.status(201).json(link);
}));

// ============================================================
// REMOVE ENTITY LINK
// ============================================================

router.delete('/:id/links/:linkId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id, linkId } = req.params;
  const { deleted_by } = req.body;

  // Get link details for logging
  const { data: link, error: fetchError } = await supabase
    .from('v2_photo_links')
    .select('*')
    .eq('builder_id', builderId)
    .eq('id', linkId)
    .eq('photo_id', id)
    .single();

  if (fetchError || !link) {
    throw new AppError('NOT_FOUND', 'Link not found');
  }

  // Delete link
  const { error: deleteError } = await supabase
    .from('v2_photo_links')
    .delete()
    .eq('builder_id', builderId)
    .eq('id', linkId);

  if (deleteError) throw new AppError('DATABASE_ERROR', deleteError.message);

  await logPhotoActivity(id, 'photo_unlinked', deleted_by || 'system', {
    entity_type: link.entity_type,
    entity_id: link.entity_id
  }, builderId);

  res.json({ success: true, message: 'Link removed' });
}));

module.exports = router;
