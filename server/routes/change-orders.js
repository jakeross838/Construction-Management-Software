/**
 * Change Order Routes
 * All change order management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// Helper: Log CO activity
async function logCOActivity(changeOrderId, action, performedBy, details = {}, builderId = null) {
  try {
    const record = {
      change_order_id: changeOrderId,
      action,
      performed_by: performedBy,
      details
    };
    if (builderId) record.builder_id = builderId;
    await supabase.from('v2_job_co_activity').insert(record);
  } catch (err) {
    console.error('Failed to log CO activity:', err);
  }
}

// ============================================================
// LIST ENDPOINTS
// ============================================================

// Get all change orders (with optional filters)
router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, draw_id, status } = req.query;

  // If filtering by draw_id, we need to find COs that have billings for that draw
  if (draw_id) {
    // Get change order IDs that have billings in this draw
    const { data: billings, error: billingsError } = await supabase
      .from('v2_job_co_draw_billings')
      .select('change_order_id, amount')
      .eq('draw_id', draw_id)
      .eq('builder_id', builderId);

    if (billingsError) throw billingsError;

    if (!billings || billings.length === 0) {
      return res.json([]);
    }

    const coIds = [...new Set(billings.map(b => b.change_order_id))];

    const { data, error } = await supabase
      .from('v2_job_change_orders')
      .select(`
        *,
        job:v2_jobs(id, name, client_name)
      `)
      .in('id', coIds)
      .eq('builder_id', builderId)
      .order('change_order_number', { ascending: true });

    if (error) throw error;

    // Add billing amount for this draw to each CO and transform
    const result = (data || []).map(co => ({
      ...transformJobCO(co),
      draw_billing_amount: billings
        .filter(b => b.change_order_id === co.id)
        .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0)
    }));

    return res.json(result);
  }

  // Standard query without draw_id filter
  let query = supabase
    .from('v2_job_change_orders')
    .select(`
      *,
      job:v2_jobs(id, name, client_name)
    `)
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;

  // Transform all COs to frontend format
  res.json((data || []).map(transformJobCO));
}));

// Helper: Transform job change order to frontend format
function transformJobCO(co) {
  if (!co) return co;
  return {
    ...co,
    // Map database fields to frontend expected fields
    co_number: `CO-${co.change_order_number || 0}`,
    type: co.reason || 'scope_change',
    total_amount: co.amount || 0,
    subtotal: co.base_amount || co.amount || 0,
    markup_amount: co.gc_fee_amount || 0,
    markup_percent: co.gc_fee_percent || 0,
    days_impact: co.days_added || 0,
    pm_hours: co.admin_hours || 0,
    pm_hourly_rate: co.admin_rate || 0,
    pm_cost: co.admin_cost || 0,
    job_name: co.job?.name || '',
    job_client: co.job?.client_name || '',
    requested_by: co.created_by || null,
    client_signature_required: false,
    client_signed_at: co.client_approved_at,
    approved_at: co.internal_approved_at,
    approved_by: co.internal_approved_by,
  };
}

// Get single change order with billing history
router.get('/:id', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
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
      .eq('builder_id', builderId)
      .single();

    if (error) throw error;
    if (!co) return res.status(404).json({ error: 'Change order not found' });

    const { data: activity } = await supabase
      .from('v2_job_co_activity')
      .select('*')
      .eq('change_order_id', id)
      .eq('builder_id', builderId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Transform to frontend format
    const transformed = transformJobCO(co);
    res.json({ ...transformed, activity: activity || [] });
}));

// ============================================================
// CREATE/UPDATE ENDPOINTS
// ============================================================

// Update change order
router.patch('/:id', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const {
      change_order_number, title, description, reason, amount,
      base_amount, gc_fee_percent, gc_fee_amount,
      admin_hours, admin_rate, admin_cost,
      status, first_billed_draw_number, days_added, updated_by
    } = req.body;

    const { data: existing } = await supabase
      .from('v2_job_change_orders')
      .select('status, billed_amount')
      .eq('id', id)
      .eq('builder_id', builderId)
      .single();

    if (!existing) return res.status(404).json({ error: 'Change order not found' });

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
    if (admin_hours !== undefined) updates.admin_hours = parseFloat(admin_hours) || 0;
    if (admin_rate !== undefined) updates.admin_rate = parseFloat(admin_rate) || 0;
    if (admin_cost !== undefined) updates.admin_cost = parseFloat(admin_cost) || 0;
    if (days_added !== undefined) updates.days_added = parseInt(days_added);
    if (status !== undefined) updates.status = status;
    if (first_billed_draw_number !== undefined) updates.first_billed_draw_number = first_billed_draw_number;

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update(updates)
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'updated', updated_by, updates, builderId);
    res.json(co);
}));

// Delete change order
router.delete('/:id', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('v2_job_change_orders')
      .select('status, invoiced_amount, billed_amount')
      .eq('id', id)
      .eq('builder_id', builderId)
      .single();

    if (!existing) return res.status(404).json({ error: 'Change order not found' });

    const invoicedAmt = parseFloat(existing.invoiced_amount || 0);
    const billedAmt = parseFloat(existing.billed_amount || 0);
    const canDelete = existing.status === 'draft' || (invoicedAmt === 0 && billedAmt === 0);

    if (!canDelete) {
      return res.status(400).json({
        error: 'Cannot delete change order with invoices or billings linked to it'
      });
    }

    const { error } = await supabase.from('v2_job_change_orders').delete().eq('id', id).eq('builder_id', builderId);
    if (error) throw error;

    res.json({ success: true });
}));

// ============================================================
// STATUS TRANSITIONS
// ============================================================

// Submit for approval
router.post('/:id/submit', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { submitted_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).eq('builder_id', builderId).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Can only submit draft change orders' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'submitted', submitted_by, {}, builderId);
    res.json(co);
}));

// Internal approve
router.post('/:id/approve', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { approved_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).eq('builder_id', builderId).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'pending_approval') return res.status(400).json({ error: 'Can only approve pending change orders' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({
        status: 'approved',
        internal_approved_at: new Date().toISOString(),
        internal_approved_by: approved_by,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'approved', approved_by, {}, builderId);
    res.json(co);
}));

// Client approve
router.post('/:id/client-approve', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { client_approved_by, recorded_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).eq('builder_id', builderId).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'approved') return res.status(400).json({ error: 'Must be internally approved first' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({
        client_approved_at: new Date().toISOString(),
        client_approved_by: client_approved_by || 'Client',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'client_approved', recorded_by || 'System', { client_approved_by }, builderId);
    res.json(co);
}));

// Bypass client approval
router.post('/:id/bypass-client', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { bypass_reason, bypassed_by } = req.body;

    if (!bypass_reason) return res.status(400).json({ error: 'Bypass reason is required' });

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).eq('builder_id', builderId).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'approved') return res.status(400).json({ error: 'Must be internally approved first' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({
        client_approval_bypassed: true,
        bypass_reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'client_bypassed', bypassed_by, { bypass_reason }, builderId);
    res.json(co);
}));

// Reject
router.post('/:id/reject', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { rejection_reason, rejected_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).eq('builder_id', builderId).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (!['pending_approval', 'approved'].includes(existing.status)) {
      return res.status(400).json({ error: 'Invalid status for rejection' });
    }

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({
        status: 'rejected',
        rejection_reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'rejected', rejected_by, { rejection_reason }, builderId);
    res.json(co);
}));

// ============================================================
// INVOICE LINKING
// ============================================================

// Get invoices linked to CO
router.get('/:id/invoices', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { data, error } = await supabase
      .from('v2_change_order_invoices')
      .select(`
        id, amount, notes, created_at, invoice_id,
        invoice:v2_invoices(id, invoice_number, amount, invoice_date, vendor:v2_vendors(id, name))
      `)
      .eq('change_order_id', req.params.id)
      .eq('builder_id', builderId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
}));

// Link invoice to CO
router.post('/:id/link-invoice', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { invoice_id, amount, notes } = req.body;

    if (!invoice_id) return res.status(400).json({ error: 'invoice_id is required' });

    const { data: existing } = await supabase
      .from('v2_change_order_invoices')
      .select('id')
      .eq('change_order_id', id)
      .eq('invoice_id', invoice_id)
      .eq('builder_id', builderId)
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
        notes,
        builder_id: builderId
      })
      .select(`
        id, amount, notes, created_at, invoice_id,
        invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(id, name))
      `)
      .single();

    if (error) throw error;
    await logCOActivity(id, 'invoice_linked', 'System', { invoice_id, amount }, builderId);
    res.status(201).json(link);
}));

// Unlink invoice from CO
router.delete('/:id/unlink-invoice/:invoiceId', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id, invoiceId } = req.params;

    const { error } = await supabase
      .from('v2_change_order_invoices')
      .delete()
      .eq('change_order_id', id)
      .eq('invoice_id', invoiceId)
      .eq('builder_id', builderId);

    if (error) throw error;
    await logCOActivity(id, 'invoice_unlinked', 'System', { invoice_id: invoiceId }, builderId);
    res.json({ success: true });
}));

// ============================================================
// COST CODES
// ============================================================

router.get('/:id/cost-codes', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { data, error } = await supabase
      .from('v2_change_order_cost_codes')
      .select('*, cost_code:v2_cost_codes(id, code, name)')
      .eq('change_order_id', req.params.id)
      .eq('builder_id', builderId)
      .order('created_at');

    if (error) throw error;
    res.json(data || []);
}));

router.put('/:id/cost-codes', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { cost_codes } = req.body;

    await supabase.from('v2_change_order_cost_codes').delete().eq('change_order_id', id).eq('builder_id', builderId);

    if (cost_codes && cost_codes.length > 0) {
      const toInsert = cost_codes.map(cc => ({
        change_order_id: id,
        cost_code_id: cc.cost_code_id,
        amount: parseFloat(cc.amount) || 0,
        description: cc.description || null,
        builder_id: builderId
      }));

      const { error } = await supabase.from('v2_change_order_cost_codes').insert(toInsert);
      if (error) throw error;
    }

    await logCOActivity(id, 'cost_codes_updated', 'System', { count: cost_codes?.length || 0 }, builderId);
    res.json({ success: true });
}));

// ============================================================
// REVISIONS
// ============================================================

// Get revision history for a change order
router.get('/:id/revisions', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;

    const { data, error } = await supabase
      .from('v2_change_order_revisions')
      .select('*')
      .eq('change_order_id', id)
      .eq('builder_id', builderId)
      .order('revision_number', { ascending: false });

    if (error) throw error;
    res.json(data || []);
}));

// Get a specific revision
router.get('/:id/revisions/:revisionNumber', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id, revisionNumber } = req.params;

    const { data, error } = await supabase
      .from('v2_change_order_revisions')
      .select('*')
      .eq('change_order_id', id)
      .eq('revision_number', parseInt(revisionNumber))
      .eq('builder_id', builderId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!data) return res.status(404).json({ error: 'Revision not found' });

    res.json(data);
}));

// Create a new revision (snapshot current state before making changes)
router.post('/:id/revisions', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { revision_reason, revised_by } = req.body;

    // Get current CO data
    const { data: co, error: coError } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('id', id)
      .eq('builder_id', builderId)
      .single();

    if (coError) throw coError;
    if (!co) return res.status(404).json({ error: 'Change order not found' });

    // Get current line items
    const { data: lineItems } = await supabase
      .from('v2_change_order_line_items')
      .select('*')
      .eq('change_order_id', id)
      .eq('builder_id', builderId);

    // Get current revision number and increment
    const currentRevision = co.revision_number || 0;
    const newRevisionNumber = currentRevision + 1;

    // Create revision snapshot
    const { data: revision, error: revError } = await supabase
      .from('v2_change_order_revisions')
      .insert({
        change_order_id: id,
        revision_number: currentRevision, // Store CURRENT state before incrementing
        title: co.title,
        description: co.description,
        reason: co.reason,
        amount: co.amount,
        base_amount: co.base_amount,
        gc_fee_percent: co.gc_fee_percent,
        gc_fee_amount: co.gc_fee_amount,
        admin_hours: co.admin_hours,
        admin_rate: co.admin_rate,
        admin_cost: co.admin_cost,
        days_added: co.days_added,
        markup_percent: co.markup_percent,
        markup_amount: co.markup_amount,
        subtotal: co.subtotal,
        total_amount: co.total_amount,
        pm_hours: co.pm_hours,
        pm_hourly_rate: co.pm_hourly_rate,
        pm_cost: co.pm_cost,
        days_impact: co.days_impact,
        line_items: lineItems || [],
        revision_reason: revision_reason || 'Revision created',
        revised_by: revised_by || 'System',
        builder_id: builderId
      })
      .select()
      .single();

    if (revError) throw revError;

    // Update CO with new revision number
    const { data: updatedCO, error: updateError } = await supabase
      .from('v2_job_change_orders')
      .update({
        revision_number: newRevisionNumber,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (updateError) throw updateError;

    await logCOActivity(id, 'revision_created', revised_by, {
      revision_number: currentRevision,
      new_revision_number: newRevisionNumber,
      reason: revision_reason
    }, builderId);

    res.status(201).json({
      revision,
      change_order: updatedCO
    });
}));

// Compare two revisions
router.get('/:id/revisions/compare/:rev1/:rev2', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id, rev1, rev2 } = req.params;

    const { data, error } = await supabase
      .from('v2_change_order_revisions')
      .select('*')
      .eq('change_order_id', id)
      .eq('builder_id', builderId)
      .in('revision_number', [parseInt(rev1), parseInt(rev2)]);

    if (error) throw error;

    const revision1 = data?.find(r => r.revision_number === parseInt(rev1));
    const revision2 = data?.find(r => r.revision_number === parseInt(rev2));

    if (!revision1 || !revision2) {
      return res.status(404).json({ error: 'One or both revisions not found' });
    }

    // Calculate differences
    const changes = [];
    const fieldsToCompare = [
      'title', 'description', 'reason', 'amount', 'base_amount',
      'gc_fee_percent', 'gc_fee_amount', 'admin_hours', 'admin_rate',
      'admin_cost', 'days_added', 'markup_percent', 'markup_amount',
      'subtotal', 'total_amount', 'pm_hours', 'pm_hourly_rate',
      'pm_cost', 'days_impact'
    ];

    fieldsToCompare.forEach(field => {
      const val1 = revision1[field];
      const val2 = revision2[field];
      if (val1 !== val2) {
        changes.push({
          field,
          from: val1,
          to: val2
        });
      }
    });

    // Compare line items count
    const li1Count = (revision1.line_items || []).length;
    const li2Count = (revision2.line_items || []).length;
    if (li1Count !== li2Count) {
      changes.push({
        field: 'line_items_count',
        from: li1Count,
        to: li2Count
      });
    }

    res.json({
      revision1,
      revision2,
      changes
    });
}));

module.exports = router;
module.exports.logCOActivity = logCOActivity;
