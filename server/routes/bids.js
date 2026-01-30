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
// LIST BIDS
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { job_id, vendor_id, status, search } = req.query;

  let query = supabase
    .from('v2_bids')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      documents:v2_bid_documents(id, file_name, file_url)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Add document count
  const result = (data || []).map(bid => ({
    ...bid,
    document_count: bid.documents?.length || 0
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
      vendor:v2_vendors(id, name, email, phone)
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
      vendor:v2_vendors(id, name)
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
      vendor:v2_vendors(id, name)
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
      vendor:v2_vendors(id, name)
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
      vendor:v2_vendors(id, name),
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

// Export the helper for use in status change
module.exports = router;
module.exports.updateBudgetFromAcceptedBid = updateBudgetFromAcceptedBid;
