-- Migration 052: Price Intelligence Auto-Creation & Naming Conventions
-- Enables AI to auto-create master items with configurable naming rules

-- ============================================================
-- NAMING CONVENTIONS TABLE
-- Stores rules for how materials should be named by category
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_naming_conventions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,  -- NULL means applies to all subcategories

  -- Naming pattern with placeholders: {width}, {height}, {length}, {thickness}, {species}, {grade}, {brand}
  name_pattern TEXT NOT NULL,

  -- Example: "2x4x8 SPF Stud" for pattern "{width}x{height}x{length} {species} Stud"
  example TEXT,

  -- Keywords that trigger this convention
  trigger_keywords TEXT[] DEFAULT '{}',

  -- Standard unit for this category
  default_unit TEXT DEFAULT 'ea',

  -- Priority (higher = checked first)
  priority INTEGER DEFAULT 0,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(category, subcategory)
);

-- ============================================================
-- ADD REVIEW STATUS TO MASTER ITEMS
-- Tracks whether item was auto-created and needs review
-- ============================================================

ALTER TABLE v2_master_items
ADD COLUMN IF NOT EXISTS created_by_ai BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'approved' CHECK (review_status IN ('pending', 'approved', 'rejected')),
ADD COLUMN IF NOT EXISTS original_description TEXT,  -- The vendor description that triggered creation
ADD COLUMN IF NOT EXISTS source_invoice_id UUID REFERENCES v2_invoices(id),
ADD COLUMN IF NOT EXISTS source_vendor_id UUID REFERENCES v2_vendors(id);

-- Index for finding items needing review
CREATE INDEX IF NOT EXISTS idx_master_items_review ON v2_master_items(review_status) WHERE review_status = 'pending';

-- ============================================================
-- SEED DEFAULT NAMING CONVENTIONS
-- ============================================================

INSERT INTO v2_naming_conventions (category, subcategory, name_pattern, example, trigger_keywords, default_unit, priority) VALUES
-- Lumber
('Lumber', 'Studs', '{width}x{height}x{length} {species} Stud', '2x4x8 SPF Stud', ARRAY['stud', 'studs'], 'ea', 100),
('Lumber', 'Dimensional', '{width}x{height}x{length} {species}', '2x6x16 SPF', ARRAY['dimensional', 'lumber', 'board'], 'ea', 90),
('Lumber', 'Treated', '{width}x{height}x{length} PT {grade}', '2x6x8 PT Ground Contact', ARRAY['pressure treated', 'pt', 'treated', 'ground contact'], 'ea', 95),
('Lumber', 'LVL', '{thickness}x{height} LVL', '1-3/4x11-7/8 LVL', ARRAY['lvl', 'laminated veneer'], 'lf', 85),
('Lumber', NULL, '{width}x{height}x{length} {species}', '2x4x8 SPF', ARRAY['lumber'], 'ea', 50),

-- Plywood & Sheathing
('Plywood', 'Sheathing', '{thickness} OSB Sheathing {width}x{height}', '7/16 OSB Sheathing 4x8', ARRAY['osb', 'sheathing'], 'sheet', 100),
('Plywood', 'Subfloor', '{thickness} T&G OSB Subfloor', '23/32 T&G OSB Subfloor', ARRAY['subfloor', 'tongue and groove', 't&g', 'advantech'], 'sheet', 95),
('Plywood', 'CDX', '{thickness} CDX Plywood {width}x{height}', '1/2 CDX Plywood 4x8', ARRAY['cdx', 'plywood'], 'sheet', 90),
('Plywood', NULL, '{thickness} {grade} {width}x{height}', '3/4 BC Plywood 4x8', ARRAY['plywood', 'ply'], 'sheet', 50),

-- Drywall
('Drywall', 'Regular', '{thickness} Drywall {width}x{height}', '1/2 Drywall 4x8', ARRAY['drywall', 'sheetrock', 'gypsum'], 'sheet', 100),
('Drywall', 'Moisture Resistant', '{thickness} Green Board {width}x{height}', '1/2 Green Board 4x8', ARRAY['greenboard', 'green board', 'moisture resistant', 'mr'], 'sheet', 95),
('Drywall', 'Fire Rated', '{thickness} Type X Drywall {width}x{height}', '5/8 Type X Drywall 4x8', ARRAY['type x', 'fire rated', 'fire code'], 'sheet', 95),

