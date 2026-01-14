-- Migration 021: Add change_order_id to invoice allocations
-- Allows tracking whether an allocation is for base budget or change order work

-- Add change_order_id column to invoice allocations
-- NULL = base budget work, UUID = allocation is for specific change order
ALTER TABLE v2_invoice_allocations
  ADD COLUMN IF NOT EXISTS change_order_id UUID REFERENCES v2_job_change_orders(id) ON DELETE SET NULL;

-- Index for efficient queries by change order
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_co_id ON v2_invoice_allocations(change_order_id);

-- Add invoiced_amount tracking to change orders (sum of allocations linked to this CO)
ALTER TABLE v2_job_change_orders
  ADD COLUMN IF NOT EXISTS invoiced_amount DECIMAL(12,2) DEFAULT 0;
