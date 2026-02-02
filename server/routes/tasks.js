/**
 * Tasks API Routes
 * Manages tasks, checklists, comments, and assignments
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { getBuilderId } = require('../core/multi-tenant');

// Async handler wrapper
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Helper to apply builder filter
const withBuilderFilter = (query, builderId) => {
  if (builderId) {
    return query.eq('builder_id', builderId);
  }
  return query;
};

// ============================================================
// TASKS
// ============================================================

/**
 * GET /api/tasks
 * List tasks with optional filters
 */
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, assigned_to, priority, type, due_before, parent_task_id } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_tasks')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  query = withBuilderFilter(query, builderId);

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (assigned_to) query = query.eq('assigned_to', assigned_to);
  if (priority) query = query.eq('priority', priority);
  if (type) query = query.eq('type', type);
  if (due_before) query = query.lte('due_date', due_before);
  if (parent_task_id === 'null') {
    query = query.is('parent_task_id', null);
  } else if (parent_task_id) {
    query = query.eq('parent_task_id', parent_task_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/tasks/stats
 * Get task statistics
 */
router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_tasks')
    .select('status, priority, due_date')
    .is('deleted_at', null);

  query = withBuilderFilter(query, builderId);
  if (job_id) query = query.eq('job_id', job_id);

  const { data, error } = await query;
  if (error) throw error;

  const today = new Date().toISOString().split('T')[0];

  const stats = {
    total: data?.length || 0,
    todo: 0,
    in_progress: 0,
    on_hold: 0,
    completed: 0,
    cancelled: 0,
    overdue: 0
  };

  (data || []).forEach(task => {
    if (stats[task.status] !== undefined) stats[task.status]++;
    if (task.due_date && task.due_date < today && !['completed', 'cancelled'].includes(task.status)) {
      stats.overdue++;
    }
  });

  res.json(stats);
}));

/**
 * GET /api/tasks/my-tasks
 * Get current user's tasks
 */
router.get('/my-tasks', asyncHandler(async (req, res) => {
  const { assigned_to = 'Jake Ross' } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_tasks')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('assigned_to', assigned_to)
    .is('deleted_at', null)
    .not('status', 'in', '("completed","cancelled")')
    .order('due_date', { ascending: true, nullsLast: true });

  query = withBuilderFilter(query, builderId);

  const { data, error } = await query;
  if (error) throw error;
  res.json(data);
}));

/**
 * GET /api/tasks/:id
 * Get a single task with checklists, comments, and subtasks
 */
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  // Get task
  let taskQuery = supabase
    .from('v2_tasks')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', id)
    .is('deleted_at', null);

  taskQuery = withBuilderFilter(taskQuery, builderId);
  const { data: task, error: taskError } = await taskQuery.single();

  if (taskError) throw taskError;
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Get checklists
  const { data: checklists } = await supabase
    .from('v2_task_checklists')
    .select('*')
    .eq('task_id', id)
    .order('item_order');

  // Get comments
  const { data: comments } = await supabase
    .from('v2_task_comments')
    .select('*')
    .eq('task_id', id)
    .order('created_at', { ascending: false });

  // Get attachments
  const { data: attachments } = await supabase
    .from('v2_task_attachments')
    .select('*')
    .eq('task_id', id)
    .order('created_at');

  // Get subtasks
  let subtasksQuery = supabase
    .from('v2_tasks')
    .select('*')
    .eq('parent_task_id', id)
    .is('deleted_at', null)
    .order('created_at');

  subtasksQuery = withBuilderFilter(subtasksQuery, builderId);
  const { data: subtasks } = await subtasksQuery;

  res.json({
    ...task,
    checklists: checklists || [],
    comments: comments || [],
    attachments: attachments || [],
    subtasks: subtasks || []
  });
}));

/**
 * POST /api/tasks
 * Create a new task
 */
router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    title,
    description,
    type,
    category,
    priority,
    assigned_to,
    assignee_id,
    created_by,
    due_date,
    start_date,
    parent_task_id,
    estimated_hours,
    tags,
    notes
  } = req.body;
  const builderId = getBuilderId(req);

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const insertData = {
    job_id: job_id || null,
    title,
    description,
    type: type || 'task',
    category,
    priority: priority || 'normal',
    assigned_to,
    assignee_id: assignee_id || null,
    created_by: created_by || 'Jake Ross',
    due_date,
    start_date,
    parent_task_id: parent_task_id || null,
    estimated_hours: estimated_hours || null,
    tags,
    notes,
    status: 'todo'
  };

  // Add builder_id if available
  if (builderId) {
    insertData.builder_id = builderId;
  }

  const { data, error } = await supabase
    .from('v2_tasks')
    .insert(insertData)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/tasks/:id
 * Update a task
 */
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);
  const updates = req.body;

  delete updates.id;
  delete updates.created_at;
  delete updates.task_number;
  delete updates.builder_id; // Don't allow builder_id to be changed

  // If marking as completed, set completed_at
  if (updates.status === 'completed' && !updates.completed_at) {
    updates.completed_at = new Date().toISOString();
    updates.progress = 100;
  }

  // If unmarking as completed, clear completed_at
  if (updates.status && updates.status !== 'completed') {
    updates.completed_at = null;
  }

  let query = supabase
    .from('v2_tasks')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null);

  query = withBuilderFilter(query, builderId);

  const { data, error } = await query
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(data);
}));

