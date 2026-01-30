-- Migration 129: Bid Packages Restructure
-- Transform v2_bids into "Bid Packages" and use v2_subcontractor_bids for vendor submissions

-- ============================================================
-- PHASE 1: Add package fields to v2_bids
-- ============================================================

ALTER TABLE v2_bids
  ADD COLUMN IF NOT EXISTS package_number TEXT,
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS trade_category TEXT,
  ADD COLUMN IF NOT EXISTS awarded_vendor_id UUID REFERENCES v2_vendors(id),
  ADD COLUMN IF NOT EXISTS awarded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS awarded_amount DECIMAL(14,2);

-- Update status constraint
DO $$ BEGIN
  ALTER TABLE v2_bids DROP CONSTRAINT IF EXISTS v2_bids_status_check;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE v2_bids ADD CONSTRAINT v2_bids_status_check
  CHECK (status IN ('draft', 'issued', 'receiving', 'evaluating', 'awarded', 'cancelled', 'received', 'under_review', 'accepted', 'rejected', 'withdrawn'));

-- ============================================================
-- PHASE 2: Update v2_subcontractor_bids to reference v2_bids
-- ============================================================

-- Drop the existing FK constraint (was referencing v2_bid_packages)
ALTER TABLE v2_subcontractor_bids
  DROP CONSTRAINT IF EXISTS v2_subcontractor_bids_bid_package_id_fkey;

-- Add new FK to v2_bids
ALTER TABLE v2_subcontractor_bids
  ADD CONSTRAINT v2_subcontractor_bids_bid_package_id_fkey
  FOREIGN KEY (bid_package_id) REFERENCES v2_bids(id) ON DELETE CASCADE;

-- Also update invites table
ALTER TABLE v2_bid_package_invites
  DROP CONSTRAINT IF EXISTS v2_bid_package_invites_bid_package_id_fkey;

ALTER TABLE v2_bid_package_invites
  ADD CONSTRAINT v2_bid_package_invites_bid_package_id_fkey
  FOREIGN KEY (bid_package_id) REFERENCES v2_bids(id) ON DELETE CASCADE;

-- ============================================================
-- PHASE 3: Migrate existing bid data
-- ============================================================

-- Update awarded packages from accepted bids
UPDATE v2_bids SET
  awarded_vendor_id = vendor_id,
  awarded_amount = bid_amount,
  awarded_at = COALESCE(updated_at, created_at),
  status = 'awarded'
WHERE status = 'accepted'
  AND vendor_id IS NOT NULL
  AND awarded_vendor_id IS NULL;

-- Extract trade category from title
UPDATE v2_bids SET trade_category =
  CASE
    WHEN title ILIKE '%framing%' THEN 'Wood & Plastics'
    WHEN title ILIKE '%concrete%' OR title ILIKE '%masonry%' THEN 'Concrete'
    WHEN title ILIKE '%electrical%' THEN 'Electrical'
    WHEN title ILIKE '%plumbing%' THEN 'Plumbing'
    WHEN title ILIKE '%hvac%' OR title ILIKE '%air condition%' OR title ILIKE '%captain cool%' THEN 'HVAC'
    WHEN title ILIKE '%roofing%' OR title ILIKE '%roof%' THEN 'Roofing'
    WHEN title ILIKE '%drywall%' THEN 'Drywall'
    WHEN title ILIKE '%window%' OR title ILIKE '%door%' THEN 'Doors & Windows'
    WHEN title ILIKE '%pool%' OR title ILIKE '%spa%' THEN 'Pool'
    WHEN title ILIKE '%paint%' THEN 'Painting'
    WHEN title ILIKE '%flooring%' OR title ILIKE '%tile%' THEN 'Flooring'
    WHEN title ILIKE '%cabinet%' OR title ILIKE '%millwork%' THEN 'Cabinets & Millwork'
    WHEN title ILIKE '%landscap%' THEN 'Landscaping'
    WHEN title ILIKE '%insulation%' THEN 'Insulation'
    WHEN title ILIKE '%siding%' THEN 'Thermal & Moisture'
    ELSE 'Other'
  END
