-- Migration 040: Remove Retainage Tracking
-- Removes retainage columns from purchase orders table

-- Drop retainage columns from v2_purchase_orders
ALTER TABLE v2_purchase_orders
  DROP COLUMN IF EXISTS retainage_percent,
  DROP COLUMN IF EXISTS retainage_held,
  DROP COLUMN IF EXISTS retainage_released_at,
  DROP COLUMN IF EXISTS retainage_released_by;
