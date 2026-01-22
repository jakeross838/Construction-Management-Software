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
