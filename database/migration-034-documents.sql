-- Migration 034: Documents Module
-- Date: 2026-01-16
-- Purpose: Centralized document storage for all job-related files

-- Main documents table
CREATE TABLE IF NOT EXISTS v2_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Document identity
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,  -- contracts, plans, permits, insurance, proposals, specs, invoices, warranties, correspondence, photos, other

  -- File info
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,

  -- Metadata
  document_date DATE,        -- Date on the document itself
  expiration_date DATE,      -- For insurance, permits, etc.
  tags TEXT[],               -- Flexible tagging

  -- Linking to other modules (optional)
  vendor_id UUID REFERENCES v2_vendors(id),
  po_id UUID REFERENCES v2_purchase_orders(id),
  invoice_id UUID REFERENCES v2_invoices(id),

  -- Audit
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Document activity log
CREATE TABLE IF NOT EXISTS v2_document_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES v2_documents(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- uploaded, viewed, downloaded, updated, deleted
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_job_id ON v2_documents(job_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON v2_documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at ON v2_documents(deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_vendor_id ON v2_documents(vendor_id);
CREATE INDEX IF NOT EXISTS idx_documents_expiration ON v2_documents(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_activity_document ON v2_document_activity(document_id);
