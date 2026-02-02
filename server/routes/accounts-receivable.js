/**
 * Accounts Receivable Routes
 * Client invoicing and payment tracking
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler, notFoundError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const logger = require('../utils/logger');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Log client invoice activity
 */
async function logInvoiceActivity(invoiceId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_client_invoice_activity').insert({
      client_invoice_id: invoiceId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    logger.error('Failed to log AR invoice activity', { invoiceId, error: err.message });
  }
}

/**
 * Update overdue invoices status
 */
async function updateOverdueStatuses(builderId) {
  try {
    await supabase
      .from('v2_client_invoices')
      .update({ status: 'overdue' })
      .eq('builder_id', builderId)
      .in('status', ['sent', 'partial'])
      .lt('due_date', new Date().toISOString().split('T')[0])
      .is('deleted_at', null);
  } catch (err) {
    logger.error('Failed to update overdue statuses', { builderId, error: err.message });
  }
}

// ============================================================
// CLIENT INVOICES
// ============================================================

/**
 * GET /api/ar/invoices
 * List client invoices with filters
 */
router.get('/invoices', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, client_id, status, start_date, end_date } = req.query;

  // Update overdue statuses first
  if (builderId) {
    await updateOverdueStatuses(builderId);
  }

  let query = supabase
    .from('v2_client_invoices')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      client:v2_clients(id, name, email),
      draw:v2_draws(id, draw_number, status),
      payments:v2_client_payments(id, amount, payment_date, payment_method, reference_number)
    `)
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false });

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  if (client_id) {
    query = query.eq('client_id', client_id);
  }

  if (status) {
    if (status === 'outstanding') {
      query = query.in('status', ['sent', 'partial', 'overdue']);
    } else {
      query = query.eq('status', status);
    }
  }

  if (start_date) {
    query = query.gte('invoice_date', start_date);
  }

  if (end_date) {
    query = query.lte('invoice_date', end_date);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(data);
}));

/**
 * GET /api/ar/invoices/:id
 * Get single client invoice with details
 */
router.get('/invoices/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  let query = supabase
    .from('v2_client_invoices')
    .select(`
      *,
      job:v2_jobs(id, name, address, client_name),
      client:v2_clients(id, name, email, phone),
      draw:v2_draws(id, draw_number, status, total_amount, period_end),
      payments:v2_client_payments(id, amount, payment_date, payment_method, reference_number, notes, received_by, received_at),
      activity:v2_client_invoice_activity(id, action, performed_by, details, created_at)
    `)
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data, error } = await query.single();

  if (error || !data) throw notFoundError('Client invoice');

  res.json(data);
}));

/**
 * POST /api/ar/invoices
 * Create a new client invoice (optionally from a draw)
 */
router.post('/invoices', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    job_id,
    client_id,
    draw_id,
    invoice_number,
    description,
    amount,
    retainage_amount = 0,
    tax_amount = 0,
    invoice_date,
    due_date,
    terms,
    notes,
    created_by
  } = req.body;

  if (!job_id || !amount) {
    throw new AppError('VALIDATION_FAILED', 'job_id and amount are required');
  }

  // Generate invoice number if not provided
  let finalInvoiceNumber = invoice_number;
  if (!finalInvoiceNumber && builderId) {
    const { data: generated } = await supabase
      .rpc('generate_client_invoice_number', { p_builder_id: builderId });
    finalInvoiceNumber = generated;
  }

  if (!finalInvoiceNumber) {
    throw new AppError('VALIDATION_FAILED', 'invoice_number is required');
  }

  // If creating from draw, get draw info
  let drawInfo = null;
  let finalDescription = description;
  let finalAmount = amount;

  if (draw_id) {
    const { data: draw, error: drawError } = await supabase
      .from('v2_draws')
      .select('id, draw_number, total_amount, job_id, status')
      .eq('id', draw_id)
      .single();

    if (drawError || !draw) {
      throw new AppError('VALIDATION_FAILED', 'Draw not found');
    }

    drawInfo = draw;
    if (!finalDescription) {
      finalDescription = `Draw #${draw.draw_number}`;
    }
    if (!amount || amount === 0) {
      finalAmount = draw.total_amount;
    }
  }

  const invoiceData = {
    job_id,
    client_id: client_id || null,
    draw_id: draw_id || null,
    invoice_number: finalInvoiceNumber,
    description: finalDescription,
    amount: finalAmount,
    retainage_amount: retainage_amount || 0,
    tax_amount: tax_amount || 0,
    invoice_date: invoice_date || new Date().toISOString().split('T')[0],
    due_date: due_date || null,
    terms: terms || null,
    notes: notes || null,
    created_by: created_by || null,
    status: 'draft'
  };

  if (builderId) {
    invoiceData.builder_id = builderId;
  }

  const { data, error } = await supabase
    .from('v2_client_invoices')
    .insert(invoiceData)
    .select()
    .single();

  if (error) {
    if (error.code === '23505') { // Unique constraint violation
      throw new AppError('VALIDATION_FAILED', 'Invoice number already exists');
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Log activity
  await logInvoiceActivity(data.id, 'created', created_by, {
    from_draw: !!draw_id,
    draw_number: drawInfo?.draw_number
  });

  res.status(201).json(data);
}));

