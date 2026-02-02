/**
 * Historical Costs Routes
 * Cost trending and analytics for construction projects
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============================================================
// STATS (must be before other routes)
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { cost_code_id, vendor_id, year } = req.query;

  let query = supabase
    .from('v2_historical_costs')
    .select('id, source, total_cost, cost_date, year');

  if (cost_code_id) query = query.eq('cost_code_id', cost_code_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (year) query = query.eq('year', parseInt(year));

  const { data: costs, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total_records: costs.length,
    total_value: 0,
    by_source: {},
    by_year: {}
  };

  for (const c of costs) {
    stats.total_value += parseFloat(c.total_cost || 0);
    stats.by_source[c.source] = (stats.by_source[c.source] || 0) + 1;
    stats.by_year[c.year] = (stats.by_year[c.year] || 0) + 1;
  }

  res.json(stats);
}));

// ============================================================
// LIST HISTORICAL COSTS
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const {
    cost_code_id,
    vendor_id,
    job_id,
    source,
    year,
    limit = 100,
    offset = 0
  } = req.query;

  let query = supabase
    .from('v2_historical_costs')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name),
      vendor:v2_vendors(id, name),
      job:v2_jobs(id, name)
    `)
    .order('cost_date', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  // Apply filters
  if (cost_code_id) query = query.eq('cost_code_id', cost_code_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (job_id) query = query.eq('job_id', job_id);
  if (source) query = query.eq('source', source);
  if (year) query = query.eq('year', parseInt(year));

  const { data: costs, error, count } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({
    data: costs || [],
    total: count || (costs || []).length,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
}));

// ============================================================
// GET COST TRENDS OVER TIME
// ============================================================

router.get('/trends', asyncHandler(async (req, res) => {
  const {
    cost_code_id,
    vendor_id,
    unit_type,
    period = 'month',  // month, quarter, year
    limit = 24
  } = req.query;

  if (!cost_code_id) {
    throw new AppError('VALIDATION_ERROR', 'cost_code_id is required for trends');
  }

  // Get raw data for the cost code
  let query = supabase
    .from('v2_historical_costs')
    .select('*')
    .eq('cost_code_id', cost_code_id)
    .order('cost_date', { ascending: false })
    .limit(500);

  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (unit_type) query = query.eq('unit_type', unit_type);

  const { data: costs, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Group by period
  const periodData = {};
  for (const cost of (costs || [])) {
    let periodKey;
    const date = new Date(cost.cost_date);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const quarter = Math.ceil(month / 3);

    switch (period) {
      case 'quarter':
        periodKey = `${year}-Q${quarter}`;
        break;
      case 'year':
        periodKey = `${year}`;
        break;
      default: // month
        periodKey = `${year}-${String(month).padStart(2, '0')}`;
    }

    if (!periodData[periodKey]) {
      periodData[periodKey] = {
        period: periodKey,
        count: 0,
        total_cost: 0,
        total_quantity: 0,
        unit_costs: []
      };
    }

    const pd = periodData[periodKey];
    pd.count++;
    pd.total_cost += parseFloat(cost.total_cost || 0);
    pd.total_quantity += parseFloat(cost.quantity || 1);
    if (cost.unit_cost) {
      pd.unit_costs.push(parseFloat(cost.unit_cost));
    }
  }

  // Calculate averages and format response
  const trends = Object.values(periodData)
    .map(pd => ({
      period: pd.period,
      count: pd.count,
      total_cost: pd.total_cost,
      avg_total_cost: pd.total_cost / pd.count,
      avg_unit_cost: pd.unit_costs.length > 0
        ? pd.unit_costs.reduce((a, b) => a + b, 0) / pd.unit_costs.length
        : null,
      min_unit_cost: pd.unit_costs.length > 0 ? Math.min(...pd.unit_costs) : null,
      max_unit_cost: pd.unit_costs.length > 0 ? Math.max(...pd.unit_costs) : null
    }))
    .sort((a, b) => a.period.localeCompare(b.period))
    .slice(-parseInt(limit));

  // Calculate overall trend (linear regression on avg_unit_cost)
  let trendDirection = 'stable';
  let trendPercent = 0;

  if (trends.length >= 2) {
    const withUnitCosts = trends.filter(t => t.avg_unit_cost !== null);
    if (withUnitCosts.length >= 2) {
      const first = withUnitCosts[0].avg_unit_cost;
      const last = withUnitCosts[withUnitCosts.length - 1].avg_unit_cost;
      trendPercent = ((last - first) / first) * 100;
      trendDirection = trendPercent > 5 ? 'increasing' : trendPercent < -5 ? 'decreasing' : 'stable';
    }
  }

  res.json({
    cost_code_id,
    period,
    trends,
    summary: {
      total_records: costs.length,
      trend_direction: trendDirection,
      trend_percent: trendPercent,
      first_date: costs.length > 0 ? costs[costs.length - 1].cost_date : null,
      last_date: costs.length > 0 ? costs[0].cost_date : null
    }
  });
}));

// ============================================================
// GET AVERAGE COST PER UNIT
// ============================================================

router.get('/average', asyncHandler(async (req, res) => {
  const {
    cost_code_id,
    vendor_id,
    unit_type,
    months = 12,  // Look back period
    job_type
  } = req.query;

  if (!cost_code_id) {
    throw new AppError('VALIDATION_ERROR', 'cost_code_id is required');
  }

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  let query = supabase
    .from('v2_historical_costs')
    .select(`
      unit_cost,
      quantity,
      total_cost,
      unit_type,
      vendor_id,
      job_type,
      cost_date,
      vendor:v2_vendors(name)
    `)
    .eq('cost_code_id', cost_code_id)
    .gte('cost_date', startDate.toISOString().split('T')[0])
    .lte('cost_date', endDate.toISOString().split('T')[0]);

  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (unit_type) query = query.eq('unit_type', unit_type);
  if (job_type) query = query.eq('job_type', job_type);

  const { data: costs, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  if (!costs || costs.length === 0) {
    return res.json({
      cost_code_id,
      count: 0,
      average: null,
      min: null,
      max: null,
      median: null,
      by_vendor: [],
      by_unit_type: {}
    });
  }

  // Calculate overall statistics
  const unitCosts = costs
    .filter(c => c.unit_cost !== null)
    .map(c => parseFloat(c.unit_cost));

  const sorted = [...unitCosts].sort((a, b) => a - b);
  const median = sorted.length > 0
    ? sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)]
    : null;

  // Group by vendor
  const byVendor = {};
  for (const cost of costs) {
    const vendorId = cost.vendor_id || 'unknown';
    if (!byVendor[vendorId]) {
      byVendor[vendorId] = {
        vendor_id: vendorId,
        vendor_name: cost.vendor?.name || 'Unknown',
        count: 0,
        total: 0,
        unit_costs: []
      };
    }
    byVendor[vendorId].count++;
    byVendor[vendorId].total += parseFloat(cost.total_cost || 0);
    if (cost.unit_cost) {
      byVendor[vendorId].unit_costs.push(parseFloat(cost.unit_cost));
    }
  }

  const vendorStats = Object.values(byVendor).map(v => ({
    vendor_id: v.vendor_id,
    vendor_name: v.vendor_name,
    count: v.count,
    total: v.total,
    avg_unit_cost: v.unit_costs.length > 0
      ? v.unit_costs.reduce((a, b) => a + b, 0) / v.unit_costs.length
      : null
  })).sort((a, b) => (b.avg_unit_cost || 0) - (a.avg_unit_cost || 0));

  // Group by unit type
  const byUnitType = {};
  for (const cost of costs) {
    const ut = cost.unit_type || 'unknown';
    if (!byUnitType[ut]) {
      byUnitType[ut] = { count: 0, total: 0, unit_costs: [] };
    }
    byUnitType[ut].count++;
    byUnitType[ut].total += parseFloat(cost.total_cost || 0);
    if (cost.unit_cost) {
      byUnitType[ut].unit_costs.push(parseFloat(cost.unit_cost));
    }
  }

  const unitTypeStats = {};
  for (const [ut, data] of Object.entries(byUnitType)) {
    unitTypeStats[ut] = {
      count: data.count,
      total: data.total,
      avg_unit_cost: data.unit_costs.length > 0
        ? data.unit_costs.reduce((a, b) => a + b, 0) / data.unit_costs.length
        : null
    };
  }

  res.json({
    cost_code_id,
    period_months: parseInt(months),
    count: costs.length,
    average: unitCosts.length > 0
      ? unitCosts.reduce((a, b) => a + b, 0) / unitCosts.length
      : null,
    min: unitCosts.length > 0 ? Math.min(...unitCosts) : null,
    max: unitCosts.length > 0 ? Math.max(...unitCosts) : null,
    median,
    by_vendor: vendorStats,
    by_unit_type: unitTypeStats
  });
}));

// ============================================================
// COMPARE VENDORS FOR A COST CODE
// ============================================================

router.get('/compare-vendors', asyncHandler(async (req, res) => {
  const { cost_code_id, months = 12 } = req.query;

  if (!cost_code_id) {
    throw new AppError('VALIDATION_ERROR', 'cost_code_id is required');
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  const { data: costs, error } = await supabase
    .from('v2_historical_costs')
    .select(`
      vendor_id,
      unit_cost,
      total_cost,
      cost_date,
      vendor:v2_vendors(id, name)
    `)
    .eq('cost_code_id', cost_code_id)
    .gte('cost_date', startDate.toISOString().split('T')[0])
    .not('vendor_id', 'is', null);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Group by vendor
  const vendorData = {};
  for (const cost of (costs || [])) {
    const vid = cost.vendor_id;
    if (!vendorData[vid]) {
      vendorData[vid] = {
        vendor_id: vid,
        vendor_name: cost.vendor?.name || 'Unknown',
        invoices: 0,
        total_spent: 0,
        unit_costs: [],
        last_cost_date: null
      };
    }
    vendorData[vid].invoices++;
    vendorData[vid].total_spent += parseFloat(cost.total_cost || 0);
    if (cost.unit_cost) {
      vendorData[vid].unit_costs.push(parseFloat(cost.unit_cost));
    }
    if (!vendorData[vid].last_cost_date || cost.cost_date > vendorData[vid].last_cost_date) {
      vendorData[vid].last_cost_date = cost.cost_date;
    }
  }

  // Calculate stats and rank
  const comparison = Object.values(vendorData)
    .map(v => ({
      vendor_id: v.vendor_id,
      vendor_name: v.vendor_name,
      invoice_count: v.invoices,
      total_spent: v.total_spent,
      avg_unit_cost: v.unit_costs.length > 0
        ? v.unit_costs.reduce((a, b) => a + b, 0) / v.unit_costs.length
        : null,
      min_unit_cost: v.unit_costs.length > 0 ? Math.min(...v.unit_costs) : null,
      max_unit_cost: v.unit_costs.length > 0 ? Math.max(...v.unit_costs) : null,
      last_cost_date: v.last_cost_date
    }))
    .sort((a, b) => (a.avg_unit_cost || Infinity) - (b.avg_unit_cost || Infinity));

  // Add ranking
  comparison.forEach((v, idx) => {
    v.rank = idx + 1;
  });

  res.json({
    cost_code_id,
    period_months: parseInt(months),
    vendor_count: comparison.length,
    vendors: comparison,
    best_value: comparison[0] || null,
    most_used: [...comparison].sort((a, b) => b.invoice_count - a.invoice_count)[0] || null
  });
}));

// ============================================================
// MANUALLY ADD COST DATA
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    cost_code_id,
    vendor_id,
    description,
    unit_type,
    unit_cost,
    quantity,
    total_cost,
    cost_date,
    source = 'manual',
    job_type,
    sqft,
    location
  } = req.body;

  // Calculate total_cost if not provided
  const calculatedTotal = total_cost !== undefined
    ? total_cost
    : (parseFloat(unit_cost || 0) * parseFloat(quantity || 1));

  const { data: cost, error } = await supabase
    .from('v2_historical_costs')
    .insert({
      job_id: job_id || null,
      cost_code_id: cost_code_id || null,
      vendor_id: vendor_id || null,
      description: description || null,
      unit_type: unit_type || null,
      unit_cost: unit_cost !== undefined ? parseFloat(unit_cost) : null,
      quantity: parseFloat(quantity || 1),
      total_cost: calculatedTotal,
      cost_date: cost_date || new Date().toISOString().split('T')[0],
      source: source,
      job_type: job_type || null,
      sqft: sqft ? parseInt(sqft) : null,
      location: location || null
    })
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name),
      vendor:v2_vendors(id, name),
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.status(201).json(cost);
}));

// ============================================================
// BULK IMPORT COSTS
// ============================================================

router.post('/bulk', asyncHandler(async (req, res) => {
  const { costs } = req.body;

  if (!Array.isArray(costs) || costs.length === 0) {
    throw new AppError('VALIDATION_ERROR', 'costs array is required');
  }

  if (costs.length > 500) {
    throw new AppError('VALIDATION_ERROR', 'Maximum 500 costs per bulk import');
  }

  // Format all costs
  const formatted = costs.map(c => ({
    job_id: c.job_id || null,
    cost_code_id: c.cost_code_id || null,
    vendor_id: c.vendor_id || null,
    description: c.description || null,
    unit_type: c.unit_type || null,
    unit_cost: c.unit_cost !== undefined ? parseFloat(c.unit_cost) : null,
    quantity: parseFloat(c.quantity || 1),
    total_cost: c.total_cost !== undefined
      ? parseFloat(c.total_cost)
      : (parseFloat(c.unit_cost || 0) * parseFloat(c.quantity || 1)),
    cost_date: c.cost_date || new Date().toISOString().split('T')[0],
    source: c.source || 'manual',
    job_type: c.job_type || null,
    sqft: c.sqft ? parseInt(c.sqft) : null,
    location: c.location || null
  }));

  const { data: inserted, error } = await supabase
    .from('v2_historical_costs')
    .insert(formatted)
    .select('id');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.status(201).json({
    success: true,
    imported: (inserted || []).length,
    message: `Successfully imported ${(inserted || []).length} cost records`
  });
}));

// ============================================================
// DELETE COST RECORD
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: cost, error } = await supabase
    .from('v2_historical_costs')
    .delete()
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!cost) throw new AppError('NOT_FOUND', 'Cost record not found');

  res.json({ success: true, message: 'Cost record deleted' });
}));

// ============================================================
// CAPTURE COSTS FROM EXISTING INVOICES (one-time backfill)
// ============================================================

router.post('/backfill-from-invoices', asyncHandler(async (req, res) => {
  const { limit = 1000 } = req.body;

  // Get approved/paid invoices that haven't been captured yet
  const { data: invoices, error: invError } = await supabase
    .from('v2_invoices')
    .select(`
      id,
      job_id,
      vendor_id,
      invoice_number,
      invoice_date,
      description,
      job:v2_jobs(name, sqft, job_type, city)
    `)
    .in('status', ['approved', 'in_draw', 'paid'])
    .is('deleted_at', null)
    .limit(parseInt(limit));

  if (invError) throw new AppError('DATABASE_ERROR', invError.message);

  // Get existing source_ids to avoid duplicates
  const invoiceIds = (invoices || []).map(i => i.id);
  const { data: existing } = await supabase
    .from('v2_historical_costs')
    .select('source_id')
    .eq('source', 'invoice')
    .in('source_id', invoiceIds);

  const existingIds = new Set((existing || []).map(e => e.source_id));

  // Filter to invoices not yet captured
  const toCapture = (invoices || []).filter(i => !existingIds.has(i.id));

  if (toCapture.length === 0) {
    return res.json({
      success: true,
      message: 'No new invoices to capture',
      captured: 0
    });
  }

  // Get allocations for these invoices
  const toIds = toCapture.map(i => i.id);
  const { data: allocations, error: allocError } = await supabase
    .from('v2_invoice_allocations')
    .select('*')
    .in('invoice_id', toIds);

  if (allocError) throw new AppError('DATABASE_ERROR', allocError.message);

  // Build cost records
  const costsToInsert = [];
  const invoiceMap = {};
  for (const inv of toCapture) {
    invoiceMap[inv.id] = inv;
  }

  for (const alloc of (allocations || [])) {
    const inv = invoiceMap[alloc.invoice_id];
    if (!inv) continue;

    costsToInsert.push({
      job_id: inv.job_id,
      cost_code_id: alloc.cost_code_id,
      vendor_id: inv.vendor_id,
      description: alloc.notes || inv.description || `Invoice ${inv.invoice_number}`,
      unit_type: 'ls',
      unit_cost: parseFloat(alloc.amount || 0),
      quantity: 1,
      total_cost: parseFloat(alloc.amount || 0),
      cost_date: inv.invoice_date || new Date().toISOString().split('T')[0],
      source: 'invoice',
      source_id: inv.id,
      job_type: inv.job?.job_type || null,
      sqft: inv.job?.sqft || null,
      location: inv.job?.city || null
    });
  }

  if (costsToInsert.length === 0) {
    return res.json({
      success: true,
      message: 'No allocations found for new invoices',
      captured: 0
    });
  }

  // Insert costs
  const { data: inserted, error: insertError } = await supabase
    .from('v2_historical_costs')
    .insert(costsToInsert)
    .select('id');

  if (insertError) throw new AppError('DATABASE_ERROR', insertError.message);

  res.json({
    success: true,
    message: `Captured ${(inserted || []).length} cost records from ${toCapture.length} invoices`,
    captured: (inserted || []).length,
    invoices_processed: toCapture.length
  });
}));

module.exports = router;
