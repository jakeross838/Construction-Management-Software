-- Migration 062: Warranties
-- Track warranties for equipment, materials, and workmanship

-- ============================================================
-- WARRANTIES (main table)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_warranties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Warranty identification
  warranty_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Classification
  type TEXT DEFAULT 'manufacturer', -- manufacturer, contractor, extended, labor
  category TEXT, -- appliance, hvac, roofing, plumbing, electrical, structural, etc.

  -- Coverage
  coverage_details TEXT,

  -- Vendor/Manufacturer info
  vendor_id UUID REFERENCES v2_vendors(id),
  manufacturer TEXT,
  model_number TEXT,
  serial_number TEXT,

  -- Contact info
  contact_name TEXT,
  contact_phone TEXT,
  contact_email TEXT,

  -- Dates
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  installation_date DATE,

  -- Status: active, expired, claimed, void
  status TEXT DEFAULT 'active',

  -- Claim tracking
  claim_count INTEGER DEFAULT 0,
  last_claim_date DATE,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(job_id, warranty_number)
);

-- ============================================================
-- WARRANTY CLAIMS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id UUID NOT NULL REFERENCES v2_warranties(id) ON DELETE CASCADE,

  -- Claim details
  claim_number TEXT NOT NULL,
  issue_description TEXT NOT NULL,
  claim_date DATE NOT NULL,

  -- Status: submitted, in_progress, approved, denied, completed
  status TEXT DEFAULT 'submitted',

  -- Resolution
  resolution_description TEXT,
  resolution_date DATE,
  resolved_by TEXT,

  -- Cost
  claim_amount DECIMAL(12,2),
  approved_amount DECIMAL(12,2),

  -- Metadata
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- WARRANTY ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_warranty_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warranty_id UUID NOT NULL REFERENCES v2_warranties(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  attachment_type TEXT DEFAULT 'warranty', -- warranty, manual, receipt, claim, photo

  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_warranties_job_id ON v2_warranties(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_warranties_status ON v2_warranties(status);
CREATE INDEX IF NOT EXISTS idx_v2_warranties_type ON v2_warranties(type);
CREATE INDEX IF NOT EXISTS idx_v2_warranties_category ON v2_warranties(category);
CREATE INDEX IF NOT EXISTS idx_v2_warranties_end_date ON v2_warranties(end_date);
CREATE INDEX IF NOT EXISTS idx_v2_warranties_vendor_id ON v2_warranties(vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_warranties_deleted_at ON v2_warranties(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v2_warranty_claims_warranty_id ON v2_warranty_claims(warranty_id);
CREATE INDEX IF NOT EXISTS idx_v2_warranty_claims_status ON v2_warranty_claims(status);
CREATE INDEX IF NOT EXISTS idx_v2_warranty_attachments_warranty_id ON v2_warranty_attachments(warranty_id);

-- ============================================================
-- TRIGGER FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_warranty_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_warranty_updated_at ON v2_warranties;
CREATE TRIGGER trigger_warranty_updated_at
  BEFORE UPDATE ON v2_warranties
  FOR EACH ROW
  EXECUTE FUNCTION update_warranty_updated_at();

CREATE OR REPLACE FUNCTION update_warranty_claim_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_warranty_claim_updated_at ON v2_warranty_claims;
CREATE TRIGGER trigger_warranty_claim_updated_at
  BEFORE UPDATE ON v2_warranty_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_warranty_claim_updated_at();

-- ============================================================
-- AUTO-GENERATE WARRANTY NUMBER
-- ============================================================
CREATE OR REPLACE FUNCTION generate_warranty_number()
RETURNS TRIGGER AS $$
DECLARE
  job_prefix TEXT;
  next_num INTEGER;
BEGIN
  -- Get job identifier
  SELECT COALESCE(
    REGEXP_REPLACE(SPLIT_PART(name, '-', 1) || REGEXP_REPLACE(SPLIT_PART(name, ' ', 2), '[^0-9]', '', 'g'), '[^a-zA-Z0-9]', '', 'g'),
    'JOB'
  ) INTO job_prefix FROM v2_jobs WHERE id = NEW.job_id;

  -- Get next warranty number for this job
  SELECT COALESCE(MAX(
    CASE
      WHEN warranty_number ~ '-[0-9]+$' THEN
        CAST(SUBSTRING(warranty_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM v2_warranties WHERE job_id = NEW.job_id;

  NEW.warranty_number := 'WAR-' || job_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_warranty_number ON v2_warranties;
CREATE TRIGGER trigger_generate_warranty_number
  BEFORE INSERT ON v2_warranties
  FOR EACH ROW
  WHEN (NEW.warranty_number IS NULL OR NEW.warranty_number = '')
  EXECUTE FUNCTION generate_warranty_number();

-- Update warranty status based on end_date
CREATE OR REPLACE FUNCTION update_warranty_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.end_date < CURRENT_DATE AND NEW.status = 'active' THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_warranty_status ON v2_warranties;
CREATE TRIGGER trigger_update_warranty_status
  BEFORE UPDATE ON v2_warranties
  FOR EACH ROW
  EXECUTE FUNCTION update_warranty_status();
