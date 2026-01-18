-- Migration 041: Estimates System
-- Cost estimation with versioning and budget conversion

-- Main estimates table
CREATE TABLE IF NOT EXISTS v2_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  title TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  parent_estimate_id UUID REFERENCES v2_estimates(id),  -- For version tracking
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected', 'converted')),
  total_amount DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  source_bid_id UUID REFERENCES v2_bids(id),  -- If imported from bid
  created_by TEXT NOT NULL,
  submitted_at TIMESTAMPTZ,
  submitted_by TEXT,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  converted_at TIMESTAMPTZ,
  converted_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Estimate line items
CREATE TABLE IF NOT EXISTS v2_estimate_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  description TEXT,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT,  -- ea, sf, lf, hr, etc.
  unit_cost DECIMAL(12,2) DEFAULT 0,
  amount DECIMAL(14,2) DEFAULT 0,  -- quantity * unit_cost (or manual)
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS v2_estimate_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which estimate created a budget
ALTER TABLE v2_budget_lines
  ADD COLUMN IF NOT EXISTS source_estimate_id UUID REFERENCES v2_estimates(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_estimates_job ON v2_estimates(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_estimates_status ON v2_estimates(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_estimates_parent ON v2_estimates(parent_estimate_id) WHERE parent_estimate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_estimate_lines_estimate ON v2_estimate_lines(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_cost_code ON v2_estimate_lines(cost_code_id);
CREATE INDEX IF NOT EXISTS idx_estimate_activity_estimate ON v2_estimate_activity(estimate_id);
