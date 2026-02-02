-- Migration 130: Create NOA (Notice of Acceptance) / Product Approvals tables
-- For Florida Building Code product approval tracking

-- Create NOAs table
CREATE TABLE IF NOT EXISTS v2_noas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,

  -- Product info
  product_name VARCHAR(255) NOT NULL,
  product_type VARCHAR(100) NOT NULL CHECK (product_type IN (
    'windows', 'doors', 'roofing', 'siding', 'structural',
    'waterproofing', 'insulation', 'hvac', 'electrical',
    'plumbing', 'fire_protection', 'other'
  )),
  manufacturer VARCHAR(255),
  model_number VARCHAR(255),

  -- Florida approval info
  fl_approval_number VARCHAR(100) NOT NULL,
  approval_type VARCHAR(50) DEFAULT 'state' CHECK (approval_type IN ('state', 'miami_dade', 'local')),

  -- Dates
  issue_date DATE,
  expiration_date DATE,

  -- Specs
  wind_speed_rating INTEGER,
  impact_rated BOOLEAN DEFAULT FALSE,
  energy_rated BOOLEAN DEFAULT FALSE,
  fire_rating VARCHAR(50),

  -- Performance
  design_pressure DECIMAL(10,2),
  water_resistance DECIMAL(10,2),
  air_infiltration DECIMAL(10,2),

  -- Document
  document_url TEXT,
  document_name VARCHAR(255),

  -- Status
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'expiring_soon', 'expired', 'superseded')),

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  -- Meta
  created_by VARCHAR(255) DEFAULT 'System',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create NOA usage tracking (which jobs use which NOAs)
CREATE TABLE IF NOT EXISTS v2_noa_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  noa_id UUID NOT NULL REFERENCES v2_noas(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  location_description TEXT,
  quantity INTEGER,
  verified_at TIMESTAMPTZ,
  verified_by VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(noa_id, job_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_v2_noas_job_id ON v2_noas(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_noas_fl_approval ON v2_noas(fl_approval_number);
CREATE INDEX IF NOT EXISTS idx_v2_noas_product_type ON v2_noas(product_type);
CREATE INDEX IF NOT EXISTS idx_v2_noas_status ON v2_noas(status);
CREATE INDEX IF NOT EXISTS idx_v2_noas_expiration ON v2_noas(expiration_date);
CREATE INDEX IF NOT EXISTS idx_v2_noa_usages_noa_id ON v2_noa_usages(noa_id);
CREATE INDEX IF NOT EXISTS idx_v2_noa_usages_job_id ON v2_noa_usages(job_id);

-- Enable RLS
ALTER TABLE v2_noas ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_noa_usages ENABLE ROW LEVEL SECURITY;

-- Create policies
DROP POLICY IF EXISTS "Allow all for v2_noas" ON v2_noas;
CREATE POLICY "Allow all for v2_noas" ON v2_noas FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for v2_noa_usages" ON v2_noa_usages;
CREATE POLICY "Allow all for v2_noa_usages" ON v2_noa_usages FOR ALL USING (true) WITH CHECK (true);
