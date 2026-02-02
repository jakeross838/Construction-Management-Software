const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');

// Helper: Map database status to frontend status
function mapTaskStatus(dbStatus) {
  const statusMap = {
    'not_started': 'scheduled',
    'in_progress': 'in_progress',
    'completed': 'completed',
    'on_hold': 'delayed',
    'delayed': 'delayed',
    'cancelled': 'cancelled',
  };
  return statusMap[dbStatus] || dbStatus || 'scheduled';
}

// Helper: Log schedule activity
async function logScheduleActivity(scheduleId, taskId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_schedule_activity').insert({
      schedule_id: scheduleId,
      task_id: taskId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Failed to log schedule activity:', err);
  }
}

// ============================================================
// SCHEDULE ENDPOINTS
// ============================================================

// List schedules (optionally filtered by job)
router.get('/', asyncHandler(async (req, res) => {
    const { job_id } = req.query;

    let query = supabase
      .from('v2_schedules')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        tasks:v2_schedule_tasks(id, name, status, percent_complete)
      `)
            .order('created_at', { ascending: false });

    if (job_id) {
      query = query.eq('job_id', job_id);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Add task summary to each schedule
    const schedulesWithSummary = data.map(schedule => ({
      ...schedule,
      task_count: schedule.tasks?.length || 0,
      completed_tasks: schedule.tasks?.filter(t => t.status === 'completed').length || 0,
      overall_progress: schedule.tasks?.length > 0
        ? Math.round(schedule.tasks.reduce((sum, t) => sum + (t.percent_complete || 0), 0) / schedule.tasks.length)
        : 0
    }));

    res.json(schedulesWithSummary);
}));

// Get schedule by job ID (convenience endpoint)
router.get('/by-job/:jobId', asyncHandler(async (req, res) => {
    const { jobId } = req.params;

    const { data: schedule, error } = await supabase
      .from('v2_schedules')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        tasks:v2_schedule_tasks(
          id, name, description, phase,
          planned_start, planned_end, estimated_days,
          actual_start, actual_end, actual_days,
          status, percent_complete, sort_order,
                    cost_code_id
        )
      `)
      .eq('job_id', jobId)
            .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (!schedule) {
      return res.json(null); // No schedule exists for this job yet
    }

    // Sort tasks by sort_order
    if (schedule.tasks) {
      schedule.tasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    res.json(schedule);
}));

// List all tasks (optionally filtered by job_id) - MUST BE BEFORE /:id route
router.get('/tasks', asyncHandler(async (req, res) => {
    const { job_id } = req.query;

    // Simple query without problematic joins
    let query = supabase
      .from('v2_schedule_tasks')
      .select('*')
      .order('planned_start', { ascending: true })
      .order('sort_order', { ascending: true });

    // If job_id is provided, filter through schedules table
    if (job_id) {
      const { data: schedules } = await supabase
        .from('v2_schedules')
        .select('id')
        .eq('job_id', job_id);

      if (!schedules || schedules.length === 0) {
        return res.json([]);
      }

      const scheduleIds = schedules.map(s => s.id);
      query = query.in('schedule_id', scheduleIds);
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    // Fetch job names separately to avoid join issues
    const scheduleIds = [...new Set((tasks || []).map(t => t.schedule_id).filter(Boolean))];
    let scheduleJobMap = {};
    if (scheduleIds.length > 0) {
      const { data: schedules } = await supabase
        .from('v2_schedules')
        .select('id, job_id, job:v2_jobs(id, name)')
        .in('id', scheduleIds);

      if (schedules) {
        schedules.forEach(s => {
          scheduleJobMap[s.id] = { job_id: s.job_id, job_name: s.job?.name };
        });
      }
    }

    // Map to expected format - translate database fields to frontend expectations
    const mappedTasks = (tasks || []).map(task => ({
      ...task,
      // Map planned_start/planned_end to start_date/end_date for frontend
      start_date: task.planned_start || task.actual_start || null,
      end_date: task.planned_end || task.actual_end || null,
      // Map status values
      status: mapTaskStatus(task.status),
      // Additional mappings
      job_id: scheduleJobMap[task.schedule_id]?.job_id || task.job_id || null,
      job_name: scheduleJobMap[task.schedule_id]?.job_name || null,
      task_type: task.task_type || 'work',
      critical_path: task.is_critical || task.critical_path || false,
      predecessors: task.predecessors || [],
      color: task.color || '#3b82f6',
      assigned_to: task.assigned_vendor_id || task.assigned_to || null,
      trades: task.trades || [],
      tags: task.tags || [],
      // Milestone and baseline support
      is_milestone: task.is_milestone || task.task_type === 'milestone' || false,
      baseline_start: task.baseline_start || null,
      baseline_end: task.baseline_end || null,
    }));

    res.json(mappedTasks);
}));

// Create task (accepts job_id - creates schedule if needed)
router.post('/tasks', asyncHandler(async (req, res) => {
    const {
      job_id,
      name,
      description,
      phase,
      cost_code_id,
      trade_id,
      start_date,
      end_date,
      planned_start,
      planned_end,
      estimated_days,
      duration_days,
      assigned_vendor_id,
      assigned_to,
      sort_order,
      is_milestone,
      task_type,
      predecessors,
      created_by
    } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }
    if (!name) {
      return res.status(400).json({ error: 'Task name is required' });
    }

    // Get or create schedule for this job
    let schedule;
    const { data: existingSchedule } = await supabase
      .from('v2_schedules')
      .select('id')
      .eq('job_id', job_id)
      .single();

    if (existingSchedule) {
      schedule = existingSchedule;
    } else {
      // Create a new schedule for this job
      const { data: newSchedule, error: scheduleError } = await supabase
        .from('v2_schedules')
        .insert({
          job_id,
          name: 'Master Schedule',
          status: 'draft',
          created_by: created_by || 'System'
        })
        .select()
        .single();

      if (scheduleError) throw scheduleError;
      schedule = newSchedule;
    }

    // Get next sort order if not provided
    let taskSortOrder = sort_order;
    if (taskSortOrder === undefined) {
      const { data: lastTask } = await supabase
        .from('v2_schedule_tasks')
        .select('sort_order')
        .eq('schedule_id', schedule.id)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      taskSortOrder = (lastTask?.sort_order || 0) + 10;
    }

    // Determine if this is a milestone
    const isMilestone = is_milestone || task_type === 'milestone';

    // Map frontend field names to database field names
    const taskPlannedStart = planned_start || start_date;
    const taskPlannedEnd = planned_end || end_date;
    const taskEstimatedDays = isMilestone ? 0 : (estimated_days || duration_days || 1);

    const { data: task, error } = await supabase
      .from('v2_schedule_tasks')
      .insert({
        schedule_id: schedule.id,
        name,
        description,
        phase,
        cost_code_id,
        trade_id,
        planned_start: taskPlannedStart,
        planned_end: taskPlannedEnd,
        estimated_days: taskEstimatedDays,
        assigned_vendor_id: assigned_vendor_id || assigned_to,
        sort_order: taskSortOrder,
        status: 'not_started',
        percent_complete: 0,
        is_milestone: isMilestone,
        task_type: task_type || 'work',
        predecessors: predecessors || []
      })
      .select('*')
      .single();

    if (error) throw error;

    await logScheduleActivity(schedule.id, task.id, 'task_added', created_by, { name });

    // Map response to frontend format
    res.status(201).json({
      ...task,
      job_id,
      start_date: task.planned_start,
      end_date: task.planned_end,
      duration_days: task.estimated_days,
      assigned_to: task.assigned_vendor_id,
      is_milestone: task.is_milestone || task.task_type === 'milestone'
    });
}));

