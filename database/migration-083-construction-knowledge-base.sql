-- Migration 083: Construction Knowledge Base (Phase 71)
-- Adds warnings, quality checks, pre-installation requirements, and tribal knowledge to catalog items

-- ============================================================
-- 1. KNOWLEDGE TYPE ENUM
-- ============================================================
DO $$ BEGIN
  CREATE TYPE knowledge_type AS ENUM (
    'warning',           -- Critical things that cause failures if ignored
    'quality_check',     -- What to verify during and after installation
    'pre_installation',  -- What must be true before starting
    'inspection_point',  -- What inspectors look for
    'common_defect',     -- Typical punch list items
    'tip'               -- Tribal knowledge, best practices
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- 2. CATALOG KNOWLEDGE TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_catalog_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Can be linked to specific item OR entire category
  catalog_item_id UUID REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,
  category_id UUID REFERENCES v2_selection_categories(id) ON DELETE CASCADE,

  -- Knowledge content
  knowledge_type knowledge_type NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT CHECK (severity IN ('critical', 'important', 'info')) DEFAULT 'important',

  -- Source tracking
  source TEXT,  -- 'manufacturer_spec', 'punch_list', 'staff_input', 'ai_extracted'
  source_document_id UUID,  -- Link to document if AI-extracted

  -- Applicability
  applies_to_rooms TEXT[],  -- NULL = all rooms, or specific rooms like ['Kitchen', 'Master Bath']

  -- Photo examples
  photo_urls TEXT[],

  -- Usage flags
  show_in_punch_list BOOLEAN DEFAULT false,
  show_in_inspection BOOLEAN DEFAULT false,
  show_in_daily_log BOOLEAN DEFAULT false,

  -- Metadata
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- At least one of catalog_item_id or category_id must be set
  CONSTRAINT knowledge_target CHECK (
    catalog_item_id IS NOT NULL OR category_id IS NOT NULL
  )
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_catalog_knowledge_item ON v2_catalog_knowledge(catalog_item_id);
CREATE INDEX IF NOT EXISTS idx_catalog_knowledge_category ON v2_catalog_knowledge(category_id);
CREATE INDEX IF NOT EXISTS idx_catalog_knowledge_type ON v2_catalog_knowledge(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_catalog_knowledge_severity ON v2_catalog_knowledge(severity) WHERE severity = 'critical';
CREATE INDEX IF NOT EXISTS idx_catalog_knowledge_punch_list ON v2_catalog_knowledge(show_in_punch_list) WHERE show_in_punch_list = true;
CREATE INDEX IF NOT EXISTS idx_catalog_knowledge_inspection ON v2_catalog_knowledge(show_in_inspection) WHERE show_in_inspection = true;

-- ============================================================
-- 4. VIEW: Get knowledge for a catalog item (includes category-level)
-- ============================================================
CREATE OR REPLACE VIEW v2_catalog_knowledge_resolved AS
SELECT
  ck.*,
  CASE
    WHEN ck.catalog_item_id IS NOT NULL THEN 'item'
    ELSE 'category'
  END as knowledge_level,
  COALESCE(sc.name, '') as item_name,
  COALESCE(cat.name, cat2.name, '') as category_name
FROM v2_catalog_knowledge ck
LEFT JOIN v2_selection_catalog sc ON ck.catalog_item_id = sc.id
LEFT JOIN v2_selection_categories cat ON sc.category_id = cat.id
LEFT JOIN v2_selection_categories cat2 ON ck.category_id = cat2.id;

-- ============================================================
-- 5. FUNCTION: Get all knowledge for a catalog item
-- (includes item-specific + category-level knowledge)
-- ============================================================
CREATE OR REPLACE FUNCTION get_catalog_knowledge(p_catalog_item_id UUID)
RETURNS TABLE (
  id UUID,
  knowledge_type knowledge_type,
  title TEXT,
  description TEXT,
  severity TEXT,
  source TEXT,
  applies_to_rooms TEXT[],
  photo_urls TEXT[],
  show_in_punch_list BOOLEAN,
  show_in_inspection BOOLEAN,
  show_in_daily_log BOOLEAN,
  knowledge_level TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  WITH item_info AS (
    SELECT category_id FROM v2_selection_catalog WHERE id = p_catalog_item_id
  )
  SELECT
    ck.id,
    ck.knowledge_type,
    ck.title,
    ck.description,
    ck.severity,
    ck.source,
    ck.applies_to_rooms,
    ck.photo_urls,
    ck.show_in_punch_list,
    ck.show_in_inspection,
    ck.show_in_daily_log,
    CASE
      WHEN ck.catalog_item_id IS NOT NULL THEN 'item'
      ELSE 'category'
    END as knowledge_level,
    ck.created_at
  FROM v2_catalog_knowledge ck, item_info
  WHERE ck.catalog_item_id = p_catalog_item_id
     OR ck.category_id = item_info.category_id
  ORDER BY
    CASE ck.severity
      WHEN 'critical' THEN 1
      WHEN 'important' THEN 2
      ELSE 3
    END,
    ck.knowledge_type,
    ck.title;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. FUNCTION: Get punch list suggestions based on selections
-- ============================================================
CREATE OR REPLACE FUNCTION get_punch_list_suggestions(p_job_id UUID, p_room TEXT DEFAULT NULL)
RETURNS TABLE (
  knowledge_id UUID,
  knowledge_type knowledge_type,
  title TEXT,
  description TEXT,
  severity TEXT,
  selection_name TEXT,
  category_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT
    ck.id as knowledge_id,
    ck.knowledge_type,
    ck.title,
    ck.description,
    ck.severity,
    sc.name as selection_name,
    cat.name as category_name
  FROM v2_selections sel
  JOIN v2_allowances a ON sel.allowance_id = a.id
  JOIN v2_selection_catalog sc ON sel.catalog_item_id = sc.id
  JOIN v2_selection_categories cat ON sc.category_id = cat.id
  LEFT JOIN v2_catalog_knowledge ck ON (
    ck.catalog_item_id = sc.id OR ck.category_id = sc.category_id
  )
  WHERE a.job_id = p_job_id
    AND ck.show_in_punch_list = true
    AND sel.deleted_at IS NULL
    AND (p_room IS NULL OR ck.applies_to_rooms IS NULL OR p_room = ANY(ck.applies_to_rooms))
  ORDER BY
    CASE ck.severity WHEN 'critical' THEN 1 WHEN 'important' THEN 2 ELSE 3 END,
    cat.name,
    ck.title;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. TRIGGER: Update timestamps
-- ============================================================
CREATE OR REPLACE FUNCTION update_knowledge_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_knowledge_timestamp ON v2_catalog_knowledge;
CREATE TRIGGER trigger_update_knowledge_timestamp
  BEFORE UPDATE ON v2_catalog_knowledge
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_timestamp();

-- ============================================================
-- 8. SEED SOME EXAMPLE KNOWLEDGE
-- ============================================================
DO $$
DECLARE
  v_flooring_cat_id UUID;
  v_plumbing_cat_id UUID;
  v_electrical_cat_id UUID;
BEGIN
  -- Get category IDs
  SELECT id INTO v_flooring_cat_id FROM v2_selection_categories WHERE name = 'Flooring' LIMIT 1;
  SELECT id INTO v_plumbing_cat_id FROM v2_selection_categories WHERE name = 'Plumbing Fixtures' LIMIT 1;
  SELECT id INTO v_electrical_cat_id FROM v2_selection_categories WHERE name = 'Electrical' OR name = 'Lighting' LIMIT 1;

  -- Flooring knowledge
  IF v_flooring_cat_id IS NOT NULL THEN
    INSERT INTO v2_catalog_knowledge (category_id, knowledge_type, title, description, severity, source, show_in_punch_list, show_in_inspection) VALUES
      (v_flooring_cat_id, 'warning', 'Subfloor must be level', 'Verify subfloor is level within 3/16" per 10 feet before installation. Unlevel subfloors cause gaps, squeaks, and premature wear.', 'critical', 'manufacturer_spec', false, true),
      (v_flooring_cat_id, 'pre_installation', 'Acclimate material 48-72 hours', 'Flooring materials must acclimate in the installation space for minimum 48 hours before installation.', 'critical', 'manufacturer_spec', false, true),
      (v_flooring_cat_id, 'quality_check', 'Check moisture levels', 'Concrete slab moisture must be below 3%. Use calcium chloride test or relative humidity test.', 'important', 'manufacturer_spec', false, true),
      (v_flooring_cat_id, 'common_defect', 'Gapping at transitions', 'Check for gaps at doorway transitions. Expansion gaps should be covered by transition strips.', 'important', 'punch_list', true, false),
      (v_flooring_cat_id, 'common_defect', 'Visible seams', 'Check that seams are tight and aligned. Visible seams indicate poor installation technique.', 'important', 'punch_list', true, false),
      (v_flooring_cat_id, 'tip', 'Transition strip placement', 'Install transition strips at all doorways and material changes. Use T-molding for same-height transitions.', 'info', 'staff_input', false, false)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Plumbing knowledge
  IF v_plumbing_cat_id IS NOT NULL THEN
    INSERT INTO v2_catalog_knowledge (category_id, knowledge_type, title, description, severity, source, show_in_punch_list, show_in_inspection) VALUES
      (v_plumbing_cat_id, 'warning', 'Water supply shutoff required', 'Ensure water supply is shut off at the main before any fixture installation.', 'critical', 'staff_input', false, false),
      (v_plumbing_cat_id, 'pre_installation', 'Verify rough-in dimensions', 'Confirm rough-in matches fixture specs before ordering. Toilet rough-in is typically 12" but verify.', 'critical', 'manufacturer_spec', false, true),
      (v_plumbing_cat_id, 'quality_check', 'Test for leaks', 'Run water for 5 minutes and check all connections for leaks. Check under sink and behind fixtures.', 'critical', 'manufacturer_spec', true, true),
      (v_plumbing_cat_id, 'common_defect', 'Caulk gaps', 'Check for missing or incomplete caulk around fixtures, especially at wall/floor junctions.', 'important', 'punch_list', true, false),
      (v_plumbing_cat_id, 'inspection_point', 'Supply line connections', 'Inspector will verify proper connection types and check for kinks in supply lines.', 'important', 'staff_input', false, true)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Electrical knowledge
  IF v_electrical_cat_id IS NOT NULL THEN
    INSERT INTO v2_catalog_knowledge (category_id, knowledge_type, title, description, severity, source, show_in_punch_list, show_in_inspection) VALUES
      (v_electrical_cat_id, 'warning', 'Circuit must be de-energized', 'Always verify circuit is off at the breaker before any electrical work. Use non-contact voltage tester.', 'critical', 'staff_input', false, false),
      (v_electrical_cat_id, 'pre_installation', 'Check box capacity', 'Verify junction box has adequate capacity for fixture weight. Heavy fixtures may need fan-rated box.', 'important', 'manufacturer_spec', false, true),
      (v_electrical_cat_id, 'quality_check', 'Verify polarity', 'Test outlets for correct wiring: hot on right, neutral on left, ground connected.', 'critical', 'staff_input', false, true),
      (v_electrical_cat_id, 'common_defect', 'Loose cover plates', 'Check that all cover plates are secure and properly aligned.', 'info', 'punch_list', true, false),
      (v_electrical_cat_id, 'inspection_point', 'Wire gauge and breaker match', 'Inspector verifies wire gauge matches circuit breaker amperage.', 'critical', 'staff_input', false, true)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 9. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_catalog_knowledge IS 'Installation warnings, quality checks, and tribal knowledge attached to catalog items or categories';
COMMENT ON COLUMN v2_catalog_knowledge.knowledge_type IS 'Type: warning, quality_check, pre_installation, inspection_point, common_defect, tip';
COMMENT ON COLUMN v2_catalog_knowledge.severity IS 'Importance: critical (must address), important (should address), info (nice to know)';
COMMENT ON COLUMN v2_catalog_knowledge.source IS 'Where knowledge came from: manufacturer_spec, punch_list, staff_input, ai_extracted';
COMMENT ON FUNCTION get_catalog_knowledge(UUID) IS 'Returns all knowledge for a catalog item, including category-level knowledge';
COMMENT ON FUNCTION get_punch_list_suggestions(UUID, TEXT) IS 'Returns knowledge items marked for punch list based on job selections';
