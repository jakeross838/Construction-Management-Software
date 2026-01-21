-- Migration 102: Employee & Labor Setup
-- Employee management with burden class and rate configuration for v3.1

-- ============================================================
-- BURDEN CLASSES
-- Groups of employees with similar burden rates
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_burden_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  name TEXT NOT NULL UNIQUE,           -- "Field Crew", "Office Staff", "Foreman"
  description TEXT,

  -- Burden rate components (percentages stored as decimals: 0.0765 = 7.65%)
  fica_rate DECIMAL(6,4) DEFAULT 0.0765,        -- Social Security + Medicare (7.65%)
  futa_rate DECIMAL(6,4) DEFAULT 0.006,         -- Federal Unemployment (0.6%)
  suta_rate DECIMAL(6,4) DEFAULT 0.027,         -- State Unemployment (varies, ~2.7%)
  workers_comp_rate DECIMAL(6,4) DEFAULT 0.08,  -- Workers Comp (varies, ~8%)
  health_insurance_rate DECIMAL(6,4) DEFAULT 0.15, -- Health benefits (~15% of wages)
  retirement_rate DECIMAL(6,4) DEFAULT 0.03,    -- 401k match (~3%)
  pto_rate DECIMAL(6,4) DEFAULT 0.05,           -- PTO accrual (~5%)
  other_rate DECIMAL(6,4) DEFAULT 0,            -- Other benefits

  -- Calculated total (updated by trigger)
  total_burden_rate DECIMAL(6,4) NOT NULL DEFAULT 0.40,

  -- Status
  is_default BOOLEAN DEFAULT FALSE,    -- One class can be the default
  is_active BOOLEAN DEFAULT TRUE,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default burden classes
