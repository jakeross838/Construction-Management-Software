-- Migration 167: Leads Foundation
-- Core tables for lead management system

-- =====================================================
-- CONTACTS TABLE (Master people/companies database)
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),

  -- Contact type
  type TEXT NOT NULL DEFAULT 'individual' CHECK (type IN ('individual', 'couple', 'company')),
  company_name TEXT, -- For company type

  -- Primary contact info
  primary_email TEXT,
  primary_phone TEXT,

  -- Address
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,

  -- Source tracking
  source TEXT,
  source_detail TEXT,

  -- Status
  is_client BOOLEAN DEFAULT false, -- Becomes true when they have a Job

  -- Metadata
  notes TEXT,
  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- CONTACT PEOPLE (Individuals within a contact)
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_contact_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES v2_contacts(id) ON DELETE CASCADE,

  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,

  role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'spouse', 'representative', 'other')),
  is_primary BOOLEAN DEFAULT false,

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- LEAD SOURCES (Configurable list)
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),

  name TEXT NOT NULL,
  category TEXT, -- referral, online, advertising, events, other
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default lead sources
INSERT INTO v2_lead_sources (name, category, sort_order) VALUES
  ('Past Client Referral', 'referral', 1),
  ('Architect Referral', 'referral', 2),
  ('Designer Referral', 'referral', 3),
  ('Realtor Referral', 'referral', 4),
  ('Friend/Family Referral', 'referral', 5),
  ('Subcontractor Referral', 'referral', 6),
  ('Website Contact Form', 'online', 10),
  ('Google Search', 'online', 11),
  ('Zillow', 'online', 12),
  ('Houzz', 'online', 13),
  ('Instagram', 'online', 14),
  ('Facebook', 'online', 15),
  ('LinkedIn', 'online', 16),
  ('Phone Call (Inbound)', 'direct', 20),
  ('Walk-in', 'direct', 21),
  ('Lot Visit', 'direct', 22),
  ('Home Show', 'events', 30),
  ('Trade Show', 'events', 31),
  ('Community Event', 'events', 32),
  ('Print Advertising', 'advertising', 40),
  ('Billboard', 'advertising', 41),
  ('Radio', 'advertising', 42),
  ('Other', 'other', 99)
ON CONFLICT DO NOTHING;

-- =====================================================
-- PIPELINE STAGES (Configurable)
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),

  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- for code references
  description TEXT,
  color TEXT DEFAULT '#6366f1',

  stage_order INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,

  -- Stage configuration
  is_won_stage BOOLEAN DEFAULT false,
  is_lost_stage BOOLEAN DEFAULT false,

  -- Required fields before entering this stage (JSONB array of field names)
  required_fields JSONB DEFAULT '[]',

  -- Auto-actions when entering stage
  auto_actions JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pipeline stages
INSERT INTO v2_pipeline_stages (name, slug, stage_order, color, description) VALUES
  ('New Inquiry', 'new_inquiry', 1, '#94a3b8', 'Initial contact received'),
  ('Initial Contact', 'initial_contact', 2, '#60a5fa', 'First phone call or meeting scheduled'),
  ('Scope Discussion', 'scope_discussion', 3, '#818cf8', 'Discussing project requirements and limitations'),
  ('Team Assembly', 'team_assembly', 4, '#a78bfa', 'Building construction team (architect, engineer, etc.)'),
  ('Preconstruction Agreement', 'precon_agreement', 5, '#c084fc', 'Preconstruction services agreement phase'),
  ('Design/Engineering', 'design_engineering', 6, '#e879f9', 'Design and engineering in progress'),
  ('Preliminary Estimate', 'prelim_estimate', 7, '#f472b6', 'Rough estimate provided'),
  ('Budget Review', 'budget_review', 8, '#fb7185', 'Reviewing and refining budget'),
  ('Final Estimate', 'final_estimate', 9, '#f97316', 'Final estimate/budget complete'),
  ('Contract Negotiation', 'contract_negotiation', 10, '#facc15', 'Negotiating final contract terms'),
  ('Won', 'won', 11, '#22c55e', 'Contract signed - converting to Job')
ON CONFLICT DO NOTHING;

-- Update won stage flag
UPDATE v2_pipeline_stages SET is_won_stage = true WHERE slug = 'won';

