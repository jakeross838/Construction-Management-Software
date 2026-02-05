-- Migration 174: Time Clock Tables for Mobile PWA
-- Phase 1.1b: Time Clock with GPS Tracking

-- Time Clock Entries table
CREATE TABLE IF NOT EXISTS v2_time_clock_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Clock times
  clock_in_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  clock_out_time TIMESTAMPTZ,

  -- GPS coordinates at clock in/out
  clock_in_latitude DECIMAL(10, 8),
  clock_in_longitude DECIMAL(11, 8),
  clock_out_latitude DECIMAL(10, 8),
  clock_out_longitude DECIMAL(11, 8),

  -- Current location (updated periodically while clocked in)
  current_latitude DECIMAL(10, 8),
  current_longitude DECIMAL(11, 8),
  last_location_update TIMESTAMPTZ,

  -- Tracking status
  tracking_status TEXT DEFAULT 'active' CHECK (tracking_status IN ('active', 'paused', 'stopped')),

  -- Calculated fields (updated on clock out)
  total_hours DECIMAL(5, 2),
  total_break_minutes INTEGER DEFAULT 0,

  -- Notes
  notes TEXT,

  -- Offline sync tracking
  offline_created BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time Clock Breaks table
CREATE TABLE IF NOT EXISTS v2_time_clock_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_clock_entry_id UUID NOT NULL REFERENCES v2_time_clock_entries(id) ON DELETE CASCADE,

  break_start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  break_end_time TIMESTAMPTZ,

  -- Break duration in minutes (calculated on end)
  duration_minutes INTEGER,

  -- Break type
  break_type TEXT DEFAULT 'lunch' CHECK (break_type IN ('lunch', 'rest', 'other')),

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Location History (for GPS tracking throughout the day)
CREATE TABLE IF NOT EXISTS v2_time_clock_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_clock_entry_id UUID NOT NULL REFERENCES v2_time_clock_entries(id) ON DELETE CASCADE,

  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(6, 2), -- GPS accuracy in meters

  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_user_id ON v2_time_clock_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_job_id ON v2_time_clock_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_clock_in ON v2_time_clock_entries(clock_in_time);
CREATE INDEX IF NOT EXISTS idx_time_clock_entries_active ON v2_time_clock_entries(user_id) WHERE clock_out_time IS NULL;
CREATE INDEX IF NOT EXISTS idx_time_clock_breaks_entry ON v2_time_clock_breaks(time_clock_entry_id);
CREATE INDEX IF NOT EXISTS idx_time_clock_locations_entry ON v2_time_clock_locations(time_clock_entry_id);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_time_clock_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER time_clock_entries_updated_at
  BEFORE UPDATE ON v2_time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION update_time_clock_updated_at();

CREATE TRIGGER time_clock_breaks_updated_at
  BEFORE UPDATE ON v2_time_clock_breaks
  FOR EACH ROW EXECUTE FUNCTION update_time_clock_updated_at();

-- Function to calculate total hours on clock out
CREATE OR REPLACE FUNCTION calculate_time_clock_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NULL THEN
    -- Calculate total hours worked
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600;

    -- Calculate total break minutes
    SELECT COALESCE(SUM(duration_minutes), 0) INTO NEW.total_break_minutes
    FROM v2_time_clock_breaks
    WHERE time_clock_entry_id = NEW.id AND duration_minutes IS NOT NULL;

    -- Subtract breaks from total
    NEW.total_hours = NEW.total_hours - (NEW.total_break_minutes / 60.0);

    -- Update tracking status
    NEW.tracking_status = 'stopped';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_hours_on_clock_out
  BEFORE UPDATE ON v2_time_clock_entries
  FOR EACH ROW EXECUTE FUNCTION calculate_time_clock_hours();

-- Function to calculate break duration on end
CREATE OR REPLACE FUNCTION calculate_break_duration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.break_end_time IS NOT NULL AND OLD.break_end_time IS NULL THEN
    NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.break_end_time - NEW.break_start_time)) / 60;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_break_duration_on_end
  BEFORE UPDATE ON v2_time_clock_breaks
  FOR EACH ROW EXECUTE FUNCTION calculate_break_duration();

-- Enable RLS
ALTER TABLE v2_time_clock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_time_clock_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_time_clock_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can see their own entries, managers can see their team
CREATE POLICY "Users can view own time entries"
  ON v2_time_clock_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own time entries"
  ON v2_time_clock_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own time entries"
  ON v2_time_clock_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own breaks"
  ON v2_time_clock_breaks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM v2_time_clock_entries e
    WHERE e.id = time_clock_entry_id AND e.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own breaks"
  ON v2_time_clock_breaks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM v2_time_clock_entries e
    WHERE e.id = time_clock_entry_id AND e.user_id = auth.uid()
  ));

CREATE POLICY "Users can view own locations"
  ON v2_time_clock_locations FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM v2_time_clock_entries e
    WHERE e.id = time_clock_entry_id AND e.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert own locations"
  ON v2_time_clock_locations FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM v2_time_clock_entries e
    WHERE e.id = time_clock_entry_id AND e.user_id = auth.uid()
  ));

COMMENT ON TABLE v2_time_clock_entries IS 'Mobile time clock entries with GPS tracking';
COMMENT ON TABLE v2_time_clock_breaks IS 'Break periods within time clock entries';
COMMENT ON TABLE v2_time_clock_locations IS 'GPS location history during active time clock sessions';
