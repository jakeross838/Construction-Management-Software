-- Migration 116: Schedule Template Tasks (Phase 102-02)
-- Adds detailed template task storage for save-as-template and apply-template

-- ============================================================
-- 1. ADD SOURCE SCHEDULE TRACKING TO TEMPLATES
-- ============================================================
ALTER TABLE v2_schedule_templates
ADD COLUMN IF NOT EXISTS source_schedule_id UUID REFERENCES v2_schedules(id) ON DELETE SET NULL;

-- ============================================================
-- 2. CREATE TEMPLATE TASKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_schedule_template_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES v2_schedule_templates(id) ON DELETE CASCADE,

  -- Task identity (copied from source task)
  name TEXT NOT NULL,
  description TEXT,
  phase TEXT,
  trade_id TEXT,  -- Store as text for template portability

  -- Relative timing (calculated from source)
  relative_start_day INTEGER NOT NULL DEFAULT 0,  -- Day 0 = project start
  relative_end_day INTEGER NOT NULL DEFAULT 0,
  duration_days INTEGER NOT NULL DEFAULT 1,

  -- Template-specific
  sort_order INTEGER DEFAULT 0,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_tasks_template
ON v2_schedule_template_tasks(template_id);

CREATE INDEX IF NOT EXISTS idx_template_tasks_sort
ON v2_schedule_template_tasks(template_id, sort_order);

-- ============================================================
-- 3. CREATE TEMPLATE DEPENDENCIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_schedule_template_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES v2_schedule_templates(id) ON DELETE CASCADE,

  -- Reference by sort_order since task IDs won't exist yet
  predecessor_sort_order INTEGER NOT NULL,
  successor_sort_order INTEGER NOT NULL,

  dependency_type TEXT DEFAULT 'FS',
  lag_days INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_id, predecessor_sort_order, successor_sort_order)
);

CREATE INDEX IF NOT EXISTS idx_template_deps_template
ON v2_schedule_template_dependencies(template_id);

-- ============================================================
-- 4. FUNCTION: Save schedule as template
-- ============================================================
CREATE OR REPLACE FUNCTION save_schedule_as_template(
  p_source_schedule_id UUID,
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_project_type TEXT DEFAULT 'residential',
  p_created_by TEXT DEFAULT 'System'
)
RETURNS UUID AS $$
DECLARE
  v_template_id UUID;
  v_anchor_date DATE;
  v_task RECORD;
  v_dep RECORD;
  v_task_count INTEGER := 0;
  v_sort_mapping JSONB := '{}';