// Get single schedule with all tasks
router.get('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: schedule, error } = await supabase
      .from('v2_schedules')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        tasks:v2_schedule_tasks(
          id, name, description, phase,
          planned_start, planned_end, estimated_days,
          actual_start, actual_end, actual_days,
          status, percent_complete, sort_order,
                    cost_code_id
        )
      `)
      .eq('id', id)
            .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      throw error;
    }

    // Sort tasks by sort_order
    if (schedule.tasks) {
      schedule.tasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    // Get activity log
    const { data: activity } = await supabase
      .from('v2_schedule_activity')
      .select('*')
      .eq('schedule_id', id)
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({
      ...schedule,
      activity: activity || []
    });
}));

// Create schedule for a job
router.post('/', asyncHandler(async (req, res) => {
    const { job_id, name, start_date, target_end_date, created_by } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }

    // Check if schedule already exists for this job
    const { data: existing } = await supabase
      .from('v2_schedules')
      .select('id')
      .eq('job_id', job_id)
            .single();

    if (existing) {
      return res.status(409).json({
        error: 'A schedule already exists for this job',
        existing_id: existing.id
      });
    }

    const { data: schedule, error } = await supabase
      .from('v2_schedules')
      .insert({
        job_id,
        name: name || 'Master Schedule',
        start_date,
        target_end_date,
        status: 'draft',
        created_by
      })
      .select(`
        *,
        job:v2_jobs(id, name, address)
      `)
      .single();

    if (error) throw error;

    await logScheduleActivity(schedule.id, null, 'created', created_by, { name: schedule.name });

    res.status(201).json(schedule);
}));

// Update schedule
router.patch('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { name, status, start_date, target_end_date, actual_end_date, updated_by } = req.body;

    const updates = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (status !== undefined) updates.status = status;
    if (start_date !== undefined) updates.start_date = start_date;
    if (target_end_date !== undefined) updates.target_end_date = target_end_date;
    if (actual_end_date !== undefined) updates.actual_end_date = actual_end_date;

    const { data: schedule, error } = await supabase
      .from('v2_schedules')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await logScheduleActivity(id, null, 'updated', updated_by, updates);

    res.json(schedule);
}));

// Delete schedule (hard delete - tasks cascade via FK)
router.delete('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { deleted_by } = req.body;

    await logScheduleActivity(id, null, 'deleted', deleted_by);

    const { error } = await supabase
      .from('v2_schedules')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({ success: true });
}));

// ============================================================
// TASK ENDPOINTS
// ============================================================

// Get tasks for a job (for daily log task picker)
router.get('/tasks/by-job/:jobId', asyncHandler(async (req, res) => {
    const { jobId } = req.params;
    const { trade, status } = req.query;

    // First get the schedule for this job
    const { data: schedule } = await supabase
      .from('v2_schedules')
      .select('id')
      .eq('job_id', jobId)
            .single();

    if (!schedule) {
      return res.json([]); // No schedule, no tasks
    }

    let query = supabase
      .from('v2_schedule_tasks')
      .select('id, name, status, percent_complete')
      .eq('schedule_id', schedule.id)
      .order('sort_order', { ascending: true });

    // Filter by trade for auto-suggest
    if (trade) {
      query = query.eq('trade', trade);
    }

    // Filter by status (typically want pending or in_progress)
    if (status) {
      query = query.eq('status', status);
    } else {
      // Default: exclude completed tasks
      query = query.neq('status', 'completed');
    }

    const { data: tasks, error } = await query;
    if (error) throw error;

    res.json(tasks || []);
}));

// Add task to schedule
router.post('/:scheduleId/tasks', asyncHandler(async (req, res) => {
    const { scheduleId } = req.params;
    const {
      name,
      description,
      phase,
      cost_code_id,
      trade_id,
      planned_start,
      planned_end,
      estimated_days,
      assigned_vendor_id,
      sort_order,
      is_milestone,
      task_type,
      created_by
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Task name is required' });
    }

    // Get next sort order if not provided
    let taskSortOrder = sort_order;
    if (taskSortOrder === undefined) {
      const { data: lastTask } = await supabase
        .from('v2_schedule_tasks')
        .select('sort_order')
        .eq('schedule_id', scheduleId)
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      taskSortOrder = (lastTask?.sort_order || 0) + 10;
    }

    // Determine if this is a milestone based on task_type or is_milestone flag
    const isMilestone = is_milestone || task_type === 'milestone';

    const { data: task, error } = await supabase
      .from('v2_schedule_tasks')
      .insert({
        schedule_id: scheduleId,
        name,
        description,
        phase,
        cost_code_id,
        trade_id,
        planned_start,
        planned_end,
        estimated_days: isMilestone ? 0 : (estimated_days || 1),
        assigned_vendor_id,
        sort_order: taskSortOrder,
        status: 'not_started',
        percent_complete: 0,
        is_milestone: isMilestone,
        task_type: task_type || 'work'
      })
      .select(`
        *,
                cost_code_id
      `)
      .single();

    if (error) throw error;

    await logScheduleActivity(scheduleId, task.id, 'task_added', created_by, { name });

    res.status(201).json(task);
}));

// Update task
router.patch('/tasks/:taskId', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const {
      name,
      description,
      phase,
      cost_code_id,
      trade_id,
      planned_start,
      planned_end,
      start_date,
      end_date,
      estimated_days,
      duration_days,
      actual_start,
      actual_end,
      actual_days,
      status,
      percent_complete,
      assigned_vendor_id,
      assigned_to,
      sort_order,
      is_milestone,
      task_type,
      predecessors,
      updated_by
    } = req.body;

    const updates = { updated_at: new Date().toISOString() };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (phase !== undefined) updates.phase = phase;
    if (cost_code_id !== undefined) updates.cost_code_id = cost_code_id;
    if (trade_id !== undefined) updates.trade_id = trade_id;
    // Handle both frontend (start_date/end_date) and backend (planned_start/planned_end) field names
    if (planned_start !== undefined) updates.planned_start = planned_start;
    else if (start_date !== undefined) updates.planned_start = start_date;
    if (planned_end !== undefined) updates.planned_end = planned_end;
    else if (end_date !== undefined) updates.planned_end = end_date;
    if (estimated_days !== undefined) updates.estimated_days = estimated_days;
    else if (duration_days !== undefined) updates.estimated_days = duration_days;
    if (actual_start !== undefined) updates.actual_start = actual_start;
    if (actual_end !== undefined) updates.actual_end = actual_end;
    if (actual_days !== undefined) updates.actual_days = actual_days;
    if (status !== undefined) updates.status = status;
    if (percent_complete !== undefined) updates.percent_complete = percent_complete;
    if (assigned_vendor_id !== undefined) updates.assigned_vendor_id = assigned_vendor_id;
    else if (assigned_to !== undefined) updates.assigned_vendor_id = assigned_to;
    if (sort_order !== undefined) updates.sort_order = sort_order;
    if (is_milestone !== undefined) updates.is_milestone = is_milestone;
    if (task_type !== undefined) updates.task_type = task_type;
    if (predecessors !== undefined) updates.predecessors = predecessors;

    // Auto-update status based on completion
    if (percent_complete !== undefined) {
      if (percent_complete >= 100 && status !== 'complete') {
        updates.status = 'complete';
        if (!updates.actual_end) {
          updates.actual_end = new Date().toISOString().split('T')[0];
        }
      } else if (percent_complete > 0 && percent_complete < 100 && status === 'not_started') {
        updates.status = 'in_progress';
        if (!updates.actual_start) {
          updates.actual_start = new Date().toISOString().split('T')[0];
        }
      }
    }

    // Get schedule_id for activity logging
    const { data: existingTask } = await supabase
      .from('v2_schedule_tasks')
      .select('schedule_id')
      .eq('id', taskId)
      .single();

    const { data: task, error } = await supabase
      .from('v2_schedule_tasks')
      .update(updates)
      .eq('id', taskId)
      .select(`
        *,
                cost_code_id
      `)
      .single();

    if (error) throw error;

    if (existingTask) {
      await logScheduleActivity(existingTask.schedule_id, taskId, 'task_updated', updated_by, updates);
    }

    res.json(task);
}));

// Delete task
router.delete('/tasks/:taskId', asyncHandler(async (req, res) => {
    const { taskId } = req.params;
    const { deleted_by } = req.body;

    // Get schedule_id for activity logging
    const { data: task } = await supabase
      .from('v2_schedule_tasks')
      .select('schedule_id, name')
      .eq('id', taskId)
      .single();

    // Clear task references in activity logs (to avoid FK constraint)
    await supabase
      .from('v2_schedule_activity')
      .update({ task_id: null })
      .eq('task_id', taskId);

    // Also clear any dependency references to this task
    await supabase
      .from('v2_schedule_tasks')
      .update({ depends_on: [] })
      .contains('depends_on', [taskId]);

    const { error } = await supabase
      .from('v2_schedule_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;

    if (task) {
      await logScheduleActivity(task.schedule_id, null, 'task_deleted', deleted_by, { name: task.name });
    }

    res.json({ success: true });
}));

// Reorder tasks
router.post('/:scheduleId/tasks/reorder', asyncHandler(async (req, res) => {
    const { scheduleId } = req.params;
    const { task_order, updated_by } = req.body; // Array of { id, sort_order }

    if (!Array.isArray(task_order)) {
      return res.status(400).json({ error: 'task_order must be an array' });
    }

    // Update each task's sort_order
    for (const item of task_order) {
      await supabase
        .from('v2_schedule_tasks')
        .update({ sort_order: item.sort_order })
        .eq('id', item.id)
        .eq('schedule_id', scheduleId);
    }

    await logScheduleActivity(scheduleId, null, 'tasks_reordered', updated_by);

    res.json({ success: true });
}));

// ============================================================
// GANTT DATA ENDPOINT
// ============================================================

// Get Gantt chart data (optimized format)
router.get('/:id/gantt', asyncHandler(async (req, res) => {
    const { id } = req.params;

    const { data: schedule, error } = await supabase
      .from('v2_schedules')
      .select(`
        id, name, start_date, target_end_date,
        job:v2_jobs(id, name),
        tasks:v2_schedule_tasks(
          id, name, phase,
          planned_start, planned_end,
          actual_start, actual_end,
          status, percent_complete, sort_order
        )
      `)
      .eq('id', id)
            .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Schedule not found' });
      }
      throw error;
    }

    // Sort tasks
    if (schedule.tasks) {
      schedule.tasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }

    // Calculate date range for Gantt
    let minDate = schedule.start_date;
    let maxDate = schedule.target_end_date;

    schedule.tasks?.forEach(task => {
      if (task.planned_start && (!minDate || task.planned_start < minDate)) {
        minDate = task.planned_start;
      }
      if (task.planned_end && (!maxDate || task.planned_end > maxDate)) {
        maxDate = task.planned_end;
      }
      if (task.actual_start && (!minDate || task.actual_start < minDate)) {
        minDate = task.actual_start;
      }
      if (task.actual_end && (!maxDate || task.actual_end > maxDate)) {
        maxDate = task.actual_end;
      }
    });

    res.json({
      ...schedule,
      gantt_start: minDate,
      gantt_end: maxDate
    });
}));

// ============================================================
// PHASE 102: BASELINE SCHEDULES
// ============================================================

// Set baseline snapshot
router.post('/:id/set-baseline', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { set_by, force } = req.body;

  // Check if baseline already exists
  const { data: schedule, error: fetchError } = await supabase
    .from('v2_schedules')
    .select('baseline_set_at, baseline_set_by')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    throw fetchError;
  }

  // Warn if baseline already exists (unless force=true)
  if (schedule.baseline_set_at && !force) {
    return res.status(409).json({
      error: 'Baseline already exists',
      existing_baseline: {
        set_at: schedule.baseline_set_at,
        set_by: schedule.baseline_set_by
      },
      message: 'Use force: true to overwrite existing baseline'
    });
  }

  // Call copy_to_baseline RPC
  const { error } = await supabase.rpc('copy_to_baseline', {
    p_schedule_id: id,
    p_set_by: set_by || 'System'
  });

  if (error) throw error;

  // Get updated schedule
  const { data: updated } = await supabase
    .from('v2_schedules')
    .select('baseline_set_at, baseline_set_by')
    .eq('id', id)
    .single();

  await logScheduleActivity(id, null, 'baseline_set', set_by, {
    force: !!force,
    previous_baseline: schedule.baseline_set_at
  });

  res.json({
    success: true,
    baseline_set_at: updated.baseline_set_at,
    baseline_set_by: updated.baseline_set_by
  });
}));

// Get baseline variance comparison
router.get('/:id/baseline', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get schedule info
  const { data: schedule, error: scheduleError } = await supabase
    .from('v2_schedules')
    .select('id, baseline_set_at, baseline_set_by')
    .eq('id', id)
    .single();

  if (scheduleError) {
    if (scheduleError.code === 'PGRST116') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    throw scheduleError;
  }

  if (!schedule.baseline_set_at) {
    return res.status(404).json({
      error: 'No baseline set',
      message: 'Use POST /:id/set-baseline to capture a baseline first'
    });
  }

  // Get tasks with baseline data
  const { data: tasks, error: tasksError } = await supabase
    .from('v2_schedule_tasks')
    .select('id, name, baseline_start, baseline_end, planned_start, planned_end, status, percent_complete, sort_order')
    .eq('schedule_id', id)
    .order('sort_order');

  if (tasksError) throw tasksError;

  // Calculate variance for each task
  const tasksWithVariance = (tasks || []).map(task => {
    let variance_days = 0;
    if (task.baseline_end && task.planned_end) {
      const baselineEnd = new Date(task.baseline_end);
      const plannedEnd = new Date(task.planned_end);
      variance_days = Math.round((plannedEnd - baselineEnd) / (1000 * 60 * 60 * 24));
    }
    return {
      ...task,
      variance_days
    };
  });

  // Calculate summary
  const tasksWithBaseline = tasksWithVariance.filter(t => t.baseline_end);
  const summary = {
    total_tasks: tasksWithVariance.length,
    tasks_with_baseline: tasksWithBaseline.length,
    on_schedule: tasksWithBaseline.filter(t => t.variance_days === 0).length,
    behind_schedule: tasksWithBaseline.filter(t => t.variance_days > 0).length,
    ahead_schedule: tasksWithBaseline.filter(t => t.variance_days < 0).length,
    total_variance_days: tasksWithBaseline.reduce((sum, t) => sum + t.variance_days, 0)
  };

  res.json({
    schedule_id: id,
    baseline_set_at: schedule.baseline_set_at,
    baseline_set_by: schedule.baseline_set_by,
    tasks: tasksWithVariance,
    summary
  });
}));

// ============================================================
// BASELINE CAPTURE & VARIANCE (RPC-based)
// ============================================================

// Capture baseline using the capture_schedule_baseline RPC function
router.post('/:id/capture-baseline', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { captured_by } = req.body;

  // Verify schedule exists
  const { data: schedule, error: fetchError } = await supabase
    .from('v2_schedules')
    .select('id, name, baseline_captured_at')
    .eq('id', id)
    .single();

  if (fetchError) {
    if (fetchError.code === 'PGRST116') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    throw fetchError;
  }

  // Call capture_schedule_baseline RPC
  const { data, error } = await supabase.rpc('capture_schedule_baseline', {
    p_schedule_id: id
  });

  if (error) throw error;

  await logScheduleActivity(id, null, 'baseline_captured', captured_by || 'System', {
    previous_baseline: schedule.baseline_captured_at,
    tasks_captured: data?.tasks_captured
  });

  res.json(data);
}));

// Get schedule variance using the get_schedule_variance RPC function
router.get('/:id/variance', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Call get_schedule_variance RPC
  const { data, error } = await supabase.rpc('get_schedule_variance', {
    p_schedule_id: id
  });

  if (error) {
    if (error.message && error.message.includes('Schedule not found')) {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    throw error;
  }

  // Check if baseline exists
  if (!data.has_baseline) {
    return res.status(404).json({
      error: 'No baseline captured',
      message: 'Use POST /:id/capture-baseline to capture a baseline first'
    });
  }

  res.json(data);
}));

// ============================================================
// PHASE 73: SCHEDULE INTELLIGENCE
// ============================================================

// Get templates (list)
router.get('/templates', asyncHandler(async (req, res) => {
  const { data: templates, error } = await supabase
    .from('v2_schedule_templates')
    .select(`
      *,
      task_count:v2_schedule_template_tasks(count)
    `)
    .order('is_default', { ascending: false })
    .order('name');

  if (error) throw error;

  // Flatten count
  const templatesWithCount = (templates || []).map(t => ({
    ...t,
    task_count: t.task_count?.[0]?.count || 0
  }));

  res.json(templatesWithCount);
}));

// Get single template with tasks
router.get('/templates/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  const { data: template, error: templateError } = await supabase
    .from('v2_schedule_templates')
    .select('*')
    .eq('id', templateId)
    .single();

  if (templateError) {
    if (templateError.code === 'PGRST116') {
      return res.status(404).json({ error: 'Template not found' });
    }
    throw templateError;
  }

  // Get template tasks
  const { data: tasks } = await supabase
    .from('v2_schedule_template_tasks')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order');

  // Get template dependencies
  const { data: dependencies } = await supabase
    .from('v2_schedule_template_dependencies')
    .select('*')
    .eq('template_id', templateId);

  res.json({
    ...template,
    tasks: tasks || [],
    dependencies: dependencies || []
  });
}));

// Save schedule as template
router.post('/templates/from-schedule', asyncHandler(async (req, res) => {
  const { source_schedule_id, name, description, project_type, created_by } = req.body;

  if (!source_schedule_id) {
    return res.status(400).json({ error: 'source_schedule_id is required' });
  }
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  // Call RPC to save template
  const { data: templateId, error } = await supabase.rpc('save_schedule_as_template', {
    p_source_schedule_id: source_schedule_id,
    p_name: name,
    p_description: description || null,
    p_project_type: project_type || 'residential',
    p_created_by: created_by || 'System'
  });

  if (error) throw error;

  // Get task count
  const { data: taskCount } = await supabase
    .from('v2_schedule_template_tasks')
    .select('id', { count: 'exact' })
    .eq('template_id', templateId);

  res.status(201).json({
    success: true,
    template_id: templateId,
    task_count: taskCount?.length || 0
  });
}));

// Apply template to job
router.post('/templates/:templateId/apply', asyncHandler(async (req, res) => {
  const { templateId } = req.params;
  const { job_id, start_date, created_by } = req.body;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id is required' });
  }
  if (!start_date) {
    return res.status(400).json({ error: 'start_date is required' });
  }

  // Check if job already has schedule
  const { data: existing } = await supabase
    .from('v2_schedules')
    .select('id')
    .eq('job_id', job_id)
    .single();

  if (existing) {
    return res.status(409).json({
      error: 'Job already has a schedule',
      existing_schedule_id: existing.id,
      message: 'Delete the existing schedule first or use a different job'
    });
  }

  // Call RPC to apply template
  const { data: scheduleId, error } = await supabase.rpc('apply_template_to_job', {
    p_template_id: templateId,
    p_job_id: job_id,
    p_start_date: start_date,
    p_created_by: created_by || 'System'
  });

  if (error) throw error;

  // Get created schedule with tasks
  const { data: schedule } = await supabase
    .from('v2_schedules')
    .select(`
      *,
      job:v2_jobs(id, name),
      tasks:v2_schedule_tasks(id, name, planned_start, planned_end)
    `)
    .eq('id', scheduleId)
    .single();

  res.status(201).json({
    success: true,
    schedule_id: scheduleId,
    tasks_created: schedule?.tasks?.length || 0,
    schedule
  });
}));

// Delete template
router.delete('/templates/:templateId', asyncHandler(async (req, res) => {
  const { templateId } = req.params;

  // Cascade deletes template_tasks and template_dependencies due to FK constraints
  const { error } = await supabase
    .from('v2_schedule_templates')
    .delete()
    .eq('id', templateId);

  if (error) throw error;

  res.json({ success: true });
}));

// Generate schedule from selections
// Generate schedule from selections
router.post('/jobs/:jobId/generate-from-selections', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const { start_date, created_by } = req.body;

  const { data: scheduleId, error } = await supabase
    .rpc('generate_schedule_from_selections', {
      p_job_id: jobId,
      p_start_date: start_date || new Date().toISOString().split('T')[0],
      p_created_by: created_by || 'System'
    });

  if (error) throw error;

  // Fetch the created schedule with tasks
  const { data: schedule } = await supabase
    .from('v2_schedules')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', scheduleId)
    .single();

  const { data: tasks } = await supabase
    .from('v2_schedule_tasks')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('sort_order');

  res.status(201).json({
    success: true,
    message: `Schedule generated with ${tasks?.length || 0} tasks`,
    schedule: {
      ...schedule,
      tasks: tasks || []
    }
  });
}));

// ============================================================
// DEPENDENCIES
// ============================================================

// Add dependency
router.post('/:scheduleId/dependencies', asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const { predecessor_id, successor_id, dependency_type, lag_days, created_by } = req.body;

  if (!predecessor_id || !successor_id) {
    return res.status(400).json({ error: 'Predecessor and successor are required' });
  }

  if (predecessor_id === successor_id) {
    return res.status(400).json({ error: 'A task cannot depend on itself' });
  }

  const { data: dependency, error } = await supabase
    .from('v2_schedule_dependencies')
    .insert({
      predecessor_id,
      successor_id,
      dependency_type: dependency_type || 'FS',
      lag_days: lag_days || 0,
      source: 'manual'
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This dependency already exists' });
    }
    throw error;
  }

  // Recalculate schedule
  await supabase.rpc('recalculate_schedule', { p_schedule_id: scheduleId });

  await logScheduleActivity(scheduleId, null, 'dependency_added', created_by, { dependency_type });

  res.status(201).json(dependency);
}));

// Get dependencies for schedule
router.get('/:scheduleId/dependencies', asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;

  // Get all task IDs for this schedule
  const { data: tasks } = await supabase
    .from('v2_schedule_tasks')
    .select('id')
    .eq('schedule_id', scheduleId);

  const taskIds = (tasks || []).map(t => t.id);

  if (taskIds.length === 0) {
    return res.json([]);
  }

  const { data: dependencies, error } = await supabase
    .from('v2_schedule_dependencies')
    .select(`
      *,
      predecessor:v2_schedule_tasks!predecessor_id(id, name),
      successor:v2_schedule_tasks!successor_id(id, name)
    `)
    .in('predecessor_id', taskIds);

  if (error) throw error;

  res.json(dependencies || []);
}));

// Delete dependency
router.delete('/:scheduleId/dependencies/:depId', asyncHandler(async (req, res) => {
  const { scheduleId, depId } = req.params;
  const { deleted_by } = req.body;

  const { error } = await supabase
    .from('v2_schedule_dependencies')
    .delete()
    .eq('id', depId);

  if (error) throw error;

  // Recalculate schedule
  await supabase.rpc('recalculate_schedule', { p_schedule_id: scheduleId });

  await logScheduleActivity(scheduleId, null, 'dependency_removed', deleted_by);

  res.json({ success: true });
}));

// ============================================================
// MILESTONES
// ============================================================

// Get milestones
router.get('/:scheduleId/milestones', asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;

  const { data: milestones, error } = await supabase
    .from('v2_schedule_milestones')
    .select(`
      *,
      linked_task:v2_schedule_tasks(id, name)
    `)
    .eq('schedule_id', scheduleId)
    .order('target_date');

  if (error) throw error;

  res.json(milestones || []);
}));

// Add milestone
router.post('/:scheduleId/milestones', asyncHandler(async (req, res) => {
  const { scheduleId } = req.params;
  const { name, description, target_date, linked_task_id, notify_days_before, created_by } = req.body;

  if (!name) return res.status(400).json({ error: 'Milestone name is required' });
  if (!target_date) return res.status(400).json({ error: 'Target date is required' });

  const { data: milestone, error } = await supabase
    .from('v2_schedule_milestones')
    .insert({
      schedule_id: scheduleId,
      name,
      description,
      target_date,
      linked_task_id,
      notify_days_before: notify_days_before || 7
    })
    .select()
    .single();

  if (error) throw error;

  await logScheduleActivity(scheduleId, null, 'milestone_added', created_by, { name });

  res.status(201).json(milestone);
}));

// Update milestone
router.patch('/:scheduleId/milestones/:msId', asyncHandler(async (req, res) => {
  const { scheduleId, msId } = req.params;
  const { name, description, target_date, actual_date, status, linked_task_id, updated_by } = req.body;

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (target_date !== undefined) updates.target_date = target_date;
  if (actual_date !== undefined) updates.actual_date = actual_date;
  if (status !== undefined) updates.status = status;
  if (linked_task_id !== undefined) updates.linked_task_id = linked_task_id;

  const { data: milestone, error } = await supabase
    .from('v2_schedule_milestones')
    .update(updates)
    .eq('id', msId)
    .eq('schedule_id', scheduleId)
    .select()
    .single();

  if (error) throw error;

  await logScheduleActivity(scheduleId, null, 'milestone_updated', updated_by, { updates });

  res.json(milestone);
}));

// Delete milestone
router.delete('/:scheduleId/milestones/:msId', asyncHandler(async (req, res) => {
  const { scheduleId, msId } = req.params;

  const { error } = await supabase
    .from('v2_schedule_milestones')
    .delete()
    .eq('id', msId)
    .eq('schedule_id', scheduleId);

  if (error) throw error;

  res.json({ success: true });
}));

// ============================================================
// CRITICAL PATH
// ============================================================

router.get('/:id/critical-path', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get critical tasks
  const { data: criticalTasks, error } = await supabase
    .from('v2_schedule_tasks')
    .select('*')
    .eq('schedule_id', id)
    .eq('is_critical', true)
    .order('earliest_start');

  if (error) throw error;

  // Get schedule info
  const { data: schedule } = await supabase
    .from('v2_schedules')
    .select('critical_path_days, start_date, target_end_date')
    .eq('id', id)
    .single();

  res.json({
    critical_path_days: schedule?.critical_path_days || 0,
    start_date: schedule?.start_date,
    projected_end: criticalTasks?.[criticalTasks.length - 1]?.earliest_finish || null,
    target_end_date: schedule?.target_end_date,
    critical_tasks: criticalTasks || []
  });
}));

// ============================================================
// RECALCULATE SCHEDULE
// ============================================================

router.post('/:id/recalculate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { updated_by } = req.body;

  const { error } = await supabase
    .rpc('recalculate_schedule', { p_schedule_id: id });

  if (error) throw error;

  // Fetch updated schedule
  const { data: schedule } = await supabase
    .from('v2_schedules')
    .select('critical_path_days')
    .eq('id', id)
    .single();

  await logScheduleActivity(id, null, 'recalculated', updated_by, {
    critical_path_days: schedule?.critical_path_days
  });

  res.json({
    success: true,
    critical_path_days: schedule?.critical_path_days
  });
}));

// ============================================================
// ENHANCED GANTT WITH CRITICAL PATH
// ============================================================

router.get('/:id/gantt-enhanced', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: schedule, error } = await supabase
    .from('v2_schedules')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    throw error;
  }

  // Get tasks with all critical path fields
  const { data: tasks } = await supabase
    .from('v2_schedule_tasks')
    .select('*')
    .eq('schedule_id', id)
    .order('sort_order');

  // Get dependencies
  const taskIds = (tasks || []).map(t => t.id);
  const { data: dependencies } = await supabase
    .from('v2_schedule_dependencies')
    .select('*')
    .in('predecessor_id', taskIds.length > 0 ? taskIds : ['00000000-0000-0000-0000-000000000000']);

  // Get milestones
  const { data: milestones } = await supabase
    .from('v2_schedule_milestones')
    .select('*')
    .eq('schedule_id', id);

  // Format for Gantt chart
  const ganttData = {
    schedule: {
      id: schedule.id,
      name: schedule.name,
      start_date: schedule.start_date,
      target_end_date: schedule.target_end_date,
      critical_path_days: schedule.critical_path_days,
      work_days: schedule.work_days,
      status: schedule.status
    },
    tasks: (tasks || []).map(task => ({
      id: task.id,
      name: task.name,
      phase: task.phase,
      start: task.planned_start || task.earliest_start,
      end: task.planned_end || task.earliest_finish,
      actual_start: task.actual_start,
      actual_end: task.actual_end,
      duration: task.estimated_days,
      progress: task.percent_complete,
      status: task.status,
      is_critical: task.is_critical,
      total_float: task.total_float,
      earliest_start: task.earliest_start,
      earliest_finish: task.earliest_finish,
      latest_start: task.latest_start,
      latest_finish: task.latest_finish,
      dependencies: (dependencies || [])
        .filter(d => d.successor_id === task.id)
        .map(d => ({
          predecessor_id: d.predecessor_id,
          type: d.dependency_type,
          lag: d.lag_days
        }))
    })),
    milestones: (milestones || []).map(m => ({
      id: m.id,
      name: m.name,
      date: m.target_date,
      actual_date: m.actual_date,
      status: m.status
    })),
    dependencies: dependencies || []
  };

  res.json(ganttData);
}));

// ============================================================
// PDF EXPORT
// ============================================================

// Export schedule/Gantt to PDF
router.get('/jobs/:jobId/export-pdf', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name, address, client_name')
    .eq('id', jobId)
    .single();

  if (jobError) {
    if (jobError.code === 'PGRST116') {
      return res.status(404).json({ error: 'Job not found' });
    }
    throw jobError;
  }

  // Get schedule for this job
  const { data: schedule } = await supabase
    .from('v2_schedules')
    .select('id, name, start_date, target_end_date, status')
    .eq('job_id', jobId)
    .single();

  // Get tasks for this job's schedule
  let tasks = [];
  if (schedule) {
    const { data: taskData } = await supabase
      .from('v2_schedule_tasks')
      .select(`
        id, name, description, phase,
        planned_start, planned_end, estimated_days,
        actual_start, actual_end,
        status, percent_complete, sort_order,
        is_milestone, is_critical, task_type,
        predecessors, trade_id
      `)
      .eq('schedule_id', schedule.id)
      .order('sort_order', { ascending: true });

    tasks = (taskData || []).map(task => ({
      ...task,
      start_date: task.planned_start || task.actual_start,
      end_date: task.planned_end || task.actual_end,
      critical_path: task.is_critical || false,
    }));
  }

  // Generate PDF
  const { generateSchedulePDF } = require('../services/schedule-pdf-generator');
  const pdfBuffer = await generateSchedulePDF({
    job,
    schedule,
    tasks,
  });

  // Set response headers for PDF download
  const jobIdentifier = (job.name || 'Schedule').replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Schedule_${jobIdentifier}_${dateStr}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);

  res.send(pdfBuffer);
}));

// Alternative endpoint using schedule ID directly
router.get('/:id/export-pdf', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get schedule with job info
  const { data: schedule, error: scheduleError } = await supabase
    .from('v2_schedules')
    .select(`
      id, name, start_date, target_end_date, status,
      job:v2_jobs(id, name, address, client_name)
    `)
    .eq('id', id)
    .single();

  if (scheduleError) {
    if (scheduleError.code === 'PGRST116') {
      return res.status(404).json({ error: 'Schedule not found' });
    }
    throw scheduleError;
  }

  // Get tasks
  const { data: tasks } = await supabase
    .from('v2_schedule_tasks')
    .select(`
      id, name, description, phase,
      planned_start, planned_end, estimated_days,
      actual_start, actual_end,
      status, percent_complete, sort_order,
      is_milestone, is_critical, task_type,
      predecessors, trade_id
    `)
    .eq('schedule_id', id)
    .order('sort_order', { ascending: true });

  const mappedTasks = (tasks || []).map(task => ({
    ...task,
    start_date: task.planned_start || task.actual_start,
    end_date: task.planned_end || task.actual_end,
    critical_path: task.is_critical || false,
  }));

  // Generate PDF
  const { generateSchedulePDF } = require('../services/schedule-pdf-generator');
  const pdfBuffer = await generateSchedulePDF({
    job: schedule.job,
    schedule,
    tasks: mappedTasks,
  });

  // Set response headers for PDF download
  const jobName = schedule.job?.name || 'Schedule';
  const jobIdentifier = jobName.replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const filename = `Schedule_${jobIdentifier}_${dateStr}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', pdfBuffer.length);

  res.send(pdfBuffer);
}));

module.exports = router;
