/**
 * Timesheet Routes
 * Digital timesheet entry, submission, and approval
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// TIMESHEET ENTRIES
// ============================================================

// List timesheets with filters
router.get('/', asyncHandler(async (req, res) => {
  const { employee_id, job_id, status, start_date, end_date, period_id } = req.query;

  let query = supabase
    .from('v2_timesheets')
    .select(`
      *,
      employee:v2_employees(id, first_name, last_name),
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .is('deleted_at', null)
    .order('work_date', { ascending: false });

  if (employee_id) query = query.eq('employee_id', employee_id);
  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (period_id) query = query.eq('period_id', period_id);
  if (start_date) query = query.gte('work_date', start_date);
  if (end_date) query = query.lte('work_date', end_date);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get single timesheet
router.get('/:id', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_timesheets')
    .select(`
      *,
      employee:v2_employees(id, first_name, last_name, pay_rate, pay_type),
      job:v2_jobs(id, name),
      cost_code:v2_cost_codes(id, code, name),
      period:v2_financial_periods(id, name, status)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Timesheet not found' });
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data);
}));

// Create timesheet entry
router.post('/', asyncHandler(async (req, res) => {
  const {
    employee_id, job_id, work_date, hours, overtime_hours,
    work_type, cost_code_id, description, notes
  } = req.body;

  if (!employee_id || !job_id || !work_date || !hours) {
    throw new AppError('VALIDATION_FAILED', 'employee_id, job_id, work_date, and hours are required');
  }

  // Validate the entry
  const { data: validation } = await supabase
    .rpc('validate_timesheet_entry', {
      p_employee_id: employee_id,
      p_work_date: work_date,
      p_hours: hours
    });

  if (validation && !validation[0].is_valid) {
    throw new AppError('VALIDATION_FAILED', validation[0].errors.join(', '));
  }

  const { data, error } = await supabase
    .from('v2_timesheets')
    .insert({
      employee_id, job_id, work_date, hours,
      overtime_hours: overtime_hours || 0,
      work_type: work_type || 'regular',
      cost_code_id, description, notes,
      status: 'draft'
    })
    .select(`
      *,
      employee:v2_employees(id, first_name, last_name),
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_timesheet_activity').insert({
    timesheet_id: data.id,
    action: 'created',
    details: { hours, job_id }
  });

  res.json(data);
}));

// Update timesheet entry
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    job_id, work_date, hours, overtime_hours,
    work_type, cost_code_id, description, notes
  } = req.body;

  // Check if timesheet can be edited
  const { data: existing } = await supabase
    .from('v2_timesheets')
    .select('status, submitted_at')
    .eq('id', id)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }

  // Get edit window setting
  const { data: settings } = await supabase
    .from('v2_company_settings')
    .select('value')
    .eq('key', 'timesheet_edit_window')
    .single();

  const editWindowDays = parseInt(settings?.value || '2');

  if (existing.status === 'approved') {
    throw new AppError('VALIDATION_FAILED', 'Cannot edit approved timesheets');
  }

  if (existing.status === 'submitted' && existing.submitted_at) {
    const submittedDate = new Date(existing.submitted_at);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - editWindowDays);

    if (submittedDate < cutoffDate) {
      throw new AppError('VALIDATION_FAILED', `Edit window of ${editWindowDays} days has passed`);
    }
  }

  const updates = {};
  if (job_id !== undefined) updates.job_id = job_id;
  if (work_date !== undefined) updates.work_date = work_date;
  if (hours !== undefined) updates.hours = hours;
  if (overtime_hours !== undefined) updates.overtime_hours = overtime_hours;
  if (work_type !== undefined) updates.work_type = work_type;
  if (cost_code_id !== undefined) updates.cost_code_id = cost_code_id;
  if (description !== undefined) updates.description = description;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase
    .from('v2_timesheets')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      employee:v2_employees(id, first_name, last_name),
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_timesheet_activity').insert({
    timesheet_id: id,
    action: 'updated',
    details: updates
  });

  res.json(data);
}));

// Delete timesheet (soft delete)
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if timesheet can be deleted
  const { data: existing } = await supabase
    .from('v2_timesheets')
    .select('status')
    .eq('id', id)
    .single();

  if (existing?.status === 'approved') {
    throw new AppError('VALIDATION_FAILED', 'Cannot delete approved timesheets');
  }

  const { error } = await supabase
    .from('v2_timesheets')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// SUBMISSION & APPROVAL
// ============================================================

// Submit timesheet for approval
router.post('/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: existing } = await supabase
    .from('v2_timesheets')
    .select('status')
    .eq('id', id)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }

  if (existing.status !== 'draft' && existing.status !== 'rejected') {
    throw new AppError('VALIDATION_FAILED', 'Only draft or rejected timesheets can be submitted');
  }

  const { data, error } = await supabase
    .from('v2_timesheets')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_timesheet_activity').insert({
    timesheet_id: id,
    action: 'submitted'
  });

  res.json(data);
}));

// Approve timesheet
router.post('/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  const { data: existing } = await supabase
    .from('v2_timesheets')
    .select('status')
    .eq('id', id)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }

  if (existing.status !== 'submitted') {
    throw new AppError('VALIDATION_FAILED', 'Only submitted timesheets can be approved');
  }

  const { data, error } = await supabase
    .from('v2_timesheets')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approved_by || 'admin'
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_timesheet_activity').insert({
    timesheet_id: id,
    action: 'approved',
    actor: approved_by
  });

  res.json(data);
}));

// Reject timesheet
router.post('/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejected_by, reason } = req.body;

  const { data: existing } = await supabase
    .from('v2_timesheets')
    .select('status')
    .eq('id', id)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Timesheet not found' });
  }

  if (existing.status !== 'submitted') {
    throw new AppError('VALIDATION_FAILED', 'Only submitted timesheets can be rejected');
  }

  const { data, error } = await supabase
    .from('v2_timesheets')
    .update({
      status: 'rejected',
      rejection_reason: reason
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_timesheet_activity').insert({
    timesheet_id: id,
    action: 'rejected',
    actor: rejected_by,
    details: { reason }
  });

  res.json(data);
}));

// Bulk submit timesheets
router.post('/bulk-submit', asyncHandler(async (req, res) => {
  const { timesheet_ids } = req.body;

  if (!timesheet_ids || !Array.isArray(timesheet_ids)) {
    throw new AppError('VALIDATION_FAILED', 'timesheet_ids array required');
  }

  const { data, error } = await supabase
    .from('v2_timesheets')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })
    .in('id', timesheet_ids)
    .in('status', ['draft', 'rejected'])
    .select();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity for each
  const activities = data.map(t => ({
    timesheet_id: t.id,
    action: 'submitted'
  }));
  await supabase.from('v2_timesheet_activity').insert(activities);

  res.json({ submitted: data.length });
}));

// Bulk approve timesheets
router.post('/bulk-approve', asyncHandler(async (req, res) => {
  const { timesheet_ids, approved_by } = req.body;

  if (!timesheet_ids || !Array.isArray(timesheet_ids)) {
    throw new AppError('VALIDATION_FAILED', 'timesheet_ids array required');
  }

  const { data, error } = await supabase
    .from('v2_timesheets')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approved_by || 'admin'
    })
    .in('id', timesheet_ids)
    .eq('status', 'submitted')
    .select();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity for each
  const activities = data.map(t => ({
    timesheet_id: t.id,
    action: 'approved',
    actor: approved_by
  }));
  await supabase.from('v2_timesheet_activity').insert(activities);

  res.json({ approved: data.length });
}));

// ============================================================
// BATCHES
// ============================================================

// Get batches for employee
router.get('/batches/list', asyncHandler(async (req, res) => {
  const { employee_id, status } = req.query;

  let query = supabase
    .from('v2_timesheet_batches')
    .select(`
      *,
      employee:v2_employees(id, first_name, last_name)
    `)
    .order('week_start', { ascending: false });

  if (employee_id) query = query.eq('employee_id', employee_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Create or get batch for week
router.post('/batches', asyncHandler(async (req, res) => {
  const { employee_id, week_start } = req.body;

  if (!employee_id || !week_start) {
    throw new AppError('VALIDATION_FAILED', 'employee_id and week_start required');
  }

  // Calculate week end (6 days after start)
  const weekStartDate = new Date(week_start);
  const weekEndDate = new Date(weekStartDate);
  weekEndDate.setDate(weekEndDate.getDate() + 6);
  const weekEnd = weekEndDate.toISOString().split('T')[0];

  // Try to get existing batch
  const { data: existing } = await supabase
    .from('v2_timesheet_batches')
    .select('*')
    .eq('employee_id', employee_id)
    .eq('week_start', week_start)
    .single();

  if (existing) {
    return res.json(existing);
  }

  // Create new batch
  const { data, error } = await supabase
    .from('v2_timesheet_batches')
    .insert({
      employee_id,
      week_start,
      week_end: weekEnd
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Submit batch
router.post('/batches/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get batch details
  const { data: batch } = await supabase
    .from('v2_timesheet_batches')
    .select('*')
    .eq('id', id)
    .single();

  if (!batch) {
    return res.status(404).json({ error: 'Batch not found' });
  }

  // Submit all draft timesheets in batch range
  await supabase
    .from('v2_timesheets')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })
    .eq('employee_id', batch.employee_id)
    .gte('work_date', batch.week_start)
    .lte('work_date', batch.week_end)
    .in('status', ['draft', 'rejected']);

  // Update batch status
  const { data, error } = await supabase
    .from('v2_timesheet_batches')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_timesheet_activity').insert({
    batch_id: id,
    action: 'submitted'
  });

  res.json(data);
}));

// ============================================================
// REPORTS & SUMMARIES
// ============================================================

// Labor hours by job
router.get('/reports/by-job', asyncHandler(async (req, res) => {
  const { start_date, end_date, status } = req.query;

  let query = supabase
    .from('v2_timesheets')
    .select(`
      job_id,
      job:v2_jobs(id, name),
      hours,
      overtime_hours,
      base_cost,
      burden_amount,
      total_cost
    `)
    .is('deleted_at', null);

  if (status) query = query.eq('status', status);
  if (start_date) query = query.gte('work_date', start_date);
  if (end_date) query = query.lte('work_date', end_date);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Aggregate by job
  const jobSummary = {};
  data.forEach(t => {
    if (!jobSummary[t.job_id]) {
      jobSummary[t.job_id] = {
        job_id: t.job_id,
        job_name: t.job?.name,
        total_hours: 0,
        overtime_hours: 0,
        base_cost: 0,
        burden_amount: 0,
        total_cost: 0
      };
    }
    jobSummary[t.job_id].total_hours += parseFloat(t.hours) || 0;
    jobSummary[t.job_id].overtime_hours += parseFloat(t.overtime_hours) || 0;
    jobSummary[t.job_id].base_cost += parseFloat(t.base_cost) || 0;
    jobSummary[t.job_id].burden_amount += parseFloat(t.burden_amount) || 0;
    jobSummary[t.job_id].total_cost += parseFloat(t.total_cost) || 0;
  });

  res.json(Object.values(jobSummary));
}));

// Labor hours by employee
router.get('/reports/by-employee', asyncHandler(async (req, res) => {
  const { start_date, end_date, status } = req.query;

  let query = supabase
    .from('v2_timesheets')
    .select(`
      employee_id,
      employee:v2_employees(id, first_name, last_name),
      hours,
      overtime_hours,
      base_cost,
      burden_amount,
      total_cost
    `)
    .is('deleted_at', null);

  if (status) query = query.eq('status', status);
  if (start_date) query = query.gte('work_date', start_date);
  if (end_date) query = query.lte('work_date', end_date);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Aggregate by employee
  const empSummary = {};
  data.forEach(t => {
    if (!empSummary[t.employee_id]) {
      empSummary[t.employee_id] = {
        employee_id: t.employee_id,
        employee_name: t.employee ? `${t.employee.first_name} ${t.employee.last_name}` : 'Unknown',
        total_hours: 0,
        overtime_hours: 0,
        base_cost: 0,
        burden_amount: 0,
        total_cost: 0
      };
    }
    empSummary[t.employee_id].total_hours += parseFloat(t.hours) || 0;
    empSummary[t.employee_id].overtime_hours += parseFloat(t.overtime_hours) || 0;
    empSummary[t.employee_id].base_cost += parseFloat(t.base_cost) || 0;
    empSummary[t.employee_id].burden_amount += parseFloat(t.burden_amount) || 0;
    empSummary[t.employee_id].total_cost += parseFloat(t.total_cost) || 0;
  });

  res.json(Object.values(empSummary));
}));

// Labor hours by period
router.get('/reports/by-period', asyncHandler(async (req, res) => {
  const { status } = req.query;

  let query = supabase
    .from('v2_timesheets')
    .select(`
      period_id,
      period:v2_financial_periods(id, name, start_date, end_date),
      hours,
      overtime_hours,
      base_cost,
      burden_amount,
      total_cost
    `)
    .is('deleted_at', null)
    .not('period_id', 'is', null);

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Aggregate by period
  const periodSummary = {};
  data.forEach(t => {
    if (!periodSummary[t.period_id]) {
      periodSummary[t.period_id] = {
        period_id: t.period_id,
        period_name: t.period?.name,
        start_date: t.period?.start_date,
        end_date: t.period?.end_date,
        total_hours: 0,
        overtime_hours: 0,
        base_cost: 0,
        burden_amount: 0,
        total_cost: 0
      };
    }
    periodSummary[t.period_id].total_hours += parseFloat(t.hours) || 0;
    periodSummary[t.period_id].overtime_hours += parseFloat(t.overtime_hours) || 0;
    periodSummary[t.period_id].base_cost += parseFloat(t.base_cost) || 0;
    periodSummary[t.period_id].burden_amount += parseFloat(t.burden_amount) || 0;
    periodSummary[t.period_id].total_cost += parseFloat(t.total_cost) || 0;
  });

  res.json(Object.values(periodSummary));
}));

// Pending approval count
router.get('/pending-count', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_timesheets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'submitted')
    .is('deleted_at', null);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ pending: data });
}));

module.exports = router;
