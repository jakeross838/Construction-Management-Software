-- Migration 032: Replace equipment tracking with simple dumpster exchange checkbox
-- Date: 2026-01-16

-- Add dumpster_exchange boolean column to daily logs
ALTER TABLE v2_daily_logs
ADD COLUMN IF NOT EXISTS dumpster_exchange BOOLEAN DEFAULT FALSE;

-- The v2_daily_log_equipment table can remain for historical data but is no longer used
