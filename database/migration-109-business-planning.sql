-- Migration 109: Business Planning
-- Annual/quarterly planning, targets, and performance tracking

-- ============================================================
-- BUSINESS PLANS
-- Annual and quarterly business plans
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  plan_name TEXT NOT NULL,
  plan_type TEXT NOT NULL, -- annual, quarterly
  year INTEGER NOT NULL,
  quarter INTEGER, -- 1-4 for quarterly plans

  -- Date Range
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Revenue Targets
  revenue_target DECIMAL(14,2) DEFAULT 0,
  gross_margin_target DECIMAL(6,4) DEFAULT 0,
  net_margin_target DECIMAL(6,4) DEFAULT 0,

  -- Job Targets
  jobs_target INTEGER DEFAULT 0,
  avg_job_size_target DECIMAL(14,2) DEFAULT 0,

  -- Cost Targets
  labor_cost_target DECIMAL(14,2) DEFAULT 0,
  material_cost_target DECIMAL(14,2) DEFAULT 0,
  overhead_target DECIMAL(14,2) DEFAULT 0,

  -- Growth
  revenue_growth_target DECIMAL(6,4) DEFAULT 0, -- % vs prior period
  margin_improvement_target DECIMAL(6,4) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'draft', -- draft, active, completed
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

-- ============================================================
-- PLAN MILESTONES
-- Key milestones and checkpoints in the plan
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_plan_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  plan_id UUID NOT NULL REFERENCES v2_business_plans(id) ON DELETE CASCADE,

  milestone_name TEXT NOT NULL,
  target_date DATE NOT NULL,
  category TEXT, -- revenue, job, operational, financial

  -- Target
  target_value DECIMAL(14,2),
  target_metric TEXT, -- revenue, job_count, margin, etc.

  -- Actual
  actual_value DECIMAL(14,2),
  achieved_date DATE,

  -- Status
  status TEXT DEFAULT 'pending', -- pending, on_track, at_risk, achieved, missed

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAN ACTUALS
-- Track actual performance against plan
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_plan_actuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  plan_id UUID NOT NULL REFERENCES v2_business_plans(id) ON DELETE CASCADE,
  period_id UUID REFERENCES v2_financial_periods(id),

  -- Actuals
  actual_revenue DECIMAL(14,2) DEFAULT 0,
  actual_gross_profit DECIMAL(14,2) DEFAULT 0,
  actual_gross_margin DECIMAL(6,4) DEFAULT 0,
  actual_net_income DECIMAL(14,2) DEFAULT 0,
  actual_net_margin DECIMAL(6,4) DEFAULT 0,

  -- Jobs
  actual_jobs_started INTEGER DEFAULT 0,
  actual_jobs_completed INTEGER DEFAULT 0,
  actual_avg_job_size DECIMAL(14,2) DEFAULT 0,

  -- Costs
  actual_labor_cost DECIMAL(14,2) DEFAULT 0,
  actual_material_cost DECIMAL(14,2) DEFAULT 0,
  actual_overhead_cost DECIMAL(14,2) DEFAULT 0,

  -- Audit
  snapshot_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_id, period_id)
);

-- ============================================================
-- KPI DEFINITIONS
-- Define KPIs to track
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_kpi_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  kpi_name TEXT NOT NULL,
  kpi_code TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT, -- financial, operational, customer, growth

  -- Calculation
  calculation_type TEXT, -- sum, average, ratio, count
  data_source TEXT, -- which table/view provides data

  -- Display
  format TEXT DEFAULT 'number', -- number, currency, percent
  higher_is_better BOOLEAN DEFAULT TRUE,

  -- Targets
  default_target DECIMAL(14,2),
  warning_threshold DECIMAL(6,4), -- % below target to show warning
  danger_threshold DECIMAL(6,4), -- % below target to show danger

  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default KPIs
INSERT INTO v2_kpi_definitions (kpi_name, kpi_code, category, calculation_type, format, higher_is_better, display_order) VALUES
  ('Revenue', 'REVENUE', 'financial', 'sum', 'currency', true, 1),
  ('Gross Margin', 'GROSS_MARGIN', 'financial', 'ratio', 'percent', true, 2),
  ('Net Margin', 'NET_MARGIN', 'financial', 'ratio', 'percent', true, 3),
  ('Jobs Started', 'JOBS_STARTED', 'operational', 'count', 'number', true, 4),
  ('Jobs Completed', 'JOBS_COMPLETED', 'operational', 'count', 'number', true, 5),
  ('Average Job Size', 'AVG_JOB_SIZE', 'financial', 'average', 'currency', true, 6),
  ('Overhead Rate', 'OVERHEAD_RATE', 'financial', 'ratio', 'percent', false, 7),
  ('WIP Balance', 'WIP_BALANCE', 'financial', 'sum', 'currency', true, 8)
