/**
 * Global Search Routes
 * Search across invoices, vendors, jobs, and POs
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler } = require('../core/errors');

// Global search endpoint
router.get('/', asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return res.json({ results: [] });
  }

  const searchTerm = `%${q}%`;
  const results = [];

  // Search jobs
  const { data: jobs } = await supabase
    .from('v2_jobs')
    .select('id, name, client_name, status')
    .or(`name.ilike.${searchTerm},client_name.ilike.${searchTerm}`)
    .limit(5);

  (jobs || []).forEach(job => {
    results.push({
      type: 'job',
      id: job.id,
      title: job.name,
      subtitle: job.client_name || '',
      status: job.status,
      url: `job-profile.html?id=${job.id}`
    });
  });

  // Search vendors
  const { data: vendors } = await supabase
    .from('v2_vendors')
    .select('id, name, email')
    .ilike('name', searchTerm)
    .limit(5);

  (vendors || []).forEach(vendor => {
    results.push({
      type: 'vendor',
      id: vendor.id,
      title: vendor.name,
      subtitle: vendor.email || '',
      url: `vendors.html?id=${vendor.id}`
    });
  });

  // Search invoices by number or vendor
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, status, v2_vendors(name)')
    .or(`invoice_number.ilike.${searchTerm}`)
    .is('deleted_at', null)
    .limit(5);

  (invoices || []).forEach(inv => {
    results.push({
      type: 'invoice',
      id: inv.id,
      title: `Invoice #${inv.invoice_number || 'N/A'}`,
      subtitle: `${inv.v2_vendors?.name || 'Unknown'} - $${parseFloat(inv.amount || 0).toLocaleString()}`,
      status: inv.status,
      url: `index.html?invoice=${inv.id}`
    });
  });

  // Search POs by number
  const { data: pos } = await supabase
    .from('v2_purchase_orders')
    .select('id, po_number, total_amount, status, v2_vendors(name)')
    .ilike('po_number', searchTerm)
    .is('deleted_at', null)
    .limit(5);

  (pos || []).forEach(po => {
    results.push({
      type: 'po',
      id: po.id,
      title: po.po_number,
      subtitle: `${po.v2_vendors?.name || 'Unknown'} - $${parseFloat(po.total_amount || 0).toLocaleString()}`,
      status: po.status,
      url: `pos.html?id=${po.id}`
    });
  });

  // Sort by relevance (exact matches first) and limit total
  results.sort((a, b) => {
    const aExact = a.title.toLowerCase().includes(q.toLowerCase()) ? 0 : 1;
    const bExact = b.title.toLowerCase().includes(q.toLowerCase()) ? 0 : 1;
    return aExact - bExact;
  });

  res.json({ results: results.slice(0, parseInt(limit)) });
}));

module.exports = router;
