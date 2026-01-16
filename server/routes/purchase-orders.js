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
      .is('deleted_at', null)
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

  if (!['closed', 'completed'].includes(po.status_detail)) {
    throw new AppError('VALIDATION_FAILED', 'Only closed or completed POs can be reopened');
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

// ============================================================
// PO WORKFLOW ACTIONS
// ============================================================

// Send PO to vendor (draft → sent)
router.post('/:id/send', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sent_by } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*, line_items:v2_po_line_items(id, cost_code_id, amount)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  // Only draft POs can be sent
  const draftStatuses = [null, undefined, 'pending', 'draft'];
  if (!draftStatuses.includes(po.status_detail)) {
    throw new AppError('VALIDATION_FAILED', 'Only draft POs can be sent to vendor');
  }

  // Validate required fields before sending
  const errors = [];
  if (!po.job_id) errors.push('Job is required');
  if (!po.vendor_id) errors.push('Vendor is required');
  if (!po.line_items || po.line_items.length === 0) {
    errors.push('At least one line item is required');
  } else {
    const itemsWithAmounts = po.line_items.filter(item => parseFloat(item.amount) > 0);
    if (itemsWithAmounts.length === 0) {
      errors.push('At least one line item must have an amount');
    }
    const missingCostCodes = itemsWithAmounts.filter(item => !item.cost_code_id);
    if (missingCostCodes.length > 0) {
      errors.push('All line items with amounts must have a cost code');
    }
  }
  if (errors.length > 0) {
    throw new AppError('VALIDATION_FAILED', errors.join('. '));
  }

  // Update PO status to sent
  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status_detail: 'sent',
      status: 'open'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, 'sent', sent_by || 'system', { total_amount: po.total_amount });

  // Broadcast update
  broadcastInvoiceUpdate(id, 'po_sent', { po: updated });

  res.json({ success: true, po: updated });
}));

// Complete PO (mark as completed/closed)
router.post('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { completed_by } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (!['approved', 'active', 'sent'].includes(po.status_detail) && po.approval_status !== 'approved') {
    throw new AppError('VALIDATION_FAILED', 'Only sent or approved POs can be completed');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status: 'closed',
      status_detail: 'completed',
      closed_at: new Date().toISOString(),
      closed_by: completed_by || 'system'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, 'completed', completed_by || 'system', {});

  broadcastInvoiceUpdate(id, 'po_completed', { po: updated });
  res.json({ success: true, po: updated });
}));

// Void PO (cancels PO)
router.post('/:id/void', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, voided_by } = req.body;

  if (!reason || !reason.trim()) {
    throw new AppError('VALIDATION_FAILED', 'Reason is required for voiding a PO');
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

  // Can void any PO that's not already voided or completed
  if (['voided', 'cancelled', 'completed', 'closed'].includes(po.status_detail)) {
    throw new AppError('VALIDATION_FAILED', 'This PO cannot be voided');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status: 'cancelled',
      status_detail: 'voided',
      closed_at: new Date().toISOString(),
      closed_by: voided_by || 'system',
      closed_reason: reason
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logPOActivity(id, 'voided', voided_by || 'system', { reason });

  broadcastInvoiceUpdate(id, 'po_voided', { po: updated });
  res.json({ success: true, po: updated });
}));

// ============================================================
// PO CHANGE ORDERS
// ============================================================

