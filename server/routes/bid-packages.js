/**
 * Bid Packages Routes
 * Subcontractor bid solicitation, collection, and award workflow
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============================================================
// LIST BID PACKAGES
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, trade_category } = req.query;

  let query = supabase
    .from('v2_bid_packages')
    .select(`
      *,
      job:v2_jobs(id, name),
      awarded_vendor:v2_vendors!v2_bid_packages_awarded_vendor_id_fkey(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (trade_category) query = query.eq('trade_category', trade_category);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get invite and bid counts for each package
  const packageIds = (data || []).map(p => p.id);

  // Get invite counts
  const { data: inviteCounts } = await supabase
    .from('v2_bid_package_invites')
    .select('bid_package_id')
    .in('bid_package_id', packageIds);

  // Get bid counts
  const { data: bidCounts } = await supabase
    .from('v2_subcontractor_bids')
    .select('bid_package_id')
    .in('bid_package_id', packageIds);

  // Map counts
  const inviteMap = {};
  const bidMap = {};
  (inviteCounts || []).forEach(i => {
    inviteMap[i.bid_package_id] = (inviteMap[i.bid_package_id] || 0) + 1;
  });
  (bidCounts || []).forEach(b => {
    bidMap[b.bid_package_id] = (bidMap[b.bid_package_id] || 0) + 1;
  });

  const result = (data || []).map(pkg => ({
    ...pkg,
    job_name: pkg.job?.name || null,
    awarded_vendor_name: pkg.awarded_vendor?.name || null,
    invite_count: inviteMap[pkg.id] || 0,
    bid_count: bidMap[pkg.id] || 0,
  }));

  res.json(result);
}));

// ============================================================
// GET SINGLE BID PACKAGE
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: pkg, error } = await supabase
    .from('v2_bid_packages')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      awarded_vendor:v2_vendors!v2_bid_packages_awarded_vendor_id_fkey(id, name, email, phone)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !pkg) throw new AppError('NOT_FOUND', 'Bid package not found');

  // Get counts
  const { count: inviteCount } = await supabase
    .from('v2_bid_package_invites')
    .select('id', { count: 'exact', head: true })
    .eq('bid_package_id', id);

  const { count: bidCount } = await supabase
    .from('v2_subcontractor_bids')
    .select('id', { count: 'exact', head: true })
    .eq('bid_package_id', id);

  res.json({
    ...pkg,
    job_name: pkg.job?.name || null,
    awarded_vendor_name: pkg.awarded_vendor?.name || null,
    invite_count: inviteCount || 0,
    bid_count: bidCount || 0,
  });
}));

// ============================================================
// CREATE BID PACKAGE
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id, package_number, title, description, trade_category,
    scope_of_work, issue_date, due_date, site_visit_date, site_visit_time,
    square_footage, specs_summary, special_requirements
  } = req.body;

  if (!title) throw new AppError('VALIDATION_ERROR', 'Title is required');
  if (!package_number) throw new AppError('VALIDATION_ERROR', 'Package number is required');

  const { data, error } = await supabase
    .from('v2_bid_packages')
    .insert({
      job_id: job_id || null,
      package_number,
      title,
      description: description || null,
      trade_category: trade_category || null,
      scope_of_work: scope_of_work || null,
      issue_date: issue_date || null,
      due_date: due_date || null,
      site_visit_date: site_visit_date || null,
      site_visit_time: site_visit_time || null,
      square_footage: square_footage || null,
      specs_summary: specs_summary || null,
      special_requirements: special_requirements || null,
      status: 'draft'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json(data);
}));

// ============================================================
// UPDATE BID PACKAGE
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };
  delete updates.id;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('v2_bid_packages')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Bid package not found');
  res.json(data);
}));

// ============================================================
// DELETE BID PACKAGE (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_bid_packages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// BID PACKAGE DOCUMENTS
// ============================================================

router.get('/:id/documents', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_bid_package_documents')
    .select('*')
    .eq('bid_package_id', id)
    .order('uploaded_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

router.post('/:id/documents', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { document_type, file_name, file_url, file_size, file_type, description } = req.body;

  const { data, error } = await supabase
    .from('v2_bid_package_documents')
    .insert({
      bid_package_id: id,
      document_type: document_type || 'other',
      file_name,
      file_url,
      file_size: file_size || null,
      file_type: file_type || null,
      description: description || null
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json(data);
}));

router.delete('/:packageId/documents/:docId', asyncHandler(async (req, res) => {
  const { docId } = req.params;

  const { error } = await supabase
    .from('v2_bid_package_documents')
    .delete()
    .eq('id', docId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// Delete document (alternative route without packageId)
router.delete('/documents/:docId', asyncHandler(async (req, res) => {
  const { docId } = req.params;

  const { error } = await supabase
    .from('v2_bid_package_documents')
    .delete()
    .eq('id', docId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// Move document to another bid package
router.patch('/documents/:docId', asyncHandler(async (req, res) => {
  const { docId } = req.params;
  const { bid_package_id: newBidId, moved_by } = req.body;

  if (!newBidId) throw new AppError('VALIDATION_ERROR', 'New bid_package_id is required');

  // Get current document
  const { data: doc, error: fetchError } = await supabase
    .from('v2_bid_package_documents')
    .select('*')
    .eq('id', docId)
    .single();

  if (fetchError || !doc) throw new AppError('NOT_FOUND', 'Document not found');

  // Verify target bid exists
  const { data: targetBid, error: targetError } = await supabase
    .from('v2_bid_packages')
    .select('id, title')
    .eq('id', newBidId)
    .is('deleted_at', null)
    .single();

  if (targetError || !targetBid) throw new AppError('NOT_FOUND', 'Target bid package not found');

  // Update document's bid_package_id
  const { data: updated, error: updateError } = await supabase
    .from('v2_bid_package_documents')
    .update({ bid_package_id: newBidId })
    .eq('id', docId)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  res.json(updated);
}));

// ============================================================
// BID PACKAGE INVITES
// ============================================================

router.get('/:id/invites', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_bid_package_invites')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone)
    `)
    .eq('bid_package_id', id)
    .order('invited_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const result = (data || []).map(inv => ({
    ...inv,
    vendor_name: inv.vendor?.name,
    vendor_email: inv.vendor?.email,
    vendor_phone: inv.vendor?.phone
  }));

  res.json(result);
}));

router.post('/:id/invites', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vendor_id } = req.body;

  if (!vendor_id) throw new AppError('VALIDATION_ERROR', 'Vendor is required');

  const { data, error } = await supabase
    .from('v2_bid_package_invites')
    .insert({ bid_package_id: id, vendor_id })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new AppError('VALIDATION_ERROR', 'Vendor already invited');
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }
  res.status(201).json(data);
}));

router.delete('/:packageId/invites/:inviteId', asyncHandler(async (req, res) => {
  const { inviteId } = req.params;

  const { error } = await supabase
    .from('v2_bid_package_invites')
    .delete()
    .eq('id', inviteId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// SUBCONTRACTOR BID SUBMISSIONS
// ============================================================

router.get('/:id/submissions', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_subcontractor_bids')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone)
    `)
    .eq('bid_package_id', id)
    .order('bid_amount', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const result = (data || []).map(bid => ({
    ...bid,
    vendor_name: bid.vendor?.name,
    vendor_email: bid.vendor?.email
  }));

  res.json(result);
}));

router.post('/:id/submissions', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    vendor_id, bid_amount, unit_price_per_sf, inclusions, exclusions,
    clarifications, alternate_amounts, proposed_start_date, proposed_duration_days,
    payment_terms, warranty_terms, bond_included, insurance_verified, valid_until, notes
  } = req.body;

  if (!vendor_id) throw new AppError('VALIDATION_ERROR', 'Vendor is required');
  if (!bid_amount) throw new AppError('VALIDATION_ERROR', 'Bid amount is required');

  const { data, error } = await supabase
    .from('v2_subcontractor_bids')
    .insert({
      bid_package_id: id,
      vendor_id,
      bid_amount,
      unit_price_per_sf: unit_price_per_sf || null,
      inclusions: inclusions || [],
      exclusions: exclusions || [],
      clarifications: clarifications || [],
      alternate_amounts: alternate_amounts || [],
      proposed_start_date: proposed_start_date || null,
      proposed_duration_days: proposed_duration_days || null,
      payment_terms: payment_terms || null,
      warranty_terms: warranty_terms || null,
      bond_included: bond_included || false,
      insurance_verified: insurance_verified || false,
      valid_until: valid_until || null,
      notes: notes || null
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json(data);
}));

router.get('/submissions/:bidId', asyncHandler(async (req, res) => {
  const { bidId } = req.params;

  const { data, error } = await supabase
    .from('v2_subcontractor_bids')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone),
      bid_package:v2_bid_packages(id, title, package_number)
    `)
    .eq('id', bidId)
    .single();

  if (error || !data) throw new AppError('NOT_FOUND', 'Bid not found');

  res.json({
    ...data,
    vendor_name: data.vendor?.name,
    vendor_email: data.vendor?.email,
    package_title: data.bid_package?.title
  });
}));

router.patch('/submissions/:bidId', asyncHandler(async (req, res) => {
  const { bidId } = req.params;
  const updates = { ...req.body };
  delete updates.id;
  delete updates.created_at;
  delete updates.bid_package_id;

  const { data, error } = await supabase
    .from('v2_subcontractor_bids')
    .update(updates)
    .eq('id', bidId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

router.delete('/submissions/:bidId', asyncHandler(async (req, res) => {
  const { bidId } = req.params;

  const { error } = await supabase
    .from('v2_subcontractor_bids')
    .delete()
    .eq('id', bidId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// BID ITEMS
// ============================================================

router.get('/submissions/:bidId/items', asyncHandler(async (req, res) => {
  const { bidId } = req.params;

  const { data, error } = await supabase
    .from('v2_subcontractor_bid_items')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name)
    `)
    .eq('subcontractor_bid_id', bidId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const result = (data || []).map(item => ({
    ...item,
    cost_code_name: item.cost_code ? `${item.cost_code.code} - ${item.cost_code.name}` : null
  }));

  res.json(result);
}));

router.post('/submissions/:bidId/items', asyncHandler(async (req, res) => {
  const { bidId } = req.params;
  const { description, quantity, unit, unit_price, amount, cost_code_id, notes, sort_order } = req.body;

  const { data, error } = await supabase
    .from('v2_subcontractor_bid_items')
    .insert({
      subcontractor_bid_id: bidId,
      description,
      quantity: quantity || null,
      unit: unit || null,
      unit_price: unit_price || null,
      amount,
      cost_code_id: cost_code_id || null,
      notes: notes || null,
      sort_order: sort_order || 0
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json(data);
}));

module.exports = router;
