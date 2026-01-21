-- Migration 106: WIP (Work-in-Progress) Schedule
-- Track project progress, billings vs costs, and revenue recognition

-- ============================================================
-- WIP SNAPSHOTS
-- Monthly WIP calculations for each job
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_wip_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),

  -- Contract Values
  original_contract DECIMAL(14,2) DEFAULT 0,
  approved_changes DECIMAL(14,2) DEFAULT 0,
  revised_contract DECIMAL(14,2) DEFAULT 0,

  -- Cost Data
  estimated_cost DECIMAL(14,2) DEFAULT 0,
  cost_to_date DECIMAL(14,2) DEFAULT 0,
  estimated_cost_to_complete DECIMAL(14,2) DEFAULT 0,
  revised_estimated_cost DECIMAL(14,2) DEFAULT 0,

  -- Progress
  percent_complete DECIMAL(5,2) DEFAULT 0,
  completion_method TEXT DEFAULT 'cost_to_cost', -- cost_to_cost, units, milestones

  -- Revenue Recognition
  earned_revenue DECIMAL(14,2) DEFAULT 0,
  billed_to_date DECIMAL(14,2) DEFAULT 0,

  -- WIP Calculation
  overbilling DECIMAL(14,2) DEFAULT 0,  -- Billings > Earned (liability)
  underbilling DECIMAL(14,2) DEFAULT 0, -- Earned > Billings (asset)

  -- Gross Profit
  estimated_gross_profit DECIMAL(14,2) DEFAULT 0,
  gross_profit_to_date DECIMAL(14,2) DEFAULT 0,
  gross_profit_percent DECIMAL(6,4) DEFAULT 0,

  -- Projected Final
  projected_final_cost DECIMAL(14,2) DEFAULT 0,
  projected_final_profit DECIMAL(14,2) DEFAULT 0,
  projected_margin DECIMAL(6,4) DEFAULT 0,

  -- Variance from Original
  cost_variance DECIMAL(14,2) DEFAULT 0, -- Projected - Original Estimate
  profit_variance DECIMAL(14,2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'in_progress', -- in_progress, complete, closed
  notes TEXT,

  -- Audit
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  UNIQUE(job_id, period_id)
);

-- ============================================================
-- JOB ESTIMATES
-- Store original and revised estimates for WIP calculations
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_job_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  estimate_type TEXT NOT NULL DEFAULT 'original', -- original, revised, forecast

  -- Cost Breakdown
  total_estimated_cost DECIMAL(14,2) DEFAULT 0,
  labor_cost DECIMAL(14,2) DEFAULT 0,
  material_cost DECIMAL(14,2) DEFAULT 0,
  subcontractor_cost DECIMAL(14,2) DEFAULT 0,
  equipment_cost DECIMAL(14,2) DEFAULT 0,
  overhead_cost DECIMAL(14,2) DEFAULT 0,
  other_cost DECIMAL(14,2) DEFAULT 0,

  -- Profit
  estimated_profit DECIMAL(14,2) DEFAULT 0,
  target_margin DECIMAL(6,4) DEFAULT 0,

  -- Metadata
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_wip_job ON v2_wip_snapshots(job_id);
CREATE INDEX IF NOT EXISTS idx_wip_period ON v2_wip_snapshots(period_id);
CREATE INDEX IF NOT EXISTS idx_wip_date ON v2_wip_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_wip_status ON v2_wip_snapshots(status);
CREATE INDEX IF NOT EXISTS idx_job_estimates_job ON v2_job_estimates(job_id);
CREATE INDEX IF NOT EXISTS idx_job_estimates_type ON v2_job_estimates(estimate_type);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Calculate WIP for a single job
CREATE OR REPLACE FUNCTION calculate_job_wip(
  p_job_id UUID,
  p_period_id UUID DEFAULT NULL
)
RETURNS TABLE (
  original_contract DECIMAL(14,2),
  approved_changes DECIMAL(14,2),
  revised_contract DECIMAL(14,2),
  estimated_cost DECIMAL(14,2),
  cost_to_date DECIMAL(14,2),
  estimated_cost_to_complete DECIMAL(14,2),
  revised_estimated_cost DECIMAL(14,2),
  percent_complete DECIMAL(5,2),
  earned_revenue DECIMAL(14,2),
  billed_to_date DECIMAL(14,2),
  overbilling DECIMAL(14,2),
  underbilling DECIMAL(14,2),
  estimated_gross_profit DECIMAL(14,2),
  gross_profit_to_date DECIMAL(14,2),
  projected_final_cost DECIMAL(14,2),
  projected_final_profit DECIMAL(14,2),
  projected_margin DECIMAL(6,4)
) AS $$
DECLARE
  v_original_contract DECIMAL(14,2);
  v_approved_changes DECIMAL(14,2) := 0;
  v_revised_contract DECIMAL(14,2);
  v_estimated_cost DECIMAL(14,2) := 0;
  v_cost_to_date DECIMAL(14,2) := 0;
  v_etc DECIMAL(14,2) := 0;
  v_revised_estimate DECIMAL(14,2);
  v_pct_complete DECIMAL(5,2) := 0;
  v_earned_revenue DECIMAL(14,2);
  v_billed DECIMAL(14,2) := 0;
  v_over DECIMAL(14,2) := 0;
  v_under DECIMAL(14,2) := 0;
  v_est_profit DECIMAL(14,2);
  v_profit_to_date DECIMAL(14,2);
  v_proj_final_cost DECIMAL(14,2);
  v_proj_final_profit DECIMAL(14,2);
  v_proj_margin DECIMAL(6,4) := 0;
