-- Migration 054: Labor Bids & Subcontractor Analysis
-- Enables tracking and comparison of labor bids/proposals from subcontractors

-- ============================================================
-- LABOR CATEGORIES (Trades)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_labor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,           -- "Framing", "Drywall", "Electrical"
  code TEXT UNIQUE,                    -- "FRAM", "DRYW", "ELEC"

  -- Standard pricing metrics for this trade
  primary_metric TEXT DEFAULT 'sf',    -- sf, lf, ea, fixture, opening
  metric_label TEXT,                   -- "per SF", "per LF", "per fixture"

  -- Typical ranges (for flagging outliers)
  typical_low DECIMAL(10,2),           -- $/metric low end
  typical_high DECIMAL(10,2),          -- $/metric high end

  -- Display order
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed labor categories
INSERT INTO v2_labor_categories (name, code, primary_metric, metric_label, typical_low, typical_high, sort_order) VALUES
('Framing', 'FRAM', 'sf', 'per SF', 8.00, 15.00, 1),
('Roofing', 'ROOF', 'sq', 'per square', 250.00, 450.00, 2),
('Siding', 'SIDE', 'sf', 'per SF', 4.00, 10.00, 3),
('Windows & Doors', 'WIND', 'opening', 'per opening', 150.00, 400.00, 4),
('Drywall', 'DRYW', 'sf', 'per SF wall', 1.50, 3.50, 5),
('Insulation', 'INSU', 'sf', 'per SF', 1.00, 2.50, 6),
('Electrical', 'ELEC', 'sf', 'per SF', 6.00, 12.00, 7),
('Plumbing', 'PLUM', 'fixture', 'per fixture', 800.00, 1500.00, 8),
('HVAC', 'HVAC', 'ton', 'per ton', 2500.00, 4500.00, 9),
('Painting', 'PAINT', 'sf', 'per SF', 1.50, 4.00, 10),
('Flooring', 'FLOOR', 'sf', 'per SF', 3.00, 12.00, 11),
('Tile', 'TILE', 'sf', 'per SF', 8.00, 25.00, 12),
('Cabinets', 'CAB', 'lf', 'per LF', 150.00, 400.00, 13),
('Countertops', 'CNTR', 'sf', 'per SF', 40.00, 150.00, 14),
('Concrete', 'CONC', 'sf', 'per SF', 5.00, 12.00, 15),
('Excavation', 'EXCV', 'cy', 'per CY', 15.00, 40.00, 16),
('Landscaping', 'LAND', 'sf', 'per SF lot', 0.50, 3.00, 17),
('Cleaning', 'CLEAN', 'sf', 'per SF', 0.15, 0.40, 18)
ON CONFLICT (name) DO UPDATE SET
  code = EXCLUDED.code,
  primary_metric = EXCLUDED.primary_metric,
  metric_label = EXCLUDED.metric_label,
  typical_low = EXCLUDED.typical_low,
  typical_high = EXCLUDED.typical_high,
  sort_order = EXCLUDED.sort_order;

-- ============================================================
-- JOB METRICS (Characteristics for normalizing bids)
-- ============================================================

-- Add metrics columns to existing jobs table
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS conditioned_sf INTEGER,        -- Heated/cooled SF
ADD COLUMN IF NOT EXISTS total_sf INTEGER,              -- Total under roof
ADD COLUMN IF NOT EXISTS lot_sf INTEGER,                -- Lot size
ADD COLUMN IF NOT EXISTS stories INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS bedrooms INTEGER,
ADD COLUMN IF NOT EXISTS bathrooms DECIMAL(3,1),        -- 2.5 bathrooms
ADD COLUMN IF NOT EXISTS garage_sf INTEGER,
ADD COLUMN IF NOT EXISTS garage_bays INTEGER,
ADD COLUMN IF NOT EXISTS exterior_wall_sf INTEGER,
ADD COLUMN IF NOT EXISTS roof_squares DECIMAL(6,1),     -- Roofing squares
ADD COLUMN IF NOT EXISTS window_count INTEGER,
ADD COLUMN IF NOT EXISTS door_count INTEGER,
ADD COLUMN IF NOT EXISTS plumbing_fixtures INTEGER,
ADD COLUMN IF NOT EXISTS hvac_tons DECIMAL(4,1),
ADD COLUMN IF NOT EXISTS job_type TEXT;                 -- 'custom', 'spec', 'remodel', 'addition'

