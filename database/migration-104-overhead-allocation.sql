-- Migration 104: Overhead Allocation Engine
-- Calculate and allocate overhead to jobs using % of Labor Hours

-- ============================================================
-- COST POOLS
-- Groups expenses into overhead categories for allocation
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_cost_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL UNIQUE,              -- "Office Overhead", "Fleet", "Equipment"
  description TEXT,

  -- Pool configuration
  allocation_method TEXT DEFAULT 'labor_hours',  -- labor_hours (only method for now)
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COST POOL CATEGORIES
-- Links expense categories to cost pools
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_cost_pool_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  cost_pool_id UUID NOT NULL REFERENCES v2_cost_pools(id) ON DELETE CASCADE,
  expense_category_id UUID NOT NULL REFERENCES v2_expense_categories(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(cost_pool_id, expense_category_id)
);

-- ============================================================
-- OVERHEAD RATES
-- Calculated overhead rates per period
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_overhead_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),
  cost_pool_id UUID REFERENCES v2_cost_pools(id),  -- NULL = total overhead

  -- Period data
  total_overhead DECIMAL(14,2) NOT NULL DEFAULT 0,  -- Total expenses in pool
  total_labor_hours DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_labor_cost DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Calculated rate
  overhead_rate_per_hour DECIMAL(8,4),              -- overhead / hours
  overhead_rate_percent DECIMAL(6,4),               -- overhead / labor cost

  -- Status
  is_final BOOLEAN DEFAULT FALSE,                   -- True when period closed
  calculated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(period_id, cost_pool_id)
);

-- ============================================================
-- JOB OVERHEAD ALLOCATIONS
-- Overhead allocated to each job per period
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_job_overhead_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id),
  cost_pool_id UUID REFERENCES v2_cost_pools(id),  -- NULL = total

  -- Job's share
  job_labor_hours DECIMAL(12,2) NOT NULL DEFAULT 0,
  job_labor_cost DECIMAL(14,2) NOT NULL DEFAULT 0,
  hours_percentage DECIMAL(8,6),                    -- Job's % of total hours

  -- Allocated overhead
  allocated_overhead DECIMAL(14,2) NOT NULL DEFAULT 0,

  -- Status
  is_final BOOLEAN DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, period_id, cost_pool_id)
);

-- ============================================================
-- COMPANY SETTINGS FOR OVERHEAD
-- ============================================================

INSERT INTO v2_company_settings (key, value, value_type, description) VALUES
  ('overhead_allocation_method', 'labor_hours', 'string', 'Method for allocating overhead (labor_hours)'),
  ('overhead_use_rolling_average', 'true', 'boolean', 'Use 12-month rolling average for rate'),
  ('overhead_rolling_months', '12', 'number', 'Number of months for rolling average'),
  ('overhead_include_ot', 'true', 'boolean', 'Include overtime hours in allocation'),
  ('overhead_auto_allocate', 'true', 'boolean', 'Auto-allocate when period closes')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED DEFAULT COST POOLS
-- ============================================================

INSERT INTO v2_cost_pools (name, description) VALUES
  ('Office Overhead', 'General office and administrative expenses'),
  ('Fleet Overhead', 'Vehicle and transportation expenses'),
  ('Equipment Overhead', 'Tools, equipment, and machinery expenses'),
  ('Insurance Overhead', 'Insurance premiums and related costs')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cost_pool_categories_pool ON v2_cost_pool_categories(cost_pool_id);
CREATE INDEX IF NOT EXISTS idx_cost_pool_categories_expense ON v2_cost_pool_categories(expense_category_id);
CREATE INDEX IF NOT EXISTS idx_overhead_rates_period ON v2_overhead_rates(period_id);
CREATE INDEX IF NOT EXISTS idx_overhead_rates_pool ON v2_overhead_rates(cost_pool_id);
CREATE INDEX IF NOT EXISTS idx_job_overhead_job ON v2_job_overhead_allocations(job_id);
CREATE INDEX IF NOT EXISTS idx_job_overhead_period ON v2_job_overhead_allocations(period_id);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Calculate overhead rate for a period
CREATE OR REPLACE FUNCTION calculate_period_overhead_rate(p_period_id UUID)
RETURNS TABLE (
  total_overhead DECIMAL(14,2),
  total_labor_hours DECIMAL(12,2),
  total_labor_cost DECIMAL(14,2),
  rate_per_hour DECIMAL(8,4),
  rate_percent DECIMAL(6,4)
) AS $$
DECLARE
  period_start DATE;
  period_end DATE;
  v_total_overhead DECIMAL(14,2);
  v_total_hours DECIMAL(12,2);
  v_total_labor_cost DECIMAL(14,2);
