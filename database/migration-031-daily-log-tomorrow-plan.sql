-- Migration 031: Add tomorrow's plan field to daily logs
-- Allows superintendent to note what's planned for the next day

ALTER TABLE v2_daily_logs
ADD COLUMN IF NOT EXISTS work_planned TEXT;

COMMENT ON COLUMN v2_daily_logs.work_planned IS 'Work planned for tomorrow / next day';
