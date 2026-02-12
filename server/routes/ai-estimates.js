/**
 * AI Estimates Routes
 * AI-generated preliminary estimates and historical pricing aggregation
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');
const { getBuilderId } = require('../core/multi-tenant');

// ============================================================
// HISTORICAL PRICING AGGREGATION
// ============================================================

/**
 * Refresh historical pricing cache for all cost codes
 * Aggregates data from PO line items and accepted bids
 */
async function refreshHistoricalPricing(builderId) {
  // Get all cost codes
  const { data: costCodes, error: ccError } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name')
    .eq('builder_id', builderId);

  if (ccError) throw new AppError('DATABASE_ERROR', ccError.message);

  const results = [];

  for (const cc of costCodes || []) {
    // Get amounts from PO line items
    const { data: poLines } = await supabase
      .from('v2_po_line_items')
      .select('amount')
      .eq('cost_code_id', cc.id)
      .eq('builder_id', builderId)
      .gt('amount', 0);

    // Get amounts from bid lines
    const { data: bidLines } = await supabase
      .from('v2_bid_lines')
      .select(`
        amount,
        bid:v2_bids!inner(status)
      `)
      .eq('cost_code_id', cc.id)
      .eq('builder_id', builderId)
      .eq('bid.status', 'accepted')
      .gt('amount', 0);

    // Get amounts from estimate lines (approved/converted)
    const { data: estLines } = await supabase
      .from('v2_estimate_lines')
      .select(`
        amount,
        estimate:v2_estimates!inner(status)
      `)
      .eq('cost_code_id', cc.id)
      .eq('builder_id', builderId)
      .in('estimate.status', ['approved', 'converted'])
      .gt('amount', 0);

    // Combine all amounts
    const allAmounts = [
      ...(poLines || []).map(p => parseFloat(p.amount)),
      ...(bidLines || []).map(b => parseFloat(b.amount)),
      ...(estLines || []).map(e => parseFloat(e.amount))
    ].filter(a => a > 0);

    if (allAmounts.length === 0) continue;

    const stats = {
      cost_code_id: cc.id,
      avg_amount: allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length,
      min_amount: Math.min(...allAmounts),
      max_amount: Math.max(...allAmounts),
      sample_count: allAmounts.length,
      avg_per_sqft: 0, // Would need job sqft data to calculate
      last_refreshed: new Date().toISOString(),
      builder_id: builderId
    };

    // Upsert into historical_pricing
    const { error: upsertError } = await supabase
      .from('v2_historical_pricing')
      .upsert(stats, { onConflict: 'cost_code_id' });

    if (!upsertError) {
      results.push({ code: cc.code, name: cc.name, ...stats });
    }
  }

  return results;
}

// Endpoint to refresh historical pricing
router.post('/refresh-pricing', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);
  const results = await refreshHistoricalPricing(builderId);
  res.json({
    success: true,
    message: `Updated pricing for ${results.length} cost codes`,
    results
  });
}));

