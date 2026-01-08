-- Migration 006: Billing Tracking
-- Adds columns to properly track partial billing flow

-- Add billed_amount to invoices to track cumulative billing across draws
ALTER TABLE v2_invoices
ADD COLUMN IF NOT EXISTS billed_amount DECIMAL(12,2) DEFAULT 0;

-- Add comment explaining the field
COMMENT ON COLUMN v2_invoices.billed_amount IS
'Cumulative amount billed across all submitted draws. Updated on draw submit. Different from paid_amount which is updated on draw fund.';

-- Add funding_difference to draws to track partial funding
ALTER TABLE v2_draws
ADD COLUMN IF NOT EXISTS funding_difference DECIMAL(12,2) DEFAULT 0;

-- Add partial_funding_note for explanations
ALTER TABLE v2_draws
ADD COLUMN IF NOT EXISTS partial_funding_note TEXT;

-- Add comment explaining the fields
COMMENT ON COLUMN v2_draws.funding_difference IS
'Difference between total_amount (billed) and funded_amount (paid). Negative = partial funding, Positive = overfunding/credit.';

COMMENT ON COLUMN v2_draws.partial_funding_note IS
'Explanation for partial funding or overfunding situations.';

-- Index for faster lookups of partially billed invoices
CREATE INDEX IF NOT EXISTS idx_invoices_billed_amount
ON v2_invoices(billed_amount)
WHERE billed_amount > 0 AND billed_amount < amount;
