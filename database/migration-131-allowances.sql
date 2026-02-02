-- Migration 131: Create allowances tables
-- For tracking construction allowances and owner selections

-- Create allowances table
CREATE TABLE IF NOT EXISTS v2_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Allowance info
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) CHECK (category IN (
    'appliances', 'flooring', 'tile', 'countertops', 'cabinets',
    'lighting', 'plumbing_fixtures', 'hardware', 'paint',
    'landscaping', 'window_treatments', 'other'
  )),

  -- Budget
  budgeted_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  spent_amount DECIMAL(15,2) DEFAULT 0,

  -- Status
  status VARCHAR(50) DEFAULT 'open' CHECK (status IN (
    'open', 'pending_selection', 'selected', 'ordered', 'received', 'installed', 'closed', 'over_budget'
  )),

  -- Owner approval
  requires_owner_approval BOOLEAN DEFAULT TRUE,
  owner_approved_at TIMESTAMPTZ,
  owner_approved_by VARCHAR(255),

  -- Dates
  selection_due_date DATE,
  order_date DATE,
  expected_delivery DATE,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Meta
  created_by VARCHAR(255) DEFAULT 'System',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes for allowances
CREATE INDEX IF NOT EXISTS idx_v2_allowances_job_id ON v2_allowances(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_allowances_cost_code_id ON v2_allowances(cost_code_id);
CREATE INDEX IF NOT EXISTS idx_v2_allowances_status ON v2_allowances(status);
CREATE INDEX IF NOT EXISTS idx_v2_allowances_category ON v2_allowances(category);

-- Enable RLS
ALTER TABLE v2_allowances ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow all for v2_allowances" ON v2_allowances;
CREATE POLICY "Allow all for v2_allowances" ON v2_allowances FOR ALL USING (true) WITH CHECK (true);
