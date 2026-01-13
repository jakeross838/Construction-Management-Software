-- Migration 019: Lien Releases
-- Track lien waivers from vendors - documents that waive mechanic's lien rights

-- Main lien releases table
CREATE TABLE IF NOT EXISTS v2_lien_releases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID REFERENCES v2_jobs(id),
  vendor_id UUID REFERENCES v2_vendors(id),
  draw_id UUID REFERENCES v2_draws(id),  -- Optional, can be standalone

  -- Release Details
  release_type TEXT NOT NULL CHECK (release_type IN (
    'conditional_progress',
    'unconditional_progress',
    'conditional_final',
    'unconditional_final'
  )),
  release_date DATE,
  through_date DATE,           -- Date through which work is covered
  amount DECIMAL(12,2),        -- Amount being released

  -- PDF Storage
  pdf_url TEXT,

  -- AI Processing
  ai_processed BOOLEAN DEFAULT false,
  ai_confidence JSONB,         -- {vendor: 0.95, job: 0.80, amount: 0.99, ...}
  ai_extracted_data JSONB,     -- Raw extraction data

  -- Status & Review
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'verified', 'attached')),
  needs_review BOOLEAN DEFAULT false,
  review_flags TEXT[],

  -- Notary Info (extracted)
  notary_name TEXT,
  notary_county TEXT,
  notary_expiration DATE,
  signer_name TEXT,
  signer_title TEXT,

  -- Metadata
  notes TEXT,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  deleted_at TIMESTAMPTZ
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_lien_releases_job ON v2_lien_releases(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lien_releases_vendor ON v2_lien_releases(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lien_releases_draw ON v2_lien_releases(draw_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lien_releases_status ON v2_lien_releases(status) WHERE deleted_at IS NULL;

-- Activity log for lien releases
CREATE TABLE IF NOT EXISTS v2_lien_release_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lien_release_id UUID NOT NULL REFERENCES v2_lien_releases(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lien_release_activity_release
  ON v2_lien_release_activity(lien_release_id);

-- Comments
COMMENT ON TABLE v2_lien_releases IS 'Lien release/waiver documents from vendors';
COMMENT ON COLUMN v2_lien_releases.release_type IS 'Type: conditional_progress, unconditional_progress, conditional_final, unconditional_final';
COMMENT ON COLUMN v2_lien_releases.through_date IS 'Date through which work/payment is covered by this release';
COMMENT ON COLUMN v2_lien_releases.draw_id IS 'Optional - release can be standalone or attached to a draw';
COMMENT ON TABLE v2_lien_release_activity IS 'Audit log for lien release actions';
