const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// PID file for safe server restarts (won't kill other node processes)
const PID_FILE = path.join(__dirname, '..', 'server.pid');
const { supabase, port } = require('../config');
const {
  uploadPDF,
  uploadStampedPDF,
  uploadStampedPDFById,
  downloadPDF,
  deleteByUrl,
  extractStoragePath,
  acquireStampLock,
  releaseStampLock
} = require('./storage');
const { stampApproval, stampInDraw, stampPaid, stampPartiallyPaid, stampPartiallyBilled, stampSplit, stampNeedsReview, stampReadyForApproval } = require('./pdf-stamper');
const { processInvoice, processDocument, processLienRelease, processMultiPageDocument, splitPDF, DOCUMENT_TYPES, extractInvoiceFromImage, extractInvoiceFromText } = require('./ai-processor');
const { convertDocument, isSupported, getSupportedExtensions, FILE_TYPES } = require('./document-converter');
const standards = require('./standards');
const aiLearning = require('./ai-learning');
const ExcelJS = require('exceljs');
const { PDFDocument } = require('pdf-lib');

// New modules for enhanced invoice system
const {
  validateInvoice,
  validateStatusTransition,
  validatePreTransition,
  validateAllocations,
  validateCostCodesExist,
  validatePOCapacity,
  STATUS_TRANSITIONS
} = require('./validation');

// Consolidated duplicate detection
const {
  checkDuplicate,
  checkForDuplicates,
  storePDFHash
} = require('./duplicate-check');

const {
  AppError,
  errorMiddleware,
  asyncHandler,
  validationError,
  transitionError,
  notFoundError,
  lockedError,
  versionConflictError
} = require('./errors');

const {
  acquireLock,
  releaseLock,
  releaseLockByEntity,
  checkLock,
  forceReleaseLock,
  cleanupExpiredLocks,
  getAllLocks
} = require('./locking');

const {
  createUndoSnapshot,
  getAvailableUndo,
  executeUndo,
  UNDO_WINDOW_SECONDS
} = require('./undo');

const {
  reconcileJob,
  reconcileAll,
  getExternalSyncStatus,
  recordExternalSync
} = require('./reconciliation');

const {
  sseHandler,
  broadcast,
  broadcastInvoiceUpdate,
  broadcastDrawUpdate,
  initializeRealtimeSubscriptions,
  getStats: getRealtimeStats
} = require('./realtime');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Disable caching for JS files during development
app.use('/js', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.use(express.static(path.join(__dirname, '../public')));

// ============================================================
// ROUTE MODULES (Refactored from monolithic index.js)
// ============================================================
const invoiceRoutes = require('./routes/invoices');
const drawRoutes = require('./routes/draws');
const changeOrderRoutes = require('./routes/change-orders');

// Mount modular routes
// These take precedence over the legacy inline routes below
app.use('/api/invoices', invoiceRoutes);
app.use('/api/draws', drawRoutes);
app.use('/api/change-orders', changeOrderRoutes);

// Multer for file uploads (memory storage)
// Accept all document types for AI processing
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    // Allow all supported file types
    const supportedMimes = [
      // PDFs
      'application/pdf',
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/tiff', 'image/heic', 'image/heif', 'image/bmp',
      // Word documents
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // Excel
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'
    ];

    if (supportedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      // Also check by extension as fallback
      const ext = path.extname(file.originalname).toLowerCase();
      const supportedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.tiff', '.tif', '.heic', '.heif', '.bmp', '.doc', '.docx', '.xls', '.xlsx', '.csv'];
      if (supportedExts.includes(ext)) {
        cb(null, true);
      } else {
        cb(new Error(`Unsupported file type. Supported: PDF, images (JPG, PNG, etc.), Word (.doc, .docx), Excel (.xls, .xlsx)`));
      }
    }
  }
});

// ============================================================
// ACTIVITY LOGGING HELPER
// ============================================================

async function logActivity(invoiceId, action, performedBy, details = {}) {
  await supabase.from('v2_invoice_activity').insert({
    invoice_id: invoiceId,
    action,
    performed_by: performedBy,
    details
  });
}

// ============================================================
// PO LINE ITEM HELPERS
// ============================================================

/**
 * Update PO line items' invoiced_amount when allocations change.
 */
async function updatePOLineItemsForAllocations(poId, allocations, add = true) {
  if (!poId || !allocations || allocations.length === 0) return;

  for (const alloc of allocations) {
    let poLineItem = null;

    // Priority 1: Direct po_line_item_id link
    if (alloc.po_line_item_id) {
      const { data } = await supabase
        .from('v2_po_line_items')
        .select('id, invoiced_amount')
        .eq('id', alloc.po_line_item_id)
        .eq('po_id', poId)
        .single();
      poLineItem = data;
    }

    // Priority 2: Fall back to cost code matching
    if (!poLineItem) {
      const costCodeId = alloc.cost_code_id || alloc.cost_code?.id;
      if (costCodeId) {
        const { data } = await supabase
          .from('v2_po_line_items')
          .select('id, invoiced_amount')
          .eq('po_id', poId)
          .eq('cost_code_id', costCodeId)
          .single();
        poLineItem = data;
      }
    }

    if (poLineItem) {
      const currentAmount = parseFloat(poLineItem.invoiced_amount) || 0;
      const allocAmount = parseFloat(alloc.amount) || 0;
      const newAmount = add
        ? currentAmount + allocAmount
        : Math.max(0, currentAmount - allocAmount);

      await supabase
        .from('v2_po_line_items')
        .update({ invoiced_amount: newAmount })
        .eq('id', poLineItem.id);
    }
  }
}

/**
 * Sync PO line items when allocations change on an invoice.
 */
async function syncPOLineItemsOnAllocationChange(invoice, oldAllocations, newAllocations, oldPoId = null) {
  const billableStatuses = ['approved', 'in_draw', 'paid'];
  if (!billableStatuses.includes(invoice.status)) return;

  const effectiveOldPoId = oldPoId || invoice.po_id;

  if (effectiveOldPoId && effectiveOldPoId !== invoice.po_id) {
    await updatePOLineItemsForAllocations(effectiveOldPoId, oldAllocations, false);
  }

  if (invoice.po_id) {
    if (effectiveOldPoId === invoice.po_id) {
      await updatePOLineItemsForAllocations(invoice.po_id, oldAllocations, false);
    }
    await updatePOLineItemsForAllocations(invoice.po_id, newAllocations, true);
  }
}

/**
 * Update PO invoiced amounts when allocations are linked to POs.
 * Groups allocations by PO and updates the PO's total invoiced amount.
 */
async function updatePOInvoicedAmounts(allocations) {
  // Group allocations by PO
  const byPO = {};
  for (const alloc of allocations) {
    if (!alloc.po_id) continue;
    if (!byPO[alloc.po_id]) byPO[alloc.po_id] = 0;
    byPO[alloc.po_id] += parseFloat(alloc.amount) || 0;
  }

  // Update each PO's line items
  for (const [poId, totalAmount] of Object.entries(byPO)) {
    // Also update PO line items if po_line_item_id is specified
    const poAllocations = allocations.filter(a => a.po_id === poId);
    await updatePOLineItemsForAllocations(poId, poAllocations, true);
  }
}

/**
 * Update CO invoiced amounts when allocations are linked to COs.
 * Groups allocations by CO and updates the CO's invoiced_amount.
 */
async function updateCOInvoicedAmounts(allocations) {
  // Group allocations by CO
  const byCO = {};
  for (const alloc of allocations) {
    if (!alloc.change_order_id) continue;
    if (!byCO[alloc.change_order_id]) byCO[alloc.change_order_id] = 0;
    byCO[alloc.change_order_id] += parseFloat(alloc.amount) || 0;
  }

  // Recalculate total invoiced for each CO from all allocations
  for (const coId of Object.keys(byCO)) {
    const { data: allCOAllocations } = await supabase
      .from('v2_invoice_allocations')
      .select('amount')
      .eq('change_order_id', coId);

    const totalInvoiced = (allCOAllocations || []).reduce(
      (sum, a) => sum + (parseFloat(a.amount) || 0), 0
    );

    await supabase
      .from('v2_job_change_orders')
      .update({ invoiced_amount: totalInvoiced })
      .eq('id', coId);
  }
}

/**
 * UNIFIED STAMP INVOICE FUNCTION
 *
 * This is the single source of truth for all PDF stamping.
 * - Always stamps from ORIGINAL pdf_url (never accumulates)
 * - Uses fixed path: {job_id}/{invoice_id}_stamped.pdf
 * - Includes locking to prevent concurrent stamp operations
 * - Updates pdf_stamped_url in database
 *
 * @param {string} invoiceId - Invoice ID to stamp
 * @param {object} options - Optional overrides
 * @param {boolean} options.force - Force stamp even if locked
 * @returns {Promise<string|null>} - Stamped URL or null
 */
async function stampInvoice(invoiceId, options = {}) {
  const { force = false } = options;

  // Acquire lock to prevent concurrent stamping
  if (!force && !acquireStampLock(invoiceId)) {
    console.log('[STAMP] Skipping - already being stamped:', invoiceId);
    return null;
  }

  try {
    // Fetch full invoice data
    const { data: invoice, error: fetchError } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, description, total_amount),
        allocations:v2_invoice_allocations(
          amount,
          cost_code_id,
          po_id,
          po_line_item_id,
          cost_code:v2_cost_codes(code, name)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      console.error('[STAMP] Invoice not found:', invoiceId);
      return null;
    }

    if (!invoice.pdf_url) {
      console.log('[STAMP] No PDF to stamp:', invoiceId);
      return null;
    }

    // Extract storage path from ORIGINAL pdf_url (never use pdf_stamped_url)
    const storagePath = extractStoragePath(invoice.pdf_url);
    if (!storagePath) {
      console.error('[STAMP] Could not extract path from pdf_url:', invoice.pdf_url);
      return null;
    }

    // Download ORIGINAL PDF
    let pdfBuffer;
    try {
      pdfBuffer = await downloadPDF(storagePath);
    } catch (downloadErr) {
      console.error('[STAMP] Failed to download original PDF:', downloadErr.message);
      return null;
    }

    const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    // Get cost codes formatted for stamp
    const costCodesForStamp = (invoice.allocations || []).map(a => ({
      code: a.cost_code?.code || '',
      name: a.cost_code?.name || '',
      amount: parseFloat(a.amount) || 0
    })).filter(cc => cc.code);

    let stampedBuffer = null;

    // Apply stamp based on current status
    switch (invoice.status) {
      case 'needs_review':
        stampedBuffer = await stampNeedsReview(pdfBuffer, {
          date: dateStr,
          vendorName: invoice.vendor?.name,
          invoiceNumber: invoice.invoice_number,
          amount: invoice.amount,
          flags: invoice.review_flags || []
        });
        break;

      case 'ready_for_approval':
        stampedBuffer = await stampReadyForApproval(pdfBuffer, {
          date: dateStr,
          codedBy: invoice.coded_by,
          jobName: invoice.job?.name,
          vendorName: invoice.vendor?.name,
          amount: invoice.amount,
          costCodes: costCodesForStamp
        });
        break;

      case 'approved':
      case 'in_draw':
      case 'paid': {
        // Get PO billing info
        let poTotal = null;
        let poBilledToDate = 0;
        let poLinkedAmount = null; // Amount of THIS invoice allocated to the PO

        // Helper to check if cost code is a CO code (ends with 'C')
        const isCOCostCode = (code) => code && /C$/i.test(code.trim());

        if (invoice.po?.id) {
          poTotal = parseFloat(invoice.po.total_amount);

          // Calculate how much of THIS invoice is linked to the PO
          // CO cost code allocations NEVER count toward PO billing (they're CO work)
          poLinkedAmount = (invoice.allocations || []).reduce((sum, alloc) => {
            const costCode = alloc.cost_code?.code;
            const isCO = isCOCostCode(costCode);

            // CO allocations never count toward PO billing, regardless of po_id
            if (isCO) {
              return sum;
            }
            // Non-CO allocations count if explicitly PO-linked OR invoice is PO-linked
            if (alloc.po_id === invoice.po.id || alloc.po_line_item_id || true) {
              return sum + parseFloat(alloc.amount || 0);
            }
            return sum;
          }, 0);

          // Get prior invoices billed against this PO (need to sum their PO-linked allocations too)
          const { data: priorInvoices } = await supabase
            .from('v2_invoices')
            .select(`
              id,
              amount,
              allocations:v2_invoice_allocations(
                amount,
                po_id,
                po_line_item_id,
                cost_code:v2_cost_codes(code)
              )
            `)
            .eq('po_id', invoice.po.id)
            .neq('id', invoiceId)
            .in('status', ['approved', 'in_draw', 'paid']);

          if (priorInvoices) {
            // Sum the PO-linked allocations from prior invoices (exclude CO allocations)
            poBilledToDate = priorInvoices.reduce((sum, inv) => {
              if (inv.allocations && inv.allocations.length > 0) {
                // Count only non-CO allocations (CO work doesn't bill against PO)
                return sum + inv.allocations.reduce((s, a) => {
                  const costCode = a.cost_code?.code;
                  const isCO = isCOCostCode(costCode);
                  // CO allocations never count toward PO billing
                  if (isCO) {
                    return s;
                  }
                  return s + parseFloat(a.amount || 0);
                }, 0);
              }
              // Fall back to full invoice amount if no allocations (legacy data)
              return sum + parseFloat(inv.amount || 0);
            }, 0);
          }
        }

        // Check if this is a partial approval
        const isPartialApproval = invoice.review_flags?.includes('partial_approval');

        stampedBuffer = await stampApproval(pdfBuffer, {
          status: 'APPROVED',
          date: invoice.approved_at ? new Date(invoice.approved_at).toLocaleDateString() : dateStr,
          approvedBy: invoice.approved_by,
          vendorName: invoice.vendor?.name,
          invoiceNumber: invoice.invoice_number,
          jobName: invoice.job?.name,
          costCodes: costCodesForStamp,
          amount: parseFloat(invoice.amount),
          poNumber: invoice.po?.po_number,
          poDescription: invoice.po?.description,
          poTotal,
          poBilledToDate,
          poLinkedAmount,
          isPartial: isPartialApproval
        });

        // Add IN DRAW stamp if applicable
        if (invoice.status === 'in_draw') {
          const { data: drawInvoice } = await supabase
            .from('v2_draw_invoices')
            .select('draw:v2_draws(draw_number)')
            .eq('invoice_id', invoiceId)
            .single();

          if (drawInvoice?.draw?.draw_number) {
            stampedBuffer = await stampInDraw(stampedBuffer, drawInvoice.draw.draw_number);
          }
        }

        // Add PAID stamp if applicable
        if (invoice.status === 'paid' && invoice.paid_at) {
          const paidDate = new Date(invoice.paid_at).toLocaleDateString();
          stampedBuffer = await stampPaid(stampedBuffer, paidDate);
        }
        break;
      }

      default:
        // No stamp for other statuses (received, denied, split, etc.)
        console.log('[STAMP] No stamp for status:', invoice.status);
        return null;
    }

    if (!stampedBuffer) {
      return null;
    }

    // Upload to FIXED path: {job_id}/{invoice_id}_stamped.pdf
    const uploadResult = await uploadStampedPDFById(
      stampedBuffer,
      invoiceId,
      invoice.job_id
    );

    if (uploadResult?.url) {
      // Update invoice with new stamped URL
      await supabase
        .from('v2_invoices')
        .update({ pdf_stamped_url: uploadResult.url })
        .eq('id', invoiceId);

      console.log('[STAMP] Success:', invoiceId, '->', uploadResult.url);
      return uploadResult.url;
    }

    return null;
  } catch (err) {
    console.error('[STAMP] Error stamping invoice:', invoiceId, err.message);
    return null;
  } finally {
    // Always release lock
    releaseStampLock(invoiceId);
  }
}

// Alias for backwards compatibility
const restampInvoice = stampInvoice;

/**
 * Check if all children of a split parent have reached terminal states
 * If so, mark the parent as 'reconciled'
 *
 * Terminal states: paid, denied, deleted (via deleted_at)
 *
 * @param {string} parentInvoiceId - Parent invoice ID to check
 */
async function checkSplitReconciliation(parentInvoiceId) {
  if (!parentInvoiceId) return;

  try {
    // Get parent to verify it's a split parent
    const { data: parent } = await supabase
      .from('v2_invoices')
      .select('id, is_split_parent, status')
      .eq('id', parentInvoiceId)
      .single();

    if (!parent || !parent.is_split_parent) return;
    if (parent.status === 'reconciled') return; // Already reconciled

    // Get all children (including soft-deleted ones)
    const { data: children } = await supabase
      .from('v2_invoices')
      .select('id, status, deleted_at')
      .eq('parent_invoice_id', parentInvoiceId);

    if (!children || children.length === 0) return;

    // Check if all children are in terminal states
    const terminalStatuses = ['paid', 'denied'];
    const allTerminal = children.every(child =>
      child.deleted_at !== null || terminalStatuses.includes(child.status)
    );

    if (allTerminal) {
      // Calculate summary stats
      const paidCount = children.filter(c => c.status === 'paid' && !c.deleted_at).length;
      const deniedCount = children.filter(c => c.status === 'denied' && !c.deleted_at).length;
      const deletedCount = children.filter(c => c.deleted_at !== null).length;

      await supabase
        .from('v2_invoices')
        .update({
          status: 'reconciled',
          notes: `Split reconciled on ${new Date().toLocaleDateString()}\nPaid: ${paidCount}, Denied: ${deniedCount}, Deleted: ${deletedCount}`
        })
        .eq('id', parentInvoiceId);

      console.log('[SPLIT] Reconciled parent invoice:', parentInvoiceId, { paidCount, deniedCount, deletedCount });
    }
  } catch (err) {
    console.error('[SPLIT] Reconciliation check failed:', parentInvoiceId, err.message);
  }
}

// ============================================================
// // OWNER DASHBOARD STATS (All Jobs)
// ============================================================

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Get all invoices across all jobs
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('status, amount, job_id');

    const stats = {
      needs_review: { count: 0, amount: 0 },
      ready_for_approval: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      in_draw: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 }
    };

    if (invoices) {
      invoices.forEach(inv => {
        if (stats[inv.status]) {
          stats[inv.status].count++;
          stats[inv.status].amount += parseFloat(inv.amount) || 0;
        }
      });
    }

    // Get all draws
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('status, total_amount');

    const drawStats = {
      draft: { count: 0, amount: 0 },
      submitted: { count: 0, amount: 0 },
      funded: { count: 0, amount: 0 }
    };

    if (draws) {
      draws.forEach(d => {
        // Group partially_funded and overfunded with funded for stats
        const statCategory = ['partially_funded', 'overfunded'].includes(d.status) ? 'funded' : d.status;
        if (drawStats[statCategory]) {
          drawStats[statCategory].count++;
          drawStats[statCategory].amount += parseFloat(d.total_amount) || 0;
        }
      });
    }

    // Get jobs summary
    const { data: jobs } = await supabase
      .from('v2_jobs')
      .select('id, name, contract_amount, client_name, status');

    // Calculate billed per job using already-fetched invoices (avoid N+1 query)
    const billedByJob = {};
    if (invoices) {
      invoices.forEach(inv => {
        if (inv.job_id && ['approved', 'in_draw', 'paid'].includes(inv.status)) {
          billedByJob[inv.job_id] = (billedByJob[inv.job_id] || 0) + parseFloat(inv.amount || 0);
        }
      });
    }

    const jobSummaries = (jobs || []).map(job => {
      const billed = billedByJob[job.id] || 0;
      return {
        ...job,
        total_billed: billed,
        remaining: (parseFloat(job.contract_amount) || 0) - billed
      };
    });

    // Calculate total contract value
    const total_contract = (jobs || []).reduce((sum, job) => sum + (parseFloat(job.contract_amount) || 0), 0);

    res.json({
      invoices: stats,
      draws: drawStats,
      jobs: jobSummaries,
      total_contract,
      alerts: {
        needsReview: stats.needs_review.count,
        readyForApproval: stats.ready_for_approval.count,
        inDraws: drawStats.submitted.count
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// JOBS API
// ============================================================

app.get('/api/jobs', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_jobs')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_jobs')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a job (admin cleanup)
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get related IDs first
    const { data: draws } = await supabase.from('v2_draws').select('id').eq('job_id', jobId);
    const { data: invoices } = await supabase.from('v2_invoices').select('id').eq('job_id', jobId);
    const { data: pos } = await supabase.from('v2_purchase_orders').select('id').eq('job_id', jobId);

    const drawIds = draws?.map(d => d.id) || [];
    const invoiceIds = invoices?.map(i => i.id) || [];
    const poIds = pos?.map(p => p.id) || [];

    // Delete related data
    await supabase.from('v2_budget_lines').delete().eq('job_id', jobId);

    if (drawIds.length > 0) {
      await supabase.from('v2_draw_allocations').delete().in('draw_id', drawIds);
      await supabase.from('v2_draw_invoices').delete().in('draw_id', drawIds);
      await supabase.from('v2_draw_activity').delete().in('draw_id', drawIds);
      await supabase.from('v2_draws').delete().eq('job_id', jobId);
    }

    if (invoiceIds.length > 0) {
      await supabase.from('v2_invoice_allocations').delete().in('invoice_id', invoiceIds);
      await supabase.from('v2_invoice_activity').delete().in('invoice_id', invoiceIds);
      await supabase.from('v2_invoices').delete().eq('job_id', jobId);
    }

    if (poIds.length > 0) {
      await supabase.from('v2_po_line_items').delete().in('po_id', poIds);
      await supabase.from('v2_po_activity').delete().in('po_id', poIds);
      await supabase.from('v2_purchase_orders').delete().eq('job_id', jobId);
    }

    // Delete the job
    const { error } = await supabase
      .from('v2_jobs')
      .delete()
      .eq('id', jobId);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting job:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get purchase orders for a specific job
app.get('/api/jobs/:id/purchase-orders', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_purchase_orders')
      .select(`
        id,
        po_number,
        description,
        total_amount,
        status,
        vendor:v2_vendors(id, name)
      `)
      .eq('job_id', req.params.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Flatten vendor name for easier frontend use
    const result = (data || []).map(po => ({
      ...po,
      vendor_name: po.vendor?.name || null
    }));
    
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// VENDORS API
// ============================================================

app.get('/api/vendors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_vendors')
      .select('*')
      .order('name');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vendors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_vendors')
      .insert(req.body)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Find potential duplicate vendors (MUST be before :id routes)
app.get('/api/vendors/duplicates', asyncHandler(async (req, res) => {
  const threshold = parseInt(req.query.threshold) || 75;
  const flagNew = req.query.flag !== 'false'; // Default to flagging new duplicates

  // Use the enhanced function from ai-learning
  const duplicates = await aiLearning.findPotentialDuplicateVendors(threshold);

  // Also get any previously flagged duplicates from the database
  const { data: flaggedDuplicates } = await supabase
    .from('v2_vendor_duplicates')
    .select(`
      *,
      vendor1:vendor_id_1(id, name),
      vendor2:vendor_id_2(id, name)
    `)
    .eq('status', 'pending');

  // Flag new duplicates in database for tracking
  if (flagNew) {
    for (const dup of duplicates) {
      await aiLearning.flagVendorDuplicate(dup.vendor1.id, dup.vendor2.id, dup.similarity);
    }
  }

  res.json({
    duplicates,
    flagged: flaggedDuplicates || [],
    threshold,
    count: duplicates.length
  });
}));

// Merge two vendors (MUST be before :id routes)
app.post('/api/vendors/merge', asyncHandler(async (req, res) => {
  const { keep_vendor_id, remove_vendor_id, performed_by = 'System' } = req.body;

  if (!keep_vendor_id || !remove_vendor_id) {
    return res.status(400).json({ error: 'keep_vendor_id and remove_vendor_id are required' });
  }

  if (keep_vendor_id === remove_vendor_id) {
    return res.status(400).json({ error: 'Cannot merge vendor with itself' });
  }

  // Get both vendors for logging
  const { data: keepVendor } = await supabase
    .from('v2_vendors')
    .select('name')
    .eq('id', keep_vendor_id)
    .single();

  const { data: removeVendor } = await supabase
    .from('v2_vendors')
    .select('name')
    .eq('id', remove_vendor_id)
    .single();

  let updatedCount = 0;

  // Transfer invoices
  const { data: invoiceUpdate } = await supabase
    .from('v2_invoices')
    .update({ vendor_id: keep_vendor_id })
    .eq('vendor_id', remove_vendor_id)
    .select('id');
  updatedCount += (invoiceUpdate?.length || 0);

  // Transfer POs
  const { data: poUpdate } = await supabase
    .from('v2_purchase_orders')
    .update({ vendor_id: keep_vendor_id })
    .eq('vendor_id', remove_vendor_id)
    .select('id');
  updatedCount += (poUpdate?.length || 0);

  // Transfer lien releases
  const { data: lienUpdate } = await supabase
    .from('v2_lien_releases')
    .update({ vendor_id: keep_vendor_id })
    .eq('vendor_id', remove_vendor_id)
    .select('id');
  updatedCount += (lienUpdate?.length || 0);

  // Transfer AI learning mappings
  await supabase
    .from('v2_ai_learning')
    .update({ matched_id: keep_vendor_id, matched_name: keepVendor?.name })
    .eq('entity_type', 'vendor')
    .eq('matched_id', remove_vendor_id);

  // Transfer vendor aliases to kept vendor
  await supabase
    .from('v2_vendor_aliases')
    .update({ vendor_id: keep_vendor_id })
    .eq('vendor_id', remove_vendor_id);

  // Record the removed vendor's name as an alias for the kept vendor
  if (removeVendor?.name) {
    await aiLearning.recordVendorAlias(keep_vendor_id, removeVendor.name, 'merge');
  }

  // Update v2_vendor_duplicates to mark as merged
  const [id1, id2] = [keep_vendor_id, remove_vendor_id].sort();
  await supabase
    .from('v2_vendor_duplicates')
    .update({
      status: 'merged',
      merged_into: keep_vendor_id,
      reviewed_by: performed_by,
      reviewed_at: new Date().toISOString()
    })
    .eq('vendor_id_1', id1)
    .eq('vendor_id_2', id2);

  // Soft delete the removed vendor
  await supabase
    .from('v2_vendors')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', remove_vendor_id);

  console.log(`[Vendor Merge] "${removeVendor?.name}" merged into "${keepVendor?.name}" - ${updatedCount} records updated`);

  res.json({
    success: true,
    updated_count: updatedCount,
    keep_vendor_id,
    keep_vendor_name: keepVendor?.name,
    removed_vendor_id: remove_vendor_id,
    removed_vendor_name: removeVendor?.name
  });
}));

// Dismiss a flagged vendor duplicate (mark as not a duplicate)
app.post('/api/vendors/duplicates/dismiss', asyncHandler(async (req, res) => {
  const { vendor_id_1, vendor_id_2, performed_by = 'System' } = req.body;

  if (!vendor_id_1 || !vendor_id_2) {
    return res.status(400).json({ error: 'vendor_id_1 and vendor_id_2 are required' });
  }

  const [id1, id2] = [vendor_id_1, vendor_id_2].sort();

  const { data, error } = await supabase
    .from('v2_vendor_duplicates')
    .update({
      status: 'dismissed',
      reviewed_by: performed_by,
      reviewed_at: new Date().toISOString()
    })
    .eq('vendor_id_1', id1)
    .eq('vendor_id_2', id2)
    .select()
    .single();

  if (error) {
    return res.status(404).json({ error: 'Duplicate flag not found' });
  }

  res.json({ success: true, dismissed: data });
}));

// Get AI learning statistics
app.get('/api/ai/stats', asyncHandler(async (req, res) => {
  const stats = await aiLearning.getLearningStats();

  // Get feedback counts
  const { count: feedbackCount } = await supabase
    .from('v2_ai_feedback')
    .select('*', { count: 'exact', head: true });

  const { count: appliedCount } = await supabase
    .from('v2_ai_feedback')
    .select('*', { count: 'exact', head: true })
    .eq('applied_to_learning', true);

  // Get alias counts
  const { count: aliasCount } = await supabase
    .from('v2_vendor_aliases')
    .select('*', { count: 'exact', head: true });

  // Get duplicate counts
  const { count: pendingDuplicates } = await supabase
    .from('v2_vendor_duplicates')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  res.json({
    learning: stats,
    feedback: {
      total: feedbackCount || 0,
      applied: appliedCount || 0
    },
    vendor_aliases: aliasCount || 0,
    pending_duplicates: pendingDuplicates || 0
  });
}));

// Update vendor
app.patch('/api/vendors/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_vendors')
    .update(req.body)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

// Upload vendor document (COI, W-9, License)
app.post('/api/vendors/:id/documents', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { document_type, file_data, file_name } = req.body;

  if (!document_type || !file_data) {
    return res.status(400).json({ error: 'document_type and file_data are required' });
  }

  const validTypes = ['coi', 'w9', 'license'];
  if (!validTypes.includes(document_type)) {
    return res.status(400).json({ error: 'Invalid document_type. Must be: coi, w9, or license' });
  }

  // Decode base64 file
  const buffer = Buffer.from(file_data.split(',')[1] || file_data, 'base64');
  const fileName = `vendor-docs/${id}/${document_type}_${Date.now()}.pdf`;

  // Upload to Supabase storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('documents')
    .upload(fileName, buffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    console.error('Upload error:', uploadError);
    throw new Error('Failed to upload document');
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName);

  const publicUrl = urlData.publicUrl;

  // Update vendor record with document URL
  const updateField = {
    coi: { coi_url: publicUrl, coi_on_file: true },
    w9: { w9_url: publicUrl, w9_on_file: true, w9_received_date: new Date().toISOString().split('T')[0] },
    license: { license_url: publicUrl }
  }[document_type];

  const { data: vendor, error: updateError } = await supabase
    .from('v2_vendors')
    .update(updateField)
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw updateError;

  res.json({ success: true, url: publicUrl, vendor });
}));

// Get vendors with expiring documents
app.get('/api/vendors/expiring', asyncHandler(async (req, res) => {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { data: vendors, error } = await supabase
    .from('v2_vendors')
    .select('id, name, trade, gl_expiration, wc_expiration, auto_expiration, license_expiration')
    .is('deleted_at', null)
    .or(`gl_expiration.lte.${thirtyDaysFromNow},wc_expiration.lte.${thirtyDaysFromNow},license_expiration.lte.${thirtyDaysFromNow}`)
    .order('gl_expiration', { ascending: true });

  if (error) throw error;

  // Categorize by urgency
  const today = new Date().toISOString().split('T')[0];
  const result = (vendors || []).map(v => {
    const issues = [];
    if (v.gl_expiration && v.gl_expiration <= today) issues.push({ type: 'GL', status: 'expired', date: v.gl_expiration });
    else if (v.gl_expiration && v.gl_expiration <= thirtyDaysFromNow) issues.push({ type: 'GL', status: 'expiring', date: v.gl_expiration });

    if (v.wc_expiration && v.wc_expiration <= today) issues.push({ type: 'WC', status: 'expired', date: v.wc_expiration });
    else if (v.wc_expiration && v.wc_expiration <= thirtyDaysFromNow) issues.push({ type: 'WC', status: 'expiring', date: v.wc_expiration });

    if (v.license_expiration && v.license_expiration <= today) issues.push({ type: 'License', status: 'expired', date: v.license_expiration });
    else if (v.license_expiration && v.license_expiration <= thirtyDaysFromNow) issues.push({ type: 'License', status: 'expiring', date: v.license_expiration });

    return { ...v, issues };
  }).filter(v => v.issues.length > 0);

  res.json(result);
}));

// Get vendor details with stats
app.get('/api/vendors/:id/details', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get vendor
  const { data: vendor, error: vendorError } = await supabase
    .from('v2_vendors')
    .select('*')
    .eq('id', id)
    .single();

  if (vendorError || !vendor) {
    return res.status(404).json({ error: 'Vendor not found' });
  }

  // Get invoice stats
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('id, amount, invoice_number, job:v2_jobs(id, name)')
    .eq('vendor_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(10);

  // Get PO count
  const { count: poCount } = await supabase
    .from('v2_purchase_orders')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', id)
    .is('deleted_at', null);

  // Get lien release count
  const { count: lienCount } = await supabase
    .from('v2_lien_releases')
    .select('id', { count: 'exact', head: true })
    .eq('vendor_id', id)
    .is('deleted_at', null);

  // Get unique jobs
  const { data: jobIds } = await supabase
    .from('v2_invoices')
    .select('job_id')
    .eq('vendor_id', id)
    .is('deleted_at', null)
    .not('job_id', 'is', null);

  const uniqueJobIds = [...new Set((jobIds || []).map(j => j.job_id))];
  let jobs = [];
  if (uniqueJobIds.length > 0) {
    const { data: jobData } = await supabase
      .from('v2_jobs')
      .select('id, name')
      .in('id', uniqueJobIds);
    jobs = jobData || [];
  }

  // Calculate totals
  const totalInvoiced = (invoices || []).reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

  res.json({
    ...vendor,
    stats: {
      invoice_count: invoices?.length || 0,
      total_invoiced: totalInvoiced,
      po_count: poCount || 0,
      lien_release_count: lienCount || 0
    },
    recent_invoices: invoices || [],
    jobs
  });
}));

// ============================================================
// COST CODES API
// ============================================================

app.get('/api/cost-codes', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_cost_codes')
      .select('*')
      .order('code');

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PURCHASE ORDERS API
// ============================================================

app.get('/api/purchase-orders', async (req, res) => {
  try {
    const { job_id, vendor_id, status } = req.query;

    let query = supabase
      .from('v2_purchase_orders')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        job_change_order:v2_job_change_orders(id, change_order_number, title, amount, status),
        line_items:v2_po_line_items(
          id, description, amount, invoiced_amount, cost_type, title, change_order_id,
          cost_code:v2_cost_codes(id, code, name),
          change_order:v2_job_change_orders(id, change_order_number, title)
        )
      `)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (job_id) query = query.eq('job_id', job_id);
    if (vendor_id) query = query.eq('vendor_id', vendor_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get PO statistics (must be before /:id route)
app.get('/api/purchase-orders/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_purchase_orders')
    .select('id, total_amount, status, status_detail, approval_status')
    .is('deleted_at', null);

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: pos, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get billed amounts
  const { data: invoices } = await supabase
    .from('v2_invoices')
    .select('po_id, amount, status')
    .in('po_id', pos.map(p => p.id))
    .is('deleted_at', null);

  const billedByPO = {};
  if (invoices) {
    for (const inv of invoices) {
      if (['approved', 'in_draw', 'paid'].includes(inv.status)) {
        billedByPO[inv.po_id] = (billedByPO[inv.po_id] || 0) + parseFloat(inv.amount || 0);
      }
    }
  }

  const stats = {
    total_count: pos.length,
    total_value: pos.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0),
    total_billed: Object.values(billedByPO).reduce((sum, v) => sum + v, 0),
    by_status: {
      pending: { count: 0, value: 0 },
      approved: { count: 0, value: 0 },
      active: { count: 0, value: 0 },
      closed: { count: 0, value: 0 },
      cancelled: { count: 0, value: 0 }
    },
    pending_approval: pos.filter(p => p.approval_status === 'pending').length,
    over_budget: 0
  };

  for (const po of pos) {
    const status = po.status_detail || 'pending';
    if (stats.by_status[status]) {
      stats.by_status[status].count++;
      stats.by_status[status].value += parseFloat(po.total_amount || 0);
    }

    // Check if over budget
    const billed = billedByPO[po.id] || 0;
    if (billed > parseFloat(po.total_amount || 0)) {
      stats.over_budget++;
    }
  }

  stats.total_remaining = stats.total_value - stats.total_billed;

  res.json(stats);
}));

app.get('/api/purchase-orders/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_purchase_orders')
      .select(`
        *,
        vendor:v2_vendors(id, name, email, phone),
        job:v2_jobs(id, name, address),
        line_items:v2_po_line_items(
          id, description, amount, invoiced_amount, cost_type, title, change_order_id,
          cost_code:v2_cost_codes(id, code, name, category),
          change_order:v2_job_change_orders(id, change_order_number, title, status)
        )
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/purchase-orders', async (req, res) => {
  try {
    const { line_items, ...poData } = req.body;

    // Set status to draft by default
    if (!poData.status_detail) {
      poData.status_detail = 'draft';
    }

    // Validate CO linkage if provided
    if (poData.job_change_order_id) {
      const { data: co, error: coError } = await supabase
        .from('v2_job_change_orders')
        .select('id, job_id, status, change_order_number, title')
        .eq('id', poData.job_change_order_id)
        .single();

      if (coError || !co) {
        return res.status(400).json({ error: 'Invalid change order' });
      }

      if (poData.job_id && co.job_id !== poData.job_id) {
        return res.status(400).json({ error: 'Change order must be for the same job as the PO' });
      }

      // If job not set on PO, inherit from CO
      if (!poData.job_id) {
        poData.job_id = co.job_id;
      }
    }

    // Auto-generate PO number if not provided
    if (!poData.po_number) {
      if (poData.job_id) {
        // Get job name for PO number format
        const { data: job } = await supabase
          .from('v2_jobs')
          .select('name')
          .eq('id', poData.job_id)
          .single();

        // Count existing POs for this job to get next sequence
        const { count } = await supabase
          .from('v2_purchase_orders')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', poData.job_id);

        const sequence = (count || 0) + 1;
        poData.po_number = standards.generatePONumber(job?.name || '', sequence);
      } else {
        // Draft without job - generate temporary number
        const timestamp = Date.now().toString(36).toUpperCase();
        poData.po_number = `DRAFT-${timestamp}`;
      }
    }

    // Create PO
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .insert(poData)
      .select()
      .single();

    if (poError) throw poError;

    // Create line items (if any)
    if (line_items && line_items.length > 0) {
      const { error: itemsError } = await supabase
        .from('v2_po_line_items')
        .insert(line_items.map(item => ({ ...item, po_id: po.id })));

      if (itemsError) throw itemsError;
    }

    res.json(po);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update purchase order
app.patch('/api/purchase-orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { line_items, ...updates } = req.body;

  // Get existing PO
  const { data: existing, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*, line_items:v2_po_line_items(*)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !existing) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  // Update PO fields
  const { data: updated, error: updateError } = await supabase
    .from('v2_purchase_orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Update line items if provided
  if (line_items && Array.isArray(line_items)) {
    // Validate all line items have cost codes
    if (line_items.length === 0) {
      throw new AppError('VALIDATION_ERROR', 'At least one line item is required');
    }

    const missingCostCodes = line_items.filter(item => !item.cost_code_id);
    if (missingCostCodes.length > 0) {
      throw new AppError('VALIDATION_ERROR', `All line items must have a cost code assigned (${missingCostCodes.length} missing)`);
    }

    // Delete existing line items
    await supabase
      .from('v2_po_line_items')
      .delete()
      .eq('po_id', id);

    // Insert new line items
    const { error: itemsError } = await supabase
      .from('v2_po_line_items')
      .insert(line_items.map(item => ({ ...item, po_id: id })));

    if (itemsError) throw new AppError('DATABASE_ERROR', itemsError.message);
  }

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'updated',
      performed_by: updates.updated_by || 'system',
      details: { changes: updates }
    });

  // Broadcast update via SSE
  broadcastInvoiceUpdate(id, 'po_updated', { po: updated });

  res.json(updated);
}));

// Delete (soft delete) purchase order
app.delete('/api/purchase-orders/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;

  // Check if PO has linked invoices
  const { data: linkedInvoices } = await supabase
    .from('v2_invoices')
    .select('id')
    .eq('po_id', id)
    .is('deleted_at', null);

  if (linkedInvoices && linkedInvoices.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Cannot delete PO with linked invoices');
  }

  // Soft delete
  const { data, error } = await supabase
    .from('v2_purchase_orders')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'deleted',
      performed_by: deleted_by || 'system',
      details: {}
    });

  res.json({ success: true, message: 'Purchase order deleted' });
}));