-- ============================================================
-- LABOR SPECIFICATIONS (Material/finish options that affect pricing)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_labor_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES v2_labor_categories(id),

  spec_type TEXT NOT NULL,             -- "finish_level", "material", "coating", "grade"
  spec_name TEXT NOT NULL,             -- "Level 5", "Architectural Shingles", "2 Coats"
  spec_description TEXT,

  -- Pricing impact (multiplier or adder)
  price_multiplier DECIMAL(4,2) DEFAULT 1.0,  -- 1.0 = baseline, 1.25 = 25% more
  price_adder DECIMAL(10,2) DEFAULT 0,        -- Fixed $/SF adder

  -- Display
  is_default BOOLEAN DEFAULT false,    -- Default selection for this category
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed specifications by trade
INSERT INTO v2_labor_specifications (category_id, spec_type, spec_name, spec_description, price_multiplier, is_default, sort_order)
SELECT c.id, s.spec_type, s.spec_name, s.spec_description, s.price_multiplier, s.is_default, s.sort_order
FROM v2_labor_categories c
CROSS JOIN (VALUES
  -- Drywall finish levels
  ('Drywall', 'finish_level', 'Level 3', 'Tape embedded, one coat - for areas receiving texture', 0.85, false, 1),
  ('Drywall', 'finish_level', 'Level 4', 'Tape embedded, two coats - for flat paint or light texture', 1.0, true, 2),
  ('Drywall', 'finish_level', 'Level 5', 'Skim coat - for gloss/semi-gloss or critical lighting', 1.35, false, 3),

  -- Drywall texture
  ('Drywall', 'texture', 'Knockdown', 'Knockdown texture', 1.0, true, 1),
  ('Drywall', 'texture', 'Orange Peel', 'Orange peel texture', 0.95, false, 2),
  ('Drywall', 'texture', 'Smooth', 'Smooth walls (no texture)', 1.20, false, 3),
  ('Drywall', 'texture', 'Skip Trowel', 'Skip trowel texture', 1.15, false, 4),

  -- Roofing materials
  ('Roofing', 'material', '3-Tab Shingles', 'Basic 3-tab asphalt shingles', 0.75, false, 1),
  ('Roofing', 'material', 'Architectural Shingles', 'Dimensional/architectural asphalt shingles', 1.0, true, 2),
  ('Roofing', 'material', 'Premium Shingles', 'Designer/premium asphalt (50yr)', 1.25, false, 3),
  ('Roofing', 'material', 'Standing Seam Metal', 'Standing seam metal roofing', 2.5, false, 4),
  ('Roofing', 'material', 'Corrugated Metal', 'Corrugated/ribbed metal panels', 1.8, false, 5),
  ('Roofing', 'material', 'Concrete Tile', 'Concrete roof tiles', 2.2, false, 6),
  ('Roofing', 'material', 'Clay Tile', 'Clay roof tiles', 3.0, false, 7),
  ('Roofing', 'material', 'TPO/PVC', 'Flat roof membrane', 1.5, false, 8),

  -- Painting coats
  ('Painting', 'coats', '1 Coat', 'Single coat (touch-up only)', 0.6, false, 1),
  ('Painting', 'coats', '2 Coats', 'Standard 2 coats', 1.0, true, 2),
  ('Painting', 'coats', '3 Coats', 'Premium 3 coats', 1.35, false, 3),

  -- Paint grade
  ('Painting', 'grade', 'Builder Grade', 'Basic builder-grade paint', 0.85, false, 1),
  ('Painting', 'grade', 'Standard', 'Mid-grade paint (SW ProMar)', 1.0, true, 2),
  ('Painting', 'grade', 'Premium', 'Premium paint (SW Duration, BM Regal)', 1.25, false, 3),

  -- Flooring types
  ('Flooring', 'material', 'LVP/LVT', 'Luxury vinyl plank/tile', 1.0, true, 1),
  ('Flooring', 'material', 'Laminate', 'Laminate flooring', 0.7, false, 2),
  ('Flooring', 'material', 'Engineered Hardwood', 'Engineered hardwood', 1.5, false, 3),
  ('Flooring', 'material', 'Solid Hardwood', 'Solid hardwood', 2.0, false, 4),
  ('Flooring', 'material', 'Carpet', 'Carpet with pad', 0.6, false, 5),
  ('Flooring', 'material', 'Tile', 'Ceramic/porcelain tile', 1.8, false, 6),

  -- Tile types
  ('Tile', 'material', 'Ceramic', 'Ceramic tile', 0.8, false, 1),
  ('Tile', 'material', 'Porcelain', 'Porcelain tile', 1.0, true, 2),
  ('Tile', 'material', 'Natural Stone', 'Natural stone (marble, travertine)', 1.8, false, 3),
  ('Tile', 'material', 'Large Format', 'Large format tiles (24x24+)', 1.25, false, 4),
  ('Tile', 'material', 'Mosaic', 'Mosaic/penny tile', 1.5, false, 5),

  -- Cabinet types
  ('Cabinets', 'grade', 'Stock', 'Stock cabinets (in-stock sizes)', 0.7, false, 1),
  ('Cabinets', 'grade', 'Semi-Custom', 'Semi-custom cabinets', 1.0, true, 2),
  ('Cabinets', 'grade', 'Custom', 'Fully custom cabinets', 2.0, false, 3),

  -- Countertop materials
  ('Countertops', 'material', 'Laminate', 'Laminate countertops', 0.3, false, 1),
  ('Countertops', 'material', 'Butcher Block', 'Butcher block/wood', 0.5, false, 2),
  ('Countertops', 'material', 'Quartz', 'Engineered quartz', 1.0, true, 3),
  ('Countertops', 'material', 'Granite', 'Natural granite', 1.1, false, 4),
  ('Countertops', 'material', 'Marble', 'Natural marble', 1.5, false, 5),
  ('Countertops', 'material', 'Quartzite', 'Natural quartzite', 1.8, false, 6),

  -- Framing types
  ('Framing', 'type', 'Stick Frame', 'Traditional stick framing', 1.0, true, 1),
  ('Framing', 'type', 'Advanced Framing', 'Advanced framing (OVE)', 0.9, false, 2),
  ('Framing', 'type', 'Steel Stud', 'Steel stud framing', 1.3, false, 3),

  -- Insulation types
  ('Insulation', 'material', 'Fiberglass Batt', 'Fiberglass batt insulation', 1.0, true, 1),
  ('Insulation', 'material', 'Blown Fiberglass', 'Blown-in fiberglass', 1.1, false, 2),
  ('Insulation', 'material', 'Blown Cellulose', 'Blown-in cellulose', 1.05, false, 3),
  ('Insulation', 'material', 'Open Cell Foam', 'Open cell spray foam', 2.0, false, 4),
  ('Insulation', 'material', 'Closed Cell Foam', 'Closed cell spray foam', 3.0, false, 5),

  -- Siding types
  ('Siding', 'material', 'Vinyl', 'Vinyl siding', 0.7, false, 1),
  ('Siding', 'material', 'Fiber Cement', 'Fiber cement (HardiePlank)', 1.0, true, 2),
  ('Siding', 'material', 'LP SmartSide', 'LP SmartSide', 0.9, false, 3),
  ('Siding', 'material', 'Wood', 'Real wood siding', 1.5, false, 4),
  ('Siding', 'material', 'Stucco', 'Three-coat stucco', 1.3, false, 5),
  ('Siding', 'material', 'Stone Veneer', 'Manufactured stone veneer', 2.0, false, 6),
  ('Siding', 'material', 'Brick', 'Brick veneer', 2.5, false, 7)
) AS s(category_name, spec_type, spec_name, spec_description, price_multiplier, is_default, sort_order)
WHERE c.name = s.category_name
ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_labor_specs_category ON v2_labor_specifications(category_id);

