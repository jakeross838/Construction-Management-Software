/**
 * Bids Routes
 * Vendor bid collection, comparison, and PO conversion
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// Multer for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

const STORAGE_BUCKET = 'invoices';
const BID_PREFIX = 'bid-documents';

// Anthropic client for AI features
const Anthropic = require('@anthropic-ai/sdk');
const anthropic = new Anthropic();

// Trade categories for AI matching
const TRADE_CATEGORIES = [
  'Site Work', 'Concrete', 'Masonry', 'Metals', 'Wood & Plastics',
  'Thermal & Moisture', 'Doors & Windows', 'Finishes', 'Specialties',
  'Equipment', 'Furnishings', 'Special Construction', 'Conveying Systems',
  'Mechanical', 'Plumbing', 'HVAC', 'Electrical', 'Drywall', 'Painting',
  'Flooring', 'Roofing', 'Insulation', 'Cabinets & Millwork', 'Tile',
  'Landscaping', 'Pool', 'Other'
];

// ============================================================
// ACTIVITY LOGGING HELPER
// ============================================================

async function logBidActivity(bidId, action, performedBy, details = {}, builderId) {
  await supabase.from('v2_bid_activity').insert({
    bid_id: bidId,
    action,
    performed_by: performedBy,
    details,
    builder_id: builderId
  });
}

// ============================================================
// AI TRADE CATEGORY SUGGESTION
// ============================================================

router.post('/suggest-trade', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { title, description, scope_of_work } = req.body;

  if (!title) throw new AppError('VALIDATION_ERROR', 'Title is required');

  const context = [title, description, scope_of_work].filter(Boolean).join('\n\n');

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Analyze this construction bid package and suggest the most appropriate trade category.

Bid Package:
${context}

Available trade categories:
${TRADE_CATEGORIES.join(', ')}

Respond with ONLY a JSON object in this exact format:
{"category": "chosen category", "confidence": 0.95, "reasoning": "brief explanation"}

Choose "Other" only if none of the specific categories fit well.`
      }]
    });

    const text = response.content[0].text.trim();
    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid AI response format');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Validate category
    if (!TRADE_CATEGORIES.includes(result.category)) {
      result.category = 'Other';
    }

    res.json({
      success: true,
      suggestion: result.category,
      confidence: result.confidence || 0.8,
      reasoning: result.reasoning || '',
      alternatives: TRADE_CATEGORIES.filter(c => c !== result.category).slice(0, 5)
    });
  } catch (error) {
    console.error('AI trade suggestion error:', error);
    // Fallback: simple keyword matching
    const text = context.toLowerCase();
    let suggestion = 'Other';

    const keywordMap = {
      'plumbing': 'Plumbing', 'pipe': 'Plumbing', 'fixture': 'Plumbing',
      'electrical': 'Electrical', 'wiring': 'Electrical', 'panel': 'Electrical',
      'hvac': 'HVAC', 'heating': 'HVAC', 'cooling': 'HVAC', 'air conditioning': 'HVAC',
      'concrete': 'Concrete', 'foundation': 'Concrete', 'slab': 'Concrete',
      'roof': 'Roofing', 'shingle': 'Roofing', 'tpo': 'Roofing',
      'drywall': 'Drywall', 'sheetrock': 'Drywall',
      'paint': 'Painting', 'stain': 'Painting',
      'floor': 'Flooring', 'tile': 'Tile', 'carpet': 'Flooring',
      'cabinet': 'Cabinets & Millwork', 'millwork': 'Cabinets & Millwork',
      'window': 'Doors & Windows', 'door': 'Doors & Windows',
      'insulation': 'Insulation', 'foam': 'Insulation',
      'pool': 'Pool', 'spa': 'Pool',
      'landscape': 'Landscaping', 'irrigation': 'Landscaping',
      'frame': 'Wood & Plastics', 'framing': 'Wood & Plastics', 'lumber': 'Wood & Plastics',
      'steel': 'Metals', 'metal': 'Metals', 'iron': 'Metals',
      'masonry': 'Masonry', 'brick': 'Masonry', 'block': 'Masonry',
    };

    for (const [keyword, category] of Object.entries(keywordMap)) {
      if (text.includes(keyword)) {
        suggestion = category;
        break;
      }
    }

    res.json({
      success: true,
      suggestion,
      confidence: 0.6,
      reasoning: 'Matched by keyword (AI unavailable)',
      alternatives: TRADE_CATEGORIES.filter(c => c !== suggestion).slice(0, 5)
    });
  }
}));

// ============================================================
// STATS ENDPOINT (must be before /:id)
// ============================================================

// ============================================================
// BID ANALYTICS
// ============================================================

router.get('/analytics', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, date_from, date_to } = req.query;

  // Base query for bid packages
  let packagesQuery = supabase
    .from('v2_bids')
    .select('id, status, trade_category, awarded_amount, awarded_vendor_id, created_at, job_id')
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (job_id) packagesQuery = packagesQuery.eq('job_id', job_id);
  if (date_from) packagesQuery = packagesQuery.gte('created_at', date_from);
  if (date_to) packagesQuery = packagesQuery.lte('created_at', date_to);

  const { data: packages, error: pkgError } = await packagesQuery;
  if (pkgError) throw new AppError('DATABASE_ERROR', pkgError.message);

  // Get all subcontractor bids
  const packageIds = (packages || []).map(p => p.id);
  const { data: allBids } = await supabase
    .from('v2_subcontractor_bids')
    .select('id, bid_package_id, vendor_id, bid_amount, status, submitted_at')
    .eq('builder_id', builderId)
    .in('bid_package_id', packageIds);

  // Get vendor names for awarded packages
  const vendorIds = [...new Set([
    ...(packages || []).filter(p => p.awarded_vendor_id).map(p => p.awarded_vendor_id),
    ...(allBids || []).map(b => b.vendor_id)
  ])];

  const { data: vendors } = await supabase
    .from('v2_vendors')
    .select('id, name')
    .eq('builder_id', builderId)
    .in('id', vendorIds);

  const vendorMap = Object.fromEntries((vendors || []).map(v => [v.id, v.name]));

  // Calculate analytics
  const totalPackages = packages?.length || 0;
  const awardedPackages = packages?.filter(p => p.status === 'awarded').length || 0;
  const totalBids = allBids?.length || 0;
  const totalAwardedAmount = packages?.reduce((sum, p) => sum + (parseFloat(p.awarded_amount) || 0), 0) || 0;

  // Bids per package
  const avgBidsPerPackage = totalPackages > 0 ? (totalBids / totalPackages).toFixed(1) : 0;

  // Trade category breakdown
  const tradeStats = {};
  for (const pkg of (packages || [])) {
    const trade = pkg.trade_category || 'Other';
    if (!tradeStats[trade]) {
      tradeStats[trade] = { packages: 0, awarded: 0, totalAwarded: 0 };
    }
    tradeStats[trade].packages++;
    if (pkg.status === 'awarded') {
      tradeStats[trade].awarded++;
      tradeStats[trade].totalAwarded += parseFloat(pkg.awarded_amount) || 0;
    }
  }

  // Vendor performance (win rates)
  const vendorStats = {};
  for (const bid of (allBids || [])) {
    const vendorId = bid.vendor_id;
    if (!vendorStats[vendorId]) {
      vendorStats[vendorId] = {
        vendor_id: vendorId,
        vendor_name: vendorMap[vendorId] || 'Unknown',
        total_bids: 0,
        won: 0,
        total_amount: 0,
        won_amount: 0
      };
    }
    vendorStats[vendorId].total_bids++;
    vendorStats[vendorId].total_amount += parseFloat(bid.bid_amount) || 0;

    if (bid.status === 'selected') {
      vendorStats[vendorId].won++;
      vendorStats[vendorId].won_amount += parseFloat(bid.bid_amount) || 0;
    }
  }

  // Calculate win rates and sort by wins
  const vendorPerformance = Object.values(vendorStats)
    .map(v => ({
      ...v,
      win_rate: v.total_bids > 0 ? Math.round((v.won / v.total_bids) * 100) : 0,
      avg_bid: v.total_bids > 0 ? Math.round(v.total_amount / v.total_bids) : 0
    }))
    .sort((a, b) => b.won - a.won)
    .slice(0, 10); // Top 10 vendors

  // Monthly trend (last 6 months)
  const monthlyTrend = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = date.toISOString().split('T')[0];
    const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

    const monthPackages = (packages || []).filter(p => {
      const created = p.created_at?.split('T')[0];
      return created >= monthStart && created <= monthEnd;
    });

    const monthBids = (allBids || []).filter(b => {
      const submitted = b.submitted_at?.split('T')[0];
      return submitted >= monthStart && submitted <= monthEnd;
    });

    monthlyTrend.push({
      month: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      packages: monthPackages.length,
      bids: monthBids.length,
      awarded: monthPackages.filter(p => p.status === 'awarded').length
    });
  }

  // Bid spread analysis
  const spreadAnalysis = [];
  for (const pkg of (packages || [])) {
    const pkgBids = (allBids || []).filter(b => b.bid_package_id === pkg.id);
    if (pkgBids.length >= 2) {
      const amounts = pkgBids.map(b => parseFloat(b.bid_amount));
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      const spread = ((max - min) / min * 100).toFixed(1);
      spreadAnalysis.push({
        trade: pkg.trade_category || 'Other',
        spread: parseFloat(spread),
        bid_count: pkgBids.length
      });
    }
  }

  // Average spread by trade
  const spreadByTrade = {};
  for (const item of spreadAnalysis) {
    if (!spreadByTrade[item.trade]) {
      spreadByTrade[item.trade] = { total: 0, count: 0 };
    }
    spreadByTrade[item.trade].total += item.spread;
    spreadByTrade[item.trade].count++;
  }

  const avgSpreadByTrade = Object.entries(spreadByTrade).map(([trade, data]) => ({
    trade,
    avg_spread: Math.round(data.total / data.count),
    sample_size: data.count
  })).sort((a, b) => b.avg_spread - a.avg_spread);

  res.json({
    summary: {
      total_packages: totalPackages,
      awarded_packages: awardedPackages,
      award_rate: totalPackages > 0 ? Math.round((awardedPackages / totalPackages) * 100) : 0,
      total_bids_received: totalBids,
      avg_bids_per_package: parseFloat(avgBidsPerPackage),
      total_awarded_amount: totalAwardedAmount
    },
    by_trade: Object.entries(tradeStats).map(([trade, stats]) => ({
      trade,
      ...stats,
      award_rate: stats.packages > 0 ? Math.round((stats.awarded / stats.packages) * 100) : 0
    })).sort((a, b) => b.packages - a.packages),
    vendor_performance: vendorPerformance,
    monthly_trend: monthlyTrend,
    spread_by_trade: avgSpreadByTrade
  });
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id } = req.query;

  let query = supabase
    .from('v2_bids')
    .select('id, status, bid_amount')
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: bids, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total: bids.length,
    received: 0,
    under_review: 0,
    accepted: 0,
    rejected: 0,
    withdrawn: 0,
    total_amount: 0,
    accepted_amount: 0
  };

  for (const bid of bids) {
    stats[bid.status] = (stats[bid.status] || 0) + 1;
    const amount = parseFloat(bid.bid_amount || 0);
    stats.total_amount += amount;
    if (bid.status === 'accepted') {
      stats.accepted_amount += amount;
    }
  }

  res.json(stats);
}));

// ============================================================
// LIST BIDS (BID PACKAGES)
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, vendor_id, status, search, trade_category } = req.query;

  let query = supabase
    .from('v2_bids')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors!v2_bids_vendor_id_fkey(id, name),
      awarded_vendor:v2_vendors!v2_bids_awarded_vendor_id_fkey(id, name),
      documents:v2_bid_documents(id, file_name, file_url)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (status) query = query.eq('status', status);
  if (trade_category) query = query.eq('trade_category', trade_category);
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,package_number.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get invite and bid counts for all packages
  const packageIds = (data || []).map(b => b.id);

  // Get invite counts
  const { data: inviteCounts } = await supabase
    .from('v2_bid_package_invites')
    .select('bid_package_id')
    .eq('builder_id', builderId)
    .in('bid_package_id', packageIds);

  // Get subcontractor bid counts
  const { data: bidCounts } = await supabase
    .from('v2_subcontractor_bids')
    .select('bid_package_id')
    .eq('builder_id', builderId)
    .in('bid_package_id', packageIds);

  // Build count maps
  const inviteCountMap = {};
  const bidCountMap = {};
  (inviteCounts || []).forEach(inv => {
    inviteCountMap[inv.bid_package_id] = (inviteCountMap[inv.bid_package_id] || 0) + 1;
  });
  (bidCounts || []).forEach(bid => {
    bidCountMap[bid.bid_package_id] = (bidCountMap[bid.bid_package_id] || 0) + 1;
  });

  // Add counts and document count
  const result = (data || []).map(bid => ({
    ...bid,
    document_count: bid.documents?.length || 0,
    invite_count: inviteCountMap[bid.id] || 0,
    bid_count: bidCountMap[bid.id] || 0,
    awarded_vendor_name: bid.awarded_vendor?.name || null
  }));

  res.json(result);
}));

// ============================================================
// GET SINGLE BID
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: bid, error } = await supabase
    .from('v2_bids')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      vendor:v2_vendors!v2_bids_vendor_id_fkey(id, name, email, phone),
      awarded_vendor:v2_vendors!v2_bids_awarded_vendor_id_fkey(id, name, email, phone)
    `)
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (error || !bid) throw new AppError('NOT_FOUND', 'Bid not found');

  // Get documents
  const { data: documents } = await supabase
    .from('v2_bid_documents')
    .select('*')
    .eq('bid_id', id)
    .eq('builder_id', builderId)
    .order('uploaded_at', { ascending: false });

  // Get activity
  const { data: activity } = await supabase
    .from('v2_bid_activity')
    .select('*')
    .eq('bid_id', id)
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });

  // Check if already converted to PO
  const { data: linkedPO } = await supabase
    .from('v2_purchase_orders')
    .select('id, po_number, status')
    .eq('source_bid_id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  bid.documents = documents || [];
  bid.activity = activity || [];
  bid.linked_po = linkedPO || null;

  res.json(bid);
}));

// ============================================================
// CREATE BID
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    job_id,
    vendor_id,
    title,
    description,
    scope_of_work,
    bid_amount,
    received_date,
    due_date,
    notes,
    created_by
  } = req.body;

  if (!job_id) throw new AppError('VALIDATION_ERROR', 'Job is required');
  if (!title) throw new AppError('VALIDATION_ERROR', 'Title is required');

  const { data: bid, error } = await supabase
    .from('v2_bids')
    .insert({
      job_id,
      vendor_id: vendor_id || null,
      title,
      description: description || null,
      scope_of_work: scope_of_work || null,
      bid_amount: bid_amount || null,
      received_date: received_date || new Date().toISOString().split('T')[0],
      due_date: due_date || null,
      notes: notes || null,
      created_by: created_by || 'System',
      status: 'received',
      builder_id: builderId
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors!v2_bids_vendor_id_fkey(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logBidActivity(bid.id, 'created', created_by || 'System', { title }, builderId);

  res.status(201).json(bid);
}));

// ============================================================
// UPDATE BID
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const {
    vendor_id,
    title,
    description,
    scope_of_work,
    bid_amount,
    received_date,
    due_date,
    notes,
    updated_by
  } = req.body;

  // Build update object with only provided fields
  const updates = { updated_at: new Date().toISOString() };
  if (vendor_id !== undefined) updates.vendor_id = vendor_id || null;
  if (title !== undefined) updates.title = title;
  if (description !== undefined) updates.description = description;
  if (scope_of_work !== undefined) updates.scope_of_work = scope_of_work;
  if (bid_amount !== undefined) updates.bid_amount = bid_amount;
  if (received_date !== undefined) updates.received_date = received_date;
  if (due_date !== undefined) updates.due_date = due_date;
  if (notes !== undefined) updates.notes = notes;

  const { data: bid, error } = await supabase
    .from('v2_bids')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors!v2_bids_vendor_id_fkey(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!bid) throw new AppError('NOT_FOUND', 'Bid not found');

  await logBidActivity(id, 'updated', updated_by || 'System', { updates }, builderId);

  res.json(bid);
}));

// ============================================================
// DELETE BID (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { deleted_by } = req.body;

  const { data: bid, error } = await supabase
    .from('v2_bids')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!bid) throw new AppError('NOT_FOUND', 'Bid not found');

  await logBidActivity(id, 'deleted', deleted_by || 'System', {}, builderId);

  res.json({ success: true, message: 'Bid deleted' });
}));

// ============================================================
// CHANGE STATUS
// ============================================================

const STATUS_TRANSITIONS = {
  received: ['under_review', 'rejected', 'withdrawn'],
  under_review: ['accepted', 'rejected', 'received'],
  accepted: [], // Terminal state (but can convert to PO)
  rejected: ['under_review'], // Can reconsider
  withdrawn: [] // Terminal state
};

router.post('/:id/status', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { status: newStatus, performed_by, notes } = req.body;

  if (!newStatus) throw new AppError('VALIDATION_ERROR', 'Status is required');

  // Get current bid
  const { data: bid, error: fetchError } = await supabase
    .from('v2_bids')
    .select('status, job_id')
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !bid) throw new AppError('NOT_FOUND', 'Bid not found');

  // Validate transition
  const allowedTransitions = STATUS_TRANSITIONS[bid.status] || [];
  if (!allowedTransitions.includes(newStatus)) {
    throw new AppError('VALIDATION_ERROR',
      `Cannot transition from '${bid.status}' to '${newStatus}'. Allowed: ${allowedTransitions.join(', ') || 'none'}`
    );
  }

  // Update status
  const { data: updated, error } = await supabase
    .from('v2_bids')
    .update({
      status: newStatus,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors!v2_bids_vendor_id_fkey(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logBidActivity(id, `status_changed_to_${newStatus}`, performed_by || 'System', {
    from: bid.status,
    to: newStatus,
    notes: notes || null
  }, builderId);

  // Auto-update budget when bid is accepted
  if (newStatus === 'accepted') {
    try {
      await updateBudgetFromAcceptedBid(id, bid.job_id, builderId);
      await logBidActivity(id, 'budget_updated', 'System', {
        message: 'Budget lines auto-updated from accepted bid'
      }, builderId);
    } catch (budgetErr) {
      console.error('Error updating budget from bid:', budgetErr);
      // Don't fail the status change if budget update fails
    }
  }

  res.json(updated);
}));

// ============================================================
// UPLOAD DOCUMENT
// ============================================================

router.post('/:id/documents', upload.single('document'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { uploaded_by } = req.body;

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded');

  // Verify bid exists
  const { data: bid, error: bidError } = await supabase
    .from('v2_bids')
    .select('id, title')
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (bidError || !bid) throw new AppError('NOT_FOUND', 'Bid not found');

  // Upload to storage
  const fileName = `${BID_PREFIX}/${id}/${Date.now()}-${req.file.originalname}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype
    });

  if (uploadError) throw new AppError('STORAGE_ERROR', uploadError.message);

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  // Save document record
  const { data: doc, error: docError } = await supabase
    .from('v2_bid_documents')
    .insert({
      bid_id: id,
      file_url: publicUrl,
      file_name: req.file.originalname,
      file_size: req.file.size,
      uploaded_by: uploaded_by || 'System',
      builder_id: builderId
    })
    .select()
    .single();

  if (docError) throw new AppError('DATABASE_ERROR', docError.message);

  await logBidActivity(id, 'document_uploaded', uploaded_by || 'System', {
    file_name: req.file.originalname
  }, builderId);

  res.status(201).json(doc);
}));

// ============================================================
// DELETE DOCUMENT
// ============================================================

router.delete('/documents/:docId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { docId } = req.params;
  const { deleted_by } = req.body;

  // Get document
  const { data: doc, error: fetchError } = await supabase
    .from('v2_bid_documents')
    .select('*, bid:v2_bids(id)')
    .eq('id', docId)
    .eq('builder_id', builderId)
    .single();

  if (fetchError || !doc) throw new AppError('NOT_FOUND', 'Document not found');

  // Delete from storage (extract path from URL)
  const urlParts = doc.file_url.split('/');
  const storagePath = urlParts.slice(urlParts.indexOf(BID_PREFIX)).join('/');
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);

  // Delete record
  const { error: deleteError } = await supabase
    .from('v2_bid_documents')
    .delete()
    .eq('id', docId)
    .eq('builder_id', builderId);

  if (deleteError) throw new AppError('DATABASE_ERROR', deleteError.message);

  await logBidActivity(doc.bid_id, 'document_deleted', deleted_by || 'System', {
    file_name: doc.file_name
  }, builderId);

  res.json({ success: true, message: 'Document deleted' });
}));

// ============================================================
// MOVE DOCUMENT TO ANOTHER BID
// ============================================================

router.patch('/documents/:docId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { docId } = req.params;
  const { bid_id: newBidId, moved_by } = req.body;

  if (!newBidId) throw new AppError('VALIDATION_ERROR', 'New bid_id is required');

  // Get current document
  const { data: doc, error: fetchError } = await supabase
    .from('v2_bid_documents')
    .select('*, bid:v2_bids(id, title, job_id)')
    .eq('id', docId)
    .eq('builder_id', builderId)
    .single();

  if (fetchError || !doc) throw new AppError('NOT_FOUND', 'Document not found');

  // Verify target bid exists
  const { data: targetBid, error: targetError } = await supabase
    .from('v2_bids')
    .select('id, title, job_id')
    .eq('id', newBidId)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (targetError || !targetBid) throw new AppError('NOT_FOUND', 'Target bid not found');

  // Update document's bid_id
  const { data: updated, error: updateError } = await supabase
    .from('v2_bid_documents')
    .update({ bid_id: newBidId })
    .eq('id', docId)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Log activity on both bids
  await logBidActivity(doc.bid_id, 'document_moved_out', moved_by || 'System', {
    file_name: doc.file_name,
    moved_to_bid_id: newBidId,
    moved_to_bid_title: targetBid.title
  }, builderId);

  await logBidActivity(newBidId, 'document_moved_in', moved_by || 'System', {
    file_name: doc.file_name,
    moved_from_bid_id: doc.bid_id,
    moved_from_bid_title: doc.bid?.title
  }, builderId);

  res.json(updated);
}));

// ============================================================
// CONVERT BID TO PURCHASE ORDER
// ============================================================

router.post('/:id/convert-to-po', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { created_by, po_description, line_items } = req.body;

  // Get bid with relations
  const { data: bid, error: bidError } = await supabase
    .from('v2_bids')
    .select(`
      *,
      vendor:v2_vendors!v2_bids_vendor_id_fkey(id, name),
      job:v2_jobs(id, name)
    `)
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (bidError || !bid) throw new AppError('NOT_FOUND', 'Bid not found');

  if (bid.status !== 'accepted') {
    throw new AppError('VALIDATION_ERROR', 'Only accepted bids can be converted to POs');
  }

  // Check if already converted
  const { data: existingPO } = await supabase
    .from('v2_purchase_orders')
    .select('id, po_number')
    .eq('source_bid_id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (existingPO) {
    throw new AppError('VALIDATION_ERROR',
      `Bid already converted to PO: ${existingPO.po_number}`
    );
  }

  // Generate PO number
  const { data: existingPOs } = await supabase
    .from('v2_purchase_orders')
    .select('po_number')
    .eq('job_id', bid.job_id)
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  const poCount = (existingPOs?.length || 0) + 1;
  const jobIdentifier = bid.job?.name?.replace(/[^a-zA-Z0-9]/g, '').substring(0, 15) || 'JOB';
  const poNumber = `PO-${jobIdentifier}-${String(poCount).padStart(4, '0')}`;

  // Create PO
  const { data: po, error: poError } = await supabase
    .from('v2_purchase_orders')
    .insert({
      job_id: bid.job_id,
      vendor_id: bid.vendor_id,
      po_number: poNumber,
      description: po_description || bid.title,
      scope_of_work: bid.scope_of_work,
      total_amount: bid.bid_amount,
      original_amount: bid.bid_amount,
      status: 'open',
      status_detail: 'pending',
      approval_status: 'pending',
      source_bid_id: id,
      created_at: new Date().toISOString(),
      builder_id: builderId
    })
    .select()
    .single();

  if (poError) throw new AppError('DATABASE_ERROR', poError.message);

  // Create line items - use bid lines if available, otherwise use provided line_items
  const { data: bidLines } = await supabase
    .from('v2_bid_lines')
    .select('*')
    .eq('bid_id', id)
    .eq('builder_id', builderId)
    .order('sort_order');

  if (bidLines?.length > 0) {
    const lineItemsToInsert = bidLines.map(bl => ({
      po_id: po.id,
      cost_code_id: bl.cost_code_id,
      description: bl.description,
      amount: bl.amount,
      builder_id: builderId
    }));
    await supabase.from('v2_po_line_items').insert(lineItemsToInsert);
  } else if (line_items?.length > 0) {
    const lineItemsToInsert = line_items.map(li => ({
      po_id: po.id,
      cost_code_id: li.cost_code_id,
      description: li.description,
      amount: li.amount,
      builder_id: builderId
    }));
    await supabase.from('v2_po_line_items').insert(lineItemsToInsert);
  }

  // Log activity
  await logBidActivity(id, 'converted_to_po', created_by || 'System', {
    po_id: po.id,
    po_number: poNumber
  }, builderId);

  res.status(201).json({
    success: true,
    message: `PO ${poNumber} created from bid`,
    po
  });
}));

// ============================================================
// BID LINE ITEMS CRUD
// ============================================================

// Get bid lines
router.get('/:id/lines', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: lines, error } = await supabase
    .from('v2_bid_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('bid_id', id)
    .eq('builder_id', builderId)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(lines || []);
}));

// Add bid line
router.post('/:id/lines', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { cost_code_id, description, quantity, unit, unit_cost, amount, created_by } = req.body;

  // Verify bid exists
  const { data: bid, error: bidError } = await supabase
    .from('v2_bids')
    .select('id, status')
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (bidError || !bid) throw new AppError('NOT_FOUND', 'Bid not found');

  // Get max sort_order
  const { data: maxOrder } = await supabase
    .from('v2_bid_lines')
    .select('sort_order')
    .eq('bid_id', id)
    .eq('builder_id', builderId)
    .order('sort_order', { ascending: false })
    .limit(1);

  const sortOrder = (maxOrder?.[0]?.sort_order || 0) + 1;

  // Calculate amount if not provided
  const qty = parseFloat(quantity) || 1;
  const cost = parseFloat(unit_cost) || 0;
  const lineAmount = amount !== undefined ? parseFloat(amount) : qty * cost;

  const { data: line, error } = await supabase
    .from('v2_bid_lines')
    .insert({
      bid_id: id,
      cost_code_id: cost_code_id || null,
      description: description || null,
      quantity: qty,
      unit: unit || null,
      unit_cost: cost,
      amount: lineAmount,
      sort_order: sortOrder,
      builder_id: builderId
    })
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logBidActivity(id, 'line_added', created_by || 'System', {
    line_id: line.id,
    description: line.description,
    amount: line.amount
  }, builderId);

  res.status(201).json(line);
}));

// Update bid line
router.patch('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id, lineId } = req.params;
  const { cost_code_id, description, quantity, unit, unit_cost, amount, sort_order, updated_by } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (cost_code_id !== undefined) updates.cost_code_id = cost_code_id || null;
  if (description !== undefined) updates.description = description;
  if (quantity !== undefined) updates.quantity = parseFloat(quantity) || 1;
  if (unit !== undefined) updates.unit = unit;
  if (unit_cost !== undefined) updates.unit_cost = parseFloat(unit_cost) || 0;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  // Calculate amount if qty or unit_cost changed but amount not explicitly set
  if ((quantity !== undefined || unit_cost !== undefined) && amount === undefined) {
    const qty = updates.quantity !== undefined ? updates.quantity : null;
    const cost = updates.unit_cost !== undefined ? updates.unit_cost : null;

    if (qty !== null && cost !== null) {
      updates.amount = qty * cost;
    } else {
      const { data: currentLine } = await supabase
        .from('v2_bid_lines')
        .select('quantity, unit_cost')
        .eq('id', lineId)
        .eq('builder_id', builderId)
        .single();
      if (currentLine) {
        updates.amount = (qty ?? currentLine.quantity) * (cost ?? currentLine.unit_cost);
      }
    }
  } else if (amount !== undefined) {
    updates.amount = parseFloat(amount) || 0;
  }

  const { data: line, error } = await supabase
    .from('v2_bid_lines')
    .update(updates)
    .eq('id', lineId)
    .eq('bid_id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!line) throw new AppError('NOT_FOUND', 'Line item not found');

  await logBidActivity(id, 'line_updated', updated_by || 'System', { line_id: lineId, updates }, builderId);

  res.json(line);
}));

// Delete bid line
router.delete('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id, lineId } = req.params;
  const { deleted_by } = req.body;

  const { data: line, error } = await supabase
    .from('v2_bid_lines')
    .delete()
    .eq('id', lineId)
    .eq('bid_id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!line) throw new AppError('NOT_FOUND', 'Line item not found');

  await logBidActivity(id, 'line_deleted', deleted_by || 'System', {
    line_id: lineId,
    description: line.description,
    amount: line.amount
  }, builderId);

  res.json({ success: true, message: 'Line item deleted' });
}));

// Get bid lines total (for validation)
router.get('/:id/lines/total', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: lines, error } = await supabase
    .from('v2_bid_lines')
    .select('amount')
    .eq('bid_id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const total = (lines || []).reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);

  // Get bid amount for comparison
  const { data: bid } = await supabase
    .from('v2_bids')
    .select('bid_amount')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  res.json({
    lines_total: total,
    bid_amount: parseFloat(bid?.bid_amount) || 0,
    difference: (parseFloat(bid?.bid_amount) || 0) - total,
    is_balanced: Math.abs((parseFloat(bid?.bid_amount) || 0) - total) < 0.01
  });
}));

// ============================================================
// BUDGET AUTO-UPDATE ON BID ACCEPTANCE
// ============================================================

/**
 * Update budget lines when a bid is accepted
 * Called internally when status changes to 'accepted'
 */