// Send PO to vendor (draft → sent, commits to budget)
app.post('/api/purchase-orders/:id/send', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sent_by } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*, line_items:v2_po_line_items(id, cost_code_id, amount)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  // Only draft POs can be sent
  const draftStatuses = [null, undefined, 'pending', 'draft'];
  if (!draftStatuses.includes(po.status_detail)) {
    throw new AppError('VALIDATION_FAILED', 'Only draft POs can be sent to vendor');
  }

  // Validate required fields before sending
  const errors = [];
  if (!po.job_id) errors.push('Job is required');
  if (!po.vendor_id) errors.push('Vendor is required');
  if (!po.line_items || po.line_items.length === 0) {
    errors.push('At least one line item is required');
  } else {
    const itemsWithAmounts = po.line_items.filter(item => parseFloat(item.amount) > 0);
    if (itemsWithAmounts.length === 0) {
      errors.push('At least one line item must have an amount');
    }
    const missingCostCodes = itemsWithAmounts.filter(item => !item.cost_code_id);
    if (missingCostCodes.length > 0) {
      errors.push('All line items with amounts must have a cost code');
    }
  }
  if (errors.length > 0) {
    throw new AppError('VALIDATION_FAILED', errors.join('. '));
  }

  // Update PO status to sent
  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status_detail: 'sent',
      status: 'open'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'sent',
      performed_by: sent_by || 'system',
      details: { total_amount: po.total_amount }
    });

  // Broadcast update
  broadcast({ type: 'po_update', data: { id, action: 'sent' } });

  res.json({ success: true, po: updated });
}));

// Submit PO for approval (legacy - redirects to send)
app.post('/api/purchase-orders/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { submitted_by } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (po.status_detail !== 'pending') {
    throw new AppError('VALIDATION_FAILED', 'Only pending POs can be submitted for approval');
  }

  // Check approval thresholds
  const { data: thresholds } = await supabase
    .from('v2_approval_thresholds')
    .select('*')
    .eq('entity_type', 'po')
    .order('threshold_amount', { ascending: true });

  let autoApprove = false;
  let requiresApprovalFrom = 'owner';

  if (thresholds && thresholds.length > 0) {
    for (const t of thresholds) {
      if (po.total_amount <= t.threshold_amount) {
        autoApprove = t.auto_approve_below;
        requiresApprovalFrom = t.requires_approval_from;
        break;
      }
    }
  }

  const newStatus = autoApprove ? 'approved' : 'pending';
  const updateData = {
    approval_status: newStatus,
    status_detail: autoApprove ? 'approved' : 'pending'
  };

  if (autoApprove) {
    updateData.approved_at = new Date().toISOString();
    updateData.approved_by = 'auto-approved';
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: autoApprove ? 'auto_approved' : 'submitted',
      performed_by: submitted_by || 'system',
      details: { auto_approved: autoApprove, requires_approval_from: requiresApprovalFrom }
    });

  res.json({
    success: true,
    po: updated,
    auto_approved: autoApprove,
    requires_approval_from: autoApprove ? null : requiresApprovalFrom
  });
}));

// Approve PO
app.post('/api/purchase-orders/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (po.approval_status === 'approved') {
    throw new AppError('VALIDATION_FAILED', 'PO is already approved');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      approval_status: 'approved',
      status_detail: 'approved',
      status: 'open',
      approved_at: new Date().toISOString(),
      approved_by: approved_by || 'system'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'approved',
      performed_by: approved_by || 'system',
      details: { amount: po.total_amount }
    });

  // Update budget committed amounts
  const { data: lineItems } = await supabase
    .from('v2_po_line_items')
    .select('*, cost_code:v2_cost_codes(id, code)')
    .eq('po_id', id);

  if (lineItems && lineItems.length > 0) {
    for (const item of lineItems) {
      await supabase.rpc('increment_committed_amount', {
        p_job_id: po.job_id,
        p_cost_code_id: item.cost_code_id,
        p_amount: item.amount
      });
    }
  }

  broadcastInvoiceUpdate(id, 'po_approved', { po: updated });

  res.json({ success: true, po: updated });
}));

// Reject PO
app.post('/api/purchase-orders/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejected_by, reason } = req.body;

  if (!reason) {
    throw new AppError('VALIDATION_FAILED', 'Rejection reason is required');
  }

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      approval_status: 'rejected',
      status_detail: 'pending',
      rejection_reason: reason
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'rejected',
      performed_by: rejected_by || 'system',
      details: { reason }
    });

  res.json({ success: true, po: updated });
}));

// Complete PO (alias: close)
app.post('/api/purchase-orders/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { completed_by } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (!['approved', 'active', 'sent'].includes(po.status_detail) && po.approval_status !== 'approved') {
    throw new AppError('VALIDATION_FAILED', 'Only sent or approved POs can be completed');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status: 'closed',
      status_detail: 'completed',
      closed_at: new Date().toISOString(),
      closed_by: completed_by || 'system'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'completed',
      performed_by: completed_by || 'system',
      details: {}
    });

  broadcast({ type: 'po_update', data: { id, action: 'completed' } });
  res.json({ success: true, po: updated });
}));

// Close PO (legacy - redirects to complete)
app.post('/api/purchase-orders/:id/close', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { closed_by, reason } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (!['approved', 'active'].includes(po.status_detail)) {
    throw new AppError('VALIDATION_FAILED', 'Only approved or active POs can be closed');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status: 'closed',
      status_detail: 'completed',
      closed_at: new Date().toISOString(),
      closed_by: closed_by || 'system',
      closed_reason: reason || 'Manually closed'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'completed',
      performed_by: closed_by || 'system',
      details: { reason }
    });

  res.json({ success: true, po: updated });
}));

// Void PO (cancels PO and removes budget commitment)
app.post('/api/purchase-orders/:id/void', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason, voided_by } = req.body;

  if (!reason || !reason.trim()) {
    throw new AppError('VALIDATION_FAILED', 'Reason is required for voiding a PO');
  }

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  // Can void any PO that's not already voided or completed
  if (['voided', 'cancelled', 'completed', 'closed'].includes(po.status_detail)) {
    throw new AppError('VALIDATION_FAILED', 'This PO cannot be voided');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status: 'cancelled',
      status_detail: 'voided',
      closed_at: new Date().toISOString(),
      closed_by: voided_by || 'system',
      closed_reason: reason
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'voided',
      performed_by: voided_by || 'system',
      details: { reason }
    });

  broadcast({ type: 'po_update', data: { id, action: 'voided' } });
  res.json({ success: true, po: updated });
}));

// Reopen PO
app.post('/api/purchase-orders/:id/reopen', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reopened_by, reason } = req.body;

  const { data: po, error: fetchError } = await supabase
    .from('v2_purchase_orders')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !po) {
    throw new AppError('NOT_FOUND', 'Purchase order not found');
  }

  if (!['closed', 'completed'].includes(po.status_detail)) {
    throw new AppError('VALIDATION_FAILED', 'Only closed or completed POs can be reopened');
  }

  const { data: updated, error } = await supabase
    .from('v2_purchase_orders')
    .update({
      status: 'open',
      status_detail: 'approved',
      closed_at: null,
      closed_by: null,
      closed_reason: null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'reopened',
      performed_by: reopened_by || 'system',
      details: { reason }
    });

  res.json({ success: true, po: updated });
}));

// Get PO activity log
app.get('/api/purchase-orders/:id/activity', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_po_activity')
    .select('*')
    .eq('po_id', id)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get PO invoices
app.get('/api/purchase-orders/:id/invoices', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      vendor:v2_vendors(id, name),
      job:v2_jobs(id, name)
    `)
    .eq('po_id', id)
    .is('deleted_at', null)
    .is('deleted_at', null)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get PO attachments
app.get('/api/purchase-orders/:id/attachments', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_po_attachments')
    .select('*')
    .eq('po_id', id)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Upload PO attachment
app.post('/api/purchase-orders/:id/attachments', upload.single('file'), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if file was uploaded via multer
  if (!req.file) {
    throw new AppError('VALIDATION_FAILED', 'No file uploaded');
  }

  const file = {
    name: req.file.originalname,
    data: req.file.buffer,
    size: req.file.size,
    mimetype: req.file.mimetype
  };
  const { description, category } = req.body;

  // Determine file type
  const ext = file.name.split('.').pop().toLowerCase();
  let fileType = 'other';
  if (['pdf'].includes(ext)) fileType = 'pdf';
  else if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) fileType = 'image';
  else if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) fileType = 'document';
  else if (['xls', 'xlsx', 'csv'].includes(ext)) fileType = 'spreadsheet';

  // Get PO info for folder structure
  const { data: po } = await supabase
    .from('v2_purchase_orders')
    .select('po_number, job:v2_jobs(name)')
    .eq('id', id)
    .single();

  // Create storage path
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storagePath = `po-attachments/${id}/${timestamp}_${safeName}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from('invoices')
    .upload(storagePath, file.data, {
      contentType: file.mimetype,
      upsert: false
    });

  if (uploadError) throw new AppError('DATABASE_ERROR', uploadError.message);

  // Create attachment record
  const { data: attachment, error: dbError } = await supabase
    .from('v2_po_attachments')
    .insert({
      po_id: id,
      file_name: file.name,
      file_type: fileType,
      file_size: file.size,
      storage_path: storagePath,
      description: description || null,
      category: category || 'other',
      uploaded_by: req.body.uploaded_by || 'system'
    })
    .select()
    .single();

  if (dbError) throw new AppError('DATABASE_ERROR', dbError.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: id,
      action: 'attachment_added',
      performed_by: req.body.uploaded_by || 'system',
      details: { file_name: file.name, category }
    });

  res.json(attachment);
}));

// Delete PO attachment
app.delete('/api/purchase-orders/:poId/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const { poId, attachmentId } = req.params;

  // Get attachment info
  const { data: attachment, error: fetchError } = await supabase
    .from('v2_po_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('po_id', poId)
    .single();

  if (fetchError || !attachment) {
    throw new AppError('NOT_FOUND', 'Attachment not found');
  }

  // Delete from storage
  await supabase.storage
    .from('invoices')
    .remove([attachment.storage_path]);

  // Delete record
  const { error: deleteError } = await supabase
    .from('v2_po_attachments')
    .delete()
    .eq('id', attachmentId);

  if (deleteError) throw new AppError('DATABASE_ERROR', deleteError.message);

  // Log activity
  await supabase
    .from('v2_po_activity')
    .insert({
      po_id: poId,
      action: 'attachment_removed',
      performed_by: req.body.deleted_by || 'system',
      details: { file_name: attachment.file_name }
    });

  res.json({ success: true });
}));

