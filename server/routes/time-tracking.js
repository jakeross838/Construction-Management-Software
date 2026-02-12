/**
 * Time Tracking Routes
 * Mobile clock in/out with GPS fence validation and overtime calculations
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Calculate distance between two GPS points using Haversine formula
 * @returns Distance in meters
 */
function calculateDistanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

/**
 * Check if a GPS point is within a geofence
 */
function isWithinGeofence(gpsLat, gpsLng, fenceLat, fenceLng, radiusMeters) {
  const distance = calculateDistanceMeters(gpsLat, gpsLng, fenceLat, fenceLng);
  return distance <= radiusMeters;
}

/**
 * Calculate total hours and overtime for a time entry
 */
function calculateHours(clockIn, clockOut, breakMinutes = 0) {
  if (!clockOut) {
    return { totalHours: 0, overtimeHours: 0 };
  }

  const startTime = new Date(clockIn);
  const endTime = new Date(clockOut);
  const workedMinutes = (endTime - startTime) / (1000 * 60) - breakMinutes;
  const totalHours = Math.round((workedMinutes / 60) * 100) / 100;

  // Daily overtime: hours over 8
  const overtimeHours = totalHours > 8 ? Math.round((totalHours - 8) * 100) / 100 : 0;

  return { totalHours, overtimeHours };
}

/**
 * Get weekly hours for an employee to calculate weekly overtime
 */
async function getWeeklyHours(employeeId, date, builderId) {
  // Get Monday of the week containing the date
  const d = new Date(date);
  const dayOfWeek = d.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(d);
  weekStart.setDate(d.getDate() + mondayOffset);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const { data, error } = await supabase
    .from('v2_time_entries')
    .select('total_hours')
    .eq('builder_id', builderId)
    .eq('employee_id', employeeId)
    .gte('date', weekStart.toISOString().split('T')[0])
    .lte('date', weekEnd.toISOString().split('T')[0])
    .is('deleted_at', null);

  if (error) return 0;

  return data.reduce((sum, entry) => sum + (parseFloat(entry.total_hours) || 0), 0);
}

/**
 * Calculate pay amounts
 */
function calculatePay(totalHours, overtimeHours, payRate) {
  if (!payRate) return { regularPay: null, overtimePay: null, totalPay: null };

  const regularHours = totalHours - overtimeHours;
  const regularPay = Math.round(regularHours * payRate * 100) / 100;
  const overtimePay = Math.round(overtimeHours * payRate * 1.5 * 100) / 100;
  const totalPay = Math.round((regularPay + overtimePay) * 100) / 100;

  return { regularPay, overtimePay, totalPay };
}

/**
 * Log time entry activity
 */
async function logActivity(timeEntryId, action, performedBy, details = {}, gpsLocation = null, builderId = null) {
  await supabase.from('v2_time_entry_activity').insert({
    builder_id: builderId,
    time_entry_id: timeEntryId,
    action,
    performed_by: performedBy,
    details,
    gps_location: gpsLocation
  });
}

// ============================================================
// TIME ENTRIES
// ============================================================

