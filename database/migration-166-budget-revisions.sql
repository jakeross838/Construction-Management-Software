-- Migration 166: Budget Revision History and Forecast Support
-- Adds tables for tracking budget revisions and forecast amounts

-- ============================================================
-- BUDGET REVISIONS TABLE
-- Tracks each revision to a job's budget with metadata
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_budget_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Revision metadata
  revision_number INTEGER NOT NULL,
  revision_date DATE NOT NULL DEFAULT CURRENT_DATE,
  revised_by TEXT,
  reason TEXT,
  notes TEXT,

  -- Total amounts at time of revision
  previous_total DECIMAL(12,2) DEFAULT 0,
  new_total DECIMAL(12,2) DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id, revision_number)
);

-- ============================================================
-- BUDGET REVISION LINES TABLE
-- Tracks per-cost-code changes within a revision
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_budget_revision_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id UUID NOT NULL REFERENCES v2_budget_revisions(id) ON DELETE CASCADE,
  cost_code_id UUID NOT NULL REFERENCES v2_cost_codes(id) ON DELETE CASCADE,

  -- Amount tracking
  previous_amount DECIMAL(12,2) DEFAULT 0,
  new_amount DECIMAL(12,2) DEFAULT 0,
  change_amount DECIMAL(12,2) GENERATED ALWAYS AS (new_amount - previous_amount) STORED,

  -- Reason for this specific line change
  change_reason TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADD FORECAST COLUMN TO BUDGET LINES
-- For budget vs forecast comparison
-- ============================================================

ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS forecast_amount DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN v2_budget_lines.forecast_amount IS 'Forecasted amount for this cost code (updated estimate to completion)';

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_budget_revisions_job_id
  ON v2_budget_revisions(job_id);

CREATE INDEX IF NOT EXISTS idx_budget_revisions_date
  ON v2_budget_revisions(revision_date);

CREATE INDEX IF NOT EXISTS idx_budget_revisions_job_number
  ON v2_budget_revisions(job_id, revision_number);

CREATE INDEX IF NOT EXISTS idx_budget_revision_lines_revision_id
  ON v2_budget_revision_lines(revision_id);

CREATE INDEX IF NOT EXISTS idx_budget_revision_lines_cost_code_id
  ON v2_budget_revision_lines(cost_code_id);

CREATE INDEX IF NOT EXISTS idx_budget_lines_forecast
  ON v2_budget_lines(job_id)
  WHERE forecast_amount > 0;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_budget_revisions IS 'Tracks revisions to job budgets with full audit trail';
COMMENT ON TABLE v2_budget_revision_lines IS 'Per-cost-code changes within a budget revision';

COMMENT ON COLUMN v2_budget_revisions.revision_number IS 'Sequential number within job (1, 2, 3...)';
COMMENT ON COLUMN v2_budget_revisions.previous_total IS 'Total budget before this revision';
COMMENT ON COLUMN v2_budget_revisions.new_total IS 'Total budget after this revision';
COMMENT ON COLUMN v2_budget_revision_lines.change_amount IS 'Computed: new_amount - previous_amount';
