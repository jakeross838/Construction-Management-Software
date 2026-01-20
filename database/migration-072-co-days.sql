-- Migration 009: Change Order Days Added
-- Adds required days_added field to track schedule impact of change orders

ALTER TABLE v2_job_change_orders
  ADD COLUMN IF NOT EXISTS days_added INTEGER NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN v2_job_change_orders.days_added IS 'Number of days added (or removed if negative) to project schedule due to this change order';
