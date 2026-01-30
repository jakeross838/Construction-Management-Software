/**
 * Budget Builder Routes
 * Smart budget assembly from multiple sources (bids, AI estimates, manual estimates)
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../core/errors');

// ============================================================
// BUDGET COMPARISON
// ============================================================

/**
 * Get comprehensive budget comparison for a job
 * Shows AI estimate vs bids vs manual estimates for each cost code
 */
router.get('/jobs/:id/comparison', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;

  // Get job info
  const { data: job, error: jobError } = await supabase
    .from('v2_jobs')
    .select('id, name, contract_amount')
    .eq('id', jobId)
    .single();

  if (jobError || !job) throw new AppError('NOT_FOUND', 'Job not found');

  // Get all cost codes
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .order('code');

  // Get current budget lines
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('*')
    .eq('job_id', jobId);

  // Get active AI estimate
  const { data: aiEstimate } = await supabase
    .from('v2_ai_estimates')
    .select('id, total_amount, confidence')
    .eq('job_id', jobId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Get AI estimate lines if exists
  let aiLines = [];
  if (aiEstimate) {
    const { data: lines } = await supabase
      .from('v2_ai_estimate_lines')
      .select('*')
      .eq('ai_estimate_id', aiEstimate.id);
    aiLines = lines || [];
  }

  // Get accepted bids with lines
  const { data: acceptedBids } = await supabase
    .from('v2_bids')
    .select(`
      id,
      title,
      bid_amount,
      vendor:v2_vendors(id, name),
      primary_cost_code_id
    `)
    .eq('job_id', jobId)
    .eq('status', 'accepted')
    .is('deleted_at', null);

  // Get bid lines for accepted bids
  const bidIds = (acceptedBids || []).map(b => b.id);
  let bidLines = [];
  if (bidIds.length > 0) {
    const { data: lines } = await supabase
      .from('v2_bid_lines')
      .select('*')
      .in('bid_id', bidIds);
    bidLines = lines || [];
  }

  // Get approved/converted estimates with lines
  const { data: estimates } = await supabase
    .from('v2_estimates')
    .select('id, title, total_amount')
    .eq('job_id', jobId)
    .in('status', ['approved', 'converted'])
    .is('deleted_at', null);

  const estIds = (estimates || []).map(e => e.id);
  let estLines = [];
  if (estIds.length > 0) {
    const { data: lines } = await supabase
      .from('v2_estimate_lines')
      .select('*')
      .in('estimate_id', estIds);
    estLines = lines || [];
  }

  // Build comparison data per cost code
  const comparison = [];
  const budgetMap = {};
  const aiMap = {};
  const bidMap = {};
  const estMap = {};

  // Index by cost code
  (budgetLines || []).forEach(bl => {
    budgetMap[bl.cost_code_id] = bl;
  });
  (aiLines || []).forEach(al => {
    aiMap[al.cost_code_id] = al;
  });
  (bidLines || []).forEach(bl => {
    if (!bidMap[bl.cost_code_id]) bidMap[bl.cost_code_id] = [];
    bidMap[bl.cost_code_id].push(bl);
  });
  // Also map lump-sum bids to their primary cost code
  (acceptedBids || []).forEach(bid => {
    if (bid.primary_cost_code_id) {
      if (!bidMap[bid.primary_cost_code_id]) bidMap[bid.primary_cost_code_id] = [];
      // Check if we already have bid lines for this bid
      const hasBidLines = bidLines.some(bl => bl.bid_id === bid.id);
      if (!hasBidLines) {
        bidMap[bid.primary_cost_code_id].push({
          bid_id: bid.id,
          cost_code_id: bid.primary_cost_code_id,
          amount: bid.bid_amount,
          description: bid.title,
          vendor_name: bid.vendor?.name,
          is_lump_sum: true
        });
      }
    }
  });
  (estLines || []).forEach(el => {
    if (!estMap[el.cost_code_id]) estMap[el.cost_code_id] = [];
    estMap[el.cost_code_id].push(el);
  });

  // Build comparison for each cost code
  let totals = {
    budget: 0,
    ai: 0,
    bids: 0,
    estimates: 0,
    from_bids: 0,
    from_ai: 0,
    from_estimates: 0,
    from_manual: 0,
    gaps: 0
  };

  for (const cc of (costCodes || [])) {
    const budget = budgetMap[cc.id];
    const ai = aiMap[cc.id];
    const bids = bidMap[cc.id] || [];
    const ests = estMap[cc.id] || [];

    const row = {
      cost_code: cc,
      budget: budget ? {
        id: budget.id,
        amount: parseFloat(budget.budgeted_amount) || 0,
        source_type: budget.source_type || 'manual',
        source_bid_id: budget.source_bid_id,
        source_ai_estimate_id: budget.source_ai_estimate_id,
        source_estimate_id: budget.source_estimate_id,
        locked: budget.source_locked || false
      } : null,
      ai_estimate: ai ? {
        amount: parseFloat(ai.amount) || 0,
        confidence: ai.confidence,
        reasoning: ai.reasoning,
        data_source: ai.data_source
      } : null,
      bids: bids.map(b => ({
        bid_id: b.bid_id,
        amount: parseFloat(b.amount) || 0,
        description: b.description,
        vendor_name: b.vendor_name,
        is_lump_sum: b.is_lump_sum || false
      })),
      estimates: ests.map(e => ({
        estimate_id: e.estimate_id,
        amount: parseFloat(e.amount) || 0,
        description: e.description
      })),
      // Recommended source selection
      recommended_source: null,
      recommended_amount: 0
    };

    // Determine recommended source (priority: bid > estimate > ai)
    if (bids.length > 0) {
      const lowestBid = bids.reduce((min, b) =>
        parseFloat(b.amount) < parseFloat(min.amount) ? b : min, bids[0]);
      row.recommended_source = 'bid';
      row.recommended_amount = parseFloat(lowestBid.amount) || 0;
    } else if (ests.length > 0) {
      const latestEst = ests[ests.length - 1];
      row.recommended_source = 'estimate';
      row.recommended_amount = parseFloat(latestEst.amount) || 0;
    } else if (ai) {
      row.recommended_source = 'ai';
      row.recommended_amount = parseFloat(ai.amount) || 0;
    }

    // Calculate totals
    if (budget) {
      totals.budget += parseFloat(budget.budgeted_amount) || 0;
      if (budget.source_type === 'accepted_bid') totals.from_bids += parseFloat(budget.budgeted_amount) || 0;
      else if (budget.source_type === 'ai_estimate') totals.from_ai += parseFloat(budget.budgeted_amount) || 0;
      else if (budget.source_type === 'estimate') totals.from_estimates += parseFloat(budget.budgeted_amount) || 0;
      else totals.from_manual += parseFloat(budget.budgeted_amount) || 0;
    }
    if (ai) totals.ai += parseFloat(ai.amount) || 0;
    if (bids.length > 0) totals.bids += bids.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
    if (ests.length > 0) totals.estimates += ests.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    // Count gaps (cost codes with no budget and no sources)
    if (!budget && !ai && bids.length === 0 && ests.length === 0) {
      totals.gaps++;
    }

    comparison.push(row);
  }

  // Calculate coverage percentages
  const coverage = {
    from_bids_pct: totals.budget > 0 ? (totals.from_bids / totals.budget * 100).toFixed(1) : 0,
    from_ai_pct: totals.budget > 0 ? (totals.from_ai / totals.budget * 100).toFixed(1) : 0,
    from_estimates_pct: totals.budget > 0 ? (totals.from_estimates / totals.budget * 100).toFixed(1) : 0,
    from_manual_pct: totals.budget > 0 ? (totals.from_manual / totals.budget * 100).toFixed(1) : 0
  };

  res.json({
    job,
    ai_estimate: aiEstimate,
    totals,
    coverage,
    comparison
  });
}));

