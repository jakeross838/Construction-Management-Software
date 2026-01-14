-- Migration 007: Vendor Document URLs
-- Add URL fields for storing uploaded documents

ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS w9_url TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS license_url TEXT;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS coi_url TEXT;

COMMENT ON COLUMN v2_vendors.w9_url IS 'URL to stored W-9 document';
COMMENT ON COLUMN v2_vendors.license_url IS 'URL to stored license document';
COMMENT ON COLUMN v2_vendors.coi_url IS 'URL to stored Certificate of Insurance document';