async function updateBudgetFromAcceptedBid(bidId, jobId, builderId) {
  // Get bid lines
  const { data: bidLines } = await supabase
    .from('v2_bid_lines')
    .select('*')
    .eq('bid_id', bidId)
    .eq('builder_id', builderId);

  // Get the bid itself for lump sum handling
  const { data: bid } = await supabase
    .from('v2_bids')
    .select('bid_amount, primary_cost_code_id')
    .eq('id', bidId)
    .eq('builder_id', builderId)
    .single();

  // If bid has line items, update budget for each
  if (bidLines?.length > 0) {
    for (const line of bidLines) {
      if (!line.cost_code_id) continue;

      // Check if budget line exists and is not locked
      const { data: existing } = await supabase
        .from('v2_budget_lines')
        .select('id, source_locked')
        .eq('job_id', jobId)
        .eq('cost_code_id', line.cost_code_id)
        .eq('builder_id', builderId)
        .single();

      if (existing?.source_locked) continue;

      if (existing) {
        await supabase
          .from('v2_budget_lines')
          .update({
            budgeted_amount: line.amount,
            source_type: 'accepted_bid',
            source_bid_id: bidId,
            source_ai_estimate_id: null,
            source_estimate_id: null
          })
          .eq('id', existing.id)
          .eq('builder_id', builderId);
      } else {
        await supabase
          .from('v2_budget_lines')
          .insert({
            job_id: jobId,
            cost_code_id: line.cost_code_id,
            budgeted_amount: line.amount,
            committed_amount: 0,
            billed_amount: 0,
            paid_amount: 0,
            source_type: 'accepted_bid',
            source_bid_id: bidId,
            builder_id: builderId
          });
      }
    }
  } else if (bid?.primary_cost_code_id && bid?.bid_amount) {
    // Lump sum bid with primary cost code
    const { data: existing } = await supabase
      .from('v2_budget_lines')
      .select('id, source_locked')
      .eq('job_id', jobId)
      .eq('cost_code_id', bid.primary_cost_code_id)
      .eq('builder_id', builderId)
      .single();

    if (!existing?.source_locked) {
      if (existing) {
        await supabase
          .from('v2_budget_lines')
          .update({
            budgeted_amount: bid.bid_amount,
            source_type: 'accepted_bid',
            source_bid_id: bidId,
            source_ai_estimate_id: null,
            source_estimate_id: null
          })
          .eq('id', existing.id)
          .eq('builder_id', builderId);
      } else {
        await supabase
          .from('v2_budget_lines')
          .insert({
            job_id: jobId,
            cost_code_id: bid.primary_cost_code_id,
            budgeted_amount: bid.bid_amount,
            committed_amount: 0,
            billed_amount: 0,
            paid_amount: 0,
            source_type: 'accepted_bid',
            source_bid_id: bidId,
            builder_id: builderId
          });
      }
    }
  }
}

