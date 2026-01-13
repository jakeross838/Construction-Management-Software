-- Migration 018: AI Learning System
-- Stores corrections to improve future invoice matching accuracy

-- Learning table for vendor and job matching corrections
CREATE TABLE IF NOT EXISTS v2_ai_learning (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('job', 'vendor')),
  extracted_value TEXT NOT NULL,           -- What AI extracted (normalized lowercase)
  extracted_raw TEXT,                       -- Original extracted text before normalization
  matched_id UUID NOT NULL,                 -- The ID it was matched to (job_id or vendor_id)
  matched_name TEXT NOT NULL,               -- Name for quick reference
  source_field TEXT,                        -- Which field the value came from (e.g., 'job.reference', 'vendor.companyName')
  confidence DECIMAL(3,2) DEFAULT 0.90,     -- Starting confidence for this learned mapping
  times_used INTEGER DEFAULT 1,             -- How many times this mapping has been confirmed
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one mapping per extracted value + entity type
  UNIQUE(entity_type, extracted_value)
);

-- Index for fast lookups during invoice processing
CREATE INDEX IF NOT EXISTS idx_ai_learning_lookup
  ON v2_ai_learning(entity_type, extracted_value);

-- Index for finding all learnings for a specific entity
CREATE INDEX IF NOT EXISTS idx_ai_learning_entity
  ON v2_ai_learning(entity_type, matched_id);

-- Comments
COMMENT ON TABLE v2_ai_learning IS 'Stores AI learning from manual corrections to improve future matching';
COMMENT ON COLUMN v2_ai_learning.extracted_value IS 'Normalized (lowercase, stripped) value that AI extracted';
COMMENT ON COLUMN v2_ai_learning.extracted_raw IS 'Original value before normalization for reference';
COMMENT ON COLUMN v2_ai_learning.times_used IS 'Incremented each time this mapping is confirmed, boosts confidence';
