-- Migration 163: E-Signatures System
-- Implements electronic signature requests, signatures, and audit trail
-- Supports internal signatures and external providers (DocuSign, HelloSign)

-- ============================================================
-- 1. SIGNATURE REQUESTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_signature_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),

  -- Document reference (polymorphic)
  document_id UUID NOT NULL,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'contract', 'change_order', 'daily_log', 'proposal',
    'subcontract', 'lien_release', 'purchase_order', 'other'
  )),

  -- Request details
  title TEXT NOT NULL,
  description TEXT,
  message TEXT, -- Message to include in signature request email

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',      -- Still being prepared
    'pending',    -- Sent, awaiting signatures
    'completed',  -- All signatures collected
    'declined',   -- At least one signer declined
    'expired',    -- Request expired before completion
    'cancelled'   -- Manually cancelled
  )),

  -- Signers (ordered array of signer objects)
  -- Each signer: { name, email, role, order, status, signed_at, signature_id, declined_at, decline_reason }
  signers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- External provider integration
  external_provider TEXT CHECK (external_provider IN ('docusign', 'hellosign', 'internal', NULL)),
  external_id TEXT,           -- ID from external provider
  external_status TEXT,       -- Status from external provider
  external_envelope_url TEXT, -- URL to view/sign in external provider

  -- Timing
  expires_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Document URLs
  original_document_url TEXT,  -- Original document to sign
  signed_document_url TEXT,    -- Final signed document

  -- Tracking
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- 2. SIGNATURES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES v2_signature_requests(id) ON DELETE CASCADE,

  -- Signer identity
  signer_email TEXT NOT NULL,
  signer_name TEXT NOT NULL,
  signer_role TEXT, -- e.g., 'builder', 'client', 'subcontractor', 'witness'

  -- Signature data
  signature_type TEXT NOT NULL DEFAULT 'drawn' CHECK (signature_type IN (
    'drawn',    -- Canvas signature
    'typed',    -- Typed name as signature
    'uploaded', -- Uploaded image
    'external'  -- From external provider
  )),
  signature_data TEXT, -- Base64 encoded signature image for internal signatures
  typed_name TEXT,     -- For typed signatures

  -- Security/audit info
  ip_address INET,
  user_agent TEXT,
  geo_location JSONB, -- { city, region, country, lat, lng }

  -- Timing
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. SIGNATURE AUDIT TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_signature_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES v2_signature_requests(id) ON DELETE CASCADE,

  -- Action tracking
  action TEXT NOT NULL CHECK (action IN (
    'created',
    'updated',
    'sent',
    'viewed',
    'signed',
    'declined',
    'expired',
    'cancelled',
    'reminded',
    'downloaded',
    'voided',
    'resent'
  )),

  -- Actor information
  actor_email TEXT,
  actor_name TEXT,
  actor_role TEXT,

  -- Security info
  ip_address INET,
  user_agent TEXT,

  -- Additional details
  details JSONB, -- Action-specific details

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. SIGNATURE TEMPLATES (for reusable signature workflows)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_signature_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),

  name TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL,

  -- Default signers template
  -- Each: { role, order, required }
  default_signers JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Default settings
  default_message TEXT,
  default_expiration_days INTEGER DEFAULT 30,

  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_signature_requests_builder ON v2_signature_requests(builder_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_document ON v2_signature_requests(document_type, document_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_status ON v2_signature_requests(status);
CREATE INDEX IF NOT EXISTS idx_signature_requests_external ON v2_signature_requests(external_provider, external_id);
CREATE INDEX IF NOT EXISTS idx_signature_requests_created ON v2_signature_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signatures_request ON v2_signatures(request_id);
CREATE INDEX IF NOT EXISTS idx_signatures_email ON v2_signatures(signer_email);
CREATE INDEX IF NOT EXISTS idx_signatures_signed ON v2_signatures(signed_at DESC);

CREATE INDEX IF NOT EXISTS idx_signature_audit_request ON v2_signature_audit(request_id);
CREATE INDEX IF NOT EXISTS idx_signature_audit_created ON v2_signature_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_signature_templates_builder ON v2_signature_templates(builder_id);

-- ============================================================
-- 6. TRIGGER FOR UPDATED_AT
-- ============================================================
CREATE OR REPLACE FUNCTION update_signature_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_signature_requests_updated_at ON v2_signature_requests;
CREATE TRIGGER trg_signature_requests_updated_at
  BEFORE UPDATE ON v2_signature_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_signature_requests_updated_at();

-- ============================================================
-- 7. FUNCTION TO CHECK ALL SIGNERS COMPLETED
-- ============================================================
CREATE OR REPLACE FUNCTION check_signature_request_completion()
RETURNS TRIGGER AS $$
DECLARE
  all_signed BOOLEAN;
  any_declined BOOLEAN;
BEGIN
  -- Check if all signers have signed
  SELECT
    COALESCE(bool_and((s->>'signed_at') IS NOT NULL), false),
    COALESCE(bool_or((s->>'declined_at') IS NOT NULL), false)
  INTO all_signed, any_declined
  FROM jsonb_array_elements(NEW.signers) AS s;

  -- Update status based on signer states
  IF any_declined AND NEW.status NOT IN ('declined', 'cancelled') THEN
    NEW.status := 'declined';
  ELSIF all_signed AND NEW.status NOT IN ('completed', 'cancelled') AND
        jsonb_array_length(NEW.signers) > 0 THEN
    NEW.status := 'completed';
    NEW.completed_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_signature_completion ON v2_signature_requests;
CREATE TRIGGER trg_check_signature_completion
  BEFORE UPDATE ON v2_signature_requests
  FOR EACH ROW
  WHEN (OLD.signers IS DISTINCT FROM NEW.signers)
  EXECUTE FUNCTION check_signature_request_completion();

-- ============================================================
-- 8. VIEW FOR SIGNATURE REQUEST STATS
-- ============================================================
CREATE OR REPLACE VIEW v2_signature_request_stats AS
SELECT
  builder_id,
  COUNT(*) FILTER (WHERE status = 'draft') as draft_count,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
  COUNT(*) FILTER (WHERE status = 'declined') as declined_count,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_count,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_count,
  COUNT(*) as total_count,
  AVG(EXTRACT(EPOCH FROM (completed_at - sent_at))/3600) FILTER (WHERE status = 'completed') as avg_completion_hours
FROM v2_signature_requests
WHERE deleted_at IS NULL
GROUP BY builder_id;

-- ============================================================
-- 9. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_signature_requests IS 'E-signature requests for documents, supporting internal and external providers';
COMMENT ON TABLE v2_signatures IS 'Individual signatures submitted for signature requests';
COMMENT ON TABLE v2_signature_audit IS 'Comprehensive audit trail for all signature-related actions';
COMMENT ON TABLE v2_signature_templates IS 'Reusable templates for signature workflows';

COMMENT ON COLUMN v2_signature_requests.signers IS 'JSONB array of signer objects: { name, email, role, order, status, signed_at, signature_id, declined_at, decline_reason }';
COMMENT ON COLUMN v2_signature_requests.external_provider IS 'External e-signature provider (docusign, hellosign, or internal for in-app signatures)';
COMMENT ON COLUMN v2_signatures.signature_data IS 'Base64 encoded signature image for internal drawn signatures';
