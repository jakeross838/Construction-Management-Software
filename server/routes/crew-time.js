/**
 * Crew Time Routes
 * Time tracking integration for daily logs
 * Tracks individual worker time entries linked to daily log crew entries
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const { asyncHandler, AppError } = require('../core/errors');

// ============================================================
// GET TIME ENTRIES FOR A DAILY LOG
// ============================================================

// Get all time entries for a daily log
router.get('/:dailyLogId/crew-time', asyncHandler(async (req, res) => {
  const { dailyLogId } = req.params;
  const { status, worker_id } = req.query;

  // Verify daily log exists
  const { data: log, error: logError } = await supabase
    .from('v2_daily_logs')
    .select('id, job_id, log_date')
    .eq('id', dailyLogId)
    .is('deleted_at', null)
    .single();

  if (logError || !log) {
    throw new AppError('Daily log not found', 404);
  }

  // Build query
  let query = supabase
    .from('v2_daily_log_time_entries')
    .select(`
      *,
      crew_entry:v2_daily_log_crew(
        id, vendor_id, trade, notes,
        vendor:v2_vendors(id, name)
      )
    `)
    .eq('daily_log_id', dailyLogId)
    .order('clock_in', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }
  if (worker_id) {
    query = query.eq('worker_id', worker_id);
  }

  const { data: entries, error } = await query;

  if (error) throw error;

  // Calculate totals
  const totalHours = entries?.reduce((sum, e) => sum + (e.total_hours || 0), 0) || 0;
  const activeCount = entries?.filter(e => e.status === 'active' && !e.clock_out).length || 0;

  res.json({
    daily_log_id: dailyLogId,
    log_date: log.log_date,
    entries: entries || [],
    summary: {
      total_entries: entries?.length || 0,
      total_hours: totalHours,
      active_count: activeCount,
      completed_count: entries?.filter(e => e.status === 'completed').length || 0
    }
  });
}));

// ============================================================
// CREATE TIME ENTRY (CLOCK IN)
// ============================================================

router.post('/:dailyLogId/crew-time', asyncHandler(async (req, res) => {
  const { dailyLogId } = req.params;
  const {
    worker_name,
    worker_id,
    crew_entry_id,
    clock_in,
    trade,
    work_area,
    task_description,
    clock_in_location,
    notes
  } = req.body;

  // Validate required fields
  if (!worker_name) {
    throw new AppError('worker_name is required', 400);
  }

  // Verify daily log exists and is not completed
  const { data: log, error: logError } = await supabase
    .from('v2_daily_logs')
    .select('id, status, job_id')
    .eq('id', dailyLogId)
    .is('deleted_at', null)
    .single();

  if (logError || !log) {
    throw new AppError('Daily log not found', 404);
  }

  if (log.status === 'completed') {
    throw new AppError('Cannot add time entries to a completed daily log', 400);
  }

  // Verify crew_entry_id if provided
  if (crew_entry_id) {
    const { data: crewEntry, error: crewError } = await supabase
      .from('v2_daily_log_crew')
      .select('id')
      .eq('id', crew_entry_id)
      .eq('daily_log_id', dailyLogId)
      .single();

    if (crewError || !crewEntry) {
      throw new AppError('Crew entry not found', 404);
    }
  }

  // Create time entry
  const { data: entry, error: createError } = await supabase
    .from('v2_daily_log_time_entries')
    .insert({
      daily_log_id: dailyLogId,
      crew_entry_id: crew_entry_id || null,
      worker_name,
      worker_id: worker_id || null,
      clock_in: clock_in || new Date().toISOString(),
      trade: trade || null,
      work_area: work_area || null,
      task_description: task_description || null,
      clock_in_location: clock_in_location || null,
      notes: notes || null,
      status: 'active'
    })
    .select()
    .single();

  if (createError) throw createError;

  logger.info('Time entry created (clock in)', {
    component: 'CrewTime',
    dailyLogId,
    entryId: entry.id,
    worker: worker_name
  });

  res.status(201).json(entry);
}));

// ============================================================
// UPDATE TIME ENTRY (CLOCK OUT, ADJUSTMENTS)
// ============================================================

router.patch('/:dailyLogId/crew-time/:entryId', asyncHandler(async (req, res) => {
  const { dailyLogId, entryId } = req.params;
  const {
    clock_out,
    clock_out_location,
    break_minutes,
    trade,
    work_area,
    task_description,
    notes,
    status
  } = req.body;

  // Verify daily log exists and is not completed
  const { data: log, error: logError } = await supabase
    .from('v2_daily_logs')
    .select('id, status')
    .eq('id', dailyLogId)
    .is('deleted_at', null)
    .single();

  if (logError || !log) {
    throw new AppError('Daily log not found', 404);
  }

  if (log.status === 'completed') {
    throw new AppError('Cannot modify time entries on a completed daily log', 400);
  }

  // Get existing entry
  const { data: existing, error: existError } = await supabase
    .from('v2_daily_log_time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('daily_log_id', dailyLogId)
    .single();

  if (existError || !existing) {
    throw new AppError('Time entry not found', 404);
  }

  // Build update object
  const updates = {
    updated_at: new Date().toISOString()
  };

  if (clock_out !== undefined) {
    updates.clock_out = clock_out;

    // Calculate total hours
    const clockIn = new Date(existing.clock_in);
    const clockOut = new Date(clock_out);
    const breaks = break_minutes !== undefined ? break_minutes : (existing.break_minutes || 0);
    const hours = (clockOut - clockIn) / (1000 * 60 * 60) - (breaks / 60);
    updates.total_hours = Math.max(0, Math.round(hours * 100) / 100);

    // Auto-set status to completed if clocking out
    if (!status) {
      updates.status = 'completed';
    }
  }

  if (clock_out_location !== undefined) updates.clock_out_location = clock_out_location;
  if (break_minutes !== undefined) {
    updates.break_minutes = break_minutes;
    // Recalculate hours if we have both clock in and out
    if (existing.clock_out || clock_out) {
      const clockIn = new Date(existing.clock_in);
      const clockOut = new Date(clock_out || existing.clock_out);
      const hours = (clockOut - clockIn) / (1000 * 60 * 60) - (break_minutes / 60);
      updates.total_hours = Math.max(0, Math.round(hours * 100) / 100);
    }
  }
  if (trade !== undefined) updates.trade = trade;
  if (work_area !== undefined) updates.work_area = work_area;
  if (task_description !== undefined) updates.task_description = task_description;
  if (notes !== undefined) updates.notes = notes;
  if (status !== undefined) updates.status = status;

  // Update entry
  const { data: updated, error: updateError } = await supabase
    .from('v2_daily_log_time_entries')
    .update(updates)
    .eq('id', entryId)
    .select()
    .single();

  if (updateError) throw updateError;

  logger.info('Time entry updated', {
    component: 'CrewTime',
    dailyLogId,
    entryId,
    updates: Object.keys(updates)
  });

  res.json(updated);
}));

// ============================================================
// CLOCK OUT (CONVENIENCE ENDPOINT)
// ============================================================

router.post('/:dailyLogId/crew-time/:entryId/clock-out', asyncHandler(async (req, res) => {
  const { dailyLogId, entryId } = req.params;
  const { clock_out_location, break_minutes, notes } = req.body;

  // Verify daily log exists and is not completed
  const { data: log, error: logError } = await supabase
    .from('v2_daily_logs')
    .select('id, status')
    .eq('id', dailyLogId)
    .is('deleted_at', null)
    .single();

  if (logError || !log) {
    throw new AppError('Daily log not found', 404);
  }

  if (log.status === 'completed') {
    throw new AppError('Cannot clock out on a completed daily log', 400);
  }

  // Get existing entry
  const { data: existing, error: existError } = await supabase
    .from('v2_daily_log_time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('daily_log_id', dailyLogId)
    .single();

  if (existError || !existing) {
    throw new AppError('Time entry not found', 404);
  }

  if (existing.clock_out) {
    throw new AppError('Worker has already clocked out', 400);
  }

  // Clock out
  const clockOut = new Date();
  const clockIn = new Date(existing.clock_in);
  const breaks = break_minutes || existing.break_minutes || 0;
  const hours = (clockOut - clockIn) / (1000 * 60 * 60) - (breaks / 60);

  const { data: updated, error: updateError } = await supabase
    .from('v2_daily_log_time_entries')
    .update({
      clock_out: clockOut.toISOString(),
      clock_out_location: clock_out_location || null,
      break_minutes: breaks,
      total_hours: Math.max(0, Math.round(hours * 100) / 100),
      notes: notes ? (existing.notes ? existing.notes + '\n' + notes : notes) : existing.notes,
      status: 'completed',
      updated_at: clockOut.toISOString()
    })
    .eq('id', entryId)
    .select()
    .single();

  if (updateError) throw updateError;

  logger.info('Worker clocked out', {
    component: 'CrewTime',
    dailyLogId,
    entryId,
    worker: existing.worker_name,
    totalHours: updated.total_hours
  });

  res.json(updated);
}));

// ============================================================
// DELETE TIME ENTRY
// ============================================================

router.delete('/:dailyLogId/crew-time/:entryId', asyncHandler(async (req, res) => {
  const { dailyLogId, entryId } = req.params;

  // Verify daily log exists and is not completed
  const { data: log, error: logError } = await supabase
    .from('v2_daily_logs')
    .select('id, status')
    .eq('id', dailyLogId)
    .is('deleted_at', null)
    .single();

  if (logError || !log) {
    throw new AppError('Daily log not found', 404);
  }

  if (log.status === 'completed') {
    throw new AppError('Cannot delete time entries from a completed daily log', 400);
  }

  // Delete entry
  const { error: deleteError } = await supabase
    .from('v2_daily_log_time_entries')
    .delete()
    .eq('id', entryId)
    .eq('daily_log_id', dailyLogId);

  if (deleteError) throw deleteError;

  logger.info('Time entry deleted', { component: 'CrewTime', dailyLogId, entryId });

  res.json({ success: true });
}));

// ============================================================
// APPROVE TIME ENTRIES
// ============================================================

router.post('/:dailyLogId/crew-time/:entryId/approve', asyncHandler(async (req, res) => {
  const { dailyLogId, entryId } = req.params;
  const { approved_by } = req.body;

  // Get existing entry
  const { data: existing, error: existError } = await supabase
    .from('v2_daily_log_time_entries')
    .select('*')
    .eq('id', entryId)
    .eq('daily_log_id', dailyLogId)
    .single();

  if (existError || !existing) {
    throw new AppError('Time entry not found', 404);
  }

  if (!existing.clock_out) {
    throw new AppError('Cannot approve entry without clock out time', 400);
  }

  // Approve entry
  const { data: updated, error: updateError } = await supabase
    .from('v2_daily_log_time_entries')
    .update({
      approved: true,
      approved_by: approved_by || 'System',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', entryId)
    .select()
    .single();

  if (updateError) throw updateError;

  logger.info('Time entry approved', {
    component: 'CrewTime',
    dailyLogId,
    entryId,
    approvedBy: approved_by
  });

  res.json(updated);
}));

// ============================================================
// BULK APPROVE TIME ENTRIES
// ============================================================

router.post('/:dailyLogId/crew-time/approve-all', asyncHandler(async (req, res) => {
  const { dailyLogId } = req.params;
  const { approved_by } = req.body;

  // Get all completed, unapproved entries
  const { data: entries, error: fetchError } = await supabase
    .from('v2_daily_log_time_entries')
    .select('id')
    .eq('daily_log_id', dailyLogId)
    .eq('status', 'completed')
    .eq('approved', false)
    .not('clock_out', 'is', null);

  if (fetchError) throw fetchError;

  if (!entries || entries.length === 0) {
    return res.json({ approved_count: 0, message: 'No entries to approve' });
  }

  // Bulk update
  const { error: updateError } = await supabase
    .from('v2_daily_log_time_entries')
    .update({
      approved: true,
      approved_by: approved_by || 'System',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('daily_log_id', dailyLogId)
    .eq('status', 'completed')
    .eq('approved', false)
    .not('clock_out', 'is', null);

  if (updateError) throw updateError;

  logger.info('Bulk time entries approved', {
    component: 'CrewTime',
    dailyLogId,
    count: entries.length,
    approvedBy: approved_by
  });

  res.json({
    approved_count: entries.length,
    message: `Approved ${entries.length} time entries`
  });
}));

// ============================================================
// GET TIME SUMMARY FOR JOB (ACROSS ALL DAILY LOGS)
// ============================================================

router.get('/job/:jobId/time-summary', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { start_date, end_date, trade } = req.query;

  // Get all daily logs for the job
  let logQuery = supabase
    .from('v2_daily_logs')
    .select('id, log_date')
    .eq('job_id', jobId)
    .is('deleted_at', null);

  if (start_date) {
    logQuery = logQuery.gte('log_date', start_date);
  }
  if (end_date) {
    logQuery = logQuery.lte('log_date', end_date);
  }

  const { data: logs, error: logError } = await logQuery;

  if (logError) throw logError;

  if (!logs || logs.length === 0) {
    return res.json({
      job_id: jobId,
      period: { start: start_date, end: end_date },
      entries: [],
      summary: {
        total_hours: 0,
        total_entries: 0,
        by_trade: {},
        by_worker: {}
      }
    });
  }

  const logIds = logs.map(l => l.id);

  // Get all time entries for these logs
  let entryQuery = supabase
    .from('v2_daily_log_time_entries')
    .select('*')
    .in('daily_log_id', logIds)
    .eq('status', 'completed');

  if (trade) {
    entryQuery = entryQuery.eq('trade', trade);
  }

  const { data: entries, error: entryError } = await entryQuery;

  if (entryError) throw entryError;

  // Calculate summaries
  const byTrade = {};
  const byWorker = {};
  let totalHours = 0;

  (entries || []).forEach(e => {
    totalHours += e.total_hours || 0;

    // By trade
    const t = e.trade || 'Unspecified';
    if (!byTrade[t]) {
      byTrade[t] = { hours: 0, entries: 0 };
    }
    byTrade[t].hours += e.total_hours || 0;
    byTrade[t].entries += 1;

    // By worker
    const w = e.worker_name;
    if (!byWorker[w]) {
      byWorker[w] = { hours: 0, entries: 0, trade: e.trade };
    }
    byWorker[w].hours += e.total_hours || 0;
    byWorker[w].entries += 1;
  });

  res.json({
    job_id: jobId,
    period: { start: start_date, end: end_date },
    entries: entries || [],
    summary: {
      total_hours: Math.round(totalHours * 100) / 100,
      total_entries: entries?.length || 0,
      by_trade: byTrade,
      by_worker: byWorker
    }
  });
}));

module.exports = router;
