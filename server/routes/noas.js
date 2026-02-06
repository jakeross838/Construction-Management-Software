/**
 * NOAs (Notice of Acceptance) API Routes
 * Manages Florida Building Code product approvals
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { getUserName } = require('../utils/shared');

const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

router.get('/', asyncHandler(async (req, res) => {
  const { job_id, product_type, status, approval_type, expiring_soon } = req.query;
  let query = supabase.from('v2_noas').select('*, job:v2_jobs(id, name)').is('deleted_at', null).order('created_at', { ascending: false });
  if (job_id) query = query.eq('job_id', job_id);
  if (product_type) query = query.eq('product_type', product_type);
  if (status) query = query.eq('status', status);
  if (approval_type) query = query.eq('approval_type', approval_type);
  if (expiring_soon === 'true') {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 90);
    query = query.eq('status', 'active').lte('expiration_date', futureDate.toISOString().split('T')[0]);
  }
  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;
  let query = supabase.from('v2_noas').select('status, expiration_date, product_type').is('deleted_at', null);
  if (job_id) query = query.eq('job_id', job_id);
  const { data, error } = await query;
  if (error) throw error;
  const today = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);
  const stats = { total: data?.length || 0, active: 0, expiring_soon: 0, expired: 0, superseded: 0, by_type: {} };
  (data || []).forEach(n => {
    if (stats[n.status] !== undefined) stats[n.status]++;
    if (n.status === 'active' && new Date(n.expiration_date) <= ninetyDaysFromNow) stats.expiring_soon++;
    stats.by_type[n.product_type] = (stats.by_type[n.product_type] || 0) + 1;
  });
  res.json(stats);
}));

router.get('/search', asyncHandler(async (req, res) => {
  const { q, fl_number } = req.query;
  const searchTerm = q || fl_number;
  if (!searchTerm) return res.status(400).json({ error: 'Search term required' });
  const { data, error } = await supabase.from('v2_noas').select('*, job:v2_jobs(id, name)').is('deleted_at', null).or('fl_approval_number.ilike.%' + searchTerm + '%,product_name.ilike.%' + searchTerm + '%,manufacturer.ilike.%' + searchTerm + '%').limit(50);
  if (error) throw error;
  res.json(data);
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data: noa, error: noaError } = await supabase.from('v2_noas').select('*, job:v2_jobs(id, name)').eq('id', id).is('deleted_at', null).single();
  if (noaError) throw noaError;
  if (!noa) return res.status(404).json({ error: 'NOA not found' });
  const { data: usages } = await supabase.from('v2_noa_usages').select('*, job:v2_jobs(id, name)').eq('noa_id', id).order('created_at', { ascending: false });
  res.json({ ...noa, usages: usages || [] });
}));

router.post('/', asyncHandler(async (req, res) => {
  const { job_id, product_name, product_type, manufacturer, model_number, fl_approval_number, approval_type, issue_date, expiration_date, wind_speed_rating, impact_rated, energy_rated, fire_rating, design_pressure, water_resistance, air_infiltration, document_url, document_name, notes, internal_notes } = req.body;
  if (!product_name || !product_type || !fl_approval_number) return res.status(400).json({ error: 'Product name, type, and FL approval number are required' });
  let status = 'active';
  if (expiration_date) {
    const expDate = new Date(expiration_date);
    const today = new Date();
    const ninetyDays = new Date();
    ninetyDays.setDate(today.getDate() + 90);
    if (expDate < today) status = 'expired';
    else if (expDate <= ninetyDays) status = 'expiring_soon';
  }
  const { data, error } = await supabase.from('v2_noas').insert({ job_id, product_name, product_type, manufacturer, model_number, fl_approval_number, approval_type: approval_type || 'state', issue_date, expiration_date, wind_speed_rating, impact_rated: impact_rated || false, energy_rated: energy_rated || false, fire_rating, design_pressure, water_resistance, air_infiltration, document_url, document_name, status, notes, internal_notes, created_by: getUserName(req) }).select('*, job:v2_jobs(id, name)').single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  delete updates.id; delete updates.created_at;
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('v2_noas').update(updates).eq('id', id).is('deleted_at', null).select('*, job:v2_jobs(id, name)').single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'NOA not found' });
  res.json(data);
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { data, error } = await supabase.from('v2_noas').update({ deleted_at: new Date().toISOString() }).eq('id', id).is('deleted_at', null).select().single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'NOA not found' });
  res.json({ success: true, message: 'NOA deleted' });
}));

router.post('/:id/usages', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { job_id, location_description, quantity, notes } = req.body;
  if (!job_id) return res.status(400).json({ error: 'Job ID is required' });
  const { data, error } = await supabase.from('v2_noa_usages').insert({ noa_id: id, job_id, location_description, quantity, notes }).select('*, job:v2_jobs(id, name)').single();
  if (error) throw error;
  res.status(201).json(data);
}));

router.patch('/:noaId/usages/:usageId', asyncHandler(async (req, res) => {
  const { usageId } = req.params;
  const updates = req.body;
  delete updates.id; delete updates.noa_id; delete updates.created_at;
  const { data, error } = await supabase.from('v2_noa_usages').update(updates).eq('id', usageId).select('*, job:v2_jobs(id, name)').single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'NOA usage not found' });
  res.json(data);
}));

router.post('/:noaId/usages/:usageId/verify', asyncHandler(async (req, res) => {
  const { usageId } = req.params;
  const { verified_by } = req.body;
  const { data, error } = await supabase.from('v2_noa_usages').update({ verified_at: new Date().toISOString(), verified_by: getUserName(req) }).eq('id', usageId).select('*, job:v2_jobs(id, name)').single();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: 'NOA usage not found' });
  res.json(data);
}));

router.delete('/:noaId/usages/:usageId', asyncHandler(async (req, res) => {
  const { usageId } = req.params;
  const { error } = await supabase.from('v2_noa_usages').delete().eq('id', usageId);
  if (error) throw error;
  res.json({ success: true, message: 'NOA usage deleted' });
}));

module.exports = router;
