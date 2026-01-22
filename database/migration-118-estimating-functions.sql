-- Migration 118: Estimating Functions & Triggers (Phase 106)
-- Functions for estimate calculations with separate overhead/profit/contingency

-- ============================================================
-- 1. ESTIMATE TOTALS CALCULATION (with separate markups)
-- ============================================================
-- Calculation order:
--   subtotal = sum(line_items where parent_line_id IS NULL)
--   overhead_amount = subtotal * (overhead_percent / 100)
--   profit_amount = (subtotal + overhead_amount) * (profit_percent / 100)
--   contingency_amount = subtotal * (contingency_percent / 100)
--   grand_total = subtotal + overhead_amount + profit_amount + contingency_amount
--
-- Note: Legacy markup_percent/markup_amount preserved for backward compatibility
--       If overhead/profit are both 0 but markup_percent > 0, use legacy calculation

CREATE OR REPLACE FUNCTION recalculate_estimate_totals_v3(p_estimate_id UUID)
RETURNS void AS $$
DECLARE
  v_subtotal DECIMAL(14,2);
  v_material DECIMAL(14,2);
  v_labor DECIMAL(14,2);
  v_overhead_pct DECIMAL(5,2);
  v_profit_pct DECIMAL(5,2);
  v_contingency_pct DECIMAL(5,2);
  v_markup_pct DECIMAL(5,2);  -- Legacy
  v_overhead_amt DECIMAL(14,2);
  v_profit_amt DECIMAL(14,2);
  v_contingency_amt DECIMAL(14,2);
  v_markup_amt DECIMAL(14,2);  -- Legacy
  v_grand_total DECIMAL(14,2);
BEGIN
  -- Sum all line items (excluding assembly children to avoid double-counting)
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(material_with_waste), 0),
    COALESCE(SUM(labor_cost), 0)
  INTO v_subtotal, v_material, v_labor
  FROM v2_estimate_lines
  WHERE estimate_id = p_estimate_id
    AND parent_line_id IS NULL;  -- Only top-level items

  -- If no material/labor breakdown, use amount total
  IF v_material = 0 AND v_labor = 0 THEN
    v_material := v_subtotal;
    v_labor := 0;
  END IF;

  -- Get markup percentages
  SELECT
    COALESCE(overhead_percent, 0),
    COALESCE(profit_percent, 0),
    COALESCE(contingency_percent, 0),
    COALESCE(markup_percent, 0)
  INTO v_overhead_pct, v_profit_pct, v_contingency_pct, v_markup_pct
  FROM v2_estimates
  WHERE id = p_estimate_id;

  -- Calculate new-style markups (overhead, profit, contingency)
  IF v_overhead_pct > 0 OR v_profit_pct > 0 THEN
    -- Use new calculation: overhead on subtotal, profit on (subtotal + overhead)
    v_overhead_amt := v_subtotal * v_overhead_pct / 100;
    v_profit_amt := (v_subtotal + v_overhead_amt) * v_profit_pct / 100;
    v_contingency_amt := v_subtotal * v_contingency_pct / 100;
    v_markup_amt := 0;  -- Not using legacy markup
  ELSE
    -- Legacy calculation: combined markup
    v_overhead_amt := 0;
    v_profit_amt := 0;
    v_markup_amt := v_subtotal * v_markup_pct / 100;
    v_contingency_amt := v_subtotal * v_contingency_pct / 100;
  END IF;

  v_grand_total := v_subtotal + v_overhead_amt + v_profit_amt + v_contingency_amt + v_markup_amt;

  -- Update estimate
  UPDATE v2_estimates
  SET
    subtotal = v_subtotal,
    material_total = v_material,
    labor_total = v_labor,
    overhead_amount = v_overhead_amt,
    profit_amount = v_profit_amt,
    contingency_amount = v_contingency_amt,
    markup_amount = v_markup_amt,
    total_amount = v_grand_total,
    updated_at = NOW()
  WHERE id = p_estimate_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_estimate_totals_v3(UUID) IS 'Recalculates estimate with separate overhead, profit, and contingency markups';