-- Insulation
('Insulation', 'Batt', 'R-{rvalue} {facing} Batt {width}"', 'R-13 Unfaced Batt 15"', ARRAY['batt', 'fiberglass', 'r-13', 'r-19', 'r-30'], 'bag', 100),
('Insulation', 'Rigid', '{thickness} {type} Rigid Foam {width}x{height}', '1" XPS Rigid Foam 4x8', ARRAY['rigid', 'foam', 'xps', 'eps', 'polyiso'], 'sheet', 90),

-- Roofing
('Roofing', 'Shingles', '{style} Shingle Bundle', 'Architectural Shingle Bundle', ARRAY['shingle', 'shingles', 'architectural', '3-tab'], 'bundle', 100),
('Roofing', 'Underlayment', '{weight} Felt Underlayment', '15# Felt Underlayment', ARRAY['felt', 'underlayment', 'tar paper'], 'roll', 90),

-- Concrete
('Concrete', 'Ready Mix', 'Concrete {weight} Bag', 'Concrete 80# Bag', ARRAY['concrete', 'quikrete', 'sakrete', 'ready mix'], 'bag', 100),
('Concrete', 'Rebar', '#{size} Rebar {length}ft', '#4 Rebar 20ft', ARRAY['rebar', 'reinforcing bar'], 'ea', 90),

-- Hardware
('Hardware', 'Fasteners', '{size} {type} {quantity} Box', '3" Deck Screws 5# Box', ARRAY['screw', 'screws', 'nail', 'nails', 'fastener'], 'box', 100),
('Hardware', 'Hangers', '{model} {type}', 'LUS26 Joist Hanger', ARRAY['hanger', 'simpson', 'connector', 'bracket'], 'ea', 90),

-- Siding
('Siding', 'Hardie', 'HardiePlank {style} {dimensions}', 'HardiePlank Lap Siding 8.25x144', ARRAY['hardie', 'hardiplank', 'fiber cement'], 'pc', 100),
('Siding', 'Vinyl', '{profile} Vinyl Siding {color}', 'D4 Vinyl Siding White', ARRAY['vinyl', 'siding'], 'sq', 90)

ON CONFLICT (category, subcategory) DO UPDATE SET
  name_pattern = EXCLUDED.name_pattern,
  example = EXCLUDED.example,
  trigger_keywords = EXCLUDED.trigger_keywords,
  default_unit = EXCLUDED.default_unit,
  priority = EXCLUDED.priority,
  updated_at = NOW();

-- ============================================================
-- FUNCTION TO APPLY NAMING CONVENTION
-- ============================================================

CREATE OR REPLACE FUNCTION apply_naming_convention(
  p_description TEXT,
  p_category TEXT DEFAULT NULL
) RETURNS TABLE (
  standard_name TEXT,
  category TEXT,
  subcategory TEXT,
  unit TEXT,
  confidence NUMERIC
) AS $$
DECLARE
  v_convention RECORD;
  v_desc_lower TEXT;
  v_result_name TEXT;
  v_matched BOOLEAN;
BEGIN
  v_desc_lower := LOWER(p_description);

  -- Find best matching convention
  FOR v_convention IN
    SELECT * FROM v2_naming_conventions
    WHERE is_active = true
    AND (p_category IS NULL OR v2_naming_conventions.category = p_category)
    ORDER BY priority DESC
  LOOP
    -- Check if any trigger keywords match
    v_matched := FALSE;
    FOR i IN 1..array_length(v_convention.trigger_keywords, 1) LOOP
      IF v_desc_lower LIKE '%' || v_convention.trigger_keywords[i] || '%' THEN
        v_matched := TRUE;
        EXIT;
      END IF;
    END LOOP;

    IF v_matched THEN
      -- Return this convention's info (actual name parsing done in application code)
      RETURN QUERY SELECT
        v_convention.name_pattern,
        v_convention.category,
        v_convention.subcategory,
        v_convention.default_unit,
        0.8::NUMERIC;
      RETURN;
    END IF;
  END LOOP;

  -- No match - return generic
  RETURN QUERY SELECT
    p_description,
    COALESCE(p_category, 'General')::TEXT,
    NULL::TEXT,
    'ea'::TEXT,
    0.3::NUMERIC;
END;
$$ LANGUAGE plpgsql;