-- ============================================================
-- SCOPE TEMPLATES (Standard scope items by trade)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_scope_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES v2_labor_categories(id),

  item_name TEXT NOT NULL,             -- "Hang drywall", "Tape & mud", "Texture"
  item_description TEXT,               -- Detailed description

  -- Is this typically included or an add-on?
  is_standard BOOLEAN DEFAULT true,    -- Standard inclusion vs optional
  is_exclusion BOOLEAN DEFAULT false,  -- Common exclusion to watch for

  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed common scope items
INSERT INTO v2_scope_templates (category_id, item_name, item_description, is_standard, is_exclusion, sort_order)
SELECT c.id, s.item_name, s.item_description, s.is_standard, s.is_exclusion, s.sort_order
FROM v2_labor_categories c
CROSS JOIN (VALUES
  -- Drywall
  ('Drywall', 'Hang drywall', 'Install drywall sheets on walls and ceilings', true, false, 1),
  ('Drywall', 'Tape & mud', 'Tape joints and apply joint compound', true, false, 2),
  ('Drywall', 'Texture', 'Apply texture (knockdown, orange peel, smooth)', true, false, 3),
  ('Drywall', 'Garage drywall', 'Drywall in garage area', false, true, 4),
  ('Drywall', 'Patch & repair', 'Patch holes and repair damage', false, true, 5),

  -- Framing
  ('Framing', 'Wall framing', 'Frame exterior and interior walls', true, false, 1),
  ('Framing', 'Roof framing', 'Frame roof/trusses', true, false, 2),
  ('Framing', 'Floor framing', 'Frame floors/subfloor', true, false, 3),
  ('Framing', 'Deck framing', 'Frame deck structure', false, false, 4),
  ('Framing', 'Hardware install', 'Install Simpson hardware/connectors', true, false, 5),
  ('Framing', 'Sheathing', 'Install wall and roof sheathing', true, false, 6),

  -- Electrical
  ('Electrical', 'Rough-in', 'Run wires, install boxes', true, false, 1),
  ('Electrical', 'Panel & service', 'Install electrical panel and service', true, false, 2),
  ('Electrical', 'Trim-out', 'Install devices, fixtures, covers', true, false, 3),
  ('Electrical', 'Low voltage', 'Data/phone/cable rough-in', false, false, 4),
  ('Electrical', 'Permit & inspection', 'Pull permit and coordinate inspections', true, false, 5),

  -- Plumbing
  ('Plumbing', 'Rough-in', 'Run supply and drain lines', true, false, 1),
  ('Plumbing', 'Top-out', 'Vent through roof', true, false, 2),
  ('Plumbing', 'Trim-out', 'Install fixtures, faucets, toilets', true, false, 3),
  ('Plumbing', 'Gas line', 'Run gas lines', false, false, 4),
  ('Plumbing', 'Water heater', 'Install water heater', true, false, 5),

  -- Painting
  ('Painting', 'Interior walls', 'Paint interior walls', true, false, 1),
  ('Painting', 'Interior trim', 'Paint doors, trim, casings', true, false, 2),
  ('Painting', 'Ceilings', 'Paint ceilings', true, false, 3),
  ('Painting', 'Exterior', 'Paint exterior (if applicable)', false, false, 4),
  ('Painting', 'Cabinets', 'Paint/stain cabinets', false, false, 5),
  ('Painting', 'Primer included', 'Primer coat included', true, false, 6),

  -- Roofing
  ('Roofing', 'Tear-off', 'Remove existing roofing', false, false, 1),
  ('Roofing', 'Underlayment', 'Install felt/synthetic underlayment', true, false, 2),
  ('Roofing', 'Shingles', 'Install shingles', true, false, 3),
  ('Roofing', 'Flashing', 'Install flashing at penetrations', true, false, 4),
  ('Roofing', 'Ridge vent', 'Install ridge vent', true, false, 5),
  ('Roofing', 'Gutters', 'Install gutters and downspouts', false, true, 6)
) AS s(category_name, item_name, item_description, is_standard, is_exclusion, sort_order)
WHERE c.name = s.category_name
ON CONFLICT DO NOTHING;

