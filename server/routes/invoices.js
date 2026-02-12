/**
 * Invoice Routes
 * All invoice management endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const { paginated } = require('../utils/api-response');
const { AppError, asyncHandler, notFoundError, validationError, transitionError, lockedError, versionConflictError } = require('../core/errors');
const { checkLock } = require('../core/locking');
const {
  decodeCursor,
  buildCursorFromItem,
  processCursorResults
} = require('../utils/cursor-pagination');
const {
  PaginationType,
  detectPaginationType,
  cursorResponse,
  offsetResponse,
  noPaginationResponse
} = require('../middleware/pagination');
const { validate, schemas } = require('../middleware/validate');
const { requirePermission } = require('../middleware/auth');
const { broadcastInvoiceUpdate, broadcast, broadcastNotification } = require('../core/realtime');
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
const { getBuilderId } = require('../core/multi-tenant');
const { triggerWebhooks } = require('./webhooks');

// Multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// ============================================================
// LIST & FILTER ENDPOINTS
// ============================================================

// List invoices (with optional filters and pagination)
// Supports three modes:
// 1. Cursor pagination: ?cursor=abc&limit=50 (recommended for real-time data)
// 2. Offset pagination: ?page=1&limit=50 (backward compatible)
// 3. No pagination: returns all results (backward compatible)
router.get('/', validate(schemas.invoiceQuery), async (req, res) => {
  try {
    const { job_id, status, vendor_id, page, limit, cursor } = req.query;
    const builderId = getBuilderId(req);
    const paginationType = detectPaginationType(req.query);

    // Parse limit (common to both pagination types)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));

    // Define the select query
    const selectQuery = `
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
    `;

    // Handle CURSOR pagination
    if (paginationType === PaginationType.CURSOR) {
      let query = supabase
        .from('v2_invoices')
        .select(selectQuery)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .order('id', { ascending: false });

      // Apply filters
      if (builderId) query = query.eq('builder_id', builderId);
      if (job_id) query = query.eq('job_id', job_id);
      if (status) query = query.eq('status', status);
      if (vendor_id) query = query.eq('vendor_id', vendor_id);

      // Apply cursor filter if provided
      if (cursor) {
        const cursorData = decodeCursor(cursor);
        if (cursorData && cursorData.created_at) {
          // For descending order: get items BEFORE cursor position
          // Use compound filter for precise positioning
          if (cursorData.id) {
            query = query.or(
              `created_at.lt.${cursorData.created_at},` +
              `and(created_at.eq.${cursorData.created_at},id.lt.${cursorData.id})`
            );
          } else {
            query = query.lt('created_at', cursorData.created_at);
          }
        }
      }

      // Fetch one extra to check if there are more items
      query = query.limit(limitNum + 1);

      const { data, error } = await query;
      if (error) throw error;

      // Process results
      const result = processCursorResults(data || [], limitNum, ['created_at', 'id']);

      return res.json(cursorResponse(result.data, result.nextCursor, result.hasMore));
    }

    // Handle OFFSET pagination (backward compatible)
    if (paginationType === PaginationType.OFFSET) {
      const pageNum = Math.max(1, parseInt(page) || 1);
      const offset = (pageNum - 1) * limitNum;

      let query = supabase
        .from('v2_invoices')
        .select(selectQuery, { count: 'exact' })
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      // Apply filters
      if (builderId) query = query.eq('builder_id', builderId);
      if (job_id) query = query.eq('job_id', job_id);
      if (status) query = query.eq('status', status);
      if (vendor_id) query = query.eq('vendor_id', vendor_id);

      query = query.range(offset, offset + limitNum - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      // Use the new standardized offset response
      return res.json(offsetResponse(data || [], pageNum, limitNum, count || 0));
    }

    // NO pagination - return all results (backward compatible)
    let query = supabase
      .from('v2_invoices')
      .select(selectQuery)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Apply filters
    if (builderId) query = query.eq('builder_id', builderId);
    if (job_id) query = query.eq('job_id', job_id);
    if (status) query = query.eq('status', status);
    if (vendor_id) query = query.eq('vendor_id', vendor_id);

    const { data, error } = await query;
    if (error) throw error;

    return res.json(noPaginationResponse(data || []));
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get invoices that need review
router.get('/needs-review', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('needs_review', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get invoices with low AI confidence
router.get('/low-confidence', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('ai_processed', true)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const lowConfidence = data.filter(inv => {
    if (!inv.ai_confidence) return false;
    return Object.values(inv.ai_confidence).some(c => c < 0.6);
  });

  res.json(lowConfidence);
}));

// Get invoices without job assignment
router.get('/no-job', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_invoices')
    .select(`
      *,
      vendor:v2_vendors(id, name)
    `)
    .is('job_id', null)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (builderId) query = query.eq('builder_id', builderId);

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// SINGLE INVOICE ENDPOINTS
// ============================================================

// Get single invoice with full details
router.get('/:id', validate(schemas.idParam), async (req, res) => {
  try {
    const builderId = getBuilderId(req);

    let query = supabase
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
      .eq('id', req.params.id);

    if (builderId) query = query.eq('builder_id', builderId);

    const { data, error } = await query.single();

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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
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
router.get('/:id/family', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  const { data: invoice, error: invError } = await supabase
    .from('v2_invoices')
    .select('id, parent_invoice_id, is_split_parent')
    .eq('id', id)
    .eq('builder_id', builderId)
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
    .eq('builder_id', builderId)
    .single();

  const { data: children } = await supabase
    .from('v2_invoices')
    .select(`
      *, vendor:v2_vendors(id, name), job:v2_jobs(id, name),
      po:v2_purchase_orders(id, po_number, job_change_order_id)
    `)
    .eq('parent_invoice_id', rootId)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .order('split_index');

  res.json({ is_split: true, parent, children: children || [] });
}));

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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// AI-powered invoice processing
router.post('/process', requirePermission('canApproveInvoices'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file provided',
        supported: 'PDF, images (JPG, PNG, etc.), Word (.doc, .docx), Excel (.xls, .xlsx)'
      });
    }

    // Get builder_id from authenticated user
    const builderId = getBuilderId(req);
    const companyName = req.builder?.name || 'your company';

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
      twoStageResult = await processInvoiceTwoStage(fileBuffer, originalFilename, companyName);

      // Fall back to original process if two-stage fails
      if (!twoStageResult.success) {
        logger.info('Falling back to original processInvoice', { component: 'TwoStage' });
        result = await processInvoice(fileBuffer, originalFilename, companyName);
      } else {
        // Build result from two-stage pipeline
        result = await processInvoice(fileBuffer, originalFilename, companyName);

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
        originalFilename,
        companyName
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
      const extracted = await extractInvoiceFromText(documentText, originalFilename, converted.fileType, companyName);

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
        builder_id: builderId || null,
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
        po_id: invoice.po_id || null,
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
              po_id: invoice.po_id || null,
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

    // Trigger webhook for invoice creation
    if (builderId) {
      triggerWebhooks(builderId, 'invoice.created', invoice.id, {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        vendor_id: invoice.vendor_id,
        vendor_name: result.vendor?.name,
        job_id: invoice.job_id,
        job_name: result.matchedJob?.name,
        amount: invoice.amount,
        status: invoice.status,
        created_at: invoice.created_at,
      }).catch(err => logger.error('Webhook trigger failed', { error: err.message }));
    }

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
    res.status(500).json({ error: 'Internal server error' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Process a multi-invoice PDF: split and process each invoice
 * Returns results for all detected invoices
 */