// Get historical pricing for a cost code
router.get('/pricing/:costCodeId', asyncHandler(async (req, res) => {
  const { costCodeId } = req.params;
  const builderId = getBuilderId(req);

  const { data: pricing, error } = await supabase
    .from('v2_historical_pricing')
    .select('*')
    .eq('cost_code_id', costCodeId)
    .eq('builder_id', builderId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(pricing || {
    cost_code_id: costCodeId,
    avg_amount: 0,
    min_amount: 0,
    max_amount: 0,
    sample_count: 0,
    avg_per_sqft: 0
  });
}));

// Get all historical pricing
router.get('/pricing', asyncHandler(async (req, res) => {
  const builderId = getBuilderId(req);

  const { data: pricing, error } = await supabase
    .from('v2_historical_pricing')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('builder_id', builderId)
    .order('avg_amount', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(pricing || []);
}));

// ============================================================
// AI ESTIMATE GENERATION
// ============================================================

/**
 * Generate AI estimate for a job
 * Uses historical data and AI to estimate costs
 */
router.post('/jobs/:id/generate', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;
  const builderId = getBuilderId(req);
  const { generated_by, scope_description, job_sqft, job_type } = req.body;

  // Get job details
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name, address, contract_amount')
    .eq('id', jobId)
    .eq('builder_id', builderId)
    .single();

  if (jobError || !job) throw new AppError('NOT_FOUND', 'Job not found');

  // Mark any existing active AI estimates as superseded
  await supabase
    .from('v2_ai_estimates')
    .update({ status: 'superseded', updated_at: new Date().toISOString() })
    .eq('job_id', jobId)
    .eq('builder_id', builderId)
    .eq('status', 'active');

  // Get historical pricing for all cost codes
  const { data: pricing } = await supabase
    .from('v2_historical_pricing')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('builder_id', builderId)
    .gt('sample_count', 0);

  // Get cost codes to estimate
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .eq('builder_id', builderId)
    .order('code');

  // Build pricing map
  const pricingMap = {};
  (pricing || []).forEach(p => {
    pricingMap[p.cost_code_id] = p;
  });

  // Generate estimate lines using historical data
  const estimateLines = [];
  let totalAmount = 0;
  let totalConfidence = 0;
  let lineCount = 0;

  for (const cc of (costCodes || [])) {
    const historical = pricingMap[cc.id];

    if (historical && historical.avg_amount > 0) {
      // Use historical average
      const amount = historical.avg_amount;
      const confidence = Math.min(0.95, 0.5 + (historical.sample_count * 0.05));

      estimateLines.push({
        cost_code_id: cc.id,
        description: cc.name,
        amount,
        confidence,
        data_source: 'historical_avg',
        reasoning: `Based on ${historical.sample_count} historical entries. Range: $${historical.min_amount.toLocaleString()} - $${historical.max_amount.toLocaleString()}`,
        sort_order: parseInt(cc.code) || 0
      });

      totalAmount += amount;
      totalConfidence += confidence;
      lineCount++;
    }
  }

  // Calculate overall confidence
  const overallConfidence = lineCount > 0 ? totalConfidence / lineCount : 0.3;

  // Create the AI estimate
  const { data: aiEstimate, error: createError } = await supabase
    .from('v2_ai_estimates')
    .insert({
      job_id: jobId,
      total_amount: totalAmount,
      job_sqft: job_sqft || null,
      job_type: job_type || null,
      scope_description: scope_description || null,
      confidence: overallConfidence,
      similar_jobs_used: 0,
      status: 'active',
      generated_by: generated_by || 'System',
      builder_id: builderId
    })
    .select()
    .single();

  if (createError) throw new AppError('DATABASE_ERROR', createError.message);

  // Insert estimate lines
  if (estimateLines.length > 0) {
    const linesToInsert = estimateLines.map(line => ({
      ai_estimate_id: aiEstimate.id,
      ...line,
      builder_id: builderId
    }));

    await supabase.from('v2_ai_estimate_lines').insert(linesToInsert);
  }

  // Return the complete estimate with lines
  const { data: lines } = await supabase
    .from('v2_ai_estimate_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('ai_estimate_id', aiEstimate.id)
    .order('sort_order', { ascending: true });

  res.status(201).json({
    success: true,
    message: `AI estimate generated with ${lines?.length || 0} line items`,
    estimate: {
      ...aiEstimate,
      lines: lines || [],
      job
    }
  });
}));

// ============================================================
// GET AI ESTIMATES
// ============================================================

// Get active AI estimate for a job
router.get('/jobs/:id', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;
  const builderId = getBuilderId(req);

  const { data: estimate, error } = await supabase
    .from('v2_ai_estimates')
    .select(`
      *,
      job:v2_jobs(id, name, address)
    `)
    .eq('job_id', jobId)
    .eq('builder_id', builderId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new AppError('DATABASE_ERROR', error.message);
  }

  if (!estimate) {
    return res.json(null);
  }

  // Get lines
  const { data: lines } = await supabase
    .from('v2_ai_estimate_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('ai_estimate_id', estimate.id)
    .order('sort_order', { ascending: true });

  res.json({
    ...estimate,
    lines: lines || []
  });
}));

// Get all AI estimates for a job (including superseded)
router.get('/jobs/:id/history', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;
  const builderId = getBuilderId(req);

  const { data: estimates, error } = await supabase
    .from('v2_ai_estimates')
    .select('id, total_amount, confidence, status, created_at, generated_by')
    .eq('job_id', jobId)
    .eq('builder_id', builderId)
    .order('created_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(estimates || []);
}));

// Get specific AI estimate by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const builderId = getBuilderId(req);

  const { data: estimate, error } = await supabase
    .from('v2_ai_estimates')
    .select(`
      *,
      job:v2_jobs(id, name, address)
    `)
    .eq('id', id)
    .eq('builder_id', builderId)
    .single();

  if (error || !estimate) throw new AppError('NOT_FOUND', 'AI estimate not found');

  // Get lines
  const { data: lines } = await supabase
    .from('v2_ai_estimate_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('ai_estimate_id', id)
    .order('sort_order', { ascending: true });

  res.json({
    ...estimate,
    lines: lines || []
  });
}));

// ============================================================
// REFRESH AI ESTIMATE
// ============================================================

router.post('/jobs/:id/refresh', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;
  const builderId = getBuilderId(req);
  const { generated_by } = req.body;

  // Get existing estimate for context
  const { data: existing } = await supabase
    .from('v2_ai_estimates')
    .select('scope_description, job_sqft, job_type')
    .eq('job_id', jobId)
    .eq('builder_id', builderId)
    .eq('status', 'active')
    .single();

  // Regenerate with existing context
  req.body = {
    generated_by: generated_by || 'System',
    scope_description: existing?.scope_description,
    job_sqft: existing?.job_sqft,
    job_type: existing?.job_type
  };

  // Forward to generate endpoint
  const generateHandler = router.stack.find(
    layer => layer.route?.path === '/jobs/:id/generate' && layer.route?.methods?.post
  );

  if (generateHandler) {
    req.params.id = jobId;
    return generateHandler.route.stack[0].handle(req, res);
  }

  // Fallback - just generate fresh
  throw new AppError('SERVER_ERROR', 'Could not refresh estimate');
}));

// ============================================================
// STATS
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;
  const builderId = getBuilderId(req);

  let query = supabase
    .from('v2_ai_estimates')
    .select('id, status, total_amount, confidence')
    .eq('builder_id', builderId);

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: estimates, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total: estimates?.length || 0,
    active: 0,
    superseded: 0,
    total_value: 0,
    avg_confidence: 0
  };

  let confidenceSum = 0;
  for (const est of (estimates || [])) {
    stats[est.status] = (stats[est.status] || 0) + 1;
    stats.total_value += parseFloat(est.total_amount) || 0;
    confidenceSum += parseFloat(est.confidence) || 0;
  }

  stats.avg_confidence = stats.total > 0 ? confidenceSum / stats.total : 0;

  res.json(stats);
}));

module.exports = router;
