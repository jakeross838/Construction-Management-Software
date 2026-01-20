-- Migration 078: Contracts Management
-- Store contracts, proposals, subcontracts, and amendments

-- Contracts table
CREATE TABLE IF NOT EXISTS v2_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contract identification
  contract_number TEXT,
  name TEXT NOT NULL,
  description TEXT,

  -- Type and category
  contract_type TEXT NOT NULL CHECK (contract_type IN (
    'prime', 'subcontract', 'proposal', 'change_order', 'amendment', 'nda', 'purchase_agreement', 'other'
  )),
  category TEXT,

  -- Linked entities
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  company_id UUID REFERENCES v2_companies(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES v2_contacts(id) ON DELETE SET NULL,

  -- Parent contract (for amendments/change orders)
  parent_contract_id UUID REFERENCES v2_contracts(id) ON DELETE SET NULL,

  -- Financial terms
  contract_amount DECIMAL(12,2),
  original_amount DECIMAL(12,2),
  retainage_percent DECIMAL(5,2),
  payment_terms TEXT,  -- Net 30, Net 60, etc.

  -- Dates
  start_date DATE,
  end_date DATE,
  expiration_date DATE,
  execution_date DATE,

  -- Signature tracking
  signature_status TEXT DEFAULT 'draft' CHECK (signature_status IN (
    'draft', 'pending_internal', 'sent', 'pending_signature', 'partially_signed', 'fully_executed', 'declined', 'expired'
  )),
  sent_for_signature_at TIMESTAMPTZ,
  internal_signed_at TIMESTAMPTZ,
  internal_signed_by TEXT,
  external_signed_at TIMESTAMPTZ,
  external_signed_by TEXT,

  -- Document
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  file_size INTEGER,
  signed_file_url TEXT,  -- Final signed version

  -- Terms and conditions
  scope_of_work TEXT,
  insurance_requirements TEXT,
  bond_requirements TEXT,
  warranty_terms TEXT,
  liquidated_damages TEXT,
  termination_clause TEXT,
  special_conditions TEXT,

  -- Key dates (tracked for reminders)
  notice_period_days INTEGER,
  renewal_date DATE,
  auto_renew BOOLEAN DEFAULT false,

  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'terminated', 'expired', 'cancelled')),

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Generate contract number
CREATE OR REPLACE FUNCTION generate_contract_number()
RETURNS TRIGGER AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
  type_prefix TEXT;
BEGIN
  IF NEW.contract_number IS NULL THEN
    year_part := TO_CHAR(NOW(), 'YY');

    -- Get sequence number for this year
    SELECT COALESCE(MAX(
      CASE WHEN contract_number ~ '^[A-Z]+-[0-9]{2}-[0-9]+$'
      THEN CAST(SPLIT_PART(contract_number, '-', 3) AS INTEGER)
      ELSE 0 END
    ), 0) + 1
    INTO seq_num
    FROM v2_contracts
    WHERE contract_number LIKE '%-' || year_part || '-%';

    -- Type prefix
    type_prefix := CASE NEW.contract_type
      WHEN 'prime' THEN 'PRM'
      WHEN 'subcontract' THEN 'SUB'
      WHEN 'proposal' THEN 'PRP'
      WHEN 'change_order' THEN 'CO'
      WHEN 'amendment' THEN 'AMD'
      WHEN 'nda' THEN 'NDA'
      ELSE 'CTR'
    END;

    NEW.contract_number := type_prefix || '-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_contract_number ON v2_contracts;
CREATE TRIGGER set_contract_number
  BEFORE INSERT ON v2_contracts
  FOR EACH ROW
  EXECUTE FUNCTION generate_contract_number();

-- Contract signers table (for multi-party signatures)
CREATE TABLE IF NOT EXISTS v2_contract_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES v2_contracts(id) ON DELETE CASCADE,

  -- Signer info
  signer_name TEXT NOT NULL,
  signer_email TEXT,
  signer_title TEXT,
  signer_company TEXT,

  -- Signature type
  signer_type TEXT NOT NULL CHECK (signer_type IN ('internal', 'external', 'witness', 'notary')),
  sign_order INTEGER DEFAULT 1,

  -- Signature status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'viewed', 'signed', 'declined')),
  signed_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,

  -- Signature method
  signature_method TEXT,  -- in_person, electronic, docusign, etc.
  ip_address TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract activity log
CREATE TABLE IF NOT EXISTS v2_contract_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES v2_contracts(id) ON DELETE CASCADE,

  action TEXT NOT NULL,
  performed_by TEXT,
  notes TEXT,
  field_changes JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_contracts_job ON v2_contracts(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_company ON v2_contracts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_vendor ON v2_contracts(vendor_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_type ON v2_contracts(contract_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_status ON v2_contracts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_signature ON v2_contracts(signature_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contracts_expiration ON v2_contracts(expiration_date)
  WHERE deleted_at IS NULL AND status = 'active';
CREATE INDEX IF NOT EXISTS idx_contract_signers ON v2_contract_signers(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_activity ON v2_contract_activity(contract_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_contracts_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_contracts_timestamp ON v2_contracts;
CREATE TRIGGER set_contracts_timestamp
  BEFORE UPDATE ON v2_contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_contracts_timestamp();
