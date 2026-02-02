const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');

// ============================================================
// RESOURCE CONFLICTS - Phase 4 Schedule Enhancements
// Detects overlapping resource assignments across tasks/jobs
// ============================================================

// ============================================================
// CONFLICT DETECTION ENDPOINTS
// ============================================================

// GET /api/resource-conflicts - Detect conflicts for a specific job
router.get('/', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id query parameter is required' });
  }

  // Use the RPC function for job-specific conflicts
  const { data: conflicts, error } = await supabase.rpc('get_job_resource_conflicts', {
    p_job_id: job_id
  });

  if (error) throw error;

  // Group conflicts by resource for easier display
  const groupedByResource = (conflicts || []).reduce((acc, conflict) => {
    const key = `${conflict.resource_type}-${conflict.resource_id}`;
    if (!acc[key]) {
      acc[key] = {
        resource_type: conflict.resource_type,
        resource_id: conflict.resource_id,
        resource_name: conflict.resource_name,
        conflicts: []
      };
    }
    acc[key].conflicts.push({
      conflict_id: conflict.conflict_id,
      task_1: {
        id: conflict.task_1_id,
        name: conflict.task_1_name
      },
      task_2: {
        id: conflict.task_2_id,
        name: conflict.task_2_name
      },
      overlap_start: conflict.overlap_start,
      overlap_end: conflict.overlap_end,
      total_allocation: conflict.total_allocation,
      severity: conflict.severity
    });
    return acc;
  }, {});

  // Calculate summary
  const critical = (conflicts || []).filter(c => c.severity === 'critical').length;
  const warning = (conflicts || []).filter(c => c.severity === 'warning').length;

  res.json({
    job_id,
    total_conflicts: (conflicts || []).length,
    critical_count: critical,
    warning_count: warning,
    conflicts: conflicts || [],
    grouped_by_resource: Object.values(groupedByResource)
  });
}));

// GET /api/resource-conflicts/all - Detect conflicts across all active jobs
router.get('/all', asyncHandler(async (req, res) => {
  const { severity, cross_job_only } = req.query;

  // Use the RPC function for all conflicts
  const { data: conflicts, error } = await supabase.rpc('get_all_resource_conflicts');

  if (error) throw error;

  // Filter by severity if requested
  let filteredConflicts = conflicts || [];
  if (severity) {
    filteredConflicts = filteredConflicts.filter(c => c.severity === severity);
  }
  if (cross_job_only === 'true') {
    filteredConflicts = filteredConflicts.filter(c => c.is_cross_job);
  }

  // Group by severity
  const criticalConflicts = filteredConflicts.filter(c => c.severity === 'critical');
  const warningConflicts = filteredConflicts.filter(c => c.severity === 'warning');

  // Group by resource
  const groupedByResource = filteredConflicts.reduce((acc, conflict) => {
    const key = `${conflict.resource_type}-${conflict.resource_id}`;
    if (!acc[key]) {
      acc[key] = {
        resource_type: conflict.resource_type,
        resource_id: conflict.resource_id,
        resource_name: conflict.resource_name,
        conflicts: []
      };
    }
    acc[key].conflicts.push({
      conflict_id: conflict.conflict_id,
      task_1: {
        id: conflict.task_1_id,
        name: conflict.task_1_name,
        job_id: conflict.job_1_id,
        job_name: conflict.job_1_name
      },
      task_2: {
        id: conflict.task_2_id,
        name: conflict.task_2_name,
        job_id: conflict.job_2_id,
        job_name: conflict.job_2_name
      },
      overlap_start: conflict.overlap_start,
      overlap_end: conflict.overlap_end,
      total_allocation: conflict.total_allocation,
      severity: conflict.severity,
      is_cross_job: conflict.is_cross_job
    });
    return acc;
  }, {});

  // Count cross-job conflicts
  const crossJobCount = filteredConflicts.filter(c => c.is_cross_job).length;

  res.json({
    total_conflicts: filteredConflicts.length,
    critical_count: criticalConflicts.length,
    warning_count: warningConflicts.length,
    cross_job_count: crossJobCount,
    conflicts: filteredConflicts,
    grouped_by_resource: Object.values(groupedByResource)
  });
}));

