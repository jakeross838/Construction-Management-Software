/**
 * Purchase Orders Routes
 * Purchase order management endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');
const { broadcastInvoiceUpdate } = require('../realtime');
const { logPOActivity } = require('../services/activityLogger');

// Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// Get all purchase orders
router.get('/', async (req, res) => {
  try {
    const { job_id, vendor_id, status } = req.query;

    let query = supabase
      .from('v2_purchase_orders')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        line_items:v2_po_line_items(
          id, description, amount, invoiced_amount,
          cost_code:v2_cost_codes(id, code, name)
        )
      `)
      .order('created_at', { ascending: false });

    if (job_id) query = query.eq('job_id', job_id);
    if (vendor_id) query = query.eq('vendor_id', vendor_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get PO statistics (must be before /:id route)
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_purchase_orders')
    .select('id, total_amount, status, status_detail, approval_status')
    .is('deleted_at', null);

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: pos, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get billed amounts
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('po_id, amount, status')
    .in('po_id', pos.map(p => p.id))
    .is('deleted_at', null);

  const billedByPO = {};
  if (invoices) {
    for (const inv of invoices) {
      if (['approved', 'in_draw', 'paid'].includes(inv.status)) {
        billedByPO[inv.po_id] = (billedByPO[inv.po_id] || 0) + parseFloat(inv.amount || 0);
      }
    }
  }

  const stats = {
    total_count: pos.length,
    total_value: pos.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
    total_billed: Object.values(billedByPO).reduce((sum, v) => sum + v, 0),
    by_status: {
      pending: { count: 0, value: 0 },
      approved: { count: 0, value: 0 },
      active: { count: 0, value: 0 },
      closed: { count: 0, value: 0 },
      cancelled: { count: 0, value: 0 }
    },
    pending_approval: pos.filter(p => p.approval_status === 'pending').length,
    over_budget: 0
  };

  for (const po of pos) {
    const status = po.status_detail || 'pending';
    if (stats.by_status[status]) {
      stats.by_status[status].count++;
      stats.by_status[status].value += parseFloat(po.total_amount || 0);
    }

    // Check if over budget
    const billed = billedByPO[po.id] || 0;
    if (billed > parseFloat(po.total_amount || 0)) {
      stats.over_budget++;
    }
  }

  stats.total_remaining = stats.total_value - stats.total_billed;

  res.json(stats);
}));

// Get single purchase order
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_purchase_orders')
      .select(`
        *,
        vendor:v2_vendors(id, name, email, phone),
        job:v2_jobs(id, name, address),
        line_items:v2_po_line_items(
          id, description, amount, invoiced_amount,
          cost_code:v2_cost_codes(id, code, name, category)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create purchase order
router.post('/', async (req, res) => {
  try {
    const { line_items, ...poData } = req.body;

    // Validate PO-CO linkage if job_change_order_id is provided
    if (poData.job_change_order_id) {
      const { data: co, error: coError } = await supabase
        .from('v2_job_change_orders')
        .select('id, job_id, status')
        .eq('id', poData.job_change_order_id)
        .single();

      if (coError || !co) {
        return res.status(400).json({ error: 'Change order not found' });
      }

      if (poData.job_id && co.job_id !== poData.job_id) {
        return res.status(400).json({ error: 'Change order belongs to a different job' });
      }

      if (co.status !== 'approved') {
        return res.status(400).json({ error: 'Change order must be approved before linking to PO' });
      }
    }

    // Create PO
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .insert(poData)
      .select()
      .single();

    if (poError) throw poError;

    // Create line items
    if (line_items && line_items.length > 0) {
      const { error: itemsError } = await supabase
        .from('v2_po_line_items')
        .insert(line_items.map(item => ({ ...item, po_id: po.id })));

      if (itemsError) throw itemsError;
    }

    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update purchase order
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { line_items, ...updates } = req.body;

  // Get existing PO
  const { data: existing, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*, line_items:v2_po_line_items(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  // Validate PO-CO linkage if job_change_order_id is being updated
  if (updates.job_change_order_id) {
    const { data: co, error: coError } = await supabase
      .from('v2_job_change_orders')
      .select('id, job_id, status')
      .eq('id', updates.job_change_order_id)
      .single();

    if (coError || !co) {
      throw new AppError('VALIDATION_ERROR', 'Change order not found');
    }

    const jobId = updates.job_id || existing.job_id;
    if (jobId && co.job_id !== jobId) {
      throw new AppError('VALIDATION_ERROR', 'Change order belongs to a different job');
    }

    if (co.status !== 'approved') {
      throw new AppError('VALIDATION_ERROR', 'Change order must be approved before linking to PO');
    }
  }

  // Update PO fields
  const { data: updated, error: updateError } = await supabase
    .from('v2_purchase_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Update line items if provided
  if (line_items && Array.isArray(line_items)) {
    // Delete existing line items
    await supabase
      .from('v2_po_line_items')
      .delete()
      .eq('po_id', id);

    // Insert new line items
    if (line_items.length > 0) {
      const { error: itemsError } = await supabase
        .from('v2_po_line_items')
        .insert(line_items.map(item => ({ ...item, po_id: id })));

      if (itemsError) throw new AppError('DATABASE_ERROR', itemsError.message);
    }
  }

  // Log activity
  await logPOActivity(id, 'updated', updates.updated_by || 'system', { changes: updates });

  // Broadcast update via SSE
  broadcastInvoiceUpdate(id, 'po_updated', { po: updated });

  res.json(updated);
}));

// Delete (soft delete) purchase order
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;

  // Check if PO has linked invoices
  const { data: linkedInvoices } = await supabase
    .from('v2_invoices')
    .select('id')
    .eq('po_id', id)
    .is('deleted_at', null);

  if (linkedInvoices && linkedInvoices.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Cannot delete PO with linked invoices');
  }

  // Soft delete
  const { data, error } = await supabase
    .from('v2_purchase_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, 'deleted', deleted_by || 'system', {});

  res.json({ success: true, message: 'Purchase order deleted' });
}));

// Submit PO for approval
router.post('/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { submitted_by } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (po.status_detail !== 'pending') {
    throw new AppError('VALIDATION_FAILED', 'Only pending POs can be submitted for approval');
  }

  // Check approval thresholds
  const { data: thresholds } = await supabase
    .from('v2_approval_thresholds')
    .select('*')
    .eq('entity_type', 'po')
    .order('threshold_amount', { ascending: true });

  let autoApprove = false;
  let requiresApprovalFrom = 'owner';

  if (thresholds && thresholds.length > 0) {
    for (const t of thresholds) {
      if (po.total_amount <= t.threshold_amount) {
        autoApprove = t.auto_approve_below;
        requiresApprovalFrom = t.requires_approval_from;
        break;
      }
    }
  }

  const newStatus = autoApprove ? 'approved' : 'pending';
  const updateData = {
    approval_status: newStatus,
    status_detail: autoApprove ? 'approved' : 'pending'
  };

  if (autoApprove) {
    updateData.approved_at = new Date().toISOString();
    updateData.approved_by = 'auto-approved';
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, autoApprove ? 'auto_approved' : 'submitted', submitted_by || 'system', {
    auto_approved: autoApprove,
    requires_approval_from: requiresApprovalFrom
  });

  res.json({
    success: true,
    po: updated,
    auto_approved: autoApprove,
    requires_approval_from: autoApprove ? null : requiresApprovalFrom
  });
}));

// Approve PO
router.post('/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (po.approval_status === 'approved') {
    throw new AppError('VALIDATION_FAILED', 'PO is already approved');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      approval_status: 'approved',
      status_detail: 'approved',
      status: 'open',
      approved_at: new Date().toISOString(),
      approved_by: approved_by || 'system'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, 'approved', approved_by || 'system', { amount: po.total_amount });

  // Update budget committed amounts
  const { data: lineItems } = await supabase
    .from('v2_po_line_items')
    .select('*, cost_code:v2_cost_codes(id, code)')
    .eq('po_id', id);

  if (lineItems && lineItems.length > 0) {
    for (const item of lineItems) {
      await supabase.rpc('increment_committed_amount', {
        p_job_id: po.job_id,
        p_cost_code_id: item.cost_code_id,
        p_amount: item.amount
      });
    }
  }

  broadcastInvoiceUpdate(id, 'po_approved', { po: updated });

  res.json({ success: true, po: updated });
}));

// Reject PO
router.post('/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejected_by, reason } = req.body;

  if (!reason) {
    throw new AppError('VALIDATION_FAILED', 'Rejection reason is required');
  }

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      approval_status: 'rejected',
      status_detail: 'pending',
      rejection_reason: reason
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, 'rejected', rejected_by || 'system', { reason });

  res.json({ success: true, po: updated });
}));

// Close PO
router.post('/:id/close', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { closed_by, reason } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (!['approved', 'active'].includes(po.status_detail)) {
    throw new AppError('VALIDATION_FAILED', 'Only approved or active POs can be closed');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status: 'closed',
      status_detail: 'closed',
      closed_at: new Date().toISOString(),
      closed_by: closed_by || 'system',
      closed_reason: reason || 'Manually closed'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, 'closed', closed_by || 'system', { reason });

  res.json({ success: true, po: updated });
}));

// Reopen PO
router.post('/:id/reopen', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reopened_by, reason } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (po.status_detail !== 'closed') {
    throw new AppError('VALIDATION_FAILED', 'Only closed POs can be reopened');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status: 'open',
      status_detail: 'active',
      closed_at: null,
      closed_by: null,
      closed_reason: null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, 'reopened', reopened_by || 'system', { reason });

  res.json({ success: true, po: updated });
}));

// Get PO activity log
router.get('/:id/activity', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_po_activity')
    .select('*')
    .eq('po_id', id)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get PO invoices
router.get('/:id/invoices', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      vendor:v2_vendors(id, name),
      job:v2_jobs(id, name)
    `)
    .eq('po_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get PO attachments
router.get('/:id/attachments', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_po_attachments')
    .select('*')
    .eq('po_id', id)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Upload PO attachment
router.post('/:id/attachments', upload.single('file'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!req.file) {
    throw new AppError('VALIDATION_FAILED', 'No file uploaded');
  }

  const file = req.file;
  const { description, category } = req.body;

  // Determine file type
  const ext = file.originalname.split('.').pop().toLowerCase();
  let fileType = 'other';
  if (['pdf'].includes(ext)) fileType = 'pdf';
  else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) fileType = 'image';
  else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) fileType = 'document';
  else if (['xls', 'xlsx', 'csv'].includes(ext)) fileType = 'spreadsheet';

  // Get PO info for folder structure
  const { data: po } = await supabase
    .from('v2_purchase_orders')
    .select('po_number, job:v2_jobs(name)')
    .eq('id', id)
    .single();

  // Create storage path
  const timestamp = Date.now();
  const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `po-attachments/${id}/${timestamp}_${safeName}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(storagePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (uploadError) throw new AppError('DATABASE_ERROR', uploadError.message);

  // Create attachment record
  const { data: attachment, error: dbError } = await supabase
    .from('v2_po_attachments')
    .insert({
      po_id: id,
      file_name: file.originalname,
      file_type: fileType,
      file_size: file.size,
      storage_path: storagePath,
      description: description || null,
      category: category || 'other',
      uploaded_by: req.body.uploaded_by || 'system'
    })
    .select()
    .single();

  if (dbError) throw new AppError('DATABASE_ERROR', dbError.message);

  // Log activity
  await logPOActivity(id, 'attachment_added', req.body.uploaded_by || 'system', {
    file_name: file.originalname,
    category
  });

  res.json(attachment);
}));

// Delete PO attachment
router.delete('/:poId/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const { poId, attachmentId } = req.params;

  // Get attachment info
  const { data: attachment, error: fetchError } = await supabase
    .from('v2_po_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('po_id', poId)
    .single();

  if (fetchError || !attachment) {
    throw new AppError('NOT_FOUND', 'Attachment not found');
  }

  // Delete from storage
  await supabase.storage
    .from('invoices')
    .remove([attachment.storage_path]);

  // Delete record
  const { error: deleteError } = await supabase
    .from('v2_po_attachments')
    .delete()
    .eq('id', attachmentId);

  if (deleteError) throw new AppError('DATABASE_ERROR', deleteError.message);

  // Log activity
  await logPOActivity(poId, 'attachment_removed', req.body.deleted_by || 'system', {
    file_name: attachment.file_name
  });

  res.json({ success: true });
}));

// Get attachment download URL
router.get('/:poId/attachments/:attachmentId/url', asyncHandler(async (req, res) => {
  const { poId, attachmentId } = req.params;

  const { data: attachment, error: fetchError } = await supabase
    .from('v2_po_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('po_id', poId)
    .single();

  if (fetchError || !attachment) {
    throw new AppError('NOT_FOUND', 'Attachment not found');
  }

  // Get signed URL (valid for 1 hour)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('invoices')
    .createSignedUrl(attachment.storage_path, 3600);

  if (urlError) throw new AppError('DATABASE_ERROR', urlError.message);

  res.json({ url: urlData.signedUrl, fileName: attachment.file_name });
}));

module.exports = router;

