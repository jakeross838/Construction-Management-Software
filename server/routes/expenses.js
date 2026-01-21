/**
 * Expense Routes
 * Non-invoice expense tracking with filtering and period assignment
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// GET EXPENSE CATEGORIES
// ============================================================

router.get('/categories', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_expense_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// EXPENSE STATS (must be before /:id route)
// ============================================================

router.get('/stats/summary', asyncHandler(async (req, res) => {
  const { period_id, start_date, end_date } = req.query;

  let query = supabase
    .from('v2_expenses')
    .select(`
      amount,
      category:v2_expense_categories(overhead_type)
    `)
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
  const { period_id, category_id, vendor_id, overhead_type, start_date, end_date } = req.query;

  let query = supabase
    .from('v2_expenses')
    .select(`
      *,
      category:v2_expense_categories(id, name, overhead_type),
      vendor:v2_vendors(id, name),
      period:v2_financial_periods(id, name, status)
    `)
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
      .single();

    if (period?.is_locked) {
      throw new AppError('LOCKED_ERROR', `Cannot add expense to locked period: ${period.name}`);
    }
  }

  const { data, error } = await supabase
    .from('v2_expenses')
    .insert({
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
    .select(`
      *,
      category:v2_expense_categories(id, name, overhead_type),
      vendor:v2_vendors(id, name),
      period:v2_financial_periods(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await supabase.from('v2_expense_activity').insert({
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
  const { id } = req.params;
  const { deleted_by } = req.body;

  // Check if expense's period is locked
  const { data: existing } = await supabase
    .from('v2_expenses')
    .select('period:v2_financial_periods(is_locked, name)')
    .eq('id', id)
    .single();

  if (existing?.period?.is_locked) {
    throw new AppError('LOCKED_ERROR',
      `Cannot delete expense from locked period: ${existing.period.name}`);
  }

  const { error } = await supabase
    .from('v2_expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await supabase.from('v2_expense_activity').insert({
    expense_id: id,
    action: 'deleted',
    performed_by: deleted_by || 'system',
    details: {}
  });

  res.json({ success: true });
}));

module.exports = router;