// Get attachment download URL
app.get('/api/purchase-orders/:poId/attachments/:attachmentId/url', asyncHandler(async (req, res) => {
  const { poId, attachmentId } = req.params;

  const { data: attachment, error: fetchError } = await supabase
    .from('v2_po_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('po_id', poId)
    .single();

  if (fetchError || !attachment) {
    throw new AppError('NOT_FOUND', 'Attachment not found');
  }

  // Get signed URL (valid for 1 hour)
  const { data: urlData, error: urlError } = await supabase.storage
    .from('invoices')
    .createSignedUrl(attachment.storage_path, 3600);

  if (urlError) throw new AppError('DATABASE_ERROR', urlError.message);

  res.json({ url: urlData.signedUrl, fileName: attachment.file_name });
}));

// ============================================================
// PO CHANGE ORDERS
// ============================================================

// List change orders for a PO
app.get('/api/purchase-orders/:poId/change-orders', asyncHandler(async (req, res) => {
  const { poId } = req.params;

  const { data, error } = await supabase
    .from('v2_change_orders')
    .select(`
      *,
      line_items:v2_change_order_line_items(
        id, cost_code_id, description, amount, is_new,
        cost_code:v2_cost_codes(id, code, name)
      )
    `)
    .eq('po_id', poId)
    .order('change_order_number', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Create a change order for a PO
app.post('/api/purchase-orders/:poId/change-orders', asyncHandler(async (req, res) => {
  const { poId } = req.params;
  const { description, reason, amount_change, line_items } = req.body;

  // Get PO and current highest CO number
  const { data: po, error: poError } = await supabase
    .from('v2_purchase_orders')
    .select('id, total_amount, change_order_total')
    .eq('id', poId)
    .single();

  if (poError || !po) throw new AppError('NOT_FOUND', 'Purchase order not found');

  const { data: existingCOs } = await supabase
    .from('v2_change_orders')
    .select('change_order_number')
    .eq('po_id', poId)
    .order('change_order_number', { ascending: false })
    .limit(1);

  const nextCONumber = (existingCOs?.[0]?.change_order_number || 0) + 1;
  const previousTotal = parseFloat(po.total_amount) || 0;
  const changeAmount = parseFloat(amount_change) || 0;
  const newTotal = previousTotal + changeAmount;

  // Create change order
  const { data: co, error: coError } = await supabase
    .from('v2_change_orders')
    .insert({
      po_id: poId,
      change_order_number: nextCONumber,
      description,
      reason,
      amount_change: changeAmount,
      previous_total: previousTotal,
      new_total: newTotal,
      status: 'pending',
      created_by: 'system'
    })
    .select()
    .single();

  if (coError) throw new AppError('DATABASE_ERROR', coError.message);

  // Insert line items if provided
  if (line_items && line_items.length > 0) {
    const lineItemsToInsert = line_items.map(li => ({
      change_order_id: co.id,
      cost_code_id: li.cost_code_id,
      description: li.description,
      amount: parseFloat(li.amount) || 0,
      is_new: li.is_new || false,
      original_line_item_id: li.original_line_item_id
    }));

    const { error: liError } = await supabase
      .from('v2_change_order_line_items')
      .insert(lineItemsToInsert);

    if (liError) console.error('Error inserting CO line items:', liError);
  }

  // Log activity
  await supabase.from('v2_po_activity').insert({
    po_id: poId,
    action: 'change_order_created',
    performed_by: 'system',
    details: { change_order_id: co.id, number: nextCONumber, amount: changeAmount }
  });

  res.json(co);
}));

// Approve a change order
app.post('/api/purchase-orders/:poId/change-orders/:coId/approve', asyncHandler(async (req, res) => {
  const { poId, coId } = req.params;

  // Get the change order
  const { data: co, error: coError } = await supabase
    .from('v2_change_orders')
    .select('*')
    .eq('id', coId)
    .eq('po_id', poId)
    .single();

  if (coError || !co) throw new AppError('NOT_FOUND', 'Change order not found');
  if (co.status === 'approved') throw new AppError('INVALID_STATE', 'Change order already approved');

  // Update change order status
  const { error: updateCOError } = await supabase
    .from('v2_change_orders')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: 'Jake Ross'
    })
    .eq('id', coId);

  if (updateCOError) throw new AppError('DATABASE_ERROR', updateCOError.message);

  // Update PO total and change_order_total
  const { data: po } = await supabase
    .from('v2_purchase_orders')
    .select('total_amount, change_order_total')
    .eq('id', poId)
    .single();

  const newTotal = (parseFloat(po.total_amount) || 0) + (parseFloat(co.amount_change) || 0);
  const newCOTotal = (parseFloat(po.change_order_total) || 0) + (parseFloat(co.amount_change) || 0);

  await supabase
    .from('v2_purchase_orders')
    .update({
      total_amount: newTotal,
      change_order_total: newCOTotal
    })
    .eq('id', poId);

  // Log activity
  await supabase.from('v2_po_activity').insert({
    po_id: poId,
    action: 'change_order_approved',
    performed_by: 'Jake Ross',
    details: { change_order_id: coId, amount: co.amount_change, new_total: newTotal }
  });

  res.json({ success: true, new_total: newTotal });
}));

// Reject a change order
app.post('/api/purchase-orders/:poId/change-orders/:coId/reject', asyncHandler(async (req, res) => {
  const { poId, coId } = req.params;
  const { reason } = req.body;

  const { error } = await supabase
    .from('v2_change_orders')
    .update({
      status: 'rejected',
      rejection_reason: reason
    })
    .eq('id', coId)
    .eq('po_id', poId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await supabase.from('v2_po_activity').insert({
    po_id: poId,
    action: 'change_order_rejected',
    performed_by: 'Jake Ross',
    details: { change_order_id: coId, reason }
  });

  res.json({ success: true });
}));

// ============================================================
// PO PDF GENERATION
// ============================================================

app.get('/api/purchase-orders/:id/pdf', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get PO with all related data
  const { data: po, error } = await supabase
    .from('v2_purchase_orders')
    .select(`
      *,
      job:v2_jobs(id, name, address, client_name),
      vendor:v2_vendors(id, name, email, phone, address),
      line_items:v2_po_line_items(
        id, description, amount,
        cost_code:v2_cost_codes(id, code, name)
      )
    `)
    .eq('id', id)
    .single();

  if (error || !po) throw new AppError('NOT_FOUND', 'Purchase order not found');

  // Get change orders
  const { data: changeOrders } = await supabase
    .from('v2_change_orders')
    .select('*')
    .eq('po_id', id)
    .eq('status', 'approved')
    .order('change_order_number');

  // Generate PDF using pdf-lib
  const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const drawText = (text, x, y, options = {}) => {
    page.drawText(text || '', {
      x,
      y,
      size: options.size || 10,
      font: options.bold ? boldFont : font,
      color: options.color || rgb(0, 0, 0)
    });
  };

  const formatMoney = (amt) => '$' + (parseFloat(amt) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Header
  drawText('ROSS BUILT CUSTOM HOMES', 50, height - 50, { size: 16, bold: true });
  drawText('305 67th St West, Bradenton, FL 34209', 50, height - 68, { size: 9, color: rgb(0.4, 0.4, 0.4) });

  drawText('PURCHASE ORDER', width - 200, height - 50, { size: 14, bold: true });
  drawText(po.po_number || 'Draft', width - 200, height - 68, { size: 12 });

  // Status
  const status = po.approval_status === 'approved' ? 'APPROVED' : po.status_detail?.toUpperCase() || 'DRAFT';
  drawText(status, width - 200, height - 85, { size: 10, bold: true, color: po.approval_status === 'approved' ? rgb(0.1, 0.5, 0.1) : rgb(0.5, 0.5, 0.5) });

  // Divider
  page.drawLine({ start: { x: 50, y: height - 100 }, end: { x: width - 50, y: height - 100 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });

  // Vendor and Job info
  let y = height - 130;

  drawText('VENDOR', 50, y, { size: 8, bold: true, color: rgb(0.4, 0.4, 0.4) });
  drawText('JOB', 320, y, { size: 8, bold: true, color: rgb(0.4, 0.4, 0.4) });

  y -= 15;
  drawText(po.vendor?.name || 'Unknown Vendor', 50, y, { size: 11, bold: true });
  drawText(po.job?.name || 'Unknown Job', 320, y, { size: 11, bold: true });

  if (po.vendor?.address) { y -= 12; drawText(po.vendor.address, 50, y, { size: 9 }); }
  if (po.job?.address) { y -= 12; drawText(po.job.address, 320, y, { size: 9 }); }

  y -= 25;

  // Description
  if (po.description) {
    drawText('DESCRIPTION', 50, y, { size: 8, bold: true, color: rgb(0.4, 0.4, 0.4) });
    y -= 15;
    drawText(po.description, 50, y, { size: 10 });
    y -= 20;
  }

  // Scope of Work
  if (po.scope_of_work) {
    drawText('SCOPE OF WORK', 50, y, { size: 8, bold: true, color: rgb(0.4, 0.4, 0.4) });
    y -= 15;
    const lines = po.scope_of_work.split('\n').slice(0, 5);
    lines.forEach(line => {
      drawText(line.substring(0, 80), 50, y, { size: 9 });
      y -= 12;
    });
    y -= 10;
  }

  // Line Items Header
  page.drawRectangle({ x: 50, y: y - 5, width: width - 100, height: 20, color: rgb(0.95, 0.95, 0.95) });
  drawText('Cost Code', 55, y, { size: 9, bold: true });
  drawText('Description', 160, y, { size: 9, bold: true });
  drawText('Amount', width - 100, y, { size: 9, bold: true });
  y -= 25;

  // Line Items
  const lineItems = po.line_items || [];
  let subtotal = 0;
  lineItems.forEach(item => {
    const cc = item.cost_code;
    drawText(cc?.code || '-', 55, y, { size: 9 });
    drawText((cc?.name || item.description || '').substring(0, 40), 160, y, { size: 9 });
    drawText(formatMoney(item.amount), width - 100, y, { size: 9 });
    subtotal += parseFloat(item.amount) || 0;
    y -= 15;
  });

  // Totals
  y -= 10;
  page.drawLine({ start: { x: width - 200, y: y + 5 }, end: { x: width - 50, y: y + 5 }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });

  drawText('Subtotal:', width - 180, y - 10, { size: 9 });
  drawText(formatMoney(subtotal), width - 100, y - 10, { size: 9 });

  if (changeOrders && changeOrders.length > 0) {
    const coTotal = changeOrders.reduce((sum, co) => sum + parseFloat(co.amount_change || 0), 0);
    y -= 15;
    drawText('Change Orders:', width - 180, y - 10, { size: 9 });
    drawText(formatMoney(coTotal), width - 100, y - 10, { size: 9 });
  }

  y -= 20;
  drawText('TOTAL:', width - 180, y - 10, { size: 10, bold: true });
  drawText(formatMoney(po.total_amount), width - 100, y - 10, { size: 10, bold: true });

  // Footer
  drawText(`Generated: ${new Date().toLocaleDateString()}`, 50, 50, { size: 8, color: rgb(0.5, 0.5, 0.5) });

  // Output
  const pdfBytes = await pdfDoc.save();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${po.po_number || 'PO'}.pdf"`);
  res.send(Buffer.from(pdfBytes));
}));

// ============================================================
// INVOICES API
// ============================================================

// List invoices (with optional filters)
app.get('/api/invoices', async (req, res) => {
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
      .is('deleted_at', null)  // Filter out soft-deleted invoices
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

// Get invoices that need review (must be before :id route)
app.get('/api/invoices/needs-review', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('needs_review', true)
    .is('deleted_at', null)
    .is('deleted_at', null)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get invoices with low AI confidence (must be before :id route)
app.get('/api/invoices/low-confidence', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('ai_processed', true)
    .is('deleted_at', null)
    .is('deleted_at', null)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Filter for low confidence
  const lowConfidence = data.filter(inv => {
    if (!inv.ai_confidence) return false;
    return Object.values(inv.ai_confidence).some(c => c < 0.6);
  });

  res.json(lowConfidence);
}));

// Get invoices without job assignment (must be before :id route)
app.get('/api/invoices/no-job', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_invoices')
    .select(`
      *,
      vendor:v2_vendors(id, name)
    `)
    .is('job_id', null)
    .is('deleted_at', null)
    .is('deleted_at', null)
      .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get single invoice with full details
app.get('/api/invoices/:id', async (req, res) => {
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
      // PGRST116 = no rows found
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Invoice not found' });
      }
      throw error;
    }

    // Flatten draw info for easier access
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
app.get('/api/invoices/:id/activity', async (req, res) => {
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

// Get invoice approval context (budget + PO status + CO status for decision-making)
app.get('/api/invoices/:id/approval-context', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('Error getting approval context:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get invoice allocations
app.get('/api/invoices/:id/allocations', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        id,
        amount,
        notes,
        cost_code_id,
        job_id,
        po_id,
        po_line_item_id,
        change_order_id,
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

// Get available funding sources (POs and COs) for a job
app.get('/api/jobs/:jobId/funding-sources', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get open/active POs for the job
    const { data: pos, error: poError } = await supabase
      .from('v2_purchase_orders')
      .select(`
        id, po_number, vendor_id, total_amount, status, description, created_at,
        vendor:v2_vendors(id, name),
        line_items:v2_po_line_items(id, cost_code_id, amount, invoiced_amount, description, change_order_id,
          cost_code:v2_cost_codes(id, code, name)
        )
      `)
      .eq('job_id', jobId)
      .in('status', ['open', 'active'])
      .is('deleted_at', null)
      .order('po_number');

    if (poError) throw poError;

    // Get approved COs for the job
    const { data: cos, error: coError } = await supabase
      .from('v2_job_change_orders')
      .select('id, change_order_number, title, amount, invoiced_amount, status')
      .eq('job_id', jobId)
      .in('status', ['approved', 'pending_approval'])
      .order('change_order_number');

    if (coError) throw coError;

    // Calculate remaining amounts
    const posWithRemaining = (pos || []).map(po => ({
      ...po,
      invoiced_total: (po.line_items || []).reduce((sum, li) => sum + parseFloat(li.invoiced_amount || 0), 0),
      remaining: parseFloat(po.total_amount || 0) - (po.line_items || []).reduce((sum, li) => sum + parseFloat(li.invoiced_amount || 0), 0)
    }));

    const cosWithRemaining = (cos || []).map(co => ({
      ...co,
      remaining: parseFloat(co.amount || 0) - parseFloat(co.invoiced_amount || 0)
    }));

    res.json({
      purchase_orders: posWithRemaining,
      change_orders: cosWithRemaining
    });
  } catch (err) {
    console.error('Error getting funding sources:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload invoice with PDF
app.post('/api/invoices/upload', upload.single('pdf'), async (req, res) => {
  try {
    const { job_id, vendor_id, invoice_number, invoice_date, due_date, amount, notes, uploaded_by } = req.body;

    let pdf_url = null;

    // Upload PDF if provided
    if (req.file) {
      const result = await uploadPDF(req.file.buffer, req.file.originalname, job_id);
      pdf_url = result.url;
    }

    // Determine invoice type based on amount
    const parsedAmount = parseFloat(amount) || 0;
    const invoice_type = parsedAmount < 0 ? 'credit_memo' : 'standard';

    // Create invoice
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

    // Log activity
    await logActivity(invoice.id, 'uploaded', uploaded_by || 'System', {
      filename: req.file?.originalname
    });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI-powered invoice processing - accepts PDF, images, Word, Excel
app.post('/api/invoices/process', upload.single('file'), async (req, res) => {
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

    // Convert document to processable format
    const converted = await convertDocument(fileBuffer, originalFilename, mimetype);

    if (!converted.success) {
      return res.status(400).json({
        error: 'Document conversion failed',
        details: converted.error,
        supported: getSupportedExtensions()
      });
    }

    console.log(`[Upload] Converted: ${converted.fileType}`);

    // Process based on document type
    let result;

    if (converted.fileType === 'PDF') {
      // Standard PDF processing
      result = await processInvoice(fileBuffer, originalFilename);
    } else if (converted.fileType === 'IMAGE') {
      // Image processing via Claude Vision
      console.log(`[Upload] Using Claude Vision for image: ${converted.data.mediaType}`);

      // Extract invoice data using vision
      const extracted = await extractInvoiceFromImage(
        converted.data.base64,
        converted.data.mediaType,
        originalFilename
      );

      // Build result similar to processInvoice output
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

      // Run matching logic (vendor, job, PO)
      const { findMatchingJob, findOrCreateVendor, findOrCreatePO } = require('./ai-processor');

      if (extracted.vendor?.companyName) {
        result.vendor = await findOrCreateVendor(extracted.vendor, extracted.vendor?.tradeType);
      }
      if (extracted.job) {
        result.matchedJob = await findMatchingJob(extracted.job);
      }
      if (result.vendor && result.matchedJob) {
        result.po = await findOrCreatePO(result.vendor, result.matchedJob, result.extracted.totalAmount, extracted.job?.poNumber);
      }

      // Generate standardized filename
      const vendorName = result.vendor?.name || extracted.vendor?.companyName || 'Unknown';
      const jobName = result.matchedJob?.name || 'Unassigned';
      const dateStr = extracted.invoiceDate || new Date().toISOString().split('T')[0];
      result.standardizedFilename = standards.generateInvoiceFilename(jobName, vendorName, dateStr);

      // Check for duplicates
      if (result.vendor?.id && extracted.invoiceNumber) {
        const dupes = await checkForDuplicates(result.vendor.id, extracted.invoiceNumber, result.extracted.totalAmount);
        result.suggestions = { possible_duplicates: dupes };
      }
    } else if (converted.fileType === 'WORD' || converted.fileType === 'EXCEL') {
      // Text-based document processing
      console.log(`[Upload] Processing ${converted.fileType} document as text`);

      const documentText = converted.data.text;
      const extracted = await extractInvoiceFromText(documentText, originalFilename, converted.fileType);

      // Build result similar to processInvoice output
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

      // Run matching logic
      const { findMatchingJob, findOrCreateVendor, findOrCreatePO } = require('./ai-processor');

      if (extracted.vendor?.companyName) {
        result.vendor = await findOrCreateVendor(extracted.vendor, extracted.vendor?.tradeType);
      }
      if (extracted.job) {
        result.matchedJob = await findMatchingJob(extracted.job);
      }
      if (result.vendor && result.matchedJob) {
        result.po = await findOrCreatePO(result.vendor, result.matchedJob, result.extracted.totalAmount, extracted.job?.poNumber);
      }

      // Generate standardized filename
      const vendorName = result.vendor?.name || extracted.vendor?.companyName || 'Unknown';
      const jobName = result.matchedJob?.name || 'Unassigned';
      const dateStr = extracted.invoiceDate || new Date().toISOString().split('T')[0];
      result.standardizedFilename = standards.generateInvoiceFilename(jobName, vendorName, dateStr);

      // Check for duplicates
      if (result.vendor?.id && extracted.invoiceNumber) {
        const dupes = await checkForDuplicates(result.vendor.id, extracted.invoiceNumber, result.extracted.totalAmount);
        result.suggestions = { possible_duplicates: dupes };
      }
    } else {
      return res.status(400).json({
        error: 'Unsupported file type',
        fileType: converted.fileType
      });
    }

    if (!result.success) {
      return res.status(422).json({
        error: 'Processing failed',
        messages: result.messages
      });
    }

    // Check for duplicates and BLOCK if high-confidence duplicate found
    const duplicates = result.suggestions?.possible_duplicates || [];
    const highConfidenceDupe = duplicates.find(d => d.confidence >= 0.95);

    if (highConfidenceDupe) {
      return res.status(409).json({
        error: 'Duplicate invoice detected',
        message: `This appears to be a duplicate of invoice #${highConfidenceDupe.invoice_number} from ${highConfidenceDupe.vendor?.name || 'this vendor'}`,
        duplicate: {
          id: highConfidenceDupe.id,
          invoice_number: highConfidenceDupe.invoice_number,
          amount: highConfidenceDupe.amount,
          status: highConfidenceDupe.status,
          matchReason: highConfidenceDupe.matchReason,
          confidence: highConfidenceDupe.confidence
        }
      });
    }

    // Upload PDF with standardized name
    // Use converted PDF for images, or original buffer for PDFs
    let pdf_url = null;
    const jobId = result.matchedJob?.id;
    const storagePath = result.standardizedFilename;

    // Determine which buffer to upload (converted PDF for images, original for PDFs)
    const bufferToUpload = converted.pdfBuffer || fileBuffer;

    if (jobId) {
      const uploadResult = await uploadPDF(bufferToUpload, storagePath, jobId);
      pdf_url = uploadResult.url;
    } else {
      // Upload to unassigned folder if no job match
      const uploadResult = await uploadPDF(bufferToUpload, `unassigned/${storagePath}`, null);
      pdf_url = uploadResult.url;
    }

    // Create invoice record with AI metadata
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
        // AI metadata for confidence badges
        ai_processed: result.ai_processed || false,
        ai_confidence: result.ai_confidence || null,
        ai_extracted_data: result.ai_extracted_data || null,
        needs_review: result.needs_review || false,
        review_flags: result.review_flags || null
      })
      .select()
      .single();

    if (invError) throw invError;

    // Create allocations from line items OR suggested allocations
    let allocationsCreated = false;

    // First try to create allocations from line items with explicit cost codes
    if (result.extracted.lineItems?.length > 0) {
      const allocations = [];
      for (const item of result.extracted.lineItems) {
        if (item.costCode) {
          // Try to find matching cost code
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
        allocationsCreated = true;
      }
    }

    // Fallback: If no allocations created, use suggested allocations from trade type
    if (!allocationsCreated && result.suggested_allocations?.length > 0) {
      const suggestedAllocs = result.suggested_allocations.map(sa => ({
        invoice_id: invoice.id,
        job_id: result.matchedJob?.id || null,
        cost_code_id: sa.cost_code_id,
        amount: sa.amount,
        po_id: sa.po_id || null, // AI-linked PO
        notes: sa._aiLinked
          ? `Auto-suggested (AI-linked to PO)`
          : `Auto-suggested based on ${result.extracted.vendor?.tradeType || 'detected'} trade type`
      }));

      await supabase.from('v2_invoice_allocations').insert(suggestedAllocs);
      allocationsCreated = true;
    }

    // Stamp PDF with "Needs Review" for new invoice
    if (pdf_url) {
      try {
        let storagePath = null;
        if (pdf_url.includes('/storage/v1/object/public/invoices/')) {
          const urlParts = pdf_url.split('/storage/v1/object/public/invoices/');
          storagePath = urlParts[1] ? decodeURIComponent(urlParts[1].split('?')[0]) : null;
        }
        if (storagePath) {
          const pdfBuffer = await downloadPDF(storagePath);
          const stampedBuffer = await stampNeedsReview(pdfBuffer, {
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            vendorName: result.vendor?.name,
            invoiceNumber: result.extracted?.invoiceNumber,
            amount: result.extracted?.totalAmount,
            flags: result.review_flags || []
          });
          // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
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

    // Log activity
    await logActivity(invoice.id, 'uploaded', 'AI Processor', {
      originalFilename,
      standardizedFilename: result.standardizedFilename,
      aiExtracted: true,
      vendorMatched: !!result.vendor,
      vendorCreated: result.messages.some(m => m.includes('Created new vendor')),
      jobMatched: !!result.matchedJob,
      poMatched: !!result.po,
      poCreated: result.messages.some(m => m.includes('Created draft PO'))
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
// MASTER DOCUMENT PROCESSOR - Universal upload endpoint
// ============================================================

/**
 * Universal document processor - classifies and routes any document type
 * Supports: invoices, lien releases, POs, quotes, change orders, insurance, contracts
 */
app.post('/api/documents/process', upload.single('file'), async (req, res) => {
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
    const uploadedBy = req.body.uploaded_by || 'System';

    console.log(`[Document Processor] Processing: ${originalFilename} (${mimetype})`);

    // Convert document to processable format
    const converted = await convertDocument(fileBuffer, originalFilename, mimetype);

    if (!converted.success) {
      return res.status(400).json({
        error: 'Document conversion failed',
        details: converted.error,
        supported: getSupportedExtensions()
      });
    }

    // Use converted PDF for storage, original buffer for PDF files
    const pdfBuffer = converted.pdfBuffer || fileBuffer;

    // For non-PDF files, we need special handling
    let result;

    if (converted.fileType === 'PDF') {
      // Standard PDF processing with document classification
      result = await processDocument(pdfBuffer, originalFilename, { uploadedBy });
    } else if (converted.fileType === 'IMAGE') {
      // Image processing - extract invoice data using vision
      console.log(`[Document Processor] Using Claude Vision for image`);

      const extracted = await extractInvoiceFromImage(
        converted.data.base64,
        converted.data.mediaType,
        originalFilename
      );

      // Build result similar to processDocument output
      const { findMatchingJob, findOrCreateVendor, findOrCreatePO } = require('./ai-processor');

      let vendor = null;
      let matchedJob = null;
      let po = null;

      if (extracted.vendor?.companyName) {
        vendor = await findOrCreateVendor(extracted.vendor, extracted.vendor?.tradeType);
      }
      if (extracted.job) {
        matchedJob = await findMatchingJob(extracted.job);
      }
      if (vendor && matchedJob) {
        po = await findOrCreatePO(vendor, matchedJob, extracted.amounts?.totalAmount, extracted.job?.poNumber);
      }

      result = {
        success: true,
        documentType: DOCUMENT_TYPES.INVOICE,
        classification: { type: 'invoice', confidence: 0.9, reasoning: 'Image processed as invoice' },
        data: {
          success: true,
          extracted: {
            vendor: extracted.vendor,
            invoiceNumber: extracted.invoiceNumber,
            invoiceDate: extracted.invoiceDate,
            dueDate: extracted.dueDate,
            totalAmount: extracted.amounts?.totalAmount,
            lineItems: extracted.lineItems || []
          },
          vendor,
          matchedJob,
          po,
          ai_confidence: extracted.extractionConfidence || {},
          needs_review: true,
          review_flags: ['image_source'],
          standardizedFilename: standards.generateInvoiceFilename(
            matchedJob?.name || 'Unassigned',
            vendor?.name || extracted.vendor?.companyName || 'Unknown',
            extracted.invoiceDate || new Date().toISOString().split('T')[0]
          ),
          suggestions: {}
        },
        messages: ['Processed image document with Claude Vision']
      };

      // Check for duplicates
      if (vendor?.id && extracted.invoiceNumber) {
        const dupes = await checkForDuplicates(vendor.id, extracted.invoiceNumber, extracted.amounts?.totalAmount);
        result.data.suggestions.possible_duplicates = dupes;
      }
    } else if (converted.fileType === 'WORD' || converted.fileType === 'EXCEL') {
      // Text-based document processing
      console.log(`[Document Processor] Processing ${converted.fileType} as text`);

      const documentText = converted.data.text;
      const extracted = await extractInvoiceFromText(documentText, originalFilename, converted.fileType);

      const { findMatchingJob, findOrCreateVendor, findOrCreatePO } = require('./ai-processor');

      let vendor = null;
      let matchedJob = null;
      let po = null;

      if (extracted.vendor?.companyName) {
        vendor = await findOrCreateVendor(extracted.vendor, extracted.vendor?.tradeType);
      }
      if (extracted.job) {
        matchedJob = await findMatchingJob(extracted.job);
      }
      if (vendor && matchedJob) {
        po = await findOrCreatePO(vendor, matchedJob, extracted.amounts?.totalAmount, extracted.job?.poNumber);
      }

      result = {
        success: true,
        documentType: DOCUMENT_TYPES.INVOICE,
        classification: { type: 'invoice', confidence: 0.8, reasoning: `${converted.fileType} processed as invoice` },
        data: {
          success: true,
          extracted: {
            vendor: extracted.vendor,
            invoiceNumber: extracted.invoiceNumber,
            invoiceDate: extracted.invoiceDate,
            dueDate: extracted.dueDate,
            totalAmount: extracted.amounts?.totalAmount,
            lineItems: extracted.lineItems || []
          },
          vendor,
          matchedJob,
          po,
          ai_confidence: extracted.extractionConfidence || {},
          needs_review: true,
          review_flags: [`${converted.fileType.toLowerCase()}_source`],
          standardizedFilename: standards.generateInvoiceFilename(
            matchedJob?.name || 'Unassigned',
            vendor?.name || extracted.vendor?.companyName || 'Unknown',
            extracted.invoiceDate || new Date().toISOString().split('T')[0]
          ),
          suggestions: {}
        },
        messages: [`Processed ${converted.fileType} document`]
      };

      // Check for duplicates
      if (vendor?.id && extracted.invoiceNumber) {
        const dupes = await checkForDuplicates(vendor.id, extracted.invoiceNumber, extracted.amounts?.totalAmount);
        result.data.suggestions.possible_duplicates = dupes;
      }
    } else {
      return res.status(400).json({
        error: 'Unsupported file type for document processing',
        fileType: converted.fileType
      });
    }

    if (!result.success && result.documentType === DOCUMENT_TYPES.UNKNOWN) {
      return res.status(422).json({
        success: false,
        error: 'Could not classify document',
        messages: result.messages,
        classification: result.classification
      });
    }

    // Handle different document types
    let savedRecord = null;

    if (result.documentType === DOCUMENT_TYPES.INVOICE) {
      // Invoice processing - create the invoice record
      const invoiceData = result.data;

      if (!invoiceData.success) {
        return res.status(422).json({
          success: false,
          documentType: result.documentType,
          error: 'Invoice processing failed',
          messages: result.messages
        });
      }

      // Check for duplicates
      const duplicates = invoiceData.suggestions?.possible_duplicates || [];
      const highConfidenceDupe = duplicates.find(d => d.confidence >= 0.95);

      if (highConfidenceDupe) {
        return res.status(409).json({
          success: false,
          documentType: result.documentType,
          error: 'Duplicate invoice detected',
          message: `This appears to be a duplicate of invoice #${highConfidenceDupe.invoice_number}`,
          duplicate: highConfidenceDupe
        });
      }

      // Upload PDF
      let pdf_url = null;
      const jobId = invoiceData.matchedJob?.id;
      const storagePath = invoiceData.standardizedFilename;

      if (jobId) {
        const uploadResult = await uploadPDF(pdfBuffer, storagePath, jobId);
        pdf_url = uploadResult.url;
      } else {
        const uploadResult = await uploadPDF(pdfBuffer, `unassigned/${storagePath}`, null);
        pdf_url = uploadResult.url;
      }

      // Create invoice record
      const { data: invoice, error: invError } = await supabase
        .from('v2_invoices')
        .insert({
          job_id: jobId || null,
          vendor_id: invoiceData.vendor?.id || null,
          po_id: invoiceData.po?.id || null,
          invoice_number: invoiceData.extracted.invoiceNumber,
          invoice_date: invoiceData.extracted.invoiceDate,
          due_date: invoiceData.extracted.dueDate || null,
          amount: invoiceData.extracted.totalAmount || 0,
          pdf_url,
          status: 'needs_review',
          notes: invoiceData.messages.join('\n'),
          ai_processed: true,
          ai_confidence: invoiceData.ai_confidence || null,
          ai_extracted_data: invoiceData.ai_extracted_data || null,
          needs_review: invoiceData.needs_review || false,
          review_flags: invoiceData.review_flags || null
        })
        .select()
        .single();

      if (invError) throw invError;

      // Store PDF hash for duplicate detection
      if (pdfBuffer && invoice.id) {
        storePDFHash(invoice.id, pdfBuffer).catch(err => {
          console.error('[HASH] Failed to store PDF hash:', err.message);
        });
      }

      // Create allocations if available
      if (invoiceData.suggested_allocations?.length > 0) {
        const allocs = invoiceData.suggested_allocations.map(sa => ({
          invoice_id: invoice.id,
          job_id: invoiceData.matchedJob?.id || null,
          cost_code_id: sa.cost_code_id,
          amount: sa.amount,
          po_id: sa.po_id || null, // AI-linked PO
          notes: sa._aiLinked
            ? `Auto-suggested (AI-linked to PO)`
            : `Auto-suggested based on ${invoiceData.extracted.vendor?.tradeType || 'detected'} trade type`
        }));
        await supabase.from('v2_invoice_allocations').insert(allocs);
      }

      // Stamp PDF with "Needs Review" for new invoice
      if (pdf_url) {
        try {
          let storagePath = null;
          if (pdf_url.includes('/storage/v1/object/public/invoices/')) {
            const urlParts = pdf_url.split('/storage/v1/object/public/invoices/');
            storagePath = urlParts[1] ? decodeURIComponent(urlParts[1].split('?')[0]) : null;
          }
          if (storagePath) {
            const pdfBuffer2 = await downloadPDF(storagePath);
            const stampedBuffer = await stampNeedsReview(pdfBuffer2, {
              date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              vendorName: invoiceData.vendor?.name,
              invoiceNumber: invoiceData.extracted?.invoiceNumber,
              amount: invoiceData.extracted?.totalAmount,
              flags: invoiceData.review_flags || []
            });
            // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
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

      savedRecord = invoice;
      result.redirect.id = invoice.id;

    } else if (result.documentType === DOCUMENT_TYPES.LIEN_RELEASE) {
      // Lien release processing - create the lien release record
      const lienData = result.data;

      if (!lienData.success) {
        return res.status(422).json({
          success: false,
          documentType: result.documentType,
          error: 'Lien release processing failed',
          messages: result.messages
        });
      }

      // Upload PDF
      let pdf_url = null;
      const jobId = lienData.matchedJob?.id;
      const vendorName = lienData.vendor?.name || lienData.extracted?.vendor?.companyName || 'Unknown';
      const releaseType = lienData.extracted?.releaseType || 'unknown';
      const dateStr = lienData.extracted?.throughDate || new Date().toISOString().split('T')[0];
      const storagePath = `lien-releases/LR_${vendorName.replace(/[^a-zA-Z0-9]/g, '')}_${releaseType}_${dateStr}.pdf`;

      if (jobId) {
        const uploadResult = await uploadPDF(pdfBuffer, storagePath, jobId);
        pdf_url = uploadResult.url;
      } else {
        const uploadResult = await uploadPDF(pdfBuffer, `unassigned/${storagePath}`, null);
        pdf_url = uploadResult.url;
      }

      // Create lien release record
      const { data: lienRelease, error: lienError } = await supabase
        .from('v2_lien_releases')
        .insert({
          job_id: jobId || null,
          vendor_id: lienData.vendor?.id || null,
          release_type: lienData.extracted?.releaseType || 'conditional_progress',
          amount: lienData.extracted?.amount || null,
          through_date: lienData.extracted?.throughDate || null,
          release_date: lienData.extracted?.releaseDate || new Date().toISOString().split('T')[0],
          pdf_url,
          status: 'received',
          signer_name: lienData.extracted?.signer?.name || null,
          signer_title: lienData.extracted?.signer?.title || null,
          notary_name: lienData.extracted?.notary?.name || null,
          notary_county: lienData.extracted?.notary?.county || null,
          notary_expiration: lienData.extracted?.notary?.expiration || null,
          ai_processed: true,
          ai_confidence: lienData.ai_confidence || null,
          ai_extracted_data: lienData.ai_extracted_data || null,
          needs_review: lienData.needs_review || false,
          review_flags: lienData.review_flags || null
        })
        .select()
        .single();

      if (lienError) throw lienError;

      savedRecord = lienRelease;
      result.redirect.id = lienRelease.id;
    }

    // Return unified response
    res.json({
      success: true,
      documentType: result.documentType,
      classification: result.classification,
      data: result.data,
      savedRecord,
      redirect: result.redirect,
      messages: result.messages
    });

  } catch (err) {
    console.error('Document processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Multi-page document processor - splits combined PDFs and processes each page
 * Use this for combined lien releases, multiple invoices in one PDF, etc.
 */
app.post('/api/documents/process-multipage', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const originalFilename = req.file.originalname;
    const pdfBuffer = req.file.buffer;
    const uploadedBy = req.body.uploaded_by || 'System';

    console.log(`[Multi-Page Processor] Processing: ${originalFilename}`);

    // Process the combined document (extraction only)
    const result = await processMultiPageDocument(pdfBuffer, originalFilename, { uploadedBy });

    // Now save each processed page to the database
    for (const page of result.processedPages) {
      try {
        if (page.documentType === DOCUMENT_TYPES.LIEN_RELEASE) {
          const lienData = page.data;

          // Upload the split PDF page
          let pdf_url = null;
          const jobId = lienData.matchedJob?.id;
          const vendorName = lienData.vendor?.name || lienData.extracted?.vendor?.companyName || 'Unknown';
          const releaseType = lienData.extracted?.releaseType || 'unknown';
          const dateStr = lienData.extracted?.throughDate || new Date().toISOString().split('T')[0];
          const storagePath = `lien-releases/LR_${vendorName.replace(/[^a-zA-Z0-9]/g, '')}_${releaseType}_${dateStr}_p${page.pageNumber}.pdf`;

          // Get the split page buffer from the result
                    const pages = await splitPDF(pdfBuffer);
          const pageBuffer = pages[page.pageNumber - 1]?.buffer;

          if (pageBuffer) {
            if (jobId) {
              const uploadResult = await uploadPDF(pageBuffer, storagePath, jobId);
              pdf_url = uploadResult.url;
            } else {
              const uploadResult = await uploadPDF(pageBuffer, `unassigned/${storagePath}`, null);
              pdf_url = uploadResult.url;
            }
          }

          // Create lien release record
          const { data: lienRelease, error: lienError } = await supabase
            .from('v2_lien_releases')
            .insert({
              job_id: jobId || null,
              vendor_id: lienData.vendor?.id || null,
              release_type: lienData.extracted?.releaseType || 'conditional_progress',
              amount: lienData.extracted?.amount || null,
              through_date: lienData.extracted?.throughDate || null,
              release_date: lienData.extracted?.releaseDate || new Date().toISOString().split('T')[0],
              pdf_url,
              status: 'received',
              signer_name: lienData.extracted?.signer?.name || null,
              signer_title: lienData.extracted?.signer?.title || null,
              notary_name: lienData.extracted?.notary?.name || null,
              notary_county: lienData.extracted?.notary?.county || null,
              notary_expiration: lienData.extracted?.notary?.expiration || null,
              ai_processed: true,
              ai_confidence: lienData.ai_confidence || null,
              ai_extracted_data: lienData.ai_extracted_data || null,
              needs_review: lienData.needs_review || false,
              review_flags: lienData.review_flags || null,
              uploaded_by: uploadedBy
            })
            .select()
            .single();

          if (lienError) {
            console.error(`Error saving lien release page ${page.pageNumber}:`, lienError);
            page.saveError = lienError.message;
          } else {
            page.savedRecord = lienRelease;
            page.redirect = { page: 'lien-releases.html', id: lienRelease.id };
          }

        } else if (page.documentType === DOCUMENT_TYPES.INVOICE) {
          // Similar saving logic for invoices if needed
          const invoiceData = page.data;

          // Get the split page buffer
                    const pages = await splitPDF(pdfBuffer);
          const pageBuffer = pages[page.pageNumber - 1]?.buffer;

          let pdf_url = null;
          const jobId = invoiceData.matchedJob?.id;
          const storagePath = invoiceData.standardizedFilename || `invoice_page${page.pageNumber}.pdf`;

          if (pageBuffer) {
            if (jobId) {
              const uploadResult = await uploadPDF(pageBuffer, storagePath, jobId);
              pdf_url = uploadResult.url;
            } else {
              const uploadResult = await uploadPDF(pageBuffer, `unassigned/${storagePath}`, null);
              pdf_url = uploadResult.url;
            }
          }

          // Create invoice record
          const { data: invoice, error: invError } = await supabase
            .from('v2_invoices')
            .insert({
              job_id: jobId || null,
              vendor_id: invoiceData.vendor?.id || null,
              po_id: invoiceData.po?.id || null,
              invoice_number: invoiceData.extracted?.invoiceNumber || `PAGE-${page.pageNumber}`,
              invoice_date: invoiceData.extracted?.invoiceDate || null,
              due_date: invoiceData.extracted?.dueDate || null,
              amount: invoiceData.extracted?.totalAmount || 0,
              pdf_url,
              status: 'needs_review',
              notes: invoiceData.messages?.join('\n') || '',
              ai_processed: true,
              ai_confidence: invoiceData.ai_confidence || null,
              ai_extracted_data: invoiceData.ai_extracted_data || null,
              needs_review: invoiceData.needs_review || false,
              review_flags: invoiceData.review_flags || null
            })
            .select()
            .single();

          if (invError) {
            console.error(`Error saving invoice page ${page.pageNumber}:`, invError);
            page.saveError = invError.message;
          } else {
            page.savedRecord = invoice;
            page.redirect = { page: 'index.html', id: invoice.id };

            // Store PDF hash for duplicate detection
            if (pageBuffer && invoice.id) {
              storePDFHash(invoice.id, pageBuffer).catch(err => {
                console.error('[HASH] Failed to store PDF hash for page:', err.message);
              });
            }
          }
        }
      } catch (saveErr) {
        console.error(`Error saving page ${page.pageNumber}:`, saveErr);
        page.saveError = saveErr.message;
      }
    }

    res.json({
      success: result.success,
      totalPages: result.totalPages,
      processedPages: result.processedPages,
      failedPages: result.failedPages,
      summary: result.summary,
      messages: result.messages
    });

  } catch (err) {
    console.error('Multi-page document processing error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Code invoice (assign job, vendor, PO, cost codes)
app.patch('/api/invoices/:id/code', async (req, res) => {
  try {
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
      console.error('[RESTAMP] Background re-stamp failed:', err.message);
    });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve invoice (with PDF stamping)
app.patch('/api/invoices/:id/approve', async (req, res) => {
  try {
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
      .eq('id', invoiceId)
      .single();

    if (getError) throw getError;

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
        console.error('Error getting/creating draft draw:', drawErr);
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
          console.log('[APPROVAL STAMP] Using PDF:', invoice.pdf_stamped_url ? 'pdf_stamped_url (progressive)' : 'pdf_url (original)');
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
        console.error('PDF stamping failed:', stampErr.message);
        // Continue without stamping
      }
    }

    // ==========================================
    // ADD INVOICE TO DRAFT DRAW
    // ==========================================

    if (draftDraw) {
      try {
        // Add invoice to draw (creates draw_allocations)
        await addInvoiceToDraw(invoiceId, draftDraw.id, approved_by);
        addedToDraw = true;

        console.log(`[APPROVAL] Invoice ${invoiceId} auto-added to Draw #${draftDraw.draw_number}`);
      } catch (drawErr) {
        console.error('Error adding invoice to draw:', drawErr);
        // Continue with approval even if draw add fails
      }
    }

    // Update invoice - status is now 'in_draw' if added to draw, otherwise 'approved'
    const newStatus = addedToDraw ? 'in_draw' : 'approved';

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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deny invoice - moves to archived 'denied' status
app.patch('/api/invoices/:id/deny', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { denied_by, denial_reason } = req.body;

    // Get current invoice to validate transition
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, status')
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
      .select()
      .single();

    if (error) throw error;

    await logActivity(invoiceId, 'denied', denied_by, { reason: denial_reason });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Close out invoice - write off remaining balance and mark as paid
app.post('/api/invoices/:id/close-out', async (req, res) => {
  try {
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
        console.error('[RECONCILE] Check failed:', err.message);
      });
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// SPLIT INVOICE ENDPOINTS
// ============================================================

/**
 * Split an invoice into multiple child invoices
 * POST /api/invoices/:id/split
 */
app.post('/api/invoices/:id/split', async (req, res) => {
  try {
    const { id } = req.params;
    const { splits, performed_by = 'System' } = req.body;

    // Validation: need at least 2 splits
    if (!splits || !Array.isArray(splits) || splits.length < 2) {
      return res.status(400).json({ error: 'At least 2 splits required' });
    }

    // Fetch parent invoice
    const { data: parent, error: fetchError } = await supabase
      .from('v2_invoices')
      .select('*, vendor:v2_vendors(id, name)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !parent) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Cannot split already-split invoice
    if (parent.parent_invoice_id || parent.is_split_parent) {
      return res.status(400).json({ error: 'Invoice is already part of a split' });
    }

    // Only split invoices in early statuses
    const splittableStatuses = ['received', 'needs_review', 'needs_approval', 'ready_for_approval'];
    if (!splittableStatuses.includes(parent.status)) {
      return res.status(400).json({ error: `Cannot split invoice in ${parent.status} status` });
    }

    // Validate amounts sum to original
    const totalSplit = splits.reduce((sum, s) => sum + parseFloat(s.amount || 0), 0);
    const parentAmount = parseFloat(parent.amount || 0);
    const isCredit = parentAmount < 0;

    if (Math.abs(totalSplit - parentAmount) > 0.01) {
      return res.status(400).json({
        error: `Split amounts ($${totalSplit.toFixed(2)}) must equal original amount ($${parentAmount.toFixed(2)})`
      });
    }

    // Validate each split has required fields (just amount, job/PO assigned later)
    for (let i = 0; i < splits.length; i++) {
      const split = splits[i];
      const splitAmount = parseFloat(split.amount);

      // Amount cannot be zero
      if (splitAmount === 0) {
        return res.status(400).json({ error: `Split ${i + 1}: Amount cannot be zero` });
      }

      // For credit invoices: splits must be negative
      // For standard invoices: splits must be positive
      if (isCredit && splitAmount > 0) {
        return res.status(400).json({ error: `Split ${i + 1}: Credit split amounts must be negative` });
      }
      if (!isCredit && splitAmount < 0) {
        return res.status(400).json({ error: `Split ${i + 1}: Amount must be positive` });
      }
    }

    // Get sibling count for invoice numbers
    const childInvoices = [];
    let splitIndex = 1;

    for (const split of splits) {
      // Generate child invoice number
      const baseNumber = parent.invoice_number || 'INV';
      const childInvoiceNumber = `${baseNumber}-${splitIndex}`;

      // Get job name if job_id provided
      let jobName = null;
      if (split.job_id) {
        const { data: job } = await supabase
          .from('v2_jobs')
          .select('name')
          .eq('id', split.job_id)
          .single();
        jobName = job?.name;
      }

      // Create child invoice (job optional, assigned now or during review)
      const { data: child, error: insertError } = await supabase
        .from('v2_invoices')
        .insert({
          parent_invoice_id: id,
          split_index: splitIndex,
          invoice_number: childInvoiceNumber,
          invoice_date: parent.invoice_date,
          due_date: parent.due_date,
          vendor_id: parent.vendor_id,
          job_id: split.job_id || null, // Optional - can assign now or during review
          po_id: null,  // Assigned during review
          amount: split.amount,
          original_amount: split.amount,
          status: 'needs_review', // Children start fresh in pipeline
          pdf_url: parent.pdf_url, // Share same PDF
          pdf_stamped_url: null, // Will get stamped
          notes: split.notes || `Split ${splitIndex} of ${splits.length} from ${parent.invoice_number}`,
          ai_processed: false,
          needs_review: true,
          review_flags: split.job_id ? ['split_child'] : ['split_child', 'no_job'],
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating split child:', insertError);
        return res.status(500).json({ error: `Failed to create split ${splitIndex}: ${insertError.message}` });
      }

      // Log activity on child
      await logActivity(child.id, 'created_from_split', performed_by, {
        parent_invoice_id: id,
        parent_invoice_number: parent.invoice_number,
        split_index: splitIndex,
        total_splits: splits.length,
        amount: split.amount,
        job_id: split.job_id || null,
        job_name: jobName
      });

      // === STAMP THE CHILD PDF ===
      try {
        if (parent.pdf_url) {
          // Extract storage path from URL
          const urlParts = parent.pdf_url.split('/invoices/');
          if (urlParts.length > 1) {
            const storagePath = urlParts[1].split('?')[0]; // Remove query params

            const pdfBuffer = await downloadPDF(storagePath);

            // Stamp with split info (include job if provided)
            const stampedBuffer = await stampSplit(pdfBuffer, {
              splitIndex: splitIndex,
              splitTotal: splits.length,
              splitDate: new Date().toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', year: 'numeric'
              }),
              originalInvoiceNumber: parent.invoice_number,
              originalAmount: parent.amount,
              thisAmount: split.amount,
              notes: split.notes || null,
              jobName: jobName  // Include job if assigned
            });

            // Upload stamped PDF (to job folder if assigned, otherwise unassigned)
            const stampedFileName = `${split.job_id || 'unassigned'}/${Date.now()}_${childInvoiceNumber.replace(/[^a-zA-Z0-9.-]/g, '_')}_split.pdf`;
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('invoices')
              .upload(stampedFileName, stampedBuffer, {
                contentType: 'application/pdf',
                upsert: true
              });

            if (!uploadError) {
              const { data: urlData } = supabase.storage
                .from('invoices')
                .getPublicUrl(stampedFileName);

              const stampedUrl = `${urlData.publicUrl}?t=${Date.now()}`;

              // Update child with stamped URL
              await supabase
                .from('v2_invoices')
                .update({ pdf_stamped_url: stampedUrl })
                .eq('id', child.id);

              child.pdf_stamped_url = stampedUrl;
              console.log(`[SPLIT] Stamped PDF for split ${splitIndex}: ${stampedUrl}`);
            } else {
              console.error(`[SPLIT] Failed to upload stamped PDF for split ${splitIndex}:`, uploadError);
            }
          }
        }
      } catch (stampError) {
        console.error(`[SPLIT] Error stamping split ${splitIndex}:`, stampError);
        // Continue even if stamping fails - invoice is still valid
      }

      childInvoices.push(child);
      splitIndex++;
    }

    // Update parent to be a container
    const { error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        is_split_parent: true,
        original_amount: parent.amount,
        status: 'split',
        notes: `Split into ${splits.length} invoices on ${new Date().toLocaleDateString()}`
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating parent:', updateError);
    }

    // Log activity on parent
    await logActivity(id, 'split', performed_by, {
      child_count: splits.length,
      child_ids: childInvoices.map(c => c.id),
      child_numbers: childInvoices.map(c => c.invoice_number),
      amounts: splits.map(s => s.amount)
    });

    // Broadcast update
    broadcast('invoice_split', {
      parent_id: id,
      parent_number: parent.invoice_number,
      children: childInvoices.map(c => ({ id: c.id, invoice_number: c.invoice_number, amount: c.amount }))
    });

    res.json({
      success: true,
      parent_id: id,
      children: childInvoices,
      message: `Invoice split into ${childInvoices.length} parts`
    });
  } catch (err) {
    console.error('Error splitting invoice:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Unsplit an invoice - delete children and restore parent
 * POST /api/invoices/:id/unsplit
 */
app.post('/api/invoices/:id/unsplit', async (req, res) => {
  try {
    const { id } = req.params;
    const { performed_by = 'System' } = req.body;

    // Fetch parent invoice
    const { data: parent, error: fetchError } = await supabase
      .from('v2_invoices')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !parent) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Must be a split parent
    if (!parent.is_split_parent) {
      return res.status(400).json({ error: 'Invoice is not a split parent' });
    }

    // Get all children
    const { data: children, error: childError } = await supabase
      .from('v2_invoices')
      .select('id, invoice_number, status, pdf_stamped_url')
      .eq('parent_invoice_id', id)
      .is('deleted_at', null);

    if (childError) {
      return res.status(500).json({ error: 'Failed to fetch child invoices' });
    }

    // Check if any children have progressed too far (approved, in_draw, paid)
    const blockedStatuses = ['approved', 'in_draw', 'paid'];
    const blockedChildren = children.filter(c => blockedStatuses.includes(c.status));
    if (blockedChildren.length > 0) {
      return res.status(400).json({
        error: `Cannot unsplit: ${blockedChildren.length} child invoice(s) have already been approved or added to a draw`,
        blocked_children: blockedChildren.map(c => ({ id: c.id, invoice_number: c.invoice_number, status: c.status }))
      });
    }

    // Delete all children (soft delete) and clean up their stamped PDFs
    const childIds = children.map(c => c.id);
    if (childIds.length > 0) {
      // First, delete stamped PDFs from storage to prevent orphaned files
      for (const child of children) {
        if (child.pdf_stamped_url) {
          try {
            await deleteByUrl(child.pdf_stamped_url);
            console.log('[UNSPLIT] Deleted stamped PDF for child:', child.id);
          } catch (err) {
            console.error('[UNSPLIT] Failed to delete stamped PDF for child:', child.id, err.message);
            // Continue even if delete fails
          }
        }
      }

      // Soft delete the child invoices
      const { error: deleteError } = await supabase
        .from('v2_invoices')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', childIds);

      if (deleteError) {
        console.error('Error deleting children:', deleteError);
        return res.status(500).json({ error: 'Failed to delete child invoices' });
      }

      // Log activity on each child
      for (const child of children) {
        await logActivity(child.id, 'deleted_unsplit', performed_by, {
          parent_invoice_id: id,
          reason: 'Parent invoice unsplit'
        });
      }
    }

    // Restore parent to original state
    const { error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        is_split_parent: false,
        status: 'needs_review', // Back to review
        notes: parent.notes ? `${parent.notes}\n\nUnsplit on ${new Date().toLocaleDateString()}` : `Unsplit on ${new Date().toLocaleDateString()}`
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error restoring parent:', updateError);
      return res.status(500).json({ error: 'Failed to restore parent invoice' });
    }

    // Log activity on parent
    await logActivity(id, 'unsplit', performed_by, {
      deleted_child_count: children.length,
      deleted_child_ids: childIds,
      deleted_child_numbers: children.map(c => c.invoice_number)
    });

    // Broadcast update
    broadcast('invoice_unsplit', {
      parent_id: id,
      deleted_children: childIds
    });

    res.json({
      success: true,
      parent_id: id,
      deleted_children: childIds.length,
      message: `Invoice unsplit - ${childIds.length} child invoice(s) removed`
    });
  } catch (err) {
    console.error('Error unsplitting invoice:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * Get all invoices in a family (parent + children)
 * GET /api/invoices/:id/family
 */
app.get('/api/invoices/:id/family', async (req, res) => {
  try {
    const { id } = req.params;

    // Get the invoice to determine family structure
    const { data: invoice, error: invError } = await supabase
      .from('v2_invoices')
      .select('id, parent_invoice_id, is_split_parent')
      .eq('id', id)
      .single();

    if (invError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    // Determine family root
    const rootId = invoice.is_split_parent ? id : (invoice.parent_invoice_id || id);

    // If no parent and not a split parent, this is a standalone invoice
    if (!invoice.parent_invoice_id && !invoice.is_split_parent) {
      return res.json({
        is_split: false,
        parent: null,
        children: []
      });
    }

    // Get parent
    const { data: parent } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name)
      `)
      .eq('id', rootId)
      .single();

    // Get children
    const { data: children } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, job_change_order_id)
      `)
      .eq('parent_invoice_id', rootId)
      .is('deleted_at', null)
      .order('split_index');

    res.json({
      is_split: true,
      parent,
      children: children || []
    });
  } catch (err) {
    console.error('Error fetching invoice family:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark invoice as paid to vendor
app.patch('/api/invoices/:id/pay', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { payment_method, payment_reference, payment_date, payment_amount } = req.body;

    // Validate required fields
    if (!payment_method) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    const validMethods = ['check', 'ach', 'wire', 'credit_card', 'cash', 'other'];
    if (!validMethods.includes(payment_method)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Get current invoice
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, status, amount, paid_to_vendor')
      .eq('id', invoiceId)
      .single();

    if (getError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (invoice.paid_to_vendor) {
      return res.status(400).json({ error: 'Invoice has already been marked as paid' });
    }

    // Determine payment amount (default to invoice amount if not specified)
    const paidAmount = payment_amount !== undefined ? parseFloat(payment_amount) : parseFloat(invoice.amount || 0);

    // Update invoice with payment info
    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        paid_to_vendor: true,
        paid_to_vendor_date: payment_date || new Date().toISOString().split('T')[0],
        paid_to_vendor_amount: paidAmount,
        paid_to_vendor_ref: payment_reference || null
      })
      .eq('id', invoiceId)
      .select(`
        *,
        vendor:v2_vendors(*),
        job:v2_jobs(id, name)
      `)
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(invoiceId, 'paid_to_vendor', 'System', {
      payment_method,
      payment_reference,
      payment_amount: paidAmount,
      payment_date: payment_date || new Date().toISOString().split('T')[0]
    });

    res.json(updated);
  } catch (err) {
    console.error('Error marking invoice as paid:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unmark invoice as paid to vendor
app.patch('/api/invoices/:id/unpay', async (req, res) => {
  try {
    const invoiceId = req.params.id;

    // Get current invoice
    const { data: invoice, error: getError } = await supabase
      .from('v2_invoices')
      .select('id, paid_to_vendor')
      .eq('id', invoiceId)
      .single();

    if (getError || !invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    if (!invoice.paid_to_vendor) {
      return res.status(400).json({ error: 'Invoice is not marked as paid' });
    }

    // Clear payment info
    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        paid_to_vendor: false,
        paid_to_vendor_date: null,
        paid_to_vendor_amount: null,
        paid_to_vendor_ref: null
      })
      .eq('id', invoiceId)
      .select(`
        *,
        vendor:v2_vendors(*),
        job:v2_jobs(id, name)
      `)
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(invoiceId, 'unpaid', 'System', {});

    res.json(updated);
  } catch (err) {
    console.error('Error unmarking invoice as paid:', err);
    res.status(500).json({ error: err.message });
  }
});

// Allocate invoice to cost codes
app.post('/api/invoices/:id/allocate', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { allocations } = req.body;

    // Get invoice to check remaining amount
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

      // Calculate new allocation total
      const allocationTotal = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

      // Validate: allocation cannot exceed remaining amount
      if (allocationTotal > remainingAmount + 0.01) {
        return res.status(400).json({
          error: `Allocation total ($${allocationTotal.toFixed(2)}) exceeds remaining amount ($${remainingAmount.toFixed(2)}). This invoice has already been billed $${alreadyBilled.toFixed(2)}.`
        });
      }
    }

    // Get OLD allocations to subtract their PO/CO amounts before deleting
    const { data: oldAllocations } = await supabase
      .from('v2_invoice_allocations')
      .select('id, amount, po_id, po_line_item_id, change_order_id')
      .eq('invoice_id', invoiceId);

    // Subtract old PO amounts
    const oldPoAllocations = (oldAllocations || []).filter(a => a.po_id);
    for (const alloc of oldPoAllocations) {
      await updatePOLineItemsForAllocations(alloc.po_id, [alloc], false);
    }

    // Subtract old CO amounts
    const oldCoAllocations = (oldAllocations || []).filter(a => a.change_order_id);
    for (const alloc of oldCoAllocations) {
      const { data: coData } = await supabase
        .from('v2_job_change_orders')
        .select('invoiced_amount')
        .eq('id', alloc.change_order_id)
        .single();
      if (coData) {
        const newAmount = Math.max(0, (parseFloat(coData.invoiced_amount) || 0) - (parseFloat(alloc.amount) || 0));
        await supabase
          .from('v2_job_change_orders')
          .update({ invoiced_amount: newAmount })
          .eq('id', alloc.change_order_id);
      }
    }

    // Now delete old allocations
    await supabase
      .from('v2_invoice_allocations')
      .delete()
      .eq('invoice_id', invoiceId);

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

      // Update PO invoiced amounts for allocations linked to POs
      const poAllocations = allocations.filter(a => a.po_id);
      if (poAllocations.length > 0) {
        await updatePOInvoicedAmounts(poAllocations);
      }

      // Update CO invoiced amounts for allocations linked to COs
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
// BUDGET API
// ============================================================

app.get('/api/jobs/:id/budget', async (req, res) => {
  try {
    const jobId = req.params.id;

    const { data: budgetLines, error: budgetError } = await supabase
      .from('v2_budget_lines')
      .select(`
        *,
        cost_code:v2_cost_codes(id, code, name, category)
      `)
      .eq('job_id', jobId)
      .order('cost_code(code)');

    if (budgetError) throw budgetError;

    // Get allocations from approved+ invoices
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount,
        cost_code_id,
        invoice:v2_invoices!inner(job_id, status)
      `)
      .eq('invoice.job_id', jobId)
      .in('invoice.status', ['approved', 'in_draw', 'paid']);

    const actualsByCostCode = {};
    if (allocations) {
      allocations.forEach(a => {
        if (!actualsByCostCode[a.cost_code_id]) {
          actualsByCostCode[a.cost_code_id] = { billed: 0, paid: 0 };
        }
        actualsByCostCode[a.cost_code_id].billed += parseFloat(a.amount) || 0;
        if (a.invoice.status === 'paid') {
          actualsByCostCode[a.cost_code_id].paid += parseFloat(a.amount) || 0;
        }
      });
    }

    const result = budgetLines.map(bl => ({
      ...bl,
      actual_billed: actualsByCostCode[bl.cost_code_id]?.billed || 0,
      actual_paid: actualsByCostCode[bl.cost_code_id]?.paid || 0,
      variance: (parseFloat(bl.budgeted_amount) || 0) - (actualsByCostCode[bl.cost_code_id]?.billed || 0)
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full budget summary for a job (for Budget page)
app.get('/api/jobs/:id/budget-summary', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get job info
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    // Get budget lines with cost code info
    const { data: budgetLines, error: budgetError } = await supabase
      .from('v2_budget_lines')
      .select(`
        *,
        cost_code:v2_cost_codes(id, code, name, category)
      `)
      .eq('job_id', jobId);

    if (budgetError) throw budgetError;

    // Get all cost codes (for lines without budget)
    const { data: allCostCodes } = await supabase
      .from('v2_cost_codes')
      .select('id, code, name, category')
      .order('code');

    // Get invoices that are linked to job change orders (PCCOs) - these are CO work, not base budget
    const { data: coInvoiceLinks } = await supabase
      .from('v2_change_order_invoices')
      .select(`
        invoice_id,
        change_order:v2_job_change_orders!inner(job_id)
      `)
      .eq('change_order.job_id', jobId);

    const coInvoiceIds = new Set((coInvoiceLinks || []).map(link => link.invoice_id));

    // Get allocations from all invoices for this job (include po_id to check if linked to PO)
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        amount,
        cost_code_id,
        cost_code:v2_cost_codes(id, code, name),
        invoice:v2_invoices!inner(id, job_id, status, po_id)
      `)
      .eq('invoice.job_id', jobId);

    // Filter out allocations from invoices linked to change orders (base budget only)
    const baseBudgetAllocations = (allocations || []).filter(a => !coInvoiceIds.has(a.invoice.id));

    // Get committed amounts from POs (only sent or approved POs commit to budget)
    const { data: poLines } = await supabase
      .from('v2_po_line_items')
      .select(`
        amount,
        cost_code_id,
        po:v2_purchase_orders!inner(job_id, status, status_detail, approval_status)
      `)
      .eq('po.job_id', jobId)
      .neq('po.status', 'cancelled')
      .or('status_detail.eq.sent,status_detail.eq.approved,approval_status.eq.approved', { foreignTable: 'po' });

    // Build actuals, committed, and pending by cost code
    const actualsByCostCode = {};
    const committedByCostCode = {};
    const pendingByCostCode = {};
    const poAmountByCostCode = {};  // Track PO amounts separately to know PO coverage

    // First, add PO line items to committed and track PO coverage
    if (poLines) {
      poLines.forEach(pl => {
        const ccId = pl.cost_code_id;
        if (!committedByCostCode[ccId]) committedByCostCode[ccId] = 0;
        if (!poAmountByCostCode[ccId]) poAmountByCostCode[ccId] = 0;
        const amount = parseFloat(pl.amount) || 0;
        committedByCostCode[ccId] += amount;
        poAmountByCostCode[ccId] += amount;  // Track PO amount for coverage
      });
    }

    // Process invoice allocations (base budget only - excludes CO invoices)
    if (baseBudgetAllocations) {
      baseBudgetAllocations.forEach(a => {
        const ccId = a.cost_code_id;
        if (!actualsByCostCode[ccId]) {
          actualsByCostCode[ccId] = { billed: 0, paid: 0, approved: 0, costCode: a.cost_code };
        }

        const amount = parseFloat(a.amount) || 0;

        // Track pending invoices (ready_for_approval, needs_review)
        if (['ready_for_approval', 'needs_review'].includes(a.invoice.status)) {
          if (!pendingByCostCode[ccId]) pendingByCostCode[ccId] = 0;
          pendingByCostCode[ccId] += amount;
        }

        // Track approved invoices (approved, in_draw) - not yet paid but committed
        if (['approved', 'in_draw'].includes(a.invoice.status)) {
          actualsByCostCode[ccId].approved += amount;
          actualsByCostCode[ccId].billed += amount;

          // Add to committed if invoice is NOT linked to a PO (to avoid double counting)
          if (!a.invoice.po_id) {
            if (!committedByCostCode[ccId]) committedByCostCode[ccId] = 0;
            committedByCostCode[ccId] += amount;
          }
        }

        // Track paid invoices
        if (a.invoice.status === 'paid') {
          actualsByCostCode[ccId].paid += amount;
          actualsByCostCode[ccId].billed += amount;

          // Add to committed if invoice is NOT linked to a PO (to avoid double counting)
          if (!a.invoice.po_id) {
            if (!committedByCostCode[ccId]) committedByCostCode[ccId] = 0;
            committedByCostCode[ccId] += amount;
          }
        }
      });
    }

    // Build budget map
    const budgetMap = {};
    (budgetLines || []).forEach(bl => {
      budgetMap[bl.cost_code_id] = {
        budgeted: parseFloat(bl.budgeted_amount) || 0,
        costCode: bl.cost_code?.code || '',
        description: bl.cost_code?.name || '',
        category: bl.cost_code?.category || 'Uncategorized',
        closedAt: bl.closed_at || null,
        closedBy: bl.closed_by || null,
        notes: bl.notes || null
      };
    });

    // Build cost code lookup for category info
    const costCodeLookup = {};
    (allCostCodes || []).forEach(cc => {
      costCodeLookup[cc.id] = cc;
    });

    // Combine all cost codes that have any activity
    const allCostCodeIds = new Set();
    Object.keys(budgetMap).forEach(id => allCostCodeIds.add(id));
    Object.keys(actualsByCostCode).forEach(id => allCostCodeIds.add(id));
    Object.keys(committedByCostCode).forEach(id => allCostCodeIds.add(id));
    Object.keys(pendingByCostCode).forEach(id => allCostCodeIds.add(id));

    // Build result lines (filter out lines with no activity unless they have budget)
    const hideEmpty = req.query.hideEmpty !== 'false'; // Default to hiding empty lines
    const lines = [];
    allCostCodeIds.forEach(ccId => {
      const budget = budgetMap[ccId] || {};
      const actuals = actualsByCostCode[ccId] || { billed: 0, paid: 0, approved: 0 };
      const costCodeInfo = costCodeLookup[ccId] || {};
      const costCode = budget.costCode || costCodeInfo.code || '';
      const description = budget.description || costCodeInfo.name || '';
      const category = budget.category || costCodeInfo.category || 'Uncategorized';

      const budgeted = budget.budgeted || 0;
      const committed = committedByCostCode[ccId] || 0;
      const pending = pendingByCostCode[ccId] || 0;
      const poAmount = poAmountByCostCode[ccId] || 0;
      const hasPOCoverage = poAmount > 0;
      const billed = actuals.billed;
      const paid = actuals.paid;
      const approved = actuals.approved;

      // Skip empty lines unless hideEmpty is disabled
      if (hideEmpty && budgeted === 0 && committed === 0 && billed === 0 && paid === 0 && pending === 0) {
        return;
      }

      // Projected cost logic:
      // - Closed lines: use actual (we know final cost, locks in under/over)
      // - Open lines: assume full budget unless already over (conservative)
      // Underages only recognized when line is closed
      // Overages show immediately when committed > budget
      let projected;
      if (budget.closedAt) {
        // Closed - we know the final cost
        projected = committed + pending;
      } else {
        // Open - assume full budget, but show overage if already over
        projected = Math.max(budgeted, committed + pending);
      }

      // Variance = Budget - Committed - Pending - Paid (conservative view)
      // Shows how much budget remains after all known activity
      const variance = budgeted - committed - pending;

      // % Complete = (Committed + Pending + Paid) / Budget
      // Note: Paid is included in committed for non-PO invoices, so use committed + pending
      const percentComplete = budgeted > 0 ? ((committed + pending) / budgeted) * 100 : 0;

      lines.push({
        costCodeId: ccId,
        costCode,
        description,
        category,
        budgeted,
        committed,
        pending,
        poAmount,
        hasPOCoverage,
        paid,
        approved,
        billed,
        projected,
        variance,
        percentComplete,
        closedAt: budget.closedAt || null,
        closedBy: budget.closedBy || null,
        notes: budget.notes || null
      });
    });

    // Sort by cost code
    lines.sort((a, b) => (a.costCode || '').localeCompare(b.costCode || ''));

    // Calculate totals
    const totals = lines.reduce((acc, line) => ({
      budgeted: acc.budgeted + line.budgeted,
      committed: acc.committed + line.committed,
      pending: acc.pending + line.pending,
      billed: acc.billed + line.billed,
      paid: acc.paid + line.paid,
      projected: acc.projected + line.projected,
      poAmount: acc.poAmount + (line.poAmount || 0),
      budgetWithPO: acc.budgetWithPO + (line.hasPOCoverage ? line.budgeted : 0),
      linesWithPO: acc.linesWithPO + (line.hasPOCoverage ? 1 : 0),
      linesClosed: acc.linesClosed + (line.closedAt ? 1 : 0),
      budgetClosed: acc.budgetClosed + (line.closedAt ? line.budgeted : 0)
    }), { budgeted: 0, committed: 0, pending: 0, billed: 0, paid: 0, projected: 0, poAmount: 0, budgetWithPO: 0, linesWithPO: 0, linesClosed: 0, budgetClosed: 0 });

    // Variance = Budget - Committed - Pending (conservative - shows remaining budget)
    totals.variance = totals.budgeted - totals.committed - totals.pending;
    totals.remaining = totals.budgeted - totals.billed;
    // % Complete based on committed + pending vs budget
    totals.percentComplete = totals.budgeted > 0 ? ((totals.committed + totals.pending) / totals.budgeted) * 100 : 0;

    // PO Coverage stats
    totals.totalLines = lines.length;
    totals.poCoveragePercent = totals.budgeted > 0 ? (totals.budgetWithPO / totals.budgeted) * 100 : 0;
    totals.knownCoveragePercent = totals.budgeted > 0 ? ((totals.budgetWithPO + totals.budgetClosed) / totals.budgeted) * 100 : 0;

    // Get PO change orders for this job
    const { data: poChangeOrders } = await supabase
      .from('v2_change_orders')
      .select(`
        id, change_order_number, description, reason, amount_change, status, approved_at, created_at,
        po:v2_purchase_orders!inner(id, po_number, job_id, vendor:v2_vendors(id, name))
      `)
      .eq('po.job_id', jobId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    // Get job-level change orders (PCCOs - Prime Contract Change Orders)
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', jobId)
      .order('change_order_number');

    // Calculate PO change order totals (only approved ones affect subcontract costs)
    const approvedPOCOs = (poChangeOrders || []).filter(co => co.status === 'approved');
    const poChangeOrderTotal = approvedPOCOs.reduce((sum, co) => sum + (parseFloat(co.amount_change) || 0), 0);

    // Calculate job change order totals (PCCOs - affect contract with owner)
    const approvedPCCOs = (jobChangeOrders || []).filter(co => co.status === 'approved');
    const pccoTotal = approvedPCCOs.reduce((sum, co) => sum + (parseFloat(co.amount) || 0), 0);

    // Totals
    totals.poChangeOrderTotal = poChangeOrderTotal;  // Changes to subcontract costs
    totals.changeOrderTotal = pccoTotal;             // Changes to owner contract (PCCO)
    totals.adjustedContract = (parseFloat(job?.contract_amount) || totals.budgeted) + pccoTotal;

    // Projected variance: positive = under budget, negative = over budget
    totals.projectedVariance = totals.budgeted - totals.projected;

    res.json({
      job,
      lines,
      totals,
      changeOrders: poChangeOrders || [],
      jobChangeOrders: jobChangeOrders || []
    });
  } catch (err) {
    console.error('Budget summary error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get cost code details (invoices, POs) for a specific job and cost code
app.get('/api/jobs/:jobId/cost-code/:costCodeId/details', async (req, res) => {
  try {
    const { jobId, costCodeId } = req.params;

    // Get cost code info
    const { data: costCode, error: ccError } = await supabase
      .from('v2_cost_codes')
      .select('*')
      .eq('id', costCodeId)
      .single();

    if (ccError) throw ccError;

    // Get budget line for this job/cost code
    const { data: budgetLine } = await supabase
      .from('v2_budget_lines')
      .select('*')
      .eq('job_id', jobId)
      .eq('cost_code_id', costCodeId)
      .single();

    // Get invoices with allocations to this cost code for this job
    const { data: allocations, error: allocError } = await supabase
      .from('v2_invoice_allocations')
      .select(`
        id,
        amount,
        notes,
        invoice:v2_invoices!inner(
          id,
          invoice_number,
          invoice_date,
          amount,
          status,
          po_id,
          vendor:v2_vendors(id, name)
        )
      `)
      .eq('job_id', jobId)
      .eq('cost_code_id', costCodeId);

    if (allocError) throw allocError;

    // Get POs with line items for this cost code
    const { data: poLineItems, error: poError } = await supabase
      .from('v2_po_line_items')
      .select(`
        id,
        description,
        amount,
        invoiced_amount,
        po:v2_purchase_orders!inner(
          id,
          po_number,
          description,
          total_amount,
          status,
          status_detail,
          approval_status,
          vendor:v2_vendors(id, name)
        )
      `)
      .eq('po.job_id', jobId)
      .eq('cost_code_id', costCodeId);

    if (poError) throw poError;

    // Calculate totals
    let totalBilled = 0;
    let totalPaid = 0;
    const invoices = [];

    (allocations || []).forEach(a => {
      if (['approved', 'in_draw', 'paid'].includes(a.invoice.status)) {
        totalBilled += parseFloat(a.amount) || 0;
      }
      if (a.invoice.status === 'paid') {
        totalPaid += parseFloat(a.amount) || 0;
      }
      invoices.push({
        id: a.invoice.id,
        invoiceNumber: a.invoice.invoice_number,
        invoiceDate: a.invoice.invoice_date,
        vendorName: a.invoice.vendor?.name || 'Unknown',
        totalAmount: parseFloat(a.invoice.amount) || 0,
        allocatedAmount: parseFloat(a.amount) || 0,
        status: a.invoice.status,
        poId: a.invoice.po_id,
        notes: a.notes
      });
    });

    // Build PO list
    let totalCommitted = 0;
    const pos = [];
    const seenPoIds = new Set();

    (poLineItems || []).forEach(pl => {
      const po = pl.po;
      // Only count sent/approved POs as committed
      if (['sent', 'approved'].includes(po.status_detail) || po.approval_status === 'approved') {
        totalCommitted += parseFloat(pl.amount) || 0;
      }

      if (!seenPoIds.has(po.id)) {
        seenPoIds.add(po.id);
        pos.push({
          id: po.id,
          poNumber: po.po_number,
          vendorName: po.vendor?.name || 'Unknown',
          description: po.description,
          totalAmount: parseFloat(po.total_amount) || 0,
          status: po.status,
          statusDetail: po.status_detail,
          lineItems: []
        });
      }

      // Add line item to PO
      const poEntry = pos.find(p => p.id === po.id);
      if (poEntry) {
        poEntry.lineItems.push({
          id: pl.id,
          description: pl.description,
          amount: parseFloat(pl.amount) || 0,
          invoicedAmount: parseFloat(pl.invoiced_amount) || 0
        });
      }
    });

    // Calculate line item totals for each PO (just for this cost code)
    pos.forEach(po => {
      po.costCodeAmount = po.lineItems.reduce((sum, li) => sum + li.amount, 0);
      po.costCodeInvoiced = po.lineItems.reduce((sum, li) => sum + li.invoicedAmount, 0);
    });

    res.json({
      costCode: {
        id: costCode.id,
        code: costCode.code,
        name: costCode.name,
        category: costCode.category
      },
      budget: {
        budgeted: parseFloat(budgetLine?.budgeted_amount) || 0,
        committed: totalCommitted,
        billed: totalBilled,
        paid: totalPaid,
        remaining: (parseFloat(budgetLine?.budgeted_amount) || 0) - totalBilled
      },
      invoices,
      purchaseOrders: pos
    });

  } catch (err) {
    console.error('Cost code details error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Close out a budget line (lock in savings)
app.post('/api/jobs/:jobId/budget/:costCodeId/close', async (req, res) => {
  try {
    const { jobId, costCodeId } = req.params;
    const { closed_by, notes } = req.body;

    // Check if budget line exists
    const { data: existing } = await supabase
      .from('v2_budget_lines')
      .select('id, closed_at')
      .eq('job_id', jobId)
      .eq('cost_code_id', costCodeId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Budget line not found' });
    }

    if (existing.closed_at) {
      return res.status(400).json({ error: 'Budget line is already closed' });
    }

    // Close the budget line
    const { data, error } = await supabase
      .from('v2_budget_lines')
      .update({
        closed_at: new Date().toISOString(),
        closed_by: closed_by || 'Unknown',
        notes: notes || null
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, budgetLine: data });
  } catch (err) {
    console.error('Close budget line error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reopen a closed budget line
app.post('/api/jobs/:jobId/budget/:costCodeId/reopen', async (req, res) => {
  try {
    const { jobId, costCodeId } = req.params;

    // Check if budget line exists and is closed
    const { data: existing } = await supabase
      .from('v2_budget_lines')
      .select('id, closed_at')
      .eq('job_id', jobId)
      .eq('cost_code_id', costCodeId)
      .single();

    if (!existing) {
      return res.status(404).json({ error: 'Budget line not found' });
    }

    if (!existing.closed_at) {
      return res.status(400).json({ error: 'Budget line is not closed' });
    }

    // Reopen the budget line
    const { data, error } = await supabase
      .from('v2_budget_lines')
      .update({
        closed_at: null,
        closed_by: null
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, budgetLine: data });
  } catch (err) {
    console.error('Reopen budget line error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Import budget from Excel
app.post('/api/jobs/:id/budget/import', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { lines } = req.body;

    if (!lines || !Array.isArray(lines)) {
      return res.status(400).json({ error: 'Invalid budget data' });
    }

    // Get all cost codes
    const { data: costCodes } = await supabase
      .from('v2_cost_codes')
      .select('id, code, name');

    const costCodeMap = {};
    costCodes.forEach(cc => {
      costCodeMap[cc.code] = cc;
    });

    let imported = 0;
    let created = 0;

    for (const line of lines) {
      let costCode = costCodeMap[line.costCode];

      // Create cost code if it doesn't exist
      if (!costCode && line.costCode) {
        const { data: newCostCode, error: ccError } = await supabase
          .from('v2_cost_codes')
          .insert({
            code: line.costCode,
            name: line.description || line.costCode,
            category: 'Imported'
          })
          .select()
          .single();

        if (!ccError && newCostCode) {
          costCode = newCostCode;
          costCodeMap[line.costCode] = costCode;
          created++;
        }
      }

      if (costCode) {
        // Check if budget line exists
        const { data: existing } = await supabase
          .from('v2_budget_lines')
          .select('id')
          .eq('job_id', jobId)
          .eq('cost_code_id', costCode.id)
          .single();

        if (existing) {
          // Update existing
          await supabase
            .from('v2_budget_lines')
            .update({ budgeted_amount: line.budgeted || 0 })
            .eq('id', existing.id);
        } else {
          // Insert new
          await supabase
            .from('v2_budget_lines')
            .insert({
              job_id: jobId,
              cost_code_id: costCode.id,
              budgeted_amount: line.budgeted || 0,
              committed_amount: 0,
              billed_amount: 0,
              paid_amount: 0
            });
        }
        imported++;
      }
    }

    res.json({ success: true, imported, costCodesCreated: created });
  } catch (err) {
    console.error('Budget import error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Export budget to Excel
app.get('/api/jobs/:id/budget/export', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get job
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    // Get budget summary
    const budgetRes = await fetch(`http://localhost:${PORT}/api/jobs/${jobId}/budget-summary`);
    const budgetData = await budgetRes.json();

    // Create workbook
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Budget');

    // Header
    sheet.mergeCells('A1:I1');
    sheet.getCell('A1').value = `Budget - ${job.name}`;
    sheet.getCell('A1').font = { bold: true, size: 16 };

    // Column headers
    sheet.addRow([]);
    sheet.addRow(['Cost Code', 'Description', 'Budget', 'Committed', 'Billed', 'Paid', '%', 'Remaining', 'Variance']);
    const headerRow = sheet.getRow(3);
    headerRow.font = { bold: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    });

    // Data rows
    budgetData.lines.forEach(line => {
      const remaining = line.budgeted - line.billed;
      const variance = line.budgeted - line.billed;
      const pct = line.budgeted > 0 ? (line.billed / line.budgeted) * 100 : 0;

      sheet.addRow([
        line.costCode,
        line.description,
        line.budgeted,
        line.committed,
        line.billed,
        line.paid,
        pct / 100,
        remaining,
        variance
      ]);
    });

    // Totals row
    const totalsRow = sheet.addRow([
      'TOTAL',
      '',
      budgetData.totals.budgeted,
      budgetData.totals.committed,
      budgetData.totals.billed,
      budgetData.totals.paid,
      budgetData.totals.percentComplete / 100,
      budgetData.totals.remaining,
      budgetData.totals.budgeted - budgetData.totals.billed
    ]);
    totalsRow.font = { bold: true };

    // Format currency columns
    ['C', 'D', 'E', 'F', 'H', 'I'].forEach(col => {
      sheet.getColumn(col).numFmt = '"$"#,##0.00';
      sheet.getColumn(col).width = 15;
    });
    sheet.getColumn('G').numFmt = '0.0%';
    sheet.getColumn('A').width = 12;
    sheet.getColumn('B').width = 30;

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Budget-${job.name.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Budget export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DRAWS API
// ============================================================

// List all draws across all jobs
app.get('/api/draws', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_draws')
      .select(`
        *,
        job:v2_jobs(id, name),
        invoices:v2_draw_invoices(
          invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(name))
        )
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get CO billings for all draws
    const drawIds = data.map(d => d.id);
    const { data: coBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('draw_id, amount')
      .in('draw_id', drawIds.length > 0 ? drawIds : ['00000000-0000-0000-0000-000000000000']);

    // Calculate total amount for each draw (invoices + CO billings)
    const drawsWithTotals = data.map(draw => {
      const invoiceTotal = draw.invoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
      const coTotal = (coBillings || [])
        .filter(b => b.draw_id === draw.id)
        .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      return {
        ...draw,
        total_amount: invoiceTotal + coTotal,
        invoice_total: invoiceTotal,
        co_total: coTotal
      };
    });

    res.json(drawsWithTotals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/jobs/:id/draws', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_draws')
      .select(`
        *,
        invoices:v2_draw_invoices(
          invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(name))
        )
      `)
      .eq('job_id', req.params.id)
      .order('draw_number', { ascending: false });

    if (error) throw error;

    // Get CO billings for all draws
    const drawIds = data.map(d => d.id);
    const { data: coBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('draw_id, amount')
      .in('draw_id', drawIds);

    // Calculate total amount for each draw (invoices + CO billings)
    const drawsWithTotals = data.map(draw => {
      const invoiceTotal = draw.invoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
      const coTotal = (coBillings || [])
        .filter(b => b.draw_id === draw.id)
        .reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      return {
        ...draw,
        total_amount: invoiceTotal + coTotal,
        invoice_total: invoiceTotal,
        co_total: coTotal
      };
    });

    res.json(drawsWithTotals);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single draw with full data for G702/G703 view
app.get('/api/draws/:id', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Get draw with job info
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`
        *,
        job:v2_jobs(id, name, address, client_name, contract_amount)
      `)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    // Get invoices in this draw with full details
    const { data: drawInvoices, error: invError } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          id, invoice_number, invoice_date, amount, status, pdf_url, pdf_stamped_url,
          vendor:v2_vendors(id, name),
          allocations:v2_invoice_allocations(
            id, amount, notes, change_order_id,
            cost_code:v2_cost_codes(id, code, name)
          )
        )
      `)
      .eq('draw_id', drawId);

    if (invError) throw invError;

    // Get budget lines for this job (for G703 scheduled values)
    const { data: budgetLines, error: budgetError } = await supabase
      .from('v2_budget_lines')
      .select(`
        id, budgeted_amount, committed_amount, billed_amount, paid_amount,
        cost_code:v2_cost_codes(id, code, name)
      `)
      .eq('job_id', draw.job_id);

    if (budgetError) throw budgetError;

    // Get previous draws for this job to calculate previous totals
    const { data: previousDraws, error: prevError } = await supabase
      .from('v2_draws')
      .select('id, draw_number')
      .eq('job_id', draw.job_id)
      .lt('draw_number', draw.draw_number)
      .order('draw_number', { ascending: true });

    if (prevError) throw prevError;

    // Helper to detect CO cost codes (ending in "C" like "26102C")
    const isCOCostCode = (code) => {
      if (!code) return false;
      // Check if code ends with "C" (case insensitive)
      return /C$/i.test(code.trim());
    };

    // Get all previous draw invoices to calculate previous period totals by cost code
    // Exclude allocations linked to Change Orders OR to CO cost codes (they go to CO schedule)
    let previousByCode = {};
    let previousCOByAlloc = {}; // Track CO allocations separately (linked to specific CO)
    let previousUnlinkedCO = { amount: 0, allocations: [] }; // Track CO cost code allocations without CO link
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`
          invoice:v2_invoices(
            allocations:v2_invoice_allocations(
              amount,
              cost_code_id,
              change_order_id,
              cost_code:v2_cost_codes(id, code, name)
            )
          )
        `)
        .in('draw_id', prevDrawIds);

      if (prevInvoices) {
        prevInvoices.forEach(di => {
          if (di.invoice?.allocations) {
            di.invoice.allocations.forEach(alloc => {
              const costCode = alloc.cost_code?.code;
              const isCOCode = isCOCostCode(costCode);

              // Skip CO-linked allocations for G703 - they go to CO schedule
              if (alloc.change_order_id) {
                if (!previousCOByAlloc[alloc.change_order_id]) {
                  previousCOByAlloc[alloc.change_order_id] = 0;
                }
                previousCOByAlloc[alloc.change_order_id] += parseFloat(alloc.amount) || 0;
                return;
              }

              // Skip CO cost codes even without change_order_id - they go to unlinked CO section
              if (isCOCode) {
                previousUnlinkedCO.amount += parseFloat(alloc.amount) || 0;
                previousUnlinkedCO.allocations.push(alloc);
                return;
              }

              if (!previousByCode[alloc.cost_code_id]) {
                previousByCode[alloc.cost_code_id] = 0;
              }
              previousByCode[alloc.cost_code_id] += parseFloat(alloc.amount) || 0;
            });
          }
        });
      }
    }

    // Calculate this period totals by cost code
    // Exclude CO-linked allocations AND CO cost codes - track them separately
    let thisPeriodByCode = {};
    let thisPeriodCOByAlloc = {}; // Track CO allocations for this draw (linked to specific CO)
    let thisPeriodUnlinkedCO = { amount: 0, allocations: [] }; // Track CO cost code allocations without CO link
    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];
    invoices.forEach(inv => {
      if (inv.allocations) {
        inv.allocations.forEach(alloc => {
          const codeId = alloc.cost_code?.id;
          const costCode = alloc.cost_code?.code;
          const isCOCode = isCOCostCode(costCode);

          // Skip CO-linked allocations for G703 - they go to CO schedule
          if (alloc.change_order_id) {
            if (!thisPeriodCOByAlloc[alloc.change_order_id]) {
              thisPeriodCOByAlloc[alloc.change_order_id] = { amount: 0, allocations: [] };
            }
            thisPeriodCOByAlloc[alloc.change_order_id].amount += parseFloat(alloc.amount) || 0;
            thisPeriodCOByAlloc[alloc.change_order_id].allocations.push(alloc);
            return;
          }

          // Skip CO cost codes even without change_order_id - they go to unlinked CO section
          if (isCOCode) {
            thisPeriodUnlinkedCO.amount += parseFloat(alloc.amount) || 0;
            thisPeriodUnlinkedCO.allocations.push(alloc);
            return;
          }

          if (codeId) {
            if (!thisPeriodByCode[codeId]) {
              thisPeriodByCode[codeId] = 0;
            }
            thisPeriodByCode[codeId] += parseFloat(alloc.amount) || 0;
          }
        });
      }
    });

    // Build G703 schedule of values - combine budget lines with activity
    // First, collect all unique cost codes from budget lines, previous draws, and current draw
    const allCostCodeIds = new Set();
    (budgetLines || []).forEach(bl => {
      if (bl.cost_code?.id) allCostCodeIds.add(bl.cost_code.id);
    });
    Object.keys(previousByCode).forEach(id => allCostCodeIds.add(id));
    Object.keys(thisPeriodByCode).forEach(id => allCostCodeIds.add(id));

    // Build a map of budget lines by cost code id
    const budgetByCode = {};
    (budgetLines || []).forEach(bl => {
      if (bl.cost_code?.id) {
        budgetByCode[bl.cost_code.id] = bl;
      }
    });

    // Get cost code info for any codes not in budget lines
    const missingCodeIds = [...allCostCodeIds].filter(id => !budgetByCode[id]);
    let additionalCodes = {};
    if (missingCodeIds.length > 0) {
      const { data: codes } = await supabase
        .from('v2_cost_codes')
        .select('id, code, name')
        .in('id', missingCodeIds);
      (codes || []).forEach(c => {
        additionalCodes[c.id] = c;
      });
    }

    // Build schedule of values
    let itemNum = 0;
    const scheduleOfValues = [...allCostCodeIds].map(codeId => {
      const bl = budgetByCode[codeId];
      const costCode = bl?.cost_code || additionalCodes[codeId];
      if (!costCode) return null;

      const budget = parseFloat(bl?.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const materialsStored = 0;
      const totalBilled = previous + thisPeriod + materialsStored;
      const percentComplete = budget > 0 ? (totalBilled / budget) * 100 : (totalBilled > 0 ? 100 : 0);
      const balance = budget - totalBilled;

      // Only include cost codes with billing activity in THIS draw period
      if (thisPeriod === 0) return null;

      itemNum++;
      return {
        item: itemNum,
        costCodeId: codeId,
        costCode: costCode.code,
        description: costCode.name,
        budget: budget,
        scheduledValue: budget, // Keep for backwards compatibility
        previousBilled: previous,
        previousCompleted: previous, // Keep for backwards compatibility
        currentBilled: thisPeriod,
        thisPeriod: thisPeriod, // Keep for backwards compatibility
        materialsStored: materialsStored,
        totalBilled: totalBilled,
        totalCompleted: totalBilled, // Keep for backwards compatibility
        percentComplete: percentComplete,
        balance: balance
      };
    }).filter(Boolean).sort((a, b) => (a.costCode || '').localeCompare(b.costCode || ''));

    // Calculate G702 totals (invoice portion)
    const totalScheduled = scheduleOfValues.reduce((sum, item) => sum + item.scheduledValue, 0);
    const totalPrevious = scheduleOfValues.reduce((sum, item) => sum + item.previousCompleted, 0);
    const totalThisPeriod = scheduleOfValues.reduce((sum, item) => sum + item.thisPeriod, 0);
    const totalMaterials = scheduleOfValues.reduce((sum, item) => sum + item.materialsStored, 0);

    // ========== CHANGE ORDER DATA ==========
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .eq('status', 'approved')
      .order('change_order_number', { ascending: true });

    const changeOrderTotal = (jobChangeOrders || []).reduce((sum, co) => sum + parseFloat(co.amount || 0), 0);

    // Get manual CO billings from the CO billing table
    const { data: thisDrawCOBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount)')
      .eq('draw_id', drawId);

    let previousCOBillingsManual = [];
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevCO } = await supabase
        .from('v2_job_co_draw_billings')
        .select('amount, draw_id, change_order_id')
        .in('draw_id', prevDrawIds);
      previousCOBillingsManual = prevCO || [];
    }

    // Combine manual CO billings with invoice allocation-based CO billings
    // Manual billings (from v2_job_co_draw_billings)
    const manualCOThisPeriod = (thisDrawCOBillings || []).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
    const manualCOPrevious = previousCOBillingsManual.reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    // Invoice allocation-based CO billings (from thisPeriodCOByAlloc and previousCOByAlloc)
    const allocCOThisPeriod = Object.values(thisPeriodCOByAlloc).reduce((sum, co) => sum + co.amount, 0);
    const allocCOPrevious = Object.values(previousCOByAlloc).reduce((sum, amt) => sum + amt, 0);

    // Unlinked CO cost code billings (CO cost codes without change_order_id link)
    const unlinkedCOThisPeriod = thisPeriodUnlinkedCO.amount;
    const unlinkedCOPrevious = previousUnlinkedCO.amount;

    const coBilledThisPeriod = manualCOThisPeriod + allocCOThisPeriod + unlinkedCOThisPeriod;
    const coBilledPreviously = manualCOPrevious + allocCOPrevious + unlinkedCOPrevious;

    // Build unified CO set - include COs with either manual billings OR invoice allocation billings this period
    const cosWithBillingsSet = new Set();
    (jobChangeOrders || []).forEach(co => {
      const hasManualBilling = (thisDrawCOBillings || []).some(b => b.change_order_id === co.id);
      const hasAllocBilling = thisPeriodCOByAlloc[co.id]?.amount > 0;
      if (hasManualBilling || hasAllocBilling) {
        cosWithBillingsSet.add(co.id);
      }
    });

    const cosWithBillings = (jobChangeOrders || []).filter(co => cosWithBillingsSet.has(co.id));

    const coScheduleOfValues = cosWithBillings.map((co, idx) => {
      // Manual billings
      const prevManual = previousCOBillingsManual.filter(b => b.change_order_id === co.id).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);
      const thisPeriodManual = (thisDrawCOBillings || []).filter(b => b.change_order_id === co.id).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

      // Invoice allocation billings
      const prevAlloc = previousCOByAlloc[co.id] || 0;
      const thisPeriodAlloc = thisPeriodCOByAlloc[co.id]?.amount || 0;

      const prevBillings = prevManual + prevAlloc;
      const thisPeriodBilling = thisPeriodManual + thisPeriodAlloc;
      const totalBilled = prevBillings + thisPeriodBilling;
      const coAmount = parseFloat(co.amount || 0);

      return {
        itemNumber: idx + 1,
        changeOrderId: co.id,
        changeOrderNumber: co.change_order_number,
        title: co.title,
        scheduledValue: coAmount,
        coAmount: coAmount,
        daysAdded: parseInt(co.days_added) || 0,
        previousBillings: prevBillings,
        previousBilled: prevBillings,
        thisPeriodBilling: thisPeriodBilling,
        thisPeriod: thisPeriodBilling,
        totalBilled: totalBilled,
        percentComplete: coAmount > 0 ? Math.min((totalBilled / coAmount) * 100, 100) : 0,
        balance: coAmount - totalBilled,
        clientApproved: !!co.client_approved_at || co.client_approval_bypassed,
        // Include allocation details for reference
        allocations: thisPeriodCOByAlloc[co.id]?.allocations || []
      };
    });

    const grandTotalCompleted = totalPrevious + totalThisPeriod + totalMaterials + coBilledPreviously + coBilledThisPeriod;
    const currentPaymentDue = totalThisPeriod + coBilledThisPeriod;
    const contractSum = parseFloat(draw.job?.contract_amount || 0);
    const contractSumToDate = contractSum + changeOrderTotal;

    // ========== ATTACHMENTS ==========
    const { data: attachments } = await supabase
      .from('v2_draw_attachments')
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .eq('draw_id', drawId)
      .order('uploaded_at', { ascending: false });

    // ========== ACTIVITY LOG ==========
    const { data: activity } = await supabase
      .from('v2_draw_activity')
      .select('*')
      .eq('draw_id', drawId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    res.json({
      ...draw,
      invoices,
      invoiceCount: invoices.length,
      scheduleOfValues,
      changeOrders: jobChangeOrders || [],
      changeOrderTotal,
      coScheduleOfValues,
      coBillings: thisDrawCOBillings || [],
      coBilledThisPeriod,
      coBilledPreviously,
      // Unlinked CO cost code allocations (CO cost codes without change_order_id)
      unlinkedCOAllocations: {
        thisPeriod: thisPeriodUnlinkedCO,
        previous: previousUnlinkedCO,
        totalThisPeriod: unlinkedCOThisPeriod,
        totalPrevious: unlinkedCOPrevious
      },
      attachments: attachments || [],
      activity: activity || [],
      g702: {
        applicationNumber: draw.draw_number,
        periodTo: draw.period_end,
        contractSum: contractSum,
        netChangeOrders: changeOrderTotal,
        contractSumToDate: contractSumToDate,
        totalCompletedPrevious: totalPrevious + coBilledPreviously,
        totalCompletedThisPeriod: totalThisPeriod + coBilledThisPeriod,
        materialsStored: totalMaterials,
        grandTotal: grandTotalCompleted,
        lessPreviousCertificates: totalPrevious + coBilledPreviously,
        currentPaymentDue: currentPaymentDue
      }
    });
  } catch (err) {
    console.error('Error fetching draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/jobs/:id/draws', async (req, res) => {
  try {
    const jobId = req.params.id;

    const { data: existing } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('job_id', jobId)
      .order('draw_number', { ascending: false })
      .limit(1);

    const nextNumber = existing && existing.length > 0 ? existing[0].draw_number + 1 : 1;

    const { data, error } = await supabase
      .from('v2_draws')
      .insert({
        job_id: jobId,
        draw_number: nextNumber,
        period_end: req.body.period_end || new Date().toISOString().split('T')[0],
        status: 'draft'
      })
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get approved invoices that haven't been added to a draw yet
app.get('/api/jobs/:id/approved-unbilled-invoices', async (req, res) => {
  try {
    const jobId = req.params.id;

    // Get all approved invoices for this job that are NOT in a draw
    const { data: invoices, error: invError } = await supabase
      .from('v2_invoices')
      .select(`
        id, invoice_number, invoice_date, amount, status, vendor_id, job_id,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        allocations:v2_invoice_allocations(id, amount, cost_code_id)
      `)
      .eq('job_id', jobId)
      .eq('status', 'approved')
      .is('deleted_at', null)
      .order('invoice_date', { ascending: false });

    if (invError) throw invError;

    // Calculate the total
    const totalAmount = (invoices || []).reduce((sum, inv) => {
      const allocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      return sum + (allocationSum > 0 ? allocationSum : parseFloat(inv.amount || 0));
    }, 0);

    // Check if there's an existing draft draw for this job
    const { data: draftDraw, error: drawError } = await supabase
      .from('v2_draws')
      .select('id, draw_number, total_amount')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (drawError) throw drawError;

    res.json({
      invoices: invoices || [],
      invoice_count: (invoices || []).length,
      total_amount: totalAmount,
      existing_draft: draftDraw || null
    });
  } catch (err) {
    console.error('Error fetching approved unbilled invoices:', err);
    res.status(500).json({ error: err.message });
  }
});

// Auto-generate draw from approved invoices
app.post('/api/jobs/:id/auto-generate-draw', async (req, res) => {
  try {
    const jobId = req.params.id;
    const { invoice_ids, use_existing_draft } = req.body;

    if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
      return res.status(400).json({ error: 'No invoices selected' });
    }

    let draw;

    // Check for existing draft draw if requested
    if (use_existing_draft) {
      const { data: draftDraw, error: draftError } = await supabase
        .from('v2_draws')
        .select('*')
        .eq('job_id', jobId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (draftError) throw draftError;
      draw = draftDraw;
    }

    // Create new draw if no existing draft
    if (!draw) {
      const { data: existing } = await supabase
        .from('v2_draws')
        .select('draw_number')
        .eq('job_id', jobId)
        .order('draw_number', { ascending: false })
        .limit(1);

      const nextNumber = existing && existing.length > 0 ? existing[0].draw_number + 1 : 1;

      const { data: newDraw, error: createError } = await supabase
        .from('v2_draws')
        .insert({
          job_id: jobId,
          draw_number: nextNumber,
          period_end: new Date().toISOString().split('T')[0],
          status: 'draft'
        })
        .select()
        .single();

      if (createError) throw createError;
      draw = newDraw;
    }

    // Add invoices to draw
    let addedCount = 0;
    let totalAmount = 0;

    for (const invoiceId of invoice_ids) {
      // Check if invoice exists and is approved
      const { data: invoice, error: invError } = await supabase
        .from('v2_invoices')
        .select('id, status, amount, allocations:v2_invoice_allocations(amount)')
        .eq('id', invoiceId)
        .single();

      if (invError || !invoice) continue;
      if (invoice.status !== 'approved') continue;

      // Check if already in draw
      const { data: existing } = await supabase
        .from('v2_draw_invoices')
        .select('id')
        .eq('draw_id', draw.id)
        .eq('invoice_id', invoiceId)
        .maybeSingle();

      if (existing) continue;

      // Add to draw
      const { error: linkError } = await supabase
        .from('v2_draw_invoices')
        .insert({ draw_id: draw.id, invoice_id: invoiceId });

      if (linkError) {
        console.error('Error linking invoice to draw:', linkError);
        continue;
      }

      // Update invoice status to in_draw
      const { error: statusError } = await supabase
        .from('v2_invoices')
        .update({ status: 'in_draw' })
        .eq('id', invoiceId);

      if (statusError) {
        console.error('Error updating invoice status:', statusError);
      }

      // Calculate amount (use allocation sum if available)
      const allocationSum = (invoice.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      totalAmount += allocationSum > 0 ? allocationSum : parseFloat(invoice.amount || 0);
      addedCount++;
    }

    // Update draw total
    const { error: updateError } = await supabase
      .from('v2_draws')
      .update({
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', draw.id);

    if (updateError) {
      console.error('Error updating draw total:', updateError);
    }

    res.json({
      draw_id: draw.id,
      draw_number: draw.draw_number,
      invoice_count: addedCount,
      total_amount: totalAmount,
      created_new: !use_existing_draft || !draw.id
    });
  } catch (err) {
    console.error('Error auto-generating draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update draw (header fields and G702 overrides)
app.patch('/api/draws/:id', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { draw_number, period_end, notes, g702_overrides } = req.body;
    const { data: currentDraw, error: fetchError } = await supabase
      .from('v2_draws').select('status').eq('id', drawId).single();
    if (fetchError) throw fetchError;
    if (currentDraw.status !== 'draft') {
      return res.status(400).json({ error: 'Can only edit draft draws' });
    }
    const updateData = { updated_at: new Date().toISOString() };
    if (draw_number !== undefined) updateData.draw_number = draw_number;
    if (period_end !== undefined) updateData.period_end = period_end;
    if (notes !== undefined) updateData.notes = notes;
    if (g702_overrides) {
      if (g702_overrides.original_contract_sum !== undefined) updateData.g702_original_contract_override = g702_overrides.original_contract_sum;
      if (g702_overrides.net_change_orders !== undefined) updateData.g702_change_orders_override = g702_overrides.net_change_orders;
    }
    const { data, error } = await supabase.from('v2_draws').update(updateData).eq('id', drawId).select().single();
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/draws/:id/add-invoices', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { invoice_ids } = req.body;

    // Get draw info
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('id', drawId)
      .single();

    const { error: linkError } = await supabase
      .from('v2_draw_invoices')
      .insert(invoice_ids.map(id => ({ draw_id: drawId, invoice_id: id })));

    if (linkError) throw linkError;

    // Get invoices with their stamped PDFs, allocations, and current billed amount
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select(`
        id, amount, pdf_stamped_url, billed_amount,
        allocations:v2_invoice_allocations(id, amount, cost_code_id, notes, po_line_item_id)
      `)
      .in('id', invoice_ids);

    // Track which invoices are partial vs fully billed
    const partialInvoices = [];
    const fullyBilledInvoices = [];

    // Process each invoice
    for (const inv of invoices) {
      const invoiceAmount = parseFloat(inv.amount || 0);
      const previouslyBilled = parseFloat(inv.billed_amount || 0);
      const currentAllocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      const newBilledTotal = previouslyBilled + currentAllocationSum;
      const isCredit = invoiceAmount < 0;
      // For credits: fully billed when newBilledTotal <= invoiceAmount (more negative)
      // For standard: fully billed when newBilledTotal >= invoiceAmount
      const isFullyBilled = isCredit
        ? newBilledTotal <= invoiceAmount + 0.01  // e.g., -100 <= -100.01 means fully billed
        : newBilledTotal >= invoiceAmount - 0.01;

      // Copy allocations to draw_allocations before potentially clearing them
      for (const alloc of (inv.allocations || [])) {
        await supabase
          .from('v2_draw_allocations')
          .upsert({
            draw_id: drawId,
            invoice_id: inv.id,
            cost_code_id: alloc.cost_code_id,
            amount: alloc.amount,
            notes: alloc.notes,
            created_by: 'System'
          }, { onConflict: 'draw_id,invoice_id,cost_code_id' });
      }

      // Stamp PDF with "IN DRAW" using fixed path
      if (inv.pdf_url) {
        try {
          // Always stamp from original PDF
          const storagePath = extractStoragePath(inv.pdf_url);
          if (storagePath) {
            const pdfBuffer = await downloadPDF(storagePath);
            const stampedBuffer = await stampInDraw(pdfBuffer, draw?.draw_number || 1);
            // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
            await uploadStampedPDFById(stampedBuffer, inv.id, inv.job_id);
          }
        } catch (stampErr) {
          console.error('IN DRAW stamp failed for invoice:', inv.id, stampErr.message);
        }
      }

      // Update invoice billed_amount (cap at invoice amount to prevent overbilling)
      // For credits: use Math.max (cap at most negative value)
      // For standard: use Math.min (cap at invoice amount)
      const cappedBilledTotal = isCredit
        ? Math.max(newBilledTotal, invoiceAmount)  // e.g., max(-150, -100) = -100
        : Math.min(newBilledTotal, invoiceAmount);
      const updateData = {
        billed_amount: cappedBilledTotal
      };

      if (isFullyBilled) {
        // Fully billed - status becomes in_draw
        updateData.status = 'in_draw';
        updateData.fully_billed_at = new Date().toISOString();
        fullyBilledInvoices.push(inv.id);

        await logActivity(inv.id, 'added_to_draw', 'System', {
          draw_number: draw?.draw_number,
          billed_amount: currentAllocationSum,
          fully_billed: true
        });
      } else {
        // Partially billed - cycle back to needs_review for remaining allocation
        updateData.status = 'needs_review';
        partialInvoices.push({
          id: inv.id,
          billed: currentAllocationSum,
          remaining: invoiceAmount - newBilledTotal,
          allocationIds: (inv.allocations || []).map(a => a.id)
        });

        await logActivity(inv.id, 'partial_billed', 'System', {
          draw_number: draw?.draw_number,
          billed_amount: currentAllocationSum,
          remaining_amount: invoiceAmount - newBilledTotal,
          total_billed: newBilledTotal
        });
      }

      await supabase
        .from('v2_invoices')
        .update(updateData)
        .eq('id', inv.id);
    }

    // For partial invoices, clear the allocations so they can be re-allocated for remaining
    for (const partial of partialInvoices) {
      if (partial.allocationIds.length > 0) {
        await supabase
          .from('v2_invoice_allocations')
          .delete()
          .in('id', partial.allocationIds);
      }
    }

    // Update draw total
    await updateDrawTotal(drawId);

    res.json({
      success: true,
      fully_billed: fullyBilledInvoices.length,
      partial_billed: partialInvoices.length,
      partial_invoices: partialInvoices.map(p => ({
        id: p.id,
        billed: p.billed,
        remaining: p.remaining
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove invoice from draw
app.post('/api/draws/:id/remove-invoice', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { invoice_id, performed_by = 'System' } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id is required' });
    }

    // Get draw info for activity log
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow removal from draft draws (submitted/funded are locked)
    if (draw.status !== 'draft') {
      return res.status(400).json({
        error: draw.status === 'submitted'
          ? 'Cannot remove invoices from a submitted draw. Unsubmit the draw first.'
          : 'Cannot remove invoices from a funded draw'
      });
    }

    // Remove from draw_allocations (new table)
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoice_id);

    // Remove from draw_invoices
    const { error: deleteError } = await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoice_id);

    if (deleteError) throw deleteError;

    // Get invoice data for re-stamping
    const { data: invoice } = await supabase
      .from('v2_invoices')
      .select(`
        *,
        vendor:v2_vendors(id, name),
        job:v2_jobs(id, name),
        po:v2_purchase_orders(id, po_number, description, total_amount),
        allocations:v2_invoice_allocations(
          amount,
          cost_code_id,
          cost_code:v2_cost_codes(code, name)
        )
      `)
      .eq('id', invoice_id)
      .single();

    // Re-stamp with just APPROVED (remove IN DRAW stamp) using fixed path
    let newStampedUrl = null;
    if (invoice?.pdf_url) {
      try {
        // Always stamp from original PDF
        const storagePath = extractStoragePath(invoice.pdf_url);
        if (storagePath) {
          const pdfBuffer = await downloadPDF(storagePath);

          // Get PO billing info
          let poTotal = null;
          let poBilledToDate = 0;
          if (invoice.po?.id) {
            poTotal = invoice.po.total_amount;
            const { data: priorInvoices } = await supabase
              .from('v2_invoices')
              .select('amount')
              .eq('po_id', invoice.po.id)
              .neq('id', invoice_id)
              .in('status', ['approved', 'in_draw', 'paid']);
            if (priorInvoices) {
              poBilledToDate = priorInvoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
            }
          }

          const stampedBuffer = await stampApproval(pdfBuffer, {
            status: 'APPROVED',
            date: new Date().toLocaleDateString(),
            approvedBy: invoice.approved_by || performed_by,
            vendorName: invoice.vendor?.name,
            invoiceNumber: invoice.invoice_number,
            jobName: invoice.job?.name,
            costCodes: (invoice.allocations || []).map(a => ({
              code: a.cost_code?.code,
              name: a.cost_code?.name,
              amount: a.amount
            })).filter(cc => cc.code),
            amount: invoice.amount,
            poNumber: invoice.po?.po_number,
            poDescription: invoice.po?.description,
            poTotal: poTotal,
            poBilledToDate: poBilledToDate,
            isPartial: invoice.review_flags?.includes('partial_approval')
          });

          // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
          const result = await uploadStampedPDFById(stampedBuffer, invoice_id, invoice.job?.id);
          newStampedUrl = result.url;
        }
      } catch (stampErr) {
        console.error('Re-stamping failed when removing from draw:', stampErr.message);
      }
    }

    // Update invoice status back to approved (keep approval info, re-stamp without IN DRAW)
    const { error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        status: 'approved',
        pdf_stamped_url: newStampedUrl
      })
      .eq('id', invoice_id);

    if (updateError) throw updateError;

    // Log invoice activity
    await logActivity(invoice_id, 'removed_from_draw', performed_by, {
      draw_number: draw.draw_number
    });

    // Log draw activity
    await logDrawActivity(drawId, 'invoice_removed', performed_by, {
      invoice_id,
      invoice_number: invoice?.invoice_number,
      vendor_name: invoice?.vendor?.name
    });

    // Recalculate draw total using v2_draw_allocations
    const { data: remainingAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId);

    const newTotal = remainingAllocations?.reduce((sum, alloc) => {
      return sum + parseFloat(alloc.amount || 0);
    }, 0) || 0;

    await supabase
      .from('v2_draws')
      .update({ total_amount: newTotal })
      .eq('id', drawId);

    res.json({ success: true, new_total: newTotal, draw_number: draw.draw_number });
  } catch (err) {
    console.error('Error removing invoice from draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete a draw (admin cleanup)
app.delete('/api/draws/:id', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Delete draw allocations first
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId);

    // Delete draw invoices
    await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId);

    // Delete draw activity
    await supabase
      .from('v2_draw_activity')
      .delete()
      .eq('draw_id', drawId);

    // Delete the draw
    const { error } = await supabase
      .from('v2_draws')
      .delete()
      .eq('id', drawId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Recalculate draw total (fixes data from before partial approval fix)
app.post('/api/draws/:id/recalculate', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Get all invoices in this draw with allocations
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          amount,
          allocations:v2_invoice_allocations(amount, po_line_item_id)
        )
      `)
      .eq('draw_id', drawId);

    // Calculate correct total using allocation sums
    const newTotal = drawInvoices?.reduce((sum, di) => {
      const inv = di.invoice;
      if (!inv) return sum;
      const allocationSum = (inv.allocations || []).reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      return sum + (allocationSum > 0 ? allocationSum : parseFloat(inv.amount || 0));
    }, 0) || 0;

    // Update the draw
    await supabase
      .from('v2_draws')
      .update({ total_amount: newTotal })
      .eq('id', drawId);

    res.json({ success: true, new_total: newTotal });
  } catch (err) {
    console.error('Error recalculating draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/draws/:id/submit', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { submitted_by = 'System' } = req.body;

    // Get draw info
    const { data: drawInfo } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!drawInfo) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    if (drawInfo.status !== 'draft') {
      return res.status(400).json({
        error: `Cannot submit a draw that is already ${drawInfo.status}`
      });
    }

    const now = new Date().toISOString();

    // Update draw status - set submitted_at and locked_at
    const { data: draw, error } = await supabase
      .from('v2_draws')
      .update({
        status: 'submitted',
        submitted_at: now,
        locked_at: now
      })
      .eq('id', drawId)
      .select()
      .single();

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'submitted', submitted_by, {
      draw_number: draw.draw_number,
      total_amount: draw.total_amount
    });

    // Get invoices in this draw and update their billed_amount tracking
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('invoice_id, amount')
      .eq('draw_id', drawId);

    if (drawAllocations && drawAllocations.length > 0) {
      // Group allocations by invoice
      const invoiceAmounts = {};
      for (const alloc of drawAllocations) {
        if (!invoiceAmounts[alloc.invoice_id]) {
          invoiceAmounts[alloc.invoice_id] = 0;
        }
        invoiceAmounts[alloc.invoice_id] += parseFloat(alloc.amount || 0);
      }

      // Update each invoice's billed_amount
      for (const [invoiceId, thisDrawAmount] of Object.entries(invoiceAmounts)) {
        const { data: invoice } = await supabase
          .from('v2_invoices')
          .select('billed_amount, amount')
          .eq('id', invoiceId)
          .single();

        if (invoice) {
          const previouslyBilled = parseFloat(invoice.billed_amount || 0);
          const cumulativeBilled = previouslyBilled + thisDrawAmount;
          const invoiceTotal = parseFloat(invoice.amount || 0);

          // Track partial billing but don't kick back - invoices stay in_draw
          // They can be billed again in the next draw for the remaining amount
          await supabase
            .from('v2_invoices')
            .update({ billed_amount: cumulativeBilled })
            .eq('id', invoiceId);

          // Log if partial
          if (cumulativeBilled < invoiceTotal - 0.01) {
            await logActivity(invoiceId, 'partial_billed', 'System', {
              draw_id: drawId,
              draw_number: draw.draw_number,
              amount_billed_this_draw: thisDrawAmount,
              cumulative_billed: cumulativeBilled,
              remaining: invoiceTotal - cumulativeBilled
            });
          }
        }
      }
    }

    console.log(`[DRAW] Draw #${draw.draw_number} submitted and locked`);
    res.json(draw);
  } catch (err) {
    console.error('Error submitting draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unsubmit draw - revert from submitted back to draft
app.post('/api/draws/:id/unsubmit', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { reason, performed_by = 'System' } = req.body;

    // Get draw info
    const { data: drawInfo } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!drawInfo) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    if (drawInfo.status !== 'submitted') {
      return res.status(400).json({
        error: drawInfo.status === 'draft'
          ? 'Draw is already in draft status'
          : 'Cannot unsubmit a funded draw'
      });
    }

    const now = new Date().toISOString();

    // Update draw status back to draft
    const { data: draw, error } = await supabase
      .from('v2_draws')
      .update({
        status: 'draft',
        locked_at: null,
        unsubmitted_at: now,
        unsubmit_reason: reason || null
      })
      .eq('id', drawId)
      .select()
      .single();

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'unsubmitted', performed_by, {
      draw_number: draw.draw_number,
      reason: reason || 'No reason provided'
    });

    // Note: We don't need to revert billed_amount on invoices because
    // the billing tracking is cumulative and useful for partial billing

    console.log(`[DRAW] Draw #${draw.draw_number} unsubmitted - returned to draft`);
    res.json(draw);
  } catch (err) {
    console.error('Error unsubmitting draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/draws/:id/fund', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { funded_amount, partial_funding_note, funded_by = 'System' } = req.body;

    // Get draw info first
    const { data: drawBefore } = await supabase
      .from('v2_draws')
      .select('draw_number, total_amount, job_id, status, locked_at')
      .eq('id', drawId)
      .single();

    if (!drawBefore) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Validate draw is submitted (can't fund a draft)
    if (drawBefore.status === 'draft') {
      return res.status(400).json({ error: 'Cannot fund a draft draw. Submit the draw first.' });
    }

    // Prevent re-funding an already funded draw
    if (drawBefore.status === 'funded') {
      return res.status(400).json({ error: 'Draw has already been funded' });
    }

    const billedAmount = parseFloat(drawBefore?.total_amount || 0);
    const actualFunded = parseFloat(funded_amount || billedAmount);
    const fundingDifference = actualFunded - billedAmount;

    // Status is always 'funded' - funding variance tracked in funding_difference field
    const status = 'funded';
    // Note: funding_difference < 0 means partial payment, > 0 means overpayment

    const now = new Date().toISOString();

    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .update({
        status: status,
        funded_at: now,
        funded_amount: actualFunded,
        funding_difference: fundingDifference,
        partial_funding_note: partial_funding_note || null,
        locked_at: drawBefore.locked_at || now // Ensure locked_at is set
      })
      .eq('id', drawId)
      .select()
      .single();

    if (drawError) throw drawError;

    // Log draw activity
    await logDrawActivity(drawId, 'funded', funded_by, {
      draw_number: draw.draw_number,
      billed_amount: billedAmount,
      funded_amount: actualFunded,
      funding_difference: fundingDifference,
      status: status
    });

    // Log funding difference if applicable
    if (Math.abs(fundingDifference) > 0.01) {
      console.log(`Draw ${draw.draw_number} funding: billed=${billedAmount}, funded=${actualFunded}, diff=${fundingDifference} (${status})`);
    }

    // Get draw allocations for this draw (using new v2_draw_allocations table)
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('invoice_id, cost_code_id, amount')
      .eq('draw_id', drawId);

    // Group allocations by invoice
    const invoiceAllocations = {};
    for (const alloc of drawAllocations || []) {
      if (!invoiceAllocations[alloc.invoice_id]) {
        invoiceAllocations[alloc.invoice_id] = [];
      }
      invoiceAllocations[alloc.invoice_id].push(alloc);
    }

    const invoiceIds = Object.keys(invoiceAllocations);
    if (invoiceIds.length > 0) {
      // Get invoices that are still in_draw
      const { data: invoices } = await supabase
        .from('v2_invoices')
        .select('id, amount, billed_amount, paid_amount, pdf_stamped_url, job_id, status, parent_invoice_id')
        .in('id', invoiceIds)
        .eq('status', 'in_draw');

      const paidDate = new Date().toLocaleDateString();

      for (const inv of invoices || []) {
        const invoiceAmount = parseFloat(inv.amount || 0);
        const allocsForInvoice = invoiceAllocations[inv.id] || [];
        const billedThisDraw = allocsForInvoice.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const previouslyPaid = parseFloat(inv.paid_amount || 0);
        const newPaidAmount = previouslyPaid + billedThisDraw;

        // Check if invoice is fully billed
        const isFullyBilled = newPaidAmount >= invoiceAmount - 0.01;

        // Update budget paid amounts
        if (inv.job_id) {
          for (const alloc of allocsForInvoice) {
            if (!alloc.cost_code_id) continue;

            const { data: budgetLine } = await supabase
              .from('v2_budget_lines')
              .select('id, paid_amount')
              .eq('job_id', inv.job_id)
              .eq('cost_code_id', alloc.cost_code_id)
              .single();

            if (budgetLine) {
              const newBudgetPaid = (parseFloat(budgetLine.paid_amount) || 0) + parseFloat(alloc.amount || 0);
              await supabase
                .from('v2_budget_lines')
                .update({ paid_amount: newBudgetPaid })
                .eq('id', budgetLine.id);
            }
          }
        }

        // Stamp and update invoice as PAID using fixed path
        if (inv.pdf_url) {
          try {
            // Always stamp from original PDF
            const storagePath = extractStoragePath(inv.pdf_url);
            if (storagePath) {
              const pdfBuffer = await downloadPDF(storagePath);
              const stampedBuffer = await stampPaid(pdfBuffer, paidDate);
              // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
              await uploadStampedPDFById(stampedBuffer, inv.id, inv.job_id);
            }
          } catch (stampErr) {
            console.error('PAID stamp failed for invoice:', inv.id, stampErr.message);
          }
        }

        // Mark invoice as paid and set fully_billed_at if applicable
        const invoiceUpdate = {
          status: 'paid',
          paid_amount: newPaidAmount
        };
        if (isFullyBilled) {
          invoiceUpdate.fully_billed_at = now;
        }

        await supabase
          .from('v2_invoices')
          .update(invoiceUpdate)
          .eq('id', inv.id);

        await logActivity(inv.id, 'paid', 'System', {
          draw_id: drawId,
          draw_number: draw.draw_number,
          amount_paid_this_draw: billedThisDraw,
          cumulative_paid: newPaidAmount,
          fully_billed: isFullyBilled
        });

        // Check if this completes a split (all children in terminal state)
        if (inv.parent_invoice_id) {
          checkSplitReconciliation(inv.parent_invoice_id).catch(err => {
            console.error('[RECONCILE] Check failed:', err.message);
          });
        }
      }
    }

    console.log(`[DRAW] Draw #${draw.draw_number} funded - status: ${status}, amount: $${actualFunded}`);
    res.json(draw);
  } catch (err) {
    console.error('Error funding draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Fix legacy draw statuses (one-time migration helper)
app.post('/api/draws/fix-legacy-status', async (req, res) => {
  try {
    // Update partially_funded and overfunded to just 'funded'
    const { data, error } = await supabase
      .from('v2_draws')
      .update({ status: 'funded' })
      .in('status', ['partially_funded', 'overfunded'])
      .select('id, draw_number, status');

    if (error) throw error;
    res.json({ message: 'Legacy statuses fixed', updated: data?.length || 0, draws: data });
  } catch (err) {
    console.error('Error fixing legacy statuses:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DRAW EXPORT ENDPOINTS
// ============================================================
// JOB CHANGE ORDER ENDPOINTS
// Client-side change orders for billing (separate from PO COs)
// ============================================================

// Helper: Log CO activity
async function logCOActivity(changeOrderId, action, performedBy, details = {}) {
  try {
    await supabase
      .from('v2_job_co_activity')
      .insert({
        change_order_id: changeOrderId,
        action,
        performed_by: performedBy,
        details
      });
  } catch (err) {
    console.error('Failed to log CO activity:', err);
  }
}

// List change orders for a job
app.get('/api/jobs/:jobId/change-orders', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.query;

    let query = supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', jobId)
      .order('change_order_number', { ascending: true });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data || []);
  } catch (err) {
    console.error('Error fetching job change orders:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single change order with billing history
app.get('/api/change-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .select(`
        *,
        job:v2_jobs(id, name, client_name),
        billings:v2_job_co_draw_billings(
          id, amount, created_at,
          draw:v2_draws(id, draw_number, period_end, status)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!co) return res.status(404).json({ error: 'Change order not found' });

    const { data: activity } = await supabase
      .from('v2_job_co_activity')
      .select('*')
      .eq('change_order_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    res.json({ ...co, activity: activity || [] });
  } catch (err) {
    console.error('Error fetching change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create new change order
app.post('/api/jobs/:jobId/change-orders', async (req, res) => {
  try {
    const { jobId } = req.params;
    const {
      change_order_number, title, description, reason, amount,
      base_amount, gc_fee_percent, gc_fee_amount,
      admin_hours, admin_rate, admin_cost,
      status, first_billed_draw_number, days_added, created_by
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (days_added === undefined || days_added === null || days_added === '') {
      return res.status(400).json({ error: 'Days added is required (can be 0)' });
    }

    // Get next CO number if not provided
    let coNumber = change_order_number;
    if (!coNumber) {
      const { data: maxCO } = await supabase
        .from('v2_job_change_orders')
        .select('change_order_number')
        .eq('job_id', jobId)
        .order('change_order_number', { ascending: false })
        .limit(1)
        .single();
      coNumber = (maxCO?.change_order_number || 0) + 1;
    }

    const insertData = {
      job_id: jobId,
      change_order_number: coNumber,
      title,
      description: description || title,
      reason: reason || 'scope_change',
      amount: parseFloat(amount) || 0,
      days_added: parseInt(days_added) || 0,
      status: status || 'draft',
      created_by
    };

    // Add optional fields
    if (base_amount !== undefined) insertData.base_amount = parseFloat(base_amount);
    if (gc_fee_percent !== undefined) insertData.gc_fee_percent = parseFloat(gc_fee_percent);
    if (gc_fee_amount !== undefined) insertData.gc_fee_amount = parseFloat(gc_fee_amount);
    if (admin_hours !== undefined) insertData.admin_hours = parseFloat(admin_hours) || 0;
    if (admin_rate !== undefined) insertData.admin_rate = parseFloat(admin_rate) || 0;
    if (admin_cost !== undefined) insertData.admin_cost = parseFloat(admin_cost) || 0;
    if (first_billed_draw_number) insertData.first_billed_draw_number = first_billed_draw_number;

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .insert(insertData)
      .select()
      .single();

    if (error) throw error;

    await logCOActivity(co.id, 'created', created_by, { amount: insertData.amount });

    res.status(201).json(co);
  } catch (err) {
    console.error('Error creating change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update change order
app.patch('/api/change-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      change_order_number, title, description, reason, amount,
      base_amount, gc_fee_percent, gc_fee_amount,
      admin_hours, admin_rate, admin_cost,
      status, first_billed_draw_number, days_added, updated_by
    } = req.body;

    const { data: existing } = await supabase
      .from('v2_job_change_orders')
      .select('status, billed_amount')
      .eq('id', id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Change order not found' });

    // Only prevent editing if there are billings (actual usage)
    const hasBillings = parseFloat(existing.billed_amount || 0) > 0;
    if (hasBillings && amount !== undefined && parseFloat(amount) < parseFloat(existing.billed_amount)) {
      return res.status(400).json({ error: 'Cannot reduce amount below billed amount' });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (change_order_number !== undefined) updates.change_order_number = change_order_number;
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (reason !== undefined) updates.reason = reason;
    if (amount !== undefined) updates.amount = parseFloat(amount);
    if (base_amount !== undefined) updates.base_amount = parseFloat(base_amount);
    if (gc_fee_percent !== undefined) updates.gc_fee_percent = parseFloat(gc_fee_percent);
    if (gc_fee_amount !== undefined) updates.gc_fee_amount = parseFloat(gc_fee_amount);
    if (admin_hours !== undefined) updates.admin_hours = parseFloat(admin_hours) || 0;
    if (admin_rate !== undefined) updates.admin_rate = parseFloat(admin_rate) || 0;
    if (admin_cost !== undefined) updates.admin_cost = parseFloat(admin_cost) || 0;
    if (days_added !== undefined) updates.days_added = parseInt(days_added);
    if (status !== undefined) updates.status = status;
    if (first_billed_draw_number !== undefined) updates.first_billed_draw_number = first_billed_draw_number;

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'updated', updated_by, updates);
    res.json(co);
  } catch (err) {
    console.error('Error updating change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete change order (draft, or approved with no invoices)
app.delete('/api/change-orders/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('v2_job_change_orders')
      .select('status, invoiced_amount, billed_amount')
      .eq('id', id)
      .single();

    if (!existing) return res.status(404).json({ error: 'Change order not found' });

    // Allow delete if: draft status OR (approved with no invoices/billings)
    const invoicedAmt = parseFloat(existing.invoiced_amount || 0);
    const billedAmt = parseFloat(existing.billed_amount || 0);
    const canDelete = existing.status === 'draft' || (invoicedAmt === 0 && billedAmt === 0);

    if (!canDelete) {
      return res.status(400).json({
        error: 'Cannot delete change order with invoices or billings linked to it'
      });
    }

    const { error } = await supabase.from('v2_job_change_orders').delete().eq('id', id);
    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Submit change order for approval
app.post('/api/change-orders/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { submitted_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'draft') return res.status(400).json({ error: 'Can only submit draft change orders' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'submitted', submitted_by);
    res.json(co);
  } catch (err) {
    console.error('Error submitting change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Internal approve change order
app.post('/api/change-orders/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { approved_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'pending_approval') return res.status(400).json({ error: 'Can only approve pending change orders' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ status: 'approved', internal_approved_at: new Date().toISOString(), internal_approved_by: approved_by, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'approved', approved_by);
    res.json(co);
  } catch (err) {
    console.error('Error approving change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// Client approve change order
app.post('/api/change-orders/:id/client-approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { client_approved_by, recorded_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'approved') return res.status(400).json({ error: 'Must be internally approved first' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ client_approved_at: new Date().toISOString(), client_approved_by: client_approved_by || 'Client', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'client_approved', recorded_by || 'System', { client_approved_by });
    res.json(co);
  } catch (err) {
    console.error('Error recording client approval:', err);
    res.status(500).json({ error: err.message });
  }
});

// Bypass client approval
app.post('/api/change-orders/:id/bypass-client', async (req, res) => {
  try {
    const { id } = req.params;
    const { bypass_reason, bypassed_by } = req.body;

    if (!bypass_reason) return res.status(400).json({ error: 'Bypass reason is required' });

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (existing.status !== 'approved') return res.status(400).json({ error: 'Must be internally approved first' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ client_approval_bypassed: true, bypass_reason, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'client_bypassed', bypassed_by, { bypass_reason });
    res.json(co);
  } catch (err) {
    console.error('Error bypassing client approval:', err);
    res.status(500).json({ error: err.message });
  }
});

// Reject change order
app.post('/api/change-orders/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { rejection_reason, rejected_by } = req.body;

    const { data: existing } = await supabase.from('v2_job_change_orders').select('status').eq('id', id).single();
    if (!existing) return res.status(404).json({ error: 'Change order not found' });
    if (!['pending_approval', 'approved'].includes(existing.status)) return res.status(400).json({ error: 'Invalid status for rejection' });

    const { data: co, error } = await supabase
      .from('v2_job_change_orders')
      .update({ status: 'rejected', rejection_reason, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(id, 'rejected', rejected_by, { rejection_reason });
    res.json(co);
  } catch (err) {
    console.error('Error rejecting change order:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CHANGE ORDER INVOICE LINKING
// ============================================================

// Get invoices linked to a change order
app.get('/api/change-orders/:id/invoices', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: links, error } = await supabase
      .from('v2_change_order_invoices')
      .select(`
        id, amount, notes, created_at, invoice_id,
        invoice:v2_invoices(id, invoice_number, amount, invoice_date, vendor:v2_vendors(id, name))
      `)
      .eq('change_order_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(links || []);
  } catch (err) {
    console.error('Error fetching CO invoices:', err);
    res.status(500).json({ error: err.message });
  }
});

// Link invoice to change order
app.post('/api/change-orders/:id/link-invoice', async (req, res) => {
  try {
    const { id } = req.params;
    const { invoice_id, amount, notes } = req.body;

    if (!invoice_id) {
      return res.status(400).json({ error: 'invoice_id is required' });
    }

    // Check if already linked
    const { data: existing } = await supabase
      .from('v2_change_order_invoices')
      .select('id')
      .eq('change_order_id', id)
      .eq('invoice_id', invoice_id)
      .single();

    if (existing) {
      return res.status(400).json({ error: 'Invoice already linked to this change order' });
    }

    const { data: link, error } = await supabase
      .from('v2_change_order_invoices')
      .insert({
        change_order_id: id,
        invoice_id,
        amount: amount ? parseFloat(amount) : null,
        notes
      })
      .select(`
        id, amount, notes, created_at, invoice_id,
        invoice:v2_invoices(id, invoice_number, amount, vendor:v2_vendors(id, name))
      `)
      .single();

    if (error) throw error;

    await logCOActivity(id, 'invoice_linked', 'System', { invoice_id, amount });

    res.status(201).json(link);
  } catch (err) {
    console.error('Error linking invoice to CO:', err);
    res.status(500).json({ error: err.message });
  }
});

// Unlink invoice from change order
app.delete('/api/change-orders/:id/unlink-invoice/:invoiceId', async (req, res) => {
  try {
    const { id, invoiceId } = req.params;

    const { error } = await supabase
      .from('v2_change_order_invoices')
      .delete()
      .eq('change_order_id', id)
      .eq('invoice_id', invoiceId);

    if (error) throw error;

    await logCOActivity(id, 'invoice_unlinked', 'System', { invoice_id: invoiceId });

    res.json({ success: true });
  } catch (err) {
    console.error('Error unlinking invoice from CO:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CHANGE ORDER COST CODES
// ============================================================

// Get cost codes for a change order
app.get('/api/change-orders/:id/cost-codes', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('v2_change_order_cost_codes')
      .select('*, cost_code:v2_cost_codes(id, code, name)')
      .eq('change_order_id', id)
      .order('created_at');

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
    console.error('Error fetching CO cost codes:', err);
    res.status(500).json({ error: err.message });
  }
});

// Save cost codes for a change order (replace all)
app.put('/api/change-orders/:id/cost-codes', async (req, res) => {
  try {
    const { id } = req.params;
    const { cost_codes } = req.body;

    // Delete existing cost codes
    await supabase.from('v2_change_order_cost_codes').delete().eq('change_order_id', id);

    // Insert new cost codes
    if (cost_codes && cost_codes.length > 0) {
      const toInsert = cost_codes.map(cc => ({
        change_order_id: id,
        cost_code_id: cc.cost_code_id,
        amount: parseFloat(cc.amount) || 0,
        description: cc.description || null
      }));

      const { error } = await supabase.from('v2_change_order_cost_codes').insert(toInsert);
      if (error) throw error;
    }

    await logCOActivity(id, 'cost_codes_updated', 'System', { count: cost_codes?.length || 0 });

    res.json({ success: true });
  } catch (err) {
    console.error('Error saving CO cost codes:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CHANGE ORDER BILLING ON DRAWS
// ============================================================

// Get COs available to bill on a draw
app.get('/api/draws/:id/available-cos', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { data: draw } = await supabase.from('v2_draws').select('job_id').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    const { data: cos, error } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .eq('status', 'approved')
      .or('client_approved_at.not.is.null,client_approval_bypassed.eq.true');

    if (error) throw error;

    const available = (cos || []).filter(co => {
      const remaining = parseFloat(co.amount) - parseFloat(co.billed_amount || 0);
      return remaining > 0.01;
    }).map(co => ({ ...co, remaining_to_bill: parseFloat(co.amount) - parseFloat(co.billed_amount || 0) }));

    res.json(available);
  } catch (err) {
    console.error('Error fetching available COs:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get CO billings for a specific draw
app.get('/api/draws/:id/co-billings', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { data: billings, error } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount, billed_amount)')
      .eq('draw_id', drawId);

    if (error) throw error;
    res.json(billings || []);
  } catch (err) {
    console.error('Error fetching CO billings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Add CO billing to draw
app.post('/api/draws/:id/add-co-billing', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { change_order_id, amount, added_by } = req.body;

    if (!change_order_id || amount === undefined) return res.status(400).json({ error: 'change_order_id and amount are required' });

    const billingAmount = parseFloat(amount);
    if (billingAmount <= 0) return res.status(400).json({ error: 'Amount must be positive' });

    const { data: draw } = await supabase.from('v2_draws').select('status').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    if (draw.status !== 'draft') return res.status(400).json({ error: 'Can only add CO billings to draft draws' });

    const { data: co } = await supabase
      .from('v2_job_change_orders')
      .select('amount, billed_amount, status, client_approved_at, client_approval_bypassed')
      .eq('id', change_order_id)
      .single();

    if (!co) return res.status(404).json({ error: 'Change order not found' });
    if (co.status !== 'approved') return res.status(400).json({ error: 'Change order must be approved' });
    if (!co.client_approved_at && !co.client_approval_bypassed) return res.status(400).json({ error: 'Change order requires client approval or bypass' });

    const remaining = parseFloat(co.amount) - parseFloat(co.billed_amount || 0);
    if (billingAmount > remaining + 0.01) return res.status(400).json({ error: `Amount exceeds remaining ($${remaining.toFixed(2)})` });

    const { data: existing } = await supabase
      .from('v2_job_co_draw_billings')
      .select('id, amount')
      .eq('draw_id', drawId)
      .eq('change_order_id', change_order_id)
      .single();

    if (existing) {
      const newAmount = parseFloat(existing.amount) + billingAmount;
      const { data: billing, error } = await supabase.from('v2_job_co_draw_billings').update({ amount: newAmount }).eq('id', existing.id).select().single();
      if (error) throw error;
      await logCOActivity(change_order_id, 'billed', added_by, { draw_id: drawId, amount: billingAmount });
      await updateDrawTotal(drawId);
      return res.json(billing);
    }

    const { data: billing, error } = await supabase
      .from('v2_job_co_draw_billings')
      .insert({ change_order_id, draw_id: drawId, amount: billingAmount })
      .select()
      .single();

    if (error) throw error;
    await logCOActivity(change_order_id, 'billed', added_by, { draw_id: drawId, amount: billingAmount });
    await updateDrawTotal(drawId);
    res.status(201).json(billing);
  } catch (err) {
    console.error('Error adding CO billing:', err);
    res.status(500).json({ error: err.message });
  }
});

// Remove CO billing from draw
app.delete('/api/draws/:id/remove-co-billing/:coId', async (req, res) => {
  try {
    const { id: drawId, coId: changeOrderId } = req.params;

    const { data: draw } = await supabase.from('v2_draws').select('status').eq('id', drawId).single();
    if (!draw) return res.status(404).json({ error: 'Draw not found' });
    if (draw.status !== 'draft') return res.status(400).json({ error: 'Can only remove CO billings from draft draws' });

    const { data: billing } = await supabase.from('v2_job_co_draw_billings').select('amount').eq('draw_id', drawId).eq('change_order_id', changeOrderId).single();
    if (!billing) return res.status(404).json({ error: 'CO billing not found on this draw' });

    const { error } = await supabase.from('v2_job_co_draw_billings').delete().eq('draw_id', drawId).eq('change_order_id', changeOrderId);
    if (error) throw error;

    await logCOActivity(changeOrderId, 'billing_removed', req.body?.removed_by, { draw_id: drawId, amount: billing.amount });
    await updateDrawTotal(drawId);
    res.json({ success: true });
  } catch (err) {
    console.error('Error removing CO billing:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DRAW ATTACHMENTS ENDPOINTS
// ============================================================

// List attachments for a draw
app.get('/api/draws/:id/attachments', async (req, res) => {
  try {
    const drawId = req.params.id;

    const { data: attachments, error } = await supabase
      .from('v2_draw_attachments')
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .eq('draw_id', drawId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    res.json(attachments || []);
  } catch (err) {
    console.error('Error fetching draw attachments:', err);
    res.status(500).json({ error: err.message });
  }
});

// Upload attachment to draw
app.post('/api/draws/:id/attachments', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { file_name, file_url, file_size, attachment_type, vendor_id, notes, uploaded_by } = req.body;

    if (!file_name || !file_url) {
      return res.status(400).json({ error: 'file_name and file_url are required' });
    }

    // Get draw info
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow attachments on draft or submitted draws (not funded)
    if (['funded', 'partially_funded', 'overfunded'].includes(draw.status)) {
      return res.status(400).json({ error: 'Cannot add attachments to a funded draw' });
    }

    const { data: attachment, error } = await supabase
      .from('v2_draw_attachments')
      .insert({
        draw_id: drawId,
        file_name,
        file_url,
        file_size: file_size || null,
        attachment_type: attachment_type || 'other',
        vendor_id: vendor_id || null,
        notes: notes || null,
        uploaded_by: uploaded_by || 'System'
      })
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .single();

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'attachment_added', uploaded_by || 'System', {
      attachment_id: attachment.id,
      file_name,
      attachment_type: attachment_type || 'other'
    });

    res.json(attachment);
  } catch (err) {
    console.error('Error adding draw attachment:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete attachment from draw
app.delete('/api/draws/:id/attachments/:attachmentId', async (req, res) => {
  try {
    const { id: drawId, attachmentId } = req.params;
    const { deleted_by } = req.body || {};

    // Get draw info
    const { data: draw } = await supabase
      .from('v2_draws')
      .select('draw_number, status')
      .eq('id', drawId)
      .single();

    if (!draw) {
      return res.status(404).json({ error: 'Draw not found' });
    }

    // Only allow deletion on draft or submitted draws (not funded)
    if (['funded', 'partially_funded', 'overfunded'].includes(draw.status)) {
      return res.status(400).json({ error: 'Cannot remove attachments from a funded draw' });
    }

    // Get attachment info for logging
    const { data: attachment } = await supabase
      .from('v2_draw_attachments')
      .select('file_name, attachment_type')
      .eq('id', attachmentId)
      .eq('draw_id', drawId)
      .single();

    if (!attachment) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const { error } = await supabase
      .from('v2_draw_attachments')
      .delete()
      .eq('id', attachmentId)
      .eq('draw_id', drawId);

    if (error) throw error;

    // Log draw activity
    await logDrawActivity(drawId, 'attachment_removed', deleted_by || 'System', {
      attachment_id: attachmentId,
      file_name: attachment.file_name,
      attachment_type: attachment.attachment_type
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting draw attachment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DRAW ACTIVITY LOG ENDPOINT
// ============================================================

// Get activity log for a draw
app.get('/api/draws/:id/activity', async (req, res) => {
  try {
    const drawId = req.params.id;

    const { data: activities, error } = await supabase
      .from('v2_draw_activity')
      .select('*')
      .eq('draw_id', drawId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json(activities || []);
  } catch (err) {
    console.error('Error fetching draw activity:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current draft draw for a job (or create one)
app.get('/api/jobs/:jobId/current-draw', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { create } = req.query;

    // Check if job exists
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('id, name')
      .eq('id', jobId)
      .single();

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (create === 'true') {
      // Get or create draft draw
      const draw = await getOrCreateDraftDraw(jobId, 'API');
      return res.json(draw);
    }

    // Just look for existing draft
    const { data: draftDraw } = await supabase
      .from('v2_draws')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .single();

    res.json(draftDraw || null);
  } catch (err) {
    console.error('Error getting current draw:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper: Update draw total amount (invoices + CO billings)
// Now uses v2_draw_allocations for invoice amounts
async function updateDrawTotal(drawId) {
  try {
    // Get allocations from the new draw_allocations table
    const { data: drawAllocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId);

    const invoiceTotal = (drawAllocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Get CO billings
    const { data: coBillings } = await supabase
      .from('v2_job_co_draw_billings')
      .select('amount')
      .eq('draw_id', drawId);

    const coTotal = (coBillings || []).reduce((sum, b) => sum + parseFloat(b.amount || 0), 0);

    await supabase.from('v2_draws').update({ total_amount: invoiceTotal + coTotal }).eq('id', drawId);
  } catch (err) {
    console.error('Error updating draw total:', err);
  }
}

// Helper: Get or create draft draw for a job
// Returns the draft draw, creating one if it doesn't exist
async function getOrCreateDraftDraw(jobId, createdBy = 'System') {
  try {
    // Try to find existing draft draw for this job
    const { data: existingDraft } = await supabase
      .from('v2_draws')
      .select('*')
      .eq('job_id', jobId)
      .eq('status', 'draft')
      .single();

    if (existingDraft) {
      return existingDraft;
    }

    // No draft exists, create a new one
    // Get next draw number for this job
    const { data: draws } = await supabase
      .from('v2_draws')
      .select('draw_number')
      .eq('job_id', jobId)
      .order('draw_number', { ascending: false })
      .limit(1);

    const nextNumber = (draws?.[0]?.draw_number || 0) + 1;

    // Create new draft draw
    const { data: newDraw, error } = await supabase
      .from('v2_draws')
      .insert({
        job_id: jobId,
        draw_number: nextNumber,
        status: 'draft',
        total_amount: 0
      })
      .select()
      .single();

    if (error) throw error;

    // Log activity
    await logDrawActivity(newDraw.id, 'created', createdBy, { auto_created: true });

    console.log(`[DRAW] Auto-created Draw #${nextNumber} for job ${jobId}`);
    return newDraw;
  } catch (err) {
    console.error('Error getting/creating draft draw:', err);
    throw err;
  }
}

// Helper: Log draw activity
async function logDrawActivity(drawId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_draw_activity').insert({
      draw_id: drawId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Error logging draw activity:', err);
  }
}

// Helper: Add invoice to draw (creates draw_allocations from invoice_allocations)
async function addInvoiceToDraw(invoiceId, drawId, performedBy = 'System') {
  try {
    // Get invoice allocations
    const { data: allocations } = await supabase
      .from('v2_invoice_allocations')
      .select('cost_code_id, amount, notes')
      .eq('invoice_id', invoiceId);

    if (!allocations || allocations.length === 0) {
      throw new Error('Invoice has no allocations');
    }

    // Link invoice to draw
    const { error: linkError } = await supabase
      .from('v2_draw_invoices')
      .insert({ draw_id: drawId, invoice_id: invoiceId });

    if (linkError && !linkError.message?.includes('duplicate')) {
      throw linkError;
    }

    // Create draw_allocations (copy from invoice_allocations)
    for (const alloc of allocations) {
      const { error: allocError } = await supabase
        .from('v2_draw_allocations')
        .upsert({
          draw_id: drawId,
          invoice_id: invoiceId,
          cost_code_id: alloc.cost_code_id,
          amount: alloc.amount,
          notes: alloc.notes,
          created_by: performedBy
        }, { onConflict: 'draw_id,invoice_id,cost_code_id' });

      if (allocError) {
        console.error('Error creating draw allocation:', allocError);
      }
    }

    // Update draw total
    await updateDrawTotal(drawId);

    // Log activity
    const totalAmount = allocations.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    await logDrawActivity(drawId, 'invoice_added', performedBy, {
      invoice_id: invoiceId,
      amount: totalAmount
    });

    return true;
  } catch (err) {
    console.error('Error adding invoice to draw:', err);
    throw err;
  }
}

// Helper: Remove invoice from draw
async function removeInvoiceFromDraw(invoiceId, drawId, performedBy = 'System') {
  try {
    // Get the amount being removed for logging
    const { data: allocations } = await supabase
      .from('v2_draw_allocations')
      .select('amount')
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    const totalAmount = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

    // Remove draw_allocations
    await supabase
      .from('v2_draw_allocations')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    // Remove from draw_invoices
    await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoiceId);

    // Update draw total
    await updateDrawTotal(drawId);

    // Log activity
    await logDrawActivity(drawId, 'invoice_removed', performedBy, {
      invoice_id: invoiceId,
      amount: totalAmount
    });

    return true;
  } catch (err) {
    console.error('Error removing invoice from draw:', err);
    throw err;
  }
}

// ============================================================

// Export Draw as Excel (G702/G703/PCCO)
app.get('/api/draws/:id/export/excel', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Get draw with full data
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`*, job:v2_jobs(id, name, address, client_name, contract_amount)`)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    // Get invoices in this draw
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices(
          id, invoice_number, invoice_date, amount,
          vendor:v2_vendors(name),
          allocations:v2_invoice_allocations(amount, po_line_item_id, cost_code:v2_cost_codes(id, code, name))
        )
      `)
      .eq('draw_id', drawId);

    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];

    // Get budget lines for scheduled values
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select(`*, cost_code:v2_cost_codes(id, code, name)`)
      .eq('job_id', draw.job_id);

    // Get previous draws' allocations
    const { data: previousDraws } = await supabase
      .from('v2_draws')
      .select('id')
      .eq('job_id', draw.job_id)
      .lt('draw_number', draw.draw_number);

    let previousByCode = {};
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`invoice:v2_invoices(allocations:v2_invoice_allocations(amount, cost_code_id, po_line_item_id))`)
        .in('draw_id', prevDrawIds);

      prevInvoices?.forEach(di => {
        di.invoice?.allocations?.forEach(alloc => {
          previousByCode[alloc.cost_code_id] = (previousByCode[alloc.cost_code_id] || 0) + parseFloat(alloc.amount || 0);
        });
      });
    }

    // Calculate this period by cost code
    let thisPeriodByCode = {};
    invoices.forEach(inv => {
      inv.allocations?.forEach(alloc => {
        const codeId = alloc.cost_code?.id;
        if (codeId) {
          thisPeriodByCode[codeId] = (thisPeriodByCode[codeId] || 0) + parseFloat(alloc.amount || 0);
        }
      });
    });

    // Get job change orders (approved ones billable to client)
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('*')
      .eq('job_id', draw.job_id)
      .in('status', ['approved'])
      .order('change_order_number');

    // Get CO billings for this draw
    const { data: coBillingsThisDraw } = await supabase
      .from('v2_job_co_draw_billings')
      .select('*, change_order:v2_job_change_orders(id, change_order_number, title, amount)')
      .eq('draw_id', drawId);

    // Get previous draws' CO billings
    let previousCOBillings = {};
    if (previousDraws && previousDraws.length > 0) {
      const prevDrawIds = previousDraws.map(d => d.id);
      const { data: prevCOBillings } = await supabase
        .from('v2_job_co_draw_billings')
        .select('change_order_id, amount')
        .in('draw_id', prevDrawIds);

      prevCOBillings?.forEach(b => {
        previousCOBillings[b.change_order_id] = (previousCOBillings[b.change_order_id] || 0) + parseFloat(b.amount || 0);
      });
    }

    // Calculate CO totals
    const approvedCOTotal = (jobChangeOrders || [])
      .filter(co => co.client_approved_at || co.client_approval_bypassed)
      .reduce((sum, co) => sum + parseFloat(co.amount || 0), 0);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Ross Built CMS';
    workbook.created = new Date();

    // ========== G702 Sheet ==========
    const g702 = workbook.addWorksheet('G702');
    g702.columns = [
      { width: 5 }, { width: 50 }, { width: 20 }
    ];

    // Header
    g702.addRow(['', 'AIA DOCUMENT G702 - APPLICATION AND CERTIFICATE FOR PAYMENT', '']);
    g702.addRow(['']);
    g702.addRow(['', `TO OWNER: ${draw.job?.client_name || '-'}`, `APPLICATION NO: ${draw.draw_number}`]);
    g702.addRow(['', `PROJECT: ${draw.job?.name || '-'}`, `PERIOD TO: ${draw.period_end || '-'}`]);
    g702.addRow(['', 'FROM CONTRACTOR: Ross Built Custom Homes', '']);
    g702.addRow(['']);

    const contractSum = parseFloat(draw.job?.contract_amount) || 0;
    const changeOrders = approvedCOTotal;
    const contractSumToDate = contractSum + changeOrders;

    // Build G703 data for calculations
    const g703Data = (budgetLines || []).map((bl, idx) => {
      const codeId = bl.cost_code?.id;
      const scheduled = parseFloat(bl.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const total = previous + thisPeriod;
      return { scheduled, previous, thisPeriod, total, balance: scheduled - total };
    });

    const totals = g703Data.reduce((acc, item) => ({
      scheduled: acc.scheduled + item.scheduled,
      previous: acc.previous + item.previous,
      thisPeriod: acc.thisPeriod + item.thisPeriod,
      total: acc.total + item.total
    }), { scheduled: 0, previous: 0, thisPeriod: 0, total: 0 });

    const previousCertificates = totals.previous;
    const currentPaymentDue = totals.thisPeriod;
    const balanceToFinish = contractSumToDate - totals.total;

    g702.addRow(['1.', 'ORIGINAL CONTRACT SUM', formatCurrency(contractSum)]);
    g702.addRow(['2.', 'Net change by Change Orders', formatCurrency(changeOrders)]);
    g702.addRow(['3.', 'CONTRACT SUM TO DATE (Line 1 + 2)', formatCurrency(contractSumToDate)]);
    g702.addRow(['4.', 'TOTAL COMPLETED & STORED TO DATE', formatCurrency(totals.total)]);
    g702.addRow(['5.', 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', formatCurrency(previousCertificates)]);
    g702.addRow(['6.', 'CURRENT PAYMENT DUE', formatCurrency(currentPaymentDue)]);
    g702.addRow(['7.', 'BALANCE TO FINISH', formatCurrency(balanceToFinish)]);

    // Style G702
    g702.getRow(1).font = { bold: true, size: 14 };
    g702.getRow(15).font = { bold: true };
    g702.getColumn(3).numFmt = '$#,##0.00';

    // ========== G703 Sheet ==========
    const g703 = workbook.addWorksheet('G703');
    g703.columns = [
      { header: 'Item', width: 6 },
      { header: 'Description of Work', width: 35 },
      { header: 'Scheduled Value', width: 15 },
      { header: 'Previous', width: 15 },
      { header: 'This Period', width: 15 },
      { header: 'Materials', width: 12 },
      { header: 'Total', width: 15 },
      { header: '%', width: 8 },
      { header: 'Balance', width: 15 }
    ];

    // Add header row
    g703.addRow(['A', 'B', 'C', 'D (Previous)', 'D (This Period)', 'E', 'F', 'G', 'H']);
    g703.getRow(1).font = { bold: true };
    g703.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Add data rows
    (budgetLines || []).forEach((bl, idx) => {
      const codeId = bl.cost_code?.id;
      const scheduled = parseFloat(bl.budgeted_amount) || 0;
      const previous = previousByCode[codeId] || 0;
      const thisPeriod = thisPeriodByCode[codeId] || 0;
      const materials = 0;
      const total = previous + thisPeriod + materials;
      const percent = scheduled > 0 ? (total / scheduled) : 0;
      const balance = scheduled - total;

      if (scheduled > 0 || thisPeriod > 0) {
        g703.addRow([
          idx + 1,
          `${bl.cost_code?.code} - ${bl.cost_code?.name}`,
          scheduled,
          previous,
          thisPeriod,
          materials,
          total,
          percent,
          balance
        ]);
      }
    });

    // Add totals row
    const totalsRow = g703.addRow([
      '', 'GRAND TOTAL',
      totals.scheduled, totals.previous, totals.thisPeriod, 0, totals.total,
      totals.scheduled > 0 ? totals.total / totals.scheduled : 0,
      totals.scheduled - totals.total
    ]);
    totalsRow.font = { bold: true };
    totalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Format currency columns
    [3, 4, 5, 6, 7, 9].forEach(col => {
      g703.getColumn(col).numFmt = '$#,##0.00';
    });
    g703.getColumn(8).numFmt = '0.0%';

    // ========== PCCO Sheet (Change Orders) ==========
    const pcco = workbook.addWorksheet('PCCO');
    pcco.columns = [
      { header: 'CO #', width: 8 },
      { header: 'Title', width: 30 },
      { header: 'Description', width: 40 },
      { header: 'Reason', width: 15 },
      { header: 'Amount', width: 15 },
      { header: 'Status', width: 15 },
      { header: 'Previous Billed', width: 15 },
      { header: 'This Period', width: 15 },
      { header: 'Total Billed', width: 15 },
      { header: 'Balance', width: 15 }
    ];

    pcco.addRow(['CHANGE ORDER LOG']);
    pcco.mergeCells('A1:J1');
    pcco.getRow(1).font = { bold: true, size: 14 };
    pcco.addRow(['']);

    // Header row
    const headerRow = pcco.addRow(['CO #', 'Title', 'Description', 'Reason', 'Amount', 'Status', 'Previous Billed', 'This Period', 'Total Billed', 'Balance']);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // Build CO billing map for this draw
    const thisDrawCOBillings = {};
    (coBillingsThisDraw || []).forEach(b => {
      thisDrawCOBillings[b.change_order_id] = parseFloat(b.amount || 0);
    });

    if (!jobChangeOrders || jobChangeOrders.length === 0) {
      pcco.addRow(['', 'No change orders for this job.', '', '', '', '', '', '', '', '']);
    } else {
      (jobChangeOrders || []).forEach(co => {
        const coAmount = parseFloat(co.amount) || 0;
        const previousBilled = previousCOBillings[co.id] || 0;
        const thisPeriod = thisDrawCOBillings[co.id] || 0;
        const totalBilled = previousBilled + thisPeriod;
        const balance = coAmount - totalBilled;

        let status = co.status;
        if (co.client_approved_at) status = 'Client Approved';
        else if (co.client_approval_bypassed) status = 'Bypassed';

        pcco.addRow([
          `CO-${String(co.change_order_number).padStart(3, '0')}`,
          co.title || '',
          co.description || '',
          co.reason || '',
          coAmount,
          status,
          previousBilled,
          thisPeriod,
          totalBilled,
          balance
        ]);
      });

      // Totals row
      const coTotals = (jobChangeOrders || []).reduce((acc, co) => {
        const coAmount = parseFloat(co.amount) || 0;
        const previousBilled = previousCOBillings[co.id] || 0;
        const thisPeriod = thisDrawCOBillings[co.id] || 0;
        return {
          amount: acc.amount + coAmount,
          previous: acc.previous + previousBilled,
          thisPeriod: acc.thisPeriod + thisPeriod,
          total: acc.total + previousBilled + thisPeriod
        };
      }, { amount: 0, previous: 0, thisPeriod: 0, total: 0 });

      const coTotalsRow = pcco.addRow([
        '', 'TOTALS', '', '', coTotals.amount, '',
        coTotals.previous, coTotals.thisPeriod, coTotals.total,
        coTotals.amount - coTotals.total
      ]);
      coTotalsRow.font = { bold: true };
      coTotalsRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    }

    // Format currency columns
    [5, 7, 8, 9, 10].forEach(col => {
      pcco.getColumn(col).numFmt = '$#,##0.00';
    });

    // Send file
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Draw_${draw.draw_number}_${draw.job?.name?.replace(/\s+/g, '_') || 'Job'}_G702_G703.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting Excel:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function for currency formatting
function formatCurrency(amount) {
  return parseFloat(amount) || 0;
}

// Helper to format money for PDF (with $ and commas)
function formatMoneyPDF(amount) {
  const num = parseFloat(amount) || 0;
  return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Export Draw as PDF (G702/G703 + Invoice PDFs)
app.get('/api/draws/:id/export/pdf', async (req, res) => {
  try {
    const drawId = req.params.id;

    // Get draw info with job details
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select(`*, job:v2_jobs(id, name, client_name, address, contract_amount)`)
      .eq('id', drawId)
      .single();

    if (drawError) throw drawError;
    if (!draw) return res.status(404).json({ error: 'Draw not found' });

    const jobId = draw.job_id;

    // Get invoices with allocations and stamped PDFs
    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`invoice:v2_invoices(id, invoice_number, amount, pdf_stamped_url, vendor:v2_vendors(name), allocations:v2_invoice_allocations(cost_code_id, amount))`)
      .eq('draw_id', drawId);

    const invoices = drawInvoices?.map(di => di.invoice).filter(Boolean) || [];

    // Get budget lines for G703
    const { data: budgetLines } = await supabase
      .from('v2_budget_lines')
      .select(`*, cost_code:v2_cost_codes(id, code, name)`)
      .eq('job_id', jobId)
      .order('cost_code(code)');

    // Get all draws for this job to calculate previous billings
    const { data: allDraws } = await supabase
      .from('v2_draws')
      .select(`id, draw_number, total_amount, status`)
      .eq('job_id', jobId)
      .order('draw_number');

    // Get all invoice allocations for previous draws
    const previousDrawIds = allDraws?.filter(d => d.draw_number < draw.draw_number).map(d => d.id) || [];
    let previousAllocations = [];
    if (previousDrawIds.length > 0) {
      const { data: prevDrawInvoices } = await supabase
        .from('v2_draw_invoices')
        .select(`invoice:v2_invoices(allocations:v2_invoice_allocations(cost_code_id, amount))`)
        .in('draw_id', previousDrawIds);
      previousAllocations = prevDrawInvoices?.flatMap(di => di.invoice?.allocations || []) || [];
    }

    // Get job change orders (PCCOs) for net change calculation
    const { data: jobChangeOrders } = await supabase
      .from('v2_job_change_orders')
      .select('amount, status')
      .eq('job_id', jobId)
      .eq('status', 'approved');

    // Calculate G702 values
    const contractAmount = parseFloat(draw.job?.contract_amount) || 0;
    const netChangeOrders = jobChangeOrders?.reduce((sum, co) => sum + (parseFloat(co.amount) || 0), 0) || 0;
    const contractSumToDate = contractAmount + netChangeOrders;

    // Use override values if set
    const originalContractSum = draw.g702_original_contract_override != null
      ? parseFloat(draw.g702_original_contract_override)
      : contractAmount;
    const changeOrdersAmount = draw.g702_change_orders_override != null
      ? parseFloat(draw.g702_change_orders_override)
      : netChangeOrders;

    // Calculate previous completed amounts
    const previousCompleted = previousDrawIds.length > 0
      ? allDraws.filter(d => d.draw_number < draw.draw_number).reduce((sum, d) => sum + (parseFloat(d.total_amount) || 0), 0)
      : 0;

    const thisDrawAmount = parseFloat(draw.total_amount) || 0;
    const totalCompletedToDate = previousCompleted + thisDrawAmount;
    const lessPreviousCertificates = previousCompleted;
    const currentPaymentDue = thisDrawAmount;
    const balanceToFinish = (originalContractSum + changeOrdersAmount) - totalCompletedToDate;

    // Build G703 data by cost code
    const g703Data = [];
    const costCodeMap = new Map();

    // Sum up allocations by cost code for current draw
    const currentAllocations = invoices.flatMap(inv => inv.allocations || []);
    currentAllocations.forEach(alloc => {
      const existing = costCodeMap.get(alloc.cost_code_id) || { current: 0 };
      existing.current += parseFloat(alloc.amount) || 0;
      costCodeMap.set(alloc.cost_code_id, existing);
    });

    // Sum up previous allocations by cost code
    previousAllocations.forEach(alloc => {
      const existing = costCodeMap.get(alloc.cost_code_id) || { current: 0 };
      existing.previous = (existing.previous || 0) + (parseFloat(alloc.amount) || 0);
      costCodeMap.set(alloc.cost_code_id, existing);
    });

    // Build G703 rows from budget lines (only include rows with budget or billings)
    let itemNum = 1;
    budgetLines?.forEach(bl => {
      const ccId = bl.cost_code_id;
      const allocData = costCodeMap.get(ccId) || { current: 0, previous: 0 };
      const scheduledValue = parseFloat(bl.budgeted_amount) || 0;
      const previousBillings = allocData.previous || 0;
      const currentBillings = allocData.current || 0;
      const totalBilled = previousBillings + currentBillings;

      // Skip rows with no budget and no billings
      if (scheduledValue === 0 && totalBilled === 0) return;

      const percentComplete = scheduledValue > 0 ? (totalBilled / scheduledValue) * 100 : 0;
      const balance = scheduledValue - totalBilled;

      g703Data.push({
        itemNum: itemNum++,
        costCode: bl.cost_code?.code || '',
        description: bl.cost_code?.name || '',
        scheduledValue,
        previousBillings,
        currentBillings,
        materialsStored: 0,
        totalBilled,
        percentComplete,
        balance
      });
    });

    // Create merged PDF
    const mergedPdf = await PDFDocument.create();

    // ============ G702 PAGE (Portrait) ============
    const g702Page = mergedPdf.addPage([612, 792]); // Letter size portrait
    const g702Height = g702Page.getHeight();
    let y = g702Height - 40;

    // Header
    g702Page.drawText('AIA DOCUMENT G702 - APPLICATION AND CERTIFICATE FOR PAYMENT', { x: 50, y, size: 11 });
    y -= 25;

    g702Page.drawText('TO OWNER:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.client_name || '-', { x: 120, y, size: 9 });
    y -= 15;

    g702Page.drawText('PROJECT:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.name || '-', { x: 120, y, size: 9 });
    y -= 15;

    g702Page.drawText('ADDRESS:', { x: 50, y, size: 9 });
    g702Page.drawText(draw.job?.address || '-', { x: 120, y, size: 9 });

    // Right side header
    g702Page.drawText('APPLICATION NO:', { x: 380, y: g702Height - 65, size: 9 });
    g702Page.drawText(String(draw.draw_number), { x: 480, y: g702Height - 65, size: 9 });
    g702Page.drawText('PERIOD TO:', { x: 380, y: g702Height - 80, size: 9 });
    g702Page.drawText(draw.period_end || '-', { x: 480, y: g702Height - 80, size: 9 });

    y -= 30;
    g702Page.drawText('FROM CONTRACTOR:', { x: 50, y, size: 9 });
    g702Page.drawText('Ross Built Custom Homes', { x: 160, y, size: 9 });

    // G702 Line Items Table
    y -= 40;
    const tableStartY = y;
    const lineHeight = 22;

    const g702Lines = [
      { num: '1.', label: 'ORIGINAL CONTRACT SUM', value: formatMoneyPDF(originalContractSum) },
      { num: '2.', label: 'Net change by Change Orders', value: formatMoneyPDF(changeOrdersAmount) },
      { num: '3.', label: 'CONTRACT SUM TO DATE (Line 1 + 2)', value: formatMoneyPDF(originalContractSum + changeOrdersAmount) },
      { num: '4.', label: 'TOTAL COMPLETED & STORED TO DATE (Column G on G703)', value: formatMoneyPDF(totalCompletedToDate) },
      { num: '5.', label: 'LESS PREVIOUS CERTIFICATES FOR PAYMENT', value: formatMoneyPDF(lessPreviousCertificates) },
      { num: '6.', label: 'CURRENT PAYMENT DUE', value: formatMoneyPDF(currentPaymentDue) },
      { num: '7.', label: 'BALANCE TO FINISH (Line 3 less Line 4)', value: formatMoneyPDF(balanceToFinish) },
    ];

    g702Lines.forEach((line, idx) => {
      const lineY = tableStartY - (idx * lineHeight);
      g702Page.drawText(line.num, { x: 50, y: lineY, size: 10 });
      g702Page.drawText(line.label, { x: 75, y: lineY, size: 10 });
      g702Page.drawText(line.value, { x: 480, y: lineY, size: 10 });
    });

    // Notes section if present
    if (draw.notes) {
      y = tableStartY - (g702Lines.length * lineHeight) - 30;
      g702Page.drawText('NOTES:', { x: 50, y, size: 9 });
      y -= 15;
      // Truncate long notes
      const notesText = draw.notes.length > 200 ? draw.notes.substring(0, 200) + '...' : draw.notes;
      g702Page.drawText(notesText, { x: 50, y, size: 9 });
    }

    // Footer
    g702Page.drawText('Generated by Ross Built CMS', { x: 50, y: 50, size: 8 });
    g702Page.drawText(new Date().toLocaleDateString(), { x: 50, y: 38, size: 8 });

    // ============ G703 PAGES (Landscape, multi-page support) ============
    const colX = [30, 55, 130, 220, 300, 380, 460, 540, 610, 680];
    const headers = ['#', 'Code', 'Description', 'Scheduled', 'Previous', 'This Period', 'Materials', 'Total', '%', 'Balance'];
    const rowHeight = 14;
    const g703Width = 792;
    const g703Height = 612;
    let grandTotals = { scheduled: 0, previous: 0, current: 0, materials: 0, total: 0, balance: 0 };

    // Helper function to create a new G703 page with headers
    function createG703Page(pageNum) {
      const page = mergedPdf.addPage([792, 612]); // Letter size landscape
      // Header
      page.drawText('AIA DOCUMENT G703 - CONTINUATION SHEET (SCHEDULE OF VALUES)', { x: 50, y: g703Height - 30, size: 11 });
      page.drawText(`Application #${draw.draw_number}`, { x: 50, y: g703Height - 45, size: 9 });
      page.drawText(`Period To: ${draw.period_end || '-'}`, { x: 200, y: g703Height - 45, size: 9 });
      page.drawText(`Project: ${draw.job?.name || '-'}`, { x: 400, y: g703Height - 45, size: 9 });
      if (pageNum > 1) {
        page.drawText(`(Page ${pageNum})`, { x: 700, y: g703Height - 30, size: 9 });
      }
      // Table headers
      const headerY = g703Height - 70;
      headers.forEach((h, i) => {
        page.drawText(h, { x: colX[i], y: headerY, size: 8 });
      });
      // Line under headers
      page.drawLine({
        start: { x: 25, y: headerY - 5 },
        end: { x: g703Width - 25, y: headerY - 5 },
        thickness: 0.5
      });
      return { page, rowY: headerY - 20 };
    }

    // Create first G703 page
    let g703PageNum = 1;
    let { page: currentG703Page, rowY } = createG703Page(g703PageNum);

    // Render all rows with pagination
    g703Data.forEach((row, idx) => {
      // Check if we need a new page
      if (rowY < 60) {
        // Add footer to current page
        currentG703Page.drawText('Generated by Ross Built CMS', { x: 50, y: 25, size: 8 });
        currentG703Page.drawText('(continued)', { x: g703Width - 100, y: 25, size: 8 });
        // Create new page
        g703PageNum++;
        const newPage = createG703Page(g703PageNum);
        currentG703Page = newPage.page;
        rowY = newPage.rowY;
      }

      currentG703Page.drawText(String(row.itemNum), { x: colX[0], y: rowY, size: 7 });
      currentG703Page.drawText(row.costCode.substring(0, 8), { x: colX[1], y: rowY, size: 7 });
      currentG703Page.drawText(row.description.substring(0, 15), { x: colX[2], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.scheduledValue).substring(0, 12), { x: colX[3], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.previousBillings).substring(0, 12), { x: colX[4], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.currentBillings).substring(0, 12), { x: colX[5], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.materialsStored).substring(0, 10), { x: colX[6], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.totalBilled).substring(0, 12), { x: colX[7], y: rowY, size: 7 });
      currentG703Page.drawText(row.percentComplete.toFixed(0) + '%', { x: colX[8], y: rowY, size: 7 });
      currentG703Page.drawText(formatMoneyPDF(row.balance).substring(0, 12), { x: colX[9], y: rowY, size: 7 });

      grandTotals.scheduled += row.scheduledValue;
      grandTotals.previous += row.previousBillings;
      grandTotals.current += row.currentBillings;
      grandTotals.total += row.totalBilled;
      grandTotals.balance += row.balance;

      rowY -= rowHeight;
    });

    // Grand totals row on last page
    rowY -= 5;
    currentG703Page.drawLine({
      start: { x: 25, y: rowY + 10 },
      end: { x: g703Width - 25, y: rowY + 10 },
      thickness: 0.5
    });

    currentG703Page.drawText('GRAND TOTAL', { x: colX[2], y: rowY, size: 8 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.scheduled).substring(0, 12), { x: colX[3], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.previous).substring(0, 12), { x: colX[4], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.current).substring(0, 12), { x: colX[5], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.total).substring(0, 12), { x: colX[7], y: rowY, size: 7 });
    currentG703Page.drawText(formatMoneyPDF(grandTotals.balance).substring(0, 12), { x: colX[9], y: rowY, size: 7 });

    // Footer on last page
    currentG703Page.drawText('Generated by Ross Built CMS', { x: 50, y: 25, size: 8 });
    currentG703Page.drawText(new Date().toLocaleDateString(), { x: g703Width - 100, y: 25, size: 8 });

    // ============ INVOICE COVER PAGE ============
    if (invoices.length > 0) {
      const invoiceCoverPage = mergedPdf.addPage([612, 792]);
      const icHeight = invoiceCoverPage.getHeight();

      invoiceCoverPage.drawText('ATTACHED INVOICES', { x: 50, y: icHeight - 60, size: 18 });
      invoiceCoverPage.drawText(`Draw #${draw.draw_number} - ${draw.job?.name || ''}`, { x: 50, y: icHeight - 85, size: 12 });

      let listY = icHeight - 130;
      invoices.forEach((inv, idx) => {
        if (listY < 80) return;
        const amount = parseFloat(inv.amount) || 0;
        invoiceCoverPage.drawText(
          `${idx + 1}. ${inv.vendor?.name || 'Unknown'} - Invoice #${inv.invoice_number || 'N/A'} - ${formatMoneyPDF(amount)}`,
          { x: 60, y: listY, size: 10 }
        );
        listY -= 20;
      });

      invoiceCoverPage.drawText('Generated by Ross Built CMS', { x: 50, y: 40, size: 8 });
    }

    // ============ APPEND INVOICE PDFs ============
    for (const inv of invoices) {
      if (inv.pdf_stamped_url) {
        try {
          const urlParts = inv.pdf_stamped_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1].split('?')[0]);
            const pdfBuffer = await downloadPDF(storagePath);
            const invoicePdf = await PDFDocument.load(pdfBuffer);
            const pages = await mergedPdf.copyPages(invoicePdf, invoicePdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
          }
        } catch (pdfErr) {
          console.error(`Failed to fetch PDF for invoice ${inv.id}:`, pdfErr.message);
        }
      }
    }

    const pdfBytes = await mergedPdf.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Draw_${draw.draw_number}_${draw.job?.name?.replace(/\s+/g, '_') || 'Job'}_G702_G703.pdf`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Error exporting PDF:', err);
    res.status(500).json({ error: err.message });
  }
});

// Job-specific stats
app.get('/api/jobs/:id/stats', async (req, res) => {
  try {
    const jobId = req.params.id;

    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('status, amount')
      .eq('job_id', jobId);

    const stats = {
      needs_review: { count: 0, amount: 0 },
      ready_for_approval: { count: 0, amount: 0 },
      approved: { count: 0, amount: 0 },
      in_draw: { count: 0, amount: 0 },
      paid: { count: 0, amount: 0 }
    };

    if (invoices) {
      invoices.forEach(inv => {
        if (stats[inv.status]) {
          stats[inv.status].count++;
          stats[inv.status].amount += parseFloat(inv.amount) || 0;
        }
      });
    }

    const { data: draws } = await supabase
      .from('v2_draws')
      .select('status, total_amount')
      .eq('job_id', jobId);

    const drawStats = {
      draft: { count: 0, amount: 0 },
      submitted: { count: 0, amount: 0 },
      funded: { count: 0, amount: 0 }
    };

    if (draws) {
      draws.forEach(d => {
        // Group partially_funded and overfunded with funded for stats
        const statCategory = ['partially_funded', 'overfunded'].includes(d.status) ? 'funded' : d.status;
        if (drawStats[statCategory]) {
          drawStats[statCategory].count++;
          drawStats[statCategory].amount += parseFloat(d.total_amount) || 0;
        }
      });
    }

    res.json({ invoices: stats, draws: drawStats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// INVOICE EDITING ENDPOINTS
// ============================================================

// Partial update (PATCH)
app.patch('/api/invoices/:id', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const updates = req.body;
  const performedBy = updates.performed_by || 'System';
  delete updates.performed_by;

  // Check if invoice exists
  const { data: existing, error: getError } = await supabase
    .from('v2_invoices')
    .select('*, allocations:v2_invoice_allocations(*)')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (getError || !existing) {
    throw notFoundError('invoice', invoiceId);
  }

  // Check if invoice is archived (read-only) - allow status changes to unarchive
  const archivedStatuses = ['paid'];
  const allowedUnarchiveStatuses = ['approved', 'ready_for_approval', 'in_draw', 'needs_review'];
  if (archivedStatuses.includes(existing.status) && !allowedUnarchiveStatuses.includes(updates.status)) {
    throw new AppError('ARCHIVED_INVOICE', `Cannot edit archived invoice (status: ${existing.status})`, { status: 400 });
  }

  // Check lock
  const lockStatus = await checkLock('invoice', invoiceId);
  if (lockStatus.isLocked && lockStatus.lock.lockedBy !== performedBy) {
    throw lockedError(lockStatus.lock.lockedBy, lockStatus.lock.expiresAt);
  }

  // Version check if provided
  if (updates.expected_version && updates.expected_version !== existing.version) {
    throw versionConflictError(updates.expected_version, existing.version, existing);
  }
  delete updates.expected_version;

  // Validate partial update
  const validation = validateInvoice(updates, true);
  if (!validation.valid) {
    throw validationError(validation.errors);
  }

  // Check for duplicate if changing invoice_number or vendor_id
  // Allow override with overrideDuplicate flag
  if ((updates.invoice_number || updates.vendor_id) && !updates.overrideDuplicate) {
    const dupCheck = await checkDuplicate(
      updates.vendor_id || existing.vendor_id,
      updates.invoice_number || existing.invoice_number,
      updates.amount || existing.amount,
      invoiceId
    );
    if (dupCheck.isDuplicate) {
      // Return soft-block that can be overridden (like PO_OVERAGE)
      return res.status(409).json({
        error: 'DUPLICATE_INVOICE',
        code: 'DUPLICATE_INVOICE',
        message: dupCheck.message,
        existingInvoice: dupCheck.existingInvoice,
        existingId: dupCheck.existingInvoice?.id,
        existingStatus: dupCheck.existingInvoice?.status,
        existingAmount: dupCheck.existingInvoice?.amount
      });
    }
  }
  delete updates.overrideDuplicate;

  // If amount is changing, check that existing allocations would still balance
  if (updates.amount && parseFloat(updates.amount) !== parseFloat(existing.amount)) {
    const existingAllocs = existing.allocations || [];
    if (existingAllocs.length > 0) {
      const allocTotal = existingAllocs.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
      const newAmount = parseFloat(updates.amount);
      if (Math.abs(allocTotal - newAmount) > 0.01) {
        throw validationError([{
          field: 'amount',
          message: `Cannot change amount: existing allocations total $${allocTotal.toFixed(2)} would not match new amount $${newAmount.toFixed(2)}. Update allocations first.`
        }]);
      }
    }
  }

  // Create undo snapshot
  await createUndoSnapshot('invoice', invoiceId, 'edited', existing, performedBy);

  // Build update object
  const updateFields = {};
  const editableFields = ['invoice_number', 'invoice_date', 'due_date', 'amount', 'job_id', 'vendor_id', 'po_id', 'notes', 'status', 'paid_to_vendor', 'paid_to_vendor_date', 'paid_to_vendor_ref', 'needs_review', 'review_flags'];
  for (const field of editableFields) {
    if (updates.hasOwnProperty(field)) {
      updateFields[field] = updates[field];
    }
  }

  // Append partial approval note to invoice notes and add flag
  console.log('[PATCH] partial_approval_note:', updates.partial_approval_note);
  if (updates.partial_approval_note) {
    console.log('[PATCH] Adding partial_approval flag');
    const existingNotes = existing.notes || '';
    const separator = existingNotes ? '\n\n' : '';
    updateFields.notes = existingNotes + separator + updates.partial_approval_note;

    // Add partial_approval flag to review_flags
    const existingFlags = existing.review_flags || [];
    if (!existingFlags.includes('partial_approval')) {
      updateFields.review_flags = [...existingFlags, 'partial_approval'];
      console.log('[PATCH] New review_flags:', updateFields.review_flags);
    }
  }

  // AI LEARNING: When assigning a job_id, record it so AI can learn for future invoices
  // Note: Status transition is NOT automatic - user must explicitly click "Submit for Approval"
  if (updateFields.job_id && updateFields.job_id !== existing.job_id) {
    try {
      const { data: assignedJob } = await supabase
        .from('v2_jobs')
        .select('id, name')
        .eq('id', updateFields.job_id)
        .single();

      if (assignedJob && existing.ai_extracted_data) {
        await aiLearning.recordInvoiceLearning(existing, assignedJob.id, assignedJob);
      }
    } catch (learnErr) {
      console.error('[AI Learning] Error recording learning:', learnErr.message);
      // Don't fail the update if learning fails
    }
  }

  // AI LEARNING: When correcting vendor_id, record feedback and learn the mapping
  if (updateFields.vendor_id && updateFields.vendor_id !== existing.vendor_id) {
    try {
      const { data: newVendor } = await supabase
        .from('v2_vendors')
        .select('id, name')
        .eq('id', updateFields.vendor_id)
        .single();

      if (newVendor && existing.ai_extracted_data) {
        const aiVendorName = existing.ai_extracted_data.parsed_vendor_name ||
                             existing.extracted?.vendor?.companyName;
        if (aiVendorName && aiVendorName !== newVendor.name) {
          // Record feedback and learn the correction
          await aiLearning.recordFeedback({
            invoiceId: invoiceId,
            fieldName: 'vendor',
            aiValue: aiVendorName,
            userValue: newVendor.name,
            entityId: newVendor.id,
            correctedBy: performedBy,
            context: { original_vendor_id: existing.vendor_id }
          });
          // Also increment correction count on vendor
          await supabase
            .from('v2_vendors')
            .update({ correction_count: (existing.vendor?.correction_count || 0) + 1 })
            .eq('id', existing.vendor_id);
        }
      }
    } catch (learnErr) {
      console.error('[AI Learning] Error recording vendor learning:', learnErr.message);
      // Don't fail the update if learning fails
    }
  }

  // Handle status transitions with proper timestamp updates
  if (updates.status && updates.status !== existing.status) {
    // Validate transition is allowed
    const transitionCheck = validateStatusTransition(existing.status, updates.status);
    if (!transitionCheck.valid) {
      throw new AppError('TRANSITION_NOT_ALLOWED', transitionCheck.error);
    }

    // For approval, run pre-transition checks (including PO overage)
    // Skip pre-transition checks when removing from draw (in_draw → approved is a rollback)
    if (updates.status === 'approved' && existing.status !== 'in_draw') {
      const allocsToUse = updates.allocations || existing.allocations || [];
      const preCheck = await validatePreTransition(existing, 'approved', {
        allocations: allocsToUse,
        overridePoOverage: updates.overridePoOverage
      });

      if (!preCheck.valid) {
        // Check if it's a PO overage that requires override
        const poError = preCheck.errors.find(e => e.type === 'PO_OVERAGE');
        if (poError) {
          return res.status(400).json({
            success: false,
            error: 'PO_OVERAGE',
            message: poError.message,
            poRemaining: poError.poRemaining,
            invoiceAmount: poError.invoiceAmount,
            overageAmount: poError.overageAmount,
            requiresOverride: true
          });
        }
        throw new AppError('PRE_TRANSITION_FAILED', preCheck.errors[0]?.message || 'Pre-transition requirements not met', { errors: preCheck.errors });
      }
    }

    const statusTransitions = {
      // Unapprove: approved → ready_for_approval (clear approval)
      'approved_to_ready_for_approval': () => {
        updateFields.approved_at = null;
        updateFields.approved_by = null;
      },
      // Send back from approved: approved → needs_review (clear approval, record reason)
      'approved_to_needs_review': () => {
        updateFields.approved_at = null;
        updateFields.approved_by = null;
        updateFields.sent_back_at = new Date().toISOString();
        updateFields.sent_back_by = performedBy;
        if (updates.sendback_reason) {
          updateFields.sent_back_reason = updates.sendback_reason;
        }
      },
      // Send back from ready_for_approval: ready_for_approval → needs_review (record reason)
      'ready_for_approval_to_needs_review': () => {
        updateFields.sent_back_at = new Date().toISOString();
        updateFields.sent_back_by = performedBy;
        if (updates.sendback_reason) {
          updateFields.sent_back_reason = updates.sendback_reason;
        }
      },
      // Remove from draw: in_draw → approved
      'in_draw_to_approved': () => {
        // Keep approval info
      },
      // Resubmit denied: denied → needs_review (clear denial)
      'denied_to_needs_review': () => {
        updateFields.denied_at = null;
        updateFields.denied_by = null;
        updateFields.denial_reason = null;
      },
      // Submit for approval: needs_review → ready_for_approval (clear send back)
      'needs_review_to_ready_for_approval': () => {
        updateFields.coded_at = new Date().toISOString();
        updateFields.coded_by = performedBy;
        updateFields.sent_back_at = null;
        updateFields.sent_back_by = null;
        updateFields.sent_back_reason = null;
      },
      // Approve: ready_for_approval → approved (stamping handled below)
      'ready_for_approval_to_approved': () => {
        updateFields.approved_at = new Date().toISOString();
        updateFields.approved_by = performedBy;
      },
      // Deny: any → denied
      'to_denied': () => {
        updateFields.denied_at = new Date().toISOString();
        updateFields.denied_by = performedBy;
        if (updates.denial_reason) {
          updateFields.denial_reason = updates.denial_reason;
        }
      }
    };

    const transitionKey = `${existing.status}_to_${updates.status}`;
    if (statusTransitions[transitionKey]) {
      statusTransitions[transitionKey]();
    } else if (updates.status === 'denied') {
      statusTransitions['to_denied']();
    }

    // Handle removing invoice from draw when transitioning OUT of in_draw status
    // This covers: in_draw → approved, in_draw → ready_for_approval (unapprove), etc.
    if (existing.status === 'in_draw' && updates.status !== 'in_draw') {
      // Find and delete the draw_invoice record
      const { data: drawInvoice, error: findError } = await supabase
        .from('v2_draw_invoices')
        .select('draw_id, draw:v2_draws(draw_number)')
        .eq('invoice_id', invoiceId)
        .single();

      if (findError && findError.code !== 'PGRST116') { // PGRST116 = not found
        console.error('[TRANSITION] Error finding draw link:', findError);
      }

      if (drawInvoice) {
        const { error: deleteError } = await supabase
          .from('v2_draw_invoices')
          .delete()
          .eq('invoice_id', invoiceId);

        if (deleteError) {
          console.error('[TRANSITION] Error deleting draw link:', deleteError);
          throw new AppError('DATABASE_ERROR', 'Failed to remove invoice from draw');
        }

        // Update draw total
        const { data: remainingInvoices } = await supabase
          .from('v2_draw_invoices')
          .select('invoice:v2_invoices(amount)')
          .eq('draw_id', drawInvoice.draw_id);

        const newTotal = remainingInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
        await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', drawInvoice.draw_id);

        // Log removed from draw activity
        await logActivity(invoiceId, 'removed_from_draw', performedBy, {
          draw_number: drawInvoice.draw?.draw_number,
          new_status: updates.status
        });

        console.log(`[TRANSITION] Removed invoice ${invoiceId} from draw ${drawInvoice.draw_id}`);
      }
    }

    // Handle adding invoice to draw when transitioning TO in_draw
    if (updates.status === 'in_draw' && existing.status === 'approved') {
      // Find or create a draft draw for this job
      let drawId;
      let drawNumber;

      // First, look for an existing draft draw for this job
      const { data: existingDraw } = await supabase
        .from('v2_draws')
        .select('id, draw_number')
        .eq('job_id', existing.job_id)
        .eq('status', 'draft')
        .single();

      if (existingDraw) {
        drawId = existingDraw.id;
        drawNumber = existingDraw.draw_number;
      } else {
        // Create a new draft draw for this job
        // Get the next draw number
        const { data: lastDraw } = await supabase
          .from('v2_draws')
          .select('draw_number')
          .eq('job_id', existing.job_id)
          .order('draw_number', { ascending: false })
          .limit(1)
          .single();

        drawNumber = (lastDraw?.draw_number || 0) + 1;

        const { data: newDraw, error: createDrawError } = await supabase
          .from('v2_draws')
          .insert({
            job_id: existing.job_id,
            draw_number: drawNumber,
            status: 'draft',
            total_amount: 0
          })
          .select()
          .single();

        if (createDrawError) {
          console.error('Failed to create draw:', createDrawError);
          throw new Error('Failed to create draw for invoice');
        }

        drawId = newDraw.id;
      }

      // Add invoice to draw_invoices
      const { error: linkError } = await supabase
        .from('v2_draw_invoices')
        .insert({ draw_id: drawId, invoice_id: invoiceId });

      if (linkError && !linkError.message?.includes('duplicate')) {
        console.error('Failed to link invoice to draw:', linkError);
      }

      // Update draw total
      const { data: drawInvoices } = await supabase
        .from('v2_draw_invoices')
        .select('invoice:v2_invoices(amount)')
        .eq('draw_id', drawId);

      const newTotal = drawInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
      await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', drawId);

      // Log activity
      await logActivity(invoiceId, 'added_to_draw', performedBy, { draw_number: drawNumber });

      // Add IN DRAW stamp to the PDF using fixed path
      try {
        if (existing.pdf_url) {
          // Always stamp from original PDF
          const storagePath = extractStoragePath(existing.pdf_url);
          if (storagePath) {
            const pdfBuffer = await downloadPDF(storagePath);
            const stampedBuffer = await stampInDraw(pdfBuffer, drawNumber);
            // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
            const result = await uploadStampedPDFById(stampedBuffer, invoiceId, existing.job_id);
            updateFields.pdf_stamped_url = result.url;
          }
        }
      } catch (stampErr) {
        console.error('IN DRAW stamp failed:', stampErr.message);
      }
    }

    // Handle PDF stamping when transitioning TO approved
    if (updates.status === 'approved' && existing.status !== 'in_draw') {
      try {
        // Fetch full invoice data with relations for stamping
        const { data: fullInvoice } = await supabase
          .from('v2_invoices')
          .select(`
            *,
            vendor:v2_vendors(id, name),
            job:v2_jobs(id, name),
            po:v2_purchase_orders(id, po_number, description, total_amount),
            allocations:v2_invoice_allocations(
              amount,
              cost_code_id,
              cost_code:v2_cost_codes(code, name)
            )
          `)
          .eq('id', invoiceId)
          .single();

        if (fullInvoice?.pdf_url) {
          // Always stamp from original PDF
          const storagePath = extractStoragePath(fullInvoice.pdf_url);
          if (storagePath) {
            const pdfBuffer = await downloadPDF(storagePath);

            // Get PO billing info with CO cost code exclusion
            let poTotal = null;
            let poBilledToDate = 0;
            let poLinkedAmount = null;
            const isCOCostCode = (code) => code && /C$/i.test(code.trim());

            // Build allocations with cost code details for stamping (do this first so we have cost codes)
            let allocationsForStamp = [];
            let ccMap = new Map();

            if (updates.allocations && updates.allocations.length > 0) {
              // Allocations from request - need to fetch cost code details
              const costCodeIds = updates.allocations
                .filter(a => a.cost_code_id)
                .map(a => a.cost_code_id);

              if (costCodeIds.length > 0) {
                const { data: costCodes } = await supabase
                  .from('v2_cost_codes')
                  .select('id, code, name')
                  .in('id', costCodeIds);

                ccMap = new Map((costCodes || []).map(cc => [cc.id, cc]));

                allocationsForStamp = updates.allocations
                  .filter(a => a.cost_code_id && ccMap.has(a.cost_code_id))
                  .map(a => ({
                    amount: a.amount,
                    cost_code: ccMap.get(a.cost_code_id)
                  }));
              }
            } else {
              // Use allocations from database
              allocationsForStamp = fullInvoice.allocations || [];
            }

            if (fullInvoice.po?.id) {
              poTotal = fullInvoice.po.total_amount;

              // Calculate how much of THIS invoice links to PO (exclude CO allocations)
              poLinkedAmount = allocationsForStamp.reduce((sum, a) => {
                const code = a.cost_code?.code;
                if (code && isCOCostCode(code)) return sum;
                return sum + parseFloat(a.amount || 0);
              }, 0);

              // Get prior invoices with allocations to exclude CO work
              const { data: priorInvoices } = await supabase
                .from('v2_invoices')
                .select(`
                  id,
                  amount,
                  allocations:v2_invoice_allocations(
                    amount,
                    cost_code:v2_cost_codes(code)
                  )
                `)
                .eq('po_id', fullInvoice.po.id)
                .neq('id', invoiceId)
                .in('status', ['approved', 'in_draw', 'paid']);

              if (priorInvoices) {
                poBilledToDate = priorInvoices.reduce((sum, inv) => {
                  if (inv.allocations && inv.allocations.length > 0) {
                    return sum + inv.allocations.reduce((s, a) => {
                      if (a.cost_code?.code && isCOCostCode(a.cost_code.code)) return s;
                      return s + parseFloat(a.amount || 0);
                    }, 0);
                  }
                  return sum + parseFloat(inv.amount || 0);
                }, 0);
              }
            }

            const stampedBuffer = await stampApproval(pdfBuffer, {
              status: 'APPROVED',
              date: new Date().toLocaleDateString(),
              approvedBy: performedBy,
              vendorName: fullInvoice.vendor?.name,
              invoiceNumber: fullInvoice.invoice_number,
              jobName: fullInvoice.job?.name,
              costCodes: allocationsForStamp.map(a => ({
                code: a.cost_code?.code,
                name: a.cost_code?.name,
                amount: a.amount
              })).filter(cc => cc.code), // Only include allocations with cost codes
              amount: fullInvoice.amount,
              poNumber: fullInvoice.po?.po_number,
              poDescription: fullInvoice.po?.description,
              poTotal: poTotal,
              poBilledToDate: poBilledToDate,
              poLinkedAmount: poLinkedAmount,
              isPartial: fullInvoice.review_flags?.includes('partial_approval')
            });

            // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
            const result = await uploadStampedPDFById(stampedBuffer, invoiceId, fullInvoice.job?.id);
            updateFields.pdf_stamped_url = result.url;
          }
        }
      } catch (stampErr) {
        console.error('PDF stamping failed during PATCH:', stampErr.message);
        // Continue without stamping
      }
    }

    // Handle clearing stamps when transitioning back to ready_for_approval (from any status)
    if (updates.status === 'ready_for_approval') {
      updateFields.pdf_stamped_url = null;
      updateFields.approved_at = null;
      updateFields.approved_by = null;
    }

    // Handle re-stamping when going from in_draw back to approved (remove IN DRAW stamp)
    if (updates.status === 'approved' && existing.status === 'in_draw') {
      try {
        // Re-fetch invoice with full data for re-stamping
        const { data: fullInvoice } = await supabase
          .from('v2_invoices')
          .select(`
            *,
            vendor:v2_vendors(id, name),
            job:v2_jobs(id, name),
            po:v2_purchase_orders(id, po_number, description, total_amount),
            allocations:v2_invoice_allocations(
              amount,
              cost_code_id,
              cost_code:v2_cost_codes(code, name)
            )
          `)
          .eq('id', invoiceId)
          .single();

        if (fullInvoice?.pdf_url) {
          // Always stamp from original PDF
          const storagePath = extractStoragePath(fullInvoice.pdf_url);
          if (storagePath) {
            // Download ORIGINAL PDF (not stamped) to re-stamp fresh
            const pdfBuffer = await downloadPDF(storagePath);

            // Get PO billing info with CO cost code exclusion
            let poTotal = null;
            let poBilledToDate = 0;
            let poLinkedAmount = null;
            const isCOCostCode = (code) => code && /C$/i.test(code.trim());

            if (fullInvoice.po?.id) {
              poTotal = fullInvoice.po.total_amount;

              // Calculate how much of THIS invoice links to PO (exclude CO allocations)
              const allocs = fullInvoice.allocations || [];
              poLinkedAmount = allocs.reduce((sum, a) => {
                if (a.cost_code?.code && isCOCostCode(a.cost_code.code)) return sum;
                return sum + parseFloat(a.amount || 0);
              }, 0);

              // Get prior invoices with allocations to exclude CO work
              const { data: priorInvoices } = await supabase
                .from('v2_invoices')
                .select(`
                  id,
                  amount,
                  allocations:v2_invoice_allocations(
                    amount,
                    cost_code:v2_cost_codes(code)
                  )
                `)
                .eq('po_id', fullInvoice.po.id)
                .neq('id', invoiceId)
                .in('status', ['approved', 'in_draw', 'paid']);

              if (priorInvoices) {
                poBilledToDate = priorInvoices.reduce((sum, inv) => {
                  if (inv.allocations && inv.allocations.length > 0) {
                    return sum + inv.allocations.reduce((s, a) => {
                      if (a.cost_code?.code && isCOCostCode(a.cost_code.code)) return s;
                      return s + parseFloat(a.amount || 0);
                    }, 0);
                  }
                  return sum + parseFloat(inv.amount || 0);
                }, 0);
              }
            }

            const stampedBuffer = await stampApproval(pdfBuffer, {
              status: 'APPROVED',
              date: new Date().toLocaleDateString(),
              approvedBy: fullInvoice.approved_by || performedBy,
              vendorName: fullInvoice.vendor?.name,
              invoiceNumber: fullInvoice.invoice_number,
              jobName: fullInvoice.job?.name,
              costCodes: (fullInvoice.allocations || []).map(a => ({
                code: a.cost_code?.code,
                name: a.cost_code?.name,
                amount: a.amount
              })).filter(cc => cc.code),
              amount: fullInvoice.amount,
              poNumber: fullInvoice.po?.po_number,
              poDescription: fullInvoice.po?.description,
              poTotal: poTotal,
              poBilledToDate: poBilledToDate,
              poLinkedAmount: poLinkedAmount,
              isPartial: fullInvoice.review_flags?.includes('partial_approval')
            });

            // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
            const result = await uploadStampedPDFById(stampedBuffer, invoiceId, fullInvoice.job?.id);
            updateFields.pdf_stamped_url = result.url;
          }
        }
      } catch (stampErr) {
        console.error('Re-stamping failed when removing from draw:', stampErr.message);
      }
    }
  }

  // Track changes for activity log
  const changes = {};
  for (const [key, value] of Object.entries(updateFields)) {
    if (existing[key] !== value) {
      changes[key] = { from: existing[key], to: value };
    }
  }

  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateFields)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to update invoice');
  }

  // Handle allocations if provided
  if (updates.allocations && Array.isArray(updates.allocations)) {
    // Delete existing allocations
    await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);

    // Insert new allocations (only those with cost_code_id)
    const allocsToInsert = updates.allocations
      .filter(a => a.cost_code_id)
      .map(a => ({
        invoice_id: invoiceId,
        cost_code_id: a.cost_code_id,
        amount: parseFloat(a.amount) || 0,
        notes: a.notes || null,
        job_id: a.job_id || null,
        po_id: a.po_id || null,
        po_line_item_id: a.po_line_item_id || null,
        change_order_id: a.change_order_id || null
      }));

    if (allocsToInsert.length > 0) {
      const { error: allocError } = await supabase.from('v2_invoice_allocations').insert(allocsToInsert);
      if (allocError) {
        console.error('Failed to save allocations:', allocError);
      }
    }

    changes.allocations = { from: existing.allocations?.length || 0, to: allocsToInsert.length };
  }

  // Re-stamp PDF if there were changes that affect the stamp
  // (but skip if status transition already handled stamping)
  const stampAffectingFields = ['job_id', 'vendor_id', 'amount', 'invoice_number', 'po_id'];
  const hasStampAffectingChanges = stampAffectingFields.some(f => changes[f]) || changes.allocations;
  const statusAlreadyStamped = changes.status && ['needs_review', 'ready_for_approval', 'approved', 'in_draw', 'paid'].includes(changes.status.to);

  if (hasStampAffectingChanges && !statusAlreadyStamped) {
    // Re-stamp in background (don't block response)
    restampInvoice(invoiceId).catch(err => {
      console.error('[RESTAMP] Background re-stamp failed:', err.message);
    });
  }

  // Log activity
  if (Object.keys(changes).length > 0) {
    // Check for partial approval
    if (updates.status === 'approved' && updates.partial_approval_note) {
      await logActivity(invoiceId, 'partial_approval', performedBy, {
        changes,
        note: updates.partial_approval_note,
        partial_amount: updates.partial_amount
      });
    } else if (changes.status?.to === 'approved') {
      await logActivity(invoiceId, 'approved', performedBy, { changes });
    } else if (changes.status?.to === 'needs_review' && updates.sendback_reason) {
      // Send back with reason
      await logActivity(invoiceId, 'sent_back', performedBy, {
        changes,
        reason: updates.sendback_reason,
        from_status: changes.status?.from
      });
    } else if (changes.status?.to === 'denied') {
      // Denial
      await logActivity(invoiceId, 'denied', performedBy, {
        changes,
        reason: updates.denial_reason
      });
    } else if (changes.status?.to === 'ready_for_approval') {
      // Submitted for approval
      await logActivity(invoiceId, 'ready_for_approval', performedBy, { changes });
    } else {
      await logActivity(invoiceId, 'edited', performedBy, { changes });
    }
  }

  // Broadcast update
  broadcastInvoiceUpdate(updated, 'edited', performedBy);

  res.json({
    success: true,
    invoice: updated,
    changes,
    undoAvailable: true,
    undoExpiresIn: UNDO_WINDOW_SECONDS * 1000
  });
}));

// Full update (PUT)
app.put('/api/invoices/:id/full', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { invoice: updates, allocations, performed_by: performedBy = 'System' } = req.body;

  // Check if invoice exists
  const { data: existing, error: getError } = await supabase
    .from('v2_invoices')
    .select('*, allocations:v2_invoice_allocations(*)')
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
    console.error('[RESTAMP] Background re-stamp failed:', err.message);
  });

  await logActivity(invoiceId, 'full_edit', performedBy, { updates });
  broadcastInvoiceUpdate(updated, 'full_edit', performedBy);

  res.json({ success: true, invoice: updated });
}));

// ============================================================
// STATUS TRANSITION ENDPOINT
// ============================================================

app.post('/api/invoices/:id/transition', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { new_status, performed_by: performedBy, reason, allocations, draw_id, overridePoOverage } = req.body;

  // Get current invoice
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

  // Validate transition is allowed
  const transitionCheck = validateStatusTransition(invoice.status, new_status);
  if (!transitionCheck.valid) {
    throw transitionError(invoice.status, new_status, transitionCheck.error);
  }

  // If allocations provided inline, validate them first
  if (allocations && allocations.length > 0) {
    const allocCheck = validateAllocations(allocations, parseFloat(invoice.amount));
    if (!allocCheck.valid) {
      throw validationError([{ field: 'allocations', message: allocCheck.error }]);
    }

    // Validate cost codes exist
    const costCodeIds = allocations.map(a => a.cost_code_id).filter(id => id);
    const codeCheck = await validateCostCodesExist(costCodeIds);
    if (!codeCheck.valid) {
      throw validationError([{ field: 'allocations', message: codeCheck.error }]);
    }
  }

  // Validate pre-transition requirements (pass overridePoOverage for soft-block)
  const preCheck = await validatePreTransition(invoice, new_status, { allocations, draw_id, overridePoOverage });
  if (!preCheck.valid) {
    // Check if it's a PO overage that requires override
    const poError = preCheck.errors.find(e => e.type === 'PO_OVERAGE');
    if (poError) {
      return res.status(400).json({
        success: false,
        error: 'PO_OVERAGE',
        message: poError.message,
        poRemaining: poError.poRemaining,
        invoiceAmount: poError.invoiceAmount,
        overageAmount: poError.overageAmount,
        requiresOverride: true
      });
    }
    throw new AppError('PRE_TRANSITION_FAILED', 'Pre-transition requirements not met', { errors: preCheck.errors });
  }

  // Create undo snapshot
  await createUndoSnapshot('invoice', invoiceId, new_status, invoice, performedBy);

  // Build update object
  const updateData = { status: new_status };
  let pdf_stamped_url = null;

  // Handle status-specific logic
  switch (new_status) {
    case 'ready_for_approval':
      updateData.coded_at = new Date().toISOString();
      updateData.coded_by = performedBy;
      updateData.approved_at = null;
      updateData.approved_by = null;

      // Revert PO line items if moving FROM billable status
      if (['approved', 'in_draw', 'paid'].includes(invoice.status)) {
        if (invoice.po?.id && invoice.allocations && invoice.allocations.length > 0) {
          await updatePOLineItemsForAllocations(invoice.po.id, invoice.allocations, false);
        }
      }

      // Stamp PDF with "Ready for Approval" (progressive stamping) using fixed path
      {
        if (invoice.pdf_url) {
          try {
            // Always stamp from original PDF
            const storagePath = extractStoragePath(invoice.pdf_url);
            if (storagePath) {
              const pdfBuffer = await downloadPDF(storagePath);

              // Get cost codes for stamp
              const allocsForStamp = invoice.allocations || [];
              let costCodesForStamp = [];
              if (allocsForStamp.length > 0) {
                const costCodeIds = allocsForStamp.map(a => a.cost_code_id).filter(id => id);
                if (costCodeIds.length > 0) {
                  const { data: costCodes } = await supabase
                    .from('v2_cost_codes')
                    .select('id, code, name')
                    .in('id', costCodeIds);
                  const codeMap = {};
                  (costCodes || []).forEach(cc => { codeMap[cc.id] = cc; });
                  costCodesForStamp = allocsForStamp.map(a => ({
                    code: codeMap[a.cost_code_id]?.code || '',
                    name: codeMap[a.cost_code_id]?.name || '',
                    amount: parseFloat(a.amount) || 0
                  }));
                }
              }

              const stampedBuffer = await stampReadyForApproval(pdfBuffer, {
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                codedBy: performedBy,
                jobName: invoice.job?.name,
                vendorName: invoice.vendor?.name,
                amount: invoice.amount,
                costCodes: costCodesForStamp
              });

              // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
              const uploadResult = await uploadStampedPDFById(stampedBuffer, invoiceId, invoice.job?.id);
              if (uploadResult?.url) {
                updateData.pdf_stamped_url = uploadResult.url;
                pdf_stamped_url = uploadResult.url;
              }
            }
          } catch (stampErr) {
            console.error('[STAMP] Ready for approval stamp error:', stampErr.message);
          }
        }
      }
      break;

    case 'approved':
      // Split children must have a job assigned before approval
      if (invoice.parent_invoice_id && !invoice.job_id) {
        return res.status(400).json({
          error: true,
          code: 'SPLIT_REQUIRES_JOB',
          message: 'Split invoices must be assigned to a job before approval',
          details: { invoice_id: invoiceId }
        });
      }

      // Check for CO cost codes without CO link - block approval
      {
        const allocsToCheck = allocations || invoice.allocations || [];
        const unlinkedCOAllocs = allocsToCheck.filter(a => {
          const costCode = a.cost_code?.code || '';
          const isCOCostCode = costCode.endsWith('C') && /\d+C$/.test(costCode);
          return isCOCostCode && !a.change_order_id && !a.pending_co;
        });
        if (unlinkedCOAllocs.length > 0) {
          const codes = unlinkedCOAllocs.map(a => a.cost_code?.code).filter(Boolean).join(', ');
          return res.status(400).json({
            error: true,
            code: 'UNLINKED_CO_COST_CODES',
            message: `Cannot approve invoice with unlinked CO cost codes: ${codes || 'unknown'}. Please link to a Change Order or mark as Pending CO.`
          });
        }
      }

      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = performedBy;

      // Handle allocations if provided
      if (allocations && allocations.length > 0) {
        await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);
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

      // Stamp PDF (progressive stamping - use existing stamp if available)
      {
        const pdfSourceUrl = invoice.pdf_stamped_url || invoice.pdf_url;
        if (pdfSourceUrl) {
          try {
            let storagePath = null;
            if (pdfSourceUrl.includes('/storage/v1/object/public/invoices/')) {
              const urlParts = pdfSourceUrl.split('/storage/v1/object/public/invoices/');
              storagePath = urlParts[1] ? decodeURIComponent(urlParts[1].split('?')[0]) : null;
            }
            if (storagePath) {
              const pdfBuffer = await downloadPDF(storagePath);

              // Get PO info with CO cost code exclusion
              let poTotal = null, poBilledToDate = 0, poLinkedAmount = null;
              const isCOCostCode = (code) => code && /C$/i.test(code.trim());

              if (invoice.po?.id) {
                poTotal = parseFloat(invoice.po.total_amount);

                // Get allocations with cost codes for this invoice
                const allocsForPO = allocations || invoice.allocations || [];

                // Calculate how much of THIS invoice links to PO (exclude CO allocations)
                poLinkedAmount = allocsForPO.reduce((sum, alloc) => {
                  const costCode = alloc.cost_code?.code || alloc.cost_code_id;
                  // Try to get code if we only have ID
                  let codeStr = costCode;
                  if (!codeStr && alloc.cost_code_id) {
                    // Will be checked later after cost code fetch
                    return sum + parseFloat(alloc.amount || 0); // Temporarily count
                  }
                  const isCO = typeof codeStr === 'string' && isCOCostCode(codeStr);
                  if (isCO) return sum;
                  return sum + parseFloat(alloc.amount || 0);
                }, 0);

                // Get prior invoices with allocations to exclude CO work
                const { data: priorInvoices } = await supabase
                  .from('v2_invoices')
                  .select(`
                    id,
                    amount,
                    allocations:v2_invoice_allocations(
                      amount,
                      cost_code:v2_cost_codes(code)
                    )
                  `)
                  .eq('po_id', invoice.po.id)
                  .neq('id', invoiceId)
                  .in('status', ['approved', 'in_draw', 'paid']);

                if (priorInvoices) {
                  poBilledToDate = priorInvoices.reduce((sum, inv) => {
                    if (inv.allocations && inv.allocations.length > 0) {
                      return sum + inv.allocations.reduce((s, a) => {
                        const isCO = isCOCostCode(a.cost_code?.code);
                        if (isCO) return s;
                        return s + parseFloat(a.amount || 0);
                      }, 0);
                    }
                    return sum + parseFloat(inv.amount || 0);
                  }, 0);
                }
              }

              // Get cost code details for stamping
              const allocsForStamp = allocations || invoice.allocations || [];
              let costCodesForStamp = [];
              let codeMap = {};

              if (allocsForStamp.length > 0) {
                // If allocations don't have cost_code details, fetch them
                const needsFetch = allocsForStamp.some(a => !a.cost_code?.code);

                if (needsFetch) {
                  const costCodeIds = allocsForStamp.map(a => a.cost_code_id).filter(id => id);
                  if (costCodeIds.length > 0) {
                    const { data: costCodes } = await supabase
                      .from('v2_cost_codes')
                      .select('id, code, name')
                      .in('id', costCodeIds);

                    (costCodes || []).forEach(cc => { codeMap[cc.id] = cc; });

                    costCodesForStamp = allocsForStamp.map(a => {
                      const cc = codeMap[a.cost_code_id] || {};
                      return {
                        code: cc.code || 'N/A',
                        name: cc.name || 'Unknown',
                        amount: parseFloat(a.amount)
                      };
                    });
                  }
                } else {
                  costCodesForStamp = allocsForStamp.map(a => ({
                    code: a.cost_code?.code || 'N/A',
                    name: a.cost_code?.name || 'Unknown',
                    amount: parseFloat(a.amount)
                  }));
                }
              }

              // Recalculate poLinkedAmount now that we have cost codes
              if (invoice.po?.id) {
                poLinkedAmount = allocsForStamp.reduce((sum, alloc) => {
                  const cc = alloc.cost_code?.code || (codeMap[alloc.cost_code_id]?.code);
                  if (cc && isCOCostCode(cc)) return sum;
                  return sum + parseFloat(alloc.amount || 0);
                }, 0);
              }

              const stampedBuffer = await stampApproval(pdfBuffer, {
                status: 'APPROVED',
                date: new Date().toLocaleDateString(),
                approvedBy: performedBy,
                vendorName: invoice.vendor?.name,
                invoiceNumber: invoice.invoice_number,
                jobName: invoice.job?.name,
                costCodes: costCodesForStamp,
                amount: parseFloat(invoice.amount),
                poNumber: invoice.po?.po_number,
                poDescription: invoice.po?.description,
                poTotal,
                poBilledToDate,
                poLinkedAmount,
                isPartial: invoice.review_flags?.includes('partial_approval')
              });

              // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
              const result = await uploadStampedPDFById(stampedBuffer, invoiceId, invoice.job_id);
              pdf_stamped_url = result.url;
              updateData.pdf_stamped_url = pdf_stamped_url;
            }
          } catch (stampErr) {
            console.error('PDF stamping failed:', stampErr.message);
            // Continue without stamp but flag it
          }
        }
      }

      // Update budget lines
      const finalAllocations = allocations || invoice.allocations || [];
      if (finalAllocations.length > 0 && invoice.job?.id) {
        for (const alloc of finalAllocations) {
          const costCodeId = alloc.cost_code_id || alloc.cost_code?.id;
          if (!costCodeId) continue;

          const { data: existing } = await supabase
            .from('v2_budget_lines')
            .select('id, billed_amount')
            .eq('job_id', invoice.job.id)
            .eq('cost_code_id', costCodeId)
            .single();

          if (existing) {
            const newBilled = (parseFloat(existing.billed_amount) || 0) + parseFloat(alloc.amount);
            await supabase.from('v2_budget_lines').update({ billed_amount: newBilled }).eq('id', existing.id);
          } else {
            await supabase.from('v2_budget_lines').insert({
              job_id: invoice.job.id,
              cost_code_id: costCodeId,
              budgeted_amount: 0,
              committed_amount: 0,
              billed_amount: parseFloat(alloc.amount) || 0,
              paid_amount: 0
            });
          }
        }
      }

      // Update PO line items
      if (invoice.po?.id && finalAllocations.length > 0) {
        for (const alloc of finalAllocations) {
          const costCodeId = alloc.cost_code_id || alloc.cost_code?.id;
          if (!costCodeId) continue;

          const { data: poLineItem } = await supabase
            .from('v2_po_line_items')
            .select('id, invoiced_amount')
            .eq('po_id', invoice.po.id)
            .eq('cost_code_id', costCodeId)
            .single();

          if (poLineItem) {
            const newInvoiced = (parseFloat(poLineItem.invoiced_amount) || 0) + parseFloat(alloc.amount);
            await supabase.from('v2_po_line_items').update({ invoiced_amount: newInvoiced }).eq('id', poLineItem.id);
          }
        }
      }
      break;

    case 'denied':
      updateData.denied_at = new Date().toISOString();
      updateData.denied_by = performedBy;
      updateData.denial_reason = reason;
      break;

    case 'in_draw':
      // Add to draw
      if (draw_id) {
        await supabase.from('v2_draw_invoices').insert({
          draw_id: draw_id,
          invoice_id: invoiceId
        });
        // Update draw total
        const { data: drawInvoices } = await supabase
          .from('v2_draw_invoices')
          .select('invoice:v2_invoices(amount)')
          .eq('draw_id', draw_id);
        const newTotal = drawInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
        await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', draw_id);
      }
      break;

    case 'needs_review':
      // Clearing denial (if coming from denied)
      if (invoice.status === 'denied') {
        updateData.denied_at = null;
        updateData.denied_by = null;
        updateData.denial_reason = null;
      }

      // Stamp PDF with "Needs Review" (progressive stamping) using fixed path
      {
        if (invoice.pdf_url) {
          try {
            // Always stamp from original PDF
            const storagePath = extractStoragePath(invoice.pdf_url);
            if (storagePath) {
              const pdfBuffer = await downloadPDF(storagePath);

              const stampedBuffer = await stampNeedsReview(pdfBuffer, {
                date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
                vendorName: invoice.vendor?.name,
                invoiceNumber: invoice.invoice_number,
                amount: invoice.amount,
                flags: invoice.review_flags || []
              });

              // Use fixed path: {job_id}/{invoice_id}_stamped.pdf
              const uploadResult = await uploadStampedPDFById(stampedBuffer, invoiceId, invoice.job?.id);
              if (uploadResult?.url) {
                updateData.pdf_stamped_url = uploadResult.url;
                pdf_stamped_url = uploadResult.url;
              }
            }
          } catch (stampErr) {
            console.error('[STAMP] Needs review stamp error:', stampErr.message);
          }
        }
      }
      break;
  }

  // Apply update
  const { data: updated, error: updateError } = await supabase
    .from('v2_invoices')
    .update(updateData)
    .eq('id', invoiceId)
    .select()
    .single();

  if (updateError) {
    throw new AppError('DATABASE_ERROR', 'Failed to update invoice status');
  }

  // Log activity
  await logActivity(invoiceId, new_status, performedBy, {
    from_status: invoice.status,
    to_status: new_status,
    reason,
    stamped: !!pdf_stamped_url
  });

  // Check if this completes a split (terminal states: paid, denied)
  if (invoice.parent_invoice_id && ['paid', 'denied'].includes(new_status)) {
    checkSplitReconciliation(invoice.parent_invoice_id).catch(err => {
      console.error('[RECONCILE] Check failed:', err.message);
    });
  }

  broadcastInvoiceUpdate(updated, `status_${new_status}`, performedBy);

  res.json({
    success: true,
    invoice: updated,
    warnings: preCheck.warnings || [],
    undoAvailable: true,
    undoExpiresIn: UNDO_WINDOW_SECONDS * 1000
  });
}));

// ============================================================
// BATCH RE-STAMP ENDPOINT
// ============================================================

// Re-stamp all invoices that are missing stamps or need re-stamping
app.post('/api/invoices/batch-restamp', asyncHandler(async (req, res) => {
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
      console.log('[BATCH-STAMP] Stamped:', invoice.id);

    } catch (err) {
      results.failed++;
      results.errors.push({ id: invoice.id, error: err.message });
      console.error('[BATCH-STAMP] Failed:', invoice.id, err.message);
    }
  }

  res.json({
    success: true,
    total: invoices.length,
    ...results
  });
}));

// ============================================================
// AI OVERRIDE ENDPOINT
// ============================================================

app.patch('/api/invoices/:id/override', asyncHandler(async (req, res) => {
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
// AI FEEDBACK ENDPOINT (for learning from corrections)
// ============================================================

app.post('/api/ai/feedback', asyncHandler(async (req, res) => {
  const {
    invoice_id,
    field_name,
    ai_value,
    user_value,
    entity_id,
    corrected_by = 'unknown',
    context = {}
  } = req.body;

  // Use the new recordFeedback function which stores AND applies to learning
  const feedback = await aiLearning.recordFeedback({
    invoiceId: invoice_id,
    fieldName: field_name,
    aiValue: typeof ai_value === 'object' ? JSON.stringify(ai_value) : String(ai_value || ''),
    userValue: typeof user_value === 'object' ? JSON.stringify(user_value) : String(user_value || ''),
    entityId: entity_id,
    correctedBy: corrected_by,
    context: context
  });

  res.json({ success: true, feedback_id: feedback?.id });
}));

// ============================================================
// UNDO ENDPOINTS
// ============================================================

app.get('/api/undo/available/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const result = await getAvailableUndo(entityType, entityId);
  res.json(result);
}));

app.post('/api/invoices/:id/undo', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { performed_by: performedBy = 'System' } = req.body;

  // Get available undo
  const undoInfo = await getAvailableUndo('invoice', invoiceId);
  if (!undoInfo.available) {
    throw new AppError('UNDO_NOT_FOUND', 'No undo available for this invoice');
  }

  // Execute undo
  const result = await executeUndo(undoInfo.undoEntry.id, performedBy);
  if (!result.success) {
    throw result.error;
  }

  // Get updated invoice
  const { data: updated } = await supabase
    .from('v2_invoices')
    .select('*')
    .eq('id', invoiceId)
    .single();

  broadcastInvoiceUpdate(updated, 'undone', performedBy);

  res.json({
    success: true,
    invoice: updated,
    undoneAction: result.undoneAction,
    restoredState: result.restoredState
  });
}));

// ============================================================
// LOCKING ENDPOINTS
// ============================================================

app.post('/api/locks/acquire', asyncHandler(async (req, res) => {
  const { entity_type, entity_id, locked_by } = req.body;

  if (!entity_type || !entity_id || !locked_by) {
    throw new AppError('VALIDATION_FAILED', 'entity_type, entity_id, and locked_by are required');
  }

  const result = await acquireLock(entity_type, entity_id, locked_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({
    success: true,
    lock: result.lock,
    refreshed: result.refreshed || false,
    created: result.created || false
  });
}));

app.delete('/api/locks/:lockId', asyncHandler(async (req, res) => {
  const { lockId } = req.params;
  const { released_by } = req.body;

  const result = await releaseLock(lockId, released_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({ success: true });
}));

app.get('/api/locks/check/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const result = await checkLock(entityType, entityId);
  res.json(result);
}));

app.delete('/api/locks/entity/:entityType/:entityId', asyncHandler(async (req, res) => {
  const { entityType, entityId } = req.params;
  const { released_by } = req.body;

  const result = await releaseLockByEntity(entityType, entityId, released_by);

  if (!result.success) {
    throw result.error;
  }

  res.json({ success: true });
}));

// ============================================================
// BULK OPERATIONS
// ============================================================

app.post('/api/invoices/bulk/approve', asyncHandler(async (req, res) => {
  const { invoice_ids, performed_by: performedBy } = req.body;

  if (!invoice_ids || !Array.isArray(invoice_ids) || invoice_ids.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'invoice_ids array is required');
  }

  const results = { success: [], failed: [] };

  // First, validate all
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

    const preCheck = await validatePreTransition(invoice, 'approved', {});
    if (!preCheck.valid) {
      results.failed.push({ id: invoiceId, error: preCheck.errors[0]?.message || 'Pre-transition failed' });
      continue;
    }

    results.success.push(invoiceId);
  }

  // Process valid ones
  const approved = [];
  for (const invoiceId of results.success) {
    try {
      const { data: updated } = await supabase
        .from('v2_invoices')
        .update({
          status: 'approved',
          approved_at: new Date().toISOString(),
          approved_by: performedBy
        })
        .eq('id', invoiceId)
        .select()
        .single();

      await logActivity(invoiceId, 'approved', performedBy, { bulk: true });
      approved.push(updated);
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

app.post('/api/invoices/bulk/add-to-draw', asyncHandler(async (req, res) => {
  const { invoice_ids, draw_id, performed_by: performedBy } = req.body;

  if (!invoice_ids || !draw_id) {
    throw new AppError('VALIDATION_FAILED', 'invoice_ids and draw_id are required');
  }

  // Verify draw exists and is not funded
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

    // Check if already in a draw
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

app.post('/api/invoices/bulk/deny', asyncHandler(async (req, res) => {
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

// ============================================================
// VERSION CHECK ENDPOINT
// ============================================================

app.get('/api/invoices/:id/version', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;

  const { data: invoice, error } = await supabase
    .from('v2_invoices')
    .select('id, version, updated_at')
    .eq('id', invoiceId)
    .single();

  if (error || !invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  res.json({
    id: invoice.id,
    version: invoice.version,
    updated_at: invoice.updated_at
  });
}));

// ============================================================
// SOFT DELETE
// ============================================================

app.delete('/api/invoices/:id', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;
  const { performed_by: performedBy = 'System' } = req.body;

  // Get invoice for undo snapshot
  const { data: invoice } = await supabase
    .from('v2_invoices')
    .select('*')
    .eq('id', invoiceId)
    .is('deleted_at', null)
    .single();

  if (!invoice) {
    throw notFoundError('invoice', invoiceId);
  }

  // Cannot delete paid invoices
  if (invoice.status === 'paid') {
    throw new AppError('VALIDATION_FAILED', 'Cannot delete paid invoices');
  }

  // Cannot delete invoices in funded draws
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

  // Create undo snapshot
  await createUndoSnapshot('invoice', invoiceId, 'deleted', invoice, performedBy);

  // Soft delete
  const { error } = await supabase
    .from('v2_invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', invoiceId);

  if (error) {
    throw new AppError('DATABASE_ERROR', 'Failed to delete invoice');
  }

  await logActivity(invoiceId, 'deleted', performedBy, {});

  // Check if this completes a split (deleted is a terminal state)
  if (invoice.parent_invoice_id) {
    checkSplitReconciliation(invoice.parent_invoice_id).catch(err => {
      console.error('[RECONCILE] Check failed:', err.message);
    });
  }

  broadcastInvoiceUpdate({ id: invoiceId }, 'deleted', performedBy);

  res.json({
    success: true,
    undoAvailable: true,
    undoExpiresIn: UNDO_WINDOW_SECONDS * 1000
  });
}));

// ============================================================
// REALTIME SSE ENDPOINT
// ============================================================

app.get('/api/realtime/events', sseHandler);

app.get('/api/realtime/stats', (req, res) => {
  res.json(getRealtimeStats());
});

// ============================================================
// ERROR HANDLING MIDDLEWARE (must be last)
// ============================================================

app.use(errorMiddleware);

// ============================================================
// START SERVER
// ============================================================

// Write PID file for safe restarts
fs.writeFileSync(PID_FILE, process.pid.toString());
console.log(`PID ${process.pid} written to ${PID_FILE}`);

// Clean up PID file on exit
const cleanupPID = () => {
  try {
    if (fs.existsSync(PID_FILE)) {
      fs.unlinkSync(PID_FILE);
    }
  } catch (e) {}
};
process.on('exit', cleanupPID);
process.on('SIGINT', () => { cleanupPID(); process.exit(0); });
process.on('SIGTERM', () => { cleanupPID(); process.exit(0); });

// ==========================================
// RECONCILIATION API
// ==========================================

// Run reconciliation for a specific job
app.get('/api/jobs/:id/reconcile', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const startTime = Date.now();

  const results = await reconcileJob(supabase, jobId);
  results.duration_ms = Date.now() - startTime;

  // Log the reconciliation run
  await supabase.from('v2_reconciliation_log').insert({
    job_id: jobId,
    total_checks: results.summary.total_checks,
    passed: results.summary.passed,
    failed: results.summary.failed,
    warnings: results.summary.warnings,
    results: results.checks,
    errors: results.errors,
    run_by: req.query.performed_by || 'System',
    duration_ms: results.duration_ms
  });

  // Update job's last reconciled timestamp
  if (results.summary.failed === 0) {
    await supabase.from('v2_jobs')
      .update({ last_reconciled_at: new Date().toISOString() })
      .eq('id', jobId);
  }

  res.json(results);
}));

// Run reconciliation for all active jobs
app.get('/api/reconcile/all', asyncHandler(async (req, res) => {
  const startTime = Date.now();
  const results = await reconcileAll(supabase);
  results.duration_ms = Date.now() - startTime;

  // Log the reconciliation run
  await supabase.from('v2_reconciliation_log').insert({
    job_id: null,
    total_checks: results.results.reduce((sum, r) => sum + r.summary.total_checks, 0),
    passed: results.results.reduce((sum, r) => sum + r.summary.passed, 0),
    failed: results.summary.total_errors,
    warnings: results.summary.total_warnings,
    results: results.results,
    run_by: req.query.performed_by || 'System',
    duration_ms: results.duration_ms
  });

  res.json(results);
}));

// Get reconciliation history
app.get('/api/reconcile/history', asyncHandler(async (req, res) => {
  const { job_id, limit = 20, unresolved_only } = req.query;

  let query = supabase
    .from('v2_reconciliation_log')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(parseInt(limit));

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  if (unresolved_only === 'true') {
    query = query.gt('failed', 0).is('resolved_at', null);
  }

  const { data, error } = await query;
  if (error) throw error;

  res.json(data);
}));

// Mark reconciliation issues as resolved
app.post('/api/reconcile/:id/resolve', asyncHandler(async (req, res) => {
  const { resolved_by, notes } = req.body;

  const { data, error } = await supabase
    .from('v2_reconciliation_log')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by,
      resolution_notes: notes
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

// Get external sync status for an entity
app.get('/api/sync/:entity_type/:entity_id', asyncHandler(async (req, res) => {
  const { entity_type, entity_id } = req.params;
  const syncs = await getExternalSyncStatus(supabase, entity_type, entity_id);
  res.json(syncs);
}));

// Record external sync (e.g., after QuickBooks export)
app.post('/api/sync', asyncHandler(async (req, res) => {
  const { entity_type, entity_id, system, external_id, status, details, synced_by } = req.body;

  const result = await recordExternalSync(supabase, {
    entityType: entity_type,
    entityId: entity_id,
    system,
    externalId: external_id,
    status: status || 'synced',
    details,
    syncedBy: synced_by || 'System'
  });

  if (result.error) throw result.error;
  res.json({ success: true, sync: result.data });
}));

// Get entities pending sync for a system
app.get('/api/sync/:system/pending', asyncHandler(async (req, res) => {
  const { system } = req.params;
  const { entity_type } = req.query;

  // Get invoices not yet synced to this system
  let query = supabase
    .from('v2_invoices')
    .select(`
      id, invoice_number, amount, status, vendor:v2_vendors(name), job:v2_jobs(name),
      syncs:v2_external_sync(status, synced_at)
    `)
    .in('status', ['approved', 'in_draw', 'paid'])
    .is('deleted_at', null);

  const { data: invoices, error } = await query;
  if (error) throw error;

  // Filter to those not synced or failed
  const pending = (invoices || []).filter(inv => {
    const sync = (inv.syncs || []).find(s => s.system === system);
    return !sync || sync.status === 'failed' || sync.status === 'pending';
  });

  res.json({
    system,
    pending_count: pending.length,
    invoices: pending
  });
}));

// Create financial snapshot
app.post('/api/jobs/:id/snapshot', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const { snapshot_type = 'manual', reference_type, reference_id, created_by = 'System' } = req.body;

  // Call the database function to create snapshot
  const { data, error } = await supabase.rpc('create_financial_snapshot', {
    p_job_id: jobId,
    p_snapshot_type: snapshot_type,
    p_reference_type: reference_type,
    p_reference_id: reference_id,
    p_created_by: created_by
  });

  if (error) throw error;
  res.json({ success: true, snapshot_id: data });
}));

// Get financial snapshots for a job
app.get('/api/jobs/:id/snapshots', asyncHandler(async (req, res) => {
  const jobId = req.params.id;
  const { limit = 10 } = req.query;

  const { data, error } = await supabase
    .from('v2_financial_snapshots')
    .select('id, snapshot_type, reference_type, reference_id, total_contract, total_billed, total_paid, retainage_held, created_at, created_by, notes')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (error) throw error;
  res.json(data);
}));

// =====================================================
// QUICK FIX ENDPOINTS (Reconciliation Fixes)
// =====================================================

// Sync invoice billed_amount from actual draw history
app.post('/api/invoices/:id/sync-billed', asyncHandler(async (req, res) => {
  const invoiceId = req.params.id;

  // Get invoice info
  const { data: invoice, error: invError } = await supabase
    .from('v2_invoices')
    .select('id, invoice_number, amount, billed_amount')
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

// Sync all budget line totals from actual allocations
app.post('/api/budgets/sync-totals', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  // Get all budget lines (optionally filtered by job)
  let budgetQuery = supabase
    .from('v2_budget_lines')
    .select('id, job_id, cost_code_id, billed_amount');

  if (job_id) {
    budgetQuery = budgetQuery.eq('job_id', job_id);
  }

  const { data: budgetLines, error: blError } = await budgetQuery;
  if (blError) throw blError;

  const updates = [];
  const results = [];

  for (const bl of budgetLines || []) {
    // Get sum of allocations for this job + cost_code
    const { data: allocations, error: allocError } = await supabase
      .from('v2_invoice_allocations')
      .select('amount')
      .eq('job_id', bl.job_id)
      .eq('cost_code_id', bl.cost_code_id);

    if (allocError) {
      console.error(`Error getting allocations for budget line ${bl.id}:`, allocError);
      continue;
    }

    const calculatedBilled = (allocations || []).reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
    const previousBilled = parseFloat(bl.billed_amount || 0);

    // Only update if different
    if (Math.abs(calculatedBilled - previousBilled) > 0.01) {
      updates.push({
        id: bl.id,
        billed_amount: calculatedBilled
      });

      results.push({
        budget_line_id: bl.id,
        previous: previousBilled,
        calculated: calculatedBilled,
        difference: calculatedBilled - previousBilled
      });
    }
  }

  // Batch update
  for (const update of updates) {
    await supabase
      .from('v2_budget_lines')
      .update({ billed_amount: update.billed_amount })
      .eq('id', update.id);
  }

  res.json({
    success: true,
    total_budget_lines: budgetLines?.length || 0,
    updated_count: updates.length,
    updates: results
  });
}));

// Sync all invoices' billed_amount (bulk fix)
app.post('/api/invoices/sync-all-billed', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  // Get all invoices that have been in draws
  let invoiceQuery = supabase
    .from('v2_invoices')
    .select(`
      id, invoice_number, amount, billed_amount,
      draw_invoices:v2_draw_invoices(draw_id),
      allocations:v2_invoice_allocations(amount)
    `)
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

// ============================================================
// LIEN RELEASES API
// ============================================================

// Helper: Log lien release activity
async function logLienReleaseActivity(lienReleaseId, action, performedBy, details = {}) {
  await supabase.from('v2_lien_release_activity').insert({
    lien_release_id: lienReleaseId,
    action,
    performed_by: performedBy,
    details
  });
}

// List lien releases with filters
app.get('/api/lien-releases', asyncHandler(async (req, res) => {
  const { job_id, vendor_id, draw_id, status, search, limit = 100 } = req.query;

  let query = supabase
    .from('v2_lien_releases')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      draw:v2_draws(id, draw_number, status)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(parseInt(limit));

  if (job_id) query = query.eq('job_id', job_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (draw_id) query = query.eq('draw_id', draw_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw error;

  // Apply search filter client-side (for vendor/job names)
  let filtered = data || [];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(lr =>
      (lr.vendor?.name || '').toLowerCase().includes(q) ||
      (lr.job?.name || '').toLowerCase().includes(q) ||
      (lr.signer_name || '').toLowerCase().includes(q)
    );
  }

  res.json(filtered);
}));

// Get single lien release with details
app.get('/api/lien-releases/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lien_releases')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      vendor:v2_vendors(id, name),
      draw:v2_draws(id, draw_number, status, job_id)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !data) {
    return res.status(404).json({ error: 'Lien release not found' });
  }

  // Get activity log
  const { data: activity } = await supabase
    .from('v2_lien_release_activity')
    .select('*')
    .eq('lien_release_id', id)
    .order('created_at', { ascending: false });

  res.json({ ...data, activity: activity || [] });
}));

// Simple upload (no AI processing)
app.post('/api/lien-releases/upload', upload.single('pdf'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  const { job_id, vendor_id, release_type, amount, through_date, release_date, notes, uploaded_by } = req.body;

  // Validate release_type
  const validTypes = ['conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final'];
  if (!release_type || !validTypes.includes(release_type)) {
    return res.status(400).json({ error: 'Invalid release_type. Must be one of: ' + validTypes.join(', ') });
  }

  // Upload PDF
  const filename = `lien-releases/${Date.now()}_${req.file.originalname}`;
  const uploadResult = await uploadPDF(req.file.buffer, filename, job_id);

  // Create record
  const { data: release, error } = await supabase
    .from('v2_lien_releases')
    .insert({
      job_id: job_id || null,
      vendor_id: vendor_id || null,
      release_type,
      amount: amount ? parseFloat(amount) : null,
      through_date: through_date || null,
      release_date: release_date || null,
      pdf_url: uploadResult.url,
      notes,
      uploaded_by,
      status: 'received'
    })
    .select()
    .single();

  if (error) throw error;

  await logLienReleaseActivity(release.id, 'uploaded', uploaded_by || 'System', {
    filename: req.file.originalname
  });

  res.json({ success: true, lien_release: release });
}));

// AI-powered lien release processing
app.post('/api/lien-releases/process', upload.single('pdf'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file provided' });
  }

  const { uploaded_by } = req.body;
  const pdfBuffer = req.file.buffer;
  const originalFilename = req.file.originalname;

  // Import and use the lien release processor
  const { processLienRelease } = require('./ai-processor');
  const result = await processLienRelease(pdfBuffer, originalFilename);

  if (!result.success) {
    return res.status(422).json({
      error: 'Processing failed',
      messages: result.messages
    });
  }

  // Upload PDF
  const jobId = result.matchedJob?.id;
  const filename = `lien-releases/${Date.now()}_${originalFilename}`;
  const uploadResult = await uploadPDF(pdfBuffer, filename, jobId);

  // Create lien release record
  const { data: release, error } = await supabase
    .from('v2_lien_releases')
    .insert({
      job_id: jobId || null,
      vendor_id: result.vendor?.id || null,
      release_type: result.extracted.releaseType || 'conditional_progress',
      release_date: result.extracted.releaseDate || null,
      through_date: result.extracted.throughDate || null,
      amount: result.extracted.amount || null,
      pdf_url: uploadResult.url,
      ai_processed: true,
      ai_confidence: result.ai_confidence || null,
      ai_extracted_data: result.ai_extracted_data || null,
      needs_review: result.needs_review || false,
      review_flags: result.review_flags || null,
      notary_name: result.extracted.notary?.name || null,
      notary_county: result.extracted.notary?.county || null,
      notary_expiration: result.extracted.notary?.expiration || null,
      signer_name: result.extracted.signer?.name || null,
      signer_title: result.extracted.signer?.title || null,
      notes: result.messages.join('\n'),
      uploaded_by,
      status: 'received'
    })
    .select()
    .single();

  if (error) throw error;

  await logLienReleaseActivity(release.id, 'ai_processed', uploaded_by || 'AI Processor', {
    originalFilename,
    vendorMatched: !!result.vendor,
    jobMatched: !!result.matchedJob,
    confidence: result.ai_confidence?.overall
  });

  res.json({
    success: true,
    lien_release: release,
    processing: {
      extracted: result.extracted,
      matchedJob: result.matchedJob,
      vendor: result.vendor,
      messages: result.messages
    }
  });
}));

// Update lien release
app.patch('/api/lien-releases/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    job_id, vendor_id, draw_id, release_type, release_date, through_date,
    amount, status, notes, signer_name, signer_title,
    notary_name, notary_county, notary_expiration, updated_by
  } = req.body;

  // Get current record
  const { data: current, error: fetchError } = await supabase
    .from('v2_lien_releases')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !current) {
    return res.status(404).json({ error: 'Lien release not found' });
  }

  // Build update object (only include provided fields)
  const updates = { version: current.version + 1 };
  if (job_id !== undefined) updates.job_id = job_id;
  if (vendor_id !== undefined) updates.vendor_id = vendor_id;
  if (draw_id !== undefined) updates.draw_id = draw_id;
  if (release_type !== undefined) updates.release_type = release_type;
  if (release_date !== undefined) updates.release_date = release_date;
  if (through_date !== undefined) updates.through_date = through_date;
  if (amount !== undefined) updates.amount = amount;
  if (status !== undefined) {
    updates.status = status;
    if (status === 'verified') {
      updates.verified_at = new Date().toISOString();
      updates.verified_by = updated_by;
    }
  }
  if (notes !== undefined) updates.notes = notes;
  if (signer_name !== undefined) updates.signer_name = signer_name;
  if (signer_title !== undefined) updates.signer_title = signer_title;
  if (notary_name !== undefined) updates.notary_name = notary_name;
  if (notary_county !== undefined) updates.notary_county = notary_county;
  if (notary_expiration !== undefined) updates.notary_expiration = notary_expiration;

  const { data: updated, error: updateError } = await supabase
    .from('v2_lien_releases')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      draw:v2_draws(id, draw_number, status)
    `)
    .single();

  if (updateError) throw updateError;

  await logLienReleaseActivity(id, 'updated', updated_by || 'System', { updates });

  res.json({ success: true, lien_release: updated });
}));

// Delete lien release (soft delete)
app.delete('/api/lien-releases/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;

  const { data, error } = await supabase
    .from('v2_lien_releases')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;

  await logLienReleaseActivity(id, 'deleted', deleted_by || 'System', {});

  res.json({ success: true });
}));

// Attach lien release to draw
app.post('/api/lien-releases/:id/attach-to-draw', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { draw_id, attached_by } = req.body;

  if (!draw_id) {
    return res.status(400).json({ error: 'draw_id is required' });
  }

  // Verify draw exists
  const { data: draw, error: drawError } = await supabase
    .from('v2_draws')
    .select('id, draw_number, job_id')
    .eq('id', draw_id)
    .single();

  if (drawError || !draw) {
    return res.status(404).json({ error: 'Draw not found' });
  }

  // Update lien release
  const { data: updated, error } = await supabase
    .from('v2_lien_releases')
    .update({
      draw_id,
      status: 'attached',
      job_id: draw.job_id  // Also update job_id to match draw's job
    })
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name),
      draw:v2_draws(id, draw_number, status)
    `)
    .single();

  if (error) throw error;

  await logLienReleaseActivity(id, 'attached_to_draw', attached_by || 'System', {
    draw_id,
    draw_number: draw.draw_number
  });

  res.json({ success: true, lien_release: updated });
}));

// Detach lien release from draw
app.post('/api/lien-releases/:id/detach-from-draw', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { detached_by } = req.body;

  // Get current release to log the draw it's being detached from
  const { data: current } = await supabase
    .from('v2_lien_releases')
    .select('draw_id')
    .eq('id', id)
    .single();

  const { data: updated, error } = await supabase
    .from('v2_lien_releases')
    .update({
      draw_id: null,
      status: 'verified'
    })
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw error;

  await logLienReleaseActivity(id, 'detached_from_draw', detached_by || 'System', {
    previous_draw_id: current?.draw_id
  });

  res.json({ success: true, lien_release: updated });
}));

// Get lien releases for a draw
app.get('/api/draws/:id/lien-releases', asyncHandler(async (req, res) => {
  const drawId = req.params.id;

  const { data, error } = await supabase
    .from('v2_lien_releases')
    .select(`
      *,
      vendor:v2_vendors(id, name)
    `)
    .eq('draw_id', drawId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json(data || []);
}));

// Get lien release activity
app.get('/api/lien-releases/:id/activity', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lien_release_activity')
    .select('*')
    .eq('lien_release_id', id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  res.json(data || []);
}));

// Get suggested draws for a lien release
// Suggests draws based on vendor, job, and date matching
app.get('/api/lien-releases/:id/suggested-draws', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get the lien release
  const { data: lienRelease, error: lrError } = await supabase
    .from('v2_lien_releases')
    .select('vendor_id, job_id, through_date')
    .eq('id', id)
    .single();

  if (lrError || !lienRelease) {
    return res.status(404).json({ error: 'Lien release not found' });
  }

  // Get all draft draws (only suggest draft draws that can accept releases)
  const { data: draws, error: drawError } = await supabase
    .from('v2_draws')
    .select(`
      id,
      draw_number,
      period_end,
      status,
      total_amount,
      job_id,
      job:v2_jobs(id, name)
    `)
    .eq('status', 'draft')
    .order('created_at', { ascending: false });

  if (drawError) throw drawError;

  // For each draw, check if the vendor has invoices in it
  const suggestedDraws = [];

  for (const draw of (draws || [])) {
    let score = 0;
    const reasons = [];

    // Check if same job
    if (lienRelease.job_id && draw.job_id === lienRelease.job_id) {
      score += 50;
      reasons.push('Same job');
    }

    // Check if vendor has invoices in this draw
    const { data: vendorInvoices } = await supabase
      .from('v2_draw_invoices')
      .select(`
        invoice:v2_invoices!inner(vendor_id)
      `)
      .eq('draw_id', draw.id)
      .eq('invoice.vendor_id', lienRelease.vendor_id);

    if (vendorInvoices && vendorInvoices.length > 0) {
      score += 40;
      reasons.push(`Vendor has ${vendorInvoices.length} invoice(s) in draw`);
    }

    // Check date proximity
    if (lienRelease.through_date && draw.period_end) {
      const lrDate = new Date(lienRelease.through_date);
      const drawDate = new Date(draw.period_end);
      const daysDiff = Math.abs((lrDate - drawDate) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 7) {
        score += 10;
        reasons.push('Dates within 7 days');
      } else if (daysDiff <= 30) {
        score += 5;
        reasons.push('Dates within 30 days');
      }
    }

    // Only include if there's some relevance
    if (score > 0) {
      suggestedDraws.push({
        draw_id: draw.id,
        draw_number: draw.draw_number,
        job_name: draw.job?.name || 'Unknown Job',
        period_end: draw.period_end,
        total_amount: draw.total_amount,
        score,
        reasons
      });
    }
  }

  // Sort by score descending
  suggestedDraws.sort((a, b) => b.score - a.score);

  res.json(suggestedDraws.slice(0, 5)); // Return top 5 suggestions
}));

// Get lien release coverage status for a draw
// Shows which vendors have invoices but are missing lien releases
app.get('/api/draws/:id/lien-release-coverage', asyncHandler(async (req, res) => {
  const drawId = req.params.id;

  // Get all invoices in this draw with their vendors
  const { data: drawInvoices, error: invError } = await supabase
    .from('v2_draw_invoices')
    .select(`
      invoice:v2_invoices(
        id,
        vendor_id,
        amount,
        vendor:v2_vendors(id, name)
      )
    `)
    .eq('draw_id', drawId);

  if (invError) throw invError;

  // Get all lien releases attached to this draw
  const { data: lienReleases, error: lrError } = await supabase
    .from('v2_lien_releases')
    .select('vendor_id')
    .eq('draw_id', drawId)
    .is('deleted_at', null);

  if (lrError) throw lrError;

  // Build vendor coverage map
  const vendorLienReleaseSet = new Set((lienReleases || []).map(lr => lr.vendor_id));

  // Group invoices by vendor
  const vendorInvoices = {};
  for (const di of (drawInvoices || [])) {
    if (!di.invoice) continue;
    const vendorId = di.invoice.vendor_id;
    const vendorName = di.invoice.vendor?.name || 'Unknown Vendor';

    if (!vendorInvoices[vendorId]) {
      vendorInvoices[vendorId] = {
        vendor_id: vendorId,
        vendor_name: vendorName,
        invoice_count: 0,
        total_amount: 0,
        has_lien_release: vendorLienReleaseSet.has(vendorId)
      };
    }
    vendorInvoices[vendorId].invoice_count++;
    vendorInvoices[vendorId].total_amount += parseFloat(di.invoice.amount || 0);
  }

  const coverage = Object.values(vendorInvoices);
  const totalVendors = coverage.length;
  const vendorsWithRelease = coverage.filter(v => v.has_lien_release).length;
  const vendorsMissingRelease = coverage.filter(v => !v.has_lien_release);

  res.json({
    total_vendors: totalVendors,
    vendors_with_release: vendorsWithRelease,
    vendors_missing_release: vendorsMissingRelease.length,
    coverage_percent: totalVendors > 0 ? Math.round((vendorsWithRelease / totalVendors) * 100) : 100,
    is_complete: vendorsMissingRelease.length === 0,
    vendors: coverage,
    missing_vendors: vendorsMissingRelease
  });
}));

app.listen(port, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('ROSS BUILT CONSTRUCTION MANAGEMENT');
  console.log('='.repeat(50));
  console.log(`Server running at http://localhost:${port}`);
  console.log(`PID: ${process.pid} (use 'npm run stop' to safely stop)`);
  console.log('');
  console.log('API Endpoints:');
  console.log('  GET  /api/dashboard/stats       - Owner dashboard');
  console.log('  GET  /api/invoices              - List invoices');
  console.log('  POST /api/invoices/upload       - Upload invoice PDF');
  console.log('  POST /api/invoices/process      - AI-powered invoice processing');
  console.log('  PATCH /api/invoices/:id         - Edit invoice (partial)');
  console.log('  PUT  /api/invoices/:id/full     - Edit invoice (full)');
  console.log('  POST /api/invoices/:id/transition - Status transition');
  console.log('  PATCH /api/invoices/:id/override - AI field override');
  console.log('  POST /api/invoices/:id/undo     - Undo last action');
  console.log('  POST /api/locks/acquire         - Acquire edit lock');
  console.log('  POST /api/invoices/bulk/approve - Bulk approve');
  console.log('  GET  /api/realtime/events       - SSE realtime updates');
  console.log('='.repeat(50));

  // Initialize realtime subscriptions
  initializeRealtimeSubscriptions();
});
