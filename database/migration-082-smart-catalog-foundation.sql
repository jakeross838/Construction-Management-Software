-- Migration 082: Smart Catalog Foundation (Phase 70)
-- Adds estimation and scheduling fields to catalog items
-- Enables labor hours, durations, dependencies, permits, and warranty tracking

-- ============================================================
-- 1. QUALITY TIER ENUM
-- ============================================================
DO $$ BEGIN
  CREATE TYPE quality_tier AS ENUM ('builder', 'standard', 'premium');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. ESTIMATION FIELDS ON CATALOG
-- ============================================================
-- Labor and installation timing
ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS labor_hours DECIMAL(6,2);

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS install_duration_hours DECIMAL(6,2);

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS crew_size INTEGER DEFAULT 1;

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS lead_time_days INTEGER DEFAULT 0;

-- Quality tier
ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS quality_tier quality_tier DEFAULT 'standard';

-- ============================================================
-- 3. MATERIAL COVERAGE FIELDS
-- ============================================================
ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS waste_factor_percent DECIMAL(5,2) DEFAULT 0;

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS coverage_rate DECIMAL(10,2);

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS coverage_unit TEXT;
-- Examples: 'sqft', 'lnft', 'sqm', 'each'

-- ============================================================
-- 4. PERMIT REQUIREMENT FIELDS
-- ============================================================
ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS requires_permit BOOLEAN DEFAULT false;

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS permit_type TEXT;
-- Examples: 'electrical', 'plumbing', 'mechanical', 'building'

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS rough_in_required BOOLEAN DEFAULT false;

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS rough_in_notes TEXT;

-- ============================================================
-- 5. WARRANTY FIELDS
-- ============================================================
ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS warranty_months INTEGER;

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS warranty_notes TEXT;

-- ============================================================
-- 6. CATALOG TRADES JUNCTION TABLE
-- Links catalog items to trades (v2_labor_categories)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_catalog_trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES v2_labor_categories(id) ON DELETE CASCADE,

  -- Installation specifics for this trade on this item
  is_primary BOOLEAN DEFAULT false,
  labor_hours_override DECIMAL(6,2),
  hourly_rate_override DECIMAL(10,2),
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(catalog_item_id, trade_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_trades_item ON v2_catalog_trades(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_trades_trade ON v2_catalog_trades(trade_id);

-- ============================================================
-- 7. CATALOG DEPENDENCIES TABLE
-- Defines before/after/incompatible relationships
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_catalog_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,

  -- Target can be specific item OR entire category
  depends_on_item_id UUID REFERENCES v2_selection_catalog(id) ON DELETE SET NULL,
  depends_on_category_id UUID REFERENCES v2_selection_categories(id) ON DELETE SET NULL,

  -- Dependency type
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('must_precede', 'must_follow', 'incompatible')),
  -- must_precede: this item must be installed BEFORE depends_on item
  -- must_follow: this item must be installed AFTER depends_on item
  -- incompatible: these items cannot both be selected

  -- Timing constraints
  gap_days INTEGER DEFAULT 0,  -- Required days between installations (for curing, etc.)
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- At least one of depends_on_item_id or depends_on_category_id must be set
  CONSTRAINT dependency_target CHECK (
    depends_on_item_id IS NOT NULL OR depends_on_category_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_catalog_deps_item ON v2_catalog_dependencies(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_deps_depends ON v2_catalog_dependencies(depends_on_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_deps_category ON v2_catalog_dependencies(depends_on_category_id);

-- ============================================================
-- 8. PERFORMANCE INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_catalog_quality_tier ON v2_selection_catalog(quality_tier);
CREATE INDEX IF NOT EXISTS idx_catalog_requires_permit ON v2_selection_catalog(requires_permit) WHERE requires_permit = true;
CREATE INDEX IF NOT EXISTS idx_catalog_lead_time ON v2_selection_catalog(lead_time_days) WHERE lead_time_days > 0;

-- ============================================================
-- 9. COMMENTS
-- ============================================================
COMMENT ON COLUMN v2_selection_catalog.labor_hours IS 'Estimated labor hours to install this item';
COMMENT ON COLUMN v2_selection_catalog.install_duration_hours IS 'Total duration including setup/cleanup (may differ from labor_hours)';
COMMENT ON COLUMN v2_selection_catalog.crew_size IS 'Typical crew size for installation';
COMMENT ON COLUMN v2_selection_catalog.lead_time_days IS 'Days from order to delivery';
COMMENT ON COLUMN v2_selection_catalog.quality_tier IS 'Price/quality tier: builder, standard, or premium';
COMMENT ON COLUMN v2_selection_catalog.waste_factor_percent IS 'Material waste factor (e.g., 10 = 10% extra needed)';
COMMENT ON COLUMN v2_selection_catalog.coverage_rate IS 'How much area one unit covers';
COMMENT ON COLUMN v2_selection_catalog.coverage_unit IS 'Unit for coverage rate: sqft, lnft, etc.';
COMMENT ON COLUMN v2_selection_catalog.requires_permit IS 'Whether installation requires a permit';
COMMENT ON COLUMN v2_selection_catalog.permit_type IS 'Type of permit: electrical, plumbing, mechanical, building';
COMMENT ON COLUMN v2_selection_catalog.rough_in_required IS 'Whether rough-in work is needed before final installation';
COMMENT ON COLUMN v2_selection_catalog.rough_in_notes IS 'Notes about rough-in requirements';
COMMENT ON COLUMN v2_selection_catalog.warranty_months IS 'Manufacturer warranty duration in months';
COMMENT ON COLUMN v2_selection_catalog.warranty_notes IS 'Warranty terms and conditions';

COMMENT ON TABLE v2_catalog_trades IS 'Links catalog items to trades/labor categories with optional rate overrides';
COMMENT ON TABLE v2_catalog_dependencies IS 'Defines scheduling dependencies between catalog items or categories';
