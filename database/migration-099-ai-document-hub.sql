-- Migration 099: AI Document Intelligence Hub (Phase 70.1)
-- Foundational AI infrastructure that processes any document and routes data everywhere
-- NOTE: This migration drops and recreates v2_document_extractions with new schema

-- ============================================================
-- 1. DROP OLD TABLE (had different schema from migration-088)
-- ============================================================
DROP TABLE IF EXISTS v2_document_extractions CASCADE;

-- ============================================================
-- 2. DOCUMENT QUEUE TABLE (if not exists)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_document_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  uploaded_by TEXT,
  document_type TEXT DEFAULT 'unknown',
  ai_confidence DECIMAL(5,4),
  status TEXT DEFAULT 'pending',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_queue_status ON v2_document_queue(status);
CREATE INDEX IF NOT EXISTS idx_doc_queue_type ON v2_document_queue(document_type);
CREATE INDEX IF NOT EXISTS idx_doc_queue_job ON v2_document_queue(job_id);
CREATE INDEX IF NOT EXISTS idx_doc_queue_created ON v2_document_queue(created_at DESC);

-- ============================================================
-- 3. DOCUMENT EXTRACTIONS TABLE (new schema)
-- ============================================================
CREATE TABLE v2_document_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES v2_document_queue(id) ON DELETE CASCADE,
  extracted_data JSONB NOT NULL DEFAULT '{}',
  model_used TEXT,
  tokens_used INTEGER,
  extraction_time_ms INTEGER,
  routing_destinations JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_extractions_doc ON v2_document_extractions(document_id);

-- ============================================================
-- 4. DOCUMENT ROUTING LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_document_routing_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES v2_document_queue(id) ON DELETE CASCADE,
  extraction_id UUID REFERENCES v2_document_extractions(id) ON DELETE SET NULL,
  destination TEXT NOT NULL,
  destination_record_id UUID,
  destination_record_type TEXT,
  routed_data JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'skipped')),
  error_message TEXT,
  auto_routed BOOLEAN DEFAULT false,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_routing_log_doc ON v2_document_routing_log(document_id);
CREATE INDEX IF NOT EXISTS idx_routing_log_dest ON v2_document_routing_log(destination);
CREATE INDEX IF NOT EXISTS idx_routing_log_status ON v2_document_routing_log(status);

-- ============================================================
-- 5. EXTRACTION TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_extraction_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type TEXT NOT NULL UNIQUE,
  extraction_schema JSONB NOT NULL,
  routing_rules JSONB NOT NULL,
  example_extractions JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. DEFAULT TEMPLATES
-- ============================================================
INSERT INTO v2_extraction_templates (document_type, extraction_schema, routing_rules) VALUES
('invoice', '{"vendor_name": "string", "invoice_number": "string", "invoice_date": "date", "total_amount": "decimal", "line_items": []}', '{"invoices": {"auto_route": false}, "pricing": {"auto_route": true}}'),
('quote', '{"vendor_name": "string", "quote_number": "string", "total_amount": "decimal", "line_items": [], "lead_time_days": "integer"}', '{"catalog": {"auto_route": false}, "pricing": {"auto_route": true}}'),
('proposal', '{"vendor_name": "string", "scope_of_work": "string", "total_amount": "decimal", "warranty_terms": "string"}', '{"catalog": {"auto_route": false}, "knowledge": {"auto_route": false}}'),
('spec_sheet', '{"product_name": "string", "manufacturer": "string", "model_number": "string", "specifications": "object"}', '{"catalog": {"auto_route": false}, "knowledge": {"auto_route": false}}'),
('delivery_receipt', '{"vendor_name": "string", "delivery_date": "date", "items_delivered": []}', '{"daily_logs": {"auto_route": false}, "schedule": {"auto_route": true}}'),
('warranty_doc', '{"product_name": "string", "warranty_months": "integer", "coverage_details": "string"}', '{"catalog": {"auto_route": false}, "knowledge": {"auto_route": false}}'),
('change_order', '{"co_number": "string", "total_amount": "decimal", "line_items": []}', '{"invoices": {"auto_route": false}, "schedule": {"auto_route": false}}')
ON CONFLICT (document_type) DO NOTHING;

-- ============================================================
-- 7. VIEWS
-- ============================================================
CREATE OR REPLACE VIEW v2_documents_pending_review AS
SELECT
  dq.*,
  de.extracted_data,
  de.routing_destinations,
  j.name as job_name,
  v.name as vendor_name
FROM v2_document_queue dq
LEFT JOIN v2_document_extractions de ON de.document_id = dq.id
LEFT JOIN v2_jobs j ON j.id = dq.job_id
LEFT JOIN v2_vendors v ON v.id = dq.vendor_id
WHERE dq.status IN ('extracted', 'review')
ORDER BY dq.created_at DESC;

CREATE OR REPLACE VIEW v2_document_processing_stats AS
SELECT
  document_type,
  status,
  COUNT(*) as count,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) as avg_processing_seconds
FROM v2_document_queue
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY document_type, status;