-- ============================================================
-- LABOR BIDS (Proposals from subs)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_labor_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id),
  vendor_id UUID REFERENCES v2_vendors(id),  -- The subcontractor
  category_id UUID REFERENCES v2_labor_categories(id),

  -- Bid details
  bid_number TEXT,                     -- Vendor's quote/proposal number
  bid_date DATE,
  valid_until DATE,                    -- Quote expiration

  -- Amounts
  base_amount DECIMAL(12,2) NOT NULL,  -- Base bid amount
  alternates_amount DECIMAL(12,2) DEFAULT 0,  -- Add-ons/alternates
  total_amount DECIMAL(12,2) GENERATED ALWAYS AS (base_amount + COALESCE(alternates_amount, 0)) STORED,

  -- Normalized pricing (calculated from job metrics)
  price_per_sf DECIMAL(10,2),          -- Calculated $/SF
  price_per_metric DECIMAL(10,2),      -- $/primary metric for this trade

  -- Status
  status TEXT DEFAULT 'received' CHECK (status IN ('received', 'reviewing', 'accepted', 'rejected', 'expired', 'countered')),

  -- Scope assessment
  scope_notes TEXT,                    -- Free-form scope notes
  inclusions TEXT[],                   -- What's included
  exclusions TEXT[],                   -- What's NOT included
  scope_score INTEGER,                 -- 1-10 completeness score

  -- Comparison flags
  is_lowest BOOLEAN DEFAULT false,
  is_selected BOOLEAN DEFAULT false,

  -- Terms
  payment_terms TEXT,                  -- "50% start, 50% complete"
  warranty_terms TEXT,
  lead_time_days INTEGER,              -- Days until they can start
  duration_days INTEGER,               -- Expected duration

  -- Documents
  pdf_url TEXT,                        -- Uploaded proposal PDF

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding bids
CREATE INDEX IF NOT EXISTS idx_labor_bids_job ON v2_labor_bids(job_id);
CREATE INDEX IF NOT EXISTS idx_labor_bids_vendor ON v2_labor_bids(vendor_id);
CREATE INDEX IF NOT EXISTS idx_labor_bids_category ON v2_labor_bids(category_id);
CREATE INDEX IF NOT EXISTS idx_labor_bids_status ON v2_labor_bids(status);