-- ============================================================
-- 2. SECTION SUBTOTAL CALCULATION
-- ============================================================
CREATE OR REPLACE FUNCTION update_section_subtotal(p_section_id UUID)
RETURNS void AS $$
BEGIN
  IF p_section_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE v2_estimate_sections
  SET
    subtotal = (
      SELECT COALESCE(SUM(amount), 0)
      FROM v2_estimate_lines
      WHERE section_id = p_section_id
        AND parent_line_id IS NULL
    ),
    updated_at = NOW()
  WHERE id = p_section_id;
END;
$$ LANGUAGE plpgsql;

-- Update all sections for an estimate
CREATE OR REPLACE FUNCTION update_all_section_subtotals(p_estimate_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE v2_estimate_sections sec
  SET
    subtotal = (
      SELECT COALESCE(SUM(amount), 0)
      FROM v2_estimate_lines
      WHERE section_id = sec.id
        AND parent_line_id IS NULL
    ),
    updated_at = NOW()
  WHERE sec.estimate_id = p_estimate_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_section_subtotal(UUID) IS 'Updates subtotal for a single section';
COMMENT ON FUNCTION update_all_section_subtotals(UUID) IS 'Updates subtotals for all sections in an estimate';

-- ============================================================
-- 3. ASSEMBLY TEMPLATE EXPANSION
-- ============================================================
-- Expands an assembly template into line items within an estimate
-- Returns the ID of the assembly header line created

CREATE OR REPLACE FUNCTION expand_assembly_template(
  p_estimate_id UUID,
  p_template_id UUID,
  p_section_id UUID DEFAULT NULL,
  p_quantity_multiplier DECIMAL DEFAULT 1
)
RETURNS UUID AS $$
DECLARE
  v_template RECORD;
  v_header_id UUID;
  v_sort_base INTEGER;
BEGIN
  -- Get template info
  SELECT * INTO v_template FROM v2_assembly_templates WHERE id = p_template_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assembly template not found: %', p_template_id;
  END IF;

  IF NOT v_template.is_active THEN
    RAISE EXCEPTION 'Assembly template is not active: %', v_template.name;
  END IF;

  -- Get next sort order
  SELECT COALESCE(MAX(sort_order), 0) + 1 INTO v_sort_base
  FROM v2_estimate_lines WHERE estimate_id = p_estimate_id;

  -- Create assembly header line
  INSERT INTO v2_estimate_lines (
    estimate_id, section_id, description,
    is_assembly, template_id, sort_order,
    quantity, unit, amount
  )
  VALUES (
    p_estimate_id, p_section_id, v_template.name,
    true, p_template_id, v_sort_base,
    1, 'ea', 0  -- Amount will be sum of children
  )
  RETURNING id INTO v_header_id;

  -- Copy template items as child lines
  INSERT INTO v2_estimate_lines (
    estimate_id, section_id, cost_code_id,
    description, quantity, unit, unit_cost, amount,
    parent_line_id, template_id, source, sort_order
  )
  SELECT
    p_estimate_id,
    p_section_id,
    ti.cost_code_id,
    ti.description,
    ti.quantity * p_quantity_multiplier,
    ti.unit,
    ti.unit_cost,
    ti.quantity * p_quantity_multiplier * ti.unit_cost,
    v_header_id,
    p_template_id,
    'template',
    v_sort_base + ti.sort_order + 1
  FROM v2_assembly_template_items ti
  WHERE ti.template_id = p_template_id
  ORDER BY ti.sort_order;

  -- Update header with sum of children
  UPDATE v2_estimate_lines
  SET amount = (
    SELECT COALESCE(SUM(amount), 0)
    FROM v2_estimate_lines
    WHERE parent_line_id = v_header_id
  )
  WHERE id = v_header_id;

  RETURN v_header_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION expand_assembly_template(UUID, UUID, UUID, DECIMAL) IS 'Expands an assembly template into estimate line items with optional quantity multiplier';

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

-- Trigger function for line item changes
CREATE OR REPLACE FUNCTION trigger_estimate_line_changed_v3()
RETURNS TRIGGER AS $$
DECLARE
  v_estimate_id UUID;
  v_old_section_id UUID;
  v_new_section_id UUID;
BEGIN
  -- Determine which estimate(s) and section(s) to update
  IF TG_OP = 'DELETE' THEN
    v_estimate_id := OLD.estimate_id;
    v_old_section_id := OLD.section_id;
  ELSE
    v_estimate_id := NEW.estimate_id;
    v_new_section_id := NEW.section_id;
    IF TG_OP = 'UPDATE' THEN
      v_old_section_id := OLD.section_id;
    END IF;
  END IF;

  -- Update section subtotals
  IF v_old_section_id IS NOT NULL THEN
    PERFORM update_section_subtotal(v_old_section_id);
  END IF;
  IF v_new_section_id IS NOT NULL AND v_new_section_id IS DISTINCT FROM v_old_section_id THEN
    PERFORM update_section_subtotal(v_new_section_id);
  END IF;

  -- Update estimate totals
  PERFORM recalculate_estimate_totals_v3(v_estimate_id);

  -- Update assembly header if this is a child line
  IF TG_OP = 'DELETE' AND OLD.parent_line_id IS NOT NULL THEN
    UPDATE v2_estimate_lines
    SET amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM v2_estimate_lines
      WHERE parent_line_id = OLD.parent_line_id
    )
    WHERE id = OLD.parent_line_id;
  ELSIF TG_OP != 'DELETE' AND NEW.parent_line_id IS NOT NULL THEN
    UPDATE v2_estimate_lines
    SET amount = (
      SELECT COALESCE(SUM(amount), 0)
      FROM v2_estimate_lines
      WHERE parent_line_id = NEW.parent_line_id
    )
    WHERE id = NEW.parent_line_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Replace existing trigger with new version
