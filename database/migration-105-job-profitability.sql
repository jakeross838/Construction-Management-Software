-- Migration 105: Job Profitability Reports
-- True all-in job costs with allocated overhead and profitability metrics

-- ============================================================
-- JOB PROFITABILITY SNAPSHOTS
-- Monthly snapshots of job profitability for trend analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_job_profitability_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),

  -- Revenue
  contract_amount DECIMAL(14,2) DEFAULT 0,
  change_order_amount DECIMAL(14,2) DEFAULT 0,
  total_contract DECIMAL(14,2) DEFAULT 0,
  billed_to_date DECIMAL(14,2) DEFAULT 0,

  -- Direct Costs
  material_cost DECIMAL(14,2) DEFAULT 0,
  labor_base_cost DECIMAL(14,2) DEFAULT 0,
  labor_burden_cost DECIMAL(14,2) DEFAULT 0,
  subcontractor_cost DECIMAL(14,2) DEFAULT 0,
  equipment_cost DECIMAL(14,2) DEFAULT 0,
  other_direct_cost DECIMAL(14,2) DEFAULT 0,
  total_direct_cost DECIMAL(14,2) DEFAULT 0,

  -- Indirect Costs
  allocated_overhead DECIMAL(14,2) DEFAULT 0,
  total_indirect_cost DECIMAL(14,2) DEFAULT 0,

  -- Totals and Margins
  total_cost DECIMAL(14,2) DEFAULT 0,
  gross_profit DECIMAL(14,2) DEFAULT 0,
  gross_margin_percent DECIMAL(6,4) DEFAULT 0,
  net_profit DECIMAL(14,2) DEFAULT 0,
  net_margin_percent DECIMAL(6,4) DEFAULT 0,

  -- Completion
  percent_complete DECIMAL(5,2) DEFAULT 0,

  -- Audit
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, period_id)
);

-- ============================================================
-- JOB COST DETAILS
-- Cost breakdowns by cost code for drill-down
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_job_cost_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Budget
  budget_amount DECIMAL(14,2) DEFAULT 0,

  -- Actuals
  actual_amount DECIMAL(14,2) DEFAULT 0,
  committed_amount DECIMAL(14,2) DEFAULT 0,

  -- Variance
  variance_amount DECIMAL(14,2) DEFAULT 0,
  variance_percent DECIMAL(6,4) DEFAULT 0,

  -- Source breakdown
  invoice_amount DECIMAL(14,2) DEFAULT 0,
  labor_amount DECIMAL(14,2) DEFAULT 0,
  po_amount DECIMAL(14,2) DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, period_id, cost_code_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profitability_job ON v2_job_profitability_snapshots(job_id);
