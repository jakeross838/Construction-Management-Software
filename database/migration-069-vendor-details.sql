-- Migration 006: Enhanced Vendor/Subcontractor Details
-- Adds insurance tracking, licensing details, compliance fields

-- Add new columns to v2_vendors
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS contact_name TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS trade TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS license_state TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS license_expiration DATE;

-- Insurance fields
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS gl_policy_number TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS gl_expiration DATE;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS gl_coverage_amount DECIMAL(12,2);
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS wc_policy_number TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS wc_expiration DATE;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS auto_policy_number TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS auto_expiration DATE;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS coi_on_file BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS coi_url TEXT;

-- Tax & Payment
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS w9_on_file BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS w9_received_date DATE;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS payment_terms TEXT DEFAULT 'Net 30';

-- Status & Rating
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS is_preferred BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS notes TEXT;

-- Soft delete
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_vendors_status ON v2_vendors(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_trade ON v2_vendors(trade) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_gl_expiration ON v2_vendors(gl_expiration) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_vendors_wc_expiration ON v2_vendors(wc_expiration) WHERE deleted_at IS NULL;

COMMENT ON COLUMN v2_vendors.gl_policy_number IS 'General Liability insurance policy number';
COMMENT ON COLUMN v2_vendors.gl_expiration IS 'General Liability expiration date';
COMMENT ON COLUMN v2_vendors.gl_coverage_amount IS 'General Liability coverage amount';
COMMENT ON COLUMN v2_vendors.wc_policy_number IS 'Workers Compensation policy number';
COMMENT ON COLUMN v2_vendors.wc_expiration IS 'Workers Compensation expiration date';
COMMENT ON COLUMN v2_vendors.coi_on_file IS 'Certificate of Insurance document on file';
COMMENT ON COLUMN v2_vendors.coi_url IS 'URL to stored COI document';
COMMENT ON COLUMN v2_vendors.tax_id IS 'Tax ID or EIN';
COMMENT ON COLUMN v2_vendors.w9_on_file IS 'W-9 form received';
COMMENT ON COLUMN v2_vendors.payment_terms IS 'Default payment terms (Net 30, Net 15, etc)';
COMMENT ON COLUMN v2_vendors.is_preferred IS 'Preferred/approved vendor flag';
COMMENT ON COLUMN v2_vendors.rating IS 'Performance rating 1-5';

-- Additional document URL columns
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS w9_url TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS license_url TEXT;