-- ============================================================
-- LABOR BID ITEMS (Line items/scope breakdown)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_labor_bid_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID REFERENCES v2_labor_bids(id) ON DELETE CASCADE,
  scope_template_id UUID REFERENCES v2_scope_templates(id),

  description TEXT NOT NULL,           -- Item description
  amount DECIMAL(12,2),                -- Amount for this line (if broken out)
  is_included BOOLEAN DEFAULT true,    -- Included in base or as alternate
  is_alternate BOOLEAN DEFAULT false,  -- Is this an add-on/alternate?

  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_bid_items_bid ON v2_labor_bid_items(bid_id);

-- ============================================================
-- BID SPECIFICATIONS (Link bids to their selected specs)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_labor_bid_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID REFERENCES v2_labor_bids(id) ON DELETE CASCADE,
  spec_id UUID REFERENCES v2_labor_specifications(id),

  -- Override values (if different from template)
  custom_multiplier DECIMAL(4,2),          -- Override the default multiplier
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(bid_id, spec_id)
);

CREATE INDEX IF NOT EXISTS idx_labor_bid_specs_bid ON v2_labor_bid_specs(bid_id);
CREATE INDEX IF NOT EXISTS idx_labor_bid_specs_spec ON v2_labor_bid_specs(spec_id);

