-- Migration 157: Estimate Assemblies & Historical Costs
-- Phase 9 Advanced Features: Assembly-based estimating and historical cost trending

-- ============================================================
-- ESTIMATE ASSEMBLIES (Reusable assembly packages for estimates)
-- ============================================================

-- Main assemblies table - reusable packages that can be applied to estimates
CREATE TABLE IF NOT EXISTS v2_estimate_assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID,  -- For multi-tenant support (optional)
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- e.g., 'Framing', 'Plumbing', 'Electrical', 'Foundation'
  unit_type TEXT NOT NULL DEFAULT 'each',  -- each, sqft, lf, cy, hr, etc.
  base_cost DECIMAL(14,2) DEFAULT 0,  -- Base cost per unit (calculated from components)
  labor_cost DECIMAL(14,2) DEFAULT 0,  -- Labor portion of base cost
  material_cost DECIMAL(14,2) DEFAULT 0,  -- Material portion of base cost
  components JSONB DEFAULT '[]'::JSONB,  -- Array of { cost_code_id, description, quantity_formula, unit_cost, is_labor }
  tags TEXT[] DEFAULT '{}',  -- Tags for filtering/searching
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INTEGER DEFAULT 0,  -- Track how often this assembly is used
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for assemblies applied to estimates
CREATE TABLE IF NOT EXISTS v2_estimate_assembly_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id UUID NOT NULL REFERENCES v2_estimates(id) ON DELETE CASCADE,
  assembly_id UUID NOT NULL REFERENCES v2_estimate_assemblies(id) ON DELETE RESTRICT,
  quantity DECIMAL(12,4) DEFAULT 1,  -- How many units of assembly
  unit_override TEXT,  -- Override the assembly's unit_type
  cost_multiplier DECIMAL(6,4) DEFAULT 1.0000,  -- For price adjustments (e.g., 1.1 = 10% markup)
  notes TEXT,
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  applied_by TEXT,
  -- Track what lines were created from this application
  generated_line_ids UUID[] DEFAULT '{}'
);

-- ============================================================
-- HISTORICAL COSTS (Cost trending and analytics)
-- ============================================================

-- Historical cost records from various sources
CREATE TABLE IF NOT EXISTS v2_historical_costs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID,  -- For multi-tenant support (optional)
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE SET NULL,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,

  -- Cost details
  description TEXT,
  unit_type TEXT,  -- each, sqft, lf, hr, etc.
  unit_cost DECIMAL(14,4),  -- Cost per unit with high precision
  quantity DECIMAL(12,4) DEFAULT 1,
  total_cost DECIMAL(14,2),  -- Total cost (unit_cost * quantity)

  -- Metadata
  cost_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT NOT NULL CHECK (source IN ('invoice', 'estimate', 'po', 'manual', 'bid')),
  source_id UUID,  -- Reference to source record (invoice_id, estimate_id, po_id, etc.)

  -- Context for trending
  job_type TEXT,  -- 'new_construction', 'remodel', 'addition', etc.
  sqft INTEGER,  -- Job square footage for normalization
  location TEXT,  -- City/region for location-based analysis

  -- Indexing helpers
  year INTEGER GENERATED ALWAYS AS (EXTRACT(YEAR FROM cost_date)) STORED,
  month INTEGER GENERATED ALWAYS AS (EXTRACT(MONTH FROM cost_date)) STORED,
  quarter INTEGER GENERATED ALWAYS AS (EXTRACT(QUARTER FROM cost_date)) STORED,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Estimate assemblies indexes
CREATE INDEX IF NOT EXISTS idx_estimate_assemblies_category
  ON v2_estimate_assemblies(category) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_estimate_assemblies_unit_type
  ON v2_estimate_assemblies(unit_type) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_estimate_assemblies_search
  ON v2_estimate_assemblies USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX IF NOT EXISTS idx_estimate_assemblies_tags
  ON v2_estimate_assemblies USING gin(tags);