// ============================================================
// BID PACKAGE INVITES
// ============================================================

// Get all invites for a bid package
router.get('/:id/invites', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: invites, error } = await supabase
    .from('v2_bid_package_invites')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone)
    `)
    .eq('bid_package_id', id)
    .eq('builder_id', builderId)
    .order('invited_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Flatten vendor info
  const result = (invites || []).map(inv => ({
    ...inv,
    vendor_name: inv.vendor?.name,
    vendor_email: inv.vendor?.email,
    vendor_phone: inv.vendor?.phone
  }));

  res.json(result);
}));

// Add invite to bid package
router.post('/:id/invites', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { vendor_id, invited_by } = req.body;

  if (!vendor_id) throw new AppError('VALIDATION_ERROR', 'Vendor ID is required');

  // Verify bid exists
  const { data: bid, error: bidError } = await supabase
    .from('v2_bids')
    .select('id, title')
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (bidError || !bid) throw new AppError('NOT_FOUND', 'Bid package not found');

  // Check if already invited
  const { data: existing } = await supabase
    .from('v2_bid_package_invites')
    .select('id')
    .eq('bid_package_id', id)
    .eq('vendor_id', vendor_id)
    .eq('builder_id', builderId)
    .single();

  if (existing) throw new AppError('VALIDATION_ERROR', 'Vendor already invited');

  const { data: invite, error } = await supabase
    .from('v2_bid_package_invites')
    .insert({
      bid_package_id: id,
      vendor_id,
      invited_at: new Date().toISOString(),
      invite_sent: false,
      declined: false,
      builder_id: builderId
    })
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logBidActivity(id, 'vendor_invited', invited_by || 'System', {
    vendor_id,
    vendor_name: invite.vendor?.name
  }, builderId);

  res.status(201).json({
    ...invite,
    vendor_name: invite.vendor?.name,
    vendor_email: invite.vendor?.email,
    vendor_phone: invite.vendor?.phone
  });
}));

// Remove invite from bid package
router.delete('/:id/invites/:inviteId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id, inviteId } = req.params;
  const { removed_by } = req.body;

  const { data: invite, error } = await supabase
    .from('v2_bid_package_invites')
    .delete()
    .eq('id', inviteId)
    .eq('bid_package_id', id)
    .eq('builder_id', builderId)
    .select(`*, vendor:v2_vendors(name)`)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!invite) throw new AppError('NOT_FOUND', 'Invite not found');

  await logBidActivity(id, 'invite_removed', removed_by || 'System', {
    vendor_name: invite.vendor?.name
  }, builderId);

  res.json({ success: true, message: 'Invite removed' });
}));

// Send invite email to vendor
router.post('/:id/invites/:inviteId/send', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id, inviteId } = req.params;
  const { sent_by } = req.body;

  // Get invite with vendor and bid package details
  const { data: invite, error: inviteError } = await supabase
    .from('v2_bid_package_invites')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone),
      bid_package:v2_bids(id, title, description, scope_of_work, due_date, job:v2_jobs(name))
    `)
    .eq('id', inviteId)
    .eq('bid_package_id', id)
    .eq('builder_id', builderId)
    .single();

  if (inviteError || !invite) throw new AppError('NOT_FOUND', 'Invite not found');

  const vendor = invite.vendor;
  const pkg = invite.bid_package;

  if (!vendor?.email) {
    throw new AppError('VALIDATION_ERROR', 'Vendor has no email address');
  }

  // Generate email content
  const subject = `Invitation to Bid: ${pkg.title} - ${pkg.job?.name || 'Project'}`;
  const dueDateStr = pkg.due_date ? new Date(pkg.due_date).toLocaleDateString() : 'TBD';

  const body = `Dear ${vendor.name},

${req.builder?.name || 'Your Company'} is pleased to invite you to submit a bid for the following scope of work:

PROJECT: ${pkg.job?.name || 'Project'}
SCOPE: ${pkg.title}
${pkg.description ? `\nDESCRIPTION:\n${pkg.description}` : ''}
${pkg.scope_of_work ? `\nSCOPE OF WORK:\n${pkg.scope_of_work}` : ''}

BID DUE DATE: ${dueDateStr}

Please review the attached documents and submit your proposal at your earliest convenience.

If you have any questions, please don't hesitate to contact us.

Best regards,
${req.builder?.name || 'Your Company'}`;

  // Generate mailto link
  const mailtoLink = `mailto:${encodeURIComponent(vendor.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Mark invite as sent
  const { error: updateError } = await supabase
    .from('v2_bid_package_invites')
    .update({
      invite_sent: true,
      invite_sent_at: new Date().toISOString()
    })
    .eq('id', inviteId)
    .eq('builder_id', builderId);

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  await logBidActivity(id, 'invite_sent', sent_by || 'System', {
    vendor_name: vendor.name,
    vendor_email: vendor.email
  }, builderId);

  res.json({
    success: true,
    mailtoLink,
    emailContent: {
      to: vendor.email,
      subject,
      body
    },
    message: `Invite prepared for ${vendor.name}`
  });
}));

// ============================================================
// SUBCONTRACTOR BIDS (SUBMISSIONS)
// ============================================================

// Get all submissions for a bid package
router.get('/:id/submissions', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: bids, error } = await supabase
    .from('v2_subcontractor_bids')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone)
    `)
    .eq('bid_package_id', id)
    .eq('builder_id', builderId)
    .order('bid_amount', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get document counts for all submissions
  const submissionIds = (bids || []).map(b => b.id);
  const { data: docCounts } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('subcontractor_bid_id')
    .eq('builder_id', builderId)
    .in('subcontractor_bid_id', submissionIds);

  const docCountMap = {};
  (docCounts || []).forEach(doc => {
    docCountMap[doc.subcontractor_bid_id] = (docCountMap[doc.subcontractor_bid_id] || 0) + 1;
  });

  // Calculate lowest bid flag and flatten vendor info
  const lowestAmount = bids?.length > 0 ? Math.min(...bids.map(b => parseFloat(b.bid_amount))) : null;
  const result = (bids || []).map(bid => ({
    ...bid,
    vendor_name: bid.vendor?.name,
    vendor_email: bid.vendor?.email,
    is_lowest_bid: parseFloat(bid.bid_amount) === lowestAmount,
    document_count: docCountMap[bid.id] || 0
  }));

  res.json(result);
}));

