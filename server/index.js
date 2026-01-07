const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { supabase, port } = require('../config');
const { uploadPDF, uploadStampedPDF, downloadPDF } = require('./storage');
const { stampApproval, stampInDraw, stampPaid } = require('./pdf-stamper');
const { processInvoice } = require('./ai-processor');
const standards = require('./standards');

// New modules for enhanced invoice system
const {
  validateInvoice,
  validateStatusTransition,
  validatePreTransition,
  checkDuplicate,
  validateAllocations,
  validateCostCodesExist,
  validatePOCapacity,
  STATUS_TRANSITIONS
} = require('./validation');

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
app.use(express.static(path.join(__dirname, '../public')));

// Multer for file uploads (memory storage)
const upload = multer({ storage: multer.memoryStorage() });

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
// OWNER DASHBOARD STATS (All Jobs)
// ============================================================

app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Get all invoices across all jobs
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('status, amount, job_id');

    const stats = {
      received: { count: 0, amount: 0 },
      coded: { count: 0, amount: 0 },
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
        if (drawStats[d.status]) {
          drawStats[d.status].count++;
          drawStats[d.status].amount += parseFloat(d.total_amount) || 0;
        }
      });
    }

    // Get jobs summary
    const { data: jobs } = await supabase
      .from('v2_jobs')
      .select('id, name, contract_amount, client_name, status');

    // Calculate billed per job
    const jobSummaries = await Promise.all((jobs || []).map(async (job) => {
      const { data: jobInvoices } = await supabase
        .from('v2_invoices')
        .select('amount, status')
        .eq('job_id', job.id)
        .in('status', ['approved', 'in_draw', 'paid']);

      const billed = (jobInvoices || []).reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

      return {
        ...job,
        total_billed: billed,
        remaining: (parseFloat(job.contract_amount) || 0) - billed
      };
    }));

    // Calculate total contract value
    const total_contract = (jobs || []).reduce((sum, job) => sum + (parseFloat(job.contract_amount) || 0), 0);

    res.json({
      invoices: stats,
      draws: drawStats,
      jobs: jobSummaries,
      total_contract,
      alerts: {
        needsCoding: stats.received.count,
        needsApproval: stats.coded.count,
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
        line_items:v2_po_line_items(
          id, description, amount, invoiced_amount,
          cost_code:v2_cost_codes(id, code, name)
        )
      `)
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

app.get('/api/purchase-orders/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_purchase_orders')
      .select(`
        *,
        vendor:v2_vendors(id, name, email, phone),
        job:v2_jobs(id, name, address),
        line_items:v2_po_line_items(
          id, description, amount, invoiced_amount,
          cost_code:v2_cost_codes(id, code, name, category)
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

    // Create PO
    const { data: po, error: poError } = await supabase
      .from('v2_purchase_orders')
      .insert(poData)
      .select()
      .single();

    if (poError) throw poError;

    // Create line items
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
        po:v2_purchase_orders(id, po_number),
        allocations:v2_invoice_allocations(
          id, amount, notes,
          cost_code:v2_cost_codes(id, code, name)
        )
      `)
      .is('deleted_at', null)  // Filter out soft-deleted invoices
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
          id, amount, notes,
          cost_code:v2_cost_codes(id, code, name, category)
        ),
        draw_invoices:v2_draw_invoices(draw_id, draw:v2_draws(id, draw_number, status))
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

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
    res.json(data);
  } catch (err) {
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
        cost_code:v2_cost_codes(id, code, name, category)
      `)
      .eq('invoice_id', req.params.id);

    if (error) throw error;
    res.json(data || []);
  } catch (err) {
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
        status: 'received'
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

// AI-powered invoice processing
app.post('/api/invoices/process', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }

    const originalFilename = req.file.originalname;
    const pdfBuffer = req.file.buffer;

    // Process with AI
    const result = await processInvoice(pdfBuffer, originalFilename);

    if (!result.success) {
      return res.status(422).json({
        error: 'Processing failed',
        messages: result.messages
      });
    }

    // Upload PDF with standardized name
    let pdf_url = null;
    const jobId = result.matchedJob?.id;
    const storagePath = result.standardizedFilename;

    if (jobId) {
      const uploadResult = await uploadPDF(pdfBuffer, storagePath, jobId);
      pdf_url = uploadResult.url;
    } else {
      // Upload to unassigned folder if no job match
      const uploadResult = await uploadPDF(pdfBuffer, `unassigned/${storagePath}`, null);
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
        pdf_url,
        status: 'received',
        notes: result.messages.join('\n')
      })
      .select()
      .single();

    if (invError) throw invError;

    // Create allocations from line items
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
        status: 'coded',
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
          notes: a.notes
        })));
    }

    // Log activity
    await logActivity(invoiceId, 'coded', coded_by, {
      job_id,
      vendor_id,
      po_id,
      allocations: allocs
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
          cost_code:v2_cost_codes(code, name)
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (getError) throw getError;

    let pdf_stamped_url = null;

    // Stamp PDF if exists
    if (invoice.pdf_url) {
      try {
        // Extract storage path from URL
        const urlParts = invoice.pdf_url.split('/storage/v1/object/public/invoices/');
        if (urlParts[1]) {
          const storagePath = decodeURIComponent(urlParts[1]);
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

          const stampedBuffer = await stampApproval(pdfBuffer, {
            status: 'APPROVED',
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
            poBilledToDate: poBilledToDate
          });

          const result = await uploadStampedPDF(stampedBuffer, storagePath);
          pdf_stamped_url = result.url;
        }
      } catch (stampErr) {
        console.error('PDF stamping failed:', stampErr.message);
        // Continue without stamping
      }
    }

    // Update invoice
    const { data: updated, error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by,
        pdf_stamped_url
      })
      .eq('id', invoiceId)
      .select()
      .single();

    if (updateError) throw updateError;

    // Log activity
    await logActivity(invoiceId, 'approved', approved_by, {
      stamped: !!pdf_stamped_url
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

    // Only allow deny from received or coded status
    const allowedStatuses = ['received', 'coded'];
    if (!allowedStatuses.includes(invoice.status)) {
      return res.status(400).json({
        error: `Cannot deny invoice in '${invoice.status}' status. Only received or coded invoices can be denied.`
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

// Allocate invoice to cost codes
app.post('/api/invoices/:id/allocate', async (req, res) => {
  try {
    const invoiceId = req.params.id;
    const { allocations } = req.body;

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
          notes: a.notes
        })));

      if (error) throw error;
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

// ============================================================
// DRAWS API
// ============================================================

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
    res.json(data);
  } catch (err) {
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

    // Get invoices with their stamped PDFs
    const { data: invoices } = await supabase
      .from('v2_invoices')
      .select('id, amount, pdf_stamped_url')
      .in('id', invoice_ids);

    // Stamp each invoice with "IN DRAW"
    for (const inv of invoices) {
      if (inv.pdf_stamped_url) {
        try {
          const urlParts = inv.pdf_stamped_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1]).replace('_stamped.pdf', '.pdf');
            const pdfBuffer = await downloadPDF(storagePath.replace('.pdf', '_stamped.pdf'));
            const stampedBuffer = await stampInDraw(pdfBuffer, draw?.draw_number || 1);
            await uploadStampedPDF(stampedBuffer, storagePath);
          }
        } catch (stampErr) {
          console.error('IN DRAW stamp failed for invoice:', inv.id, stampErr.message);
        }
      }
      await logActivity(inv.id, 'added_to_draw', 'System', { draw_number: draw?.draw_number });
    }

    const { error: updateError } = await supabase
      .from('v2_invoices')
      .update({ status: 'in_draw' })
      .in('id', invoice_ids);

    if (updateError) throw updateError;

    const total = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount), 0);

    await supabase
      .from('v2_draws')
      .update({ total_amount: total })
      .eq('id', drawId);

    res.json({ success: true, total });
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

    if (draw.status === 'funded') {
      return res.status(400).json({ error: 'Cannot remove invoices from a funded draw' });
    }

    // Remove from draw_invoices
    const { error: deleteError } = await supabase
      .from('v2_draw_invoices')
      .delete()
      .eq('draw_id', drawId)
      .eq('invoice_id', invoice_id);

    if (deleteError) throw deleteError;

    // Update invoice status back to coded and clear the stamp
    // Invoice needs to be re-approved after being removed from draw
    const { error: updateError } = await supabase
      .from('v2_invoices')
      .update({
        status: 'coded',
        pdf_stamped_url: null,
        approved_at: null,
        approved_by: null
      })
      .eq('id', invoice_id);

    if (updateError) throw updateError;

    // Log activity
    await logActivity(invoice_id, 'removed_from_draw', performed_by, {
      draw_number: draw.draw_number
    });

    // Recalculate draw total
    const { data: remainingInvoices } = await supabase
      .from('v2_draw_invoices')
      .select('invoice:v2_invoices(amount)')
      .eq('draw_id', drawId);

    const newTotal = remainingInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;

    await supabase
      .from('v2_draws')
      .update({ total_amount: newTotal })
      .eq('id', drawId);

    res.json({ success: true, new_total: newTotal });
  } catch (err) {
    console.error('Error removing invoice from draw:', err);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/draws/:id/submit', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_draws')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString()
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/draws/:id/fund', async (req, res) => {
  try {
    const drawId = req.params.id;
    const { funded_amount } = req.body;

    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .update({
        status: 'funded',
        funded_at: new Date().toISOString(),
        funded_amount
      })
      .eq('id', drawId)
      .select()
      .single();

    if (drawError) throw drawError;

    const { data: drawInvoices } = await supabase
      .from('v2_draw_invoices')
      .select('invoice_id')
      .eq('draw_id', drawId);

    if (drawInvoices && drawInvoices.length > 0) {
      const invoiceIds = drawInvoices.map(di => di.invoice_id);

      // Get invoices with their stamped PDFs to add PAID stamp
      const { data: invoicesForStamp } = await supabase
        .from('v2_invoices')
        .select('id, pdf_stamped_url')
        .in('id', invoiceIds);

      // Add PAID stamp to each invoice
      const paidDate = new Date().toLocaleDateString();
      for (const inv of invoicesForStamp || []) {
        if (inv.pdf_stamped_url) {
          try {
            const urlParts = inv.pdf_stamped_url.split('/storage/v1/object/public/invoices/');
            if (urlParts[1]) {
              const storagePath = decodeURIComponent(urlParts[1]).replace('_stamped.pdf', '.pdf');
              const pdfBuffer = await downloadPDF(storagePath.replace('.pdf', '_stamped.pdf'));
              const stampedBuffer = await stampPaid(pdfBuffer, paidDate);
              await uploadStampedPDF(stampedBuffer, storagePath);
            }
          } catch (stampErr) {
            console.error('PAID stamp failed for invoice:', inv.id, stampErr.message);
          }
        }
        await logActivity(inv.id, 'paid', 'System', { draw_id: drawId });
      }

      await supabase
        .from('v2_invoices')
        .update({ status: 'paid' })
        .in('id', invoiceIds);

      // ==========================================
      // LIVE BUDGET UPDATES - Mark as paid
      // ==========================================

      // Get all invoices with allocations to update paid_amount
      for (const invId of invoiceIds) {
        const { data: inv } = await supabase
          .from('v2_invoices')
          .select(`
            job_id,
            allocations:v2_invoice_allocations(amount, cost_code_id)
          `)
          .eq('id', invId)
          .single();

        if (inv?.allocations && inv.job_id) {
          for (const alloc of inv.allocations) {
            if (!alloc.cost_code_id) continue;

            const { data: budgetLine } = await supabase
              .from('v2_budget_lines')
              .select('id, paid_amount')
              .eq('job_id', inv.job_id)
              .eq('cost_code_id', alloc.cost_code_id)
              .single();

            if (budgetLine) {
              const newPaid = (parseFloat(budgetLine.paid_amount) || 0) + parseFloat(alloc.amount);
              await supabase
                .from('v2_budget_lines')
                .update({ paid_amount: newPaid })
                .eq('id', budgetLine.id);
            }
          }
        }
      }
    }

    res.json(draw);
  } catch (err) {
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
      received: { count: 0, amount: 0 },
      coded: { count: 0, amount: 0 },
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
        if (drawStats[d.status]) {
          drawStats[d.status].count++;
          drawStats[d.status].amount += parseFloat(d.total_amount) || 0;
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

  // Check if invoice is archived (read-only)
  const archivedStatuses = ['paid', 'denied'];
  if (archivedStatuses.includes(existing.status)) {
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
  if (updates.invoice_number || updates.vendor_id) {
    const dupCheck = await checkDuplicate(
      updates.vendor_id || existing.vendor_id,
      updates.invoice_number || existing.invoice_number,
      updates.amount || existing.amount,
      invoiceId
    );
    if (dupCheck.isDuplicate) {
      throw new AppError('DUPLICATE_INVOICE', dupCheck.message, { existingInvoice: dupCheck.existingInvoice });
    }
  }

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
  const editableFields = ['invoice_number', 'invoice_date', 'due_date', 'amount', 'job_id', 'vendor_id', 'po_id', 'notes', 'status'];
  for (const field of editableFields) {
    if (updates.hasOwnProperty(field)) {
      updateFields[field] = updates[field];
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
      // Unapprove: approved → coded (clear approval)
      'approved_to_coded': () => {
        updateFields.approved_at = null;
        updateFields.approved_by = null;
      },
      // Remove from draw: in_draw → approved
      'in_draw_to_approved': () => {
        // Keep approval info
      },
      // Resubmit denied: denied → received (clear denial)
      'denied_to_received': () => {
        updateFields.denied_at = null;
        updateFields.denied_by = null;
        updateFields.denial_reason = null;
      },
      // Code: received → coded
      'received_to_coded': () => {
        updateFields.coded_at = new Date().toISOString();
        updateFields.coded_by = performedBy;
      },
      // Approve: coded → approved
      'coded_to_approved': () => {
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

    // Handle removing invoice from draw when transitioning from in_draw to approved
    if (existing.status === 'in_draw' && updates.status === 'approved') {
      // Find and delete the draw_invoice record
      const { data: drawInvoice } = await supabase
        .from('v2_draw_invoices')
        .select('draw_id, draw:v2_draws(draw_number)')
        .eq('invoice_id', invoiceId)
        .single();

      if (drawInvoice) {
        await supabase
          .from('v2_draw_invoices')
          .delete()
          .eq('invoice_id', invoiceId);

        // Update draw total
        const { data: remainingInvoices } = await supabase
          .from('v2_draw_invoices')
          .select('invoice:v2_invoices(amount)')
          .eq('draw_id', drawInvoice.draw_id);

        const newTotal = remainingInvoices?.reduce((sum, di) => sum + parseFloat(di.invoice?.amount || 0), 0) || 0;
        await supabase.from('v2_draws').update({ total_amount: newTotal }).eq('id', drawInvoice.draw_id);

        // Log removed from draw activity
        await logActivity(invoiceId, 'removed_from_draw', performedBy, {
          draw_number: drawInvoice.draw?.draw_number
        });
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
        notes: a.notes || null
      }));

    if (allocsToInsert.length > 0) {
      const { error: allocError } = await supabase.from('v2_invoice_allocations').insert(allocsToInsert);
      if (allocError) {
        console.error('Failed to save allocations:', allocError);
      }
    }

    changes.allocations = { from: existing.allocations?.length || 0, to: allocsToInsert.length };
  }

  // Log activity
  if (Object.keys(changes).length > 0) {
    await logActivity(invoiceId, 'edited', performedBy, { changes });
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
        notes: a.notes
      }));
      await supabase.from('v2_invoice_allocations').insert(allocsToInsert);
    }
  }

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
      allocations:v2_invoice_allocations(id, amount, cost_code_id, cost_code:v2_cost_codes(code, name))
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
    case 'coded':
      updateData.coded_at = new Date().toISOString();
      updateData.coded_by = performedBy;
      // Clear stamp when moving back to coded (needs approval)
      updateData.pdf_stamped_url = null;
      updateData.approved_at = null;
      updateData.approved_by = null;
      break;

    case 'approved':
      updateData.approved_at = new Date().toISOString();
      updateData.approved_by = performedBy;

      // Handle allocations if provided
      if (allocations && allocations.length > 0) {
        await supabase.from('v2_invoice_allocations').delete().eq('invoice_id', invoiceId);
        const allocsToInsert = allocations.map(a => ({
          invoice_id: invoiceId,
          cost_code_id: a.cost_code_id,
          amount: a.amount,
          notes: a.notes
        }));
        await supabase.from('v2_invoice_allocations').insert(allocsToInsert);
      }

      // Stamp PDF
      if (invoice.pdf_url) {
        try {
          const urlParts = invoice.pdf_url.split('/storage/v1/object/public/invoices/');
          if (urlParts[1]) {
            const storagePath = decodeURIComponent(urlParts[1]);
            const pdfBuffer = await downloadPDF(storagePath);

            // Get PO info
            let poTotal = null, poBilledToDate = 0;
            if (invoice.po?.id) {
              poTotal = parseFloat(invoice.po.total_amount);
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

            // Get cost code details for stamping
            const allocsForStamp = allocations || invoice.allocations || [];
            let costCodesForStamp = [];

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

                  const codeMap = {};
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
              poBilledToDate
            });

            const result = await uploadStampedPDF(stampedBuffer, storagePath);
            pdf_stamped_url = result.url;
            updateData.pdf_stamped_url = pdf_stamped_url;
          }
        } catch (stampErr) {
          console.error('PDF stamping failed:', stampErr.message);
          // Continue without stamp but flag it
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

    case 'received':
      // Clearing denial (if coming from denied)
      if (invoice.status === 'denied') {
        updateData.denied_at = null;
        updateData.denied_by = null;
        updateData.denial_reason = null;
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

  if (draw.status === 'funded') {
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

    if (drawInvoice?.draw?.status === 'funded') {
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

app.listen(port, () => {
  console.log('');
  console.log('='.repeat(50));
  console.log('ROSS BUILT CONSTRUCTION MANAGEMENT');
  console.log('='.repeat(50));
  console.log(`Server running at http://localhost:${port}`);
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