-- Add normalized price columns to bids (adjusting for specs)
ALTER TABLE v2_labor_bids
ADD COLUMN IF NOT EXISTS spec_multiplier DECIMAL(4,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS normalized_amount DECIMAL(12,2),      -- Amount normalized to default specs
ADD COLUMN IF NOT EXISTS normalized_per_sf DECIMAL(10,2);      -- $/SF normalized to default specs

-- ============================================================
-- LABOR HISTORY (Historical pricing data)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_labor_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id),
  vendor_id UUID REFERENCES v2_vendors(id),
  category_id UUID REFERENCES v2_labor_categories(id),
  bid_id UUID REFERENCES v2_labor_bids(id),

  -- Job characteristics at time of bid
  conditioned_sf INTEGER,
  total_sf INTEGER,
  job_type TEXT,

  -- Pricing
  total_amount DECIMAL(12,2),
  price_per_sf DECIMAL(10,2),
  price_per_metric DECIMAL(10,2),

  -- Outcome (filled in after job complete)
  was_selected BOOLEAN DEFAULT false,
  final_amount DECIMAL(12,2),          -- Actual amount paid (with COs)
  change_order_amount DECIMAL(12,2),

  -- Performance
  on_budget BOOLEAN,                   -- Came in at or under
  on_schedule BOOLEAN,                 -- Met timeline
  quality_score INTEGER,               -- 1-5 rating
  would_use_again BOOLEAN,

  -- Metadata
  bid_year INTEGER,
  bid_month INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_labor_history_category ON v2_labor_history(category_id);
CREATE INDEX IF NOT EXISTS idx_labor_history_vendor ON v2_labor_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_labor_history_year ON v2_labor_history(bid_year);

-- ============================================================
-- SUB PERFORMANCE (Aggregate performance tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_sub_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES v2_vendors(id),
  category_id UUID REFERENCES v2_labor_categories(id),

  -- Aggregates
  total_jobs INTEGER DEFAULT 0,
  total_bids INTEGER DEFAULT 0,
  bids_won INTEGER DEFAULT 0,
  win_rate DECIMAL(5,2),               -- % of bids won

  -- Pricing
  avg_price_per_sf DECIMAL(10,2),
  price_trend DECIMAL(5,2),            -- YoY % change

  -- Performance
  avg_budget_variance DECIMAL(5,2),    -- % over/under budget
  on_budget_rate DECIMAL(5,2),         -- % of jobs on budget
  on_schedule_rate DECIMAL(5,2),       -- % of jobs on schedule
  avg_quality_score DECIMAL(3,1),      -- Avg quality rating

  -- Recommendation
  recommended BOOLEAN DEFAULT true,
  notes TEXT,

  last_bid_date DATE,
  last_job_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id, category_id)
);

-- ============================================================
-- VIEW: Current bid comparison for a job
-- ============================================================

CREATE OR REPLACE VIEW v2_job_bid_comparison AS
SELECT
  b.job_id,
  b.category_id,
  c.name as category_name,
  b.id as bid_id,
  v.name as vendor_name,
  b.total_amount,
  b.price_per_sf,
  b.status,
  b.scope_score,
  b.is_lowest,
  b.is_selected,
  b.bid_date,
  b.valid_until,
  sp.avg_price_per_sf as vendor_avg_price,
  sp.on_budget_rate as vendor_budget_rate,
  sp.avg_quality_score as vendor_quality,
  CASE
    WHEN sp.avg_price_per_sf > 0 THEN
      ROUND(((b.price_per_sf - sp.avg_price_per_sf) / sp.avg_price_per_sf * 100)::numeric, 1)
    ELSE NULL
  END as vs_vendor_avg_pct
FROM v2_labor_bids b
JOIN v2_labor_categories c ON b.category_id = c.id
JOIN v2_vendors v ON b.vendor_id = v.id
LEFT JOIN v2_sub_performance sp ON b.vendor_id = sp.vendor_id AND b.category_id = sp.category_id
WHERE b.status NOT IN ('rejected', 'expired');

-- ============================================================
-- FUNCTION: Calculate price per SF for a bid
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_bid_price_per_sf()
RETURNS TRIGGER AS $$
DECLARE
  v_sf INTEGER;
BEGIN
  -- Get conditioned SF from job
  SELECT conditioned_sf INTO v_sf
  FROM v2_jobs
  WHERE id = NEW.job_id;

  -- Calculate price per SF if we have SF data
  IF v_sf > 0 AND NEW.total_amount > 0 THEN
    NEW.price_per_sf := ROUND((NEW.base_amount / v_sf)::numeric, 2);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bid_price_per_sf ON v2_labor_bids;
CREATE TRIGGER bid_price_per_sf
  BEFORE INSERT OR UPDATE OF base_amount, job_id
  ON v2_labor_bids
  FOR EACH ROW
  EXECUTE FUNCTION calculate_bid_price_per_sf();