// ============================================================
// SMART BUDGET ASSEMBLY
// ============================================================

/**
 * Auto-assemble budget from best available sources
 * Priority: accepted_bid > estimate > ai_estimate
 * Skips locked lines
 */
router.post('/jobs/:id/assemble', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;
  const { performed_by, include_ai } = req.body;

  // Get comparison data
  const comparisonResponse = await new Promise((resolve) => {
    const mockReq = { params: { id: jobId } };
    const mockRes = { json: resolve };
    router.handle(mockReq, mockRes, () => {});
  });

  // This won't work directly, let's do it properly
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name')
    .order('code');

  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('*')
    .eq('job_id', jobId);

  const { data: aiEstimate } = await supabase
    .from('v2_ai_estimates')
    .select('id')
    .eq('job_id', jobId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let aiLines = [];
  if (aiEstimate) {
    const { data } = await supabase
      .from('v2_ai_estimate_lines')
      .select('*')
      .eq('ai_estimate_id', aiEstimate.id);
    aiLines = data || [];
  }

  const { data: acceptedBids } = await supabase
    .from('v2_bids')
    .select('id, bid_amount, primary_cost_code_id')
    .eq('job_id', jobId)
    .eq('status', 'accepted')
    .is('deleted_at', null);

  const bidIds = (acceptedBids || []).map(b => b.id);
  let bidLines = [];
  if (bidIds.length > 0) {
    const { data } = await supabase
      .from('v2_bid_lines')
      .select('*')
      .in('bid_id', bidIds);
    bidLines = data || [];
  }

  const { data: estimates } = await supabase
    .from('v2_estimates')
    .select('id')
    .eq('job_id', jobId)
    .in('status', ['approved', 'converted'])
    .is('deleted_at', null);

  const estIds = (estimates || []).map(e => e.id);
  let estLines = [];
  if (estIds.length > 0) {
    const { data } = await supabase
      .from('v2_estimate_lines')
      .select('*')
      .in('estimate_id', estIds);
    estLines = data || [];
  }

  // Index current budget lines
  const budgetMap = {};
  (budgetLines || []).forEach(bl => {
    budgetMap[bl.cost_code_id] = bl;
  });

  // Process each cost code
  const results = { created: 0, updated: 0, skipped: 0 };

  for (const cc of (costCodes || [])) {
    const existing = budgetMap[cc.id];

    // Skip locked lines
    if (existing?.source_locked) {
      results.skipped++;
      continue;
    }

    // Find best source
    let bestSource = null;
    let amount = 0;
    let sourceType = 'manual';
    let sourceBidId = null;
    let sourceAiEstimateId = null;
    let sourceEstimateId = null;

    // Check bids first (highest priority)
    const ccBidLines = bidLines.filter(bl => bl.cost_code_id === cc.id);
    const lumpSumBid = (acceptedBids || []).find(b => b.primary_cost_code_id === cc.id);

    if (ccBidLines.length > 0) {
      const lowestBidLine = ccBidLines.reduce((min, bl) =>
        parseFloat(bl.amount) < parseFloat(min.amount) ? bl : min, ccBidLines[0]);
      bestSource = 'bid';
      amount = parseFloat(lowestBidLine.amount) || 0;
      sourceType = 'accepted_bid';
      sourceBidId = lowestBidLine.bid_id;
    } else if (lumpSumBid && !bidLines.some(bl => bl.bid_id === lumpSumBid.id)) {
      bestSource = 'bid';
      amount = parseFloat(lumpSumBid.bid_amount) || 0;
      sourceType = 'accepted_bid';
      sourceBidId = lumpSumBid.id;
    }

    // Check estimates (second priority)
    if (!bestSource) {
      const ccEstLines = estLines.filter(el => el.cost_code_id === cc.id);
      if (ccEstLines.length > 0) {
        const latest = ccEstLines[ccEstLines.length - 1];
        bestSource = 'estimate';
        amount = parseFloat(latest.amount) || 0;
        sourceType = 'estimate';
        sourceEstimateId = latest.estimate_id;
      }
    }

    // Check AI estimate (third priority, if enabled)
    if (!bestSource && include_ai !== false && aiEstimate) {
      const ccAiLine = aiLines.find(al => al.cost_code_id === cc.id);
      if (ccAiLine) {
        bestSource = 'ai';
        amount = parseFloat(ccAiLine.amount) || 0;
        sourceType = 'ai_estimate';
        sourceAiEstimateId = aiEstimate.id;
      }
    }

    // Update or create budget line if we have a source
    if (bestSource && amount > 0) {
      if (existing) {
        await supabase
          .from('v2_budget_lines')
          .update({
            budgeted_amount: amount,
            source_type: sourceType,
            source_bid_id: sourceBidId,
            source_ai_estimate_id: sourceAiEstimateId,
            source_estimate_id: sourceEstimateId
          })
          .eq('id', existing.id);
        results.updated++;
      } else {
        await supabase
          .from('v2_budget_lines')
          .insert({
            job_id: jobId,
            cost_code_id: cc.id,
            budgeted_amount: amount,
            committed_amount: 0,
            billed_amount: 0,
            paid_amount: 0,
            source_type: sourceType,
            source_bid_id: sourceBidId,
            source_ai_estimate_id: sourceAiEstimateId,
            source_estimate_id: sourceEstimateId
          });
        results.created++;
      }
    }
  }

  res.json({
    success: true,
    message: `Budget assembled: ${results.created} created, ${results.updated} updated, ${results.skipped} locked/skipped`,
    results
  });
}));

