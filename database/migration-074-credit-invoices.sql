-- Migration 026: Add invoice_type field for credit invoice support
-- Adds optional invoice_type to distinguish standard invoices from credits/memos

-- Add invoice_type field to v2_invoices
ALTER TABLE v2_invoices
ADD COLUMN IF NOT EXISTS invoice_type TEXT DEFAULT 'standard';

-- Add comment explaining field
COMMENT ON COLUMN v2_invoices.invoice_type IS 'Type of invoice: standard, credit_memo, debit_memo, adjustment';

-- Create an index for filtering by type
CREATE INDEX IF NOT EXISTS idx_invoices_type ON v2_invoices(invoice_type) WHERE deleted_at IS NULL;

-- Update existing invoices: set type based on amount sign
UPDATE v2_invoices
SET invoice_type = CASE
  WHEN amount < 0 THEN 'credit_memo'
  ELSE 'standard'
END
WHERE invoice_type IS NULL OR invoice_type = 'standard';
