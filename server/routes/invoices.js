/**
 * Invoice Routes
 * All invoice management endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const { AppError, asyncHandler, notFoundError, validationError, transitionError } = require('../core/errors');
const { validate, schemas } = require('../middleware/validate');
const { broadcastInvoiceUpdate, broadcast } = require('../core/realtime');
const {
  logActivity,
  updatePOLineItemsForAllocations,
  syncPOLineItemsOnAllocationChange,
  updatePOInvoicedAmounts,
  updateCOInvoicedAmounts,
  stampInvoice,
  restampInvoice,
  checkSplitReconciliation,
  getOrCreateDraftDraw,
  cleanupInvoiceAllocations,
  recalculateBilledAmounts,
  recalculatePOLineItemInvoiced,
  recalculateCOInvoiced
} = require('../services/invoice-helpers');
const { detectVariances, quickVarianceCheck } = require('../services/variance-detector');
const {
  uploadPDF,
  uploadStampedPDFById,
  downloadPDF,
  deleteByUrl,
  extractStoragePath
} = require('../core/storage');
const {
  stampApproval,
  stampInDraw,
  stampPaid,
  stampNeedsReview,
  stampReadyForApproval,
  stampSplit
} = require('../documents/pdf-stamper');
const {
  validateInvoice,
  validateStatusTransition,
  validatePreTransition,
  validateAllocations,
  validateCostCodesExist
} = require('../core/validation');
const { createUndoSnapshot, UNDO_WINDOW_SECONDS } = require('../core/undo');
const {
  createValidationError,
  createValidationWarning,
  createDetailedFixHint,
  formatAmount
} = require('../matching/validation-errors');
const {
  processInvoice,
  processInvoiceTwoStage,
  extractInvoiceFromImage,
  extractInvoiceFromText,
  findMatchingJob,
  findOrCreateVendor,
  findOrCreatePO,
  analyzeMultiInvoicePDF,
  processMultiInvoicePDF,
  CONFIDENCE_THRESHOLDS
} = require('../ai/processor');
const { convertDocument, getSupportedExtensions } = require('../documents/converter');
const { checkForDuplicates } = require('../matching/duplicate-check');
const standards = require('../services/standards');

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============================================================
// LIST & FILTER ENDPOINTS
// ============================================================

// List invoices (with optional filters)
router.get('/', validate(schemas.invoiceQuery), async (req, res) => {
  try {
    const { job_id, status, vendor_id } = req.query;

    let query = supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name, trade),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, total_amount),
        allocations:v2_invoice_allocations(
          id, amount, notes, job_id, change_order_id, po_id, cost_code_id,
          cost_code:v2_cost_codes(id, code, name),
          purchase_order:v2_purchase_orders(id, po_number)
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
router.get('/:id', validate(schemas.idParam), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name, email, phone, trade),
        job:v2_jobs(id, name, address),
        po:v2_purchase_orders(id, po_number, total_amount),
        allocations:v2_invoice_allocations(
          id, amount, notes, job_id, po_id, po_line_item_id, change_order_id, pending_co, cost_code_id,
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

    // Detect variances if invoice is linked to a PO
    if (data.po_id) {
      try {
        const variance = await detectVariances(data);
        data.variance = variance;
      } catch (varErr) {
        logger.error('Error detecting variances', { component: 'Variance', error: varErr.message });
        data.variance = { error: varErr.message };
      }
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get invoice activity log
router.get('/:id/activity', validate(schemas.idParam), async (req, res) => {
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
router.get('/:id/allocations', validate(schemas.idParam), async (req, res) => {
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

// Quick variance check - for real-time feedback when linking invoice to PO
router.get('/:id/variance-check', asyncHandler(async (req, res) => {
  const { poId } = req.query;

  if (!poId) {
    return res.json({ warning: false, message: 'No PO specified' });
  }

  const { data: invoice, error } = await supabase
    .from('v2_invoices')
    .select('id, amount')
    .eq('id', req.params.id)
    .single();

  if (error || !invoice) {
    throw notFoundError('invoice', req.params.id);
  }

  const result = await quickVarianceCheck(poId, parseFloat(invoice.amount) || 0, invoice.id);
  res.json(result || { warning: false });
}));

// ============================================================
// JOB LINKAGE VALIDATION ENDPOINT
// ============================================================

// Validate linkages for a job's invoices (orphaned allocations, broken PO/Draw links)
router.get('/jobs/:jobId/validate-linkages', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const errors = [];
  const warnings = [];
  let invoicesChecked = 0;
  let allocationsChecked = 0;

  // Fetch all invoices for the job with their allocations
  const { data: invoices, error: invoicesError } = await supabase
    .from('v2_invoices')
    .select(`
      id, invoice_number, amount, status, po_id,
      allocations:v2_invoice_allocations(
        id, amount, po_id, po_line_item_id, change_order_id, cost_code_id
      )
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null);

  if (invoicesError) {
    throw new AppError('DATABASE_ERROR', `Failed to fetch invoices: ${invoicesError.message}`);
  }

  invoicesChecked = (invoices || []).length;

  // Get all valid POs for this job
  const { data: validPOs } = await supabase
    .from('v2_purchase_orders')
    .select('id')
    .eq('job_id', jobId)
    .is('deleted_at', null);
  const validPOIds = new Set((validPOs || []).map(po => po.id));

  // Get all valid PO line items for this job's POs
  const { data: validLineItems } = await supabase
    .from('v2_po_line_items')
    .select('id, po_id')
    .in('po_id', Array.from(validPOIds));
  const validLineItemIds = new Set((validLineItems || []).map(li => li.id));

  // Get all valid change orders for this job
  const { data: validCOs } = await supabase
    .from('v2_job_change_orders')
    .select('id')
    .eq('job_id', jobId)
    .is('deleted_at', null);
  const validCOIds = new Set((validCOs || []).map(co => co.id));

  // Get all draw invoices for this job
  const { data: drawInvoices } = await supabase
    .from('v2_draw_invoices')
    .select(`
      invoice_id,
      draw:v2_draws!inner(id, job_id)
    `)
    .eq('draw.job_id', jobId);
  const invoicesInDraws = new Set((drawInvoices || []).map(di => di.invoice_id));

  // Process each invoice
  for (const invoice of (invoices || [])) {
    const invoiceAmount = parseFloat(invoice.amount || 0);
    let allocationTotal = 0;

    // Check each allocation
    for (const alloc of (invoice.allocations || [])) {
      allocationsChecked++;
      const allocAmount = parseFloat(alloc.amount || 0);
      allocationTotal += allocAmount;

      // Check 1: Orphaned PO allocation
      if (alloc.po_id && !validPOIds.has(alloc.po_id)) {
        errors.push(createValidationError('ORPHANED_PO_ALLOCATION', {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          allocation_id: alloc.id,
          details: {
            allocation_id: alloc.id,
            referenced_po_id: alloc.po_id,
            amount: allocAmount
          }
        }));
      }

      // Check 2: Orphaned PO line item allocation
      if (alloc.po_line_item_id && !validLineItemIds.has(alloc.po_line_item_id)) {
        errors.push(createValidationError('ORPHANED_LINE_ITEM_ALLOCATION', {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          allocation_id: alloc.id,
          details: {
            allocation_id: alloc.id,
            referenced_line_item_id: alloc.po_line_item_id,
            amount: allocAmount
          }
        }));
      }

      // Check 3: Orphaned change order allocation
      if (alloc.change_order_id && !validCOIds.has(alloc.change_order_id)) {
        errors.push(createValidationError('ORPHANED_CO_ALLOCATION', {
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          allocation_id: alloc.id,
          details: {
            allocation_id: alloc.id,
            referenced_co_id: alloc.change_order_id,
            amount: allocAmount
          }
        }));
      }
    }

    // Check 4: Draw status mismatch
    if (invoicesInDraws.has(invoice.id) && !['approved', 'in_draw', 'paid'].includes(invoice.status)) {
      errors.push(createValidationError('DRAW_STATUS_MISMATCH', {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        message: `Invoice is in a draw but has status '${invoice.status}' instead of 'approved', 'in_draw', or 'paid'`,
        details: {
          current_status: invoice.status,
          expected_statuses: ['approved', 'in_draw', 'paid']
        }
      }));
    }

    // Check 5: Allocation sum exceeds invoice amount
    if (allocationTotal > invoiceAmount + 0.01) {
      const excess = allocationTotal - invoiceAmount;
      errors.push(createValidationError('ALLOCATION_SUM_EXCEEDS_INVOICE', {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        message: `Allocations total (${formatAmount(allocationTotal)}) exceeds invoice amount (${formatAmount(invoiceAmount)})`,
        fix_hint: createDetailedFixHint('ALLOCATION_SUM_EXCEEDS_INVOICE', {
          allocation_sum: allocationTotal,
          invoice_amount: invoiceAmount,
          excess
        }),
        details: {
          invoice_amount: invoiceAmount,
          allocation_total: allocationTotal,
          excess
        }
      }));
    }

    // Check 6: Invoice has PO but no allocations (warning)
    if (invoice.po_id && (!invoice.allocations || invoice.allocations.length === 0)) {
      warnings.push(createValidationWarning('INVOICE_PO_NO_ALLOCATIONS', {
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        po_id: invoice.po_id,
        details: {
          po_id: invoice.po_id,
          invoice_amount: invoiceAmount
        }
      }));
    }
  }

  const valid = errors.length === 0;

  res.json({
    valid,
    errors,
    warnings,
    summary: {
      invoices_checked: invoicesChecked,
      allocations_checked: allocationsChecked,
      errors_found: errors.length,
      warnings_found: warnings.length
    }
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

    logger.info('Processing upload', { component: 'Upload', filename: originalFilename, mimetype, size: fileBuffer.length });

    const converted = await convertDocument(fileBuffer, originalFilename, mimetype);

    if (!converted.success) {
      return res.status(400).json({
        error: 'Document conversion failed',
        details: converted.error,
        supported: getSupportedExtensions()
      });
    }

    let result;
    let twoStageResult = null;

    if (converted.fileType === 'PDF') {
      // Use two-stage pipeline for PDFs
      twoStageResult = await processInvoiceTwoStage(fileBuffer, originalFilename);

      // Fall back to original process if two-stage fails
      if (!twoStageResult.success) {
        logger.info('Falling back to original processInvoice', { component: 'TwoStage' });
        result = await processInvoice(fileBuffer, originalFilename);
      } else {
        // Build result from two-stage pipeline
        result = await processInvoice(fileBuffer, originalFilename);

        // Enhance result with two-stage data
        result.twoStageResult = {
          stage1Confidence: twoStageResult.stage1Confidence,
          stage2Score: twoStageResult.stage2Score,
          validationIssues: twoStageResult.validationIssues,
          autoCorrections: twoStageResult.autoCorrections
        };

        // Apply auto-corrections from two-stage pipeline
        if (twoStageResult.extracted && result.extracted) {
          if (twoStageResult.extracted.invoiceNumber) {
            result.extracted.invoiceNumber = twoStageResult.extracted.invoiceNumber;
          }
          if (twoStageResult.extracted.totalAmount) {
            result.extracted.totalAmount = twoStageResult.extracted.totalAmount;
          }
          if (twoStageResult.extracted.invoiceType) {
            result.extracted.invoiceType = twoStageResult.extracted.invoiceType;
          }
        }

        // Update confidence with combined score
        if (twoStageResult.confidence && result.ai_confidence) {
          result.ai_confidence.combined = twoStageResult.confidence;
        }

        if (result.messages && twoStageResult.messages) {
          result.messages.push(...twoStageResult.messages);
        }
      }
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
        // Use multi-signal PO matching
        const poResult = await findOrCreatePO(
          result.matchedJob.id,
          result.vendor.id,
          extracted,
          result.matchedJob.name
        );
        if (poResult) {
          result.po = poResult.po;
          result.po_match = {
            matched: !!poResult.po,
            po_id: poResult.po?.id || null,
            po_number: poResult.po?.po_number || null,
            confidence: poResult.matchConfidence || 0,
            needs_review: poResult.needsReview || false,
            explanation: poResult.explanation || '',
            breakdown: poResult.matchBreakdown || null,
            candidates: poResult.candidates || []
          };
          if (poResult.needsReview) {
            result.review_flags.push('po_match_needs_review');
          }
        }
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
        // Use multi-signal PO matching
        const poResult = await findOrCreatePO(
          result.matchedJob.id,
          result.vendor.id,
          extracted,
          result.matchedJob.name
        );
        if (poResult) {
          result.po = poResult.po;
          result.po_match = {
            matched: !!poResult.po,
            po_id: poResult.po?.id || null,
            po_number: poResult.po?.po_number || null,
            confidence: poResult.matchConfidence || 0,
            needs_review: poResult.needsReview || false,
            explanation: poResult.explanation || '',
            breakdown: poResult.matchBreakdown || null,
            candidates: poResult.candidates || []
          };
          if (poResult.needsReview) {
            result.review_flags.push('po_match_needs_review');
          }
        }
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

    // Create invoice record (notes left empty for human input - AI log goes to activity)
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
        notes: null, // Reserved for human notes - AI log goes to activity
        ai_processed: result.ai_processed || false,
        ai_confidence: result.ai_confidence || null,
        ai_extracted_data: result.ai_extracted_data || null,
        needs_review: result.needs_review || false,
        review_flags: result.review_flags || null
      })
      .select()
      .single();

    if (invError) throw invError;

    // Create allocations from AI suggestions or line items
    let allocationsCreated = false;
    const invoiceAmount = invoice.amount || result.extracted?.totalAmount || 0;

    // First priority: Use AI suggested_allocations (generated from trade type + line item analysis)
    if (result.suggested_allocations?.length > 0) {
      // Calculate total of suggested allocations
      const suggestedTotal = result.suggested_allocations.reduce((sum, a) => sum + (a.amount || 0), 0);

      // If suggested total differs from invoice amount, normalize proportionally
      // This handles cases like "40% Delivery Invoice" where line items show full amounts
      const needsNormalization = suggestedTotal > 0 && Math.abs(suggestedTotal - invoiceAmount) > 1;
      const scaleFactor = needsNormalization ? invoiceAmount / suggestedTotal : 1;

      const allocations = result.suggested_allocations.map(alloc => ({
        invoice_id: invoice.id,
        job_id: invoice.job_id,
        cost_code_id: alloc.cost_code_id,
        amount: Math.round((alloc.amount || 0) * scaleFactor * 100) / 100, // Scale and round to cents
        notes: alloc.line_item_descriptions?.join('; ') || alloc.name || null
      }));

      // Adjust for rounding errors - ensure total matches invoice amount exactly
      if (allocations.length > 0 && needsNormalization) {
        const allocTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
        const diff = invoiceAmount - allocTotal;
        if (Math.abs(diff) > 0.001) {
          allocations[0].amount = Math.round((allocations[0].amount + diff) * 100) / 100;
        }
      }

      if (allocations.length > 0) {
        const { error: allocError } = await supabase.from('v2_invoice_allocations').insert(allocations);
        if (!allocError) {
          allocationsCreated = true;
          logger.info('Created allocations from AI suggestions', {
            component: 'Invoices',
            invoiceId: invoice.id,
            count: allocations.length,
            codes: result.suggested_allocations.map(a => a.code).join(', '),
            normalized: needsNormalization,
            originalTotal: suggestedTotal,
            invoiceAmount
          });
        }
      }
    }

    // Fallback: Try line items with explicit cost codes (rare, but handle it)
    if (!allocationsCreated && result.extracted.lineItems?.length > 0) {
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
              job_id: invoice.job_id,
              cost_code_id: costCode.id,
              amount: item.amount || 0,
              notes: item.description
            });
          }
        }
      }

      if (allocations.length > 0) {
        await supabase.from('v2_invoice_allocations').insert(allocations);
        allocationsCreated = true;
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
        logger.error('Initial needs review stamp error', { component: 'STAMP', error: stampErr.message });
      }
    }

    await logActivity(invoice.id, 'processed', 'AI Processor', {
      originalFilename,
      standardizedFilename: result.standardizedFilename,
      vendorMatched: !!result.vendor,
      vendorName: result.vendor?.name || null,
      jobMatched: !!result.matchedJob,
      jobName: result.matchedJob?.name || null,
      poMatched: !!result.po,
      poNumber: result.po?.po_number || null,
      confidence: result.ai_confidence?.overall || null,
      processingLog: result.messages || []
    });

    // Determine needs_review based on new thresholds
    const combinedConfidence = twoStageResult?.confidence || result.ai_confidence?.overall || 0;
    const needsReviewFromThreshold = combinedConfidence < CONFIDENCE_THRESHOLDS.HUMAN_REVIEW;
    const reviewFlags = [...(result.review_flags || [])];

    // Add threshold-based review flags
    if (combinedConfidence < CONFIDENCE_THRESHOLDS.REJECT) {
      reviewFlags.push('low_confidence_reject');
    } else if (combinedConfidence < CONFIDENCE_THRESHOLDS.NEEDS_ATTENTION) {
      reviewFlags.push('needs_attention');
    } else if (combinedConfidence < CONFIDENCE_THRESHOLDS.HUMAN_REVIEW) {
      reviewFlags.push('human_review_suggested');
    }

    // Build enhanced response
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
      },
      // New validation-related fields
      validation_issues: twoStageResult?.validationIssues || [],
      auto_corrections: twoStageResult?.autoCorrections || [],
      ai_confidence: {
        overall: combinedConfidence,
        extraction: twoStageResult?.stage1Confidence || result.ai_confidence?.overall || 0,
        validation: twoStageResult?.stage2Score || 1.0,
        breakdown: result.ai_confidence || {}
      },
      needs_review: result.needs_review || needsReviewFromThreshold,
      review_flags: reviewFlags
    });
  } catch (err) {
    logger.error('AI processing error', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// MULTI-INVOICE BATCH PROCESSING
// ============================================================

/**
 * Analyze a PDF for multiple invoices (preview before splitting)
 * Returns detected invoice boundaries without processing
 */
