/**
 * Dashboard Routes
 * Owner dashboard statistics and metrics
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

// Get dashboard alerts - actionable items across all modules
router.get('/alerts', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // 1. Upcoming Inspections (next 7 days)
    const { data: inspections } = await supabase
      .from('v2_inspections')
      .select('id, job_id, type, scheduled_date, v2_jobs(name)')
      .gte('scheduled_date', today)
      .lte('scheduled_date', sevenDaysFromNow)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true })
      .limit(10);

    // 2. Budget Overruns (billed > budgeted)
    const { data: budgets } = await supabase
      .from('v2_budget_lines')
      .select('id, job_id, cost_code_id, budgeted_amount, billed_amount, v2_jobs(name), v2_cost_codes(code, name)');

    const budgetOverruns = (budgets || []).filter(b =>
      parseFloat(b.billed_amount || 0) > parseFloat(b.budgeted_amount || 0)
    );

    // 3. Pending Approvals - Invoices
    const { data: pendingInvoices } = await supabase
      .from('v2_invoices')
      .select('id')
      .eq('status', 'needs_approval')
      .is('deleted_at', null);

    // 3b. Pending Approvals - POs
    const { data: pendingPOs } = await supabase
      .from('v2_purchase_orders')
      .select('id')
      .eq('approval_status', 'pending')
      .is('deleted_at', null);

    // 4. Open Punch Items
    const { data: punchItems } = await supabase
      .from('v2_punch_items')
      .select('id, punch_list_id, description, status')
      .in('status', ['open', 'in_progress'])
      .limit(20);

    // 5. Overdue Inspections (past scheduled_date with status 'scheduled')
    const { data: overdueInspections } = await supabase
      .from('v2_inspections')
      .select('id, job_id, type, scheduled_date, v2_jobs(name)')
      .lt('scheduled_date', today)
      .eq('status', 'scheduled')
      .order('scheduled_date', { ascending: true })
      .limit(10);

    res.json({
      inspections: {
        count: (inspections || []).length,
        items: inspections || []
      },
      budgetOverruns: {
        count: budgetOverruns.length,
        items: budgetOverruns.slice(0, 10)
      },
      pendingApprovals: {
        invoices: (pendingInvoices || []).length,
        pos: (pendingPOs || []).length
      },
      punchItems: {
        count: (punchItems || []).length,
        items: punchItems || []
      },
      overdueInspections: {
        count: (overdueInspections || []).length,
        items: overdueInspections || []
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get recent activity across all entities
router.get('/activity', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const activities = [];

    // Recent invoices
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('id, invoice_number, amount, status, created_at, v2_vendors(name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5);

    (invoices || []).forEach(inv => {
      activities.push({
        type: 'invoice',
        icon: '📄',
        text: `Invoice #${inv.invoice_number || 'N/A'} from ${inv.v2_vendors?.name || 'Unknown'} - ${formatMoney(inv.amount)}`,
        status: inv.status,
        timestamp: inv.created_at
      });
    });

    // Recent PO activity
    const { data: poActivity } = await supabase
      .from('v2_po_activity')
      .select('id, action, details, created_at, v2_purchase_orders(po_number)')
      .order('created_at', { ascending: false })
      .limit(5);

    (poActivity || []).forEach(act => {
      activities.push({
        type: 'po',
        icon: '📋',
        text: `PO ${act.v2_purchase_orders?.po_number || 'Unknown'}: ${act.action}`,
        timestamp: act.created_at
      });
    });

    // Recent inspections with results
    const { data: recentInspections } = await supabase
      .from('v2_inspections')
      .select('id, type, status, result_date, v2_jobs(name)')
      .not('result_date', 'is', null)
      .order('result_date', { ascending: false })
      .limit(5);

    (recentInspections || []).forEach(insp => {
      activities.push({
        type: 'inspection',
        icon: '🔍',
        text: `${insp.type} inspection ${insp.status} - ${insp.v2_jobs?.name || 'Unknown Job'}`,
        status: insp.status,
        timestamp: insp.result_date
      });
    });

    // Sort by timestamp and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json(activities.slice(0, limit));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function formatMoney(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0
  }).format(amount || 0);
}

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

