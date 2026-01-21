-- Migration 107: Company P&L Dashboard
-- Aggregate financials across all jobs for company-wide P&L

-- ============================================================
-- P&L SNAPSHOTS
-- Monthly P&L snapshots for company-wide reporting
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_pnl_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),

  -- Revenue
  contract_revenue DECIMAL(14,2) DEFAULT 0,
  change_order_revenue DECIMAL(14,2) DEFAULT 0,
  total_revenue DECIMAL(14,2) DEFAULT 0,

  -- Cost of Goods Sold (Direct Costs)
  material_cost DECIMAL(14,2) DEFAULT 0,
  labor_cost DECIMAL(14,2) DEFAULT 0,
  subcontractor_cost DECIMAL(14,2) DEFAULT 0,
  equipment_cost DECIMAL(14,2) DEFAULT 0,
  other_direct_cost DECIMAL(14,2) DEFAULT 0,
  total_cogs DECIMAL(14,2) DEFAULT 0,

  -- Gross Profit
  gross_profit DECIMAL(14,2) DEFAULT 0,
  gross_margin DECIMAL(6,4) DEFAULT 0,

  -- Operating Expenses (Overhead)
  overhead_expense DECIMAL(14,2) DEFAULT 0,
  admin_expense DECIMAL(14,2) DEFAULT 0,
  insurance_expense DECIMAL(14,2) DEFAULT 0,
  other_expense DECIMAL(14,2) DEFAULT 0,
  total_opex DECIMAL(14,2) DEFAULT 0,

  -- Operating Income
  operating_income DECIMAL(14,2) DEFAULT 0,
  operating_margin DECIMAL(6,4) DEFAULT 0,

  -- Non-Operating
  interest_expense DECIMAL(14,2) DEFAULT 0,
  other_income DECIMAL(14,2) DEFAULT 0,

  -- Net Income
  net_income DECIMAL(14,2) DEFAULT 0,
  net_margin DECIMAL(6,4) DEFAULT 0,

  -- Metrics
  active_jobs INTEGER DEFAULT 0,
  completed_jobs INTEGER DEFAULT 0,
  total_backlog DECIMAL(14,2) DEFAULT 0,

  -- Audit
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,

  UNIQUE(period_id)
);

-- ============================================================
-- REVENUE CATEGORIES
-- Track revenue by category/type
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_revenue_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
INSERT INTO v2_revenue_categories (name, description, display_order) VALUES
  ('Construction', 'Primary construction revenue', 1),
  ('Change Orders', 'Approved change order revenue', 2),
  ('Design/Engineering', 'Design and engineering services', 3),
  ('Consulting', 'Consulting and advisory services', 4),
  ('Other', 'Miscellaneous revenue', 5)
ON CONFLICT DO NOTHING;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pnl_period ON v2_pnl_snapshots(period_id);
CREATE INDEX IF NOT EXISTS idx_pnl_date ON v2_pnl_snapshots(snapshot_date);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Calculate company-wide P&L for a period
CREATE OR REPLACE FUNCTION calculate_company_pnl(
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  contract_revenue DECIMAL(14,2),
  change_order_revenue DECIMAL(14,2),
  total_revenue DECIMAL(14,2),
  material_cost DECIMAL(14,2),
  labor_cost DECIMAL(14,2),
  subcontractor_cost DECIMAL(14,2),
  equipment_cost DECIMAL(14,2),
  other_direct_cost DECIMAL(14,2),
  total_cogs DECIMAL(14,2),
  gross_profit DECIMAL(14,2),
  gross_margin DECIMAL(6,4),
  overhead_expense DECIMAL(14,2),
  operating_income DECIMAL(14,2),
  operating_margin DECIMAL(6,4),
  net_income DECIMAL(14,2),
  net_margin DECIMAL(6,4),
  active_jobs INTEGER,
  completed_jobs INTEGER,
  total_backlog DECIMAL(14,2)
) AS $$
DECLARE
  v_contract_rev DECIMAL(14,2) := 0;
  v_co_rev DECIMAL(14,2) := 0;
  v_total_rev DECIMAL(14,2);
  v_material DECIMAL(14,2) := 0;
  v_labor DECIMAL(14,2) := 0;
  v_sub DECIMAL(14,2) := 0;
  v_equipment DECIMAL(14,2) := 0;
  v_other DECIMAL(14,2) := 0;
  v_cogs DECIMAL(14,2);
  v_gross DECIMAL(14,2);
  v_gross_margin DECIMAL(6,4);
  v_overhead DECIMAL(14,2) := 0;
  v_opex DECIMAL(14,2);
  v_operating DECIMAL(14,2);
  v_op_margin DECIMAL(6,4);
  v_net DECIMAL(14,2);
  v_net_margin DECIMAL(6,4);
  v_active INTEGER := 0;
  v_completed INTEGER := 0;
  v_backlog DECIMAL(14,2) := 0;
