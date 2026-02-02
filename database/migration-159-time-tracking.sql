-- Migration 157: Time Tracking System
-- Mobile clock in/out with GPS validation, overtime calculations, certified payroll support

-- ============================================================
-- JOB GEOFENCES
-- Define geographic boundaries for job sites
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_job_geofences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Job Site',           -- e.g., "Main Building", "North Lot"
  center_lat DECIMAL(10, 7) NOT NULL,              -- Latitude (e.g., 27.3364347)
  center_lng DECIMAL(10, 7) NOT NULL,              -- Longitude (e.g., -82.5306527)
  radius_meters INTEGER NOT NULL DEFAULT 150,      -- Radius in meters (default 150m ~500ft)
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TIME ENTRIES
-- Clock in/out records with GPS validation
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Core references
  builder_id UUID REFERENCES v2_builders(id) ON DELETE SET NULL,  -- For multi-tenant
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES v2_users(id) ON DELETE SET NULL,        -- If using auth users
  employee_id UUID REFERENCES v2_employees(id) ON DELETE SET NULL, -- Link to employee record

  -- Time tracking
  date DATE NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,                           -- NULL if still clocked in
  break_minutes INTEGER DEFAULT 0,                 -- Total break time in minutes

  -- Calculated hours (computed on clock-out or update)
  total_hours DECIMAL(5, 2),                       -- Total worked hours minus breaks
  overtime_hours DECIMAL(5, 2) DEFAULT 0,          -- Hours over 8 for this day

  -- Cost allocation
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE SET NULL,
  task_id UUID REFERENCES v2_tasks(id) ON DELETE SET NULL,  -- Optional task link

  -- GPS data
  gps_clock_in JSONB,                              -- { lat: number, lng: number, accuracy: number, timestamp: string }
  gps_clock_out JSONB,                             -- { lat: number, lng: number, accuracy: number, timestamp: string }
  clock_in_geofence_valid BOOLEAN,                 -- Was clock-in within geofence?
  clock_out_geofence_valid BOOLEAN,                -- Was clock-out within geofence?

  -- Status and approval
  status TEXT NOT NULL DEFAULT 'pending',          -- pending, approved, rejected
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  -- Notes
  notes TEXT,

  -- Payroll
  pay_rate DECIMAL(10, 2),                         -- Hourly rate at time of entry
  regular_pay DECIMAL(10, 2),                      -- Regular hours * pay_rate
  overtime_pay DECIMAL(10, 2),                     -- OT hours * pay_rate * 1.5
  total_pay DECIMAL(10, 2),                        -- regular_pay + overtime_pay

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- TIME ENTRY ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_time_entry_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES v2_time_entries(id) ON DELETE CASCADE,
  action TEXT NOT NULL,                            -- clocked_in, clocked_out, break_started, break_ended, approved, rejected, edited
  performed_by TEXT,
  details JSONB,
  gps_location JSONB,                              -- GPS at time of action
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WEEKLY OVERTIME TRACKING VIEW
-- For calculating weekly overtime (over 40 hours)
-- ============================================================

CREATE OR REPLACE VIEW v2_weekly_hours_summary AS
SELECT
  employee_id,
  job_id,
  date_trunc('week', date) AS week_start,
  SUM(total_hours) AS total_weekly_hours,
  SUM(CASE WHEN total_hours > 8 THEN total_hours - 8 ELSE 0 END) AS daily_overtime,
  COUNT(*) AS days_worked
