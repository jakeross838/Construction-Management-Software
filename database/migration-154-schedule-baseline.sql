-- Migration 154: Schedule Baseline Capture Functions
-- Date: 2026-02-01
-- Purpose: Add dedicated baseline capture and variance functions for schedule tracking

-- ============================================================
-- 1. ADD baseline_captured_at COLUMN (alias for baseline_set_at)
-- ============================================================
-- Note: baseline_set_at already exists from migration-115, adding captured_at as alias
ALTER TABLE v2_schedules
ADD COLUMN IF NOT EXISTS baseline_captured_at TIMESTAMPTZ;

-- Sync existing baseline_set_at to baseline_captured_at if data exists
UPDATE v2_schedules
SET baseline_captured_at = baseline_set_at
WHERE baseline_set_at IS NOT NULL AND baseline_captured_at IS NULL;

-- ============================================================
-- 2. FUNCTION: capture_schedule_baseline
-- Copies planned_start/planned_end to baseline_start/baseline_end
-- for all tasks in a schedule
-- ============================================================
CREATE OR REPLACE FUNCTION capture_schedule_baseline(p_schedule_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_task_count INTEGER;
  v_schedule_name TEXT;
BEGIN
  -- Get schedule name
  SELECT name INTO v_schedule_name
  FROM v2_schedules
  WHERE id = p_schedule_id;

  IF v_schedule_name IS NULL THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;

  -- Copy planned dates to baseline for all tasks with valid dates
  UPDATE v2_schedule_tasks
  SET
    baseline_start = planned_start,
    baseline_end = planned_end,
    updated_at = NOW()
  WHERE schedule_id = p_schedule_id
    AND planned_start IS NOT NULL
    AND planned_end IS NOT NULL;

  GET DIAGNOSTICS v_task_count = ROW_COUNT;

  -- Update schedule with baseline timestamp
  UPDATE v2_schedules
  SET
    baseline_captured_at = NOW(),
    baseline_set_at = NOW(),
    updated_at = NOW()
  WHERE id = p_schedule_id;

  RETURN jsonb_build_object(
    'success', true,
    'schedule_id', p_schedule_id,
    'schedule_name', v_schedule_name,
    'tasks_captured', v_task_count,
    'captured_at', NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3. FUNCTION: get_schedule_variance
-- Returns variance data for all tasks in a schedule
-- ============================================================
CREATE OR REPLACE FUNCTION get_schedule_variance(p_schedule_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_schedule_record RECORD;
  v_tasks JSONB;
  v_summary JSONB;
BEGIN
  -- Get schedule info
  SELECT
    id,
    name,
    baseline_captured_at,
    baseline_set_at,
    baseline_set_by
  INTO v_schedule_record
  FROM v2_schedules
  WHERE id = p_schedule_id;

  IF v_schedule_record.id IS NULL THEN
    RAISE EXCEPTION 'Schedule not found: %', p_schedule_id;
  END IF;

  -- Get task variance data
  SELECT jsonb_agg(
    jsonb_build_object(
      'task_id', t.id,
      'task_name', t.name,
      'phase', t.phase,
      'baseline_start', t.baseline_start,
      'baseline_end', t.baseline_end,
      'planned_start', t.planned_start,
      'planned_end', t.planned_end,
      'actual_start', t.actual_start,
      'actual_end', t.actual_end,
      'status', t.status,
      'percent_complete', t.percent_complete,
      'start_variance_days',
        CASE
          WHEN t.baseline_start IS NOT NULL AND t.planned_start IS NOT NULL
          THEN t.planned_start - t.baseline_start
          ELSE 0
        END,
      'end_variance_days',
        CASE
          WHEN t.baseline_end IS NOT NULL AND t.planned_end IS NOT NULL
          THEN t.planned_end - t.baseline_end
          ELSE 0
        END,
      'has_baseline', (t.baseline_start IS NOT NULL AND t.baseline_end IS NOT NULL)
    ) ORDER BY t.sort_order
  )
  INTO v_tasks
  FROM v2_schedule_tasks t
  WHERE t.schedule_id = p_schedule_id;

  -- Calculate summary
  SELECT jsonb_build_object(
    'total_tasks', COUNT(*),
    'tasks_with_baseline', COUNT(*) FILTER (WHERE baseline_start IS NOT NULL AND baseline_end IS NOT NULL),
    'tasks_without_baseline', COUNT(*) FILTER (WHERE baseline_start IS NULL OR baseline_end IS NULL),
    'on_schedule', COUNT(*) FILTER (
      WHERE baseline_end IS NOT NULL
      AND planned_end IS NOT NULL
      AND planned_end <= baseline_end
    ),
    'behind_schedule', COUNT(*) FILTER (
      WHERE baseline_end IS NOT NULL
      AND planned_end IS NOT NULL
      AND planned_end > baseline_end
    ),
    'ahead_of_schedule', COUNT(*) FILTER (
      WHERE baseline_end IS NOT NULL
      AND planned_end IS NOT NULL
      AND planned_end < baseline_end
    ),
    'total_end_variance_days', COALESCE(SUM(
      CASE
        WHEN baseline_end IS NOT NULL AND planned_end IS NOT NULL
        THEN planned_end - baseline_end
        ELSE 0
      END
    ), 0),
    'avg_end_variance_days', COALESCE(AVG(
      CASE
        WHEN baseline_end IS NOT NULL AND planned_end IS NOT NULL
        THEN planned_end - baseline_end
        ELSE NULL
      END
    ), 0)
  )
  INTO v_summary
  FROM v2_schedule_tasks
  WHERE schedule_id = p_schedule_id;

  RETURN jsonb_build_object(
    'schedule_id', p_schedule_id,
    'schedule_name', v_schedule_record.name,
    'baseline_captured_at', COALESCE(v_schedule_record.baseline_captured_at, v_schedule_record.baseline_set_at),
    'baseline_set_by', v_schedule_record.baseline_set_by,
    'has_baseline', (v_schedule_record.baseline_captured_at IS NOT NULL OR v_schedule_record.baseline_set_at IS NOT NULL),
    'tasks', COALESCE(v_tasks, '[]'::jsonb),
    'summary', v_summary
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 4. COMMENTS
-- ============================================================
COMMENT ON COLUMN v2_schedules.baseline_captured_at IS 'When the baseline was captured (alias for baseline_set_at)';
COMMENT ON FUNCTION capture_schedule_baseline(UUID) IS 'Captures current planned dates as baseline for all tasks in a schedule';
COMMENT ON FUNCTION get_schedule_variance(UUID) IS 'Returns variance analysis between baseline and current planned dates for all tasks';

-- ============================================================
-- 5. INDEX FOR PERFORMANCE
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_schedules_baseline_captured
ON v2_schedules(baseline_captured_at)
WHERE baseline_captured_at IS NOT NULL;
