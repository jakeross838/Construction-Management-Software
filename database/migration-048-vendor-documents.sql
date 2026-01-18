-- Migration 048: Vendor Documents Table
-- Stores document history and metadata

CREATE TABLE IF NOT EXISTS v2_vendor_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL, -- 'coi', 'w9', 'license', 'contract', 'other'
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  uploaded_by TEXT,
  notes TEXT,
  expiration_date DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick vendor document lookups
CREATE INDEX IF NOT EXISTS idx_vendor_documents_vendor ON v2_vendor_documents(vendor_id, document_type);
CREATE INDEX IF NOT EXISTS idx_vendor_documents_current ON v2_vendor_documents(vendor_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_vendor_documents_expiring ON v2_vendor_documents(expiration_date) WHERE is_current = true;

COMMENT ON TABLE v2_vendor_documents IS 'Stores all vendor documents with history tracking';
COMMENT ON COLUMN v2_vendor_documents.document_type IS 'Type: coi (Certificate of Insurance), w9, license, contract, other';
COMMENT ON COLUMN v2_vendor_documents.is_current IS 'Latest version of this document type for the vendor';