// Get single submission with documents
router.get('/submissions/:submissionId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { submissionId } = req.params;

  const { data: bid, error } = await supabase
    .from('v2_subcontractor_bids')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone),
      package:v2_bids(id, title, job_id)
    `)
    .eq('id', submissionId)
    .eq('builder_id', builderId)
    .single();

  if (error || !bid) throw new AppError('NOT_FOUND', 'Submission not found');

  // Get documents for this submission
  const { data: documents } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('*')
    .eq('subcontractor_bid_id', submissionId)
    .eq('builder_id', builderId)
    .order('uploaded_at', { ascending: false });

  res.json({
    ...bid,
    vendor_name: bid.vendor?.name,
    vendor_email: bid.vendor?.email,
    package_title: bid.package?.title,
    documents: documents || []
  });
}));

// Record a new subcontractor bid
router.post('/:id/submissions', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const {
    vendor_id,
    bid_amount,
    unit_price_per_sf,
    inclusions,
    exclusions,
    clarifications,
    alternate_amounts,
    proposed_start_date,
    proposed_duration_days,
    payment_terms,
    warranty_terms,
    bond_included,
    insurance_verified,
    valid_until,
    notes,
    submitted_by
  } = req.body;

  if (!vendor_id) throw new AppError('VALIDATION_ERROR', 'Vendor ID is required');
  if (!bid_amount) throw new AppError('VALIDATION_ERROR', 'Bid amount is required');

  // Verify bid package exists
  const { data: pkg, error: pkgError } = await supabase
    .from('v2_bids')
    .select('id, title')
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (pkgError || !pkg) throw new AppError('NOT_FOUND', 'Bid package not found');

  // Use provided unit price or null
  let calculatedUnitPrice = unit_price_per_sf || null;

  const { data: submission, error } = await supabase
    .from('v2_subcontractor_bids')
    .insert({
      bid_package_id: id,
      vendor_id,
      bid_amount: parseFloat(bid_amount),
      unit_price_per_sf: calculatedUnitPrice,
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
      notes: notes || null,
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      builder_id: builderId
    })
    .select(`
      *,
      vendor:v2_vendors(id, name, email)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logBidActivity(id, 'bid_received', submitted_by || 'System', {
    vendor_id,
    vendor_name: submission.vendor?.name,
    bid_amount: parseFloat(bid_amount)
  }, builderId);

  res.status(201).json({
    ...submission,
    vendor_name: submission.vendor?.name,
    vendor_email: submission.vendor?.email
  });
}));

