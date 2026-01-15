/**
 * Invoice Routes
 * All invoice management endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler, notFoundError, validationError, transitionError } = require('../errors');
const { broadcastInvoiceUpdate, broadcast } = require('../realtime');
const {
  logActivity,
  updatePOLineItemsForAllocations,
  syncPOLineItemsOnAllocationChange,
  updatePOInvoicedAmounts,
  updateCOInvoicedAmounts,
  stampInvoice,
  restampInvoice,
  checkSplitReconciliation,
  getOrCreateDraftDraw
} = require('../services/invoiceHelpers');
const {
  uploadPDF,
  uploadStampedPDFById,
  downloadPDF,
  deleteByUrl,
  extractStoragePath
} = require('../storage');
const {
  stampApproval,
  stampInDraw,
  stampPaid,
  stampNeedsReview,
  stampReadyForApproval,
  stampSplit
} = require('../pdf-stamper');
const {
  validateInvoice,
  validateStatusTransition,
  validatePreTransition,
  validateAllocations,
  validateCostCodesExist
} = require('../validation');
const { createUndoSnapshot, UNDO_WINDOW_SECONDS } = require('../undo');
const { processInvoice, extractInvoiceFromImage, extractInvoiceFromText, findMatchingJob, findOrCreateVendor, findOrCreatePO } = require('../ai-processor');
const { convertDocument, getSupportedExtensions } = require('../document-converter');
const { checkForDuplicates } = require('../duplicate-check');
const standards = require('../standards');

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============================================================
// LIST & FILTER ENDPOINTS
// ============================================================

// List invoices (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { job_id, status, vendor_id } = req.query;

    let query = supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, total_amount),
        allocations:v2_invoice_allocations(
          id, amount, notes, job_id, change_order_id,
          cost_code:v2_cost_codes(id, code, name)
        ),
        draw_invoices:v2_draw_invoices(draw_id, draw:v2_draws(id, draw_number, status))
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (job_id) query = query.eq('job_id', job_id);
    if (status) query = query.eq('status', status);
    if (vendor_id) query = query.eq('vendor_id', vendor_id);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoices that need review
router.get('/needs-review', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('needs_review', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get invoices with low AI confidence
router.get('/low-confidence', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('ai_processed', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const lowConfidence = data.filter(inv => {
    if (!inv.ai_confidence) return false;
    return Object.values(inv.ai_confidence).some(c => c < 0.6);
  });

  res.json(lowConfidence);
}));

// Get invoices without job assignment
router.get('/no-job', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      vendor:v2_vendors(id, name)
    `)
    .is('job_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// SINGLE INVOICE ENDPOINTS
// ============================================================

// Get single invoice with full details
router.get('/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name, email, phone),
        job:v2_jobs(id, name, address),
        po:v2_purchase_orders(id, po_number, total_amount),
        allocations:v2_invoice_allocations(
          id, amount, notes, job_id, po_id, po_line_item_id, change_order_id, pending_co,
          cost_code:v2_cost_codes(id, code, name, category),
          purchase_order:v2_purchase_orders(id, po_number),
          change_order:v2_job_change_orders(id, change_order_number, title)
        ),
        draw_invoices:v2_draw_invoices(draw_id, draw:v2_draws(id, draw_number, status))
      `)
      .eq('id', req.params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      throw error;
    }

    // Flatten draw info
    if (data.draw_invoices?.length > 0) {
      data.draw_id = data.draw_invoices[0].draw_id;
      data.draw = data.draw_invoices[0].draw;
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoice activity log
router.get('/:id/activity', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_invoice_activity')
      .select('*')
      .eq('invoice_id', req.params.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoice allocations
router.get('/:id/allocations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        id, amount, notes, cost_code_id, job_id, po_id, po_line_item_id, change_order_id,
        cost_code:v2_cost_codes(id, code, name, category),
        purchase_order:v2_purchase_orders(id, po_number),
        change_order:v2_job_change_orders(id, change_order_number, title)
      `)
      .eq('invoice_id', req.params.id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoice version
router.get('/:id/version', asyncHandler(async (req, res) => {
  const { data: invoice, error } = await supabase
    .from('v2_invoices')
    .select('id, version, updated_at')
    .eq('id', req.params.id)
    .single();

  if (error || !invoice) {
    throw notFoundError('invoice', req.params.id);
  }

  res.json({
    id: invoice.id,
    version: invoice.version,
    updated_at: invoice.updated_at
  });
}));

// Get invoice family (parent + children for split invoices)
router.get('/:id/family', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .select('id, parent_invoice_id, is_split_parent')
      .eq('id', id)
      .single();

    if (invError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const rootId = invoice.is_split_parent ? id : (invoice.parent_invoice_id || id);

    if (!invoice.parent_invoice_id && !invoice.is_split_parent) {
      return res.json({ is_split: false, parent: null, children: [] });
    }

    const { data: parent } = await supabase
      .from('v2_invoices')
      .select(`*, vendor:v2_vendors(id, name), job:v2_jobs(id, name)`)
      .eq('id', rootId)
      .single();

    const { data: children } = await supabase
      .from('v2_invoices')
      .select(`
        *, vendor:v2_vendors(id, name), job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, job_change_order_id)
      `)
      .eq('parent_invoice_id', rootId)
      .is('deleted_at', null)
      .order('split_index');

    res.json({ is_split: true, parent, children: children || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UPLOAD & PROCESSING ENDPOINTS
// ============================================================

// Upload invoice with PDF (manual upload)
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    const { job_id, vendor_id, invoice_number, invoice_date, due_date, amount, notes, uploaded_by } = req.body;

    let pdf_url = null;
    if (req.file) {
      const result = await uploadPDF(req.file.buffer, req.file.originalname, job_id);
      pdf_url = result.url;
    }

    const parsedAmount = parseFloat(amount) || 0;
    const invoice_type = parsedAmount < 0 ? 'credit_memo' : 'standard';

    const { data: invoice, error } = await supabase
      .from('v2_invoices')
      .insert({
        job_id,
        vendor_id: vendor_id || null,
        invoice_number,
        invoice_date,
        due_date: due_date || null,
        amount,
        notes: notes || null,
        pdf_url,
        status: 'needs_review',
        invoice_type
      })
      .select()
      .single();

    if (error) throw error;

    await logActivity(invoice.id, 'uploaded', uploaded_by || 'System', {
      filename: req.file?.originalname
    });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI-powered invoice processing
router.post('/process', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        supported: 'PDF, images (JPG, PNG, etc.), Word (.doc, .docx), Excel (.xls, .xlsx)'
      });
    }

    const originalFilename = req.file.originalname;
    const fileBuffer = req.file.buffer;
    const mimetype = req.file.mimetype;

    console.log(`[Upload] Processing: ${originalFilename} (${mimetype}, ${fileBuffer.length} bytes)`);

    const converted = await convertDocument(fileBuffer, originalFilename, mimetype);

    if (!converted.success) {
      return res.status(400).json({
        error: 'Document conversion failed',
        details: converted.error,
        supported: getSupportedExtensions()
      });
    }

    let result;

    if (converted.fileType === 'PDF') {
      result = await processInvoice(fileBuffer, originalFilename);
    } else if (converted.fileType === 'IMAGE') {
      const extracted = await extractInvoiceFromImage(
        converted.data.base64,
        converted.data.mediaType,
        originalFilename
      );

      result = {
        success: true,
        ai_processed: true,
        extracted: {
          vendor: extracted.vendor,
          invoiceNumber: extracted.invoiceNumber,
          invoiceDate: extracted.invoiceDate,
          dueDate: extracted.dueDate,
          totalAmount: extracted.amounts?.totalAmount,
          lineItems: extracted.lineItems || [],
          job: extracted.job,
          extractionConfidence: extracted.extractionConfidence
        },
        ai_extracted_data: {
          parsed_vendor_name: extracted.vendor?.companyName,
          parsed_amount: extracted.amounts?.totalAmount,
          parsed_invoice_number: extracted.invoiceNumber,
          parsed_date: extracted.invoiceDate,
          source_type: 'image',
          original_format: converted.data.originalFormat
        },
        ai_confidence: extracted.extractionConfidence || {},
        messages: ['Processed image document with Claude Vision'],
        needs_review: true,
        review_flags: ['image_source']
      };

      if (extracted.vendor?.companyName) {
        result.vendor = await findOrCreateVendor(extracted.vendor, extracted.vendor?.tradeType);
      }
      if (extracted.job) {
        result.matchedJob = await findMatchingJob(extracted.job);
      }
      if (result.vendor && result.matchedJob) {
        result.po = await findOrCreatePO(result.vendor, result.matchedJob, result.extracted.totalAmount, extracted.job?.poNumber);
      }

      const vendorName = result.vendor?.name || extracted.vendor?.companyName || 'Unknown';
      const jobName = result.matchedJob?.name || 'Unassigned';
      const dateStr = extracted.invoiceDate || new Date().toISOString().split('T')[0];
      result.standardizedFilename = standards.generateInvoiceFilename(jobName, vendorName, dateStr);

      if (result.vendor?.id && extracted.invoiceNumber) {
        const dupes = await checkForDuplicates(result.vendor.id, extracted.invoiceNumber, result.extracted.totalAmount);
        result.suggestions = { possible_duplicates: dupes };
      }
    } else if (converted.fileType === 'WORD' || converted.fileType === 'EXCEL') {
      const documentText = converted.data.text;
      const extracted = await extractInvoiceFromText(documentText, originalFilename, converted.fileType);

      result = {
        success: true,
        ai_processed: true,
        extracted: {
          vendor: extracted.vendor,
          invoiceNumber: extracted.invoiceNumber,
          invoiceDate: extracted.invoiceDate,
          dueDate: extracted.dueDate,
          totalAmount: extracted.amounts?.totalAmount,
          lineItems: extracted.lineItems || [],
          job: extracted.job,
          extractionConfidence: extracted.extractionConfidence
        },
        ai_extracted_data: {
          parsed_vendor_name: extracted.vendor?.companyName,
          parsed_amount: extracted.amounts?.totalAmount,
          parsed_invoice_number: extracted.invoiceNumber,
          parsed_date: extracted.invoiceDate,
          source_type: converted.fileType.toLowerCase(),
          raw_text: documentText?.substring(0, 2000)
        },
        ai_confidence: extracted.extractionConfidence || {},
        messages: [`Processed ${converted.fileType} document`],
        needs_review: true,
        review_flags: [`${converted.fileType.toLowerCase()}_source`]
      };

      if (extracted.vendor?.companyName) {
        result.vendor = await findOrCreateVendor(extracted.vendor, extracted.vendor?.tradeType);
      }
      if (extracted.job) {
        result.matchedJob = await findMatchingJob(extracted.job);
      }
      if (result.vendor && result.matchedJob) {
        result.po = await findOrCreatePO(result.vendor, result.matchedJob, result.extracted.totalAmount, extracted.job?.poNumber);
      }

      const vendorName = result.vendor?.name || extracted.vendor?.companyName || 'Unknown';
      const jobName = result.matchedJob?.name || 'Unassigned';
      const dateStr = extracted.invoiceDate || new Date().toISOString().split('T')[0];
      result.standardizedFilename = standards.generateInvoiceFilename(jobName, vendorName, dateStr);

      if (result.vendor?.id && extracted.invoiceNumber) {
        const dupes = await checkForDuplicates(result.vendor.id, extracted.invoiceNumber, result.extracted.totalAmount);
        result.suggestions = { possible_duplicates: dupes };
      }
    } else {
      return res.status(400).json({ error: 'Unsupported file type', fileType: converted.fileType });
    }

    if (!result.success) {
      return res.status(422).json({ error: 'Processing failed', messages: result.messages });
    }

    // Check for high-confidence duplicates
    const duplicates = result.suggestions?.possible_duplicates || [];
    const highConfidenceDupe = duplicates.find(d => d.confidence >= 0.95);

    if (highConfidenceDupe) {
      return res.status(409).json({
        error: 'Duplicate invoice detected',
        message: `This appears to be a duplicate of invoice #${highConfidenceDupe.invoice_number}`,
        duplicate: {
          id: highConfidenceDupe.id,
          invoice_number: highConfidenceDupe.invoice_number,
          amount: highConfidenceDupe.amount,
          status: highConfidenceDupe.status,
          confidence: highConfidenceDupe.confidence
        }
      });
    }

    // Upload PDF
    let pdf_url = null;
    const jobId = result.matchedJob?.id;
    const storagePath = result.standardizedFilename;
    const bufferToUpload = converted.pdfBuffer || fileBuffer;

    if (jobId) {
      const uploadResult = await uploadPDF(bufferToUpload, storagePath, jobId);
      pdf_url = uploadResult.url;
    } else {
      const uploadResult = await uploadPDF(bufferToUpload, `unassigned/${storagePath}`, null);
      pdf_url = uploadResult.url;
    }

    // Create invoice record
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .insert({
        job_id: jobId || null,
        vendor_id: result.vendor?.id || null,
        po_id: result.po?.id || null,
        invoice_number: result.extracted.invoiceNumber,
        invoice_date: result.extracted.invoiceDate,
        due_date: result.extracted.dueDate || null,
        amount: result.extracted.totalAmount || 0,
        invoice_type: result.extracted.invoiceType || (parseFloat(result.extracted.totalAmount) < 0 ? 'credit_memo' : 'standard'),
        pdf_url,
        status: 'needs_review',
        notes: result.messages.join('\n'),
        ai_processed: result.ai_processed || false,
        ai_confidence: result.ai_confidence || null,
        ai_extracted_data: result.ai_extracted_data || null,
        needs_review: result.needs_review || false,
        review_flags: result.review_flags || null
      })
      .select()
      .single();

    if (invError) throw invError;

    // Create allocations from line items
    if (result.extracted.lineItems?.length > 0) {
      const allocations = [];
      for (const item of result.extracted.lineItems) {
        if (item.costCode) {
          const { data: costCode } = await supabase
            .from('v2_cost_codes')
            .select('id')
            .ilike('code', `%${item.costCode}%`)
            .limit(1)
            .single();

          if (costCode) {
            allocations.push({
              invoice_id: invoice.id,
              cost_code_id: costCode.id,
              amount: item.amount || 0,
              notes: item.description
            });
          }
        }
      }

      if (allocations.length > 0) {
        await supabase.from('v2_invoice_allocations').insert(allocations);
      }
    }

    // Stamp PDF with "Needs Review"
    if (pdf_url) {
      try {
        const storagePath = extractStoragePath(pdf_url);
        if (storagePath) {
          const pdfBuffer = await downloadPDF(storagePath);
          const stampedBuffer = await stampNeedsReview(pdfBuffer, {
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            vendorName: result.vendor?.name,
            invoiceNumber: result.extracted?.invoiceNumber,
            amount: result.extracted?.totalAmount,
            flags: result.review_flags || []
          });
          const uploadResult = await uploadStampedPDFById(stampedBuffer, invoice.id, invoice.job_id);
          if (uploadResult?.url) {
            await supabase.from('v2_invoices').update({ pdf_stamped_url: uploadResult.url }).eq('id', invoice.id);
            invoice.pdf_stamped_url = uploadResult.url;
          }
        }
      } catch (stampErr) {
        console.error('[STAMP] Initial needs review stamp error:', stampErr.message);
      }
    }

    await logActivity(invoice.id, 'uploaded', 'AI Processor', {
      originalFilename,
      standardizedFilename: result.standardizedFilename,
      aiExtracted: true,
      vendorMatched: !!result.vendor,
      jobMatched: !!result.matchedJob,
      poMatched: !!result.po
    });

    res.json({
      success: true,
      invoice,
      processing: {
        extracted: result.extracted,
        matchedJob: result.matchedJob,
        vendor: result.vendor,
        po: result.po,
        standardizedFilename: result.standardizedFilename,
        messages: result.messages
      }
    });
  } catch (err) {
    console.error('AI processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UPDATE ENDPOINTS
// ============================================================

// Update invoice (partial)
router.patch('/:id', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const updates = req.body;
  const performedBy = updates.updated_by || 'System';

  // Get existing invoice
  const { data: existing, error: fetchError } = await supabase
    .from('v2_invoices')
    .select('*, allocations:v2_invoice_allocations(*)')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    throw notFoundError('invoice', invoiceId);
  }

  // Remove non-updateable fields
  const { id, allocations, updated_by, ...updateFields } = updates;

  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateFields)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to update invoice');
  }

  await logActivity(invoiceId, 'updated', performedBy, { fields: Object.keys(updateFields) });
  broadcastInvoiceUpdate(updated, 'updated', performedBy);

  res.json({ success: true, invoice: updated });
}));

// Allocate invoice to cost codes
router.post('/:id/allocate', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { allocations } = req.body;

    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('amount, billed_amount, paid_amount')
      .eq('id', invoiceId)
      .single();

    if (invoice) {
      const invoiceAmount = parseFloat(invoice.amount || 0);
      const alreadyBilled = Math.max(
        parseFloat(invoice.billed_amount || 0),
        parseFloat(invoice.paid_amount || 0)
      );
      const remainingAmount = invoiceAmount - alreadyBilled;
      const allocationTotal = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

      if (allocationTotal > remainingAmount + 0.01) {
        return res.status(400).json({
          error: `Allocation total ($${allocationTotal.toFixed(2)}) exceeds remaining amount ($${remainingAmount.toFixed(2)})`
        });
      }
    }

    // Get old allocations to subtract PO/CO amounts
    const { data: oldAllocations } = await supabase
      .from('v2_invoice_allocations')
      .select('id, amount, po_id, po_line_item_id, change_order_id')
      .eq('invoice_id', invoiceId);

    // Subtract old amounts
    for (const alloc of (oldAllocations || []).filter(a => a.po_id)) {
      await updatePOLineItemsForAllocations(alloc.po_id, [alloc], false);
    }

    for (const alloc of (oldAllocations || []).filter(a => a.change_order_id)) {
      const { data: coData } = await supabase
        .from('v2_job_change_orders')
        .select('invoiced_amount')
        .eq('id', alloc.change_order_id)
        .single();
      if (coData) {
        const newAmount = Math.max(0, (parseFloat(coData.invoiced_amount) || 0) - (parseFloat(alloc.amount) || 0));
        await supabase.from('v2_job_change_orders').update({ invoiced_amount: newAmount }).eq('id', alloc.change_order_id);
      }
    }

    // Delete old and insert new
    await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);

    if (allocations && allocations.length > 0) {
      const { error } = await supabase
        .from('v2_invoice_allocations')
        .insert(allocations.map(a => ({
          invoice_id: invoiceId,
          cost_code_id: a.cost_code_id,
          amount: a.amount,
          notes: a.notes,
          job_id: a.job_id || null,
          po_id: a.po_id || null,
          po_line_item_id: a.po_line_item_id || null,
          change_order_id: a.change_order_id || null,
          pending_co: a.pending_co || false
        })));

      if (error) throw error;

      // Update PO/CO amounts
      const poAllocations = allocations.filter(a => a.po_id);
      if (poAllocations.length > 0) {
        await updatePOInvoicedAmounts(poAllocations);
      }

      const coAllocations = allocations.filter(a => a.change_order_id);
      if (coAllocations.length > 0) {
        await updateCOInvoicedAmounts(coAllocations);
      }
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATUS TRANSITION ENDPOINT
// ============================================================

router.post('/:id/transition', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { new_status, performed_by: performedBy, reason, allocations, draw_id, overridePoOverage } = req.body;

  const { data: invoice, error: getError } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      po:v2_purchase_orders(id, po_number, description, total_amount),
      allocations:v2_invoice_allocations(id, amount, cost_code_id, po_line_item_id, change_order_id, pending_co, cost_code:v2_cost_codes(code, name))
    `)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (getError || !invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  const transitionCheck = validateStatusTransition(invoice.status, new_status);
  if (!transitionCheck.valid) {
    throw transitionError(invoice.status, new_status, transitionCheck.error);
  }

  if (allocations && allocations.length > 0) {
    const allocCheck = validateAllocations(allocations, parseFloat(invoice.amount));
    if (!allocCheck.valid) {
      throw validationError([{ field: 'allocations', message: allocCheck.error }]);
    }
  }

  const preCheck = await validatePreTransition(invoice, new_status, { allocations, draw_id, overridePoOverage });
  if (!preCheck.valid) {
    const poError = preCheck.errors.find(e => e.type === 'PO_OVERAGE');
    if (poError) {
      return res.status(400).json({
        success: false,
        error: 'PO_OVERAGE',
        message: poError.message,
        requiresOverride: true
      });
    }
    throw new AppError('PRE_TRANSITION_FAILED', 'Pre-transition requirements not met', { errors: preCheck.errors });
  }

  await createUndoSnapshot('invoice', invoiceId, new_status, invoice, performedBy);

  const updateData = { status: new_status };

  // Status-specific logic
  if (new_status === 'approved') {
    updateData.approved_at = new Date().toISOString();
    updateData.approved_by = performedBy;

    if (allocations && allocations.length > 0) {
      await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);
      await supabase.from('v2_invoice_allocations').insert(allocations.map(a => ({
        invoice_id: invoiceId,
        cost_code_id: a.cost_code_id,
        amount: a.amount,
        notes: a.notes,
        job_id: a.job_id || null,
        po_id: a.po_id || null,
        po_line_item_id: a.po_line_item_id || null,
        change_order_id: a.change_order_id || null,
        pending_co: a.pending_co || false
      })));
    }

    // CO Auto-Inheritance: If invoice PO is linked to a CO, auto-set change_order_id on allocations
    if (invoice.po_id) {
      const { data: po } = await supabase
        .from('v2_purchase_orders')
        .select('id, job_change_order_id')
        .eq('id', invoice.po_id)
        .single();

      if (po?.job_change_order_id) {
        // Update allocations that don't already have a change_order_id
        const { data: updatedAllocs, error: coError } = await supabase
          .from('v2_invoice_allocations')
          .update({ change_order_id: po.job_change_order_id })
          .eq('invoice_id', invoiceId)
          .is('change_order_id', null)
          .select('id');

        if (!coError && updatedAllocs?.length > 0) {
          await logActivity(invoiceId, 'co_auto_linked', 'System', {
            change_order_id: po.job_change_order_id,
            from_po: po.id,
            allocations_updated: updatedAllocs.length
          });
        }
      }
    }
  } else if (new_status === 'denied') {
    updateData.denied_at = new Date().toISOString();
    updateData.denied_by = performedBy;
    updateData.denial_reason = reason;
  }

  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to update invoice status');
  }

  // Restamp PDF in background
  restampInvoice(invoiceId).catch(err => {
    console.error('[RESTAMP] Background re-stamp failed:', err.message);
  });

  await logActivity(invoiceId, `status_${new_status}`, performedBy, { reason, from: invoice.status });
  broadcastInvoiceUpdate(updated, 'status_changed', performedBy);

  if (invoice.parent_invoice_id) {
    checkSplitReconciliation(invoice.parent_invoice_id).catch(console.error);
  }

  res.json({ success: true, invoice: updated });
}));

// ============================================================
// SPLIT INVOICE ENDPOINTS
// ============================================================

router.post('/:id/split', async (req, res) => {
  try {
    const { id } = req.params;
    const { splits, performed_by = 'System' } = req.body;

    if (!splits || !Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({ error: 'At least 2 splits required' });
    }

    const { data: parent, error: fetchError } = await supabase
      .from('v2_invoices')
      .select('*, vendor:v2_vendors(id, name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !parent) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (parent.parent_invoice_id || parent.is_split_parent) {
      return res.status(400).json({ error: 'Invoice is already part of a split' });
    }

    const splittableStatuses = ['received', 'needs_review', 'needs_approval', 'ready_for_approval'];
    if (!splittableStatuses.includes(parent.status)) {
      return res.status(400).json({ error: `Cannot split invoice in ${parent.status} status` });
    }

    const totalSplit = splits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const parentAmount = parseFloat(parent.amount || 0);

    if (Math.abs(totalSplit - parentAmount) > 0.01) {
      return res.status(400).json({
        error: `Split amounts ($${totalSplit.toFixed(2)}) must equal original amount ($${parentAmount.toFixed(2)})`
      });
    }

    const childInvoices = [];
    let splitIndex = 1;

    for (const split of splits) {
      const baseNumber = parent.invoice_number || 'INV';
      const childInvoiceNumber = `${baseNumber}-${splitIndex}`;

      let jobName = null;
      if (split.job_id) {
        const { data: job } = await supabase.from('v2_jobs').select('name').eq('id', split.job_id).single();
        jobName = job?.name;
      }

      const { data: child, error: insertError } = await supabase
        .from('v2_invoices')
        .insert({
          parent_invoice_id: id,
          split_index: splitIndex,
          invoice_number: childInvoiceNumber,
          invoice_date: parent.invoice_date,
          due_date: parent.due_date,
          vendor_id: parent.vendor_id,
          job_id: split.job_id || null,
          amount: split.amount,
          original_amount: split.amount,
          status: 'needs_review',
          pdf_url: parent.pdf_url,
          notes: split.notes || `Split ${splitIndex} of ${splits.length} from ${parent.invoice_number}`,
          needs_review: true,
          review_flags: split.job_id ? ['split_child'] : ['split_child', 'no_job']
        })
        .select()
        .single();

      if (insertError) {
        return res.status(500).json({ error: `Failed to create split ${splitIndex}: ${insertError.message}` });
      }

      await logActivity(child.id, 'created_from_split', performed_by, {
        parent_invoice_id: id,
        split_index: splitIndex,
        amount: split.amount
      });

      // Stamp the child PDF
      try {
        if (parent.pdf_url) {
          const storagePath = extractStoragePath(parent.pdf_url);
          if (storagePath) {
            const pdfBuffer = await downloadPDF(storagePath);
            const stampedBuffer = await stampSplit(pdfBuffer, {
              splitIndex,
              splitTotal: splits.length,
              splitDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              originalInvoiceNumber: parent.invoice_number,
              originalAmount: parent.amount,
              thisAmount: split.amount,
              jobName
            });

            const stampedFileName = `${split.job_id || 'unassigned'}/${Date.now()}_${childInvoiceNumber.replace(/[^a-zA-Z0-9.-]/g, '_')}_split.pdf`;
            const { error: uploadError } = await supabase.storage
              .from('invoices')
              .upload(stampedFileName, stampedBuffer, { contentType: 'application/pdf', upsert: true });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from('invoices').getPublicUrl(stampedFileName);
              const stampedUrl = `${urlData.publicUrl}?t=${Date.now()}`;
              await supabase.from('v2_invoices').update({ pdf_stamped_url: stampedUrl }).eq('id', child.id);
              child.pdf_stamped_url = stampedUrl;
            }
          }
        }
      } catch (stampError) {
        console.error(`[SPLIT] Error stamping split ${splitIndex}:`, stampError);
      }

      childInvoices.push(child);
      splitIndex++;
    }

    await supabase.from('v2_invoices').update({
      is_split_parent: true,
      original_amount: parent.amount,
      status: 'split',
      notes: `Split into ${splits.length} invoices on ${new Date().toLocaleDateString()}`
    }).eq('id', id);

    await logActivity(id, 'split', performed_by, {
      child_count: splits.length,
      child_ids: childInvoices.map(c => c.id)
    });

    broadcast('invoice_split', {
      parent_id: id,
      children: childInvoices.map(c => ({ id: c.id, invoice_number: c.invoice_number, amount: c.amount }))
    });

    res.json({
      success: true,
      parent_id: id,
      children: childInvoices,
      message: `Invoice split into ${childInvoices.length} parts`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/unsplit', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by = 'System' } = req.body;

    const { data: parent } = await supabase
      .from('v2_invoices')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (!parent) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!parent.is_split_parent) {
      return res.status(400).json({ error: 'Invoice is not a split parent' });
    }

    const { data: children } = await supabase
      .from('v2_invoices')
      .select('id, invoice_number, status, pdf_stamped_url')
      .eq('parent_invoice_id', id)
      .is('deleted_at', null);

    const blockedStatuses = ['approved', 'in_draw', 'paid'];
    const blockedChildren = (children || []).filter(c => blockedStatuses.includes(c.status));
    if (blockedChildren.length > 0) {
      return res.status(400).json({
        error: `Cannot unsplit: ${blockedChildren.length} child invoice(s) have been approved`
      });
    }

    const childIds = (children || []).map(c => c.id);

    for (const child of children || []) {
      if (child.pdf_stamped_url) {
        try {
          await deleteByUrl(child.pdf_stamped_url);
        } catch (err) {
          console.error('[UNSPLIT] Failed to delete stamped PDF:', err.message);
        }
      }
    }

    if (childIds.length > 0) {
      await supabase.from('v2_invoices').update({ deleted_at: new Date().toISOString() }).in('id', childIds);
    }

    await supabase.from('v2_invoices').update({
      is_split_parent: false,
      status: 'needs_review'
    }).eq('id', id);

    await logActivity(id, 'unsplit', performed_by, { deleted_child_count: childIds.length });

    broadcast('invoice_unsplit', { parent_id: id, deleted_children: childIds });

    res.json({
      success: true,
      parent_id: id,
      deleted_children: childIds.length,
      message: `Invoice unsplit - ${childIds.length} child invoice(s) removed`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PAYMENT ENDPOINTS
// ============================================================

router.patch('/:id/pay', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { payment_method, payment_reference, payment_date, payment_amount } = req.body;

    if (!payment_method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const validMethods = ['check', 'ach', 'wire', 'credit_card', 'cash', 'other'];
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('id, status, amount, paid_to_vendor')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.paid_to_vendor) {
      return res.status(400).json({ error: 'Invoice has already been marked as paid' });
    }

    const paidAmount = payment_amount !== undefined ? parseFloat(payment_amount) : parseFloat(invoice.amount || 0);

    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        paid_to_vendor: true,
        paid_to_vendor_date: payment_date || new Date().toISOString().split('T')[0],
        paid_to_vendor_amount: paidAmount,
        paid_to_vendor_ref: payment_reference || null
      })
      .eq('id', invoiceId)
      .select(`*, vendor:v2_vendors(*), job:v2_jobs(id, name)`)
      .single();

    if (updateError) throw updateError;

    await logActivity(invoiceId, 'paid_to_vendor', 'System', {
      payment_method,
      payment_reference,
      payment_amount: paidAmount
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/unpay', async (req, res) => {
  try {
    const invoiceId = req.params.id;

    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('id, paid_to_vendor')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!invoice.paid_to_vendor) {
      return res.status(400).json({ error: 'Invoice is not marked as paid' });
    }

    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        paid_to_vendor: false,
        paid_to_vendor_date: null,
        paid_to_vendor_amount: null,
        paid_to_vendor_ref: null
      })
      .eq('id', invoiceId)
      .select(`*, vendor:v2_vendors(*), job:v2_jobs(id, name)`)
      .single();

    if (updateError) throw updateError;

    await logActivity(invoiceId, 'unpaid', 'System', {});

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// BULK OPERATIONS
// ============================================================

router.post('/bulk/approve', asyncHandler(async (req, res) => {
  const { invoice_ids, performed_by: performedBy } = req.body;

  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'invoice_ids array is required');
  }

  const results = { success: [], failed: [] };

  for (const invoiceId of invoice_ids) {
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('*, allocations:v2_invoice_allocations(*)')
      .eq('id', invoiceId)
      .is('deleted_at', null)
      .single();

    if (!invoice) {
      results.failed.push({ id: invoiceId, error: 'Invoice not found' });
      continue;
    }

    const transitionCheck = validateStatusTransition(invoice.status, 'approved');
    if (!transitionCheck.valid) {
      results.failed.push({ id: invoiceId, error: transitionCheck.error });
      continue;
    }

    results.success.push(invoiceId);
  }

  for (const invoiceId of results.success) {
    try {
      await supabase.from('v2_invoices').update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: performedBy
      }).eq('id', invoiceId);

      await logActivity(invoiceId, 'approved', performedBy, { bulk: true });
    } catch (err) {
      results.failed.push({ id: invoiceId, error: err.message });
      results.success = results.success.filter(id => id !== invoiceId);
    }
  }

  broadcast('bulk_approve', { invoiceIds: results.success, performedBy });

  res.json({
    success: true,
    approved: results.success.length,
    failed: results.failed.length,
    results
  });
}));

router.post('/bulk/deny', asyncHandler(async (req, res) => {
  const { invoice_ids, reason, performed_by: performedBy } = req.body;

  if (!invoice_ids || !reason) {
    throw new AppError('VALIDATION_FAILED', 'invoice_ids and reason are required');
  }

  const results = { success: [], failed: [] };

  for (const invoiceId of invoice_ids) {
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      results.failed.push({ id: invoiceId, error: 'Invoice not found' });
      continue;
    }

    const transitionCheck = validateStatusTransition(invoice.status, 'denied');
    if (!transitionCheck.valid) {
      results.failed.push({ id: invoiceId, error: transitionCheck.error });
      continue;
    }

    try {
      await supabase.from('v2_invoices').update({
        status: 'denied',
        denied_at: new Date().toISOString(),
        denied_by: performedBy,
        denial_reason: reason
      }).eq('id', invoiceId);

      await logActivity(invoiceId, 'denied', performedBy, { reason, bulk: true });
      results.success.push(invoiceId);
    } catch (err) {
      results.failed.push({ id: invoiceId, error: err.message });
    }
  }

  res.json({
    success: true,
    denied: results.success.length,
    failed: results.failed.length,
    results
  });
}));

router.post('/bulk/add-to-draw', asyncHandler(async (req, res) => {
  const { invoice_ids, draw_id, performed_by: performedBy } = req.body;

  if (!invoice_ids || !draw_id) {
    throw new AppError('VALIDATION_FAILED', 'invoice_ids and draw_id are required');
  }

  const { data: draw } = await supabase
    .from('v2_draws')
    .select('id, status')
    .eq('id', draw_id)
    .single();

  if (!draw) {
    throw notFoundError('draw', draw_id);
  }

  if (['funded', 'partially_funded', 'overfunded'].includes(draw.status)) {
    throw new AppError('DRAW_FUNDED', 'Cannot add invoices to a funded draw');
  }

  const results = { success: [], failed: [] };

  for (const invoiceId of invoice_ids) {
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('id, status')
      .eq('id', invoiceId)
      .single();

    if (!invoice) {
      results.failed.push({ id: invoiceId, error: 'Invoice not found' });
      continue;
    }

    if (invoice.status !== 'approved') {
      results.failed.push({ id: invoiceId, error: 'Invoice must be approved first' });
      continue;
    }

    const { data: existingDraw } = await supabase
      .from('v2_draw_invoices')
      .select('draw_id')
      .eq('invoice_id', invoiceId)
      .single();

    if (existingDraw) {
      results.failed.push({ id: invoiceId, error: 'Invoice already in a draw' });
      continue;
    }

    try {
      await supabase.from('v2_draw_invoices').insert({ draw_id, invoice_id: invoiceId });
      await supabase.from('v2_invoices').update({ status: 'in_draw' }).eq('id', invoiceId);
      await logActivity(invoiceId, 'added_to_draw', performedBy, { draw_id, bulk: true });
      results.success.push(invoiceId);
    } catch (err) {
      results.failed.push({ id: invoiceId, error: err.message });
    }
  }

  // Update draw total
  const { data: drawInvoices } = await supabase
    .from('v2_draw_invoices')
    .select('invoice:v2_invoices(amount)')
    .eq('draw_id', draw_id);

  const newTotal = drawInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
  await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', draw_id);

  res.json({
    success: true,
    added: results.success.length,
    failed: results.failed.length,
    results,
    drawTotal: newTotal
  });
}));

// ============================================================
// DELETE ENDPOINT
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { performed_by: performedBy = 'System' } = req.body;

  const { data: invoice } = await supabase
    .from('v2_invoices')
    .select('*')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (!invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  if (invoice.status === 'paid') {
    throw new AppError('VALIDATION_FAILED', 'Cannot delete paid invoices');
  }

  if (invoice.status === 'in_draw') {
    const { data: drawInvoice } = await supabase
      .from('v2_draw_invoices')
      .select('draw:v2_draws(status)')
      .eq('invoice_id', invoiceId)
      .single();

    if (['funded', 'partially_funded', 'overfunded'].includes(drawInvoice?.draw?.status)) {
      throw new AppError('VALIDATION_FAILED', 'Cannot delete invoice in funded draw');
    }
  }

  await createUndoSnapshot('invoice', invoiceId, 'deleted', invoice, performedBy);

  const { error } = await supabase
    .from('v2_invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (error) {
    throw new AppError('DATABASE_ERROR', 'Failed to delete invoice');
  }

  await logActivity(invoiceId, 'deleted', performedBy, {});

  if (invoice.parent_invoice_id) {
    checkSplitReconciliation(invoice.parent_invoice_id).catch(console.error);
  }

  broadcastInvoiceUpdate({ id: invoiceId }, 'deleted', performedBy);

  res.json({
    success: true,
    undoAvailable: true,
    undoExpiresIn: UNDO_WINDOW_SECONDS * 1000
  });
}));

module.exports = router;
