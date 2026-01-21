-- Migration 100: Financial Foundation
-- Expense tracking and financial period management for v3.1

-- ============================================================
-- EXPENSE CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  overhead_type TEXT NOT NULL DEFAULT 'other', -- office, fleet, equipment, admin, other
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default categories
INSERT INTO v2_expense_categories (name, description, overhead_type, sort_order) VALUES
  ('Office Supplies', 'Paper, pens, printer supplies, etc.', 'office', 1),
  ('Office Rent', 'Monthly office lease payments', 'office', 2),
  ('Office Utilities', 'Electric, water, internet, phone', 'office', 3),
  ('Office Equipment', 'Computers, printers, furniture', 'office', 4),
  ('Vehicle Fuel', 'Gas and diesel for company vehicles', 'fleet', 10),
  ('Vehicle Maintenance', 'Oil changes, repairs, tires', 'fleet', 11),
  ('Vehicle Insurance', 'Auto insurance premiums', 'fleet', 12),
  ('Vehicle Registration', 'Tags, titles, registration fees', 'fleet', 13),
  ('Tool Purchases', 'New tools and small equipment', 'equipment', 20),
  ('Tool Repairs', 'Tool maintenance and repairs', 'equipment', 21),
  ('Equipment Rental', 'Rented equipment not job-specific', 'equipment', 22),
  ('Accounting Fees', 'CPA, bookkeeping services', 'admin', 30),
  ('Legal Fees', 'Attorney, legal services', 'admin', 31),
  ('Insurance - General', 'General liability, umbrella', 'admin', 32),
  ('Insurance - Workers Comp', 'Workers compensation premiums', 'admin', 33),
  ('Bank Fees', 'Service charges, wire fees', 'admin', 34),
  ('Licenses & Permits', 'Business licenses, contractor licenses', 'admin', 35),
  ('Professional Development', 'Training, conferences, certifications', 'admin', 36),
  ('Software Subscriptions', 'Business software, SaaS tools', 'admin', 37),
  ('Miscellaneous', 'Other overhead expenses', 'other', 99)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- FINANCIAL PERIODS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_financial_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Period definition
  name TEXT NOT NULL,                    -- "January 2026", "Q1 2026"
  period_type TEXT NOT NULL DEFAULT 'monthly', -- monthly, quarterly, annual, custom
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'open',   -- open, closed
  is_locked BOOLEAN DEFAULT FALSE,       -- Prevents ALL modifications

  -- Totals (computed, cached for performance)
  total_expenses DECIMAL(12,2) DEFAULT 0,
  expense_count INTEGER DEFAULT 0,

  -- Audit
  created_by TEXT,
  closed_by TEXT,
  closed_at TIMESTAMPTZ,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- ============================================================
-- EXPENSES
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core fields
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  expense_date DATE NOT NULL,

  -- References
  category_id UUID REFERENCES v2_expense_categories(id),
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  period_id UUID REFERENCES v2_financial_periods(id) ON DELETE SET NULL,

  -- Optional job link (for job-specific overhead)
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Receipt/documentation
  receipt_url TEXT,
  notes TEXT,

  -- Audit
  created_by TEXT,
  updated_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- ACTIVITY TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_financial_period_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES v2_financial_periods(id) ON DELETE CASCADE,
  action TEXT NOT NULL,          -- created, closed, locked, unlocked, reopened
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_expense_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES v2_expenses(id) ON DELETE CASCADE,
  action TEXT NOT NULL,          -- created, updated, deleted, categorized
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_expenses_period ON v2_expenses(period_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_category ON v2_expenses(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_vendor ON v2_expenses(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_date ON v2_expenses(expense_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_job ON v2_expenses(job_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_periods_status ON v2_financial_periods(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_periods_dates ON v2_financial_periods(start_date, end_date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_period_activity_period ON v2_financial_period_activity(period_id);
CREATE INDEX IF NOT EXISTS idx_expense_activity_expense ON v2_expense_activity(expense_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_expense_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_expense_timestamp ON v2_expenses;
CREATE TRIGGER set_expense_timestamp
  BEFORE UPDATE ON v2_expenses
  FOR EACH ROW
  EXECUTE FUNCTION update_expense_timestamp();

CREATE OR REPLACE FUNCTION update_period_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_period_timestamp ON v2_financial_periods;
CREATE TRIGGER set_period_timestamp
  BEFORE UPDATE ON v2_financial_periods
  FOR EACH ROW
  EXECUTE FUNCTION update_period_timestamp();

-- ============================================================
-- HELPER FUNCTION: Auto-assign expense to period
-- ============================================================

CREATE OR REPLACE FUNCTION assign_expense_to_period()
RETURNS TRIGGER AS $$
BEGIN
  -- If no period_id set, find matching open period by date
  IF NEW.period_id IS NULL THEN
    SELECT id INTO NEW.period_id
    FROM v2_financial_periods
    WHERE NEW.expense_date BETWEEN start_date AND end_date
      AND status = 'open'
      AND deleted_at IS NULL
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_assign_expense_period ON v2_expenses;
CREATE TRIGGER auto_assign_expense_period
  BEFORE INSERT ON v2_expenses
  FOR EACH ROW
  EXECUTE FUNCTION assign_expense_to_period();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_expense_categories IS 'Expense categories with overhead type classification for allocation';
COMMENT ON TABLE v2_financial_periods IS 'Time periods for organizing and locking financial data';
COMMENT ON TABLE v2_expenses IS 'Non-invoice overhead expenses for overhead allocation';
COMMENT ON COLUMN v2_expense_categories.overhead_type IS 'Classification: office, fleet, equipment, admin, other';
COMMENT ON COLUMN v2_financial_periods.is_locked IS 'When true, no expenses can be added/modified in this period';
COMMENT ON COLUMN v2_expenses.period_id IS 'Auto-assigned based on expense_date if not specified';
