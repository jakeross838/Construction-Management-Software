-- Migration 136: Fix Budget Lines Schema
-- Ensures v2_budget_lines has all required columns

-- Add job_id if missing (critical for budget queries)
ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE;

-- Add cost_code_id if missing
ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE;

-- Create index for job_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_v2_budget_lines_job_id ON v2_budget_lines(job_id);

-- Create unique constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'v2_budget_lines_job_id_cost_code_id_key'
    ) THEN
        ALTER TABLE v2_budget_lines
        ADD CONSTRAINT v2_budget_lines_job_id_cost_code_id_key
        UNIQUE (job_id, cost_code_id);
    END IF;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
