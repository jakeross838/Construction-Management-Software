-- Migration 028: AI Feedback System
-- Creates feedback table for learning from user corrections
-- Adds vendor alternate names for better matching

-- AI Feedback table - stores all user corrections
CREATE TABLE IF NOT EXISTS v2_ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES v2_invoices(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,           -- 'vendor', 'job', 'amount', 'invoice_number', etc.
  ai_value TEXT,                      -- What AI extracted
  user_value TEXT,                    -- What user corrected to
  entity_id UUID,                     -- ID of matched entity (vendor_id, job_id, etc.)
  corrected_by TEXT,                  -- User who made correction
  applied_to_learning BOOLEAN DEFAULT FALSE,  -- Whether this fed back to v2_ai_learning
  context JSONB,                      -- Additional context (vendor name, confidence, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendor alternate names - tracks variations that map to same vendor
CREATE TABLE IF NOT EXISTS v2_vendor_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES v2_vendors(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,                -- Alternate name (e.g., "TNT Paint")
  alias_normalized TEXT NOT NULL,     -- Lowercase, no special chars
  source TEXT DEFAULT 'correction',   -- 'correction', 'manual', 'ai_extracted'
  times_matched INTEGER DEFAULT 1,    -- How often this alias appeared
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(alias_normalized)
);

-- Potential vendor duplicates - flagged for review
CREATE TABLE IF NOT EXISTS v2_vendor_duplicates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id_1 UUID NOT NULL REFERENCES v2_vendors(id) ON DELETE CASCADE,
  vendor_id_2 UUID NOT NULL REFERENCES v2_vendors(id) ON DELETE CASCADE,
  similarity_score DECIMAL(5,2) NOT NULL,  -- 0-100
  status TEXT DEFAULT 'pending',      -- 'pending', 'merged', 'dismissed'
  merged_into UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(vendor_id_1, vendor_id_2)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_feedback_invoice ON v2_ai_feedback(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_field ON v2_ai_feedback(field_name);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON v2_ai_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_aliases_vendor ON v2_vendor_aliases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendor_aliases_normalized ON v2_vendor_aliases(alias_normalized);
CREATE INDEX IF NOT EXISTS idx_vendor_duplicates_status ON v2_vendor_duplicates(status);

-- Add fields to vendors for better tracking
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS last_invoice_date DATE;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS invoice_count INTEGER DEFAULT 0;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS correction_count INTEGER DEFAULT 0;