BEGIN
  -- Get billed revenue from draws in period
  SELECT COALESCE(SUM(d.total_amount), 0) INTO v_contract_rev
  FROM v2_draws d
  JOIN v2_jobs j ON j.id = d.job_id
  WHERE d.status IN ('submitted', 'funded')
    AND d.submitted_at >= p_start_date
    AND d.submitted_at <= p_end_date + INTERVAL '1 day';

  -- Get change order revenue approved in period
  SELECT COALESCE(SUM(co.amount), 0) INTO v_co_rev
  FROM v2_change_orders co
  WHERE co.status = 'approved'
    AND co.approved_at >= p_start_date
    AND co.approved_at <= p_end_date + INTERVAL '1 day'
    AND co.deleted_at IS NULL;

  v_total_rev := v_contract_rev + v_co_rev;

  -- Get direct costs from invoices in period
  SELECT
    COALESCE(SUM(CASE WHEN cc.category IN ('Materials', 'Supplies') THEN ia.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.category = 'Subcontractor' THEN ia.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.category = 'Equipment' THEN ia.amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN cc.category NOT IN ('Materials', 'Supplies', 'Subcontractor', 'Equipment', 'Labor') THEN ia.amount ELSE 0 END), 0)
  INTO v_material, v_sub, v_equipment, v_other
  FROM v2_invoice_allocations ia
  JOIN v2_invoices i ON i.id = ia.invoice_id
  LEFT JOIN v2_cost_codes cc ON cc.id = ia.cost_code_id
  WHERE i.status IN ('approved', 'in_draw', 'paid')
    AND i.invoice_date >= p_start_date
    AND i.invoice_date <= p_end_date
    AND i.deleted_at IS NULL;

  -- Get labor costs from timesheets in period
  SELECT COALESCE(SUM(t.total_cost), 0) INTO v_labor
  FROM v2_timesheets t
  WHERE t.status = 'approved'
    AND t.work_date >= p_start_date
    AND t.work_date <= p_end_date
    AND t.deleted_at IS NULL;

  v_cogs := v_material + v_labor + v_sub + v_equipment + v_other;
  v_gross := v_total_rev - v_cogs;
  v_gross_margin := CASE WHEN v_total_rev > 0 THEN ROUND(v_gross / v_total_rev, 4) ELSE 0 END;

  -- Get overhead expenses from expense tracking
  SELECT COALESCE(SUM(e.amount), 0) INTO v_overhead
  FROM v2_expenses e
  WHERE e.expense_type = 'indirect'
    AND e.expense_date >= p_start_date
    AND e.expense_date <= p_end_date
    AND e.deleted_at IS NULL;

  v_opex := v_overhead;
  v_operating := v_gross - v_opex;
  v_op_margin := CASE WHEN v_total_rev > 0 THEN ROUND(v_operating / v_total_rev, 4) ELSE 0 END;

  v_net := v_operating; -- Simplified for now
  v_net_margin := CASE WHEN v_total_rev > 0 THEN ROUND(v_net / v_total_rev, 4) ELSE 0 END;

  -- Get job counts
  SELECT COUNT(*) INTO v_active
  FROM v2_jobs WHERE status = 'active' AND deleted_at IS NULL;

  SELECT COUNT(*) INTO v_completed
  FROM v2_jobs WHERE status = 'completed'
    AND updated_at >= p_start_date AND updated_at <= p_end_date + INTERVAL '1 day';

  -- Calculate backlog (contract value - billed)
  SELECT COALESCE(SUM(j.contract_amount - COALESCE(
    (SELECT SUM(d.total_amount) FROM v2_draws d WHERE d.job_id = j.id AND d.status IN ('submitted', 'funded')), 0
  )), 0) INTO v_backlog
  FROM v2_jobs j WHERE j.status = 'active' AND j.deleted_at IS NULL;

  RETURN QUERY SELECT
    v_contract_rev, v_co_rev, v_total_rev,
    v_material, v_labor, v_sub, v_equipment, v_other, v_cogs,
    v_gross, v_gross_margin,
    v_overhead, v_operating, v_op_margin,
    v_net, v_net_margin,
    v_active, v_completed, v_backlog;
END;
$$ LANGUAGE plpgsql;