// List change orders for a PO
router.get('/:poId/change-orders', asyncHandler(async (req, res) => {
  const { poId } = req.params;

  const { data, error } = await supabase
    .from('v2_change_orders')
    .select(`
      *,
      line_items:v2_change_order_line_items(
        id, cost_code_id, description, amount, is_new,
        cost_code:v2_cost_codes(id, code, name)
      )
    `)
    .eq('po_id', poId)
    .order('change_order_number', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Create a change order for a PO
router.post('/:poId/change-orders', asyncHandler(async (req, res) => {
  const { poId } = req.params;
  const { description, reason, amount_change, line_items } = req.body;

  // Get PO and current highest CO number
  const { data: po, error: poError } = await supabase
    .from('v2_purchase_orders')
    .select('id, total_amount, change_order_total')
    .eq('id', poId)
    .single();

  if (poError || !po) throw new AppError('NOT_FOUND', 'Purchase order not found');

  const { data: existingCOs } = await supabase
    .from('v2_change_orders')
    .select('change_order_number')
    .eq('po_id', poId)
    .order('change_order_number', { ascending: false })
    .limit(1);

  const nextCONumber = (existingCOs?.[0]?.change_order_number || 0) + 1;
  const previousTotal = parseFloat(po.total_amount) || 0;
  const changeAmount = parseFloat(amount_change) || 0;
  const newTotal = previousTotal + changeAmount;

  // Create change order
  const { data: co, error: coError } = await supabase
    .from('v2_change_orders')
    .insert({
      po_id: poId,
      change_order_number: nextCONumber,
      description,
      reason,
      amount_change: changeAmount,
      previous_total: previousTotal,
      new_total: newTotal,
      status: 'pending',
      created_by: 'system'
    })
    .select()
    .single();

  if (coError) throw new AppError('DATABASE_ERROR', coError.message);

  // Insert line items if provided
  if (line_items && line_items.length > 0) {
    const lineItemsToInsert = line_items.map(li => ({
      change_order_id: co.id,
      cost_code_id: li.cost_code_id,
      description: li.description,
      amount: parseFloat(li.amount) || 0,
      is_new: li.is_new || false,
      original_line_item_id: li.original_line_item_id
    }));

    const { error: liError } = await supabase
      .from('v2_change_order_line_items')
      .insert(lineItemsToInsert);

    if (liError) console.error('Error inserting CO line items:', liError);
  }

  // Log activity
  await logPOActivity(poId, 'change_order_created', 'system', {
    change_order_id: co.id,
    number: nextCONumber,
    amount: changeAmount
  });

  res.json(co);
}));

// Approve a change order
router.post('/:poId/change-orders/:coId/approve', asyncHandler(async (req, res) => {
  const { poId, coId } = req.params;
  const { approved_by } = req.body;

  // Get the change order
  const { data: co, error: coError } = await supabase
    .from('v2_change_orders')
    .select('*')
    .eq('id', coId)
    .eq('po_id', poId)
    .single();

  if (coError || !co) throw new AppError('NOT_FOUND', 'Change order not found');
  if (co.status === 'approved') throw new AppError('INVALID_STATE', 'Change order already approved');

  // Update change order status
  const { error: updateCOError } = await supabase
    .from('v2_change_orders')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approved_by || 'Jake Ross'
    })
    .eq('id', coId);

  if (updateCOError) throw new AppError('DATABASE_ERROR', updateCOError.message);

  // Update PO total and change_order_total
  const { data: po } = await supabase
    .from('v2_purchase_orders')
    .select('total_amount, change_order_total')
    .eq('id', poId)
    .single();

  const newTotal = (parseFloat(po.total_amount) || 0) + (parseFloat(co.amount_change) || 0);
  const newCOTotal = (parseFloat(po.change_order_total) || 0) + (parseFloat(co.amount_change) || 0);

  await supabase
    .from('v2_purchase_orders')
    .update({
      total_amount: newTotal,
      change_order_total: newCOTotal
    })
    .eq('id', poId);

  // Log activity
  await logPOActivity(poId, 'change_order_approved', approved_by || 'Jake Ross', {
    change_order_id: coId,
    amount: co.amount_change,
    new_total: newTotal
  });

  res.json({ success: true, new_total: newTotal });
}));

// Reject a change order
router.post('/:poId/change-orders/:coId/reject', asyncHandler(async (req, res) => {
  const { poId, coId } = req.params;
  const { reason, rejected_by } = req.body;

  const { error } = await supabase
    .from('v2_change_orders')
    .update({
      status: 'rejected',
      rejection_reason: reason
    })
    .eq('id', coId)
    .eq('po_id', poId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logPOActivity(poId, 'change_order_rejected', rejected_by || 'Jake Ross', {
    change_order_id: coId,
    reason
  });

  res.json({ success: true });
}));

// Delete a change order (only pending ones)
router.delete('/:poId/change-orders/:coId', asyncHandler(async (req, res) => {
  const { poId, coId } = req.params;
  const { deleted_by } = req.body;

  // Get the change order
  const { data: co, error: fetchError } = await supabase
    .from('v2_change_orders')
    .select('*')
    .eq('id', coId)
    .eq('po_id', poId)
    .single();

  if (fetchError || !co) {
    throw new AppError('NOT_FOUND', 'Change order not found');
  }

  if (co.status !== 'pending') {
    throw new AppError('VALIDATION_FAILED', 'Only pending change orders can be deleted');
  }

  // Delete line items first
  await supabase
    .from('v2_change_order_line_items')
    .delete()
    .eq('change_order_id', coId);

  // Delete change order
  const { error: deleteError } = await supabase
    .from('v2_change_orders')
    .delete()
    .eq('id', coId);

  if (deleteError) throw new AppError('DATABASE_ERROR', deleteError.message);

  // Log activity
  await logPOActivity(poId, 'change_order_deleted', deleted_by || 'system', {
    change_order_number: co.change_order_number
  });

  res.json({ success: true });
}));

// ============================================================
// PO PDF GENERATION
// ============================================================

router.get('/:id/pdf', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get PO with all related data
  const { data: po, error } = await supabase
    .from('v2_purchase_orders')
    .select(`
      *,
      job:v2_jobs(id, name, address, client_name),
      vendor:v2_vendors(id, name, email, phone, address),
      line_items:v2_po_line_items(
        id, description, amount,
        cost_code:v2_cost_codes(id, code, name)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !po) throw new AppError('NOT_FOUND', 'Purchase order not found');

  // Get change orders
  const { data: changeOrders } = await supabase
    .from('v2_change_orders')
    .select('*')
    .eq('po_id', id)
    .eq('status', 'approved')
    .order('change_order_number');

  // Generate PDF using pdf-lib
  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawText = (text, x, y, options = {}) => {
    page.drawText(text || '', {
      x,
      y,
      size: options.size || 10,
      font: options.bold ? boldFont : font,
      color: options.color || rgb(0, 0, 0)
    });
  };

  const formatMoney = (amt) => '$' + (parseFloat(amt) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Header
  drawText('ROSS BUILT CUSTOM HOMES', 50, height - 50, { size: 16, bold: true });
  drawText('305 67th St West, Bradenton, FL 34209', 50, height - 68, { size: 9, color: rgb(0.4, 0.4, 0.4) });

  drawText('PURCHASE ORDER', width - 200, height - 50, { size: 14, bold: true });
  drawText(po.po_number || 'Draft', width - 200, height - 68, { size: 12 });

  // Status
  const status = po.approval_status === 'approved' ? 'APPROVED' : po.status_detail?.toUpperCase() || 'DRAFT';
  drawText(status, width - 200, height - 85, { size: 10, bold: true, color: po.approval_status === 'approved' ? rgb(0.1, 0.5, 0.1) : rgb(0.5, 0.5, 0.5) });

  // Divider
  page.drawLine({ start: { x: 50, y: height - 100 }, end: { x: width - 50, y: height - 100 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  // Vendor and Job info
  let y = height - 130;

  drawText('VENDOR', 50, y, { size: 8, bold: true, color: rgb(0.4, 0.4, 0.4) });
  drawText('JOB', 320, y, { size: 8, bold: true, color: rgb(0.4, 0.4, 0.4) });

  y -= 15;
  drawText(po.vendor?.name || 'Unknown Vendor', 50, y, { size: 11, bold: true });
  drawText(po.job?.name || 'Unknown Job', 320, y, { size: 11, bold: true });

  if (po.vendor?.address) { y -= 12; drawText(po.vendor.address, 50, y, { size: 9 }); }
  if (po.job?.address) { y -= 12; drawText(po.job.address, 320, y, { size: 9 }); }

  y -= 25;

  // Description
  if (po.description) {
    drawText('DESCRIPTION', 50, y, { size: 8, bold: true, color: rgb(0.4, 0.4, 0.4) });
    y -= 15;
    drawText(po.description, 50, y, { size: 10 });
    y -= 20;
  }

  // Scope of Work
  if (po.scope_of_work) {
    drawText('SCOPE OF WORK', 50, y, { size: 8, bold: true, color: rgb(0.4, 0.4, 0.4) });
    y -= 15;
    const lines = po.scope_of_work.split('\n').slice(0, 5);
    lines.forEach(line => {
      drawText(line.substring(0, 80), 50, y, { size: 9 });
      y -= 12;
    });
    y -= 10;
  }

  // Line Items Header
  page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 20, color: rgb(0.95, 0.95, 0.95) });
  drawText('Cost Code', 55, y, { size: 9, bold: true });
  drawText('Description', 160, y, { size: 9, bold: true });
  drawText('Amount', width - 100, y, { size: 9, bold: true });
  y -= 25;

  // Line Items
  const lineItems = po.line_items || [];
  let subtotal = 0;
  lineItems.forEach(item => {
    const cc = item.cost_code;
    drawText(cc?.code || '-', 55, y, { size: 9 });
    drawText((cc?.name || item.description || '').substring(0, 40), 160, y, { size: 9 });
    drawText(formatMoney(item.amount), width - 100, y, { size: 9 });
    subtotal += parseFloat(item.amount) || 0;
    y -= 15;
  });

  // Totals
  y -= 10;
  page.drawLine({ start: { x: width - 200, y: y + 5 }, end: { x: width - 50, y: y + 5 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

  drawText('Subtotal:', width - 180, y - 10, { size: 9 });
  drawText(formatMoney(subtotal), width - 100, y - 10, { size: 9 });

  if (changeOrders && changeOrders.length > 0) {
    const coTotal = changeOrders.reduce((sum, co) => sum + parseFloat(co.amount_change || 0), 0);
    y -= 15;
    drawText('Change Orders:', width - 180, y - 10, { size: 9 });
    drawText(formatMoney(coTotal), width - 100, y - 10, { size: 9 });
  }

  y -= 20;
  drawText('TOTAL:', width - 180, y - 10, { size: 10, bold: true });
  drawText(formatMoney(po.total_amount), width - 100, y - 10, { size: 10, bold: true });

  // Footer
  drawText(`Generated: ${new Date().toLocaleDateString()}`, 50, 50, { size: 8, color: rgb(0.5, 0.5, 0.5) });

  // Output
  const pdfBytes = await pdfDoc.save();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${po.po_number || 'PO'}.pdf"`);
  res.send(Buffer.from(pdfBytes));
}));

module.exports = router;