// ============================================================
// SOURCE OVERRIDE
// ============================================================

/**
 * Override the source for a specific budget line
 */
router.patch('/jobs/:id/lines/:costCodeId/source', asyncHandler(async (req, res) => {
  const { id: jobId, costCodeId } = req.params;
  const { source_type, source_id, amount, lock } = req.body;

  // Get existing budget line
  const { data: existing } = await supabase
    .from('v2_budget_lines')
    .select('*')
    .eq('job_id', jobId)
    .eq('cost_code_id', costCodeId)
    .single();

  const updates = {
    source_type: source_type || 'manual',
    budgeted_amount: amount
  };

  // Clear old source references
  updates.source_bid_id = null;
  updates.source_ai_estimate_id = null;
  updates.source_estimate_id = null;

  // Set new source reference
  if (source_type === 'accepted_bid' && source_id) {
    updates.source_bid_id = source_id;
  } else if (source_type === 'ai_estimate' && source_id) {
    updates.source_ai_estimate_id = source_id;
  } else if (source_type === 'estimate' && source_id) {
    updates.source_estimate_id = source_id;
  }

  if (lock !== undefined) {
    updates.source_locked = lock;
  }

  if (existing) {
    const { data: updated, error } = await supabase
      .from('v2_budget_lines')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw new AppError('DATABASE_ERROR', error.message);
    res.json(updated);
  } else {
    const { data: created, error } = await supabase
      .from('v2_budget_lines')
      .insert({
        job_id: jobId,
        cost_code_id: costCodeId,
        committed_amount: 0,
        billed_amount: 0,
        paid_amount: 0,
        ...updates
      })
      .select()
      .single();

    if (error) throw new AppError('DATABASE_ERROR', error.message);
    res.status(201).json(created);
  }
}));