-- Create P&L snapshot for a period
CREATE OR REPLACE FUNCTION create_pnl_snapshot(
  p_period_id UUID,
  p_created_by TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  period_rec RECORD;
  pnl_rec RECORD;
  snapshot_id UUID;
BEGIN
  -- Get period dates
  SELECT * INTO period_rec FROM v2_financial_periods WHERE id = p_period_id;

  -- Calculate P&L
  SELECT * INTO pnl_rec FROM calculate_company_pnl(period_rec.start_date, period_rec.end_date);

  INSERT INTO v2_pnl_snapshots (
    period_id,
    contract_revenue, change_order_revenue, total_revenue,
    material_cost, labor_cost, subcontractor_cost, equipment_cost, other_direct_cost, total_cogs,
    gross_profit, gross_margin,
    overhead_expense, total_opex,
    operating_income, operating_margin,
    net_income, net_margin,
    active_jobs, completed_jobs, total_backlog,
    snapshot_date, created_by
  ) VALUES (
    p_period_id,
    pnl_rec.contract_revenue, pnl_rec.change_order_revenue, pnl_rec.total_revenue,
    pnl_rec.material_cost, pnl_rec.labor_cost, pnl_rec.subcontractor_cost, pnl_rec.equipment_cost, pnl_rec.other_direct_cost, pnl_rec.total_cogs,
    pnl_rec.gross_profit, pnl_rec.gross_margin,
    pnl_rec.overhead_expense, pnl_rec.overhead_expense,
    pnl_rec.operating_income, pnl_rec.operating_margin,
    pnl_rec.net_income, pnl_rec.net_margin,
    pnl_rec.active_jobs, pnl_rec.completed_jobs, pnl_rec.total_backlog,
    period_rec.end_date, p_created_by
  )
  ON CONFLICT (period_id)
  DO UPDATE SET
    contract_revenue = EXCLUDED.contract_revenue,
    change_order_revenue = EXCLUDED.change_order_revenue,
    total_revenue = EXCLUDED.total_revenue,
    material_cost = EXCLUDED.material_cost,
    labor_cost = EXCLUDED.labor_cost,
    subcontractor_cost = EXCLUDED.subcontractor_cost,
    equipment_cost = EXCLUDED.equipment_cost,
    other_direct_cost = EXCLUDED.other_direct_cost,
    total_cogs = EXCLUDED.total_cogs,
    gross_profit = EXCLUDED.gross_profit,
    gross_margin = EXCLUDED.gross_margin,
    overhead_expense = EXCLUDED.overhead_expense,
    total_opex = EXCLUDED.total_opex,
    operating_income = EXCLUDED.operating_income,
    operating_margin = EXCLUDED.operating_margin,
    net_income = EXCLUDED.net_income,
    net_margin = EXCLUDED.net_margin,
    active_jobs = EXCLUDED.active_jobs,
    completed_jobs = EXCLUDED.completed_jobs,
    total_backlog = EXCLUDED.total_backlog,
    snapshot_date = EXCLUDED.snapshot_date
  RETURNING id INTO snapshot_id;

  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Get YTD P&L
CREATE OR REPLACE FUNCTION get_ytd_pnl(p_year INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
RETURNS TABLE (
  total_revenue DECIMAL(14,2),
  total_cogs DECIMAL(14,2),
  gross_profit DECIMAL(14,2),
  gross_margin DECIMAL(6,4),
  total_opex DECIMAL(14,2),
  operating_income DECIMAL(14,2),
  operating_margin DECIMAL(6,4),
  net_income DECIMAL(14,2),
  net_margin DECIMAL(6,4)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(s.total_revenue), 0) as total_revenue,
    COALESCE(SUM(s.total_cogs), 0) as total_cogs,
    COALESCE(SUM(s.gross_profit), 0) as gross_profit,
    CASE WHEN SUM(s.total_revenue) > 0 THEN ROUND(SUM(s.gross_profit) / SUM(s.total_revenue), 4) ELSE 0 END as gross_margin,
    COALESCE(SUM(s.total_opex), 0) as total_opex,
    COALESCE(SUM(s.operating_income), 0) as operating_income,
    CASE WHEN SUM(s.total_revenue) > 0 THEN ROUND(SUM(s.operating_income) / SUM(s.total_revenue), 4) ELSE 0 END as operating_margin,
    COALESCE(SUM(s.net_income), 0) as net_income,
    CASE WHEN SUM(s.total_revenue) > 0 THEN ROUND(SUM(s.net_income) / SUM(s.total_revenue), 4) ELSE 0 END as net_margin
  FROM v2_pnl_snapshots s
  JOIN v2_financial_periods p ON p.id = s.period_id
  WHERE EXTRACT(YEAR FROM p.start_date) = p_year;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

-- Monthly P&L trend
CREATE OR REPLACE VIEW v2_pnl_monthly_trend AS
SELECT
  p.id as period_id,
  p.name as period_name,
  p.start_date,
  p.end_date,
  s.total_revenue,
  s.total_cogs,
  s.gross_profit,
  s.gross_margin,
  s.total_opex,
  s.operating_income,
  s.operating_margin,
  s.net_income,
  s.net_margin,
  s.active_jobs,
  s.total_backlog
FROM v2_financial_periods p
LEFT JOIN v2_pnl_snapshots s ON s.period_id = p.id
WHERE p.status = 'closed'
ORDER BY p.start_date DESC;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_pnl_snapshots IS 'Monthly P&L snapshots for company-wide financial reporting';
COMMENT ON FUNCTION calculate_company_pnl(DATE, DATE) IS 'Calculate P&L for a date range';
COMMENT ON FUNCTION create_pnl_snapshot(UUID, TEXT) IS 'Create or update P&L snapshot for a period';
