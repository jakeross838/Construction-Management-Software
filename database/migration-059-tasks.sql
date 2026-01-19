-- Migration 059: Tasks
-- Project task management with assignments and progress tracking

-- ============================================================
-- TASKS (main table)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Task identification
  task_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  -- Classification
  type TEXT DEFAULT 'task', -- task, milestone, checklist, reminder
  category TEXT, -- coordination, procurement, inspection, admin, etc.

  -- Status: todo, in_progress, on_hold, completed, cancelled
  status TEXT DEFAULT 'todo',
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent

  -- Assignment
  assigned_to TEXT,
  created_by TEXT,

  -- Dates
  due_date DATE,
  start_date DATE,
  completed_at TIMESTAMPTZ,

  -- Progress (0-100)
  progress INTEGER DEFAULT 0,

  -- Parent task (for subtasks)
  parent_task_id UUID REFERENCES v2_tasks(id) ON DELETE CASCADE,

  -- Related entities
  related_rfi_id UUID,
  related_submittal_id UUID,
  related_po_id UUID,

  -- Metadata
  tags TEXT[],
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TASK CHECKLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_task_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES v2_tasks(id) ON DELETE CASCADE,

  item_order INTEGER NOT NULL,
  description TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASK COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES v2_tasks(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  author TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASK ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_task_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES v2_tasks(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,

  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_tasks_job_id ON v2_tasks(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_tasks_status ON v2_tasks(status);
CREATE INDEX IF NOT EXISTS idx_v2_tasks_assigned_to ON v2_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_v2_tasks_due_date ON v2_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_v2_tasks_parent_task_id ON v2_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_v2_tasks_deleted_at ON v2_tasks(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v2_task_checklists_task_id ON v2_task_checklists(task_id);
CREATE INDEX IF NOT EXISTS idx_v2_task_comments_task_id ON v2_task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_v2_task_attachments_task_id ON v2_task_attachments(task_id);

-- ============================================================
-- TRIGGER FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_task_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_task_updated_at ON v2_tasks;
CREATE TRIGGER trigger_task_updated_at
  BEFORE UPDATE ON v2_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_task_updated_at();

-- ============================================================
-- AUTO-GENERATE TASK NUMBER
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

  -- Get next task number
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

DROP TRIGGER IF EXISTS trigger_generate_task_number ON v2_tasks;
CREATE TRIGGER trigger_generate_task_number
  BEFORE INSERT ON v2_tasks
  FOR EACH ROW
  WHEN (NEW.task_number IS NULL OR NEW.task_number = '')
  EXECUTE FUNCTION generate_task_number();