BEGIN
  -- Get original contract
  SELECT COALESCE(j.contract_amount, 0) INTO v_original_contract
  FROM v2_jobs j WHERE j.id = p_job_id;

  -- Get approved change orders
  SELECT COALESCE(SUM(co.amount), 0) INTO v_approved_changes
  FROM v2_change_orders co
  WHERE co.job_id = p_job_id
    AND co.status = 'approved'
    AND co.deleted_at IS NULL;

  v_revised_contract := v_original_contract + v_approved_changes;

  -- Get original estimate (or use budget)
  SELECT COALESCE(e.total_estimated_cost, 0) INTO v_estimated_cost
  FROM v2_job_estimates e
  WHERE e.job_id = p_job_id AND e.estimate_type = 'original'
  ORDER BY e.effective_date DESC
  LIMIT 1;

  -- If no estimate, use total budget
  IF v_estimated_cost = 0 THEN
    SELECT COALESCE(SUM(bl.budgeted_amount), 0) INTO v_estimated_cost
    FROM v2_budget_lines bl WHERE bl.job_id = p_job_id;
  END IF;

  -- Get cost to date from direct costs
  SELECT COALESCE(total_direct, 0) INTO v_cost_to_date
  FROM get_job_direct_costs(p_job_id);

  -- Get latest forecast/revised estimate for ETC
  SELECT COALESCE(e.total_estimated_cost, 0) INTO v_revised_estimate
  FROM v2_job_estimates e
  WHERE e.job_id = p_job_id AND e.estimate_type IN ('revised', 'forecast')
  ORDER BY e.effective_date DESC
  LIMIT 1;

  -- If no revised estimate, project based on percent complete
  IF v_revised_estimate = 0 OR v_revised_estimate < v_cost_to_date THEN
    -- Use remaining budget or extrapolate
    IF v_cost_to_date > 0 AND v_estimated_cost > 0 THEN
      v_pct_complete := LEAST(ROUND((v_cost_to_date / v_estimated_cost) * 100, 2), 100);
      IF v_pct_complete > 0 THEN
        v_revised_estimate := (v_cost_to_date / v_pct_complete) * 100;
      ELSE
        v_revised_estimate := v_estimated_cost;
      END IF;
    ELSE
      v_revised_estimate := v_estimated_cost;
    END IF;
  END IF;

  -- Calculate ETC and percent complete
  v_etc := GREATEST(v_revised_estimate - v_cost_to_date, 0);
  IF v_revised_estimate > 0 THEN
    v_pct_complete := LEAST(ROUND((v_cost_to_date / v_revised_estimate) * 100, 2), 100);
  END IF;

  -- Calculate earned revenue (% complete method)
  v_earned_revenue := v_revised_contract * (v_pct_complete / 100);

  -- Get billed to date from draws
  SELECT COALESCE(SUM(d.total_amount), 0) INTO v_billed
  FROM v2_draws d
  WHERE d.job_id = p_job_id AND d.status IN ('submitted', 'funded');

  -- Calculate over/under billing
  IF v_billed > v_earned_revenue THEN
    v_over := v_billed - v_earned_revenue;
    v_under := 0;
  ELSE
    v_over := 0;
    v_under := v_earned_revenue - v_billed;
  END IF;

  -- Calculate profits
  v_est_profit := v_revised_contract - v_estimated_cost;
  v_profit_to_date := v_earned_revenue - v_cost_to_date;
  v_proj_final_cost := v_revised_estimate;
  v_proj_final_profit := v_revised_contract - v_proj_final_cost;

  IF v_revised_contract > 0 THEN
    v_proj_margin := ROUND(v_proj_final_profit / v_revised_contract, 4);
  END IF;

  RETURN QUERY SELECT
    v_original_contract,
    v_approved_changes,
    v_revised_contract,
    v_estimated_cost,
    v_cost_to_date,
    v_etc,
    v_revised_estimate,
    v_pct_complete,
    v_earned_revenue,
    v_billed,
    v_over,
    v_under,
    v_est_profit,
    v_profit_to_date,
    v_proj_final_cost,
    v_proj_final_profit,
    v_proj_margin;
END;
$$ LANGUAGE plpgsql;

