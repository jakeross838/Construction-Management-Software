-- Migration 030: Add absent crews tracking to daily logs
-- Tracks crews that were scheduled but didn't show up

-- Add absent_crews JSONB column to v2_daily_logs
ALTER TABLE v2_daily_logs
ADD COLUMN IF NOT EXISTS absent_crews JSONB;

-- Comment explaining the structure
COMMENT ON COLUMN v2_daily_logs.absent_crews IS 'JSON array of crews that were scheduled but did not show. Structure: [{vendor_id, trade, reason}]';