FROM v2_time_entries
WHERE deleted_at IS NULL
GROUP BY employee_id, job_id, date_trunc('week', date);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_time_entries_employee ON v2_time_entries(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_job ON v2_time_entries(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_date ON v2_time_entries(date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_status ON v2_time_entries(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_date ON v2_time_entries(employee_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_entries_job_date ON v2_time_entries(job_id, date) WHERE deleted_at IS NULL;
-- Note: Skipping week-based index as date_trunc is not immutable
-- Use employee_id + date index instead for weekly queries
CREATE INDEX IF NOT EXISTS idx_time_entries_employee_week ON v2_time_entries(employee_id, date) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_geofences_job ON v2_job_geofences(job_id) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_time_entry_activity_entry ON v2_time_entry_activity(time_entry_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update timestamp trigger for time_entries
CREATE OR REPLACE FUNCTION update_time_entry_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_time_entry_timestamp ON v2_time_entries;
CREATE TRIGGER set_time_entry_timestamp
  BEFORE UPDATE ON v2_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_time_entry_timestamp();

-- Update timestamp trigger for geofences
DROP TRIGGER IF EXISTS set_geofence_timestamp ON v2_job_geofences;
CREATE TRIGGER set_geofence_timestamp
  BEFORE UPDATE ON v2_job_geofences
  FOR EACH ROW
  EXECUTE FUNCTION update_time_entry_timestamp();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Calculate distance between two GPS points (Haversine formula)
CREATE OR REPLACE FUNCTION calculate_distance_meters(
  lat1 DECIMAL, lng1 DECIMAL,
  lat2 DECIMAL, lng2 DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  R DECIMAL := 6371000; -- Earth's radius in meters
  dLat DECIMAL;
  dLng DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  dLat := radians(lat2 - lat1);
  dLng := radians(lng2 - lng1);
  a := sin(dLat/2) * sin(dLat/2) + cos(radians(lat1)) * cos(radians(lat2)) * sin(dLng/2) * sin(dLng/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN R * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Check if GPS point is within a geofence
CREATE OR REPLACE FUNCTION is_within_geofence(
  gps_lat DECIMAL, gps_lng DECIMAL,
  fence_lat DECIMAL, fence_lng DECIMAL,
  fence_radius INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN calculate_distance_meters(gps_lat, gps_lng, fence_lat, fence_lng) <= fence_radius;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Calculate hours and overtime for a time entry
CREATE OR REPLACE FUNCTION calculate_time_entry_hours(
  p_clock_in TIMESTAMPTZ,
  p_clock_out TIMESTAMPTZ,
  p_break_minutes INTEGER
) RETURNS TABLE(total_hours DECIMAL, overtime_hours DECIMAL) AS $$
DECLARE
  worked_minutes DECIMAL;
  worked_hours DECIMAL;
  ot_hours DECIMAL;
BEGIN
  IF p_clock_out IS NULL THEN
    RETURN QUERY SELECT 0::DECIMAL, 0::DECIMAL;
    RETURN;
  END IF;

  worked_minutes := EXTRACT(EPOCH FROM (p_clock_out - p_clock_in)) / 60 - COALESCE(p_break_minutes, 0);
  worked_hours := ROUND((worked_minutes / 60)::DECIMAL, 2);

  -- Daily overtime: hours over 8
  IF worked_hours > 8 THEN
    ot_hours := worked_hours - 8;
  ELSE
    ot_hours := 0;
  END IF;

  RETURN QUERY SELECT worked_hours, ot_hours;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get weekly hours for an employee (for 40-hour overtime calculation)
CREATE OR REPLACE FUNCTION get_weekly_hours(
  p_employee_id UUID,
  p_date DATE
) RETURNS DECIMAL AS $$
DECLARE
  week_start DATE;
  total DECIMAL;
BEGIN
  -- Get Monday of the week
  week_start := date_trunc('week', p_date)::DATE;

  SELECT COALESCE(SUM(total_hours), 0)
  INTO total
  FROM v2_time_entries
  WHERE employee_id = p_employee_id
    AND date >= week_start
    AND date < week_start + 7
    AND deleted_at IS NULL;

  RETURN total;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CERTIFIED PAYROLL REPORT DATA
-- ============================================================

-- View for certified payroll data (Davis-Bacon compliant)
CREATE OR REPLACE VIEW v2_certified_payroll_data AS
SELECT
  te.id,
  te.job_id,
  j.name AS job_name,
  j.address AS job_address,
  te.employee_id,
  e.first_name,
  e.last_name,
  te.pay_rate AS hourly_rate,  -- Employee hourly_rate column may not exist
  te.date AS work_date,
  te.total_hours,
  te.overtime_hours,
  (te.total_hours - COALESCE(te.overtime_hours, 0)) AS regular_hours,
  te.regular_pay,
  te.overtime_pay,
  te.total_pay,
  te.cost_code_id,
  cc.code AS cost_code,
  cc.name AS cost_code_name,
  te.status,
  te.approved_by,
  te.approved_at
FROM v2_time_entries te
LEFT JOIN v2_jobs j ON te.job_id = j.id
LEFT JOIN v2_employees e ON te.employee_id = e.id
LEFT JOIN v2_cost_codes cc ON te.cost_code_id = cc.id
WHERE te.deleted_at IS NULL
  AND te.status = 'approved';

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_job_geofences IS 'Geographic boundaries for job sites, used for GPS clock-in validation';
COMMENT ON TABLE v2_time_entries IS 'Employee time tracking entries with GPS and overtime support';
COMMENT ON TABLE v2_time_entry_activity IS 'Audit log for time entry actions';
COMMENT ON COLUMN v2_time_entries.gps_clock_in IS 'GPS coordinates at clock-in: {lat, lng, accuracy, timestamp}';
COMMENT ON COLUMN v2_time_entries.clock_in_geofence_valid IS 'Whether clock-in was within job geofence';
COMMENT ON COLUMN v2_time_entries.overtime_hours IS 'Daily overtime (hours over 8 per day)';
COMMENT ON FUNCTION calculate_distance_meters IS 'Haversine formula for GPS distance calculation';
COMMENT ON FUNCTION is_within_geofence IS 'Check if GPS point is within a circular geofence';
COMMENT ON VIEW v2_certified_payroll_data IS 'Data view for certified payroll reports (Davis-Bacon)';
