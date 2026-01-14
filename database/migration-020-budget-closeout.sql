-- Migration 020: Budget Line Close-Out Feature
-- Adds ability to mark budget lines as closed/complete to lock in savings

-- Add closed_at and closed_by columns to budget_lines
ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS closed_by TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for querying closed budget lines
CREATE INDEX IF NOT EXISTS idx_v2_budget_lines_closed ON v2_budget_lines(closed_at) WHERE closed_at IS NOT NULL;
