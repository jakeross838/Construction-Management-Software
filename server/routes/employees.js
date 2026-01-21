/**
 * Employee Routes
 * Employee management with burden class and rate configuration
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// BURDEN CLASSES
// ============================================================

// List burden classes
router.get('/burden-classes', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_burden_classes')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get single burden class
router.get('/burden-classes/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_burden_classes')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Burden class not found' });
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data);
}));

// Create burden class
router.post('/burden-classes', asyncHandler(async (req, res) => {
  const {
    name, description, fica_rate, futa_rate, suta_rate,
    workers_comp_rate, health_insurance_rate, retirement_rate,
    pto_rate, other_rate, is_default
  } = req.body;

  if (!name) {
    throw new AppError('VALIDATION_FAILED', 'name is required');
  }

  const { data, error } = await supabase
    .from('v2_burden_classes')
    .insert({
      name, description, fica_rate, futa_rate, suta_rate,
      workers_comp_rate, health_insurance_rate, retirement_rate,
      pto_rate, other_rate, is_default
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Update burden class
router.patch('/burden-classes/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name, description, fica_rate, futa_rate, suta_rate,
    workers_comp_rate, health_insurance_rate, retirement_rate,
    pto_rate, other_rate, is_default, is_active
  } = req.body;

  // Get old rate for history
  const { data: oldClass } = await supabase
    .from('v2_burden_classes')
    .select('total_burden_rate')
    .eq('id', id)
    .single();

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (fica_rate !== undefined) updates.fica_rate = fica_rate;
  if (futa_rate !== undefined) updates.futa_rate = futa_rate;
  if (suta_rate !== undefined) updates.suta_rate = suta_rate;
  if (workers_comp_rate !== undefined) updates.workers_comp_rate = workers_comp_rate;
  if (health_insurance_rate !== undefined) updates.health_insurance_rate = health_insurance_rate;
  if (retirement_rate !== undefined) updates.retirement_rate = retirement_rate;
  if (pto_rate !== undefined) updates.pto_rate = pto_rate;
  if (other_rate !== undefined) updates.other_rate = other_rate;
  if (is_default !== undefined) updates.is_default = is_default;
  if (is_active !== undefined) updates.is_active = is_active;

  const { data, error } = await supabase
    .from('v2_burden_classes')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Record history if rate changed
  if (oldClass && data.total_burden_rate !== oldClass.total_burden_rate) {
    await supabase.from('v2_burden_rate_history').insert({
      burden_class_id: id,
      previous_rate: oldClass.total_burden_rate,
      new_rate: data.total_burden_rate,
      effective_date: new Date().toISOString().split('T')[0],
      reason: 'Rate update',
      changed_by: req.body.updated_by || 'system'
    });
  }

  res.json(data);
}));

// ============================================================
// EMPLOYEES
// ============================================================

// List employees
router.get('/', asyncHandler(async (req, res) => {
  const { status, burden_class_id, department } = req.query;

  let query = supabase
    .from('v2_employees')
    .select(`
      *,
      burden_class:v2_burden_classes(id, name, total_burden_rate)
    `)
    .is('deleted_at', null)
    .order('last_name');

  if (status) query = query.eq('status', status);
  if (burden_class_id) query = query.eq('burden_class_id', burden_class_id);
  if (department) query = query.eq('department', department);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Add calculated burden rate to each employee
  const employeesWithRates = data.map(emp => ({
    ...emp,
    effective_burden_rate: emp.custom_burden_rate ||
      emp.burden_class?.total_burden_rate ||
      0.40
  }));

  res.json(employeesWithRates);
}));

// Get single employee
router.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_employees')
    .select(`
      *,
      burden_class:v2_burden_classes(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Get effective burden rate via RPC
  const { data: rateData } = await supabase
    .rpc('get_employee_burden_rate', { emp_id: req.params.id });

  res.json({
    ...data,
    effective_burden_rate: rateData || 0.40
  });
}));

// Create employee
router.post('/', asyncHandler(async (req, res) => {
  const {
    first_name, last_name, email, phone, employee_number,
    hire_date, role, burden_class_id, department,
    pay_type, pay_rate, custom_burden_rate,
    emergency_contact_name, emergency_contact_phone
  } = req.body;

  if (!first_name || !last_name) {
    throw new AppError('VALIDATION_FAILED', 'first_name and last_name are required');
  }

  const { data, error } = await supabase
    .from('v2_employees')
    .insert({
      first_name, last_name, email, phone, employee_number,
      hire_date, role, burden_class_id, department,
      pay_type: pay_type || 'hourly', pay_rate, custom_burden_rate,
      emergency_contact_name, emergency_contact_phone
    })
    .select(`
      *,
      burden_class:v2_burden_classes(id, name, total_burden_rate)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Update employee
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    first_name, last_name, email, phone, employee_number,
    hire_date, termination_date, status, role, burden_class_id,
    department, pay_type, pay_rate, custom_burden_rate,
    emergency_contact_name, emergency_contact_phone
  } = req.body;

  const updates = {};
  if (first_name !== undefined) updates.first_name = first_name;
  if (last_name !== undefined) updates.last_name = last_name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (employee_number !== undefined) updates.employee_number = employee_number;
  if (hire_date !== undefined) updates.hire_date = hire_date;
  if (termination_date !== undefined) updates.termination_date = termination_date;
  if (status !== undefined) updates.status = status;
  if (role !== undefined) updates.role = role;
  if (burden_class_id !== undefined) updates.burden_class_id = burden_class_id;
  if (department !== undefined) updates.department = department;
  if (pay_type !== undefined) updates.pay_type = pay_type;
  if (pay_rate !== undefined) updates.pay_rate = pay_rate;
  if (custom_burden_rate !== undefined) updates.custom_burden_rate = custom_burden_rate;
  if (emergency_contact_name !== undefined) updates.emergency_contact_name = emergency_contact_name;
  if (emergency_contact_phone !== undefined) updates.emergency_contact_phone = emergency_contact_phone;

  const { data, error } = await supabase
    .from('v2_employees')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      burden_class:v2_burden_classes(id, name, total_burden_rate)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Delete employee (soft delete)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_employees')
    .update({ deleted_at: new Date().toISOString(), status: 'terminated' })
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// COMPANY SETTINGS
// ============================================================

// Get company settings
router.get('/settings/all', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_company_settings')
    .select('*')
    .order('key');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Convert to object for easier use
  const settings = data.reduce((acc, s) => {
    let value = s.value;
    if (s.value_type === 'number') value = parseFloat(s.value);
    else if (s.value_type === 'boolean') value = s.value === 'true';
    else if (s.value_type === 'json') value = JSON.parse(s.value);
    acc[s.key] = value;
    return acc;
  }, {});

  res.json(settings);
}));

// Update company setting
router.patch('/settings/:key', asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value, updated_by } = req.body;

  const { data, error } = await supabase
    .from('v2_company_settings')
    .update({
      value: String(value),
      updated_at: new Date().toISOString(),
      updated_by: updated_by || 'system'
    })
    .eq('key', key)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// BURDEN CALCULATION
// ============================================================

// Calculate burdened cost for employee
router.post('/calculate-burden', asyncHandler(async (req, res) => {
  const { employee_id, base_wage, hours } = req.body;

  if (!base_wage) {
    throw new AppError('VALIDATION_FAILED', 'base_wage is required');
  }

  let burdenRate = 0.40; // Default

  if (employee_id) {
    const { data: rateData } = await supabase
      .rpc('get_employee_burden_rate', { emp_id: employee_id });
    if (rateData) burdenRate = rateData;
  }

  const totalWage = parseFloat(base_wage) * (hours || 1);
  const burdenAmount = totalWage * burdenRate;
  const burdenedCost = totalWage + burdenAmount;

  res.json({
    base_wage: parseFloat(base_wage),
    hours: hours || 1,
    total_base: totalWage,
    burden_rate: burdenRate,
    burden_amount: Math.round(burdenAmount * 100) / 100,
    burdened_cost: Math.round(burdenedCost * 100) / 100
  });
}));

// ============================================================
// BURDEN REVIEW REMINDERS
// ============================================================

// Get pending reviews
router.get('/burden-reviews', asyncHandler(async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('v2_burden_review_reminders')
    .select('*')
    .order('due_date');

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Complete a review
router.patch('/burden-reviews/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { completed_by, notes } = req.body;

  const { data, error } = await supabase
    .from('v2_burden_review_reminders')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by: completed_by || 'system',
      notes
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Create next quarterly review
  await supabase.rpc('create_burden_review_reminder');

  // Update company setting
  await supabase
    .from('v2_company_settings')
    .update({
      value: new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString()
    })
    .eq('key', 'last_burden_review');

  res.json(data);
}));

// Create review reminder manually
router.post('/burden-reviews', asyncHandler(async (req, res) => {
  const { review_type, due_date } = req.body;

  const { data, error } = await supabase
    .from('v2_burden_review_reminders')
    .insert({
      review_type: review_type || 'manual',
      due_date: due_date || new Date().toISOString().split('T')[0]
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

module.exports = router;