/**
 * POST /api/tasks/:id/complete
 * Mark task as completed
 */
router.post('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_tasks')
    .update({
      status: 'completed',
      progress: 100,
      completed_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null);

  query = withBuilderFilter(query, builderId);

  const { data, error } = await query.select().single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(data);
}));

/**
 * POST /api/tasks/:id/reopen
 * Reopen a completed task
 */
router.post('/:id/reopen', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_tasks')
    .update({
      status: 'todo',
      completed_at: null
    })
    .eq('id', id)
    .is('deleted_at', null);

  query = withBuilderFilter(query, builderId);

  const { data, error } = await query.select().single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json(data);
}));

/**
 * DELETE /api/tasks/:id
 * Soft delete a task
 */
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_tasks')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null);

  query = withBuilderFilter(query, builderId);

  const { data, error } = await query.select().single();

  if (error) throw error;
  if (!data) {
    return res.status(404).json({ error: 'Task not found' });
  }

  res.json({ success: true, message: 'Task deleted' });
}));

// ============================================================
// CHECKLISTS
// ============================================================

/**
 * POST /api/tasks/:id/checklists
 * Add checklist item
 */
router.post('/:id/checklists', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;

  if (!description) {
    return res.status(400).json({ error: 'Description is required' });
  }

  // Get next order
  const { data: existing } = await supabase
    .from('v2_task_checklists')
    .select('item_order')
    .eq('task_id', id)
    .order('item_order', { ascending: false })
    .limit(1);

  const nextOrder = (existing?.[0]?.item_order || 0) + 1;

  const { data, error } = await supabase
    .from('v2_task_checklists')
    .insert({
      task_id: id,
      item_order: nextOrder,
      description
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * PATCH /api/tasks/:taskId/checklists/:checklistId
 * Toggle checklist item
 */
router.patch('/:taskId/checklists/:checklistId', asyncHandler(async (req, res) => {
  const { checklistId } = req.params;
  const { is_completed, completed_by } = req.body;

  const updates = {
    is_completed,
    completed_at: is_completed ? new Date().toISOString() : null,
    completed_by: is_completed ? (completed_by || 'Jake Ross') : null
  };

  const { data, error } = await supabase
    .from('v2_task_checklists')
    .update(updates)
    .eq('id', checklistId)
    .select()
    .single();

  if (error) throw error;
  res.json(data);
}));

/**
 * DELETE /api/tasks/:taskId/checklists/:checklistId
 * Delete checklist item
 */
router.delete('/:taskId/checklists/:checklistId', asyncHandler(async (req, res) => {
  const { checklistId } = req.params;

  const { error } = await supabase
    .from('v2_task_checklists')
    .delete()
    .eq('id', checklistId);

  if (error) throw error;
  res.json({ success: true, message: 'Checklist item deleted' });
}));

// ============================================================
// COMMENTS
// ============================================================

/**
 * POST /api/tasks/:id/comments
 * Add comment
 */
router.post('/:id/comments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { content, author } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'Content is required' });
  }

  const { data, error } = await supabase
    .from('v2_task_comments')
    .insert({
      task_id: id,
      content,
      author: author || 'Jake Ross'
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /api/tasks/:taskId/comments/:commentId
 * Delete comment
 */
router.delete('/:taskId/comments/:commentId', asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const { error } = await supabase
    .from('v2_task_comments')
    .delete()
    .eq('id', commentId);

  if (error) throw error;
  res.json({ success: true, message: 'Comment deleted' });
}));

// ============================================================
// ATTACHMENTS
// ============================================================

/**
 * POST /api/tasks/:id/attachments
 * Add attachment
 */
router.post('/:id/attachments', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, file_url, file_type, file_size, uploaded_by } = req.body;

  if (!name || !file_url) {
    return res.status(400).json({ error: 'Name and file URL are required' });
  }

  const { data, error } = await supabase
    .from('v2_task_attachments')
    .insert({
      task_id: id,
      name,
      file_url,
      file_type,
      file_size,
      uploaded_by: uploaded_by || 'Jake Ross'
    })
    .select()
    .single();

  if (error) throw error;
  res.status(201).json(data);
}));

/**
 * DELETE /api/tasks/:taskId/attachments/:attachmentId
 * Delete attachment
 */
router.delete('/:taskId/attachments/:attachmentId', asyncHandler(async (req, res) => {
  const { attachmentId } = req.params;

  const { error } = await supabase
    .from('v2_task_attachments')
    .delete()
    .eq('id', attachmentId);

  if (error) throw error;
  res.json({ success: true, message: 'Attachment deleted' });
}));

module.exports = router;
