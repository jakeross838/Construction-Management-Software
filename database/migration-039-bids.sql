-- Migration 039: Bids System
-- Vendor bid collection, comparison, and PO conversion

-- Main bids table
CREATE TABLE IF NOT EXISTS v2_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  vendor_id UUID REFERENCES v2_vendors(id),
  title TEXT NOT NULL,
  description TEXT,
  scope_of_work TEXT,
  bid_amount DECIMAL(14,2),
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'under_review', 'accepted', 'rejected', 'withdrawn')),
  received_date DATE DEFAULT CURRENT_DATE,
  due_date DATE,
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Bid documents (uploaded PDFs)
CREATE TABLE IF NOT EXISTS v2_bid_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES v2_bids(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log for audit trail
CREATE TABLE IF NOT EXISTS v2_bid_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES v2_bids(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track which PO was created from which bid
ALTER TABLE v2_purchase_orders
  ADD COLUMN IF NOT EXISTS source_bid_id UUID REFERENCES v2_bids(id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bids_job ON v2_bids(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bids_vendor ON v2_bids(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bids_status ON v2_bids(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_bid_documents_bid ON v2_bid_documents(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_activity_bid ON v2_bid_activity(bid_id);
