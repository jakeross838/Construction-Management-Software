/**
 * Spend Analytics Routes
 * API endpoints for vendor spend analysis and negotiation insights
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// VENDOR SPEND
// ============================================================

/**
 * GET /api/spend/by-vendor
 * Get spend breakdown by vendor
 */
router.get('/by-vendor', asyncHandler(async (req, res) => {
  const { year, job_id, limit = 25 } = req.query;

  // Build date filter
  let dateFilter = {};
  if (year) {
    dateFilter = {
      gte: `${year}-01-01`,
      lte: `${year}-12-31`
    };
  }

  // Get invoices grouped by vendor
  let query = supabase
    .from('v2_invoices')
    .select('vendor_id, amount, invoice_date, vendor:v2_vendors(name)')
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid']);

  if (year) {
    query = query
      .gte('invoice_date', `${year}-01-01`)
      .lte('invoice_date', `${year}-12-31`);
  }

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: invoices, error } = await query;
  if (error) throw new AppError(error.message, 500);

  // Aggregate by vendor
  const vendorSpend = new Map();
  for (const inv of (invoices || [])) {
    if (!inv.vendor_id) continue;

    if (!vendorSpend.has(inv.vendor_id)) {
      vendorSpend.set(inv.vendor_id, {
        vendor_id: inv.vendor_id,
        vendor_name: inv.vendor?.name || 'Unknown',
        invoice_count: 0,
        total_spend: 0,
        avg_invoice: 0,
        first_invoice: inv.invoice_date,
        last_invoice: inv.invoice_date
      });
    }

    const v = vendorSpend.get(inv.vendor_id);
    v.invoice_count++;
    v.total_spend += parseFloat(inv.amount || 0);
    if (inv.invoice_date < v.first_invoice) v.first_invoice = inv.invoice_date;
    if (inv.invoice_date > v.last_invoice) v.last_invoice = inv.invoice_date;
  }

  // Calculate averages and sort
  const result = Array.from(vendorSpend.values())
    .map(v => ({
      ...v,
      avg_invoice: v.invoice_count > 0 ? v.total_spend / v.invoice_count : 0
    }))
    .sort((a, b) => b.total_spend - a.total_spend)
    .slice(0, parseInt(limit));

  // Calculate total for percentage
  const totalSpend = result.reduce((sum, v) => sum + v.total_spend, 0);

  res.json({
    vendors: result.map(v => ({
      ...v,
      spend_percent: totalSpend > 0 ? ((v.total_spend / totalSpend) * 100).toFixed(1) : 0
    })),
    total_spend: totalSpend,
    vendor_count: vendorSpend.size
  });
}));

/**
 * GET /api/spend/by-category
 * Get spend breakdown by cost code category
 */
router.get('/by-category', asyncHandler(async (req, res) => {
  const { year, job_id } = req.query;

  // Get allocations with cost codes
  let query = supabase
    .from('v2_invoice_allocations')
    .select('amount, cost_code:v2_cost_codes(code, name, category), invoice:v2_invoices(invoice_date, status, deleted_at)');

  const { data: allocations, error } = await query;
  if (error) throw new AppError(error.message, 500);

  // Filter and aggregate
  const categorySpend = new Map();
  for (const alloc of (allocations || [])) {
    // Skip deleted or non-approved invoices
    if (alloc.invoice?.deleted_at) continue;
    if (!['approved', 'in_draw', 'paid'].includes(alloc.invoice?.status)) continue;

    // Apply date filter
    if (year) {
      const invDate = alloc.invoice?.invoice_date;
      if (!invDate || !invDate.startsWith(year)) continue;
    }

    const category = alloc.cost_code?.category || 'Uncategorized';
    if (!categorySpend.has(category)) {
      categorySpend.set(category, {
        category,
        total_spend: 0,
        allocation_count: 0,
        cost_codes: new Set()
      });
    }

    const cat = categorySpend.get(category);
    cat.total_spend += parseFloat(alloc.amount || 0);
    cat.allocation_count++;
    if (alloc.cost_code?.code) {
      cat.cost_codes.add(alloc.cost_code.code);
    }
  }

  const result = Array.from(categorySpend.values())
    .map(c => ({
      category: c.category,
      total_spend: c.total_spend,
      allocation_count: c.allocation_count,
      cost_code_count: c.cost_codes.size
    }))
    .sort((a, b) => b.total_spend - a.total_spend);

  const totalSpend = result.reduce((sum, c) => sum + c.total_spend, 0);

  res.json({
    categories: result.map(c => ({
      ...c,
      spend_percent: totalSpend > 0 ? ((c.total_spend / totalSpend) * 100).toFixed(1) : 0
    })),
    total_spend: totalSpend
  });
}));

