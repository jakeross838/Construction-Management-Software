/**
 * Schedule Sync Service
 * Ensures daily log entries update schedule task progress
 */

const { supabase } = require('../../config');
const logger = require('../utils/logger');

/**
 * Calculate total hours logged for a schedule task
 */
async function calculateTaskHours(taskId) {
  try {
    const { data: entries, error } = await supabase
      .from('v2_daily_log_crews')
      .select('hours_worked')
      .eq('schedule_task_id', taskId);

    if (error) throw error;

    const totalHours = (entries || [])
      .reduce((sum, e) => sum + parseFloat(e.hours_worked || 0), 0);

    return totalHours;
  } catch (error) {
    logger.error('Failed to calculate task hours', {
      component: 'ScheduleSync',
      taskId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Calculate percent complete based on hours worked vs estimated
 */
function calculatePercentComplete(hoursWorked, estimatedHours) {
  if (!estimatedHours || estimatedHours <= 0) return null;
  const percent = (hoursWorked / estimatedHours) * 100;
  return Math.min(100, Math.round(percent));
}

/**
 * Update schedule task progress from daily log
 */
async function updateTaskProgress(taskId) {
  try {
    // Get task details
    const { data: task, error: taskError } = await supabase
      .from('v2_schedule_tasks')
      .select('id, estimated_hours, actual_hours, percent_complete, status')
      .eq('id', taskId)
      .single();

    if (taskError) {
      // Task might not exist or be linked
      if (taskError.code === 'PGRST116') {
        logger.info('Schedule task not found, skipping sync', { taskId });
        return null;
      }
      throw taskError;
    }

    // Calculate total hours from daily logs
    const totalHours = await calculateTaskHours(taskId);

    // Calculate percent complete
    const estimatedHours = parseFloat(task.estimated_hours || 0);
    const percentComplete = calculatePercentComplete(totalHours, estimatedHours);

    // Determine status based on progress
    let newStatus = task.status;
    if (totalHours > 0 && task.status === 'pending') {
      newStatus = 'in_progress';
    }
    if (percentComplete >= 100 && task.status !== 'completed') {
      // Don't auto-complete, just mark as ready for review
      // Completion should be explicit
    }

    // Update task
    const updates = {
      actual_hours: totalHours,
    };

    if (percentComplete !== null) {
      updates.percent_complete = percentComplete;
    }

    if (newStatus !== task.status) {
      updates.status = newStatus;
    }

    const { error: updateError } = await supabase
      .from('v2_schedule_tasks')
      .update(updates)
      .eq('id', taskId);

    if (updateError) throw updateError;

    logger.info('Updated task progress from daily log', {
      component: 'ScheduleSync',
      taskId,
      totalHours,
      estimatedHours,
      percentComplete,
      newStatus,
    });

    return { totalHours, percentComplete, status: newStatus };
  } catch (error) {
    logger.error('Failed to update task progress', {
      component: 'ScheduleSync',
      taskId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Sync all tasks affected by a daily log entry
 */
async function syncDailyLogToSchedule(dailyLogId) {
  try {
    // Get all crew entries with schedule tasks
    const { data: crewEntries, error: crewError } = await supabase
      .from('v2_daily_log_crews')
      .select('schedule_task_id')
      .eq('daily_log_id', dailyLogId)
      .not('schedule_task_id', 'is', null);

    if (crewError) throw crewError;

    // Get unique task IDs
    const taskIds = [...new Set(
      (crewEntries || [])
        .map(e => e.schedule_task_id)
        .filter(Boolean)
    )];

    // Update each task
    const results = [];
    for (const taskId of taskIds) {
      const result = await updateTaskProgress(taskId);
      if (result) {
        results.push({ taskId, ...result });
      }
    }

    logger.info('Synced daily log to schedule', {
      component: 'ScheduleSync',
      dailyLogId,
      tasksUpdated: results.length,
    });

    return results;
  } catch (error) {
    logger.error('Failed to sync daily log to schedule', {
      component: 'ScheduleSync',
      dailyLogId,
      error: error.message,
    });
  }
}

/**
 * Handle crew entry change (add/update/delete)
 */
async function handleCrewEntryChange(crewEntryId, taskId) {
  if (taskId) {
    await updateTaskProgress(taskId);
  }
}

/**
 * Recalculate all task progress for a job
 * Use this for full reconciliation
 */
async function syncJobSchedule(jobId) {
  try {
    // Get all schedule tasks for this job
    const { data: tasks, error: taskError } = await supabase
      .from('v2_schedule_tasks')
      .select('id')
      .eq('job_id', jobId);

    if (taskError) throw taskError;

    const results = [];
    for (const task of (tasks || [])) {
      const result = await updateTaskProgress(task.id);
      if (result) {
        results.push({ taskId: task.id, ...result });
      }
    }

    logger.info('Full job schedule sync complete', {
      component: 'ScheduleSync',
      jobId,
      tasksUpdated: results.length,
    });

    return results;
  } catch (error) {
    logger.error('Failed to sync job schedule', {
      component: 'ScheduleSync',
      jobId,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get schedule progress summary for a job
 */
async function getJobScheduleProgress(jobId) {
  try {
    const { data: tasks, error } = await supabase
      .from('v2_schedule_tasks')
      .select('id, name, status, estimated_hours, actual_hours, percent_complete')
      .eq('job_id', jobId);

    if (error) throw error;

    const summary = {
      totalTasks: (tasks || []).length,
      completed: (tasks || []).filter(t => t.status === 'completed').length,
      inProgress: (tasks || []).filter(t => t.status === 'in_progress').length,
      pending: (tasks || []).filter(t => t.status === 'pending').length,
      totalEstimatedHours: (tasks || []).reduce((sum, t) => sum + parseFloat(t.estimated_hours || 0), 0),
      totalActualHours: (tasks || []).reduce((sum, t) => sum + parseFloat(t.actual_hours || 0), 0),
      averagePercentComplete: 0,
    };

    if (summary.totalTasks > 0) {
      const totalPercent = (tasks || []).reduce((sum, t) => sum + (t.percent_complete || 0), 0);
      summary.averagePercentComplete = Math.round(totalPercent / summary.totalTasks);
    }

    return summary;
  } catch (error) {
    logger.error('Failed to get job schedule progress', {
      component: 'ScheduleSync',
      jobId,
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  calculateTaskHours,
  updateTaskProgress,
  syncDailyLogToSchedule,
  handleCrewEntryChange,
  syncJobSchedule,
  getJobScheduleProgress,
};
