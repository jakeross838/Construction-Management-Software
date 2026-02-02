-- Migration 129: Create budgets and budget lines tables
-- For job-level budget tracking with cost code integration

-- Create budgets table
CREATE TABLE IF NOT EXISTS v2_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL DEFAULT 'Project Budget',
  description TEXT,
  version INTEGER DEFAULT 1,
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'revised', 'final')),
  total_budget DECIMAL(15,2) DEFAULT 0,
  total_committed DECIMAL(15,2) DEFAULT 0,
  total_actual DECIMAL(15,2) DEFAULT 0,
  contingency_percent DECIMAL(5,2) DEFAULT 5.00,
  contingency_amount DECIMAL(15,2) DEFAULT 0,
  approved_by VARCHAR(255),
  approved_at TIMESTAMPTZ,
  notes TEXT,
  created_by VARCHAR(255) DEFAULT 'System',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(job_id, version)
);

-- Create budget line items table
CREATE TABLE IF NOT EXISTS v2_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES v2_budgets(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  category VARCHAR(255),
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  original_amount DECIMAL(15,2) DEFAULT 0,
  revised_amount DECIMAL(15,2) DEFAULT 0,
  committed_amount DECIMAL(15,2) DEFAULT 0,
  actual_amount DECIMAL(15,2) DEFAULT 0,
  unit_of_measure VARCHAR(50),
  quantity DECIMAL(15,4),
  unit_cost DECIMAL(15,4),
  notes TEXT,
  is_allowance BOOLEAN DEFAULT FALSE,
  allowance_status VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_v2_budgets_job_id ON v2_budgets(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_budgets_status ON v2_budgets(status);
CREATE INDEX IF NOT EXISTS idx_v2_budget_lines_budget_id ON v2_budget_lines(budget_id);
CREATE INDEX IF NOT EXISTS idx_v2_budget_lines_cost_code_id ON v2_budget_lines(cost_code_id);

-- Enable RLS
ALTER TABLE v2_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_budget_lines ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow all for v2_budgets" ON v2_budgets;
CREATE POLICY "Allow all for v2_budgets" ON v2_budgets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for v2_budget_lines" ON v2_budget_lines;
CREATE POLICY "Allow all for v2_budget_lines" ON v2_budget_lines FOR ALL USING (true) WITH CHECK (true);
