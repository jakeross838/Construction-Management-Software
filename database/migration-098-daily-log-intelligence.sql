-- Migration 098: Daily Log Intelligence Feedback Tables
-- Tracks actuals from daily logs to improve catalog, pricing, and schedule predictions

-- ============================================================
-- 1. CATALOG LABOR FEEDBACK
-- Tracks actual vs estimated labor hours from daily logs
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_catalog_labor_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  catalog_item_id UUID REFERENCES v2_selection_catalog(id) ON DELETE SET NULL,
  daily_log_id UUID NOT NULL REFERENCES v2_daily_logs(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,

  -- Hours comparison
  estimated_hours DECIMAL(8,2),
  actual_hours DECIMAL(8,2) NOT NULL,
  crew_size INTEGER DEFAULT 1,
  variance_hours DECIMAL(8,2),
  variance_percent DECIMAL(6,2),

  -- Context
  log_date DATE NOT NULL,
  trade TEXT,
  notes TEXT,

  -- Processing
  applied_to_catalog BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,
  applied_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_catalog_labor_feedback_item ON v2_catalog_labor_feedback(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_labor_feedback_log ON v2_catalog_labor_feedback(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_catalog_labor_feedback_date ON v2_catalog_labor_feedback(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_catalog_labor_feedback_variance ON v2_catalog_labor_feedback(variance_percent)
  WHERE ABS(variance_percent) > 15;

COMMENT ON TABLE v2_catalog_labor_feedback IS 'Tracks actual labor hours from daily logs to improve catalog estimates';

-- ============================================================
-- 2. SCHEDULE DURATION FEEDBACK
-- Tracks actual vs estimated task durations
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_schedule_duration_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  schedule_task_id UUID,  -- References v2_schedule_tasks if exists
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  catalog_item_id UUID REFERENCES v2_selection_catalog(id) ON DELETE SET NULL,

  -- Duration comparison
  trade TEXT,
  estimated_days DECIMAL(6,2),
  actual_days DECIMAL(6,2) NOT NULL,
  variance_days DECIMAL(6,2),
  variance_percent DECIMAL(6,2),

  -- Context
  had_delays BOOLEAN DEFAULT false,
  delay_notes TEXT,
  weather_impact BOOLEAN DEFAULT false,

  -- Processing
  recorded_date DATE NOT NULL,
  applied_to_catalog BOOLEAN DEFAULT false,
  applied_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_duration_feedback_task ON v2_schedule_duration_feedback(schedule_task_id);
CREATE INDEX IF NOT EXISTS idx_schedule_duration_feedback_job ON v2_schedule_duration_feedback(job_id);
CREATE INDEX IF NOT EXISTS idx_schedule_duration_feedback_trade ON v2_schedule_duration_feedback(trade);
CREATE INDEX IF NOT EXISTS idx_schedule_duration_feedback_date ON v2_schedule_duration_feedback(recorded_date DESC);

COMMENT ON TABLE v2_schedule_duration_feedback IS 'Tracks actual task durations to improve schedule predictions';

-- ============================================================
-- 3. DELIVERY PRICE FEEDBACK
-- Links deliveries to price history for tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_delivery_price_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links
  delivery_id UUID NOT NULL,  -- References v2_daily_log_deliveries
  daily_log_id UUID NOT NULL REFERENCES v2_daily_logs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  master_item_id UUID REFERENCES v2_master_items(id) ON DELETE SET NULL,
  price_history_id UUID REFERENCES v2_price_history(id) ON DELETE SET NULL,

  -- Price data
  item_description TEXT NOT NULL,
  quantity DECIMAL(12,4),
  unit TEXT,
  unit_price DECIMAL(12,4),
  total_price DECIMAL(12,2),

  -- Comparison to existing
  previous_price DECIMAL(12,4),
  price_change_percent DECIMAL(6,2),

  -- Context
  delivery_date DATE NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_price_feedback_vendor ON v2_delivery_price_feedback(vendor_id);
CREATE INDEX IF NOT EXISTS idx_delivery_price_feedback_item ON v2_delivery_price_feedback(master_item_id);
CREATE INDEX IF NOT EXISTS idx_delivery_price_feedback_date ON v2_delivery_price_feedback(delivery_date DESC);

COMMENT ON TABLE v2_delivery_price_feedback IS 'Tracks material prices from daily log deliveries';

-- ============================================================
-- 4. INTELLIGENCE INSIGHTS TABLE
-- Stores generated insights for review
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_intelligence_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source
  source_type TEXT NOT NULL CHECK (source_type IN ('daily_log', 'invoice', 'po', 'schedule', 'manual')),
  source_id UUID,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Insight
  insight_type TEXT NOT NULL CHECK (insight_type IN (
    'labor_variance', 'price_change', 'duration_variance',
    'pattern_detected', 'recommendation', 'warning'
  )),
  severity TEXT CHECK (severity IN ('low', 'medium', 'high')) DEFAULT 'medium',

  -- Content
  title TEXT NOT NULL,
  description TEXT,
  data JSONB,
  suggestion TEXT,

  -- Entity affected
  affected_entity_type TEXT,  -- 'catalog_item', 'vendor', 'trade', etc.
  affected_entity_id UUID,

  -- Status
  status TEXT CHECK (status IN ('new', 'reviewed', 'applied', 'dismissed')) DEFAULT 'new',
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_intelligence_insights_type ON v2_intelligence_insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_status ON v2_intelligence_insights(status);
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_severity ON v2_intelligence_insights(severity)
  WHERE severity IN ('medium', 'high');
CREATE INDEX IF NOT EXISTS idx_intelligence_insights_new ON v2_intelligence_insights(created_at DESC)
  WHERE status = 'new';

COMMENT ON TABLE v2_intelligence_insights IS 'Actionable insights generated from daily logs and other sources';

-- ============================================================
-- 5. FUNCTION: Get labor feedback summary per catalog item
-- ============================================================
CREATE OR REPLACE FUNCTION get_catalog_labor_summary(p_catalog_item_id UUID DEFAULT NULL)
RETURNS TABLE (
  catalog_item_id UUID,
  sample_count BIGINT,
  avg_estimated DECIMAL,
  avg_actual DECIMAL,
  avg_variance_percent DECIMAL,
  suggested_hours DECIMAL,
  confidence INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    clf.catalog_item_id,
    COUNT(*)::BIGINT as sample_count,
    ROUND(AVG(clf.estimated_hours), 2) as avg_estimated,
    ROUND(AVG(clf.actual_hours), 2) as avg_actual,
    ROUND(AVG(clf.variance_percent), 1) as avg_variance_percent,
    ROUND(AVG(clf.actual_hours), 1) as suggested_hours,
    LEAST(95, 60 + COUNT(*)::INTEGER * 5) as confidence
  FROM v2_catalog_labor_feedback clf
  WHERE (p_catalog_item_id IS NULL OR clf.catalog_item_id = p_catalog_item_id)
    AND clf.catalog_item_id IS NOT NULL
  GROUP BY clf.catalog_item_id
  HAVING COUNT(*) >= 3;  -- Minimum samples for suggestion
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. FUNCTION: Get duration feedback summary per trade
-- ============================================================
CREATE OR REPLACE FUNCTION get_trade_duration_summary(p_trade TEXT DEFAULT NULL)
RETURNS TABLE (
  trade TEXT,
  sample_count BIGINT,
  avg_estimated DECIMAL,
  avg_actual DECIMAL,
  avg_variance_percent DECIMAL,
  delay_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sdf.trade,
    COUNT(*)::BIGINT as sample_count,
    ROUND(AVG(sdf.estimated_days), 2) as avg_estimated,
    ROUND(AVG(sdf.actual_days), 2) as avg_actual,
    ROUND(AVG(sdf.variance_percent), 1) as avg_variance_percent,
    ROUND(COUNT(*) FILTER (WHERE sdf.had_delays)::DECIMAL / COUNT(*) * 100, 1) as delay_rate
  FROM v2_schedule_duration_feedback sdf
  WHERE (p_trade IS NULL OR sdf.trade = p_trade)
    AND sdf.trade IS NOT NULL
  GROUP BY sdf.trade
  HAVING COUNT(*) >= 3;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. VIEW: Pending catalog updates
-- Shows catalog items with enough feedback to suggest updates
-- ============================================================
CREATE OR REPLACE VIEW v2_pending_catalog_updates AS
SELECT
  sc.id as catalog_item_id,
  sc.name as item_name,
  sc.labor_hours as current_labor_hours,
  summary.avg_actual as suggested_labor_hours,
  summary.sample_count,
  summary.avg_variance_percent as variance_percent,
  summary.confidence
FROM v2_selection_catalog sc
JOIN get_catalog_labor_summary(NULL) summary ON summary.catalog_item_id = sc.id
WHERE ABS(summary.avg_variance_percent) > 15
  AND summary.sample_count >= 3
ORDER BY summary.sample_count DESC, ABS(summary.avg_variance_percent) DESC;

-- ============================================================
-- 8. COMMENTS
-- ============================================================
COMMENT ON FUNCTION get_catalog_labor_summary IS 'Aggregates labor feedback for catalog update suggestions';
COMMENT ON FUNCTION get_trade_duration_summary IS 'Aggregates duration feedback by trade for schedule intelligence';
COMMENT ON VIEW v2_pending_catalog_updates IS 'Catalog items with enough feedback data to suggest labor hour updates';
