-- Migration 080: Permitting System
-- Permit applications, inspections, and document tracking

-- Permits
CREATE TABLE IF NOT EXISTS v2_permits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES v2_jobs(id),
  permit_number TEXT,
  permit_type TEXT NOT NULL, -- building, electrical, plumbing, mechanical, roofing, demo, other
  description TEXT,
  status TEXT DEFAULT 'draft', -- draft, submitted, under_review, approved, denied, expired, closed
  submission_date DATE,
  approval_date DATE,
  expiration_date DATE,
  issued_by TEXT, -- jurisdiction/authority
  fee_amount DECIMAL(10,2),
  fee_paid BOOLEAN DEFAULT false,
  fee_paid_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Permit inspections
CREATE TABLE IF NOT EXISTS v2_permit_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permit_id UUID NOT NULL REFERENCES v2_permits(id),
  job_id UUID REFERENCES v2_jobs(id),
  inspection_type TEXT NOT NULL, -- foundation, framing, rough_in, final, other
  description TEXT,
  scheduled_date DATE,
  scheduled_time TIME,
  inspector_contact_id UUID REFERENCES v2_contacts(id),
  inspector_name TEXT,
  inspector_phone TEXT,
  status TEXT DEFAULT 'scheduled', -- scheduled, passed, failed, cancelled, rescheduled
  result_notes TEXT,
  completed_date DATE,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permit documents (permits, approvals, COO, etc.)
CREATE TABLE IF NOT EXISTS v2_permit_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permit_id UUID NOT NULL REFERENCES v2_permits(id),
  document_type TEXT NOT NULL, -- application, permit, approval, coo, inspection_report, other
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permit activity log
CREATE TABLE IF NOT EXISTS v2_permit_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  permit_id UUID NOT NULL REFERENCES v2_permits(id),
  action TEXT NOT NULL, -- created, submitted, updated, inspection_scheduled, inspection_completed, approved, denied
  description TEXT,
  performed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_permits_job ON v2_permits(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_permits_status ON v2_permits(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_permits_type ON v2_permits(permit_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_permit_inspections_permit ON v2_permit_inspections(permit_id);
CREATE INDEX IF NOT EXISTS idx_permit_inspections_date ON v2_permit_inspections(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_permit_inspections_status ON v2_permit_inspections(status);
CREATE INDEX IF NOT EXISTS idx_permit_documents_permit ON v2_permit_documents(permit_id);
CREATE INDEX IF NOT EXISTS idx_permit_activity_permit ON v2_permit_activity(permit_id);
