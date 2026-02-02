-- Migration 153: Tasks Module Enhancements
-- Adds missing columns and improves task management capabilities

-- ============================================================
-- ADD MISSING COLUMNS TO v2_tasks
-- ============================================================

-- Add estimated_hours and actual_hours for time tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_tasks' AND column_name = 'estimated_hours') THEN
    ALTER TABLE v2_tasks ADD COLUMN estimated_hours DECIMAL(6,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_tasks' AND column_name = 'actual_hours') THEN
    ALTER TABLE v2_tasks ADD COLUMN actual_hours DECIMAL(6,2);
  END IF;

  -- Add assignee_id as UUID for proper user reference (in addition to assigned_to text)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_tasks' AND column_name = 'assignee_id') THEN
    ALTER TABLE v2_tasks ADD COLUMN assignee_id UUID REFERENCES v2_employees(id) ON DELETE SET NULL;
  END IF;

  -- Add cost_code_id for linking tasks to cost codes
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_tasks' AND column_name = 'cost_code_id') THEN
    ALTER TABLE v2_tasks ADD COLUMN cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE SET NULL;
  END IF;

  -- Add vendor_id for tasks related to vendors
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_tasks' AND column_name = 'vendor_id') THEN
    ALTER TABLE v2_tasks ADD COLUMN vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- ADD INDEXES FOR COMMON QUERIES
-- ============================================================

-- Index for priority-based queries
CREATE INDEX IF NOT EXISTS idx_v2_tasks_priority ON v2_tasks(priority);

-- Index for type-based queries
CREATE INDEX IF NOT EXISTS idx_v2_tasks_type ON v2_tasks(type);

-- Index for assignee_id lookups
CREATE INDEX IF NOT EXISTS idx_v2_tasks_assignee_id ON v2_tasks(assignee_id);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_v2_tasks_job_status_priority
  ON v2_tasks(job_id, status, priority)
  WHERE deleted_at IS NULL;

-- Composite index for due date ordering (overdue tasks)
CREATE INDEX IF NOT EXISTS idx_v2_tasks_due_date_status
  ON v2_tasks(due_date, status)
  WHERE deleted_at IS NULL AND status NOT IN ('completed', 'cancelled');

-- ============================================================
-- UPDATE TASK NUMBER GENERATION TO HANDLE GLOBAL TASKS
-- ============================================================

CREATE OR REPLACE FUNCTION generate_task_number()
RETURNS TRIGGER AS $$
DECLARE
  prefix TEXT;
  next_num INTEGER;
BEGIN
  IF NEW.job_id IS NOT NULL THEN
    -- Get job identifier
    SELECT COALESCE(
      REGEXP_REPLACE(SPLIT_PART(name, '-', 1) || REGEXP_REPLACE(SPLIT_PART(name, ' ', 2), '[^0-9]', '', 'g'), '[^a-zA-Z0-9]', '', 'g'),
      'JOB'
    ) INTO prefix FROM v2_jobs WHERE id = NEW.job_id;
  ELSE
    prefix := 'GEN';
  END IF;

  -- Get next task number (scoped to job or global)
  SELECT COALESCE(MAX(
    CASE
      WHEN task_number ~ '-[0-9]+$' THEN
        CAST(SUBSTRING(task_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM v2_tasks WHERE job_id IS NOT DISTINCT FROM NEW.job_id;

  NEW.task_number := 'TASK-' || prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- ADD BUILDER_ID IF MISSING (for multi-tenancy)
-- ============================================================

DO $$
BEGIN
  -- Ensure builder_id exists on v2_tasks (should already exist from migration-139)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_tasks' AND column_name = 'builder_id') THEN
    ALTER TABLE v2_tasks ADD COLUMN builder_id UUID;
  END IF;

  -- Ensure builder_id exists on v2_task_checklists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_task_checklists' AND column_name = 'builder_id') THEN
    ALTER TABLE v2_task_checklists ADD COLUMN builder_id UUID;
  END IF;

  -- Ensure builder_id exists on v2_task_comments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_task_comments' AND column_name = 'builder_id') THEN
    ALTER TABLE v2_task_comments ADD COLUMN builder_id UUID;
  END IF;

  -- Ensure builder_id exists on v2_task_attachments
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_task_attachments' AND column_name = 'builder_id') THEN
    ALTER TABLE v2_task_attachments ADD COLUMN builder_id UUID;
  END IF;
END $$;
