-- Migration 087: Trade Scorecards (Phase 74)
-- Tracks vendor/trade performance: quality, speed, reliability, communication

-- ============================================================
-- 1. VENDOR SCORECARDS (Aggregated metrics)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_vendor_scorecards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES v2_vendors(id) ON DELETE CASCADE,

  -- Overall scores (0-100)
  overall_score DECIMAL(5,2) DEFAULT 0,
  quality_score DECIMAL(5,2) DEFAULT 0,
  speed_score DECIMAL(5,2) DEFAULT 0,
  reliability_score DECIMAL(5,2) DEFAULT 0,
  communication_score DECIMAL(5,2) DEFAULT 0,
  value_score DECIMAL(5,2) DEFAULT 0,

  -- Counts
  total_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  active_jobs INTEGER DEFAULT 0,

  -- Performance metrics
  on_time_percent DECIMAL(5,2) DEFAULT 0,
  on_budget_percent DECIMAL(5,2) DEFAULT 0,
  callback_rate DECIMAL(5,2) DEFAULT 0, -- % of jobs with callbacks
  avg_punch_items DECIMAL(8,2) DEFAULT 0,

  -- Financial metrics
  total_contract_value DECIMAL(14,2) DEFAULT 0,
  total_change_orders DECIMAL(14,2) DEFAULT 0,
  change_order_percent DECIMAL(5,2) DEFAULT 0,

  -- Trends
  trend_direction TEXT CHECK (trend_direction IN ('up', 'down', 'stable')) DEFAULT 'stable',
  last_30_days_score DECIMAL(5,2),
  last_90_days_score DECIMAL(5,2),

  -- Certification/status
  preferred_vendor BOOLEAN DEFAULT false,
  certified_date DATE,
  certified_by TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_vendor_scorecards_vendor ON v2_vendor_scorecards(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_scorecards_overall ON v2_vendor_scorecards(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_scorecards_preferred ON v2_vendor_scorecards(preferred_vendor) WHERE preferred_vendor = true;

-- ============================================================
-- 2. VENDOR REVIEWS (Individual job reviews)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_vendor_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES v2_vendors(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE SET NULL,

  -- Review info
  review_date DATE DEFAULT CURRENT_DATE,
  reviewed_by TEXT,

  -- Scores (1-5 scale)
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  speed_rating INTEGER CHECK (speed_rating >= 1 AND speed_rating <= 5),
  reliability_rating INTEGER CHECK (reliability_rating >= 1 AND reliability_rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  overall_rating INTEGER CHECK (overall_rating >= 1 AND overall_rating <= 5),

  -- Detailed metrics
  days_scheduled INTEGER,
  days_actual INTEGER,
  was_on_time BOOLEAN,
  was_on_budget BOOLEAN,
  punch_item_count INTEGER DEFAULT 0,
  callback_required BOOLEAN DEFAULT false,

  -- Comments
  strengths TEXT,
  areas_for_improvement TEXT,
  notes TEXT,

  -- Visibility
  visible_to_vendor BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_reviews_vendor ON v2_vendor_reviews(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_job ON v2_vendor_reviews(job_id);
CREATE INDEX IF NOT EXISTS idx_vendor_reviews_date ON v2_vendor_reviews(review_date DESC);

-- ============================================================
-- 3. VENDOR INCIDENTS (Issues tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_vendor_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES v2_vendors(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Incident info
  incident_date DATE DEFAULT CURRENT_DATE,
  incident_type TEXT CHECK (incident_type IN (
    'quality_issue', 'schedule_delay', 'no_show', 'safety_violation',
    'communication_failure', 'damage', 'warranty_claim', 'other'
  )),
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'major', 'critical')) DEFAULT 'moderate',

  -- Details
  description TEXT NOT NULL,
  resolution TEXT,
  resolved_date DATE,
  cost_impact DECIMAL(12,2) DEFAULT 0,
  schedule_impact_days INTEGER DEFAULT 0,

  -- Who reported
  reported_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendor_incidents_vendor ON v2_vendor_incidents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_incidents_type ON v2_vendor_incidents(incident_type);
CREATE INDEX IF NOT EXISTS idx_vendor_incidents_severity ON v2_vendor_incidents(severity);

-- ============================================================
-- 4. TRADE METRICS (Category-level aggregates)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_trade_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_name TEXT NOT NULL,  -- 'Plumbing', 'Electrical', etc.

  -- Regional/market data
  avg_quality_score DECIMAL(5,2),
  avg_speed_score DECIMAL(5,2),
  avg_hourly_rate DECIMAL(10,2),
  vendor_count INTEGER DEFAULT 0,

  -- Benchmarks
  industry_benchmark_score DECIMAL(5,2),
  your_avg_score DECIMAL(5,2),

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(trade_name)
);

-- ============================================================
-- 5. FUNCTION: Update vendor scorecard from reviews
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_vendor_scorecard(p_vendor_id UUID)
RETURNS void AS $$
DECLARE
  v_total_reviews INTEGER;
  v_quality_avg DECIMAL(5,2);
  v_speed_avg DECIMAL(5,2);
  v_reliability_avg DECIMAL(5,2);
  v_communication_avg DECIMAL(5,2);
  v_value_avg DECIMAL(5,2);
  v_overall DECIMAL(5,2);
  v_on_time_count INTEGER;
  v_on_budget_count INTEGER;
  v_callback_count INTEGER;
  v_total_punch INTEGER;
  v_incident_count INTEGER;
  v_job_count INTEGER;
  v_completed_jobs INTEGER;
  v_active_jobs INTEGER;
  v_total_value DECIMAL(14,2);
  v_total_cos DECIMAL(14,2);
BEGIN
  -- Count reviews
  SELECT COUNT(*) INTO v_total_reviews
  FROM v2_vendor_reviews WHERE vendor_id = p_vendor_id;

  IF v_total_reviews = 0 THEN
    -- Initialize with neutral scores
    INSERT INTO v2_vendor_scorecards (vendor_id, overall_score, total_jobs)
    VALUES (p_vendor_id, 50, 0)
    ON CONFLICT (vendor_id) DO UPDATE SET updated_at = NOW();
    RETURN;
  END IF;

  -- Calculate averages from reviews (convert 1-5 to 0-100)
  SELECT
    COALESCE(AVG(quality_rating) * 20, 50),
    COALESCE(AVG(speed_rating) * 20, 50),
    COALESCE(AVG(reliability_rating) * 20, 50),
    COALESCE(AVG(communication_rating) * 20, 50),
    COALESCE(AVG(value_rating) * 20, 50),
    COUNT(*) FILTER (WHERE was_on_time = true),
    COUNT(*) FILTER (WHERE was_on_budget = true),
    COUNT(*) FILTER (WHERE callback_required = true),
    COALESCE(SUM(punch_item_count), 0)
  INTO
    v_quality_avg, v_speed_avg, v_reliability_avg,
    v_communication_avg, v_value_avg,
    v_on_time_count, v_on_budget_count, v_callback_count, v_total_punch
  FROM v2_vendor_reviews
  WHERE vendor_id = p_vendor_id;

  -- Count incidents (deduct from reliability)
  SELECT COUNT(*) INTO v_incident_count
  FROM v2_vendor_incidents
  WHERE vendor_id = p_vendor_id
    AND incident_date > CURRENT_DATE - INTERVAL '1 year';

  -- Adjust reliability based on incidents
  v_reliability_avg := GREATEST(0, v_reliability_avg - (v_incident_count * 5));

  -- Count jobs from POs
  SELECT
    COUNT(DISTINCT job_id),
    COUNT(DISTINCT job_id) FILTER (WHERE status = 'closed'),
    COUNT(DISTINCT job_id) FILTER (WHERE status IN ('open', 'approved'))
  INTO v_job_count, v_completed_jobs, v_active_jobs
  FROM v2_purchase_orders
  WHERE vendor_id = p_vendor_id
    AND deleted_at IS NULL;

  -- Financial metrics
  SELECT
    COALESCE(SUM(total_amount), 0),
    COALESCE(SUM(change_order_total), 0)
  INTO v_total_value, v_total_cos
  FROM v2_purchase_orders
  WHERE vendor_id = p_vendor_id
    AND deleted_at IS NULL;

  -- Calculate overall score (weighted average)
  v_overall := (
    v_quality_avg * 0.30 +
    v_speed_avg * 0.20 +
    v_reliability_avg * 0.25 +
    v_communication_avg * 0.15 +
    v_value_avg * 0.10
  );

  -- Upsert scorecard
  INSERT INTO v2_vendor_scorecards (
    vendor_id,
    overall_score, quality_score, speed_score,
    reliability_score, communication_score, value_score,
    total_jobs, completed_jobs, active_jobs,
    on_time_percent, on_budget_percent, callback_rate, avg_punch_items,
    total_contract_value, total_change_orders, change_order_percent,
    updated_at
  )
  VALUES (
    p_vendor_id,
    v_overall, v_quality_avg, v_speed_avg,
    v_reliability_avg, v_communication_avg, v_value_avg,
    v_job_count, v_completed_jobs, v_active_jobs,
    CASE WHEN v_total_reviews > 0 THEN (v_on_time_count::DECIMAL / v_total_reviews * 100) ELSE 0 END,
    CASE WHEN v_total_reviews > 0 THEN (v_on_budget_count::DECIMAL / v_total_reviews * 100) ELSE 0 END,
    CASE WHEN v_total_reviews > 0 THEN (v_callback_count::DECIMAL / v_total_reviews * 100) ELSE 0 END,
    CASE WHEN v_total_reviews > 0 THEN (v_total_punch::DECIMAL / v_total_reviews) ELSE 0 END,
    v_total_value, v_total_cos,
    CASE WHEN v_total_value > 0 THEN (v_total_cos / v_total_value * 100) ELSE 0 END,
    NOW()
  )
  ON CONFLICT (vendor_id) DO UPDATE SET
    overall_score = EXCLUDED.overall_score,
    quality_score = EXCLUDED.quality_score,
    speed_score = EXCLUDED.speed_score,
    reliability_score = EXCLUDED.reliability_score,
    communication_score = EXCLUDED.communication_score,
    value_score = EXCLUDED.value_score,
    total_jobs = EXCLUDED.total_jobs,
    completed_jobs = EXCLUDED.completed_jobs,
    active_jobs = EXCLUDED.active_jobs,
    on_time_percent = EXCLUDED.on_time_percent,
    on_budget_percent = EXCLUDED.on_budget_percent,
    callback_rate = EXCLUDED.callback_rate,
    avg_punch_items = EXCLUDED.avg_punch_items,
    total_contract_value = EXCLUDED.total_contract_value,
    total_change_orders = EXCLUDED.total_change_orders,
    change_order_percent = EXCLUDED.change_order_percent,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. TRIGGER: Auto-update scorecard on review changes
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_update_vendor_scorecard()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_vendor_scorecard(OLD.vendor_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_vendor_scorecard(NEW.vendor_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_review_update_scorecard ON v2_vendor_reviews;
CREATE TRIGGER trigger_review_update_scorecard
  AFTER INSERT OR UPDATE OR DELETE ON v2_vendor_reviews
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vendor_scorecard();

DROP TRIGGER IF EXISTS trigger_incident_update_scorecard ON v2_vendor_incidents;
CREATE TRIGGER trigger_incident_update_scorecard
  AFTER INSERT OR UPDATE OR DELETE ON v2_vendor_incidents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_vendor_scorecard();

-- ============================================================
-- 7. VIEW: Vendor leaderboard
-- ============================================================
CREATE OR REPLACE VIEW v2_vendor_leaderboard AS
SELECT
  v.id as vendor_id,
  v.name as vendor_name,
  v.email,
  v.phone,
  COALESCE(sc.overall_score, 50) as overall_score,
  COALESCE(sc.quality_score, 50) as quality_score,
  COALESCE(sc.speed_score, 50) as speed_score,
  COALESCE(sc.reliability_score, 50) as reliability_score,
  COALESCE(sc.communication_score, 50) as communication_score,
  COALESCE(sc.total_jobs, 0) as total_jobs,
  COALESCE(sc.completed_jobs, 0) as completed_jobs,
  COALESCE(sc.on_time_percent, 0) as on_time_percent,
  COALESCE(sc.callback_rate, 0) as callback_rate,
  COALESCE(sc.total_contract_value, 0) as total_contract_value,
  COALESCE(sc.preferred_vendor, false) as preferred_vendor,
  RANK() OVER (ORDER BY COALESCE(sc.overall_score, 50) DESC) as rank
FROM v2_vendors v
LEFT JOIN v2_vendor_scorecards sc ON v.id = sc.vendor_id
WHERE v.deleted_at IS NULL
ORDER BY overall_score DESC;

-- ============================================================
-- 8. FUNCTION: Get vendor comparison
-- ============================================================
CREATE OR REPLACE FUNCTION compare_vendors(p_vendor_ids UUID[])
RETURNS TABLE (
  vendor_id UUID,
  vendor_name TEXT,
  overall_score DECIMAL,
  quality_score DECIMAL,
  speed_score DECIMAL,
  reliability_score DECIMAL,
  communication_score DECIMAL,
  value_score DECIMAL,
  total_jobs INTEGER,
  on_time_percent DECIMAL,
  callback_rate DECIMAL,
  avg_punch_items DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.id,
    v.name,
    COALESCE(sc.overall_score, 50),
    COALESCE(sc.quality_score, 50),
    COALESCE(sc.speed_score, 50),
    COALESCE(sc.reliability_score, 50),
    COALESCE(sc.communication_score, 50),
    COALESCE(sc.value_score, 50),
    COALESCE(sc.total_jobs, 0),
    COALESCE(sc.on_time_percent, 0),
    COALESCE(sc.callback_rate, 0),
    COALESCE(sc.avg_punch_items, 0)
  FROM v2_vendors v
  LEFT JOIN v2_vendor_scorecards sc ON v.id = sc.vendor_id
  WHERE v.id = ANY(p_vendor_ids);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_vendor_scorecards IS 'Aggregated performance metrics for vendors';
COMMENT ON TABLE v2_vendor_reviews IS 'Individual job/PO reviews for vendors';
COMMENT ON TABLE v2_vendor_incidents IS 'Tracked issues and problems with vendors';
COMMENT ON FUNCTION recalculate_vendor_scorecard(UUID) IS 'Recalculates vendor scorecard from reviews and incidents';
COMMENT ON VIEW v2_vendor_leaderboard IS 'Ranked list of vendors by overall score';