-- ============================================================
-- FUNCTION: Flag lowest bid per category per job
-- ============================================================

CREATE OR REPLACE FUNCTION update_lowest_bid()
RETURNS TRIGGER AS $$
BEGIN
  -- Reset all is_lowest flags for this job/category
  UPDATE v2_labor_bids
  SET is_lowest = false
  WHERE job_id = NEW.job_id
    AND category_id = NEW.category_id
    AND status NOT IN ('rejected', 'expired');

  -- Set is_lowest for the actual lowest
  UPDATE v2_labor_bids
  SET is_lowest = true
  WHERE id = (
    SELECT id FROM v2_labor_bids
    WHERE job_id = NEW.job_id
      AND category_id = NEW.category_id
      AND status NOT IN ('rejected', 'expired')
    ORDER BY total_amount
    LIMIT 1
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lowest_bid_trigger ON v2_labor_bids;
CREATE TRIGGER update_lowest_bid_trigger
  AFTER INSERT OR UPDATE OF base_amount, alternates_amount, status
  ON v2_labor_bids
  FOR EACH ROW
  EXECUTE FUNCTION update_lowest_bid();

-- ============================================================
-- FUNCTION: Calculate spec multiplier for a bid
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_bid_spec_multiplier(p_bid_id UUID)
RETURNS DECIMAL AS $$
DECLARE
  v_multiplier DECIMAL := 1.0;
  v_spec_count INTEGER := 0;
  rec RECORD;
BEGIN
  -- Multiply all spec multipliers together
  FOR rec IN
    SELECT
      COALESCE(bs.custom_multiplier, ls.price_multiplier) as mult
    FROM v2_labor_bid_specs bs
    JOIN v2_labor_specifications ls ON bs.spec_id = ls.id
    WHERE bs.bid_id = p_bid_id
  LOOP
    v_multiplier := v_multiplier * rec.mult;
    v_spec_count := v_spec_count + 1;
  END LOOP;

  -- If no specs selected, use 1.0
  IF v_spec_count = 0 THEN
    RETURN 1.0;
  END IF;

  RETURN v_multiplier;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: Update normalized amounts when specs change
-- ============================================================

CREATE OR REPLACE FUNCTION update_bid_normalized_amounts()
RETURNS TRIGGER AS $$
DECLARE
  v_bid RECORD;
  v_sf INTEGER;
  v_mult DECIMAL;
BEGIN
  -- Get the bid and job info
  SELECT b.*, j.conditioned_sf
  INTO v_bid
  FROM v2_labor_bids b
  LEFT JOIN v2_jobs j ON b.job_id = j.id
  WHERE b.id = COALESCE(NEW.bid_id, OLD.bid_id);

  IF v_bid.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate new multiplier
  v_mult := calculate_bid_spec_multiplier(v_bid.id);

  -- Update the bid with normalized values
  UPDATE v2_labor_bids
  SET
    spec_multiplier = v_mult,
    normalized_amount = CASE WHEN v_mult > 0 THEN ROUND((base_amount / v_mult)::numeric, 2) ELSE base_amount END,
    normalized_per_sf = CASE
      WHEN v_mult > 0 AND v_bid.conditioned_sf > 0
      THEN ROUND(((base_amount / v_mult) / v_bid.conditioned_sf)::numeric, 2)
      ELSE price_per_sf
    END
  WHERE id = v_bid.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS bid_spec_update_trigger ON v2_labor_bid_specs;
CREATE TRIGGER bid_spec_update_trigger
  AFTER INSERT OR UPDATE OR DELETE
  ON v2_labor_bid_specs
  FOR EACH ROW
  EXECUTE FUNCTION update_bid_normalized_amounts();

-- ============================================================
-- VIEW: Bid comparison with specs (enhanced)
-- ============================================================

CREATE OR REPLACE VIEW v2_bid_comparison_detail AS
SELECT
  b.id as bid_id,
  b.job_id,
  j.name as job_name,
  j.conditioned_sf,
  b.category_id,
  c.name as category_name,
  c.primary_metric,
  c.typical_low,
  c.typical_high,
  v.id as vendor_id,
  v.name as vendor_name,
  b.bid_number,
  b.bid_date,
  b.valid_until,
  b.base_amount,
  b.total_amount,
  b.price_per_sf,
  b.spec_multiplier,
  b.normalized_amount,
  b.normalized_per_sf,
  b.status,
  b.scope_score,
  b.inclusions,
  b.exclusions,
  b.is_lowest,
  b.is_selected,
  b.lead_time_days,
  b.duration_days,
  -- Specs as JSON array
  (
    SELECT json_agg(json_build_object(
      'spec_type', ls.spec_type,
      'spec_name', ls.spec_name,
      'multiplier', COALESCE(bs.custom_multiplier, ls.price_multiplier)
    ))
    FROM v2_labor_bid_specs bs
    JOIN v2_labor_specifications ls ON bs.spec_id = ls.id
    WHERE bs.bid_id = b.id
  ) as specs,
  -- Vendor performance
  sp.avg_price_per_sf as vendor_avg_price,
  sp.on_budget_rate as vendor_budget_rate,
  sp.avg_quality_score as vendor_quality,
  sp.total_jobs as vendor_total_jobs,
  -- Price comparison
  CASE
    WHEN c.typical_low > 0 THEN
      CASE
        WHEN b.normalized_per_sf < c.typical_low THEN 'below_typical'
        WHEN b.normalized_per_sf > c.typical_high THEN 'above_typical'
        ELSE 'in_range'
      END
    ELSE 'unknown'
  END as price_range_status
FROM v2_labor_bids b
JOIN v2_labor_categories c ON b.category_id = c.id
JOIN v2_vendors v ON b.vendor_id = v.id
LEFT JOIN v2_jobs j ON b.job_id = j.id
LEFT JOIN v2_sub_performance sp ON b.vendor_id = sp.vendor_id AND b.category_id = sp.category_id;

-- ============================================================
-- FUNCTION: Get bid analysis for a job/category
-- ============================================================

CREATE OR REPLACE FUNCTION analyze_bids(
  p_job_id UUID,
  p_category_id UUID DEFAULT NULL
) RETURNS TABLE (
  category_name TEXT,
  bid_count INTEGER,
  lowest_amount DECIMAL,
  highest_amount DECIMAL,
  avg_amount DECIMAL,
  lowest_normalized DECIMAL,
  avg_per_sf DECIMAL,
  recommended_vendor TEXT,
  recommended_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.name as category_name,
    COUNT(b.id)::INTEGER as bid_count,
    MIN(b.total_amount) as lowest_amount,
    MAX(b.total_amount) as highest_amount,
    ROUND(AVG(b.total_amount)::numeric, 2) as avg_amount,
    MIN(b.normalized_amount) as lowest_normalized,
    ROUND(AVG(b.normalized_per_sf)::numeric, 2) as avg_per_sf,
    (
      SELECT v.name
      FROM v2_labor_bids lb
      JOIN v2_vendors v ON lb.vendor_id = v.id
      LEFT JOIN v2_sub_performance sp ON lb.vendor_id = sp.vendor_id AND lb.category_id = sp.category_id
      WHERE lb.job_id = p_job_id
        AND lb.category_id = c.id
        AND lb.status NOT IN ('rejected', 'expired')
      ORDER BY
        -- Score: weighted by price (40%), quality (30%), budget reliability (30%)
        (CASE WHEN lb.normalized_amount = MIN(lb.normalized_amount) OVER () THEN 0.4 ELSE 0 END) +
        (COALESCE(sp.avg_quality_score, 3) / 5 * 0.3) +
        (COALESCE(sp.on_budget_rate, 50) / 100 * 0.3) DESC
      LIMIT 1
    ) as recommended_vendor,
    'Best value considering price, quality, and reliability' as recommended_reason
  FROM v2_labor_categories c
  JOIN v2_labor_bids b ON b.category_id = c.id
  WHERE b.job_id = p_job_id
    AND b.status NOT IN ('rejected', 'expired')
    AND (p_category_id IS NULL OR c.id = p_category_id)
  GROUP BY c.id, c.name;
END;
$$ LANGUAGE plpgsql;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Labor bids schema created with categories, specifications, scope templates, and performance tracking';
END $$;
