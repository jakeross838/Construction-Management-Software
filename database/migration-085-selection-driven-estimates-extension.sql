-- Migration 085: Selection-Driven Estimates Extension (Phase 72 Compatibility)
-- Extends existing v2_estimates system to support selection-driven estimation

-- ============================================================
-- 1. ADD MISSING COLUMNS TO v2_estimates
-- ============================================================
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS estimate_number TEXT;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS material_total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS labor_total DECIMAL(12,2) DEFAULT 0;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS markup_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS markup_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS contingency_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS contingency_amount DECIMAL(12,2) DEFAULT 0;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS valid_until DATE;
ALTER TABLE v2_estimates ADD COLUMN IF NOT EXISTS internal_notes TEXT;

-- ============================================================
-- 2. ADD MISSING COLUMNS TO v2_estimate_lines
-- ============================================================
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES v2_selection_catalog(id) ON DELETE SET NULL;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS quantity_formula TEXT;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS quantity_override BOOLEAN DEFAULT false;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS price_override BOOLEAN DEFAULT false;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS material_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS waste_factor_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS material_with_waste DECIMAL(12,2) DEFAULT 0;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS labor_hours DECIMAL(8,2) DEFAULT 0;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS labor_rate DECIMAL(10,2) DEFAULT 0;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS labor_cost DECIMAL(12,2) DEFAULT 0;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS room TEXT;
ALTER TABLE v2_estimate_lines ADD COLUMN IF NOT EXISTS source TEXT;

-- Index for catalog lookups
CREATE INDEX IF NOT EXISTS idx_estimate_lines_catalog ON v2_estimate_lines(catalog_item_id);

-- ============================================================
-- 3. PROJECT DETAILS TABLE (House info for calculations)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_project_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Square footage
  total_sqft DECIMAL(10,2),
  conditioned_sqft DECIMAL(10,2),
  garage_sqft DECIMAL(10,2),
  porch_sqft DECIMAL(10,2),

  -- Room counts
  bedroom_count INTEGER,
  bathroom_count DECIMAL(3,1),
  story_count DECIMAL(3,1),

  -- Dimensions (for linear foot calculations)
  exterior_linear_ft DECIMAL(10,2),
  interior_wall_linear_ft DECIMAL(10,2),
  roof_sqft DECIMAL(10,2),

  -- Room-specific details stored as JSON
  room_details JSONB DEFAULT '[]',

  -- Style/tier for default selections
  style_tier TEXT CHECK (style_tier IN ('builder', 'standard', 'premium', 'luxury')) DEFAULT 'standard',

  -- Source of data
  source TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id)
);

CREATE INDEX IF NOT EXISTS idx_project_details_job ON v2_project_details(job_id);

-- ============================================================
-- 4. SCOPES OF WORK (for bid requests)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_scopes_of_work (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  estimate_id UUID REFERENCES v2_estimates(id) ON DELETE SET NULL,
  trade_id UUID REFERENCES v2_labor_categories(id),

  -- Identification
  scope_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Status
  status TEXT CHECK (status IN ('draft', 'sent', 'received_bids', 'awarded', 'cancelled')) DEFAULT 'draft',

  -- Content
  scope_text TEXT,
  inclusions TEXT[],
  exclusions TEXT[],

  -- Attached items
  line_items JSONB,

  -- Bid info
  due_date DATE,
  awarded_vendor_id UUID REFERENCES v2_vendors(id),
  awarded_amount DECIMAL(12,2),

  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scopes_job ON v2_scopes_of_work(job_id);
CREATE INDEX IF NOT EXISTS idx_scopes_estimate ON v2_scopes_of_work(estimate_id);

-- ============================================================
-- 5. ESTIMATE CONVERSIONS (tracking downstream)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_estimate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,

  -- What was created
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('allowance', 'scope', 'bid_request', 'purchase_order', 'budget')),
  target_id UUID NOT NULL,

  -- When and by whom
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  converted_by TEXT,

  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_estimate_conversions_estimate ON v2_estimate_conversions(estimate_id);

-- ============================================================
-- 6. FUNCTION: Calculate line totals
-- ============================================================
CREATE OR REPLACE FUNCTION calculate_estimate_line_costs()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate material with waste
  NEW.material_with_waste := COALESCE(NEW.material_cost, 0) * (1 + COALESCE(NEW.waste_factor_percent, 0) / 100);

  -- Calculate labor cost
  NEW.labor_cost := COALESCE(NEW.labor_hours, 0) * COALESCE(NEW.labor_rate, 0);

  -- Calculate amount (line total) if not explicitly set
  IF NEW.amount IS NULL OR NEW.amount = 0 THEN
    NEW.amount := COALESCE(NEW.material_with_waste, 0) + COALESCE(NEW.labor_cost, 0);
    -- Fall back to quantity * unit_cost if no material/labor breakdown
    IF NEW.amount = 0 THEN
      NEW.amount := COALESCE(NEW.quantity, 1) * COALESCE(NEW.unit_cost, 0);
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_estimate_line_costs ON v2_estimate_lines;
CREATE TRIGGER trigger_calc_estimate_line_costs
  BEFORE INSERT OR UPDATE ON v2_estimate_lines
  FOR EACH ROW
  EXECUTE FUNCTION calculate_estimate_line_costs();

