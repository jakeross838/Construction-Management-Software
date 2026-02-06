/**
 * Budgets API Routes
 * Manages job budgets and budget line items
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { getUserName } = require('../utils/shared');
const { requireFinancialAccess } = require('../middleware/auth');

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, version } = req.query;
  let query = supabase.from('v2_budgets').select('*, job:v2_jobs(id, name)').is('deleted_at', null).order('created_at', { ascending: false });
  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (version) query = query.eq('version', version);
  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;
  let query = supabase.from('v2_budgets').select('status, total_budget, total_committed, total_actual').is('deleted_at', null);
  if (job_id) query = query.eq('job_id', job_id);
  const { data, error } = await query;
  if (error) throw error;
  const stats = { total: data?.length || 0, draft: 0, approved: 0, revised: 0, final: 0, total_budget: 0, total_committed: 0, total_actual: 0 };
  (data || []).forEach(b => {
    if (stats[b.status] !== undefined) stats[b.status]++;
    stats.total_budget += parseFloat(b.total_budget) || 0;
    stats.total_committed += parseFloat(b.total_committed) || 0;
    stats.total_actual += parseFloat(b.total_actual) || 0;
  });
  res.json(stats);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data: budget, error: budgetError } = await supabase.from('v2_budgets').select('*, job:v2_jobs(id, name)').eq('id', id).is('deleted_at', null).single();
  if (budgetError) throw budgetError;
  if (!budget) return res.status(404).json({ error: 'Budget not found' });
  const { data: lines } = await supabase.from('v2_budget_lines').select('*, cost_code:v2_cost_codes(id, code, name)').eq('budget_id', id).is('deleted_at', null).order('sort_order', { ascending: true });
  res.json({ ...budget, lines: lines || [] });
}));

router.post('/', requireFinancialAccess, asyncHandler(async (req, res) => {
  const { job_id, name, description, status, contingency_percent, notes } = req.body;
  if (!job_id) return res.status(400).json({ error: 'Job ID is required' });
  const { data: existing } = await supabase.from('v2_budgets').select('version').eq('job_id', job_id).is('deleted_at', null).order('version', { ascending: false }).limit(1);
  const nextVersion = (existing?.[0]?.version || 0) + 1;
  const { data, error } = await supabase.from('v2_budgets').insert({ job_id, name: name || 'Project Budget', description, version: nextVersion, status: status || 'draft', contingency_percent: contingency_percent || 5.00, notes, created_by: getUserName(req) }).select('*, job:v2_jobs(id, name)').single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.patch('/:id', requireFinancialAccess, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  delete updates.id; delete updates.created_at; delete updates.job_id; delete updates.version;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('v2_budgets').update(updates).eq('id', id).is('deleted_at', null).select('*, job:v2_jobs(id, name)').single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Budget not found' });
  res.json(data);
}));

router.delete('/:id', requireFinancialAccess, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('v2_budgets').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select().single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Budget not found' });
  res.json({ success: true, message: 'Budget deleted' });
}));

router.post('/:id/approve', requireFinancialAccess, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;
  const { data, error } = await supabase.from('v2_budgets').update({ status: 'approved', approved_by: getUserName(req), approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select('*, job:v2_jobs(id, name)').single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Budget not found' });
  res.json(data);
}));

router.get('/:id/lines', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('v2_budget_lines').select('*, cost_code:v2_cost_codes(id, code, name)').eq('budget_id', id).is('deleted_at', null).order('sort_order', { ascending: true });
  if (error) throw error;
  res.json(data || []);
}));

router.post('/:id/lines', requireFinancialAccess, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { cost_code_id, category, description, sort_order, original_amount, unit_of_measure, quantity, unit_cost, notes, is_allowance } = req.body;
  const { data, error } = await supabase.from('v2_budget_lines').insert({ budget_id: id, cost_code_id, category, description, sort_order: sort_order || 0, original_amount: original_amount || 0, revised_amount: original_amount || 0, unit_of_measure, quantity, unit_cost, notes, is_allowance: is_allowance || false }).select('*, cost_code:v2_cost_codes(id, code, name)').single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.patch('/:budgetId/lines/:lineId', requireFinancialAccess, asyncHandler(async (req, res) => {
  const { lineId } = req.params;
  const updates = req.body;
  delete updates.id; delete updates.budget_id; delete updates.created_at;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('v2_budget_lines').update(updates).eq('id', lineId).is('deleted_at', null).select('*, cost_code:v2_cost_codes(id, code, name)').single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Budget line not found' });
  res.json(data);
}));

router.delete('/:budgetId/lines/:lineId', requireFinancialAccess, asyncHandler(async (req, res) => {
  const { lineId } = req.params;
  const { data, error } = await supabase.from('v2_budget_lines').update({ deleted_at: new Date().toISOString() }).eq('id', lineId).is('deleted_at', null).select().single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'Budget line not found' });
  res.json({ success: true, message: 'Budget line deleted' });
}));

module.exports = router;
