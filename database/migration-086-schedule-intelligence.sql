-- Migration 086: Schedule Intelligence (Phase 73)
-- Adds dependency-based scheduling, critical path, and auto-scheduling

-- ============================================================
-- 0. CLEANUP (in case of partial migration)
-- ============================================================
DROP TABLE IF EXISTS v2_schedule_activity CASCADE;
DROP TABLE IF EXISTS v2_schedule_milestones CASCADE;
DROP TABLE IF EXISTS v2_schedule_dependencies CASCADE;
DROP TABLE IF EXISTS v2_schedule_tasks CASCADE;
DROP TABLE IF EXISTS v2_schedules CASCADE;
DROP TABLE IF EXISTS v2_schedule_templates CASCADE;

-- ============================================================
-- 1. SCHEDULE TEMPLATES (Standard construction sequences)
-- ============================================================
CREATE TABLE v2_schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  project_type TEXT, -- 'residential', 'commercial', 'renovation'

  -- Template metadata
  estimated_duration_days INTEGER,
  phases JSONB DEFAULT '[]',

  is_default BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PROJECT SCHEDULES
-- ============================================================
CREATE TABLE v2_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Schedule info
  name TEXT NOT NULL DEFAULT 'Master Schedule',
  status TEXT CHECK (status IN ('draft', 'active', 'complete', 'on_hold')) DEFAULT 'draft',

  -- Date range
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,

  -- Working days configuration
  work_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]',
  holidays JSONB DEFAULT '[]',

  -- Template used
  template_id UUID REFERENCES v2_schedule_templates(id),

  -- Schedule health
  critical_path_days INTEGER,
  buffer_days INTEGER DEFAULT 0,
  on_schedule BOOLEAN DEFAULT true,

  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id)
);

CREATE INDEX IF NOT EXISTS idx_schedules_job ON v2_schedules(job_id);

-- ============================================================
-- 3. SCHEDULE TASKS
-- ============================================================
CREATE TABLE v2_schedule_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES v2_schedules(id) ON DELETE CASCADE,

  -- Task identity
  name TEXT NOT NULL,
  description TEXT,
  phase TEXT,  -- 'Foundation', 'Framing', 'MEP Rough', etc.

  -- Linkages (no FK constraints - tables may not exist)
  trade_id UUID,
  cost_code_id UUID,
  catalog_item_id UUID,
  allowance_id UUID,

  -- Duration
  estimated_days INTEGER NOT NULL DEFAULT 1,
  actual_days INTEGER,

  -- Dates
  planned_start DATE,
  planned_end DATE,
  actual_start DATE,
  actual_end DATE,

  -- Status
  status TEXT CHECK (status IN ('not_started', 'in_progress', 'complete', 'blocked', 'skipped')) DEFAULT 'not_started',
  percent_complete INTEGER DEFAULT 0 CHECK (percent_complete >= 0 AND percent_complete <= 100),

  -- Critical path
  is_critical BOOLEAN DEFAULT false,
  earliest_start DATE,
  earliest_finish DATE,
  latest_start DATE,
  latest_finish DATE,
  total_float INTEGER DEFAULT 0,
  free_float INTEGER DEFAULT 0,

  -- Constraints
  constraint_type TEXT CHECK (constraint_type IN ('none', 'start_no_earlier', 'start_no_later', 'must_start_on', 'must_finish_on')),
  constraint_date DATE,

  -- Resources
  assigned_vendor_id UUID,
  crew_size INTEGER DEFAULT 1,

  -- Ordering
  sort_order INTEGER DEFAULT 0,
  wbs_code TEXT,  -- Work breakdown structure code

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_tasks_schedule ON v2_schedule_tasks(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_status ON v2_schedule_tasks(status);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_trade ON v2_schedule_tasks(trade_id);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_dates ON v2_schedule_tasks(planned_start, planned_end);

-- ============================================================
-- 4. TASK DEPENDENCIES
-- ============================================================
CREATE TABLE v2_schedule_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  predecessor_id UUID NOT NULL REFERENCES v2_schedule_tasks(id) ON DELETE CASCADE,
  successor_id UUID NOT NULL REFERENCES v2_schedule_tasks(id) ON DELETE CASCADE,

  -- Dependency type
  dependency_type TEXT CHECK (dependency_type IN ('FS', 'FF', 'SS', 'SF')) DEFAULT 'FS',
  -- FS = Finish-to-Start (most common)
  -- FF = Finish-to-Finish
  -- SS = Start-to-Start
  -- SF = Start-to-Finish (rare)

  -- Lag (positive) or Lead (negative)
  lag_days INTEGER DEFAULT 0,

  -- Source of dependency
  source TEXT,  -- 'manual', 'catalog', 'template'

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(predecessor_id, successor_id)
);