// GET /api/resource-conflicts/check-availability - Check resource availability for date range
router.get('/check-availability', asyncHandler(async (req, res) => {
  const { resource_type, resource_id, start_date, end_date, exclude_task_id } = req.query;

  if (!resource_type || !resource_id || !start_date || !end_date) {
    return res.status(400).json({
      error: 'Required parameters: resource_type, resource_id, start_date, end_date'
    });
  }

  const { data: availability, error } = await supabase.rpc('check_resource_availability', {
    p_resource_type: resource_type,
    p_resource_id: resource_id,
    p_start_date: start_date,
    p_end_date: end_date,
    p_exclude_task_id: exclude_task_id || null
  });

  if (error) throw error;

  // Calculate summary
  const overallocatedDays = (availability || []).filter(d => d.is_overallocated);
  const maxAllocation = Math.max(...(availability || []).map(d => d.total_allocation), 0);
  const avgAllocation = (availability || []).length > 0
    ? Math.round((availability || []).reduce((sum, d) => sum + d.total_allocation, 0) / availability.length)
    : 0;

  res.json({
    resource_type,
    resource_id,
    start_date,
    end_date,
    summary: {
      total_days: (availability || []).length,
      overallocated_days: overallocatedDays.length,
      max_allocation: maxAllocation,
      avg_allocation: avgAllocation,
      is_available: overallocatedDays.length === 0
    },
    daily_allocation: availability || []
  });
}));

// ============================================================
// TASK RESOURCE MANAGEMENT ENDPOINTS
// ============================================================

// GET /api/resource-conflicts/task/:taskId/resources - Get resources assigned to a task
router.get('/task/:taskId/resources', asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const { data: resources, error } = await supabase
    .from('v2_task_resources')
    .select('*')
    .eq('task_id', taskId)
    .order('resource_type')
    .order('resource_name');

  if (error) throw error;

  res.json(resources || []);
}));

// POST /api/resource-conflicts/task/:taskId/resources - Assign resource to a task
router.post('/task/:taskId/resources', asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const {
    resource_type,
    resource_id,
    resource_name,
    allocation_percent,
    start_date,
    end_date,
    notes
  } = req.body;

  // Validate required fields
  if (!resource_type || !resource_id) {
    return res.status(400).json({ error: 'resource_type and resource_id are required' });
  }

  if (!['crew', 'equipment', 'subcontractor'].includes(resource_type)) {
    return res.status(400).json({ error: 'resource_type must be crew, equipment, or subcontractor' });
  }

  // Verify task exists
  const { data: task, error: taskError } = await supabase
    .from('v2_schedule_tasks')
    .select('id, name, planned_start, planned_end')
    .eq('id', taskId)
    .single();

  if (taskError || !task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  // Get resource name if not provided
  let finalResourceName = resource_name;
  if (!finalResourceName) {
    if (resource_type === 'crew') {
      const { data: crew } = await supabase
        .from('v2_crew_members')
        .select('name')
        .eq('id', resource_id)
        .single();
      finalResourceName = crew?.name || 'Unknown Crew';
    } else if (resource_type === 'subcontractor') {
      const { data: vendor } = await supabase
        .from('v2_vendors')
        .select('name')
        .eq('id', resource_id)
        .single();
      finalResourceName = vendor?.name || 'Unknown Subcontractor';
    } else {
      finalResourceName = 'Equipment';
    }
  }

  // Insert resource assignment
  const { data: assignment, error } = await supabase
    .from('v2_task_resources')
    .insert({
      task_id: taskId,
      resource_type,
      resource_id,
      resource_name: finalResourceName,
      allocation_percent: allocation_percent || 100,
      start_date: start_date || null,
      end_date: end_date || null,
      notes
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'This resource is already assigned to this task' });
    }
    throw error;
  }

  // Check for new conflicts created by this assignment
  const effectiveStart = start_date || task.planned_start;
  const effectiveEnd = end_date || task.planned_end;

  if (effectiveStart && effectiveEnd) {
    const { data: conflicts } = await supabase.rpc('check_resource_availability', {
      p_resource_type: resource_type,
      p_resource_id: resource_id,
      p_start_date: effectiveStart,
      p_end_date: effectiveEnd
    });

    const hasConflicts = (conflicts || []).some(d => d.is_overallocated);

    if (hasConflicts) {
      return res.status(201).json({
        ...assignment,
        warning: 'Resource assignment creates scheduling conflicts',
        conflicts_detected: true
      });
    }
  }

  res.status(201).json(assignment);
}));

