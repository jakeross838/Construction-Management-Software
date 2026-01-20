-- Migration 088: Document Intelligence (Phase 75)
-- AI document parsing, classification, version tracking, contract analysis

-- Clean up any partial tables from failed runs
DROP TABLE IF EXISTS v2_document_search_log CASCADE;
DROP TABLE IF EXISTS v2_job_document_checklist CASCADE;
DROP TABLE IF EXISTS v2_document_requirements CASCADE;
DROP TABLE IF EXISTS v2_contract_analysis CASCADE;
DROP TABLE IF EXISTS v2_document_extractions CASCADE;
DROP TABLE IF EXISTS v2_document_versions CASCADE;
DROP TABLE IF EXISTS v2_documents CASCADE;
DROP TABLE IF EXISTS v2_document_types CASCADE;
DROP VIEW IF EXISTS v2_document_dashboard CASCADE;
DROP FUNCTION IF EXISTS search_documents CASCADE;
DROP FUNCTION IF EXISTS get_job_document_compliance CASCADE;
DROP FUNCTION IF EXISTS build_document_search_text CASCADE;

-- ============================================================
-- 1. DOCUMENT TYPES (Classification categories)
-- ============================================================
CREATE TABLE v2_document_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT CHECK (category IN (
    'contract', 'financial', 'permit', 'plan', 'specification',
    'correspondence', 'insurance', 'warranty', 'closeout', 'other'
  )),
  description TEXT,
  required_fields JSONB DEFAULT '[]',
  retention_days INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. DOCUMENTS (Master document registry)
-- ============================================================
CREATE TABLE v2_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  document_type_id UUID REFERENCES v2_document_types(id),
  ai_classified_type TEXT,
  ai_classification_confidence DECIMAL(5,2),
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT,
  file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  page_count INTEGER,
  ai_extracted_data JSONB DEFAULT '{}',
  ai_summary TEXT,
  ai_key_dates JSONB DEFAULT '[]',
  ai_key_amounts JSONB DEFAULT '[]',
  ai_parties JSONB DEFAULT '[]',
  status TEXT CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'archived')) DEFAULT 'pending',
  processing_error TEXT,
  search_text TEXT,
  tags TEXT[] DEFAULT '{}',
  parent_document_id UUID REFERENCES v2_documents(id),
  related_vendor_id UUID REFERENCES v2_vendors(id),
  related_po_id UUID REFERENCES v2_purchase_orders(id),
  related_invoice_id UUID REFERENCES v2_invoices(id),
  source TEXT,
  uploaded_by TEXT,
  received_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- 3. DOCUMENT VERSIONS (Version history)
-- ============================================================
CREATE TABLE v2_document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES v2_documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  change_summary TEXT,
  changes_detected JSONB DEFAULT '[]',
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  file_hash TEXT,
  UNIQUE(document_id, version_number)
);

-- ============================================================
-- 4. DOCUMENT EXTRACTIONS (Structured data from documents)
-- ============================================================
CREATE TABLE v2_document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES v2_documents(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  field_value TEXT,
  field_type TEXT CHECK (field_type IN ('text', 'date', 'amount', 'number', 'boolean', 'array')),
  confidence DECIMAL(5,2),
  source_page INTEGER,
  source_location JSONB,
  verified BOOLEAN DEFAULT false,
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  original_value TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. CONTRACT ANALYSIS (Detailed contract parsing)
-- ============================================================
CREATE TABLE v2_contract_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES v2_documents(id) ON DELETE CASCADE,
  contract_type TEXT,
  contract_date DATE,
  effective_date DATE,
  owner_party JSONB,
  contractor_party JSONB,
  original_amount DECIMAL(14,2),
  current_amount DECIMAL(14,2),
  retainage_percent DECIMAL(5,2),
  start_date DATE,
  substantial_completion DATE,
  final_completion DATE,
  liquidated_damages DECIMAL(12,2),
  ld_per_day DECIMAL(10,2),
  payment_terms TEXT,
  change_order_process TEXT,
  dispute_resolution TEXT,
  warranty_terms TEXT,
  insurance_requirements JSONB,
  risk_factors JSONB DEFAULT '[]',
  key_obligations JSONB DEFAULT '[]',
  deadlines JSONB DEFAULT '[]',
  compared_to_standard BOOLEAN DEFAULT false,
  deviations JSONB DEFAULT '[]',
  analyzed_at TIMESTAMPTZ DEFAULT NOW(),
  analyzed_by TEXT
);

