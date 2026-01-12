const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// PID file for safe server restarts (won't kill other node processes)
const PID_FILE = path.join(__dirname, '..', 'server.pid');
const { supabase, port } = require('../config');
const { uploadPDF, uploadStampedPDF, downloadPDF } = require('./storage');
const { stampApproval, stampInDraw, stampPaid, stampPartiallyPaid, stampPartiallyBilled } = require('./pdf-stamper');
const { processInvoice } = require('./ai-processor');
const standards = require('./standards');
const ExcelJS = require('exceljs');
const { PDFDocument } = require('pdf-lib');

// New modules for enhanced invoice system
const {
  validateInvoice,
  validateStatusTransition,
  validatePreTransition,
  checkDuplicate,
  validateAllocations,
  validateCostCodesExist,
  validatePOCapacity,
  STATUS_TRANSITIONS
} = require('./validation');

const {
  AppError,
  errorMiddleware,
  asyncHandler,
  validationError,
  transitionError,
  notFoundError,
  lockedError,
  versionConflictError
} = require('./errors');

const {
  acquireLock,
  releaseLock,
  releaseLockByEntity,
  checkLock,
  forceReleaseLock,
  cleanupExpiredLocks,
  getAllLocks
} = require('./locking');

const {
  createUndoSnapshot,
  getAvailableUndo,
  executeUndo,
  UNDO_WINDOW_SECONDS
} = require('./undo');

const {
  sseHandler,
  broadcast,
  broadcastInvoiceUpdate,
  broadcastDrawUpdate,
  initializeRealtimeSubscriptions,
  getStats: getRealtimeStats
} = require('./realtime');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

// ============================================================
// ACTIVITY LOGGING HELPER
// ============================================================

async function logActivity(invoiceId, action, performedBy, details = {}) {
  await supabase.from('v2_invoice_activity').insert({
    invoice_id: invoiceId,
    action,
    performed_by: performedBy,
    details
  });
}

// ============================================================
// PO LINE ITEM HELPERS
// ============================================================

/**
 * Update PO line items' invoiced_amount when allocations change.
 */
async function updatePOLineItemsForAllocations(poId, allocations, add = true) {
  if (!poId || !allocations || allocations.length === 0) return;

  for (const alloc of allocations) {
    let poLineItem = null;

    // Priority 1: Direct po_line_item_id link
    if (alloc.po_line_item_id) {
      const { data } = await supabase
        .from('v2_po_line_items')
        .select('id, invoiced_amount')
        .eq('id', alloc.po_line_item_id)
        .eq('po_id', poId)
        .single();
      poLineItem = data;
    }

    // Priority 2: Fall back to cost code matching
    if (!poLineItem) {
      const costCodeId = alloc.cost_code_id || alloc.cost_code?.id;
      if (costCodeId) {
        const { data } = await supabase
          .from('v2_po_line_items')
          .select('id, invoiced_amount')
          .eq('po_id', poId)
          .eq('cost_code_id', costCodeId)
          .single();
        poLineItem = data;
      }
    }

    if (poLineItem) {
      const currentAmount = parseFloat(poLineItem.invoiced_amount) || 0;
      const allocAmount = parseFloat(alloc.amount) || 0;
      const newAmount = add
        ? currentAmount + allocAmount
        : Math.max(0, currentAmount - allocAmount);

      await supabase
        .from('v2_po_line_items')
        .update({ invoiced_amount: newAmount })
        .eq('id', poLineItem.id);
    }
  }
}

/**
 * Sync PO line items when allocations change on an invoice.
 */
async function syncPOLineItemsOnAllocationChange(invoice, oldAllocations, newAllocations, oldPoId = null) {
  const billableStatuses = ['approved', 'in_draw', 'paid'];
  if (!billableStatuses.includes(invoice.status)) return;

  const effectiveOldPoId = oldPoId || invoice.po_id;

  if (effectiveOldPoId && effectiveOldPoId !== invoice.po_id) {
    await updatePOLineItemsForAllocations(effectiveOldPoId, oldAllocations, false);
  }

  if (invoice.po_id) {
    if (effectiveOldPoId === invoice.po_id) {
      await updatePOLineItemsForAllocations(invoice.po_id, oldAllocations, false);
    }
    await updatePOLineItemsForAllocations(invoice.po_id, newAllocations, true);
  }
}

// ============================================================
// // OWNER DASHBOARD STATS (All Jobs)
// ============================================================

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Get all invoices across all jobs
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('status, amount, job_id');

    const stats = {
      received: { count: 0, amount: 0 },
      needs_approval: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      in_draw: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 }
    };

    if (invoices) {
      invoices.forEach(inv => {
        if (stats[inv.status]) {
          stats[inv.status].count++;
          stats[inv.status].amount += parseFloat(inv.amount) || 0;
        }
      });
    }

    // Get all draws
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('status, total_amount');

    const drawStats = {
      draft: { count: 0, amount: 0 },
      submitted: { count: 0, amount: 0 },
      funded: { count: 0, amount: 0 }
    };

    if (draws) {
      draws.forEach(d => {
        // Group partially_funded and overfunded with funded for stats
        const statCategory = ['partially_funded', 'overfunded'].includes(d.status) ? 'funded' : d.status;
        if (drawStats[statCategory]) {
          drawStats[statCategory].count++;
          drawStats[statCategory].amount += parseFloat(d.total_amount) || 0;
        }
      });
    }

    // Get jobs summary
    const { data: jobs } = await supabase
      .from('v2_jobs')
      .select('id, name, contract_amount, client_name, status');

    // Calculate billed per job
    const jobSummaries = await Promise.all((jobs || []).map(async (job) => {
      const { data: jobInvoices } = await supabase
        .from('v2_invoices')
        .select('amount, status')
        .eq('job_id', job.id)
        .in('status', ['approved', 'in_draw', 'paid']);

      const billed = (jobInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

      return {
        ...job,
        total_billed: billed,
        remaining: (parseFloat(job.contract_amount) || 0) - billed
      };
    }));

    // Calculate total contract value
    const total_contract = (jobs || []).reduce((sum, job) => sum + (parseFloat(job.contract_amount) || 0), 0);

    res.json({
      invoices: stats,
      draws: drawStats,
      jobs: jobSummaries,
      total_contract,
      alerts: {
        needsCoding: stats.received.count,
        needsApproval: stats.needs_approval.count,
        inDraws: drawStats.submitted.count
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// JOBS API
// ============================================================

app.get('/api/jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_jobs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a job (admin cleanup)
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get related IDs first
    const { data: draws } = await supabase.from('v2_draws').select('id').eq('job_id', jobId);
    const { data: invoices } = await supabase.from('v2_invoices').select('id').eq('job_id', jobId);
    const { data: pos } = await supabase.from('v2_purchase_orders').select('id').eq('job_id', jobId);

    const drawIds = draws?.map(d => d.id) || [];
    const invoiceIds = invoices?.map(i => i.id) || [];
    const poIds = pos?.map(p => p.id) || [];

    // Delete related data
    await supabase.from('v2_budget_lines').delete().eq('job_id', jobId);

    if (drawIds.length > 0) {
      await supabase.from('v2_draw_allocations').delete().in('draw_id', drawIds);
      await supabase.from('v2_draw_invoices').delete().in('draw_id', drawIds);
      await supabase.from('v2_draw_activity').delete().in('draw_id', drawIds);
      await supabase.from('v2_draws').delete().eq('job_id', jobId);
    }

    if (invoiceIds.length > 0) {
      await supabase.from('v2_invoice_allocations').delete().in('invoice_id', invoiceIds);
      await supabase.from('v2_invoice_activity').delete().in('invoice_id', invoiceIds);
      await supabase.from('v2_invoices').delete().eq('job_id', jobId);
    }

    if (poIds.length > 0) {
      await supabase.from('v2_po_line_items').delete().in('po_id', poIds);
      await supabase.from('v2_po_activity').delete().in('po_id', poIds);
      await supabase.from('v2_purchase_orders').delete().eq('job_id', jobId);
    }

    // Delete the job
    const { error } = await supabase
      .from('v2_jobs')
      .delete()
      .eq('id', jobId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get purchase orders for a specific job
app.get('/api/jobs/:id/purchase-orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_purchase_orders')
      .select(`
        id,
        po_number,
        description,
        total_amount,
        status,
        vendor:v2_vendors(id, name)
      `)
      .eq('job_id', req.params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Flatten vendor name for easier frontend use
    const result = (data || []).map(po => ({
      ...po,
      vendor_name: po.vendor?.name || null
    }));
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// VENDORS API
// ============================================================

app.get('/api/vendors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_vendors')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_vendors')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// COST CODES API
// ============================================================

app.get('/api/cost-codes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_cost_codes')
      .select('*')
      .order('code');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PURCHASE ORDERS API
// ============================================================

app.get('/api/purchase-orders', async (req, res) => {
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
app.get('/api/purchase-orders/stats', asyncHandler(async (req, res) => {
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

app.get('/api/purchase-orders/:id', async (req, res) => {
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

app.post('/api/purchase-orders', async (req, res) => {
  try {
    const { line_items, ...poData } = req.body;

    // Validate line items have cost codes
    if (!line_items || line_items.length === 0) {
      return res.status(400).json({ error: 'At least one line item is required' });
    }

    const missingCostCodes = line_items.filter(item => !item.cost_code_id);
    if (missingCostCodes.length > 0) {
      return res.status(400).json({
        error: 'All line items must have a cost code assigned',
        details: `${missingCostCodes.length} line item(s) missing cost codes`
      });
    }

    // Create PO
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .insert(poData)
      .select()
      .single();

    if (poError) throw poError;

    // Create line items
    const { error: itemsError } = await supabase
      .from('v2_po_line_items')
      .insert(line_items.map(item => ({ ...item, po_id: po.id })));

    if (itemsError) throw itemsError;

    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update purchase order
app.patch('/api/purchase-orders/:id', asyncHandler(async (req, res) => {
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
    // Validate all line items have cost codes
    if (line_items.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one line item is required');
    }

    const missingCostCodes = line_items.filter(item => !item.cost_code_id);
    if (missingCostCodes.length > 0) {
      throw new AppError('VALIDATION_ERROR', `All line items must have a cost code assigned (${missingCostCodes.length} missing)`);
    }

    // Delete existing line items
    await supabase
      .from('v2_po_line_items')
      .delete()
      .eq('po_id', id);

    // Insert new line items
    const { error: itemsError } = await supabase
      .from('v2_po_line_items')
      .insert(line_items.map(item => ({ ...item, po_id: id })));

    if (itemsError) throw new AppError('DATABASE_ERROR', itemsError.message);
  }

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'updated',
      performed_by: updates.updated_by || 'system',
      details: { changes: updates }
    });

  // Broadcast update via SSE
  broadcastInvoiceUpdate(id, 'po_updated', { po: updated });

  res.json(updated);
}));

// Delete (soft delete) purchase order
app.delete('/api/purchase-orders/:id', asyncHandler(async (req, res) => {
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'deleted',
      performed_by: deleted_by || 'system',
      details: {}
    });

  res.json({ success: true, message: 'Purchase order deleted' });
}));

// Send PO to vendor (draft → sent, commits to budget)
app.post('/api/purchase-orders/:id/send', asyncHandler(async (req, res) => {
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'sent',
      performed_by: sent_by || 'system',
      details: { total_amount: po.total_amount }
    });

  // Broadcast update
  broadcast({ type: 'po_update', data: { id, action: 'sent' } });

  res.json({ success: true, po: updated });
}));

// Submit PO for approval (legacy - redirects to send)
app.post('/api/purchase-orders/:id/submit', asyncHandler(async (req, res) => {
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: autoApprove ? 'auto_approved' : 'submitted',
      performed_by: submitted_by || 'system',
      details: { auto_approved: autoApprove, requires_approval_from: requiresApprovalFrom }
    });

  res.json({
    success: true,
    po: updated,
    auto_approved: autoApprove,
    requires_approval_from: autoApprove ? null : requiresApprovalFrom
  });
}));

// Approve PO
app.post('/api/purchase-orders/:id/approve', asyncHandler(async (req, res) => {
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'approved',
      performed_by: approved_by || 'system',
      details: { amount: po.total_amount }
    });

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
app.post('/api/purchase-orders/:id/reject', asyncHandler(async (req, res) => {
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'rejected',
      performed_by: rejected_by || 'system',
      details: { reason }
    });

  res.json({ success: true, po: updated });
}));

// Complete PO (alias: close)
app.post('/api/purchase-orders/:id/complete', asyncHandler(async (req, res) => {
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'completed',
      performed_by: completed_by || 'system',
      details: {}
    });

  broadcast({ type: 'po_update', data: { id, action: 'completed' } });
  res.json({ success: true, po: updated });
}));

// Close PO (legacy - redirects to complete)
app.post('/api/purchase-orders/:id/close', asyncHandler(async (req, res) => {
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
      status_detail: 'completed',
      closed_at: new Date().toISOString(),
      closed_by: closed_by || 'system',
      closed_reason: reason || 'Manually closed'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'completed',
      performed_by: closed_by || 'system',
      details: { reason }
    });

  res.json({ success: true, po: updated });
}));

// Void PO (cancels PO and removes budget commitment)
app.post('/api/purchase-orders/:id/void', asyncHandler(async (req, res) => {
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'voided',
      performed_by: voided_by || 'system',
      details: { reason }
    });

  broadcast({ type: 'po_update', data: { id, action: 'voided' } });
  res.json({ success: true, po: updated });
}));

// Reopen PO
app.post('/api/purchase-orders/:id/reopen', asyncHandler(async (req, res) => {
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
      status_detail: 'approved',
      closed_at: null,
      closed_by: null,
      closed_reason: null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'reopened',
      performed_by: reopened_by || 'system',
      details: { reason }
    });

  res.json({ success: true, po: updated });
}));

