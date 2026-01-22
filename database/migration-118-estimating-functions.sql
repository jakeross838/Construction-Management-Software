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