/**
 * PATCH /api/ar/invoices/:id
 * Update a client invoice
 */
router.patch('/invoices/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const updates = req.body;

  // Remove fields that shouldn't be directly updated
  delete updates.id;
  delete updates.builder_id;
  delete updates.created_at;
  delete updates.paid_amount; // Managed by payments

  let query = supabase
    .from('v2_client_invoices')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data, error } = await query.select().single();

  if (error || !data) throw notFoundError('Client invoice');

  // Log activity
  await logInvoiceActivity(id, 'updated', updates.updated_by || null, { fields: Object.keys(updates) });

  res.json(data);
}));

/**
 * POST /api/ar/invoices/:id/send
 * Mark invoice as sent
 */
router.post('/invoices/:id/send', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { sent_to, sent_by } = req.body;

  let query = supabase
    .from('v2_client_invoices')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_to: sent_to || null
    })
    .eq('id', id)
    .eq('status', 'draft')
    .is('deleted_at', null);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data, error } = await query.select().single();

  if (error || !data) {
    throw new AppError('VALIDATION_FAILED', 'Invoice not found or not in draft status');
  }

  await logInvoiceActivity(id, 'sent', sent_by, { sent_to });

  res.json(data);
}));

/**
 * POST /api/ar/invoices/:id/void
 * Void an invoice
 */
router.post('/invoices/:id/void', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { reason, voided_by } = req.body;

  // Check if invoice has payments
  const { data: payments } = await supabase
    .from('v2_client_payments')
    .select('id')
    .eq('client_invoice_id', id)
    .is('deleted_at', null)
    .limit(1);

  if (payments && payments.length > 0) {
    throw new AppError('VALIDATION_FAILED', 'Cannot void an invoice with payments. Delete payments first.');
  }

  let query = supabase
    .from('v2_client_invoices')
    .update({ status: 'void' })
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data, error } = await query.select().single();

  if (error || !data) throw notFoundError('Client invoice');

  await logInvoiceActivity(id, 'voided', voided_by, { reason });

  res.json(data);
}));

/**
 * DELETE /api/ar/invoices/:id
 * Soft delete a client invoice
 */
router.delete('/invoices/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  let query = supabase
    .from('v2_client_invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data, error } = await query.select().single();

  if (error || !data) throw notFoundError('Client invoice');

  res.json({ success: true, message: 'Invoice deleted' });
}));

// ============================================================
// PAYMENTS
// ============================================================

/**
 * POST /api/ar/invoices/:id/payments
 * Record a payment for an invoice
 */