// Update a subcontractor bid
router.patch('/submissions/:submissionId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { submissionId } = req.params;
  const {
    bid_amount,
    unit_price_per_sf,
    inclusions,
    exclusions,
    clarifications,
    alternate_amounts,
    proposed_start_date,
    proposed_duration_days,
    payment_terms,
    warranty_terms,
    bond_included,
    insurance_verified,
    valid_until,
    notes,
    status,
    is_lowest_bid,
    ranking,
    evaluation_score,
    evaluation_notes,
    updated_by
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };

  if (bid_amount !== undefined) updates.bid_amount = parseFloat(bid_amount);
  if (unit_price_per_sf !== undefined) updates.unit_price_per_sf = unit_price_per_sf;
  if (inclusions !== undefined) updates.inclusions = inclusions;
  if (exclusions !== undefined) updates.exclusions = exclusions;
  if (clarifications !== undefined) updates.clarifications = clarifications;
  if (alternate_amounts !== undefined) updates.alternate_amounts = alternate_amounts;
  if (proposed_start_date !== undefined) updates.proposed_start_date = proposed_start_date;
  if (proposed_duration_days !== undefined) updates.proposed_duration_days = proposed_duration_days;
  if (payment_terms !== undefined) updates.payment_terms = payment_terms;
  if (warranty_terms !== undefined) updates.warranty_terms = warranty_terms;
  if (bond_included !== undefined) updates.bond_included = bond_included;
  if (insurance_verified !== undefined) updates.insurance_verified = insurance_verified;
  if (valid_until !== undefined) updates.valid_until = valid_until;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;
  if (is_lowest_bid !== undefined) updates.is_lowest_bid = is_lowest_bid;
  if (ranking !== undefined) updates.ranking = ranking;
  if (evaluation_score !== undefined) updates.evaluation_score = evaluation_score;
  if (evaluation_notes !== undefined) updates.evaluation_notes = evaluation_notes;

  const { data: submission, error } = await supabase
    .from('v2_subcontractor_bids')
    .update(updates)
    .eq('id', submissionId)
    .eq('builder_id', builderId)
    .select(`
      *,
      vendor:v2_vendors(id, name, email)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!submission) throw new AppError('NOT_FOUND', 'Submission not found');

  // Log activity on the bid package
  await logBidActivity(submission.bid_package_id, 'bid_updated', updated_by || 'System', {
    submission_id: submissionId,
    vendor_name: submission.vendor?.name,
    updates
  }, builderId);

  res.json({
    ...submission,
    vendor_name: submission.vendor?.name,
    vendor_email: submission.vendor?.email
  });
}));

// Delete a subcontractor bid
router.delete('/submissions/:submissionId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { submissionId } = req.params;
  const { deleted_by } = req.body;

  const { data: submission, error } = await supabase
    .from('v2_subcontractor_bids')
    .delete()
    .eq('id', submissionId)
    .eq('builder_id', builderId)
    .select(`*, vendor:v2_vendors(name)`)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!submission) throw new AppError('NOT_FOUND', 'Submission not found');

  await logBidActivity(submission.bid_package_id, 'bid_deleted', deleted_by || 'System', {
    vendor_name: submission.vendor?.name,
    bid_amount: submission.bid_amount
  }, builderId);

  res.json({ success: true, message: 'Submission deleted' });
}));

// ============================================================
// SUBCONTRACTOR BID DOCUMENTS (Vendor Proposals)
// ============================================================

// Get documents for a subcontractor bid
router.get('/submissions/:submissionId/documents', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { submissionId } = req.params;

  const { data: docs, error } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('*')
    .eq('subcontractor_bid_id', submissionId)
    .eq('builder_id', builderId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(docs || []);
}));

// Upload document to subcontractor bid
router.post('/submissions/:submissionId/documents', upload.single('document'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { submissionId } = req.params;
  const { uploaded_by, document_type } = req.body;

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded');

  // Verify submission exists and get package id for logging
  const { data: submission, error: subError } = await supabase
    .from('v2_subcontractor_bids')
    .select('id, bid_package_id, vendor:v2_vendors(name)')
    .eq('id', submissionId)
    .eq('builder_id', builderId)
    .single();

  if (subError || !submission) throw new AppError('NOT_FOUND', 'Submission not found');

  // Upload to storage
  const fileName = `${BID_PREFIX}/submissions/${submissionId}/${Date.now()}-${req.file.originalname}`;
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype
    });

  if (uploadError) throw new AppError('STORAGE_ERROR', uploadError.message);

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  // Save document record
  const { data: doc, error: docError } = await supabase
    .from('v2_subcontractor_bid_documents')
    .insert({
      subcontractor_bid_id: submissionId,
      file_url: publicUrl,
      file_name: req.file.originalname,
      file_size: req.file.size,
      document_type: document_type || 'proposal',
      uploaded_by: uploaded_by || 'System',
      builder_id: builderId
    })
    .select()
    .single();

  if (docError) throw new AppError('DATABASE_ERROR', docError.message);

  await logBidActivity(submission.bid_package_id, 'submission_document_uploaded', uploaded_by || 'System', {
    vendor_name: submission.vendor?.name,
    file_name: req.file.originalname
  }, builderId);

  res.status(201).json(doc);
}));

// Delete document from subcontractor bid
router.delete('/submissions/:submissionId/documents/:docId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { submissionId, docId } = req.params;
  const { deleted_by } = req.body;

  // Get document and submission info
  const { data: doc, error: fetchError } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('*')
    .eq('id', docId)
    .eq('subcontractor_bid_id', submissionId)
    .eq('builder_id', builderId)
    .single();

  if (fetchError || !doc) throw new AppError('NOT_FOUND', 'Document not found');

  // Get submission for logging
  const { data: submission } = await supabase
    .from('v2_subcontractor_bids')
    .select('bid_package_id, vendor:v2_vendors(name)')
    .eq('id', submissionId)
    .eq('builder_id', builderId)
    .single();

  // Delete from storage
  const urlParts = doc.file_url.split('/');
  const storagePath = urlParts.slice(urlParts.indexOf(BID_PREFIX)).join('/');
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);

  // Delete record
  const { error: deleteError } = await supabase
    .from('v2_subcontractor_bid_documents')
    .delete()
    .eq('id', docId)
    .eq('builder_id', builderId);

  if (deleteError) throw new AppError('DATABASE_ERROR', deleteError.message);

  if (submission) {
    await logBidActivity(submission.bid_package_id, 'submission_document_deleted', deleted_by || 'System', {
      vendor_name: submission.vendor?.name,
      file_name: doc.file_name
    }, builderId);
  }

  res.json({ success: true, message: 'Document deleted' });
}));

// ============================================================
// AWARD BID PACKAGE
// ============================================================

router.post('/:id/award', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { vendor_id, amount, submission_id, awarded_by, notes } = req.body;

  if (!vendor_id) throw new AppError('VALIDATION_ERROR', 'Vendor ID is required');
  if (!amount) throw new AppError('VALIDATION_ERROR', 'Award amount is required');

  // Verify bid package exists
  const { data: pkg, error: pkgError } = await supabase
    .from('v2_bids')
    .select('id, title, status')
    .eq('id', id)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .single();

  if (pkgError || !pkg) throw new AppError('NOT_FOUND', 'Bid package not found');

  // Update the bid package
  const { data: updatedPkg, error: updateError } = await supabase
    .from('v2_bids')
    .update({
      status: 'awarded',
      awarded_vendor_id: vendor_id,
      awarded_amount: parseFloat(amount),
      awarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      awarded_vendor:v2_vendors!v2_bids_awarded_vendor_id_fkey(id, name)
    `)
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // If there's a submission_id, mark it as selected and others as rejected
  if (submission_id) {
    await supabase
      .from('v2_subcontractor_bids')
      .update({ status: 'selected', is_lowest_bid: true })
      .eq('id', submission_id)
      .eq('builder_id', builderId);

    await supabase
      .from('v2_subcontractor_bids')
      .update({ status: 'rejected' })
      .eq('bid_package_id', id)
      .eq('builder_id', builderId)
      .neq('id', submission_id)
      .not('status', 'in', '("withdrawn")');
  }

  // Get vendor name for logging
  const { data: vendor } = await supabase
    .from('v2_vendors')
    .select('name')
    .eq('id', vendor_id)
    .eq('builder_id', builderId)
    .single();

  await logBidActivity(id, 'awarded', awarded_by || 'System', {
    vendor_id,
    vendor_name: vendor?.name,
    amount: parseFloat(amount),
    notes: notes || null
  }, builderId);

  res.json({
    ...updatedPkg,
    awarded_vendor_name: updatedPkg.awarded_vendor?.name
  });
}));