router.post('/analyze-multi', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const originalFilename = req.file.originalname;
    const fileBuffer = req.file.buffer;

    logger.info('Analyzing multi-invoice PDF', { component: 'MultiInvoice', filename: originalFilename });

    const analysis = await analyzeMultiInvoicePDF(fileBuffer, originalFilename);

    res.json({
      success: true,
      filename: originalFilename,
      totalPages: analysis.totalPages,
      isMultiInvoice: analysis.isMultiInvoice,
      invoicesDetected: analysis.invoices.length,
      invoices: analysis.invoices,
      message: analysis.isMultiInvoice
        ? `Detected ${analysis.invoices.length} separate invoices`
        : 'Single invoice detected'
    });

  } catch (err) {
    logger.error('Multi-invoice analysis error', { component: 'MultiInvoice', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

/**
 * Process a multi-invoice PDF: split and process each invoice
 * Returns results for all detected invoices
 */
router.post('/process-batch', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const originalFilename = req.file.originalname;
    const fileBuffer = req.file.buffer;

    logger.info('Batch processing multi-invoice PDF', { component: 'MultiInvoice', filename: originalFilename });

    // Process the multi-invoice PDF
    const batchResult = await processMultiInvoicePDF(fileBuffer, originalFilename);

    if (!batchResult.isMultiInvoice) {
      // Single invoice - redirect to normal flow response
      const singleResult = batchResult.invoicesProcessed[0]?.result;
      if (singleResult) {
        return res.json({
          success: true,
          isMultiInvoice: false,
          message: 'Single invoice processed normally',
          invoice: singleResult
        });
      }
    }

    // Helper to validate dates - returns null if invalid
    const validateDate = (dateStr) => {
      if (!dateStr) return null;
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return null;
      // Check for obviously invalid dates (day > 31, month > 12)
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const month = parseInt(parts[1]);
        const day = parseInt(parts[2]);
        if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      }
      return dateStr;
    };

    // For each successfully processed invoice, save to database
    const savedInvoices = [];
    const failedSaves = [];

    for (const processed of batchResult.invoicesProcessed) {
      const result = processed.result;

      try {
        // Upload PDF for this split
        let pdf_url = null;
        const jobId = result.matchedJob?.id;
        const storagePath = result.standardizedFilename || `batch_${processed.invoiceIndex}.pdf`;
        const bufferToUpload = result.pdfBuffer;

        if (bufferToUpload) {
          try {
            if (jobId) {
              const uploadResult = await uploadPDF(bufferToUpload, storagePath, jobId);
              pdf_url = uploadResult.url;
            } else {
              const uploadResult = await uploadPDF(bufferToUpload, `unassigned/${storagePath}`, null);
              pdf_url = uploadResult.url;
            }
          } catch (uploadErr) {
            logger.error('PDF upload failed', { component: 'MultiInvoice', invoiceIndex: processed.invoiceIndex, error: uploadErr.message });
            // Continue without PDF - still save the invoice record
          }
        }

        // Validate dates before saving
        const invoiceDate = validateDate(result.extracted?.invoiceDate);
        const dueDate = validateDate(result.extracted?.dueDate);

        // Create invoice record (notes left empty for human input - AI log goes to activity)
        const { data: invoice, error: invError } = await supabase
          .from('v2_invoices')
          .insert({
            job_id: jobId || null,
            vendor_id: result.vendor?.id || null,
            po_id: result.po?.id || null,
            invoice_number: result.extracted?.invoiceNumber || processed.detectedMetadata?.invoiceNumber,
            invoice_date: invoiceDate,
            due_date: dueDate,
            amount: result.extracted?.totalAmount || processed.detectedMetadata?.approximateAmount || 0,
            invoice_type: result.extracted?.invoiceType || 'standard',
            pdf_url,
            status: 'needs_review',
            notes: null, // Reserved for human notes - AI log goes to activity
            ai_processed: true,
            ai_confidence: result.ai_confidence || null,
            ai_extracted_data: result.ai_extracted_data || null,
            needs_review: true,
            review_flags: [...(result.review_flags || []), 'batch_processed', ...(invoiceDate ? [] : ['invalid_date'])]
          })
          .select()
          .single();

        if (invError) throw invError;

        // Log activity with processing details
        await logActivity(invoice.id, 'processed', 'Batch Processor', {
          originalFilename,
          pageRange: processed.pageRange,
          batchIndex: processed.invoiceIndex,
          detectedVendor: processed.detectedMetadata?.vendor,
          processingLog: result.messages || []
        });

        savedInvoices.push({
          invoiceIndex: processed.invoiceIndex,
          pageRange: processed.pageRange,
          invoice,
          vendor: result.vendor,
          matchedJob: result.matchedJob
        });

      } catch (saveErr) {
        logger.error('Failed to save invoice', { component: 'MultiInvoice', invoiceIndex: processed.invoiceIndex, error: saveErr.message });
        failedSaves.push({
          invoiceIndex: processed.invoiceIndex,
          pageRange: processed.pageRange,
          error: saveErr.message
        });
      }
    }

    res.json({
      success: batchResult.success && failedSaves.length === 0,
      isMultiInvoice: true,
      totalPages: batchResult.totalPages,
      invoicesDetected: batchResult.invoicesDetected,
      invoicesSaved: savedInvoices.length,
      invoicesFailed: batchResult.invoicesFailed.length + failedSaves.length,
      savedInvoices,
      failedSaves,
      processingFailed: batchResult.invoicesFailed,
      messages: batchResult.messages
    });

  } catch (err) {
    logger.error('Batch processing error', { component: 'MultiInvoice', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// UPDATE ENDPOINTS
// ============================================================

// Update invoice (partial)
router.patch('/:id', validate(schemas.invoiceUpdate), asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const updates = req.body;
  const performedBy = updates.performed_by || updates.updated_by || 'System';

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

  // Remove non-updateable fields (performed_by is used for logging, not stored on invoice)
  const { id, allocations, updated_by, performed_by, ...updateFields } = updates;

  // Map frontend field names to database column names
  if (updateFields.sendback_reason !== undefined) {
    updateFields.sent_back_reason = updateFields.sendback_reason;
    delete updateFields.sendback_reason;
  }

  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateFields)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    logger.error('Invoice update error', { component: 'Invoice', invoiceId, error: updateError.message });
    throw new AppError('DATABASE_ERROR', `Failed to update invoice: ${updateError.message}`);
  }

  // Restamp if status changed to a status that needs stamping
  const statusChanged = updateFields.status && updateFields.status !== existing.status;
  const stampableStatuses = ['needs_review', 'ready_for_approval', 'approved', 'in_draw', 'paid'];
  if (statusChanged && stampableStatuses.includes(updateFields.status)) {
    logger.info('Status changed, triggering restamp', { component: 'RESTAMP', invoiceId, newStatus: updateFields.status });
    restampInvoice(invoiceId).catch(err => {
      logger.error('Background re-stamp failed', { component: 'RESTAMP', invoiceId, error: err.message });
    });
  }

  await logActivity(invoiceId, 'updated', performedBy, { fields: Object.keys(updateFields) });
  broadcastInvoiceUpdate(updated, 'updated', performedBy);

  res.json({ success: true, invoice: updated });
}));

// Allocate invoice to cost codes
router.post('/:id/allocate', validate(schemas.invoiceAllocations), async (req, res) => {
  const invoiceId = req.params.id;
  let rollbackData = null;

  try {
    const { allocations } = req.body;

    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select('amount, billed_amount, paid_amount, status')
      .eq('id', invoiceId)
      .single();

    if (invoice) {
      const invoiceAmount = parseFloat(invoice.amount || 0);
      const allocationTotal = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

      // Only check billed_amount constraint for invoices that are already in a draw or paid
      // For invoices still being allocated (needs_approval, approved), allow up to full amount
      const billedStatuses = ['in_draw', 'paid'];
      if (billedStatuses.includes(invoice.status)) {
        const alreadyBilled = Math.max(
          parseFloat(invoice.billed_amount || 0),
          parseFloat(invoice.paid_amount || 0)
        );
        const remainingAmount = invoiceAmount - alreadyBilled;

        if (allocationTotal > remainingAmount + 0.01) {
          return res.status(400).json({
            error: `Allocation total ($${allocationTotal.toFixed(2)}) exceeds remaining amount ($${remainingAmount.toFixed(2)})`
          });
        }
      } else {
        // For pre-billed invoices, just check allocation doesn't exceed invoice amount
        if (allocationTotal > invoiceAmount + 0.01) {
          return res.status(400).json({
            error: `Allocation total ($${allocationTotal.toFixed(2)}) exceeds invoice amount ($${invoiceAmount.toFixed(2)})`
          });
        }
      }
    }

    // Get old allocations for potential rollback
    const { data: oldAllocations } = await supabase
      .from('v2_invoice_allocations')
      .select('*')
      .eq('invoice_id', invoiceId);

    // Store for rollback - remove generated fields that can't be re-inserted
    rollbackData = {
      oldAllocations: (oldAllocations || []).map(a => ({
        invoice_id: a.invoice_id,
        cost_code_id: a.cost_code_id,
        amount: a.amount,
        notes: a.notes,
        job_id: a.job_id,
        po_id: a.po_id,
        po_line_item_id: a.po_line_item_id,
        change_order_id: a.change_order_id,
        pending_co: a.pending_co
      }))
    };

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

    // Check if invoice is in a draw - if so, recalculate billed amounts
    const { data: drawInvoice } = await supabase
      .from('v2_draw_invoices')
      .select('draw_id, draw:v2_draws(job_id)')
      .eq('invoice_id', invoiceId)
      .single();

    if (drawInvoice?.draw?.job_id) {
      // Get all cost codes affected by old and new allocations
      const affectedCostCodes = new Set();
      (oldAllocations || []).forEach(a => { if (a.cost_code_id) affectedCostCodes.add(a.cost_code_id); });
      (allocations || []).forEach(a => { if (a.cost_code_id) affectedCostCodes.add(a.cost_code_id); });

      if (affectedCostCodes.size > 0) {
        await recalculateBilledAmounts(drawInvoice.draw.job_id, Array.from(affectedCostCodes));

        // Also update draw_allocations to match new allocations
        await supabase.from('v2_draw_allocations')
          .delete()
          .eq('draw_id', drawInvoice.draw_id)
          .eq('invoice_id', invoiceId);

        if (allocations && allocations.length > 0) {
          await supabase.from('v2_draw_allocations').insert(
            allocations.map(a => ({
              draw_id: drawInvoice.draw_id,
              invoice_id: invoiceId,
              cost_code_id: a.cost_code_id,
              amount: a.amount,
              notes: a.notes,
              created_by: 'System'
            }))
          );
        }
      }

      // If invoice is in draw, update its billed_amount to match new allocations
      const newBilledAmount = (allocations || []).reduce(
        (sum, a) => sum + parseFloat(a.amount || 0), 0
      );

      await supabase
        .from('v2_invoices')
        .update({ billed_amount: newBilledAmount })
        .eq('id', invoiceId);

      logger.info('Updated invoice billed_amount', { component: 'ALLOCATE', invoiceId, billedAmount: newBilledAmount.toFixed(2) });
    }

    // PO-INT-01 & PO-INT-02: Full recalculation for approved+ invoices
    const validStatuses = ['approved', 'in_draw', 'paid'];
    let coOverlapWarnings = [];

    if (validStatuses.includes(invoice?.status)) {
      // Get affected POs and COs
      const affectedPOs = new Set();
      const affectedCOs = new Set();

      (oldAllocations || []).forEach(a => {
        if (a.po_id) affectedPOs.add(a.po_id);
        if (a.change_order_id) affectedCOs.add(a.change_order_id);
      });
      (allocations || []).forEach(a => {
        if (a.po_id) affectedPOs.add(a.po_id);
        if (a.change_order_id) affectedCOs.add(a.change_order_id);
      });

      // Recalculate PO line items
      for (const poId of affectedPOs) {
        await recalculatePOLineItemInvoiced(poId);
      }

      // Recalculate COs
      for (const coId of affectedCOs) {
        await recalculateCOInvoiced(coId);
      }

      // PO-INT-04: Check for CO overlap with manual billings
      if (drawInvoice?.draw_id) {
        const coIdsInAllocations = (allocations || [])
          .filter(a => a.change_order_id)
          .map(a => a.change_order_id);

        if (coIdsInAllocations.length > 0) {
          const { data: manualBillings } = await supabase
            .from('v2_job_co_draw_billings')
            .select('change_order_id, amount')
            .eq('draw_id', drawInvoice.draw_id)
            .in('change_order_id', coIdsInAllocations);

          if (manualBillings && manualBillings.length > 0) {
            for (const mb of manualBillings) {
              coOverlapWarnings.push({
                change_order_id: mb.change_order_id,
                manual_amount: mb.amount,
                message: `CO has manual billing of $${parseFloat(mb.amount).toFixed(2)} in this draw - potential double-count`
              });
            }
            logger.warn('CO overlap warning', { component: 'ALLOCATE', warnings: coOverlapWarnings });
          }
        }
      }
    }

    res.json({
      success: true,
      warnings: coOverlapWarnings.length > 0 ? { co_overlap: coOverlapWarnings } : undefined
    });
  } catch (err) {
    logger.error('Allocation error', { component: 'ALLOCATE', invoiceId, error: err.message });

    // Attempt to restore old allocations on failure
    if (rollbackData?.oldAllocations?.length > 0) {
      try {
        // Clear any partial new allocations
        await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);
        // Restore old allocations
        await supabase.from('v2_invoice_allocations').insert(rollbackData.oldAllocations);
        logger.info('Rolled back allocations for invoice', { component: 'ALLOCATE', invoiceId });
      } catch (rollbackErr) {
        logger.error('Rollback failed', { component: 'ALLOCATE', invoiceId, error: rollbackErr.message });
      }
    }

    res.status(500).json({ error: err.message, rollback_attempted: !!rollbackData });
  }
});