router.post('/invoices/:id/payments', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const {
    amount,
    payment_date,
    payment_method = 'check',
    reference_number,
    notes,
    received_by
  } = req.body;

  if (!amount || amount <= 0) {
    throw new AppError('VALIDATION_FAILED', 'Payment amount must be greater than 0');
  }

  // Verify invoice exists and get balance
  let invoiceQuery = supabase
    .from('v2_client_invoices')
    .select('id, balance_due, status')
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    invoiceQuery = invoiceQuery.eq('builder_id', builderId);
  }

  const { data: invoice, error: invoiceError } = await invoiceQuery.single();

  if (invoiceError || !invoice) throw notFoundError('Client invoice');

  if (invoice.status === 'draft') {
    throw new AppError('VALIDATION_FAILED', 'Cannot record payment for draft invoice');
  }

  if (invoice.status === 'void') {
    throw new AppError('VALIDATION_FAILED', 'Cannot record payment for voided invoice');
  }

  // Insert payment
  const paymentData = {
    client_invoice_id: id,
    amount,
    payment_date: payment_date || new Date().toISOString().split('T')[0],
    payment_method,
    reference_number: reference_number || null,
    notes: notes || null,
    received_by: received_by || null
  };

  if (builderId) {
    paymentData.builder_id = builderId;
  }

  const { data: payment, error } = await supabase
    .from('v2_client_payments')
    .insert(paymentData)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity (trigger will update invoice totals)
  await logInvoiceActivity(id, 'payment_received', received_by, {
    payment_id: payment.id,
    amount,
    payment_method,
    reference_number
  });

  // Get updated invoice
  const { data: updatedInvoice } = await supabase
    .from('v2_client_invoices')
    .select('*')
    .eq('id', id)
    .single();

  res.status(201).json({
    payment,
    invoice: updatedInvoice
  });
}));

/**
 * DELETE /api/ar/payments/:id
 * Delete a payment
 */
router.delete('/payments/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  // Get payment to find invoice
  let paymentQuery = supabase
    .from('v2_client_payments')
    .select('id, client_invoice_id, amount')
    .eq('id', id)
    .is('deleted_at', null);

  if (builderId) {
    paymentQuery = paymentQuery.eq('builder_id', builderId);
  }

  const { data: payment, error: paymentError } = await paymentQuery.single();

  if (paymentError || !payment) throw notFoundError('Payment');

  // Soft delete the payment
  const { error } = await supabase
    .from('v2_client_payments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logInvoiceActivity(payment.client_invoice_id, 'payment_deleted', null, {
    payment_id: id,
    amount: payment.amount
  });

  res.json({ success: true, message: 'Payment deleted' });
}));

// ============================================================
// AR AGING REPORT
// ============================================================

/**
 * GET /api/ar/aging
 * Get AR aging report
 */
router.get('/aging', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, client_id } = req.query;

  // Update overdue statuses first
  if (builderId) {
    await updateOverdueStatuses(builderId);
  }

  // Get aging detail
  let detailQuery = supabase
    .from('v2_ar_aging')
    .select('*')
    .order('days_past_due', { ascending: false });

  if (builderId) {
    detailQuery = detailQuery.eq('builder_id', builderId);
  }

  if (job_id) {
    detailQuery = detailQuery.eq('job_id', job_id);
  }

  if (client_id) {
    detailQuery = detailQuery.eq('client_id', client_id);
  }

  const { data: detail, error: detailError } = await detailQuery;

  if (detailError) throw new AppError('DATABASE_ERROR', detailError.message);

  // Get aging summary
  let summaryQuery = supabase
    .from('v2_ar_aging_summary')
    .select('*');

  if (builderId) {
    summaryQuery = summaryQuery.eq('builder_id', builderId);
  }

  const { data: summaryData } = await summaryQuery.single();

  // Calculate summary by bucket from detail if view returned nothing
  const summary = summaryData || {
    current_amount: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_90_plus: 0,
    total_outstanding: 0,
    invoice_count: 0
  };

  // If filtering, recalculate from detail
  if ((job_id || client_id) && detail) {
    summary.current_amount = detail.filter(d => d.aging_bucket === 'current').reduce((s, d) => s + parseFloat(d.balance_due || 0), 0);
    summary.days_1_30 = detail.filter(d => d.aging_bucket === '1-30').reduce((s, d) => s + parseFloat(d.balance_due || 0), 0);
    summary.days_31_60 = detail.filter(d => d.aging_bucket === '31-60').reduce((s, d) => s + parseFloat(d.balance_due || 0), 0);
    summary.days_61_90 = detail.filter(d => d.aging_bucket === '61-90').reduce((s, d) => s + parseFloat(d.balance_due || 0), 0);
    summary.days_90_plus = detail.filter(d => d.aging_bucket === '90+').reduce((s, d) => s + parseFloat(d.balance_due || 0), 0);
    summary.total_outstanding = detail.reduce((s, d) => s + parseFloat(d.balance_due || 0), 0);
    summary.invoice_count = detail.length;
  }

  res.json({
    summary,
    invoices: detail || []
  });
}));

// ============================================================
// AR SUMMARY
// ============================================================

