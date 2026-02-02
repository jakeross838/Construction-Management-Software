-- Migration 132: Bid Packages System
-- Full subcontractor bid solicitation workflow

-- Bid Packages table (soliciting bids from multiple subs)
CREATE TABLE IF NOT EXISTS v2_bid_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id),
  package_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  trade_category TEXT,
  scope_of_work TEXT,
  issue_date DATE,
  due_date DATE DEFAULT (CURRENT_DATE + INTERVAL '14 days'),
  site_visit_date DATE,
  site_visit_time TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'receiving', 'evaluating', 'awarded', 'cancelled')),
  square_footage DECIMAL(12,2),
  specs_summary TEXT,
  special_requirements TEXT,
  awarded_vendor_id UUID REFERENCES v2_vendors(id),
  awarded_at TIMESTAMPTZ,
  awarded_amount DECIMAL(14,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Bid Package Documents
CREATE TABLE IF NOT EXISTS v2_bid_package_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_package_id UUID NOT NULL REFERENCES v2_bid_packages(id) ON DELETE CASCADE,
  document_type TEXT DEFAULT 'other' CHECK (document_type IN ('plans', 'specifications', 'scope', 'contract', 'addendum', 'other')),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  description TEXT,
  version INTEGER DEFAULT 1,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT
);

-- Vendor Invites to Bid
CREATE TABLE IF NOT EXISTS v2_bid_package_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_package_id UUID NOT NULL REFERENCES v2_bid_packages(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES v2_vendors(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  invite_sent BOOLEAN DEFAULT FALSE,
  invite_sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  declined BOOLEAN DEFAULT FALSE,
  declined_reason TEXT,
  UNIQUE(bid_package_id, vendor_id)
);

-- Subcontractor Bids (responses to bid packages)
CREATE TABLE IF NOT EXISTS v2_subcontractor_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_package_id UUID NOT NULL REFERENCES v2_bid_packages(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES v2_vendors(id),
  bid_amount DECIMAL(14,2) NOT NULL,
  unit_price_per_sf DECIMAL(10,4),
  alternate_amounts JSONB DEFAULT '[]',
  inclusions TEXT[] DEFAULT '{}',
  exclusions TEXT[] DEFAULT '{}',
  clarifications TEXT[] DEFAULT '{}',
  proposed_start_date DATE,
  proposed_duration_days INTEGER,
  payment_terms TEXT,
  warranty_terms TEXT,
  bond_included BOOLEAN DEFAULT FALSE,
  insurance_verified BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'shortlisted', 'selected', 'rejected', 'withdrawn')),
  is_lowest_bid BOOLEAN DEFAULT FALSE,
  ranking INTEGER,
  evaluation_score DECIMAL(5,2),
  evaluation_notes TEXT,
  proposal_url TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bid Line Items (detailed breakdown)
CREATE TABLE IF NOT EXISTS v2_subcontractor_bid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontractor_bid_id UUID NOT NULL REFERENCES v2_subcontractor_bids(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity DECIMAL(12,4),
  unit TEXT,
  unit_price DECIMAL(14,4),
  amount DECIMAL(14,2) NOT NULL,
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bid_packages_job ON v2_bid_packages(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bid_packages_status ON v2_bid_packages(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bid_package_docs_pkg ON v2_bid_package_documents(bid_package_id);
CREATE INDEX IF NOT EXISTS idx_bid_invites_pkg ON v2_bid_package_invites(bid_package_id);
CREATE INDEX IF NOT EXISTS idx_bid_invites_vendor ON v2_bid_package_invites(vendor_id);
CREATE INDEX IF NOT EXISTS idx_sub_bids_pkg ON v2_subcontractor_bids(bid_package_id);
CREATE INDEX IF NOT EXISTS idx_sub_bids_vendor ON v2_subcontractor_bids(vendor_id);
CREATE INDEX IF NOT EXISTS idx_sub_bid_items_bid ON v2_subcontractor_bid_items(subcontractor_bid_id);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_bid_package_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_bid_packages_updated ON v2_bid_packages;
CREATE TRIGGER tr_bid_packages_updated
  BEFORE UPDATE ON v2_bid_packages
  FOR EACH ROW EXECUTE FUNCTION update_bid_package_timestamp();

DROP TRIGGER IF EXISTS tr_subcontractor_bids_updated ON v2_subcontractor_bids;
CREATE TRIGGER tr_subcontractor_bids_updated
  BEFORE UPDATE ON v2_subcontractor_bids
  FOR EACH ROW EXECUTE FUNCTION update_bid_package_timestamp();
