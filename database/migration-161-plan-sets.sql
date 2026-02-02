-- Migration 161: Plan Set Management
-- Date: 2026-02-01
-- Purpose: Drawing version control, sheet list with thumbnails, revision marks, distribution tracking

-- ============================================================
-- PLAN SETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_plan_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  issue_date DATE,
  status TEXT NOT NULL DEFAULT 'current' CHECK (status IN ('current', 'superseded', 'archived')),

  -- Version chain tracking (FK added after table creation)
  parent_plan_set_id UUID,

  -- Metadata
  total_sheets INTEGER DEFAULT 0,
  notes TEXT,

  -- Audit
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAN SHEETS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_plan_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_set_id UUID NOT NULL REFERENCES v2_plan_sets(id) ON DELETE CASCADE,

  -- Sheet identification
  sheet_number TEXT NOT NULL,
  sheet_name TEXT NOT NULL,
  discipline TEXT CHECK (discipline IN ('architectural', 'structural', 'mechanical', 'electrical', 'plumbing', 'civil', 'landscape', 'interior', 'general', 'other')),

  -- Files
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,

  -- Revision tracking
  revision TEXT DEFAULT 'A',
  revision_date DATE,
  revision_notes TEXT,

  -- Sheet metadata
  page_size TEXT,  -- e.g., '24x36', 'ARCH D', 'ANSI B'
  scale TEXT,      -- e.g., '1/4" = 1\'-0"'

  -- Ordering
  sort_order INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAN DISTRIBUTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_plan_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_set_id UUID NOT NULL REFERENCES v2_plan_sets(id) ON DELETE CASCADE,

  -- Recipient info
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('vendor', 'client', 'internal', 'consultant', 'building_dept', 'other')),
  recipient_id UUID,  -- References v2_vendors or v2_contacts depending on type
  recipient_email TEXT,
  recipient_name TEXT,
  recipient_company TEXT,

  -- Distribution tracking
  sent_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  download_count INTEGER DEFAULT 0,

  -- Distribution details
  sent_by TEXT,
  delivery_method TEXT DEFAULT 'email' CHECK (delivery_method IN ('email', 'print', 'portal', 'link', 'hand_delivery')),
  notes TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAN MARKUPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_plan_markups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id UUID NOT NULL REFERENCES v2_plan_sheets(id) ON DELETE CASCADE,

  -- Markup type
  markup_type TEXT NOT NULL CHECK (markup_type IN ('revision_cloud', 'comment', 'dimension', 'arrow', 'text', 'rectangle', 'circle', 'line', 'highlight', 'callout')),

  -- Markup data (stored as JSON for flexibility)
  markup_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  -- Expected structure:
  -- {
  --   "coordinates": {"x": 100, "y": 200, "width": 50, "height": 30},
  --   "points": [{"x": 0, "y": 0}, {"x": 100, "y": 100}],  -- For lines, clouds
  --   "text": "Revision note text",
  --   "style": {"color": "#ff0000", "stroke_width": 2, "fill": "transparent"},
  --   "revision": "A",
  --   "delta_number": "1"
  -- }

  -- Link to revision if applicable
  revision TEXT,

  -- Status
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,

  -- Audit
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PLAN SET ACTIVITY TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_plan_set_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_set_id UUID NOT NULL REFERENCES v2_plan_sets(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- created, updated, sheet_added, sheet_removed, distributed, version_created, archived
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add parent_plan_set_id column if it doesn't exist and then add FK
ALTER TABLE v2_plan_sets ADD COLUMN IF NOT EXISTS parent_plan_set_id UUID;

-- Add self-referencing FK (may already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_plan_sets_parent' AND table_name = 'v2_plan_sets'
  ) THEN
    ALTER TABLE v2_plan_sets ADD CONSTRAINT fk_plan_sets_parent
      FOREIGN KEY (parent_plan_set_id) REFERENCES v2_plan_sets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_plan_sets_job_id ON v2_plan_sets(job_id);
CREATE INDEX IF NOT EXISTS idx_plan_sets_status ON v2_plan_sets(status);
CREATE INDEX IF NOT EXISTS idx_plan_sets_parent ON v2_plan_sets(parent_plan_set_id);
CREATE INDEX IF NOT EXISTS idx_plan_sheets_plan_set ON v2_plan_sheets(plan_set_id);
CREATE INDEX IF NOT EXISTS idx_plan_sheets_discipline ON v2_plan_sheets(discipline);
CREATE INDEX IF NOT EXISTS idx_plan_distributions_plan_set ON v2_plan_distributions(plan_set_id);
CREATE INDEX IF NOT EXISTS idx_plan_distributions_recipient ON v2_plan_distributions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_plan_markups_sheet ON v2_plan_markups(sheet_id);
CREATE INDEX IF NOT EXISTS idx_plan_markups_type ON v2_plan_markups(markup_type);
CREATE INDEX IF NOT EXISTS idx_plan_set_activity_plan_set ON v2_plan_set_activity(plan_set_id);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE v2_plan_sets IS 'Construction plan/drawing sets with version control';
COMMENT ON TABLE v2_plan_sheets IS 'Individual sheets/pages within a plan set';
COMMENT ON TABLE v2_plan_distributions IS 'Tracking of plan set distribution to stakeholders';
COMMENT ON TABLE v2_plan_markups IS 'Annotations and revision clouds on plan sheets';
COMMENT ON COLUMN v2_plan_sets.status IS 'current = active version, superseded = replaced by newer version, archived = no longer in use';
COMMENT ON COLUMN v2_plan_sheets.discipline IS 'Drawing discipline: architectural, structural, MEP, civil, etc.';
COMMENT ON COLUMN v2_plan_markups.markup_data IS 'JSON containing coordinates, text, style, and other markup properties';
