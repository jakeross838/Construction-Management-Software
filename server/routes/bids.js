/**
 * Bids Routes
 * Vendor bid collection, comparison, and PO conversion
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

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

async function logBidActivity(bidId, action, performedBy, details = {}) {
  await supabase.from('v2_bid_activity').insert({
    bid_id: bidId,
    action,
    performed_by: performedBy,
    details
  });
}

// ============================================================
// AI TRADE CATEGORY SUGGESTION
// ============================================================

router.post('/suggest-trade', asyncHandler(async (req, res) => {
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

router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_bids')
    .select('id, status, bid_amount')
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
    .in('bid_package_id', packageIds);

  // Get subcontractor bid counts
  const { data: bidCounts } = await supabase
    .from('v2_subcontractor_bids')
    .select('bid_package_id')
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
    .is('deleted_at', null)
    .single();

  if (error || !bid) throw new AppError('NOT_FOUND', 'Bid not found');

  // Get documents
  const { data: documents } = await supabase
    .from('v2_bid_documents')
    .select('*')
    .eq('bid_id', id)
    .order('uploaded_at', { ascending: false });

  // Get activity
  const { data: activity } = await supabase
    .from('v2_bid_activity')
    .select('*')
    .eq('bid_id', id)
    .order('created_at', { ascending: false });

  // Check if already converted to PO
  const { data: linkedPO } = await supabase
    .from('v2_purchase_orders')
    .select('id, po_number, status')
    .eq('source_bid_id', id)
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
      status: 'received'
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors!v2_bids_vendor_id_fkey(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logBidActivity(bid.id, 'created', created_by || 'System', { title });

  res.status(201).json(bid);
}));

// ============================================================
// UPDATE BID
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
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
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors!v2_bids_vendor_id_fkey(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!bid) throw new AppError('NOT_FOUND', 'Bid not found');

  await logBidActivity(id, 'updated', updated_by || 'System', { updates });

  res.json(bid);
}));

// ============================================================
// DELETE BID (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;

  const { data: bid, error } = await supabase
    .from('v2_bids')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!bid) throw new AppError('NOT_FOUND', 'Bid not found');

  await logBidActivity(id, 'deleted', deleted_by || 'System', {});

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
  const { id } = req.params;
  const { status: newStatus, performed_by, notes } = req.body;

  if (!newStatus) throw new AppError('VALIDATION_ERROR', 'Status is required');

  // Get current bid
  const { data: bid, error: fetchError } = await supabase
    .from('v2_bids')
    .select('status, job_id')
    .eq('id', id)
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
  });

  // Auto-update budget when bid is accepted
  if (newStatus === 'accepted') {
    try {
      await updateBudgetFromAcceptedBid(id, bid.job_id);
      await logBidActivity(id, 'budget_updated', 'System', {
        message: 'Budget lines auto-updated from accepted bid'
      });
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
  const { id } = req.params;
  const { uploaded_by } = req.body;

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded');

  // Verify bid exists
  const { data: bid, error: bidError } = await supabase
    .from('v2_bids')
    .select('id, title')
    .eq('id', id)
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
      uploaded_by: uploaded_by || 'System'
    })
    .select()
    .single();

  if (docError) throw new AppError('DATABASE_ERROR', docError.message);

  await logBidActivity(id, 'document_uploaded', uploaded_by || 'System', {
    file_name: req.file.originalname
  });

  res.status(201).json(doc);
}));

// ============================================================
// DELETE DOCUMENT
// ============================================================

router.delete('/documents/:docId', asyncHandler(async (req, res) => {
  const { docId } = req.params;
  const { deleted_by } = req.body;

  // Get document
  const { data: doc, error: fetchError } = await supabase
    .from('v2_bid_documents')
    .select('*, bid:v2_bids(id)')
    .eq('id', docId)
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
    .eq('id', docId);

  if (deleteError) throw new AppError('DATABASE_ERROR', deleteError.message);

  await logBidActivity(doc.bid_id, 'document_deleted', deleted_by || 'System', {
    file_name: doc.file_name
  });

  res.json({ success: true, message: 'Document deleted' });
}));

// ============================================================
// MOVE DOCUMENT TO ANOTHER BID
// ============================================================

router.patch('/documents/:docId', asyncHandler(async (req, res) => {
  const { docId } = req.params;
  const { bid_id: newBidId, moved_by } = req.body;

  if (!newBidId) throw new AppError('VALIDATION_ERROR', 'New bid_id is required');

  // Get current document
  const { data: doc, error: fetchError } = await supabase
    .from('v2_bid_documents')
    .select('*, bid:v2_bids(id, title, job_id)')
    .eq('id', docId)
    .single();

  if (fetchError || !doc) throw new AppError('NOT_FOUND', 'Document not found');

  // Verify target bid exists
  const { data: targetBid, error: targetError } = await supabase
    .from('v2_bids')
    .select('id, title, job_id')
    .eq('id', newBidId)
    .is('deleted_at', null)
    .single();

  if (targetError || !targetBid) throw new AppError('NOT_FOUND', 'Target bid not found');

  // Update document's bid_id
  const { data: updated, error: updateError } = await supabase
    .from('v2_bid_documents')
    .update({ bid_id: newBidId })
    .eq('id', docId)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Log activity on both bids
  await logBidActivity(doc.bid_id, 'document_moved_out', moved_by || 'System', {
    file_name: doc.file_name,
    moved_to_bid_id: newBidId,
    moved_to_bid_title: targetBid.title
  });

  await logBidActivity(newBidId, 'document_moved_in', moved_by || 'System', {
    file_name: doc.file_name,
    moved_from_bid_id: doc.bid_id,
    moved_from_bid_title: doc.bid?.title
  });

  res.json(updated);
}));

// ============================================================
// CONVERT BID TO PURCHASE ORDER
// ============================================================

router.post('/:id/convert-to-po', asyncHandler(async (req, res) => {
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
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (poError) throw new AppError('DATABASE_ERROR', poError.message);

  // Create line items - use bid lines if available, otherwise use provided line_items
  const { data: bidLines } = await supabase
    .from('v2_bid_lines')
    .select('*')
    .eq('bid_id', id)
    .order('sort_order');

  if (bidLines?.length > 0) {
    const lineItemsToInsert = bidLines.map(bl => ({
      po_id: po.id,
      cost_code_id: bl.cost_code_id,
      description: bl.description,
      amount: bl.amount
    }));
    await supabase.from('v2_po_line_items').insert(lineItemsToInsert);
  } else if (line_items?.length > 0) {
    const lineItemsToInsert = line_items.map(li => ({
      po_id: po.id,
      cost_code_id: li.cost_code_id,
      description: li.description,
      amount: li.amount
    }));
    await supabase.from('v2_po_line_items').insert(lineItemsToInsert);
  }

  // Log activity
  await logBidActivity(id, 'converted_to_po', created_by || 'System', {
    po_id: po.id,
    po_number: poNumber
  });

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
  const { id } = req.params;

  const { data: lines, error } = await supabase
    .from('v2_bid_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('bid_id', id)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(lines || []);
}));

// Add bid line
router.post('/:id/lines', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cost_code_id, description, quantity, unit, unit_cost, amount, created_by } = req.body;

  // Verify bid exists
  const { data: bid, error: bidError } = await supabase
    .from('v2_bids')
    .select('id, status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (bidError || !bid) throw new AppError('NOT_FOUND', 'Bid not found');

  // Get max sort_order
  const { data: maxOrder } = await supabase
    .from('v2_bid_lines')
    .select('sort_order')
    .eq('bid_id', id)
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
      sort_order: sortOrder
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
  });

  res.status(201).json(line);
}));

// Update bid line
router.patch('/:id/lines/:lineId', asyncHandler(async (req, res) => {
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
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!line) throw new AppError('NOT_FOUND', 'Line item not found');

  await logBidActivity(id, 'line_updated', updated_by || 'System', { line_id: lineId, updates });

  res.json(line);
}));

// Delete bid line
router.delete('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  const { id, lineId } = req.params;
  const { deleted_by } = req.body;

  const { data: line, error } = await supabase
    .from('v2_bid_lines')
    .delete()
    .eq('id', lineId)
    .eq('bid_id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!line) throw new AppError('NOT_FOUND', 'Line item not found');

  await logBidActivity(id, 'line_deleted', deleted_by || 'System', {
    line_id: lineId,
    description: line.description,
    amount: line.amount
  });

  res.json({ success: true, message: 'Line item deleted' });
}));

// Get bid lines total (for validation)
router.get('/:id/lines/total', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: lines, error } = await supabase
    .from('v2_bid_lines')
    .select('amount')
    .eq('bid_id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const total = (lines || []).reduce((sum, line) => sum + (parseFloat(line.amount) || 0), 0);

  // Get bid amount for comparison
  const { data: bid } = await supabase
    .from('v2_bids')
    .select('bid_amount')
    .eq('id', id)
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
async function updateBudgetFromAcceptedBid(bidId, jobId) {
  // Get bid lines
  const { data: bidLines } = await supabase
    .from('v2_bid_lines')
    .select('*')
    .eq('bid_id', bidId);

  // Get the bid itself for lump sum handling
  const { data: bid } = await supabase
    .from('v2_bids')
    .select('bid_amount, primary_cost_code_id')
    .eq('id', bidId)
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
          .eq('id', existing.id);
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
            source_bid_id: bidId
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
          .eq('id', existing.id);
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
            source_bid_id: bidId
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
  const { id } = req.params;

  const { data: invites, error } = await supabase
    .from('v2_bid_package_invites')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone)
    `)
    .eq('bid_package_id', id)
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
  const { id } = req.params;
  const { vendor_id, invited_by } = req.body;

  if (!vendor_id) throw new AppError('VALIDATION_ERROR', 'Vendor ID is required');

  // Verify bid exists
  const { data: bid, error: bidError } = await supabase
    .from('v2_bids')
    .select('id, title')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (bidError || !bid) throw new AppError('NOT_FOUND', 'Bid package not found');

  // Check if already invited
  const { data: existing } = await supabase
    .from('v2_bid_package_invites')
    .select('id')
    .eq('bid_package_id', id)
    .eq('vendor_id', vendor_id)
    .single();

  if (existing) throw new AppError('VALIDATION_ERROR', 'Vendor already invited');

  const { data: invite, error } = await supabase
    .from('v2_bid_package_invites')
    .insert({
      bid_package_id: id,
      vendor_id,
      invited_at: new Date().toISOString(),
      invite_sent: false,
      declined: false
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
  });

  res.status(201).json({
    ...invite,
    vendor_name: invite.vendor?.name,
    vendor_email: invite.vendor?.email,
    vendor_phone: invite.vendor?.phone
  });
}));

// Remove invite from bid package
router.delete('/:id/invites/:inviteId', asyncHandler(async (req, res) => {
  const { id, inviteId } = req.params;
  const { removed_by } = req.body;

  const { data: invite, error } = await supabase
    .from('v2_bid_package_invites')
    .delete()
    .eq('id', inviteId)
    .eq('bid_package_id', id)
    .select(`*, vendor:v2_vendors(name)`)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!invite) throw new AppError('NOT_FOUND', 'Invite not found');

  await logBidActivity(id, 'invite_removed', removed_by || 'System', {
    vendor_name: invite.vendor?.name
  });

  res.json({ success: true, message: 'Invite removed' });
}));

// Send invite email to vendor
router.post('/:id/invites/:inviteId/send', asyncHandler(async (req, res) => {
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

Ross Built Custom Homes is pleased to invite you to submit a bid for the following scope of work:

PROJECT: ${pkg.job?.name || 'Project'}
SCOPE: ${pkg.title}
${pkg.description ? `\nDESCRIPTION:\n${pkg.description}` : ''}
${pkg.scope_of_work ? `\nSCOPE OF WORK:\n${pkg.scope_of_work}` : ''}

BID DUE DATE: ${dueDateStr}

Please review the attached documents and submit your proposal at your earliest convenience.

If you have any questions, please don't hesitate to contact us.

Best regards,
Ross Built Custom Homes`;

  // Generate mailto link
  const mailtoLink = `mailto:${encodeURIComponent(vendor.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Mark invite as sent
  const { error: updateError } = await supabase
    .from('v2_bid_package_invites')
    .update({
      invite_sent: true,
      invite_sent_at: new Date().toISOString()
    })
    .eq('id', inviteId);

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  await logBidActivity(id, 'invite_sent', sent_by || 'System', {
    vendor_name: vendor.name,
    vendor_email: vendor.email
  });

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
  const { id } = req.params;

  const { data: bids, error } = await supabase
    .from('v2_subcontractor_bids')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone)
    `)
    .eq('bid_package_id', id)
    .order('bid_amount', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get document counts for all submissions
  const submissionIds = (bids || []).map(b => b.id);
  const { data: docCounts } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('subcontractor_bid_id')
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
  const { submissionId } = req.params;

  const { data: bid, error } = await supabase
    .from('v2_subcontractor_bids')
    .select(`
      *,
      vendor:v2_vendors(id, name, email, phone),
      package:v2_bids(id, title, job_id)
    `)
    .eq('id', submissionId)
    .single();

  if (error || !bid) throw new AppError('NOT_FOUND', 'Submission not found');

  // Get documents for this submission
  const { data: documents } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('*')
    .eq('subcontractor_bid_id', submissionId)
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
      submitted_at: new Date().toISOString()
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
  });

  res.status(201).json({
    ...submission,
    vendor_name: submission.vendor?.name,
    vendor_email: submission.vendor?.email
  });
}));

// Update a subcontractor bid
router.patch('/submissions/:submissionId', asyncHandler(async (req, res) => {
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
  });

  res.json({
    ...submission,
    vendor_name: submission.vendor?.name,
    vendor_email: submission.vendor?.email
  });
}));

// Delete a subcontractor bid
router.delete('/submissions/:submissionId', asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { deleted_by } = req.body;

  const { data: submission, error } = await supabase
    .from('v2_subcontractor_bids')
    .delete()
    .eq('id', submissionId)
    .select(`*, vendor:v2_vendors(name)`)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!submission) throw new AppError('NOT_FOUND', 'Submission not found');

  await logBidActivity(submission.bid_package_id, 'bid_deleted', deleted_by || 'System', {
    vendor_name: submission.vendor?.name,
    bid_amount: submission.bid_amount
  });

  res.json({ success: true, message: 'Submission deleted' });
}));

// ============================================================
// SUBCONTRACTOR BID DOCUMENTS (Vendor Proposals)
// ============================================================

// Get documents for a subcontractor bid
router.get('/submissions/:submissionId/documents', asyncHandler(async (req, res) => {
  const { submissionId } = req.params;

  const { data: docs, error } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('*')
    .eq('subcontractor_bid_id', submissionId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(docs || []);
}));

// Upload document to subcontractor bid
router.post('/submissions/:submissionId/documents', upload.single('document'), asyncHandler(async (req, res) => {
  const { submissionId } = req.params;
  const { uploaded_by, document_type } = req.body;

  if (!req.file) throw new AppError('VALIDATION_ERROR', 'No file uploaded');

  // Verify submission exists and get package id for logging
  const { data: submission, error: subError } = await supabase
    .from('v2_subcontractor_bids')
    .select('id, bid_package_id, vendor:v2_vendors(name)')
    .eq('id', submissionId)
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
      uploaded_by: uploaded_by || 'System'
    })
    .select()
    .single();

  if (docError) throw new AppError('DATABASE_ERROR', docError.message);

  await logBidActivity(submission.bid_package_id, 'submission_document_uploaded', uploaded_by || 'System', {
    vendor_name: submission.vendor?.name,
    file_name: req.file.originalname
  });

  res.status(201).json(doc);
}));

// Delete document from subcontractor bid
router.delete('/submissions/:submissionId/documents/:docId', asyncHandler(async (req, res) => {
  const { submissionId, docId } = req.params;
  const { deleted_by } = req.body;

  // Get document and submission info
  const { data: doc, error: fetchError } = await supabase
    .from('v2_subcontractor_bid_documents')
    .select('*')
    .eq('id', docId)
    .eq('subcontractor_bid_id', submissionId)
    .single();

  if (fetchError || !doc) throw new AppError('NOT_FOUND', 'Document not found');

  // Get submission for logging
  const { data: submission } = await supabase
    .from('v2_subcontractor_bids')
    .select('bid_package_id, vendor:v2_vendors(name)')
    .eq('id', submissionId)
    .single();

  // Delete from storage
  const urlParts = doc.file_url.split('/');
  const storagePath = urlParts.slice(urlParts.indexOf(BID_PREFIX)).join('/');
  await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);

  // Delete record
  const { error: deleteError } = await supabase
    .from('v2_subcontractor_bid_documents')
    .delete()
    .eq('id', docId);

  if (deleteError) throw new AppError('DATABASE_ERROR', deleteError.message);

  if (submission) {
    await logBidActivity(submission.bid_package_id, 'submission_document_deleted', deleted_by || 'System', {
      vendor_name: submission.vendor?.name,
      file_name: doc.file_name
    });
  }

  res.json({ success: true, message: 'Document deleted' });
}));

// ============================================================
// AWARD BID PACKAGE
// ============================================================

router.post('/:id/award', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vendor_id, amount, submission_id, awarded_by, notes } = req.body;

  if (!vendor_id) throw new AppError('VALIDATION_ERROR', 'Vendor ID is required');
  if (!amount) throw new AppError('VALIDATION_ERROR', 'Award amount is required');

  // Verify bid package exists
  const { data: pkg, error: pkgError } = await supabase
    .from('v2_bids')
    .select('id, title, status')
    .eq('id', id)
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
      .eq('id', submission_id);

    await supabase
      .from('v2_subcontractor_bids')
      .update({ status: 'rejected' })
      .eq('bid_package_id', id)
      .neq('id', submission_id)
      .not('status', 'in', '("withdrawn")');
  }

  // Get vendor name for logging
  const { data: vendor } = await supabase
    .from('v2_vendors')
    .select('name')
    .eq('id', vendor_id)
    .single();

  await logBidActivity(id, 'awarded', awarded_by || 'System', {
    vendor_id,
    vendor_name: vendor?.name,
    amount: parseFloat(amount),
    notes: notes || null
  });

  res.json({
    ...updatedPkg,
    awarded_vendor_name: updatedPkg.awarded_vendor?.name
  });
}));

// Export the helper for use in status change
module.exports = router;
module.exports.updateBudgetFromAcceptedBid = updateBudgetFromAcceptedBid;
