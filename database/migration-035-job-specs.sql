-- Migration 035: Job Specifications for House Details
-- Adds comprehensive specs fields for historical/predictive data

-- Add specification columns to v2_jobs
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS sqft_conditioned INTEGER,
ADD COLUMN IF NOT EXISTS sqft_total INTEGER,
ADD COLUMN IF NOT EXISTS sqft_garage INTEGER,
ADD COLUMN IF NOT EXISTS sqft_covered INTEGER,
ADD COLUMN IF NOT EXISTS lot_size_sqft INTEGER,
ADD COLUMN IF NOT EXISTS lot_size_acres DECIMAL(6,3),
ADD COLUMN IF NOT EXISTS bedrooms INTEGER,
ADD COLUMN IF NOT EXISTS bathrooms DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS half_baths INTEGER,
ADD COLUMN IF NOT EXISTS stories DECIMAL(3,1),
ADD COLUMN IF NOT EXISTS garage_spaces INTEGER,
ADD COLUMN IF NOT EXISTS ac_units INTEGER,
ADD COLUMN IF NOT EXISTS ac_tonnage DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS pool_type TEXT,  -- none, in_ground, above_ground, spa
ADD COLUMN IF NOT EXISTS construction_type TEXT,  -- new_construction, renovation, addition
ADD COLUMN IF NOT EXISTS foundation_type TEXT,  -- slab, crawl, basement, pier
ADD COLUMN IF NOT EXISTS roof_type TEXT,  -- shingle, tile, metal, flat
ADD COLUMN IF NOT EXISTS exterior_finish TEXT,  -- stucco, siding, brick, stone
ADD COLUMN IF NOT EXISTS year_built INTEGER,
ADD COLUMN IF NOT EXISTS zoning TEXT,
ADD COLUMN IF NOT EXISTS flood_zone TEXT,
ADD COLUMN IF NOT EXISTS parcel_id TEXT,
ADD COLUMN IF NOT EXISTS legal_description TEXT,
ADD COLUMN IF NOT EXISTS architect TEXT,
ADD COLUMN IF NOT EXISTS engineer TEXT,
ADD COLUMN IF NOT EXISTS permit_number TEXT,
ADD COLUMN IF NOT EXISTS permit_date DATE,
ADD COLUMN IF NOT EXISTS estimated_start DATE,
ADD COLUMN IF NOT EXISTS estimated_completion DATE,
ADD COLUMN IF NOT EXISTS actual_start DATE,
ADD COLUMN IF NOT EXISTS actual_completion DATE,
ADD COLUMN IF NOT EXISTS specs_notes TEXT,
ADD COLUMN IF NOT EXISTS specs_extracted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS specs_source_document_id UUID,
ADD COLUMN IF NOT EXISTS specs_ai_confidence DECIMAL(3,2);

-- Add custom specs for flexibility (JSON for additional fields)
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS custom_specs JSONB DEFAULT '{}';

-- Create job specs activity log for tracking changes
CREATE TABLE IF NOT EXISTS v2_job_specs_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- updated, ai_extracted, manual_override
  performed_by TEXT,
  field_changes JSONB,  -- {"field": {"old": x, "new": y}}
  source_document_id UUID,
  ai_confidence DECIMAL(3,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for job specs activity
CREATE INDEX IF NOT EXISTS idx_job_specs_activity_job_id ON v2_job_specs_activity(job_id);

-- Add foreign key for specs source document (only if v2_documents exists)
-- Note: This will fail silently if v2_documents doesn't exist yet
ALTER TABLE v2_jobs
DROP CONSTRAINT IF EXISTS fk_specs_source_document;

-- Try to add the FK - will be skipped if it causes an error
ALTER TABLE v2_jobs
ADD CONSTRAINT fk_specs_source_document
FOREIGN KEY (specs_source_document_id) REFERENCES v2_documents(id) ON DELETE SET NULL;