DROP TRIGGER IF EXISTS trigger_estimate_line_changed ON v2_estimate_lines;
DROP TRIGGER IF EXISTS trigger_estimate_line_changed_v3 ON v2_estimate_lines;

CREATE TRIGGER trigger_estimate_line_changed_v3
  AFTER INSERT OR UPDATE OR DELETE ON v2_estimate_lines
  FOR EACH ROW
  EXECUTE FUNCTION trigger_estimate_line_changed_v3();

-- Trigger for markup percentage changes
CREATE OR REPLACE FUNCTION trigger_estimate_markup_changed()
RETURNS TRIGGER AS $$
BEGIN
  -- Only recalculate if markup percentages changed
  IF OLD.overhead_percent IS DISTINCT FROM NEW.overhead_percent
     OR OLD.profit_percent IS DISTINCT FROM NEW.profit_percent
     OR OLD.contingency_percent IS DISTINCT FROM NEW.contingency_percent
     OR OLD.markup_percent IS DISTINCT FROM NEW.markup_percent
  THEN
    PERFORM recalculate_estimate_totals_v3(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_estimate_markup_changed ON v2_estimates;

CREATE TRIGGER trigger_estimate_markup_changed
  AFTER UPDATE OF overhead_percent, profit_percent, contingency_percent, markup_percent ON v2_estimates
  FOR EACH ROW
  EXECUTE FUNCTION trigger_estimate_markup_changed();

-- Timestamp trigger for sections
CREATE OR REPLACE FUNCTION update_section_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_section_timestamp ON v2_estimate_sections;

CREATE TRIGGER trigger_update_section_timestamp
  BEFORE UPDATE ON v2_estimate_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_section_timestamp();

-- Timestamp trigger for assembly templates
DROP TRIGGER IF EXISTS trigger_update_assembly_template_timestamp ON v2_assembly_templates;

CREATE TRIGGER trigger_update_assembly_template_timestamp
  BEFORE UPDATE ON v2_assembly_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_section_timestamp();

-- ============================================================
-- 5. COMMENTS
-- ============================================================
COMMENT ON FUNCTION trigger_estimate_line_changed_v3() IS 'Trigger function that updates section subtotals, estimate totals, and assembly headers on line item changes';
COMMENT ON FUNCTION trigger_estimate_markup_changed() IS 'Trigger function that recalculates estimate when markup percentages change';