BEGIN
  -- Find the earliest task start date as anchor (Day 0)
  SELECT MIN(planned_start) INTO v_anchor_date
  FROM v2_schedule_tasks
  WHERE schedule_id = p_source_schedule_id
    AND planned_start IS NOT NULL;

  IF v_anchor_date IS NULL THEN
    RAISE EXCEPTION 'Source schedule has no tasks with planned dates';
  END IF;

  -- Create template
  INSERT INTO v2_schedule_templates (
    name, description, project_type, source_schedule_id, created_by
  )
  VALUES (p_name, p_description, p_project_type, p_source_schedule_id, p_created_by)
  RETURNING id INTO v_template_id;

  -- Copy tasks with relative days
  FOR v_task IN
    SELECT
      t.id,
      t.name,
      t.description,
      t.phase,
      t.trade_id::TEXT as trade_id,
      t.planned_start,
      t.planned_end,
      t.estimated_days,
      t.sort_order,
      t.notes
    FROM v2_schedule_tasks t
    WHERE t.schedule_id = p_source_schedule_id
    ORDER BY t.sort_order
  LOOP
    INSERT INTO v2_schedule_template_tasks (
      template_id,
      name,
      description,
      phase,
      trade_id,
      relative_start_day,
      relative_end_day,
      duration_days,
      sort_order,
      notes
    )
    VALUES (
      v_template_id,
      v_task.name,
      v_task.description,
      v_task.phase,
      v_task.trade_id,
      COALESCE(v_task.planned_start - v_anchor_date, 0),
      COALESCE(v_task.planned_end - v_anchor_date, 0),
      COALESCE(v_task.estimated_days, 1),
      v_task.sort_order,
      v_task.notes
    );

    v_task_count := v_task_count + 1;
    -- Store mapping of original task id to sort_order
    v_sort_mapping := v_sort_mapping || jsonb_build_object(v_task.id::TEXT, v_task.sort_order);
  END LOOP;

  -- Copy dependencies using sort_order mapping
  FOR v_dep IN
    SELECT
      d.*,
      pred.sort_order as pred_sort,
      succ.sort_order as succ_sort
    FROM v2_schedule_dependencies d
    JOIN v2_schedule_tasks pred ON d.predecessor_id = pred.id
    JOIN v2_schedule_tasks succ ON d.successor_id = succ.id
    WHERE pred.schedule_id = p_source_schedule_id
  LOOP
    INSERT INTO v2_schedule_template_dependencies (
      template_id,
      predecessor_sort_order,
      successor_sort_order,
      dependency_type,
      lag_days
    )
    VALUES (
      v_template_id,
      v_dep.pred_sort,
      v_dep.succ_sort,
      v_dep.dependency_type,
      v_dep.lag_days
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Update template with estimated duration
  UPDATE v2_schedule_templates
  SET estimated_duration_days = (
    SELECT MAX(relative_end_day) + 1
    FROM v2_schedule_template_tasks
    WHERE template_id = v_template_id
  )
  WHERE id = v_template_id;

  RETURN v_template_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. FUNCTION: Apply template to create schedule
-- ============================================================
CREATE OR REPLACE FUNCTION apply_template_to_job(
  p_template_id UUID,
  p_job_id UUID,
  p_start_date DATE,
  p_created_by TEXT DEFAULT 'System'
)
RETURNS UUID AS $$
DECLARE
  v_schedule_id UUID;
  v_template_task RECORD;
  v_template_dep RECORD;
  v_task_id UUID;
  v_sort_to_id JSONB := '{}';
  v_target_end DATE;
BEGIN
  -- Check if job already has schedule
  IF EXISTS (SELECT 1 FROM v2_schedules WHERE job_id = p_job_id) THEN
    RAISE EXCEPTION 'Job already has a schedule. Delete it first or use a different job.';
  END IF;

  -- Get template info for target end calculation
  SELECT MAX(relative_end_day) + 1 INTO v_target_end
  FROM v2_schedule_template_tasks
  WHERE template_id = p_template_id;

  -- Create schedule
  INSERT INTO v2_schedules (
    job_id,
    name,
    status,
    start_date,
    target_end_date,
    template_id,
    created_by
  )
  VALUES (
    p_job_id,
    'Generated from Template',
    'draft',
    p_start_date,
    p_start_date + COALESCE(v_target_end, 0),
    p_template_id,
    p_created_by
  )
  RETURNING id INTO v_schedule_id;

  -- Create tasks from template
  FOR v_template_task IN
    SELECT *
    FROM v2_schedule_template_tasks
    WHERE template_id = p_template_id
    ORDER BY sort_order
  LOOP
    INSERT INTO v2_schedule_tasks (
      schedule_id,
      name,
      description,
      phase,
      trade_id,
      planned_start,
      planned_end,
      estimated_days,
      sort_order,
      notes,
      status
    )
    VALUES (
      v_schedule_id,
      v_template_task.name,
      v_template_task.description,
      v_template_task.phase,
      v_template_task.trade_id::UUID,
      p_start_date + v_template_task.relative_start_day,
      p_start_date + v_template_task.relative_end_day,
      v_template_task.duration_days,
      v_template_task.sort_order,
      v_template_task.notes,
      'not_started'
    )
    RETURNING id INTO v_task_id;

    -- Map sort_order to new task id
    v_sort_to_id := v_sort_to_id || jsonb_build_object(v_template_task.sort_order::TEXT, v_task_id::TEXT);
  END LOOP;

  -- Create dependencies from template
  FOR v_template_dep IN
    SELECT *
    FROM v2_schedule_template_dependencies
    WHERE template_id = p_template_id
  LOOP
    INSERT INTO v2_schedule_dependencies (
      predecessor_id,
      successor_id,
      dependency_type,
      lag_days,
      source
    )
    VALUES (
      (v_sort_to_id ->> v_template_dep.predecessor_sort_order::TEXT)::UUID,
      (v_sort_to_id ->> v_template_dep.successor_sort_order::TEXT)::UUID,
      v_template_dep.dependency_type,
      v_template_dep.lag_days,
      'template'
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  -- Recalculate schedule
  PERFORM recalculate_schedule(v_schedule_id);

  RETURN v_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_schedule_template_tasks IS 'Individual tasks stored in a template with relative day offsets';
COMMENT ON TABLE v2_schedule_template_dependencies IS 'Dependencies between template tasks using sort_order references';
COMMENT ON COLUMN v2_schedule_template_tasks.relative_start_day IS 'Days from project start (Day 0)';
COMMENT ON COLUMN v2_schedule_template_tasks.relative_end_day IS 'Days from project start (Day 0)';
COMMENT ON FUNCTION save_schedule_as_template(UUID, TEXT, TEXT, TEXT, TEXT) IS 'Saves a schedule as a reusable template with relative days';
COMMENT ON FUNCTION apply_template_to_job(UUID, UUID, DATE, TEXT) IS 'Creates a new schedule from template anchored to start date';
