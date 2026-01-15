/**
 * Jobs Routes
 * Job management endpoints
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Get all jobs
router.get('/', async (req, res) => {
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

// Get single job
router.get('/:id', async (req, res) => {
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

// Get purchase orders for a specific job
router.get('/:id/purchase-orders', async (req, res) => {
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

// Get job budget
router.get('/:id/budget', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get budget lines
    const { data: budgetLines, error: budgetError } = await supabase
      .from('v2_budget_lines')
      .select(`
        *,
        cost_code:v2_cost_codes(id, code, name, category)
      `)
      .eq('job_id', jobId);

    if (budgetError) throw budgetError;

    // Get invoices for this job
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('amount, status')
      .eq('job_id', jobId)
      .in('status', ['approved', 'in_draw', 'paid']);

    // Get allocations
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select('cost_code_id, amount')
      .in('invoice_id', invoices?.map(i => i.id) || []);

    // Calculate totals
    const totals = {
      budgeted: 0,
      committed: 0,
      billed: 0,
      paid: 0
    };

    (budgetLines || []).forEach(bl => {
      totals.budgeted += parseFloat(bl.budgeted_amount || 0);
      totals.committed += parseFloat(bl.committed_amount || 0);
      totals.billed += parseFloat(bl.billed_amount || 0);
      totals.paid += parseFloat(bl.paid_amount || 0);
    });

    res.json({
      budget_lines: budgetLines || [],
      totals
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get draws for a job
router.get('/:id/draws', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_draws')
      .select('*')
      .eq('job_id', req.params.id)
      .order('draw_number', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get job statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get job
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    // Get invoices
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('amount, status')
      .eq('job_id', jobId)
      .is('deleted_at', null);

    const stats = {
      total_invoices: invoices?.length || 0,
      total_billed: 0,
      by_status: {
        received: 0,
        needs_approval: 0,
        approved: 0,
        in_draw: 0,
        paid: 0
      }
    };

    (invoices || []).forEach(inv => {
      stats.total_billed += parseFloat(inv.amount || 0);
      if (stats.by_status[inv.status] !== undefined) {
        stats.by_status[inv.status]++;
      }
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

