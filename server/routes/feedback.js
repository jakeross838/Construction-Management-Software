/**
 * Feedback Routes (Phase 76: Feedback Loops)
 * AI learning, correction tracking, user feedback
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { asyncHandler, AppError } = require('../errors');

// ============================================================
// AI PREDICTIONS
// ============================================================

// Log a new AI prediction
router.post('/predictions', asyncHandler(async (req, res) => {
  const {
    prediction_type,
    entity_type,
    entity_id,
    predicted_value,
    confidence,
    input_features,
    model_version
  } = req.body;

  if (!prediction_type || !predicted_value) {
    throw new AppError('VALIDATION_ERROR', 'prediction_type and predicted_value required');
  }

  const { data, error } = await supabase
    .rpc('log_ai_prediction', {
      p_type: prediction_type,
      p_entity_type: entity_type || null,
      p_entity_id: entity_id || null,
      p_predicted_value: predicted_value,
      p_confidence: confidence || null,
      p_input_features: input_features || null,
      p_model_version: model_version || 'v1'
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ prediction_id: data });
}));

// Record a correction to a prediction
router.post('/predictions/:id/correction', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { corrected_value, corrected_by } = req.body;

  const { error } = await supabase
    .rpc('record_prediction_correction', {
      p_prediction_id: id,
      p_corrected_value: corrected_value,
      p_corrected_by: corrected_by || 'user'
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// Mark prediction as correct (no correction needed)
router.post('/predictions/:id/confirm', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { confirmed_by } = req.body;

  const { data, error } = await supabase
    .from('v2_ai_predictions')
    .update({
      was_correct: true,
      correction_type: 'none',
      corrected_by: confirmed_by,
      evaluated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get recent predictions
router.get('/predictions', asyncHandler(async (req, res) => {
  const { type, entity_type, days = 7, limit = 100 } = req.query;

  let query = supabase
    .from('v2_ai_predictions')
    .select('*')
    .gte('predicted_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('predicted_at', { ascending: false })
    .limit(parseInt(limit));

  if (type) {
    query = query.eq('prediction_type', type);
  }

  if (entity_type) {
    query = query.eq('entity_type', entity_type);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// ============================================================
// ACCURACY METRICS
// ============================================================

// Get learning dashboard
router.get('/learning/dashboard', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_learning_dashboard')
    .select('*');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Get accuracy trend
router.get('/accuracy/trend', asyncHandler(async (req, res) => {
  const { type, days = 30 } = req.query;

  const { data, error } = await supabase
    .rpc('get_accuracy_trend', {
      p_prediction_type: type || null,
      p_days: parseInt(days)
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Trigger accuracy metrics update
router.post('/accuracy/update', asyncHandler(async (req, res) => {
  const { date } = req.body;

  const { error } = await supabase
    .rpc('update_accuracy_metrics', {
      p_date: date || new Date().toISOString().split('T')[0]
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// CORRECTION PATTERNS
// ============================================================

// Get correction patterns
router.get('/patterns', asyncHandler(async (req, res) => {
  const { type, min_occurrences = 1, status = 'active' } = req.query;

  let query = supabase
    .from('v2_correction_patterns')
    .select('*')
    .gte('occurrence_count', parseInt(min_occurrences))
    .order('occurrence_count', { ascending: false });

  if (type) {
    query = query.eq('pattern_type', type);
  }

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Get patterns ready for learning rules
router.get('/patterns/learnable', asyncHandler(async (req, res) => {
  const { min_occurrences = 3 } = req.query;

  const { data, error } = await supabase
    .rpc('get_correction_patterns_for_learning', {
      p_min_occurrences: parseInt(min_occurrences)
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Confirm a pattern as a learning rule
router.post('/patterns/:id/confirm', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { confirmed_by, auto_correct = false } = req.body;

  const { data, error } = await supabase
    .from('v2_correction_patterns')
    .update({
      status: 'confirmed',
      should_auto_correct: auto_correct,
      confirmed_by,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Deprecate a pattern
router.post('/patterns/:id/deprecate', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from('v2_correction_patterns')
    .update({
      status: 'deprecated',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// LEARNING RULES
// ============================================================

// Get active learning rules
router.get('/rules', asyncHandler(async (req, res) => {
  const { applies_to, active_only = true } = req.query;

  let query = supabase
    .from('v2_learning_rules')
    .select('*')
    .order('times_applied', { ascending: false });

  if (applies_to) {
    query = query.eq('applies_to', applies_to);
  }

  if (active_only === true || active_only === 'true') {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Create learning rule from pattern
router.post('/rules', asyncHandler(async (req, res) => {
  const {
    rule_name,
    rule_type,
    applies_to,
    condition,
    action,
    source_pattern_id,
    confidence,
    created_by
  } = req.body;

  if (!rule_name || !applies_to || !condition || !action) {
    throw new AppError('VALIDATION_ERROR', 'Missing required fields');
  }

  const { data, error } = await supabase
    .from('v2_learning_rules')
    .insert({
      rule_name,
      rule_type: rule_type || 'substitution',
      applies_to,
      condition,
      action,
      source_pattern_id,
      confidence: confidence || 75,
      created_by
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Toggle rule active status
router.patch('/rules/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { is_active } = req.body;

  const { data, error } = await supabase
    .from('v2_learning_rules')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Record rule application
router.post('/rules/:id/applied', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { was_overridden = false } = req.body;

  const updateData = {
    times_applied: supabase.raw('times_applied + 1'),
    last_applied_at: new Date().toISOString()
  };

  if (was_overridden) {
    updateData.times_overridden = supabase.raw('times_overridden + 1');
  }

  // Use RPC or raw SQL since supabase.raw isn't directly supported
  const { error } = await supabase.rpc('increment_rule_usage', {
    p_rule_id: id,
    p_was_overridden: was_overridden
  }).catch(async () => {
    // Fallback to regular update
    return await supabase
      .from('v2_learning_rules')
      .update({ last_applied_at: new Date().toISOString() })
      .eq('id', id);
  });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ success: true });
}));

// ============================================================
// USER FEEDBACK
// ============================================================

// Submit user feedback
router.post('/user-feedback', asyncHandler(async (req, res) => {
  const {
    feature_area,
    entity_type,
    entity_id,
    rating,
    sentiment,
    feedback_text,
    tags,
    is_bug_report,
    submitted_by
  } = req.body;

  if (!feature_area) {
    throw new AppError('VALIDATION_ERROR', 'feature_area required');
  }

  const { data, error } = await supabase
    .from('v2_user_feedback')
    .insert({
      feature_area,
      entity_type,
      entity_id,
      rating,
      sentiment,
      feedback_text,
      tags: tags || [],
      is_bug_report: is_bug_report || false,
      submitted_by
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get feedback summary
router.get('/user-feedback/summary', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_feedback_summary')
    .select('*');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Get feedback list
router.get('/user-feedback', asyncHandler(async (req, res) => {
  const { feature_area, is_bug, resolved, limit = 50 } = req.query;

  let query = supabase
    .from('v2_user_feedback')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(parseInt(limit));

  if (feature_area) {
    query = query.eq('feature_area', feature_area);
  }

  if (is_bug !== undefined) {
    query = query.eq('is_bug_report', is_bug === 'true');
  }

  if (resolved !== undefined) {
    query = query.eq('resolved', resolved === 'true');
  }

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Resolve feedback/bug
router.patch('/user-feedback/:id/resolve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { resolved_by, resolution_notes } = req.body;

  const { data, error } = await supabase
    .from('v2_user_feedback')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by,
      resolution_notes
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// SYSTEM HEALTH
// ============================================================

// Get system health metrics
router.get('/health/metrics', asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const { data, error } = await supabase
    .from('v2_system_health_metrics')
    .select('*')
    .gte('metric_date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
    .order('metric_date', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data || []);
}));

// Record daily health metrics
router.post('/health/record', asyncHandler(async (req, res) => {
  const metrics = req.body;

  const { data, error } = await supabase
    .from('v2_system_health_metrics')
    .upsert({
      metric_date: new Date().toISOString().split('T')[0],
      ...metrics
    }, { onConflict: 'metric_date' })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

module.exports = router;