// List time entries with filters
router.get('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, user_id, employee_id, date_from, date_to, status } = req.query;

  let query = supabase
    .from('v2_time_entries')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      employee:v2_employees(id, first_name, last_name, hourly_rate),
      cost_code:v2_cost_codes(id, code, name),
      task:v2_tasks(id, name)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .order('date', { ascending: false })
    .order('clock_in', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (user_id) query = query.eq('user_id', user_id);
  if (employee_id) query = query.eq('employee_id', employee_id);
  if (status) query = query.eq('status', status);
  if (date_from) query = query.gte('date', date_from);
  if (date_to) query = query.lte('date', date_to);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get single time entry
router.get('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { data, error } = await supabase
    .from('v2_time_entries')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      employee:v2_employees(id, first_name, last_name, hourly_rate),
      cost_code:v2_cost_codes(id, code, name),
      task:v2_tasks(id, name)
    `)
    .eq('id', req.params.id)
    .eq('builder_id', builderId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Time entry not found' });
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data);
}));

// Clock in with GPS
router.post('/clock-in', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    job_id, employee_id, user_id,
    gps, cost_code_id, task_id, notes
  } = req.body;

  if (!job_id || !employee_id) {
    throw new AppError('VALIDATION_FAILED', 'job_id and employee_id are required');
  }

  // Check if already clocked in (has an entry without clock_out today)
  const today = new Date().toISOString().split('T')[0];
  const { data: existing } = await supabase
    .from('v2_time_entries')
    .select('id')
    .eq('builder_id', builderId)
    .eq('employee_id', employee_id)
    .eq('date', today)
    .is('clock_out', null)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    throw new AppError('VALIDATION_FAILED', 'Employee is already clocked in. Please clock out first.');
  }

  // Validate geofence if GPS provided
  let clockInGeofenceValid = null;
  if (gps && gps.lat && gps.lng) {
    const { data: geofences } = await supabase
      .from('v2_job_geofences')
      .select('*')
      .eq('job_id', job_id)
      .eq('builder_id', builderId)
      .eq('is_active', true);

    if (geofences && geofences.length > 0) {
      clockInGeofenceValid = geofences.some(fence =>
        isWithinGeofence(gps.lat, gps.lng, parseFloat(fence.center_lat), parseFloat(fence.center_lng), fence.radius_meters)
      );
    }
  }

  // Get employee pay rate
  const { data: employee } = await supabase
    .from('v2_employees')
    .select('hourly_rate')
    .eq('id', employee_id)
    .eq('builder_id', builderId)
    .single();

  const now = new Date();
  const { data, error } = await supabase
    .from('v2_time_entries')
    .insert({
      builder_id: builderId,
      job_id,
      employee_id,
      user_id,
      date: today,
      clock_in: now.toISOString(),
      gps_clock_in: gps ? { ...gps, timestamp: now.toISOString() } : null,
      clock_in_geofence_valid: clockInGeofenceValid,
      cost_code_id,
      task_id,
      notes,
      pay_rate: employee?.hourly_rate,
      status: 'pending'
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      employee:v2_employees(id, first_name, last_name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logActivity(data.id, 'clocked_in', employee_id, {
    geofence_valid: clockInGeofenceValid
  }, gps, builderId);

  res.json(data);
}));

// Clock out with GPS
router.post('/clock-out', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { employee_id, gps, break_minutes } = req.body;

  if (!employee_id) {
    throw new AppError('VALIDATION_FAILED', 'employee_id is required');
  }

  // Find open time entry
  const today = new Date().toISOString().split('T')[0];
  const { data: entry, error: findError } = await supabase
    .from('v2_time_entries')
    .select('*, job:v2_jobs(id, name)')
    .eq('builder_id', builderId)
    .eq('employee_id', employee_id)
    .is('clock_out', null)
    .is('deleted_at', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .single();

  if (findError || !entry) {
    return res.status(404).json({ error: 'No active clock-in found for this employee' });
  }

  // Validate geofence if GPS provided
  let clockOutGeofenceValid = null;
  if (gps && gps.lat && gps.lng) {
    const { data: geofences } = await supabase
      .from('v2_job_geofences')
      .select('*')
      .eq('job_id', entry.job_id)
      .eq('builder_id', builderId)
      .eq('is_active', true);

    if (geofences && geofences.length > 0) {
      clockOutGeofenceValid = geofences.some(fence =>
        isWithinGeofence(gps.lat, gps.lng, parseFloat(fence.center_lat), parseFloat(fence.center_lng), fence.radius_meters)
      );
    }
  }

  const now = new Date();
  const totalBreakMinutes = (entry.break_minutes || 0) + (break_minutes || 0);

  // Calculate hours
  const { totalHours, overtimeHours } = calculateHours(entry.clock_in, now, totalBreakMinutes);

  // Calculate pay
  const { regularPay, overtimePay, totalPay } = calculatePay(totalHours, overtimeHours, entry.pay_rate);

  const { data, error } = await supabase
    .from('v2_time_entries')
    .update({
      clock_out: now.toISOString(),
      gps_clock_out: gps ? { ...gps, timestamp: now.toISOString() } : null,
      clock_out_geofence_valid: clockOutGeofenceValid,
      break_minutes: totalBreakMinutes,
      total_hours: totalHours,
      overtime_hours: overtimeHours,
      regular_pay: regularPay,
      overtime_pay: overtimePay,
      total_pay: totalPay
    })
    .eq('id', entry.id)
    .eq('builder_id', builderId)
    .select(`
      *,
      job:v2_jobs(id, name),
      employee:v2_employees(id, first_name, last_name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logActivity(data.id, 'clocked_out', employee_id, {
    total_hours: totalHours,
    overtime_hours: overtimeHours,
    geofence_valid: clockOutGeofenceValid
  }, gps, builderId);

  res.json(data);
}));

// Manual time entry
router.post('/', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const {
    job_id, employee_id, user_id, date,
    clock_in, clock_out, break_minutes,
    cost_code_id, task_id, notes
  } = req.body;

  if (!job_id || !employee_id || !date || !clock_in) {
    throw new AppError('VALIDATION_FAILED', 'job_id, employee_id, date, and clock_in are required');
  }

  // Get employee pay rate
  const { data: employee } = await supabase
    .from('v2_employees')
    .select('hourly_rate')
    .eq('id', employee_id)
    .eq('builder_id', builderId)
    .single();

  // Calculate hours if clock_out provided
  let totalHours = null;
  let overtimeHours = null;
  let regularPay = null;
  let overtimePay = null;
  let totalPay = null;

  if (clock_out) {
    const hours = calculateHours(clock_in, clock_out, break_minutes || 0);
    totalHours = hours.totalHours;
    overtimeHours = hours.overtimeHours;

    const pay = calculatePay(totalHours, overtimeHours, employee?.hourly_rate);
    regularPay = pay.regularPay;
    overtimePay = pay.overtimePay;
    totalPay = pay.totalPay;
  }

  const { data, error } = await supabase
    .from('v2_time_entries')
    .insert({
      builder_id: builderId,
      job_id,
      employee_id,
      user_id,
      date,
      clock_in,
      clock_out,
      break_minutes: break_minutes || 0,
      total_hours: totalHours,
      overtime_hours: overtimeHours,
      cost_code_id,
      task_id,
      notes,
      pay_rate: employee?.hourly_rate,
      regular_pay: regularPay,
      overtime_pay: overtimePay,
      total_pay: totalPay,
      status: 'pending'
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      employee:v2_employees(id, first_name, last_name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logActivity(data.id, 'manual_entry', 'admin', {
    total_hours: totalHours
  }, null, builderId);

  res.json(data);
}));

// Update time entry
router.patch('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const {
    clock_in, clock_out, break_minutes,
    cost_code_id, task_id, notes, pay_rate
  } = req.body;

  // Get existing entry
  const { data: existing, error: fetchError } = await supabase
    .from('v2_time_entries')
    .select('*')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (fetchError || !existing) {
    return res.status(404).json({ error: 'Time entry not found' });
  }

  if (existing.status === 'approved') {
    throw new AppError('VALIDATION_FAILED', 'Cannot edit approved time entries');
  }

  const updates = {};
  if (clock_in !== undefined) updates.clock_in = clock_in;
  if (clock_out !== undefined) updates.clock_out = clock_out;
  if (break_minutes !== undefined) updates.break_minutes = break_minutes;
  if (cost_code_id !== undefined) updates.cost_code_id = cost_code_id;
  if (task_id !== undefined) updates.task_id = task_id;
  if (notes !== undefined) updates.notes = notes;
  if (pay_rate !== undefined) updates.pay_rate = pay_rate;

  // Recalculate hours if times changed
  const finalClockIn = updates.clock_in || existing.clock_in;
  const finalClockOut = updates.clock_out !== undefined ? updates.clock_out : existing.clock_out;
  const finalBreakMinutes = updates.break_minutes !== undefined ? updates.break_minutes : existing.break_minutes;
  const finalPayRate = updates.pay_rate !== undefined ? updates.pay_rate : existing.pay_rate;

  if (finalClockOut) {
    const { totalHours, overtimeHours } = calculateHours(finalClockIn, finalClockOut, finalBreakMinutes || 0);
    updates.total_hours = totalHours;
    updates.overtime_hours = overtimeHours;

    const { regularPay, overtimePay, totalPay } = calculatePay(totalHours, overtimeHours, finalPayRate);
    updates.regular_pay = regularPay;
    updates.overtime_pay = overtimePay;
    updates.total_pay = totalPay;
  }

  const { data, error } = await supabase
    .from('v2_time_entries')
    .update(updates)
    .eq('id', id)
    .eq('builder_id', builderId)
    .select(`
      *,
      job:v2_jobs(id, name),
      employee:v2_employees(id, first_name, last_name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logActivity(id, 'edited', 'admin', updates, null, builderId);

  res.json(data);
}));

// Approve time entry
router.patch('/:id/approve', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { approved_by } = req.body;

  const { data: existing } = await supabase
    .from('v2_time_entries')
    .select('status')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (!existing) {
    return res.status(404).json({ error: 'Time entry not found' });
  }

  if (existing.status === 'approved') {
    throw new AppError('VALIDATION_FAILED', 'Time entry is already approved');
  }

  const { data, error } = await supabase
    .from('v2_time_entries')
    .update({
      status: 'approved',
      approved_by: approved_by || 'admin',
      approved_at: new Date().toISOString()
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logActivity(id, 'approved', approved_by || 'admin', {}, null, builderId);

  res.json(data);
}));

// Reject time entry
router.patch('/:id/reject', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;
  const { rejected_by, reason } = req.body;

  const { data, error } = await supabase
    .from('v2_time_entries')
    .update({
      status: 'rejected',
      rejection_reason: reason
    })
    .eq('id', id)
    .eq('builder_id', builderId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await logActivity(id, 'rejected', rejected_by || 'admin', { reason }, null, builderId);

  res.json(data);
}));

// Delete time entry (soft delete)
router.delete('/:id', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { id } = req.params;

  const { data: existing } = await supabase
    .from('v2_time_entries')
    .select('status')
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (existing?.status === 'approved') {
    throw new AppError('VALIDATION_FAILED', 'Cannot delete approved time entries');
  }

  const { error } = await supabase
    .from('v2_time_entries')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true });
}));

// ============================================================
// SUMMARIES & REPORTS
// ============================================================

// Get hours summary by job and/or employee
router.get('/summary', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, employee_id, period, date_from, date_to } = req.query;

  // Determine date range based on period
  let startDate, endDate;
  const now = new Date();

  if (date_from && date_to) {
    startDate = date_from;
    endDate = date_to;
  } else if (period === 'week') {
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    startDate = monday.toISOString().split('T')[0];
    endDate = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  } else if (period === 'month') {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  } else if (period === 'year') {
    startDate = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
    endDate = new Date(now.getFullYear(), 11, 31).toISOString().split('T')[0];
  } else {
    // Default to current week
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    startDate = monday.toISOString().split('T')[0];
    endDate = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  let query = supabase
    .from('v2_time_entries')
    .select(`
      id,
      job_id,
      employee_id,
      date,
      total_hours,
      overtime_hours,
      regular_pay,
      overtime_pay,
      total_pay,
      status,
      job:v2_jobs(id, name),
      employee:v2_employees(id, first_name, last_name)
    `)
    .eq('builder_id', builderId)
    .is('deleted_at', null)
    .gte('date', startDate)
    .lte('date', endDate);

  if (job_id) query = query.eq('job_id', job_id);
  if (employee_id) query = query.eq('employee_id', employee_id);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Calculate summary
  const summary = {
    period: { start: startDate, end: endDate },
    entries: data.length,
    total_hours: 0,
    regular_hours: 0,
    overtime_hours: 0,
    total_pay: 0,
    regular_pay: 0,
    overtime_pay: 0,
    by_job: {},
    by_employee: {},
    by_date: {}
  };

  data.forEach(entry => {
    const hours = parseFloat(entry.total_hours) || 0;
    const ot = parseFloat(entry.overtime_hours) || 0;
    const regular = hours - ot;

    summary.total_hours += hours;
    summary.regular_hours += regular;
    summary.overtime_hours += ot;
    summary.total_pay += parseFloat(entry.total_pay) || 0;
    summary.regular_pay += parseFloat(entry.regular_pay) || 0;
    summary.overtime_pay += parseFloat(entry.overtime_pay) || 0;

    // By job
    if (!summary.by_job[entry.job_id]) {
      summary.by_job[entry.job_id] = {
        job_id: entry.job_id,
        job_name: entry.job?.name,
        total_hours: 0,
        overtime_hours: 0,
        total_pay: 0
      };
    }
    summary.by_job[entry.job_id].total_hours += hours;
    summary.by_job[entry.job_id].overtime_hours += ot;
    summary.by_job[entry.job_id].total_pay += parseFloat(entry.total_pay) || 0;

    // By employee
    if (!summary.by_employee[entry.employee_id]) {
      summary.by_employee[entry.employee_id] = {
        employee_id: entry.employee_id,
        employee_name: entry.employee ? `${entry.employee.first_name} ${entry.employee.last_name}` : 'Unknown',
        total_hours: 0,
        overtime_hours: 0,
        total_pay: 0
      };
    }
    summary.by_employee[entry.employee_id].total_hours += hours;
    summary.by_employee[entry.employee_id].overtime_hours += ot;
    summary.by_employee[entry.employee_id].total_pay += parseFloat(entry.total_pay) || 0;

    // By date
    if (!summary.by_date[entry.date]) {
      summary.by_date[entry.date] = { date: entry.date, total_hours: 0, overtime_hours: 0 };
    }
    summary.by_date[entry.date].total_hours += hours;
    summary.by_date[entry.date].overtime_hours += ot;
  });

  // Convert objects to arrays
  summary.by_job = Object.values(summary.by_job);
  summary.by_employee = Object.values(summary.by_employee);
  summary.by_date = Object.values(summary.by_date).sort((a, b) => a.date.localeCompare(b.date));

  res.json(summary);
}));

// Certified payroll report
router.get('/certified-payroll', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { job_id, date_from, date_to } = req.query;

  if (!job_id || !date_from || !date_to) {
    throw new AppError('VALIDATION_FAILED', 'job_id, date_from, and date_to are required');
  }

  const { data, error } = await supabase
    .from('v2_time_entries')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      employee:v2_employees(id, first_name, last_name, hourly_rate),
      cost_code:v2_cost_codes(id, code, name)
    `)
    .eq('builder_id', builderId)
    .eq('job_id', job_id)
    .eq('status', 'approved')
    .gte('date', date_from)
    .lte('date', date_to)
    .is('deleted_at', null)
    .order('date')
    .order('employee_id');

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Group by employee for report
  const reportData = {};
  data.forEach(entry => {
    if (!reportData[entry.employee_id]) {
      reportData[entry.employee_id] = {
        employee_id: entry.employee_id,
        employee: entry.employee,
        entries: [],
        total_regular_hours: 0,
        total_overtime_hours: 0,
        total_hours: 0,
        total_regular_pay: 0,
        total_overtime_pay: 0,
        total_gross_pay: 0
      };
    }

    const hours = parseFloat(entry.total_hours) || 0;
    const ot = parseFloat(entry.overtime_hours) || 0;

    reportData[entry.employee_id].entries.push(entry);
    reportData[entry.employee_id].total_hours += hours;
    reportData[entry.employee_id].total_regular_hours += hours - ot;
    reportData[entry.employee_id].total_overtime_hours += ot;
    reportData[entry.employee_id].total_regular_pay += parseFloat(entry.regular_pay) || 0;
    reportData[entry.employee_id].total_overtime_pay += parseFloat(entry.overtime_pay) || 0;
    reportData[entry.employee_id].total_gross_pay += parseFloat(entry.total_pay) || 0;
  });

  res.json({
    job_id,
    period: { start: date_from, end: date_to },
    employees: Object.values(reportData),
    totals: {
      entries: data.length,
      employees: Object.keys(reportData).length,
      total_hours: Object.values(reportData).reduce((sum, e) => sum + e.total_hours, 0),
      total_regular_hours: Object.values(reportData).reduce((sum, e) => sum + e.total_regular_hours, 0),
      total_overtime_hours: Object.values(reportData).reduce((sum, e) => sum + e.total_overtime_hours, 0),
      total_gross_pay: Object.values(reportData).reduce((sum, e) => sum + e.total_gross_pay, 0)
    }
  });
}));

