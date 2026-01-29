-- Migration 101: Billable/Non-Billable Invoice Support
-- Allows invoices to be marked as fully billable, partially billable, or non-billable to client
-- Non-billable amounts are absorbed by the contractor but still tracked in budget actuals

-- Add billable_amount to invoices
-- NULL = fully billable (backwards compatible, default behavior)
-- 0 = fully non-billable (contractor absorbs entire cost)
-- > 0 and < amount = partially billable (partial amount goes to draw)
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS billable_amount DECIMAL(12,2);

-- Add non_billable_reason for tracking why costs aren't being passed to client
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS non_billable_reason TEXT;

-- Common reasons:
-- 'warranty' - Warranty/callback work
-- 'overhead' - General overhead/administrative
-- 'rework' - Fix for our mistake
-- 'goodwill' - Customer satisfaction/relationship
-- 'absorbed' - Absorbed cost overrun
-- 'other' - Other reason (use notes)

-- Add billable flag to allocations for more granular control
-- If NULL, inherits from invoice billable_amount ratio
-- If explicitly set, overrides invoice-level setting for this allocation
ALTER TABLE v2_invoice_allocations ADD COLUMN IF NOT EXISTS billable BOOLEAN;
ALTER TABLE v2_invoice_allocations ADD COLUMN IF NOT EXISTS billable_amount DECIMAL(12,2);

-- Index for filtering non-billable invoices
CREATE INDEX IF NOT EXISTS idx_invoices_non_billable
  ON v2_invoices(job_id)
  WHERE billable_amount IS NOT NULL AND billable_amount < amount;

-- Comments
COMMENT ON COLUMN v2_invoices.billable_amount IS 'Amount billable to client. NULL=fully billable, 0=non-billable, partial=split';
COMMENT ON COLUMN v2_invoices.non_billable_reason IS 'Reason for non-billable amount: warranty, overhead, rework, goodwill, absorbed, other';
COMMENT ON COLUMN v2_invoice_allocations.billable IS 'Override billable status for this allocation';
COMMENT ON COLUMN v2_invoice_allocations.billable_amount IS 'Specific billable amount for this allocation';