router.post('/process-batch', requirePermission('canApproveInvoices'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Get builder_id from authenticated user
    const builderId = getBuilderId(req);
    const companyName = req.builder?.name || 'your company';

    const originalFilename = req.file.originalname;
    const fileBuffer = req.file.buffer;

    logger.info('Batch processing multi-invoice PDF', { component: 'MultiInvoice', filename: originalFilename });

    // Process the multi-invoice PDF
    const batchResult = await processMultiInvoicePDF(fileBuffer, originalFilename, {}, companyName);

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
            builder_id: builderId || null,
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// UPDATE ENDPOINTS
// ============================================================

// Update invoice (partial)
router.patch('/:id', requirePermission('canApproveInvoices'), validate(schemas.invoiceUpdate), asyncHandler(async (req, res) => {
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
router.post('/:id/allocate', requirePermission('canApproveInvoices'), validate(schemas.invoiceAllocations), async (req, res) => {
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

    res.status(500).json({ error: 'Internal server error', rollback_attempted: !!rollbackData });
  }
});

// ============================================================
// STATUS TRANSITION ENDPOINT
// ============================================================

router.post('/:id/transition', requirePermission('canApproveInvoices'), validate(schemas.invoiceTransition), asyncHandler(async (req, res) => {
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

  // Send real-time toast notification for key status changes
  if (new_status === 'approved') {
    broadcastNotification('success', `Invoice #${updated.invoice_number || invoiceId.slice(0, 8)} approved`, {
      title: 'Invoice Approved',
      entityType: 'invoice',
      entityId: invoiceId,
      link: `/invoices?id=${invoiceId}`,
      action: 'approved',
      performedBy
    });
  } else if (new_status === 'denied') {
    broadcastNotification('warning', `Invoice #${updated.invoice_number || invoiceId.slice(0, 8)} denied`, {
      title: 'Invoice Denied',
      entityType: 'invoice',
      entityId: invoiceId,
      link: `/invoices?id=${invoiceId}`,
      action: 'denied',
      performedBy
    });
  } else if (new_status === 'paid') {
    broadcastNotification('success', `Invoice #${updated.invoice_number || invoiceId.slice(0, 8)} marked as paid`, {
      title: 'Invoice Paid',
      entityType: 'invoice',
      entityId: invoiceId,
      link: `/invoices?id=${invoiceId}`,
      action: 'paid',
      performedBy
    });
  }

  // Trigger webhook for status change
  const builderId = getBuilderId(req);
  if (builderId) {
    const eventType = new_status === 'approved' ? 'invoice.approved'
      : new_status === 'paid' ? 'invoice.paid'
      : 'invoice.updated';
    triggerWebhooks(builderId, eventType, updated.id, {
      id: updated.id,
      invoice_number: updated.invoice_number,
      vendor_id: updated.vendor_id,
      job_id: updated.job_id,
      amount: updated.amount,
      status: updated.status,
      previous_status: invoice.status,
      performed_by: performedBy,
      updated_at: updated.updated_at,
    }).catch(err => logger.error('Webhook trigger failed', { error: err.message }));
  }

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
router.post('/:id/stamp', requirePermission('canApproveInvoices'), asyncHandler(async (req, res) => {
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

router.post('/:id/split', requirePermission('canApproveInvoices'), async (req, res) => {
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/unsplit', requirePermission('canApproveInvoices'), async (req, res) => {
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// PAYMENT ENDPOINTS
// ============================================================

router.patch('/:id/pay', requirePermission('canApproveInvoices'), async (req, res) => {
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/:id/unpay', requirePermission('canApproveInvoices'), async (req, res) => {
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// BULK OPERATIONS
// ============================================================

router.post('/bulk/approve', requirePermission('canApproveInvoices'), asyncHandler(async (req, res) => {
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

router.post('/bulk/add-to-draw', requirePermission('canApproveInvoices'), asyncHandler(async (req, res) => {
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
router.post('/:id/fix-allocation', requirePermission('canApproveInvoices'), asyncHandler(async (req, res) => {
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

router.delete('/:id', requirePermission('canApproveInvoices'), validate(schemas.idParam), asyncHandler(async (req, res) => {
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
// MANUAL INVOICE CREATION - Create invoice without PDF upload
// ============================================================
router.post('/create', asyncHandler(async (req, res) => {
  const {
    job_id,
    vendor_id,
    po_id,
    invoice_number,
    invoice_date,
    due_date,
    amount,
    description,
    notes,
    status
  } = req.body;

  if (!job_id || !vendor_id || !amount) {
    throw validationError('job_id, vendor_id, and amount are required');
  }

  if (!invoice_number) {
    throw validationError('invoice_number is required');
  }

  // Check for duplicate invoice number for this job
  const { data: existing } = await supabase
    .from('v2_invoices')
    .select('id')
    .eq('job_id', job_id)
    .eq('invoice_number', invoice_number)
    .is('deleted_at', null)
    .single();

  if (existing) {
    throw validationError(`Invoice number "${invoice_number}" already exists for this job`);
  }

  const { data: invoice, error } = await supabase
    .from('v2_invoices')
    .insert({
      job_id,
      vendor_id,
      po_id: po_id || null,
      invoice_number,
      invoice_date: invoice_date || new Date().toISOString().split('T')[0],
      due_date: due_date || null,
      amount: parseFloat(amount),
      description: description || null,
      notes: notes || null,
      status: status || 'needs_approval',
      ai_processed: false,
      version: 1
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', `Failed to create invoice: ${error.message}`);
  }

  await logActivity(invoice.id, 'created', 'Manual Entry', {
    manual_entry: true,
    has_po: !!po_id
  });

  res.status(201).json(invoice);
}));

// Legacy endpoint for backwards compatibility
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

// ============================================================
// APPROVAL CONTEXT (budget/PO info for approval workflow)
// ============================================================

router.get('/:id/approval-context', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    // Get the invoice with allocations, job, and PO
    const { data: invoice, error: invoiceError } = await supabase
      .from('v2_invoices')
      .select(`
        id, job_id, po_id, amount, status,
        allocations:v2_invoice_allocations(
          id, amount, cost_code_id, po_line_item_id,
          cost_code:v2_cost_codes(id, code, name)
        ),
        po:v2_purchase_orders(
          id, po_number, total_amount, status, job_change_order_id,
          line_items:v2_po_line_items(id, cost_code_id, amount, invoiced_amount)
        )
      `)
      .eq('builder_id', builderId)
      .eq('id', req.params.id)
      .single();

    if (invoiceError) throw invoiceError;
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const result = {
      budget: [],
      po: null
    };

    // Get budget context for each cost code in allocations
    if (invoice.allocations?.length > 0 && invoice.job_id) {
      const costCodeIds = invoice.allocations.map(a => a.cost_code_id).filter(Boolean);

      // Get budget lines for these cost codes
      const { data: budgetLines } = await supabase
        .from('v2_budget_lines')
        .select('cost_code_id, budgeted_amount')
        .eq('job_id', invoice.job_id)
        .in('cost_code_id', costCodeIds);

      // Get all approved/in_draw/paid invoice allocations for these cost codes (excluding current invoice)
      const { data: existingAllocations } = await supabase
        .from('v2_invoice_allocations')
        .select(`
          amount, cost_code_id,
          invoice:v2_invoices!inner(id, job_id, status)
        `)
        .eq('invoice.job_id', invoice.job_id)
        .in('invoice.status', ['approved', 'in_draw', 'paid'])
        .neq('invoice.id', invoice.id)
        .in('cost_code_id', costCodeIds);

      // Calculate billed amounts per cost code
      const billedByCostCode = {};
      existingAllocations?.forEach(a => {
        if (!billedByCostCode[a.cost_code_id]) billedByCostCode[a.cost_code_id] = 0;
        billedByCostCode[a.cost_code_id] += parseFloat(a.amount) || 0;
      });

      // Build budget context for each allocation
      result.budget = invoice.allocations.map(alloc => {
        const budgetLine = budgetLines?.find(bl => bl.cost_code_id === alloc.cost_code_id);
        const budgeted = parseFloat(budgetLine?.budgeted_amount) || 0;
        const previouslyBilled = billedByCostCode[alloc.cost_code_id] || 0;
        const thisInvoice = parseFloat(alloc.amount) || 0;
        const afterApproval = previouslyBilled + thisInvoice;

        return {
          cost_code: alloc.cost_code,
          this_invoice: thisInvoice,
          budgeted: budgeted,
          previously_billed: previouslyBilled,
          after_approval: afterApproval,
          remaining: budgeted - afterApproval,
          over_budget: afterApproval > budgeted && budgeted > 0
        };
      });
    }

    // Get PO context - either from invoice.po_id OR from allocation po_line_item links
    let linkedPO = invoice.po;
    let linkedPOId = invoice.po_id;

    // If no direct PO link, check allocation line item links
    if (!linkedPO && invoice.allocations?.length > 0) {
      const poLineItemIds = invoice.allocations
        .map(a => a.po_line_item_id)
        .filter(Boolean);

      if (poLineItemIds.length > 0) {
        // Get the PO from the first linked line item
        const { data: poLineItem } = await supabase
          .from('v2_po_line_items')
          .select(`
            po_id,
            po:v2_purchase_orders(
              id, po_number, total_amount, status, job_change_order_id,
              line_items:v2_po_line_items(id, cost_code_id, amount, invoiced_amount)
            )
          `)
          .eq('id', poLineItemIds[0])
          .single();

        if (poLineItem?.po) {
          linkedPO = poLineItem.po;
          linkedPOId = poLineItem.po_id;
        }
      }
    }

    if (linkedPO) {
      const poTotal = parseFloat(linkedPO.total_amount) || 0;

      // Get all invoices already billed against this PO (excluding current invoice)
      // Check both invoice.po_id and allocations linked to PO line items
      const { data: poInvoices } = await supabase
        .from('v2_invoices')
        .select('id, amount, status')
        .eq('po_id', linkedPOId)
        .neq('id', invoice.id)
        .in('status', ['approved', 'in_draw', 'paid']);

      // Also get invoices linked via po_line_item_id
      const { data: lineItemAllocations } = await supabase
        .from('v2_invoice_allocations')
        .select(`
          amount,
          po_line_item:v2_po_line_items!inner(po_id),
          invoice:v2_invoices!inner(id, status)
        `)
        .eq('po_line_item.po_id', linkedPOId)
        .neq('invoice.id', invoice.id)
        .in('invoice.status', ['approved', 'in_draw', 'paid']);

      const previouslyBilledDirect = poInvoices?.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0) || 0;
      const previouslyBilledLineItems = lineItemAllocations?.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) || 0;

      // Get this invoice's allocated amount (for partial approvals, use allocated not full amount)
      const totalAllocated = invoice.allocations?.reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) || 0;

      // Get amount linked specifically to this PO (could be partial if split across POs)
      const thisInvoiceLinkedAmount = invoice.allocations
        ?.filter(a => {
          if (!a.po_line_item_id) return false;
          // Check if this line item belongs to our PO
          const lineItem = linkedPO.line_items?.find(li => li.id === a.po_line_item_id);
          return !!lineItem;
        })
        .reduce((sum, a) => sum + (parseFloat(a.amount) || 0), 0) || 0;

      const previouslyBilled = Math.max(previouslyBilledDirect, previouslyBilledLineItems);
      // Use allocated amount if available (for partial approvals), otherwise full invoice amount
      const thisInvoice = invoice.po_id === linkedPOId
        ? (totalAllocated > 0 ? totalAllocated : (parseFloat(invoice.amount) || 0))
        : (thisInvoiceLinkedAmount > 0 ? thisInvoiceLinkedAmount : (parseFloat(invoice.amount) || 0));
      const afterApproval = previouslyBilled + thisInvoice;

      result.po = {
        id: linkedPO.id,
        po_number: linkedPO.po_number,
        po_status: linkedPO.status,
        total_amount: poTotal,
        previously_billed: previouslyBilled,
        this_invoice: thisInvoice,
        after_approval: afterApproval,
        remaining: poTotal - afterApproval,
        percent_used: poTotal > 0 ? Math.round((afterApproval / poTotal) * 100) : 0,
        over_po: afterApproval > poTotal,
        job_change_order_id: linkedPO.job_change_order_id
      };

      // Get CO context if PO is linked to a Change Order
      if (linkedPO.job_change_order_id) {
        const { data: co } = await supabase
          .from('v2_job_change_orders')
          .select('id, change_order_number, title, amount, invoiced_amount, status')
          .eq('id', linkedPO.job_change_order_id)
          .single();

        if (co) {
          const coTotal = parseFloat(co.amount) || 0;
          const coPreviouslyBilled = parseFloat(co.invoiced_amount) || 0;
          const coThisInvoice = thisInvoice;
          const coAfterApproval = coPreviouslyBilled + coThisInvoice;

          result.change_order = {
            id: co.id,
            change_order_number: co.change_order_number,
            title: co.title,
            status: co.status,
            total_amount: coTotal,
            previously_billed: coPreviouslyBilled,
            this_invoice: coThisInvoice,
            after_approval: coAfterApproval,
            remaining: coTotal - coAfterApproval,
            percent_used: coTotal > 0 ? Math.round((coAfterApproval / coTotal) * 100) : 0,
            over_co: coAfterApproval > coTotal
          };
        }
      }
    }

    res.json(result);
}));

// ============================================================
// UPDATE COST CODE (coding workflow)
// ============================================================

router.patch('/:id/code', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const invoiceId = req.params.id;
    const { job_id, vendor_id, po_id, cost_codes, allocations, coded_by } = req.body;
    // Support both cost_codes (from frontend) and allocations (legacy)
    const allocs = cost_codes || allocations || [];

    // Update invoice
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .update({
        job_id,
        vendor_id,
        po_id: po_id || null,
        status: 'ready_for_approval',
        coded_at: new Date().toISOString(),
        coded_by
      })
      .eq('id', invoiceId)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (invError) throw invError;

    // Update allocations
    await supabase
      .from('v2_invoice_allocations')
      .delete()
      .eq('invoice_id', invoiceId);

    if (allocs && allocs.length > 0) {
      await supabase
        .from('v2_invoice_allocations')
        .insert(allocs.map(a => ({
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

    // Log activity
    await logActivity(invoiceId, 'ready_for_approval', coded_by, {
      job_id,
      vendor_id,
      po_id,
      allocations: allocs
    });

    // Re-stamp PDF with "Ready for Approval" (run in background)
    restampInvoice(invoiceId).catch(err => {
      logger.error('Background re-stamp failed', { component: 'restamp', error: err.message });
    });

    res.json(invoice);
}));

// ============================================================
// APPROVE INVOICE (with PDF stamping)
// ============================================================

router.patch('/:id/approve', requirePermission('canApproveInvoices'), asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const invoiceId = req.params.id;
    const { approved_by } = req.body;

    // Get invoice with details
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, description, total_amount),
        allocations:v2_invoice_allocations(
          amount,
          cost_code_id,
          pending_co,
          change_order_id,
          cost_code:v2_cost_codes(code, name)
        )
      `)
      .eq('builder_id', builderId)
      .eq('id', invoiceId)
      .single();

    if (getError) throw getError;

    // ==========================================
    // VALIDATION: Prevent re-approval (preserve audit trail)
    // ==========================================
    const alreadyApprovedStatuses = ['approved', 'pm_approved', 'in_draw', 'paid'];
    if (alreadyApprovedStatuses.includes(invoice.status)) {
      return res.status(400).json({
        error: `Invoice is already ${invoice.status}. Cannot re-approve.`,
        current_status: invoice.status,
        approved_by: invoice.approved_by,
        approved_at: invoice.approved_at
      });
    }

    // ==========================================
    // VALIDATION: Require allocations before approval
    // ==========================================
    const allocations = invoice.allocations || [];
    if (allocations.length === 0) {
      return res.status(400).json({
        error: 'Cannot approve invoice without cost code allocations. Please assign at least one cost code.'
      });
    }

    // ==========================================
    // VALIDATION: Allocation total must match invoice amount
    // Allow partial billing (already billed amount + new allocations should cover invoice)
    // OR allow explicit partial approval via allow_partial flag
    // ==========================================
    const invoiceAmount = parseFloat(invoice.amount || 0);
    const allocationTotal = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const previouslyBilled = parseFloat(invoice.billed_amount || 0);
    const totalCoded = previouslyBilled + allocationTotal;
    const allowPartial = req.body.allow_partial === true;

    // For credits, check if allocation is negative enough; for regular invoices, check if fully coded
    const isCredit = invoiceAmount < 0;
    const tolerance = 0.01; // Allow penny rounding differences
    let isPartialApproval = false;

    if (isCredit) {
      // Credit: allocation should be negative and match invoice
      if (allocationTotal > invoiceAmount + tolerance) {
        return res.status(400).json({
          error: `Allocation total ($${allocationTotal.toFixed(2)}) does not match credit amount ($${invoiceAmount.toFixed(2)}). Please adjust allocations.`
        });
      }
    } else {
      // Regular invoice: allocations should fully cover the invoice (allowing for partial billing)
      if (totalCoded < invoiceAmount - tolerance) {
        const remaining = invoiceAmount - totalCoded;

        // If allow_partial flag is set, proceed with partial approval
        if (allowPartial) {
          isPartialApproval = true;
          logger.info('Partial approval', { component: 'approval', allocationTotal, invoiceAmount, remaining });
        } else {
          return res.status(400).json({
            error: `Allocations ($${allocationTotal.toFixed(2)}) do not fully cover invoice amount ($${invoiceAmount.toFixed(2)}). $${remaining.toFixed(2)} remains unallocated.`,
            invoice_amount: invoiceAmount,
            allocation_total: allocationTotal,
            previously_billed: previouslyBilled,
            remaining: remaining,
            allow_partial_option: true
          });
        }
      }
    }

    // Check for pending CO allocations - block approval
    const pendingCOAllocations = (invoice.allocations || []).filter(a => a.pending_co);
    if (pendingCOAllocations.length > 0) {
      return res.status(400).json({
        error: 'Cannot approve invoice with pending CO allocations. Please link all CO cost codes to Change Orders first.'
      });
    }

    // Check for CO cost codes without CO link - block approval
    const unlinkedCOAllocations = (invoice.allocations || []).filter(a => {
      const costCode = a.cost_code?.code || '';
      const isCOCostCode = costCode.endsWith('C') && /\d+C$/.test(costCode);
      return isCOCostCode && !a.change_order_id && !a.pending_co;
    });
    if (unlinkedCOAllocations.length > 0) {
      const codes = unlinkedCOAllocations.map(a => a.cost_code?.code).join(', ');
      return res.status(400).json({
        error: `Cannot approve invoice with unlinked CO cost codes: ${codes}. Please link to a Change Order or mark as Pending CO.`
      });
    }

    // ==========================================
    // CO AUTO-INHERITANCE FROM PO
    // If invoice is linked to a PO that's linked to a CO, inherit the CO
    // ==========================================
    let linkedChangeOrder = null;
    if (invoice.po_id) {
      const { data: po } = await supabase
        .from('v2_purchase_orders')
        .select('id, job_change_order_id, job_change_order:v2_job_change_orders(id, change_order_number, title)')
        .eq('id', invoice.po_id)
        .single();

      if (po?.job_change_order_id) {
        linkedChangeOrder = po.job_change_order;
        // Update all allocations to link to this CO
        const { error: allocUpdateError } = await supabase
          .from('v2_invoice_allocations')
          .update({ change_order_id: po.job_change_order_id })
          .eq('invoice_id', invoiceId)
          .is('change_order_id', null); // Only update allocations not already linked

        if (!allocUpdateError) {
          // Log the auto-linking
          await logActivity(invoiceId, 'co_auto_linked', 'System', {
            change_order_id: po.job_change_order_id,
            change_order_number: linkedChangeOrder?.change_order_number,
            from_po: po.id
          });
        }
      }
    }

    // ==========================================
    // GET/CREATE DRAFT DRAW FIRST (before stamping)
    // ==========================================

    let draftDraw = null;
    let addedToDraw = false;

    if (invoice.job?.id && invoice.allocations && invoice.allocations.length > 0) {
      try {
        draftDraw = await getOrCreateDraftDraw(invoice.job.id, approved_by);
      } catch (drawErr) {
        logger.error('Error getting/creating draft draw', { component: 'approval', error: drawErr.message });
        // Continue without draw assignment
      }
    }

    let pdf_stamped_url = null;

    // Stamp PDF if exists - use existing stamped PDF if available (progressive stamping)
    const pdfSourceUrl = invoice.pdf_stamped_url || invoice.pdf_url;
    if (pdfSourceUrl) {
      try {
        // Extract storage path from URL - handle both storage URL formats
        let storagePath = null;
        if (pdfSourceUrl.includes('/storage/v1/object/public/invoices/')) {
          const urlParts = pdfSourceUrl.split('/storage/v1/object/public/invoices/');
          storagePath = urlParts[1] ? decodeURIComponent(urlParts[1].split('?')[0]) : null;
        } else if (pdfSourceUrl.includes('/invoices/')) {
          const urlParts = pdfSourceUrl.split('/invoices/');
          storagePath = urlParts[1] ? decodeURIComponent(urlParts[1].split('?')[0]) : null;
        }

        if (storagePath) {
          logger.debug('Approval stamp source', { component: 'stamp', source: invoice.pdf_stamped_url ? 'pdf_stamped_url' : 'pdf_url' });
          const pdfBuffer = await downloadPDF(storagePath);

          // Get PO billing info if PO is linked
          let poTotal = null;
          let poBilledToDate = 0;

          if (invoice.po?.id) {
            poTotal = invoice.po.total_amount;

            // Get sum of all previously approved invoices for this PO (excluding current)
            const { data: priorInvoices } = await supabase
              .from('v2_invoices')
              .select('amount')
              .eq('po_id', invoice.po.id)
              .neq('id', invoiceId)
              .in('status', ['approved', 'in_draw', 'paid']);

            if (priorInvoices) {
              poBilledToDate = priorInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
            }
          }

          // Calculate partial billing info
          const invoiceTotal = parseFloat(invoice.amount || 0);
          const alreadyBilled = Math.max(
            parseFloat(invoice.billed_amount || 0),
            parseFloat(invoice.paid_amount || 0)
          );
          const isPartialInvoice = alreadyBilled > 0;

          // Build status text with draw number if available
          let stampStatus = isPartialInvoice ? 'APPROVED (PARTIAL)' : 'APPROVED';
          if (draftDraw) {
            stampStatus += ` - Draw #${draftDraw.draw_number}`;
          }

          // Get split info if this is a split child
          let splitInfo = null;
          if (invoice.parent_invoice_id && invoice.split_index) {
            // Count total siblings
            const { count } = await supabase
              .from('v2_invoices')
              .select('*', { count: 'exact', head: true })
              .eq('parent_invoice_id', invoice.parent_invoice_id);

            splitInfo = {
              isSplit: true,
              index: invoice.split_index,
              total: count || 1
            };
          }

          // Build CO info from linked change order (if any)
          const coInfo = linkedChangeOrder ? {
            number: linkedChangeOrder.change_order_number,
            title: linkedChangeOrder.title
          } : null;

          const stampedBuffer = await stampApproval(pdfBuffer, {
            status: stampStatus,
            date: new Date().toLocaleDateString(),
            approvedBy: approved_by,
            vendorName: invoice.vendor?.name,
            invoiceNumber: invoice.invoice_number,
            jobName: invoice.job?.name,
            costCodes: invoice.allocations?.map(a => ({
              code: a.cost_code?.code,
              name: a.cost_code?.name,
              amount: a.amount
            })) || [],
            amount: invoice.amount,
            poNumber: invoice.po?.po_number,
            poDescription: invoice.po?.description,
            poTotal: poTotal,
            poBilledToDate: poBilledToDate,
            // Partial billing info
            isPartial: isPartialInvoice,
            previouslyBilled: alreadyBilled,
            remainingAfterThis: invoiceTotal - alreadyBilled - (invoice.allocations?.reduce((s, a) => s + parseFloat(a.amount || 0), 0) || 0),
            // Draw info
            drawNumber: draftDraw?.draw_number,
            // Split invoice info
            splitInfo,
            // Change Order info (from PO linkage)
            coInfo
          });

          // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
          const result = await uploadStampedPDFById(stampedBuffer, invoiceId, invoice.job?.id);
          pdf_stamped_url = result.url;
        }
      } catch (stampErr) {
        logger.error('PDF stamping failed', { component: 'stamp', error: stampErr.message });
        // Continue without stamping
      }
    }

    // ==========================================
    // ADD INVOICE TO DRAFT DRAW (unless non-billable)
    // ==========================================

    // Check if invoice is non-billable (billable_amount = 0)
    const effectiveBillableAmount = invoice.billable_amount !== null
      ? parseFloat(invoice.billable_amount)
      : parseFloat(invoice.amount || 0);
    const isNonBillable = effectiveBillableAmount === 0;

    if (isNonBillable) {
      logger.info('Invoice is non-billable - skipping draw', { component: 'approval', invoiceId });
    } else if (draftDraw) {
      try {
        // TODO: Import addInvoiceToDraw from services/invoice-helpers.js
        // Add invoice to draw (creates draw_allocations)
        await addInvoiceToDraw(invoiceId, draftDraw.id, approved_by);
        addedToDraw = true;

        logger.info('Invoice auto-added to draw', { component: 'approval', invoiceId, drawNumber: draftDraw.draw_number });
      } catch (drawErr) {
        logger.error('Error adding invoice to draw', { component: 'approval', error: drawErr.message });
        // Continue with approval even if draw add fails
      }
    }

    // Update invoice status:
    // - non-billable: 'paid' (absorbed, not in draw)
    // - added to draw: 'in_draw'
    // - otherwise: 'approved'
    const newStatus = isNonBillable ? 'paid' : (addedToDraw ? 'in_draw' : 'approved');

    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        status: newStatus,
        approved_at: new Date().toISOString(),
        approved_by,
        pdf_stamped_url,
        first_draw_id: addedToDraw ? draftDraw.id : null
      })
      .eq('id', invoiceId)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(invoiceId, 'approved', approved_by, {
      stamped: !!pdf_stamped_url,
      added_to_draw: addedToDraw,
      draw_id: draftDraw?.id,
      draw_number: draftDraw?.draw_number
    });

    // ==========================================
    // LIVE BUDGET UPDATES
    // ==========================================

    // Update budget lines for each cost code allocation
    if (invoice.allocations && invoice.allocations.length > 0 && invoice.job?.id) {
      for (const alloc of invoice.allocations) {
        if (!alloc.cost_code_id) continue;

        // Check if budget line exists for this job/cost code
        const { data: existing } = await supabase
          .from('v2_budget_lines')
          .select('id, billed_amount')
          .eq('job_id', invoice.job.id)
          .eq('cost_code_id', alloc.cost_code_id)
          .single();

        if (existing) {
          // Update existing budget line
          const newBilled = (parseFloat(existing.billed_amount) || 0) + parseFloat(alloc.amount);
          await supabase
            .from('v2_budget_lines')
            .update({ billed_amount: newBilled })
            .eq('id', existing.id);
        } else {
          // Create new budget line
          await supabase
            .from('v2_budget_lines')
            .insert({
              job_id: invoice.job.id,
              cost_code_id: alloc.cost_code_id,
              budgeted_amount: 0,
              committed_amount: 0,
              billed_amount: parseFloat(alloc.amount) || 0,
              paid_amount: 0
            });
        }
      }
    }

    // Update PO line items if invoice is linked to a PO
    if (invoice.po?.id && invoice.allocations && invoice.allocations.length > 0) {
      for (const alloc of invoice.allocations) {
        if (!alloc.cost_code_id) continue;

        // Find matching PO line item by cost code
        const { data: poLineItem } = await supabase
          .from('v2_po_line_items')
          .select('id, invoiced_amount')
          .eq('po_id', invoice.po.id)
          .eq('cost_code_id', alloc.cost_code_id)
          .single();

        if (poLineItem) {
          const newInvoiced = (parseFloat(poLineItem.invoiced_amount) || 0) + parseFloat(alloc.amount);
          await supabase
            .from('v2_po_line_items')
            .update({ invoiced_amount: newInvoiced })
            .eq('id', poLineItem.id);
        }
      }
    }

    res.json(updated);
}));

// ============================================================
// DENY INVOICE
// ============================================================

router.patch('/:id/deny', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const invoiceId = req.params.id;
    const { denied_by, denial_reason } = req.body;

    // Get current invoice to validate transition
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', invoiceId)
      .single();

    if (getError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Only allow deny from needs_review or ready_for_approval status
    const allowedStatuses = ['needs_review', 'ready_for_approval'];
    if (!allowedStatuses.includes(invoice.status)) {
      return res.status(400).json({
        error: `Cannot deny invoice in '${invoice.status}' status. Only needs_review or ready_for_approval invoices can be denied.`
      });
    }

    const { data, error } = await supabase
      .from('v2_invoices')
      .update({
        status: 'denied',
        denied_at: new Date().toISOString(),
        denied_by,
        denial_reason
      })
      .eq('id', invoiceId)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (error) throw error;

    await logActivity(invoiceId, 'denied', denied_by, { reason: denial_reason });

    res.json(data);
}));

// ============================================================
// CLOSE OUT INVOICE
// ============================================================

router.post('/:id/close-out', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const invoiceId = req.params.id;
    const { closed_out_by, reason, notes } = req.body;

    // Validate required fields
    if (!closed_out_by) {
      return res.status(400).json({ error: 'closed_out_by is required' });
    }
    if (!reason) {
      return res.status(400).json({ error: 'Reason is required for close-out' });
    }

    // Valid close-out reasons
    const validReasons = [
      'Work descoped / reduced scope',
      'Vendor credit issued',
      'Dispute resolved / settlement',
      'Change order adjustment',
      'Billing error corrected',
      'Other'
    ];

    if (!validReasons.includes(reason)) {
      return res.status(400).json({ error: 'Invalid close-out reason' });
    }

    // If reason is "Other", notes are required
    if (reason === 'Other' && (!notes || notes.trim() === '')) {
      return res.status(400).json({ error: 'Notes are required when reason is "Other"' });
    }

    // Get current invoice
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, status, amount, paid_amount, parent_invoice_id')
      .eq('builder_id', builderId)
      .eq('id', invoiceId)
      .single();

    if (getError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Only allow close-out from ready_for_approval or approved status
    const allowedStatuses = ['ready_for_approval', 'approved'];
    if (!allowedStatuses.includes(invoice.status)) {
      return res.status(400).json({
        error: `Cannot close out invoice in '${invoice.status}' status. Only ready_for_approval or approved invoices can be closed out.`
      });
    }

    const invoiceAmount = parseFloat(invoice.amount || 0);
    const paidAmount = parseFloat(invoice.paid_amount || 0);
    const writeOffAmount = invoiceAmount - paidAmount;

    // Validate there's actually something to write off
    if (writeOffAmount <= 0.01) {
      return res.status(400).json({
        error: 'Invoice is already fully paid. Nothing to close out.'
      });
    }

    // Build close-out reason with notes
    const fullReason = notes ? `${reason}: ${notes}` : reason;

    // Update invoice
    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        status: 'paid',
        paid_amount: invoiceAmount, // Set paid_amount to full amount (write-off counts as "paid")
        closed_out_at: new Date().toISOString(),
        closed_out_by,
        closed_out_reason: fullReason,
        write_off_amount: writeOffAmount
      })
      .eq('id', invoiceId)
      .eq('builder_id', builderId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Clear any remaining allocations
    await supabase
      .from('v2_invoice_allocations')
      .delete()
      .eq('invoice_id', invoiceId);

    // Log activity
    await logActivity(invoiceId, 'closed_out', closed_out_by, {
      invoice_amount: invoiceAmount,
      total_paid: paidAmount,
      write_off_amount: writeOffAmount,
      reason,
      notes: notes || null
    });

    // Check if this completes a split (all children in terminal state)
    if (invoice.parent_invoice_id) {
      checkSplitReconciliation(invoice.parent_invoice_id).catch(err => {
        logger.error('Reconcile check failed', { component: 'reconcile', error: err.message });
      });
    }

    res.json(updated);
}));

// ============================================================
// PAYMENT HISTORY
// ============================================================

router.get('/:id/payments', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const invoiceId = req.params.id;

    // Verify invoice belongs to this builder
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .select('id, amount, paid_amount, payment_status')
      .eq('builder_id', builderId)
      .eq('id', invoiceId)
      .single();

    if (invError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const { data: payments, error } = await supabase
      .from('v2_invoice_payments')
      .select('*')
      .eq('invoice_id', invoiceId)
      .order('payment_date', { ascending: false });

    if (error) throw error;

    res.json({
      payments: payments || [],
      summary: {
        invoice_amount: parseFloat(invoice.amount || 0),
        total_paid: parseFloat(invoice.paid_amount || 0),
        remaining: parseFloat(invoice.amount || 0) - parseFloat(invoice.paid_amount || 0),
        payment_status: invoice.payment_status
      }
    });
}));

// ============================================================
// FULL INVOICE EDIT
// ============================================================

router.put('/:id/full', requirePermission('canApproveInvoices'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const invoiceId = req.params.id;
  const { invoice: updates, allocations, performed_by: performedBy = 'System' } = req.body;

  // Check if invoice exists
  const { data: existing, error: getError } = await supabase
    .from('v2_invoices')
    .select('*, allocations:v2_invoice_allocations(*)')
    .eq('builder_id', builderId)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (getError || !existing) {
    throw notFoundError('invoice', invoiceId);
  }

  // Check lock
  const lockStatus = await checkLock('invoice', invoiceId);
  if (lockStatus.isLocked && lockStatus.lock.lockedBy !== performedBy) {
    throw lockedError(lockStatus.lock.lockedBy, lockStatus.lock.expiresAt);
  }

  // Version check
  if (updates.expected_version && updates.expected_version !== existing.version) {
    throw versionConflictError(updates.expected_version, existing.version, existing);
  }

  // Validate full update
  const validation = validateInvoice(updates, false);
  if (!validation.valid) {
    throw validationError(validation.errors);
  }

  // Validate allocations if provided
  if (allocations && allocations.length > 0) {
    const allocValidation = validateAllocations(allocations, updates.amount || existing.amount);
    if (!allocValidation.valid) {
      throw new AppError('ALLOCATIONS_UNBALANCED', allocValidation.error);
    }
  }

  // Create undo snapshot
  await createUndoSnapshot('invoice', invoiceId, 'full_edit', { ...existing, allocations: existing.allocations }, performedBy);

  // Update invoice
  const updateFields = {
    invoice_number: updates.invoice_number,
    invoice_date: updates.invoice_date,
    due_date: updates.due_date,
    amount: updates.amount,
    job_id: updates.job_id,
    vendor_id: updates.vendor_id,
    po_id: updates.po_id,
    notes: updates.notes
  };

  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateFields)
    .eq('id', invoiceId)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to update invoice');
  }

  // Update allocations if provided
  if (allocations) {
    await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);
    if (allocations.length > 0) {
      const allocsToInsert = allocations.map(a => ({
        invoice_id: invoiceId,
        cost_code_id: a.cost_code_id,
        amount: a.amount,
        notes: a.notes,
        job_id: a.job_id || null,
        po_id: a.po_id || null,
        po_line_item_id: a.po_line_item_id || null,
        change_order_id: a.change_order_id || null,
        pending_co: a.pending_co || false
      }));
      await supabase.from('v2_invoice_allocations').insert(allocsToInsert);
    }
  }

  // Re-stamp PDF with updated information (run in background)
  restampInvoice(invoiceId).catch(err => {
    logger.error('Background re-stamp failed', { component: 'restamp', error: err.message });
  });

  await logActivity(invoiceId, 'full_edit', performedBy, { updates });
  broadcastInvoiceUpdate(updated, 'full_edit', performedBy);

  res.json({ success: true, invoice: updated });
}));

// ============================================================
// BATCH RESTAMP
// ============================================================

router.post('/batch-restamp', requirePermission('canApproveInvoices'), asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { status, force = false } = req.body;

  // Build query - get invoices that need stamping
  let query = supabase
    .from('v2_invoices')
    .select(`
      id, status, job_id, po_id, pdf_url, pdf_stamped_url, invoice_number, amount, review_flags,
      approved_at, approved_by,
      vendor:v2_vendors(id, name),
      job:v2_jobs(id, name),
      po:v2_purchase_orders(id, po_number, total_amount),
      allocations:v2_invoice_allocations(amount, cost_code_id)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (status) {
    query = query.eq('status', status);
  }

  if (!force) {
    // Only get invoices without stamps
    query = query.is('pdf_stamped_url', null);
  }

  const { data: invoices, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', 'Failed to fetch invoices');
  }

  const results = { stamped: 0, failed: 0, errors: [] };

  for (const invoice of invoices) {
    if (!invoice.pdf_url) {
      results.failed++;
      results.errors.push({ id: invoice.id, error: 'No PDF URL' });
      continue;
    }

    try {
      const storagePath = extractStoragePath(invoice.pdf_url);
      if (!storagePath) {
        results.failed++;
        results.errors.push({ id: invoice.id, error: 'Invalid PDF URL' });
        continue;
      }

      const pdfBuffer = await downloadPDF(storagePath);
      let stampedBuffer;

      // Choose stamp based on status
      if (invoice.status === 'needs_review') {
        stampedBuffer = await stampNeedsReview(pdfBuffer, {
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          vendorName: invoice.vendor?.name,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          flags: invoice.review_flags || []
        });
      } else if (invoice.status === 'ready_for_approval') {
        // Get cost codes for stamp
        let costCodesForStamp = [];
        if (invoice.allocations?.length > 0) {
          const costCodeIds = invoice.allocations.map(a => a.cost_code_id).filter(id => id);
          if (costCodeIds.length > 0) {
            const { data: costCodes } = await supabase
              .from('v2_cost_codes')
              .select('id, code, name')
              .in('id', costCodeIds);
            const codeMap = {};
            (costCodes || []).forEach(cc => { codeMap[cc.id] = cc; });
            costCodesForStamp = invoice.allocations.map(a => ({
              code: codeMap[a.cost_code_id]?.code || '',
              name: codeMap[a.cost_code_id]?.name || '',
              amount: parseFloat(a.amount) || 0
            }));
          }
        }
        stampedBuffer = await stampReadyForApproval(pdfBuffer, {
          date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          codedBy: 'System',
          jobName: invoice.job?.name,
          vendorName: invoice.vendor?.name,
          amount: invoice.amount,
          costCodes: costCodesForStamp
        });
      } else if (invoice.status === 'approved' || invoice.status === 'in_draw') {
        // Get cost codes for stamp
        let costCodesForStamp = [];
        if (invoice.allocations?.length > 0) {
          const costCodeIds = invoice.allocations.map(a => a.cost_code_id).filter(id => id);
          if (costCodeIds.length > 0) {
            const { data: costCodes } = await supabase
              .from('v2_cost_codes')
              .select('id, code, name')
              .in('id', costCodeIds);
            const codeMap = {};
            (costCodes || []).forEach(cc => { codeMap[cc.id] = cc; });
            costCodesForStamp = invoice.allocations.map(a => ({
              code: codeMap[a.cost_code_id]?.code || '',
              name: codeMap[a.cost_code_id]?.name || '',
              amount: parseFloat(a.amount) || 0
            }));
          }
        }

        // Get PO billing info if available
        let poTotal = null;
        let poBilledToDate = 0;
        if (invoice.po_id) {
          const { data: po } = await supabase
            .from('v2_purchase_orders')
            .select('total_amount')
            .eq('id', invoice.po_id)
            .single();
          if (po) {
            poTotal = po.total_amount;
            const { data: priorInvoices } = await supabase
              .from('v2_invoices')
              .select('amount')
              .eq('po_id', invoice.po_id)
              .neq('id', invoice.id)
              .in('status', ['approved', 'in_draw', 'paid']);
            if (priorInvoices) {
              poBilledToDate = priorInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
            }
          }
        }

        const stampStatus = invoice.status === 'in_draw' ? 'IN DRAW' : 'APPROVED';
        stampedBuffer = await stampApproval(pdfBuffer, {
          status: stampStatus,
          date: invoice.approved_at ? new Date(invoice.approved_at).toLocaleDateString() : new Date().toLocaleDateString(),
          approvedBy: invoice.approved_by || 'System',
          vendorName: invoice.vendor?.name,
          invoiceNumber: invoice.invoice_number,
          jobName: invoice.job?.name,
          costCodes: costCodesForStamp,
          amount: invoice.amount,
          poNumber: invoice.po?.po_number,
          poTotal: poTotal,
          poBilledToDate: poBilledToDate,
          isPartial: invoice.review_flags?.includes('partial_approval')
        });
      } else {
        // Skip other statuses for now
        continue;
      }

      // Upload using fixed path
      const uploadResult = await uploadStampedPDFById(stampedBuffer, invoice.id, invoice.job_id);

      // Update invoice
      await supabase
        .from('v2_invoices')
        .update({ pdf_stamped_url: uploadResult.url })
        .eq('id', invoice.id);

      results.stamped++;
      logger.debug('Batch stamp completed', { component: 'batch-stamp', invoiceId: invoice.id });

    } catch (err) {
      results.failed++;
      results.errors.push({ id: invoice.id, error: err.message });
      logger.error('Batch stamp failed', { component: 'batch-stamp', invoiceId: invoice.id, error: err.message });
    }
  }

  res.json({
    success: true,
    total: invoices.length,
    ...results
  });
}));

// ============================================================
// AI FIELD OVERRIDE
// ============================================================

router.patch('/:id/override', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const invoiceId = req.params.id;
  const { field, value, reason, performed_by: performedBy = 'System' } = req.body;

  // Validate field is overridable
  const overridableFields = ['job_id', 'vendor_id', 'amount', 'invoice_number', 'invoice_date', 'due_date'];
  if (!overridableFields.includes(field)) {
    throw new AppError('VALIDATION_FAILED', `Field '${field}' cannot be overridden`);
  }

  // Get current invoice
  const { data: invoice, error: getError } = await supabase
    .from('v2_invoices')
    .select('*, ai_confidence, ai_overrides, review_flags, needs_review')
    .eq('builder_id', builderId)
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (getError || !invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  // Build override record
  const overrideRecord = {
    ai_value: invoice[field],
    ai_confidence: invoice.ai_confidence?.[field.replace('_id', '')] || null,
    override_value: value,
    override_by: performedBy,
    override_at: new Date().toISOString(),
    override_reason: reason || null
  };

  // Merge with existing overrides
  const ai_overrides = { ...(invoice.ai_overrides || {}), [field]: overrideRecord };

  // Clear related review flags
  let review_flags = invoice.review_flags || [];
  const flagsToClear = {
    job_id: ['verify_job', 'select_job', 'no_job_match', 'missing_job_reference', 'low_job_confidence'],
    vendor_id: ['verify_vendor', 'select_vendor'],
    amount: ['amount_mismatch', 'verify_amount']
  };
  if (flagsToClear[field]) {
    review_flags = review_flags.filter(f => !flagsToClear[field].includes(f));
  }

  // Determine if still needs review
  const needs_review = review_flags.length > 0;

  // Update invoice
  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update({
      [field]: value,
      ai_overrides,
      review_flags,
      needs_review
    })
    .eq('id', invoiceId)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to apply override');
  }

  // Log activity
  await logActivity(invoiceId, 'ai_override', performedBy, {
    field,
    ai_value: overrideRecord.ai_value,
    ai_confidence: overrideRecord.ai_confidence,
    new_value: value,
    reason
  });

  broadcastInvoiceUpdate(updated, 'ai_override', performedBy);

  res.json({
    success: true,
    invoice: updated,
    override: overrideRecord,
    remainingFlags: review_flags
  });
}));

// ============================================================
// SYNC BILLED AMOUNTS
// ============================================================

// Sync invoice billed_amount from actual draw history
router.post('/:id/sync-billed', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const invoiceId = req.params.id;

  // Get invoice info
  const { data: invoice, error: invError } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, billed_amount')
    .eq('builder_id', builderId)
    .eq('id', invoiceId)
    .single();

  if (invError) throw invError;
  if (!invoice) {
    return res.status(404).json({ error: 'Invoice not found' });
  }

  // Get all draw_invoices for this invoice (these are the actual billings)
  const { data: drawInvoices, error: diError } = await supabase
    .from('v2_draw_invoices')
    .select(`
      draw_id,
      draw:v2_draws(id, status)
    `)
    .eq('invoice_id', invoiceId);

  if (diError) throw diError;

  // Get allocations that were part of each billing
  // For simplicity, we'll calculate from current allocations marked as billed
  // In a more complex system, we'd track historical allocation snapshots
  const { data: allocations, error: allocError } = await supabase
    .from('v2_invoice_allocations')
    .select('amount')
    .eq('invoice_id', invoiceId);

  if (allocError) throw allocError;

  // Calculate billed amount
  // If invoice is in a draw (or was), the billed amount = sum of allocations at time of draw
  // For now, use allocation sum if invoice has been in draws
  let calculatedBilled = 0;

  if (drawInvoices && drawInvoices.length > 0) {
    // Invoice has been in draws - calculate from allocations
    const allocationSum = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    calculatedBilled = allocationSum > 0 ? allocationSum : parseFloat(invoice.amount || 0);
  }

  // Update the invoice
  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update({ billed_amount: calculatedBilled })
    .eq('id', invoiceId)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (updateError) throw updateError;

  res.json({
    success: true,
    invoice_id: invoiceId,
    invoice_number: invoice.invoice_number,
    previous_billed: parseFloat(invoice.billed_amount || 0),
    new_billed: calculatedBilled,
    draw_count: drawInvoices?.length || 0
  });
}));

// Sync all invoices' billed_amount (bulk fix)
router.post('/sync-all-billed', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id } = req.query;

  // Get all invoices that have been in draws
  let invoiceQuery = supabase
    .from('v2_invoices')
    .select(`
      id, invoice_number, amount, billed_amount,
      draw_invoices:v2_draw_invoices(draw_id),
      allocations:v2_invoice_allocations(amount)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (job_id) {
    invoiceQuery = invoiceQuery.eq('job_id', job_id);
  }

  const { data: invoices, error } = await invoiceQuery;
  if (error) throw error;

  const updates = [];
  const results = [];

  for (const inv of invoices || []) {
    // Only process invoices that have been in draws
    if (!inv.draw_invoices || inv.draw_invoices.length === 0) continue;

    const allocationSum = (inv.allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const calculatedBilled = allocationSum > 0 ? allocationSum : parseFloat(inv.amount || 0);
    const previousBilled = parseFloat(inv.billed_amount || 0);

    if (Math.abs(calculatedBilled - previousBilled) > 0.01) {
      updates.push({
        id: inv.id,
        billed_amount: calculatedBilled
      });

      results.push({
        invoice_id: inv.id,
        invoice_number: inv.invoice_number,
        previous: previousBilled,
        calculated: calculatedBilled
      });
    }
  }

  // Batch update
  for (const update of updates) {
    await supabase
      .from('v2_invoices')
      .update({ billed_amount: update.billed_amount })
      .eq('id', update.id);
  }

  res.json({
    success: true,
    total_invoices: invoices?.length || 0,
    updated_count: updates.length,
    updates: results
  });
}));

module.exports = router;
