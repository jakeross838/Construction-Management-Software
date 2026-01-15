/**
 * Change Order Routes
 * All change order management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Helper: Log CO activity
async function logCOActivity(changeOrderId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_job_co_activity').insert({
      change_order_id: changeOrderId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Failed to log CO activity:', err);
  }
}

// ============================================================
// LIST ENDPOINTS
// ============================================================

// Get single change order with billing history
router.get('/:id', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CREATE/UPDATE ENDPOINTS
// ============================================================

// Update change order
router.patch('/:id', async (req, res) => {
  try {
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
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'updated', updated_by, updates);
    res.json(co);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete change order
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('v2_job_change_orders')
      .select('status, invoiced_amount, billed_amount')
      .eq('id', id)
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

    const { error } = await supabase.from('v2_job_change_orders').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATUS TRANSITIONS
// ============================================================

// Submit for approval
router.post('/:id/submit', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// Internal approve
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
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
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'approved', approved_by);
    res.json(co);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client approve
router.post('/:id/client-approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { client_approved_by, recorded_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
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
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'client_approved', recorded_by || 'System', { client_approved_by });
    res.json(co);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bypass client approval
router.post('/:id/bypass-client', async (req, res) => {
  try {
    const { id } = req.params;
    const { bypass_reason, bypassed_by } = req.body;

    if (!bypass_reason) return res.status(400).json({ error: 'Bypass reason is required' });

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
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
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'client_bypassed', bypassed_by, { bypass_reason });
    res.json(co);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject
router.post('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, rejected_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
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
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'rejected', rejected_by, { rejection_reason });
    res.json(co);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// INVOICE LINKING
// ============================================================

// Get invoices linked to CO
router.get('/:id/invoices', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_change_order_invoices')
      .select(`
        id, amount, notes, created_at, invoice_id,
        invoice:v2_invoices(id, invoice_number, amount, invoice_date, vendor:v2_vendors(id, name))
      `)
      .eq('change_order_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Link invoice to CO
router.post('/:id/link-invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const { invoice_id, amount, notes } = req.body;

    if (!invoice_id) return res.status(400).json({ error: 'invoice_id is required' });

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
    res.status(500).json({ error: err.message });
  }
});

// Unlink invoice from CO
router.delete('/:id/unlink-invoice/:invoiceId', async (req, res) => {
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
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// COST CODES
// ============================================================

router.get('/:id/cost-codes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_change_order_cost_codes')
      .select('*, cost_code:v2_cost_codes(id, code, name)')
      .eq('change_order_id', req.params.id)
      .order('created_at');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id/cost-codes', async (req, res) => {
  try {
    const { id } = req.params;
    const { cost_codes } = req.body;

    await supabase.from('v2_change_order_cost_codes').delete().eq('change_order_id', id);

    if (cost_codes && cost_codes.length > 0) {
      const toInsert = cost_codes.map(cc => ({
        change_order_id: id,
        cost_code_id: cc.cost_code_id,
        amount: parseFloat(cc.amount) || 0,
        description: cc.description || null
      }));

      const { error } = await supabase.from('v2_change_order_cost_codes').insert(toInsert);
      if (error) throw error;
    }

    await logCOActivity(id, 'cost_codes_updated', 'System', { count: cost_codes?.length || 0 });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
module.exports.logCOActivity = logCOActivity;
