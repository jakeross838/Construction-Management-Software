-- Migration 164: Document Intelligence Phase 6
-- Date: 2026-02-01
-- Purpose: PDF text extraction, auto-categorization, expiration alerts, full-text search

-- ============================================================
-- 1. DOCUMENT METADATA TABLE (Extracted text and categorization)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_document_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES v2_documents(id) ON DELETE CASCADE,

  -- Extracted content
  extracted_text TEXT,
  extracted_at TIMESTAMPTZ,
  extraction_method TEXT CHECK (extraction_method IN ('pdf-parse', 'ocr', 'manual')),
  page_count INTEGER,
  word_count INTEGER,

  -- Auto-categorization
  ai_category TEXT,
  ai_category_confidence DECIMAL(5,2),
  ai_suggested_tags TEXT[],

  -- Expiration tracking
  expiration_date DATE,
  expiration_type TEXT CHECK (expiration_type IN ('insurance', 'license', 'permit', 'warranty', 'contract', 'certification', 'bond', 'other')),
  expiration_notes TEXT,
  alert_days_before INTEGER[] DEFAULT '{30, 14, 7}',

  -- Timestamps
  last_extracted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One metadata record per document
  UNIQUE(document_id)
);

-- ============================================================
-- 2. DOCUMENT ALERTS TABLE (Expiration and other alerts)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_document_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES v2_documents(id) ON DELETE CASCADE,

  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN ('expiring_soon', 'expired', 'missing_required', 'needs_review', 'extraction_failed')),
  alert_date DATE NOT NULL,
  days_until_expiry INTEGER,

  -- Alert message
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',

  -- Acknowledgment
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate alerts for same document/type/date
  UNIQUE(document_id, alert_type, alert_date)
);

-- ============================================================
-- 3. FULL-TEXT SEARCH INDEX ON EXTRACTED TEXT
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_document_metadata_search
  ON v2_document_metadata
  USING gin(to_tsvector('english', COALESCE(extracted_text, '')));

-- ============================================================
-- 4. OTHER INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_document_metadata_document ON v2_document_metadata(document_id);
CREATE INDEX IF NOT EXISTS idx_document_metadata_expiration ON v2_document_metadata(expiration_date) WHERE expiration_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_metadata_category ON v2_document_metadata(ai_category);
CREATE INDEX IF NOT EXISTS idx_document_alerts_document ON v2_document_alerts(document_id);
CREATE INDEX IF NOT EXISTS idx_document_alerts_type ON v2_document_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_document_alerts_date ON v2_document_alerts(alert_date);
CREATE INDEX IF NOT EXISTS idx_document_alerts_active ON v2_document_alerts(acknowledged, dismissed) WHERE acknowledged = FALSE AND dismissed = FALSE;