/**
 * GET /api/spend/trends
 * Get spend trends over time
 */
router.get('/trends', asyncHandler(async (req, res) => {
  const { months = 12, vendor_id, category } = req.query;

  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - parseInt(months));

  let query = supabase
    .from('v2_invoices')
    .select('vendor_id, amount, invoice_date, vendor:v2_vendors(name)')
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid'])
    .gte('invoice_date', startDate.toISOString().split('T')[0])
    .order('invoice_date');

  if (vendor_id) {
    query = query.eq('vendor_id', vendor_id);
  }

  const { data: invoices, error } = await query;
  if (error) throw new AppError(error.message, 500);

  // Group by month
  const monthlySpend = new Map();
  for (const inv of (invoices || [])) {
    const date = new Date(inv.invoice_date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlySpend.has(monthKey)) {
      monthlySpend.set(monthKey, {
        month: monthKey,
        total_spend: 0,
        invoice_count: 0,
        vendors: new Set()
      });
    }

    const m = monthlySpend.get(monthKey);
    m.total_spend += parseFloat(inv.amount || 0);
    m.invoice_count++;
    if (inv.vendor_id) m.vendors.add(inv.vendor_id);
  }

  // Fill in missing months
  const current = new Date();
  for (let i = 0; i < parseInt(months); i++) {
    const date = new Date(current);
    date.setMonth(current.getMonth() - i);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (!monthlySpend.has(key)) {
      monthlySpend.set(key, {
        month: key,
        total_spend: 0,
        invoice_count: 0,
        vendors: new Set()
      });
    }
  }

  const result = Array.from(monthlySpend.values())
    .map(m => ({
      month: m.month,
      total_spend: m.total_spend,
      invoice_count: m.invoice_count,
      vendor_count: m.vendors.size
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Calculate trend
  const recentMonths = result.slice(-3);
  const olderMonths = result.slice(-6, -3);
  const recentAvg = recentMonths.reduce((s, m) => s + m.total_spend, 0) / 3;
  const olderAvg = olderMonths.length > 0
    ? olderMonths.reduce((s, m) => s + m.total_spend, 0) / olderMonths.length
    : recentAvg;

  const trendPercent = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg * 100) : 0;

  res.json({
    monthly_data: result,
    trend: {
      direction: trendPercent > 5 ? 'increasing' : trendPercent < -5 ? 'decreasing' : 'stable',
      percent_change: trendPercent.toFixed(1),
      recent_3mo_avg: recentAvg,
      prior_3mo_avg: olderAvg
    }
  });
}));

// ============================================================
// NEGOTIATION INSIGHTS
// ============================================================

/**
 * GET /api/spend/negotiation-targets
 * Identify high-spend vendors for negotiation
 */
router.get('/negotiation-targets', asyncHandler(async (req, res) => {
  const { min_spend = 10000, year } = req.query;

  // Get vendor spend data
  let query = supabase
    .from('v2_invoices')
    .select('vendor_id, amount, invoice_date, vendor:v2_vendors(name, delivery_fee, free_delivery_minimum)')
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid']);

  if (year) {
    query = query
      .gte('invoice_date', `${year}-01-01`)
      .lte('invoice_date', `${year}-12-31`);
  }

  const { data: invoices, error } = await query;
  if (error) throw new AppError(error.message, 500);

  // Aggregate by vendor
  const vendorData = new Map();
  for (const inv of (invoices || [])) {
    if (!inv.vendor_id) continue;

    if (!vendorData.has(inv.vendor_id)) {
      vendorData.set(inv.vendor_id, {
        vendor_id: inv.vendor_id,
        vendor_name: inv.vendor?.name || 'Unknown',
        delivery_fee: inv.vendor?.delivery_fee,
        free_delivery_minimum: inv.vendor?.free_delivery_minimum,
        invoices: [],
        total_spend: 0
      });
    }

    const v = vendorData.get(inv.vendor_id);
    v.invoices.push(inv);
    v.total_spend += parseFloat(inv.amount || 0);
  }

  // Filter by minimum spend and calculate insights
  const targets = Array.from(vendorData.values())
    .filter(v => v.total_spend >= parseFloat(min_spend))
    .map(v => {
      // Calculate frequency
      const invoiceCount = v.invoices.length;

      // Calculate consistency (coefficient of variation)
      const amounts = v.invoices.map(i => parseFloat(i.amount || 0));
      const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const stdDev = Math.sqrt(
        amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length
      );
      const cv = mean > 0 ? stdDev / mean : 0;

      // Negotiation potential score (higher spend + higher frequency = better target)
      const negotiationScore = Math.log10(v.total_spend) * Math.log10(invoiceCount + 1) * 10;

      // Suggested discount based on spend tier
      let suggestedDiscount;
      if (v.total_spend >= 100000) suggestedDiscount = '5-8%';
      else if (v.total_spend >= 50000) suggestedDiscount = '3-5%';
      else if (v.total_spend >= 25000) suggestedDiscount = '2-4%';
      else suggestedDiscount = '1-3%';

      return {
        vendor_id: v.vendor_id,
        vendor_name: v.vendor_name,
        total_spend: v.total_spend,
        invoice_count: invoiceCount,
        avg_invoice: mean,
        spend_consistency: cv < 0.5 ? 'consistent' : cv < 1 ? 'moderate' : 'variable',
        negotiation_score: negotiationScore.toFixed(1),
        suggested_discount: suggestedDiscount,
        potential_savings: v.total_spend * 0.03, // Conservative 3% estimate
        insights: []
      };
    })
    .sort((a, b) => parseFloat(b.negotiation_score) - parseFloat(a.negotiation_score));

  // Add specific insights
  for (const target of targets) {
    if (target.total_spend > 50000) {
      target.insights.push(`High volume (${target.invoice_count} invoices) - strong negotiating position`);
    }
    if (target.spend_consistency === 'consistent') {
      target.insights.push('Consistent ordering pattern - ideal for volume commitment');
    }
    if (target.avg_invoice > 5000) {
      target.insights.push('Large average order size - consider early payment discount');
    }
  }

  res.json({
    targets,
    summary: {
      total_targets: targets.length,
      total_spend_with_targets: targets.reduce((s, t) => s + t.total_spend, 0),
      total_potential_savings: targets.reduce((s, t) => s + t.potential_savings, 0)
    }
  });
}));

/**
 * GET /api/spend/vendor/:vendorId/detail
 * Get detailed spend analysis for a specific vendor
 */
router.get('/vendor/:vendorId/detail', asyncHandler(async (req, res) => {
  const { vendorId } = req.params;

  // Get vendor info
  const { data: vendor } = await supabase
    .from('v2_vendors')
    .select('*')
    .eq('id', vendorId)
    .single();

  if (!vendor) throw new AppError('Vendor not found', 404);

  // Get all invoices for this vendor
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, amount, invoice_date, job_id, job:v2_jobs(name)')
    .eq('vendor_id', vendorId)
    .is('deleted_at', null)
    .in('status', ['approved', 'in_draw', 'paid'])
    .order('invoice_date', { ascending: false });

  // Get PO data
  const { data: pos } = await supabase
    .from('v2_purchase_orders')
    .select('id, total_amount, status, created_at')
    .eq('vendor_id', vendorId)
    .is('deleted_at', null);

  // Get price history for this vendor
  const { data: prices } = await supabase
    .from('v2_price_history')
    .select('unit_price, price_date, master_item:v2_master_items(standard_name, category)')
    .eq('vendor_id', vendorId)
    .order('price_date', { ascending: false })
    .limit(50);

  // Calculate metrics
  const totalSpend = invoices?.reduce((s, i) => s + parseFloat(i.amount || 0), 0) || 0;
  const invoiceCount = invoices?.length || 0;

  // Spend by job
  const jobSpend = new Map();
  for (const inv of (invoices || [])) {
    const jobId = inv.job_id || 'unassigned';
    if (!jobSpend.has(jobId)) {
      jobSpend.set(jobId, {
        job_id: inv.job_id,
        job_name: inv.job?.name || 'Unassigned',
        total: 0,
        count: 0
      });
    }
    const j = jobSpend.get(jobId);
    j.total += parseFloat(inv.amount || 0);
    j.count++;
  }

  // Monthly trend
  const monthlySpend = new Map();
  for (const inv of (invoices || [])) {
    const month = inv.invoice_date?.substring(0, 7);
    if (!month) continue;
    monthlySpend.set(month, (monthlySpend.get(month) || 0) + parseFloat(inv.amount || 0));
  }

  res.json({
    vendor,
    metrics: {
      total_spend: totalSpend,
      invoice_count: invoiceCount,
      avg_invoice: invoiceCount > 0 ? totalSpend / invoiceCount : 0,
      po_count: pos?.length || 0,
      po_total: pos?.reduce((s, p) => s + parseFloat(p.total_amount || 0), 0) || 0,
      price_points: prices?.length || 0
    },
    spend_by_job: Array.from(jobSpend.values()).sort((a, b) => b.total - a.total),
    monthly_trend: Array.from(monthlySpend.entries())
      .map(([month, spend]) => ({ month, spend }))
      .sort((a, b) => a.month.localeCompare(b.month)),
    recent_prices: prices || [],
    recent_invoices: invoices?.slice(0, 10) || []
  });
}));

// ============================================================
// COMPARISON & BENCHMARKS
// ============================================================

/**
 * GET /api/spend/price-comparison
 * Compare prices across vendors for specific items
 */
router.get('/price-comparison', asyncHandler(async (req, res) => {
  const { category, limit = 20 } = req.query;

  let query = supabase
    .from('v2_current_prices')
    .select('*');

  if (category) {
    query = query.eq('category', category);
  }

  const { data: prices, error } = await query.limit(500);
  if (error) throw new AppError(error.message, 500);

  // Group by master item
  const itemPrices = new Map();
  for (const price of (prices || [])) {
    if (!itemPrices.has(price.master_item_id)) {
      itemPrices.set(price.master_item_id, {
        master_item_id: price.master_item_id,
        standard_name: price.standard_name,
        category: price.category,
        vendors: []
      });
    }

    itemPrices.get(price.master_item_id).vendors.push({
      vendor_id: price.vendor_id,
      vendor_name: price.vendor_name,
      unit_price: price.unit_price,
      price_date: price.price_date
    });
  }

  // Calculate price spread for items with multiple vendors
  const comparisons = Array.from(itemPrices.values())
    .filter(item => item.vendors.length > 1)
    .map(item => {
      const sortedPrices = item.vendors.sort((a, b) => a.unit_price - b.unit_price);
      const lowest = sortedPrices[0];
      const highest = sortedPrices[sortedPrices.length - 1];
      const spread = highest.unit_price - lowest.unit_price;
      const spreadPercent = lowest.unit_price > 0
        ? (spread / lowest.unit_price * 100)
        : 0;

      return {
        ...item,
        vendor_count: item.vendors.length,
        lowest_price: lowest.unit_price,
        lowest_vendor: lowest.vendor_name,
        highest_price: highest.unit_price,
        highest_vendor: highest.vendor_name,
        price_spread: spread,
        spread_percent: spreadPercent.toFixed(1)
      };
    })
    .sort((a, b) => parseFloat(b.spread_percent) - parseFloat(a.spread_percent))
    .slice(0, parseInt(limit));

  res.json({
    comparisons,
    summary: {
      items_compared: comparisons.length,
      avg_spread_percent: comparisons.length > 0
        ? (comparisons.reduce((s, c) => s + parseFloat(c.spread_percent), 0) / comparisons.length).toFixed(1)
        : 0
    }
  });
}));

/**
 * GET /api/spend/dashboard
 * Get spend analytics dashboard data
 */
router.get('/dashboard', asyncHandler(async (req, res) => {
  const currentYear = new Date().getFullYear();

  // Run all queries in parallel
  const [
    vendorSpendRes,
    categorySpendRes,
    trendsRes,
    targetsRes
  ] = await Promise.all([
    // Top vendors
    supabase
      .from('v2_invoices')
      .select('vendor_id, amount, vendor:v2_vendors(name)')
      .is('deleted_at', null)
      .in('status', ['approved', 'in_draw', 'paid'])
      .gte('invoice_date', `${currentYear}-01-01`),

    // Allocations for categories
    supabase
      .from('v2_invoice_allocations')
      .select('amount, cost_code:v2_cost_codes(category)'),

    // Monthly totals
    supabase
      .from('v2_invoices')
      .select('amount, invoice_date')
      .is('deleted_at', null)
      .in('status', ['approved', 'in_draw', 'paid'])
      .gte('invoice_date', new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0]),

    // Savings potential
    supabase
      .from('v2_current_prices')
      .select('master_item_id, unit_price')
  ]);

  // Process vendor spend
  const vendorSpend = new Map();
  for (const inv of (vendorSpendRes.data || [])) {
    if (!inv.vendor_id) continue;
    const current = vendorSpend.get(inv.vendor_id) || { name: inv.vendor?.name, total: 0 };
    current.total += parseFloat(inv.amount || 0);
    vendorSpend.set(inv.vendor_id, current);
  }
  const topVendors = Array.from(vendorSpend.entries())
    .map(([id, v]) => ({ vendor_id: id, vendor_name: v.name, total_spend: v.total }))
    .sort((a, b) => b.total_spend - a.total_spend)
    .slice(0, 5);

  // Process category spend
  const categorySpend = new Map();
  for (const alloc of (categorySpendRes.data || [])) {
    const cat = alloc.cost_code?.category || 'Other';
    categorySpend.set(cat, (categorySpend.get(cat) || 0) + parseFloat(alloc.amount || 0));
  }
  const topCategories = Array.from(categorySpend.entries())
    .map(([cat, total]) => ({ category: cat, total_spend: total }))
    .sort((a, b) => b.total_spend - a.total_spend)
    .slice(0, 5);

  // Process monthly trend
  const monthlyTrend = new Map();
  for (const inv of (trendsRes.data || [])) {
    const month = inv.invoice_date?.substring(0, 7);
    if (!month) continue;
    monthlyTrend.set(month, (monthlyTrend.get(month) || 0) + parseFloat(inv.amount || 0));
  }

  // Calculate savings potential from price variance
  const itemPrices = new Map();
  for (const price of (targetsRes.data || [])) {
    if (!itemPrices.has(price.master_item_id)) {
      itemPrices.set(price.master_item_id, []);
    }
    itemPrices.get(price.master_item_id).push(parseFloat(price.unit_price));
  }

  let totalVariance = 0;
  let itemsWithVariance = 0;
  for (const prices of itemPrices.values()) {
    if (prices.length > 1) {
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      if (min > 0) {
        totalVariance += (max - min) / min;
        itemsWithVariance++;
      }
    }
  }
  const avgPriceVariance = itemsWithVariance > 0 ? (totalVariance / itemsWithVariance * 100) : 0;

  // Total YTD spend
  const ytdSpend = topVendors.reduce((s, v) => s + v.total_spend, 0);

  res.json({
    summary: {
      ytd_spend: ytdSpend,
      vendor_count: vendorSpend.size,
      avg_price_variance: avgPriceVariance.toFixed(1)
    },
    top_vendors: topVendors,
    top_categories: topCategories,
    monthly_trend: Array.from(monthlyTrend.entries())
      .map(([month, total]) => ({ month, total_spend: total }))
      .sort((a, b) => a.month.localeCompare(b.month))
  });
}));

module.exports = router;
