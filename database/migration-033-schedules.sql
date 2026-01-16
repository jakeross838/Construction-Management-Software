-- Migration 033: Schedule Module
-- Date: 2026-01-16
-- Purpose: Add schedule tracking tables for construction project management

-- Main schedule (one per job)
CREATE TABLE IF NOT EXISTS v2_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  name TEXT DEFAULT 'Master Schedule',
  status TEXT DEFAULT 'draft',  -- draft, active, completed
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(job_id)  -- One schedule per job
);

-- Schedule tasks (phases/activities)
CREATE TABLE IF NOT EXISTS v2_schedule_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES v2_schedules(id) ON DELETE CASCADE,

  -- Task identity
  name TEXT NOT NULL,
  description TEXT,
  trade TEXT,                    -- Links to trades list (Framing, Electrical, etc.)
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  construction_phase TEXT,       -- Links to construction phases

  -- Timing
  planned_start DATE,
  planned_end DATE,
  planned_duration_days INTEGER,
  actual_start DATE,
  actual_end DATE,
  actual_duration_days INTEGER,

  -- Progress (updated from daily logs)
  status TEXT DEFAULT 'pending', -- pending, in_progress, completed, blocked
  completion_percent INTEGER DEFAULT 0,

  -- Dependencies (array of task IDs this depends on)
  depends_on UUID[],

  -- Assignment
  vendor_id UUID REFERENCES v2_vendors(id),
  po_id UUID REFERENCES v2_purchase_orders(id),

  -- Ordering
  sort_order INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link daily log crew entries to schedule tasks
ALTER TABLE v2_daily_log_crew
ADD COLUMN IF NOT EXISTS schedule_task_id UUID REFERENCES v2_schedule_tasks(id);

-- Schedule activity log
CREATE TABLE IF NOT EXISTS v2_schedule_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES v2_schedules(id) ON DELETE CASCADE,
  task_id UUID REFERENCES v2_schedule_tasks(id),
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedules_job_id ON v2_schedules(job_id);
CREATE INDEX IF NOT EXISTS idx_schedules_status ON v2_schedules(status);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_schedule_id ON v2_schedule_tasks(schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_trade ON v2_schedule_tasks(trade);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_status ON v2_schedule_tasks(status);
CREATE INDEX IF NOT EXISTS idx_schedule_tasks_planned_start ON v2_schedule_tasks(planned_start);
CREATE INDEX IF NOT EXISTS idx_daily_log_crew_task ON v2_daily_log_crew(schedule_task_id);
CREATE INDEX IF NOT EXISTS idx_schedule_activity_schedule ON v2_schedule_activity(schedule_id);
