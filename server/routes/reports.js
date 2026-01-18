/**
 * Reports Routes
 * Financial summary endpoints for job cost, vendor spend, and category spend analysis
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../errors');

// ============================================================
// JOB COST REPORT
// GET /api/reports/job-cost/:jobId
// ============================================================

router.get('/job-cost/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { startDate, endDate } = req.query;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new AppError('JOB_NOT_FOUND', 'Job not found', { jobId });
  }

  // Get budget lines for the job
  const { data: budgetLines, error: budgetError } = await supabase
    .from('v2_budget_lines')
    .select(`
      id,
      budgeted_amount,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('job_id', jobId);

  if (budgetError) {
    throw new AppError('DATABASE_ERROR', budgetError.message);
  }

  // Get committed amounts from PO line items
  let poQuery = supabase
    .from('v2_po_line_items')
    .select(`
      id,
      amount,
      cost_code_id,
      purchase_order:v2_purchase_orders!inner(id, job_id, status)
    `)
    .eq('purchase_order.job_id', jobId)
    .neq('purchase_order.status', 'cancelled');

  const { data: poLineItems, error: poError } = await poQuery;

  if (poError) {
    throw new AppError('DATABASE_ERROR', poError.message);
  }

  // Get actual costs from invoice allocations (approved, in_draw, paid invoices only)
  let allocQuery = supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code_id,
      invoice:v2_invoices!inner(id, status, invoice_date)
    `)
    .eq('job_id', jobId)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  // Apply date filters if provided
  if (startDate) {
    allocQuery = allocQuery.gte('invoice.invoice_date', startDate);
  }
  if (endDate) {
    allocQuery = allocQuery.lte('invoice.invoice_date', endDate);
  }

  const { data: allocations, error: allocError } = await allocQuery;

  if (allocError) {
    throw new AppError('DATABASE_ERROR', allocError.message);
  }

  // Build cost code map with budget, committed, and actual amounts
  const costCodeMap = new Map();

  // Initialize with budget lines
  for (const bl of budgetLines || []) {
    if (bl.cost_code) {
      costCodeMap.set(bl.cost_code.id, {
        costCodeId: bl.cost_code.id,
        costCode: bl.cost_code.code,
        description: bl.cost_code.name,
        category: bl.cost_code.category,
        budget: parseFloat(bl.budgeted_amount) || 0,
        committed: 0,
        actual: 0
      });
    }
  }

  // Add committed amounts from PO line items
  for (const item of poLineItems || []) {
    const existing = costCodeMap.get(item.cost_code_id);
    if (existing) {
      existing.committed += parseFloat(item.amount) || 0;
    } else {
      // Cost code not in budget, but has PO committed
      costCodeMap.set(item.cost_code_id, {
        costCodeId: item.cost_code_id,
        costCode: 'Unknown',
        description: 'Unknown',
        category: null,
        budget: 0,
        committed: parseFloat(item.amount) || 0,
        actual: 0
      });
    }
  }

  // Add actual amounts from invoice allocations
  for (const alloc of allocations || []) {
    const existing = costCodeMap.get(alloc.cost_code_id);
    if (existing) {
      existing.actual += parseFloat(alloc.amount) || 0;
    } else {
      // Cost code not in budget or POs, but has invoices
      costCodeMap.set(alloc.cost_code_id, {
        costCodeId: alloc.cost_code_id,
        costCode: 'Unknown',
        description: 'Unknown',
        category: null,
        budget: 0,
        committed: 0,
        actual: parseFloat(alloc.amount) || 0
      });
    }
  }

  // Calculate variance and status for each line
  const lines = [];
  let totalBudget = 0;
  let totalCommitted = 0;
  let totalActual = 0;

  for (const [, item] of costCodeMap) {
    const variance = item.budget - item.actual;
    const variancePercent = item.budget > 0
      ? Math.round((variance / item.budget) * 100)
      : 0;

    let status;
    if (item.actual > item.budget) {
      status = 'over';
    } else if (item.budget > 0 && item.actual > item.budget * 0.9) {
      status = 'near';
    } else {
      status = 'under';
    }

    lines.push({
      costCode: item.costCode,
      description: item.description,
      category: item.category,
      budget: item.budget,
      committed: item.committed,
      actual: item.actual,
      variance,
      variancePercent,
      status
    });

    totalBudget += item.budget;
    totalCommitted += item.committed;
    totalActual += item.actual;
  }

  // Sort by cost code
  lines.sort((a, b) => a.costCode.localeCompare(b.costCode));

  const totalVariance = totalBudget - totalActual;
  const percentComplete = totalBudget > 0
    ? Math.round((totalActual / totalBudget) * 100)
    : 0;

  res.json({
    job: { id: job.id, name: job.name },
    period: { start: startDate || null, end: endDate || null },
    summary: {
      totalBudget,
      totalCommitted,
      totalActual,
      totalVariance,
      percentComplete
    },
    lines
  });
}));

// ============================================================
// VENDOR SPEND REPORT
// GET /api/reports/vendor-spend
// ============================================================

router.get('/vendor-spend', asyncHandler(async (req, res) => {
  const { jobId, startDate, endDate } = req.query;

  // Build query for invoices with vendor info
  let query = supabase
    .from('v2_invoices')
    .select(`
      id,
      amount,
      invoice_date,
      vendor_id,
      vendor:v2_vendors(id, name)
    `)
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid']);

  // Apply filters
  if (jobId) {
    query = query.eq('job_id', jobId);
  }
  if (startDate) {
    query = query.gte('invoice_date', startDate);
  }
  if (endDate) {
    query = query.lte('invoice_date', endDate);
  }

  const { data: invoices, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Get job name if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .single();
    jobName = job?.name || null;
  }

  // Group by vendor
  const vendorMap = new Map();

  for (const inv of invoices || []) {
    if (!inv.vendor_id) continue;

    const existing = vendorMap.get(inv.vendor_id);
    const amount = parseFloat(inv.amount) || 0;
    const invoiceDate = inv.invoice_date;

    if (existing) {
      existing.invoiceCount += 1;
      existing.totalSpend += amount;
      if (invoiceDate && (!existing.lastInvoiceDate || invoiceDate > existing.lastInvoiceDate)) {
        existing.lastInvoiceDate = invoiceDate;
      }
    } else {
      vendorMap.set(inv.vendor_id, {
        vendorId: inv.vendor_id,
        vendorName: inv.vendor?.name || 'Unknown',
        invoiceCount: 1,
        totalSpend: amount,
        lastInvoiceDate: invoiceDate || null
      });
    }
  }

  // Calculate stats and build result
  const vendors = [];
  let totalSpend = 0;
  let invoiceCount = 0;

  for (const [, v] of vendorMap) {
    v.avgInvoiceAmount = v.invoiceCount > 0
      ? Math.round(v.totalSpend / v.invoiceCount * 100) / 100
      : 0;
    vendors.push(v);
    totalSpend += v.totalSpend;
    invoiceCount += v.invoiceCount;
  }

  // Sort by total spend descending
  vendors.sort((a, b) => b.totalSpend - a.totalSpend);

  const avgInvoiceAmount = invoiceCount > 0
    ? Math.round(totalSpend / invoiceCount * 100) / 100
    : 0;

  res.json({
    period: { start: startDate || null, end: endDate || null },
    filters: { jobId: jobId || null, jobName },
    summary: {
      totalSpend,
      vendorCount: vendors.length,
      invoiceCount,
      avgInvoiceAmount
    },
    vendors
  });
}));

// ============================================================
// CATEGORY SPEND REPORT
// GET /api/reports/category-spend
// ============================================================

router.get('/category-spend', asyncHandler(async (req, res) => {
  const { jobId, startDate, endDate } = req.query;

  // Build query for invoice allocations with cost code info
  let query = supabase
    .from('v2_invoice_allocations')
    .select(`
      id,
      amount,
      cost_code:v2_cost_codes(id, code, name, category),
      invoice:v2_invoices!inner(id, status, invoice_date, job_id)
    `)
    .in('invoice.status', ['approved', 'in_draw', 'paid']);

  // Apply filters
  if (jobId) {
    query = query.eq('invoice.job_id', jobId);
  }
  if (startDate) {
    query = query.gte('invoice.invoice_date', startDate);
  }
  if (endDate) {
    query = query.lte('invoice.invoice_date', endDate);
  }

  const { data: allocations, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Get job name if filtered
  let jobName = null;
  if (jobId) {
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('name')
      .eq('id', jobId)
      .single();
    jobName = job?.name || null;
  }

  // Group by category (first 2 digits of cost code)
  const categoryMap = new Map();
  const costCodesByCategory = new Map();

  for (const alloc of allocations || []) {
    if (!alloc.cost_code) continue;

    const code = alloc.cost_code.code || '';
    const categoryCode = code.substring(0, 2);
    const categoryName = alloc.cost_code.category || getCategoryName(categoryCode);
    const amount = parseFloat(alloc.amount) || 0;

    const key = categoryCode;
    const existing = categoryMap.get(key);

    // Track unique cost codes per category
    if (!costCodesByCategory.has(key)) {
      costCodesByCategory.set(key, new Set());
    }
    costCodesByCategory.get(key).add(alloc.cost_code.id);

    if (existing) {
      existing.totalSpend += amount;
    } else {
      categoryMap.set(key, {
        categoryCode,
        categoryName,
        totalSpend: amount
      });
    }
  }

  // Calculate total spend and build result
  let totalSpend = 0;
  for (const [, cat] of categoryMap) {
    totalSpend += cat.totalSpend;
  }

  const categories = [];
  for (const [key, cat] of categoryMap) {
    const costCodeCount = costCodesByCategory.get(key)?.size || 0;
    const percentOfTotal = totalSpend > 0
      ? Math.round((cat.totalSpend / totalSpend) * 1000) / 10
      : 0;

    categories.push({
      categoryCode: cat.categoryCode,
      categoryName: cat.categoryName,
      costCodeCount,
      totalSpend: cat.totalSpend,
      percentOfTotal
    });
  }

  // Sort by total spend descending
  categories.sort((a, b) => b.totalSpend - a.totalSpend);

  res.json({
    period: { start: startDate || null, end: endDate || null },
    filters: { jobId: jobId || null, jobName },
    summary: {
      totalSpend,
      categoryCount: categories.length
    },
    categories
  });
}));

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Get category name from CSI MasterFormat division code
 */
function getCategoryName(divisionCode) {
  const divisions = {
    '01': 'General Requirements',
    '02': 'Site Construction',
    '03': 'Concrete',
    '04': 'Masonry',
    '05': 'Metals',
    '06': 'Wood & Plastics',
    '07': 'Thermal & Moisture Protection',
    '08': 'Doors & Windows',
    '09': 'Finishes',
    '10': 'Specialties',
    '11': 'Equipment',
    '12': 'Furnishings',
    '13': 'Special Construction',
    '14': 'Conveying Systems',
    '15': 'Mechanical',
    '16': 'Electrical',
    '21': 'Fire Suppression',
    '22': 'Plumbing',
    '23': 'HVAC',
    '26': 'Electrical',
    '27': 'Communications',
    '31': 'Earthwork',
    '32': 'Exterior Improvements',
    '33': 'Utilities'
  };
  return divisions[divisionCode] || 'Other';
}

module.exports = router;