INSERT INTO v2_burden_classes (name, description, fica_rate, futa_rate, suta_rate, workers_comp_rate, health_insurance_rate, retirement_rate, pto_rate, total_burden_rate, is_default) VALUES
  ('Field Crew', 'Construction workers in the field', 0.0765, 0.006, 0.027, 0.12, 0.10, 0.03, 0.04, 0.3995, FALSE),
  ('Office Staff', 'Administrative and office employees', 0.0765, 0.006, 0.027, 0.01, 0.15, 0.04, 0.05, 0.3595, TRUE),
  ('Foreman', 'Site supervisors and foremen', 0.0765, 0.006, 0.027, 0.10, 0.12, 0.04, 0.04, 0.4095, FALSE),
  ('Subcontractor', 'No burden applied', 0, 0, 0, 0, 0, 0, 0, 0, FALSE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- COMPANY SETTINGS
-- Stored as key-value for flexibility
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  value_type TEXT DEFAULT 'string',    -- string, number, boolean, json
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Seed default company settings
INSERT INTO v2_company_settings (key, value, value_type, description) VALUES
  ('default_burden_rate', '0.40', 'number', 'Company-wide default burden rate (40%)'),
  ('burden_review_frequency', 'quarterly', 'string', 'How often to review burden rates'),
  ('last_burden_review', NULL, 'string', 'Date of last burden rate review'),
  ('next_burden_review', NULL, 'string', 'Date when next burden review is due')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- EMPLOYEES
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Basic info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  -- Employment details
  employee_number TEXT UNIQUE,          -- Internal ID
  hire_date DATE,
  termination_date DATE,
  status TEXT DEFAULT 'active',         -- active, inactive, terminated

  -- Role and classification
  role TEXT,                            -- Job title
  burden_class_id UUID REFERENCES v2_burden_classes(id),
  department TEXT,

  -- Pay information
  pay_type TEXT DEFAULT 'hourly',       -- hourly, salary
  pay_rate DECIMAL(10,2),               -- Hourly rate or annual salary

  -- For burden calculation override
  custom_burden_rate DECIMAL(6,4),      -- Override class rate if set

  -- Emergency contact
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- BURDEN RATE HISTORY
-- Track changes for audit and historical reporting
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_burden_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference (either class or employee)
  burden_class_id UUID REFERENCES v2_burden_classes(id),
  employee_id UUID REFERENCES v2_employees(id),

  -- Rates snapshot
  previous_rate DECIMAL(6,4),
  new_rate DECIMAL(6,4),
  effective_date DATE NOT NULL,
  reason TEXT,

  -- Audit
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- BURDEN REVIEW REMINDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_burden_review_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  review_type TEXT NOT NULL,            -- quarterly, annual, manual
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',        -- pending, completed, dismissed
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_employees_status ON v2_employees(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_employees_burden_class ON v2_employees(burden_class_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_burden_history_class ON v2_burden_rate_history(burden_class_id);
CREATE INDEX IF NOT EXISTS idx_burden_history_employee ON v2_burden_rate_history(employee_id);
CREATE INDEX IF NOT EXISTS idx_burden_review_status ON v2_burden_review_reminders(status, due_date);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-calculate total burden rate when components change
CREATE OR REPLACE FUNCTION calculate_total_burden_rate()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_burden_rate := COALESCE(NEW.fica_rate, 0) +
                           COALESCE(NEW.futa_rate, 0) +
                           COALESCE(NEW.suta_rate, 0) +
                           COALESCE(NEW.workers_comp_rate, 0) +
                           COALESCE(NEW.health_insurance_rate, 0) +
                           COALESCE(NEW.retirement_rate, 0) +
                           COALESCE(NEW.pto_rate, 0) +
                           COALESCE(NEW.other_rate, 0);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS calc_burden_rate ON v2_burden_classes;
CREATE TRIGGER calc_burden_rate
  BEFORE INSERT OR UPDATE ON v2_burden_classes
  FOR EACH ROW
  EXECUTE FUNCTION calculate_total_burden_rate();

-- Auto-update employee timestamp
CREATE OR REPLACE FUNCTION update_employee_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_employee_timestamp ON v2_employees;
CREATE TRIGGER set_employee_timestamp
  BEFORE UPDATE ON v2_employees
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_timestamp();

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Get effective burden rate for an employee
CREATE OR REPLACE FUNCTION get_employee_burden_rate(emp_id UUID)
RETURNS DECIMAL(6,4) AS $$
DECLARE
  emp_record RECORD;
  class_rate DECIMAL(6,4);
  default_rate DECIMAL(6,4);
BEGIN
  -- Get employee and their class
  SELECT e.custom_burden_rate, e.burden_class_id, bc.total_burden_rate
  INTO emp_record
  FROM v2_employees e
  LEFT JOIN v2_burden_classes bc ON e.burden_class_id = bc.id
  WHERE e.id = emp_id AND e.deleted_at IS NULL;

  -- Priority: custom rate > class rate > company default
  IF emp_record.custom_burden_rate IS NOT NULL THEN
    RETURN emp_record.custom_burden_rate;
  ELSIF emp_record.total_burden_rate IS NOT NULL THEN
    RETURN emp_record.total_burden_rate;
  ELSE
    -- Get company default
    SELECT value::DECIMAL INTO default_rate
    FROM v2_company_settings
    WHERE key = 'default_burden_rate';
    RETURN COALESCE(default_rate, 0.40);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Calculate burdened labor cost
CREATE OR REPLACE FUNCTION calculate_burdened_cost(base_wage DECIMAL(12,2), burden_rate DECIMAL(6,4))
RETURNS DECIMAL(12,2) AS $$
BEGIN
  RETURN ROUND(base_wage * (1 + COALESCE(burden_rate, 0)), 2);
END;
$$ LANGUAGE plpgsql;

-- Create quarterly burden review reminder
CREATE OR REPLACE FUNCTION create_burden_review_reminder()
RETURNS void AS $$
DECLARE
  next_quarter_start DATE;
BEGIN
  -- Calculate start of next quarter
  next_quarter_start := DATE_TRUNC('quarter', CURRENT_DATE + INTERVAL '3 months')::DATE;

  -- Create reminder if not exists
  INSERT INTO v2_burden_review_reminders (review_type, due_date, status)
  SELECT 'quarterly', next_quarter_start, 'pending'
  WHERE NOT EXISTS (
    SELECT 1 FROM v2_burden_review_reminders
    WHERE due_date = next_quarter_start AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_burden_classes IS 'Employee classifications with associated burden rates';
COMMENT ON TABLE v2_employees IS 'Employee records for labor tracking and burden calculation';
COMMENT ON TABLE v2_company_settings IS 'Company-wide configuration settings';
COMMENT ON TABLE v2_burden_rate_history IS 'Audit trail of burden rate changes';
COMMENT ON FUNCTION get_employee_burden_rate(UUID) IS 'Returns effective burden rate for employee: custom > class > company default';
COMMENT ON FUNCTION calculate_burdened_cost(DECIMAL, DECIMAL) IS 'Calculates total cost: base_wage * (1 + burden_rate)';
