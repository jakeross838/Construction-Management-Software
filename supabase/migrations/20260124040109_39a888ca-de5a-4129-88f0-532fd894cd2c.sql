-- Add new columns to change_orders table for enhanced CO tracking
ALTER TABLE public.change_orders
ADD COLUMN IF NOT EXISTS days_impact integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS pm_hours numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pm_hourly_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pm_cost numeric DEFAULT 0;