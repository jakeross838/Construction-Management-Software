-- Migration 009: Add paid_to_vendor tracking fields
-- Tracks when invoices have been paid to vendors (separate from draw process)

ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS paid_to_vendor BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS paid_to_vendor_date DATE;
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS paid_to_vendor_amount DECIMAL(12,2);
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS paid_to_vendor_ref TEXT;  -- check number, reference, etc.

-- Index for filtering by payment status
CREATE INDEX IF NOT EXISTS idx_invoices_paid_to_vendor ON v2_invoices(paid_to_vendor) WHERE paid_to_vendor = true;

COMMENT ON COLUMN v2_invoices.paid_to_vendor IS 'Whether invoice has been paid to the vendor';
COMMENT ON COLUMN v2_invoices.paid_to_vendor_date IS 'Date payment was made to vendor';
COMMENT ON COLUMN v2_invoices.paid_to_vendor_amount IS 'Amount paid to vendor (may differ from invoice amount)';
COMMENT ON COLUMN v2_invoices.paid_to_vendor_ref IS 'Payment reference (check number, transaction ID, etc.)';