/**
 * GET /api/ar/summary
 * Get overall AR summary stats
 */
router.get('/summary', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  // Update overdue statuses first
  if (builderId) {
    await updateOverdueStatuses(builderId);
  }

  // Get summary from view
  let query = supabase
    .from('v2_ar_summary')
    .select('*');

  if (builderId) {
    query = query.eq('builder_id', builderId);
  }

  const { data, error } = await query.single();

  if (error && error.code !== 'PGRST116') { // Ignore "no rows" error
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Default values if no data
  const summary = data || {
    draft_count: 0,
    draft_amount: 0,
    sent_count: 0,
    sent_outstanding: 0,
    partial_count: 0,
    partial_outstanding: 0,
    overdue_count: 0,
    overdue_amount: 0,
    paid_count: 0,
    paid_amount: 0,
    total_invoiced: 0,
    total_collected: 0,
    total_outstanding: 0
  };

  // Get recent payments (last 30 days)
  let recentPaymentsQuery = supabase
    .from('v2_client_payments')
    .select('amount, payment_date')
    .gte('payment_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .is('deleted_at', null)
    .order('payment_date', { ascending: false });

  if (builderId) {
    recentPaymentsQuery = recentPaymentsQuery.eq('builder_id', builderId);
  }

  const { data: recentPayments } = await recentPaymentsQuery;

  const collections_last_30_days = recentPayments?.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0) || 0;

  res.json({
    ...summary,
    collections_last_30_days
  });
}));

// ============================================================
// BATCH OPERATIONS
// ============================================================

/**
 * POST /api/ar/invoices/from-draws
 * Create client invoices from multiple draws
 */
router.post('/invoices/from-draws', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { draw_ids, created_by } = req.body;

  if (!draw_ids || !Array.isArray(draw_ids) || draw_ids.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'draw_ids array is required');
  }

  const results = [];
  const errors = [];

  for (const drawId of draw_ids) {
    try {
      // Get draw info
      let drawQuery = supabase
        .from('v2_draws')
        .select('id, draw_number, total_amount, job_id, status')
        .eq('id', drawId);

      if (builderId) {
        // Check job belongs to builder
        drawQuery = supabase
          .from('v2_draws')
          .select(`
            id, draw_number, total_amount, job_id, status,
            job:v2_jobs(builder_id)
          `)
          .eq('id', drawId);
      }

      const { data: draw, error: drawError } = await drawQuery.single();

      if (drawError || !draw) {
        errors.push({ draw_id: drawId, error: 'Draw not found' });
        continue;
      }

      if (builderId && draw.job?.builder_id !== builderId) {
        errors.push({ draw_id: drawId, error: 'Draw not accessible' });
        continue;
      }

      // Check if invoice already exists for this draw
      const { data: existing } = await supabase
        .from('v2_client_invoices')
        .select('id')
        .eq('draw_id', drawId)
        .is('deleted_at', null)
        .limit(1);

      if (existing && existing.length > 0) {
        errors.push({ draw_id: drawId, error: 'Invoice already exists for this draw' });
        continue;
      }

      // Generate invoice number
      let invoiceNumber;
      if (builderId) {
        const { data: generated } = await supabase
          .rpc('generate_client_invoice_number', { p_builder_id: builderId });
        invoiceNumber = generated;
      } else {
        invoiceNumber = `INV-${Date.now()}`;
      }

      // Create invoice
      const invoiceData = {
        job_id: draw.job_id,
        draw_id: drawId,
        invoice_number: invoiceNumber,
        description: `Draw #${draw.draw_number}`,
        amount: draw.total_amount,
        invoice_date: new Date().toISOString().split('T')[0],
        created_by,
        status: 'draft'
      };

      if (builderId) {
        invoiceData.builder_id = builderId;
      }

      const { data: invoice, error: invoiceError } = await supabase
        .from('v2_client_invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) {
        errors.push({ draw_id: drawId, error: invoiceError.message });
        continue;
      }

      await logInvoiceActivity(invoice.id, 'created', created_by, { from_draw: true, draw_number: draw.draw_number });
      results.push(invoice);
    } catch (err) {
      errors.push({ draw_id: drawId, error: err.message });
    }
  }

  res.json({
    created: results.length,
    failed: errors.length,
    invoices: results,
    errors
  });
}));

module.exports = router;