-- =====================================================
-- LEADS TABLE (Opportunities)
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),

  -- Relationships
  contact_id UUID REFERENCES v2_contacts(id),
  job_id UUID REFERENCES v2_jobs(id), -- Set when engaged/converted

  -- Lead identifiers
  lead_number TEXT, -- Auto-generated: LEAD-001
  project_name TEXT,

  -- Property/Lot info
  lot_address TEXT,
  lot_city TEXT,
  lot_state TEXT DEFAULT 'FL',
  lot_zip TEXT,
  lot_lat DECIMAL(10, 8),
  lot_lng DECIMAL(11, 8),
  lot_size_sqft INTEGER,
  lot_size_acres DECIMAL(10, 4),

  -- Project details
  project_type TEXT CHECK (project_type IN ('custom', 'semi_custom', 'remodel', 'addition', 'other')),
  project_sqft INTEGER,
  project_stories INTEGER,
  project_bedrooms INTEGER,
  project_bathrooms DECIMAL(3, 1),

  -- Budget
  budget_range_min DECIMAL(12, 2),
  budget_range_max DECIMAL(12, 2),
  budget_notes TEXT,

  -- Land status
  land_status TEXT CHECK (land_status IN ('owns_lot', 'under_contract', 'needs_lot', 'looking', 'unknown')),

  -- Timeline
  timeline_start DATE,
  timeline_target_completion DATE,
  timeline_flexibility TEXT CHECK (timeline_flexibility IN ('flexible', 'somewhat_flexible', 'firm')),
  timeline_notes TEXT,

  -- Pipeline
  status TEXT DEFAULT 'active' CHECK (status IN ('new', 'active', 'on_hold', 'won', 'lost')),
  stage_id UUID REFERENCES v2_pipeline_stages(id),
  stage_entered_at TIMESTAMPTZ DEFAULT NOW(),

  -- Source
  source_id UUID REFERENCES v2_lead_sources(id),
  source_detail TEXT, -- Additional source info (e.g., which past client referred)
  referrer_contact_id UUID REFERENCES v2_contacts(id), -- Link to referring contact

  -- Assignment
  assigned_to UUID, -- User ID
  assigned_at TIMESTAMPTZ,

  -- Scoring
  score INTEGER CHECK (score >= 0 AND score <= 100),
  score_breakdown JSONB, -- { budget: 25, land: 20, timeline: 15, ... }
  score_override BOOLEAN DEFAULT false,
  score_notes TEXT,

  -- Lost tracking
  lost_reason TEXT CHECK (lost_reason IN ('budget', 'timeline', 'competitor', 'not_ready', 'location', 'scope', 'communication', 'other')),
  lost_reason_detail TEXT,
  lost_to_competitor TEXT,
  lost_date DATE,

  -- Revival
  revival_date DATE,
  revival_notes TEXT,

  -- Follow-up
  next_follow_up DATE,
  follow_up_notes TEXT,

  -- Metadata
  description TEXT,
  notes TEXT,
  tags TEXT[],

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  converted_at TIMESTAMPTZ, -- When turned into a Job

  -- Soft delete
  deleted_at TIMESTAMPTZ
);

-- =====================================================
-- LEAD STAGE HISTORY (Track stage changes)
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_lead_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES v2_leads(id) ON DELETE CASCADE,

  from_stage_id UUID REFERENCES v2_pipeline_stages(id),
  to_stage_id UUID REFERENCES v2_pipeline_stages(id),

  changed_by UUID, -- User ID
  changed_at TIMESTAMPTZ DEFAULT NOW(),

  notes TEXT,
  duration_in_previous_stage INTERVAL
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_contacts_builder ON v2_contacts(builder_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON v2_contacts(primary_email);
CREATE INDEX IF NOT EXISTS idx_contacts_is_client ON v2_contacts(is_client);

CREATE INDEX IF NOT EXISTS idx_contact_people_contact ON v2_contact_people(contact_id);

CREATE INDEX IF NOT EXISTS idx_leads_builder ON v2_leads(builder_id);
CREATE INDEX IF NOT EXISTS idx_leads_contact ON v2_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_job ON v2_leads(job_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON v2_leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_stage ON v2_leads(stage_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON v2_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_source ON v2_leads(source_id);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON v2_leads(next_follow_up) WHERE next_follow_up IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_leads_created ON v2_leads(created_at);
CREATE INDEX IF NOT EXISTS idx_leads_location ON v2_leads(lot_lat, lot_lng) WHERE lot_lat IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lead_stage_history_lead ON v2_lead_stage_history(lead_id);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Auto-generate lead number
CREATE OR REPLACE FUNCTION generate_lead_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(lead_number FROM 6) AS INTEGER)), 0) + 1
  INTO next_num
  FROM v2_leads
  WHERE builder_id = NEW.builder_id;

  NEW.lead_number := 'LEAD-' || LPAD(next_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_lead_number
  BEFORE INSERT ON v2_leads
  FOR EACH ROW
  WHEN (NEW.lead_number IS NULL)
  EXECUTE FUNCTION generate_lead_number();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_lead_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_lead_updated
  BEFORE UPDATE ON v2_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_timestamp();

CREATE OR REPLACE TRIGGER trigger_contact_updated
  BEFORE UPDATE ON v2_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_lead_timestamp();

-- Track stage changes
CREATE OR REPLACE FUNCTION track_lead_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
    INSERT INTO v2_lead_stage_history (lead_id, from_stage_id, to_stage_id, duration_in_previous_stage)
    VALUES (
      NEW.id,
      OLD.stage_id,
      NEW.stage_id,
      NOW() - OLD.stage_entered_at
    );
    NEW.stage_entered_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_lead_stage_change
  BEFORE UPDATE ON v2_leads
  FOR EACH ROW
  EXECUTE FUNCTION track_lead_stage_change();
