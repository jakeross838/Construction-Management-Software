/**
 * Leads/CRM Routes
 * Lead management, pipeline tracking, activities, tasks, and documents
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const { getUserName } = require('../utils/shared');

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

// Valid pipeline stages - updated to match v2_pipeline_stages table
const PIPELINE_STAGES = [
  'new_inquiry', 'initial_contact', 'scope_discussion', 'team_assembly',
  'precon_agreement', 'design_engineering', 'prelim_estimate', 'budget_review',
  'final_estimate', 'contract_negotiation', 'won', 'lost'
];

// ============================================================
// PIPELINE STAGES (from database)
// ============================================================

router.get('/stages', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_pipeline_stages')
    .select('*')
    .eq('is_active', true)
    .order('stage_order', { ascending: true });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

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
// LOST REASONS
// ============================================================

router.get('/lost-reasons', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_lost_lead_reasons')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// ============================================================
// LOST ANALYTICS
// ============================================================

router.get('/lost-analytics', asyncHandler(async (req, res) => {
  // Get all lost leads with their reasons
  const { data: lostLeads, error } = await supabase
    .from('v2_leads')
    .select('id, lost_reason, lost_competitor, lost_at, estimated_value, stage_entered_at, created_at')
    .eq('outcome', 'lost')
    .is('deleted_at', null);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Aggregate by reason
  const byReason = {};
  const byCompetitor = {};
  let totalLostValue = 0;
  let totalLeads = lostLeads?.length || 0;

  for (const lead of (lostLeads || [])) {
    // By reason
    const reason = lead.lost_reason || 'Unknown';
    if (!byReason[reason]) {
      byReason[reason] = { count: 0, value: 0 };
    }
    byReason[reason].count++;
    byReason[reason].value += lead.estimated_value || 0;

    // By competitor
    if (lead.lost_competitor) {
      if (!byCompetitor[lead.lost_competitor]) {
        byCompetitor[lead.lost_competitor] = { count: 0, value: 0 };
      }
      byCompetitor[lead.lost_competitor].count++;
      byCompetitor[lead.lost_competitor].value += lead.estimated_value || 0;
    }

    totalLostValue += lead.estimated_value || 0;
  }

  // Convert to sorted arrays
  const reasonsArray = Object.entries(byReason)
    .map(([reason, data]) => ({ reason, ...data, percentage: totalLeads > 0 ? Math.round((data.count / totalLeads) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);

  const competitorsArray = Object.entries(byCompetitor)
    .map(([competitor, data]) => ({ competitor, ...data }))
    .sort((a, b) => b.count - a.count);

  res.json({
    total_lost: totalLeads,
    total_lost_value: totalLostValue,
    by_reason: reasonsArray,
    by_competitor: competitorsArray,
  });
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
      job:v2_jobs!job_id(id, name)
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
      job:v2_jobs!job_id(id, name, address, status)
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
      stage: 'new_inquiry',
      stage_entered_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log initial stage
  await logStageChange(lead.id, null, 'new_inquiry', 'System');

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
  const { lost_reason, lost_competitor, changed_by, notes } = req.body;

  // Get current lead
  const { data: current, error: fetchError } = await supabase
    .from('v2_leads')
    .select('stage, notes')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !current) throw new AppError('NOT_FOUND', 'Lead not found');

  // Append lost notes if provided
  const updatedNotes = notes
    ? `[Marked Lost ${new Date().toLocaleDateString()}] ${notes}\n\n${current.notes || ''}`
    : current.notes;

  const { data: lead, error } = await supabase
    .from('v2_leads')
    .update({
      stage: 'lost',
      stage_entered_at: new Date().toISOString(),
      outcome: 'lost',
      lost_reason,
      lost_competitor,
      lost_at: new Date().toISOString(),
      notes: updatedNotes
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log stage change
  await logStageChange(id, current.stage, 'lost', changed_by || 'User');

  // Log activity
  await supabase.from('v2_lead_activities').insert({
    lead_id: id,
    activity_type: 'note',
    subject: 'Lead Marked as Lost',
    description: `Lost reason: ${lost_reason || 'Not specified'}${lost_competitor ? ` | Competitor: ${lost_competitor}` : ''}`,
    performed_by: changed_by || 'User',
    performed_at: new Date().toISOString(),
  });

  res.json(lead);
}));

// ============================================================
// REVIVE LOST LEAD
// ============================================================

router.post('/:id/revive', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, changed_by, target_stage } = req.body;

  // Get current lead
  const { data: current, error: fetchError } = await supabase
    .from('v2_leads')
    .select('stage, outcome, notes, lost_reason, lost_competitor')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !current) throw new AppError('NOT_FOUND', 'Lead not found');

  if (current.outcome !== 'lost') {
    throw new AppError('VALIDATION_ERROR', 'Only lost leads can be revived');
  }

  const reviveStage = target_stage || 'new_inquiry';
  const newNotes = notes
    ? `[Revived ${new Date().toLocaleDateString()}] ${notes}\n\n${current.notes || ''}`
    : current.notes;

  const { data: lead, error } = await supabase
    .from('v2_leads')
    .update({
      stage: reviveStage,
      stage_entered_at: new Date().toISOString(),
      outcome: null,
      lost_reason: null,
      lost_competitor: null,
      lost_at: null,
      revived_at: new Date().toISOString(),
      revival_notes: notes,
      notes: newNotes
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log stage change
  await logStageChange(id, 'lost', reviveStage, changed_by || 'User');

  // Log activity
  await supabase.from('v2_lead_activities').insert({
    lead_id: id,
    activity_type: 'note',
    subject: 'Lead Revived',
    description: `Lead revived from lost status. Previous reason: ${current.lost_reason || 'Not specified'}${current.lost_competitor ? ` | Previous competitor: ${current.lost_competitor}` : ''}${notes ? ` | Revival reason: ${notes}` : ''}`,
    performed_by: changed_by || 'User',
    performed_at: new Date().toISOString(),
  });

  res.json(lead);
}));

// ============================================================
// LEAD CONTACTS (Multiple people per lead)
// ============================================================

router.get('/:id/contacts', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_lead_contacts')
    .select('*')
    .eq('lead_id', id)
    .order('is_primary', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

router.post('/:id/contacts', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, email, phone, role, is_primary, notes } = req.body;

  if (!first_name || !last_name) {
    throw new AppError('VALIDATION_ERROR', 'First name and last name are required');
  }

  // If setting as primary, unset other primaries
  if (is_primary) {
    await supabase
      .from('v2_lead_contacts')
      .update({ is_primary: false })
      .eq('lead_id', id);
  }

  const { data, error } = await supabase
    .from('v2_lead_contacts')
    .insert({
      lead_id: id,
      first_name,
      last_name,
      email,
      phone,
      role: role || 'owner',
      is_primary: is_primary || false,
      notes
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.status(201).json(data);
}));

router.patch('/:leadId/contacts/:contactId', asyncHandler(async (req, res) => {
  const { leadId, contactId } = req.params;
  const updates = { ...req.body };

  delete updates.id;
  delete updates.lead_id;
  delete updates.created_at;

  // If setting as primary, unset other primaries
  if (updates.is_primary) {
    await supabase
      .from('v2_lead_contacts')
      .update({ is_primary: false })
      .eq('lead_id', leadId);
  }

  const { data, error } = await supabase
    .from('v2_lead_contacts')
    .update(updates)
    .eq('id', contactId)
    .eq('lead_id', leadId)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!data) throw new AppError('NOT_FOUND', 'Contact not found');
  res.json(data);
}));

router.delete('/:leadId/contacts/:contactId', asyncHandler(async (req, res) => {
  const { contactId } = req.params;

  const { error } = await supabase
    .from('v2_lead_contacts')
    .delete()
    .eq('id', contactId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// LEAD SCORING
// ============================================================

router.post('/:id/score', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { override_score, score_notes } = req.body;

  // Fetch lead data for scoring
  const { data: lead, error: fetchError } = await supabase
    .from('v2_leads')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError) throw new AppError('DATABASE_ERROR', fetchError.message);
  if (!lead) throw new AppError('NOT_FOUND', 'Lead not found');

  // Calculate score breakdown
  const breakdown = {};
  let totalScore = 0;

  // Budget score (max 30 points)
  const budgetMin = lead.budget_min || parseBudgetRange(lead.budget_range)?.min || 0;
  if (budgetMin >= 2000000) {
    breakdown.budget = 30;
  } else if (budgetMin >= 1500000) {
    breakdown.budget = 25;
  } else if (budgetMin >= 1000000) {
    breakdown.budget = 20;
  } else if (budgetMin >= 500000) {
    breakdown.budget = 10;
  } else {
    breakdown.budget = 5;
  }
  totalScore += breakdown.budget;

  // Land status score (max 25 points)
  if (lead.has_lot || lead.land_status === 'owns_lot') {
    breakdown.land = 25;
  } else if (lead.land_status === 'under_contract') {
    breakdown.land = 20;
  } else if (lead.land_status === 'looking') {
    breakdown.land = 10;
  } else {
    breakdown.land = 5;
  }
  totalScore += breakdown.land;

  // Source score (max 20 points)
  const referralSources = ['past client referral', 'architect referral', 'designer referral'];
  const sourceName = (lead.referral_source || '').toLowerCase();
  if (referralSources.some(s => sourceName.includes(s.toLowerCase()))) {
    breakdown.source = 20;
  } else if (sourceName.includes('referral')) {
    breakdown.source = 15;
  } else {
    breakdown.source = 10;
  }
  totalScore += breakdown.source;

  // Timeline score (max 15 points)
  const timeline = (lead.timeline || '').toLowerCase();
  if (timeline.includes('immediate') || timeline.includes('3 month') || timeline.includes('asap')) {
    breakdown.timeline = 15;
  } else if (timeline.includes('6 month')) {
    breakdown.timeline = 12;
  } else if (timeline.includes('year') || timeline.includes('12 month')) {
    breakdown.timeline = 8;
  } else {
    breakdown.timeline = 5;
  }
  totalScore += breakdown.timeline;

  // Readiness score (max 10 points)
  let readiness = 0;
  if (lead.has_plans) readiness += 5;
  if (lead.has_architect) readiness += 5;
  breakdown.readiness = readiness || 5;
  totalScore += breakdown.readiness;

  // Use override if provided
  const finalScore = override_score !== undefined ? override_score : totalScore;

  // Update lead with score
  const { data, error: updateError } = await supabase
    .from('v2_leads')
    .update({
      qualification_score: finalScore,
      score_breakdown: breakdown,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  res.json({
    lead: data,
    score: finalScore,
    breakdown,
    max_score: 100,
    is_override: override_score !== undefined,
  });
}));

// Helper to parse budget range string
function parseBudgetRange(range) {
  if (!range) return null;
  // Handle formats like "$1.5M - $2M", "1500000-2000000", "$1,500,000 - $2,000,000"
  const cleanRange = range.replace(/[,$]/g, '');
  const match = cleanRange.match(/([\d.]+)\s*[mM]?\s*[-–to]+\s*([\d.]+)\s*[mM]?/);
  if (match) {
    let min = parseFloat(match[1]);
    let max = parseFloat(match[2]);
    // If values look like millions (e.g., 1.5, 2)
    if (min < 100) min *= 1000000;
    if (max < 100) max *= 1000000;
    return { min, max };
  }
  return null;
}

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

// ============================================================
// LEAD ESTIMATES
// ============================================================

// Get estimates linked to a lead
router.get('/:id/estimates', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_estimates')
    .select('id, estimate_number, title, total_amount, status, version, created_at, updated_at')
    .eq('lead_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Create estimate from lead
router.post('/:id/estimates', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  // Get lead data to pre-populate estimate
  const { data: lead, error: leadError } = await supabase
    .from('v2_leads')
    .select('first_name, last_name, project_name, project_address, project_description, estimated_value, square_footage')
    .eq('id', id)
    .single();

  if (leadError) throw new AppError('NOT_FOUND', 'Lead not found');

  // Get next estimate number
  const { data: lastEstimate } = await supabase
    .from('v2_estimates')
    .select('estimate_number')
    .like('estimate_number', `EST-${new Date().getFullYear()}%`)
    .order('estimate_number', { ascending: false })
    .limit(1);

  let nextNumber = 1;
  if (lastEstimate && lastEstimate.length > 0) {
    const match = lastEstimate[0].estimate_number?.match(/EST-\d{4}-(\d+)/);
    if (match) nextNumber = parseInt(match[1], 10) + 1;
  }

  const estimateNumber = `EST-${new Date().getFullYear()}-${String(nextNumber).padStart(3, '0')}`;
  const estimateTitle = title || `${lead.first_name} ${lead.last_name} - ${lead.project_name || 'New Home'}`;

  const { data: estimate, error } = await supabase
    .from('v2_estimates')
    .insert({
      lead_id: id,
      estimate_number: estimateNumber,
      title: estimateTitle,
      total_amount: lead.estimated_value || 0,
      status: 'draft',
      version: 1,
      notes: lead.project_description,
      created_by: getUserName(req),
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Log activity
  await supabase.from('v2_lead_activities').insert({
    lead_id: id,
    activity_type: 'note',
    subject: 'Estimate Created',
    description: `Created estimate ${estimateNumber}`,
    performed_by: getUserName(req),
    performed_at: new Date().toISOString(),
  });

  res.status(201).json(estimate);
}));

// ============================================================
// LEAD TO JOB CONVERSION
// ============================================================

// Convert lead to job
router.post('/:id/convert-to-job', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { contract_amount } = req.body;

  // Get lead data
  const { data: lead, error: leadError } = await supabase
    .from('v2_leads')
    .select('*')
    .eq('id', id)
    .single();

  if (leadError || !lead) throw new AppError('NOT_FOUND', 'Lead not found');

  // Check if already converted
  if (lead.job_id) {
    throw new AppError('INVALID_OPERATION', 'Lead has already been converted to a job');
  }

  // Create job from lead data
  const jobName = lead.project_name || `${lead.first_name} ${lead.last_name}`;

  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .insert({
      name: jobName,
      address: lead.project_address,
      client_name: `${lead.first_name} ${lead.last_name}`,
      contract_amount: contract_amount || lead.estimated_value || 0,
      status: 'active',
      sqft_total: lead.square_footage,
      lead_id: id,
    })
    .select()
    .single();

  if (jobError) throw new AppError('DATABASE_ERROR', jobError.message);

  // Update lead with job reference and mark as converted
  const { error: updateError } = await supabase
    .from('v2_leads')
    .update({
      job_id: job.id,
      stage: 'won',
      outcome: 'won',
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  // Link any estimates to the new job
  await supabase
    .from('v2_estimates')
    .update({ job_id: job.id })
    .eq('lead_id', id);

  // Log activity
  await supabase.from('v2_lead_activities').insert({
    lead_id: id,
    activity_type: 'note',
    subject: 'Converted to Job',
    description: `Lead converted to job: ${job.name}`,
    performed_by: getUserName(req),
    performed_at: new Date().toISOString(),
  });

  // Log stage change
  await logStageChange(id, lead.stage, 'won', getUserName(req));

  res.status(201).json({
    success: true,
    job,
    message: `Lead converted to job: ${job.name}`
  });
}));

module.exports = router;
