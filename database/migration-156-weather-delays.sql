-- Migration 156: Weather Delay Tracking
-- Date: 2026-02-01
-- Purpose: Track weather-related delays for construction schedules

-- Weather delays table
CREATE TABLE IF NOT EXISTS v2_weather_delays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id) ON DELETE SET NULL,
  delay_date DATE NOT NULL,
  weather_type TEXT NOT NULL CHECK (weather_type IN ('rain', 'wind', 'snow', 'extreme_heat', 'extreme_cold', 'storm', 'other')),
  delay_hours DECIMAL(4,2) NOT NULL CHECK (delay_hours > 0 AND delay_hours <= 24),
  impact_description TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_weather_delays_job_id ON v2_weather_delays(job_id);
CREATE INDEX IF NOT EXISTS idx_weather_delays_delay_date ON v2_weather_delays(delay_date);
CREATE INDEX IF NOT EXISTS idx_weather_delays_weather_type ON v2_weather_delays(weather_type);
CREATE INDEX IF NOT EXISTS idx_weather_delays_schedule_task_id ON v2_weather_delays(schedule_task_id);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_weather_delays_job_date ON v2_weather_delays(job_id, delay_date);

-- Comments for documentation
COMMENT ON TABLE v2_weather_delays IS 'Tracks weather-related delays that impact construction schedules';
COMMENT ON COLUMN v2_weather_delays.weather_type IS 'Type of weather: rain, wind, snow, extreme_heat, extreme_cold, storm, or other';
COMMENT ON COLUMN v2_weather_delays.delay_hours IS 'Hours of delay caused by weather (0.25 to 24)';
COMMENT ON COLUMN v2_weather_delays.schedule_task_id IS 'Optional link to specific schedule task affected';
