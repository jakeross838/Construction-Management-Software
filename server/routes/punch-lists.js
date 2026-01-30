/**
 * Punch Lists Routes
 * Punch list tracking with items, photos, and activity
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const { broadcastInvoiceUpdate } = require('../core/realtime');

// Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// ============================================================
// ACTIVITY LOGGING HELPER
// ============================================================

async function logPunchListActivity(punchListId, itemId, action, performedBy, details = {}) {
  await supabase.from('v2_punch_list_activity').insert({
    punch_list_id: punchListId,
    item_id: itemId,
    action,
    performed_by: performedBy,
    details
  });
}

// ============================================================
// LIST & FILTER ENDPOINTS
// ============================================================

// Get punch list statistics (must be before /:id route)
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_punch_lists')
    .select(`
      id, status, job_id,
      items:v2_punch_list_items(id, status)
    `)
    .is('deleted_at', null);

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: lists, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total_lists: lists.length,
    by_status: {
      open: 0,
      in_progress: 0,
      resolved: 0,
      closed: 0
    },
    total_items: 0,
    items_by_status: {
      open: 0,
      in_progress: 0,
      resolved: 0,
      verified: 0
    }
  };

  for (const list of lists) {
    stats.by_status[list.status] = (stats.by_status[list.status] || 0) + 1;

    const items = list.items || [];
    stats.total_items += items.length;

    for (const item of items) {
      stats.items_by_status[item.status] = (stats.items_by_status[item.status] || 0) + 1;
    }
  }

  stats.items_pending_verification = stats.items_by_status.resolved;
  stats.items_complete = stats.items_by_status.verified;

  res.json(stats);
}));

// Get all punch lists
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, po_id, status, vendor_id } = req.query;

  let query = supabase
    .from('v2_punch_lists')
    .select(`
      *,
      job:v2_jobs(id, name),
      po:v2_purchase_orders(id, po_number),
      vendor:v2_vendors(id, name),
      items:v2_punch_list_items(id, status, priority)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (po_id) query = query.eq('po_id', po_id);
  if (status) query = query.eq('status', status);
  if (vendor_id) query = query.eq('assigned_vendor_id', vendor_id);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate item counts for each list
  const result = data.map(list => {
    const items = list.items || [];
    return {
      ...list,
      item_count: items.length,
      open_items: items.filter(i => i.status === 'open').length,
      in_progress_items: items.filter(i => i.status === 'in_progress').length,
      resolved_items: items.filter(i => i.status === 'resolved').length,
      verified_items: items.filter(i => i.status === 'verified').length
    };
  });

  res.json(result);
}));

// Get single punch list with full details
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: list, error } = await supabase
    .from('v2_punch_lists')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      po:v2_purchase_orders(id, po_number, total_amount),
      vendor:v2_vendors(id, name, email, phone),
      items:v2_punch_list_items(
        *,
        vendor:v2_vendors(id, name),
        schedule_task:v2_schedule_tasks(id, name)
      )
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error) throw new AppError('NOT_FOUND', 'Punch list not found');

  // Get attachments
  const { data: attachments } = await supabase
    .from('v2_punch_list_attachments')
    .select('*')
    .or(`punch_list_id.eq.${id},item_id.in.(${(list.items || []).map(i => i.id).join(',')})`)
    .order('uploaded_at', { ascending: false });

  // Get activity
  const { data: activity } = await supabase
    .from('v2_punch_list_activity')
    .select('*')
    .eq('punch_list_id', id)
    .order('created_at', { ascending: false });

  list.attachments = attachments || [];
  list.activity = activity || [];

  res.json(list);
}));

// ============================================================
// CREATE / UPDATE / DELETE
// ============================================================

// Create punch list
router.post('/', asyncHandler(async (req, res) => {
  const { job_id, po_id, title, description, assigned_vendor_id, due_date, created_by, items } = req.body;

  if (!job_id) throw new AppError('VALIDATION_ERROR', 'Job is required');
  if (!title) throw new AppError('VALIDATION_ERROR', 'Title is required');
  if (!created_by) throw new AppError('VALIDATION_ERROR', 'Created by is required');

  // Create punch list
  const { data: list, error } = await supabase
    .from('v2_punch_lists')
    .insert({
      job_id,
      po_id: po_id || null,
      title,
      description: description || null,
      assigned_vendor_id: assigned_vendor_id || null,
      due_date: due_date || null,
      created_by,
      status: 'open'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Create initial items if provided
  if (items && items.length > 0) {
    const itemsToInsert = items.map((item, index) => ({
      punch_list_id: list.id,
      item_number: index + 1,
      description: item.description,
      location: item.location || null,
      category: item.category || null,
      priority: item.priority || 'normal',
      assigned_vendor_id: item.assigned_vendor_id || assigned_vendor_id || null,
      status: 'open'
    }));

    await supabase.from('v2_punch_list_items').insert(itemsToInsert);
  }

  // Log activity
  await logPunchListActivity(list.id, null, 'created', created_by, { title, item_count: items?.length || 0 });

  // Broadcast update
  broadcastInvoiceUpdate(list.id, 'punch_list_created', { punch_list: list });

  res.json(list);
}));

// Update punch list
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, description, status, assigned_vendor_id, due_date, updated_by } = req.body;

  // Get existing
  const { data: existing, error: fetchError } = await supabase
    .from('v2_punch_lists')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    throw new AppError('NOT_FOUND', 'Punch list not found');
  }

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (status !== undefined) updates.status = status;
  if (assigned_vendor_id !== undefined) updates.assigned_vendor_id = assigned_vendor_id || null;
  if (due_date !== undefined) updates.due_date = due_date || null;
  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('v2_punch_lists')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(id, null, 'updated', updated_by || 'system', { changes: updates });

  // Broadcast update
  broadcastInvoiceUpdate(id, 'punch_list_updated', { punch_list: updated });

  res.json(updated);
}));

// Soft delete punch list
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;

  const { data, error } = await supabase
    .from('v2_punch_lists')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(id, null, 'deleted', deleted_by || 'system', {});

  res.json({ success: true, message: 'Punch list deleted' });
}));

// ============================================================
// ITEM MANAGEMENT
// ============================================================

// Add item to punch list
router.post('/:id/items', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description, location, category, priority, assigned_vendor_id, schedule_task_id, created_by } = req.body;

  if (!description) throw new AppError('VALIDATION_ERROR', 'Description is required');

  // Get current max item number
  const { data: existingItems } = await supabase
    .from('v2_punch_list_items')
    .select('item_number')
    .eq('punch_list_id', id)
    .order('item_number', { ascending: false })
    .limit(1);

  const nextNumber = (existingItems?.[0]?.item_number || 0) + 1;

  const { data: item, error } = await supabase
    .from('v2_punch_list_items')
    .insert({
      punch_list_id: id,
      item_number: nextNumber,
      description,
      location: location || null,
      category: category || null,
      priority: priority || 'normal',
      assigned_vendor_id: assigned_vendor_id || null,
      schedule_task_id: schedule_task_id || null,
      status: 'open'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Update punch list status to in_progress if it was open
  await supabase
    .from('v2_punch_lists')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'open');

  // Log activity
  await logPunchListActivity(id, item.id, 'item_added', created_by || 'system', { description, item_number: nextNumber });

  res.json(item);
}));

// Update item
router.patch('/items/:itemId', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { description, location, category, priority, assigned_vendor_id, schedule_task_id, updated_by } = req.body;

  const { data: existing, error: fetchError } = await supabase
    .from('v2_punch_list_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !existing) {
    throw new AppError('NOT_FOUND', 'Item not found');
  }

  const updates = {};
  if (description !== undefined) updates.description = description;
  if (location !== undefined) updates.location = location || null;
  if (category !== undefined) updates.category = category || null;
  if (priority !== undefined) updates.priority = priority;
  if (assigned_vendor_id !== undefined) updates.assigned_vendor_id = assigned_vendor_id || null;
  if (schedule_task_id !== undefined) updates.schedule_task_id = schedule_task_id || null;
  updates.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabase
    .from('v2_punch_list_items')
    .update(updates)
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(existing.punch_list_id, itemId, 'item_updated', updated_by || 'system', { changes: updates });

  res.json(updated);
}));

// Delete item
router.delete('/items/:itemId', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { deleted_by } = req.body;

  const { data: item, error: fetchError } = await supabase
    .from('v2_punch_list_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new AppError('NOT_FOUND', 'Item not found');
  }

  // Delete attachments first
  await supabase
    .from('v2_punch_list_attachments')
    .delete()
    .eq('item_id', itemId);

  // Delete item
  const { error } = await supabase
    .from('v2_punch_list_items')
    .delete()
    .eq('id', itemId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(item.punch_list_id, null, 'item_deleted', deleted_by || 'system', {
    description: item.description,
    item_number: item.item_number
  });

  res.json({ success: true });
}));

// ============================================================
// STATUS TRANSITIONS
// ============================================================

// Mark item as in progress
router.post('/items/:itemId/start', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { started_by } = req.body;

  const { data: item, error: fetchError } = await supabase
    .from('v2_punch_list_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new AppError('NOT_FOUND', 'Item not found');
  }

  if (item.status !== 'open') {
    throw new AppError('VALIDATION_ERROR', 'Only open items can be started');
  }

  const { data: updated, error } = await supabase
    .from('v2_punch_list_items')
    .update({ status: 'in_progress', updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(item.punch_list_id, itemId, 'item_started', started_by || 'system', {});

  res.json(updated);
}));

// Mark item as resolved (vendor claims done)
router.post('/items/:itemId/resolve', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { resolved_by, resolution_notes } = req.body;

  const { data: item, error: fetchError } = await supabase
    .from('v2_punch_list_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new AppError('NOT_FOUND', 'Item not found');
  }

  if (!['open', 'in_progress'].includes(item.status)) {
    throw new AppError('VALIDATION_ERROR', 'Only open or in-progress items can be resolved');
  }

  const { data: updated, error } = await supabase
    .from('v2_punch_list_items')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
      resolved_by: resolved_by || 'system',
      resolution_notes: resolution_notes || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(item.punch_list_id, itemId, 'item_resolved', resolved_by || 'system', {
    resolution_notes
  });

  res.json(updated);
}));

// PM verifies item as complete
router.post('/items/:itemId/verify', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { verified_by } = req.body;

  const { data: item, error: fetchError } = await supabase
    .from('v2_punch_list_items')
    .select('*, punch_list:v2_punch_lists(id, po_id)')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new AppError('NOT_FOUND', 'Item not found');
  }

  if (item.status !== 'resolved') {
    throw new AppError('VALIDATION_ERROR', 'Only resolved items can be verified');
  }

  const { data: updated, error } = await supabase
    .from('v2_punch_list_items')
    .update({
      status: 'verified',
      verified_at: new Date().toISOString(),
      verified_by: verified_by || 'system',
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(item.punch_list_id, itemId, 'item_verified', verified_by || 'system', {});

  // Check if all items are verified - update list status
  const { data: allItems } = await supabase
    .from('v2_punch_list_items')
    .select('status')
    .eq('punch_list_id', item.punch_list_id);

  const allVerified = allItems && allItems.length > 0 && allItems.every(i => i.status === 'verified');

  if (allVerified) {
    await supabase
      .from('v2_punch_lists')
      .update({ status: 'resolved', updated_at: new Date().toISOString() })
      .eq('id', item.punch_list_id);

    await logPunchListActivity(item.punch_list_id, null, 'list_resolved', verified_by || 'system', {
      reason: 'All items verified'
    });
  }

  res.json({ item: updated, all_verified: allVerified });
}));

// Reject resolved item (send back to open)
router.post('/items/:itemId/reject', asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { rejected_by, reason } = req.body;

  const { data: item, error: fetchError } = await supabase
    .from('v2_punch_list_items')
    .select('*')
    .eq('id', itemId)
    .single();

  if (fetchError || !item) {
    throw new AppError('NOT_FOUND', 'Item not found');
  }

  if (item.status !== 'resolved') {
    throw new AppError('VALIDATION_ERROR', 'Only resolved items can be rejected');
  }

  const { data: updated, error } = await supabase
    .from('v2_punch_list_items')
    .update({
      status: 'open',
      resolved_at: null,
      resolved_by: null,
      resolution_notes: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', itemId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(item.punch_list_id, itemId, 'item_rejected', rejected_by || 'system', { reason });

  res.json(updated);
}));

// ============================================================
// PHOTO ATTACHMENTS
// ============================================================

// Upload photo
router.post('/:id/photos', upload.single('file'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { item_id, category, caption, uploaded_by } = req.body;

  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'No file uploaded');
  }

  const file = req.file;

  // Validate it's an image
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.mimetype)) {
    throw new AppError('VALIDATION_ERROR', 'Only image files are allowed');
  }

  // Create storage path
  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `punch-list-photos/${id}/${timestamp}_${safeName}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (uploadError) throw new AppError('DATABASE_ERROR', uploadError.message);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('invoices')
    .getPublicUrl(storagePath);

  // Create attachment record
  const { data: attachment, error: dbError } = await supabase
    .from('v2_punch_list_attachments')
    .insert({
      punch_list_id: id,
      item_id: item_id || null,
      file_url: urlData.publicUrl,
      file_name: file.originalname,
      category: category || 'before',
      caption: caption || null,
      uploaded_by: uploaded_by || 'system'
    })
    .select()
    .single();

  if (dbError) throw new AppError('DATABASE_ERROR', dbError.message);

  // Log activity
  await logPunchListActivity(id, item_id || null, 'photo_uploaded', uploaded_by || 'system', {
    file_name: file.originalname,
    category
  });

  res.json(attachment);
}));

// Delete photo
router.delete('/photos/:photoId', asyncHandler(async (req, res) => {
  const { photoId } = req.params;
  const { deleted_by } = req.body;

  const { data: photo, error: fetchError } = await supabase
    .from('v2_punch_list_attachments')
    .select('*')
    .eq('id', photoId)
    .single();

  if (fetchError || !photo) {
    throw new AppError('NOT_FOUND', 'Photo not found');
  }

  // Extract storage path from URL and delete from storage
  const storagePath = photo.file_url.split('/storage/v1/object/public/invoices/')[1];
  if (storagePath) {
    await supabase.storage
      .from('invoices')
      .remove([storagePath]);
  }

  // Delete record
  const { error } = await supabase
    .from('v2_punch_list_attachments')
    .delete()
    .eq('id', photoId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(photo.punch_list_id, photo.item_id, 'photo_deleted', deleted_by || 'system', {
    file_name: photo.file_name
  });

  res.json({ success: true });
}));

// ============================================================
// CLOSE PUNCH LIST
// ============================================================

router.post('/:id/close', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { closed_by } = req.body;

  // Check all items are verified
  const { data: items } = await supabase
    .from('v2_punch_list_items')
    .select('id, status')
    .eq('punch_list_id', id);

  const unverified = (items || []).filter(i => i.status !== 'verified');
  if (unverified.length > 0) {
    throw new AppError('VALIDATION_ERROR', `Cannot close: ${unverified.length} items not verified`);
  }

  const { data: updated, error } = await supabase
    .from('v2_punch_lists')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPunchListActivity(id, null, 'list_closed', closed_by || 'system', {});

  res.json(updated);
}));

module.exports = router;