CREATE INDEX IF NOT EXISTS idx_dependencies_predecessor ON v2_schedule_dependencies(predecessor_id);
CREATE INDEX IF NOT EXISTS idx_dependencies_successor ON v2_schedule_dependencies(successor_id);

-- ============================================================
-- 5. SCHEDULE MILESTONES
-- ============================================================
CREATE TABLE v2_schedule_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES v2_schedules(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,

  -- Date
  target_date DATE NOT NULL,
  actual_date DATE,

  -- Status
  status TEXT CHECK (status IN ('upcoming', 'reached', 'missed')) DEFAULT 'upcoming',

  -- Links
  linked_task_id UUID REFERENCES v2_schedule_tasks(id),

  -- Notifications
  notify_days_before INTEGER DEFAULT 7,

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_milestones_schedule ON v2_schedule_milestones(schedule_id);

-- ============================================================
-- 6. SCHEDULE ACTIVITY LOG
-- ============================================================
CREATE TABLE v2_schedule_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES v2_schedules(id) ON DELETE CASCADE,
  task_id UUID REFERENCES v2_schedule_tasks(id) ON DELETE SET NULL,

  action TEXT NOT NULL,
  details JSONB,
  performed_by TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schedule_activity_schedule ON v2_schedule_activity(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_activity_date ON v2_schedule_activity(created_at DESC);

-- ============================================================
-- 7. FUNCTION: Calculate working days between dates
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_working_days(
  p_start_date DATE,
  p_end_date DATE,
  p_work_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]'
)
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_current DATE;
  v_day_name TEXT;
BEGIN
  v_current := p_start_date;

  WHILE v_current <= p_end_date LOOP
    v_day_name := LOWER(TO_CHAR(v_current, 'Dy'));

    IF p_work_days ? v_day_name THEN
      v_count := v_count + 1;
    END IF;

    v_current := v_current + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. FUNCTION: Add working days to a date
-- ============================================================
CREATE OR REPLACE FUNCTION add_working_days(
  p_start_date DATE,
  p_days INTEGER,
  p_work_days JSONB DEFAULT '["mon","tue","wed","thu","fri"]'
)
RETURNS DATE AS $$
DECLARE
  v_result DATE;
  v_added INTEGER := 0;
  v_day_name TEXT;
BEGIN
  v_result := p_start_date;

  IF p_days <= 0 THEN
    RETURN v_result;
  END IF;

  WHILE v_added < p_days LOOP
    v_result := v_result + 1;
    v_day_name := LOWER(TO_CHAR(v_result, 'Dy'));

    IF p_work_days ? v_day_name THEN
      v_added := v_added + 1;
    END IF;
  END LOOP;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. FUNCTION: Get topological order of tasks
-- ============================================================
CREATE OR REPLACE FUNCTION get_task_order(p_schedule_id UUID)
RETURNS TABLE (
  task_id UUID,
  task_name TEXT,
  level INTEGER
) AS $$
WITH RECURSIVE task_levels AS (
  -- Base case: tasks with no predecessors
  SELECT
    t.id as task_id,
    t.name as task_name,
    0 as level
  FROM v2_schedule_tasks t
  WHERE t.schedule_id = p_schedule_id
    AND NOT EXISTS (
      SELECT 1 FROM v2_schedule_dependencies d
      WHERE d.successor_id = t.id
    )

  UNION ALL

  -- Recursive case: tasks that depend on processed tasks
  SELECT
    t.id,
    t.name,
    tl.level + 1
  FROM v2_schedule_tasks t
  JOIN v2_schedule_dependencies d ON d.successor_id = t.id
  JOIN task_levels tl ON tl.task_id = d.predecessor_id
  WHERE t.schedule_id = p_schedule_id
)
SELECT DISTINCT ON (task_id)
  task_id,
  task_name,
  MAX(level) OVER (PARTITION BY task_id) as level
FROM task_levels
ORDER BY task_id, level DESC;
$$ LANGUAGE sql;

-- ============================================================
-- 10. FUNCTION: Calculate critical path (forward pass)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_schedule_forward_pass(p_schedule_id UUID)
RETURNS void AS $$
DECLARE
  v_schedule RECORD;
  v_task RECORD;
  v_pred RECORD;
  v_max_finish DATE;
  v_start DATE;
BEGIN
  -- Get schedule
  SELECT * INTO v_schedule FROM v2_schedules WHERE id = p_schedule_id;

  IF v_schedule IS NULL THEN
    RETURN;
  END IF;

  -- Reset all dates
  UPDATE v2_schedule_tasks
  SET earliest_start = NULL, earliest_finish = NULL
  WHERE schedule_id = p_schedule_id;

  -- Process tasks in topological order
  FOR v_task IN
    SELECT t.*
    FROM v2_schedule_tasks t
    LEFT JOIN LATERAL (
      SELECT MAX(d.predecessor_id) as has_pred
      FROM v2_schedule_dependencies d
      WHERE d.successor_id = t.id
    ) deps ON true
    WHERE t.schedule_id = p_schedule_id
    ORDER BY
      CASE WHEN deps.has_pred IS NULL THEN 0 ELSE 1 END,
      t.sort_order
  LOOP
    -- Get max finish date of predecessors
    SELECT MAX(
      CASE d.dependency_type
        WHEN 'FS' THEN add_working_days(pred.earliest_finish, d.lag_days, v_schedule.work_days)
        WHEN 'SS' THEN add_working_days(pred.earliest_start, d.lag_days, v_schedule.work_days)
        WHEN 'FF' THEN add_working_days(pred.earliest_finish, d.lag_days - v_task.estimated_days, v_schedule.work_days)
        WHEN 'SF' THEN add_working_days(pred.earliest_start, d.lag_days - v_task.estimated_days, v_schedule.work_days)
        ELSE pred.earliest_finish
      END
    )
    INTO v_max_finish
    FROM v2_schedule_dependencies d
    JOIN v2_schedule_tasks pred ON d.predecessor_id = pred.id
    WHERE d.successor_id = v_task.id;

    -- Determine start date
    IF v_max_finish IS NOT NULL THEN
      v_start := v_max_finish;
    ELSIF v_task.constraint_type = 'must_start_on' THEN
      v_start := v_task.constraint_date;
    ELSIF v_task.constraint_type = 'start_no_earlier' AND v_task.constraint_date > v_schedule.start_date THEN
      v_start := v_task.constraint_date;
    ELSE
      v_start := COALESCE(v_schedule.start_date, CURRENT_DATE);
    END IF;

    -- Update task
    UPDATE v2_schedule_tasks
    SET
      earliest_start = v_start,
      earliest_finish = add_working_days(v_start, estimated_days - 1, v_schedule.work_days),
      planned_start = COALESCE(planned_start, v_start),
      planned_end = COALESCE(planned_end, add_working_days(v_start, estimated_days - 1, v_schedule.work_days))
    WHERE id = v_task.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 11. FUNCTION: Calculate critical path (backward pass)
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_schedule_backward_pass(p_schedule_id UUID)
RETURNS void AS $$
DECLARE
  v_schedule RECORD;
  v_task RECORD;
  v_min_start DATE;
  v_project_end DATE;
BEGIN
  -- Get schedule
  SELECT * INTO v_schedule FROM v2_schedules WHERE id = p_schedule_id;

  IF v_schedule IS NULL THEN
    RETURN;
  END IF;

  -- Find project end date (latest earliest_finish)
  SELECT MAX(earliest_finish) INTO v_project_end
  FROM v2_schedule_tasks
  WHERE schedule_id = p_schedule_id;

  -- Reset
  UPDATE v2_schedule_tasks
  SET latest_start = NULL, latest_finish = NULL, is_critical = false, total_float = 0
  WHERE schedule_id = p_schedule_id;

  -- Process tasks in reverse topological order
  FOR v_task IN
    SELECT t.*
    FROM v2_schedule_tasks t
    LEFT JOIN LATERAL (
      SELECT MIN(d.successor_id) as has_succ
      FROM v2_schedule_dependencies d
      WHERE d.predecessor_id = t.id
    ) deps ON true
    WHERE t.schedule_id = p_schedule_id
    ORDER BY
      CASE WHEN deps.has_succ IS NULL THEN 0 ELSE 1 END DESC,
      t.sort_order DESC
  LOOP
    -- Get min start date of successors
    SELECT MIN(
      CASE d.dependency_type
        WHEN 'FS' THEN add_working_days(succ.latest_start, -d.lag_days, v_schedule.work_days)
        WHEN 'SS' THEN add_working_days(succ.latest_start, -d.lag_days + v_task.estimated_days, v_schedule.work_days)
        WHEN 'FF' THEN add_working_days(succ.latest_finish, -d.lag_days, v_schedule.work_days)
        WHEN 'SF' THEN add_working_days(succ.latest_finish, -d.lag_days + v_task.estimated_days, v_schedule.work_days)
        ELSE succ.latest_start
      END
    )
    INTO v_min_start
    FROM v2_schedule_dependencies d
    JOIN v2_schedule_tasks succ ON d.successor_id = succ.id
    WHERE d.predecessor_id = v_task.id
      AND succ.latest_start IS NOT NULL;

    -- If no successors, use project end
    IF v_min_start IS NULL THEN
      v_min_start := v_project_end;
    END IF;

    -- Update task
    UPDATE v2_schedule_tasks
    SET
      latest_finish = v_min_start,
      latest_start = add_working_days(v_min_start, -(estimated_days - 1), v_schedule.work_days),
      total_float = calculate_working_days(earliest_start, latest_start, v_schedule.work_days),
      is_critical = (earliest_start = latest_start)
    WHERE id = v_task.id;
  END LOOP;

  -- Update schedule critical path duration
  UPDATE v2_schedules
  SET
    critical_path_days = calculate_working_days(
      start_date,
      (SELECT MAX(earliest_finish) FROM v2_schedule_tasks WHERE schedule_id = p_schedule_id),
      work_days
    ),
    updated_at = NOW()
  WHERE id = p_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. FUNCTION: Full schedule calculation
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_schedule(p_schedule_id UUID)
RETURNS void AS $$
BEGIN
  PERFORM calculate_schedule_forward_pass(p_schedule_id);
  PERFORM calculate_schedule_backward_pass(p_schedule_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. FUNCTION: Auto-generate schedule from selections
-- ============================================================
CREATE OR REPLACE FUNCTION generate_schedule_from_selections(
  p_job_id UUID,
  p_start_date DATE DEFAULT CURRENT_DATE,
  p_created_by TEXT DEFAULT 'System'
)
RETURNS UUID AS $$
DECLARE
  v_schedule_id UUID;
  v_prev_task_id UUID;
  v_task_id UUID;
  v_selection RECORD;
BEGIN
  -- Create schedule
  INSERT INTO v2_schedules (job_id, name, start_date, status, created_by)
  VALUES (p_job_id, 'Auto-Generated Schedule', p_start_date, 'draft', p_created_by)
  ON CONFLICT (job_id) DO UPDATE SET updated_at = NOW()
  RETURNING id INTO v_schedule_id;

  -- Clear existing auto-generated tasks
  DELETE FROM v2_schedule_tasks
  WHERE schedule_id = v_schedule_id
    AND notes LIKE 'Auto-generated from selection%';

  -- Create tasks from approved selections with lead times
  FOR v_selection IN
    SELECT
      sel.id as selection_id,
      sc.name as item_name,
      sc.lead_time_days,
      sc.install_duration_hours,
      sc.crew_size,
      cat.name as category_name,
      sel.room
    FROM v2_selections sel
    JOIN v2_allowances a ON sel.allowance_id = a.id
    JOIN v2_selection_catalog sc ON sel.catalog_item_id = sc.id
    LEFT JOIN v2_selection_categories cat ON sc.category_id = cat.id
    WHERE a.job_id = p_job_id
      AND sel.status = 'approved'
      AND sel.deleted_at IS NULL
      AND COALESCE(sc.install_duration_hours, 0) > 0
    ORDER BY
      CASE cat.name
        WHEN 'Flooring' THEN 10
        WHEN 'Cabinets' THEN 20
        WHEN 'Countertops' THEN 30
        WHEN 'Plumbing Fixtures' THEN 40
        WHEN 'Lighting' THEN 50
        WHEN 'Appliances' THEN 60
        ELSE 100
      END,
      sc.name
  LOOP
    -- Create task
    INSERT INTO v2_schedule_tasks (
      schedule_id,
      name,
      description,
      phase,
      catalog_item_id,
      estimated_days,
      crew_size,
      notes
    )
    VALUES (
      v_schedule_id,
      'Install ' || v_selection.item_name || COALESCE(' - ' || v_selection.room, ''),
      'Installation of ' || v_selection.item_name,
      v_selection.category_name,
      v_selection.selection_id,
      GREATEST(1, CEIL(COALESCE(v_selection.install_duration_hours, 8) / 8.0)),
      COALESCE(v_selection.crew_size, 1),
      'Auto-generated from selection'
    )
    RETURNING id INTO v_task_id;

    -- Add dependency to previous task (simple sequential)
    IF v_prev_task_id IS NOT NULL THEN
      INSERT INTO v2_schedule_dependencies (predecessor_id, successor_id, dependency_type, source)
      VALUES (v_prev_task_id, v_task_id, 'FS', 'auto')
      ON CONFLICT DO NOTHING;
    END IF;

    v_prev_task_id := v_task_id;
  END LOOP;

  -- Recalculate schedule
  PERFORM recalculate_schedule(v_schedule_id);

  RETURN v_schedule_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 14. TRIGGER: Recalculate on task changes
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_schedule_task_changed()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_schedule(OLD.schedule_id);
    RETURN OLD;
  ELSE
    NEW.updated_at := NOW();
    PERFORM recalculate_schedule(NEW.schedule_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_recalc_schedule_on_task ON v2_schedule_tasks;
CREATE TRIGGER trigger_recalc_schedule_on_task
  AFTER INSERT OR UPDATE OF estimated_days, constraint_type, constraint_date
  OR DELETE ON v2_schedule_tasks
  FOR EACH ROW
  EXECUTE FUNCTION trigger_schedule_task_changed();

-- ============================================================
-- 15. SEED DEFAULT TEMPLATE
-- ============================================================
INSERT INTO v2_schedule_templates (name, description, project_type, estimated_duration_days, is_default, phases)
VALUES (
  'Standard Residential Construction',
  'Typical sequence for new home construction',
  'residential',
  180,
  true,
  '[
    {"name": "Pre-Construction", "duration": 14, "tasks": ["Permits", "Site Prep", "Survey"]},
    {"name": "Foundation", "duration": 14, "tasks": ["Excavation", "Footings", "Slab/Walls", "Waterproofing"]},
    {"name": "Framing", "duration": 21, "tasks": ["Floor Framing", "Wall Framing", "Roof Framing", "Sheathing"]},
    {"name": "Dry-In", "duration": 14, "tasks": ["Roofing", "Windows", "Exterior Doors", "House Wrap"]},
    {"name": "MEP Rough", "duration": 21, "tasks": ["Plumbing Rough", "Electrical Rough", "HVAC Rough"]},
    {"name": "Insulation", "duration": 7, "tasks": ["Wall Insulation", "Attic Insulation"]},
    {"name": "Drywall", "duration": 14, "tasks": ["Hang Drywall", "Tape & Mud", "Texture"]},
    {"name": "Interior Trim", "duration": 14, "tasks": ["Doors", "Trim", "Cabinets", "Countertops"]},
    {"name": "Finishes", "duration": 21, "tasks": ["Paint", "Flooring", "Tile"]},
    {"name": "MEP Trim", "duration": 14, "tasks": ["Plumbing Fixtures", "Electrical Fixtures", "HVAC Trim"]},
    {"name": "Final", "duration": 7, "tasks": ["Punch List", "Final Clean", "Final Inspections"]}
  ]'::JSONB
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 16. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_schedules IS 'Project schedules with critical path calculation';
COMMENT ON TABLE v2_schedule_tasks IS 'Individual tasks in a schedule with dependencies and dates';
COMMENT ON TABLE v2_schedule_dependencies IS 'Task dependencies (FS, FF, SS, SF types)';
COMMENT ON TABLE v2_schedule_milestones IS 'Key project milestones to track';
COMMENT ON FUNCTION recalculate_schedule(UUID) IS 'Recalculates critical path using forward/backward pass';
COMMENT ON FUNCTION generate_schedule_from_selections(UUID, DATE, TEXT) IS 'Auto-generates schedule tasks from approved selections';