ON CONFLICT (kpi_code) DO NOTHING;

-- ============================================================
-- KPI TARGETS
-- KPI targets per plan
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  plan_id UUID NOT NULL REFERENCES v2_business_plans(id) ON DELETE CASCADE,
  kpi_id UUID NOT NULL REFERENCES v2_kpi_definitions(id),

  target_value DECIMAL(14,2) NOT NULL,
  stretch_target DECIMAL(14,2), -- Stretch goal

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(plan_id, kpi_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_plans_year ON v2_business_plans(year);
CREATE INDEX IF NOT EXISTS idx_plans_status ON v2_business_plans(status);
CREATE INDEX IF NOT EXISTS idx_milestones_plan ON v2_plan_milestones(plan_id);
CREATE INDEX IF NOT EXISTS idx_milestones_date ON v2_plan_milestones(target_date);
CREATE INDEX IF NOT EXISTS idx_actuals_plan ON v2_plan_actuals(plan_id);
CREATE INDEX IF NOT EXISTS idx_kpi_targets_plan ON v2_kpi_targets(plan_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Calculate plan performance
CREATE OR REPLACE FUNCTION calculate_plan_performance(p_plan_id UUID)
RETURNS TABLE (
  revenue_actual DECIMAL(14,2),
  revenue_target DECIMAL(14,2),
  revenue_variance DECIMAL(14,2),
  revenue_percent DECIMAL(6,4),
  gross_margin_actual DECIMAL(6,4),
  gross_margin_target DECIMAL(6,4),
  gross_margin_variance DECIMAL(6,4),
  net_margin_actual DECIMAL(6,4),
  net_margin_target DECIMAL(6,4),
  jobs_actual INTEGER,
  jobs_target INTEGER,
  on_track_milestones INTEGER,
  at_risk_milestones INTEGER,
  achieved_milestones INTEGER
) AS $$
DECLARE
  plan_rec RECORD;
  v_rev_actual DECIMAL(14,2) := 0;
  v_gross_margin DECIMAL(6,4) := 0;
  v_net_margin DECIMAL(6,4) := 0;
  v_jobs INTEGER := 0;
  v_on_track INTEGER := 0;
  v_at_risk INTEGER := 0;
  v_achieved INTEGER := 0;
BEGIN
  -- Get plan
  SELECT * INTO plan_rec FROM v2_business_plans WHERE id = p_plan_id;

  -- Get actuals
  SELECT
    COALESCE(SUM(actual_revenue), 0),
    CASE WHEN SUM(actual_revenue) > 0 THEN SUM(actual_gross_profit) / SUM(actual_revenue) ELSE 0 END,
    CASE WHEN SUM(actual_revenue) > 0 THEN SUM(actual_net_income) / SUM(actual_revenue) ELSE 0 END,
    COALESCE(SUM(actual_jobs_completed), 0)
  INTO v_rev_actual, v_gross_margin, v_net_margin, v_jobs
  FROM v2_plan_actuals WHERE plan_id = p_plan_id;

  -- Get milestone counts
  SELECT
    COUNT(*) FILTER (WHERE status = 'on_track'),
    COUNT(*) FILTER (WHERE status = 'at_risk'),
    COUNT(*) FILTER (WHERE status = 'achieved')
  INTO v_on_track, v_at_risk, v_achieved
  FROM v2_plan_milestones WHERE plan_id = p_plan_id;

  RETURN QUERY SELECT
    v_rev_actual,
    plan_rec.revenue_target,
    v_rev_actual - plan_rec.revenue_target,
    CASE WHEN plan_rec.revenue_target > 0 THEN v_rev_actual / plan_rec.revenue_target ELSE 0 END,
    v_gross_margin,
    plan_rec.gross_margin_target,
    v_gross_margin - plan_rec.gross_margin_target,
    v_net_margin,
    plan_rec.net_margin_target,
    v_jobs,
    plan_rec.jobs_target,
    v_on_track,
    v_at_risk,
    v_achieved;
END;
$$ LANGUAGE plpgsql;

-- Update plan actuals from P&L data
CREATE OR REPLACE FUNCTION update_plan_actuals(
  p_plan_id UUID,
  p_period_id UUID
)
RETURNS UUID AS $$
DECLARE
  period_rec RECORD;
  pnl_rec RECORD;
  actual_id UUID;
BEGIN
  -- Get period
  SELECT * INTO period_rec FROM v2_financial_periods WHERE id = p_period_id;

  -- Get P&L snapshot or calculate
  SELECT * INTO pnl_rec FROM v2_pnl_snapshots WHERE period_id = p_period_id;

  IF pnl_rec IS NULL THEN
    SELECT * INTO pnl_rec FROM calculate_company_pnl(period_rec.start_date, period_rec.end_date);
  END IF;

  -- Get job counts
  DECLARE
    v_started INTEGER;
    v_completed INTEGER;
    v_avg_size DECIMAL(14,2);
  BEGIN
    SELECT COUNT(*) INTO v_started FROM v2_jobs
    WHERE created_at >= period_rec.start_date AND created_at <= period_rec.end_date + INTERVAL '1 day';

    SELECT COUNT(*) INTO v_completed FROM v2_jobs
    WHERE status = 'completed' AND updated_at >= period_rec.start_date AND updated_at <= period_rec.end_date + INTERVAL '1 day';

    SELECT COALESCE(AVG(contract_amount), 0) INTO v_avg_size
    FROM v2_jobs WHERE created_at >= period_rec.start_date AND created_at <= period_rec.end_date + INTERVAL '1 day';

    INSERT INTO v2_plan_actuals (
      plan_id, period_id,
      actual_revenue, actual_gross_profit, actual_gross_margin,
      actual_net_income, actual_net_margin,
      actual_jobs_started, actual_jobs_completed, actual_avg_job_size,
      actual_labor_cost, actual_material_cost, actual_overhead_cost,
      snapshot_date
    ) VALUES (
      p_plan_id, p_period_id,
      pnl_rec.total_revenue, pnl_rec.gross_profit, pnl_rec.gross_margin,
      pnl_rec.net_income, pnl_rec.net_margin,
      v_started, v_completed, v_avg_size,
      pnl_rec.labor_cost, pnl_rec.material_cost, pnl_rec.overhead_expense,
      period_rec.end_date
    )
    ON CONFLICT (plan_id, period_id)
    DO UPDATE SET
      actual_revenue = EXCLUDED.actual_revenue,
      actual_gross_profit = EXCLUDED.actual_gross_profit,
      actual_gross_margin = EXCLUDED.actual_gross_margin,
      actual_net_income = EXCLUDED.actual_net_income,
      actual_net_margin = EXCLUDED.actual_net_margin,
      actual_jobs_started = EXCLUDED.actual_jobs_started,
      actual_jobs_completed = EXCLUDED.actual_jobs_completed,
      actual_avg_job_size = EXCLUDED.actual_avg_job_size,
      actual_labor_cost = EXCLUDED.actual_labor_cost,
      actual_material_cost = EXCLUDED.actual_material_cost,
      actual_overhead_cost = EXCLUDED.actual_overhead_cost,
      snapshot_date = EXCLUDED.snapshot_date
    RETURNING id INTO actual_id;

    RETURN actual_id;
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

-- Active plans with summary
CREATE OR REPLACE VIEW v2_business_plans_summary AS
SELECT
  p.*,
  (SELECT COALESCE(SUM(actual_revenue), 0) FROM v2_plan_actuals WHERE plan_id = p.id) as ytd_revenue,
  (SELECT COUNT(*) FROM v2_plan_milestones WHERE plan_id = p.id AND status = 'achieved') as achieved_milestones,
  (SELECT COUNT(*) FROM v2_plan_milestones WHERE plan_id = p.id) as total_milestones
FROM v2_business_plans p
WHERE p.status IN ('draft', 'active');

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_business_plans IS 'Annual and quarterly business plans with targets';
COMMENT ON TABLE v2_plan_milestones IS 'Key milestones and checkpoints in business plans';
COMMENT ON TABLE v2_plan_actuals IS 'Actual performance vs plan by period';
COMMENT ON TABLE v2_kpi_definitions IS 'KPI definitions and thresholds';
COMMENT ON TABLE v2_kpi_targets IS 'KPI targets per business plan';