// ============================================================
// GEOFENCES
// ============================================================

// Get job geofence(s)
router.get('/geofence/:jobId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { data, error } = await supabase
    .from('v2_job_geofences')
    .select('*')
    .eq('builder_id', builderId)
    .eq('job_id', req.params.jobId)
    .eq('is_active', true)
    .order('created_at');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Set/update job geofence
router.post('/geofence/:jobId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { jobId } = req.params;
  const { center_lat, center_lng, radius_meters, name } = req.body;

  if (!center_lat || !center_lng) {
    throw new AppError('VALIDATION_FAILED', 'center_lat and center_lng are required');
  }

  // Check if geofence already exists
  const { data: existing } = await supabase
    .from('v2_job_geofences')
    .select('id')
    .eq('builder_id', builderId)
    .eq('job_id', jobId)
    .eq('is_active', true)
    .maybeSingle();

  let data, error;

  if (existing) {
    // Update existing
    ({ data, error } = await supabase
      .from('v2_job_geofences')
      .update({
        center_lat,
        center_lng,
        radius_meters: radius_meters || 150,
        name: name || 'Job Site'
      })
      .eq('id', existing.id)
      .eq('builder_id', builderId)
      .select()
      .single());
  } else {
    // Create new
    ({ data, error } = await supabase
      .from('v2_job_geofences')
      .insert({
        builder_id: builderId,
        job_id: jobId,
        center_lat,
        center_lng,
        radius_meters: radius_meters || 150,
        name: name || 'Job Site'
      })
      .select()
      .single());
  }

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Delete geofence
router.delete('/geofence/:jobId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { error } = await supabase
    .from('v2_job_geofences')
    .update({ is_active: false })
    .eq('job_id', req.params.jobId)
    .eq('builder_id', builderId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// BULK OPERATIONS
// ============================================================

// Bulk approve time entries
router.post('/bulk-approve', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { entry_ids, approved_by } = req.body;

  if (!entry_ids || !Array.isArray(entry_ids) || entry_ids.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'entry_ids array is required');
  }

  const { data, error } = await supabase
    .from('v2_time_entries')
    .update({
      status: 'approved',
      approved_by: approved_by || 'admin',
      approved_at: new Date().toISOString()
    })
    .in('id', entry_ids)
    .eq('builder_id', builderId)
    .eq('status', 'pending')
    .select();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activities
  const activities = data.map(entry => ({
    builder_id: builderId,
    time_entry_id: entry.id,
    action: 'approved',
    performed_by: approved_by || 'admin'
  }));
  await supabase.from('v2_time_entry_activity').insert(activities);

  res.json({ approved: data.length });
}));

// Get current clock-in status for employee
router.get('/status/:employeeId', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const { data, error } = await supabase
    .from('v2_time_entries')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('builder_id', builderId)
    .eq('employee_id', req.params.employeeId)
    .is('clock_out', null)
    .is('deleted_at', null)
    .order('clock_in', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({
    clocked_in: !!data,
    active_entry: data
  });
}));

module.exports = router;
