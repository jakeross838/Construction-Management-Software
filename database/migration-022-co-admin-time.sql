-- Migration 022: Add admin/management time tracking to change orders
-- Allows tracking time spent coordinating and managing change order work

-- Add admin time columns to change orders table
ALTER TABLE v2_job_change_orders
  ADD COLUMN IF NOT EXISTS admin_hours DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS admin_rate DECIMAL(10,2) DEFAULT 85,
  ADD COLUMN IF NOT EXISTS admin_cost DECIMAL(12,2) DEFAULT 0;

-- Add comment explaining the fields
COMMENT ON COLUMN v2_job_change_orders.admin_hours IS 'Hours spent on admin/management for this CO';
COMMENT ON COLUMN v2_job_change_orders.admin_rate IS 'Hourly rate for admin time';
COMMENT ON COLUMN v2_job_change_orders.admin_cost IS 'Calculated admin cost (hours * rate)';
