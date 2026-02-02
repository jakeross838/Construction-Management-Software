-- Migration 162: Task Resources for Conflict Detection
-- Date: 2026-02-01
-- Purpose: Add resource assignments to schedule tasks for conflict detection
-- Part of Phase 4 Schedule Enhancements

-- ============================================================
-- 1. TASK RESOURCES TABLE
-- ============================================================
-- Links tasks to resources (crews, equipment, subcontractors)
-- Enables conflict detection when same resource is assigned to overlapping tasks

CREATE TABLE IF NOT EXISTS v2_task_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Task reference
  task_id UUID NOT NULL REFERENCES v2_schedule_tasks(id) ON DELETE CASCADE,

  -- Resource identification
  resource_type TEXT NOT NULL CHECK (resource_type IN ('crew', 'equipment', 'subcontractor')),
  resource_id UUID NOT NULL,  -- References v2_crew_members, equipment table, or v2_vendors
  resource_name TEXT,         -- Denormalized for display

  -- Allocation
  allocation_percent INTEGER DEFAULT 100 CHECK (allocation_percent > 0 AND allocation_percent <= 100),

  -- Optional scheduling overrides (if different from task dates)
  start_date DATE,
  end_date DATE,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate resource assignments to same task
  UNIQUE(task_id, resource_type, resource_id)
);