WHERE trade_category IS NULL;

-- Copy trade_type to trade_category if set
UPDATE v2_bids
SET trade_category = trade_type
WHERE trade_category IS NULL AND trade_type IS NOT NULL;

-- Generate package numbers
WITH numbered_bids AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at) as rnum,
    EXTRACT(YEAR FROM created_at) as yr
  FROM v2_bids
  WHERE package_number IS NULL AND deleted_at IS NULL
)
UPDATE v2_bids b
SET package_number = 'BP-' || SUBSTRING(nb.yr::TEXT, 3, 2) || '-' || LPAD(nb.rnum::TEXT, 4, '0')
FROM numbered_bids nb
WHERE b.id = nb.id;

-- ============================================================
-- PHASE 4: Create subcontractor_bid records from existing data
-- ============================================================

INSERT INTO v2_subcontractor_bids (bid_package_id, vendor_id, bid_amount, status, submitted_at, created_at)
SELECT
  b.id,
  b.vendor_id,
  b.bid_amount,
  CASE
    WHEN b.status = 'awarded' THEN 'selected'
    WHEN b.status = 'accepted' THEN 'selected'
    WHEN b.status = 'rejected' THEN 'rejected'
    WHEN b.status = 'withdrawn' THEN 'withdrawn'
    ELSE 'submitted'
  END,
  COALESCE(b.received_date::timestamptz, b.created_at),
  b.created_at
FROM v2_bids b
WHERE b.vendor_id IS NOT NULL
  AND b.bid_amount IS NOT NULL
  AND b.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM v2_subcontractor_bids sb
    WHERE sb.bid_package_id = b.id AND sb.vendor_id = b.vendor_id
  );

-- ============================================================
-- PHASE 5: Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bids_package_number ON v2_bids(package_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bids_trade_category ON v2_bids(trade_category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bids_awarded_vendor ON v2_bids(awarded_vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_subcontractor_bids_package ON v2_subcontractor_bids(bid_package_id);
CREATE INDEX IF NOT EXISTS idx_subcontractor_bids_vendor ON v2_subcontractor_bids(vendor_id);

-- ============================================================
-- PHASE 6: Fix bid package titles
-- ============================================================

-- Remove vendor names from titles: "Plumbing - Loftin Plumbing" becomes "Plumbing"
UPDATE v2_bids
SET
  title = SPLIT_PART(title, ' - ', 1),
  updated_at = NOW()
WHERE deleted_at IS NULL
  AND title LIKE '% - %'
  AND SPLIT_PART(title, ' - ', 2) != '';

-- ============================================================
-- PHASE 7: Create subcontractor bid documents table
-- ============================================================

-- Vendor proposals/documents belong on their submission, not the package
CREATE TABLE IF NOT EXISTS v2_subcontractor_bid_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_bid_id UUID NOT NULL REFERENCES v2_subcontractor_bids(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  document_type TEXT DEFAULT 'proposal', -- proposal, quote, schedule, insurance, other
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sub_bid_docs_bid ON v2_subcontractor_bid_documents(subcontractor_bid_id);

-- Migrate vendor proposals from bid_documents to subcontractor_bid_documents
INSERT INTO v2_subcontractor_bid_documents (subcontractor_bid_id, file_url, file_name, file_size, uploaded_by, uploaded_at)
SELECT
  sb.id as subcontractor_bid_id,
  bd.file_url,
  bd.file_name,
  bd.file_size,
  bd.uploaded_by,
  bd.uploaded_at
FROM v2_bid_documents bd
JOIN v2_bids b ON bd.bid_id = b.id
JOIN v2_subcontractor_bids sb ON sb.bid_package_id = b.id AND sb.vendor_id = b.vendor_id
WHERE b.deleted_at IS NULL
  AND b.vendor_id IS NOT NULL;

-- Remove migrated documents from bid_documents (they're now on sub bids)
DELETE FROM v2_bid_documents
WHERE bid_id IN (
  SELECT b.id FROM v2_bids b
  WHERE b.vendor_id IS NOT NULL AND b.deleted_at IS NULL
);
