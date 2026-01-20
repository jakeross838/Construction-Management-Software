-- Migration 075: Contacts and Companies for CRM
-- Phase 57: CRM Foundation

-- Companies table (create first since contacts reference it)
CREATE TABLE IF NOT EXISTS v2_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  company_type TEXT,  -- client, subcontractor, supplier, architect, engineer, inspector, other
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',  -- active, inactive
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_companies_status ON v2_companies(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_type ON v2_companies(company_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_companies_deleted ON v2_companies(deleted_at);

-- Contacts table
CREATE TABLE IF NOT EXISTS v2_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  title TEXT,
  company_id UUID REFERENCES v2_companies(id) ON DELETE SET NULL,
  contact_role TEXT DEFAULT 'other',  -- client, vendor, subcontractor, architect, engineer, inspector, other
  is_primary BOOLEAN DEFAULT false,  -- primary contact for their company
  preferred_contact TEXT DEFAULT 'email',  -- email, phone, mobile
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  status TEXT DEFAULT 'active',  -- active, inactive
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contacts_company ON v2_contacts(company_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_role ON v2_contacts(contact_role) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_status ON v2_contacts(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_deleted ON v2_contacts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON v2_contacts(last_name, first_name) WHERE deleted_at IS NULL;

-- Contact-Job linking table (which contacts are associated with which jobs)
CREATE TABLE IF NOT EXISTS v2_contact_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES v2_contacts(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  role TEXT,  -- role on this specific job (e.g., project_manager, owner, architect)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(contact_id, job_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_jobs_contact ON v2_contact_jobs(contact_id);
CREATE INDEX IF NOT EXISTS idx_contact_jobs_job ON v2_contact_jobs(job_id);

-- Update trigger for contacts
CREATE OR REPLACE FUNCTION update_contacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_contacts_updated_at ON v2_contacts;
CREATE TRIGGER trigger_contacts_updated_at
  BEFORE UPDATE ON v2_contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();

-- Update trigger for companies
DROP TRIGGER IF EXISTS trigger_companies_updated_at ON v2_companies;
CREATE TRIGGER trigger_companies_updated_at
  BEFORE UPDATE ON v2_companies
  FOR EACH ROW
  EXECUTE FUNCTION update_contacts_updated_at();
