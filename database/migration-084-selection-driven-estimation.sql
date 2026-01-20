-- Migration 084: Selection-Driven Estimation (Phase 72)
-- Enables creating estimates from catalog selections with auto-calculations

-- ============================================================
-- 1. PROJECT DETAILS TABLE (House info for calculations)
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
  bathroom_count DECIMAL(3,1),  -- 2.5 for 2 full + 1 half
  story_count DECIMAL(3,1),     -- 1.5 for story and a half

  -- Dimensions (for linear foot calculations)
  exterior_linear_ft DECIMAL(10,2),
  interior_wall_linear_ft DECIMAL(10,2),
  roof_sqft DECIMAL(10,2),

  -- Room-specific details stored as JSON
  room_details JSONB DEFAULT '[]',
  -- Example: [{"name": "Kitchen", "sqft": 250, "linear_ft": 64}, {"name": "Master Bath", "sqft": 120}]

  -- Style/tier for default selections
  style_tier TEXT CHECK (style_tier IN ('builder', 'standard', 'premium', 'luxury')) DEFAULT 'standard',

  -- Source of data
  source TEXT,  -- 'manual', 'plans_extracted', 'architect_provided'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id)
);

CREATE INDEX IF NOT EXISTS idx_project_details_job ON v2_project_details(job_id);

-- ============================================================
-- 2. ESTIMATES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Identification
  estimate_number TEXT NOT NULL,  -- 'EST-JobName-001'
  name TEXT NOT NULL,
  description TEXT,

  -- Status
  status TEXT CHECK (status IN ('draft', 'pending_review', 'approved', 'rejected', 'converted')) DEFAULT 'draft',

  -- Versioning
  version INTEGER DEFAULT 1,
  parent_estimate_id UUID REFERENCES v2_estimates(id),  -- For version history

  -- Totals (calculated, stored for performance)
  material_total DECIMAL(12,2) DEFAULT 0,
  labor_total DECIMAL(12,2) DEFAULT 0,
  subtotal DECIMAL(12,2) DEFAULT 0,
  markup_percent DECIMAL(5,2) DEFAULT 0,
  markup_amount DECIMAL(12,2) DEFAULT 0,
  contingency_percent DECIMAL(5,2) DEFAULT 0,
  contingency_amount DECIMAL(12,2) DEFAULT 0,
  grand_total DECIMAL(12,2) DEFAULT 0,

  -- Dates
  valid_until DATE,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,

  -- Notes
  notes TEXT,
  internal_notes TEXT,

  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimates_job ON v2_estimates(job_id);
CREATE INDEX IF NOT EXISTS idx_estimates_status ON v2_estimates(status);

-- ============================================================
-- 3. ESTIMATE LINE ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_estimate_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES v2_selection_catalog(id) ON DELETE SET NULL,
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  -- Item details (copied from catalog for versioning)
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  unit TEXT DEFAULT 'each',

  -- Quantity calculation
  quantity DECIMAL(10,4) NOT NULL DEFAULT 1,
  quantity_formula TEXT,  -- 'sqft * 1.1' for auto-calc reference
  quantity_override BOOLEAN DEFAULT false,  -- If true, user manually set quantity

  -- Pricing
  unit_price DECIMAL(12,4) DEFAULT 0,
  price_override BOOLEAN DEFAULT false,

  -- Material costs
  material_cost DECIMAL(12,2) DEFAULT 0,
  waste_factor_percent DECIMAL(5,2) DEFAULT 0,
  material_with_waste DECIMAL(12,2) DEFAULT 0,

  -- Labor costs
  labor_hours DECIMAL(8,2) DEFAULT 0,
  labor_rate DECIMAL(10,2) DEFAULT 0,
  labor_cost DECIMAL(12,2) DEFAULT 0,

  -- Line total
  line_total DECIMAL(12,2) DEFAULT 0,

  -- For grouped display
  room TEXT,
  sort_order INTEGER DEFAULT 0,

  -- Source tracking
  source TEXT,  -- 'catalog', 'manual', 'assembly'
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_estimate_lines_estimate ON v2_estimate_line_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_lines_catalog ON v2_estimate_line_items(catalog_item_id);

-- ============================================================
-- 4. ESTIMATE ASSEMBLIES (groups of related items)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_estimate_assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  description TEXT,
  room TEXT,

  -- Totals
  material_total DECIMAL(12,2) DEFAULT 0,
  labor_total DECIMAL(12,2) DEFAULT 0,
  assembly_total DECIMAL(12,2) DEFAULT 0,

  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Link table for assembly items
