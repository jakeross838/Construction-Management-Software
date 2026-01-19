-- Migration 055: Leads/CRM System
-- Creates tables for lead management, pipeline tracking, activities, tasks, and documents

-- ============================================================
-- LEAD SOURCES (reference table for dropdown)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default lead sources
INSERT INTO v2_lead_sources (name, category, display_order) VALUES
  ('Website', 'Online', 1),
  ('Phone Call', 'Direct', 2),
  ('Referral - Client', 'Referral', 3),
  ('Referral - Realtor', 'Referral', 4),
  ('Referral - Architect', 'Referral', 5),
  ('Houzz', 'Online', 6),
  ('Social Media', 'Online', 7),
  ('Home Show/Event', 'Event', 8),
  ('Drive-by/Sign', 'Direct', 9),
  ('Zillow/Realtor.com', 'Online', 10),
  ('Google Ads', 'Advertising', 11),
  ('Print/Magazine', 'Advertising', 12),
  ('Other', 'Other', 99)
ON CONFLICT DO NOTHING;

-- ============================================================
-- LEADS (main CRM table)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact Info
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  preferred_contact_method TEXT DEFAULT 'email',

  -- Source Tracking
  lead_source_id UUID REFERENCES v2_lead_sources(id),
  lead_source_detail TEXT,
  referral_source TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  -- Project Info
  project_type TEXT,
  project_address TEXT,
  has_lot BOOLEAN,
  budget_range TEXT,
  timeline TEXT,
  square_footage INTEGER,
  bedrooms INTEGER,
  bathrooms DECIMAL(3,1),
  architectural_style TEXT,
  project_description TEXT,

  -- Qualification
  is_decision_maker BOOLEAN,
  financing_status TEXT,
  has_architect BOOLEAN,
  has_plans BOOLEAN,
  qualification_score INTEGER DEFAULT 0,

  -- Pipeline
  stage TEXT DEFAULT 'inquiry',
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_to TEXT,

  -- Outcome (when closed)
  outcome TEXT,
  lost_reason TEXT,
  lost_competitor TEXT,

  -- Job Link (when converted)
  job_id UUID REFERENCES v2_jobs(id),
  converted_at TIMESTAMPTZ,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- LEAD ACTIVITIES (contact history)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_lead_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES v2_leads(id) ON DELETE CASCADE,

  activity_type TEXT NOT NULL,
  direction TEXT,
  subject TEXT,
  description TEXT,
  outcome TEXT,
  duration_minutes INTEGER,

  performed_by TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEAD TASKS (follow-up reminders)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_lead_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES v2_leads(id) ON DELETE CASCADE,

  task_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  due_time TIME,

  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by TEXT,

  assigned_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEAD DOCUMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_lead_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES v2_leads(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT,

  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- LEAD STAGE HISTORY (for analytics)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES v2_leads(id) ON DELETE CASCADE,

  from_stage TEXT,
  to_stage TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_leads_stage ON v2_leads(stage);
CREATE INDEX IF NOT EXISTS idx_v2_leads_assigned_to ON v2_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_v2_leads_job_id ON v2_leads(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_leads_deleted_at ON v2_leads(deleted_at);
CREATE INDEX IF NOT EXISTS idx_v2_leads_created_at ON v2_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_v2_lead_activities_lead_id ON v2_lead_activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_v2_lead_tasks_lead_id ON v2_lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_v2_lead_tasks_due_date ON v2_lead_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_v2_lead_tasks_status ON v2_lead_tasks(status);
CREATE INDEX IF NOT EXISTS idx_v2_lead_documents_lead_id ON v2_lead_documents(lead_id);
CREATE INDEX IF NOT EXISTS idx_v2_lead_stage_history_lead_id ON v2_lead_stage_history(lead_id);

-- ============================================================
-- TRIGGER FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_lead_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lead_updated_at ON v2_leads;
CREATE TRIGGER trigger_lead_updated_at
  BEFORE UPDATE ON v2_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_updated_at();