-- Create WIP snapshot for a job
CREATE OR REPLACE FUNCTION create_wip_snapshot(
  p_job_id UUID,
  p_period_id UUID,
  p_created_by TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  wip_rec RECORD;
  snapshot_id UUID;
  period_rec RECORD;
  v_original_est DECIMAL(14,2) := 0;
BEGIN
  -- Get period dates
  SELECT * INTO period_rec FROM v2_financial_periods WHERE id = p_period_id;

  -- Calculate WIP
  SELECT * INTO wip_rec FROM calculate_job_wip(p_job_id, p_period_id);

  -- Get original estimate
  SELECT COALESCE(e.total_estimated_cost, 0) INTO v_original_est
  FROM v2_job_estimates e
  WHERE e.job_id = p_job_id AND e.estimate_type = 'original'
  ORDER BY e.effective_date DESC
  LIMIT 1;

  INSERT INTO v2_wip_snapshots (
    job_id, period_id,
    original_contract, approved_changes, revised_contract,
    estimated_cost, cost_to_date, estimated_cost_to_complete, revised_estimated_cost,
    percent_complete, completion_method,
    earned_revenue, billed_to_date,
    overbilling, underbilling,
    estimated_gross_profit, gross_profit_to_date, gross_profit_percent,
    projected_final_cost, projected_final_profit, projected_margin,
    cost_variance, profit_variance,
    snapshot_date, created_by
  ) VALUES (
    p_job_id, p_period_id,
    wip_rec.original_contract, wip_rec.approved_changes, wip_rec.revised_contract,
    wip_rec.estimated_cost, wip_rec.cost_to_date, wip_rec.estimated_cost_to_complete, wip_rec.revised_estimated_cost,
    wip_rec.percent_complete, 'cost_to_cost',
    wip_rec.earned_revenue, wip_rec.billed_to_date,
    wip_rec.overbilling, wip_rec.underbilling,
    wip_rec.estimated_gross_profit, wip_rec.gross_profit_to_date,
    CASE WHEN wip_rec.revised_contract > 0 THEN ROUND(wip_rec.gross_profit_to_date / wip_rec.revised_contract, 4) ELSE 0 END,
    wip_rec.projected_final_cost, wip_rec.projected_final_profit, wip_rec.projected_margin,
    wip_rec.projected_final_cost - v_original_est,
    wip_rec.projected_final_profit - (wip_rec.revised_contract - v_original_est),
    period_rec.end_date, p_created_by
  )
  ON CONFLICT (job_id, period_id)
  DO UPDATE SET
    original_contract = EXCLUDED.original_contract,
    approved_changes = EXCLUDED.approved_changes,
    revised_contract = EXCLUDED.revised_contract,
    estimated_cost = EXCLUDED.estimated_cost,
    cost_to_date = EXCLUDED.cost_to_date,
    estimated_cost_to_complete = EXCLUDED.estimated_cost_to_complete,
    revised_estimated_cost = EXCLUDED.revised_estimated_cost,
    percent_complete = EXCLUDED.percent_complete,
    earned_revenue = EXCLUDED.earned_revenue,
    billed_to_date = EXCLUDED.billed_to_date,
    overbilling = EXCLUDED.overbilling,
    underbilling = EXCLUDED.underbilling,
    estimated_gross_profit = EXCLUDED.estimated_gross_profit,
    gross_profit_to_date = EXCLUDED.gross_profit_to_date,
    gross_profit_percent = EXCLUDED.gross_profit_percent,
    projected_final_cost = EXCLUDED.projected_final_cost,
    projected_final_profit = EXCLUDED.projected_final_profit,
    projected_margin = EXCLUDED.projected_margin,
    cost_variance = EXCLUDED.cost_variance,
    profit_variance = EXCLUDED.profit_variance,
    snapshot_date = EXCLUDED.snapshot_date
  RETURNING id INTO snapshot_id;

  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

-- Current WIP for all active jobs
CREATE OR REPLACE VIEW v2_wip_current AS
SELECT
  j.id as job_id,
  j.name as job_name,
  j.status as job_status,
  j.client_name,
  w.*
FROM v2_jobs j
CROSS JOIN LATERAL calculate_job_wip(j.id) w
WHERE j.status = 'active' AND j.deleted_at IS NULL;

-- WIP Summary for financial reporting
CREATE OR REPLACE VIEW v2_wip_summary AS
SELECT
  SUM(overbilling) as total_overbilling,
  SUM(underbilling) as total_underbilling,
  SUM(overbilling) - SUM(underbilling) as net_wip_position,
  SUM(earned_revenue) as total_earned_revenue,
  SUM(billed_to_date) as total_billed,
  SUM(cost_to_date) as total_costs,
  SUM(gross_profit_to_date) as total_gross_profit,
  SUM(projected_final_profit) as total_projected_profit,
  COUNT(*) FILTER (WHERE overbilling > 0) as overbilled_jobs,
  COUNT(*) FILTER (WHERE underbilling > 0) as underbilled_jobs
FROM v2_wip_current;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_wip_snapshots IS 'Monthly WIP (Work-in-Progress) snapshots for revenue recognition';
COMMENT ON TABLE v2_job_estimates IS 'Original and revised cost estimates for jobs';
COMMENT ON FUNCTION calculate_job_wip(UUID, UUID) IS 'Calculate current WIP metrics for a job';
COMMENT ON FUNCTION create_wip_snapshot(UUID, UUID, TEXT) IS 'Create or update WIP snapshot for a job in a period';
