/**
 * Daily Logs Routes
 * Daily site activity tracking endpoints
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');

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
    console.log('Geocoding failed, using Sarasota FL default');
    return {
      lat: 27.3364,
      lon: -82.5307,
      name: 'Sarasota, FL (default)'
    };
  } catch (err) {
    console.error('Geocoding error:', err);
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
    console.error('Weather fetch error:', err);
    return null;
  }
}

// Helper: Log daily log activity
async function logDailyLogActivity(dailyLogId, action, performedBy, details = {}) {
  try {
    await supabase.from('v2_daily_log_activity').insert({
      daily_log_id: dailyLogId,
      action,
      performed_by: performedBy,
      details
    });
  } catch (err) {
    console.error('Failed to log daily log activity:', err);
  }
}

// ============================================================
// LIST ENDPOINTS
// ============================================================

// List all daily logs with filters
router.get('/', async (req, res) => {
  try {
    const { job_id, status, date_from, date_to, search } = req.query;

    let query = supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, notes,
          vendor:v2_vendors(id, name)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, description, quantity, unit,
          vendor:v2_vendors(id, name)
        )
      `)
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single daily log with all details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: log, error: logError } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address, client_name),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, po_id, notes,
          vendor:v2_vendors(id, name),
          po:v2_purchase_orders(id, po_number, description)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, po_id, description, quantity, unit, received_by, notes,
          vendor:v2_vendors(id, name),
          po:v2_purchase_orders(id, po_number, description)
        ),
        attachments:v2_daily_log_attachments(
          id, file_url, file_name, file_type, caption, category, uploaded_by, uploaded_at
        )
      `)
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
      .eq('daily_log_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(50);

    res.json({
      ...log,
      activity: activity || []
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CREATE/UPDATE ENDPOINTS
// ============================================================

// Create new daily log
router.post('/', async (req, res) => {
  try {
    const {
      job_id,
      log_date,
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
        job_id,
        log_date,
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
        created_by,
        status: 'draft'
      })
      .select()
      .single();

    if (createError) throw createError;

    // Add crew entries if provided
    if (crew && crew.length > 0) {
      const crewEntries = crew.map(c => ({
        daily_log_id: newLog.id,
        vendor_id: c.vendor_id || null,
        worker_count: c.worker_count || 1,
        hours_worked: c.hours_worked || null,
        trade: c.trade || null,
        po_id: c.po_id || null,
        notes: c.notes || null
      }));

      await supabase.from('v2_daily_log_crew').insert(crewEntries);
    }

    // Add deliveries if provided
    if (deliveries && deliveries.length > 0) {
      const deliveryEntries = deliveries.map(d => ({
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

    // Log activity
    await logDailyLogActivity(newLog.id, 'created', created_by, {
      crew_count: crew?.length || 0,
      delivery_count: deliveries?.length || 0,
      absent_count: absent_crews?.length || 0
    });

    // Return the complete log
    const { data: fullLog } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, po_id, notes,
          vendor:v2_vendors(id, name)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, po_id, description, quantity, unit, received_by, notes,
          vendor:v2_vendors(id, name)
        )
      `)
      .eq('id', newLog.id)
      .single();

    res.status(201).json(fullLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update daily log
router.patch('/:id', async (req, res) => {
  try {
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
      updated_by
    } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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

    const { error: updateError } = await supabase
      .from('v2_daily_logs')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    // Update crew if provided
    if (crew !== undefined) {
      // Delete existing crew entries
      await supabase.from('v2_daily_log_crew').delete().eq('daily_log_id', id);

      // Add new crew entries
      if (crew.length > 0) {
        const crewEntries = crew.map(c => ({
          daily_log_id: id,
          vendor_id: c.vendor_id || null,
          worker_count: c.worker_count || 1,
          hours_worked: c.hours_worked || null,
          trade: c.trade || null,
          po_id: c.po_id || null,
          notes: c.notes || null
        }));

        await supabase.from('v2_daily_log_crew').insert(crewEntries);
      }
    }

    // Update deliveries if provided
    if (deliveries !== undefined) {
      // Delete existing deliveries
      await supabase.from('v2_daily_log_deliveries').delete().eq('daily_log_id', id);

      // Add new deliveries
      if (deliveries.length > 0) {
        const deliveryEntries = deliveries.map(d => ({
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

    // Log activity
    await logDailyLogActivity(id, 'updated', updated_by || 'System', {
      fields_updated: Object.keys(updateData).filter(k => k !== 'updated_at')
    });

    // Return updated log
    const { data: fullLog } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address),
        crew:v2_daily_log_crew(
          id, vendor_id, worker_count, hours_worked, trade, po_id, notes,
          vendor:v2_vendors(id, name)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, po_id, description, quantity, unit, received_by, notes,
          vendor:v2_vendors(id, name)
        )
      `)
      .eq('id', id)
      .single();

    res.json(fullLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATUS ENDPOINTS
// ============================================================

// Mark daily log as completed
router.post('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    const { completed_by } = req.body;

    // Check if log exists
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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
      .eq('id', id);

    if (updateError) throw updateError;

    // Log activity
    await logDailyLogActivity(id, 'completed', completed_by || 'System', {});

    // Return updated log
    const { data: fullLog } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address)
      `)
      .eq('id', id)
      .single();

    res.json(fullLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reopen a completed daily log (set back to draft)
router.post('/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;
    const { reopened_by } = req.body;

    // Check if log exists
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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
      .eq('id', id);

    if (updateError) throw updateError;

    // Log activity
    await logDailyLogActivity(id, 'reopened', reopened_by || 'System', {});

    // Return updated log
    const { data: fullLog } = await supabase
      .from('v2_daily_logs')
      .select(`
        *,
        job:v2_jobs(id, name, address)
      `)
      .eq('id', id)
      .single();

    res.json(fullLog);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELETE ENDPOINT
// ============================================================

// Soft delete daily log
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { deleted_by } = req.body;

    // Check if log exists
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id')
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
      .eq('id', id);

    if (deleteError) throw deleteError;

    // Log activity
    await logDailyLogActivity(id, 'deleted', deleted_by || 'System', {});

    res.json({ success: true, message: 'Daily log deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CREW ENDPOINTS
// ============================================================

// Add crew entry to daily log
router.post('/:id/crew', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendor_id, worker_count, hours_worked, trade, po_id, notes, added_by } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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
    });

    res.status(201).json(newCrew);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete crew entry
router.delete('/:id/crew/:crewId', async (req, res) => {
  try {
    const { id, crewId } = req.params;
    const { deleted_by } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// DELIVERY ENDPOINTS
// ============================================================

// Add delivery to daily log
router.post('/:id/deliveries', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendor_id, po_id, description, quantity, unit, received_by, notes, added_by } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'description is required' });
    }

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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
    });

    res.status(201).json(newDelivery);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete delivery
router.delete('/:id/deliveries/:deliveryId', async (req, res) => {
  try {
    const { id, deliveryId } = req.params;
    const { deleted_by } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// WEATHER ENDPOINT
// ============================================================

// Get current weather for a job's location
router.get('/weather/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;

    // Get job address
    const { data: job, error: jobError } = await supabase
      .from('v2_jobs')
      .select('id, name, address')
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
  } catch (err) {
    console.error('Weather endpoint error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// STATS ENDPOINT
// ============================================================

// Get daily log statistics
router.get('/stats/summary', async (req, res) => {
  try {
    const { job_id } = req.query;

    let query = supabase
      .from('v2_daily_logs')
      .select('id, status, log_date, job_id')
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// WEEKLY SUMMARY REPORT
// ============================================================

// Get weekly summary report for a job
router.get('/report/weekly', async (req, res) => {
  try {
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
          id, vendor_id, worker_count, hours_worked, trade, notes,
          vendor:v2_vendors(id, name)
        ),
        deliveries:v2_daily_log_deliveries(
          id, vendor_id, description, quantity, unit,
          vendor:v2_vendors(id, name)
        ),
        attachments:v2_daily_log_attachments(id, file_url, caption, category)
      `)
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
  } catch (err) {
    console.error('Weekly report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// PHOTO ENDPOINTS
// ============================================================

// Upload photo to daily log
router.post('/:id/photos', photoUpload.single('photo'), async (req, res) => {
  try {
    const { id } = req.params;
    const { caption, category, uploaded_by } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No photo uploaded' });
    }

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status, job_id')
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
      console.error('Photo upload error:', uploadError);
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
    });

    res.status(201).json(attachment);
  } catch (err) {
    console.error('Photo upload failed:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all photos for a daily log
router.get('/:id/photos', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: photos, error } = await supabase
      .from('v2_daily_log_attachments')
      .select('*')
      .eq('daily_log_id', id)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    res.json(photos || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update photo caption/category
router.patch('/:id/photos/:photoId', async (req, res) => {
  try {
    const { id, photoId } = req.params;
    const { caption, category } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete photo from daily log
router.delete('/:id/photos/:photoId', async (req, res) => {
  try {
    const { id, photoId } = req.params;
    const { deleted_by } = req.body;

    // Check if log exists and is not completed
    const { data: existingLog, error: checkError } = await supabase
      .from('v2_daily_logs')
      .select('id, status')
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
      console.warn('Could not delete file from storage:', storageErr.message);
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
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