-- ============================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_task_resources_task ON v2_task_resources(task_id);
CREATE INDEX IF NOT EXISTS idx_task_resources_resource ON v2_task_resources(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_task_resources_dates ON v2_task_resources(start_date, end_date);

-- ============================================================
-- 3. RESOURCE CONFLICTS VIEW
-- ============================================================
-- Helper view to detect overlapping resource assignments

CREATE OR REPLACE VIEW v2_resource_conflicts AS
WITH resource_assignments AS (
  SELECT
    tr.id as assignment_id,
    tr.task_id,
    tr.resource_type,
    tr.resource_id,
    tr.resource_name,
    tr.allocation_percent,
    COALESCE(tr.start_date, t.planned_start) as effective_start,
    COALESCE(tr.end_date, t.planned_end) as effective_end,
    t.name as task_name,
    t.schedule_id,
    s.job_id,
    j.name as job_name
  FROM v2_task_resources tr
  JOIN v2_schedule_tasks t ON tr.task_id = t.id
  JOIN v2_schedules s ON t.schedule_id = s.id
  JOIN v2_jobs j ON s.job_id = j.id
  WHERE t.status NOT IN ('complete', 'skipped')
    AND (tr.start_date IS NOT NULL OR t.planned_start IS NOT NULL)
    AND (tr.end_date IS NOT NULL OR t.planned_end IS NOT NULL)
)
SELECT
  a1.resource_type,
  a1.resource_id,
  a1.resource_name,
  a1.assignment_id as assignment_1_id,
  a1.task_id as task_1_id,
  a1.task_name as task_1_name,
  a1.job_id as job_1_id,
  a1.job_name as job_1_name,
  a1.effective_start as task_1_start,
  a1.effective_end as task_1_end,
  a1.allocation_percent as task_1_allocation,
  a2.assignment_id as assignment_2_id,
  a2.task_id as task_2_id,
  a2.task_name as task_2_name,
  a2.job_id as job_2_id,
  a2.job_name as job_2_name,
  a2.effective_start as task_2_start,
  a2.effective_end as task_2_end,
  a2.allocation_percent as task_2_allocation,
  -- Calculate overlap
  GREATEST(a1.effective_start, a2.effective_start) as overlap_start,
  LEAST(a1.effective_end, a2.effective_end) as overlap_end,
  a1.allocation_percent + a2.allocation_percent as total_allocation,
  -- Determine severity
  CASE
    WHEN a1.allocation_percent + a2.allocation_percent > 100 THEN 'critical'
    ELSE 'warning'
  END as severity
FROM resource_assignments a1
JOIN resource_assignments a2 ON
  a1.resource_type = a2.resource_type
  AND a1.resource_id = a2.resource_id
  AND a1.assignment_id < a2.assignment_id  -- Avoid duplicates and self-joins
  AND a1.effective_start <= a2.effective_end
  AND a2.effective_start <= a1.effective_end;

-- ============================================================
-- 4. FUNCTION: Check resource availability
-- ============================================================

CREATE OR REPLACE FUNCTION check_resource_availability(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_exclude_task_id UUID DEFAULT NULL
)
RETURNS TABLE (
  date DATE,
  total_allocation INTEGER,
  is_overallocated BOOLEAN,
  task_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date as check_date
  ),
  daily_allocation AS (
    SELECT
      ds.check_date,
      COALESCE(SUM(tr.allocation_percent), 0)::integer as total_alloc,
      COUNT(tr.id)::integer as task_cnt
    FROM date_series ds
    LEFT JOIN v2_task_resources tr ON
      tr.resource_type = p_resource_type
      AND tr.resource_id = p_resource_id
      AND (p_exclude_task_id IS NULL OR tr.task_id != p_exclude_task_id)
    LEFT JOIN v2_schedule_tasks t ON tr.task_id = t.id
    WHERE (
      COALESCE(tr.start_date, t.planned_start) <= ds.check_date
      AND COALESCE(tr.end_date, t.planned_end) >= ds.check_date
      AND t.status NOT IN ('complete', 'skipped')
    ) OR tr.id IS NULL
    GROUP BY ds.check_date
  )
  SELECT
    da.check_date as date,
    da.total_alloc as total_allocation,
    da.total_alloc > 100 as is_overallocated,
    da.task_cnt as task_count
  FROM daily_allocation da
  ORDER BY da.check_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 5. FUNCTION: Get conflicts for a job
-- ============================================================

CREATE OR REPLACE FUNCTION get_job_resource_conflicts(p_job_id UUID)
RETURNS TABLE (
  conflict_id TEXT,
  resource_type TEXT,
  resource_id UUID,
  resource_name TEXT,
  task_1_id UUID,
  task_1_name TEXT,
  task_2_id UUID,
  task_2_name TEXT,
  overlap_start DATE,
  overlap_end DATE,
  total_allocation INTEGER,
  severity TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.assignment_1_id::text || '-' || rc.assignment_2_id::text as conflict_id,
    rc.resource_type,
    rc.resource_id,
    rc.resource_name,
    rc.task_1_id,
    rc.task_1_name,
    rc.task_2_id,
    rc.task_2_name,
    rc.overlap_start,
    rc.overlap_end,
    rc.total_allocation::integer,
    rc.severity
  FROM v2_resource_conflicts rc
  WHERE rc.job_1_id = p_job_id OR rc.job_2_id = p_job_id
  ORDER BY
    CASE rc.severity WHEN 'critical' THEN 1 ELSE 2 END,
    rc.overlap_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. FUNCTION: Get all conflicts across active jobs
-- ============================================================

CREATE OR REPLACE FUNCTION get_all_resource_conflicts()
RETURNS TABLE (
  conflict_id TEXT,
  resource_type TEXT,
  resource_id UUID,
  resource_name TEXT,
  task_1_id UUID,
  task_1_name TEXT,
  job_1_id UUID,
  job_1_name TEXT,
  task_2_id UUID,
  task_2_name TEXT,
  job_2_id UUID,
  job_2_name TEXT,
  overlap_start DATE,
  overlap_end DATE,
  total_allocation INTEGER,
  severity TEXT,
  is_cross_job BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.assignment_1_id::text || '-' || rc.assignment_2_id::text as conflict_id,
    rc.resource_type,
    rc.resource_id,
    rc.resource_name,
    rc.task_1_id,
    rc.task_1_name,
    rc.job_1_id,
    rc.job_1_name,
    rc.task_2_id,
    rc.task_2_name,
    rc.job_2_id,
    rc.job_2_name,
    rc.overlap_start,
    rc.overlap_end,
    rc.total_allocation::integer,
    rc.severity,
    rc.job_1_id != rc.job_2_id as is_cross_job
  FROM v2_resource_conflicts rc
  ORDER BY
    CASE rc.severity WHEN 'critical' THEN 1 ELSE 2 END,
    rc.job_1_id != rc.job_2_id DESC,  -- Cross-job conflicts first
    rc.overlap_start;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. UPDATE TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION trigger_task_resources_updated()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_task_resources_update ON v2_task_resources;
CREATE TRIGGER trigger_task_resources_update
  BEFORE UPDATE ON v2_task_resources
  FOR EACH ROW
  EXECUTE FUNCTION trigger_task_resources_updated();

-- ============================================================
-- 8. COMMENTS
-- ============================================================

COMMENT ON TABLE v2_task_resources IS 'Resource assignments to schedule tasks for conflict detection';
COMMENT ON VIEW v2_resource_conflicts IS 'View showing overlapping resource assignments across tasks';
COMMENT ON FUNCTION check_resource_availability IS 'Check daily allocation for a resource over a date range';
COMMENT ON FUNCTION get_job_resource_conflicts IS 'Get resource conflicts for a specific job';
COMMENT ON FUNCTION get_all_resource_conflicts IS 'Get all resource conflicts across active jobs';
