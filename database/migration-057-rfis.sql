-- Migration 057: RFIs (Requests for Information)
-- Formal documentation for questions about plans/specs

-- ============================================================
-- RFIS (main table)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- RFI identification
  rfi_number TEXT NOT NULL,
  subject TEXT NOT NULL,

  -- Question details
  question TEXT NOT NULL,
  reference_drawings TEXT,
  reference_specs TEXT,

  -- Status workflow: draft, open, pending, answered, closed
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent

  -- Assignment
  submitted_by TEXT,
  assigned_to TEXT,

  -- Response info (when answered)
  response TEXT,
  responded_by TEXT,
  responded_at TIMESTAMPTZ,

  -- Impact assessment
  cost_impact BOOLEAN DEFAULT false,
  cost_impact_amount DECIMAL(12,2),
  schedule_impact BOOLEAN DEFAULT false,
  schedule_impact_days INTEGER,

  -- Dates
  due_date DATE,
  date_required DATE,
  closed_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(job_id, rfi_number)
);

-- ============================================================
-- RFI RESPONSES (for multi-response tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_rfi_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES v2_rfis(id) ON DELETE CASCADE,

  response_type TEXT DEFAULT 'response', -- response, clarification, revision
  content TEXT NOT NULL,

  responded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RFI ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_rfi_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfi_id UUID NOT NULL REFERENCES v2_rfis(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  attachment_type TEXT DEFAULT 'question', -- question, response

  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_rfis_job_id ON v2_rfis(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_rfis_status ON v2_rfis(status);
CREATE INDEX IF NOT EXISTS idx_v2_rfis_assigned_to ON v2_rfis(assigned_to);
CREATE INDEX IF NOT EXISTS idx_v2_rfis_due_date ON v2_rfis(due_date);
CREATE INDEX IF NOT EXISTS idx_v2_rfis_deleted_at ON v2_rfis(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v2_rfi_responses_rfi_id ON v2_rfi_responses(rfi_id);
CREATE INDEX IF NOT EXISTS idx_v2_rfi_attachments_rfi_id ON v2_rfi_attachments(rfi_id);

-- ============================================================
-- TRIGGER FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_rfi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_rfi_updated_at ON v2_rfis;
CREATE TRIGGER trigger_rfi_updated_at
  BEFORE UPDATE ON v2_rfis
  FOR EACH ROW
  EXECUTE FUNCTION update_rfi_updated_at();

-- ============================================================
-- AUTO-GENERATE RFI NUMBER
-- ============================================================
CREATE OR REPLACE FUNCTION generate_rfi_number()
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

  -- Get next RFI number for this job
  SELECT COALESCE(MAX(
    CASE
      WHEN rfi_number ~ '-[0-9]+$' THEN
        CAST(SUBSTRING(rfi_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM v2_rfis WHERE job_id = NEW.job_id;

  NEW.rfi_number := 'RFI-' || job_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_rfi_number ON v2_rfis;
CREATE TRIGGER trigger_generate_rfi_number
  BEFORE INSERT ON v2_rfis
  FOR EACH ROW
  WHEN (NEW.rfi_number IS NULL OR NEW.rfi_number = '')
  EXECUTE FUNCTION generate_rfi_number();