BEGIN
  -- Get period dates
  SELECT start_date, end_date INTO period_start, period_end
  FROM v2_financial_periods
  WHERE id = p_period_id;

  -- Get total overhead from expenses in period
  SELECT COALESCE(SUM(e.amount), 0) INTO v_total_overhead
  FROM v2_expenses e
  WHERE e.expense_date >= period_start
    AND e.expense_date <= period_end
    AND e.deleted_at IS NULL
    AND e.category_id IN (
      SELECT expense_category_id FROM v2_cost_pool_categories
    );

  -- Get total labor hours and cost from approved timesheets
  SELECT
    COALESCE(SUM(t.hours + COALESCE(t.overtime_hours, 0)), 0),
    COALESCE(SUM(t.total_cost), 0)
  INTO v_total_hours, v_total_labor_cost
  FROM v2_timesheets t
  WHERE t.work_date >= period_start
    AND t.work_date <= period_end
    AND t.status = 'approved'
    AND t.deleted_at IS NULL;

  RETURN QUERY SELECT
    v_total_overhead,
    v_total_hours,
    v_total_labor_cost,
    CASE WHEN v_total_hours > 0 THEN ROUND(v_total_overhead / v_total_hours, 4) ELSE 0 END,
    CASE WHEN v_total_labor_cost > 0 THEN ROUND(v_total_overhead / v_total_labor_cost, 4) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- Calculate rolling average overhead rate
