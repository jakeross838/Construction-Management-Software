-- Migration 176: Add missing job fields for frontend/API alignment
-- Fixes the schema mismatch between frontend JobFormDialog and v2_jobs table

-- Add missing fields that frontend expects
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS budget_amount DECIMAL(14,2);
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS percent_complete DECIMAL(5,2) DEFAULT 0;
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS project_manager TEXT;
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS site_supervisor TEXT;
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS client_email TEXT;
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS client_phone VARCHAR(20);
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS client_cell VARCHAR(20);
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS target_margin DECIMAL(5,2) DEFAULT 10;
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS retainage_percent DECIMAL(5,2) DEFAULT 10;
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add client as alias for client_name (some frontend code uses 'client')
-- We'll keep client_name as the canonical column and add a generated column
-- Actually, let's just add a separate client column and sync them
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS client TEXT;

-- Add start_date and end_date as aliases for estimated_start/estimated_completion
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS end_date DATE;

-- Add square_footage as alias for sqft_conditioned
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS square_footage INTEGER;

-- Add architectural_style if not exists
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS architectural_style TEXT;

-- Sync existing data: copy client_name to client, estimated dates to start/end
UPDATE v2_jobs SET client = client_name WHERE client IS NULL AND client_name IS NOT NULL;
UPDATE v2_jobs SET start_date = estimated_start WHERE start_date IS NULL AND estimated_start IS NOT NULL;
UPDATE v2_jobs SET end_date = estimated_completion WHERE end_date IS NULL AND estimated_completion IS NOT NULL;
UPDATE v2_jobs SET square_footage = sqft_conditioned WHERE square_footage IS NULL AND sqft_conditioned IS NOT NULL;

-- Create trigger to keep client and client_name in sync
CREATE OR REPLACE FUNCTION sync_job_client_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- If client is set but client_name is not, copy to client_name
  IF NEW.client IS NOT NULL AND (NEW.client_name IS NULL OR NEW.client_name = '') THEN
    NEW.client_name := NEW.client;
  END IF;
  -- If client_name is set but client is not, copy to client
  IF NEW.client_name IS NOT NULL AND (NEW.client IS NULL OR NEW.client = '') THEN
    NEW.client := NEW.client_name;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_job_client ON v2_jobs;
CREATE TRIGGER trg_sync_job_client
  BEFORE INSERT OR UPDATE ON v2_jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_client_fields();

-- Create trigger to sync date fields
CREATE OR REPLACE FUNCTION sync_job_date_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync start_date and estimated_start
  IF NEW.start_date IS NOT NULL AND NEW.estimated_start IS NULL THEN
    NEW.estimated_start := NEW.start_date;
  ELSIF NEW.estimated_start IS NOT NULL AND NEW.start_date IS NULL THEN
    NEW.start_date := NEW.estimated_start;
  END IF;

  -- Sync end_date and estimated_completion
  IF NEW.end_date IS NOT NULL AND NEW.estimated_completion IS NULL THEN
    NEW.estimated_completion := NEW.end_date;
  ELSIF NEW.estimated_completion IS NOT NULL AND NEW.end_date IS NULL THEN
    NEW.end_date := NEW.estimated_completion;
  END IF;

  -- Sync square_footage and sqft_conditioned
  IF NEW.square_footage IS NOT NULL AND NEW.sqft_conditioned IS NULL THEN
    NEW.sqft_conditioned := NEW.square_footage;
  ELSIF NEW.sqft_conditioned IS NOT NULL AND NEW.square_footage IS NULL THEN
    NEW.square_footage := NEW.sqft_conditioned;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_job_dates ON v2_jobs;
CREATE TRIGGER trg_sync_job_dates
  BEFORE INSERT OR UPDATE ON v2_jobs
  FOR EACH ROW
  EXECUTE FUNCTION sync_job_date_fields();

-- Add check constraint for percent_complete
ALTER TABLE v2_jobs DROP CONSTRAINT IF EXISTS chk_percent_complete_range;
ALTER TABLE v2_jobs ADD CONSTRAINT chk_percent_complete_range
  CHECK (percent_complete IS NULL OR (percent_complete >= 0 AND percent_complete <= 100));

-- Add indexes for commonly queried new fields
CREATE INDEX IF NOT EXISTS idx_v2_jobs_project_manager ON v2_jobs(project_manager);
CREATE INDEX IF NOT EXISTS idx_v2_jobs_percent_complete ON v2_jobs(percent_complete);
