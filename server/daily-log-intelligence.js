/**
 * Daily Log Intelligence Service (AI-Powered)
 *
 * Uses Claude AI to analyze completed daily logs and generate intelligent insights:
 * - Matches crew work to catalog items and compares labor estimates
 * - Identifies price changes from deliveries
 * - Detects schedule variances and patterns
 * - Generates actionable recommendations
 *
 * The AI has full context of the system's data model and can make intelligent
 * connections that hardcoded logic would miss.
 */

const Anthropic = require('@anthropic-ai/sdk');
const { supabase } = require('../config');

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// System prompt that gives Claude full context of the Ross Built CMS
const SYSTEM_PROMPT = `You are an AI assistant for Ross Built Custom Homes' construction management system.
You analyze daily construction logs and generate intelligence insights.

SYSTEM CONTEXT:
- Ross Built is a custom home builder in Florida
- The system tracks jobs, vendors, POs, invoices, catalog items, schedules, and daily logs
- Daily logs capture: crew hours by trade, material deliveries, work completed, delays
- The catalog has products with estimated labor_hours, install_duration_hours, lead_time_days
- Price intelligence tracks vendor pricing history
- Schedule tasks have estimated durations that can be compared to actuals

YOUR TASK:
Analyze the daily log data provided and generate actionable insights:

1. LABOR ANALYSIS: Compare actual crew hours to catalog estimates
   - If a crew worked 12 hours on flooring but catalog says 8 hours, that's a variance
   - Consider crew size (2 workers x 6 hours = 12 labor hours)
   - Flag significant variances (>15%) for catalog updates

2. PRICE ANALYSIS: Identify pricing trends from deliveries
   - Compare delivery costs to historical pricing
   - Flag significant price changes (>10%)
   - Note vendor pricing patterns

3. SCHEDULE ANALYSIS: Track actual vs estimated durations
   - Compare work completed to schedule predictions
   - Identify trades that consistently run over/under
   - Note delay patterns (weather, materials, coordination)

4. RECOMMENDATIONS: Suggest specific actions
   - Update catalog labor estimates based on actuals
   - Alert on price increases
   - Adjust schedule templates

RESPONSE FORMAT:
Return ONLY valid JSON (no markdown code blocks):
{
  "analysis": {
    "labor": { "findings": [], "suggested_catalog_updates": [] },
    "pricing": { "findings": [], "price_alerts": [] },
    "schedule": { "findings": [], "duration_adjustments": [] }
  },
  "insights": [
    {
      "type": "labor_variance|price_change|duration_variance|pattern_detected|recommendation",
      "severity": "high|medium|low",
      "title": "Short title",
      "description": "Detailed explanation",
      "suggestion": "Recommended action",
      "data": { "any relevant numbers/IDs" }
    }
  ],
  "summary": {
    "labor_records_analyzed": 0,
    "pricing_records_analyzed": 0,
    "schedule_records_analyzed": 0,
    "total_insights": 0
  }
}`;


/**
 * Gather all context data for AI analysis
 */
async function gatherContextForAnalysis(dailyLogId) {
  // Get the daily log with all related data
  const { data: dailyLog, error: logError } = await supabase
    .from('v2_daily_logs')
    .select(`
      *,
      job:v2_jobs(id, name, address, contract_amount),
      crew:v2_daily_log_crew(
        id, vendor_id, worker_count, hours_worked, trade, notes, po_id,
        vendor:v2_vendors(id, name),
        po:v2_purchase_orders(id, po_number, total_amount, description)
      ),
      deliveries:v2_daily_log_deliveries(
        id, vendor_id, po_id, description, quantity, unit, notes,
        vendor:v2_vendors(id, name),
        po:v2_purchase_orders(id, po_number, total_amount)
      )
    `)
    .eq('id', dailyLogId)
    .single();

  if (logError) throw logError;

  // Get relevant catalog items (by trade types mentioned in crew)
  const trades = [...new Set(dailyLog.crew?.map(c => c.trade).filter(Boolean) || [])];
  let catalogItems = [];

  if (trades.length > 0) {
    const { data: items } = await supabase
      .from('v2_selection_catalog')
      .select('id, name, labor_hours, install_duration_hours, crew_size, category_id')
      .not('labor_hours', 'is', null);
    catalogItems = items || [];
  }

  // Get schedule tasks for this job
  const { data: scheduleTasks } = await supabase
    .from('v2_schedule_tasks')
    .select('id, name, trade, estimated_duration_days, actual_start_date, actual_end_date, status')
    .eq('job_id', dailyLog.job_id)
    .in('status', ['in_progress', 'completed', 'pending']);

  // Get recent price history for items that might match deliveries
  const { data: recentPrices } = await supabase
    .from('v2_price_history')
    .select('master_item_id, vendor_id, unit_price, unit, price_date')
    .order('price_date', { ascending: false })
    .limit(100);

  // Get previous daily logs for this job (for pattern detection)
  const { data: previousLogs } = await supabase
    .from('v2_daily_logs')
    .select(`
      id, log_date, work_completed, delays_issues,
      crew:v2_daily_log_crew(trade, hours_worked, worker_count)
    `)
    .eq('job_id', dailyLog.job_id)
    .neq('id', dailyLogId)
    .order('log_date', { ascending: false })
    .limit(10);

  // Get labor categories (trades)
  const { data: laborCategories } = await supabase
    .from('v2_labor_categories')
    .select('id, name, hourly_rate');

  return {
    dailyLog,
    catalogItems,
    scheduleTasks: scheduleTasks || [],
    recentPrices: recentPrices || [],
    previousLogs: previousLogs || [],
    laborCategories: laborCategories || []
  };
}