// ============================================================
// AI EXTRACTION FROM BID DOCUMENTS
// ============================================================

router.post('/submissions/:submissionId/extract', upload.single('document'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { submissionId } = req.params;

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded');

  // Verify submission exists
  const { data: submission, error: subError } = await supabase
    .from('v2_subcontractor_bids')
    .select('id, bid_package_id, vendor:v2_vendors(name), package:v2_bids(title, square_footage)')
    .eq('id', submissionId)
    .eq('builder_id', builderId)
    .single();

  if (subError || !submission) throw new AppError('NOT_FOUND', 'Submission not found');

  try {
    // Convert PDF to base64 for AI processing
    const base64Content = req.file.buffer.toString('base64');
    const mediaType = req.file.mimetype === 'application/pdf' ? 'application/pdf' : 'image/png';

    // Use Claude to extract bid information
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Content
            }
          },
          {
            type: 'text',
            text: `Analyze this construction bid/proposal document and extract the following information in JSON format:

{
  "bid_amount": number or null (total bid amount in dollars),
  "unit_price_per_sf": number or null (price per square foot if mentioned),
  "inclusions": string[] (list of items/work included in the bid),
  "exclusions": string[] (list of items/work excluded from the bid),
  "clarifications": string[] (any clarifications or notes),
  "proposed_start_date": string or null (ISO date format YYYY-MM-DD if mentioned),
  "proposed_duration_days": number or null (project duration in days),
  "payment_terms": string or null (payment schedule/terms),
  "warranty_terms": string or null (warranty information),
  "bond_included": boolean (whether performance/payment bond is included),
  "valid_until": string or null (ISO date format when quote expires),
  "vendor_name": string or null (company name from the document),
  "confidence": number (0-1 confidence in extraction accuracy)
}

Only include fields you can confidently extract from the document. Return ONLY the JSON object, no other text.`
          }
        ]
      }]
    });

    const text = response.content[0].text.trim();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Calculate unit price if we have square footage and bid amount
    if (extracted.bid_amount && !extracted.unit_price_per_sf && submission.package?.square_footage) {
      extracted.unit_price_per_sf = Math.round((extracted.bid_amount / submission.package.square_footage) * 100) / 100;
    }

    // Log the extraction
    await logBidActivity(submission.bid_package_id, 'ai_extraction', 'AI', {
      vendor_name: submission.vendor?.name,
      extracted_amount: extracted.bid_amount,
      confidence: extracted.confidence
    }, builderId);

    res.json({
      success: true,
      extraction: extracted,
      source_file: req.file.originalname
    });

  } catch (error) {
    console.error('AI extraction error:', error);
    res.json({
      success: false,
      error: error.message || 'Failed to extract bid information',
      extraction: null
    });
  }
}));

