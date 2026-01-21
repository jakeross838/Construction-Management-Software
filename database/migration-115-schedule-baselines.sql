-- Migration 115: Schedule Baselines (Phase 102-01)
-- Adds baseline schedule support for tracking schedule slippage

-- ============================================================
-- 1. ADD BASELINE COLUMNS TO SCHEDULE TASKS
-- ============================================================
ALTER TABLE v2_schedule_tasks
ADD COLUMN IF NOT EXISTS baseline_start DATE,
ADD COLUMN IF NOT EXISTS baseline_end DATE;

-- ============================================================
-- 2. ADD BASELINE METADATA TO SCHEDULES
-- ============================================================
ALTER TABLE v2_schedules
ADD COLUMN IF NOT EXISTS baseline_set_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS baseline_set_by TEXT;

-- ============================================================
-- 3. CREATE INDEX FOR BASELINE QUERIES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_baseline
ON v2_schedule_tasks(baseline_start, baseline_end)
WHERE baseline_start IS NOT NULL;

-- ============================================================
-- 4. FUNCTION: Copy current plan to baseline
-- ============================================================
CREATE OR REPLACE FUNCTION copy_to_baseline(
  p_schedule_id UUID,
  p_set_by TEXT DEFAULT 'System'
)
RETURNS void AS $$
BEGIN
  -- Copy planned dates to baseline for all tasks
  UPDATE v2_schedule_tasks
  SET
    baseline_start = planned_start,
    baseline_end = planned_end
  WHERE schedule_id = p_schedule_id
    AND planned_start IS NOT NULL
    AND planned_end IS NOT NULL;

  -- Update schedule with baseline metadata
  UPDATE v2_schedules
  SET
    baseline_set_at = NOW(),
    baseline_set_by = p_set_by,
    updated_at = NOW()
  WHERE id = p_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. FUNCTION: Get baseline variance for a schedule
-- ============================================================
CREATE OR REPLACE FUNCTION get_baseline_variance(p_schedule_id UUID)
RETURNS TABLE (
  task_id UUID,
  task_name TEXT,
  baseline_start DATE,
  baseline_end DATE,
  planned_start DATE,
  planned_end DATE,
  variance_days INTEGER
) AS $$
SELECT
  t.id as task_id,
  t.name as task_name,
  t.baseline_start,
  t.baseline_end,
  t.planned_start,
  t.planned_end,
  CASE
    WHEN t.baseline_end IS NOT NULL AND t.planned_end IS NOT NULL
    THEN t.planned_end - t.baseline_end
    ELSE 0
  END as variance_days
FROM v2_schedule_tasks t
WHERE t.schedule_id = p_schedule_id
ORDER BY t.sort_order;
$$ LANGUAGE sql;

-- ============================================================
-- 6. COMMENTS
-- ============================================================
COMMENT ON COLUMN v2_schedule_tasks.baseline_start IS 'Original planned start date snapshot';
COMMENT ON COLUMN v2_schedule_tasks.baseline_end IS 'Original planned end date snapshot';
COMMENT ON COLUMN v2_schedules.baseline_set_at IS 'When the baseline was captured';
COMMENT ON COLUMN v2_schedules.baseline_set_by IS 'Who captured the baseline';
COMMENT ON FUNCTION copy_to_baseline(UUID, TEXT) IS 'Copies current planned dates to baseline fields';
COMMENT ON FUNCTION get_baseline_variance(UUID) IS 'Returns variance between baseline and current planned dates';