/**
 * Process a completed daily log using AI analysis
 */
async function processDailyLogIntelligence(dailyLogId) {
  console.log(`Processing intelligence for daily log: ${dailyLogId}`);

  try {
    // Gather all context
    const context = await gatherContextForAnalysis(dailyLogId);

    // Build the prompt with all context
    const userPrompt = `Analyze this daily construction log and generate intelligence insights.

DAILY LOG:
- Date: ${context.dailyLog.log_date}
- Job: ${context.dailyLog.job?.name} (${context.dailyLog.job?.address})
- Weather: ${context.dailyLog.weather_conditions || 'Not recorded'}
- Work Completed: ${context.dailyLog.work_completed || 'Not recorded'}
- Delays/Issues: ${context.dailyLog.delays_issues || 'None reported'}

CREW ON SITE (${context.dailyLog.crew?.length || 0} entries):
${JSON.stringify(context.dailyLog.crew?.map(c => ({
  trade: c.trade,
  vendor: c.vendor?.name,
  workers: c.worker_count,
  hours: c.hours_worked,
  total_labor_hours: (c.worker_count || 1) * (c.hours_worked || 0),
  po: c.po?.po_number,
  notes: c.notes
})) || [], null, 2)}

DELIVERIES (${context.dailyLog.deliveries?.length || 0} entries):
${JSON.stringify(context.dailyLog.deliveries?.map(d => ({
  description: d.description,
  vendor: d.vendor?.name,
  quantity: d.quantity,
  unit: d.unit,
  po: d.po?.po_number,
  po_total: d.po?.total_amount
})) || [], null, 2)}

CATALOG ITEMS WITH LABOR ESTIMATES (sample for reference):
${JSON.stringify(context.catalogItems.slice(0, 20).map(c => ({
  name: c.name,
  labor_hours: c.labor_hours,
  crew_size: c.crew_size
})), null, 2)}

SCHEDULE TASKS FOR THIS JOB:
${JSON.stringify(context.scheduleTasks.map(t => ({
  name: t.name,
  trade: t.trade,
  estimated_days: t.estimated_duration_days,
  status: t.status,
  actual_start: t.actual_start_date,
  actual_end: t.actual_end_date
})), null, 2)}

LABOR CATEGORIES (TRADES):
${JSON.stringify(context.laborCategories.map(l => ({
  name: l.name,
  hourly_rate: l.hourly_rate
})), null, 2)}

RECENT PREVIOUS LOGS (for pattern detection):
${JSON.stringify(context.previousLogs.slice(0, 5).map(l => ({
  date: l.log_date,
  work: l.work_completed?.substring(0, 100),
  delays: l.delays_issues?.substring(0, 50),
  crew_summary: l.crew?.map(c => `${c.trade}: ${c.hours_worked}h x ${c.worker_count}`).join(', ')
})), null, 2)}

Analyze this data and return insights about:
1. Labor variances compared to typical estimates
2. Any notable pricing information from deliveries
3. Schedule progress and duration tracking
4. Patterns across previous logs
5. Specific recommendations for updating catalog/schedule estimates`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }]
    });

    // Parse the response
    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    const aiResult = JSON.parse(jsonStr);

    // Store insights in the database
    if (aiResult.insights && aiResult.insights.length > 0) {
      const insightsToStore = aiResult.insights.map(insight => ({
        source_type: 'daily_log',
        source_id: dailyLogId,
        job_id: context.dailyLog.job_id,
        insight_type: insight.type,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        suggestion: insight.suggestion,
        data: insight.data,
        status: 'new'
      }));

      await supabase.from('v2_intelligence_insights').insert(insightsToStore);
    }

    // Log activity
    await supabase.from('v2_daily_log_activity').insert({
      daily_log_id: dailyLogId,
      action: 'ai_intelligence_processed',
      details: {
        model: 'claude-sonnet-4-20250514',
        insights_count: aiResult.insights?.length || 0,
        summary: aiResult.summary
      },
      performed_by: 'AI System'
    });

    return {
      success: true,
      summary: aiResult.summary || {
        labor_records: aiResult.analysis?.labor?.findings?.length || 0,
        pricing_records: aiResult.analysis?.pricing?.findings?.length || 0,
        schedule_records: aiResult.analysis?.schedule?.findings?.length || 0,
        total_insights: aiResult.insights?.length || 0
      },
      insights: aiResult.insights || [],
      analysis: aiResult.analysis,
      errors: {}
    };

  } catch (err) {
    console.error('AI Intelligence processing error:', err);

    // Log the error
    await supabase.from('v2_daily_log_activity').insert({
      daily_log_id: dailyLogId,
      action: 'ai_intelligence_error',
      details: { error: err.message },
      performed_by: 'AI System'
    }).catch(() => {});

    return {
      success: false,
      summary: {
        labor_records: 0,
        pricing_records: 0,
        schedule_records: 0,
        total_insights: 0
      },
      insights: [],
      errors: { ai: err.message }
    };
  }
}


