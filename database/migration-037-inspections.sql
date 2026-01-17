-- Migration 037: Inspections System
-- Building inspections tracking with deficiency management and re-inspection workflow

-- Main inspections table
CREATE TABLE IF NOT EXISTS v2_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Identity
  inspection_type TEXT NOT NULL,
  inspection_number INTEGER,

  -- Scheduling
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,

  -- Inspector
  inspector_name TEXT,
  inspector_phone TEXT,
  inspector_agency TEXT,

  -- Result
  result TEXT DEFAULT 'scheduled' CHECK (result IN ('scheduled', 'passed', 'failed', 'partial', 'cancelled', 'no_show')),
  result_date DATE,
  result_notes TEXT,

  -- Re-inspection linking
  parent_inspection_id UUID REFERENCES v2_inspections(id),
  reinspection_count INTEGER DEFAULT 0,

  -- Metadata
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  UNIQUE NULLS NOT DISTINCT (job_id, inspection_type, inspection_number)
);

-- Deficiencies for failed inspections
CREATE TABLE IF NOT EXISTS v2_inspection_deficiencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES v2_inspections(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  location TEXT,
  severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  assigned_vendor_id UUID REFERENCES v2_vendors(id),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photo attachments
CREATE TABLE IF NOT EXISTS v2_inspection_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES v2_inspections(id) ON DELETE CASCADE,
  deficiency_id UUID REFERENCES v2_inspection_deficiencies(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  caption TEXT,
  category TEXT DEFAULT 'inspection',
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE IF NOT EXISTS v2_inspection_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES v2_inspections(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_v2_inspections_job ON v2_inspections(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_v2_inspections_scheduled ON v2_inspections(scheduled_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_v2_inspections_result ON v2_inspections(result) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_v2_inspection_deficiencies_inspection ON v2_inspection_deficiencies(inspection_id);
CREATE INDEX IF NOT EXISTS idx_v2_inspection_deficiencies_status ON v2_inspection_deficiencies(status);
CREATE INDEX IF NOT EXISTS idx_v2_inspection_attachments_inspection ON v2_inspection_attachments(inspection_id);
CREATE INDEX IF NOT EXISTS idx_v2_inspection_activity_inspection ON v2_inspection_activity(inspection_id);