-- Assembly applications indexes
CREATE INDEX IF NOT EXISTS idx_estimate_assembly_apps_estimate
  ON v2_estimate_assembly_applications(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_assembly_apps_assembly
  ON v2_estimate_assembly_applications(assembly_id);

-- Historical costs indexes
CREATE INDEX IF NOT EXISTS idx_historical_costs_cost_code
  ON v2_historical_costs(cost_code_id);
CREATE INDEX IF NOT EXISTS idx_historical_costs_vendor
  ON v2_historical_costs(vendor_id);
CREATE INDEX IF NOT EXISTS idx_historical_costs_job
  ON v2_historical_costs(job_id);
CREATE INDEX IF NOT EXISTS idx_historical_costs_date
  ON v2_historical_costs(cost_date DESC);
CREATE INDEX IF NOT EXISTS idx_historical_costs_source
  ON v2_historical_costs(source, source_id);
CREATE INDEX IF NOT EXISTS idx_historical_costs_year_month
  ON v2_historical_costs(year, month);
CREATE INDEX IF NOT EXISTS idx_historical_costs_trending
  ON v2_historical_costs(cost_code_id, cost_date DESC);

-- ============================================================
-- HELPER FUNCTION: Auto-capture costs from approved invoices
-- ============================================================

CREATE OR REPLACE FUNCTION capture_historical_cost_from_invoice()
RETURNS TRIGGER AS $$
DECLARE
  alloc RECORD;
  job_data RECORD;
BEGIN
  -- Only capture when invoice is approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Get job details for context
    SELECT j.name, j.sqft, j.job_type, j.city
    INTO job_data
    FROM v2_jobs j
    WHERE j.id = NEW.job_id;

    -- Capture each allocation as a historical cost
    FOR alloc IN
      SELECT ia.*, cc.code as cost_code
      FROM v2_invoice_allocations ia
      LEFT JOIN v2_cost_codes cc ON ia.cost_code_id = cc.id
      WHERE ia.invoice_id = NEW.id
    LOOP
      INSERT INTO v2_historical_costs (
        job_id,
        cost_code_id,
        vendor_id,
        description,
        unit_type,
        unit_cost,
        quantity,
        total_cost,
        cost_date,
        source,
        source_id,
        job_type,
        sqft,
        location
      ) VALUES (
        NEW.job_id,
        alloc.cost_code_id,
        NEW.vendor_id,
        COALESCE(alloc.notes, NEW.description, 'Invoice ' || NEW.invoice_number),
        'ls',  -- Default to lump sum for invoice allocations
        alloc.amount,
        1,
        alloc.amount,
        COALESCE(NEW.invoice_date, CURRENT_DATE),
        'invoice',
        NEW.id,
        job_data.job_type,
        job_data.sqft,
        job_data.city
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop first if exists)
DROP TRIGGER IF EXISTS trigger_capture_historical_cost ON v2_invoices;
CREATE TRIGGER trigger_capture_historical_cost
  AFTER UPDATE ON v2_invoices
  FOR EACH ROW
  EXECUTE FUNCTION capture_historical_cost_from_invoice();

-- ============================================================
-- SEED DATA: Common assembly categories
-- ============================================================

INSERT INTO v2_estimate_assemblies (name, description, category, unit_type, base_cost, components) VALUES
  (
    'Standard Interior Door Package',
    'Interior door with frame, hardware, and installation',
    'Doors & Windows',
    'each',
    450.00,
    '[{"description": "Interior Door", "unit_cost": 150, "quantity_formula": "1", "is_labor": false}, {"description": "Door Frame/Jamb", "unit_cost": 75, "quantity_formula": "1", "is_labor": false}, {"description": "Hardware Set", "unit_cost": 45, "quantity_formula": "1", "is_labor": false}, {"description": "Installation Labor", "unit_cost": 180, "quantity_formula": "1", "is_labor": true}]'::JSONB
  ),
  (
    'Rough Plumbing - Bathroom',
    'Complete rough-in plumbing for standard bathroom',
    'Plumbing',
    'each',
    2800.00,
    '[{"description": "Toilet Rough-In", "unit_cost": 400, "quantity_formula": "1", "is_labor": false}, {"description": "Lavatory Rough-In", "unit_cost": 350, "quantity_formula": "1", "is_labor": false}, {"description": "Tub/Shower Rough-In", "unit_cost": 550, "quantity_formula": "1", "is_labor": false}, {"description": "Vent Stack", "unit_cost": 200, "quantity_formula": "1", "is_labor": false}, {"description": "Plumbing Labor", "unit_cost": 1300, "quantity_formula": "1", "is_labor": true}]'::JSONB
  ),
  (
    'Electrical Outlet Package',
    'Standard duplex outlet with box, wire run, and installation',
    'Electrical',
    'each',
    125.00,
    '[{"description": "Outlet & Cover", "unit_cost": 8, "quantity_formula": "1", "is_labor": false}, {"description": "Electrical Box", "unit_cost": 5, "quantity_formula": "1", "is_labor": false}, {"description": "Wire (15ft avg run)", "unit_cost": 12, "quantity_formula": "1", "is_labor": false}, {"description": "Installation Labor", "unit_cost": 100, "quantity_formula": "1", "is_labor": true}]'::JSONB
  ),
  (
    'Framing - Exterior Wall',
    'Exterior wall framing per linear foot',
    'Framing',
    'lf',
    45.00,
    '[{"description": "Studs & Plates", "unit_cost": 18, "quantity_formula": "1", "is_labor": false}, {"description": "Sheathing", "unit_cost": 8, "quantity_formula": "1", "is_labor": false}, {"description": "Fasteners", "unit_cost": 2, "quantity_formula": "1", "is_labor": false}, {"description": "Framing Labor", "unit_cost": 17, "quantity_formula": "1", "is_labor": true}]'::JSONB
  ),
  (
    'Concrete Slab Foundation',
    'Standard 4" reinforced concrete slab on grade',
    'Foundation',
    'sqft',
    12.50,
    '[{"description": "Concrete (3000 PSI)", "unit_cost": 5.50, "quantity_formula": "1", "is_labor": false}, {"description": "Rebar & Mesh", "unit_cost": 1.25, "quantity_formula": "1", "is_labor": false}, {"description": "Vapor Barrier", "unit_cost": 0.35, "quantity_formula": "1", "is_labor": false}, {"description": "Form Work", "unit_cost": 1.50, "quantity_formula": "0.2", "is_labor": false}, {"description": "Finishing Labor", "unit_cost": 3.90, "quantity_formula": "1", "is_labor": true}]'::JSONB
  ),
  (
    'Drywall - Standard',
    'Standard 1/2" drywall, hung, taped, and finished Level 4',
    'Drywall',
    'sqft',
    3.25,
    '[{"description": "1/2\" Drywall Sheet", "unit_cost": 0.55, "quantity_formula": "1", "is_labor": false}, {"description": "Joint Compound", "unit_cost": 0.15, "quantity_formula": "1", "is_labor": false}, {"description": "Tape & Fasteners", "unit_cost": 0.10, "quantity_formula": "1", "is_labor": false}, {"description": "Hanging Labor", "unit_cost": 0.85, "quantity_formula": "1", "is_labor": true}, {"description": "Taping & Finishing", "unit_cost": 1.60, "quantity_formula": "1", "is_labor": true}]'::JSONB
  ),
  (
    'Roofing - Asphalt Shingles',
    'Architectural asphalt shingles with underlayment',
    'Roofing',
    'sqft',
    5.75,
    '[{"description": "Architectural Shingles", "unit_cost": 1.40, "quantity_formula": "1", "is_labor": false}, {"description": "Underlayment", "unit_cost": 0.35, "quantity_formula": "1", "is_labor": false}, {"description": "Starter & Ridge", "unit_cost": 0.25, "quantity_formula": "1", "is_labor": false}, {"description": "Nails & Flashing", "unit_cost": 0.25, "quantity_formula": "1", "is_labor": false}, {"description": "Installation Labor", "unit_cost": 3.50, "quantity_formula": "1", "is_labor": true}]'::JSONB
  ),
  (
    'HVAC - Ductwork Run',
    'Standard flex duct run with register',
    'HVAC',
    'each',
    285.00,
    '[{"description": "Flex Duct (25ft)", "unit_cost": 45, "quantity_formula": "1", "is_labor": false}, {"description": "Register & Boot", "unit_cost": 35, "quantity_formula": "1", "is_labor": false}, {"description": "Collar & Straps", "unit_cost": 15, "quantity_formula": "1", "is_labor": false}, {"description": "Installation Labor", "unit_cost": 190, "quantity_formula": "1", "is_labor": true}]'::JSONB
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_estimate_assemblies IS 'Reusable assembly packages for estimates with component breakdown';
COMMENT ON TABLE v2_estimate_assembly_applications IS 'Tracks which assemblies have been applied to which estimates';
COMMENT ON TABLE v2_historical_costs IS 'Historical cost data captured from invoices, estimates, POs, and bids for trending';
COMMENT ON COLUMN v2_estimate_assemblies.components IS 'JSONB array of components: [{cost_code_id, description, quantity_formula, unit_cost, is_labor}]';
COMMENT ON COLUMN v2_estimate_assemblies.unit_type IS 'Unit of measure: each, sqft, lf, cy, hr, etc.';
COMMENT ON COLUMN v2_historical_costs.source IS 'Origin of cost data: invoice, estimate, po, manual, bid';
