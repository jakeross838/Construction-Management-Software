-- Migration 168: Preconstruction Agreement Tracking for Leads
-- Adds fields to track when a lead signs a preconstruction agreement

-- Add preconstruction agreement fields to v2_leads
ALTER TABLE v2_leads ADD COLUMN IF NOT EXISTS precon_agreement_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_leads ADD COLUMN IF NOT EXISTS precon_agreement_date DATE;
ALTER TABLE v2_leads ADD COLUMN IF NOT EXISTS precon_agreement_amount DECIMAL(12,2);
ALTER TABLE v2_leads ADD COLUMN IF NOT EXISTS precon_agreement_document_id UUID REFERENCES v2_lead_documents(id);
ALTER TABLE v2_leads ADD COLUMN IF NOT EXISTS precon_agreement_notes TEXT;

-- Index for querying leads with signed agreements
CREATE INDEX IF NOT EXISTS idx_leads_precon_signed ON v2_leads(precon_agreement_signed) WHERE precon_agreement_signed = TRUE;

COMMENT ON COLUMN v2_leads.precon_agreement_signed IS 'Whether lead has signed a preconstruction agreement';
COMMENT ON COLUMN v2_leads.precon_agreement_date IS 'Date preconstruction agreement was signed';
COMMENT ON COLUMN v2_leads.precon_agreement_amount IS 'Preconstruction agreement retainer/fee amount';
COMMENT ON COLUMN v2_leads.precon_agreement_document_id IS 'Reference to the signed agreement document';
COMMENT ON COLUMN v2_leads.precon_agreement_notes IS 'Notes about the preconstruction agreement';