-- ============================================================
-- 7. FUNCTION: Recalculate estimate totals with markup
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_estimate_with_markup(p_estimate_id UUID)
RETURNS void AS $$
DECLARE
  v_material DECIMAL(12,2);
  v_labor DECIMAL(12,2);
  v_subtotal DECIMAL(12,2);
  v_markup_pct DECIMAL(5,2);
  v_markup_amt DECIMAL(12,2);
  v_contingency_pct DECIMAL(5,2);
  v_contingency_amt DECIMAL(12,2);
  v_grand_total DECIMAL(12,2);
BEGIN
  -- Sum line items by cost type
  SELECT
    COALESCE(SUM(material_with_waste), 0),
    COALESCE(SUM(labor_cost), 0)
  INTO v_material, v_labor
  FROM v2_estimate_lines
  WHERE estimate_id = p_estimate_id;

  -- If no material/labor breakdown, use total amounts
  IF v_material = 0 AND v_labor = 0 THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_subtotal
    FROM v2_estimate_lines
    WHERE estimate_id = p_estimate_id;
    v_material := v_subtotal;
    v_labor := 0;
  ELSE
    v_subtotal := v_material + v_labor;
  END IF;

  -- Get markup and contingency percentages
  SELECT markup_percent, contingency_percent
  INTO v_markup_pct, v_contingency_pct
  FROM v2_estimates
  WHERE id = p_estimate_id;

  v_markup_amt := v_subtotal * COALESCE(v_markup_pct, 0) / 100;
  v_contingency_amt := v_subtotal * COALESCE(v_contingency_pct, 0) / 100;
  v_grand_total := v_subtotal + v_markup_amt + v_contingency_amt;

  -- Update estimate
  UPDATE v2_estimates
  SET
    material_total = v_material,
    labor_total = v_labor,
    subtotal = v_subtotal,
    markup_amount = v_markup_amt,
    contingency_amount = v_contingency_amt,
    total_amount = v_grand_total,
    updated_at = NOW()
  WHERE id = p_estimate_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. FUNCTION: Create estimate from job selections