-- ============================================================
-- 6. DOCUMENT REQUIREMENTS (Required docs per phase)
-- ============================================================
CREATE TABLE v2_document_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT CHECK (phase IN ('preconstruction', 'construction', 'closeout', 'warranty')),
  trigger_event TEXT,
  document_type_id UUID REFERENCES v2_document_types(id),
  description TEXT,
  responsible_party TEXT,
  due_days_offset INTEGER,
  required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. JOB DOCUMENT CHECKLIST (Track required docs per job)
-- ============================================================
CREATE TABLE v2_job_document_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  requirement_id UUID NOT NULL REFERENCES v2_document_requirements(id),
  status TEXT CHECK (status IN ('pending', 'received', 'approved', 'rejected', 'waived')) DEFAULT 'pending',
  document_id UUID REFERENCES v2_documents(id),
  due_date DATE,
  received_date DATE,
  notes TEXT,
  waived_by TEXT,
  waived_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, requirement_id)
);

-- ============================================================
-- 8. DOCUMENT SEARCH LOG
-- ============================================================
CREATE TABLE v2_document_search_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_query TEXT,
  filters JSONB,
  result_count INTEGER,
  clicked_document_id UUID REFERENCES v2_documents(id),
  searched_by TEXT,
  searched_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. INDEXES (Create after all tables exist)
-- ============================================================
CREATE INDEX idx_documents_job ON v2_documents(job_id);
CREATE INDEX idx_documents_type ON v2_documents(document_type_id);
CREATE INDEX idx_documents_status ON v2_documents(status);
CREATE INDEX idx_documents_search ON v2_documents USING gin(to_tsvector('english', COALESCE(search_text, '')));
CREATE INDEX idx_documents_tags ON v2_documents USING gin(tags);
CREATE INDEX idx_doc_versions_document ON v2_document_versions(document_id);
CREATE INDEX idx_extractions_document ON v2_document_extractions(document_id);
CREATE INDEX idx_extractions_field ON v2_document_extractions(field_name);
CREATE INDEX idx_contract_analysis_document ON v2_contract_analysis(document_id);
CREATE INDEX idx_job_checklist_job ON v2_job_document_checklist(job_id);
CREATE INDEX idx_job_checklist_status ON v2_job_document_checklist(status);

-- ============================================================
-- 10. SEED DOCUMENT TYPES
-- ============================================================
INSERT INTO v2_document_types (name, category, description, required_fields) VALUES
  ('Prime Contract', 'contract', 'Main contract between owner and contractor', '["contract_amount", "start_date", "completion_date", "retainage_percent"]'),
  ('Subcontract', 'contract', 'Agreement with subcontractor', '["vendor_name", "contract_amount", "scope", "start_date"]'),
  ('Change Order', 'contract', 'Contract modification', '["co_number", "amount", "description", "approval_date"]'),
  ('Invoice', 'financial', 'Billing document', '["vendor_name", "invoice_number", "amount", "date"]'),
  ('Lien Waiver', 'financial', 'Lien release document', '["vendor_name", "amount", "through_date", "waiver_type"]'),
  ('Pay Application', 'financial', 'AIA G702/G703', '["application_number", "period_to", "amount_due"]'),
  ('Building Permit', 'permit', 'Construction permit', '["permit_number", "issue_date", "expiration_date", "scope"]'),
  ('Certificate of Occupancy', 'permit', 'CO document', '["issue_date", "address", "use_type"]'),
  ('Architectural Plans', 'plan', 'Architectural drawings', '["revision", "date", "sheet_count"]'),
  ('Structural Plans', 'plan', 'Structural drawings', '["revision", "date", "engineer"]'),
  ('MEP Plans', 'plan', 'Mechanical/Electrical/Plumbing', '["revision", "date", "discipline"]'),
  ('Specifications', 'specification', 'Project specifications', '["division", "section", "revision"]'),
  ('Submittal', 'specification', 'Product/material submittal', '["spec_section", "product", "manufacturer"]'),
  ('RFI', 'correspondence', 'Request for Information', '["rfi_number", "date", "subject", "response_date"]'),
  ('Meeting Minutes', 'correspondence', 'Project meeting notes', '["meeting_date", "attendees", "action_items"]'),
  ('Insurance Certificate', 'insurance', 'COI document', '["policy_number", "expiration_date", "coverage_limits"]'),
  ('Warranty', 'warranty', 'Product/work warranty', '["item", "duration", "start_date", "manufacturer"]'),
  ('Punch List', 'closeout', 'Deficiency list', '["date", "area", "item_count"]'),
  ('As-Built', 'closeout', 'As-built drawings', '["system", "date", "preparer"]')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 11. FUNCTION: Search documents