// Get PO activity log
app.get('/api/purchase-orders/:id/activity', asyncHandler(async (req, res) => {
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
app.get('/api/purchase-orders/:id/invoices', asyncHandler(async (req, res) => {
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
    .is('deleted_at', null)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get PO attachments
app.get('/api/purchase-orders/:id/attachments', asyncHandler(async (req, res) => {
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
app.post('/api/purchase-orders/:id/attachments', upload.single('file'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if file was uploaded via multer
  if (!req.file) {
    throw new AppError('VALIDATION_FAILED', 'No file uploaded');
  }

  const file = {
    name: req.file.originalname,
    data: req.file.buffer,
    size: req.file.size,
    mimetype: req.file.mimetype
  };
  const { description, category } = req.body;

  // Determine file type
  const ext = file.name.split('.').pop().toLowerCase();
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
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `po-attachments/${id}/${timestamp}_${safeName}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(storagePath, file.data, {
      contentType: file.mimetype,
      upsert: false
    });

  if (uploadError) throw new AppError('DATABASE_ERROR', uploadError.message);

  // Create attachment record
  const { data: attachment, error: dbError } = await supabase
    .from('v2_po_attachments')
    .insert({
      po_id: id,
      file_name: file.name,
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'attachment_added',
      performed_by: req.body.uploaded_by || 'system',
      details: { file_name: file.name, category }
    });

  res.json(attachment);
}));

// Delete PO attachment
app.delete('/api/purchase-orders/:poId/attachments/:attachmentId', asyncHandler(async (req, res) => {
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
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: poId,
      action: 'attachment_removed',
      performed_by: req.body.deleted_by || 'system',
      details: { file_name: attachment.file_name }
    });

  res.json({ success: true });
}));

// Get attachment download URL
app.get('/api/purchase-orders/:poId/attachments/:attachmentId/url', asyncHandler(async (req, res) => {
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
// INVOICES API
// ============================================================

// List invoices (with optional filters)
app.get('/api/invoices', async (req, res) => {
  try {
    const { job_id, status, vendor_id } = req.query;

    let query = supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, total_amount),
        allocations:v2_invoice_allocations(
          id, amount, notes, job_id,
          cost_code:v2_cost_codes(id, code, name)
        )
      `)
      .is('deleted_at', null)  // Filter out soft-deleted invoices
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (job_id) query = query.eq('job_id', job_id);
    if (status) query = query.eq('status', status);
    if (vendor_id) query = query.eq('vendor_id', vendor_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoices that need review (must be before :id route)
app.get('/api/invoices/needs-review', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('needs_review', true)
    .is('deleted_at', null)
    .is('deleted_at', null)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get invoices with low AI confidence (must be before :id route)
app.get('/api/invoices/low-confidence', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('ai_processed', true)
    .is('deleted_at', null)
    .is('deleted_at', null)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Filter for low confidence
  const lowConfidence = data.filter(inv => {
    if (!inv.ai_confidence) return false;
    return Object.values(inv.ai_confidence).some(c => c < 0.6);
  });

  res.json(lowConfidence);
}));

// Get invoices without job assignment (must be before :id route)
app.get('/api/invoices/no-job', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      vendor:v2_vendors(id, name)
    `)
    .is('job_id', null)
    .is('deleted_at', null)
    .is('deleted_at', null)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get single invoice with full details
app.get('/api/invoices/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name, email, phone),
        job:v2_jobs(id, name, address),
        po:v2_purchase_orders(id, po_number, total_amount),
        allocations:v2_invoice_allocations(
          id, amount, notes, job_id, po_line_item_id,
          cost_code:v2_cost_codes(id, code, name, category)
        ),
        draw_invoices:v2_draw_invoices(draw_id, draw:v2_draws(id, draw_number, status))
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    // Flatten draw info for easier access
    if (data.draw_invoices?.length > 0) {
      data.draw_id = data.draw_invoices[0].draw_id;
      data.draw = data.draw_invoices[0].draw;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoice activity log
app.get('/api/invoices/:id/activity', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_invoice_activity')
      .select('*')
      .eq('invoice_id', req.params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoice approval context (budget + PO status for decision-making)
app.get('/api/invoices/:id/approval-context', async (req, res) => {
  try {
    // Get the invoice with allocations, job, and PO
    const { data: invoice, error: invoiceError } = await supabase
      .from('v2_invoices')
      .select(`
        id, job_id, po_id, amount, status,
        allocations:v2_invoice_allocations(
          id, amount, cost_code_id, po_line_item_id,
          cost_code:v2_cost_codes(id, code, name)
        ),
        po:v2_purchase_orders(
          id, po_number, total_amount, status,
          line_items:v2_po_line_items(id, cost_code_id, amount, invoiced_amount)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (invoiceError) throw invoiceError;
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const result = {
      budget: [],
      po: null
    };

    // Get budget context for each cost code in allocations
    if (invoice.allocations?.length > 0 && invoice.job_id) {
      const costCodeIds = invoice.allocations.map(a => a.cost_code_id).filter(Boolean);

      // Get budget lines for these cost codes
      const { data: budgetLines } = await supabase
        .from('v2_budget_lines')
        .select('cost_code_id, budgeted_amount')
        .eq('job_id', invoice.job_id)
        .in('cost_code_id', costCodeIds);

      // Get all approved/in_draw/paid invoice allocations for these cost codes (excluding current invoice)
      const { data: existingAllocations } = await supabase
        .from('v2_invoice_allocations')
        .select(`
          amount, cost_code_id,
          invoice:v2_invoices!inner(id, job_id, status)
        `)
        .eq('invoice.job_id', invoice.job_id)
        .in('invoice.status', ['approved', 'in_draw', 'paid'])
        .neq('invoice.id', invoice.id)
        .in('cost_code_id', costCodeIds);

      // Calculate billed amounts per cost code
      const billedByCostCode = {};
      existingAllocations?.forEach(a => {
        if (!billedByCostCode[a.cost_code_id]) billedByCostCode[a.cost_code_id] = 0;
        billedByCostCode[a.cost_code_id] += parseFloat(a.amount) || 0;
      });

      // Build budget context for each allocation
      result.budget = invoice.allocations.map(alloc => {
        const budgetLine = budgetLines?.find(bl => bl.cost_code_id === alloc.cost_code_id);
        const budgeted = parseFloat(budgetLine?.budgeted_amount) || 0;
        const previouslyBilled = billedByCostCode[alloc.cost_code_id] || 0;
        const thisInvoice = parseFloat(alloc.amount) || 0;
        const afterApproval = previouslyBilled + thisInvoice;

        return {
          cost_code: alloc.cost_code,
          this_invoice: thisInvoice,
          budgeted: budgeted,
          previously_billed: previouslyBilled,
          after_approval: afterApproval,
          remaining: budgeted - afterApproval,
          over_budget: afterApproval > budgeted && budgeted > 0
        };
      });
    }

    // Get PO context if invoice is linked to a PO
    if (invoice.po) {
      const poTotal = parseFloat(invoice.po.total_amount) || 0;

      // Get all invoices already billed against this PO (excluding current invoice)
      const { data: poInvoices } = await supabase
        .from('v2_invoices')
        .select('id, amount, status')
        .eq('po_id', invoice.po_id)
        .neq('id', invoice.id)
        .in('status', ['approved', 'in_draw', 'paid']);

      const previouslyBilled = poInvoices?.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0) || 0;
      const thisInvoice = parseFloat(invoice.amount) || 0;
      const afterApproval = previouslyBilled + thisInvoice;

      result.po = {
        po_number: invoice.po.po_number,
        po_status: invoice.po.status,
        total_amount: poTotal,
        previously_billed: previouslyBilled,
        this_invoice: thisInvoice,
        after_approval: afterApproval,
        remaining: poTotal - afterApproval,
        percent_used: poTotal > 0 ? Math.round((afterApproval / poTotal) * 100) : 0,
        over_po: afterApproval > poTotal
      };
    }

    res.json(result);
  } catch (err) {
    console.error('Error getting approval context:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get invoice allocations
app.get('/api/invoices/:id/allocations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        id,
        amount,
        notes,
        cost_code_id,
        job_id,
        cost_code:v2_cost_codes(id, code, name, category)
      `)
      .eq('invoice_id', req.params.id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload invoice with PDF
app.post('/api/invoices/upload', upload.single('pdf'), async (req, res) => {
  try {
    const { job_id, vendor_id, invoice_number, invoice_date, due_date, amount, notes, uploaded_by } = req.body;

    let pdf_url = null;

    // Upload PDF if provided
    if (req.file) {
      const result = await uploadPDF(req.file.buffer, req.file.originalname, job_id);
      pdf_url = result.url;
    }

    // Create invoice
    const { data: invoice, error } = await supabase
      .from('v2_invoices')
      .insert({
        job_id,
        vendor_id: vendor_id || null,
        invoice_number,
        invoice_date,
        due_date: due_date || null,
        amount,
        notes: notes || null,
        pdf_url,
        status: 'received'
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logActivity(invoice.id, 'uploaded', uploaded_by || 'System', {
      filename: req.file?.originalname
    });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI-powered invoice processing
app.post('/api/invoices/process', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const originalFilename = req.file.originalname;
    const pdfBuffer = req.file.buffer;

    // Process with AI
    const result = await processInvoice(pdfBuffer, originalFilename);

    if (!result.success) {
      return res.status(422).json({
        error: 'Processing failed',
        messages: result.messages
      });
    }

    // Check for duplicates and BLOCK if high-confidence duplicate found
    const duplicates = result.suggestions?.possible_duplicates || [];
    const highConfidenceDupe = duplicates.find(d => d.confidence >= 0.95);

    if (highConfidenceDupe) {
      return res.status(409).json({
        error: 'Duplicate invoice detected',
        message: `This appears to be a duplicate of invoice #${highConfidenceDupe.invoice_number} from ${highConfidenceDupe.vendor?.name || 'this vendor'}`,
        duplicate: {
          id: highConfidenceDupe.id,
          invoice_number: highConfidenceDupe.invoice_number,
          amount: highConfidenceDupe.amount,
          status: highConfidenceDupe.status,
          matchReason: highConfidenceDupe.matchReason,
          confidence: highConfidenceDupe.confidence
        }
      });
    }

    // Upload PDF with standardized name
    let pdf_url = null;
    const jobId = result.matchedJob?.id;
    const storagePath = result.standardizedFilename;

    if (jobId) {
      const uploadResult = await uploadPDF(pdfBuffer, storagePath, jobId);
      pdf_url = uploadResult.url;
    } else {
      // Upload to unassigned folder if no job match
      const uploadResult = await uploadPDF(pdfBuffer, `unassigned/${storagePath}`, null);
      pdf_url = uploadResult.url;
    }

    // Create invoice record with AI metadata
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .insert({
        job_id: jobId || null,
        vendor_id: result.vendor?.id || null,
        po_id: result.po?.id || null,
        invoice_number: result.extracted.invoiceNumber,
        invoice_date: result.extracted.invoiceDate,
        due_date: result.extracted.dueDate || null,
        amount: result.extracted.totalAmount || 0,
        pdf_url,
        status: 'received',
        notes: result.messages.join('\n'),
        // AI metadata for confidence badges
        ai_processed: result.ai_processed || false,
        ai_confidence: result.ai_confidence || null,
        ai_extracted_data: result.ai_extracted_data || null,
        needs_review: result.needs_review || false,
        review_flags: result.review_flags || null
      })
      .select()
      .single();

    if (invError) throw invError;

    // Create allocations from line items OR suggested allocations
    let allocationsCreated = false;

    // First try to create allocations from line items with explicit cost codes
    if (result.extracted.lineItems?.length > 0) {
      const allocations = [];
      for (const item of result.extracted.lineItems) {
        if (item.costCode) {
          // Try to find matching cost code
          const { data: costCode } = await supabase
            .from('v2_cost_codes')
            .select('id')
            .ilike('code', `%${item.costCode}%`)
            .limit(1)
            .single();

          if (costCode) {
            allocations.push({
              invoice_id: invoice.id,
              cost_code_id: costCode.id,
              amount: item.amount || 0,
              notes: item.description
            });
          }
        }
      }

      if (allocations.length > 0) {
        await supabase.from('v2_invoice_allocations').insert(allocations);
        allocationsCreated = true;
      }
    }

    // Fallback: If no allocations created, use suggested allocations from trade type
    if (!allocationsCreated && result.suggested_allocations?.length > 0) {
      const suggestedAllocs = result.suggested_allocations.map(sa => ({
        invoice_id: invoice.id,
        cost_code_id: sa.cost_code_id,
        amount: sa.amount,
        notes: `Auto-suggested based on ${result.extracted.vendor?.tradeType || 'detected'} trade type`
      }));

      await supabase.from('v2_invoice_allocations').insert(suggestedAllocs);
      allocationsCreated = true;
    }

    // Log activity
    await logActivity(invoice.id, 'uploaded', 'AI Processor', {
      originalFilename,
      standardizedFilename: result.standardizedFilename,
      aiExtracted: true,
      vendorMatched: !!result.vendor,
      vendorCreated: result.messages.some(m => m.includes('Created new vendor')),
      jobMatched: !!result.matchedJob,
      poMatched: !!result.po,
      poCreated: result.messages.some(m => m.includes('Created draft PO'))
    });

    res.json({
      success: true,
      invoice,
      processing: {
        extracted: result.extracted,
        matchedJob: result.matchedJob,
        vendor: result.vendor,
        po: result.po,
        standardizedFilename: result.standardizedFilename,
        messages: result.messages
      }
    });

  } catch (err) {
    console.error('AI processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Code invoice (assign job, vendor, PO, cost codes)
app.patch('/api/invoices/:id/code', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { job_id, vendor_id, po_id, cost_codes, allocations, coded_by } = req.body;
    // Support both cost_codes (from frontend) and allocations (legacy)
    const allocs = cost_codes || allocations || [];

    // Update invoice
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .update({
        job_id,
        vendor_id,
        po_id: po_id || null,
        status: 'needs_approval',
        coded_at: new Date().toISOString(),
        coded_by
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (invError) throw invError;

    // Update allocations
    await supabase
      .from('v2_invoice_allocations')
      .delete()
      .eq('invoice_id', invoiceId);

    if (allocs && allocs.length > 0) {
      await supabase
        .from('v2_invoice_allocations')
        .insert(allocs.map(a => ({
          invoice_id: invoiceId,
          cost_code_id: a.cost_code_id,
          amount: a.amount,
          notes: a.notes,
          job_id: a.job_id || null,
          po_line_item_id: a.po_line_item_id || null
        })));
    }

    // Log activity
    await logActivity(invoiceId, 'needs_approval', coded_by, {
      job_id,
      vendor_id,
      po_id,
      allocations: allocs
    });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve invoice (with PDF stamping)
app.patch('/api/invoices/:id/approve', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { approved_by } = req.body;

    // Get invoice with details
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, description, total_amount),
        allocations:v2_invoice_allocations(
          amount,
          cost_code_id,
          cost_code:v2_cost_codes(code, name)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (getError) throw getError;

    // ==========================================
    // GET/CREATE DRAFT DRAW FIRST (before stamping)
    // ==========================================

    let draftDraw = null;
    let addedToDraw = false;

    if (invoice.job?.id && invoice.allocations && invoice.allocations.length > 0) {
      try {
        draftDraw = await getOrCreateDraftDraw(invoice.job.id, approved_by);
      } catch (drawErr) {
        console.error('Error getting/creating draft draw:', drawErr);
        // Continue without draw assignment
      }
    }

    let pdf_stamped_url = null;

    // Stamp PDF if exists
    if (invoice.pdf_url) {
      try {
        // Extract storage path from URL
        const urlParts = invoice.pdf_url.split('/storage/v1/object/public/invoices/');
        if (urlParts[1]) {
          const storagePath = decodeURIComponent(urlParts[1]);
          const pdfBuffer = await downloadPDF(storagePath);

          // Get PO billing info if PO is linked
          let poTotal = null;
          let poBilledToDate = 0;

          if (invoice.po?.id) {
            poTotal = invoice.po.total_amount;

            // Get sum of all previously approved invoices for this PO (excluding current)
            const { data: priorInvoices } = await supabase
              .from('v2_invoices')
              .select('amount')
              .eq('po_id', invoice.po.id)
              .neq('id', invoiceId)
              .in('status', ['approved', 'in_draw', 'paid']);

            if (priorInvoices) {
              poBilledToDate = priorInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
            }
          }

          // Calculate partial billing info
          const invoiceTotal = parseFloat(invoice.amount || 0);
          const alreadyBilled = Math.max(
            parseFloat(invoice.billed_amount || 0),
            parseFloat(invoice.paid_amount || 0)
          );
          const isPartialInvoice = alreadyBilled > 0;

          // Build status text with draw number if available
          let stampStatus = isPartialInvoice ? 'APPROVED (PARTIAL)' : 'APPROVED';
          if (draftDraw) {
            stampStatus += ` - Draw #${draftDraw.draw_number}`;
          }

          const stampedBuffer = await stampApproval(pdfBuffer, {
            status: stampStatus,
            date: new Date().toLocaleDateString(),
            approvedBy: approved_by,
            vendorName: invoice.vendor?.name,
            invoiceNumber: invoice.invoice_number,
            jobName: invoice.job?.name,
            costCodes: invoice.allocations?.map(a => ({
              code: a.cost_code?.code,
              name: a.cost_code?.name,
              amount: a.amount
            })) || [],
            amount: invoice.amount,
            poNumber: invoice.po?.po_number,
            poDescription: invoice.po?.description,
            poTotal: poTotal,
            poBilledToDate: poBilledToDate,
            // Partial billing info
            isPartial: isPartialInvoice,
            previouslyBilled: alreadyBilled,
            remainingAfterThis: invoiceTotal - alreadyBilled - (invoice.allocations?.reduce((s, a) => s + parseFloat(a.amount || 0), 0) || 0),
            // Draw info
            drawNumber: draftDraw?.draw_number
          });

          const result = await uploadStampedPDF(stampedBuffer, storagePath);
          pdf_stamped_url = result.url;
        }
      } catch (stampErr) {
        console.error('PDF stamping failed:', stampErr.message);
        // Continue without stamping
      }
    }

    // ==========================================
    // ADD INVOICE TO DRAFT DRAW
    // ==========================================

    if (draftDraw) {
      try {
        // Add invoice to draw (creates draw_allocations)
        await addInvoiceToDraw(invoiceId, draftDraw.id, approved_by);
        addedToDraw = true;

        console.log(`[APPROVAL] Invoice ${invoiceId} auto-added to Draw #${draftDraw.draw_number}`);
      } catch (drawErr) {
        console.error('Error adding invoice to draw:', drawErr);
        // Continue with approval even if draw add fails
      }
    }

    // Update invoice - status is now 'in_draw' if added to draw, otherwise 'approved'
    const newStatus = addedToDraw ? 'in_draw' : 'approved';

    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        status: newStatus,
        approved_at: new Date().toISOString(),
        approved_by,
        pdf_stamped_url,
        first_draw_id: addedToDraw ? draftDraw.id : null
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(invoiceId, 'approved', approved_by, {
      stamped: !!pdf_stamped_url,
      added_to_draw: addedToDraw,
      draw_id: draftDraw?.id,
      draw_number: draftDraw?.draw_number
    });

    // ==========================================
    // LIVE BUDGET UPDATES
    // ==========================================

    // Update budget lines for each cost code allocation
    if (invoice.allocations && invoice.allocations.length > 0 && invoice.job?.id) {
      for (const alloc of invoice.allocations) {
        if (!alloc.cost_code_id) continue;

        // Check if budget line exists for this job/cost code
        const { data: existing } = await supabase
          .from('v2_budget_lines')
          .select('id, billed_amount')
          .eq('job_id', invoice.job.id)
          .eq('cost_code_id', alloc.cost_code_id)
          .single();

        if (existing) {
          // Update existing budget line
          const newBilled = (parseFloat(existing.billed_amount) || 0) + parseFloat(alloc.amount);
          await supabase
            .from('v2_budget_lines')
            .update({ billed_amount: newBilled })
            .eq('id', existing.id);
        } else {
          // Create new budget line
          await supabase
            .from('v2_budget_lines')
            .insert({
              job_id: invoice.job.id,
              cost_code_id: alloc.cost_code_id,
              budgeted_amount: 0,
              committed_amount: 0,
              billed_amount: parseFloat(alloc.amount) || 0,
              paid_amount: 0
            });
        }
      }
    }

    // Update PO line items if invoice is linked to a PO
    if (invoice.po?.id && invoice.allocations && invoice.allocations.length > 0) {
      for (const alloc of invoice.allocations) {
        if (!alloc.cost_code_id) continue;

        // Find matching PO line item by cost code
        const { data: poLineItem } = await supabase
          .from('v2_po_line_items')
          .select('id, invoiced_amount')
          .eq('po_id', invoice.po.id)
          .eq('cost_code_id', alloc.cost_code_id)
          .single();

        if (poLineItem) {
          const newInvoiced = (parseFloat(poLineItem.invoiced_amount) || 0) + parseFloat(alloc.amount);
          await supabase
            .from('v2_po_line_items')
            .update({ invoiced_amount: newInvoiced })
            .eq('id', poLineItem.id);
        }
      }
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deny invoice - moves to archived 'denied' status
app.patch('/api/invoices/:id/deny', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { denied_by, denial_reason } = req.body;

    // Get current invoice to validate transition
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single();

    if (getError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Only allow deny from received or needs_approval status
    const allowedStatuses = ['received', 'needs_approval'];
    if (!allowedStatuses.includes(invoice.status)) {
      return res.status(400).json({
        error: `Cannot deny invoice in '${invoice.status}' status. Only received or needs_approval invoices can be denied.`
      });
    }

    const { data, error } = await supabase
      .from('v2_invoices')
      .update({
        status: 'denied',
        denied_at: new Date().toISOString(),
        denied_by,
        denial_reason
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (error) throw error;

    await logActivity(invoiceId, 'denied', denied_by, { reason: denial_reason });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close out invoice - write off remaining balance and mark as paid
app.post('/api/invoices/:id/close-out', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { closed_out_by, reason, notes } = req.body;

    // Validate required fields
    if (!closed_out_by) {
      return res.status(400).json({ error: 'closed_out_by is required' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required for close-out' });
    }

    // Valid close-out reasons
    const validReasons = [
      'Work descoped / reduced scope',
      'Vendor credit issued',
      'Dispute resolved / settlement',
      'Change order adjustment',
      'Billing error corrected',
      'Other'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid close-out reason' });
    }

    // If reason is "Other", notes are required
    if (reason === 'Other' && (!notes || notes.trim() === '')) {
      return res.status(400).json({ error: 'Notes are required when reason is "Other"' });
    }

    // Get current invoice
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, status, amount, paid_amount')
      .eq('id', invoiceId)
      .single();

    if (getError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Only allow close-out from needs_approval or approved status
    const allowedStatuses = ['needs_approval', 'approved'];
    if (!allowedStatuses.includes(invoice.status)) {
      return res.status(400).json({
        error: `Cannot close out invoice in '${invoice.status}' status. Only needs_approval or approved invoices can be closed out.`
      });
    }

    const invoiceAmount = parseFloat(invoice.amount || 0);
    const paidAmount = parseFloat(invoice.paid_amount || 0);
    const writeOffAmount = invoiceAmount - paidAmount;

    // Validate there's actually something to write off
    if (writeOffAmount <= 0.01) {
      return res.status(400).json({
        error: 'Invoice is already fully paid. Nothing to close out.'
      });
    }

    // Build close-out reason with notes
    const fullReason = notes ? `${reason}: ${notes}` : reason;

    // Update invoice
    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        status: 'paid',
        paid_amount: invoiceAmount, // Set paid_amount to full amount (write-off counts as "paid")
        closed_out_at: new Date().toISOString(),
        closed_out_by,
        closed_out_reason: fullReason,
        write_off_amount: writeOffAmount
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Clear any remaining allocations
    await supabase
      .from('v2_invoice_allocations')
      .delete()
      .eq('invoice_id', invoiceId);

    // Log activity
    await logActivity(invoiceId, 'closed_out', closed_out_by, {
      invoice_amount: invoiceAmount,
      total_paid: paidAmount,
      write_off_amount: writeOffAmount,
      reason,
      notes: notes || null
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark invoice as paid to vendor
app.patch('/api/invoices/:id/pay', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { payment_method, payment_reference, payment_date, payment_amount } = req.body;

    // Validate required fields
    if (!payment_method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const validMethods = ['check', 'ach', 'wire', 'credit_card', 'cash', 'other'];
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Get current invoice
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, status, amount, paid_to_vendor')
      .eq('id', invoiceId)
      .single();

    if (getError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.paid_to_vendor) {
      return res.status(400).json({ error: 'Invoice has already been marked as paid' });
    }

    // Determine payment amount (default to invoice amount if not specified)
    const paidAmount = payment_amount !== undefined ? parseFloat(payment_amount) : parseFloat(invoice.amount || 0);

    // Update invoice with payment info
    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        paid_to_vendor: true,
        paid_to_vendor_date: payment_date || new Date().toISOString().split('T')[0],
        paid_to_vendor_amount: paidAmount,
        paid_to_vendor_ref: payment_reference || null
      })
      .eq('id', invoiceId)
      .select(`
        *,
        vendor:v2_vendors(*),
        job:v2_jobs(id, name)
      `)
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(invoiceId, 'paid_to_vendor', 'System', {
      payment_method,
      payment_reference,
      payment_amount: paidAmount,
      payment_date: payment_date || new Date().toISOString().split('T')[0]
    });

    res.json(updated);
  } catch (err) {
    console.error('Error marking invoice as paid:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unmark invoice as paid to vendor
app.patch('/api/invoices/:id/unpay', async (req, res) => {
  try {
    const invoiceId = req.params.id;

    // Get current invoice
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, paid_to_vendor')
      .eq('id', invoiceId)
      .single();

    if (getError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!invoice.paid_to_vendor) {
      return res.status(400).json({ error: 'Invoice is not marked as paid' });
    }

    // Clear payment info
    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        paid_to_vendor: false,
        paid_to_vendor_date: null,
        paid_to_vendor_amount: null,
        paid_to_vendor_ref: null
      })
      .eq('id', invoiceId)
      .select(`
        *,
        vendor:v2_vendors(*),
        job:v2_jobs(id, name)
      `)
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(invoiceId, 'unpaid', 'System', {});

    res.json(updated);
  } catch (err) {
    console.error('Error unmarking invoice as paid:', err);
    res.status(500).json({ error: err.message });
  }
});

// Allocate invoice to cost codes
app.post('/api/invoices/:id/allocate', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { allocations } = req.body;

    // Get invoice to check remaining amount
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('amount, billed_amount, paid_amount')
      .eq('id', invoiceId)
      .single();

    if (invoice) {
      const invoiceAmount = parseFloat(invoice.amount || 0);
      const alreadyBilled = Math.max(
        parseFloat(invoice.billed_amount || 0),
        parseFloat(invoice.paid_amount || 0)
      );
      const remainingAmount = invoiceAmount - alreadyBilled;

      // Calculate new allocation total
      const allocationTotal = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

      // Validate: allocation cannot exceed remaining amount
      if (allocationTotal > remainingAmount + 0.01) {
        return res.status(400).json({
          error: `Allocation total ($${allocationTotal.toFixed(2)}) exceeds remaining amount ($${remainingAmount.toFixed(2)}). This invoice has already been billed $${alreadyBilled.toFixed(2)}.`
        });
      }
    }

    await supabase
      .from('v2_invoice_allocations')
      .delete()
      .eq('invoice_id', invoiceId);

    if (allocations && allocations.length > 0) {
      const { error } = await supabase
        .from('v2_invoice_allocations')
        .insert(allocations.map(a => ({
          invoice_id: invoiceId,
          cost_code_id: a.cost_code_id,
          amount: a.amount,
          notes: a.notes,
          job_id: a.job_id || null,
          po_line_item_id: a.po_line_item_id || null
        })));

      if (error) throw error;
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// BUDGET API
// ============================================================

app.get('/api/jobs/:id/budget', async (req, res) => {
  try {
    const jobId = req.params.id;

    const { data: budgetLines, error: budgetError } = await supabase
      .from('v2_budget_lines')
      .select(`
        *,
        cost_code:v2_cost_codes(id, code, name, category)
      `)
      .eq('job_id', jobId)
      .order('cost_code(code)');

    if (budgetError) throw budgetError;

    // Get allocations from approved+ invoices
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount,
        cost_code_id,
        invoice:v2_invoices!inner(job_id, status)
      `)
      .eq('invoice.job_id', jobId)
      .in('invoice.status', ['approved', 'in_draw', 'paid']);

    const actualsByCostCode = {};
    if (allocations) {
      allocations.forEach(a => {
        if (!actualsByCostCode[a.cost_code_id]) {
          actualsByCostCode[a.cost_code_id] = { billed: 0, paid: 0 };
        }
        actualsByCostCode[a.cost_code_id].billed += parseFloat(a.amount) || 0;
        if (a.invoice.status === 'paid') {
          actualsByCostCode[a.cost_code_id].paid += parseFloat(a.amount) || 0;
        }
      });
    }

    const result = budgetLines.map(bl => ({
      ...bl,
      actual_billed: actualsByCostCode[bl.cost_code_id]?.billed || 0,
      actual_paid: actualsByCostCode[bl.cost_code_id]?.paid || 0,
      variance: (parseFloat(bl.budgeted_amount) || 0) - (actualsByCostCode[bl.cost_code_id]?.billed || 0)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full budget summary for a job (for Budget page)
app.get('/api/jobs/:id/budget-summary', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get job info
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    // Get budget lines with cost code info
    const { data: budgetLines, error: budgetError } = await supabase
      .from('v2_budget_lines')
      .select(`
        *,
        cost_code:v2_cost_codes(id, code, name, category)
      `)
      .eq('job_id', jobId);

    if (budgetError) throw budgetError;

    // Get all cost codes (for lines without budget)
    const { data: allCostCodes } = await supabase
      .from('v2_cost_codes')
      .select('id, code, name, category')
      .order('code');

    // Get allocations from all invoices for this job (include po_id to check if linked to PO)
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount,
        cost_code_id,
        cost_code:v2_cost_codes(id, code, name),
        invoice:v2_invoices!inner(id, job_id, status, po_id)
      `)
      .eq('invoice.job_id', jobId);

    // Get committed amounts from POs (only sent or approved POs commit to budget)
    const { data: poLines } = await supabase
      .from('v2_po_line_items')
      .select(`
        amount,
        cost_code_id,
        po:v2_purchase_orders!inner(job_id, status, status_detail, approval_status)
      `)
      .eq('po.job_id', jobId)
      .neq('po.status', 'cancelled')
      .or('status_detail.eq.sent,status_detail.eq.approved,approval_status.eq.approved', { foreignTable: 'po' });

    // Build actuals and committed by cost code
    const actualsByCostCode = {};
    const committedByCostCode = {};

    // First, add PO line items to committed
    if (poLines) {
      poLines.forEach(pl => {
        const ccId = pl.cost_code_id;
        if (!committedByCostCode[ccId]) committedByCostCode[ccId] = 0;
        committedByCostCode[ccId] += parseFloat(pl.amount) || 0;
      });
    }

    // Process invoice allocations
    if (allocations) {
      allocations.forEach(a => {
        const ccId = a.cost_code_id;
        if (!actualsByCostCode[ccId]) {
          actualsByCostCode[ccId] = { billed: 0, paid: 0, costCode: a.cost_code };
        }

        // Only count approved, in_draw, or paid invoices as billed
        if (['approved', 'in_draw', 'paid'].includes(a.invoice.status)) {
          actualsByCostCode[ccId].billed += parseFloat(a.amount) || 0;

          // Add to committed if invoice is NOT linked to a PO (to avoid double counting)
          if (!a.invoice.po_id) {
            if (!committedByCostCode[ccId]) committedByCostCode[ccId] = 0;
            committedByCostCode[ccId] += parseFloat(a.amount) || 0;
          }
        }
        if (a.invoice.status === 'paid') {
          actualsByCostCode[ccId].paid += parseFloat(a.amount) || 0;
        }
      });
    }

    // Build budget map
    const budgetMap = {};
    (budgetLines || []).forEach(bl => {
      budgetMap[bl.cost_code_id] = {
        budgeted: parseFloat(bl.budgeted_amount) || 0,
        costCode: bl.cost_code?.code || '',
        description: bl.cost_code?.name || '',
        category: bl.cost_code?.category || 'Uncategorized'
      };
    });

    // Build cost code lookup for category info
    const costCodeLookup = {};
    (allCostCodes || []).forEach(cc => {
      costCodeLookup[cc.id] = cc;
    });

    // Combine all cost codes that have any activity
    const allCostCodeIds = new Set();
    Object.keys(budgetMap).forEach(id => allCostCodeIds.add(id));
    Object.keys(actualsByCostCode).forEach(id => allCostCodeIds.add(id));
    Object.keys(committedByCostCode).forEach(id => allCostCodeIds.add(id));

    // Build result lines
    const lines = [];
    allCostCodeIds.forEach(ccId => {
      const budget = budgetMap[ccId] || {};
      const actuals = actualsByCostCode[ccId] || { billed: 0, paid: 0 };
      const costCodeInfo = costCodeLookup[ccId] || {};
      const costCode = budget.costCode || costCodeInfo.code || '';
      const description = budget.description || costCodeInfo.name || '';
      const category = budget.category || costCodeInfo.category || 'Uncategorized';

      lines.push({
        costCodeId: ccId,
        costCode,
        description,
        category,
        budgeted: budget.budgeted || 0,
        committed: committedByCostCode[ccId] || 0,
        billed: actuals.billed,
        paid: actuals.paid
      });
    });

    // Sort by cost code
    lines.sort((a, b) => (a.costCode || '').localeCompare(b.costCode || ''));

    // Calculate totals
    const totals = lines.reduce((acc, line) => ({
      budgeted: acc.budgeted + line.budgeted,
      committed: acc.committed + line.committed,
      billed: acc.billed + line.billed,
      paid: acc.paid + line.paid
    }), { budgeted: 0, committed: 0, billed: 0, paid: 0 });

    totals.remaining = totals.budgeted - totals.billed;
    totals.percentComplete = totals.budgeted > 0 ? (totals.billed / totals.budgeted) * 100 : 0;

    // Get PO change orders for this job
    const { data: poChangeOrders } = await supabase
      .from('v2_change_orders')
      .select(`
        id, change_order_number, description, reason, amount_change, status, approved_at, created_at,
        po:v2_purchase_orders!inner(id, po_number, job_id, vendor:v2_vendors(id, name))
      `)
      .eq('po.job_id', jobId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Get job-level change orders (PCCOs - Prime Contract Change Orders)
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', jobId)
      .order('change_order_number');

    // Calculate PO change order totals (only approved ones affect subcontract costs)
    const approvedPOCOs = (poChangeOrders || []).filter(co => co.status === 'approved');
    const poChangeOrderTotal = approvedPOCOs.reduce((sum, co) => sum + (parseFloat(co.amount_change) || 0), 0);

    // Calculate job change order totals (PCCOs - affect contract with owner)
    const approvedPCCOs = (jobChangeOrders || []).filter(co => co.status === 'approved');
    const pccoTotal = approvedPCCOs.reduce((sum, co) => sum + (parseFloat(co.amount) || 0), 0);

    // Totals
    totals.poChangeOrderTotal = poChangeOrderTotal;  // Changes to subcontract costs
    totals.changeOrderTotal = pccoTotal;             // Changes to owner contract (PCCO)
    totals.adjustedContract = (parseFloat(job?.contract_amount) || totals.budgeted) + pccoTotal;

    res.json({
      job,
      lines,
      totals,
      changeOrders: poChangeOrders || [],
      jobChangeOrders: jobChangeOrders || []
    });
  } catch (err) {
    console.error('Budget summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Import budget from Excel
app.post('/api/jobs/:id/budget/import', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { lines } = req.body;

    if (!lines || !Array.isArray(lines)) {
      return res.status(400).json({ error: 'Invalid budget data' });
    }

    // Get all cost codes
    const { data: costCodes } = await supabase
      .from('v2_cost_codes')
      .select('id, code, name');

    const costCodeMap = {};
    costCodes.forEach(cc => {
      costCodeMap[cc.code] = cc;
    });

    let imported = 0;
    let created = 0;

    for (const line of lines) {
      let costCode = costCodeMap[line.costCode];

      // Create cost code if it doesn't exist
      if (!costCode && line.costCode) {
        const { data: newCostCode, error: ccError } = await supabase
          .from('v2_cost_codes')
          .insert({
            code: line.costCode,
            name: line.description || line.costCode,
            category: 'Imported'
          })
          .select()
          .single();

        if (!ccError && newCostCode) {
          costCode = newCostCode;
          costCodeMap[line.costCode] = costCode;
          created++;
        }
      }

      if (costCode) {
        // Check if budget line exists
        const { data: existing } = await supabase
          .from('v2_budget_lines')
          .select('id')
          .eq('job_id', jobId)
          .eq('cost_code_id', costCode.id)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from('v2_budget_lines')
            .update({ budgeted_amount: line.budgeted || 0 })
            .eq('id', existing.id);
        } else {
          // Insert new
          await supabase
            .from('v2_budget_lines')
            .insert({
              job_id: jobId,
              cost_code_id: costCode.id,
              budgeted_amount: line.budgeted || 0,
              committed_amount: 0,
              billed_amount: 0,
              paid_amount: 0
            });
        }
        imported++;
      }
    }

    res.json({ success: true, imported, costCodesCreated: created });
  } catch (err) {
    console.error('Budget import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export budget to Excel
app.get('/api/jobs/:id/budget/export', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get job
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    // Get budget summary
    const budgetRes = await fetch(`http://localhost:${PORT}/api/jobs/${jobId}/budget-summary`);
    const budgetData = await budgetRes.json();

    // Create workbook
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Budget');

    // Header
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = `Budget - ${job.name}`;
    sheet.getCell('A1').font = { bold: true, size: 16 };

    // Column headers
    sheet.addRow([]);
    sheet.addRow(['Cost Code', 'Description', 'Budget', 'Committed', 'Billed', 'Paid', '%', 'Remaining', 'Variance']);
    const headerRow = sheet.getRow(3);
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // Data rows
    budgetData.lines.forEach(line => {
      const remaining = line.budgeted - line.billed;
      const variance = line.budgeted - line.billed;
      const pct = line.budgeted > 0 ? (line.billed / line.budgeted) * 100 : 0;

      sheet.addRow([
        line.costCode,
        line.description,
        line.budgeted,
        line.committed,
        line.billed,
        line.paid,
        pct / 100,
        remaining,
        variance
      ]);
    });

    // Totals row
    const totalsRow = sheet.addRow([
      'TOTAL',
      '',
      budgetData.totals.budgeted,
      budgetData.totals.committed,
      budgetData.totals.billed,
      budgetData.totals.paid,
      budgetData.totals.percentComplete / 100,
      budgetData.totals.remaining,
      budgetData.totals.budgeted - budgetData.totals.billed
    ]);
    totalsRow.font = { bold: true };

    // Format currency columns
    ['C', 'D', 'E', 'F', 'H', 'I'].forEach(col => {
      sheet.getColumn(col).numFmt = '"$"#,##0.00';
      sheet.getColumn(col).width = 15;
    });
    sheet.getColumn('G').numFmt = '0.0%';
    sheet.getColumn('A').width = 12;
    sheet.getColumn('B').width = 30;

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Budget-${job.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Budget export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DRAWS API
// ============================================================

app.get('/api/jobs/:id/draws', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_draws')
      .select(`
        *,
        invoices:v2_draw_invoices(
          invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(name))
        )
      `)
      .eq('job_id', req.params.id)
      .order('draw_number', { ascending: false });

    if (error) throw error;

    // Get CO billings for all draws
    const drawIds = data.map(d => d.id);
    const { data: coBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('draw_id, amount')
      .in('draw_id', drawIds);

    // Calculate total amount for each draw (invoices + CO billings)
    const drawsWithTotals = data.map(draw => {
      const invoiceTotal = draw.invoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
      const coTotal = (coBillings || [])
        .filter(b => b.draw_id === draw.id)
        .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      return {
        ...draw,
        total_amount: invoiceTotal + coTotal,
        invoice_total: invoiceTotal,
        co_total: coTotal
      };
    });

    res.json(drawsWithTotals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single draw with full data for G702/G703 view
app.get('/api/draws/:id', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Get draw with job info
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`
        *,
        job:v2_jobs(id, name, address, client_name, contract_amount)
      `)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    // Get invoices in this draw with full details
    const { data: drawInvoices, error: invError } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          id, invoice_number, invoice_date, amount, status, pdf_url, pdf_stamped_url,
          vendor:v2_vendors(id, name),
          allocations:v2_invoice_allocations(
            id, amount, notes,
            cost_code:v2_cost_codes(id, code, name)
          )
        )
      `)
      .eq('draw_id', drawId);

    if (invError) throw invError;

    // Get budget lines for this job (for G703 scheduled values)
    const { data: budgetLines, error: budgetError } = await supabase
      .from('v2_budget_lines')
      .select(`
        id, budgeted_amount, committed_amount, billed_amount, paid_amount,
        cost_code:v2_cost_codes(id, code, name)
      `)
      .eq('job_id', draw.job_id);

    if (budgetError) throw budgetError;

    // Get previous draws for this job to calculate previous totals
    const { data: previousDraws, error: prevError } = await supabase
      .from('v2_draws')
      .select('id, draw_number')
      .eq('job_id', draw.job_id)
      .lt('draw_number', draw.draw_number)
      .order('draw_number', { ascending: true });

    if (prevError) throw prevError;

    // Get all previous draw invoices to calculate previous period totals by cost code
    let previousByCode = {};
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`
          invoice:v2_invoices(
            allocations:v2_invoice_allocations(
              amount,
              cost_code_id
            )
          )
        `)
        .in('draw_id', prevDrawIds);

      if (prevInvoices) {
        prevInvoices.forEach(di => {
          if (di.invoice?.allocations) {
            di.invoice.allocations.forEach(alloc => {
              if (!previousByCode[alloc.cost_code_id]) {
                previousByCode[alloc.cost_code_id] = 0;
              }
              previousByCode[alloc.cost_code_id] += parseFloat(alloc.amount) || 0;
            });
          }
        });
      }
    }

    // Calculate this period totals by cost code
    let thisPeriodByCode = {};
    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];
    invoices.forEach(inv => {
      if (inv.allocations) {
        inv.allocations.forEach(alloc => {
          const codeId = alloc.cost_code?.id;
          if (codeId) {
            if (!thisPeriodByCode[codeId]) {
              thisPeriodByCode[codeId] = 0;
            }
            thisPeriodByCode[codeId] += parseFloat(alloc.amount) || 0;
          }
        });
      }
    });

    // Build G703 schedule of values - combine budget lines with activity
    // First, collect all unique cost codes from budget lines, previous draws, and current draw
    const allCostCodeIds = new Set();
    (budgetLines || []).forEach(bl => {
      if (bl.cost_code?.id) allCostCodeIds.add(bl.cost_code.id);
    });
    Object.keys(previousByCode).forEach(id => allCostCodeIds.add(id));
    Object.keys(thisPeriodByCode).forEach(id => allCostCodeIds.add(id));

    // Build a map of budget lines by cost code id
    const budgetByCode = {};
    (budgetLines || []).forEach(bl => {
      if (bl.cost_code?.id) {
        budgetByCode[bl.cost_code.id] = bl;
      }
    });

    // Get cost code info for any codes not in budget lines
    const missingCodeIds = [...allCostCodeIds].filter(id => !budgetByCode[id]);
    let additionalCodes = {};
    if (missingCodeIds.length > 0) {
      const { data: codes } = await supabase
        .from('v2_cost_codes')
        .select('id, code, name')
        .in('id', missingCodeIds);
      (codes || []).forEach(c => {
        additionalCodes[c.id] = c;
      });
    }

    // Build schedule of values
    let itemNum = 0;
    const scheduleOfValues = [...allCostCodeIds].map(codeId => {
      const bl = budgetByCode[codeId];
      const costCode = bl?.cost_code || additionalCodes[codeId];
      if (!costCode) return null;

      const budget = parseFloat(bl?.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const materialsStored = 0;
      const totalBilled = previous + thisPeriod + materialsStored;
      const percentComplete = budget > 0 ? (totalBilled / budget) * 100 : (totalBilled > 0 ? 100 : 0);
      const balance = budget - totalBilled;

      // Only include cost codes with billing activity in THIS draw period
      if (thisPeriod === 0) return null;

      itemNum++;
      return {
        item: itemNum,
        costCodeId: codeId,
        costCode: costCode.code,
        description: costCode.name,
        budget: budget,
        scheduledValue: budget, // Keep for backwards compatibility
        previousBilled: previous,
        previousCompleted: previous, // Keep for backwards compatibility
        currentBilled: thisPeriod,
        thisPeriod: thisPeriod, // Keep for backwards compatibility
        materialsStored: materialsStored,
        totalBilled: totalBilled,
        totalCompleted: totalBilled, // Keep for backwards compatibility
        percentComplete: percentComplete,
        balance: balance
      };
    }).filter(Boolean).sort((a, b) => (a.costCode || '').localeCompare(b.costCode || ''));

    // Calculate G702 totals (invoice portion)
    const totalScheduled = scheduleOfValues.reduce((sum, item) => sum + item.scheduledValue, 0);
    const totalPrevious = scheduleOfValues.reduce((sum, item) => sum + item.previousCompleted, 0);
    const totalThisPeriod = scheduleOfValues.reduce((sum, item) => sum + item.thisPeriod, 0);
    const totalMaterials = scheduleOfValues.reduce((sum, item) => sum + item.materialsStored, 0);

    // ========== CHANGE ORDER DATA ==========
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .eq('status', 'approved')
      .order('change_order_number', { ascending: true });

    const changeOrderTotal = (jobChangeOrders || []).reduce((sum, co) => sum + parseFloat(co.amount || 0), 0);

    const { data: thisDrawCOBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount)')
      .eq('draw_id', drawId);

    let previousCOBillings = [];
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevCO } = await supabase
        .from('v2_job_co_draw_billings')
        .select('amount, draw_id, change_order_id')
        .in('draw_id', prevDrawIds);
      previousCOBillings = prevCO || [];
    }

    const coBilledThisPeriod = (thisDrawCOBillings || []).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    const coBilledPreviously = previousCOBillings.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    // Only include COs that have billings on THIS draw (not previous draws)
    const cosWithBillings = (jobChangeOrders || []).filter(co => {
      const hasThisPeriodBilling = (thisDrawCOBillings || []).some(b => b.change_order_id === co.id);
      return hasThisPeriodBilling;
    });

    const coScheduleOfValues = cosWithBillings.map((co, idx) => {
      const prevBillings = previousCOBillings.filter(b => b.change_order_id === co.id).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      const thisPeriodBilling = (thisDrawCOBillings || []).filter(b => b.change_order_id === co.id).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      const totalBilled = prevBillings + thisPeriodBilling;
      const coAmount = parseFloat(co.amount || 0);
      return {
        itemNumber: idx + 1,
        changeOrderId: co.id,
        changeOrderNumber: co.change_order_number,
        title: co.title,
        scheduledValue: coAmount,
        coAmount: coAmount,
        daysAdded: parseInt(co.days_added) || 0,
        previousBillings: prevBillings,
        previousBilled: prevBillings,
        thisPeriodBilling: thisPeriodBilling,
        thisPeriod: thisPeriodBilling,
        totalBilled: totalBilled,
        percentComplete: coAmount > 0 ? Math.min((totalBilled / coAmount) * 100, 100) : 0,
        balance: coAmount - totalBilled,
        clientApproved: !!co.client_approved_at || co.client_approval_bypassed
      };
    });

    const grandTotalCompleted = totalPrevious + totalThisPeriod + totalMaterials + coBilledPreviously + coBilledThisPeriod;
    const currentPaymentDue = totalThisPeriod + coBilledThisPeriod;
    const contractSum = parseFloat(draw.job?.contract_amount || 0);
    const contractSumToDate = contractSum + changeOrderTotal;

    // ========== ATTACHMENTS ==========
    const { data: attachments } = await supabase
      .from('v2_draw_attachments')
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .eq('draw_id', drawId)
      .order('uploaded_at', { ascending: false });

    // ========== ACTIVITY LOG ==========
    const { data: activity } = await supabase
      .from('v2_draw_activity')
      .select('*')
      .eq('draw_id', drawId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    res.json({
      ...draw,
      invoices,
      invoiceCount: invoices.length,
      scheduleOfValues,
      changeOrders: jobChangeOrders || [],
      changeOrderTotal,
      coScheduleOfValues,
      coBillings: thisDrawCOBillings || [],
      coBilledThisPeriod,
      coBilledPreviously,
      attachments: attachments || [],
      activity: activity || [],
      g702: {
        applicationNumber: draw.draw_number,
        periodTo: draw.period_end,
        contractSum: contractSum,
        netChangeOrders: changeOrderTotal,
        contractSumToDate: contractSumToDate,
        totalCompletedPrevious: totalPrevious + coBilledPreviously,
        totalCompletedThisPeriod: totalThisPeriod + coBilledThisPeriod,
        materialsStored: totalMaterials,
        grandTotal: grandTotalCompleted,
        lessPreviousCertificates: totalPrevious + coBilledPreviously,
        currentPaymentDue: currentPaymentDue
      }
    });
  } catch (err) {
    console.error('Error fetching draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs/:id/draws', async (req, res) => {
  try {
    const jobId = req.params.id;

    const { data: existing } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('job_id', jobId)
      .order('draw_number', { ascending: false })
      .limit(1);

    const nextNumber = existing && existing.length > 0 ? existing[0].draw_number + 1 : 1;

    const { data, error } = await supabase
      .from('v2_draws')
      .insert({
        job_id: jobId,
        draw_number: nextNumber,
        period_end: req.body.period_end || new Date().toISOString().split('T')[0],
        status: 'draft'
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get approved invoices that haven't been added to a draw yet
app.get('/api/jobs/:id/approved-unbilled-invoices', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get all approved invoices for this job that are NOT in a draw
    const { data: invoices, error: invError } = await supabase
      .from('v2_invoices')
      .select(`
        id, invoice_number, invoice_date, amount, status, vendor_id, job_id,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        allocations:v2_invoice_allocations(id, amount, cost_code_id)
      `)
      .eq('job_id', jobId)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false });

    if (invError) throw invError;

    // Calculate the total
    const totalAmount = (invoices || []).reduce((sum, inv) => {
      const allocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      return sum + (allocationSum > 0 ? allocationSum : parseFloat(inv.amount || 0));
    }, 0);

    // Check if there's an existing draft draw for this job
    const { data: draftDraw, error: drawError } = await supabase
      .from('v2_draws')
      .select('id, draw_number, total_amount')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawError) throw drawError;

    res.json({
      invoices: invoices || [],
      invoice_count: (invoices || []).length,
      total_amount: totalAmount,
      existing_draft: draftDraw || null
    });
  } catch (err) {
    console.error('Error fetching approved unbilled invoices:', err);
    res.status(500).json({ error: err.message });
  }
});

// Auto-generate draw from approved invoices
app.post('/api/jobs/:id/auto-generate-draw', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { invoice_ids, use_existing_draft } = req.body;

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return res.status(400).json({ error: 'No invoices selected' });
    }

    let draw;

    // Check for existing draft draw if requested
    if (use_existing_draft) {
      const { data: draftDraw, error: draftError } = await supabase
        .from('v2_draws')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (draftError) throw draftError;
      draw = draftDraw;
    }

    // Create new draw if no existing draft
    if (!draw) {
      const { data: existing } = await supabase
        .from('v2_draws')
        .select('draw_number')
        .eq('job_id', jobId)
        .order('draw_number', { ascending: false })
        .limit(1);

      const nextNumber = existing && existing.length > 0 ? existing[0].draw_number + 1 : 1;

      const { data: newDraw, error: createError } = await supabase
        .from('v2_draws')
        .insert({
          job_id: jobId,
          draw_number: nextNumber,
          period_end: new Date().toISOString().split('T')[0],
          status: 'draft'
        })
        .select()
        .single();

      if (createError) throw createError;
      draw = newDraw;
    }

    // Add invoices to draw
    let addedCount = 0;
    let totalAmount = 0;

    for (const invoiceId of invoice_ids) {
      // Check if invoice exists and is approved
      const { data: invoice, error: invError } = await supabase
        .from('v2_invoices')
        .select('id, status, amount, allocations:v2_invoice_allocations(amount)')
        .eq('id', invoiceId)
        .single();

      if (invError || !invoice) continue;
      if (invoice.status !== 'approved') continue;

      // Check if already in draw
      const { data: existing } = await supabase
        .from('v2_draw_invoices')
        .select('id')
        .eq('draw_id', draw.id)
        .eq('invoice_id', invoiceId)
        .maybeSingle();

      if (existing) continue;

      // Add to draw
      const { error: linkError } = await supabase
        .from('v2_draw_invoices')
        .insert({ draw_id: draw.id, invoice_id: invoiceId });

      if (linkError) {
        console.error('Error linking invoice to draw:', linkError);
        continue;
      }

      // Update invoice status to in_draw
      const { error: statusError } = await supabase
        .from('v2_invoices')
        .update({ status: 'in_draw' })
        .eq('id', invoiceId);

      if (statusError) {
        console.error('Error updating invoice status:', statusError);
      }

      // Calculate amount (use allocation sum if available)
      const allocationSum = (invoice.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      totalAmount += allocationSum > 0 ? allocationSum : parseFloat(invoice.amount || 0);
      addedCount++;
    }

    // Update draw total
    const { error: updateError } = await supabase
      .from('v2_draws')
      .update({
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', draw.id);

    if (updateError) {
      console.error('Error updating draw total:', updateError);
    }

    res.json({
      draw_id: draw.id,
      draw_number: draw.draw_number,
      invoice_count: addedCount,
      total_amount: totalAmount,
      created_new: !use_existing_draft || !draw.id
    });
  } catch (err) {
    console.error('Error auto-generating draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update draw (header fields and G702 overrides)
app.patch('/api/draws/:id', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { draw_number, period_end, notes, g702_overrides } = req.body;
    const { data: currentDraw, error: fetchError } = await supabase
      .from('v2_draws').select('status').eq('id', drawId).single();
    if (fetchError) throw fetchError;
    if (currentDraw.status !== 'draft') {
      return res.status(400).json({ error: 'Can only edit draft draws' });
    }
    const updateData = { updated_at: new Date().toISOString() };
    if (draw_number !== undefined) updateData.draw_number = draw_number;
    if (period_end !== undefined) updateData.period_end = period_end;
    if (notes !== undefined) updateData.notes = notes;
    if (g702_overrides) {
      if (g702_overrides.original_contract_sum !== undefined) updateData.g702_original_contract_override = g702_overrides.original_contract_sum;
      if (g702_overrides.net_change_orders !== undefined) updateData.g702_change_orders_override = g702_overrides.net_change_orders;
    }
    const { data, error } = await supabase.from('v2_draws').update(updateData).eq('id', drawId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/draws/:id/add-invoices', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { invoice_ids } = req.body;

    // Get draw info
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('id', drawId)
      .single();

    const { error: linkError } = await supabase
      .from('v2_draw_invoices')
      .insert(invoice_ids.map(id => ({ draw_id: drawId, invoice_id: id })));

    if (linkError) throw linkError;

    // Get invoices with their stamped PDFs and allocations
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select(`
        id, amount, pdf_stamped_url,
        allocations:v2_invoice_allocations(amount, po_line_item_id)
      `)
      .in('id', invoice_ids);

    // Stamp each invoice with "IN DRAW"
    for (const inv of invoices) {
      if (inv.pdf_stamped_url) {
        try {
          const urlParts = inv.pdf_stamped_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1]).replace('_stamped.pdf', '.pdf');
            const pdfBuffer = await downloadPDF(storagePath.replace('.pdf', '_stamped.pdf'));
            const stampedBuffer = await stampInDraw(pdfBuffer, draw?.draw_number || 1);
            await uploadStampedPDF(stampedBuffer, storagePath);
          }
        } catch (stampErr) {
          console.error('IN DRAW stamp failed for invoice:', inv.id, stampErr.message);
        }
      }
      await logActivity(inv.id, 'added_to_draw', 'System', { draw_number: draw?.draw_number });
    }

    const { error: updateError } = await supabase
      .from('v2_invoices')
      .update({ status: 'in_draw' })
      .in('id', invoice_ids);

    if (updateError) throw updateError;

    // Calculate total using allocation sums (for partial approvals) or invoice amount as fallback
    const total = invoices.reduce((sum, inv) => {
      const allocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      // Use allocation sum if available, otherwise fall back to invoice amount
      return sum + (allocationSum > 0 ? allocationSum : parseFloat(inv.amount || 0));
    }, 0);

    await supabase
      .from('v2_draws')
      .update({ total_amount: total })
      .eq('id', drawId);

    res.json({ success: true, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove invoice from draw
app.post('/api/draws/:id/remove-invoice', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { invoice_id, performed_by = 'System' } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id is required' });
    }

    // Get draw info for activity log
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow removal from draft draws (submitted/funded are locked)
    if (draw.status !== 'draft') {
      return res.status(400).json({
        error: draw.status === 'submitted'
          ? 'Cannot remove invoices from a submitted draw. Unsubmit the draw first.'
          : 'Cannot remove invoices from a funded draw'
      });
    }

    // Remove from draw_allocations (new table)
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoice_id);

    // Remove from draw_invoices
    const { error: deleteError } = await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoice_id);

    if (deleteError) throw deleteError;

    // Get invoice data for re-stamping
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, description, total_amount),
        allocations:v2_invoice_allocations(
          amount,
          cost_code_id,
          cost_code:v2_cost_codes(code, name)
        )
      `)
      .eq('id', invoice_id)
      .single();

    // Re-stamp with just APPROVED (remove IN DRAW stamp)
    let newStampedUrl = null;
    if (invoice?.pdf_url) {
      try {
        const urlParts = invoice.pdf_url.split('/storage/v1/object/public/invoices/');
        if (urlParts[1]) {
          const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
          const pdfBuffer = await downloadPDF(storagePath);

          // Get PO billing info
          let poTotal = null;
          let poBilledToDate = 0;
          if (invoice.po?.id) {
            poTotal = invoice.po.total_amount;
            const { data: priorInvoices } = await supabase
              .from('v2_invoices')
              .select('amount')
              .eq('po_id', invoice.po.id)
              .neq('id', invoice_id)
              .in('status', ['approved', 'in_draw', 'paid']);
            if (priorInvoices) {
              poBilledToDate = priorInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
            }
          }

          const stampedBuffer = await stampApproval(pdfBuffer, {
            status: 'APPROVED',
            date: new Date().toLocaleDateString(),
            approvedBy: invoice.approved_by || performed_by,
            vendorName: invoice.vendor?.name,
            invoiceNumber: invoice.invoice_number,
            jobName: invoice.job?.name,
            costCodes: (invoice.allocations || []).map(a => ({
              code: a.cost_code?.code,
              name: a.cost_code?.name,
              amount: a.amount
            })).filter(cc => cc.code),
            amount: invoice.amount,
            poNumber: invoice.po?.po_number,
            poDescription: invoice.po?.description,
            poTotal: poTotal,
            poBilledToDate: poBilledToDate
          });

          const result = await uploadStampedPDF(stampedBuffer, storagePath);
          newStampedUrl = result.url;
        }
      } catch (stampErr) {
        console.error('Re-stamping failed when removing from draw:', stampErr.message);
      }
    }

    // Update invoice status back to approved (keep approval info, re-stamp without IN DRAW)
    const { error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        status: 'approved',
        pdf_stamped_url: newStampedUrl
      })
      .eq('id', invoice_id);

    if (updateError) throw updateError;

    // Log invoice activity
    await logActivity(invoice_id, 'removed_from_draw', performed_by, {
      draw_number: draw.draw_number
    });

    // Log draw activity
    await logDrawActivity(drawId, 'invoice_removed', performed_by, {
      invoice_id,
      invoice_number: invoice?.invoice_number,
      vendor_name: invoice?.vendor?.name
    });

    // Recalculate draw total using v2_draw_allocations
    const { data: remainingAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId);

    const newTotal = remainingAllocations?.reduce((sum, alloc) => {
      return sum + parseFloat(alloc.amount || 0);
    }, 0) || 0;

    await supabase
      .from('v2_draws')
      .update({ total_amount: newTotal })
      .eq('id', drawId);

    res.json({ success: true, new_total: newTotal, draw_number: draw.draw_number });
  } catch (err) {
    console.error('Error removing invoice from draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a draw (admin cleanup)
app.delete('/api/draws/:id', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Delete draw allocations first
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId);

    // Delete draw invoices
    await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId);

    // Delete draw activity
    await supabase
      .from('v2_draw_activity')
      .delete()
      .eq('draw_id', drawId);

    // Delete the draw
    const { error } = await supabase
      .from('v2_draws')
      .delete()
      .eq('id', drawId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Recalculate draw total (fixes data from before partial approval fix)
app.post('/api/draws/:id/recalculate', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Get all invoices in this draw with allocations
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          amount,
          allocations:v2_invoice_allocations(amount, po_line_item_id)
        )
      `)
      .eq('draw_id', drawId);

    // Calculate correct total using allocation sums
    const newTotal = drawInvoices?.reduce((sum, di) => {
      const inv = di.invoice;
      if (!inv) return sum;
      const allocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      return sum + (allocationSum > 0 ? allocationSum : parseFloat(inv.amount || 0));
    }, 0) || 0;

    // Update the draw
    await supabase
      .from('v2_draws')
      .update({ total_amount: newTotal })
      .eq('id', drawId);

    res.json({ success: true, new_total: newTotal });
  } catch (err) {
    console.error('Error recalculating draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/draws/:id/submit', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { submitted_by = 'System' } = req.body;

    // Get draw info
    const { data: drawInfo } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!drawInfo) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    if (drawInfo.status !== 'draft') {
      return res.status(400).json({
        error: `Cannot submit a draw that is already ${drawInfo.status}`
      });
    }

    const now = new Date().toISOString();

    // Update draw status - set submitted_at and locked_at
    const { data: draw, error } = await supabase
      .from('v2_draws')
      .update({
        status: 'submitted',
        submitted_at: now,
        locked_at: now
      })
      .eq('id', drawId)
      .select()
      .single();

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'submitted', submitted_by, {
      draw_number: draw.draw_number,
      total_amount: draw.total_amount
    });

    // Get invoices in this draw and update their billed_amount tracking
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('invoice_id, amount')
      .eq('draw_id', drawId);

    if (drawAllocations && drawAllocations.length > 0) {
      // Group allocations by invoice
      const invoiceAmounts = {};
      for (const alloc of drawAllocations) {
        if (!invoiceAmounts[alloc.invoice_id]) {
          invoiceAmounts[alloc.invoice_id] = 0;
        }
        invoiceAmounts[alloc.invoice_id] += parseFloat(alloc.amount || 0);
      }

      // Update each invoice's billed_amount
      for (const [invoiceId, thisDrawAmount] of Object.entries(invoiceAmounts)) {
        const { data: invoice } = await supabase
          .from('v2_invoices')
          .select('billed_amount, amount')
          .eq('id', invoiceId)
          .single();

        if (invoice) {
          const previouslyBilled = parseFloat(invoice.billed_amount || 0);
          const cumulativeBilled = previouslyBilled + thisDrawAmount;
          const invoiceTotal = parseFloat(invoice.amount || 0);

          // Track partial billing but don't kick back - invoices stay in_draw
          // They can be billed again in the next draw for the remaining amount
          await supabase
            .from('v2_invoices')
            .update({ billed_amount: cumulativeBilled })
            .eq('id', invoiceId);

          // Log if partial
          if (cumulativeBilled < invoiceTotal - 0.01) {
            await logActivity(invoiceId, 'partial_billed', 'System', {
              draw_id: drawId,
              draw_number: draw.draw_number,
              amount_billed_this_draw: thisDrawAmount,
              cumulative_billed: cumulativeBilled,
              remaining: invoiceTotal - cumulativeBilled
            });
          }
        }
      }
    }

    console.log(`[DRAW] Draw #${draw.draw_number} submitted and locked`);
    res.json(draw);
  } catch (err) {
    console.error('Error submitting draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unsubmit draw - revert from submitted back to draft
app.post('/api/draws/:id/unsubmit', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { reason, performed_by = 'System' } = req.body;

    // Get draw info
    const { data: drawInfo } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!drawInfo) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    if (drawInfo.status !== 'submitted') {
      return res.status(400).json({
        error: drawInfo.status === 'draft'
          ? 'Draw is already in draft status'
          : 'Cannot unsubmit a funded draw'
      });
    }

    const now = new Date().toISOString();

    // Update draw status back to draft
    const { data: draw, error } = await supabase
      .from('v2_draws')
      .update({
        status: 'draft',
        locked_at: null,
        unsubmitted_at: now,
        unsubmit_reason: reason || null
      })
      .eq('id', drawId)
      .select()
      .single();

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'unsubmitted', performed_by, {
      draw_number: draw.draw_number,
      reason: reason || 'No reason provided'
    });

    // Note: We don't need to revert billed_amount on invoices because
    // the billing tracking is cumulative and useful for partial billing

    console.log(`[DRAW] Draw #${draw.draw_number} unsubmitted - returned to draft`);
    res.json(draw);
  } catch (err) {
    console.error('Error unsubmitting draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/draws/:id/fund', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { funded_amount, partial_funding_note, funded_by = 'System' } = req.body;

    // Get draw info first
    const { data: drawBefore } = await supabase
      .from('v2_draws')
      .select('draw_number, total_amount, job_id, status, locked_at')
      .eq('id', drawId)
      .single();

    if (!drawBefore) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Validate draw is submitted (can't fund a draft)
    if (drawBefore.status === 'draft') {
      return res.status(400).json({ error: 'Cannot fund a draft draw. Submit the draw first.' });
    }

    // Prevent re-funding an already funded draw
    if (drawBefore.status === 'funded') {
      return res.status(400).json({ error: 'Draw has already been funded' });
    }

    const billedAmount = parseFloat(drawBefore?.total_amount || 0);
    const actualFunded = parseFloat(funded_amount || billedAmount);
    const fundingDifference = actualFunded - billedAmount;

    // Status is always 'funded' - funding variance tracked in funding_difference field
    const status = 'funded';
    // Note: funding_difference < 0 means partial payment, > 0 means overpayment

    const now = new Date().toISOString();

    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .update({
        status: status,
        funded_at: now,
        funded_amount: actualFunded,
        funding_difference: fundingDifference,
        partial_funding_note: partial_funding_note || null,
        locked_at: drawBefore.locked_at || now // Ensure locked_at is set
      })
      .eq('id', drawId)
      .select()
      .single();

    if (drawError) throw drawError;

    // Log draw activity
    await logDrawActivity(drawId, 'funded', funded_by, {
      draw_number: draw.draw_number,
      billed_amount: billedAmount,
      funded_amount: actualFunded,
      funding_difference: fundingDifference,
      status: status
    });

    // Log funding difference if applicable
    if (Math.abs(fundingDifference) > 0.01) {
      console.log(`Draw ${draw.draw_number} funding: billed=${billedAmount}, funded=${actualFunded}, diff=${fundingDifference} (${status})`);
    }

    // Get draw allocations for this draw (using new v2_draw_allocations table)
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('invoice_id, cost_code_id, amount')
      .eq('draw_id', drawId);

    // Group allocations by invoice
    const invoiceAllocations = {};
    for (const alloc of drawAllocations || []) {
      if (!invoiceAllocations[alloc.invoice_id]) {
        invoiceAllocations[alloc.invoice_id] = [];
      }
      invoiceAllocations[alloc.invoice_id].push(alloc);
    }

    const invoiceIds = Object.keys(invoiceAllocations);
    if (invoiceIds.length > 0) {
      // Get invoices that are still in_draw
      const { data: invoices } = await supabase
        .from('v2_invoices')
        .select('id, amount, billed_amount, paid_amount, pdf_stamped_url, job_id, status')
        .in('id', invoiceIds)
        .eq('status', 'in_draw');

      const paidDate = new Date().toLocaleDateString();

      for (const inv of invoices || []) {
        const invoiceAmount = parseFloat(inv.amount || 0);
        const allocsForInvoice = invoiceAllocations[inv.id] || [];
        const billedThisDraw = allocsForInvoice.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const previouslyPaid = parseFloat(inv.paid_amount || 0);
        const newPaidAmount = previouslyPaid + billedThisDraw;

        // Check if invoice is fully billed
        const isFullyBilled = newPaidAmount >= invoiceAmount - 0.01;

        // Update budget paid amounts
        if (inv.job_id) {
          for (const alloc of allocsForInvoice) {
            if (!alloc.cost_code_id) continue;

            const { data: budgetLine } = await supabase
              .from('v2_budget_lines')
              .select('id, paid_amount')
              .eq('job_id', inv.job_id)
              .eq('cost_code_id', alloc.cost_code_id)
              .single();

            if (budgetLine) {
              const newBudgetPaid = (parseFloat(budgetLine.paid_amount) || 0) + parseFloat(alloc.amount || 0);
              await supabase
                .from('v2_budget_lines')
                .update({ paid_amount: newBudgetPaid })
                .eq('id', budgetLine.id);
            }
          }
        }

        // Stamp and update invoice as PAID
        if (inv.pdf_stamped_url) {
          try {
            const urlParts = inv.pdf_stamped_url.split('/storage/v1/object/public/invoices/');
            if (urlParts[1]) {
              const storagePath = decodeURIComponent(urlParts[1]).replace('_stamped.pdf', '.pdf');
              const pdfBuffer = await downloadPDF(storagePath.replace('.pdf', '_stamped.pdf'));
              const stampedBuffer = await stampPaid(pdfBuffer, paidDate);
              await uploadStampedPDF(stampedBuffer, storagePath);
            }
          } catch (stampErr) {
            console.error('PAID stamp failed for invoice:', inv.id, stampErr.message);
          }
        }

        // Mark invoice as paid and set fully_billed_at if applicable
        const invoiceUpdate = {
          status: 'paid',
          paid_amount: newPaidAmount
        };
        if (isFullyBilled) {
          invoiceUpdate.fully_billed_at = now;
        }

        await supabase
          .from('v2_invoices')
          .update(invoiceUpdate)
          .eq('id', inv.id);

        await logActivity(inv.id, 'paid', 'System', {
          draw_id: drawId,
          draw_number: draw.draw_number,
          amount_paid_this_draw: billedThisDraw,
          cumulative_paid: newPaidAmount,
          fully_billed: isFullyBilled
        });
      }
    }

    console.log(`[DRAW] Draw #${draw.draw_number} funded - status: ${status}, amount: $${actualFunded}`);
    res.json(draw);
  } catch (err) {
    console.error('Error funding draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fix legacy draw statuses (one-time migration helper)
app.post('/api/draws/fix-legacy-status', async (req, res) => {
  try {
    // Update partially_funded and overfunded to just 'funded'
    const { data, error } = await supabase
      .from('v2_draws')
      .update({ status: 'funded' })
      .in('status', ['partially_funded', 'overfunded'])
      .select('id, draw_number, status');

    if (error) throw error;
    res.json({ message: 'Legacy statuses fixed', updated: data?.length || 0, draws: data });
  } catch (err) {
    console.error('Error fixing legacy statuses:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DRAW EXPORT ENDPOINTS
// ============================================================
// JOB CHANGE ORDER ENDPOINTS
// Client-side change orders for billing (separate from PO COs)
// ============================================================

// Helper: Log CO activity
async function logCOActivity(changeOrderId, action, performedBy, details = {}) {
  try {
    await supabase
      .from('v2_job_co_activity')
      .insert({
        change_order_id: changeOrderId,
        action,
        performed_by: performedBy,
        details
      });
  } catch (err) {
    console.error('Failed to log CO activity:', err);
  }
}

// List change orders for a job
app.get('/api/jobs/:jobId/change-orders', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.query;

    let query = supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', jobId)
      .order('change_order_number', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Error fetching job change orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single change order with billing history
app.get('/api/change-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .select(`
        *,
        job:v2_jobs(id, name, client_name),
        billings:v2_job_co_draw_billings(
          id, amount, created_at,
          draw:v2_draws(id, draw_number, period_end, status)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!co) return res.status(404).json({ error: 'Change order not found' });

    const { data: activity } = await supabase
      .from('v2_job_co_activity')
      .select('*')
      .eq('change_order_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    res.json({ ...co, activity: activity || [] });
  } catch (err) {
    console.error('Error fetching change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new change order
app.post('/api/jobs/:jobId/change-orders', async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      change_order_number, title, description, reason, amount,
      base_amount, gc_fee_percent, gc_fee_amount,
      status, first_billed_draw_number, days_added, created_by
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (days_added === undefined || days_added === null || days_added === '') {
      return res.status(400).json({ error: 'Days added is required (can be 0)' });
    }

    // Get next CO number if not provided
    let coNumber = change_order_number;
    if (!coNumber) {
      const { data: maxCO } = await supabase
        .from('v2_job_change_orders')
        .select('change_order_number')
        .eq('job_id', jobId)
        .order('change_order_number', { ascending: false })
        .limit(1)
        .single();
      coNumber = (maxCO?.change_order_number || 0) + 1;
    }

    const insertData = {
      job_id: jobId,
      change_order_number: coNumber,
      title,
      description: description || title,
      reason: reason || 'scope_change',
      amount: parseFloat(amount) || 0,
      days_added: parseInt(days_added) || 0,
      status: status || 'draft',
      created_by
    };

    // Add optional fields
    if (base_amount !== undefined) insertData.base_amount = parseFloat(base_amount);
    if (gc_fee_percent !== undefined) insertData.gc_fee_percent = parseFloat(gc_fee_percent);
    if (gc_fee_amount !== undefined) insertData.gc_fee_amount = parseFloat(gc_fee_amount);
    if (first_billed_draw_number) insertData.first_billed_draw_number = first_billed_draw_number;

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    await logCOActivity(co.id, 'created', created_by, { amount: insertData.amount });

    res.status(201).json(co);
  } catch (err) {
    console.error('Error creating change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update change order
app.patch('/api/change-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      change_order_number, title, description, reason, amount,
      base_amount, gc_fee_percent, gc_fee_amount,
      status, first_billed_draw_number, days_added, updated_by
    } = req.body;

    const { data: existing } = await supabase
      .from('v2_job_change_orders')
      .select('status, billed_amount')
      .eq('id', id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Change order not found' });

    // Only prevent editing if there are billings (actual usage)
    const hasBillings = parseFloat(existing.billed_amount || 0) > 0;
    if (hasBillings && amount !== undefined && parseFloat(amount) < parseFloat(existing.billed_amount)) {
      return res.status(400).json({ error: 'Cannot reduce amount below billed amount' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (change_order_number !== undefined) updates.change_order_number = change_order_number;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (reason !== undefined) updates.reason = reason;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (base_amount !== undefined) updates.base_amount = parseFloat(base_amount);
    if (gc_fee_percent !== undefined) updates.gc_fee_percent = parseFloat(gc_fee_percent);
    if (gc_fee_amount !== undefined) updates.gc_fee_amount = parseFloat(gc_fee_amount);
    if (days_added !== undefined) updates.days_added = parseInt(days_added);
    if (status !== undefined) updates.status = status;
    if (first_billed_draw_number !== undefined) updates.first_billed_draw_number = first_billed_draw_number;

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'updated', updated_by, updates);
    res.json(co);
  } catch (err) {
    console.error('Error updating change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete change order (draft only)
app.delete('/api/change-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('v2_job_change_orders')
      .select('status')
      .eq('id', id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Can only delete draft change orders' });

    const { error } = await supabase.from('v2_job_change_orders').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit change order for approval
app.post('/api/change-orders/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { submitted_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Can only submit draft change orders' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'submitted', submitted_by);
    res.json(co);
  } catch (err) {
    console.error('Error submitting change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Internal approve change order
app.post('/api/change-orders/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'pending_approval') return res.status(400).json({ error: 'Can only approve pending change orders' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ status: 'approved', internal_approved_at: new Date().toISOString(), internal_approved_by: approved_by, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'approved', approved_by);
    res.json(co);
  } catch (err) {
    console.error('Error approving change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Client approve change order
app.post('/api/change-orders/:id/client-approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { client_approved_by, recorded_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'approved') return res.status(400).json({ error: 'Must be internally approved first' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ client_approved_at: new Date().toISOString(), client_approved_by: client_approved_by || 'Client', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'client_approved', recorded_by || 'System', { client_approved_by });
    res.json(co);
  } catch (err) {
    console.error('Error recording client approval:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bypass client approval
app.post('/api/change-orders/:id/bypass-client', async (req, res) => {
  try {
    const { id } = req.params;
    const { bypass_reason, bypassed_by } = req.body;

    if (!bypass_reason) return res.status(400).json({ error: 'Bypass reason is required' });

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'approved') return res.status(400).json({ error: 'Must be internally approved first' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ client_approval_bypassed: true, bypass_reason, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'client_bypassed', bypassed_by, { bypass_reason });
    res.json(co);
  } catch (err) {
    console.error('Error bypassing client approval:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reject change order
app.post('/api/change-orders/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, rejected_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (!['pending_approval', 'approved'].includes(existing.status)) return res.status(400).json({ error: 'Invalid status for rejection' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ status: 'rejected', rejection_reason, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'rejected', rejected_by, { rejection_reason });
    res.json(co);
  } catch (err) {
    console.error('Error rejecting change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CHANGE ORDER INVOICE LINKING
// ============================================================

// Get invoices linked to a change order
app.get('/api/change-orders/:id/invoices', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: links, error } = await supabase
      .from('v2_change_order_invoices')
      .select(`
        id, amount, notes, created_at, invoice_id,
        invoice:v2_invoices(id, invoice_number, amount, invoice_date, vendor:v2_vendors(id, name))
      `)
      .eq('change_order_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(links || []);
  } catch (err) {
    console.error('Error fetching CO invoices:', err);
    res.status(500).json({ error: err.message });
  }
});

// Link invoice to change order
app.post('/api/change-orders/:id/link-invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const { invoice_id, amount, notes } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id is required' });
    }

    // Check if already linked
    const { data: existing } = await supabase
      .from('v2_change_order_invoices')
      .select('id')
      .eq('change_order_id', id)
      .eq('invoice_id', invoice_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Invoice already linked to this change order' });
    }

    const { data: link, error } = await supabase
      .from('v2_change_order_invoices')
      .insert({
        change_order_id: id,
        invoice_id,
        amount: amount ? parseFloat(amount) : null,
        notes
      })
      .select(`
        id, amount, notes, created_at, invoice_id,
        invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(id, name))
      `)
      .single();

    if (error) throw error;

    await logCOActivity(id, 'invoice_linked', 'System', { invoice_id, amount });

    res.status(201).json(link);
  } catch (err) {
    console.error('Error linking invoice to CO:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unlink invoice from change order
app.delete('/api/change-orders/:id/unlink-invoice/:invoiceId', async (req, res) => {
  try {
    const { id, invoiceId } = req.params;

    const { error } = await supabase
      .from('v2_change_order_invoices')
      .delete()
      .eq('change_order_id', id)
      .eq('invoice_id', invoiceId);

    if (error) throw error;

    await logCOActivity(id, 'invoice_unlinked', 'System', { invoice_id: invoiceId });

    res.json({ success: true });
  } catch (err) {
    console.error('Error unlinking invoice from CO:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CHANGE ORDER BILLING ON DRAWS
// ============================================================

// Get COs available to bill on a draw
app.get('/api/draws/:id/available-cos', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { data: draw } = await supabase.from('v2_draws').select('job_id').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    const { data: cos, error } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .eq('status', 'approved')
      .or('client_approved_at.not.is.null,client_approval_bypassed.eq.true');

    if (error) throw error;

    const available = (cos || []).filter(co => {
      const remaining = parseFloat(co.amount) - parseFloat(co.billed_amount || 0);
      return remaining > 0.01;
    }).map(co => ({ ...co, remaining_to_bill: parseFloat(co.amount) - parseFloat(co.billed_amount || 0) }));

    res.json(available);
  } catch (err) {
    console.error('Error fetching available COs:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get CO billings for a specific draw
app.get('/api/draws/:id/co-billings', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { data: billings, error } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount, billed_amount)')
      .eq('draw_id', drawId);

    if (error) throw error;
    res.json(billings || []);
  } catch (err) {
    console.error('Error fetching CO billings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add CO billing to draw
app.post('/api/draws/:id/add-co-billing', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { change_order_id, amount, added_by } = req.body;

    if (!change_order_id || amount === undefined) return res.status(400).json({ error: 'change_order_id and amount are required' });

    const billingAmount = parseFloat(amount);
    if (billingAmount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    const { data: draw } = await supabase.from('v2_draws').select('status').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    if (draw.status !== 'draft') return res.status(400).json({ error: 'Can only add CO billings to draft draws' });

    const { data: co } = await supabase
      .from('v2_job_change_orders')
      .select('amount, billed_amount, status, client_approved_at, client_approval_bypassed')
      .eq('id', change_order_id)
      .single();

    if (!co) return res.status(404).json({ error: 'Change order not found' });
    if (co.status !== 'approved') return res.status(400).json({ error: 'Change order must be approved' });
    if (!co.client_approved_at && !co.client_approval_bypassed) return res.status(400).json({ error: 'Change order requires client approval or bypass' });

    const remaining = parseFloat(co.amount) - parseFloat(co.billed_amount || 0);
    if (billingAmount > remaining + 0.01) return res.status(400).json({ error: `Amount exceeds remaining ($${remaining.toFixed(2)})` });

    const { data: existing } = await supabase
      .from('v2_job_co_draw_billings')
      .select('id, amount')
      .eq('draw_id', drawId)
      .eq('change_order_id', change_order_id)
      .single();

    if (existing) {
      const newAmount = parseFloat(existing.amount) + billingAmount;
      const { data: billing, error } = await supabase.from('v2_job_co_draw_billings').update({ amount: newAmount }).eq('id', existing.id).select().single();
      if (error) throw error;
      await logCOActivity(change_order_id, 'billed', added_by, { draw_id: drawId, amount: billingAmount });
      await updateDrawTotal(drawId);
      return res.json(billing);
    }

    const { data: billing, error } = await supabase
      .from('v2_job_co_draw_billings')
      .insert({ change_order_id, draw_id: drawId, amount: billingAmount })
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(change_order_id, 'billed', added_by, { draw_id: drawId, amount: billingAmount });
    await updateDrawTotal(drawId);
    res.status(201).json(billing);
  } catch (err) {
    console.error('Error adding CO billing:', err);
    res.status(500).json({ error: err.message });
  }
});

// Remove CO billing from draw
app.delete('/api/draws/:id/remove-co-billing/:coId', async (req, res) => {
  try {
    const { id: drawId, coId: changeOrderId } = req.params;

    const { data: draw } = await supabase.from('v2_draws').select('status').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    if (draw.status !== 'draft') return res.status(400).json({ error: 'Can only remove CO billings from draft draws' });

    const { data: billing } = await supabase.from('v2_job_co_draw_billings').select('amount').eq('draw_id', drawId).eq('change_order_id', changeOrderId).single();
    if (!billing) return res.status(404).json({ error: 'CO billing not found on this draw' });

    const { error } = await supabase.from('v2_job_co_draw_billings').delete().eq('draw_id', drawId).eq('change_order_id', changeOrderId);
    if (error) throw error;

    await logCOActivity(changeOrderId, 'billing_removed', req.body?.removed_by, { draw_id: drawId, amount: billing.amount });
    await updateDrawTotal(drawId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing CO billing:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DRAW ATTACHMENTS ENDPOINTS
// ============================================================

// List attachments for a draw
app.get('/api/draws/:id/attachments', async (req, res) => {
  try {
    const drawId = req.params.id;

    const { data: attachments, error } = await supabase
      .from('v2_draw_attachments')
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .eq('draw_id', drawId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    res.json(attachments || []);
  } catch (err) {
    console.error('Error fetching draw attachments:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload attachment to draw
app.post('/api/draws/:id/attachments', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { file_name, file_url, file_size, attachment_type, vendor_id, notes, uploaded_by } = req.body;

    if (!file_name || !file_url) {
      return res.status(400).json({ error: 'file_name and file_url are required' });
    }

    // Get draw info
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow attachments on draft or submitted draws (not funded)
    if (['funded', 'partially_funded', 'overfunded'].includes(draw.status)) {
      return res.status(400).json({ error: 'Cannot add attachments to a funded draw' });
    }

    const { data: attachment, error } = await supabase
      .from('v2_draw_attachments')
      .insert({
        draw_id: drawId,
        file_name,
        file_url,
        file_size: file_size || null,
        attachment_type: attachment_type || 'other',
        vendor_id: vendor_id || null,
        notes: notes || null,
        uploaded_by: uploaded_by || 'System'
      })
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .single();

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'attachment_added', uploaded_by || 'System', {
      attachment_id: attachment.id,
      file_name,
      attachment_type: attachment_type || 'other'
    });

    res.json(attachment);
  } catch (err) {
    console.error('Error adding draw attachment:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete attachment from draw
app.delete('/api/draws/:id/attachments/:attachmentId', async (req, res) => {
  try {
    const { id: drawId, attachmentId } = req.params;
    const { deleted_by } = req.body || {};

    // Get draw info
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow deletion on draft or submitted draws (not funded)
    if (['funded', 'partially_funded', 'overfunded'].includes(draw.status)) {
      return res.status(400).json({ error: 'Cannot remove attachments from a funded draw' });
    }

    // Get attachment info for logging
    const { data: attachment } = await supabase
      .from('v2_draw_attachments')
      .select('file_name, attachment_type')
      .eq('id', attachmentId)
      .eq('draw_id', drawId)
      .single();

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const { error } = await supabase
      .from('v2_draw_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('draw_id', drawId);

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'attachment_removed', deleted_by || 'System', {
      attachment_id: attachmentId,
      file_name: attachment.file_name,
      attachment_type: attachment.attachment_type
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting draw attachment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DRAW ACTIVITY LOG ENDPOINT
// ============================================================

// Get activity log for a draw
app.get('/api/draws/:id/activity', async (req, res) => {
  try {
    const drawId = req.params.id;

    const { data: activities, error } = await supabase
      .from('v2_draw_activity')
      .select('*')
      .eq('draw_id', drawId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(activities || []);
  } catch (err) {
    console.error('Error fetching draw activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current draft draw for a job (or create one)
app.get('/api/jobs/:jobId/current-draw', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { create } = req.query;

    // Check if job exists
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('id, name')
      .eq('id', jobId)
      .single();

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (create === 'true') {
      // Get or create draft draw
      const draw = await getOrCreateDraftDraw(jobId, 'API');
      return res.json(draw);
    }

    // Just look for existing draft
    const { data: draftDraw } = await supabase
      .from('v2_draws')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .single();

    res.json(draftDraw || null);
  } catch (err) {
    console.error('Error getting current draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: Update draw total amount (invoices + CO billings)
// Now uses v2_draw_allocations for invoice amounts
async function updateDrawTotal(drawId) {
  try {
    // Get allocations from the new draw_allocations table
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId);

    const invoiceTotal = (drawAllocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Get CO billings
    const { data: coBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('amount')
      .eq('draw_id', drawId);

    const coTotal = (coBillings || []).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    await supabase.from('v2_draws').update({ total_amount: invoiceTotal + coTotal }).eq('id', drawId);
  } catch (err) {
    console.error('Error updating draw total:', err);
  }
}

// Helper: Get or create draft draw for a job
// Returns the draft draw, creating one if it doesn't exist
async function getOrCreateDraftDraw(jobId, createdBy = 'System') {
  try {
    // Try to find existing draft draw for this job
    const { data: existingDraft } = await supabase
      .from('v2_draws')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .single();

    if (existingDraft) {
      return existingDraft;
    }

    // No draft exists, create a new one
    // Get next draw number for this job
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('job_id', jobId)
      .order('draw_number', { ascending: false })
      .limit(1);

    const nextNumber = (draws?.[0]?.draw_number || 0) + 1;

    // Create new draft draw
    const { data: newDraw, error } = await supabase
      .from('v2_draws')
      .insert({
        job_id: jobId,
        draw_number: nextNumber,
        status: 'draft',
        total_amount: 0
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logDrawActivity(newDraw.id, 'created', createdBy, { auto_created: true });

    console.log(`[DRAW] Auto-created Draw #${nextNumber} for job ${jobId}`);
    return newDraw;
  } catch (err) {
    console.error('Error getting/creating draft draw:', err);
    throw err;
  }
}

// Helper: Log draw activity
async function logDrawActivity(drawId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_draw_activity').insert({
      draw_id: drawId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Error logging draw activity:', err);
  }
}

// Helper: Add invoice to draw (creates draw_allocations from invoice_allocations)
async function addInvoiceToDraw(invoiceId, drawId, performedBy = 'System') {
  try {
    // Get invoice allocations
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select('cost_code_id, amount, notes')
      .eq('invoice_id', invoiceId);

    if (!allocations || allocations.length === 0) {
      throw new Error('Invoice has no allocations');
    }

    // Link invoice to draw
    const { error: linkError } = await supabase
      .from('v2_draw_invoices')
      .insert({ draw_id: drawId, invoice_id: invoiceId });

    if (linkError && !linkError.message?.includes('duplicate')) {
      throw linkError;
    }

    // Create draw_allocations (copy from invoice_allocations)
    for (const alloc of allocations) {
      const { error: allocError } = await supabase
        .from('v2_draw_allocations')
        .upsert({
          draw_id: drawId,
          invoice_id: invoiceId,
          cost_code_id: alloc.cost_code_id,
          amount: alloc.amount,
          notes: alloc.notes,
          created_by: performedBy
        }, { onConflict: 'draw_id,invoice_id,cost_code_id' });

      if (allocError) {
        console.error('Error creating draw allocation:', allocError);
      }
    }

    // Update draw total
    await updateDrawTotal(drawId);

    // Log activity
    const totalAmount = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    await logDrawActivity(drawId, 'invoice_added', performedBy, {
      invoice_id: invoiceId,
      amount: totalAmount
    });

    return true;
  } catch (err) {
    console.error('Error adding invoice to draw:', err);
    throw err;
  }
}

// Helper: Remove invoice from draw
async function removeInvoiceFromDraw(invoiceId, drawId, performedBy = 'System') {
  try {
    // Get the amount being removed for logging
    const { data: allocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    const totalAmount = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Remove draw_allocations
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    // Remove from draw_invoices
    await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    // Update draw total
    await updateDrawTotal(drawId);

    // Log activity
    await logDrawActivity(drawId, 'invoice_removed', performedBy, {
      invoice_id: invoiceId,
      amount: totalAmount
    });

    return true;
  } catch (err) {
    console.error('Error removing invoice from draw:', err);
    throw err;
  }
}

// ============================================================

// Export Draw as Excel (G702/G703/PCCO)
app.get('/api/draws/:id/export/excel', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Get draw with full data
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`*, job:v2_jobs(id, name, address, client_name, contract_amount)`)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    // Get invoices in this draw
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          id, invoice_number, invoice_date, amount,
          vendor:v2_vendors(name),
          allocations:v2_invoice_allocations(amount, po_line_item_id, cost_code:v2_cost_codes(id, code, name))
        )
      `)
      .eq('draw_id', drawId);

    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];

    // Get budget lines for scheduled values
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select(`*, cost_code:v2_cost_codes(id, code, name)`)
      .eq('job_id', draw.job_id);

    // Get previous draws' allocations
    const { data: previousDraws } = await supabase
      .from('v2_draws')
      .select('id')
      .eq('job_id', draw.job_id)
      .lt('draw_number', draw.draw_number);

    let previousByCode = {};
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`invoice:v2_invoices(allocations:v2_invoice_allocations(amount, cost_code_id, po_line_item_id))`)
        .in('draw_id', prevDrawIds);

      prevInvoices?.forEach(di => {
        di.invoice?.allocations?.forEach(alloc => {
          previousByCode[alloc.cost_code_id] = (previousByCode[alloc.cost_code_id] || 0) + parseFloat(alloc.amount || 0);
        });
      });
    }

    // Calculate this period by cost code
    let thisPeriodByCode = {};
    invoices.forEach(inv => {
      inv.allocations?.forEach(alloc => {
        const codeId = alloc.cost_code?.id;
        if (codeId) {
          thisPeriodByCode[codeId] = (thisPeriodByCode[codeId] || 0) + parseFloat(alloc.amount || 0);
        }
      });
    });

    // Get job change orders (approved ones billable to client)
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .in('status', ['approved'])
      .order('change_order_number');

    // Get CO billings for this draw
    const { data: coBillingsThisDraw } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount)')
      .eq('draw_id', drawId);

    // Get previous draws' CO billings
    let previousCOBillings = {};
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevCOBillings } = await supabase
        .from('v2_job_co_draw_billings')
        .select('change_order_id, amount')
        .in('draw_id', prevDrawIds);

      prevCOBillings?.forEach(b => {
        previousCOBillings[b.change_order_id] = (previousCOBillings[b.change_order_id] || 0) + parseFloat(b.amount || 0);
      });
    }

    // Calculate CO totals
    const approvedCOTotal = (jobChangeOrders || [])
      .filter(co => co.client_approved_at || co.client_approval_bypassed)
      .reduce((sum, co) => sum + parseFloat(co.amount || 0), 0);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ross Built CMS';
    workbook.created = new Date();

    // ========== G702 Sheet ==========
    const g702 = workbook.addWorksheet('G702');
    g702.columns = [
      { width: 5 }, { width: 50 }, { width: 20 }
    ];

    // Header
    g702.addRow(['', 'AIA DOCUMENT G702 - APPLICATION AND CERTIFICATE FOR PAYMENT', '']);
    g702.addRow(['']);
    g702.addRow(['', `TO OWNER: ${draw.job?.client_name || '-'}`, `APPLICATION NO: ${draw.draw_number}`]);
    g702.addRow(['', `PROJECT: ${draw.job?.name || '-'}`, `PERIOD TO: ${draw.period_end || '-'}`]);
    g702.addRow(['', 'FROM CONTRACTOR: Ross Built Custom Homes', '']);
    g702.addRow(['']);

    const contractSum = parseFloat(draw.job?.contract_amount) || 0;
    const changeOrders = approvedCOTotal;
    const contractSumToDate = contractSum + changeOrders;

    // Build G703 data for calculations
    const g703Data = (budgetLines || []).map((bl, idx) => {
      const codeId = bl.cost_code?.id;
      const scheduled = parseFloat(bl.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const total = previous + thisPeriod;
      return { scheduled, previous, thisPeriod, total, balance: scheduled - total };
    });

    const totals = g703Data.reduce((acc, item) => ({
      scheduled: acc.scheduled + item.scheduled,
      previous: acc.previous + item.previous,
      thisPeriod: acc.thisPeriod + item.thisPeriod,
      total: acc.total + item.total
    }), { scheduled: 0, previous: 0, thisPeriod: 0, total: 0 });

    const previousCertificates = totals.previous;
    const currentPaymentDue = totals.thisPeriod;
    const balanceToFinish = contractSumToDate - totals.total;

    g702.addRow(['1.', 'ORIGINAL CONTRACT SUM', formatCurrency(contractSum)]);
    g702.addRow(['2.', 'Net change by Change Orders', formatCurrency(changeOrders)]);
    g702.addRow(['3.', 'CONTRACT SUM TO DATE (Line 1 + 2)', formatCurrency(contractSumToDate)]);
    g702.addRow(['4.', 'TOTAL COMPLETED & STORED TO DATE', formatCurrency(totals.total)]);
    g702.addRow(['5.', 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', formatCurrency(previousCertificates)]);
    g702.addRow(['6.', 'CURRENT PAYMENT DUE', formatCurrency(currentPaymentDue)]);
    g702.addRow(['7.', 'BALANCE TO FINISH', formatCurrency(balanceToFinish)]);

    // Style G702
    g702.getRow(1).font = { bold: true, size: 14 };
    g702.getRow(15).font = { bold: true };
    g702.getColumn(3).numFmt = '$#,##0.00';

    // ========== G703 Sheet ==========
    const g703 = workbook.addWorksheet('G703');
    g703.columns = [
      { header: 'Item', width: 6 },
      { header: 'Description of Work', width: 35 },
      { header: 'Scheduled Value', width: 15 },
      { header: 'Previous', width: 15 },
      { header: 'This Period', width: 15 },
      { header: 'Materials', width: 12 },
      { header: 'Total', width: 15 },
      { header: '%', width: 8 },
      { header: 'Balance', width: 15 }
    ];

    // Add header row
    g703.addRow(['A', 'B', 'C', 'D (Previous)', 'D (This Period)', 'E', 'F', 'G', 'H']);
    g703.getRow(1).font = { bold: true };
    g703.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Add data rows
    (budgetLines || []).forEach((bl, idx) => {
      const codeId = bl.cost_code?.id;
      const scheduled = parseFloat(bl.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const materials = 0;
      const total = previous + thisPeriod + materials;
      const percent = scheduled > 0 ? (total / scheduled) : 0;
      const balance = scheduled - total;

      if (scheduled > 0 || thisPeriod > 0) {
        g703.addRow([
          idx + 1,
          `${bl.cost_code?.code} - ${bl.cost_code?.name}`,
          scheduled,
          previous,
          thisPeriod,
          materials,
          total,
          percent,
          balance
        ]);
      }
    });

    // Add totals row
    const totalsRow = g703.addRow([
      '', 'GRAND TOTAL',
      totals.scheduled, totals.previous, totals.thisPeriod, 0, totals.total,
      totals.scheduled > 0 ? totals.total / totals.scheduled : 0,
      totals.scheduled - totals.total
    ]);
    totalsRow.font = { bold: true };
    totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Format currency columns
    [3, 4, 5, 6, 7, 9].forEach(col => {
      g703.getColumn(col).numFmt = '$#,##0.00';
    });
    g703.getColumn(8).numFmt = '0.0%';

    // ========== PCCO Sheet (Change Orders) ==========
    const pcco = workbook.addWorksheet('PCCO');
    pcco.columns = [
      { header: 'CO #', width: 8 },
      { header: 'Title', width: 30 },
      { header: 'Description', width: 40 },
      { header: 'Reason', width: 15 },
      { header: 'Amount', width: 15 },
      { header: 'Status', width: 15 },
      { header: 'Previous Billed', width: 15 },
      { header: 'This Period', width: 15 },
      { header: 'Total Billed', width: 15 },
      { header: 'Balance', width: 15 }
    ];

    pcco.addRow(['CHANGE ORDER LOG']);
    pcco.mergeCells('A1:J1');
    pcco.getRow(1).font = { bold: true, size: 14 };
    pcco.addRow(['']);

    // Header row
    const headerRow = pcco.addRow(['CO #', 'Title', 'Description', 'Reason', 'Amount', 'Status', 'Previous Billed', 'This Period', 'Total Billed', 'Balance']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Build CO billing map for this draw
    const thisDrawCOBillings = {};
    (coBillingsThisDraw || []).forEach(b => {
      thisDrawCOBillings[b.change_order_id] = parseFloat(b.amount || 0);
    });

    if (!jobChangeOrders || jobChangeOrders.length === 0) {
      pcco.addRow(['', 'No change orders for this job.', '', '', '', '', '', '', '', '']);
    } else {
      (jobChangeOrders || []).forEach(co => {
        const coAmount = parseFloat(co.amount) || 0;
        const previousBilled = previousCOBillings[co.id] || 0;
        const thisPeriod = thisDrawCOBillings[co.id] || 0;
        const totalBilled = previousBilled + thisPeriod;
        const balance = coAmount - totalBilled;

        let status = co.status;
        if (co.client_approved_at) status = 'Client Approved';
        else if (co.client_approval_bypassed) status = 'Bypassed';

        pcco.addRow([
          `CO-${String(co.change_order_number).padStart(3, '0')}`,
          co.title || '',
          co.description || '',
          co.reason || '',
          coAmount,
          status,
          previousBilled,
          thisPeriod,
          totalBilled,
          balance
        ]);
      });

      // Totals row
      const coTotals = (jobChangeOrders || []).reduce((acc, co) => {
        const coAmount = parseFloat(co.amount) || 0;
        const previousBilled = previousCOBillings[co.id] || 0;
        const thisPeriod = thisDrawCOBillings[co.id] || 0;
        return {
          amount: acc.amount + coAmount,
          previous: acc.previous + previousBilled,
          thisPeriod: acc.thisPeriod + thisPeriod,
          total: acc.total + previousBilled + thisPeriod
        };
      }, { amount: 0, previous: 0, thisPeriod: 0, total: 0 });

      const coTotalsRow = pcco.addRow([
        '', 'TOTALS', '', '', coTotals.amount, '',
        coTotals.previous, coTotals.thisPeriod, coTotals.total,
        coTotals.amount - coTotals.total
      ]);
      coTotalsRow.font = { bold: true };
      coTotalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    }

    // Format currency columns
    [5, 7, 8, 9, 10].forEach(col => {
      pcco.getColumn(col).numFmt = '$#,##0.00';
    });

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Draw_${draw.draw_number}_${draw.job?.name?.replace(/\s+/g, '_') || 'Job'}_G702_G703.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting Excel:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function for currency formatting
function formatCurrency(amount) {
  return parseFloat(amount) || 0;
}

// Helper to format money for PDF (with $ and commas)
function formatMoneyPDF(amount) {
  const num = parseFloat(amount) || 0;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Export Draw as PDF (G702/G703 + Invoice PDFs)
app.get('/api/draws/:id/export/pdf', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Get draw info with job details
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`*, job:v2_jobs(id, name, client_name, address, contract_amount)`)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    const jobId = draw.job_id;

    // Get invoices with allocations and stamped PDFs
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`invoice:v2_invoices(id, invoice_number, amount, pdf_stamped_url, vendor:v2_vendors(name), allocations:v2_invoice_allocations(cost_code_id, amount))`)
      .eq('draw_id', drawId);

    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];

    // Get budget lines for G703
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select(`*, cost_code:v2_cost_codes(id, code, name)`)
      .eq('job_id', jobId)
      .order('cost_code(code)');

    // Get all draws for this job to calculate previous billings
    const { data: allDraws } = await supabase
      .from('v2_draws')
      .select(`id, draw_number, total_amount, status`)
      .eq('job_id', jobId)
      .order('draw_number');

    // Get all invoice allocations for previous draws
    const previousDrawIds = allDraws?.filter(d => d.draw_number < draw.draw_number).map(d => d.id) || [];
    let previousAllocations = [];
    if (previousDrawIds.length > 0) {
      const { data: prevDrawInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`invoice:v2_invoices(allocations:v2_invoice_allocations(cost_code_id, amount))`)
        .in('draw_id', previousDrawIds);
      previousAllocations = prevDrawInvoices?.flatMap(di => di.invoice?.allocations || []) || [];
    }

    // Get job change orders (PCCOs) for net change calculation
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('amount, status')
      .eq('job_id', jobId)
      .eq('status', 'approved');

    // Calculate G702 values
    const contractAmount = parseFloat(draw.job?.contract_amount) || 0;
    const netChangeOrders = jobChangeOrders?.reduce((sum, co) => sum + (parseFloat(co.amount) || 0), 0) || 0;
    const contractSumToDate = contractAmount + netChangeOrders;

    // Use override values if set
    const originalContractSum = draw.g702_original_contract_override != null
      ? parseFloat(draw.g702_original_contract_override)
      : contractAmount;
    const changeOrdersAmount = draw.g702_change_orders_override != null
      ? parseFloat(draw.g702_change_orders_override)
      : netChangeOrders;

    // Calculate previous completed amounts
    const previousCompleted = previousDrawIds.length > 0
      ? allDraws.filter(d => d.draw_number < draw.draw_number).reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
      : 0;

    const thisDrawAmount = parseFloat(draw.total_amount) || 0;
    const totalCompletedToDate = previousCompleted + thisDrawAmount;
    const lessPreviousCertificates = previousCompleted;
    const currentPaymentDue = thisDrawAmount;
    const balanceToFinish = (originalContractSum + changeOrdersAmount) - totalCompletedToDate;

    // Build G703 data by cost code
    const g703Data = [];
    const costCodeMap = new Map();

    // Sum up allocations by cost code for current draw
    const currentAllocations = invoices.flatMap(inv => inv.allocations || []);
    currentAllocations.forEach(alloc => {
      const existing = costCodeMap.get(alloc.cost_code_id) || { current: 0 };
      existing.current += parseFloat(alloc.amount) || 0;
      costCodeMap.set(alloc.cost_code_id, existing);
    });

    // Sum up previous allocations by cost code
    previousAllocations.forEach(alloc => {
      const existing = costCodeMap.get(alloc.cost_code_id) || { current: 0 };
      existing.previous = (existing.previous || 0) + (parseFloat(alloc.amount) || 0);
      costCodeMap.set(alloc.cost_code_id, existing);
    });

    // Build G703 rows from budget lines (only include rows with budget or billings)
    let itemNum = 1;
    budgetLines?.forEach(bl => {
      const ccId = bl.cost_code_id;
      const allocData = costCodeMap.get(ccId) || { current: 0, previous: 0 };
      const scheduledValue = parseFloat(bl.budgeted_amount) || 0;
      const previousBillings = allocData.previous || 0;
      const currentBillings = allocData.current || 0;
      const totalBilled = previousBillings + currentBillings;

      // Skip rows with no budget and no billings
      if (scheduledValue === 0 && totalBilled === 0) return;

      const percentComplete = scheduledValue > 0 ? (totalBilled / scheduledValue) * 100 : 0;
      const balance = scheduledValue - totalBilled;

      g703Data.push({
        itemNum: itemNum++,
        costCode: bl.cost_code?.code || '',
        description: bl.cost_code?.name || '',
        scheduledValue,
        previousBillings,
        currentBillings,
        materialsStored: 0,
        totalBilled,
        percentComplete,
        balance
      });
    });

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();

    // ============ G702 PAGE (Portrait) ============
    const g702Page = mergedPdf.addPage([612, 792]); // Letter size portrait
    const g702Height = g702Page.getHeight();
    let y = g702Height - 40;

    // Header
    g702Page.drawText('AIA DOCUMENT G702 - APPLICATION AND CERTIFICATE FOR PAYMENT', { x: 50, y, size: 11 });
    y -= 25;

    g702Page.drawText('TO OWNER:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.client_name || '-', { x: 120, y, size: 9 });
    y -= 15;

    g702Page.drawText('PROJECT:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.name || '-', { x: 120, y, size: 9 });
    y -= 15;

    g702Page.drawText('ADDRESS:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.address || '-', { x: 120, y, size: 9 });

    // Right side header
    g702Page.drawText('APPLICATION NO:', { x: 380, y: g702Height - 65, size: 9 });
    g702Page.drawText(String(draw.draw_number), { x: 480, y: g702Height - 65, size: 9 });
    g702Page.drawText('PERIOD TO:', { x: 380, y: g702Height - 80, size: 9 });
    g702Page.drawText(draw.period_end || '-', { x: 480, y: g702Height - 80, size: 9 });

    y -= 30;
    g702Page.drawText('FROM CONTRACTOR:', { x: 50, y, size: 9 });
    g702Page.drawText('Ross Built Custom Homes', { x: 160, y, size: 9 });

    // G702 Line Items Table
    y -= 40;
    const tableStartY = y;
    const lineHeight = 22;

    const g702Lines = [
      { num: '1.', label: 'ORIGINAL CONTRACT SUM', value: formatMoneyPDF(originalContractSum) },
      { num: '2.', label: 'Net change by Change Orders', value: formatMoneyPDF(changeOrdersAmount) },
      { num: '3.', label: 'CONTRACT SUM TO DATE (Line 1 + 2)', value: formatMoneyPDF(originalContractSum + changeOrdersAmount) },
      { num: '4.', label: 'TOTAL COMPLETED & STORED TO DATE (Column G on G703)', value: formatMoneyPDF(totalCompletedToDate) },
      { num: '5.', label: 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', value: formatMoneyPDF(lessPreviousCertificates) },
      { num: '6.', label: 'CURRENT PAYMENT DUE', value: formatMoneyPDF(currentPaymentDue) },
      { num: '7.', label: 'BALANCE TO FINISH (Line 3 less Line 4)', value: formatMoneyPDF(balanceToFinish) },
    ];

    g702Lines.forEach((line, idx) => {
      const lineY = tableStartY - (idx * lineHeight);
      g702Page.drawText(line.num, { x: 50, y: lineY, size: 10 });
      g702Page.drawText(line.label, { x: 75, y: lineY, size: 10 });
      g702Page.drawText(line.value, { x: 480, y: lineY, size: 10 });
    });

    // Notes section if present
    if (draw.notes) {
      y = tableStartY - (g702Lines.length * lineHeight) - 30;
      g702Page.drawText('NOTES:', { x: 50, y, size: 9 });
      y -= 15;
      // Truncate long notes
      const notesText = draw.notes.length > 200 ? draw.notes.substring(0, 200) + '...' : draw.notes;
      g702Page.drawText(notesText, { x: 50, y, size: 9 });
    }

    // Footer
    g702Page.drawText('Generated by Ross Built CMS', { x: 50, y: 50, size: 8 });
    g702Page.drawText(new Date().toLocaleDateString(), { x: 50, y: 38, size: 8 });

    // ============ G703 PAGES (Landscape, multi-page support) ============
    const colX = [30, 55, 130, 220, 300, 380, 460, 540, 610, 680];
    const headers = ['#', 'Code', 'Description', 'Scheduled', 'Previous', 'This Period', 'Materials', 'Total', '%', 'Balance'];
    const rowHeight = 14;
    const g703Width = 792;
    const g703Height = 612;
    let grandTotals = { scheduled: 0, previous: 0, current: 0, materials: 0, total: 0, balance: 0 };

    // Helper function to create a new G703 page with headers
    function createG703Page(pageNum) {
      const page = mergedPdf.addPage([792, 612]); // Letter size landscape
      // Header
      page.drawText('AIA DOCUMENT G703 - CONTINUATION SHEET (SCHEDULE OF VALUES)', { x: 50, y: g703Height - 30, size: 11 });
      page.drawText(`Application #${draw.draw_number}`, { x: 50, y: g703Height - 45, size: 9 });
      page.drawText(`Period To: ${draw.period_end || '-'}`, { x: 200, y: g703Height - 45, size: 9 });
      page.drawText(`Project: ${draw.job?.name || '-'}`, { x: 400, y: g703Height - 45, size: 9 });
      if (pageNum > 1) {
        page.drawText(`(Page ${pageNum})`, { x: 700, y: g703Height - 30, size: 9 });
      }
      // Table headers
      const headerY = g703Height - 70;
      headers.forEach((h, i) => {
        page.drawText(h, { x: colX[i], y: headerY, size: 8 });
      });
      // Line under headers
      page.drawLine({
        start: { x: 25, y: headerY - 5 },
        end: { x: g703Width - 25, y: headerY - 5 },
        thickness: 0.5
      });
      return { page, rowY: headerY - 20 };
    }

    // Create first G703 page
    let g703PageNum = 1;
    let { page: currentG703Page, rowY } = createG703Page(g703PageNum);

    // Render all rows with pagination
    g703Data.forEach((row, idx) => {
      // Check if we need a new page
      if (rowY < 60) {
        // Add footer to current page
        currentG703Page.drawText('Generated by Ross Built CMS', { x: 50, y: 25, size: 8 });
        currentG703Page.drawText('(continued)', { x: g703Width - 100, y: 25, size: 8 });
        // Create new page
        g703PageNum++;
        const newPage = createG703Page(g703PageNum);
        currentG703Page = newPage.page;
        rowY = newPage.rowY;
      }

      currentG703Page.drawText(String(row.itemNum), { x: colX[0], y: rowY, size: 7 });
      currentG703Page.drawText(row.costCode.substring(0, 8), { x: colX[1], y: rowY, size: 7 });
      currentG703Page.drawText(row.description.substring(0, 15), { x: colX[2], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.scheduledValue).substring(0, 12), { x: colX[3], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.previousBillings).substring(0, 12), { x: colX[4], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.currentBillings).substring(0, 12), { x: colX[5], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.materialsStored).substring(0, 10), { x: colX[6], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.totalBilled).substring(0, 12), { x: colX[7], y: rowY, size: 7 });
      currentG703Page.drawText(row.percentComplete.toFixed(0) + '%', { x: colX[8], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.balance).substring(0, 12), { x: colX[9], y: rowY, size: 7 });

      grandTotals.scheduled += row.scheduledValue;
      grandTotals.previous += row.previousBillings;
      grandTotals.current += row.currentBillings;
      grandTotals.total += row.totalBilled;
      grandTotals.balance += row.balance;

      rowY -= rowHeight;
    });

    // Grand totals row on last page
    rowY -= 5;
    currentG703Page.drawLine({
      start: { x: 25, y: rowY + 10 },
      end: { x: g703Width - 25, y: rowY + 10 },
      thickness: 0.5
    });

    currentG703Page.drawText('GRAND TOTAL', { x: colX[2], y: rowY, size: 8 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.scheduled).substring(0, 12), { x: colX[3], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.previous).substring(0, 12), { x: colX[4], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.current).substring(0, 12), { x: colX[5], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.total).substring(0, 12), { x: colX[7], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.balance).substring(0, 12), { x: colX[9], y: rowY, size: 7 });

    // Footer on last page
    currentG703Page.drawText('Generated by Ross Built CMS', { x: 50, y: 25, size: 8 });
    currentG703Page.drawText(new Date().toLocaleDateString(), { x: g703Width - 100, y: 25, size: 8 });

    // ============ INVOICE COVER PAGE ============
    if (invoices.length > 0) {
      const invoiceCoverPage = mergedPdf.addPage([612, 792]);
      const icHeight = invoiceCoverPage.getHeight();

      invoiceCoverPage.drawText('ATTACHED INVOICES', { x: 50, y: icHeight - 60, size: 18 });
      invoiceCoverPage.drawText(`Draw #${draw.draw_number} - ${draw.job?.name || ''}`, { x: 50, y: icHeight - 85, size: 12 });

      let listY = icHeight - 130;
      invoices.forEach((inv, idx) => {
        if (listY < 80) return;
        const amount = parseFloat(inv.amount) || 0;
        invoiceCoverPage.drawText(
          `${idx + 1}. ${inv.vendor?.name || 'Unknown'} - Invoice #${inv.invoice_number || 'N/A'} - ${formatMoneyPDF(amount)}`,
          { x: 60, y: listY, size: 10 }
        );
        listY -= 20;
      });

      invoiceCoverPage.drawText('Generated by Ross Built CMS', { x: 50, y: 40, size: 8 });
    }

    // ============ APPEND INVOICE PDFs ============
    for (const inv of invoices) {
      if (inv.pdf_stamped_url) {
        try {
          const urlParts = inv.pdf_stamped_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
            const pdfBuffer = await downloadPDF(storagePath);
            const invoicePdf = await PDFDocument.load(pdfBuffer);
            const pages = await mergedPdf.copyPages(invoicePdf, invoicePdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
          }
        } catch (pdfErr) {
          console.error(`Failed to fetch PDF for invoice ${inv.id}:`, pdfErr.message);
        }
      }
    }

    const pdfBytes = await mergedPdf.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Draw_${draw.draw_number}_${draw.job?.name?.replace(/\s+/g, '_') || 'Job'}_G702_G703.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Error exporting PDF:', err);
    res.status(500).json({ error: err.message });
  }
});

// Job-specific stats
app.get('/api/jobs/:id/stats', async (req, res) => {
  try {
    const jobId = req.params.id;

    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('status, amount')
      .eq('job_id', jobId);

    const stats = {
      received: { count: 0, amount: 0 },
      needs_approval: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      in_draw: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 }
    };

    if (invoices) {
      invoices.forEach(inv => {
        if (stats[inv.status]) {
          stats[inv.status].count++;
          stats[inv.status].amount += parseFloat(inv.amount) || 0;
        }
      });
    }

    const { data: draws } = await supabase
      .from('v2_draws')
      .select('status, total_amount')
      .eq('job_id', jobId);

    const drawStats = {
      draft: { count: 0, amount: 0 },
      submitted: { count: 0, amount: 0 },
      funded: { count: 0, amount: 0 }
    };

    if (draws) {
      draws.forEach(d => {
        // Group partially_funded and overfunded with funded for stats
        const statCategory = ['partially_funded', 'overfunded'].includes(d.status) ? 'funded' : d.status;
        if (drawStats[statCategory]) {
          drawStats[statCategory].count++;
          drawStats[statCategory].amount += parseFloat(d.total_amount) || 0;
        }
      });
    }

    res.json({ invoices: stats, draws: drawStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// INVOICE EDITING ENDPOINTS
// ============================================================

// Partial update (PATCH)
app.patch('/api/invoices/:id', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const updates = req.body;
  const performedBy = updates.performed_by || 'System';
  delete updates.performed_by;

  // Check if invoice exists
  const { data: existing, error: getError } = await supabase
    .from('v2_invoices')
    .select('*, allocations:v2_invoice_allocations(*)')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (getError || !existing) {
    throw notFoundError('invoice', invoiceId);
  }

  // Check if invoice is archived (read-only) - allow status changes to unarchive
  const archivedStatuses = ['paid'];
  const allowedUnarchiveStatuses = ['approved', 'needs_approval', 'in_draw', 'received'];
  if (archivedStatuses.includes(existing.status) && !allowedUnarchiveStatuses.includes(updates.status)) {
    throw new AppError('ARCHIVED_INVOICE', `Cannot edit archived invoice (status: ${existing.status})`, { status: 400 });
  }

  // Check lock
  const lockStatus = await checkLock('invoice', invoiceId);
  if (lockStatus.isLocked && lockStatus.lock.lockedBy !== performedBy) {
    throw lockedError(lockStatus.lock.lockedBy, lockStatus.lock.expiresAt);
  }

  // Version check if provided
  if (updates.expected_version && updates.expected_version !== existing.version) {
    throw versionConflictError(updates.expected_version, existing.version, existing);
  }
  delete updates.expected_version;

  // Validate partial update
  const validation = validateInvoice(updates, true);
  if (!validation.valid) {
    throw validationError(validation.errors);
  }

  // Check for duplicate if changing invoice_number or vendor_id
  if (updates.invoice_number || updates.vendor_id) {
    const dupCheck = await checkDuplicate(
      updates.vendor_id || existing.vendor_id,
      updates.invoice_number || existing.invoice_number,
      updates.amount || existing.amount,
      invoiceId
    );
    if (dupCheck.isDuplicate) {
      throw new AppError('DUPLICATE_INVOICE', dupCheck.message, { existingInvoice: dupCheck.existingInvoice });
    }
  }

  // If amount is changing, check that existing allocations would still balance
  if (updates.amount && parseFloat(updates.amount) !== parseFloat(existing.amount)) {
    const existingAllocs = existing.allocations || [];
    if (existingAllocs.length > 0) {
      const allocTotal = existingAllocs.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      const newAmount = parseFloat(updates.amount);
      if (Math.abs(allocTotal - newAmount) > 0.01) {
        throw validationError([{
          field: 'amount',
          message: `Cannot change amount: existing allocations total $${allocTotal.toFixed(2)} would not match new amount $${newAmount.toFixed(2)}. Update allocations first.`
        }]);
      }
    }
  }

  // Create undo snapshot
  await createUndoSnapshot('invoice', invoiceId, 'edited', existing, performedBy);

  // Build update object
  const updateFields = {};
  const editableFields = ['invoice_number', 'invoice_date', 'due_date', 'amount', 'job_id', 'vendor_id', 'po_id', 'notes', 'status', 'paid_to_vendor', 'paid_to_vendor_date', 'paid_to_vendor_ref', 'needs_review', 'review_flags'];
  for (const field of editableFields) {
    if (updates.hasOwnProperty(field)) {
      updateFields[field] = updates[field];
    }
  }

  // Append partial approval note to invoice notes
  if (updates.partial_approval_note) {
    const existingNotes = existing.notes || '';
    const separator = existingNotes ? '\n\n' : '';
    updateFields.notes = existingNotes + separator + updates.partial_approval_note;
  }

  // Handle status transitions with proper timestamp updates
  if (updates.status && updates.status !== existing.status) {
    // Validate transition is allowed
    const transitionCheck = validateStatusTransition(existing.status, updates.status);
    if (!transitionCheck.valid) {
      throw new AppError('TRANSITION_NOT_ALLOWED', transitionCheck.error);
    }

    // For approval, run pre-transition checks (including PO overage)
    // Skip pre-transition checks when removing from draw (in_draw → approved is a rollback)
    if (updates.status === 'approved' && existing.status !== 'in_draw') {
      const allocsToUse = updates.allocations || existing.allocations || [];
      const preCheck = await validatePreTransition(existing, 'approved', {
        allocations: allocsToUse,
        overridePoOverage: updates.overridePoOverage
      });

      if (!preCheck.valid) {
        // Check if it's a PO overage that requires override
        const poError = preCheck.errors.find(e => e.type === 'PO_OVERAGE');
        if (poError) {
          return res.status(400).json({
            success: false,
            error: 'PO_OVERAGE',
            message: poError.message,
            poRemaining: poError.poRemaining,
            invoiceAmount: poError.invoiceAmount,
            overageAmount: poError.overageAmount,
            requiresOverride: true
          });
        }
        throw new AppError('PRE_TRANSITION_FAILED', preCheck.errors[0]?.message || 'Pre-transition requirements not met', { errors: preCheck.errors });
      }
    }

    const statusTransitions = {
      // Unapprove: approved → needs_approval (clear approval)
      'approved_to_needs_approval': () => {
        updateFields.approved_at = null;
        updateFields.approved_by = null;
      },
      // Remove from draw: in_draw → approved
      'in_draw_to_approved': () => {
        // Keep approval info
      },
      // Resubmit denied: denied → received (clear denial)
      'denied_to_received': () => {
        updateFields.denied_at = null;
        updateFields.denied_by = null;
        updateFields.denial_reason = null;
      },
      // Submit: received → needs_approval
      'received_to_needs_approval': () => {
        updateFields.coded_at = new Date().toISOString();
        updateFields.coded_by = performedBy;
      },
      // Approve: needs_approval → approved (stamping handled below)
      'needs_approval_to_approved': () => {
        updateFields.approved_at = new Date().toISOString();
        updateFields.approved_by = performedBy;
      },
      // Deny: any → denied
      'to_denied': () => {
        updateFields.denied_at = new Date().toISOString();
        updateFields.denied_by = performedBy;
        if (updates.denial_reason) {
          updateFields.denial_reason = updates.denial_reason;
        }
      }
    };

    const transitionKey = `${existing.status}_to_${updates.status}`;
    if (statusTransitions[transitionKey]) {
      statusTransitions[transitionKey]();
    } else if (updates.status === 'denied') {
      statusTransitions['to_denied']();
    }

    // Handle removing invoice from draw when transitioning from in_draw to approved
    if (existing.status === 'in_draw' && updates.status === 'approved') {
      // Find and delete the draw_invoice record
      const { data: drawInvoice } = await supabase
        .from('v2_draw_invoices')
        .select('draw_id, draw:v2_draws(draw_number)')
        .eq('invoice_id', invoiceId)
        .single();

      if (drawInvoice) {
        await supabase
          .from('v2_draw_invoices')
          .delete()
          .eq('invoice_id', invoiceId);

        // Update draw total
        const { data: remainingInvoices } = await supabase
          .from('v2_draw_invoices')
          .select('invoice:v2_invoices(amount)')
          .eq('draw_id', drawInvoice.draw_id);

        const newTotal = remainingInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
        await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', drawInvoice.draw_id);

        // Log removed from draw activity
        await logActivity(invoiceId, 'removed_from_draw', performedBy, {
          draw_number: drawInvoice.draw?.draw_number
        });
      }
    }

    // Handle adding invoice to draw when transitioning TO in_draw
    if (updates.status === 'in_draw' && existing.status === 'approved') {
      // Find or create a draft draw for this job
      let drawId;
      let drawNumber;

      // First, look for an existing draft draw for this job
      const { data: existingDraw } = await supabase
        .from('v2_draws')
        .select('id, draw_number')
        .eq('job_id', existing.job_id)
        .eq('status', 'draft')
        .single();

      if (existingDraw) {
        drawId = existingDraw.id;
        drawNumber = existingDraw.draw_number;
      } else {
        // Create a new draft draw for this job
        // Get the next draw number
        const { data: lastDraw } = await supabase
          .from('v2_draws')
          .select('draw_number')
          .eq('job_id', existing.job_id)
          .order('draw_number', { ascending: false })
          .limit(1)
          .single();

        drawNumber = (lastDraw?.draw_number || 0) + 1;

        const { data: newDraw, error: createDrawError } = await supabase
          .from('v2_draws')
          .insert({
            job_id: existing.job_id,
            draw_number: drawNumber,
            status: 'draft',
            total_amount: 0
          })
          .select()
          .single();

        if (createDrawError) {
          console.error('Failed to create draw:', createDrawError);
          throw new Error('Failed to create draw for invoice');
        }

        drawId = newDraw.id;
      }

      // Add invoice to draw_invoices
      const { error: linkError } = await supabase
        .from('v2_draw_invoices')
        .insert({ draw_id: drawId, invoice_id: invoiceId });

      if (linkError && !linkError.message?.includes('duplicate')) {
        console.error('Failed to link invoice to draw:', linkError);
      }

      // Update draw total
      const { data: drawInvoices } = await supabase
        .from('v2_draw_invoices')
        .select('invoice:v2_invoices(amount)')
        .eq('draw_id', drawId);

      const newTotal = drawInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
      await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', drawId);

      // Log activity
      await logActivity(invoiceId, 'added_to_draw', performedBy, { draw_number: drawNumber });

      // Add IN DRAW stamp to the PDF
      try {
        const pdfUrl = existing.pdf_stamped_url || existing.pdf_url;
        if (pdfUrl) {
          const urlParts = pdfUrl.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            let storagePath = decodeURIComponent(urlParts[1].split('?')[0]); // Remove query params
            const pdfBuffer = await downloadPDF(storagePath);
            const stampedBuffer = await stampInDraw(pdfBuffer, drawNumber);

            // Upload to stamped path
            const basePath = storagePath.replace('_stamped.pdf', '.pdf');
            const result = await uploadStampedPDF(stampedBuffer, basePath);
            updateFields.pdf_stamped_url = result.url;
          }
        }
      } catch (stampErr) {
        console.error('IN DRAW stamp failed:', stampErr.message);
      }
    }

    // Handle PDF stamping when transitioning TO approved
    if (updates.status === 'approved' && existing.status !== 'in_draw') {
      try {
        // Fetch full invoice data with relations for stamping
        const { data: fullInvoice } = await supabase
          .from('v2_invoices')
          .select(`
            *,
            vendor:v2_vendors(id, name),
            job:v2_jobs(id, name),
            po:v2_purchase_orders(id, po_number, description, total_amount),
            allocations:v2_invoice_allocations(
              amount,
              cost_code_id,
              cost_code:v2_cost_codes(code, name)
            )
          `)
          .eq('id', invoiceId)
          .single();

        if (fullInvoice?.pdf_url) {
          const urlParts = fullInvoice.pdf_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1]);
            const pdfBuffer = await downloadPDF(storagePath);

            // Get PO billing info
            let poTotal = null;
            let poBilledToDate = 0;

            if (fullInvoice.po?.id) {
              poTotal = fullInvoice.po.total_amount;
              const { data: priorInvoices } = await supabase
                .from('v2_invoices')
                .select('amount')
                .eq('po_id', fullInvoice.po.id)
                .neq('id', invoiceId)
                .in('status', ['approved', 'in_draw', 'paid']);

              if (priorInvoices) {
                poBilledToDate = priorInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
              }
            }

            // Build allocations with cost code details for stamping
            let allocationsForStamp = [];

            if (updates.allocations && updates.allocations.length > 0) {
              // Allocations from request - need to fetch cost code details
              const costCodeIds = updates.allocations
                .filter(a => a.cost_code_id)
                .map(a => a.cost_code_id);

              if (costCodeIds.length > 0) {
                const { data: costCodes } = await supabase
                  .from('v2_cost_codes')
                  .select('id, code, name')
                  .in('id', costCodeIds);

                const ccMap = new Map((costCodes || []).map(cc => [cc.id, cc]));

                allocationsForStamp = updates.allocations
                  .filter(a => a.cost_code_id && ccMap.has(a.cost_code_id))
                  .map(a => ({
                    amount: a.amount,
                    cost_code: ccMap.get(a.cost_code_id)
                  }));
              }
            } else {
              // Use allocations from database
              allocationsForStamp = fullInvoice.allocations || [];
            }

            console.log('=== STAMP DEBUG (PATCH) ===');
            console.log('Allocations for stamp:', JSON.stringify(allocationsForStamp, null, 2));
            console.log('PO:', JSON.stringify(fullInvoice.po, null, 2));
            console.log('===========================');

            const stampedBuffer = await stampApproval(pdfBuffer, {
              status: 'APPROVED',
              date: new Date().toLocaleDateString(),
              approvedBy: performedBy,
              vendorName: fullInvoice.vendor?.name,
              invoiceNumber: fullInvoice.invoice_number,
              jobName: fullInvoice.job?.name,
              costCodes: allocationsForStamp.map(a => ({
                code: a.cost_code?.code,
                name: a.cost_code?.name,
                amount: a.amount
              })).filter(cc => cc.code), // Only include allocations with cost codes
              amount: fullInvoice.amount,
              poNumber: fullInvoice.po?.po_number,
              poDescription: fullInvoice.po?.description,
              poTotal: poTotal,
              poBilledToDate: poBilledToDate
            });

            const result = await uploadStampedPDF(stampedBuffer, storagePath);
            updateFields.pdf_stamped_url = result.url;
          }
        }
      } catch (stampErr) {
        console.error('PDF stamping failed during PATCH:', stampErr.message);
        // Continue without stamping
      }
    }

    // Handle clearing stamps when transitioning back to needs_approval (from any status)
    if (updates.status === 'needs_approval') {
      updateFields.pdf_stamped_url = null;
      updateFields.approved_at = null;
      updateFields.approved_by = null;
    }

    // Handle re-stamping when going from in_draw back to approved (remove IN DRAW stamp)
    if (updates.status === 'approved' && existing.status === 'in_draw') {
      try {
        // Re-fetch invoice with full data for re-stamping
        const { data: fullInvoice } = await supabase
          .from('v2_invoices')
          .select(`
            *,
            vendor:v2_vendors(id, name),
            job:v2_jobs(id, name),
            po:v2_purchase_orders(id, po_number, description, total_amount),
            allocations:v2_invoice_allocations(
              amount,
              cost_code_id,
              cost_code:v2_cost_codes(code, name)
            )
          `)
          .eq('id', invoiceId)
          .single();

        if (fullInvoice?.pdf_url) {
          const urlParts = fullInvoice.pdf_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
            // Download ORIGINAL PDF (not stamped) to re-stamp fresh
            const pdfBuffer = await downloadPDF(storagePath);

            // Get PO billing info
            let poTotal = null;
            let poBilledToDate = 0;
            if (fullInvoice.po?.id) {
              poTotal = fullInvoice.po.total_amount;
              const { data: priorInvoices } = await supabase
                .from('v2_invoices')
                .select('amount')
                .eq('po_id', fullInvoice.po.id)
                .neq('id', invoiceId)
                .in('status', ['approved', 'in_draw', 'paid']);
              if (priorInvoices) {
                poBilledToDate = priorInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
              }
            }

            const stampedBuffer = await stampApproval(pdfBuffer, {
              status: 'APPROVED',
              date: new Date().toLocaleDateString(),
              approvedBy: fullInvoice.approved_by || performedBy,
              vendorName: fullInvoice.vendor?.name,
              invoiceNumber: fullInvoice.invoice_number,
              jobName: fullInvoice.job?.name,
              costCodes: (fullInvoice.allocations || []).map(a => ({
                code: a.cost_code?.code,
                name: a.cost_code?.name,
                amount: a.amount
              })).filter(cc => cc.code),
              amount: fullInvoice.amount,
              poNumber: fullInvoice.po?.po_number,
              poDescription: fullInvoice.po?.description,
              poTotal: poTotal,
              poBilledToDate: poBilledToDate
            });

            const result = await uploadStampedPDF(stampedBuffer, storagePath);
            updateFields.pdf_stamped_url = result.url;
          }
        }
      } catch (stampErr) {
        console.error('Re-stamping failed when removing from draw:', stampErr.message);
      }
    }
  }

  // Track changes for activity log
  const changes = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (existing[key] !== value) {
      changes[key] = { from: existing[key], to: value };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateFields)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to update invoice');
  }

  // Handle allocations if provided
  if (updates.allocations && Array.isArray(updates.allocations)) {
    // Delete existing allocations
    await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);

    // Insert new allocations (only those with cost_code_id)
    const allocsToInsert = updates.allocations
      .filter(a => a.cost_code_id)
      .map(a => ({
        invoice_id: invoiceId,
        cost_code_id: a.cost_code_id,
        amount: parseFloat(a.amount) || 0,
        notes: a.notes || null,
        job_id: a.job_id || null,
        po_line_item_id: a.po_line_item_id || null
      }));

    if (allocsToInsert.length > 0) {
      const { error: allocError } = await supabase.from('v2_invoice_allocations').insert(allocsToInsert);
      if (allocError) {
        console.error('Failed to save allocations:', allocError);
      }
    }

    changes.allocations = { from: existing.allocations?.length || 0, to: allocsToInsert.length };
  }

  // Log activity
  if (Object.keys(changes).length > 0) {
    // Check for partial approval
    if (updates.status === 'approved' && updates.partial_approval_note) {
      await logActivity(invoiceId, 'partial_approval', performedBy, {
        changes,
        note: updates.partial_approval_note,
        partial_amount: updates.partial_amount
      });
    } else if (changes.status?.to === 'approved') {
      await logActivity(invoiceId, 'approved', performedBy, { changes });
    } else {
      await logActivity(invoiceId, 'edited', performedBy, { changes });
    }
  }

  // Broadcast update
  broadcastInvoiceUpdate(updated, 'edited', performedBy);

  res.json({
    success: true,
    invoice: updated,
    changes,
    undoAvailable: true,
    undoExpiresIn: UNDO_WINDOW_SECONDS * 1000
  });
}));

// Full update (PUT)
app.put('/api/invoices/:id/full', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { invoice: updates, allocations, performed_by: performedBy = 'System' } = req.body;

  // Check if invoice exists
  const { data: existing, error: getError } = await supabase
    .from('v2_invoices')
    .select('*, allocations:v2_invoice_allocations(*)')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (getError || !existing) {
    throw notFoundError('invoice', invoiceId);
  }

  // Check lock
  const lockStatus = await checkLock('invoice', invoiceId);
  if (lockStatus.isLocked && lockStatus.lock.lockedBy !== performedBy) {
    throw lockedError(lockStatus.lock.lockedBy, lockStatus.lock.expiresAt);
  }

  // Version check
  if (updates.expected_version && updates.expected_version !== existing.version) {
    throw versionConflictError(updates.expected_version, existing.version, existing);
  }

  // Validate full update
  const validation = validateInvoice(updates, false);
  if (!validation.valid) {
    throw validationError(validation.errors);
  }

  // Validate allocations if provided
  if (allocations && allocations.length > 0) {
    const allocValidation = validateAllocations(allocations, updates.amount || existing.amount);
    if (!allocValidation.valid) {
      throw new AppError('ALLOCATIONS_UNBALANCED', allocValidation.error);
    }
  }

  // Create undo snapshot
  await createUndoSnapshot('invoice', invoiceId, 'full_edit', { ...existing, allocations: existing.allocations }, performedBy);

  // Update invoice
  const updateFields = {
    invoice_number: updates.invoice_number,
    invoice_date: updates.invoice_date,
    due_date: updates.due_date,
    amount: updates.amount,
    job_id: updates.job_id,
    vendor_id: updates.vendor_id,
    po_id: updates.po_id,
    notes: updates.notes
  };

  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateFields)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to update invoice');
  }

  // Update allocations if provided
  if (allocations) {
    await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);
    if (allocations.length > 0) {
      const allocsToInsert = allocations.map(a => ({
        invoice_id: invoiceId,
        cost_code_id: a.cost_code_id,
        amount: a.amount,
        notes: a.notes,
        job_id: a.job_id || null,
        po_line_item_id: a.po_line_item_id || null
      }));
      await supabase.from('v2_invoice_allocations').insert(allocsToInsert);
    }
  }

  await logActivity(invoiceId, 'full_edit', performedBy, { updates });
  broadcastInvoiceUpdate(updated, 'full_edit', performedBy);

  res.json({ success: true, invoice: updated });
}));

// ============================================================
// STATUS TRANSITION ENDPOINT
// ============================================================

app.post('/api/invoices/:id/transition', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { new_status, performed_by: performedBy, reason, allocations, draw_id, overridePoOverage } = req.body;

  // Get current invoice
  const { data: invoice, error: getError } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      po:v2_purchase_orders(id, po_number, description, total_amount),
      allocations:v2_invoice_allocations(id, amount, cost_code_id, po_line_item_id, cost_code:v2_cost_codes(code, name))
    `)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (getError || !invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  // Validate transition is allowed
  const transitionCheck = validateStatusTransition(invoice.status, new_status);
  if (!transitionCheck.valid) {
    throw transitionError(invoice.status, new_status, transitionCheck.error);
  }

  // If allocations provided inline, validate them first
  if (allocations && allocations.length > 0) {
    const allocCheck = validateAllocations(allocations, parseFloat(invoice.amount));
    if (!allocCheck.valid) {
      throw validationError([{ field: 'allocations', message: allocCheck.error }]);
    }

    // Validate cost codes exist
    const costCodeIds = allocations.map(a => a.cost_code_id).filter(id => id);
    const codeCheck = await validateCostCodesExist(costCodeIds);
    if (!codeCheck.valid) {
      throw validationError([{ field: 'allocations', message: codeCheck.error }]);
    }
  }

  // Validate pre-transition requirements (pass overridePoOverage for soft-block)
  const preCheck = await validatePreTransition(invoice, new_status, { allocations, draw_id, overridePoOverage });
  if (!preCheck.valid) {
    // Check if it's a PO overage that requires override
    const poError = preCheck.errors.find(e => e.type === 'PO_OVERAGE');
    if (poError) {
      return res.status(400).json({
        success: false,
        error: 'PO_OVERAGE',
        message: poError.message,
        poRemaining: poError.poRemaining,
        invoiceAmount: poError.invoiceAmount,
        overageAmount: poError.overageAmount,
        requiresOverride: true
      });
    }
    throw new AppError('PRE_TRANSITION_FAILED', 'Pre-transition requirements not met', { errors: preCheck.errors });
  }

  // Create undo snapshot
  await createUndoSnapshot('invoice', invoiceId, new_status, invoice, performedBy);

  // Build update object
  const updateData = { status: new_status };
  let pdf_stamped_url = null;

  // Handle status-specific logic
  switch (new_status) {
    case 'needs_approval':
      updateData.coded_at = new Date().toISOString();
      updateData.coded_by = performedBy;
      // Clear stamp when moving back to needs_approval (needs approval)
      updateData.pdf_stamped_url = null;
      updateData.approved_at = null;
      updateData.approved_by = null;

      // Revert PO line items if moving FROM billable status
      if (['approved', 'in_draw', 'paid'].includes(invoice.status)) {
        if (invoice.po?.id && invoice.allocations && invoice.allocations.length > 0) {
          await updatePOLineItemsForAllocations(invoice.po.id, invoice.allocations, false);
        }
      }
      break;

    case 'approved':
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = performedBy;

      // Handle allocations if provided
      if (allocations && allocations.length > 0) {
        await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);
        const allocsToInsert = allocations.map(a => ({
          invoice_id: invoiceId,
          cost_code_id: a.cost_code_id,
          amount: a.amount,
          notes: a.notes,
          job_id: a.job_id || null,
          po_line_item_id: a.po_line_item_id || null
        }));
        await supabase.from('v2_invoice_allocations').insert(allocsToInsert);
      }

      // Stamp PDF
      if (invoice.pdf_url) {
        try {
          const urlParts = invoice.pdf_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1]);
            const pdfBuffer = await downloadPDF(storagePath);

            // Get PO info
            let poTotal = null, poBilledToDate = 0;
            if (invoice.po?.id) {
              poTotal = parseFloat(invoice.po.total_amount);
              const { data: priorInvoices } = await supabase
                .from('v2_invoices')
                .select('amount')
                .eq('po_id', invoice.po.id)
                .neq('id', invoiceId)
                .in('status', ['approved', 'in_draw', 'paid']);
              if (priorInvoices) {
                poBilledToDate = priorInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
              }
            }

            // Get cost code details for stamping
            const allocsForStamp = allocations || invoice.allocations || [];
            let costCodesForStamp = [];

            if (allocsForStamp.length > 0) {
              // If allocations don't have cost_code details, fetch them
              const needsFetch = allocsForStamp.some(a => !a.cost_code?.code);

              if (needsFetch) {
                const costCodeIds = allocsForStamp.map(a => a.cost_code_id).filter(id => id);
                if (costCodeIds.length > 0) {
                  const { data: costCodes } = await supabase
                    .from('v2_cost_codes')
                    .select('id, code, name')
                    .in('id', costCodeIds);

                  const codeMap = {};
                  (costCodes || []).forEach(cc => { codeMap[cc.id] = cc; });

                  costCodesForStamp = allocsForStamp.map(a => {
                    const cc = codeMap[a.cost_code_id] || {};
                    return {
                      code: cc.code || 'N/A',
                      name: cc.name || 'Unknown',
                      amount: parseFloat(a.amount)
                    };
                  });
                }
              } else {
                costCodesForStamp = allocsForStamp.map(a => ({
                  code: a.cost_code?.code || 'N/A',
                  name: a.cost_code?.name || 'Unknown',
                  amount: parseFloat(a.amount)
                }));
              }
            }

            const stampedBuffer = await stampApproval(pdfBuffer, {
              status: 'APPROVED',
              date: new Date().toLocaleDateString(),
              approvedBy: performedBy,
              vendorName: invoice.vendor?.name,
              invoiceNumber: invoice.invoice_number,
              jobName: invoice.job?.name,
              costCodes: costCodesForStamp,
              amount: parseFloat(invoice.amount),
              poNumber: invoice.po?.po_number,
              poDescription: invoice.po?.description,
              poTotal,
              poBilledToDate
            });

            const result = await uploadStampedPDF(stampedBuffer, storagePath);
            pdf_stamped_url = result.url;
            updateData.pdf_stamped_url = pdf_stamped_url;
          }
        } catch (stampErr) {
          console.error('PDF stamping failed:', stampErr.message);
          // Continue without stamp but flag it
        }
      }

      // Update budget lines
      const finalAllocations = allocations || invoice.allocations || [];
      if (finalAllocations.length > 0 && invoice.job?.id) {
        for (const alloc of finalAllocations) {
          const costCodeId = alloc.cost_code_id || alloc.cost_code?.id;
          if (!costCodeId) continue;

          const { data: existing } = await supabase
            .from('v2_budget_lines')
            .select('id, billed_amount')
            .eq('job_id', invoice.job.id)
            .eq('cost_code_id', costCodeId)
            .single();

          if (existing) {
            const newBilled = (parseFloat(existing.billed_amount) || 0) + parseFloat(alloc.amount);
            await supabase.from('v2_budget_lines').update({ billed_amount: newBilled }).eq('id', existing.id);
          } else {
            await supabase.from('v2_budget_lines').insert({
              job_id: invoice.job.id,
              cost_code_id: costCodeId,
              budgeted_amount: 0,
              committed_amount: 0,
              billed_amount: parseFloat(alloc.amount) || 0,
              paid_amount: 0
            });
          }
        }
      }

      // Update PO line items
      if (invoice.po?.id && finalAllocations.length > 0) {
        for (const alloc of finalAllocations) {
          const costCodeId = alloc.cost_code_id || alloc.cost_code?.id;
          if (!costCodeId) continue;

          const { data: poLineItem } = await supabase
            .from('v2_po_line_items')
            .select('id, invoiced_amount')
            .eq('po_id', invoice.po.id)
            .eq('cost_code_id', costCodeId)
            .single();

          if (poLineItem) {
            const newInvoiced = (parseFloat(poLineItem.invoiced_amount) || 0) + parseFloat(alloc.amount);
            await supabase.from('v2_po_line_items').update({ invoiced_amount: newInvoiced }).eq('id', poLineItem.id);
          }
        }
      }
      break;

    case 'denied':
      updateData.denied_at = new Date().toISOString();
      updateData.denied_by = performedBy;
      updateData.denial_reason = reason;
      break;

    case 'in_draw':
      // Add to draw
      if (draw_id) {
        await supabase.from('v2_draw_invoices').insert({
          draw_id: draw_id,
          invoice_id: invoiceId
        });
        // Update draw total
        const { data: drawInvoices } = await supabase
          .from('v2_draw_invoices')
          .select('invoice:v2_invoices(amount)')
          .eq('draw_id', draw_id);
        const newTotal = drawInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
        await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', draw_id);
      }
      break;

    case 'received':
      // Clearing denial (if coming from denied)
      if (invoice.status === 'denied') {
        updateData.denied_at = null;
        updateData.denied_by = null;
        updateData.denial_reason = null;
      }
      break;
  }

  // Apply update
  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to update invoice status');
  }

  // Log activity
  await logActivity(invoiceId, new_status, performedBy, {
    from_status: invoice.status,
    to_status: new_status,
    reason,
    stamped: !!pdf_stamped_url
  });

  broadcastInvoiceUpdate(updated, `status_${new_status}`, performedBy);

  res.json({
    success: true,
    invoice: updated,
    warnings: preCheck.warnings || [],
    undoAvailable: true,
    undoExpiresIn: UNDO_WINDOW_SECONDS * 1000
  });
}));

// ============================================================
// AI OVERRIDE ENDPOINT
// ============================================================

app.patch('/api/invoices/:id/override', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { field, value, reason, performed_by: performedBy = 'System' } = req.body;

  // Validate field is overridable
  const overridableFields = ['job_id', 'vendor_id', 'amount', 'invoice_number', 'invoice_date', 'due_date'];
  if (!overridableFields.includes(field)) {
    throw new AppError('VALIDATION_FAILED', `Field '${field}' cannot be overridden`);
  }

  // Get current invoice
  const { data: invoice, error: getError } = await supabase
    .from('v2_invoices')
    .select('*, ai_confidence, ai_overrides, review_flags, needs_review')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (getError || !invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  // Build override record
  const overrideRecord = {
    ai_value: invoice[field],
    ai_confidence: invoice.ai_confidence?.[field.replace('_id', '')] || null,
    override_value: value,
    override_by: performedBy,
    override_at: new Date().toISOString(),
    override_reason: reason || null
  };

  // Merge with existing overrides
  const ai_overrides = { ...(invoice.ai_overrides || {}), [field]: overrideRecord };

  // Clear related review flags
  let review_flags = invoice.review_flags || [];
  const flagsToClear = {
    job_id: ['verify_job', 'select_job', 'no_job_match', 'missing_job_reference', 'low_job_confidence'],
    vendor_id: ['verify_vendor', 'select_vendor'],
    amount: ['amount_mismatch', 'verify_amount']
  };
  if (flagsToClear[field]) {
    review_flags = review_flags.filter(f => !flagsToClear[field].includes(f));
  }

  // Determine if still needs review
  const needs_review = review_flags.length > 0;

  // Update invoice
  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update({
      [field]: value,
      ai_overrides,
      review_flags,
      needs_review
    })
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to apply override');
  }

  // Log activity
  await logActivity(invoiceId, 'ai_override', performedBy, {
    field,
    ai_value: overrideRecord.ai_value,
    ai_confidence: overrideRecord.ai_confidence,
    new_value: value,
    reason
  });

  broadcastInvoiceUpdate(updated, 'ai_override', performedBy);

  res.json({
    success: true,
    invoice: updated,
    override: overrideRecord,
    remainingFlags: review_flags
  });
}));

// ============================================================
// AI FEEDBACK ENDPOINT (for learning from corrections)
// ============================================================

app.post('/api/ai/feedback', asyncHandler(async (req, res) => {
  const {
    invoice_id,
    field_name,
    ai_value,
    user_value,
    corrected_by = 'unknown',
    vendor_name,
    context = {}
  } = req.body;

  // Store the feedback for AI learning
  const { error: insertError } = await supabase
    .from('v2_ai_feedback')
    .insert({
      invoice_id,
      field_name,
      ai_value: typeof ai_value === 'object' ? JSON.stringify(ai_value) : String(ai_value || ''),
      user_value: typeof user_value === 'object' ? JSON.stringify(user_value) : String(user_value || ''),
      corrected_by,
      vendor_name,
      ai_confidence: context.confidence || null,
      vendor_trade: context.vendor_trade || null,
      created_at: new Date().toISOString()
    });

  // If table doesn't exist, just log the feedback - it's non-critical
  if (insertError) {
    console.log('[AI Feedback] Could not store feedback (table may not exist):', insertError.message);
    console.log('[AI Feedback] Received:', {
      invoice_id,
      field_name,
      ai_value,
      user_value,
      corrected_by,
      vendor_name
    });
  } else {
    console.log(`[AI Feedback] Stored correction: ${field_name} "${ai_value}" → "${user_value}" by ${corrected_by}`);
  }

  res.json({ success: true });
}));

// ============================================================
// UNDO ENDPOINTS
// ============================================================

app.get('/api/undo/available/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const result = await getAvailableUndo(entityType, entityId);
  res.json(result);
}));

app.post('/api/invoices/:id/undo', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { performed_by: performedBy = 'System' } = req.body;

  // Get available undo
  const undoInfo = await getAvailableUndo('invoice', invoiceId);
  if (!undoInfo.available) {
    throw new AppError('UNDO_NOT_FOUND', 'No undo available for this invoice');
  }

  // Execute undo
  const result = await executeUndo(undoInfo.undoEntry.id, performedBy);
  if (!result.success) {
    throw result.error;
  }

  // Get updated invoice
  const { data: updated } = await supabase
    .from('v2_invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  broadcastInvoiceUpdate(updated, 'undone', performedBy);

  res.json({
    success: true,
    invoice: updated,
    undoneAction: result.undoneAction,
    restoredState: result.restoredState
  });
}));

// ============================================================
// LOCKING ENDPOINTS
// ============================================================

app.post('/api/locks/acquire', asyncHandler(async (req, res) => {
  const { entity_type, entity_id, locked_by } = req.body;

  if (!entity_type || !entity_id || !locked_by) {
    throw new AppError('VALIDATION_FAILED', 'entity_type, entity_id, and locked_by are required');
  }

  const result = await acquireLock(entity_type, entity_id, locked_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({
    success: true,
    lock: result.lock,
    refreshed: result.refreshed || false,
    created: result.created || false
  });
}));

app.delete('/api/locks/:lockId', asyncHandler(async (req, res) => {
  const { lockId } = req.params;
  const { released_by } = req.body;

  const result = await releaseLock(lockId, released_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({ success: true });
}));

app.get('/api/locks/check/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const result = await checkLock(entityType, entityId);
  res.json(result);
}));

app.delete('/api/locks/entity/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const { released_by } = req.body;

  const result = await releaseLockByEntity(entityType, entityId, released_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({ success: true });
}));

// ============================================================
// BULK OPERATIONS
// ============================================================

app.post('/api/invoices/bulk/approve', asyncHandler(async (req, res) => {
  const { invoice_ids, performed_by: performedBy } = req.body;

  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'invoice_ids array is required');
  }

  const results = { success: [], failed: [] };

  // First, validate all
  for (const invoiceId of invoice_ids) {
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('*, allocations:v2_invoice_allocations(*)')
      .eq('id', invoiceId)
      .is('deleted_at', null)
      .single();

    if (!invoice) {
      results.failed.push({ id: invoiceId, error: 'Invoice not found' });
      continue;
    }

    const transitionCheck = validateStatusTransition(invoice.status, 'approved');
    if (!transitionCheck.valid) {
      results.failed.push({ id: invoiceId, error: transitionCheck.error });
      continue;
    }

    const preCheck = await validatePreTransition(invoice, 'approved', {});
    if (!preCheck.valid) {
      results.failed.push({ id: invoiceId, error: preCheck.errors[0]?.message || 'Pre-transition failed' });
      continue;
    }

    results.success.push(invoiceId);
  }

  // Process valid ones
  const approved = [];
  for (const invoiceId of results.success) {
    try {
      const { data: updated } = await supabase
        .from('v2_invoices')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: performedBy
        })
        .eq('id', invoiceId)
        .select()
        .single();

      await logActivity(invoiceId, 'approved', performedBy, { bulk: true });
      approved.push(updated);
    } catch (err) {
      results.failed.push({ id: invoiceId, error: err.message });
      results.success = results.success.filter(id => id !== invoiceId);
    }
  }

  broadcast('bulk_approve', { invoiceIds: results.success, performedBy });

  res.json({
    success: true,
    approved: results.success.length,
    failed: results.failed.length,
    results
  });
}));

app.post('/api/invoices/bulk/add-to-draw', asyncHandler(async (req, res) => {
  const { invoice_ids, draw_id, performed_by: performedBy } = req.body;

  if (!invoice_ids || !draw_id) {
    throw new AppError('VALIDATION_FAILED', 'invoice_ids and draw_id are required');
  }

  // Verify draw exists and is not funded
  const { data: draw } = await supabase
    .from('v2_draws')
    .select('id, status')
    .eq('id', draw_id)
    .single();

  if (!draw) {
    throw notFoundError('draw', draw_id);
  }

  if (['funded', 'partially_funded', 'overfunded'].includes(draw.status)) {
    throw new AppError('DRAW_FUNDED', 'Cannot add invoices to a funded draw');
  }

  const results = { success: [], failed: [] };

  for (const invoiceId of invoice_ids) {
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      results.failed.push({ id: invoiceId, error: 'Invoice not found' });
      continue;
    }

    if (invoice.status !== 'approved') {
      results.failed.push({ id: invoiceId, error: 'Invoice must be approved first' });
      continue;
    }

    // Check if already in a draw
    const { data: existingDraw } = await supabase
      .from('v2_draw_invoices')
      .select('draw_id')
      .eq('invoice_id', invoiceId)
      .single();

    if (existingDraw) {
      results.failed.push({ id: invoiceId, error: 'Invoice already in a draw' });
      continue;
    }

    try {
      await supabase.from('v2_draw_invoices').insert({ draw_id, invoice_id: invoiceId });
      await supabase.from('v2_invoices').update({ status: 'in_draw' }).eq('id', invoiceId);
      await logActivity(invoiceId, 'added_to_draw', performedBy, { draw_id, bulk: true });
      results.success.push(invoiceId);
    } catch (err) {
      results.failed.push({ id: invoiceId, error: err.message });
    }
  }

  // Update draw total
  const { data: drawInvoices } = await supabase
    .from('v2_draw_invoices')
    .select('invoice:v2_invoices(amount)')
    .eq('draw_id', draw_id);

  const newTotal = drawInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
  await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', draw_id);

  res.json({
    success: true,
    added: results.success.length,
    failed: results.failed.length,
    results,
    drawTotal: newTotal
  });
}));

app.post('/api/invoices/bulk/deny', asyncHandler(async (req, res) => {
  const { invoice_ids, reason, performed_by: performedBy } = req.body;

  if (!invoice_ids || !reason) {
    throw new AppError('VALIDATION_FAILED', 'invoice_ids and reason are required');
  }

  const results = { success: [], failed: [] };

  for (const invoiceId of invoice_ids) {
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      results.failed.push({ id: invoiceId, error: 'Invoice not found' });
      continue;
    }

    const transitionCheck = validateStatusTransition(invoice.status, 'denied');
    if (!transitionCheck.valid) {
      results.failed.push({ id: invoiceId, error: transitionCheck.error });
      continue;
    }

    try {
      await supabase.from('v2_invoices').update({
        status: 'denied',
        denied_at: new Date().toISOString(),
        denied_by: performedBy,
        denial_reason: reason
      }).eq('id', invoiceId);

      await logActivity(invoiceId, 'denied', performedBy, { reason, bulk: true });
      results.success.push(invoiceId);
    } catch (err) {
      results.failed.push({ id: invoiceId, error: err.message });
    }
  }

  res.json({
    success: true,
    denied: results.success.length,
    failed: results.failed.length,
    results
  });
}));

// ============================================================
// VERSION CHECK ENDPOINT
// ============================================================

app.get('/api/invoices/:id/version', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;

  const { data: invoice, error } = await supabase
    .from('v2_invoices')
    .select('id, version, updated_at')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  res.json({
    id: invoice.id,
    version: invoice.version,
    updated_at: invoice.updated_at
  });
}));

// ============================================================
// SOFT DELETE
// ============================================================

app.delete('/api/invoices/:id', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { performed_by: performedBy = 'System' } = req.body;

  // Get invoice for undo snapshot
  const { data: invoice } = await supabase
    .from('v2_invoices')
    .select('*')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (!invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  // Cannot delete paid invoices
  if (invoice.status === 'paid') {
    throw new AppError('VALIDATION_FAILED', 'Cannot delete paid invoices');
  }

  // Cannot delete invoices in funded draws
  if (invoice.status === 'in_draw') {
    const { data: drawInvoice } = await supabase
      .from('v2_draw_invoices')
      .select('draw:v2_draws(status)')
      .eq('invoice_id', invoiceId)
      .single();

    if (['funded', 'partially_funded', 'overfunded'].includes(drawInvoice?.draw?.status)) {
      throw new AppError('VALIDATION_FAILED', 'Cannot delete invoice in funded draw');
    }
  }

  // Create undo snapshot
  await createUndoSnapshot('invoice', invoiceId, 'deleted', invoice, performedBy);

  // Soft delete
  const { error } = await supabase
    .from('v2_invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (error) {
    throw new AppError('DATABASE_ERROR', 'Failed to delete invoice');
  }

  await logActivity(invoiceId, 'deleted', performedBy, {});
  broadcastInvoiceUpdate({ id: invoiceId }, 'deleted', performedBy);

  res.json({
    success: true,
    undoAvailable: true,
    undoExpiresIn: UNDO_WINDOW_SECONDS * 1000
  });
}));

// ============================================================
// REALTIME SSE ENDPOINT
// ============================================================

app.get('/api/realtime/events', sseHandler);

app.get('/api/realtime/stats', (req, res) => {
  res.json(getRealtimeStats());
});

// ============================================================
// ERROR HANDLING MIDDLEWARE (must be last)
// ============================================================

app.use(errorMiddleware);

// ============================================================
// START SERVER
// ============================================================

// Write PID file for safe restarts
fs.writeFileSync(PID_FILE, process.pid.toString());
console.log(`PID ${process.pid} written to ${PID_FILE}`);

// Clean up PID file on exit
const cleanupPID = () => {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (e) {}
};
process.on('exit', cleanupPID);
process.on('SIGINT', () => { cleanupPID(); process.exit(0); });
process.on('SIGTERM', () => { cleanupPID(); process.exit(0); });

app.listen(port, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('ROSS BUILT CONSTRUCTION MANAGEMENT');
  console.log('='.repeat(50));
  console.log(`Server running at http://localhost:${port}`);
  console.log(`PID: ${process.pid} (use 'npm run stop' to safely stop)`);
  console.log('');
  console.log('API Endpoints:');
  console.log('  GET  /api/dashboard/stats       - Owner dashboard');
  console.log('  GET  /api/invoices              - List invoices');
  console.log('  POST /api/invoices/upload       - Upload invoice PDF');
  console.log('  POST /api/invoices/process      - AI-powered invoice processing');
  console.log('  PATCH /api/invoices/:id         - Edit invoice (partial)');
  console.log('  PUT  /api/invoices/:id/full     - Edit invoice (full)');
  console.log('  POST /api/invoices/:id/transition - Status transition');
  console.log('  PATCH /api/invoices/:id/override - AI field override');
  console.log('  POST /api/invoices/:id/undo     - Undo last action');
  console.log('  POST /api/locks/acquire         - Acquire edit lock');
  console.log('  POST /api/invoices/bulk/approve - Bulk approve');
  console.log('  GET  /api/realtime/events       - SSE realtime updates');
  console.log('='.repeat(50));

  // Initialize realtime subscriptions
  initializeRealtimeSubscriptions();
});
