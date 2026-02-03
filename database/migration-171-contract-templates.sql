-- Migration 171: Contract Templates & Clauses
-- Implements contract template management with variable substitution and clause library

-- ============================================================
-- 1. CONTRACT TEMPLATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),

  -- Template identification
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'preconstruction', 'construction', 'subcontract', 'amendment', 'change_order', 'proposal', 'other'
  )),

  -- Template content
  content TEXT NOT NULL, -- Rich text with {{VARIABLE}} placeholders

  -- Variables configuration
  -- Array of: { name: "CLIENT_NAME", label: "Client Name", source: "client.name", required: true }
  variables JSONB DEFAULT '[]'::jsonb,

  -- Included clauses (ordered array of clause IDs)
  clause_ids UUID[] DEFAULT '{}',

  -- Template settings
  default_signers JSONB DEFAULT '[]'::jsonb, -- Default signer roles
  default_expiration_days INTEGER DEFAULT 30,
  requires_florida_lien_disclosure BOOLEAN DEFAULT true,

  -- Versioning
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- 2. CONTRACT CLAUSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_contract_clauses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),

  -- Clause identification
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'general', 'payment', 'warranty', 'termination', 'indemnification',
    'insurance', 'liability', 'dispute', 'scope', 'schedule',
    'change_order', 'lien', 'force_majeure', 'safety', 'other'
  )),

  -- Clause content
  content TEXT NOT NULL, -- Rich text with {{VARIABLE}} placeholders

  -- Variables used in this clause
  variables JSONB DEFAULT '[]'::jsonb,

  -- Settings
  is_required BOOLEAN DEFAULT false, -- Must be included in all contracts
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- 3. CONTRACT DOCUMENTS TABLE (Generated from templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_contract_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES v2_contracts(id) ON DELETE CASCADE,
  template_id UUID REFERENCES v2_contract_templates(id),

  -- Document version
  version INTEGER DEFAULT 1,

  -- Rendered content
  content TEXT NOT NULL, -- Final content with variables replaced
  variables_snapshot JSONB, -- Values used for substitution

  -- Generated files
  pdf_url TEXT,
  signed_pdf_url TEXT,

  -- Signature tracking
  signature_request_id UUID REFERENCES v2_signature_requests(id),

  -- Florida Lien Law Disclosure
  florida_lien_disclosure_acknowledged BOOLEAN DEFAULT false,
  florida_lien_disclosure_acknowledged_at TIMESTAMPTZ,
  florida_lien_disclosure_acknowledged_by TEXT,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. CONTRACT PRICING TERMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_contract_pricing_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES v2_contracts(id) ON DELETE CASCADE,

  -- Pricing type
  pricing_type TEXT NOT NULL CHECK (pricing_type IN (
    'cost_plus_fixed_fee', 'cost_plus_percentage', 'fixed_price', 'gmp', 'time_and_materials'
  )),

  -- Fee structure
  base_fee_amount DECIMAL(12,2),
  fee_percentage DECIMAL(5,2),
  gmp_amount DECIMAL(12,2), -- Guaranteed Maximum Price if applicable

  -- Retainage
  retainage_percent DECIMAL(5,2) DEFAULT 10,
  retainage_release_percent DECIMAL(5,2), -- % released at substantial completion

  -- Supervision
  supervision_monthly_rate DECIMAL(12,2),
  original_duration_months INTEGER,

  -- Change order markup tiers
  change_order_markup_percent DECIMAL(5,2) DEFAULT 15, -- For changes under threshold
  change_order_markup_percent_large DECIMAL(5,2) DEFAULT 10, -- For changes over threshold
  change_order_threshold DECIMAL(12,2) DEFAULT 10000, -- Threshold for markup tier

  -- Payment terms
  payment_terms_days INTEGER DEFAULT 10,
  draw_frequency TEXT DEFAULT 'monthly' CHECK (draw_frequency IN ('weekly', 'biweekly', 'monthly', 'milestone')),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. VARIABLE SOURCES TABLE (defines where variables come from)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_contract_variable_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Variable definition
  variable_name TEXT NOT NULL UNIQUE, -- e.g., "CLIENT_NAME"
  display_label TEXT NOT NULL, -- e.g., "Client Name"
  description TEXT,

  -- Source configuration
  source_type TEXT NOT NULL CHECK (source_type IN ('lead', 'job', 'client', 'company', 'estimate', 'contract', 'computed', 'manual')),
  source_table TEXT, -- e.g., "v2_leads", "v2_jobs"
  source_field TEXT, -- e.g., "first_name || ' ' || last_name"

  -- Formatting
  format_type TEXT CHECK (format_type IN ('text', 'currency', 'date', 'percentage', 'number', 'address')),
  format_options JSONB, -- Additional formatting options

  -- Validation
  is_required BOOLEAN DEFAULT false,
  default_value TEXT,

  -- Metadata
  is_system BOOLEAN DEFAULT true, -- System-defined vs user-defined
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. INSERT DEFAULT VARIABLE SOURCES
-- ============================================================
INSERT INTO v2_contract_variable_sources (variable_name, display_label, description, source_type, source_table, source_field, format_type, is_required) VALUES
  -- Client/Lead Variables
  ('CLIENT_NAME', 'Client Name', 'Full name of the client', 'lead', 'v2_leads', 'first_name || '' '' || last_name', 'text', true),
  ('CLIENT_ADDRESS', 'Client Address', 'Client mailing address', 'lead', 'v2_leads', 'project_address', 'address', false),
  ('CLIENT_EMAIL', 'Client Email', 'Client email address', 'lead', 'v2_leads', 'email', 'text', false),
  ('CLIENT_PHONE', 'Client Phone', 'Client phone number', 'lead', 'v2_leads', 'phone', 'text', false),

  -- Project Variables
  ('PROJECT_ADDRESS', 'Project Address', 'Construction site address', 'job', 'v2_jobs', 'address', 'address', true),
  ('PROJECT_DESCRIPTION', 'Project Description', 'Brief project description', 'job', 'v2_jobs', 'description', 'text', false),
  ('PROJECT_NAME', 'Project Name', 'Name of the project', 'job', 'v2_jobs', 'name', 'text', true),
  ('SQUARE_FOOTAGE', 'Square Footage', 'Total square feet', 'job', 'v2_jobs', 'square_footage', 'number', false),

  -- Contract Variables
  ('CONTRACT_DATE', 'Contract Date', 'Date of contract execution', 'contract', 'v2_contracts', 'execution_date', 'date', true),
  ('CONTRACT_AMOUNT', 'Contract Amount', 'Total contract price', 'contract', 'v2_contracts', 'contract_amount', 'currency', true),
  ('CONTRACT_NUMBER', 'Contract Number', 'Unique contract identifier', 'contract', 'v2_contracts', 'contract_number', 'text', true),

  -- Pricing Terms
  ('FEE_AMOUNT', 'Builder Fee Amount', 'Fixed fee amount', 'contract', 'v2_contract_pricing_terms', 'base_fee_amount', 'currency', false),
  ('FEE_PERCENTAGE', 'Builder Fee Percentage', 'Fee as percentage of cost', 'contract', 'v2_contract_pricing_terms', 'fee_percentage', 'percentage', false),
  ('GMP_AMOUNT', 'Guaranteed Maximum Price', 'GMP if applicable', 'contract', 'v2_contract_pricing_terms', 'gmp_amount', 'currency', false),
  ('RETAINAGE_PERCENT', 'Retainage Percentage', 'Retainage held percentage', 'contract', 'v2_contract_pricing_terms', 'retainage_percent', 'percentage', false),

  -- Schedule Variables
  ('START_DATE', 'Estimated Start Date', 'Project start date', 'job', 'v2_jobs', 'start_date', 'date', false),
  ('COMPLETION_DATE', 'Estimated Completion Date', 'Target completion date', 'job', 'v2_jobs', 'target_completion', 'date', false),
  ('DURATION_MONTHS', 'Project Duration (Months)', 'Estimated project duration', 'computed', NULL, NULL, 'number', false),

  -- Company Variables
  ('BUILDER_NAME', 'Builder Company Name', 'Your company name', 'company', 'v2_builders', 'name', 'text', true),
  ('BUILDER_ADDRESS', 'Builder Address', 'Your company address', 'company', 'v2_builders', 'address', 'address', true),
  ('BUILDER_LICENSE', 'Builder License Number', 'Contractor license number', 'company', 'v2_builders', 'license_number', 'text', true),
  ('BUILDER_PHONE', 'Builder Phone', 'Company phone number', 'company', 'v2_builders', 'phone', 'text', false),
  ('BUILDER_EMAIL', 'Builder Email', 'Company email', 'company', 'v2_builders', 'email', 'text', false)
ON CONFLICT (variable_name) DO NOTHING;

-- ============================================================
-- 7. INSERT DEFAULT CLAUSES
-- ============================================================
INSERT INTO v2_contract_clauses (name, category, content, is_required, sort_order) VALUES
  -- Indemnification (Article 13 from recommendations)
  ('Indemnification', 'indemnification',
   'INDEMNIFICATION. To the fullest extent permitted by law, Owner shall indemnify, defend, and hold harmless Builder, its officers, directors, employees, and agents from and against all claims, damages, losses, and expenses (including but not limited to attorney''s fees) arising out of or resulting from: (a) Owner''s breach of any obligation under this Agreement; (b) any act or omission of Owner or Owner''s separate contractors; (c) any hazardous materials or conditions existing on the Property prior to commencement of Work; (d) any injury or damage caused by defects in design documents provided by Owner or Owner''s design professionals; or (e) Owner''s interference with Builder''s Work.',
   false, 130),

  -- Limitation of Liability (Article 14 from recommendations)
  ('Limitation of Liability', 'liability',
   'LIMITATION OF LIABILITY. Notwithstanding any other provision of this Agreement: (a) Builder''s total liability to Owner for any claims arising under or related to this Agreement shall not exceed the total Contract Price; (b) In no event shall Builder be liable for any indirect, special, incidental, consequential, or punitive damages, including but not limited to loss of use, loss of profits, loss of business opportunity, or diminution in value; (c) Builder shall not be liable for delays or failures in performance resulting from causes beyond Builder''s reasonable control; (d) Any action against Builder must be commenced within one (1) year after the cause of action accrues.',
   false, 140),

  -- Right to Stop Work (Article 15 from recommendations)
  ('Right to Stop Work', 'payment',
   'RIGHT TO STOP WORK. If Owner fails to make any payment when due under this Agreement, Builder may, after giving seven (7) days'' written notice to Owner, stop the Work until payment is received. Builder shall not be liable for any delays resulting from such work stoppage. Upon resumption of Work, the Contract Time shall be extended by the number of days Work was stopped, plus reasonable time for remobilization. If Work is stopped for thirty (30) or more consecutive days due to Owner''s non-payment, Builder may terminate this Agreement.',
   false, 150),

  -- Hazardous Materials (Article 16 from recommendations)
  ('Hazardous Materials', 'general',
   'HAZARDOUS MATERIALS. Owner represents and warrants that, to the best of Owner''s knowledge, there are no hazardous materials or conditions on the Property. Owner shall be responsible for the proper identification, handling, removal, and disposal of any hazardous materials discovered on the Property. If hazardous materials are encountered, Builder shall have the right to stop Work until Owner has remediated the condition at Owner''s expense. The Contract Time and Contract Price shall be adjusted to compensate Builder for any delays or additional costs caused by hazardous materials.',
   false, 160),

  -- Waiver of Subrogation (Article 17 from recommendations)
  ('Waiver of Subrogation', 'insurance',
   'WAIVER OF SUBROGATION. Owner and Builder waive all rights against each other and against the subcontractors, agents, and employees of the other for damages caused by fire or other perils to the extent covered by property insurance applicable to the Work. Owner shall require similar waivers from Owner''s separate contractors. The policies shall provide such waivers of subrogation by endorsement or otherwise.',
   false, 170),

  -- Mechanic''s Lien Rights (Article 18 from recommendations)
  ('Mechanic''s Lien Rights Notice', 'lien',
   'MECHANIC''S LIEN RIGHTS. Builder and its subcontractors and suppliers have lien rights on the Owner''s property under Florida Statute Chapter 713. To protect the property from liens, Owner should: (1) Require Builder to provide a list of all subcontractors and suppliers; (2) Require lien releases from Builder, subcontractors, and suppliers prior to making progress payments; (3) Not make final payment until Builder provides final lien releases from all parties. Owner acknowledges receipt of the Florida Construction Lien Law Disclosure required by Section 713.015, Florida Statutes.',
   true, 180),

  -- Force Majeure (Enhanced)
  ('Force Majeure', 'force_majeure',
   'FORCE MAJEURE. Neither party shall be liable for delays or failures in performance resulting from causes beyond the reasonable control of that party, including but not limited to: acts of God, natural disasters, epidemics, pandemics, government actions, war, terrorism, labor disputes, material shortages, or utility failures. The affected party shall: (a) provide written notice within 72 hours of the force majeure event; (b) make reasonable efforts to mitigate the effect; (c) resume performance as soon as reasonably practicable. The Contract Time shall be extended by the duration of the force majeure event plus reasonable time for remobilization.',
   false, 190),

  -- Dispute Resolution
  ('Dispute Resolution', 'dispute',
   'DISPUTE RESOLUTION. Any dispute arising under or related to this Agreement shall be resolved as follows: (1) NEGOTIATION: The parties shall first attempt to resolve the dispute through good faith negotiation within fifteen (15) days; (2) MEDIATION: If negotiation fails, the dispute shall be submitted to mediation in {{PROJECT_ADDRESS_COUNTY}} County, Florida, using a mutually agreed mediator; (3) BINDING ARBITRATION: If mediation fails, the dispute shall be resolved by binding arbitration in accordance with the Construction Industry Arbitration Rules of the American Arbitration Association. The prevailing party shall be entitled to recover reasonable attorney''s fees and costs.',
   false, 200),

  -- Warranty
  ('One-Year Workmanship Warranty', 'warranty',
   'WARRANTY. Builder warrants that the Work will be free from defects in workmanship for a period of one (1) year from the date of Substantial Completion. This warranty does not cover: (a) normal wear and tear; (b) damage caused by Owner, Owner''s agents, or third parties; (c) damage caused by failure to properly maintain; (d) damage caused by Acts of God; (e) items covered by manufacturer''s warranties. Owner shall notify Builder in writing of any warranty claim within the warranty period. Builder''s sole obligation under this warranty is to repair or replace defective work at Builder''s option.',
   true, 110)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 8. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_contract_templates_builder ON v2_contract_templates(builder_id);
CREATE INDEX IF NOT EXISTS idx_contract_templates_type ON v2_contract_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_contract_templates_active ON v2_contract_templates(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_contract_clauses_builder ON v2_contract_clauses(builder_id);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_category ON v2_contract_clauses(category);
CREATE INDEX IF NOT EXISTS idx_contract_clauses_active ON v2_contract_clauses(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_contract_documents_contract ON v2_contract_documents(contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_documents_template ON v2_contract_documents(template_id);

CREATE INDEX IF NOT EXISTS idx_contract_pricing_contract ON v2_contract_pricing_terms(contract_id);

-- ============================================================
-- 9. UPDATE TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_contract_templates_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contract_templates_updated ON v2_contract_templates;
CREATE TRIGGER trg_contract_templates_updated
  BEFORE UPDATE ON v2_contract_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_templates_timestamp();

DROP TRIGGER IF EXISTS trg_contract_clauses_updated ON v2_contract_clauses;
CREATE TRIGGER trg_contract_clauses_updated
  BEFORE UPDATE ON v2_contract_clauses
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_templates_timestamp();

DROP TRIGGER IF EXISTS trg_contract_pricing_updated ON v2_contract_pricing_terms;
CREATE TRIGGER trg_contract_pricing_updated
  BEFORE UPDATE ON v2_contract_pricing_terms
  FOR EACH ROW
  EXECUTE FUNCTION update_contract_templates_timestamp();

-- ============================================================
-- 10. ADD builder_id TO CONTRACTS IF NOT EXISTS
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_contracts' AND column_name = 'builder_id') THEN
    ALTER TABLE v2_contracts ADD COLUMN builder_id UUID REFERENCES v2_builders(id);
  END IF;
END $$;

-- ============================================================
-- 11. ADD lead_id TO CONTRACTS FOR LEAD LINKING
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'v2_contracts' AND column_name = 'lead_id') THEN
    ALTER TABLE v2_contracts ADD COLUMN lead_id UUID REFERENCES v2_leads(id);
    CREATE INDEX IF NOT EXISTS idx_contracts_lead ON v2_contracts(lead_id);
  END IF;
END $$;

-- ============================================================
-- 12. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_contract_templates IS 'Reusable contract templates with variable placeholders';
COMMENT ON TABLE v2_contract_clauses IS 'Library of reusable contract clauses';
COMMENT ON TABLE v2_contract_documents IS 'Generated contract documents from templates';
COMMENT ON TABLE v2_contract_pricing_terms IS 'Contract pricing configuration including fee structure and change order markup';
COMMENT ON TABLE v2_contract_variable_sources IS 'Defines available variables and their data sources for contract generation';