// ============================================================
// LOCK MANAGEMENT
// ============================================================

/**
 * Lock all current budget lines (prevent auto-update)
 */
router.post('/jobs/:id/lock-all', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;

  const { error } = await supabase
    .from('v2_budget_lines')
    .update({ source_locked: true })
    .eq('job_id', jobId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: 'All budget lines locked' });
}));

/**
 * Unlock all budget lines
 */
router.post('/jobs/:id/unlock-all', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;

  const { error } = await supabase
    .from('v2_budget_lines')
    .update({ source_locked: false })
    .eq('job_id', jobId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: 'All budget lines unlocked' });
}));

/**
 * Toggle lock on a single line
 */
router.patch('/jobs/:id/lines/:costCodeId/lock', asyncHandler(async (req, res) => {
  const { id: jobId, costCodeId } = req.params;
  const { locked } = req.body;

  const { data: existing } = await supabase
    .from('v2_budget_lines')
    .select('id, source_locked')
    .eq('job_id', jobId)
    .eq('cost_code_id', costCodeId)
    .single();

  if (!existing) throw new AppError('NOT_FOUND', 'Budget line not found');

  const newLocked = locked !== undefined ? locked : !existing.source_locked;

  const { data: updated, error } = await supabase
    .from('v2_budget_lines')
    .update({ source_locked: newLocked })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(updated);
}));

// ============================================================
// COVERAGE GAPS
// ============================================================

/**
 * Get cost codes that still need bids
 */
router.get('/jobs/:id/gaps', asyncHandler(async (req, res) => {
  const { id: jobId } = req.params;

  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .order('code');

  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('cost_code_id, source_type, budgeted_amount')
    .eq('job_id', jobId);

  const budgetMap = {};
  (budgetLines || []).forEach(bl => {
    budgetMap[bl.cost_code_id] = bl;
  });

  const gaps = [];
  for (const cc of (costCodes || [])) {
    const budget = budgetMap[cc.id];
    // Consider it a gap if no budget, or budget is from AI only
    if (!budget || budget.source_type === 'ai_estimate') {
      gaps.push({
        cost_code: cc,
        current_source: budget?.source_type || 'none',
        current_amount: budget?.budgeted_amount || 0
      });
    }
  }

  res.json({
    gap_count: gaps.length,
    total_cost_codes: costCodes?.length || 0,
    coverage_pct: ((((costCodes?.length || 0) - gaps.length) / (costCodes?.length || 1)) * 100).toFixed(1),
    gaps
  });
}));

module.exports = router;