CREATE INDEX IF NOT EXISTS idx_profitability_period ON v2_job_profitability_snapshots(period_id);
CREATE INDEX IF NOT EXISTS idx_profitability_date ON v2_job_profitability_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_cost_details_job ON v2_job_cost_details(job_id);
CREATE INDEX IF NOT EXISTS idx_cost_details_period ON v2_job_cost_details(period_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Calculate job direct costs
CREATE OR REPLACE FUNCTION get_job_direct_costs(
  p_job_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  material_cost DECIMAL(14,2),
  labor_base DECIMAL(14,2),
  labor_burden DECIMAL(14,2),
  labor_total DECIMAL(14,2),
  subcontractor_cost DECIMAL(14,2),
  equipment_cost DECIMAL(14,2),
  other_cost DECIMAL(14,2),
  total_direct DECIMAL(14,2)
) AS $$
DECLARE
  v_material DECIMAL(14,2) := 0;
  v_labor_base DECIMAL(14,2) := 0;
  v_labor_burden DECIMAL(14,2) := 0;
  v_sub DECIMAL(14,2) := 0;
  v_equipment DECIMAL(14,2) := 0;
  v_other DECIMAL(14,2) := 0;
BEGIN
  -- Get invoice amounts by category
  SELECT
    COALESCE(SUM(CASE WHEN cc.category IN ('Materials', 'Supplies') THEN ia.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.category = 'Subcontractor' THEN ia.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.category = 'Equipment' THEN ia.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.category NOT IN ('Materials', 'Supplies', 'Subcontractor', 'Equipment', 'Labor') THEN ia.amount ELSE 0 END), 0)
  INTO v_material, v_sub, v_equipment, v_other
  FROM v2_invoice_allocations ia
  JOIN v2_invoices i ON i.id = ia.invoice_id
  LEFT JOIN v2_cost_codes cc ON cc.id = ia.cost_code_id
  WHERE ia.job_id = p_job_id
    AND i.status IN ('approved', 'in_draw', 'paid')
    AND i.deleted_at IS NULL
    AND (p_start_date IS NULL OR i.invoice_date >= p_start_date)
    AND (p_end_date IS NULL OR i.invoice_date <= p_end_date);

  -- Get labor costs from timesheets
  SELECT
    COALESCE(SUM(t.base_cost), 0),
    COALESCE(SUM(t.burden_amount), 0)
  INTO v_labor_base, v_labor_burden
  FROM v2_timesheets t
  WHERE t.job_id = p_job_id
    AND t.status = 'approved'
    AND t.deleted_at IS NULL
    AND (p_start_date IS NULL OR t.work_date >= p_start_date)
    AND (p_end_date IS NULL OR t.work_date <= p_end_date);

  RETURN QUERY SELECT
    v_material,
    v_labor_base,
    v_labor_burden,
    v_labor_base + v_labor_burden,
    v_sub,
    v_equipment,
    v_other,
    v_material + v_labor_base + v_labor_burden + v_sub + v_equipment + v_other;
END;
$$ LANGUAGE plpgsql;

-- Calculate job profitability
CREATE OR REPLACE FUNCTION calculate_job_profitability(p_job_id UUID)
RETURNS TABLE (
  contract_amount DECIMAL(14,2),
  change_order_total DECIMAL(14,2),
  total_contract DECIMAL(14,2),
  billed_amount DECIMAL(14,2),
  total_direct DECIMAL(14,2),
  total_overhead DECIMAL(14,2),
  total_cost DECIMAL(14,2),
  gross_profit DECIMAL(14,2),
  gross_margin DECIMAL(6,4),
  net_profit DECIMAL(14,2),
  net_margin DECIMAL(6,4),
  percent_complete DECIMAL(5,2)
) AS $$
DECLARE
  v_contract DECIMAL(14,2);
  v_co_total DECIMAL(14,2) := 0;
  v_billed DECIMAL(14,2) := 0;
  v_direct DECIMAL(14,2) := 0;
  v_overhead DECIMAL(14,2) := 0;
  v_total_cost DECIMAL(14,2);
  v_gross DECIMAL(14,2);
  v_net DECIMAL(14,2);
BEGIN
  -- Get contract amount
  SELECT COALESCE(j.contract_amount, 0) INTO v_contract
  FROM v2_jobs j WHERE j.id = p_job_id;

  -- Get change order total
  SELECT COALESCE(SUM(co.amount), 0) INTO v_co_total
  FROM v2_change_orders co
  WHERE co.job_id = p_job_id
    AND co.status = 'approved'
    AND co.deleted_at IS NULL;

  -- Get billed amount from draws
  SELECT COALESCE(SUM(d.total_amount), 0) INTO v_billed
  FROM v2_draws d
  WHERE d.job_id = p_job_id
    AND d.status IN ('submitted', 'funded');

  -- Get direct costs
  SELECT total_direct INTO v_direct
  FROM get_job_direct_costs(p_job_id);

  -- Get allocated overhead
  SELECT COALESCE(SUM(joa.allocated_overhead), 0) INTO v_overhead
  FROM v2_job_overhead_allocations joa
  WHERE joa.job_id = p_job_id AND joa.is_final = TRUE;

  -- Calculate totals
  v_total_cost := v_direct + v_overhead;
  v_gross := (v_contract + v_co_total) - v_direct;
  v_net := (v_contract + v_co_total) - v_total_cost;

  RETURN QUERY SELECT
    v_contract,
    v_co_total,
    v_contract + v_co_total,
    v_billed,
    v_direct,
    v_overhead,
    v_total_cost,
    v_gross,
    CASE WHEN (v_contract + v_co_total) > 0 THEN ROUND(v_gross / (v_contract + v_co_total), 4) ELSE 0 END,
    v_net,
    CASE WHEN (v_contract + v_co_total) > 0 THEN ROUND(v_net / (v_contract + v_co_total), 4) ELSE 0 END,
    CASE WHEN (v_contract + v_co_total) > 0 THEN ROUND((v_billed / (v_contract + v_co_total)) * 100, 2) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- Create profitability snapshot for a job in a period
CREATE OR REPLACE FUNCTION create_profitability_snapshot(
  p_job_id UUID,
  p_period_id UUID
)
RETURNS UUID AS $$
DECLARE
  period_rec RECORD;
  direct_rec RECORD;
  profit_rec RECORD;
  snapshot_id UUID;
BEGIN
  -- Get period dates
  SELECT * INTO period_rec FROM v2_financial_periods WHERE id = p_period_id;

  -- Get direct costs for period
  SELECT * INTO direct_rec FROM get_job_direct_costs(p_job_id, period_rec.start_date, period_rec.end_date);

  -- Get overall profitability
  SELECT * INTO profit_rec FROM calculate_job_profitability(p_job_id);

  -- Get allocated overhead for this period
  DECLARE
    v_period_overhead DECIMAL(14,2) := 0;
  BEGIN
    SELECT COALESCE(allocated_overhead, 0) INTO v_period_overhead
    FROM v2_job_overhead_allocations
    WHERE job_id = p_job_id AND period_id = p_period_id AND is_final = TRUE;

    INSERT INTO v2_job_profitability_snapshots (
      job_id, period_id, contract_amount, change_order_amount, total_contract,
      billed_to_date, material_cost, labor_base_cost, labor_burden_cost,
      subcontractor_cost, equipment_cost, other_direct_cost, total_direct_cost,
      allocated_overhead, total_indirect_cost, total_cost,
      gross_profit, gross_margin_percent, net_profit, net_margin_percent,
      percent_complete, snapshot_date
    ) VALUES (
      p_job_id, p_period_id, profit_rec.contract_amount, profit_rec.change_order_total,
      profit_rec.total_contract, profit_rec.billed_amount,
      direct_rec.material_cost, direct_rec.labor_base, direct_rec.labor_burden,
      direct_rec.subcontractor_cost, direct_rec.equipment_cost, direct_rec.other_cost,
      direct_rec.total_direct, v_period_overhead, v_period_overhead,
      direct_rec.total_direct + v_period_overhead,
      profit_rec.gross_profit, profit_rec.gross_margin,
      profit_rec.net_profit, profit_rec.net_margin,
      profit_rec.percent_complete, period_rec.end_date
    )
    ON CONFLICT (job_id, period_id)
    DO UPDATE SET
      contract_amount = EXCLUDED.contract_amount,
      change_order_amount = EXCLUDED.change_order_amount,
      total_contract = EXCLUDED.total_contract,
      billed_to_date = EXCLUDED.billed_to_date,
      material_cost = EXCLUDED.material_cost,
      labor_base_cost = EXCLUDED.labor_base_cost,
      labor_burden_cost = EXCLUDED.labor_burden_cost,
      subcontractor_cost = EXCLUDED.subcontractor_cost,
      equipment_cost = EXCLUDED.equipment_cost,
      other_direct_cost = EXCLUDED.other_direct_cost,
      total_direct_cost = EXCLUDED.total_direct_cost,
      allocated_overhead = EXCLUDED.allocated_overhead,
      total_indirect_cost = EXCLUDED.total_indirect_cost,
      total_cost = EXCLUDED.total_cost,
      gross_profit = EXCLUDED.gross_profit,
      gross_margin_percent = EXCLUDED.gross_margin_percent,
      net_profit = EXCLUDED.net_profit,
      net_margin_percent = EXCLUDED.net_margin_percent,
      percent_complete = EXCLUDED.percent_complete,
      snapshot_date = EXCLUDED.snapshot_date
    RETURNING id INTO snapshot_id;

    RETURN snapshot_id;
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

-- Current job profitability summary
CREATE OR REPLACE VIEW v2_job_profitability_current AS
SELECT
  j.id as job_id,
  j.name as job_name,
  j.status as job_status,
  p.*
FROM v2_jobs j
CROSS JOIN LATERAL calculate_job_profitability(j.id) p
WHERE j.status = 'active' AND j.deleted_at IS NULL;

-- Job ranking by profitability
CREATE OR REPLACE VIEW v2_job_profitability_ranking AS
SELECT
  job_id,
  job_name,
  total_contract,
  total_cost,
  gross_profit,
  gross_margin,
  net_profit,
  net_margin,
  RANK() OVER (ORDER BY net_margin DESC) as margin_rank,
  RANK() OVER (ORDER BY net_profit DESC) as profit_rank
FROM v2_job_profitability_current
WHERE total_contract > 0;

-- Budget vs Actual by Cost Code
CREATE OR REPLACE VIEW v2_job_budget_vs_actual AS
SELECT
  bl.job_id,
  j.name as job_name,
  cc.id as cost_code_id,
  cc.code as cost_code,
  cc.name as cost_code_name,
  cc.category,
  COALESCE(bl.budgeted_amount, 0) as budget,
  COALESCE(bl.committed_amount, 0) as committed,
  COALESCE(bl.billed_amount, 0) + COALESCE(
    (SELECT SUM(t.total_cost) FROM v2_timesheets t
     WHERE t.job_id = bl.job_id AND t.cost_code_id = cc.id
     AND t.status = 'approved' AND t.deleted_at IS NULL), 0
  ) as actual,
  COALESCE(bl.budgeted_amount, 0) - (
    COALESCE(bl.billed_amount, 0) + COALESCE(
      (SELECT SUM(t.total_cost) FROM v2_timesheets t
       WHERE t.job_id = bl.job_id AND t.cost_code_id = cc.id
       AND t.status = 'approved' AND t.deleted_at IS NULL), 0
    )
  ) as variance,
  CASE WHEN COALESCE(bl.budgeted_amount, 0) > 0 THEN
    ROUND(
      ((COALESCE(bl.billed_amount, 0) + COALESCE(
        (SELECT SUM(t.total_cost) FROM v2_timesheets t
         WHERE t.job_id = bl.job_id AND t.cost_code_id = cc.id
         AND t.status = 'approved' AND t.deleted_at IS NULL), 0
      )) / bl.budgeted_amount) * 100, 2
    )
  ELSE 0 END as percent_used
FROM v2_budget_lines bl
JOIN v2_jobs j ON j.id = bl.job_id
JOIN v2_cost_codes cc ON cc.id = bl.cost_code_id
WHERE j.status = 'active' AND j.deleted_at IS NULL;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_job_profitability_snapshots IS 'Monthly snapshots of job profitability for trend analysis';
COMMENT ON TABLE v2_job_cost_details IS 'Detailed cost breakdown by cost code per period';
COMMENT ON FUNCTION calculate_job_profitability(UUID) IS 'Calculate real-time job profitability with all costs';
COMMENT ON FUNCTION create_profitability_snapshot(UUID, UUID) IS 'Create or update profitability snapshot for a job in a period';
