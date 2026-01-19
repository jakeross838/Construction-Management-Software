/**
 * Leads/CRM Routes
 * Lead management, pipeline tracking, activities, tasks, and documents
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// Multer for document uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and image files are allowed'));
    }
  }
});

const STORAGE_BUCKET = 'invoices';
const LEAD_PREFIX = 'lead-documents';

// Valid pipeline stages
const PIPELINE_STAGES = ['inquiry', 'qualification', 'consultation', 'design_agreement', 'proposal', 'contract', 'won', 'lost'];

// ============================================================
// HELPER: Log stage change
// ============================================================
async function logStageChange(leadId, fromStage, toStage, changedBy) {
  await supabase.from('v2_lead_stage_history').insert({
    lead_id: leadId,
    from_stage: fromStage,
    to_stage: toStage,
    changed_by: changedBy
  });
}

// ============================================================
// LEAD SOURCES
// ============================================================

router.get('/sources', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_lead_sources')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// ============================================================
// STATS ENDPOINT (must be before /:id)
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { data: leads, error } = await supabase
    .from('v2_leads')
    .select('id, stage, outcome, budget_range, qualification_score')
    .is('deleted_at', null);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total: leads.length,
    by_stage: {},
    by_outcome: { won: 0, lost: 0, active: 0 },
    avg_qualification_score: 0,
    hot_leads: 0,
    warm_leads: 0,
    cold_leads: 0
  };

  let totalScore = 0;
  let scoreCount = 0;

  for (const lead of leads) {
    // Count by stage
    stats.by_stage[lead.stage] = (stats.by_stage[lead.stage] || 0) + 1;

    // Count by outcome
    if (lead.outcome === 'won') {
      stats.by_outcome.won++;
    } else if (lead.outcome === 'lost') {
      stats.by_outcome.lost++;
    } else {
      stats.by_outcome.active++;
    }

    // Qualification scoring
    if (lead.qualification_score !== null) {
      totalScore += lead.qualification_score;
      scoreCount++;

      if (lead.qualification_score >= 12) {
        stats.hot_leads++;
      } else if (lead.qualification_score >= 8) {
        stats.warm_leads++;
      } else {
        stats.cold_leads++;
      }
    }
  }

  stats.avg_qualification_score = scoreCount > 0 ? Math.round(totalScore / scoreCount * 10) / 10 : 0;

  res.json(stats);
}));

// ============================================================
// LIST LEADS
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { stage, source_id, outcome, search, assigned_to } = req.query;

  let query = supabase
    .from('v2_leads')
    .select(`
      *,
      source:v2_lead_sources(id, name, category),
      job:v2_jobs(id, name)
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (stage) query = query.eq('stage', stage);
  if (source_id) query = query.eq('lead_source_id', source_id);
  if (outcome) query = query.eq('outcome', outcome);
  if (assigned_to) query = query.eq('assigned_to', assigned_to);
  if (search) {
    query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,project_address.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get task counts for each lead
  const leadIds = (data || []).map(l => l.id);
  if (leadIds.length > 0) {
    const { data: tasks } = await supabase
      .from('v2_lead_tasks')
      .select('lead_id, status')
      .in('lead_id', leadIds);

    const taskCounts = {};
    for (const task of (tasks || [])) {
      if (!taskCounts[task.lead_id]) {
        taskCounts[task.lead_id] = { pending: 0, completed: 0 };
      }
      if (task.status === 'pending') {
        taskCounts[task.lead_id].pending++;
      } else if (task.status === 'completed') {
        taskCounts[task.lead_id].completed++;
      }
    }

    for (const lead of data) {
      lead.task_counts = taskCounts[lead.id] || { pending: 0, completed: 0 };
    }
  }

  res.json(data || []);
}));

// ============================================================
// GET SINGLE LEAD
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: lead, error } = await supabase
    .from('v2_leads')
    .select(`
      *,
      source:v2_lead_sources(id, name, category),
      job:v2_jobs(id, name, address, status)
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !lead) throw new AppError('NOT_FOUND', 'Lead not found');

  // Get activities
  const { data: activities } = await supabase
    .from('v2_lead_activities')
    .select('*')
    .eq('lead_id', id)
    .order('performed_at', { ascending: false });

  // Get tasks
  const { data: tasks } = await supabase
    .from('v2_lead_tasks')
    .select('*')
    .eq('lead_id', id)
    .order('due_date', { ascending: true });

  // Get documents
  const { data: documents } = await supabase
    .from('v2_lead_documents')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });

  // Get stage history
  const { data: stageHistory } = await supabase
    .from('v2_lead_stage_history')
    .select('*')
    .eq('lead_id', id)
    .order('changed_at', { ascending: false });

  res.json({
    ...lead,
    activities: activities || [],
    tasks: tasks || [],
    documents: documents || [],
    stage_history: stageHistory || []
  });
}));

// ============================================================
// CREATE LEAD
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const {
    first_name,
    last_name,
    email,
    phone,
    preferred_contact_method,
    lead_source_id,
    lead_source_detail,
    referral_source,
    project_type,
    project_address,
    has_lot,
    budget_range,
    timeline,
    square_footage,
    bedrooms,
    bathrooms,
    architectural_style,
    project_description,
    is_decision_maker,
    financing_status,
    has_architect,
    has_plans,
    qualification_score,
    assigned_to,
    notes
  } = req.body;

  if (!first_name || !last_name) {
    throw new AppError('VALIDATION_ERROR', 'First name and last name are required');
  }

  const { data: lead, error } = await supabase
    .from('v2_leads')
    .insert({
      first_name,
      last_name,
      email,
      phone,
      preferred_contact_method,
      lead_source_id,
      lead_source_detail,
      referral_source,
      project_type,
      project_address,
      has_lot,
      budget_range,
      timeline,
      square_footage,
      bedrooms,
      bathrooms,
      architectural_style,
      project_description,
      is_decision_maker,
      financing_status,
      has_architect,
      has_plans,
      qualification_score: qualification_score || 0,
      assigned_to,
      notes,
      stage: 'inquiry',
      stage_entered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log initial stage
  await logStageChange(lead.id, null, 'inquiry', 'System');

  res.status(201).json(lead);
}));

// ============================================================
// UPDATE LEAD
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body };

  // Remove fields that shouldn't be directly updated
  delete updates.id;
  delete updates.created_at;
  delete updates.job_id;
  delete updates.converted_at;

  // If stage is being changed, handle it separately
  if (updates.stage) {
    const { data: current } = await supabase
      .from('v2_leads')
      .select('stage')
      .eq('id', id)
      .single();

    if (current && current.stage !== updates.stage) {
      updates.stage_entered_at = new Date().toISOString();
      await logStageChange(id, current.stage, updates.stage, updates.changed_by || 'User');
    }
    delete updates.changed_by;
  }

  const { data: lead, error } = await supabase
    .from('v2_leads')
    .update(updates)
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!lead) throw new AppError('NOT_FOUND', 'Lead not found');

  res.json(lead);
}));

// ============================================================
// DELETE LEAD (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_leads')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Lead not found');

  res.json({ success: true, message: 'Lead deleted' });
}));

// ============================================================
// CHANGE STAGE
// ============================================================

router.post('/:id/stage', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { stage, changed_by } = req.body;

  if (!stage || !PIPELINE_STAGES.includes(stage)) {
    throw new AppError('VALIDATION_ERROR', `Invalid stage. Must be one of: ${PIPELINE_STAGES.join(', ')}`);
  }

  // Get current lead
  const { data: current, error: fetchError } = await supabase
    .from('v2_leads')
    .select('stage, outcome')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !current) throw new AppError('NOT_FOUND', 'Lead not found');

  // Don't allow changes to already-closed leads
  if (current.outcome === 'won' || current.outcome === 'lost') {
    throw new AppError('VALIDATION_ERROR', 'Cannot change stage of a closed lead');
  }

  const fromStage = current.stage;

  // Update stage
  const { data: lead, error } = await supabase
    .from('v2_leads')
    .update({
      stage,
      stage_entered_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log stage change
  await logStageChange(id, fromStage, stage, changed_by || 'User');

  res.json(lead);
}));

// ============================================================
// MARK LEAD AS WON (Convert to Job)
// ============================================================

router.post('/:id/convert', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { converted_by } = req.body;

  // Get lead
  const { data: lead, error: fetchError } = await supabase
    .from('v2_leads')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !lead) throw new AppError('NOT_FOUND', 'Lead not found');

  if (lead.outcome === 'won') {
    throw new AppError('VALIDATION_ERROR', 'Lead already converted');
  }

  // Create job from lead data
  const jobName = `${lead.last_name} - ${lead.project_address || 'New Project'}`;

  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .insert({
      name: jobName,
      address: lead.project_address,
      client_name: `${lead.first_name} ${lead.last_name}`,
      status: 'active',
      notes: lead.notes
    })
    .select()
    .single();

  if (jobError) throw new AppError('DATABASE_ERROR', `Failed to create job: ${jobError.message}`);

  // Update lead with job link
  const { data: updatedLead, error: updateError } = await supabase
    .from('v2_leads')
    .update({
      stage: 'won',
      stage_entered_at: new Date().toISOString(),
      outcome: 'won',
      job_id: job.id,
      converted_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Log stage change
  await logStageChange(id, lead.stage, 'won', converted_by || 'User');

  res.json({
    lead: updatedLead,
    job
  });
}));

// ============================================================
// MARK LEAD AS LOST
// ============================================================

router.post('/:id/lost', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { lost_reason, lost_competitor, changed_by } = req.body;

  // Get current lead
  const { data: current, error: fetchError } = await supabase
    .from('v2_leads')
    .select('stage')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !current) throw new AppError('NOT_FOUND', 'Lead not found');

  const { data: lead, error } = await supabase
    .from('v2_leads')
    .update({
      stage: 'lost',
      stage_entered_at: new Date().toISOString(),
      outcome: 'lost',
      lost_reason,
      lost_competitor
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log stage change
  await logStageChange(id, current.stage, 'lost', changed_by || 'User');

  res.json(lead);
}));

// ============================================================
// ACTIVITIES
// ============================================================

router.get('/:id/activities', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lead_activities')
    .select('*')
    .eq('lead_id', id)
    .order('performed_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

router.post('/:id/activities', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { activity_type, direction, subject, description, outcome, duration_minutes, performed_by, performed_at } = req.body;

  if (!activity_type) {
    throw new AppError('VALIDATION_ERROR', 'Activity type is required');
  }

  const { data, error } = await supabase
    .from('v2_lead_activities')
    .insert({
      lead_id: id,
      activity_type,
      direction,
      subject,
      description,
      outcome,
      duration_minutes,
      performed_by,
      performed_at: performed_at || new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json(data);
}));

// ============================================================
// TASKS
// ============================================================

router.get('/:id/tasks', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.query;

  let query = supabase
    .from('v2_lead_tasks')
    .select('*')
    .eq('lead_id', id)
    .order('due_date', { ascending: true });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

router.post('/:id/tasks', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { task_type, title, description, due_date, due_time, priority, assigned_to } = req.body;

  if (!task_type || !title || !due_date) {
    throw new AppError('VALIDATION_ERROR', 'Task type, title, and due date are required');
  }

  const { data, error } = await supabase
    .from('v2_lead_tasks')
    .insert({
      lead_id: id,
      task_type,
      title,
      description,
      due_date,
      due_time,
      priority: priority || 'normal',
      assigned_to
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json(data);
}));

router.patch('/:leadId/tasks/:taskId', asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const updates = { ...req.body };

  delete updates.id;
  delete updates.lead_id;
  delete updates.created_at;

  const { data, error } = await supabase
    .from('v2_lead_tasks')
    .update(updates)
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Task not found');
  res.json(data);
}));

router.post('/:leadId/tasks/:taskId/complete', asyncHandler(async (req, res) => {
  const { taskId } = req.params;
  const { completed_by } = req.body;

  const { data, error } = await supabase
    .from('v2_lead_tasks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      completed_by
    })
    .eq('id', taskId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Task not found');
  res.json(data);
}));

router.delete('/:leadId/tasks/:taskId', asyncHandler(async (req, res) => {
  const { taskId } = req.params;

  const { error } = await supabase
    .from('v2_lead_tasks')
    .delete()
    .eq('id', taskId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// DOCUMENTS
// ============================================================

router.get('/:id/documents', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lead_documents')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

router.post('/:id/documents', upload.single('file'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { category, uploaded_by } = req.body;

  if (!req.file) {
    throw new AppError('VALIDATION_ERROR', 'File is required');
  }

  const fileName = `${Date.now()}-${req.file.originalname}`;
  const filePath = `${LEAD_PREFIX}/${id}/${fileName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filePath, req.file.buffer, {
      contentType: req.file.mimetype,
      upsert: false
    });

  if (uploadError) throw new AppError('STORAGE_ERROR', uploadError.message);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath);

  // Create document record
  const { data, error } = await supabase
    .from('v2_lead_documents')
    .insert({
      lead_id: id,
      name: req.file.originalname,
      file_url: urlData.publicUrl,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      category,
      uploaded_by
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json(data);
}));

router.delete('/:leadId/documents/:docId', asyncHandler(async (req, res) => {
  const { docId } = req.params;

  // Get document to find file URL
  const { data: doc, error: fetchError } = await supabase
    .from('v2_lead_documents')
    .select('file_url')
    .eq('id', docId)
    .single();

  if (fetchError || !doc) throw new AppError('NOT_FOUND', 'Document not found');

  // Delete from storage
  if (doc.file_url) {
    const path = doc.file_url.split(`${STORAGE_BUCKET}/`)[1];
    if (path) {
      await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    }
  }

  // Delete record
  const { error } = await supabase
    .from('v2_lead_documents')
    .delete()
    .eq('id', docId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// STAGE HISTORY
// ============================================================

router.get('/:id/history', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lead_stage_history')
    .select('*')
    .eq('lead_id', id)
    .order('changed_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

module.exports = router;
