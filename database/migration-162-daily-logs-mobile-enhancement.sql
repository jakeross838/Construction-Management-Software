-- Migration 162: Daily Logs Mobile Enhancement (Phase 5)
-- Adds GPS location tagging, voice notes, and enhanced weather data

-- ============================================================
-- 1. ADD NEW COLUMNS TO v2_daily_logs
-- ============================================================

-- Weather data from API (auto-fetched, more detailed than manual entry)
ALTER TABLE v2_daily_logs
ADD COLUMN IF NOT EXISTS weather_data JSONB;

COMMENT ON COLUMN v2_daily_logs.weather_data IS 'Auto-fetched weather from OpenWeatherMap API: { temp_high, temp_low, conditions, precipitation, wind_speed, humidity, fetched_at }';

-- GPS location (lat/lng from mobile device)
ALTER TABLE v2_daily_logs
ADD COLUMN IF NOT EXISTS gps_location JSONB;

COMMENT ON COLUMN v2_daily_logs.gps_location IS 'GPS coordinates from mobile: { lat, lng, accuracy, captured_at }';

-- Voice notes URL (stored in Supabase storage)
ALTER TABLE v2_daily_logs
ADD COLUMN IF NOT EXISTS voice_notes_url TEXT;

COMMENT ON COLUMN v2_daily_logs.voice_notes_url IS 'URL to voice note audio file in Supabase storage';

-- Transcribed notes from voice (AI transcription)
ALTER TABLE v2_daily_logs
ADD COLUMN IF NOT EXISTS transcribed_notes TEXT;

COMMENT ON COLUMN v2_daily_logs.transcribed_notes IS 'AI-transcribed text from voice notes';

-- ============================================================
-- 2. CREW TIME TRACKING TABLE
-- Links daily log crew entries to timesheet/time tracking system
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_daily_log_time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES v2_daily_logs(id) ON DELETE CASCADE,
  crew_entry_id UUID REFERENCES v2_daily_log_crew(id) ON DELETE SET NULL,

  -- Worker identification
  worker_name TEXT NOT NULL,
  worker_id UUID,  -- If linked to v2_crew_members or v2_employees

  -- Time tracking
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  break_minutes INTEGER DEFAULT 0,
  total_hours DECIMAL(5,2),

  -- Work details
  trade TEXT,
  work_area TEXT,
  task_description TEXT,

  -- GPS for clock in/out
  clock_in_location JSONB,
  clock_out_location JSONB,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'adjusted', 'void')),

  -- Approvals
  approved BOOLEAN DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,

  -- Notes
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_log_time_entries_log ON v2_daily_log_time_entries(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_time_entries_worker ON v2_daily_log_time_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_time_entries_date ON v2_daily_log_time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_daily_log_time_entries_status ON v2_daily_log_time_entries(status) WHERE status = 'active';

COMMENT ON TABLE v2_daily_log_time_entries IS 'Individual time entries for crew members on daily logs - links to crew entries and time tracking';

-- ============================================================
-- 3. ADD INDEX FOR GPS SEARCHES
-- ============================================================

-- For finding logs near a location (using JSONB extraction)
CREATE INDEX IF NOT EXISTS idx_daily_logs_gps ON v2_daily_logs
  USING GIN (gps_location jsonb_path_ops)
  WHERE gps_location IS NOT NULL;

-- ============================================================
-- 4. ADD COLUMNS TO v2_daily_log_crew FOR TIME TRACKING
-- ============================================================

-- Link to time tracking system
ALTER TABLE v2_daily_log_crew
ADD COLUMN IF NOT EXISTS time_entry_id UUID;

-- Start/end times for the crew entry
ALTER TABLE v2_daily_log_crew
ADD COLUMN IF NOT EXISTS start_time TIME;

ALTER TABLE v2_daily_log_crew
ADD COLUMN IF NOT EXISTS end_time TIME;

-- GPS location when logging this crew entry
ALTER TABLE v2_daily_log_crew
ADD COLUMN IF NOT EXISTS gps_location JSONB;

COMMENT ON COLUMN v2_daily_log_crew.time_entry_id IS 'Link to timesheet/time tracking entry if using integrated time tracking';
COMMENT ON COLUMN v2_daily_log_crew.start_time IS 'Start time of work for this crew entry';
COMMENT ON COLUMN v2_daily_log_crew.end_time IS 'End time of work for this crew entry';
COMMENT ON COLUMN v2_daily_log_crew.gps_location IS 'GPS coordinates when crew entry was logged from mobile';
