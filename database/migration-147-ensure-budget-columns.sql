-- Migration 147: Ensure Budget Lines Columns Exist
-- Adds missing columns that should exist according to schema

-- Ensure budgeted_amount column exists
ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS budgeted_amount DECIMAL(12,2) DEFAULT 0;

-- Ensure other required columns exist
ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS committed_amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS billed_amount DECIMAL(12,2) DEFAULT 0;

ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0;

-- Add notes column if missing
ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index on job_id for performance
CREATE INDEX IF NOT EXISTS idx_budget_lines_job_id ON v2_budget_lines(job_id);

-- Create index on cost_code_id
CREATE INDEX IF NOT EXISTS idx_budget_lines_cost_code_id ON v2_budget_lines(cost_code_id);