-- ============================================================
CREATE OR REPLACE FUNCTION create_estimate_from_selections(
  p_job_id UUID,
  p_title TEXT,
  p_created_by TEXT DEFAULT 'System',
  p_markup_percent DECIMAL DEFAULT 0,
  p_contingency_percent DECIMAL DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_estimate_id UUID;
  v_job_name TEXT;
  v_estimate_number TEXT;
  v_sort_order INTEGER := 0;
BEGIN
  -- Get job name for estimate number
  SELECT name INTO v_job_name FROM v2_jobs WHERE id = p_job_id;

  -- Generate estimate number
  SELECT 'EST-' || REPLACE(SUBSTRING(v_job_name, 1, 20), ' ', '-') || '-' ||
         LPAD((COUNT(*) + 1)::TEXT, 3, '0')
  INTO v_estimate_number
  FROM v2_estimates WHERE job_id = p_job_id;

  -- Create the estimate
  INSERT INTO v2_estimates (
    job_id, title, estimate_number, status,
    markup_percent, contingency_percent, created_by
  )
  VALUES (
    p_job_id, p_title, v_estimate_number, 'draft',
    p_markup_percent, p_contingency_percent, p_created_by
  )
  RETURNING id INTO v_estimate_id;

  -- Copy selections as line items
  INSERT INTO v2_estimate_lines (
    estimate_id, catalog_item_id, cost_code_id,
    description, category, unit, quantity, unit_cost, amount,
    material_cost, waste_factor_percent, labor_hours, labor_rate,
    room, source, sort_order
  )
  SELECT
    v_estimate_id,
    sel.catalog_item_id,
    sc.cost_code_id,
    sc.name,
    cat.name,
    sc.coverage_unit,
    sel.quantity,
    COALESCE(sel.actual_price, sel.quoted_price, sc.unit_price),
    COALESCE(sel.actual_price, sel.quoted_price, sc.unit_price) * sel.quantity,
    COALESCE(sel.actual_price, sel.quoted_price, sc.unit_price) * sel.quantity,
    COALESCE(sc.waste_factor_percent, 0),
    COALESCE(sc.labor_hours, 0) * sel.quantity,
    65.00, -- Default labor rate
    sel.room,
    'selection',
    ROW_NUMBER() OVER (ORDER BY cat.name, sc.name)
  FROM v2_selections sel
  JOIN v2_allowances a ON sel.allowance_id = a.id
  JOIN v2_selection_catalog sc ON sel.catalog_item_id = sc.id
  LEFT JOIN v2_selection_categories cat ON sc.category_id = cat.id
  WHERE a.job_id = p_job_id
    AND sel.status = 'approved'
    AND sel.deleted_at IS NULL;

  -- Calculate totals
  PERFORM recalculate_estimate_with_markup(v_estimate_id);

  RETURN v_estimate_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. FUNCTION: Generate scope of work from estimate
-- ============================================================
CREATE OR REPLACE FUNCTION generate_scope_from_estimate(
  p_estimate_id UUID,
  p_trade_id UUID,
  p_created_by TEXT DEFAULT 'System'
)
RETURNS UUID AS $$
DECLARE
  v_scope_id UUID;
  v_job_id UUID;
  v_job_name TEXT;
  v_scope_number TEXT;
  v_trade_name TEXT;
  v_scope_text TEXT := '';
  v_line_items JSONB;
  r RECORD;
BEGIN
  -- Get job info
  SELECT e.job_id, j.name
  INTO v_job_id, v_job_name
  FROM v2_estimates e
  JOIN v2_jobs j ON e.job_id = j.id
  WHERE e.id = p_estimate_id;

  -- Get trade name
  SELECT name INTO v_trade_name FROM v2_labor_categories WHERE id = p_trade_id;

  -- Generate scope number
  SELECT 'SOW-' || REPLACE(SUBSTRING(v_job_name, 1, 15), ' ', '-') || '-' ||
         LPAD((COUNT(*) + 1)::TEXT, 3, '0')
  INTO v_scope_number
  FROM v2_scopes_of_work WHERE job_id = v_job_id;

  -- Build scope text from estimate lines matching this trade
  FOR r IN
    SELECT el.description, el.quantity, el.unit, el.amount,
           sc.name as catalog_name, sc.model_number, sc.specifications
    FROM v2_estimate_lines el
    LEFT JOIN v2_selection_catalog sc ON el.catalog_item_id = sc.id
    LEFT JOIN v2_catalog_trades ct ON sc.id = ct.catalog_item_id
    WHERE el.estimate_id = p_estimate_id
      AND (ct.trade_id = p_trade_id OR p_trade_id IS NULL)
  LOOP
    v_scope_text := v_scope_text || E'\n• ' || r.description;
    IF r.quantity > 1 THEN
      v_scope_text := v_scope_text || ' (' || r.quantity || ' ' || COALESCE(r.unit, 'each') || ')';
    END IF;
    IF r.model_number IS NOT NULL THEN
      v_scope_text := v_scope_text || E'\n  Model: ' || r.model_number;
    END IF;
  END LOOP;

  -- Get line items as JSON
  SELECT json_agg(json_build_object(
    'description', el.description,
    'quantity', el.quantity,
    'unit', el.unit,
    'amount', el.amount,
    'catalog_item', sc.name,
    'model_number', sc.model_number
  ))
  INTO v_line_items
  FROM v2_estimate_lines el
  LEFT JOIN v2_selection_catalog sc ON el.catalog_item_id = sc.id
  LEFT JOIN v2_catalog_trades ct ON sc.id = ct.catalog_item_id
  WHERE el.estimate_id = p_estimate_id
    AND (ct.trade_id = p_trade_id OR p_trade_id IS NULL);

  -- Create the scope
  INSERT INTO v2_scopes_of_work (
    job_id, estimate_id, trade_id, scope_number, name,
    scope_text, line_items, created_by
  )
  VALUES (
    v_job_id, p_estimate_id, p_trade_id,
    v_scope_number, COALESCE(v_trade_name, 'General') || ' Scope of Work',
    v_scope_text, v_line_items, p_created_by
  )
  RETURNING id INTO v_scope_id;

  -- Track conversion
  INSERT INTO v2_estimate_conversions (estimate_id, conversion_type, target_id, converted_by)
  VALUES (p_estimate_id, 'scope', v_scope_id, p_created_by);

  RETURN v_scope_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. UPDATE TIMESTAMPS TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_project_details_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_project_details_timestamp ON v2_project_details;
CREATE TRIGGER trigger_update_project_details_timestamp
  BEFORE UPDATE ON v2_project_details
  FOR EACH ROW
  EXECUTE FUNCTION update_project_details_timestamp();

DROP TRIGGER IF EXISTS trigger_update_scope_timestamp ON v2_scopes_of_work;
CREATE TRIGGER trigger_update_scope_timestamp
  BEFORE UPDATE ON v2_scopes_of_work
  FOR EACH ROW
  EXECUTE FUNCTION update_project_details_timestamp();

-- ============================================================
-- 11. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_project_details IS 'House/project dimensions and details for quantity calculations';
COMMENT ON TABLE v2_scopes_of_work IS 'Scopes generated from estimates for bid requests';
COMMENT ON TABLE v2_estimate_conversions IS 'Tracks what was created from an estimate';
COMMENT ON FUNCTION create_estimate_from_selections(UUID, TEXT, TEXT, DECIMAL, DECIMAL) IS 'Creates an estimate by copying approved selections from a job';
COMMENT ON FUNCTION generate_scope_from_estimate(UUID, UUID, TEXT) IS 'Generates a scope of work from estimate lines for a specific trade';
COMMENT ON FUNCTION recalculate_estimate_with_markup(UUID) IS 'Recalculates estimate totals including markup and contingency';
