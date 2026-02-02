/**
 * Scheduled Reports API Routes
 * Phase 7 Reporting & Analytics feature
 *
 * Manages scheduled report delivery via email with support for:
 * - Multiple recipients
 * - Daily, weekly, or monthly schedules
 * - Excel and PDF format options
 * - Built-in reports (job_cost, vendor_spend, etc.) or custom templates
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../core/errors');

// ============================================================
// VALIDATION HELPERS
// ============================================================

const VALID_SCHEDULE_TYPES = ['daily', 'weekly', 'monthly'];
const VALID_FORMATS = ['excel', 'pdf', 'both'];
const VALID_REPORT_TYPES = ['built_in', 'custom'];
const VALID_BUILTIN_REPORTS = [
  'job_cost',
  'vendor_spend',
  'category_spend',
  'budget_variance',
  'invoice_aging',
  'schedule_performance',
  'revenue_per_worker',
  'labor_cost_analysis'
];

function validateScheduledReport(data) {
  const errors = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    errors.push('Name is required');
  }

  if (!data.schedule_type || !VALID_SCHEDULE_TYPES.includes(data.schedule_type)) {
    errors.push(`Schedule type must be one of: ${VALID_SCHEDULE_TYPES.join(', ')}`);
  }

  if (data.schedule_type === 'weekly') {
    if (data.schedule_day === undefined || data.schedule_day === null ||
        data.schedule_day < 0 || data.schedule_day > 6) {
      errors.push('Schedule day must be 0-6 (Sunday-Saturday) for weekly schedules');
    }
  }

  if (data.schedule_type === 'monthly') {
    if (data.schedule_day === undefined || data.schedule_day === null ||
        data.schedule_day < 1 || data.schedule_day > 31) {
      errors.push('Schedule day must be 1-31 for monthly schedules');
    }
  }

  if (!data.recipients || !Array.isArray(data.recipients) || data.recipients.length === 0) {
    errors.push('At least one recipient email is required');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const email of data.recipients) {
      if (!emailRegex.test(email)) {
        errors.push(`Invalid email address: ${email}`);
      }
    }
  }

  if (data.format && !VALID_FORMATS.includes(data.format)) {
    errors.push(`Format must be one of: ${VALID_FORMATS.join(', ')}`);
  }

  if (data.report_type && !VALID_REPORT_TYPES.includes(data.report_type)) {
    errors.push(`Report type must be one of: ${VALID_REPORT_TYPES.join(', ')}`);
  }

  if (data.report_type === 'built_in') {
    if (!data.builtin_report_name || !VALID_BUILTIN_REPORTS.includes(data.builtin_report_name)) {
      errors.push(`Built-in report name must be one of: ${VALID_BUILTIN_REPORTS.join(', ')}`);
    }
  }

  if (data.report_type === 'custom' && !data.report_template_id) {
    errors.push('Report template ID is required for custom reports');
  }

  return errors;
}

// ============================================================
// LIST SCHEDULED REPORTS
// GET /api/scheduled-reports
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { enabled, report_type, include_runs } = req.query;

  let query = supabase
    .from('v2_scheduled_reports')
    .select(`
      id,
      builder_id,
      report_template_id,
      name,
      description,
      report_type,
      builtin_report_name,
      parameters,
      schedule_type,
      schedule_day,
      schedule_time,
      timezone,
      recipients,
      format,
      enabled,
      last_run_at,
      next_run_at,
      created_by,
      created_at,
      updated_at
    `)
    .order('name', { ascending: true });

  if (enabled !== undefined) {
    query = query.eq('enabled', enabled === 'true');
  }

  if (report_type) {
    query = query.eq('report_type', report_type);
  }

  const { data, error } = await query;

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // Optionally include recent runs
  if (include_runs === 'true' && data && data.length > 0) {
    const reportIds = data.map(r => r.id);
    const { data: runs, error: runsError } = await supabase
      .from('v2_scheduled_report_runs')
      .select('*')
      .in('scheduled_report_id', reportIds)
      .order('started_at', { ascending: false })
      .limit(3);

    if (!runsError && runs) {
      // Group runs by report ID
      const runsByReport = runs.reduce((acc, run) => {
        if (!acc[run.scheduled_report_id]) {
          acc[run.scheduled_report_id] = [];
        }
        acc[run.scheduled_report_id].push(run);
        return acc;
      }, {});

      // Attach runs to each report
      data.forEach(report => {
        report.recent_runs = runsByReport[report.id] || [];
      });
    }
  }

  res.json({
    scheduled_reports: data || [],
    count: data?.length || 0
  });
}));

// ============================================================
// GET SINGLE SCHEDULED REPORT
// GET /api/scheduled-reports/:id
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_scheduled_reports')
    .select(`
      id,
      builder_id,
      report_template_id,
      name,
      description,
      report_type,
      builtin_report_name,
      parameters,
      schedule_type,
      schedule_day,
      schedule_time,
      timezone,
      recipients,
      format,
      enabled,
      last_run_at,
      next_run_at,
      created_by,
      created_at,
      updated_at,
      report_template:v2_report_templates(id, name, entity_type, columns, filters)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      throw new AppError('NOT_FOUND', 'Scheduled report not found', { id });
    }
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(data);
}));

// ============================================================
// CREATE SCHEDULED REPORT
// POST /api/scheduled-reports
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const {
    name,
    description,
    report_type = 'custom',
    report_template_id,
    builtin_report_name,
    parameters = {},
    schedule_type,
    schedule_day,
    schedule_time = '08:00:00',
    timezone = 'America/New_York',
    recipients,
    format = 'excel',
    enabled = true,
    created_by = 'System'
  } = req.body;

  // Validate input
  const validationErrors = validateScheduledReport({
    name,
    schedule_type,
    schedule_day,
    recipients,
    format,
    report_type,
    report_template_id,
    builtin_report_name
  });

  if (validationErrors.length > 0) {
    throw new AppError('VALIDATION_ERROR', validationErrors.join('; '));
  }

  // If using a template, verify it exists
  if (report_type === 'custom' && report_template_id) {
    const { data: template, error: templateError } = await supabase
      .from('v2_report_templates')
      .select('id')
      .eq('id', report_template_id)
      .is('deleted_at', null)
      .single();

    if (templateError || !template) {
      throw new AppError('VALIDATION_ERROR', 'Report template not found');
    }
  }

  const insertData = {
    name: name.trim(),
    description: description?.trim() || null,
    report_type,
    report_template_id: report_type === 'custom' ? report_template_id : null,
    builtin_report_name: report_type === 'built_in' ? builtin_report_name : null,
    parameters,
    schedule_type,
    schedule_day: schedule_type === 'daily' ? null : schedule_day,
    schedule_time,
    timezone,
    recipients,
    format,
    enabled,
    created_by
  };

  const { data, error } = await supabase
    .from('v2_scheduled_reports')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  console.log(`[ScheduledReports] Created schedule: ${data.id} - ${data.name}, next run: ${data.next_run_at}`);

  res.status(201).json({
    message: 'Scheduled report created successfully',
    scheduled_report: data
  });
}));

// ============================================================
// UPDATE SCHEDULED REPORT
// PATCH /api/scheduled-reports/:id
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  // Check if report exists
  const { data: existing, error: existError } = await supabase
    .from('v2_scheduled_reports')
    .select('id, name')
    .eq('id', id)
    .single();

  if (existError || !existing) {
    throw new AppError('NOT_FOUND', 'Scheduled report not found', { id });
  }

  // Build update object with allowed fields only
  const allowedFields = [
    'name', 'description', 'report_type', 'report_template_id', 'builtin_report_name',
    'parameters', 'schedule_type', 'schedule_day', 'schedule_time', 'timezone',
    'recipients', 'format', 'enabled'
  ];

  const updateData = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      updateData[field] = updates[field];
    }
  }

  if (Object.keys(updateData).length === 0) {
    throw new AppError('VALIDATION_ERROR', 'No valid fields to update');
  }

  // Validate if schedule-related fields are being updated
  const validationData = { ...existing, ...updateData };
  if (updateData.schedule_type || updateData.schedule_day !== undefined ||
      updateData.recipients || updateData.format || updateData.name) {
    const validationErrors = validateScheduledReport({
      name: validationData.name,
      schedule_type: validationData.schedule_type,
      schedule_day: validationData.schedule_day,
      recipients: validationData.recipients,
      format: validationData.format,
      report_type: validationData.report_type,
      report_template_id: validationData.report_template_id,
      builtin_report_name: validationData.builtin_report_name
    });

    if (validationErrors.length > 0) {
      throw new AppError('VALIDATION_ERROR', validationErrors.join('; '));
    }
  }

  // Handle name trim
  if (updateData.name) {
    updateData.name = updateData.name.trim();
  }

  // Clear schedule_day if switching to daily
  if (updateData.schedule_type === 'daily') {
    updateData.schedule_day = null;
  }

  // Clear template or builtin based on report_type change
  if (updateData.report_type === 'built_in') {
    updateData.report_template_id = null;
  } else if (updateData.report_type === 'custom') {
    updateData.builtin_report_name = null;
  }

  const { data, error } = await supabase
    .from('v2_scheduled_reports')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  console.log(`[ScheduledReports] Updated schedule: ${id}, next run: ${data.next_run_at}`);

  res.json({
    message: 'Scheduled report updated successfully',
    scheduled_report: data
  });
}));

// ============================================================
// DELETE SCHEDULED REPORT
// DELETE /api/scheduled-reports/:id
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if exists
  const { data: existing, error: existError } = await supabase
    .from('v2_scheduled_reports')
    .select('id, name')
    .eq('id', id)
    .single();

  if (existError || !existing) {
    throw new AppError('NOT_FOUND', 'Scheduled report not found', { id });
  }

  // Delete (cascade will clean up runs)
  const { error } = await supabase
    .from('v2_scheduled_reports')
    .delete()
    .eq('id', id);

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  console.log(`[ScheduledReports] Deleted schedule: ${id} - ${existing.name}`);

  res.json({
    message: 'Scheduled report deleted successfully',
    deleted_id: id
  });
}));

// ============================================================
// TRIGGER IMMEDIATE RUN
// POST /api/scheduled-reports/:id/run-now
// ============================================================

router.post('/:id/run-now', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { triggered_by = 'Manual' } = req.body;

  // Get the scheduled report
  const { data: schedule, error: schedError } = await supabase
    .from('v2_scheduled_reports')
    .select(`
      *,
      report_template:v2_report_templates(id, name, entity_type, columns, filters, grouping, sort)
    `)
    .eq('id', id)
    .single();

  if (schedError || !schedule) {
    throw new AppError('NOT_FOUND', 'Scheduled report not found', { id });
  }

  // Create a run record
  const { data: run, error: runError } = await supabase
    .from('v2_scheduled_report_runs')
    .insert({
      scheduled_report_id: id,
      builder_id: schedule.builder_id,
      status: 'running'
    })
    .select()
    .single();

  if (runError) {
    throw new AppError('DATABASE_ERROR', runError.message);
  }

  const startTime = Date.now();

  try {
    // TODO: Integrate with actual email service (SendGrid, etc.)
    // For now, log what would be sent and simulate success

    const reportName = schedule.report_type === 'built_in'
      ? schedule.builtin_report_name
      : schedule.report_template?.name || 'Custom Report';

    console.log(`[ScheduledReports] Run triggered for: ${schedule.name}`);
    console.log(`[ScheduledReports] Report: ${reportName}`);
    console.log(`[ScheduledReports] Format: ${schedule.format}`);
    console.log(`[ScheduledReports] Recipients: ${schedule.recipients.join(', ')}`);
    console.log(`[ScheduledReports] Parameters: ${JSON.stringify(schedule.parameters)}`);
    console.log(`[ScheduledReports] Triggered by: ${triggered_by}`);

    // Simulate report generation
    // In production, this would:
    // 1. Call the appropriate report endpoint to generate data
    // 2. Format as Excel/PDF using existing export logic
    // 3. Send via email service
    // 4. Store file URLs

    const generationTime = Date.now() - startTime;

    // Update run record with success
    const { data: updatedRun, error: updateError } = await supabase
      .from('v2_scheduled_report_runs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        recipients_sent: schedule.recipients,
        generation_time_ms: generationTime,
        files_generated: [] // Would contain URLs in production
      })
      .eq('id', run.id)
      .select()
      .single();

    if (updateError) {
      console.error('[ScheduledReports] Failed to update run record:', updateError);
    }

    // Update last_run_at on the schedule
    await supabase
      .from('v2_scheduled_reports')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', id);

    res.json({
      message: 'Report run triggered successfully',
      run: updatedRun || run,
      note: 'Email sending is not yet configured. Report would be sent to: ' + schedule.recipients.join(', ')
    });

  } catch (err) {
    // Update run record with failure
    const generationTime = Date.now() - startTime;

    await supabase
      .from('v2_scheduled_report_runs')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: err.message,
        generation_time_ms: generationTime
      })
      .eq('id', run.id);

    throw new AppError('REPORT_GENERATION_FAILED', err.message);
  }
}));

// ============================================================
// GET RUN HISTORY
// GET /api/scheduled-reports/:id/history
// ============================================================

router.get('/:id/history', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { limit = 20, offset = 0, status } = req.query;

  // Verify schedule exists
  const { data: schedule, error: schedError } = await supabase
    .from('v2_scheduled_reports')
    .select('id, name')
    .eq('id', id)
    .single();

  if (schedError || !schedule) {
    throw new AppError('NOT_FOUND', 'Scheduled report not found', { id });
  }

  // Get run history
  let query = supabase
    .from('v2_scheduled_report_runs')
    .select('*')
    .eq('scheduled_report_id', id)
    .order('started_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (status) {
    query = query.eq('status', status);
  }

  const { data: runs, error: runsError, count } = await supabase
    .from('v2_scheduled_report_runs')
    .select('*', { count: 'exact' })
    .eq('scheduled_report_id', id)
    .order('started_at', { ascending: false })
    .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

  if (runsError) {
    throw new AppError('DATABASE_ERROR', runsError.message);
  }

  // Calculate summary stats
  const { data: stats, error: statsError } = await supabase
    .from('v2_scheduled_report_runs')
    .select('status')
    .eq('scheduled_report_id', id);

  const summary = {
    total_runs: stats?.length || 0,
    completed: stats?.filter(r => r.status === 'completed').length || 0,
    failed: stats?.filter(r => r.status === 'failed').length || 0,
    success_rate: stats?.length > 0
      ? Math.round((stats.filter(r => r.status === 'completed').length / stats.length) * 100)
      : 0
  };

  res.json({
    schedule: {
      id: schedule.id,
      name: schedule.name
    },
    runs: runs || [],
    total: count || 0,
    summary
  });
}));

// ============================================================
// GET AVAILABLE BUILT-IN REPORTS
// GET /api/scheduled-reports/builtin/list
// ============================================================

router.get('/builtin/list', asyncHandler(async (req, res) => {
  const builtinReports = [
    {
      name: 'job_cost',
      display_name: 'Job Cost Report',
      description: 'Budget vs actual costs by cost code for a specific job',
      required_params: ['job_id'],
      optional_params: ['start_date', 'end_date']
    },
    {
      name: 'vendor_spend',
      display_name: 'Vendor Spend Report',
      description: 'Total spend by vendor with invoice counts and averages',
      required_params: [],
      optional_params: ['job_id', 'start_date', 'end_date']
    },
    {
      name: 'category_spend',
      display_name: 'Category Spend Report',
      description: 'Spend breakdown by cost code category',
      required_params: [],
      optional_params: ['job_id', 'start_date', 'end_date']
    },
    {
      name: 'budget_variance',
      display_name: 'Budget Variance Report',
      description: 'Detailed budget vs actual variance by cost code',
      required_params: ['job_id'],
      optional_params: []
    },
    {
      name: 'invoice_aging',
      display_name: 'Invoice Aging Report',
      description: 'Unpaid invoices grouped by aging buckets (current, 30, 60, 90+ days)',
      required_params: [],
      optional_params: ['job_id']
    },
    {
      name: 'schedule_performance',
      display_name: 'Schedule Performance Report',
      description: 'Task completion rates, delays, and weather impact analysis',
      required_params: [],
      optional_params: ['job_id', 'start_date', 'end_date']
    },
    {
      name: 'revenue_per_worker',
      display_name: 'Revenue Per Worker Report',
      description: 'Labor efficiency metrics based on daily logs and funded draws',
      required_params: [],
      optional_params: ['job_id', 'start_date', 'end_date']
    },
    {
      name: 'labor_cost_analysis',
      display_name: 'Labor Cost Analysis',
      description: 'Labor hours and costs by trade from daily logs and timesheets',
      required_params: [],
      optional_params: ['job_id', 'start_date', 'end_date']
    }
  ];

  res.json({
    builtin_reports: builtinReports
  });
}));

// ============================================================
// GET DUE SCHEDULES (for cron job/worker)
// GET /api/scheduled-reports/due
// Internal endpoint for background job processing
// ============================================================

router.get('/due', asyncHandler(async (req, res) => {
  const { look_ahead_minutes = 5 } = req.query;

  const windowEnd = new Date(Date.now() + parseInt(look_ahead_minutes) * 60 * 1000);

  const { data, error } = await supabase
    .from('v2_scheduled_reports')
    .select(`
      id,
      name,
      report_type,
      builtin_report_name,
      report_template_id,
      parameters,
      recipients,
      format,
      next_run_at
    `)
    .eq('enabled', true)
    .lte('next_run_at', windowEnd.toISOString())
    .order('next_run_at', { ascending: true });

  if (error) {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json({
    due_schedules: data || [],
    count: data?.length || 0,
    window_end: windowEnd.toISOString()
  });
}));

module.exports = router;