// ============================================================
// STATUS TRANSITION ENDPOINT
// ============================================================

router.post('/:id/transition', validate(schemas.invoiceTransition), asyncHandler(async (req, res) => {
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

  // Allocation sum validation for approval
  if (new_status === 'approved') {
    // Get current allocations (either from request body or existing)
    const allocsToCheck = allocations && allocations.length > 0
      ? allocations
      : invoice.allocations || [];

    // Check if invoice has any allocations
    if (allocsToCheck.length === 0) {
      throw new AppError('NO_ALLOCATIONS',
        'Cannot approve: Invoice has no cost code allocations. Please allocate the invoice before approving.',
        { invoiceAmount: parseFloat(invoice.amount || 0) }
      );
    }

    const allocSum = allocsToCheck.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const tolerance = 0.01; // 1 cent tolerance for floating point

    // Check if allocations match invoice amount
    if (Math.abs(allocSum - invoiceAmount) > tolerance) {
      throw new AppError('ALLOCATION_MISMATCH',
        `Cannot approve: Allocation total ($${allocSum.toFixed(2)}) does not equal invoice amount ($${invoiceAmount.toFixed(2)})`,
        { allocSum, invoiceAmount, difference: invoiceAmount - allocSum }
      );
    }
  }

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

    // PO-INT-01 & PO-INT-02: Sync PO/CO invoiced amounts after approval
    const { data: approvedAllocations } = await supabase
      .from('v2_invoice_allocations')
      .select('po_id, cost_code_id, change_order_id')
      .eq('invoice_id', invoiceId);

    if (approvedAllocations && approvedAllocations.length > 0) {
      // Sync PO line items
      const poIds = [...new Set(approvedAllocations.filter(a => a.po_id).map(a => a.po_id))];
      for (const poId of poIds) {
        await recalculatePOLineItemInvoiced(poId);
      }

      // Sync COs
      const coIds = [...new Set(approvedAllocations.filter(a => a.change_order_id).map(a => a.change_order_id))];
      for (const coId of coIds) {
        await recalculateCOInvoiced(coId);
      }
    }
  } else if (new_status === 'denied') {
    updateData.denied_at = new Date().toISOString();
    updateData.denied_by = performedBy;
    updateData.denial_reason = reason;

    // Clean up allocations when denying invoice
    await cleanupInvoiceAllocations(invoiceId);
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
    logger.error('Background re-stamp failed', { component: 'RESTAMP', invoiceId, error: err.message });
  });

  await logActivity(invoiceId, `status_${new_status}`, performedBy, { reason, from: invoice.status });
  broadcastInvoiceUpdate(updated, 'status_changed', performedBy);

  if (invoice.parent_invoice_id) {
    checkSplitReconciliation(invoice.parent_invoice_id).catch(err => logger.error('Split reconciliation failed', { error: err.message }));
  }

  res.json({ success: true, invoice: updated });
}));

