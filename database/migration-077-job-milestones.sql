-- Migration 077: Job Milestones/Timeline
-- Track key milestones and phases for job progress

-- Job Milestones table
CREATE TABLE IF NOT EXISTS v2_job_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Milestone info
  name TEXT NOT NULL,
  description TEXT,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN (
    'phase_start', 'phase_end', 'inspection', 'payment', 'delivery',
    'permit', 'approval', 'handoff', 'completion', 'custom'
  )),

  -- Dates
  target_date DATE,
  actual_date DATE,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'delayed', 'cancelled')),

  -- Ordering
  sort_order INTEGER DEFAULT 0,
  phase_number INTEGER,  -- For grouping milestones by phase

  -- Dependencies
  depends_on_id UUID REFERENCES v2_job_milestones(id) ON DELETE SET NULL,

  -- Progress
  progress_percent INTEGER DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

  -- Assignment
  assigned_to TEXT,

  -- Notes
  notes TEXT,
  completion_notes TEXT,

  -- Metadata
  completed_at TIMESTAMPTZ,
  completed_by TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_job_milestones_job ON v2_job_milestones(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_milestones_status ON v2_job_milestones(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_milestones_target ON v2_job_milestones(target_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_job_milestones_sort ON v2_job_milestones(job_id, sort_order) WHERE deleted_at IS NULL;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_job_milestones_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_job_milestones_timestamp ON v2_job_milestones;
CREATE TRIGGER set_job_milestones_timestamp
  BEFORE UPDATE ON v2_job_milestones
  FOR EACH ROW
  EXECUTE FUNCTION update_job_milestones_timestamp();

-- Add timeline fields to v2_jobs if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_jobs' AND column_name = 'phase_current') THEN
    ALTER TABLE v2_jobs ADD COLUMN phase_current TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_jobs' AND column_name = 'phase_count') THEN
    ALTER TABLE v2_jobs ADD COLUMN phase_count INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_jobs' AND column_name = 'milestone_progress') THEN
    ALTER TABLE v2_jobs ADD COLUMN milestone_progress INTEGER DEFAULT 0;
  END IF;
END $$;
