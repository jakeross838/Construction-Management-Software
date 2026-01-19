-- Migration 058: Submittals
-- Tracks submittal workflow for materials, shop drawings, samples, etc.

-- ============================================================
-- SUBMITTALS (main table)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_submittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Submittal identification
  submittal_number TEXT NOT NULL,
  revision TEXT DEFAULT 'A',
  title TEXT NOT NULL,

  -- Classification
  type TEXT DEFAULT 'shop_drawing', -- shop_drawing, product_data, sample, mock_up, other
  spec_section TEXT,
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Description
  description TEXT,

  -- Status workflow: draft, pending_review, approved, approved_as_noted, revise_resubmit, rejected
  status TEXT DEFAULT 'draft',

  -- Assignment
  submitted_by TEXT,
  submitted_to TEXT,
  subcontractor TEXT,
  manufacturer TEXT,

  -- Review info
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_comments TEXT,

  -- Dates
  date_submitted DATE,
  date_required DATE,
  date_returned DATE,
  lead_time_days INTEGER,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE(job_id, submittal_number, revision)
);

-- ============================================================
-- SUBMITTAL ITEMS (line items within a submittal)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_submittal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID NOT NULL REFERENCES v2_submittals(id) ON DELETE CASCADE,

  item_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit TEXT,
  manufacturer TEXT,
  model_number TEXT,
  status TEXT DEFAULT 'pending', -- pending, approved, rejected

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBMITTAL ATTACHMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_submittal_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID NOT NULL REFERENCES v2_submittals(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  attachment_type TEXT DEFAULT 'submission', -- submission, review, revised

  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SUBMITTAL LOG (history/audit)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_submittal_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submittal_id UUID NOT NULL REFERENCES v2_submittals(id) ON DELETE CASCADE,

  action TEXT NOT NULL, -- created, submitted, reviewed, revised, approved, rejected
  old_status TEXT,
  new_status TEXT,
  comments TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_submittals_job_id ON v2_submittals(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_submittals_status ON v2_submittals(status);
CREATE INDEX IF NOT EXISTS idx_v2_submittals_type ON v2_submittals(type);
CREATE INDEX IF NOT EXISTS idx_v2_submittals_spec_section ON v2_submittals(spec_section);
CREATE INDEX IF NOT EXISTS idx_v2_submittals_deleted_at ON v2_submittals(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v2_submittal_items_submittal_id ON v2_submittal_items(submittal_id);
CREATE INDEX IF NOT EXISTS idx_v2_submittal_attachments_submittal_id ON v2_submittal_attachments(submittal_id);
CREATE INDEX IF NOT EXISTS idx_v2_submittal_log_submittal_id ON v2_submittal_log(submittal_id);

-- ============================================================
-- TRIGGER FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_submittal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_submittal_updated_at ON v2_submittals;
CREATE TRIGGER trigger_submittal_updated_at
  BEFORE UPDATE ON v2_submittals
  FOR EACH ROW
  EXECUTE FUNCTION update_submittal_updated_at();

-- ============================================================
-- AUTO-GENERATE SUBMITTAL NUMBER
-- ============================================================
CREATE OR REPLACE FUNCTION generate_submittal_number()
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

  -- Get next submittal number for this job
  SELECT COALESCE(MAX(
    CASE
      WHEN submittal_number ~ '-[0-9]+$' THEN
        CAST(SUBSTRING(submittal_number FROM '-([0-9]+)$') AS INTEGER)
      ELSE 0
    END
  ), 0) + 1 INTO next_num
  FROM v2_submittals WHERE job_id = NEW.job_id;

  NEW.submittal_number := 'SUB-' || job_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_generate_submittal_number ON v2_submittals;
CREATE TRIGGER trigger_generate_submittal_number
  BEFORE INSERT ON v2_submittals
  FOR EACH ROW
  WHEN (NEW.submittal_number IS NULL OR NEW.submittal_number = '')
  EXECUTE FUNCTION generate_submittal_number();
