-- Migration 047: Job CRUD Support
-- Add soft delete, updated_at columns and job activity table

-- Add soft delete and updated_at to v2_jobs
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create job activity/audit log table
CREATE TABLE IF NOT EXISTS v2_job_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  field_changes JSONB,
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_job_activity_job_id ON v2_job_activity(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_job_activity_created_at ON v2_job_activity(created_at);
