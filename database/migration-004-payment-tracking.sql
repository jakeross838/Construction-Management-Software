-- Migration 004: Payment Tracking and Close-Out Support
-- Adds columns to track partial payments and invoice close-outs

-- Track cumulative amount paid across all draws
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0;

-- Track close-out information for partial invoices
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS closed_out_at TIMESTAMPTZ;
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS closed_out_by TEXT;
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS closed_out_reason TEXT;
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS write_off_amount DECIMAL(12,2);

-- Add index for querying partially paid invoices
CREATE INDEX IF NOT EXISTS idx_invoices_paid_amount ON v2_invoices(paid_amount);
CREATE INDEX IF NOT EXISTS idx_invoices_closed_out ON v2_invoices(closed_out_at) WHERE closed_out_at IS NOT NULL;