// AI extraction without file (from existing document URL)
router.post('/submissions/:submissionId/documents/:docId/extract', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { submissionId, docId } = req.params;

  // Get the document
  const { data: doc, error: docError } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('*')
    .eq('id', docId)
    .eq('subcontractor_bid_id', submissionId)
    .eq('builder_id', builderId)
    .single();

  if (docError || !doc) throw new AppError('NOT_FOUND', 'Document not found');

  // Get submission with package info
  const { data: submission } = await supabase
    .from('v2_subcontractor_bids')
    .select('id, bid_package_id, vendor:v2_vendors(name), package:v2_bids(title, square_footage)')
    .eq('id', submissionId)
    .eq('builder_id', builderId)
    .single();

  try {
    // Fetch the document
    const fileResponse = await fetch(doc.file_url);
    if (!fileResponse.ok) throw new Error('Could not fetch document');

    const buffer = await fileResponse.arrayBuffer();
    const base64Content = Buffer.from(buffer).toString('base64');

    // Determine media type
    const extension = doc.file_name.toLowerCase().split('.').pop();
    const mediaType = extension === 'pdf' ? 'application/pdf' :
                      ['jpg', 'jpeg'].includes(extension) ? 'image/jpeg' :
                      extension === 'png' ? 'image/png' : 'application/pdf';

    // Use Claude to extract bid information
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Content
            }
          },
          {
            type: 'text',
            text: `Analyze this construction bid/proposal document and extract the following information in JSON format:

{
  "bid_amount": number or null (total bid amount in dollars),
  "unit_price_per_sf": number or null (price per square foot if mentioned),
  "inclusions": string[] (list of items/work included in the bid),
  "exclusions": string[] (list of items/work excluded from the bid),
  "clarifications": string[] (any clarifications or notes),
  "proposed_start_date": string or null (ISO date format YYYY-MM-DD if mentioned),
  "proposed_duration_days": number or null (project duration in days),
  "payment_terms": string or null (payment schedule/terms),
  "warranty_terms": string or null (warranty information),
  "bond_included": boolean (whether performance/payment bond is included),
  "valid_until": string or null (ISO date format when quote expires),
  "vendor_name": string or null (company name from the document),
  "confidence": number (0-1 confidence in extraction accuracy)
}

Only include fields you can confidently extract from the document. Return ONLY the JSON object, no other text.`
          }
        ]
      }]
    });

    const text = response.content[0].text.trim();

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const extracted = JSON.parse(jsonMatch[0]);

    // Calculate unit price if we have square footage and bid amount
    if (extracted.bid_amount && !extracted.unit_price_per_sf && submission?.package?.square_footage) {
      extracted.unit_price_per_sf = Math.round((extracted.bid_amount / submission.package.square_footage) * 100) / 100;
    }

    // Log the extraction
    if (submission) {
      await logBidActivity(submission.bid_package_id, 'ai_extraction', 'AI', {
        vendor_name: submission.vendor?.name,
        document_id: docId,
        extracted_amount: extracted.bid_amount,
        confidence: extracted.confidence
      }, builderId);
    }

    res.json({
      success: true,
      extraction: extracted,
      source_document: doc.file_name
    });

  } catch (error) {
    console.error('AI extraction error:', error);
    res.json({
      success: false,
      error: error.message || 'Failed to extract bid information',
      extraction: null
    });
  }
}));

