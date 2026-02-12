/**
 * Daily Logs Routes
 * Daily site activity tracking endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const logger = require('../utils/logger');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');
const { processDailyLogIntelligence } = require('../services/daily-log-intelligence');
const scheduleSync = require('../services/schedule-sync');

// Configure multer for photo uploads
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for photos
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and HEIC images are allowed'), false);
    }
  }
});

// Use existing 'invoices' bucket with subfolder for photos
const PHOTO_BUCKET = 'invoices';
const PHOTO_PREFIX = 'daily-log-photos';

// ============================================================
// WEATHER API HELPER
// ============================================================

// Map Open-Meteo weather codes to our conditions
function mapWeatherCode(code) {
  // WMO Weather interpretation codes
  // https://open-meteo.com/en/docs
  if (code === 0) return 'sunny';
  if (code >= 1 && code <= 3) return 'partly_cloudy';
  if (code >= 45 && code <= 48) return 'cloudy'; // Fog
  if (code >= 51 && code <= 67) return 'rainy'; // Drizzle & Rain
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rainy'; // Rain showers
  if (code >= 85 && code <= 86) return 'snow'; // Snow showers
  if (code >= 95 && code <= 99) return 'stormy'; // Thunderstorm
  return 'cloudy';
}

// Geocode an address using Open-Meteo's geocoding API
async function geocodeAddress(address) {
  try {
    // Try original address first
    let encoded = encodeURIComponent(address);
    let response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=1&language=en&format=json`);
    let data = await response.json();

    if (data.results && data.results.length > 0) {
      return {
        lat: data.results[0].latitude,
        lon: data.results[0].longitude,
        name: data.results[0].name
      };
    }

    // Try with Florida context (Ross Built is FL-based)
    encoded = encodeURIComponent(address + ', Florida');
    response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=1&language=en&format=json`);
    data = await response.json();

    if (data.results && data.results.length > 0) {
      return {
        lat: data.results[0].latitude,
        lon: data.results[0].longitude,
        name: data.results[0].name
      };
    }

    // Try extracting city name from job name or use Sarasota as default (Ross Built HQ)
    // Default to Sarasota, FL coordinates if geocoding fails
    logger.debug('Geocoding failed, using Sarasota FL default', { component: 'DailyLog' });
    return {
      lat: 27.3364,
      lon: -82.5307,
      name: 'Sarasota, FL (default)'
    };
  } catch (err) {
    logger.error('Geocoding error', { component: 'DailyLog', error: err.message });
    // Return Sarasota as fallback
    return {
      lat: 27.3364,
      lon: -82.5307,
      name: 'Sarasota, FL (default)'
    };
  }
}

// Fetch weather for coordinates
async function fetchWeatherForCoords(lat, lon) {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`
    );
    const data = await response.json();

    if (data.current && data.daily) {
      return {
        conditions: mapWeatherCode(data.current.weather_code),
        temperature_current: Math.round(data.current.temperature_2m),
        temperature_high: Math.round(data.daily.temperature_2m_max[0]),
        temperature_low: Math.round(data.daily.temperature_2m_min[0])
      };
    }
    return null;
  } catch (err) {
    logger.error('Weather fetch error', { component: 'DailyLog', error: err.message });
    return null;
  }
}

// Helper: Log daily log activity
async function logDailyLogActivity(dailyLogId, action, performedBy, details = {}, builderId = null) {
  try {
    const record = {
      daily_log_id: dailyLogId,
      action,
      performed_by: performedBy,
      details
    };
    if (builderId) record.builder_id = builderId;
    await supabase.from('v2_daily_log_activity').insert(record);
  } catch (err) {
    logger.error('Failed to log daily log activity', { component: 'DailyLog', dailyLogId, error: err.message });
  }
}

// Helper: Update schedule task progress from crew entries
async function updateScheduleTaskProgress(crewEntries, dailyLogId = null) {
  // Get unique schedule_task_ids from crew entries
  const taskIds = [...new Set(
    crewEntries
      .filter(e => e.schedule_task_id)
      .map(e => e.schedule_task_id)
  )];

  if (taskIds.length === 0) return;

  // Use schedule-sync service for comprehensive hours tracking
  for (const taskId of taskIds) {
    try {
      await scheduleSync.updateTaskProgress(taskId);
    } catch (err) {
      logger.error('Failed to sync schedule task via schedule-sync', {
        component: 'DailyLog',
        taskId,
        error: err.message
      });
    }
  }

  // Also sync the full daily log if we have the ID
  if (dailyLogId) {
    try {
      await scheduleSync.syncDailyLogToSchedule(dailyLogId);
    } catch (err) {
      logger.error('Failed to sync daily log to schedule', {
        component: 'DailyLog',
        dailyLogId,
        error: err.message
      });
    }
  }
}

// ============================================================
// LIST ENDPOINTS
// ============================================================

// List all daily logs with filters
router.get('/', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { job_id, status, date_from, date_to, search } = req.query;

    let query = supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, notes, work_area, completion_percent, schedule_task_id,
          vendor:v2_vendors(id, name)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, description, quantity, unit,
          vendor:v2_vendors(id, name)
        ),
        attachments:v2_daily_log_attachments(id, file_url, category, caption)
      `)
      .eq('builder_id', builderId)
      .is('deleted_at', null)
      .order('log_date', { ascending: false });

    // Apply filters
    if (job_id) {
      query = query.eq('job_id', job_id);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    if (date_from) {
      query = query.gte('log_date', date_from);
    }
    if (date_to) {
      query = query.lte('log_date', date_to);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Calculate summary stats for each log
    const logsWithStats = data.map(log => ({
      ...log,
      crew_count: log.crew?.length || 0,
      total_workers: log.crew?.reduce((sum, c) => sum + (c.worker_count || 0), 0) || 0,
      delivery_count: log.deliveries?.length || 0
    }));

    res.json(logsWithStats);
}));

// ============================================================
// SPECIFIC ROUTES (must come BEFORE /:id parameterized route)
// ============================================================

// Get current weather for a job's location
router.get('/weather/:jobId', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { jobId } = req.params;

    // Get job address
    const { data: job, error: jobError } = await supabase
      .from('v2_jobs')
      .select('id, name, address')
      .eq('builder_id', builderId)
      .eq('id', jobId)
      .single();

    if (jobError || !job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (!job.address) {
      return res.status(400).json({ error: 'Job has no address' });
    }

    // Geocode the address
    const location = await geocodeAddress(job.address);
    if (!location) {
      return res.status(400).json({ error: 'Could not geocode job address' });
    }

    // Fetch weather
    const weather = await fetchWeatherForCoords(location.lat, location.lon);
    if (!weather) {
      return res.status(500).json({ error: 'Could not fetch weather data' });
    }

    res.json({
      job_id: job.id,
      job_name: job.name,
      address: job.address,
      location: {
        lat: location.lat,
        lon: location.lon
      },
      weather
    });
}));

// Get daily log statistics
router.get('/stats/summary', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { job_id } = req.query;

    let query = supabase
      .from('v2_daily_logs')
      .select('id, status, log_date, job_id')
      .eq('builder_id', builderId)
      .is('deleted_at', null);

    if (job_id) {
      query = query.eq('job_id', job_id);
    }

    const { data: logs, error } = await query;

    if (error) throw error;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const stats = {
      total: logs.length,
      draft: logs.filter(l => l.status === 'draft').length,
      completed: logs.filter(l => l.status === 'completed').length,
      last_30_days: logs.filter(l => new Date(l.log_date) >= thirtyDaysAgo).length,
      this_week: logs.filter(l => {
        const logDate = new Date(l.log_date);
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return logDate >= weekStart;
      }).length
    };

    res.json(stats);
}));

// Get weekly summary report for a job
router.get('/report/weekly', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { job_id, week_start } = req.query;

    if (!job_id) {
      return res.status(400).json({ error: 'job_id is required' });
    }

    // Calculate week range
    let startDate;
    if (week_start) {
      startDate = new Date(week_start);
    } else {
      // Default to current week (Sunday start)
      startDate = new Date();
      startDate.setDate(startDate.getDate() - startDate.getDay());
    }
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 6);
    endDate.setHours(23, 59, 59, 999);

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch logs for the week
    const { data: logs, error: logsError } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address, client_name),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, notes, work_area, completion_percent, schedule_task_id,
          vendor:v2_vendors(id, name)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, description, quantity, unit,
          vendor:v2_vendors(id, name)
        ),
        attachments:v2_daily_log_attachments(id, file_url, caption, category)
      `)
      .eq('builder_id', builderId)
      .eq('job_id', job_id)
      .gte('log_date', startStr)
      .lte('log_date', endStr)
      .is('deleted_at', null)
      .order('log_date', { ascending: true });

    if (logsError) throw logsError;

    // Get job info
    const { data: job } = await supabase
      .from('v2_jobs')
      .select('id, name, address, client_name')
      .eq('builder_id', builderId)
      .eq('id', job_id)
      .single();

    // Calculate summary statistics
    const summary = {
      job,
      week_start: startStr,
      week_end: endStr,
      total_days_logged: logs.length,
      days_with_logs: logs.map(l => l.log_date),

      // Crew totals
      total_crew_entries: logs.reduce((sum, l) => sum + (l.crew?.length || 0), 0),
      total_workers: logs.reduce((sum, l) =>
        sum + (l.crew?.reduce((s, c) => s + (c.worker_count || 0), 0) || 0), 0),
      total_hours: logs.reduce((sum, l) =>
        sum + (l.crew?.reduce((s, c) => s + (c.hours_worked || 0), 0) || 0), 0),

      // Delivery totals
      total_deliveries: logs.reduce((sum, l) => sum + (l.deliveries?.length || 0), 0),

      // Photo totals
      total_photos: logs.reduce((sum, l) => sum + (l.attachments?.length || 0), 0),

      // Weather summary
      weather_days: logs.reduce((acc, l) => {
        if (l.weather_conditions) {
          acc[l.weather_conditions] = (acc[l.weather_conditions] || 0) + 1;
        }
        return acc;
      }, {}),

      // Absent crews (from absent_crews JSONB)
      total_absent: logs.reduce((sum, l) =>
        sum + (l.absent_crews?.length || 0), 0),

      // Unique vendors on site
      unique_vendors: [...new Set(
        logs.flatMap(l => l.crew?.map(c => c.vendor?.name).filter(Boolean) || [])
      )],

      // Work completed summary
      work_completed: logs
        .filter(l => l.work_completed)
        .map(l => ({ date: l.log_date, work: l.work_completed })),

      // Delays/issues
      delays_issues: logs
        .filter(l => l.delays_issues)
        .map(l => ({ date: l.log_date, issue: l.delays_issues })),

      // Safety notes
      safety_notes: logs
        .filter(l => l.safety_notes)
        .map(l => ({ date: l.log_date, note: l.safety_notes })),

      // Daily breakdown
      daily_logs: logs.map(l => ({
        date: l.log_date,
        status: l.status,
        weather: l.weather_conditions,
        temp_high: l.temperature_high,
        temp_low: l.temperature_low,
        crew_count: l.crew?.length || 0,
        worker_count: l.crew?.reduce((s, c) => s + (c.worker_count || 0), 0) || 0,
        hours: l.crew?.reduce((s, c) => s + (c.hours_worked || 0), 0) || 0,
        delivery_count: l.deliveries?.length || 0,
        photo_count: l.attachments?.length || 0,
        absent_count: l.absent_crews?.length || 0,
        work_completed: l.work_completed,
        work_planned: l.work_planned,
        delays_issues: l.delays_issues
      }))
    };

    res.json(summary);
}));

// ============================================================
// PARAMETERIZED ROUTES (must come AFTER specific routes above)
// ============================================================

// Get single daily log with all details
router.get('/:id', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;

    const { data: log, error: logError } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address, client_name),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, po_id, notes, work_area, completion_percent, schedule_task_id,
          vendor:v2_vendors(id, name),
          po:v2_purchase_orders(id, po_number, description)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, po_id, description, quantity, unit, received_by, notes,
          vendor:v2_vendors(id, name),
          po:v2_purchase_orders(id, po_number, description)
        ),
        inspections:v2_daily_log_inspections(
          id, inspection_type, result, inspector, notes
        ),
        attachments:v2_daily_log_attachments(
          id, file_url, file_name, file_type, caption, category, uploaded_by, uploaded_at
        )
      `)
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (logError) {
      if (logError.code === 'PGRST116') {
        return res.status(404).json({ error: 'Daily log not found' });
      }
      throw logError;
    }

    // Get activity log
    const { data: activity } = await supabase
      .from('v2_daily_log_activity')
      .select('*')
      .eq('builder_id', builderId)
      .eq('daily_log_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({
      ...log,
      activity: activity || []
    });
}));

// ============================================================
// CREATE/UPDATE ENDPOINTS
// ============================================================

// Create new daily log
router.post('/', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const {
      job_id,
      log_date,
      construction_phase,
      plan_completed,
      plan_variance_notes,
      weather_conditions,
      temperature_high,
      temperature_low,
      weather_notes,
      work_completed,
      work_planned,
      delays_issues,
      site_visitors,
      safety_notes,
      crew,
      deliveries,
      absent_crews,
      dumpster_exchange,
      inspections,
      created_by
    } = req.body;

    // Validate required fields
    if (!job_id || !log_date || !created_by) {
      return res.status(400).json({ error: 'job_id, log_date, and created_by are required' });
    }

    // Check for duplicate log for same job/date
    const { data: existing } = await supabase
      .from('v2_daily_logs')
      .select('id')
      .eq('builder_id', builderId)
      .eq('job_id', job_id)
      .eq('log_date', log_date)
      .is('deleted_at', null)
      .single();

    if (existing) {
      return res.status(409).json({
        error: 'A daily log already exists for this job and date',
        existing_id: existing.id
      });
    }

    // Create the daily log
    const { data: newLog, error: createError } = await supabase
      .from('v2_daily_logs')
      .insert({
        builder_id: builderId,
        job_id,
        log_date,
        construction_phase,
        plan_completed,
        plan_variance_notes,
        weather_conditions,
        temperature_high,
        temperature_low,
        weather_notes,
        work_completed,
        work_planned,
        delays_issues,
        site_visitors,
        safety_notes,
        absent_crews: absent_crews || null,
        dumpster_exchange: dumpster_exchange || false,
        created_by,
        status: 'draft'
      })
      .select()
      .single();

    if (createError) throw createError;

    // Add crew entries if provided
    if (crew && crew.length > 0) {
      const crewEntries = crew.map(c => ({
        builder_id: builderId,
        daily_log_id: newLog.id,
        vendor_id: c.vendor_id || null,
        worker_count: c.worker_count || 1,
        hours_worked: c.hours_worked || null,
        trade: c.trade || null,
        work_area: c.work_area || null,
        completion_percent: c.completion_percent || null,
        po_id: c.po_id || null,
        schedule_task_id: c.schedule_task_id || null,
        notes: c.notes || null
      }));

      await supabase.from('v2_daily_log_crew').insert(crewEntries);

      // Update schedule task progress for any linked tasks
      await updateScheduleTaskProgress(crew, newLog.id);
    }

    // Add deliveries if provided
    if (deliveries && deliveries.length > 0) {
      const deliveryEntries = deliveries.map(d => ({
        builder_id: builderId,
        daily_log_id: newLog.id,
        vendor_id: d.vendor_id || null,
        po_id: d.po_id || null,
        description: d.description,
        quantity: d.quantity || null,
        unit: d.unit || null,
        received_by: d.received_by || null,
        notes: d.notes || null
      }));

      await supabase.from('v2_daily_log_deliveries').insert(deliveryEntries);
    }

    // Add inspections if provided
    if (inspections && inspections.length > 0) {
      const inspectionEntries = inspections.map(i => ({
        builder_id: builderId,
        daily_log_id: newLog.id,
        inspection_type: i.inspection_type,
        result: i.result || 'scheduled',
        inspector: i.inspector || null,
        notes: i.notes || null
      }));

      await supabase.from('v2_daily_log_inspections').insert(inspectionEntries);
    }

    // Log activity
    await logDailyLogActivity(newLog.id, 'created', created_by, {
      crew_count: crew?.length || 0,
      delivery_count: deliveries?.length || 0,
      absent_count: absent_crews?.length || 0,
      dumpster_exchange: dumpster_exchange || false,
      inspection_count: inspections?.length || 0
    }, builderId);

    // Return the complete log
    const { data: fullLog } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, work_area, completion_percent, po_id, schedule_task_id, notes,
          vendor:v2_vendors(id, name)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, po_id, description, quantity, unit, received_by, notes,
          vendor:v2_vendors(id, name)
        ),
        inspections:v2_daily_log_inspections(
          id, inspection_type, result, inspector, notes
        )
      `)
      .eq('builder_id', builderId)
      .eq('id', newLog.id)
      .single();

    res.status(201).json(fullLog);
}));

// Update daily log
router.patch('/:id', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const {
      weather_conditions,
      temperature_high,
      temperature_low,
      weather_notes,
      work_completed,
      work_planned,
      delays_issues,
      site_visitors,
      safety_notes,
      crew,
      deliveries,
      absent_crews,
      construction_phase,
      plan_completed,
      plan_variance_notes,
      dumpster_exchange,
      inspections,
      updated_by
    } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Cannot edit a completed daily log' });
    }

    // Update the log
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (weather_conditions !== undefined) updateData.weather_conditions = weather_conditions;
    if (temperature_high !== undefined) updateData.temperature_high = temperature_high;
    if (temperature_low !== undefined) updateData.temperature_low = temperature_low;
    if (weather_notes !== undefined) updateData.weather_notes = weather_notes;
    if (work_completed !== undefined) updateData.work_completed = work_completed;
    if (work_planned !== undefined) updateData.work_planned = work_planned;
    if (delays_issues !== undefined) updateData.delays_issues = delays_issues;
    if (site_visitors !== undefined) updateData.site_visitors = site_visitors;
    if (safety_notes !== undefined) updateData.safety_notes = safety_notes;
    if (absent_crews !== undefined) updateData.absent_crews = absent_crews;
    if (construction_phase !== undefined) updateData.construction_phase = construction_phase;
    if (plan_completed !== undefined) updateData.plan_completed = plan_completed;
    if (plan_variance_notes !== undefined) updateData.plan_variance_notes = plan_variance_notes;
    if (dumpster_exchange !== undefined) updateData.dumpster_exchange = dumpster_exchange;

    const { error: updateError } = await supabase
      .from('v2_daily_logs')
      .update(updateData)
      .eq('builder_id', builderId)
      .eq('id', id);

    if (updateError) throw updateError;

    // Update crew if provided
    if (crew !== undefined) {
      // Delete existing crew entries
      await supabase.from('v2_daily_log_crew').delete().eq('daily_log_id', id);

      // Add new crew entries
      if (crew.length > 0) {
        const crewEntries = crew.map(c => ({
          builder_id: builderId,
          daily_log_id: id,
          vendor_id: c.vendor_id || null,
          worker_count: c.worker_count || 1,
          hours_worked: c.hours_worked || null,
          trade: c.trade || null,
          po_id: c.po_id || null,
          schedule_task_id: c.schedule_task_id || null,
          notes: c.notes || null,
          work_area: c.work_area || null,
          completion_percent: c.completion_percent || null
        }));

        await supabase.from('v2_daily_log_crew').insert(crewEntries);

        // Update schedule task progress for any linked tasks
        await updateScheduleTaskProgress(crew, id);
      }
    }

    // Update deliveries if provided
    if (deliveries !== undefined) {
      // Delete existing deliveries
      await supabase.from('v2_daily_log_deliveries').delete().eq('daily_log_id', id);

      // Add new deliveries
      if (deliveries.length > 0) {
        const deliveryEntries = deliveries.map(d => ({
          builder_id: builderId,
          daily_log_id: id,
          vendor_id: d.vendor_id || null,
          po_id: d.po_id || null,
          description: d.description,
          quantity: d.quantity || null,
          unit: d.unit || null,
          received_by: d.received_by || null,
          notes: d.notes || null
        }));

        await supabase.from('v2_daily_log_deliveries').insert(deliveryEntries);
      }
    }

    // Update inspections if provided
    if (inspections !== undefined) {
      // Delete existing inspection entries
      await supabase.from('v2_daily_log_inspections').delete().eq('daily_log_id', id);

      // Add new inspection entries
      if (inspections.length > 0) {
        const inspectionEntries = inspections.map(i => ({
          builder_id: builderId,
          daily_log_id: id,
          inspection_type: i.inspection_type,
          result: i.result || 'scheduled',
          inspector: i.inspector || null,
          notes: i.notes || null
        }));

        await supabase.from('v2_daily_log_inspections').insert(inspectionEntries);
      }
    }

    // Log activity
    await logDailyLogActivity(id, 'updated', updated_by || 'System', {
      fields_updated: Object.keys(updateData).filter(k => k !== 'updated_at')
    }, builderId);

    // Return updated log
    const { data: fullLog } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, po_id, notes, work_area, completion_percent, schedule_task_id,
          vendor:v2_vendors(id, name)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, po_id, description, quantity, unit, received_by, notes,
          vendor:v2_vendors(id, name)
        ),
        inspections:v2_daily_log_inspections(
          id, inspection_type, result, inspector, notes
        )
      `)
      .eq('builder_id', builderId)
      .eq('id', id)
      .single();

    res.json(fullLog);
}));

// ============================================================
// STATUS ENDPOINTS
// ============================================================

// Mark daily log as completed
router.post('/:id/complete', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { completed_by } = req.body;

    // Check if log exists
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Daily log is already completed' });
    }

    // Update status
    const { error: updateError } = await supabase
      .from('v2_daily_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('builder_id', builderId)
      .eq('id', id);

    if (updateError) throw updateError;

    // Log activity
    await logDailyLogActivity(id, 'completed', completed_by || 'System', {}, builderId);

    // Process intelligence feedback
    let intelligenceResult = null;
    try {
      const companyName = req.builder?.name || 'your company';
      intelligenceResult = await processDailyLogIntelligence(id, companyName);
      logger.info('Intelligence processed for daily log', { component: 'DailyLog', dailyLogId: id, summary: intelligenceResult.summary });
    } catch (err) {
      logger.error('Intelligence processing error', { component: 'DailyLog', dailyLogId: id, error: err.message });
    }

    // Return updated log
    const { data: fullLog } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address)
      `)
      .eq('builder_id', builderId)
      .eq('id', id)
      .single();

    res.json({
      ...fullLog,
      intelligence: intelligenceResult
    });
}));

// Reopen a completed daily log (set back to draft)
router.post('/:id/reopen', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { reopened_by } = req.body;

    // Check if log exists
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status !== 'completed') {
      return res.status(400).json({ error: 'Daily log is not completed' });
    }

    // Update status
    const { error: updateError } = await supabase
      .from('v2_daily_logs')
      .update({
        status: 'draft',
        completed_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('builder_id', builderId)
      .eq('id', id);

    if (updateError) throw updateError;

    // Log activity
    await logDailyLogActivity(id, 'reopened', reopened_by || 'System', {}, builderId);

    // Return updated log
    const { data: fullLog } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address)
      `)
      .eq('builder_id', builderId)
      .eq('id', id)
      .single();

    res.json(fullLog);
}));

// ============================================================
// DELETE ENDPOINT
// ============================================================

// Soft delete daily log
router.delete('/:id', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { deleted_by } = req.body;

    // Check if log exists
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    // Soft delete
    const { error: deleteError } = await supabase
      .from('v2_daily_logs')
      .update({ deleted_at: new Date().toISOString() })
      .eq('builder_id', builderId)
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Log activity
    await logDailyLogActivity(id, 'deleted', deleted_by || 'System', {}, builderId);

    res.json({ success: true, message: 'Daily log deleted' });
}));

// ============================================================
// CREW ENDPOINTS
// ============================================================

// Add crew entry to daily log
router.post('/:id/crew', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { vendor_id, worker_count, hours_worked, trade, po_id, notes, added_by } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify a completed daily log' });
    }

    // Create crew entry
    const { data: newCrew, error: createError } = await supabase
      .from('v2_daily_log_crew')
      .insert({
        builder_id: builderId,
        daily_log_id: id,
        vendor_id: vendor_id || null,
        worker_count: worker_count || 1,
        hours_worked: hours_worked || null,
        trade: trade || null,
        po_id: po_id || null,
        notes: notes || null
      })
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .single();

    if (createError) throw createError;

    // Log activity
    await logDailyLogActivity(id, 'crew_added', added_by || 'System', {
      crew_id: newCrew.id,
      vendor_id
    }, builderId);

    res.status(201).json(newCrew);
}));

// Delete crew entry
router.delete('/:id/crew/:crewId', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id, crewId } = req.params;
    const { deleted_by } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify a completed daily log' });
    }

    // Delete crew entry
    const { error: deleteError } = await supabase
      .from('v2_daily_log_crew')
      .delete()
      .eq('id', crewId)
      .eq('daily_log_id', id);

    if (deleteError) throw deleteError;

    // Log activity
    await logDailyLogActivity(id, 'crew_removed', deleted_by || 'System', {
      crew_id: crewId
    }, builderId);

    res.json({ success: true });
}));

// ============================================================
// DELIVERY ENDPOINTS
// ============================================================

// Add delivery to daily log
router.post('/:id/deliveries', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { vendor_id, po_id, description, quantity, unit, received_by, notes, added_by } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify a completed daily log' });
    }

    // Create delivery entry
    const { data: newDelivery, error: createError } = await supabase
      .from('v2_daily_log_deliveries')
      .insert({
        builder_id: builderId,
        daily_log_id: id,
        vendor_id: vendor_id || null,
        po_id: po_id || null,
        description,
        quantity: quantity || null,
        unit: unit || null,
        received_by: received_by || null,
        notes: notes || null
      })
      .select(`
        *,
        vendor:v2_vendors(id, name)
      `)
      .single();

    if (createError) throw createError;

    // Log activity
    await logDailyLogActivity(id, 'delivery_added', added_by || 'System', {
      delivery_id: newDelivery.id,
      description
    }, builderId);

    res.status(201).json(newDelivery);
}));

// Delete delivery
router.delete('/:id/deliveries/:deliveryId', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id, deliveryId } = req.params;
    const { deleted_by } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify a completed daily log' });
    }

    // Delete delivery entry
    const { error: deleteError } = await supabase
      .from('v2_daily_log_deliveries')
      .delete()
      .eq('id', deliveryId)
      .eq('daily_log_id', id);

    if (deleteError) throw deleteError;

    // Log activity
    await logDailyLogActivity(id, 'delivery_removed', deleted_by || 'System', {
      delivery_id: deliveryId
    }, builderId);

    res.json({ success: true });
}));

// ============================================================
// PHOTO ENDPOINTS
// ============================================================

// Upload photo to daily log
router.post('/:id/photos', photoUpload.single('photo'), asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { caption, category, uploaded_by } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status, job_id')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Cannot add photos to a completed daily log' });
    }

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() || 'jpg';
    const fileName = `${PHOTO_PREFIX}/${existingLog.job_id}/${id}/${timestamp}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false
      });

    if (uploadError) {
      logger.error('Photo upload error', { component: 'DailyLog', dailyLogId: id, error: uploadError.message });
      throw new Error(`Failed to upload photo: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(fileName);

    // Create attachment record
    const { data: attachment, error: dbError } = await supabase
      .from('v2_daily_log_attachments')
      .insert({
        builder_id: builderId,
        daily_log_id: id,
        file_url: urlData.publicUrl,
        file_name: req.file.originalname,
        file_type: req.file.mimetype,
        caption: caption || null,
        category: category || 'progress',
        uploaded_by: uploaded_by || 'System'
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // Log activity
    await logDailyLogActivity(id, 'photo_added', uploaded_by || 'System', {
      attachment_id: attachment.id,
      file_name: req.file.originalname,
      category
    }, builderId);

    res.status(201).json(attachment);
}));

// Get all photos for a daily log
router.get('/:id/photos', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;

    const { data: photos, error } = await supabase
      .from('v2_daily_log_attachments')
      .select('*')
      .eq('builder_id', builderId)
      .eq('daily_log_id', id)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    res.json(photos || []);
}));

// Update photo caption/category
router.patch('/:id/photos/:photoId', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id, photoId } = req.params;
    const { caption, category } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Cannot modify photos in a completed daily log' });
    }

    const updateData = {};
    if (caption !== undefined) updateData.caption = caption;
    if (category !== undefined) updateData.category = category;

    const { data: updated, error } = await supabase
      .from('v2_daily_log_attachments')
      .update(updateData)
      .eq('id', photoId)
      .eq('daily_log_id', id)
      .select()
      .single();

    if (error) throw error;

    res.json(updated);
}));

// Delete photo from daily log
router.delete('/:id/photos/:photoId', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id, photoId } = req.params;
    const { deleted_by } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (checkError || !existingLog) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (existingLog.status === 'completed') {
      return res.status(400).json({ error: 'Cannot delete photos from a completed daily log' });
    }

    // Get the photo record to get the file URL
    const { data: photo, error: fetchError } = await supabase
      .from('v2_daily_log_attachments')
      .select('*')
      .eq('id', photoId)
      .eq('daily_log_id', id)
      .single();

    if (fetchError || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Extract storage path from URL and delete from storage
    try {
      // URL format: .../storage/v1/object/public/invoices/daily-log-photos/...
      const match = photo.file_url.match(/\/storage\/v1\/object\/public\/invoices\/(.+)$/);
      if (match) {
        const storagePath = decodeURIComponent(match[1].split('?')[0]);
        await supabase.storage.from(PHOTO_BUCKET).remove([storagePath]);
      }
    } catch (storageErr) {
      logger.warn('Could not delete file from storage', { component: 'DailyLog', error: storageErr.message });
    }

    // Delete the database record
    const { error: deleteError } = await supabase
      .from('v2_daily_log_attachments')
      .delete()
      .eq('id', photoId);

    if (deleteError) throw deleteError;

    // Log activity
    await logDailyLogActivity(id, 'photo_deleted', deleted_by || 'System', {
      attachment_id: photoId,
      file_name: photo.file_name
    }, builderId);

    res.json({ success: true });
}));

// ============================================================
// WEATHER ENDPOINTS (Phase 5 Mobile Enhancement)
// ============================================================

// Import weather service
const weatherService = require('../services/weather');

// Fetch and save weather for a daily log
router.post('/:id/weather', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { lat, lng, address } = req.body;

    // Verify daily log exists
    const { data: log, error: logError } = await supabase
      .from('v2_daily_logs')
      .select(`
        id, job_id, log_date, status,
        job:v2_jobs(id, name, address)
      `)
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (logError || !log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    let weatherData;
    let location;

    // If coordinates provided, use them directly
    if (lat && lng) {
      weatherData = await weatherService.fetchWeather(lat, lng);
      location = { lat, lng };
    }
    // Otherwise geocode from address (provided or from job)
    else {
      const addr = address || log.job?.address;
      if (!addr) {
        return res.status(400).json({ error: 'No address available for weather lookup' });
      }

      const result = await weatherService.getWeatherForAddress(addr);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      weatherData = result.weather;
      location = result.location;
    }

    if (weatherData.error) {
      return res.status(500).json({ error: weatherData.error });
    }

    // Assess workability
    const workability = weatherService.assessWorkability(weatherData);

    // Update the daily log with weather data
    const { error: updateError } = await supabase
      .from('v2_daily_logs')
      .update({
        weather_data: weatherData,
        // Also update the manual weather fields for backwards compatibility
        weather_conditions: mapWeatherToCondition(weatherData.conditions),
        temperature_high: weatherData.temp_high,
        temperature_low: weatherData.temp_low,
        updated_at: new Date().toISOString()
      })
      .eq('builder_id', builderId)
      .eq('id', id);

    if (updateError) throw updateError;

    // Log activity
    await logDailyLogActivity(id, 'weather_fetched', 'System', {
      source: weatherData.source,
      conditions: weatherData.conditions,
      temp: weatherData.temp_current
    }, builderId);

    res.json({
      daily_log_id: id,
      location,
      weather: weatherData,
      workability
    });
}));

// Helper to map API weather conditions to our enum values
function mapWeatherToCondition(apiCondition) {
  const mapping = {
    'clear': 'sunny',
    'partly_cloudy': 'partly_cloudy',
    'cloudy': 'cloudy',
    'foggy': 'cloudy',
    'drizzle': 'rainy',
    'rainy': 'rainy',
    'rain_showers': 'rainy',
    'freezing_rain': 'rainy',
    'freezing_drizzle': 'rainy',
    'snow': 'snow',
    'snow_showers': 'snow',
    'thunderstorm': 'stormy',
    'windy': 'windy',
    'hazy': 'cloudy',
    'dusty': 'windy',
    'severe': 'stormy'
  };
  return mapping[apiCondition] || 'cloudy';
}

// ============================================================
// GPS LOCATION ENDPOINTS (Phase 5 Mobile Enhancement)
// ============================================================

// Save GPS location for a daily log
router.patch('/:id/location', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { lat, lng, accuracy, updated_by } = req.body;

    // Validate coordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ error: 'lat and lng are required numbers' });
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    // Verify daily log exists
    const { data: log, error: logError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (logError || !log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    // Build GPS location object
    const gpsLocation = {
      lat,
      lng,
      accuracy: accuracy || null,
      captured_at: new Date().toISOString()
    };

    // Update the daily log
    const { error: updateError } = await supabase
      .from('v2_daily_logs')
      .update({
        gps_location: gpsLocation,
        updated_at: new Date().toISOString()
      })
      .eq('builder_id', builderId)
      .eq('id', id);

    if (updateError) throw updateError;

    // Log activity
    await logDailyLogActivity(id, 'location_tagged', updated_by || 'System', {
      lat,
      lng,
      accuracy
    }, builderId);

    res.json({
      daily_log_id: id,
      gps_location: gpsLocation
    });
}));

// ============================================================
// VOICE NOTES / TRANSCRIPTION ENDPOINTS (Phase 5 Mobile Enhancement)
// ============================================================

// Configure multer for voice note uploads
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit for audio
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm',
      'audio/ogg', 'audio/m4a', 'audio/x-m4a', 'audio/mp4'
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|webm|ogg|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files (MP3, WAV, WebM, OGG, M4A) are allowed'), false);
    }
  }
});

const VOICE_PREFIX = 'daily-log-voice';

// Upload voice note
router.post('/:id/voice-note', voiceUpload.single('audio'), asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { uploaded_by, auto_transcribe } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    // Verify daily log exists and is not completed
    const { data: log, error: logError } = await supabase
      .from('v2_daily_logs')
      .select('id, status, job_id')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (logError || !log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    if (log.status === 'completed') {
      return res.status(400).json({ error: 'Cannot add voice notes to a completed daily log' });
    }

    // Upload to Supabase Storage
    const timestamp = Date.now();
    const ext = req.file.originalname.split('.').pop() || 'mp3';
    const fileName = `${VOICE_PREFIX}/${log.job_id}/${id}/${timestamp}.${ext}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: true  // Allow overwriting existing voice note
      });

    if (uploadError) {
      logger.error('Voice note upload error', { component: 'DailyLog', dailyLogId: id, error: uploadError.message });
      throw new Error(`Failed to upload voice note: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(fileName);

    // Update daily log with voice note URL
    const { error: updateError } = await supabase
      .from('v2_daily_logs')
      .update({
        voice_notes_url: urlData.publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('builder_id', builderId)
      .eq('id', id);

    if (updateError) throw updateError;

    // Log activity
    await logDailyLogActivity(id, 'voice_note_uploaded', uploaded_by || 'System', {
      file_name: req.file.originalname,
      file_size: req.file.size
    }, builderId);

    res.status(201).json({
      daily_log_id: id,
      voice_notes_url: urlData.publicUrl,
      message: 'Voice note uploaded successfully. Use POST /transcribe to transcribe it.'
    });
}));

// Transcribe voice note (placeholder - requires speech-to-text service)
router.post('/:id/transcribe', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;
    const { transcribed_by, manual_text } = req.body;

    // Verify daily log exists
    const { data: log, error: logError } = await supabase
      .from('v2_daily_logs')
      .select('id, status, voice_notes_url, transcribed_notes')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (logError || !log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    // If manual text provided, save it directly
    if (manual_text) {
      const { error: updateError } = await supabase
        .from('v2_daily_logs')
        .update({
          transcribed_notes: manual_text,
          updated_at: new Date().toISOString()
        })
        .eq('builder_id', builderId)
        .eq('id', id);

      if (updateError) throw updateError;

      await logDailyLogActivity(id, 'notes_transcribed', transcribed_by || 'User', {
        method: 'manual',
        length: manual_text.length
      }, builderId);

      return res.json({
        daily_log_id: id,
        transcribed_notes: manual_text,
        method: 'manual'
      });
    }

    // Auto-transcription would require a speech-to-text service
    // Placeholder for integration with services like:
    // - OpenAI Whisper API
    // - Google Cloud Speech-to-Text
    // - AWS Transcribe
    // - AssemblyAI

    if (!log.voice_notes_url) {
      return res.status(400).json({
        error: 'No voice note to transcribe. Upload a voice note first or provide manual_text.'
      });
    }

    // For now, return a placeholder response
    // In production, this would call the speech-to-text API
    return res.status(501).json({
      error: 'Automatic transcription not yet implemented',
      message: 'Please provide manual_text in the request body, or integrate a speech-to-text service',
      voice_notes_url: log.voice_notes_url,
      suggested_services: [
        'OpenAI Whisper API (OPENAI_API_KEY)',
        'Google Cloud Speech-to-Text',
        'AWS Transcribe',
        'AssemblyAI'
      ]
    });
}));

// Get transcription status
router.get('/:id/transcription', asyncHandler(async (req, res) => {
    const builderId = getBuilderId(req);
    const { id } = req.params;

    const { data: log, error: logError } = await supabase
      .from('v2_daily_logs')
      .select('id, voice_notes_url, transcribed_notes')
      .eq('builder_id', builderId)
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (logError || !log) {
      return res.status(404).json({ error: 'Daily log not found' });
    }

    res.json({
      daily_log_id: id,
      has_voice_note: !!log.voice_notes_url,
      voice_notes_url: log.voice_notes_url,
      has_transcription: !!log.transcribed_notes,
      transcribed_notes: log.transcribed_notes
    });
}));

module.exports = router;
