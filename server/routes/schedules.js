const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');

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
router.get('/', async (req, res) => {
  try {
    const { job_id } = req.query;

    let query = supabase
      .from('v2_schedules')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        tasks:v2_schedule_tasks(id, name, status, completion_percent)
      `)
      .is('deleted_at', null)
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
        ? Math.round(schedule.tasks.reduce((sum, t) => sum + (t.completion_percent || 0), 0) / schedule.tasks.length)
        : 0
    }));

    res.json(schedulesWithSummary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get schedule by job ID (convenience endpoint)
router.get('/by-job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    const { data: schedule, error } = await supabase
      .from('v2_schedules')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        tasks:v2_schedule_tasks(
          id, name, description, trade, construction_phase,
          planned_start, planned_end, planned_duration_days,
          actual_start, actual_end, actual_duration_days,
          status, completion_percent, depends_on, sort_order,
          vendor:v2_vendors(id, name),
          po:v2_purchase_orders(id, po_number),
          cost_code:v2_cost_codes(id, code, name)
        )
      `)
      .eq('job_id', jobId)
      .is('deleted_at', null)
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single schedule with all tasks
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: schedule, error } = await supabase
      .from('v2_schedules')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        tasks:v2_schedule_tasks(
          id, name, description, trade, construction_phase,
          planned_start, planned_end, planned_duration_days,
          actual_start, actual_end, actual_duration_days,
          status, completion_percent, depends_on, sort_order,
          vendor:v2_vendors(id, name),
          po:v2_purchase_orders(id, po_number),
          cost_code:v2_cost_codes(id, code, name)
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create schedule for a job
router.post('/', async (req, res) => {
  try {
    const { job_id, name, start_date, target_end_date, created_by } = req.body;

    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }

    // Check if schedule already exists for this job
    const { data: existing } = await supabase
      .from('v2_schedules')
      .select('id')
      .eq('job_id', job_id)
      .is('deleted_at', null)
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update schedule
router.patch('/:id', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete schedule (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    const { error } = await supabase
      .from('v2_schedules')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await logScheduleActivity(id, null, 'deleted', deleted_by);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// TASK ENDPOINTS
// ============================================================

// Get tasks for a job (for daily log task picker)
router.get('/tasks/by-job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { trade, status } = req.query;

    // First get the schedule for this job
    const { data: schedule } = await supabase
      .from('v2_schedules')
      .select('id')
      .eq('job_id', jobId)
      .is('deleted_at', null)
      .single();

    if (!schedule) {
      return res.json([]); // No schedule, no tasks
    }

    let query = supabase
      .from('v2_schedule_tasks')
      .select('id, name, trade, status, completion_percent')
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add task to schedule
router.post('/:scheduleId/tasks', async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const {
      name,
      description,
      trade,
      cost_code_id,
      construction_phase,
      planned_start,
      planned_end,
      planned_duration_days,
      depends_on,
      vendor_id,
      po_id,
      sort_order,
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

    const { data: task, error } = await supabase
      .from('v2_schedule_tasks')
      .insert({
        schedule_id: scheduleId,
        name,
        description,
        trade,
        cost_code_id,
        construction_phase,
        planned_start,
        planned_end,
        planned_duration_days,
        depends_on: depends_on || [],
        vendor_id,
        po_id,
        sort_order: taskSortOrder,
        status: 'pending',
        completion_percent: 0
      })
      .select(`
        *,
        vendor:v2_vendors(id, name),
        po:v2_purchase_orders(id, po_number),
        cost_code:v2_cost_codes(id, code, name)
      `)
      .single();

    if (error) throw error;

    await logScheduleActivity(scheduleId, task.id, 'task_added', created_by, { name });

    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update task
router.patch('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const {
      name,
      description,
      trade,
      cost_code_id,
      construction_phase,
      planned_start,
      planned_end,
      planned_duration_days,
      actual_start,
      actual_end,
      actual_duration_days,
      status,
      completion_percent,
      depends_on,
      vendor_id,
      po_id,
      sort_order,
      updated_by
    } = req.body;

    const updates = { updated_at: new Date().toISOString() };

    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (trade !== undefined) updates.trade = trade;
    if (cost_code_id !== undefined) updates.cost_code_id = cost_code_id;
    if (construction_phase !== undefined) updates.construction_phase = construction_phase;
    if (planned_start !== undefined) updates.planned_start = planned_start;
    if (planned_end !== undefined) updates.planned_end = planned_end;
    if (planned_duration_days !== undefined) updates.planned_duration_days = planned_duration_days;
    if (actual_start !== undefined) updates.actual_start = actual_start;
    if (actual_end !== undefined) updates.actual_end = actual_end;
    if (actual_duration_days !== undefined) updates.actual_duration_days = actual_duration_days;
    if (status !== undefined) updates.status = status;
    if (completion_percent !== undefined) updates.completion_percent = completion_percent;
    if (depends_on !== undefined) updates.depends_on = depends_on;
    if (vendor_id !== undefined) updates.vendor_id = vendor_id;
    if (po_id !== undefined) updates.po_id = po_id;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    // Auto-update status based on completion
    if (completion_percent !== undefined) {
      if (completion_percent >= 100 && status !== 'completed') {
        updates.status = 'completed';
        if (!updates.actual_end) {
          updates.actual_end = new Date().toISOString().split('T')[0];
        }
      } else if (completion_percent > 0 && completion_percent < 100 && status === 'pending') {
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
        vendor:v2_vendors(id, name),
        po:v2_purchase_orders(id, po_number),
        cost_code:v2_cost_codes(id, code, name)
      `)
      .single();

    if (error) throw error;

    if (existingTask) {
      await logScheduleActivity(existingTask.schedule_id, taskId, 'task_updated', updated_by, updates);
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete task
router.delete('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { deleted_by } = req.body;

    // Get schedule_id for activity logging
    const { data: task } = await supabase
      .from('v2_schedule_tasks')
      .select('schedule_id, name')
      .eq('id', taskId)
      .single();

    const { error } = await supabase
      .from('v2_schedule_tasks')
      .delete()
      .eq('id', taskId);

    if (error) throw error;

    if (task) {
      await logScheduleActivity(task.schedule_id, null, 'task_deleted', deleted_by, { name: task.name });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reorder tasks
router.post('/:scheduleId/tasks/reorder', async (req, res) => {
  try {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// GANTT DATA ENDPOINT
// ============================================================

// Get Gantt chart data (optimized format)
router.get('/:id/gantt', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: schedule, error } = await supabase
      .from('v2_schedules')
      .select(`
        id, name, start_date, target_end_date,
        job:v2_jobs(id, name),
        tasks:v2_schedule_tasks(
          id, name, trade, construction_phase,
          planned_start, planned_end,
          actual_start, actual_end,
          status, completion_percent, depends_on, sort_order
        )
      `)
      .eq('id', id)
      .is('deleted_at', null)
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