-- ============================================================
CREATE OR REPLACE FUNCTION search_documents(
  p_query TEXT,
  p_job_id UUID DEFAULT NULL,
  p_type_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  document_type TEXT,
  job_name TEXT,
  file_url TEXT,
  ai_summary TEXT,
  relevance_score REAL,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.title,
    d.description,
    dt.name as document_type,
    j.name as job_name,
    d.file_url,
    d.ai_summary,
    ts_rank(to_tsvector('english', COALESCE(d.search_text, '')), plainto_tsquery('english', p_query)) as relevance_score,
    d.created_at
  FROM v2_documents d
  LEFT JOIN v2_document_types dt ON d.document_type_id = dt.id
  LEFT JOIN v2_jobs j ON d.job_id = j.id
  WHERE d.deleted_at IS NULL
    AND (p_query IS NULL OR to_tsvector('english', COALESCE(d.search_text, '')) @@ plainto_tsquery('english', p_query))
    AND (p_job_id IS NULL OR d.job_id = p_job_id)
    AND (p_type_category IS NULL OR dt.category = p_type_category)
  ORDER BY relevance_score DESC, d.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 12. FUNCTION: Get document compliance status
-- ============================================================
CREATE OR REPLACE FUNCTION get_job_document_compliance(p_job_id UUID)
RETURNS TABLE (
  total_required INTEGER,
  received INTEGER,
  approved INTEGER,
  pending INTEGER,
  overdue INTEGER,
  compliance_percent DECIMAL
) AS $$
DECLARE
  v_total INTEGER;
  v_received INTEGER;
  v_approved INTEGER;
  v_pending INTEGER;
  v_overdue INTEGER;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('received', 'approved')),
    COUNT(*) FILTER (WHERE status = 'approved'),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'pending' AND due_date < CURRENT_DATE)
  INTO v_total, v_received, v_approved, v_pending, v_overdue
  FROM v2_job_document_checklist
  WHERE job_id = p_job_id;

  RETURN QUERY SELECT
    v_total,
    v_received,
    v_approved,
    v_pending,
    v_overdue,
    CASE WHEN v_total > 0 THEN (v_approved::DECIMAL / v_total * 100) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 13. FUNCTION: Build search text trigger
-- ============================================================
CREATE OR REPLACE FUNCTION build_document_search_text()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_text := COALESCE(NEW.title, '') || ' ' ||
                     COALESCE(NEW.description, '') || ' ' ||
                     COALESCE(NEW.ai_summary, '') || ' ' ||
                     COALESCE(NEW.file_name, '') || ' ' ||
                     COALESCE(array_to_string(NEW.tags, ' '), '') || ' ' ||
                     COALESCE(NEW.ai_extracted_data::TEXT, '');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_build_document_search
  BEFORE INSERT OR UPDATE ON v2_documents
  FOR EACH ROW
  EXECUTE FUNCTION build_document_search_text();

-- ============================================================
-- 14. VIEW: Document dashboard
-- ============================================================
CREATE OR REPLACE VIEW v2_document_dashboard AS
SELECT
  d.id,
  d.title,
  d.file_name,
  d.status,
  d.created_at,
  dt.name as document_type,
  dt.category as type_category,
  j.id as job_id,
  j.name as job_name,
  v.name as vendor_name,
  d.ai_classification_confidence,
  d.page_count,
  d.tags
FROM v2_documents d
LEFT JOIN v2_document_types dt ON d.document_type_id = dt.id
LEFT JOIN v2_jobs j ON d.job_id = j.id
LEFT JOIN v2_vendors v ON d.related_vendor_id = v.id
WHERE d.deleted_at IS NULL
ORDER BY d.created_at DESC;

-- ============================================================
-- 15. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_documents IS 'Master document registry with AI classification and extraction';
COMMENT ON TABLE v2_document_versions IS 'Version history for documents';
COMMENT ON TABLE v2_document_extractions IS 'Structured data extracted from documents by AI';
COMMENT ON TABLE v2_contract_analysis IS 'Detailed contract parsing and risk analysis';
