const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');

// ============================================================
// WEATHER DELAYS ENDPOINTS
// ============================================================

// List weather delays for a job
router.get('/', asyncHandler(async (req, res) => {
  const { job_id, start_date, end_date, weather_type } = req.query;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id is required' });
  }

  let query = supabase
    .from('v2_weather_delays')
    .select(`
      *,
      job:v2_jobs(id, name),
      schedule_task:v2_schedule_tasks(id, name)
    `)
    .eq('job_id', job_id)
    .order('delay_date', { ascending: false });

  // Optional date range filter
  if (start_date) {
    query = query.gte('delay_date', start_date);
  }
  if (end_date) {
    query = query.lte('delay_date', end_date);
  }

  // Optional weather type filter
  if (weather_type) {
    query = query.eq('weather_type', weather_type);
  }

  const { data, error } = await query;
  if (error) throw error;

  res.json(data || []);
}));

// Get weather delay summary for a job
router.get('/summary', asyncHandler(async (req, res) => {
  const { job_id, start_date, end_date } = req.query;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id is required' });
  }

  // Get all delays for the job
  let query = supabase
    .from('v2_weather_delays')
    .select('*')
    .eq('job_id', job_id);

  if (start_date) {
    query = query.gte('delay_date', start_date);
  }
  if (end_date) {
    query = query.lte('delay_date', end_date);
  }

  const { data: delays, error } = await query;
  if (error) throw error;

  // Calculate summary statistics
  const summary = {
    total_delay_hours: 0,
    total_delay_days: 0,
    delay_count: delays?.length || 0,
    by_weather_type: {},
    by_month: {},
    affected_tasks: new Set()
  };

  (delays || []).forEach(delay => {
    // Total hours
    summary.total_delay_hours += parseFloat(delay.delay_hours) || 0;

    // By weather type
    if (!summary.by_weather_type[delay.weather_type]) {
      summary.by_weather_type[delay.weather_type] = {
        count: 0,
        hours: 0
      };
    }
    summary.by_weather_type[delay.weather_type].count++;
    summary.by_weather_type[delay.weather_type].hours += parseFloat(delay.delay_hours) || 0;

    // By month
    const month = delay.delay_date.substring(0, 7); // YYYY-MM
    if (!summary.by_month[month]) {
      summary.by_month[month] = {
        count: 0,
        hours: 0
      };
    }
    summary.by_month[month].count++;
    summary.by_month[month].hours += parseFloat(delay.delay_hours) || 0;

    // Track affected tasks
    if (delay.schedule_task_id) {
      summary.affected_tasks.add(delay.schedule_task_id);
    }
  });

  // Convert delay hours to days (assuming 8-hour work day)
  summary.total_delay_days = Math.round((summary.total_delay_hours / 8) * 10) / 10;
  summary.affected_task_count = summary.affected_tasks.size;
  delete summary.affected_tasks; // Remove Set for JSON serialization

  res.json(summary);
}));

// Get a single weather delay
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_weather_delays')
    .select(`
      *,
      job:v2_jobs(id, name),
      schedule_task:v2_schedule_tasks(id, name)
    `)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Weather delay not found' });
    }
    throw error;
  }

  res.json(data);
}));

// Create a weather delay
router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    schedule_task_id,
    delay_date,
    weather_type,
    delay_hours,
    impact_description,
    created_by
  } = req.body;

  // Validation
  if (!job_id) {
    return res.status(400).json({ error: 'job_id is required' });
  }
  if (!delay_date) {
    return res.status(400).json({ error: 'delay_date is required' });
  }
  if (!weather_type) {
    return res.status(400).json({ error: 'weather_type is required' });
  }
  if (!delay_hours || delay_hours <= 0) {
    return res.status(400).json({ error: 'delay_hours must be greater than 0' });
  }

  const validWeatherTypes = ['rain', 'wind', 'snow', 'extreme_heat', 'extreme_cold', 'storm', 'other'];
  if (!validWeatherTypes.includes(weather_type)) {
    return res.status(400).json({
      error: `weather_type must be one of: ${validWeatherTypes.join(', ')}`
    });
  }

  // Verify job exists
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id')
    .eq('id', job_id)
    .single();

  if (jobError || !job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Verify task exists if provided
  if (schedule_task_id) {
    const { data: task, error: taskError } = await supabase
      .from('v2_schedule_tasks')
      .select('id')
      .eq('id', schedule_task_id)
      .single();

    if (taskError || !task) {
      return res.status(404).json({ error: 'Schedule task not found' });
    }
  }

  const { data, error } = await supabase
    .from('v2_weather_delays')
    .insert({
      job_id,
      schedule_task_id: schedule_task_id || null,
      delay_date,
      weather_type,
      delay_hours,
      impact_description: impact_description || null,
      created_by: created_by || null
    })
    .select(`
      *,
      job:v2_jobs(id, name),
      schedule_task:v2_schedule_tasks(id, name)
    `)
    .single();

  if (error) throw error;

  res.status(201).json(data);
}));

// Update a weather delay
router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    schedule_task_id,
    delay_date,
    weather_type,
    delay_hours,
    impact_description
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };

  if (schedule_task_id !== undefined) {
    // Verify task exists if provided
    if (schedule_task_id) {
      const { data: task, error: taskError } = await supabase
        .from('v2_schedule_tasks')
        .select('id')
        .eq('id', schedule_task_id)
        .single();

      if (taskError || !task) {
        return res.status(404).json({ error: 'Schedule task not found' });
      }
    }
    updates.schedule_task_id = schedule_task_id || null;
  }

  if (delay_date !== undefined) {
    updates.delay_date = delay_date;
  }

  if (weather_type !== undefined) {
    const validWeatherTypes = ['rain', 'wind', 'snow', 'extreme_heat', 'extreme_cold', 'storm', 'other'];
    if (!validWeatherTypes.includes(weather_type)) {
      return res.status(400).json({
        error: `weather_type must be one of: ${validWeatherTypes.join(', ')}`
      });
    }
    updates.weather_type = weather_type;
  }

  if (delay_hours !== undefined) {
    if (delay_hours <= 0) {
      return res.status(400).json({ error: 'delay_hours must be greater than 0' });
    }
    updates.delay_hours = delay_hours;
  }

  if (impact_description !== undefined) {
    updates.impact_description = impact_description;
  }

  const { data, error } = await supabase
    .from('v2_weather_delays')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name),
      schedule_task:v2_schedule_tasks(id, name)
    `)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return res.status(404).json({ error: 'Weather delay not found' });
    }
    throw error;
  }

  res.json(data);
}));

// Delete a weather delay
router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check if exists first
  const { data: existing, error: checkError } = await supabase
    .from('v2_weather_delays')
    .select('id')
    .eq('id', id)
    .single();

  if (checkError || !existing) {
    return res.status(404).json({ error: 'Weather delay not found' });
  }

  const { error } = await supabase
    .from('v2_weather_delays')
    .delete()
    .eq('id', id);

  if (error) throw error;

  res.json({ success: true });
}));

module.exports = router;
