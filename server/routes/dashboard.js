/**
 * Dashboard Routes
 * Owner dashboard statistics and metrics
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Get dashboard statistics (all jobs)
router.get('/stats', async (req, res) => {
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
        if (drawStats[d.status]) {
          drawStats[d.status].count++;
          drawStats[d.status].amount += parseFloat(d.total_amount) || 0;
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

module.exports = router;

