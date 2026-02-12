/**
 * Expense Routes
 * Non-invoice expense tracking with filtering and period assignment
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// GET EXPENSE CATEGORIES
// ============================================================

router.get('/categories', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { data, error } = await supabase
    .from('v2_expense_categories')
    .select('*')
    .eq('builder_id', builderId)
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// EXPENSE STATS (must be before /:id route)
// ============================================================

router.get('/stats/summary', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { period_id, start_date, end_date } = req.query;

  let query = supabase
    .from('v2_expenses')
    .select(`
      amount,
      category:v2_expense_categories(overhead_type)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null);

  if (period_id) query = query.eq('period_id', period_id);
  if (start_date) query = query.gte('expense_date', start_date);
  if (end_date) query = query.lte('expense_date', end_date);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Aggregate by overhead type
  const byType = data.reduce((acc, expense) => {
    const type = expense.category?.overhead_type || 'other';
    acc[type] = (acc[type] || 0) + parseFloat(expense.amount);
    return acc;
  }, {});

  const total = data.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  res.json({
    total,
    count: data.length,
    by_overhead_type: byType
  });
}));

// ============================================================
// LIST EXPENSES
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { period_id, category_id, vendor_id, overhead_type, start_date, end_date } = req.query;

  let query = supabase
    .from('v2_expenses')
    .select(`
      *,
      category:v2_expense_categories(id, name, overhead_type),
      vendor:v2_vendors(id, name),
      period:v2_financial_periods(id, name, status)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .order('expense_date', { ascending: false });

  if (period_id) query = query.eq('period_id', period_id);
  if (category_id) query = query.eq('category_id', category_id);
  if (vendor_id) query = query.eq('vendor_id', vendor_id);
  if (start_date) query = query.gte('expense_date', start_date);
  if (end_date) query = query.lte('expense_date', end_date);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Filter by overhead_type if specified (requires post-filter)
  let filtered = data;
  if (overhead_type) {
    filtered = data.filter(e => e.category?.overhead_type === overhead_type);
  }

  res.json(filtered);
}));

// ============================================================
// GET SINGLE EXPENSE
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { data, error } = await supabase
    .from('v2_expenses')
    .select(`
      *,
      category:v2_expense_categories(*),
      vendor:v2_vendors(id, name, email),
      period:v2_financial_periods(id, name, status, is_locked),
      activity:v2_expense_activity(*)
    `)
    .eq('id', req.params.id)
    .eq('builder_id', builderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Expense not found' });
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data);
}));

// ============================================================
// CREATE EXPENSE
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    amount, description, expense_date, category_id, vendor_id,
    period_id, job_id, receipt_url, notes, created_by
  } = req.body;

  // Validation
  if (!amount || !expense_date) {
    throw new AppError('VALIDATION_FAILED', 'amount and expense_date are required');
  }

  if (parseFloat(amount) <= 0) {
    throw new AppError('VALIDATION_FAILED', 'amount must be positive');
  }

  // Check if period is locked (if specified)
  if (period_id) {
    const { data: period } = await supabase
      .from('v2_financial_periods')
      .select('is_locked, name')
      .eq('id', period_id)
      .eq('builder_id', builderId)
      .single();

    if (period?.is_locked) {
      throw new AppError('LOCKED_ERROR', `Cannot add expense to locked period: ${period.name}`);
    }
  }

  const { data, error } = await supabase
    .from('v2_expenses')
    .insert({
      builder_id: builderId,
      amount,
      description,
      expense_date,
      category_id,
      vendor_id,
      period_id,
      job_id,
      receipt_url,
      notes,
      created_by: created_by || 'system'
    })
    .select(`
      *,
      category:v2_expense_categories(id, name, overhead_type),
      vendor:v2_vendors(id, name),
      period:v2_financial_periods(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_expense_activity').insert({
    builder_id: builderId,
    expense_id: data.id,
    action: 'created',
    performed_by: created_by || 'system',
    details: { amount, category_id, expense_date }
  });

  res.json(data);
}));

// ============================================================
// UPDATE EXPENSE
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const {
    amount, description, expense_date, category_id, vendor_id,
    receipt_url, notes, updated_by
  } = req.body;

  // Check if expense's period is locked
  const { data: existing } = await supabase
    .from('v2_expenses')
    .select('period_id, period:v2_financial_periods(is_locked, name)')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Expense not found' });
  }

  if (existing.period?.is_locked) {
    throw new AppError('LOCKED_ERROR',
      `Cannot modify expense in locked period: ${existing.period.name}`);
  }

  const updates = {};
  if (amount !== undefined) updates.amount = amount;
  if (description !== undefined) updates.description = description;
  if (expense_date !== undefined) updates.expense_date = expense_date;
  if (category_id !== undefined) updates.category_id = category_id;
  if (vendor_id !== undefined) updates.vendor_id = vendor_id;
  if (receipt_url !== undefined) updates.receipt_url = receipt_url;
  if (notes !== undefined) updates.notes = notes;
  updates.updated_by = updated_by || 'system';

  const { data, error } = await supabase
    .from('v2_expenses')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      category:v2_expense_categories(id, name, overhead_type),
      vendor:v2_vendors(id, name),
      period:v2_financial_periods(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await supabase.from('v2_expense_activity').insert({
    builder_id: builderId,
    expense_id: id,
    action: 'updated',
    performed_by: updated_by || 'system',
    details: updates
  });

  res.json(data);
}));

// ============================================================
// DELETE EXPENSE (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { deleted_by } = req.body;

  // Check if expense's period is locked
  const { data: existing } = await supabase
    .from('v2_expenses')
    .select('period:v2_financial_periods(is_locked, name)')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (existing?.period?.is_locked) {
    throw new AppError('LOCKED_ERROR',
      `Cannot delete expense from locked period: ${existing.period.name}`);
  }

  const { error } = await supabase
    .from('v2_expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await supabase.from('v2_expense_activity').insert({
    builder_id: builderId,
    expense_id: id,
    action: 'deleted',
    performed_by: deleted_by || 'system',
    details: {}
  });

  res.json({ success: true });
}));

// ============================================================
// RECURRING EXPENSES
// ============================================================

// List recurring expenses
router.get('/recurring/list', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { data, error } = await supabase
    .from('v2_recurring_expenses')
    .select(`
      *,
      category:v2_expense_categories(id, name, overhead_type),
      vendor:v2_vendors(id, name)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Create recurring expense
router.post('/recurring', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    amount, description, category_id, vendor_id,
    frequency, day_of_month, created_by
  } = req.body;

  if (!amount) {
    throw new AppError('VALIDATION_FAILED', 'amount is required');
  }

  // Calculate first occurrence
  const today = new Date();
  let next_occurrence = new Date(today.getFullYear(), today.getMonth(), day_of_month || 1);
  if (next_occurrence <= today) {
    next_occurrence.setMonth(next_occurrence.getMonth() + 1);
  }

  const { data, error } = await supabase
    .from('v2_recurring_expenses')
    .insert({
      builder_id: builderId,
      amount,
      description,
      category_id,
      vendor_id,
      frequency: frequency || 'monthly',
      day_of_month: day_of_month || 1,
      next_occurrence: next_occurrence.toISOString().split('T')[0],
      created_by: created_by || 'system'
    })
    .select(`
      *,
      category:v2_expense_categories(id, name, overhead_type),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Update recurring expense
router.patch('/recurring/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const {
    amount, description, category_id, vendor_id,
    frequency, day_of_month, is_active
  } = req.body;

  const updates = {};
  if (amount !== undefined) updates.amount = amount;
  if (description !== undefined) updates.description = description;
  if (category_id !== undefined) updates.category_id = category_id;
  if (vendor_id !== undefined) updates.vendor_id = vendor_id;
  if (frequency !== undefined) updates.frequency = frequency;
  if (day_of_month !== undefined) updates.day_of_month = day_of_month;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from('v2_recurring_expenses')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      category:v2_expense_categories(id, name, overhead_type),
      vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Delete recurring expense
router.delete('/recurring/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_recurring_expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// Process recurring expenses (create due expenses)
router.post('/recurring/process', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  // Call the database function to process recurring expenses
  const { data, error } = await supabase.rpc('process_recurring_expenses', { p_builder_id: builderId });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ created_count: data });
}));

// ============================================================
// EXPENSE RECEIPTS
// ============================================================

// Add receipt to expense
router.post('/:id/receipts', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { file_name, file_url, file_type, file_size, uploaded_by } = req.body;

  if (!file_url) {
    throw new AppError('VALIDATION_FAILED', 'file_url is required');
  }

  const { data, error } = await supabase
    .from('v2_expense_receipts')
    .insert({
      builder_id: builderId,
      expense_id: id,
      file_name: file_name || 'receipt',
      file_url,
      file_type,
      file_size,
      uploaded_by: uploaded_by || 'system'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Also update the primary receipt_url on the expense for backwards compatibility
  await supabase
    .from('v2_expenses')
    .update({ receipt_url: file_url })
    .eq('id', id)
    .eq('builder_id', builderId);

  res.json(data);
}));

// List receipts for expense
router.get('/:id/receipts', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_expense_receipts')
    .select('*')
    .eq('expense_id', id)
    .eq('builder_id', builderId)
    .order('uploaded_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Delete receipt
router.delete('/receipts/:receiptId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { receiptId } = req.params;

  const { error } = await supabase
    .from('v2_expense_receipts')
    .delete()
    .eq('id', receiptId)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

module.exports = router;
