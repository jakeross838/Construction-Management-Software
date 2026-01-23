-- Migration 120: Proposal Generation (Phase 109)
-- Stores generated proposals with sharing and acceptance tracking

-- ============================================================
-- 1. PROPOSALS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to estimate and job
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Proposal metadata
  proposal_number TEXT UNIQUE,
  title TEXT,
  version INTEGER DEFAULT 1,

  -- Content options (PRO-03: detail level)
  detail_level TEXT DEFAULT 'summary' CHECK (detail_level IN ('line_items', 'summary')),
  show_allowances BOOLEAN DEFAULT true,

  -- Payment terms (PRO-04: copied at generation for snapshot)
  payment_terms JSONB,  -- [{milestone: "Deposit", percent: 50}, ...]
  terms_text TEXT,      -- Free-form terms/conditions text

  -- Generated PDF
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Sharing (PRO-06: secure link)
  share_token TEXT,
  share_expires_at TIMESTAMPTZ,
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  -- Client acceptance (PRO-07)
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired')),
  accepted_at TIMESTAMPTZ,
  accepted_by_name TEXT,
  accepted_by_email TEXT,
  accepted_ip TEXT,
  acceptance_notes TEXT,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. PROPOSAL NUMBER GENERATION
-- ============================================================
-- Format: PRP-YY-XXXX (e.g., PRP-26-0001)

CREATE OR REPLACE FUNCTION generate_proposal_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  IF NEW.proposal_number IS NULL THEN
    year_part := TO_CHAR(NOW(), 'YY');

    SELECT COALESCE(MAX(
      CASE WHEN proposal_number ~ '^PRP-[0-9]{2}-[0-9]+$'
      THEN CAST(SPLIT_PART(proposal_number, '-', 3) AS INTEGER)
      ELSE 0 END
    ), 0) + 1
    INTO seq_num
    FROM v2_proposals
    WHERE proposal_number LIKE 'PRP-' || year_part || '-%';

    NEW.proposal_number := 'PRP-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_proposal_number ON v2_proposals;
CREATE TRIGGER set_proposal_number
  BEFORE INSERT ON v2_proposals
  FOR EACH ROW
  EXECUTE FUNCTION generate_proposal_number();

-- ============================================================
-- 3. COMPANY BRANDING (for proposal branding)
-- ============================================================
-- Note: v2_company_settings is a key-value store used for config settings
-- This table stores structured branding info for proposals/documents
CREATE TABLE IF NOT EXISTS v2_company_branding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  logo_url TEXT,           -- Path to logo in storage
  company_name TEXT DEFAULT 'Ross Built Custom Homes',
  address TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  license_number TEXT,
  default_payment_terms JSONB,  -- Default milestones for new proposals
  proposal_footer_text TEXT,
  proposal_terms_boilerplate TEXT,  -- Default terms text
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed with Ross Built defaults
INSERT INTO v2_company_branding (
  company_name,
  address,
  phone,
  email,
  website,
  license_number,
  default_payment_terms,
  proposal_footer_text
)
VALUES (
  'Ross Built Custom Homes',
  '123 Builder Lane, Sarasota, FL 34236',
  '(941) 555-0123',
  'info@rossbuilt.com',
  'www.rossbuilt.com',
  'CGC1234567',
  '[{"milestone": "Contract Signing", "percent": 10, "description": "Deposit upon acceptance"},
    {"milestone": "Foundation Complete", "percent": 20},
    {"milestone": "Framing Complete", "percent": 25},
    {"milestone": "Drywall Complete", "percent": 20},
    {"milestone": "Final Completion", "percent": 25, "description": "Balance due at substantial completion"}]'::jsonb,
  'Thank you for considering Ross Built Custom Homes. We look forward to working with you.'
)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 4. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_proposals_estimate ON v2_proposals(estimate_id);
CREATE INDEX IF NOT EXISTS idx_proposals_job ON v2_proposals(job_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON v2_proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_token ON v2_proposals(share_token) WHERE share_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_proposals_expires ON v2_proposals(share_expires_at) WHERE share_expires_at IS NOT NULL;

-- ============================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_proposals_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_proposals_timestamp ON v2_proposals;
CREATE TRIGGER set_proposals_timestamp
  BEFORE UPDATE ON v2_proposals
  FOR EACH ROW
  EXECUTE FUNCTION update_proposals_timestamp();