// ============================================================
// BID PACKAGE TEMPLATES
// ============================================================

// List all templates
router.get('/templates/list', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { trade_category, active_only } = req.query;

  let query = supabase
    .from('v2_bid_package_templates')
    .select('*')
    .eq('builder_id', builderId)
    .order('usage_count', { ascending: false });

  if (trade_category) {
    query = query.eq('trade_category', trade_category);
  }

  if (active_only !== 'false') {
    query = query.eq('is_active', true);
  }

  const { data: templates, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(templates || []);
}));

// Get single template with checklist
router.get('/templates/:templateId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { templateId } = req.params;

  const { data: template, error } = await supabase
    .from('v2_bid_package_templates')
    .select('*')
    .eq('id', templateId)
    .eq('builder_id', builderId)
    .single();

  if (error || !template) throw new AppError('NOT_FOUND', 'Template not found');

  // Get checklist items
  const { data: checklist } = await supabase
    .from('v2_bid_template_checklist')
    .select('*')
    .eq('template_id', templateId)
    .eq('builder_id', builderId)
    .order('sort_order');

  template.checklist = checklist || [];

  res.json(template);
}));

// Create template
router.post('/templates', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    name,
    description,
    trade_category,
    scope_of_work,
    specs_summary,
    special_requirements,
    default_duration_days,
    typical_square_footage,
    checklist,
    created_by
  } = req.body;

  if (!name) throw new AppError('VALIDATION_ERROR', 'Template name is required');
  if (!trade_category) throw new AppError('VALIDATION_ERROR', 'Trade category is required');

  const { data: template, error } = await supabase
    .from('v2_bid_package_templates')
    .insert({
      name,
      description,
      trade_category,
      scope_of_work,
      specs_summary,
      special_requirements,
      default_duration_days,
      typical_square_footage,
      created_by: created_by || 'System',
      builder_id: builderId
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Add checklist items if provided
  if (checklist && checklist.length > 0) {
    const checklistItems = checklist.map((item, idx) => ({
      template_id: template.id,
      item_text: item.item_text || item,
      is_required: item.is_required || false,
      sort_order: idx,
      builder_id: builderId
    }));

    await supabase.from('v2_bid_template_checklist').insert(checklistItems);
  }

  res.status(201).json(template);
}));

// Create template from existing bid package
router.post('/templates/from-package/:packageId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { packageId } = req.params;
  const { name, created_by } = req.body;

  // Get the bid package
  const { data: pkg, error: pkgError } = await supabase
    .from('v2_bids')
    .select('*')
    .eq('id', packageId)
    .eq('builder_id', builderId)
    .single();

  if (pkgError || !pkg) throw new AppError('NOT_FOUND', 'Bid package not found');

  const templateName = name || `Template from ${pkg.title}`;

  const { data: template, error } = await supabase
    .from('v2_bid_package_templates')
    .insert({
      name: templateName,
      description: pkg.description,
      trade_category: pkg.trade_category || 'Other',
      scope_of_work: pkg.scope_of_work,
      specs_summary: pkg.specs_summary,
      special_requirements: pkg.special_requirements,
      typical_square_footage: pkg.square_footage,
      created_by: created_by || 'System',
      builder_id: builderId
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.status(201).json(template);
}));

// Update template
router.patch('/templates/:templateId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { templateId } = req.params;
  const {
    name,
    description,
    trade_category,
    scope_of_work,
    specs_summary,
    special_requirements,
    default_duration_days,
    typical_square_footage,
    is_active
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };

  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (trade_category !== undefined) updates.trade_category = trade_category;
  if (scope_of_work !== undefined) updates.scope_of_work = scope_of_work;
  if (specs_summary !== undefined) updates.specs_summary = specs_summary;
  if (special_requirements !== undefined) updates.special_requirements = special_requirements;
  if (default_duration_days !== undefined) updates.default_duration_days = default_duration_days;
  if (typical_square_footage !== undefined) updates.typical_square_footage = typical_square_footage;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data: template, error } = await supabase
    .from('v2_bid_package_templates')
    .update(updates)
    .eq('id', templateId)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!template) throw new AppError('NOT_FOUND', 'Template not found');

  res.json(template);
}));

// Delete template
router.delete('/templates/:templateId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { templateId } = req.params;

  const { error } = await supabase
    .from('v2_bid_package_templates')
    .delete()
    .eq('id', templateId)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: 'Template deleted' });
}));

// Apply template to new bid package (increment usage count)
router.post('/templates/:templateId/apply', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { templateId } = req.params;

  // Get template
  const { data: template, error: tplError } = await supabase
    .from('v2_bid_package_templates')
    .select('*')
    .eq('id', templateId)
    .eq('builder_id', builderId)
    .single();

  if (tplError || !template) throw new AppError('NOT_FOUND', 'Template not found');

  // Increment usage count
  await supabase
    .from('v2_bid_package_templates')
    .update({ usage_count: (template.usage_count || 0) + 1 })
    .eq('id', templateId)
    .eq('builder_id', builderId);

  // Return template data for form population
  res.json({
    trade_category: template.trade_category,
    scope_of_work: template.scope_of_work,
    description: template.description,
    specs_summary: template.specs_summary,
    special_requirements: template.special_requirements,
    square_footage: template.typical_square_footage
  });
}));

// Export the helper for use in status change
module.exports = router;
module.exports.updateBudgetFromAcceptedBid = updateBudgetFromAcceptedBid;
