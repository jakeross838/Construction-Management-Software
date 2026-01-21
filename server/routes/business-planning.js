/**
 * Business Planning Routes
 * Annual/quarterly planning, targets, and performance tracking
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// PLANS
// ============================================================

// Get all plans
router.get('/plans', asyncHandler(async (req, res) => {
  const { year, status } = req.query;

  let query = supabase
    .from('v2_business_plans_summary')
    .select('*')
    .order('year', { ascending: false });

  if (year) query = query.eq('year', parseInt(year));
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Get plan detail
router.get('/plans/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get plan
  const { data: plan, error: planError } = await supabase
    .from('v2_business_plans')
    .select('*')
    .eq('id', id)
    .single();

  if (planError) throw new AppError('DATABASE_ERROR', planError.message);
  if (!plan) throw new AppError('NOT_FOUND', 'Plan not found');

  // Get performance
  const { data: performance } = await supabase
    .rpc('calculate_plan_performance', { p_plan_id: id });

  // Get milestones
  const { data: milestones } = await supabase
    .from('v2_plan_milestones')
    .select('*')
    .eq('plan_id', id)
    .order('target_date');

  // Get actuals by period
  const { data: actuals } = await supabase
    .from('v2_plan_actuals')
    .select('*, period:v2_financial_periods(name, start_date, end_date)')
    .eq('plan_id', id)
    .order('snapshot_date');

  // Get KPI targets
  const { data: kpiTargets } = await supabase
    .from('v2_kpi_targets')
    .select('*, kpi:v2_kpi_definitions(*)')
    .eq('plan_id', id);

  res.json({
    plan,
    performance: performance?.[0] || {},
    milestones: milestones || [],
    actuals: actuals || [],
    kpi_targets: kpiTargets || []
  });
}));

// Create plan
router.post('/plans', asyncHandler(async (req, res) => {
  const {
    plan_name,
    plan_type,
    year,
    quarter,
    start_date,
    end_date,
    revenue_target = 0,
    gross_margin_target = 0,
    net_margin_target = 0,
    jobs_target = 0,
    avg_job_size_target = 0,
    labor_cost_target = 0,
    material_cost_target = 0,
    overhead_target = 0,
    revenue_growth_target = 0,
    notes,
    created_by
  } = req.body;

  if (!plan_name || !plan_type || !year || !start_date || !end_date) {
    throw new AppError('VALIDATION_FAILED', 'plan_name, plan_type, year, start_date, and end_date are required');
  }

  const { data, error } = await supabase
    .from('v2_business_plans')
    .insert({
      plan_name,
      plan_type,
      year,
      quarter,
      start_date,
      end_date,
      revenue_target,
      gross_margin_target,
      net_margin_target,
      jobs_target,
      avg_job_size_target,
      labor_cost_target,
      material_cost_target,
      overhead_target,
      revenue_growth_target,
      notes,
      created_by
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Update plan
router.patch('/plans/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updates = { ...req.body, updated_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('v2_business_plans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Activate plan
router.patch('/plans/:id/activate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  const { data, error } = await supabase
    .from('v2_business_plans')
    .update({
      status: 'active',
      approved_at: new Date().toISOString(),
      approved_by
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// MILESTONES
// ============================================================

// Get milestones for a plan
router.get('/plans/:planId/milestones', asyncHandler(async (req, res) => {
  const { planId } = req.params;

  const { data, error } = await supabase
    .from('v2_plan_milestones')
    .select('*')
    .eq('plan_id', planId)
    .order('target_date');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Add milestone
router.post('/plans/:planId/milestones', asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const {
    milestone_name,
    target_date,
    category,
    target_value,
    target_metric,
    notes
  } = req.body;

  if (!milestone_name || !target_date) {
    throw new AppError('VALIDATION_FAILED', 'milestone_name and target_date are required');
  }

  const { data, error } = await supabase
    .from('v2_plan_milestones')
    .insert({
      plan_id: planId,
      milestone_name,
      target_date,
      category,
      target_value,
      target_metric,
      notes
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Update milestone
router.patch('/milestones/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, actual_value, achieved_date, notes } = req.body;

  const updates = {};
  if (status) updates.status = status;
  if (actual_value !== undefined) updates.actual_value = actual_value;
  if (achieved_date) updates.achieved_date = achieved_date;
  if (notes !== undefined) updates.notes = notes;

  const { data, error } = await supabase
    .from('v2_plan_milestones')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// ACTUALS
// ============================================================

// Update actuals from P&L
router.post('/plans/:planId/update-actuals', asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const { period_id } = req.body;

  if (!period_id) {
    throw new AppError('VALIDATION_FAILED', 'period_id is required');
  }

  const { data, error } = await supabase
    .rpc('update_plan_actuals', {
      p_plan_id: planId,
      p_period_id: period_id
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json({ actual_id: data, success: true });
}));

// Get actuals for a plan
router.get('/plans/:planId/actuals', asyncHandler(async (req, res) => {
  const { planId } = req.params;

  const { data, error } = await supabase
    .from('v2_plan_actuals')
    .select('*, period:v2_financial_periods(id, name, start_date, end_date)')
    .eq('plan_id', planId)
    .order('snapshot_date');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// KPIs
// ============================================================

// Get KPI definitions
router.get('/kpis', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('v2_kpi_definitions')
    .select('*')
    .eq('is_active', true)
    .order('display_order');

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// Set KPI target for plan
router.post('/plans/:planId/kpi-targets', asyncHandler(async (req, res) => {
  const { planId } = req.params;
  const { kpi_id, target_value, stretch_target, notes } = req.body;

  if (!kpi_id || target_value === undefined) {
    throw new AppError('VALIDATION_FAILED', 'kpi_id and target_value are required');
  }

  const { data, error } = await supabase
    .from('v2_kpi_targets')
    .upsert({
      plan_id: planId,
      kpi_id,
      target_value,
      stretch_target,
      notes
    }, { onConflict: 'plan_id,kpi_id' })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  res.json(data);
}));

// ============================================================
// DASHBOARD
// ============================================================

// Get planning dashboard
router.get('/dashboard', asyncHandler(async (req, res) => {
  const currentYear = new Date().getFullYear();

  // Get active plan
  const { data: activePlan } = await supabase
    .from('v2_business_plans')
    .select('*')
    .eq('status', 'active')
    .eq('year', currentYear)
    .single();

  let performance = null;
  let milestones = [];

  if (activePlan) {
    // Get performance
    const { data: perf } = await supabase
      .rpc('calculate_plan_performance', { p_plan_id: activePlan.id });
    performance = perf?.[0];

    // Get upcoming milestones
    const { data: ms } = await supabase
      .from('v2_plan_milestones')
      .select('*')
      .eq('plan_id', activePlan.id)
      .in('status', ['pending', 'on_track', 'at_risk'])
      .order('target_date')
      .limit(5);
    milestones = ms || [];
  }

  // Get KPI summary
  const { data: kpis } = await supabase
    .from('v2_kpi_definitions')
    .select('*')
    .eq('is_active', true)
    .order('display_order')
    .limit(6);

  res.json({
    active_plan: activePlan,
    performance,
    upcoming_milestones: milestones,
    kpis: kpis || []
  });
}));

module.exports = router;