-- ============================================================
-- 5. FULL-TEXT SEARCH FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION search_document_content(
  p_query TEXT,
  p_job_id UUID DEFAULT NULL,
  p_category TEXT DEFAULT NULL,
  p_expiration_type TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  document_id UUID,
  document_title TEXT,
  job_id UUID,
  job_name TEXT,
  category TEXT,
  file_url TEXT,
  expiration_date DATE,
  expiration_type TEXT,
  matched_text TEXT,
  relevance_score REAL,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as document_id,
    d.title as document_title,
    d.job_id,
    j.name as job_name,
    dt.category,
    d.file_url,
    dm.expiration_date,
    dm.expiration_type,
    ts_headline('english', COALESCE(dm.extracted_text, ''), plainto_tsquery('english', p_query),
      'MaxWords=50, MinWords=20, StartSel=<mark>, StopSel=</mark>') as matched_text,
    ts_rank(to_tsvector('english', COALESCE(dm.extracted_text, '')), plainto_tsquery('english', p_query)) as relevance_score,
    d.created_at
  FROM v2_documents d
  LEFT JOIN v2_document_metadata dm ON d.id = dm.document_id
  LEFT JOIN v2_document_types dt ON d.document_type_id = dt.id
  LEFT JOIN v2_jobs j ON d.job_id = j.id
  WHERE d.deleted_at IS NULL
    AND (p_query IS NULL OR to_tsvector('english', COALESCE(dm.extracted_text, '')) @@ plainto_tsquery('english', p_query))
    AND (p_job_id IS NULL OR d.job_id = p_job_id)
    AND (p_category IS NULL OR dt.category = p_category)
    AND (p_expiration_type IS NULL OR dm.expiration_type = p_expiration_type)
  ORDER BY relevance_score DESC, d.created_at DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. GET EXPIRING DOCUMENTS FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION get_expiring_documents(
  p_days INTEGER DEFAULT 30,
  p_job_id UUID DEFAULT NULL,
  p_expiration_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  document_title TEXT,
  job_id UUID,
  job_name TEXT,
  vendor_id UUID,
  vendor_name TEXT,
  file_url TEXT,
  expiration_date DATE,
  expiration_type TEXT,
  days_until_expiry INTEGER,
  alert_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id as document_id,
    d.title as document_title,
    d.job_id,
    j.name as job_name,
    d.related_vendor_id as vendor_id,
    v.name as vendor_name,
    d.file_url,
    dm.expiration_date,
    dm.expiration_type,
    (dm.expiration_date - CURRENT_DATE)::INTEGER as days_until_expiry,
    CASE
      WHEN dm.expiration_date < CURRENT_DATE THEN 'expired'
      WHEN dm.expiration_date <= CURRENT_DATE + p_days THEN 'expiring_soon'
      ELSE 'valid'
    END as alert_status
  FROM v2_documents d
  INNER JOIN v2_document_metadata dm ON d.id = dm.document_id
  LEFT JOIN v2_jobs j ON d.job_id = j.id
  LEFT JOIN v2_vendors v ON d.related_vendor_id = v.id
  WHERE d.deleted_at IS NULL
    AND dm.expiration_date IS NOT NULL
    AND dm.expiration_date <= CURRENT_DATE + p_days
    AND (p_job_id IS NULL OR d.job_id = p_job_id)
    AND (p_expiration_type IS NULL OR dm.expiration_type = p_expiration_type)
  ORDER BY dm.expiration_date ASC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. GENERATE EXPIRATION ALERTS FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION generate_expiration_alerts()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_doc RECORD;
  v_days_before INTEGER;
BEGIN
  -- Loop through documents with expiration dates
  FOR v_doc IN
    SELECT
      d.id as document_id,
      d.title,
      dm.expiration_date,
      dm.expiration_type,
      dm.alert_days_before
    FROM v2_documents d
    INNER JOIN v2_document_metadata dm ON d.id = dm.document_id
    WHERE d.deleted_at IS NULL
      AND dm.expiration_date IS NOT NULL
      AND dm.expiration_date >= CURRENT_DATE
      AND dm.alert_days_before IS NOT NULL
  LOOP
    -- Check each alert threshold
    FOREACH v_days_before IN ARRAY v_doc.alert_days_before
    LOOP
      IF v_doc.expiration_date = CURRENT_DATE + v_days_before THEN
        INSERT INTO v2_document_alerts (
          document_id,
          alert_type,
          alert_date,
          days_until_expiry,
          title,
          message,
          severity
        )
        VALUES (
          v_doc.document_id,
          'expiring_soon',
          CURRENT_DATE,
          v_days_before,
          v_doc.title || ' expires in ' || v_days_before || ' days',
          'Document "' || v_doc.title || '" (' || COALESCE(v_doc.expiration_type, 'document') || ') will expire on ' || v_doc.expiration_date::TEXT,
          CASE
            WHEN v_days_before <= 7 THEN 'critical'
            WHEN v_days_before <= 14 THEN 'high'
            WHEN v_days_before <= 30 THEN 'medium'
            ELSE 'low'
          END
        )
        ON CONFLICT (document_id, alert_type, alert_date) DO NOTHING;

        v_count := v_count + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Also create alerts for already expired documents
  INSERT INTO v2_document_alerts (
    document_id,
    alert_type,
    alert_date,
    days_until_expiry,
    title,
    message,
    severity
  )
  SELECT
    d.id,
    'expired',
    CURRENT_DATE,
    (dm.expiration_date - CURRENT_DATE)::INTEGER,
    d.title || ' has expired',
    'Document "' || d.title || '" (' || COALESCE(dm.expiration_type, 'document') || ') expired on ' || dm.expiration_date::TEXT,
    'critical'
  FROM v2_documents d
  INNER JOIN v2_document_metadata dm ON d.id = dm.document_id
  WHERE d.deleted_at IS NULL
    AND dm.expiration_date IS NOT NULL
    AND dm.expiration_date < CURRENT_DATE
    AND NOT EXISTS (
      SELECT 1 FROM v2_document_alerts da
      WHERE da.document_id = d.id
        AND da.alert_type = 'expired'
        AND da.alert_date = CURRENT_DATE
    )
  ON CONFLICT (document_id, alert_type, alert_date) DO NOTHING;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_document_metadata IS 'Stores extracted text, AI categorization, and expiration tracking for documents';
COMMENT ON TABLE v2_document_alerts IS 'Expiration and compliance alerts for documents';
COMMENT ON FUNCTION search_document_content IS 'Full-text search across extracted document content';
COMMENT ON FUNCTION get_expiring_documents IS 'Returns documents expiring within specified days';
COMMENT ON FUNCTION generate_expiration_alerts IS 'Creates expiration alerts based on document alert thresholds';