CREATE OR REPLACE FUNCTION calculate_rolling_overhead_rate(p_months INTEGER DEFAULT 12)
RETURNS TABLE (
  avg_rate_per_hour DECIMAL(8,4),
  avg_rate_percent DECIMAL(6,4),
  periods_included INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROUND(AVG(overhead_rate_per_hour), 4)::DECIMAL(8,4),
    ROUND(AVG(overhead_rate_percent), 4)::DECIMAL(6,4),
    COUNT(*)::INTEGER
  FROM v2_overhead_rates
  WHERE is_final = TRUE
    AND cost_pool_id IS NULL
    AND calculated_at >= NOW() - (p_months || ' months')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Calculate job overhead allocation for a period
CREATE OR REPLACE FUNCTION allocate_job_overhead(
  p_job_id UUID,
  p_period_id UUID
)
RETURNS TABLE (
  job_hours DECIMAL(12,2),
  total_hours DECIMAL(12,2),
  hours_percentage DECIMAL(8,6),
  allocated_amount DECIMAL(14,2)
) AS $$
DECLARE
  period_start DATE;
  period_end DATE;
  v_job_hours DECIMAL(12,2);
  v_total_hours DECIMAL(12,2);
  v_total_overhead DECIMAL(14,2);
BEGIN
  -- Get period dates
  SELECT start_date, end_date INTO period_start, period_end
  FROM v2_financial_periods
  WHERE id = p_period_id;

  -- Get job's labor hours
  SELECT COALESCE(SUM(t.hours + COALESCE(t.overtime_hours, 0)), 0)
  INTO v_job_hours
  FROM v2_timesheets t
  WHERE t.job_id = p_job_id
    AND t.work_date >= period_start
    AND t.work_date <= period_end
    AND t.status = 'approved'
    AND t.deleted_at IS NULL;

  -- Get total labor hours
  SELECT COALESCE(SUM(t.hours + COALESCE(t.overtime_hours, 0)), 0)
  INTO v_total_hours
  FROM v2_timesheets t
  WHERE t.work_date >= period_start
    AND t.work_date <= period_end
    AND t.status = 'approved'
    AND t.deleted_at IS NULL;

  -- Get total overhead
  SELECT COALESCE(SUM(e.amount), 0) INTO v_total_overhead
  FROM v2_expenses e
  WHERE e.expense_date >= period_start
    AND e.expense_date <= period_end
    AND e.deleted_at IS NULL
    AND e.category_id IN (
      SELECT expense_category_id FROM v2_cost_pool_categories
    );

  RETURN QUERY SELECT
    v_job_hours,
    v_total_hours,
    CASE WHEN v_total_hours > 0 THEN ROUND(v_job_hours / v_total_hours, 6) ELSE 0 END,
    CASE WHEN v_total_hours > 0 THEN ROUND(v_total_overhead * (v_job_hours / v_total_hours), 2) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- Run full overhead allocation for a closed period
CREATE OR REPLACE FUNCTION run_period_allocation(p_period_id UUID)
RETURNS INTEGER AS $$
DECLARE
  period_rec RECORD;
  job_rec RECORD;
  rate_rec RECORD;
  allocation_count INTEGER := 0;
BEGIN
  -- Verify period is closed
  SELECT * INTO period_rec FROM v2_financial_periods WHERE id = p_period_id;
  IF period_rec.status != 'closed' THEN
    RAISE EXCEPTION 'Period must be closed before allocation';
  END IF;

  -- Calculate and store overall overhead rate
  SELECT * INTO rate_rec FROM calculate_period_overhead_rate(p_period_id);

  INSERT INTO v2_overhead_rates (
    period_id, cost_pool_id, total_overhead, total_labor_hours,
    total_labor_cost, overhead_rate_per_hour, overhead_rate_percent, is_final
  ) VALUES (
    p_period_id, NULL, rate_rec.total_overhead, rate_rec.total_labor_hours,
    rate_rec.total_labor_cost, rate_rec.rate_per_hour, rate_rec.rate_percent, TRUE
  )
  ON CONFLICT (period_id, cost_pool_id)
  DO UPDATE SET
    total_overhead = rate_rec.total_overhead,
    total_labor_hours = rate_rec.total_labor_hours,
    total_labor_cost = rate_rec.total_labor_cost,
    overhead_rate_per_hour = rate_rec.rate_per_hour,
    overhead_rate_percent = rate_rec.rate_percent,
    is_final = TRUE,
    updated_at = NOW();

  -- Allocate to each active job with labor in period
  FOR job_rec IN
    SELECT DISTINCT t.job_id
    FROM v2_timesheets t
    WHERE t.work_date >= period_rec.start_date
      AND t.work_date <= period_rec.end_date
      AND t.status = 'approved'
      AND t.deleted_at IS NULL
  LOOP
    DECLARE
      alloc_rec RECORD;
    BEGIN
      SELECT * INTO alloc_rec FROM allocate_job_overhead(job_rec.job_id, p_period_id);

      INSERT INTO v2_job_overhead_allocations (
        job_id, period_id, cost_pool_id, job_labor_hours,
        hours_percentage, allocated_overhead, is_final
      ) VALUES (
        job_rec.job_id, p_period_id, NULL, alloc_rec.job_hours,
        alloc_rec.hours_percentage, alloc_rec.allocated_amount, TRUE
      )
      ON CONFLICT (job_id, period_id, cost_pool_id)
      DO UPDATE SET
        job_labor_hours = alloc_rec.job_hours,
        hours_percentage = alloc_rec.hours_percentage,
        allocated_overhead = alloc_rec.allocated_amount,
        is_final = TRUE;

      allocation_count := allocation_count + 1;
    END;
  END LOOP;

  RETURN allocation_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

-- Current overhead rate with rolling average
CREATE OR REPLACE VIEW v2_current_overhead_rate AS
WITH latest_period AS (
  SELECT id, name, start_date, end_date
  FROM v2_financial_periods
  WHERE status = 'closed'
  ORDER BY end_date DESC
  LIMIT 1
),
latest_rate AS (
  SELECT total_overhead, total_labor_hours, overhead_rate_per_hour, overhead_rate_percent
  FROM v2_overhead_rates
  WHERE period_id = (SELECT id FROM latest_period)
    AND cost_pool_id IS NULL
    AND is_final = TRUE
),
rolling_rate AS (
  SELECT * FROM calculate_rolling_overhead_rate(12)
)
SELECT
  (SELECT id FROM latest_period) as period_id,
  (SELECT name FROM latest_period) as period_name,
  COALESCE((SELECT total_overhead FROM latest_rate), 0) as current_overhead,
  COALESCE((SELECT total_labor_hours FROM latest_rate), 0) as current_labor_hours,
  COALESCE((SELECT overhead_rate_per_hour FROM latest_rate), 0) as current_rate_per_hour,
  COALESCE((SELECT overhead_rate_percent FROM latest_rate), 0) as current_rate_percent,
  (SELECT avg_rate_per_hour FROM rolling_rate) as rolling_avg_rate_per_hour,
  (SELECT avg_rate_percent FROM rolling_rate) as rolling_avg_rate_percent,
  (SELECT periods_included FROM rolling_rate) as rolling_periods_count;

-- Job overhead summary
CREATE OR REPLACE VIEW v2_job_overhead_summary AS
SELECT
  j.id as job_id,
  j.name as job_name,
  COALESCE(SUM(joa.job_labor_hours), 0) as total_labor_hours,
  COALESCE(SUM(joa.allocated_overhead), 0) as total_allocated_overhead,
  COUNT(DISTINCT joa.period_id) as periods_count
FROM v2_jobs j
LEFT JOIN v2_job_overhead_allocations joa ON joa.job_id = j.id AND joa.is_final = TRUE
WHERE j.status = 'active'
GROUP BY j.id, j.name;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_cost_pools IS 'Groups of expense categories for overhead allocation';
COMMENT ON TABLE v2_overhead_rates IS 'Calculated overhead rates per financial period';
COMMENT ON TABLE v2_job_overhead_allocations IS 'Overhead allocated to each job per period';
COMMENT ON FUNCTION calculate_period_overhead_rate(UUID) IS 'Calculate overhead rate for a closed period';
COMMENT ON FUNCTION calculate_rolling_overhead_rate(INTEGER) IS 'Calculate rolling average overhead rate';
COMMENT ON FUNCTION run_period_allocation(UUID) IS 'Run full overhead allocation when period closes';
