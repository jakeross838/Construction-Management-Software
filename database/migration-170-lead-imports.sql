-- Migration 170: Lead Import System
-- Tracks CSV imports and provides audit trail

-- Import jobs table
CREATE TABLE IF NOT EXISTS v2_lead_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Import details
  file_name TEXT NOT NULL,
  file_size INTEGER,
  total_rows INTEGER,

  -- Processing status
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  processed_rows INTEGER DEFAULT 0,
  successful_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,

  -- Results
  error_log JSONB DEFAULT '[]',
  created_lead_ids UUID[] DEFAULT '{}',

  -- Metadata
  imported_by TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Import field mappings (saved templates)
CREATE TABLE IF NOT EXISTS v2_lead_import_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,

  -- Column mappings: { "csv_column": "lead_field" }
  mappings JSONB NOT NULL DEFAULT '{}',

  -- Default values for unmapped fields
  defaults JSONB DEFAULT '{}',

  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lead_imports_status ON v2_lead_imports(status);
CREATE INDEX IF NOT EXISTS idx_lead_imports_created ON v2_lead_imports(created_at);

-- Insert default mapping template
INSERT INTO v2_lead_import_mappings (name, description, mappings, defaults, is_default) VALUES
('Standard CSV Import', 'Default mapping for common CSV formats', '{
  "first_name": "first_name",
  "last_name": "last_name",
  "email": "email",
  "phone": "phone",
  "company": "company_name",
  "project_address": "project_address",
  "project_type": "project_type",
  "estimated_value": "estimated_value",
  "source": "source_name",
  "notes": "notes"
}', '{
  "stage": "new_inquiry"
}', true)
ON CONFLICT DO NOTHING;