// PATCH /api/resource-conflicts/task/:taskId/resources/:resourceId - Update resource assignment
router.patch('/task/:taskId/resources/:resourceId', asyncHandler(async (req, res) => {
  const { taskId, resourceId } = req.params;
  const { allocation_percent, start_date, end_date, notes } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (allocation_percent !== undefined) updates.allocation_percent = allocation_percent;
  if (start_date !== undefined) updates.start_date = start_date;
  if (end_date !== undefined) updates.end_date = end_date;
  if (notes !== undefined) updates.notes = notes;

  const { data: assignment, error } = await supabase
    .from('v2_task_resources')
    .update(updates)
    .eq('id', resourceId)
    .eq('task_id', taskId)
    .select()
    .single();

  if (error) throw error;

  if (!assignment) {
    return res.status(404).json({ error: 'Resource assignment not found' });
  }

  res.json(assignment);
}));

// DELETE /api/resource-conflicts/task/:taskId/resources/:resourceId - Remove resource from task
router.delete('/task/:taskId/resources/:resourceId', asyncHandler(async (req, res) => {
  const { taskId, resourceId } = req.params;

  const { error } = await supabase
    .from('v2_task_resources')
    .delete()
    .eq('id', resourceId)
    .eq('task_id', taskId);

  if (error) throw error;

  res.json({ success: true });
}));

// ============================================================
// RESOURCE LISTING ENDPOINTS
// ============================================================

// GET /api/resource-conflicts/resources - List available resources by type
router.get('/resources', asyncHandler(async (req, res) => {
  const { type } = req.query;

  const resources = {
    crews: [],
    subcontractors: [],
    equipment: []
  };

  // Get crews
  if (!type || type === 'crew') {
    const { data: crews } = await supabase
      .from('v2_crew_members')
      .select('id, name, role, skills')
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name');
    resources.crews = (crews || []).map(c => ({
      id: c.id,
      name: c.name,
      type: 'crew',
      role: c.role,
      skills: c.skills
    }));
  }

  // Get subcontractors (vendors)
  if (!type || type === 'subcontractor') {
    const { data: vendors } = await supabase
      .from('v2_vendors')
      .select('id, name')
      .is('deleted_at', null)
      .order('name');
    resources.subcontractors = (vendors || []).map(v => ({
      id: v.id,
      name: v.name,
      type: 'subcontractor'
    }));
  }

  // Note: Equipment table doesn't exist yet, return empty for now
  // Can be extended when equipment management is added

  if (type) {
    // Return only the requested type
    const typeMap = {
      crew: resources.crews,
      subcontractor: resources.subcontractors,
      equipment: resources.equipment
    };
    return res.json(typeMap[type] || []);
  }

  res.json(resources);
}));

// GET /api/resource-conflicts/resources/:resourceType/:resourceId/assignments - Get all task assignments for a resource
router.get('/resources/:resourceType/:resourceId/assignments', asyncHandler(async (req, res) => {
  const { resourceType, resourceId } = req.params;
  const { include_completed } = req.query;

  let query = supabase
    .from('v2_task_resources')
    .select(`
      *,
      task:v2_schedule_tasks(
        id, name, status, planned_start, planned_end,
        schedule:v2_schedules(
          id, job_id,
          job:v2_jobs(id, name)
        )
      )
    `)
    .eq('resource_type', resourceType)
    .eq('resource_id', resourceId);

  const { data: assignments, error } = await query;

  if (error) throw error;

  // Filter out completed tasks unless requested
  let filtered = assignments || [];
  if (include_completed !== 'true') {
    filtered = filtered.filter(a =>
      a.task && !['complete', 'skipped'].includes(a.task.status)
    );
  }

  // Format response
  const formattedAssignments = filtered.map(a => ({
    assignment_id: a.id,
    task_id: a.task_id,
    task_name: a.task?.name,
    task_status: a.task?.status,
    job_id: a.task?.schedule?.job_id,
    job_name: a.task?.schedule?.job?.name,
    allocation_percent: a.allocation_percent,
    start_date: a.start_date || a.task?.planned_start,
    end_date: a.end_date || a.task?.planned_end,
    notes: a.notes
  }));

  res.json({
    resource_type: resourceType,
    resource_id: resourceId,
    total_assignments: formattedAssignments.length,
    assignments: formattedAssignments
  });
}));

module.exports = router;
