/**
 * Safety & Compliance Routes
 * OSHA log 300, incident reporting, safety meetings, and toolbox talk templates
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { asyncHandler, AppError, notFoundError } = require('../core/errors');

// Configure multer for file uploads
const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image and PDF files are allowed'));
    }
  }
});

// Use existing 'invoices' bucket with subfolder for safety files
const FILE_BUCKET = 'invoices';
const FILE_PREFIX = 'safety-files';

// Common incident types and severities
const INCIDENT_TYPES = ['injury', 'near_miss', 'property_damage', 'environmental'];
const SEVERITY_LEVELS = ['minor', 'moderate', 'serious', 'critical'];
const INCIDENT_STATUS = ['open', 'investigating', 'closed'];
const MEETING_TYPES = ['daily_huddle', 'weekly', 'monthly', 'toolbox_talk'];

// ============================================================
// REFERENCE DATA ENDPOINTS
// ============================================================

router.get('/incident-types', (req, res) => {
  res.json(INCIDENT_TYPES);
});

router.get('/severity-levels', (req, res) => {
  res.json(SEVERITY_LEVELS);
});

router.get('/meeting-types', (req, res) => {
  res.json(MEETING_TYPES);
});

// ============================================================
// SAFETY STATISTICS
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id, builder_id, year } = req.query;
  const targetYear = year || new Date().getFullYear();
  const startDate = `${targetYear}-01-01`;
  const endDate = `${targetYear}-12-31`;

  // Build incident query
  let incidentQuery = supabase
    .from('v2_safety_incidents')
    .select('id, incident_type, severity, days_away, days_restricted, reported_to_osha, status, incident_date')
    .gte('incident_date', startDate)
    .lte('incident_date', endDate);

  if (job_id) {
    incidentQuery = incidentQuery.eq('job_id', job_id);
  }
  if (builder_id) {
    incidentQuery = incidentQuery.eq('builder_id', builder_id);
  }

  const { data: incidents, error: incidentError } = await incidentQuery;
  if (incidentError) throw incidentError;

  // Build meeting query
  let meetingQuery = supabase
    .from('v2_safety_meetings')
    .select('id, meeting_type, meeting_date, attendees')
    .gte('meeting_date', startDate)
    .lte('meeting_date', endDate);

  if (job_id) {
    meetingQuery = meetingQuery.eq('job_id', job_id);
  }
  if (builder_id) {
    meetingQuery = meetingQuery.eq('builder_id', builder_id);
  }

  const { data: meetings, error: meetingError } = await meetingQuery;
  if (meetingError) throw meetingError;

  // Calculate statistics
  const stats = {
    year: targetYear,
    incidents: {
      total: incidents?.length || 0,
      by_type: {
        injury: 0,
        near_miss: 0,
        property_damage: 0,
        environmental: 0
      },
      by_severity: {
        minor: 0,
        moderate: 0,
        serious: 0,
        critical: 0
      },
      by_status: {
        open: 0,
        investigating: 0,
        closed: 0
      },
      osha_recordable: 0,
      total_days_away: 0,
      total_days_restricted: 0
    },
    meetings: {
      total: meetings?.length || 0,
      by_type: {
        daily_huddle: 0,
        weekly: 0,
        monthly: 0,
        toolbox_talk: 0
      },
      total_attendees: 0,
      average_attendance: 0
    },
    // OSHA metrics
    osha: {
      recordable_incidents: 0,
      days_away_restricted_transfer: 0,
      dart_rate: 0  // Would need hours worked to calculate properly
    }
  };

  // Process incidents
  (incidents || []).forEach(inc => {
    if (stats.incidents.by_type[inc.incident_type] !== undefined) {
      stats.incidents.by_type[inc.incident_type]++;
    }
    if (stats.incidents.by_severity[inc.severity] !== undefined) {
      stats.incidents.by_severity[inc.severity]++;
    }
    if (stats.incidents.by_status[inc.status] !== undefined) {
      stats.incidents.by_status[inc.status]++;
    }
    if (inc.reported_to_osha) {
      stats.incidents.osha_recordable++;
      stats.osha.recordable_incidents++;
    }
    stats.incidents.total_days_away += inc.days_away || 0;
    stats.incidents.total_days_restricted += inc.days_restricted || 0;
  });

  stats.osha.days_away_restricted_transfer = stats.incidents.total_days_away + stats.incidents.total_days_restricted;

  // Process meetings
  let totalAttendees = 0;
  (meetings || []).forEach(mtg => {
    if (stats.meetings.by_type[mtg.meeting_type] !== undefined) {
      stats.meetings.by_type[mtg.meeting_type]++;
    }
    const attendeeCount = Array.isArray(mtg.attendees) ? mtg.attendees.length : 0;
    totalAttendees += attendeeCount;
  });

  stats.meetings.total_attendees = totalAttendees;
  stats.meetings.average_attendance = meetings?.length > 0
    ? Math.round(totalAttendees / meetings.length)
    : 0;

  res.json(stats);
}));

// ============================================================
// OSHA 300 LOG
// ============================================================

router.get('/osha-log', asyncHandler(async (req, res) => {
  const { year, job_id, builder_id } = req.query;
  const targetYear = year || new Date().getFullYear();
  const startDate = `${targetYear}-01-01`;
  const endDate = `${targetYear}-12-31`;

  // Get all recordable incidents for the year
  let query = supabase
    .from('v2_safety_incidents')
    .select(`
      *,
      job:v2_jobs(id, name, address)
    `)
    .gte('incident_date', startDate)
    .lte('incident_date', endDate)
    .eq('incident_type', 'injury')  // OSHA 300 is for injuries
    .order('incident_date', { ascending: true });

  if (job_id) {
    query = query.eq('job_id', job_id);
  }
  if (builder_id) {
    query = query.eq('builder_id', builder_id);
  }

  const { data: incidents, error } = await query;
  if (error) throw error;

  // Format for OSHA 300 Log
  const log300 = {
    year: targetYear,
    establishment_name: '', // Would come from builder settings
    entries: (incidents || []).map((inc, index) => ({
      case_number: inc.osha_case_number || `${targetYear}-${String(index + 1).padStart(3, '0')}`,
      employee_name: inc.injured_person_name || 'Not recorded',
      job_title: inc.injured_person_role || 'Not recorded',
      date_of_injury: inc.incident_date,
      where_event_occurred: inc.location || (inc.job?.name || 'Not recorded'),
      description: inc.description,
      // Classify injury type
      classify: {
        death: inc.severity === 'critical' && inc.status === 'closed' && inc.days_away > 180,
        days_away: (inc.days_away || 0) > 0,
        job_transfer_restriction: (inc.days_restricted || 0) > 0,
        other_recordable: inc.reported_to_osha && !inc.days_away && !inc.days_restricted
      },
      days_away_from_work: inc.days_away || 0,
      days_on_restriction: inc.days_restricted || 0,
      injury_type: categorizeInjuryType(inc.description)
    })),
    summary: {
      total_cases: incidents?.length || 0,
      deaths: 0,
      days_away_cases: (incidents || []).filter(i => (i.days_away || 0) > 0).length,
      restriction_cases: (incidents || []).filter(i => (i.days_restricted || 0) > 0 && !(i.days_away || 0)).length,
      other_recordable: (incidents || []).filter(i => i.reported_to_osha && !i.days_away && !i.days_restricted).length,
      total_days_away: (incidents || []).reduce((sum, i) => sum + (i.days_away || 0), 0),
      total_days_restricted: (incidents || []).reduce((sum, i) => sum + (i.days_restricted || 0), 0)
    }
  };

  res.json(log300);
}));

// Helper to categorize injury type for OSHA
function categorizeInjuryType(description) {
  if (!description) return 'other';
  const desc = description.toLowerCase();

  if (desc.includes('cut') || desc.includes('laceration')) return 'cut_laceration';
  if (desc.includes('strain') || desc.includes('sprain')) return 'sprain_strain';
  if (desc.includes('fracture') || desc.includes('broken')) return 'fracture';
  if (desc.includes('burn')) return 'burn';
  if (desc.includes('bruise') || desc.includes('contusion')) return 'bruise_contusion';
  if (desc.includes('eye')) return 'eye_injury';
  if (desc.includes('back')) return 'back_injury';
  if (desc.includes('fall') || desc.includes('fell')) return 'fall';
  if (desc.includes('struck')) return 'struck_by';
  if (desc.includes('caught')) return 'caught_in';

  return 'other';
}

// ============================================================
// INCIDENTS - LIST
// ============================================================

router.get('/incidents', asyncHandler(async (req, res) => {
  let query = supabase
    .from('v2_safety_incidents')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      attachments:v2_safety_incident_attachments(id, file_name, category)
    `)
    .order('incident_date', { ascending: false });

  // Filters
  if (req.query.job_id) {
    query = query.eq('job_id', req.query.job_id);
  }
  if (req.query.builder_id) {
    query = query.eq('builder_id', req.query.builder_id);
  }
  if (req.query.incident_type) {
    query = query.eq('incident_type', req.query.incident_type);
  }
  if (req.query.severity) {
    query = query.eq('severity', req.query.severity);
  }
  if (req.query.status) {
    query = query.eq('status', req.query.status);
  }
  if (req.query.from_date) {
    query = query.gte('incident_date', req.query.from_date);
  }
  if (req.query.to_date) {
    query = query.lte('incident_date', req.query.to_date);
  }
  if (req.query.osha_only === 'true') {
    query = query.eq('reported_to_osha', true);
  }
  if (req.query.search) {
    query = query.or(`description.ilike.%${req.query.search}%,injured_person_name.ilike.%${req.query.search}%,location.ilike.%${req.query.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  res.json(data || []);
}));

// ============================================================
// INCIDENTS - GET SINGLE
// ============================================================

router.get('/incidents/:id', asyncHandler(async (req, res) => {
  const { data: incident, error } = await supabase
    .from('v2_safety_incidents')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      attachments:v2_safety_incident_attachments(*),
      activity:v2_safety_incident_activity(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) throw error;
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  res.json(incident);
}));

// ============================================================
// INCIDENTS - CREATE
// ============================================================

router.post('/incidents', asyncHandler(async (req, res) => {
  const {
    builder_id,
    job_id,
    incident_date,
    incident_time,
    location,
    description,
    incident_type,
    severity,
    injured_person_name,
    injured_person_role,
    witness_names,
    immediate_actions,
    reported_by
  } = req.body;

  // Validation
  if (!incident_date || !description || !incident_type || !severity || !reported_by) {
    return res.status(400).json({
      error: 'incident_date, description, incident_type, severity, and reported_by are required'
    });
  }

  if (!INCIDENT_TYPES.includes(incident_type)) {
    return res.status(400).json({ error: `incident_type must be one of: ${INCIDENT_TYPES.join(', ')}` });
  }

  if (!SEVERITY_LEVELS.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${SEVERITY_LEVELS.join(', ')}` });
  }

  const { data: incident, error } = await supabase
    .from('v2_safety_incidents')
    .insert({
      builder_id: builder_id || null,
      job_id: job_id || null,
      incident_date,
      incident_time: incident_time || null,
      location: location || null,
      description,
      incident_type,
      severity,
      injured_person_name: injured_person_name || null,
      injured_person_role: injured_person_role || null,
      witness_names: witness_names || [],
      immediate_actions: immediate_actions || null,
      reported_by,
      status: 'open'
    })
    .select()
    .single();

  if (error) throw error;

  // Log activity
  await supabase
    .from('v2_safety_incident_activity')
    .insert({
      incident_id: incident.id,
      action: 'created',
      performed_by: reported_by,
      details: { incident_type, severity }
    });

  res.status(201).json(incident);
}));

// ============================================================
// INCIDENTS - UPDATE
// ============================================================

router.patch('/incidents/:id', asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  const updatedBy = updates.updated_by;
  delete updates.id;
  delete updates.created_at;
  delete updates.updated_by;

  // Validation for incident_type
  if (updates.incident_type && !INCIDENT_TYPES.includes(updates.incident_type)) {
    return res.status(400).json({ error: `incident_type must be one of: ${INCIDENT_TYPES.join(', ')}` });
  }

  // Validation for severity
  if (updates.severity && !SEVERITY_LEVELS.includes(updates.severity)) {
    return res.status(400).json({ error: `severity must be one of: ${SEVERITY_LEVELS.join(', ')}` });
  }

  // Validation for status
  if (updates.status && !INCIDENT_STATUS.includes(updates.status)) {
    return res.status(400).json({ error: `status must be one of: ${INCIDENT_STATUS.join(', ')}` });
  }

  const { data: incident, error } = await supabase
    .from('v2_safety_incidents')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  // Log activity
  await supabase
    .from('v2_safety_incident_activity')
    .insert({
      incident_id: incident.id,
      action: 'updated',
      performed_by: updatedBy || 'system',
      details: updates
    });

  res.json(incident);
}));

// ============================================================
// INCIDENTS - DELETE
// ============================================================

router.delete('/incidents/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('v2_safety_incidents')
    .delete()
    .eq('id', req.params.id);

  if (error) throw error;

  res.json({ success: true, message: 'Incident deleted' });
}));

// ============================================================
// INCIDENTS - CHANGE STATUS
// ============================================================

router.post('/incidents/:id/status', asyncHandler(async (req, res) => {
  const { status, performed_by, notes } = req.body;

  if (!status || !INCIDENT_STATUS.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${INCIDENT_STATUS.join(', ')}` });
  }

  const updates = {
    status,
    updated_at: new Date().toISOString()
  };

  // If closing, record closed info
  if (status === 'closed') {
    updates.closed_at = new Date().toISOString();
    updates.closed_by = performed_by || null;
  }

  const { data: incident, error } = await supabase
    .from('v2_safety_incidents')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  // Log activity
  await supabase
    .from('v2_safety_incident_activity')
    .insert({
      incident_id: incident.id,
      action: 'status_changed',
      performed_by: performed_by || 'system',
      details: { status, notes }
    });

  res.json(incident);
}));

// ============================================================
// INCIDENTS - REPORT TO OSHA
// ============================================================

router.post('/incidents/:id/osha-report', asyncHandler(async (req, res) => {
  const { osha_case_number, days_away, days_restricted, performed_by } = req.body;

  const { data: incident, error } = await supabase
    .from('v2_safety_incidents')
    .update({
      reported_to_osha: true,
      osha_case_number: osha_case_number || null,
      days_away: days_away || 0,
      days_restricted: days_restricted || 0,
      updated_at: new Date().toISOString()
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  // Log activity
  await supabase
    .from('v2_safety_incident_activity')
    .insert({
      incident_id: incident.id,
      action: 'osha_reported',
      performed_by: performed_by || 'system',
      details: { osha_case_number, days_away, days_restricted }
    });

  res.json(incident);
}));

// ============================================================
// INCIDENTS - UPLOAD ATTACHMENT
// ============================================================

router.post('/incidents/:id/attachments', fileUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Verify incident exists
  const { data: incident } = await supabase
    .from('v2_safety_incidents')
    .select('id, job_id')
    .eq('id', req.params.id)
    .single();

  if (!incident) {
    return res.status(404).json({ error: 'Incident not found' });
  }

  // Generate unique filename
  const timestamp = Date.now();
  const ext = req.file.originalname.split('.').pop() || 'file';
  const fileName = `${FILE_PREFIX}/incidents/${req.params.id}_${timestamp}.${ext}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(FILE_BUCKET)
    .getPublicUrl(fileName);

  // Save attachment record
  const { data: attachment, error } = await supabase
    .from('v2_safety_incident_attachments')
    .insert({
      incident_id: req.params.id,
      file_url: urlData.publicUrl,
      file_name: req.file.originalname,
      file_type: req.file.mimetype,
      description: req.body.description || null,
      category: req.body.category || 'photo',
      uploaded_by: req.body.uploaded_by || null
    })
    .select()
    .single();

  if (error) throw error;

  // Log activity
  await supabase
    .from('v2_safety_incident_activity')
    .insert({
      incident_id: req.params.id,
      action: 'attachment_added',
      performed_by: req.body.uploaded_by || 'system',
      details: { file_name: req.file.originalname }
    });

  res.status(201).json(attachment);
}));

// ============================================================
// MEETINGS - LIST
// ============================================================

router.get('/meetings', asyncHandler(async (req, res) => {
  let query = supabase
    .from('v2_safety_meetings')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      template:v2_toolbox_talk_templates(id, title, category)
    `)
    .order('meeting_date', { ascending: false });

  // Filters
  if (req.query.job_id) {
    query = query.eq('job_id', req.query.job_id);
  }
  if (req.query.builder_id) {
    query = query.eq('builder_id', req.query.builder_id);
  }
  if (req.query.meeting_type) {
    query = query.eq('meeting_type', req.query.meeting_type);
  }
  if (req.query.from_date) {
    query = query.gte('meeting_date', req.query.from_date);
  }
  if (req.query.to_date) {
    query = query.lte('meeting_date', req.query.to_date);
  }
  if (req.query.search) {
    query = query.or(`topic.ilike.%${req.query.search}%,conducted_by.ilike.%${req.query.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Add attendee count
  const enriched = (data || []).map(mtg => ({
    ...mtg,
    attendee_count: Array.isArray(mtg.attendees) ? mtg.attendees.length : 0
  }));

  res.json(enriched);
}));

// ============================================================
// MEETINGS - GET SINGLE
// ============================================================

router.get('/meetings/:id', asyncHandler(async (req, res) => {
  const { data: meeting, error } = await supabase
    .from('v2_safety_meetings')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      template:v2_toolbox_talk_templates(*)
    `)
    .eq('id', req.params.id)
    .single();

  if (error) throw error;
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  res.json(meeting);
}));

// ============================================================
// MEETINGS - CREATE
// ============================================================

router.post('/meetings', asyncHandler(async (req, res) => {
  const {
    builder_id,
    job_id,
    meeting_date,
    meeting_type,
    topic,
    template_id,
    attendees,
    notes,
    hazards_discussed,
    action_items,
    conducted_by,
    duration_minutes
  } = req.body;

  // Validation
  if (!meeting_date || !meeting_type || !conducted_by) {
    return res.status(400).json({
      error: 'meeting_date, meeting_type, and conducted_by are required'
    });
  }

  if (!MEETING_TYPES.includes(meeting_type)) {
    return res.status(400).json({ error: `meeting_type must be one of: ${MEETING_TYPES.join(', ')}` });
  }

  const { data: meeting, error } = await supabase
    .from('v2_safety_meetings')
    .insert({
      builder_id: builder_id || null,
      job_id: job_id || null,
      meeting_date,
      meeting_type,
      topic: topic || null,
      template_id: template_id || null,
      attendees: attendees || [],
      notes: notes || null,
      hazards_discussed: hazards_discussed || [],
      action_items: action_items || [],
      conducted_by,
      duration_minutes: duration_minutes || null
    })
    .select(`
      *,
      job:v2_jobs(id, name, address),
      template:v2_toolbox_talk_templates(id, title, category)
    `)
    .single();

  if (error) throw error;

  res.status(201).json(meeting);
}));

// ============================================================
// MEETINGS - UPDATE
// ============================================================

router.patch('/meetings/:id', asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.id;
  delete updates.created_at;

  // Validation for meeting_type
  if (updates.meeting_type && !MEETING_TYPES.includes(updates.meeting_type)) {
    return res.status(400).json({ error: `meeting_type must be one of: ${MEETING_TYPES.join(', ')}` });
  }

  const { data: meeting, error } = await supabase
    .from('v2_safety_meetings')
    .update(updates)
    .eq('id', req.params.id)
    .select(`
      *,
      job:v2_jobs(id, name, address),
      template:v2_toolbox_talk_templates(id, title, category)
    `)
    .single();

  if (error) throw error;
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  res.json(meeting);
}));

// ============================================================
// MEETINGS - DELETE
// ============================================================

router.delete('/meetings/:id', asyncHandler(async (req, res) => {
  const { error } = await supabase
    .from('v2_safety_meetings')
    .delete()
    .eq('id', req.params.id);

  if (error) throw error;

  res.json({ success: true, message: 'Meeting deleted' });
}));

// ============================================================
// MEETINGS - UPLOAD SIGN-IN SHEET
// ============================================================

router.post('/meetings/:id/sign-in-sheet', fileUpload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // Generate unique filename
  const timestamp = Date.now();
  const ext = req.file.originalname.split('.').pop() || 'file';
  const fileName = `${FILE_PREFIX}/sign-in-sheets/${req.params.id}_${timestamp}.${ext}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from(FILE_BUCKET)
    .upload(fileName, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(FILE_BUCKET)
    .getPublicUrl(fileName);

  // Update meeting with sign-in sheet URL
  const { data: meeting, error } = await supabase
    .from('v2_safety_meetings')
    .update({
      sign_in_sheet_url: urlData.publicUrl,
      updated_at: new Date().toISOString()
    })
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  res.json(meeting);
}));

// ============================================================
// TEMPLATES - LIST
// ============================================================

router.get('/templates', asyncHandler(async (req, res) => {
  let query = supabase
    .from('v2_toolbox_talk_templates')
    .select('*')
    .order('title', { ascending: true });

  // Filters
  if (req.query.builder_id) {
    // Get builder templates OR default templates
    query = query.or(`builder_id.eq.${req.query.builder_id},is_default.eq.true`);
  }
  if (req.query.category) {
    query = query.eq('category', req.query.category);
  }
  if (req.query.is_default === 'true') {
    query = query.eq('is_default', true);
  }
  if (req.query.search) {
    query = query.or(`title.ilike.%${req.query.search}%,category.ilike.%${req.query.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  res.json(data || []);
}));

// ============================================================
// TEMPLATES - GET SINGLE
// ============================================================

router.get('/templates/:id', asyncHandler(async (req, res) => {
  const { data: template, error } = await supabase
    .from('v2_toolbox_talk_templates')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error) throw error;
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(template);
}));

// ============================================================
// TEMPLATES - CREATE
// ============================================================

router.post('/templates', asyncHandler(async (req, res) => {
  const {
    builder_id,
    title,
    category,
    content,
    duration_minutes,
    required_ppe,
    hazards_covered
  } = req.body;

  // Validation
  if (!title) {
    return res.status(400).json({ error: 'title is required' });
  }

  const { data: template, error } = await supabase
    .from('v2_toolbox_talk_templates')
    .insert({
      builder_id: builder_id || null,
      title,
      category: category || null,
      content: content || null,
      duration_minutes: duration_minutes || 15,
      required_ppe: required_ppe || [],
      hazards_covered: hazards_covered || [],
      is_default: false  // User-created templates are not defaults
    })
    .select()
    .single();

  if (error) throw error;

  res.status(201).json(template);
}));

// ============================================================
// TEMPLATES - UPDATE
// ============================================================

router.patch('/templates/:id', asyncHandler(async (req, res) => {
  const updates = { ...req.body, updated_at: new Date().toISOString() };
  delete updates.id;
  delete updates.created_at;
  delete updates.is_default;  // Don't allow changing default status

  const { data: template, error } = await supabase
    .from('v2_toolbox_talk_templates')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error) throw error;
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.json(template);
}));

// ============================================================
// TEMPLATES - DELETE
// ============================================================

router.delete('/templates/:id', asyncHandler(async (req, res) => {
  // Don't allow deleting default templates
  const { data: existing } = await supabase
    .from('v2_toolbox_talk_templates')
    .select('is_default')
    .eq('id', req.params.id)
    .single();

  if (existing?.is_default) {
    return res.status(400).json({ error: 'Cannot delete default templates' });
  }

  const { error } = await supabase
    .from('v2_toolbox_talk_templates')
    .delete()
    .eq('id', req.params.id);

  if (error) throw error;

  res.json({ success: true, message: 'Template deleted' });
}));

// ============================================================
// TEMPLATES - GET CATEGORIES
// ============================================================

router.get('/template-categories', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_toolbox_talk_templates')
    .select('category')
    .not('category', 'is', null);

  if (error) throw error;

  // Get unique categories
  const categories = [...new Set((data || []).map(t => t.category).filter(Boolean))].sort();

  res.json(categories);
}));

module.exports = router;
