-- Migration 117: Estimating Data Model & Architecture (Phase 106)
-- Adds sections, assembly templates, allowance tracking, separate markups, and version history

-- ============================================================
-- 1. ESTIMATE SECTIONS (organizational grouping)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_estimate_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Site Work", "Framing", "Finishes", etc.
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  subtotal DECIMAL(14,2) DEFAULT 0,  -- Cached sum of items in section
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimate_sections_estimate ON v2_estimate_sections(estimate_id);

COMMENT ON TABLE v2_estimate_sections IS 'Organizational groupings within estimates (Site Work, Framing, Finishes, etc.)';
