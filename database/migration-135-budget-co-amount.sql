-- Migration 135: Add change_order_amount to budget lines
-- Tracks CO amounts separately from base committed_amount

ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS change_order_amount DECIMAL(12,2) DEFAULT 0;

COMMENT ON COLUMN v2_budget_lines.change_order_amount IS 'Total approved change order amounts for this cost code';

-- Note: Total commitment = committed_amount (base PO) + change_order_amount (COs)
-- This allows tracking original budget vs CO adjustments
