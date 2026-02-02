-- Migration 152: Schedule Dependencies Enhancement
-- Date: 2026-02-01
-- Purpose: Add enhanced dependency and milestone support to schedule tasks

-- ============================================================
-- 1. ADD IS_MILESTONE COLUMN TO SCHEDULE TASKS
-- ============================================================
-- While task_type='milestone' exists, adding explicit is_milestone
-- allows for quick filtering and UI decisions
ALTER TABLE v2_schedule_tasks
ADD COLUMN IF NOT EXISTS is_milestone BOOLEAN DEFAULT false;

-- Update existing milestone tasks (tasks with 0 duration are milestones)
UPDATE v2_schedule_tasks
SET is_milestone = true
WHERE estimated_days = 0 OR (planned_start IS NOT NULL AND planned_start = planned_end);

-- ============================================================
-- 2. ENSURE LAG_DAYS COLUMN EXISTS ON DEPENDENCIES
-- ============================================================
-- This should already exist from migration-086, but ensuring it's there
ALTER TABLE v2_schedule_dependencies
ADD COLUMN IF NOT EXISTS lag_days INTEGER DEFAULT 0;

-- ============================================================
-- 3. CREATE INDEX FOR MILESTONE QUERIES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_is_milestone
ON v2_schedule_tasks(is_milestone)
WHERE is_milestone = true;

-- ============================================================
-- 4. CREATE INDEX FOR BASELINE COMPARISON QUERIES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_baseline_dates
ON v2_schedule_tasks(baseline_start, baseline_end)
WHERE baseline_start IS NOT NULL OR baseline_end IS NOT NULL;

-- ============================================================
-- 5. FUNCTION: Get task with baseline variance
-- ============================================================
CREATE OR REPLACE FUNCTION get_task_baseline_variance(p_task_id UUID)
RETURNS TABLE (
  task_id UUID,
  task_name TEXT,
  planned_start DATE,
  planned_end DATE,
  baseline_start DATE,
  baseline_end DATE,
  start_variance_days INTEGER,
  end_variance_days INTEGER,
  is_behind BOOLEAN
) AS $$
SELECT
  t.id as task_id,
  t.name as task_name,
  t.planned_start,
  t.planned_end,
  t.baseline_start,
  t.baseline_end,
  CASE
    WHEN t.baseline_start IS NOT NULL AND t.planned_start IS NOT NULL
    THEN t.planned_start - t.baseline_start
    ELSE 0
  END as start_variance_days,
  CASE
    WHEN t.baseline_end IS NOT NULL AND t.planned_end IS NOT NULL
    THEN t.planned_end - t.baseline_end
    ELSE 0
  END as end_variance_days,
  CASE
    WHEN t.baseline_end IS NOT NULL AND t.planned_end IS NOT NULL
    THEN t.planned_end > t.baseline_end
    ELSE false
  END as is_behind
FROM v2_schedule_tasks t
WHERE t.id = p_task_id;
$$ LANGUAGE sql;

-- ============================================================
-- 6. COMMENTS
-- ============================================================
COMMENT ON COLUMN v2_schedule_tasks.is_milestone IS 'Flag for milestone tasks (zero duration, diamond display)';
COMMENT ON FUNCTION get_task_baseline_variance(UUID) IS 'Returns baseline variance information for a single task';
