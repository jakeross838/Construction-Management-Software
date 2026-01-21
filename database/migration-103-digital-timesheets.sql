-- Migration 103: Digital Timesheets
-- Replace paper timesheets with digital entry and approval

-- ============================================================
-- TIMESHEETS
-- Daily time entries by employee
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  employee_id UUID NOT NULL REFERENCES v2_employees(id),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),

  -- Time entry details
  work_date DATE NOT NULL,
  hours DECIMAL(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  overtime_hours DECIMAL(5,2) DEFAULT 0 CHECK (overtime_hours >= 0),

  -- Classification
  work_type TEXT DEFAULT 'regular',      -- regular, overtime, holiday, pto
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Description
  description TEXT,
  notes TEXT,

  -- Approval workflow
  status TEXT DEFAULT 'draft',            -- draft, submitted, approved, rejected
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejection_reason TEXT,

  -- Period tracking
  period_id UUID REFERENCES v2_financial_periods(id),

  -- Calculated fields (updated by trigger)
  base_cost DECIMAL(12,2),               -- hours * pay_rate
  burden_amount DECIMAL(12,2),           -- base_cost * burden_rate
  total_cost DECIMAL(12,2),              -- base_cost + burden_amount

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TIMESHEET BATCHES
-- Group timesheets for bulk submission
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_timesheet_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  employee_id UUID NOT NULL REFERENCES v2_employees(id),

  -- Batch period
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,

  -- Status
  status TEXT DEFAULT 'draft',            -- draft, submitted, approved, rejected, partial
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,

  -- Totals (calculated)
  total_hours DECIMAL(6,2) DEFAULT 0,
  total_overtime DECIMAL(6,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(employee_id, week_start)
);

-- ============================================================
-- TIMESHEET SETTINGS
-- Configuration for timesheet behavior
-- ============================================================

INSERT INTO v2_company_settings (key, value, value_type, description) VALUES
  ('timesheet_submission_deadline', '3', 'number', 'Days after week end to submit timesheets'),
  ('timesheet_edit_window', '2', 'number', 'Days after submission when edits are allowed'),
  ('timesheet_max_daily_hours', '16', 'number', 'Maximum hours per day (validation)'),
  ('timesheet_overtime_threshold', '8', 'number', 'Hours after which overtime applies'),
  ('timesheet_require_job', 'true', 'boolean', 'Require job selection for all entries'),
  ('timesheet_require_cost_code', 'false', 'boolean', 'Require cost code for all entries')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- TIMESHEET ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_timesheet_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  timesheet_id UUID REFERENCES v2_timesheets(id) ON DELETE CASCADE,
  batch_id UUID REFERENCES v2_timesheet_batches(id) ON DELETE CASCADE,

  action TEXT NOT NULL,                   -- created, updated, submitted, approved, rejected
  actor TEXT,
  details JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_timesheets_employee ON v2_timesheets(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_job ON v2_timesheets(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_date ON v2_timesheets(work_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_status ON v2_timesheets(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheets_period ON v2_timesheets(period_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_timesheet_batches_employee ON v2_timesheet_batches(employee_id);
CREATE INDEX IF NOT EXISTS idx_timesheet_batches_week ON v2_timesheet_batches(week_start);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-calculate timesheet costs
CREATE OR REPLACE FUNCTION calculate_timesheet_costs()
RETURNS TRIGGER AS $$
DECLARE
  emp_pay_rate DECIMAL(10,2);
  emp_burden_rate DECIMAL(6,4);
BEGIN
  -- Get employee pay rate
  SELECT pay_rate INTO emp_pay_rate
  FROM v2_employees
  WHERE id = NEW.employee_id;

  -- Get effective burden rate
  SELECT get_employee_burden_rate(NEW.employee_id) INTO emp_burden_rate;

  -- Calculate costs
  NEW.base_cost := COALESCE(emp_pay_rate, 0) * (NEW.hours + COALESCE(NEW.overtime_hours, 0) * 1.5);
  NEW.burden_amount := NEW.base_cost * COALESCE(emp_burden_rate, 0.40);
  NEW.total_cost := NEW.base_cost + NEW.burden_amount;
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calc_timesheet_costs ON v2_timesheets;
CREATE TRIGGER calc_timesheet_costs
  BEFORE INSERT OR UPDATE ON v2_timesheets
  FOR EACH ROW
  EXECUTE FUNCTION calculate_timesheet_costs();

-- Auto-assign period to timesheet
CREATE OR REPLACE FUNCTION assign_timesheet_period()
RETURNS TRIGGER AS $$
DECLARE
  matching_period_id UUID;
BEGIN
  IF NEW.period_id IS NULL THEN
    SELECT id INTO matching_period_id
    FROM v2_financial_periods
    WHERE NEW.work_date >= start_date AND NEW.work_date <= end_date
    LIMIT 1;

    NEW.period_id := matching_period_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assign_ts_period ON v2_timesheets;
CREATE TRIGGER assign_ts_period
  BEFORE INSERT ON v2_timesheets
  FOR EACH ROW
  EXECUTE FUNCTION assign_timesheet_period();

-- Update batch totals when timesheet changes
CREATE OR REPLACE FUNCTION update_batch_totals()
RETURNS TRIGGER AS $$
DECLARE
  batch_id_val UUID;
  week_start_val DATE;
BEGIN
  -- Find the week start for this timesheet
  week_start_val := DATE_TRUNC('week', COALESCE(NEW.work_date, OLD.work_date))::DATE;

  -- Find or create batch
  SELECT id INTO batch_id_val
  FROM v2_timesheet_batches
  WHERE employee_id = COALESCE(NEW.employee_id, OLD.employee_id)
    AND week_start = week_start_val;

  IF batch_id_val IS NOT NULL THEN
    -- Update batch totals
    UPDATE v2_timesheet_batches
    SET
      total_hours = (
        SELECT COALESCE(SUM(hours), 0)
        FROM v2_timesheets
        WHERE employee_id = v2_timesheet_batches.employee_id
          AND work_date >= v2_timesheet_batches.week_start
          AND work_date <= v2_timesheet_batches.week_end
          AND deleted_at IS NULL
      ),
      total_overtime = (
        SELECT COALESCE(SUM(overtime_hours), 0)
        FROM v2_timesheets
        WHERE employee_id = v2_timesheet_batches.employee_id
          AND work_date >= v2_timesheet_batches.week_start
          AND work_date <= v2_timesheet_batches.week_end
          AND deleted_at IS NULL
      ),
      total_cost = (
        SELECT COALESCE(SUM(total_cost), 0)
        FROM v2_timesheets
        WHERE employee_id = v2_timesheet_batches.employee_id
          AND work_date >= v2_timesheet_batches.week_start
          AND work_date <= v2_timesheet_batches.week_end
          AND deleted_at IS NULL
      ),
      updated_at = NOW()
    WHERE id = batch_id_val;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_batch_on_timesheet ON v2_timesheets;
CREATE TRIGGER update_batch_on_timesheet
  AFTER INSERT OR UPDATE OR DELETE ON v2_timesheets
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_totals();

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get labor hours by job for a period
CREATE OR REPLACE FUNCTION get_job_labor_hours(
  p_job_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  total_hours DECIMAL(10,2),
  total_overtime DECIMAL(10,2),
  total_cost DECIMAL(12,2),
  employee_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(t.hours), 0)::DECIMAL(10,2) as total_hours,
    COALESCE(SUM(t.overtime_hours), 0)::DECIMAL(10,2) as total_overtime,
    COALESCE(SUM(t.total_cost), 0)::DECIMAL(12,2) as total_cost,
    COUNT(DISTINCT t.employee_id)::INTEGER as employee_count
  FROM v2_timesheets t
  WHERE t.job_id = p_job_id
    AND t.status = 'approved'
    AND t.deleted_at IS NULL
    AND (p_start_date IS NULL OR t.work_date >= p_start_date)
    AND (p_end_date IS NULL OR t.work_date <= p_end_date);
END;
$$ LANGUAGE plpgsql;

-- Get employee hours for a period
CREATE OR REPLACE FUNCTION get_employee_labor_summary(
  p_employee_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_hours DECIMAL(10,2),
  total_overtime DECIMAL(10,2),
  total_base DECIMAL(12,2),
  total_burden DECIMAL(12,2),
  total_cost DECIMAL(12,2),
  job_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(t.hours), 0)::DECIMAL(10,2),
    COALESCE(SUM(t.overtime_hours), 0)::DECIMAL(10,2),
    COALESCE(SUM(t.base_cost), 0)::DECIMAL(12,2),
    COALESCE(SUM(t.burden_amount), 0)::DECIMAL(12,2),
    COALESCE(SUM(t.total_cost), 0)::DECIMAL(12,2),
    COUNT(DISTINCT t.job_id)::INTEGER
  FROM v2_timesheets t
  WHERE t.employee_id = p_employee_id
    AND t.work_date >= p_start_date
    AND t.work_date <= p_end_date
    AND t.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Validate timesheet entry
CREATE OR REPLACE FUNCTION validate_timesheet_entry(
  p_employee_id UUID,
  p_work_date DATE,
  p_hours DECIMAL,
  p_timesheet_id UUID DEFAULT NULL
)
RETURNS TABLE (
  is_valid BOOLEAN,
  errors TEXT[]
) AS $$
DECLARE
  max_daily DECIMAL;
  existing_hours DECIMAL;
  error_list TEXT[] := '{}';
BEGIN
  -- Get max daily hours setting
  SELECT value::DECIMAL INTO max_daily
  FROM v2_company_settings
  WHERE key = 'timesheet_max_daily_hours';
  max_daily := COALESCE(max_daily, 16);

  -- Get existing hours for this day (excluding current entry if editing)
  SELECT COALESCE(SUM(hours + COALESCE(overtime_hours, 0)), 0) INTO existing_hours
  FROM v2_timesheets
  WHERE employee_id = p_employee_id
    AND work_date = p_work_date
    AND deleted_at IS NULL
    AND (p_timesheet_id IS NULL OR id != p_timesheet_id);

  -- Check total hours for day
  IF existing_hours + p_hours > max_daily THEN
    error_list := array_append(error_list,
      format('Total hours for %s would exceed maximum of %s hours',
        p_work_date, max_daily));
  END IF;

  -- Check if date is in the future
  IF p_work_date > CURRENT_DATE THEN
    error_list := array_append(error_list, 'Cannot enter time for future dates');
  END IF;

  -- Check if employee is active
  IF NOT EXISTS (
    SELECT 1 FROM v2_employees
    WHERE id = p_employee_id AND status = 'active' AND deleted_at IS NULL
  ) THEN
    error_list := array_append(error_list, 'Employee is not active');
  END IF;

  RETURN QUERY SELECT array_length(error_list, 1) IS NULL OR array_length(error_list, 1) = 0, error_list;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- VIEWS
-- ============================================================

-- Labor summary by job
CREATE OR REPLACE VIEW v2_job_labor_summary AS
SELECT
  j.id as job_id,
  j.name as job_name,
  COUNT(DISTINCT t.employee_id) as employee_count,
  COALESCE(SUM(t.hours), 0) as total_hours,
  COALESCE(SUM(t.overtime_hours), 0) as overtime_hours,
  COALESCE(SUM(t.base_cost), 0) as total_base_cost,
  COALESCE(SUM(t.burden_amount), 0) as total_burden,
  COALESCE(SUM(t.total_cost), 0) as total_labor_cost
FROM v2_jobs j
LEFT JOIN v2_timesheets t ON t.job_id = j.id
  AND t.status = 'approved'
  AND t.deleted_at IS NULL
WHERE j.status = 'active'
GROUP BY j.id, j.name;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_timesheets IS 'Digital timesheet entries replacing paper timesheets';
COMMENT ON TABLE v2_timesheet_batches IS 'Weekly groupings of timesheets for bulk submission';
COMMENT ON FUNCTION get_job_labor_hours(UUID, DATE, DATE) IS 'Get total labor hours and cost for a job';
COMMENT ON FUNCTION validate_timesheet_entry(UUID, DATE, DECIMAL, UUID) IS 'Validate timesheet entry against business rules';