/**
 * Get AI-powered catalog update suggestions
 * Analyzes accumulated feedback and suggests updates
 */
async function getCatalogUpdateSuggestions() {
  try {
    // Get recent labor feedback
    const { data: laborFeedback } = await supabase
      .from('v2_catalog_labor_feedback')
      .select('*, catalog_item:v2_selection_catalog(name, labor_hours)')
      .eq('applied_to_catalog', false)
      .order('created_at', { ascending: false })
      .limit(50);

    // Get recent insights
    const { data: insights } = await supabase
      .from('v2_intelligence_insights')
      .select('*')
      .eq('status', 'new')
      .in('insight_type', ['labor_variance', 'recommendation'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (!laborFeedback?.length && !insights?.length) {
      return [];
    }

    // Use AI to synthesize suggestions
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: `You are an assistant that analyzes construction labor data and suggests catalog updates.
Return ONLY valid JSON array of suggestions.`,
      messages: [{
        role: 'user',
        content: `Based on this labor feedback and insights, suggest catalog updates:

LABOR FEEDBACK:
${JSON.stringify(laborFeedback?.map(f => ({
  item: f.catalog_item?.name,
  current_estimate: f.estimated_hours,
  actual: f.actual_hours,
  variance: f.variance_percent
})) || [], null, 2)}

RECENT INSIGHTS:
${JSON.stringify(insights?.map(i => ({
  type: i.insight_type,
  title: i.title,
  suggestion: i.suggestion,
  data: i.data
})) || [], null, 2)}

Return JSON array of suggestions:
[{
  "catalog_item_name": "name",
  "current_estimate": 0,
  "suggested_estimate": 0,
  "confidence": 0-100,
  "reasoning": "why this change"
}]`
      }]
    });

    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    return JSON.parse(jsonStr);

  } catch (err) {
    console.error('Error getting AI catalog suggestions:', err);
    return [];
  }
}


/**
 * Analyze a specific aspect with AI
 * Can be used for on-demand analysis of labor, pricing, or schedule
 */
async function analyzeWithAI(analysisType, data) {
  const prompts = {
    labor: `Analyze this labor data and identify any variances or patterns:
${JSON.stringify(data, null, 2)}

Return JSON with findings and recommendations.`,

    pricing: `Analyze this pricing data and identify trends or anomalies:
${JSON.stringify(data, null, 2)}

Return JSON with price change alerts and recommendations.`,

    schedule: `Analyze this schedule data and identify duration variances:
${JSON.stringify(data, null, 2)}

Return JSON with duration findings and adjustment recommendations.`
  };

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: 'You are a construction project analyst. Return ONLY valid JSON.',
      messages: [{ role: 'user', content: prompts[analysisType] || prompts.labor }]
    });

    let jsonStr = response.content[0].text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```$/g, '').trim();
    }

    return JSON.parse(jsonStr);
  } catch (err) {
    console.error(`AI ${analysisType} analysis error:`, err);
    return { error: err.message };
  }
}


module.exports = {
  processDailyLogIntelligence,
  getCatalogUpdateSuggestions,
  analyzeWithAI
};