// ============================================================
// STAMP ENDPOINT
// ============================================================

/**
 * POST /api/invoices/:id/stamp
 * Manually trigger PDF stamping for an invoice
 */
router.post('/:id/stamp', asyncHandler(async (req, res) => {
  const { id: invoiceId } = req.params;
  const { status } = req.body;

  // Verify invoice exists
  const { data: invoice, error: fetchError } = await supabase
    .from('v2_invoices')
    .select('id, status, pdf_url')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (fetchError || !invoice) {
    throw notFoundError('Invoice not found');
  }

  if (!invoice.pdf_url) {
    throw validationError('Invoice has no PDF to stamp');
  }

  logger.info('Manual stamp requested', { component: 'STAMP', invoiceId, status: status || invoice.status });

  // Trigger stamping
  const stampedUrl = await restampInvoice(invoiceId);

  res.json({
    success: true,
    stamped_url: stampedUrl,
    message: 'PDF stamped successfully'
  });
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
        logger.error('Error stamping split', { component: 'SPLIT', splitIndex, error: stampError.message });
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
          logger.error('Failed to delete stamped PDF', { component: 'UNSPLIT', error: err.message });
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

    // Validate allocations match invoice amount
    const allocSum = (invoice.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const tolerance = 0.01;

    if (invoice.allocations?.length === 0 || allocSum === 0) {
      results.failed.push({ id: invoiceId, error: 'Invoice has no allocations' });
      continue;
    }

    if (Math.abs(allocSum - invoiceAmount) > tolerance) {
      results.failed.push({
        id: invoiceId,
        error: `Allocation total ($${allocSum.toFixed(2)}) does not match invoice amount ($${invoiceAmount.toFixed(2)})`
      });
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
// FIX ENDPOINTS
// ============================================================

/**
 * Fix orphaned or problematic allocations
 * POST /api/invoices/:id/fix-allocation
 * Body: { allocation_id, fix_action: 'remove' | 'reassign', reassign_to?: { po_id, line_item_id, co_id } }
 */
router.post('/:id/fix-allocation', asyncHandler(async (req, res) => {
  const { id: invoiceId } = req.params;
  const { allocation_id, fix_action, reassign_to, performed_by } = req.body;

  if (!allocation_id || !fix_action) {
    return res.status(400).json({ error: 'allocation_id and fix_action required' });
  }

  // Verify allocation belongs to this invoice
  const { data: allocation, error: allocError } = await supabase
    .from('v2_invoice_allocations')
    .select('*')
    .eq('id', allocation_id)
    .eq('invoice_id', invoiceId)
    .single();

  if (allocError || !allocation) {
    return res.status(404).json({ error: 'Allocation not found' });
  }

  if (fix_action === 'remove') {
    // Delete the orphaned allocation
    const { error: deleteError } = await supabase
      .from('v2_invoice_allocations')
      .delete()
      .eq('id', allocation_id);

    if (deleteError) {
      throw new AppError('DATABASE_ERROR', `Failed to delete allocation: ${deleteError.message}`);
    }

    // Log activity
    await logActivity(invoiceId, 'allocation_removed', performed_by || 'System', {
      allocation_id,
      reason: 'fix_orphaned'
    });

    // Re-run validation to confirm fix worked
    const { data: remainingAllocations } = await supabase
      .from('v2_invoice_allocations')
      .select('id')
      .eq('invoice_id', invoiceId);

    return res.json({
      success: true,
      action: 'removed',
      allocation_id,
      remaining_allocations: remainingAllocations?.length || 0
    });
  }

  if (fix_action === 'reassign' && reassign_to) {
    // Update allocation with new PO/line item/CO references
    const updateFields = {};
    if (reassign_to.po_id !== undefined) updateFields.po_id = reassign_to.po_id;
    if (reassign_to.line_item_id !== undefined) updateFields.po_line_item_id = reassign_to.line_item_id;
    if (reassign_to.co_id !== undefined) updateFields.change_order_id = reassign_to.co_id;

    const { error: updateError } = await supabase
      .from('v2_invoice_allocations')
      .update(updateFields)
      .eq('id', allocation_id);

    if (updateError) {
      throw new AppError('DATABASE_ERROR', `Failed to reassign allocation: ${updateError.message}`);
    }

    await logActivity(invoiceId, 'allocation_reassigned', performed_by || 'System', {
      allocation_id,
      reassign_to
    });

    return res.json({
      success: true,
      action: 'reassigned',
      allocation_id,
      reassign_to
    });
  }

  res.status(400).json({ error: 'Invalid fix_action or missing reassign_to' });
}));

// ============================================================
// DELETE ENDPOINT
// ============================================================

router.delete('/:id', validate(schemas.idParam), asyncHandler(async (req, res) => {
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

  // Clean up allocations before soft-delete
  await cleanupInvoiceAllocations(invoiceId);

  const { error } = await supabase
    .from('v2_invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (error) {
    throw new AppError('DATABASE_ERROR', 'Failed to delete invoice');
  }

  await logActivity(invoiceId, 'deleted', performedBy, {});

  if (invoice.parent_invoice_id) {
    checkSplitReconciliation(invoice.parent_invoice_id).catch(err => logger.error('Split reconciliation failed', { error: err.message }));
  }

  broadcastInvoiceUpdate({ id: invoiceId }, 'deleted', performedBy);

  res.json({
    success: true,
    undoAvailable: true,
    undoExpiresIn: UNDO_WINDOW_SECONDS * 1000
  });
}));

// ============================================================
// TEST ENDPOINT - Create invoice directly (for testing only)
// ============================================================
router.post('/test-create', asyncHandler(async (req, res) => {
  const { job_id, vendor_id, invoice_number, invoice_date, amount, status } = req.body;

  if (!job_id || !vendor_id || !amount) {
    throw validationError('job_id, vendor_id, and amount are required');
  }

  const { data: invoice, error } = await supabase
    .from('v2_invoices')
    .insert({
      job_id,
      vendor_id,
      invoice_number: invoice_number || `TEST-${Date.now()}`,
      invoice_date: invoice_date || new Date().toISOString().split('T')[0],
      amount: parseFloat(amount),
      status: status || 'needs_approval',
      ai_processed: false,
      version: 1
    })
    .select()
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', `Failed to create test invoice: ${error.message}`);
  }

  await logActivity(invoice.id, 'created', 'Test System', { test: true });

  res.json(invoice);
}));

module.exports = router;