CREATE TABLE IF NOT EXISTS v2_estimate_assembly_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id UUID NOT NULL REFERENCES v2_estimate_assemblies(id) ON DELETE CASCADE,
  line_item_id UUID NOT NULL REFERENCES v2_estimate_line_items(id) ON DELETE CASCADE,
  UNIQUE(assembly_id, line_item_id)
);

-- ============================================================
-- 5. ESTIMATE CONVERSIONS (tracking downstream)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_estimate_conversions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,

  -- What was created
  conversion_type TEXT NOT NULL CHECK (conversion_type IN ('allowance', 'scope', 'bid_request', 'purchase_order')),
  target_id UUID NOT NULL,  -- ID of the created allowance/scope/bid/PO

  -- When and by whom
  converted_at TIMESTAMPTZ DEFAULT NOW(),
  converted_by TEXT,

  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_estimate_conversions_estimate ON v2_estimate_conversions(estimate_id);

-- ============================================================
-- 6. SCOPES OF WORK (for bid requests)
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
  scope_text TEXT,  -- Full scope of work text
  inclusions TEXT[], -- What's included
  exclusions TEXT[], -- What's NOT included

  -- Attached items
  line_items JSONB,  -- Copied from estimate for reference

  -- Bid info
  due_date DATE,
  awarded_vendor_id UUID REFERENCES v2_vendors(id),
  awarded_amount DECIMAL(12,2),

  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scopes_job ON v2_scopes_of_work(job_id);

-- ============================================================
-- 7. HELPER FUNCTIONS
-- ============================================================

-- Function to calculate estimate line totals
CREATE OR REPLACE FUNCTION calculate_estimate_line_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate material with waste
  NEW.material_with_waste := NEW.material_cost * (1 + COALESCE(NEW.waste_factor_percent, 0) / 100);

  -- Calculate labor cost
  NEW.labor_cost := COALESCE(NEW.labor_hours, 0) * COALESCE(NEW.labor_rate, 0);

  -- Calculate line total
  NEW.line_total := NEW.material_with_waste + NEW.labor_cost;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calc_estimate_line ON v2_estimate_line_items;
CREATE TRIGGER trigger_calc_estimate_line
  BEFORE INSERT OR UPDATE ON v2_estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_estimate_line_total();

-- Function to recalculate estimate totals
CREATE OR REPLACE FUNCTION recalculate_estimate_totals(p_estimate_id UUID)
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
  -- Sum line items
  SELECT
    COALESCE(SUM(material_with_waste), 0),
    COALESCE(SUM(labor_cost), 0)
  INTO v_material, v_labor
  FROM v2_estimate_line_items
  WHERE estimate_id = p_estimate_id;

  v_subtotal := v_material + v_labor;

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
    grand_total = v_grand_total,
    updated_at = NOW()
  WHERE id = p_estimate_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-recalculate on line item changes
CREATE OR REPLACE FUNCTION trigger_recalc_estimate()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_estimate_totals(OLD.estimate_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_estimate_totals(NEW.estimate_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_estimate_line_changed ON v2_estimate_line_items;
CREATE TRIGGER trigger_estimate_line_changed
  AFTER INSERT OR UPDATE OR DELETE ON v2_estimate_line_items
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalc_estimate();

-- ============================================================
-- 8. UPDATE TIMESTAMPS TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_estimate_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_estimate_timestamp ON v2_estimates;
CREATE TRIGGER trigger_update_estimate_timestamp
  BEFORE UPDATE ON v2_estimates
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_timestamp();

DROP TRIGGER IF EXISTS trigger_update_project_details_timestamp ON v2_project_details;
CREATE TRIGGER trigger_update_project_details_timestamp
  BEFORE UPDATE ON v2_project_details
  FOR EACH ROW
  EXECUTE FUNCTION update_estimate_timestamp();

-- ============================================================
-- 9. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_project_details IS 'House/project dimensions and details for quantity calculations';
COMMENT ON TABLE v2_estimates IS 'Selection-driven estimates with versioning';
COMMENT ON TABLE v2_estimate_line_items IS 'Individual items in an estimate with quantity and price calculations';
COMMENT ON TABLE v2_estimate_assemblies IS 'Groups of related line items (e.g., Kitchen Cabinets assembly)';
COMMENT ON TABLE v2_scopes_of_work IS 'Scopes generated from estimates for bid requests';
COMMENT ON FUNCTION recalculate_estimate_totals(UUID) IS 'Recalculates material, labor, markup, and grand totals for an estimate';
