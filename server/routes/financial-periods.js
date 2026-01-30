/**
 * Financial Period Routes
 * Period management with open/close/lock functionality
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============================================================
// LIST PERIODS
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { status, year } = req.query;

  let query = supabase
    .from('v2_financial_periods')
    .select('*')
    .is('deleted_at', null)
    .order('start_date', { ascending: false });

  if (status) query = query.eq('status', status);
  if (year) {
    query = query
      .gte('start_date', `${year}-01-01`)
      .lte('end_date', `${year}-12-31`);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(data);
}));

// ============================================================
// GET SINGLE PERIOD
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_financial_periods')
    .select(`
      *,
      activity:v2_financial_period_activity(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Period not found' });
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data);
}));

// ============================================================
// CREATE PERIOD
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const { name, period_type, start_date, end_date, created_by } = req.body;

  if (!name || !start_date || !end_date) {
    throw new AppError('VALIDATION_FAILED', 'name, start_date, and end_date are required');
  }

  if (new Date(start_date) >= new Date(end_date)) {
    throw new AppError('VALIDATION_FAILED', 'end_date must be after start_date');
  }

  // Check for overlapping periods
  const { data: existing } = await supabase
    .from('v2_financial_periods')
    .select('id, name')
    .is('deleted_at', null)
    .or(`and(start_date.lte.${end_date},end_date.gte.${start_date})`);

  if (existing && existing.length > 0) {
    throw new AppError('VALIDATION_FAILED',
      `Period overlaps with existing period: ${existing[0].name}`);
  }

  const { data, error } = await supabase
    .from('v2_financial_periods')
    .insert({
      name,
      period_type: period_type || 'monthly',
      start_date,
      end_date,
      created_by: created_by || 'system'
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_financial_period_activity').insert({
    period_id: data.id,
    action: 'created',
    performed_by: created_by || 'system',
    details: { name, period_type, start_date, end_date }
  });

  res.json(data);
}));

// ============================================================
// UPDATE PERIOD
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, updated_by } = req.body;

  // Check if locked
  const { data: existing } = await supabase
    .from('v2_financial_periods')
    .select('is_locked, status')
    .eq('id', id)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Period not found' });
  }

  if (existing.is_locked) {
    throw new AppError('LOCKED_ERROR', 'Cannot modify locked period');
  }

  const updates = {};
  if (name !== undefined) updates.name = name;

  const { data, error } = await supabase
    .from('v2_financial_periods')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await supabase.from('v2_financial_period_activity').insert({
    period_id: id,
    action: 'updated',
    performed_by: updated_by || 'system',
    details: updates
  });

  res.json(data);
}));

// ============================================================
// CLOSE PERIOD
// ============================================================

router.patch('/:id/close', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { closed_by } = req.body;

  const { data: existing } = await supabase
    .from('v2_financial_periods')
    .select('status, is_locked')
    .eq('id', id)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Period not found' });
  }

  if (existing.status === 'closed') {
    throw new AppError('INVALID_STATE', 'Period is already closed');
  }

  // Calculate totals before closing
  const { data: expenses } = await supabase
    .from('v2_expenses')
    .select('amount')
    .eq('period_id', id)
    .is('deleted_at', null);

  const total_expenses = expenses?.reduce((sum, e) => sum + parseFloat(e.amount), 0) || 0;
  const expense_count = expenses?.length || 0;

  const { data, error } = await supabase
    .from('v2_financial_periods')
    .update({
      status: 'closed',
      is_locked: true,
      total_expenses,
      expense_count,
      closed_by: closed_by || 'system',
      closed_at: new Date().toISOString(),
      locked_by: closed_by || 'system',
      locked_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await supabase.from('v2_financial_period_activity').insert({
    period_id: id,
    action: 'closed',
    performed_by: closed_by || 'system',
    details: { total_expenses, expense_count }
  });

  res.json(data);
}));

// ============================================================
// REOPEN PERIOD
// ============================================================

router.patch('/:id/reopen', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reopened_by } = req.body;

  const { data: existing } = await supabase
    .from('v2_financial_periods')
    .select('status')
    .eq('id', id)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Period not found' });
  }

  if (existing.status === 'open') {
    throw new AppError('INVALID_STATE', 'Period is already open');
  }

  const { data, error } = await supabase
    .from('v2_financial_periods')
    .update({
      status: 'open',
      is_locked: false,
      closed_by: null,
      closed_at: null,
      locked_by: null,
      locked_at: null
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await supabase.from('v2_financial_period_activity').insert({
    period_id: id,
    action: 'reopened',
    performed_by: reopened_by || 'system',
    details: {}
  });

  res.json(data);
}));

// ============================================================
// DELETE PERIOD (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check for linked expenses
  const { count } = await supabase
    .from('v2_expenses')
    .select('id', { count: 'exact', head: true })
    .eq('period_id', id)
    .is('deleted_at', null);

  if (count > 0) {
    throw new AppError('VALIDATION_FAILED',
      `Cannot delete period with ${count} linked expenses`);
  }

  const { error } = await supabase
    .from('v2_financial_periods')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true });
}));

module.exports = router;
