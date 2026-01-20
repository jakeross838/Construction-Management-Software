/**
 * Crew Scheduling Routes
 * Work requests, crew members, availability, and scheduling
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============ CREW MEMBERS ============

// Get all crew members
router.get('/members', asyncHandler(async (req, res) => {
  const { active } = req.query;

  let query = supabase
    .from('v2_crew_members')
    .select(`
      *,
      contact:v2_contacts(id, name, email, phone)
    `)
    .is('deleted_at', null)
    .order('name');

  if (active === 'true') {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// Get single crew member
router.get('/members/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_crew_members')
    .select(`
      *,
      contact:v2_contacts(id, name, email, phone)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !data) throw new AppError('Crew member not found', 404);

  res.json(data);
}));

// Create crew member
router.post('/members', asyncHandler(async (req, res) => {
  const { contact_id, name, role, skills, hourly_rate, notes } = req.body;

  if (!name) throw new AppError('Name is required', 400);

  const { data, error } = await supabase
    .from('v2_crew_members')
    .insert([{
      contact_id,
      name,
      role,
      skills: skills || [],
      hourly_rate,
      notes
    }])
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

// Update crew member
router.patch('/members/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('v2_crew_members')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Crew member not found', 404);

  res.json(data);
}));

// Delete crew member (soft)
router.delete('/members/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_crew_members')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError(error.message, 500);

  res.json({ success: true });
}));

// ============ WORK REQUESTS ============

// Get all work requests
router.get('/requests', asyncHandler(async (req, res) => {
  const { job_id, status, crew_id } = req.query;

  let query = supabase
    .from('v2_work_requests')
    .select(`
      *,
      job:v2_jobs(id, name),
      assigned_crew:v2_crew_members(id, name, role)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (crew_id) query = query.eq('assigned_crew_id', crew_id);

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// Get work request stats
router.get('/requests/stats', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_work_requests')
    .select('status')
    .is('deleted_at', null);

  if (error) throw new AppError(error.message, 500);

  const stats = {
    total: data.length,
    pending: data.filter(r => r.status === 'pending').length,
    scheduled: data.filter(r => r.status === 'scheduled').length,
    in_progress: data.filter(r => r.status === 'in_progress').length,
    completed: data.filter(r => r.status === 'completed').length
  };

  res.json(stats);
}));

// Get single work request
router.get('/requests/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_work_requests')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      assigned_crew:v2_crew_members(id, name, role, contact:v2_contacts(email, phone))
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !data) throw new AppError('Work request not found', 404);

  res.json(data);
}));

// Create work request
router.post('/requests', asyncHandler(async (req, res) => {
  const {
    job_id,
    requested_by,
    title,
    description,
    priority,
    estimated_hours,
    required_skills,
    preferred_date,
    due_date,
    notes
  } = req.body;

  if (!title) throw new AppError('Title is required', 400);

  const { data, error } = await supabase
    .from('v2_work_requests')
    .insert([{
      job_id,
      requested_by,
      title,
      description,
      priority: priority || 'normal',
      estimated_hours,
      required_skills: required_skills || [],
      preferred_date,
      due_date,
      notes
    }])
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

// Update work request
router.patch('/requests/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('v2_work_requests')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select(`
      *,
      job:v2_jobs(id, name),
      assigned_crew:v2_crew_members(id, name, role)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Work request not found', 404);

  res.json(data);
}));

// Schedule work request
router.post('/requests/:id/schedule', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { crew_id, date, start_time, end_time } = req.body;

  if (!crew_id || !date) throw new AppError('Crew and date are required', 400);

  // Get work request
  const { data: request, error: reqError } = await supabase
    .from('v2_work_requests')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (reqError || !request) throw new AppError('Work request not found', 404);

  // Update work request with schedule
  const { data, error } = await supabase
    .from('v2_work_requests')
    .update({
      assigned_crew_id: crew_id,
      scheduled_date: date,
      scheduled_start_time: start_time || '08:00',
      scheduled_end_time: end_time || '17:00',
      status: 'scheduled',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name),
      assigned_crew:v2_crew_members(id, name, role)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);

  // Create schedule entry
  await supabase
    .from('v2_crew_schedules')
    .insert([{
      crew_id,
      work_request_id: id,
      job_id: request.job_id,
      title: request.title,
      description: request.description,
      date,
      start_time: start_time || '08:00',
      end_time: end_time || '17:00'
    }]);

  res.json(data);
}));

// Complete work request
router.post('/requests/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { completed_by, notes } = req.body;

  const { data, error } = await supabase
    .from('v2_work_requests')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by,
      notes: notes || undefined,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Work request not found', 404);

  // Update related schedule entry
  await supabase
    .from('v2_crew_schedules')
    .update({ status: 'completed' })
    .eq('work_request_id', id);

  res.json(data);
}));

// Delete work request (soft)
router.delete('/requests/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_work_requests')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new AppError(error.message, 500);

  res.json({ success: true });
}));

// ============ AVAILABILITY ============

// Get crew availability
router.get('/availability', asyncHandler(async (req, res) => {
  const { crew_id, start_date, end_date } = req.query;

  let query = supabase
    .from('v2_crew_availability')
    .select(`
      *,
      crew:v2_crew_members(id, name, role)
    `)
    .order('date');

  if (crew_id) query = query.eq('crew_id', crew_id);
  if (start_date) query = query.gte('date', start_date);
  if (end_date) query = query.lte('date', end_date);

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// Set crew availability
router.post('/availability', asyncHandler(async (req, res) => {
  const { crew_id, date, start_time, end_time, is_available, notes } = req.body;

  if (!crew_id || !date) throw new AppError('Crew and date are required', 400);

  const { data, error } = await supabase
    .from('v2_crew_availability')
    .upsert([{
      crew_id,
      date,
      start_time: start_time || '07:00',
      end_time: end_time || '17:00',
      is_available: is_available !== false,
      notes
    }], { onConflict: 'crew_id,date' })
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);

  res.json(data);
}));

// ============ SCHEDULES / CALENDAR ============

// Get schedules (calendar view)
router.get('/schedules', asyncHandler(async (req, res) => {
  const { crew_id, job_id, start_date, end_date } = req.query;

  let query = supabase
    .from('v2_crew_schedules')
    .select(`
      *,
      crew:v2_crew_members(id, name, role),
      job:v2_jobs(id, name),
      work_request:v2_work_requests(id, title, priority)
    `)
    .order('date')
    .order('start_time');

  if (crew_id) query = query.eq('crew_id', crew_id);
  if (job_id) query = query.eq('job_id', job_id);
  if (start_date) query = query.gte('date', start_date);
  if (end_date) query = query.lte('date', end_date);

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// Create schedule entry
router.post('/schedules', asyncHandler(async (req, res) => {
  const {
    crew_id,
    work_request_id,
    job_id,
    title,
    description,
    date,
    start_time,
    end_time
  } = req.body;

  if (!crew_id || !date || !start_time || !end_time) {
    throw new AppError('Crew, date, start time, and end time are required', 400);
  }

  const { data, error } = await supabase
    .from('v2_crew_schedules')
    .insert([{
      crew_id,
      work_request_id,
      job_id,
      title: title || 'Scheduled Work',
      description,
      date,
      start_time,
      end_time
    }])
    .select(`
      *,
      crew:v2_crew_members(id, name, role),
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);

  res.status(201).json(data);
}));

// Update schedule entry (drag-to-reschedule)
router.patch('/schedules/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('v2_crew_schedules')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      crew:v2_crew_members(id, name, role),
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Schedule not found', 404);

  // If linked to work request, update it too
  if (data.work_request_id && (req.body.date || req.body.crew_id)) {
    await supabase
      .from('v2_work_requests')
      .update({
        scheduled_date: req.body.date || data.date,
        assigned_crew_id: req.body.crew_id || data.crew_id,
        updated_at: new Date().toISOString()
      })
      .eq('id', data.work_request_id);
  }

  res.json(data);
}));

// Delete schedule entry
router.delete('/schedules/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('v2_crew_schedules')
    .delete()
    .eq('id', id);

  if (error) throw new AppError(error.message, 500);

  res.json({ success: true });
}));

// ============ AUTO-SCHEDULING ============

// Auto-schedule pending requests
router.post('/auto-schedule', asyncHandler(async (req, res) => {
  const { start_date, end_date } = req.body;

  if (!start_date) throw new AppError('Start date is required', 400);

  const endDate = end_date || start_date;

  // Get pending work requests
  const { data: requests, error: reqError } = await supabase
    .from('v2_work_requests')
    .select('*')
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('priority', { ascending: false }) // urgent first
    .order('due_date', { nullsFirst: false }) // earliest due dates first
    .order('created_at');

  if (reqError) throw new AppError(reqError.message, 500);

  // Get active crew members
  const { data: crew, error: crewError } = await supabase
    .from('v2_crew_members')
    .select('*')
    .eq('is_active', true)
    .is('deleted_at', null);

  if (crewError) throw new AppError(crewError.message, 500);

  // Get existing schedules in date range
  const { data: existingSchedules, error: schedError } = await supabase
    .from('v2_crew_schedules')
    .select('*')
    .gte('date', start_date)
    .lte('date', endDate);

  if (schedError) throw new AppError(schedError.message, 500);

  // Build availability map
  const scheduled = {};
  (existingSchedules || []).forEach(s => {
    const key = `${s.crew_id}-${s.date}`;
    if (!scheduled[key]) scheduled[key] = 0;
    // Add hours (rough estimate)
    const start = parseInt(s.start_time.split(':')[0]);
    const end = parseInt(s.end_time.split(':')[0]);
    scheduled[key] += (end - start);
  });

  const results = { scheduled: 0, skipped: 0, details: [] };

  // Try to schedule each request
  for (const request of requests || []) {
    // Find best crew member (skill match + availability)
    let bestCrew = null;
    let bestDate = null;

    // Generate dates to check
    const dates = [];
    let currentDate = new Date(start_date);
    const end = new Date(endDate);
    while (currentDate <= end) {
      // Skip weekends
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        dates.push(currentDate.toISOString().split('T')[0]);
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Find first available slot
    for (const date of dates) {
      // Prefer preferred_date if in range
      if (request.preferred_date && date !== request.preferred_date) continue;

      for (const c of crew) {
        const key = `${c.id}-${date}`;
        const hoursUsed = scheduled[key] || 0;
        const estimatedHours = request.estimated_hours || 4;

        // Check if crew has capacity (assume 8 hour day)
        if (hoursUsed + estimatedHours <= 8) {
          // Check skill match if required
          if (request.required_skills && request.required_skills.length > 0) {
            const crewSkills = c.skills || [];
            const hasSkill = request.required_skills.some(s =>
              crewSkills.includes(s) || c.role === s
            );
            if (!hasSkill) continue;
          }

          bestCrew = c;
          bestDate = date;
          break;
        }
      }

      if (bestCrew) break;
    }

    // Try again without preferred_date constraint
    if (!bestCrew && request.preferred_date) {
      for (const date of dates) {
        for (const c of crew) {
          const key = `${c.id}-${date}`;
          const hoursUsed = scheduled[key] || 0;
          const estimatedHours = request.estimated_hours || 4;

          if (hoursUsed + estimatedHours <= 8) {
            bestCrew = c;
            bestDate = date;
            break;
          }
        }
        if (bestCrew) break;
      }
    }

    if (bestCrew && bestDate) {
      const estimatedHours = request.estimated_hours || 4;
      const startHour = 8 + (scheduled[`${bestCrew.id}-${bestDate}`] || 0);
      const endHour = startHour + estimatedHours;

      // Schedule the request
      await supabase
        .from('v2_work_requests')
        .update({
          assigned_crew_id: bestCrew.id,
          scheduled_date: bestDate,
          scheduled_start_time: `${String(startHour).padStart(2, '0')}:00`,
          scheduled_end_time: `${String(Math.min(endHour, 17)).padStart(2, '0')}:00`,
          status: 'scheduled',
          updated_at: new Date().toISOString()
        })
        .eq('id', request.id);

      // Create schedule entry
      await supabase
        .from('v2_crew_schedules')
        .insert([{
          crew_id: bestCrew.id,
          work_request_id: request.id,
          job_id: request.job_id,
          title: request.title,
          description: request.description,
          date: bestDate,
          start_time: `${String(startHour).padStart(2, '0')}:00`,
          end_time: `${String(Math.min(endHour, 17)).padStart(2, '0')}:00`
        }]);

      // Update availability tracking
      const key = `${bestCrew.id}-${bestDate}`;
      scheduled[key] = (scheduled[key] || 0) + estimatedHours;

      results.scheduled++;
      results.details.push({
        request_id: request.id,
        title: request.title,
        crew: bestCrew.name,
        date: bestDate
      });
    } else {
      results.skipped++;
    }
  }

  res.json(results);
}));

// ============ CREW TASK QUEUE ============

// Get task queue for a crew member
router.get('/members/:id/tasks', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { date } = req.query;

  let query = supabase
    .from('v2_crew_schedules')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      work_request:v2_work_requests(id, title, description, priority, notes)
    `)
    .eq('crew_id', id)
    .order('date')
    .order('start_time');

  if (date) {
    query = query.eq('date', date);
  } else {
    // Default to today and future
    query = query.gte('date', new Date().toISOString().split('T')[0]);
  }

  const { data, error } = await query;
  if (error) throw new AppError(error.message, 500);

  res.json(data || []);
}));

// Mark task as started
router.post('/schedules/:id/start', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_crew_schedules')
    .update({
      status: 'in_progress',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Schedule not found', 404);

  // Update work request if linked
  if (data.work_request_id) {
    await supabase
      .from('v2_work_requests')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString()
      })
      .eq('id', data.work_request_id);
  }

  res.json(data);
}));

// Mark task as complete
router.post('/schedules/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { actual_hours, notes } = req.body;

  const { data, error } = await supabase
    .from('v2_crew_schedules')
    .update({
      status: 'completed',
      actual_hours,
      notes,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError('Schedule not found', 404);

  // Update work request if linked
  if (data.work_request_id) {
    await supabase
      .from('v2_work_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', data.work_request_id);
  }

  res.json(data);
}));

module.exports = router;
