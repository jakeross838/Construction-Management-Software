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

-- ============================================================
-- 2. ASSEMBLY TEMPLATES (reusable templates)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_assembly_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- "Bathrooms", "Kitchens", "Framing", etc.
  is_active BOOLEAN DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assembly_templates_category ON v2_assembly_templates(category) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_assembly_templates_active ON v2_assembly_templates(is_active);

CREATE TABLE IF NOT EXISTS v2_assembly_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES v2_assembly_templates(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT,  -- ea, sf, lf, hr, etc.
  unit_cost DECIMAL(12,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assembly_template_items_template ON v2_assembly_template_items(template_id);

COMMENT ON TABLE v2_assembly_templates IS 'Reusable assembly templates (Standard Bathroom, Kitchen Package, etc.)';
COMMENT ON TABLE v2_assembly_template_items IS 'Line items within an assembly template';

-- ============================================================
-- 3. EXTEND v2_estimate_lines
-- ============================================================
-- Add section reference
ALTER TABLE v2_estimate_lines
  ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES v2_estimate_sections(id) ON DELETE SET NULL;

-- Add allowance tracking (EST-04)
ALTER TABLE v2_estimate_lines
  ADD COLUMN IF NOT EXISTS is_allowance BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowance_notes TEXT;

-- Add template tracking (for tracing source of assembly-derived items)
ALTER TABLE v2_estimate_lines
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES v2_assembly_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimate_lines_section ON v2_estimate_lines(section_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_template ON v2_estimate_lines(template_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_allowance ON v2_estimate_lines(estimate_id) WHERE is_allowance = true;

COMMENT ON COLUMN v2_estimate_lines.section_id IS 'Section this line item belongs to (for organizational grouping)';
COMMENT ON COLUMN v2_estimate_lines.is_allowance IS 'True if this is a placeholder amount for client selection';
COMMENT ON COLUMN v2_estimate_lines.allowance_notes IS 'Notes about the allowance (e.g., "Client to select flooring")';
COMMENT ON COLUMN v2_estimate_lines.template_id IS 'Source assembly template if this line was created from a template';

-- ============================================================
-- 4. SEPARATE MARKUP TRACKING (EST-05)
-- ============================================================
-- Add separate overhead and profit columns
ALTER TABLE v2_estimates
  ADD COLUMN IF NOT EXISTS overhead_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_amount DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_percent DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profit_amount DECIMAL(14,2) DEFAULT 0;

COMMENT ON COLUMN v2_estimates.overhead_percent IS 'Overhead markup percentage (company overhead allocation)';
COMMENT ON COLUMN v2_estimates.overhead_amount IS 'Calculated: subtotal * overhead_percent / 100';
COMMENT ON COLUMN v2_estimates.profit_percent IS 'Profit margin percentage';
COMMENT ON COLUMN v2_estimates.profit_amount IS 'Calculated: (subtotal + overhead_amount) * profit_percent / 100';
-- Note: contingency_percent and contingency_amount already exist
-- Calculation order: subtotal -> +overhead -> +profit -> +contingency = grand_total

-- ============================================================
-- 5. STATUS WORKFLOW UPDATE (EST-06)
-- ============================================================
-- The existing constraint allows: draft, submitted, approved, rejected, converted
-- We need to add 'sent' for client delivery workflow
-- First drop the existing constraint, then recreate with new values

-- Note: PostgreSQL requires dropping and recreating CHECK constraints
-- The existing constraint name may vary, so we use a safe approach
DO $$
BEGIN
  -- Try to drop existing constraint (may not exist or have different name)
  ALTER TABLE v2_estimates DROP CONSTRAINT IF EXISTS v2_estimates_status_check;
EXCEPTION WHEN OTHERS THEN
  -- Constraint may have auto-generated name, continue
  NULL;
END $$;

-- Add new constraint with all statuses including 'sent'
ALTER TABLE v2_estimates
  ADD CONSTRAINT v2_estimates_status_check
  CHECK (status IN ('draft', 'sent', 'submitted', 'approved', 'rejected', 'converted'));

COMMENT ON COLUMN v2_estimates.status IS 'Workflow: draft -> sent -> approved -> converted (or rejected back to draft)';

-- ============================================================
-- 6. ESTIMATE VERSION HISTORY (EST-06)
-- ============================================================
-- Stores snapshots of estimates for version tracking
-- Each snapshot captures the full state at a point in time

-- Add version column to estimates if not exists
ALTER TABLE v2_estimates
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

CREATE TABLE IF NOT EXISTS v2_estimate_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,

  -- Snapshot of estimate state at this version
  snapshot_data JSONB NOT NULL,  -- Full estimate + lines + sections as JSON

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  change_summary TEXT,  -- "Initial version", "Updated pricing", "Client revision 2", etc.

  -- Computed totals at snapshot time (for quick comparison without parsing JSON)
  subtotal DECIMAL(14,2),
  total_amount DECIMAL(14,2),
  line_count INTEGER,

  UNIQUE(estimate_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_estimate_versions_estimate ON v2_estimate_versions(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_versions_created ON v2_estimate_versions(created_at DESC);

COMMENT ON TABLE v2_estimate_versions IS 'Version history snapshots for estimates - allows retrieving/comparing previous versions';
COMMENT ON COLUMN v2_estimate_versions.snapshot_data IS 'JSONB snapshot containing estimate header, all sections, and all line items at this version';
COMMENT ON COLUMN v2_estimate_versions.change_summary IS 'Human-readable description of what changed in this version';

-- ============================================================
-- 7. ADDITIONAL INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_estimates_overhead ON v2_estimates(overhead_percent) WHERE overhead_percent > 0;
CREATE INDEX IF NOT EXISTS idx_estimates_profit ON v2_estimates(profit_percent) WHERE profit_percent > 0;
CREATE INDEX IF NOT EXISTS idx_estimates_version ON v2_estimates(version);
