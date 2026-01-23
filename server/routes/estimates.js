/**
 * Estimates Routes
 * Cost estimation, versioning, and budget conversion
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../../config');
const { AppError, asyncHandler } = require('../errors');

// ============================================================
// ACTIVITY LOGGING HELPER
// ============================================================

async function logEstimateActivity(estimateId, action, performedBy, details = {}) {
  await supabase.from('v2_estimate_activity').insert({
    estimate_id: estimateId,
    action,
    performed_by: performedBy,
    details
  });
}

// ============================================================
// CALCULATE & UPDATE ESTIMATE TOTAL
// ============================================================

async function updateEstimateTotal(estimateId) {
  // Sum all line item amounts
  const { data: lines, error } = await supabase
    .from('v2_estimate_lines')
    .select('amount')
    .eq('estimate_id', estimateId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const total = (lines || []).reduce((sum, line) => sum + parseFloat(line.amount || 0), 0);

  await supabase
    .from('v2_estimates')
    .update({ total_amount: total, updated_at: new Date().toISOString() })
    .eq('id', estimateId);

  return total;
}

// ============================================================
// STATS ENDPOINT (must be before /:id)
// ============================================================

router.get('/stats', asyncHandler(async (req, res) => {
  const { job_id } = req.query;

  let query = supabase
    .from('v2_estimates')
    .select('id, status, total_amount')
    .is('deleted_at', null);

  if (job_id) {
    query = query.eq('job_id', job_id);
  }

  const { data: estimates, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  const stats = {
    total: estimates.length,
    draft: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    converted: 0,
    total_value: 0,
    approved_value: 0
  };

  for (const est of estimates) {
    stats[est.status] = (stats[est.status] || 0) + 1;
    const amount = parseFloat(est.total_amount || 0);
    stats.total_value += amount;
    if (est.status === 'approved') {
      stats.approved_value += amount;
    }
  }

  res.json(stats);
}));

// ============================================================
// HISTORICAL PRICING (must be before /:id)
// ============================================================

router.get('/historical-pricing/:costCodeId', asyncHandler(async (req, res) => {
  const { costCodeId } = req.params;
  const { job_id } = req.query;

  // Get historical data from PO line items
  let poQuery = supabase
    .from('v2_po_line_items')
    .select(`
      amount,
      description,
      po:v2_purchase_orders!inner(
        id,
        created_at,
        vendor:v2_vendors(name),
        job:v2_jobs(name)
      )
    `)
    .eq('cost_code_id', costCodeId)
    .order('created_at', { foreignTable: 'v2_purchase_orders', ascending: false })
    .limit(10);

  // Get historical data from accepted bids (via estimates that were imported)
  const { data: poItems } = await poQuery;

  // Get from previous estimate lines
  let estQuery = supabase
    .from('v2_estimate_lines')
    .select(`
      amount,
      quantity,
      unit,
      unit_cost,
      description,
      estimate:v2_estimates!inner(
        id,
        title,
        created_at,
        status,
        job:v2_jobs(name)
      )
    `)
    .eq('cost_code_id', costCodeId)
    .in('estimate.status', ['approved', 'converted'])
    .order('created_at', { foreignTable: 'v2_estimates', ascending: false })
    .limit(10);

  const { data: estItems } = await estQuery;

  // Calculate statistics
  const allAmounts = [
    ...(poItems || []).map(p => parseFloat(p.amount || 0)),
    ...(estItems || []).map(e => parseFloat(e.amount || 0))
  ].filter(a => a > 0);

  const stats = {
    count: allAmounts.length,
    min: allAmounts.length ? Math.min(...allAmounts) : 0,
    max: allAmounts.length ? Math.max(...allAmounts) : 0,
    avg: allAmounts.length ? allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length : 0
  };

  res.json({
    stats,
    po_history: (poItems || []).map(p => ({
      amount: p.amount,
      description: p.description,
      vendor: p.po?.vendor?.name,
      job: p.po?.job?.name,
      date: p.po?.created_at
    })),
    estimate_history: (estItems || []).map(e => ({
      amount: e.amount,
      quantity: e.quantity,
      unit: e.unit,
      unit_cost: e.unit_cost,
      description: e.description,
      estimate_title: e.estimate?.title,
      job: e.estimate?.job?.name,
      date: e.estimate?.created_at
    }))
  });
}));

// ============================================================
// TEMPLATES (must be before /:id)
// ============================================================

router.get('/templates', asyncHandler(async (req, res) => {
  // Return predefined estimate templates based on common construction phases
  // These templates group typical cost codes together for quick estimate creation

  const templates = [
    {
      id: 'framing',
      name: 'Framing Package',
      description: 'Rough carpentry, lumber, and framing labor',
      icon: '🪵',
      category: 'Structure',
      items: [
        { code: '10101', name: 'Framing Labor', unit: 'LS', typical_percent: 60 },
        { code: '10102', name: 'Framing Materials', unit: 'LS', typical_percent: 35 },
        { code: '10103', name: 'Trusses', unit: 'EA', typical_percent: 5 }
      ]
    },
    {
      id: 'electrical',
      name: 'Electrical Package',
      description: 'Rough-in, trim, fixtures, and panel',
      icon: '⚡',
      category: 'MEP',
      items: [
        { code: '13101', name: 'Electrical Labor', unit: 'LS', typical_percent: 50 },
        { code: '13102', name: 'Electrical Materials', unit: 'LS', typical_percent: 30 },
        { code: '13103', name: 'Light Fixtures', unit: 'EA', typical_percent: 15 },
        { code: '13104', name: 'Panel & Breakers', unit: 'LS', typical_percent: 5 }
      ]
    },
    {
      id: 'plumbing',
      name: 'Plumbing Package',
      description: 'Rough-in, fixtures, and water heater',
      icon: '🔧',
      category: 'MEP',
      items: [
        { code: '12101', name: 'Plumbing Labor', unit: 'LS', typical_percent: 45 },
        { code: '12102', name: 'Plumbing Materials', unit: 'LS', typical_percent: 25 },
        { code: '12103', name: 'Fixtures', unit: 'EA', typical_percent: 20 },
        { code: '12104', name: 'Water Heater', unit: 'EA', typical_percent: 10 }
      ]
    },
    {
      id: 'hvac',
      name: 'HVAC Package',
      description: 'Equipment, ductwork, and installation',
      icon: '❄️',
      category: 'MEP',
      items: [
        { code: '14101', name: 'HVAC Equipment', unit: 'LS', typical_percent: 50 },
        { code: '14102', name: 'HVAC Labor', unit: 'LS', typical_percent: 35 },
        { code: '14103', name: 'Ductwork', unit: 'LS', typical_percent: 15 }
      ]
    },
    {
      id: 'drywall',
      name: 'Drywall & Paint',
      description: 'Drywall, texture, and interior painting',
      icon: '🎨',
      category: 'Finishes',
      items: [
        { code: '19101', name: 'Drywall Labor', unit: 'SF', typical_percent: 35 },
        { code: '19102', name: 'Drywall Materials', unit: 'SF', typical_percent: 15 },
        { code: '27101', name: 'Interior Painting', unit: 'SF', typical_percent: 40 },
        { code: '27102', name: 'Exterior Painting', unit: 'SF', typical_percent: 10 }
      ]
    },
    {
      id: 'flooring',
      name: 'Flooring Package',
      description: 'Tile, hardwood, and carpet',
      icon: '🪵',
      category: 'Finishes',
      items: [
        { code: '23101', name: 'Hardwood Flooring', unit: 'SF', typical_percent: 40 },
        { code: '24101', name: 'Tile - Floor', unit: 'SF', typical_percent: 35 },
        { code: '23103', name: 'Carpet', unit: 'SY', typical_percent: 15 },
        { code: '23104', name: 'Floor Prep', unit: 'SF', typical_percent: 10 }
      ]
    },
    {
      id: 'cabinetry',
      name: 'Cabinetry & Counters',
      description: 'Kitchen and bath cabinets with countertops',
      icon: '🗄️',
      category: 'Finishes',
      items: [
        { code: '21101', name: 'Kitchen Cabinets', unit: 'LS', typical_percent: 45 },
        { code: '21102', name: 'Bath Vanities', unit: 'EA', typical_percent: 15 },
        { code: '21201', name: 'Countertops', unit: 'SF', typical_percent: 35 },
        { code: '21103', name: 'Cabinet Hardware', unit: 'LS', typical_percent: 5 }
      ]
    },
    {
      id: 'roofing',
      name: 'Roofing Package',
      description: 'Shingles, underlayment, and flashing',
      icon: '🏠',
      category: 'Exterior',
      items: [
        { code: '17101', name: 'Roofing Labor', unit: 'SQ', typical_percent: 40 },
        { code: '17102', name: 'Roofing Materials', unit: 'SQ', typical_percent: 45 },
        { code: '17103', name: 'Flashing & Trim', unit: 'LF', typical_percent: 10 },
        { code: '17104', name: 'Gutters', unit: 'LF', typical_percent: 5 }
      ]
    },
    {
      id: 'sitework',
      name: 'Site Work Package',
      description: 'Grading, utilities, and driveway',
      icon: '🚜',
      category: 'Site',
      items: [
        { code: '06101', name: 'Site Clearing', unit: 'LS', typical_percent: 15 },
        { code: '06102', name: 'Grading', unit: 'LS', typical_percent: 25 },
        { code: '06103', name: 'Utilities', unit: 'LS', typical_percent: 30 },
        { code: '06104', name: 'Driveway', unit: 'SF', typical_percent: 30 }
      ]
    },
    {
      id: 'foundation',
      name: 'Foundation Package',
      description: 'Footings, slab, and waterproofing',
      icon: '🧱',
      category: 'Structure',
      items: [
        { code: '08101', name: 'Concrete Footings', unit: 'CY', typical_percent: 25 },
        { code: '08102', name: 'Concrete Slab', unit: 'SF', typical_percent: 45 },
        { code: '08103', name: 'Rebar & Mesh', unit: 'LS', typical_percent: 15 },
        { code: '08104', name: 'Waterproofing', unit: 'SF', typical_percent: 15 }
      ]
    }
  ];

  // Enrich templates with actual cost code IDs from database
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category');

  const codeMap = {};
  (costCodes || []).forEach(cc => {
    codeMap[cc.code] = cc;
  });

  const enrichedTemplates = templates.map(template => ({
    ...template,
    items: template.items.map(item => {
      const cc = codeMap[item.code];
      return {
        ...item,
        cost_code_id: cc?.id || null,
        cost_code_name: cc?.name || item.name,
        category: cc?.category || null
      };
    })
  }));

  res.json(enrichedTemplates);
}));

// ============================================================
// AI SCOPE ANALYSIS (must be before /:id)
// ============================================================

router.post('/analyze-scope', asyncHandler(async (req, res) => {
  const { scope_text, job_id } = req.body;

  if (!scope_text || scope_text.trim().length < 10) {
    throw new AppError('VALIDATION_ERROR', 'Please provide a scope description (at least 10 characters)');
  }

  // Get cost codes for context
  const { data: costCodes } = await supabase
    .from('v2_cost_codes')
    .select('id, code, name, category')
    .order('code');

  // Build cost code reference for AI
  const costCodeRef = (costCodes || []).map(cc => `${cc.code}: ${cc.name} (${cc.category})`).join('\n');

  // Call Claude AI to analyze scope and suggest line items
  const Anthropic = require('@anthropic-ai/sdk');
  const anthropic = new Anthropic();

  const prompt = `You are a construction estimating assistant. Analyze the following scope of work and suggest line items for a cost estimate.

AVAILABLE COST CODES:
${costCodeRef}

SCOPE OF WORK:
${scope_text}

Based on this scope, provide a JSON array of suggested line items. Each item should have:
- cost_code: The most appropriate code from the list above
- description: A clear description of the work
- quantity: Suggested quantity (number)
- unit: Unit of measure (LS, SF, LF, EA, HR, CY, SY, etc.)
- unit_cost: Estimated unit cost in dollars (use realistic construction pricing)
- notes: Any relevant notes

Return ONLY valid JSON in this format:
{
  "line_items": [
    {
      "cost_code": "10101",
      "description": "Framing labor for walls and roof",
      "quantity": 1,
      "unit": "LS",
      "unit_cost": 45000,
      "notes": "Based on 2,500 SF home"
    }
  ],
  "summary": "Brief summary of the scope analysis"
}`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].text;

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Enrich with cost code IDs
    const codeMap = {};
    (costCodes || []).forEach(cc => {
      codeMap[cc.code] = cc;
    });

    const enrichedItems = (result.line_items || []).map(item => {
      const cc = codeMap[item.cost_code];
      return {
        ...item,
        cost_code_id: cc?.id || null,
        cost_code_name: cc?.name || null,
        category: cc?.category || null,
        amount: (item.quantity || 1) * (item.unit_cost || 0)
      };
    });

    res.json({
      success: true,
      summary: result.summary,
      line_items: enrichedItems
    });
  } catch (aiError) {
    console.error('AI analysis error:', aiError);
    throw new AppError('AI_ERROR', 'Failed to analyze scope. Please try again.');
  }
}));


// ============================================================
// EXPAND ASSEMBLY TEMPLATE (must be before /:id)
// ============================================================

router.post('/:id/expand-assembly', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { template_id, section_id, quantity_multiplier = 1 } = req.body;

  if (!template_id) {
    throw new AppError('VALIDATION_ERROR', 'template_id is required');
  }

  // Call the database function that handles expansion
  const { data, error } = await supabase.rpc('expand_assembly_template', {
    p_estimate_id: id,
    p_template_id: template_id,
    p_section_id: section_id || null,
    p_quantity_multiplier: quantity_multiplier
  });

  if (error) {
    console.error('Assembly expansion error:', error);
    throw new AppError('DATABASE_ERROR', error.message);
  }

  // data is the header_line_id returned by the function
  const headerLineId = data;

  // Fetch the created lines to return
  const { data: lines } = await supabase
    .from('v2_estimate_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .or(`id.eq.${headerLineId},parent_line_id.eq.${headerLineId}`)
    .order('sort_order');

  // Fetch updated estimate totals
  const { data: estimate } = await supabase
    .from('v2_estimates')
    .select('subtotal, total_amount, overhead_amount, profit_amount, contingency_amount')
    .eq('id', id)
    .single();

  res.status(201).json({
    header_line_id: headerLineId,
    lines: lines || [],
    estimate_totals: estimate
  });
}));

// ============================================================
// DUPLICATE ESTIMATE (must be before /:id)
// ============================================================

router.post('/:id/duplicate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { target_job_id, new_title, created_by } = req.body;

  // Fetch source estimate with sections and lines
  const { data: source, error: sourceError } = await supabase
    .from('v2_estimates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (sourceError || !source) {
    throw new AppError('NOT_FOUND', 'Source estimate not found');
  }

  const { data: sourceSections } = await supabase
    .from('v2_estimate_sections')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order');

  const { data: sourceLines } = await supabase
    .from('v2_estimate_lines')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order');

  // Determine target job
  const jobId = target_job_id || source.job_id;
  const isSameJob = jobId === source.job_id;

  // Generate title
  let title = new_title;
  if (!title) {
    if (isSameJob) {
      // Same job - increment version
      const { data: existing } = await supabase
        .from('v2_estimates')
        .select('title')
        .eq('job_id', jobId)
        .ilike('title', `${source.title}%`)
        .order('created_at', { ascending: false });

      const versionMatch = existing?.[0]?.title?.match(/v(\d+)$/);
      const nextVersion = versionMatch ? parseInt(versionMatch[1]) + 1 : 2;
      title = `${source.title.replace(/\s*v\d+$/, '')} v${nextVersion}`;
    } else {
      // Different job - copy title
      title = `${source.title} (copy)`;
    }
  }

  // Create new estimate
  const { data: newEstimate, error: createError } = await supabase
    .from('v2_estimates')
    .insert({
      job_id: jobId,
      title: title,
      description: source.description,
      status: 'draft',
      overhead_percent: source.overhead_percent,
      profit_percent: source.profit_percent,
      contingency_percent: source.contingency_percent,
      markup_percent: source.markup_percent,
      created_by: created_by || 'User',
      version: 1
    })
    .select()
    .single();

  if (createError) {
    throw new AppError('DATABASE_ERROR', createError.message);
  }

  // Map old section IDs to new section IDs
  const sectionIdMap = {};

  // Copy sections
  if (sourceSections && sourceSections.length > 0) {
    for (const section of sourceSections) {
      const { data: newSection } = await supabase
        .from('v2_estimate_sections')
        .insert({
          estimate_id: newEstimate.id,
          name: section.name,
          description: section.description,
          sort_order: section.sort_order
        })
        .select()
        .single();

      if (newSection) {
        sectionIdMap[section.id] = newSection.id;
      }
    }
  }

  // Map old line IDs to new line IDs (for parent_line_id references)
  const lineIdMap = {};

  // Copy lines (parent lines first, then children)
  if (sourceLines && sourceLines.length > 0) {
    // First pass: parent lines (parent_line_id is null)
    const parentLines = sourceLines.filter(l => !l.parent_line_id);
    for (const line of parentLines) {
      const { data: newLine } = await supabase
        .from('v2_estimate_lines')
        .insert({
          estimate_id: newEstimate.id,
          section_id: line.section_id ? sectionIdMap[line.section_id] : null,
          cost_code_id: line.cost_code_id,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unit_cost: line.unit_cost,
          amount: line.amount,
          is_assembly: line.is_assembly,
          template_id: line.template_id,
          is_allowance: line.is_allowance,
          allowance_notes: line.allowance_notes,
          source: line.source,
          sort_order: line.sort_order
        })
        .select()
        .single();

      if (newLine) {
        lineIdMap[line.id] = newLine.id;
      }
    }

    // Second pass: child lines
    const childLines = sourceLines.filter(l => l.parent_line_id);
    for (const line of childLines) {
      await supabase
        .from('v2_estimate_lines')
        .insert({
          estimate_id: newEstimate.id,
          section_id: line.section_id ? sectionIdMap[line.section_id] : null,
          parent_line_id: lineIdMap[line.parent_line_id] || null,
          cost_code_id: line.cost_code_id,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit,
          unit_cost: line.unit_cost,
          amount: line.amount,
          template_id: line.template_id,
          is_allowance: line.is_allowance,
          allowance_notes: line.allowance_notes,
          source: line.source,
          sort_order: line.sort_order
        });
    }
  }

  // Trigger will auto-recalculate totals, but let's fetch final state
  const { data: finalEstimate } = await supabase
    .from('v2_estimates')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', newEstimate.id)
    .single();

  await logEstimateActivity(newEstimate.id, 'created', created_by || 'User', {
    duplicated_from: id,
    original_title: source.title,
    sections_copied: Object.keys(sectionIdMap).length,
    lines_copied: sourceLines?.length || 0
  });

  res.status(201).json({
    estimate: finalEstimate,
    sections_copied: Object.keys(sectionIdMap).length,
    lines_copied: sourceLines?.length || 0
  });
}));

// ============================================================
// IMPORT FROM BID (must be before /:id)
// ============================================================

router.post('/import-from-bid/:bidId', asyncHandler(async (req, res) => {
  const { bidId } = req.params;
  const { created_by, split_by_cost_code } = req.body;

  // Get accepted bid with relations
  const { data: bid, error: bidError } = await supabase
    .from('v2_bids')
    .select(`
      *,
      job:v2_jobs(id, name),
      vendor:v2_vendors(id, name)
    `)
    .eq('id', bidId)
    .is('deleted_at', null)
    .single();

  if (bidError || !bid) throw new AppError('NOT_FOUND', 'Bid not found');

  if (bid.status !== 'accepted') {
    throw new AppError('VALIDATION_ERROR', 'Only accepted bids can be imported as estimates');
  }

  // Create estimate
  const { data: estimate, error: estError } = await supabase
    .from('v2_estimates')
    .insert({
      job_id: bid.job_id,
      title: `Estimate from Bid: ${bid.title}`,
      status: 'draft',
      total_amount: bid.bid_amount || 0,
      notes: `Imported from bid: ${bid.title}\nVendor: ${bid.vendor?.name || 'N/A'}`,
      source_bid_id: bidId,
      created_by: created_by || 'System'
    })
    .select()
    .single();

  if (estError) throw new AppError('DATABASE_ERROR', estError.message);

  // Create single line item with bid amount
  await supabase.from('v2_estimate_lines').insert({
    estimate_id: estimate.id,
    description: bid.scope_of_work || bid.title,
    quantity: 1,
    unit: 'LS',
    unit_cost: bid.bid_amount || 0,
    amount: bid.bid_amount || 0,
    sort_order: 1
  });

  await logEstimateActivity(estimate.id, 'imported_from_bid', created_by || 'System', {
    bid_id: bidId,
    bid_title: bid.title,
    bid_amount: bid.bid_amount
  });

  res.status(201).json({
    success: true,
    message: 'Estimate created from bid',
    estimate
  });
}));

// ============================================================
// LIST ESTIMATES
// ============================================================

router.get('/', asyncHandler(async (req, res) => {
  const { job_id, status, search } = req.query;

  let query = supabase
    .from('v2_estimates')
    .select(`
      *,
      job:v2_jobs(id, name),
      source_bid:v2_bids(id, title, vendor:v2_vendors(id, name))
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (status) query = query.eq('status', status);
  if (search) {
    query = query.or(`title.ilike.%${search}%,notes.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Get line counts for each estimate
  const estimateIds = (data || []).map(e => e.id);
  let lineCounts = {};

  if (estimateIds.length > 0) {
    const { data: lines } = await supabase
      .from('v2_estimate_lines')
      .select('estimate_id')
      .in('estimate_id', estimateIds);

    for (const line of (lines || [])) {
      lineCounts[line.estimate_id] = (lineCounts[line.estimate_id] || 0) + 1;
    }
  }

  const result = (data || []).map(est => ({
    ...est,
    line_count: lineCounts[est.id] || 0
  }));

  res.json(result);
}));

// ============================================================
// GET ESTIMATE BY JOB ID
// ============================================================

router.get('/job/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  // Get the most recent estimate for this job
  const { data: estimate, error } = await supabase
    .from('v2_estimates')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      source_bid:v2_bids(id, title, bid_amount, vendor:v2_vendors(id, name))
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!estimate) throw new AppError('NOT_FOUND', 'No estimate found for this job');

  // Get line items with cost codes
  const { data: lines } = await supabase
    .from('v2_estimate_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('estimate_id', estimate.id)
    .order('sort_order', { ascending: true });

  // Get sections
  const { data: sections } = await supabase
    .from('v2_estimate_sections')
    .select('*')
    .eq('estimate_id', estimate.id)
    .order('sort_order', { ascending: true });

  res.json({
    ...estimate,
    lines: lines || [],
    sections: sections || []
  });
}));

// ============================================================
// GET SINGLE ESTIMATE
// ============================================================

router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: estimate, error } = await supabase
    .from('v2_estimates')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      source_bid:v2_bids(id, title, bid_amount, vendor:v2_vendors(id, name))
    `)
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (error || !estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  // Get full hierarchy: phases > groups > subgroups > items
  const { data: phases } = await supabase
    .from('v2_estimate_phases')
    .select(`
      *,
      groups:v2_estimate_groups(
        *,
        subgroups:v2_estimate_subgroups(
          *,
          items:v2_estimate_line_items(
            *,
            cost_code:v2_cost_codes(id, code, name, category)
          )
        )
      )
    `)
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  // Get line items with cost codes (legacy flat structure for backward compatibility)
  const { data: lines } = await supabase
    .from('v2_estimate_lines')
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  // Get sections (legacy for backward compatibility)
  const { data: sections } = await supabase
    .from('v2_estimate_sections')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  // Get activity
  const { data: activity } = await supabase
    .from('v2_estimate_activity')
    .select('*')
    .eq('estimate_id', id)
    .order('created_at', { ascending: false });

  // Get version history (parent chain)
  let versions = [];
  if (estimate.parent_estimate_id) {
    // Get all versions (parent and siblings)
    const { data: versionData } = await supabase
      .from('v2_estimates')
      .select('id, title, version, status, total_amount, created_at')
      .or(`id.eq.${estimate.parent_estimate_id},parent_estimate_id.eq.${estimate.parent_estimate_id}`)
      .is('deleted_at', null)
      .order('version', { ascending: true });
    versions = versionData || [];
  }

  // Check if already converted to budget
  const { data: budgetLines } = await supabase
    .from('v2_budget_lines')
    .select('id')
    .eq('source_estimate_id', id)
    .limit(1);

  estimate.phases = phases || [];
  estimate.lines = lines || [];
  estimate.sections = sections || [];
  estimate.activity = activity || [];
  estimate.versions = versions;
  estimate.has_budget = (budgetLines?.length || 0) > 0;

  res.json(estimate);
}));

// ============================================================
// CREATE ESTIMATE
// ============================================================

router.post('/', asyncHandler(async (req, res) => {
  const {
    job_id,
    title,
    notes,
    created_by
  } = req.body;

  if (!job_id) throw new AppError('VALIDATION_ERROR', 'Job is required');
  if (!title) throw new AppError('VALIDATION_ERROR', 'Title is required');

  const { data: estimate, error } = await supabase
    .from('v2_estimates')
    .insert({
      job_id,
      title,
      notes: notes || null,
      status: 'draft',
      total_amount: 0,
      created_by: created_by || 'System'
    })
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logEstimateActivity(estimate.id, 'created', created_by || 'System', { title });

  res.status(201).json(estimate);
}));

// ============================================================
// UPDATE ESTIMATE
// ============================================================

router.patch('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, notes, updated_by } = req.body;

  // Check if estimate is editable
  const { data: existing } = await supabase
    .from('v2_estimates')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!existing) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (!['draft', 'rejected'].includes(existing.status)) {
    throw new AppError('VALIDATION_ERROR', 'Only draft or rejected estimates can be edited');
  }

  const updates = { updated_at: new Date().toISOString() };
  if (title !== undefined) updates.title = title;
  if (notes !== undefined) updates.notes = notes;

  const { data: estimate, error } = await supabase
    .from('v2_estimates')
    .update(updates)
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logEstimateActivity(id, 'updated', updated_by || 'System', { updates });

  res.json(estimate);
}));

// ============================================================
// DELETE ESTIMATE (soft delete)
// ============================================================

router.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { deleted_by } = req.body;

  const { data: estimate, error } = await supabase
    .from('v2_estimates')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  await logEstimateActivity(id, 'deleted', deleted_by || 'System', {});

  res.json({ success: true, message: 'Estimate deleted' });
}));

// ============================================================
// ============================================================
// SECTION OPERATIONS
// ============================================================

// Create section
router.post('/:id/sections', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, sort_order, created_by } = req.body;

  if (!name) throw new AppError('VALIDATION_ERROR', 'Section name is required');

  // Get max sort_order if not provided
  let finalSortOrder = sort_order;
  if (finalSortOrder === undefined) {
    const { data: maxSection } = await supabase
      .from('v2_estimate_sections')
      .select('sort_order')
      .eq('estimate_id', id)
      .order('sort_order', { ascending: false })
      .limit(1)
      .single();
    finalSortOrder = (maxSection?.sort_order || 0) + 1;
  }

  const { data: section, error } = await supabase
    .from('v2_estimate_sections')
    .insert({
      estimate_id: id,
      name,
      sort_order: finalSortOrder
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logEstimateActivity(id, 'section_created', created_by || 'System', { section_name: name });

  res.status(201).json(section);
}));

// Update section
router.patch('/:id/sections/:sectionId', asyncHandler(async (req, res) => {
  const { id, sectionId } = req.params;
  const { name, sort_order, updated_by } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  const { data: section, error } = await supabase
    .from('v2_estimate_sections')
    .update(updates)
    .eq('id', sectionId)
    .eq('estimate_id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!section) throw new AppError('NOT_FOUND', 'Section not found');

  await logEstimateActivity(id, 'section_updated', updated_by || 'System', { section_id: sectionId, changes: updates });

  res.json(section);
}));

// Delete section (preserves line items by setting their section_id to null)
router.delete('/:id/sections/:sectionId', asyncHandler(async (req, res) => {
  const { id, sectionId } = req.params;
  const { deleted_by } = req.body;

  // Get section name for logging
  const { data: section } = await supabase
    .from('v2_estimate_sections')
    .select('name')
    .eq('id', sectionId)
    .eq('estimate_id', id)
    .single();

  if (!section) throw new AppError('NOT_FOUND', 'Section not found');

  // Move line items to no section
  await supabase
    .from('v2_estimate_lines')
    .update({ section_id: null })
    .eq('section_id', sectionId);

  // Delete section
  const { error } = await supabase
    .from('v2_estimate_sections')
    .delete()
    .eq('id', sectionId)
    .eq('estimate_id', id);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logEstimateActivity(id, 'section_deleted', deleted_by || 'System', { section_name: section.name });

  res.json({ success: true, message: 'Section deleted' });
}));

// Reorder sections
router.post('/:id/sections/reorder', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { section_ids, updated_by } = req.body;

  if (!section_ids || !Array.isArray(section_ids)) {
    throw new AppError('VALIDATION_ERROR', 'section_ids array is required');
  }

  // Update each section's sort_order
  for (let i = 0; i < section_ids.length; i++) {
    await supabase
      .from('v2_estimate_sections')
      .update({ sort_order: i + 1 })
      .eq('id', section_ids[i])
      .eq('estimate_id', id);
  }

  await logEstimateActivity(id, 'sections_reordered', updated_by || 'System', { section_ids });

  res.json({ success: true, message: 'Sections reordered' });
}));

// LINE ITEM OPERATIONS
// ============================================================

// Add line item
router.post('/:id/lines', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    cost_code_id,
    description,
    quantity,
    unit,
    unit_cost,
    amount,
    notes,
    created_by
  } = req.body;

  // Verify estimate exists and is editable
  const { data: estimate } = await supabase
    .from('v2_estimates')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (!['draft', 'rejected'].includes(estimate.status)) {
    throw new AppError('VALIDATION_ERROR', 'Cannot modify lines of a submitted/approved estimate');
  }

  // Get max sort_order
  const { data: maxOrder } = await supabase
    .from('v2_estimate_lines')
    .select('sort_order')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: false })
    .limit(1);

  const sortOrder = (maxOrder?.[0]?.sort_order || 0) + 1;

  // Calculate amount if not provided
  const qty = parseFloat(quantity) || 1;
  const cost = parseFloat(unit_cost) || 0;
  const lineAmount = amount !== undefined ? parseFloat(amount) : qty * cost;

  const { data: line, error } = await supabase
    .from('v2_estimate_lines')
    .insert({
      estimate_id: id,
      cost_code_id: cost_code_id || null,
      description: description || null,
      quantity: qty,
      unit: unit || null,
      unit_cost: cost,
      amount: lineAmount,
      notes: notes || null,
      sort_order: sortOrder
    })
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Update estimate total
  const newTotal = await updateEstimateTotal(id);

  await logEstimateActivity(id, 'line_added', created_by || 'System', {
    line_id: line.id,
    description: line.description,
    amount: line.amount
  });

  res.status(201).json({ line, estimate_total: newTotal });
}));

// Update line item
router.patch('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  const { id, lineId } = req.params;
  const {
    cost_code_id,
    description,
    quantity,
    unit,
    unit_cost,
    amount,
    notes,
    sort_order,
    updated_by
  } = req.body;

  // Verify estimate is editable
  const { data: estimate } = await supabase
    .from('v2_estimates')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (!['draft', 'rejected'].includes(estimate.status)) {
    throw new AppError('VALIDATION_ERROR', 'Cannot modify lines of a submitted/approved estimate');
  }

  const updates = { updated_at: new Date().toISOString() };
  if (cost_code_id !== undefined) updates.cost_code_id = cost_code_id || null;
  if (description !== undefined) updates.description = description;
  if (quantity !== undefined) updates.quantity = parseFloat(quantity) || 1;
  if (unit !== undefined) updates.unit = unit;
  if (unit_cost !== undefined) updates.unit_cost = parseFloat(unit_cost) || 0;
  if (notes !== undefined) updates.notes = notes;
  if (sort_order !== undefined) updates.sort_order = sort_order;

  // Calculate amount if qty or unit_cost changed but amount not explicitly set
  if ((quantity !== undefined || unit_cost !== undefined) && amount === undefined) {
    const qty = updates.quantity !== undefined ? updates.quantity : null;
    const cost = updates.unit_cost !== undefined ? updates.unit_cost : null;

    // Get current values if not being updated
    if (qty === null || cost === null) {
      const { data: currentLine } = await supabase
        .from('v2_estimate_lines')
        .select('quantity, unit_cost')
        .eq('id', lineId)
        .single();
      if (currentLine) {
        updates.amount = (qty ?? currentLine.quantity) * (cost ?? currentLine.unit_cost);
      }
    } else {
      updates.amount = qty * cost;
    }
  } else if (amount !== undefined) {
    updates.amount = parseFloat(amount) || 0;
  }

  const { data: line, error } = await supabase
    .from('v2_estimate_lines')
    .update(updates)
    .eq('id', lineId)
    .eq('estimate_id', id)
    .select(`
      *,
      cost_code:v2_cost_codes(id, code, name, category)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!line) throw new AppError('NOT_FOUND', 'Line item not found');

  // Update estimate total
  const newTotal = await updateEstimateTotal(id);

  await logEstimateActivity(id, 'line_updated', updated_by || 'System', {
    line_id: lineId,
    updates
  });

  res.json({ line, estimate_total: newTotal });
}));

// Delete line item
router.delete('/:id/lines/:lineId', asyncHandler(async (req, res) => {
  const { id, lineId } = req.params;
  const { deleted_by } = req.body;

  // Verify estimate is editable
  const { data: estimate } = await supabase
    .from('v2_estimates')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (!['draft', 'rejected'].includes(estimate.status)) {
    throw new AppError('VALIDATION_ERROR', 'Cannot modify lines of a submitted/approved estimate');
  }

  const { data: line, error } = await supabase
    .from('v2_estimate_lines')
    .delete()
    .eq('id', lineId)
    .eq('estimate_id', id)
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);
  if (!line) throw new AppError('NOT_FOUND', 'Line item not found');

  // Update estimate total
  const newTotal = await updateEstimateTotal(id);

  await logEstimateActivity(id, 'line_deleted', deleted_by || 'System', {
    line_id: lineId,
    description: line.description,
    amount: line.amount
  });

  res.json({ success: true, estimate_total: newTotal });
}));

// Reorder lines
router.post('/:id/lines/reorder', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { line_ids, updated_by } = req.body;

  if (!Array.isArray(line_ids)) {
    throw new AppError('VALIDATION_ERROR', 'line_ids must be an array');
  }

  // Update sort_order for each line
  for (let i = 0; i < line_ids.length; i++) {
    await supabase
      .from('v2_estimate_lines')
      .update({ sort_order: i + 1 })
      .eq('id', line_ids[i])
      .eq('estimate_id', id);
  }

  await logEstimateActivity(id, 'lines_reordered', updated_by || 'System', {});

  res.json({ success: true });
}));

// ============================================================
// ASSEMBLIES (LINE ITEM GROUPING)
// ============================================================

// Create assembly from selected lines
router.post('/:id/assemblies', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { line_ids, name, hide_components_from_client, created_by } = req.body;

  if (!Array.isArray(line_ids) || line_ids.length < 1) {
    throw new AppError('VALIDATION_ERROR', 'At least one line item is required');
  }

  if (!name || !name.trim()) {
    throw new AppError('VALIDATION_ERROR', 'Assembly name is required');
  }

  // Verify estimate exists and is editable
  const { data: estimate } = await supabase
    .from('v2_estimates')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (!['draft', 'rejected'].includes(estimate.status)) {
    throw new AppError('VALIDATION_ERROR', 'Cannot modify assemblies of a submitted/approved estimate');
  }

  // Get the selected lines
  const { data: selectedLines, error: fetchError } = await supabase
    .from('v2_estimate_lines')
    .select('*')
    .in('id', line_ids)
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  if (fetchError) throw new AppError('DATABASE_ERROR', fetchError.message);

  if (!selectedLines || selectedLines.length === 0) {
    throw new AppError('NOT_FOUND', 'No valid line items found');
  }

  // Check that none of the lines are already in an assembly or are assemblies
  const invalidLines = selectedLines.filter(l => l.parent_line_id || l.is_assembly);
  if (invalidLines.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'Some lines are already in an assembly or are assemblies');
  }

  // Calculate total amount for the assembly
  const assemblyTotal = selectedLines.reduce((sum, line) => sum + parseFloat(line.amount || 0), 0);

  // Get the minimum sort_order to place the assembly at the right position
  const minSortOrder = Math.min(...selectedLines.map(l => l.sort_order || 0));

  // Create the assembly header line
  const { data: assemblyLine, error: createError } = await supabase
    .from('v2_estimate_lines')
    .insert({
      estimate_id: id,
      description: name.trim(),
      is_assembly: true,
      hide_components_from_client: hide_components_from_client || false,
      quantity: 1,
      unit: 'LS',
      unit_cost: assemblyTotal,
      amount: assemblyTotal,
      sort_order: minSortOrder
    })
    .select()
    .single();

  if (createError) throw new AppError('DATABASE_ERROR', createError.message);

  // Update all selected lines to be children of the assembly
  for (let i = 0; i < selectedLines.length; i++) {
    await supabase
      .from('v2_estimate_lines')
      .update({
        parent_line_id: assemblyLine.id,
        sort_order: minSortOrder + i + 1
      })
      .eq('id', selectedLines[i].id);
  }

  // Shift sort_order of other lines
  await supabase.rpc('shift_estimate_line_order', {
    p_estimate_id: id,
    p_start_order: minSortOrder + selectedLines.length + 1,
    p_shift_amount: 1
  }).catch(() => {
    // RPC might not exist, fallback handled by client refresh
  });

  await logEstimateActivity(id, 'assembly_created', created_by || 'System', {
    assembly_id: assemblyLine.id,
    name: name.trim(),
    line_count: selectedLines.length,
    total: assemblyTotal
  });

  res.status(201).json({
    success: true,
    message: 'Assembly created',
    assembly: assemblyLine,
    child_count: selectedLines.length
  });
}));

// Toggle assembly collapsed state
router.patch('/:id/assemblies/:assemblyId/toggle', asyncHandler(async (req, res) => {
  const { id, assemblyId } = req.params;

  const { data: assembly, error } = await supabase
    .from('v2_estimate_lines')
    .select('collapsed')
    .eq('id', assemblyId)
    .eq('estimate_id', id)
    .eq('is_assembly', true)
    .single();

  if (error || !assembly) throw new AppError('NOT_FOUND', 'Assembly not found');

  const { data: updated, error: updateError } = await supabase
    .from('v2_estimate_lines')
    .update({ collapsed: !assembly.collapsed })
    .eq('id', assemblyId)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  res.json({ success: true, collapsed: updated.collapsed });
}));

// Ungroup assembly (convert back to regular lines)
router.delete('/:id/assemblies/:assemblyId', asyncHandler(async (req, res) => {
  const { id, assemblyId } = req.params;
  const { deleted_by } = req.body;

  // Verify estimate is editable
  const { data: estimate } = await supabase
    .from('v2_estimates')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (!estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (!['draft', 'rejected'].includes(estimate.status)) {
    throw new AppError('VALIDATION_ERROR', 'Cannot modify assemblies of a submitted/approved estimate');
  }

  // Get assembly
  const { data: assembly, error: fetchError } = await supabase
    .from('v2_estimate_lines')
    .select('*')
    .eq('id', assemblyId)
    .eq('estimate_id', id)
    .eq('is_assembly', true)
    .single();

  if (fetchError || !assembly) throw new AppError('NOT_FOUND', 'Assembly not found');

  // Remove parent_line_id from all children
  await supabase
    .from('v2_estimate_lines')
    .update({ parent_line_id: null })
    .eq('parent_line_id', assemblyId);

  // Delete the assembly header
  await supabase
    .from('v2_estimate_lines')
    .delete()
    .eq('id', assemblyId);

  await logEstimateActivity(id, 'assembly_deleted', deleted_by || 'System', {
    assembly_id: assemblyId,
    name: assembly.description
  });

  res.json({ success: true, message: 'Assembly ungrouped' });
}));

// Update assembly total (recalculate from children)
async function updateAssemblyTotal(assemblyId) {
  const { data: children } = await supabase
    .from('v2_estimate_lines')
    .select('amount')
    .eq('parent_line_id', assemblyId);

  const total = (children || []).reduce((sum, c) => sum + parseFloat(c.amount || 0), 0);

  await supabase
    .from('v2_estimate_lines')
    .update({ amount: total, unit_cost: total })
    .eq('id', assemblyId);

  return total;
}

// ============================================================
// STATUS WORKFLOW
// ============================================================

// Submit for approval
router.post('/:id/submit', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { submitted_by } = req.body;

  const { data: estimate, error: fetchError } = await supabase
    .from('v2_estimates')
    .select('status, total_amount')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (estimate.status !== 'draft') {
    throw new AppError('VALIDATION_ERROR', 'Only draft estimates can be submitted');
  }

  const { data: updated, error } = await supabase
    .from('v2_estimates')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by: submitted_by || 'System',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logEstimateActivity(id, 'submitted', submitted_by || 'System', {
    total_amount: estimate.total_amount
  });

  res.json(updated);
}));

// Approve estimate
router.post('/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { approved_by } = req.body;

  const { data: estimate, error: fetchError } = await supabase
    .from('v2_estimates')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (estimate.status !== 'submitted') {
    throw new AppError('VALIDATION_ERROR', 'Only submitted estimates can be approved');
  }

  const { data: updated, error } = await supabase
    .from('v2_estimates')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approved_by || 'System',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logEstimateActivity(id, 'approved', approved_by || 'System', {});

  res.json(updated);
}));

// Reject estimate
router.post('/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rejected_by, reason } = req.body;

  const { data: estimate, error: fetchError } = await supabase
    .from('v2_estimates')
    .select('status')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (estimate.status !== 'submitted') {
    throw new AppError('VALIDATION_ERROR', 'Only submitted estimates can be rejected');
  }

  const { data: updated, error } = await supabase
    .from('v2_estimates')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logEstimateActivity(id, 'rejected', rejected_by || 'System', { reason });

  res.json(updated);
}));

// ============================================================
// VERSION CONTROL
// ============================================================

router.post('/:id/new-version', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { created_by } = req.body;

  // Get original estimate with lines
  const { data: original, error: fetchError } = await supabase
    .from('v2_estimates')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !original) throw new AppError('NOT_FOUND', 'Estimate not found');

  // Get original lines
  const { data: originalLines } = await supabase
    .from('v2_estimate_lines')
    .select('*')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  // Determine parent_estimate_id (root of version chain)
  const parentId = original.parent_estimate_id || original.id;

  // Get max version for this chain
  const { data: versions } = await supabase
    .from('v2_estimates')
    .select('version')
    .or(`id.eq.${parentId},parent_estimate_id.eq.${parentId}`)
    .is('deleted_at', null)
    .order('version', { ascending: false })
    .limit(1);

  const newVersion = (versions?.[0]?.version || 1) + 1;

  // Create new estimate
  const { data: newEstimate, error: createError } = await supabase
    .from('v2_estimates')
    .insert({
      job_id: original.job_id,
      title: original.title,
      version: newVersion,
      parent_estimate_id: parentId,
      status: 'draft',
      total_amount: original.total_amount,
      notes: original.notes,
      source_bid_id: original.source_bid_id,
      created_by: created_by || 'System'
    })
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .single();

  if (createError) throw new AppError('DATABASE_ERROR', createError.message);

  // Copy lines
  if (originalLines?.length > 0) {
    const newLines = originalLines.map(line => ({
      estimate_id: newEstimate.id,
      cost_code_id: line.cost_code_id,
      description: line.description,
      quantity: line.quantity,
      unit: line.unit,
      unit_cost: line.unit_cost,
      amount: line.amount,
      notes: line.notes,
      sort_order: line.sort_order
    }));

    await supabase.from('v2_estimate_lines').insert(newLines);
  }

  await logEstimateActivity(newEstimate.id, 'version_created', created_by || 'System', {
    from_estimate_id: id,
    from_version: original.version,
    new_version: newVersion
  });

  res.status(201).json({
    success: true,
    message: `Version ${newVersion} created`,
    estimate: newEstimate
  });
}));

// ============================================================
// CONVERT TO BUDGET
// ============================================================

router.post('/:id/convert-to-budget', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { converted_by } = req.body;

  // Get estimate with lines
  const { data: estimate, error: fetchError } = await supabase
    .from('v2_estimates')
    .select('*, job:v2_jobs(id, name)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  if (estimate.status !== 'approved') {
    throw new AppError('VALIDATION_ERROR', 'Only approved estimates can be converted to budget');
  }

  // Check if already converted
  const { data: existingBudget } = await supabase
    .from('v2_budget_lines')
    .select('id')
    .eq('source_estimate_id', id)
    .limit(1);

  if (existingBudget?.length > 0) {
    throw new AppError('VALIDATION_ERROR', 'This estimate has already been converted to a budget');
  }

  // Get estimate lines with cost codes
  const { data: lines } = await supabase
    .from('v2_estimate_lines')
    .select('*, cost_code:v2_cost_codes(id, code, name)')
    .eq('estimate_id', id)
    .order('sort_order', { ascending: true });

  if (!lines?.length) {
    throw new AppError('VALIDATION_ERROR', 'Estimate has no line items to convert');
  }

  // Create/update budget lines
  const budgetResults = [];
  for (const line of lines) {
    if (!line.cost_code_id) continue; // Skip lines without cost codes

    // Check if budget line exists for this job + cost code
    const { data: existing } = await supabase
      .from('v2_budget_lines')
      .select('id, budgeted_amount')
      .eq('job_id', estimate.job_id)
      .eq('cost_code_id', line.cost_code_id)
      .single();

    if (existing) {
      // Update existing budget line
      const { data: updated, error } = await supabase
        .from('v2_budget_lines')
        .update({
          budgeted_amount: parseFloat(line.amount) || 0,
          source_estimate_id: id
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (!error) budgetResults.push({ action: 'updated', ...updated });
    } else {
      // Create new budget line
      const { data: created, error } = await supabase
        .from('v2_budget_lines')
        .insert({
          job_id: estimate.job_id,
          cost_code_id: line.cost_code_id,
          budgeted_amount: parseFloat(line.amount) || 0,
          committed_amount: 0,
          billed_amount: 0,
          paid_amount: 0,
          source_estimate_id: id
        })
        .select()
        .single();

      if (!error) budgetResults.push({ action: 'created', ...created });
    }
  }

  // Mark estimate as converted
  const { data: updated, error: updateError } = await supabase
    .from('v2_estimates')
    .update({
      status: 'converted',
      converted_at: new Date().toISOString(),
      converted_by: converted_by || 'System',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) throw new AppError('DATABASE_ERROR', updateError.message);

  await logEstimateActivity(id, 'converted_to_budget', converted_by || 'System', {
    budget_lines_created: budgetResults.filter(r => r.action === 'created').length,
    budget_lines_updated: budgetResults.filter(r => r.action === 'updated').length
  });

  res.json({
    success: true,
    message: 'Estimate converted to budget',
    budget_lines: budgetResults.length,
    estimate: updated
  });
}));

// ============================================================
// SELECTION-DRIVEN ESTIMATION (Phase 72)
// ============================================================

// ============================================================
// PROJECT DETAILS
// ============================================================

// Get project details for a job
router.get('/project-details/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;

  const { data: details, error } = await supabase
    .from('v2_project_details')
    .select('*')
    .eq('job_id', jobId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    throw new AppError('DATABASE_ERROR', error.message);
  }

  res.json(details || null);
}));

// Create/update project details
router.post('/project-details/:jobId', asyncHandler(async (req, res) => {
  const { jobId } = req.params;
  const {
    total_sqft, conditioned_sqft, garage_sqft, porch_sqft,
    bedroom_count, bathroom_count, story_count,
    exterior_linear_ft, interior_wall_linear_ft, roof_sqft,
    room_details, style_tier, source
  } = req.body;

  // Check if exists
  const { data: existing } = await supabase
    .from('v2_project_details')
    .select('id')
    .eq('job_id', jobId)
    .single();

  const detailsData = {
    job_id: jobId,
    total_sqft, conditioned_sqft, garage_sqft, porch_sqft,
    bedroom_count, bathroom_count, story_count,
    exterior_linear_ft, interior_wall_linear_ft, roof_sqft,
    room_details: room_details || [],
    style_tier: style_tier || 'standard',
    source
  };

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from('v2_project_details')
      .update(detailsData)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw new AppError('DATABASE_ERROR', error.message);
    result = data;
  } else {
    const { data, error } = await supabase
      .from('v2_project_details')
      .insert(detailsData)
      .select()
      .single();
    if (error) throw new AppError('DATABASE_ERROR', error.message);
    result = data;
  }

  res.json(result);
}));

// ============================================================
// CREATE ESTIMATE FROM SELECTIONS
// ============================================================

router.post('/from-selections', asyncHandler(async (req, res) => {
  const {
    job_id,
    title,
    markup_percent,
    contingency_percent,
    created_by
  } = req.body;

  if (!job_id) throw new AppError('VALIDATION_ERROR', 'Job is required');
  if (!title) throw new AppError('VALIDATION_ERROR', 'Title is required');

  // Check if job has approved selections
  const { data: selectionCount } = await supabase
    .from('v2_selections')
    .select('id', { count: 'exact' })
    .eq('status', 'approved')
    .is('deleted_at', null)
    .in('allowance_id',
      supabase.from('v2_allowances').select('id').eq('job_id', job_id)
    );

  // Call the database function to create estimate from selections
  const { data: result, error } = await supabase
    .rpc('create_estimate_from_selections', {
      p_job_id: job_id,
      p_title: title,
      p_created_by: created_by || 'System',
      p_markup_percent: markup_percent || 0,
      p_contingency_percent: contingency_percent || 0
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Fetch the created estimate with details
  const { data: estimate } = await supabase
    .from('v2_estimates')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', result)
    .single();

  // Get line count
  const { data: lines } = await supabase
    .from('v2_estimate_lines')
    .select('id')
    .eq('estimate_id', result);

  await logEstimateActivity(result, 'created_from_selections', created_by || 'System', {
    job_id,
    line_count: lines?.length || 0
  });

  res.status(201).json({
    success: true,
    message: `Estimate created with ${lines?.length || 0} line items from selections`,
    estimate: {
      ...estimate,
      line_count: lines?.length || 0
    }
  });
}));

// ============================================================
// RECALCULATE WITH MARKUP
// ============================================================

router.post('/:id/recalculate', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { markup_percent, contingency_percent, updated_by } = req.body;

  // Update markup/contingency if provided
  if (markup_percent !== undefined || contingency_percent !== undefined) {
    const updates = {};
    if (markup_percent !== undefined) updates.markup_percent = markup_percent;
    if (contingency_percent !== undefined) updates.contingency_percent = contingency_percent;

    await supabase
      .from('v2_estimates')
      .update(updates)
      .eq('id', id);
  }

  // Call the recalculate function
  const { error } = await supabase
    .rpc('recalculate_estimate_with_markup', { p_estimate_id: id });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Fetch updated estimate
  const { data: estimate } = await supabase
    .from('v2_estimates')
    .select(`
      *,
      job:v2_jobs(id, name)
    `)
    .eq('id', id)
    .single();

  await logEstimateActivity(id, 'recalculated', updated_by || 'System', {
    markup_percent: estimate.markup_percent,
    contingency_percent: estimate.contingency_percent,
    total_amount: estimate.total_amount
  });

  res.json(estimate);
}));

// ============================================================
// SCOPES OF WORK
// ============================================================

// List scopes
router.get('/scopes', asyncHandler(async (req, res) => {
  const { job_id, estimate_id, status } = req.query;

  let query = supabase
    .from('v2_scopes_of_work')
    .select(`
      *,
      job:v2_jobs(id, name),
      estimate:v2_estimates(id, title),
      trade:v2_labor_categories(id, name),
      awarded_vendor:v2_vendors(id, name)
    `)
    .order('created_at', { ascending: false });

  if (job_id) query = query.eq('job_id', job_id);
  if (estimate_id) query = query.eq('estimate_id', estimate_id);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(data || []);
}));

// Get single scope
router.get('/scopes/:scopeId', asyncHandler(async (req, res) => {
  const { scopeId } = req.params;

  const { data: scope, error } = await supabase
    .from('v2_scopes_of_work')
    .select(`
      *,
      job:v2_jobs(id, name, address),
      estimate:v2_estimates(id, title, total_amount),
      trade:v2_labor_categories(id, name),
      awarded_vendor:v2_vendors(id, name, email, phone)
    `)
    .eq('id', scopeId)
    .single();

  if (error) throw new AppError('NOT_FOUND', 'Scope not found');

  res.json(scope);
}));

// Create scope from estimate
router.post('/:id/generate-scope', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { trade_id, created_by } = req.body;

  // Call the database function
  const { data: scopeId, error } = await supabase
    .rpc('generate_scope_from_estimate', {
      p_estimate_id: id,
      p_trade_id: trade_id || null,
      p_created_by: created_by || 'System'
    });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  // Fetch the created scope
  const { data: scope } = await supabase
    .from('v2_scopes_of_work')
    .select(`
      *,
      job:v2_jobs(id, name),
      trade:v2_labor_categories(id, name)
    `)
    .eq('id', scopeId)
    .single();

  await logEstimateActivity(id, 'scope_generated', created_by || 'System', {
    scope_id: scopeId,
    trade_id
  });

  res.status(201).json({
    success: true,
    message: 'Scope of work generated',
    scope
  });
}));

// Update scope
router.patch('/scopes/:scopeId', asyncHandler(async (req, res) => {
  const { scopeId } = req.params;
  const {
    name, description, scope_text, inclusions, exclusions,
    due_date, status, updated_by
  } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (scope_text !== undefined) updates.scope_text = scope_text;
  if (inclusions !== undefined) updates.inclusions = inclusions;
  if (exclusions !== undefined) updates.exclusions = exclusions;
  if (due_date !== undefined) updates.due_date = due_date;
  if (status !== undefined) updates.status = status;

  const { data: scope, error } = await supabase
    .from('v2_scopes_of_work')
    .update(updates)
    .eq('id', scopeId)
    .select(`
      *,
      job:v2_jobs(id, name),
      trade:v2_labor_categories(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(scope);
}));

// Award scope to vendor
router.post('/scopes/:scopeId/award', asyncHandler(async (req, res) => {
  const { scopeId } = req.params;
  const { vendor_id, awarded_amount, awarded_by } = req.body;

  if (!vendor_id) throw new AppError('VALIDATION_ERROR', 'Vendor is required');
  if (!awarded_amount) throw new AppError('VALIDATION_ERROR', 'Amount is required');

  const { data: scope, error } = await supabase
    .from('v2_scopes_of_work')
    .update({
      status: 'awarded',
      awarded_vendor_id: vendor_id,
      awarded_amount,
      updated_at: new Date().toISOString()
    })
    .eq('id', scopeId)
    .select(`
      *,
      job:v2_jobs(id, name),
      awarded_vendor:v2_vendors(id, name)
    `)
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({
    success: true,
    message: 'Scope awarded to vendor',
    scope
  });
}));

// Delete scope
router.delete('/scopes/:scopeId', asyncHandler(async (req, res) => {
  const { scopeId } = req.params;

  const { error } = await supabase
    .from('v2_scopes_of_work')
    .delete()
    .eq('id', scopeId);

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json({ success: true, message: 'Scope deleted' });
}));

// ============================================================
// ESTIMATE CONVERSIONS
// ============================================================

// Get conversions for an estimate
router.get('/:id/conversions', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { data: conversions, error } = await supabase
    .from('v2_estimate_conversions')
    .select('*')
    .eq('estimate_id', id)
    .order('converted_at', { ascending: false });

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  res.json(conversions || []);
}));

// Track a conversion
router.post('/:id/conversions', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { conversion_type, target_id, converted_by, notes } = req.body;

  if (!conversion_type) throw new AppError('VALIDATION_ERROR', 'Conversion type is required');
  if (!target_id) throw new AppError('VALIDATION_ERROR', 'Target ID is required');

  const { data: conversion, error } = await supabase
    .from('v2_estimate_conversions')
    .insert({
      estimate_id: id,
      conversion_type,
      target_id,
      converted_by: converted_by || 'System',
      notes
    })
    .select()
    .single();

  if (error) throw new AppError('DATABASE_ERROR', error.message);

  await logEstimateActivity(id, 'converted', converted_by || 'System', {
    conversion_type,
    target_id
  });

  res.status(201).json(conversion);
}));

// ============================================================
// CONVERT ESTIMATE TO ALLOWANCES
// ============================================================

router.post('/:id/convert-to-allowances', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { converted_by } = req.body;

  // Get estimate with lines
  const { data: estimate, error: fetchError } = await supabase
    .from('v2_estimates')
    .select('*, job:v2_jobs(id, name)')
    .eq('id', id)
    .is('deleted_at', null)
    .single();

  if (fetchError || !estimate) throw new AppError('NOT_FOUND', 'Estimate not found');

  // Get lines with catalog items
  const { data: lines } = await supabase
    .from('v2_estimate_lines')
    .select(`
      *,
      catalog_item:v2_selection_catalog(
        id, name, category_id,
        category:v2_selection_categories(id, name)
      )
    `)
    .eq('estimate_id', id)
    .not('catalog_item_id', 'is', null);

  if (!lines?.length) {
    throw new AppError('VALIDATION_ERROR', 'No catalog items in estimate to convert to allowances');
  }

  // Group lines by category
  const byCategory = {};
  for (const line of lines) {
    const catName = line.catalog_item?.category?.name || 'General';
    if (!byCategory[catName]) {
      byCategory[catName] = {
        category_id: line.catalog_item?.category_id,
        lines: []
      };
    }
    byCategory[catName].lines.push(line);
  }

  // Create allowances for each category
  const allowances = [];
  for (const [catName, data] of Object.entries(byCategory)) {
    const total = data.lines.reduce((sum, l) => sum + parseFloat(l.amount || 0), 0);

    // Create allowance
    const { data: allowance, error: allowError } = await supabase
      .from('v2_allowances')
      .insert({
        job_id: estimate.job_id,
        category_id: data.category_id,
        name: `${catName} Allowance`,
        budgeted_amount: total,
        status: 'active',
        source_estimate_id: id
      })
      .select()
      .single();

    if (allowError) {
      console.error('Error creating allowance:', allowError);
      continue;
    }

    // Create selections from lines
    for (const line of data.lines) {
      await supabase
        .from('v2_selections')
        .insert({
          allowance_id: allowance.id,
          catalog_item_id: line.catalog_item_id,
          quantity: line.quantity || 1,
          quoted_price: line.unit_cost,
          status: 'approved',
          room: line.room,
          notes: `From estimate: ${estimate.title}`
        });
    }

    allowances.push(allowance);
  }

  // Track conversion
  for (const allowance of allowances) {
    await supabase.from('v2_estimate_conversions').insert({
      estimate_id: id,
      conversion_type: 'allowance',
      target_id: allowance.id,
      converted_by: converted_by || 'System'
    });
  }

  await logEstimateActivity(id, 'converted_to_allowances', converted_by || 'System', {
    allowance_count: allowances.length
  });

  res.json({
    success: true,
    message: `Created ${allowances.length} allowances from estimate`,
    allowances
  });
}));

module.exports = router;
