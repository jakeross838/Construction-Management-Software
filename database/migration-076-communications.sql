-- Migration 076: Communications Logging
-- Track calls, emails, notes, and other communications

-- Communications table
CREATE TABLE IF NOT EXISTS v2_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What type of communication
  comm_type TEXT NOT NULL CHECK (comm_type IN ('call', 'email', 'note', 'meeting', 'text', 'other')),
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),

  -- Content
  subject TEXT,
  body TEXT,
  summary TEXT,  -- Brief summary for list views

  -- Linked entities (at least one should be set)
  contact_id UUID REFERENCES v2_contacts(id) ON DELETE SET NULL,
  company_id UUID REFERENCES v2_companies(id) ON DELETE SET NULL,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Communication details
  comm_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_minutes INTEGER,  -- For calls/meetings

  -- Follow-up
  follow_up_date DATE,
  follow_up_notes TEXT,
  follow_up_completed BOOLEAN DEFAULT false,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_communications_contact ON v2_communications(contact_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communications_company ON v2_communications(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communications_job ON v2_communications(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communications_date ON v2_communications(comm_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communications_type ON v2_communications(comm_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_communications_follow_up ON v2_communications(follow_up_date)
  WHERE deleted_at IS NULL AND follow_up_date IS NOT NULL AND follow_up_completed = false;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_communications_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_communications_timestamp ON v2_communications;
CREATE TRIGGER set_communications_timestamp
  BEFORE UPDATE ON v2_communications
  FOR EACH ROW
  EXECUTE FUNCTION update_communications_timestamp();
