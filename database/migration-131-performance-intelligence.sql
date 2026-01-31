-- Migration 131: Performance Intelligence System
-- Purpose: Track sub performance to enable data-driven scheduling and estimating
-- Links: Jobs → Scopes → Daily Logs → Performance Metrics → Predictions

-- ============================================================================
-- PART 1: JOB SPECIFICATIONS (What we're building)
-- ============================================================================

-- Job metrics - measurable attributes of each job
CREATE TABLE IF NOT EXISTS v2_job_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE NOT NULL,

  -- Square Footages
  total_sf INTEGER,                    -- Total conditioned square footage
  garage_sf INTEGER,
  porch_sf INTEGER,
  deck_sf INTEGER,

  -- Room Counts
  bedroom_count INTEGER,
  bathroom_count INTEGER,
  half_bath_count INTEGER,

  -- Specific Trade Metrics (add more as needed)
  tile_sf INTEGER,                     -- Total tile square footage
  hardwood_sf INTEGER,
  carpet_sf INTEGER,
  drywall_sf INTEGER,
  paint_sf INTEGER,                    -- Wall + ceiling SF to paint
  roofing_squares DECIMAL(10,2),       -- Roofing squares (100 SF each)
  exterior_siding_sf INTEGER,
  concrete_yards DECIMAL(10,2),
  linear_ft_trim INTEGER,
  window_count INTEGER,
  door_count INTEGER,
  exterior_door_count INTEGER,

  -- Plumbing Fixtures
  plumbing_fixture_count INTEGER,      -- Total fixtures

  -- Electrical
  electrical_outlet_count INTEGER,
  electrical_switch_count INTEGER,
  electrical_fixture_count INTEGER,

  -- HVAC
  hvac_tonnage DECIMAL(5,2),
  hvac_zone_count INTEGER,

  -- Complexity Factors
  stories INTEGER DEFAULT 1,
  has_basement BOOLEAN DEFAULT false,
  has_pool BOOLEAN DEFAULT false,
  is_custom_home BOOLEAN DEFAULT true,
  complexity_rating TEXT CHECK (complexity_rating IN ('simple', 'standard', 'complex', 'luxury')),

  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(job_id)
);

-- ============================================================================
-- PART 2: SCOPE DEFINITIONS (Standard work categories with units)
-- ============================================================================

-- Master list of scope categories with their measurement units
CREATE TABLE IF NOT EXISTS v2_scope_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  code TEXT UNIQUE NOT NULL,           -- 'TILE', 'FRAMING', 'ELECTRICAL_ROUGH'
  name TEXT NOT NULL,                  -- 'Tile Installation'
  trade TEXT NOT NULL,                 -- 'Tile', 'Carpentry', 'Electrical'

  -- How we measure this scope
  primary_unit TEXT NOT NULL,          -- 'SF', 'LF', 'EA', 'FIXTURE', 'ROOM'
  secondary_unit TEXT,                 -- Optional secondary (e.g., 'ROOM' for tile)

  -- What job spec field to pull quantity from
  job_spec_field TEXT,                 -- 'tile_sf', 'bathroom_count', etc.

  -- Default expectations (industry averages, updated over time)
  baseline_days_per_unit DECIMAL(10,4),      -- e.g., 0.01 days per SF for tile
  baseline_workers INTEGER DEFAULT 2,

  -- Categorization
  phase TEXT,                          -- 'rough', 'finish', 'sitework'
  cost_code_id UUID REFERENCES v2_cost_codes(id),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert standard scope categories
INSERT INTO v2_scope_categories (code, name, trade, primary_unit, secondary_unit, job_spec_field, baseline_days_per_unit, phase) VALUES
-- Sitework & Foundation
('EXCAVATION', 'Excavation & Grading', 'Sitework', 'SF', NULL, 'total_sf', 0.0005, 'sitework'),
('FOUNDATION', 'Foundation & Footings', 'Concrete', 'SF', NULL, 'total_sf', 0.003, 'sitework'),
('CONCRETE_FLATWORK', 'Concrete Flatwork', 'Concrete', 'SF', NULL, 'garage_sf', 0.002, 'sitework'),

-- Framing
('FRAMING_FLOOR', 'Floor Framing', 'Framing', 'SF', NULL, 'total_sf', 0.002, 'rough'),
('FRAMING_WALL', 'Wall Framing', 'Framing', 'SF', NULL, 'total_sf', 0.003, 'rough'),
('FRAMING_ROOF', 'Roof Framing', 'Framing', 'SF', NULL, 'total_sf', 0.003, 'rough'),
('FRAMING_COMPLETE', 'Complete Framing', 'Framing', 'SF', NULL, 'total_sf', 0.008, 'rough'),

-- Mechanicals - Rough
('PLUMBING_ROUGH', 'Plumbing Rough-in', 'Plumbing', 'FIXTURE', NULL, 'plumbing_fixture_count', 0.5, 'rough'),
('ELECTRICAL_ROUGH', 'Electrical Rough-in', 'Electrical', 'SF', NULL, 'total_sf', 0.002, 'rough'),
('HVAC_ROUGH', 'HVAC Rough-in', 'HVAC', 'TON', NULL, 'hvac_tonnage', 1.0, 'rough'),

-- Exterior
('ROOFING', 'Roofing', 'Roofing', 'SQUARE', NULL, 'roofing_squares', 0.15, 'rough'),
('SIDING', 'Exterior Siding', 'Siding', 'SF', NULL, 'exterior_siding_sf', 0.005, 'rough'),
('WINDOWS', 'Window Installation', 'Windows', 'EA', NULL, 'window_count', 0.25, 'rough'),
('EXTERIOR_DOORS', 'Exterior Doors', 'Doors', 'EA', NULL, 'exterior_door_count', 0.5, 'rough'),

-- Insulation & Drywall
('INSULATION', 'Insulation', 'Insulation', 'SF', NULL, 'total_sf', 0.001, 'rough'),
('DRYWALL_HANG', 'Drywall Hanging', 'Drywall', 'SF', NULL, 'drywall_sf', 0.002, 'finish'),
('DRYWALL_FINISH', 'Drywall Finishing', 'Drywall', 'SF', NULL, 'drywall_sf', 0.003, 'finish'),

-- Interior Finishes
('PAINT_INTERIOR', 'Interior Painting', 'Painting', 'SF', NULL, 'paint_sf', 0.001, 'finish'),
('TRIM_CARPENTRY', 'Trim & Millwork', 'Trim', 'LF', NULL, 'linear_ft_trim', 0.01, 'finish'),
('INTERIOR_DOORS', 'Interior Doors', 'Doors', 'EA', NULL, 'door_count', 0.3, 'finish'),
('CABINETS', 'Cabinet Installation', 'Cabinets', 'ROOM', 'EA', 'bathroom_count', 1.5, 'finish'),

-- Flooring
('TILE', 'Tile Installation', 'Tile', 'SF', 'ROOM', 'tile_sf', 0.015, 'finish'),
('HARDWOOD', 'Hardwood Flooring', 'Flooring', 'SF', NULL, 'hardwood_sf', 0.008, 'finish'),
('CARPET', 'Carpet Installation', 'Flooring', 'SF', NULL, 'carpet_sf', 0.003, 'finish'),

-- Mechanicals - Finish
('PLUMBING_FINISH', 'Plumbing Trim & Fixtures', 'Plumbing', 'FIXTURE', NULL, 'plumbing_fixture_count', 0.3, 'finish'),
('ELECTRICAL_FINISH', 'Electrical Trim & Fixtures', 'Electrical', 'EA', NULL, 'electrical_fixture_count', 0.1, 'finish'),
('HVAC_FINISH', 'HVAC Trim & Startup', 'HVAC', 'ZONE', NULL, 'hvac_zone_count', 0.5, 'finish')

ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- PART 3: SCOPE TRACKING ON POs (What scope is each PO for?)
-- ============================================================================

-- Link POs to scope categories
ALTER TABLE v2_purchase_orders
  ADD COLUMN IF NOT EXISTS scope_category_id UUID REFERENCES v2_scope_categories(id),
  ADD COLUMN IF NOT EXISTS scope_quantity DECIMAL(12,2),      -- Quantity for this PO
  ADD COLUMN IF NOT EXISTS scope_unit TEXT,                   -- Unit (SF, EA, etc.)
  ADD COLUMN IF NOT EXISTS estimated_days INTEGER,            -- Estimated working days
  ADD COLUMN IF NOT EXISTS actual_start_date DATE,
  ADD COLUMN IF NOT EXISTS actual_end_date DATE,
  ADD COLUMN IF NOT EXISTS actual_working_days INTEGER;       -- Calculated from daily logs

-- ============================================================================
-- PART 4: DAILY LOG ENHANCEMENTS (Track work against scope)
-- ============================================================================

-- Add scope tracking to crew entries
ALTER TABLE v2_daily_log_crew
  ADD COLUMN IF NOT EXISTS scope_category_id UUID REFERENCES v2_scope_categories(id),
  ADD COLUMN IF NOT EXISTS quantity_completed DECIMAL(12,2),  -- How much they did today
  ADD COLUMN IF NOT EXISTS quantity_unit TEXT,                -- SF, LF, EA, etc.
  ADD COLUMN IF NOT EXISTS is_work_day BOOLEAN DEFAULT true,  -- Count toward duration?
  ADD COLUMN IF NOT EXISTS expected_workers INTEGER,
  ADD COLUMN IF NOT EXISTS work_quality TEXT CHECK (work_quality IN ('good', 'acceptable', 'needs_rework')),
  ADD COLUMN IF NOT EXISTS ready_for_next_trade BOOLEAN DEFAULT false;

-- ============================================================================
-- PART 5: PERFORMANCE TRACKING (Calculated metrics)
-- ============================================================================

-- Completed scope performance (one record per PO when work is done)
CREATE TABLE IF NOT EXISTS v2_scope_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was done
  job_id UUID REFERENCES v2_jobs(id) NOT NULL,
  po_id UUID REFERENCES v2_purchase_orders(id),
  vendor_id UUID REFERENCES v2_vendors(id) NOT NULL,
  scope_category_id UUID REFERENCES v2_scope_categories(id) NOT NULL,

  -- Scope details
  scope_quantity DECIMAL(12,2) NOT NULL,    -- Total quantity (e.g., 1500 SF)
  scope_unit TEXT NOT NULL,                 -- SF, LF, EA, etc.

  -- Job context (for normalization)
  job_total_sf INTEGER,
  job_complexity TEXT,

  -- Time tracking
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  calendar_days INTEGER NOT NULL,           -- End - Start
  working_days INTEGER NOT NULL,            -- Days crew actually worked
  weather_delay_days INTEGER DEFAULT 0,
  other_delay_days INTEGER DEFAULT 0,

  -- Crew info
  avg_workers DECIMAL(5,2),                 -- Average crew size
  total_labor_hours DECIMAL(10,2),          -- Workers × Hours summed

  -- Cost info
  po_amount DECIMAL(12,2),
  actual_cost DECIMAL(12,2),

  -- CALCULATED METRICS
  days_per_unit DECIMAL(10,6),              -- working_days / scope_quantity
  cost_per_unit DECIMAL(10,4),              -- po_amount / scope_quantity
  hours_per_unit DECIMAL(10,4),             -- total_labor_hours / scope_quantity

  -- Quality
  inspection_passed BOOLEAN,
  rework_required BOOLEAN DEFAULT false,
  quality_score DECIMAL(5,2),               -- 0-100

  -- Comparison to baseline
  baseline_days DECIMAL(10,2),              -- Expected based on baseline rate
  variance_days DECIMAL(10,2),              -- actual - expected
  variance_percent DECIMAL(8,2),            -- (actual - expected) / expected * 100

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(job_id, po_id, scope_category_id)
);

-- ============================================================================
-- PART 6: AGGREGATED BENCHMARKS (Category and Vendor averages)
-- ============================================================================

-- Trade category benchmarks (updated nightly from all completed work)
CREATE TABLE IF NOT EXISTS v2_category_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  scope_category_id UUID REFERENCES v2_scope_categories(id) NOT NULL,

  -- Sample info
  sample_count INTEGER NOT NULL,            -- How many completed scopes
  total_quantity DECIMAL(14,2),             -- Total units across all samples

  -- Averages
  avg_days_per_unit DECIMAL(10,6),
  avg_cost_per_unit DECIMAL(10,4),
  avg_hours_per_unit DECIMAL(10,4),
  avg_workers DECIMAL(5,2),

  -- Ranges
  min_days_per_unit DECIMAL(10,6),
  max_days_per_unit DECIMAL(10,6),
  stddev_days_per_unit DECIMAL(10,6),

  -- Percentiles for estimation
  p25_days_per_unit DECIMAL(10,6),          -- Optimistic
  p50_days_per_unit DECIMAL(10,6),          -- Expected
  p75_days_per_unit DECIMAL(10,6),          -- Conservative

  -- Quality
  avg_quality_score DECIMAL(5,2),
  rework_rate DECIMAL(5,2),                 -- % requiring rework

  last_calculated TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(scope_category_id)
);

-- Vendor benchmarks (per vendor, per scope category)
CREATE TABLE IF NOT EXISTS v2_vendor_benchmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  vendor_id UUID REFERENCES v2_vendors(id) NOT NULL,
  scope_category_id UUID REFERENCES v2_scope_categories(id) NOT NULL,

  -- Sample info
  sample_count INTEGER NOT NULL,
  total_quantity DECIMAL(14,2),

  -- Performance metrics
  avg_days_per_unit DECIMAL(10,6),
  avg_cost_per_unit DECIMAL(10,4),
  avg_hours_per_unit DECIMAL(10,4),
  avg_workers DECIMAL(5,2),

  -- Reliability
  on_time_rate DECIMAL(5,2),                -- % completed within estimated days
  show_up_rate DECIMAL(5,2),                -- % of scheduled days they showed

  -- Quality
  avg_quality_score DECIMAL(5,2),
  rework_rate DECIMAL(5,2),
  inspection_pass_rate DECIMAL(5,2),

  -- Comparison to category average
  speed_vs_category DECIMAL(8,2),           -- % faster/slower than category avg
  cost_vs_category DECIMAL(8,2),            -- % cheaper/more expensive

  -- Overall scores (0-100)
  efficiency_score DECIMAL(5,2),
  reliability_score DECIMAL(5,2),
  quality_score DECIMAL(5,2),
  value_score DECIMAL(5,2),                 -- Efficiency × Quality / Cost
  overall_score DECIMAL(5,2),               -- Weighted composite

  last_calculated TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(vendor_id, scope_category_id)
);

-- ============================================================================
-- PART 7: ESTIMATION HELPERS (For auto-scheduling)
-- ============================================================================

-- View: Get estimated days for a scope at a job
CREATE OR REPLACE VIEW v2_scope_estimates AS
SELECT
  j.id as job_id,
  j.name as job_name,
  sc.id as scope_category_id,
  sc.code as scope_code,
  sc.name as scope_name,
  sc.trade,
  sc.primary_unit,
  js.total_sf as job_sf,

  -- Get quantity from job specs based on scope category's field
  CASE sc.job_spec_field
    WHEN 'total_sf' THEN js.total_sf
    WHEN 'tile_sf' THEN js.tile_sf
    WHEN 'hardwood_sf' THEN js.hardwood_sf
    WHEN 'carpet_sf' THEN js.carpet_sf
    WHEN 'drywall_sf' THEN js.drywall_sf
    WHEN 'paint_sf' THEN js.paint_sf
    WHEN 'bathroom_count' THEN js.bathroom_count
    WHEN 'plumbing_fixture_count' THEN js.plumbing_fixture_count
    WHEN 'window_count' THEN js.window_count
    WHEN 'door_count' THEN js.door_count
    WHEN 'exterior_door_count' THEN js.exterior_door_count
    WHEN 'roofing_squares' THEN js.roofing_squares
    WHEN 'exterior_siding_sf' THEN js.exterior_siding_sf
    WHEN 'linear_ft_trim' THEN js.linear_ft_trim
    WHEN 'hvac_tonnage' THEN js.hvac_tonnage
    WHEN 'hvac_zone_count' THEN js.hvac_zone_count
    WHEN 'garage_sf' THEN js.garage_sf
    WHEN 'electrical_fixture_count' THEN js.electrical_fixture_count
  END as scope_quantity,

  -- Estimation rates (prefer category benchmark, fall back to baseline)
  COALESCE(cb.p50_days_per_unit, sc.baseline_days_per_unit) as days_per_unit,
  COALESCE(cb.p25_days_per_unit, sc.baseline_days_per_unit * 0.8) as optimistic_rate,
  COALESCE(cb.p75_days_per_unit, sc.baseline_days_per_unit * 1.2) as conservative_rate,

  -- Estimated days
  ROUND(
    CASE sc.job_spec_field
      WHEN 'total_sf' THEN js.total_sf
      WHEN 'tile_sf' THEN js.tile_sf
      WHEN 'hardwood_sf' THEN js.hardwood_sf
      -- ... etc (same as above)
      ELSE 0
    END * COALESCE(cb.p50_days_per_unit, sc.baseline_days_per_unit)
  , 1) as estimated_days,

  cb.sample_count as data_points

FROM v2_jobs j
JOIN v2_job_specifications js ON js.job_id = j.id
CROSS JOIN v2_scope_categories sc
LEFT JOIN v2_category_benchmarks cb ON cb.scope_category_id = sc.id
WHERE sc.is_active = true;

-- ============================================================================
-- PART 8: FUNCTIONS FOR CALCULATIONS
-- ============================================================================

-- Function: Calculate performance metrics when a scope is completed
CREATE OR REPLACE FUNCTION calculate_scope_performance(p_po_id UUID)
RETURNS UUID AS $$
DECLARE
  v_record_id UUID;
  v_job_id UUID;
  v_vendor_id UUID;
  v_scope_category_id UUID;
  v_scope_quantity DECIMAL;
  v_scope_unit TEXT;
  v_start_date DATE;
  v_end_date DATE;
  v_working_days INTEGER;
  v_total_hours DECIMAL;
  v_avg_workers DECIMAL;
  v_baseline_rate DECIMAL;
  v_baseline_days DECIMAL;
BEGIN
  -- Get PO details
  SELECT
    po.job_id, po.vendor_id, po.scope_category_id,
    po.scope_quantity, po.scope_unit,
    po.actual_start_date, po.actual_end_date
  INTO v_job_id, v_vendor_id, v_scope_category_id, v_scope_quantity, v_scope_unit, v_start_date, v_end_date
  FROM v2_purchase_orders po
  WHERE po.id = p_po_id;

  -- Count working days from daily logs
  SELECT
    COUNT(DISTINCT dl.log_date),
    SUM(dlc.worker_count * COALESCE(dlc.hours_worked, 8)),
    AVG(dlc.worker_count)
  INTO v_working_days, v_total_hours, v_avg_workers
  FROM v2_daily_logs dl
  JOIN v2_daily_log_crew dlc ON dlc.daily_log_id = dl.id
  WHERE dlc.po_id = p_po_id
    AND dlc.is_work_day = true
    AND dl.deleted_at IS NULL;

  -- Get baseline rate
  SELECT baseline_days_per_unit INTO v_baseline_rate
  FROM v2_scope_categories WHERE id = v_scope_category_id;

  v_baseline_days := v_scope_quantity * COALESCE(v_baseline_rate, 0.01);

  -- Insert performance record
  INSERT INTO v2_scope_performance (
    job_id, po_id, vendor_id, scope_category_id,
    scope_quantity, scope_unit,
    start_date, end_date,
    calendar_days, working_days,
    avg_workers, total_labor_hours,
    po_amount,
    days_per_unit, cost_per_unit, hours_per_unit,
    baseline_days, variance_days, variance_percent
  )
  SELECT
    v_job_id, p_po_id, v_vendor_id, v_scope_category_id,
    v_scope_quantity, v_scope_unit,
    v_start_date, v_end_date,
    (v_end_date - v_start_date), v_working_days,
    v_avg_workers, v_total_hours,
    po.total_amount,
    v_working_days::DECIMAL / NULLIF(v_scope_quantity, 0),
    po.total_amount / NULLIF(v_scope_quantity, 0),
    v_total_hours / NULLIF(v_scope_quantity, 0),
    v_baseline_days,
    v_working_days - v_baseline_days,
    ((v_working_days - v_baseline_days) / NULLIF(v_baseline_days, 0)) * 100
  FROM v2_purchase_orders po
  WHERE po.id = p_po_id
  RETURNING id INTO v_record_id;

  RETURN v_record_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Recalculate category benchmarks
CREATE OR REPLACE FUNCTION recalculate_category_benchmarks(p_scope_category_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
  INSERT INTO v2_category_benchmarks (
    scope_category_id,
    sample_count, total_quantity,
    avg_days_per_unit, avg_cost_per_unit, avg_hours_per_unit, avg_workers,
    min_days_per_unit, max_days_per_unit, stddev_days_per_unit,
    p25_days_per_unit, p50_days_per_unit, p75_days_per_unit,
    avg_quality_score, rework_rate,
    last_calculated
  )
  SELECT
    scope_category_id,
    COUNT(*),
    SUM(scope_quantity),
    AVG(days_per_unit),
    AVG(cost_per_unit),
    AVG(hours_per_unit),
    AVG(avg_workers),
    MIN(days_per_unit),
    MAX(days_per_unit),
    STDDEV(days_per_unit),
    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY days_per_unit),
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY days_per_unit),
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY days_per_unit),
    AVG(quality_score),
    AVG(CASE WHEN rework_required THEN 1 ELSE 0 END) * 100,
    NOW()
  FROM v2_scope_performance
  WHERE (p_scope_category_id IS NULL OR scope_category_id = p_scope_category_id)
  GROUP BY scope_category_id
  ON CONFLICT (scope_category_id) DO UPDATE SET
    sample_count = EXCLUDED.sample_count,
    total_quantity = EXCLUDED.total_quantity,
    avg_days_per_unit = EXCLUDED.avg_days_per_unit,
    avg_cost_per_unit = EXCLUDED.avg_cost_per_unit,
    avg_hours_per_unit = EXCLUDED.avg_hours_per_unit,
    avg_workers = EXCLUDED.avg_workers,
    min_days_per_unit = EXCLUDED.min_days_per_unit,
    max_days_per_unit = EXCLUDED.max_days_per_unit,
    stddev_days_per_unit = EXCLUDED.stddev_days_per_unit,
    p25_days_per_unit = EXCLUDED.p25_days_per_unit,
    p50_days_per_unit = EXCLUDED.p50_days_per_unit,
    p75_days_per_unit = EXCLUDED.p75_days_per_unit,
    avg_quality_score = EXCLUDED.avg_quality_score,
    rework_rate = EXCLUDED.rework_rate,
    last_calculated = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Recalculate vendor benchmarks
CREATE OR REPLACE FUNCTION recalculate_vendor_benchmarks(p_vendor_id UUID DEFAULT NULL)
RETURNS void AS $$
BEGIN
  INSERT INTO v2_vendor_benchmarks (
    vendor_id, scope_category_id,
    sample_count, total_quantity,
    avg_days_per_unit, avg_cost_per_unit, avg_hours_per_unit, avg_workers,
    avg_quality_score, rework_rate,
    last_calculated
  )
  SELECT
    vendor_id, scope_category_id,
    COUNT(*),
    SUM(scope_quantity),
    AVG(days_per_unit),
    AVG(cost_per_unit),
    AVG(hours_per_unit),
    AVG(avg_workers),
    AVG(quality_score),
    AVG(CASE WHEN rework_required THEN 1 ELSE 0 END) * 100,
    NOW()
  FROM v2_scope_performance
  WHERE (p_vendor_id IS NULL OR vendor_id = p_vendor_id)
  GROUP BY vendor_id, scope_category_id
  ON CONFLICT (vendor_id, scope_category_id) DO UPDATE SET
    sample_count = EXCLUDED.sample_count,
    total_quantity = EXCLUDED.total_quantity,
    avg_days_per_unit = EXCLUDED.avg_days_per_unit,
    avg_cost_per_unit = EXCLUDED.avg_cost_per_unit,
    avg_hours_per_unit = EXCLUDED.avg_hours_per_unit,
    avg_workers = EXCLUDED.avg_workers,
    avg_quality_score = EXCLUDED.avg_quality_score,
    rework_rate = EXCLUDED.rework_rate,
    last_calculated = NOW();

  -- Calculate comparison to category averages
  UPDATE v2_vendor_benchmarks vb
  SET
    speed_vs_category = ((cb.avg_days_per_unit - vb.avg_days_per_unit) / NULLIF(cb.avg_days_per_unit, 0)) * 100,
    cost_vs_category = ((cb.avg_cost_per_unit - vb.avg_cost_per_unit) / NULLIF(cb.avg_cost_per_unit, 0)) * 100
  FROM v2_category_benchmarks cb
  WHERE cb.scope_category_id = vb.scope_category_id
    AND (p_vendor_id IS NULL OR vb.vendor_id = p_vendor_id);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 9: INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_scope_perf_vendor ON v2_scope_performance(vendor_id);
CREATE INDEX IF NOT EXISTS idx_scope_perf_category ON v2_scope_performance(scope_category_id);
CREATE INDEX IF NOT EXISTS idx_scope_perf_job ON v2_scope_performance(job_id);
CREATE INDEX IF NOT EXISTS idx_job_specs_job ON v2_job_specifications(job_id);
CREATE INDEX IF NOT EXISTS idx_po_scope_category ON v2_purchase_orders(scope_category_id);
CREATE INDEX IF NOT EXISTS idx_crew_scope_category ON v2_daily_log_crew(scope_category_id);
CREATE INDEX IF NOT EXISTS idx_vendor_benchmarks_lookup ON v2_vendor_benchmarks(vendor_id, scope_category_id);

-- ============================================================================
-- PART 10: HELPFUL VIEWS
-- ============================================================================

-- View: Vendor comparison for a specific trade
CREATE OR REPLACE VIEW v2_vendor_comparison AS
SELECT
  v.id as vendor_id,
  v.name as vendor_name,
  sc.code as scope_code,
  sc.name as scope_name,
  sc.trade,
  vb.sample_count as jobs_completed,
  vb.avg_days_per_unit,
  vb.avg_cost_per_unit,
  vb.speed_vs_category,
  vb.cost_vs_category,
  vb.avg_quality_score,
  vb.rework_rate,
  cb.avg_days_per_unit as category_avg_days,
  cb.avg_cost_per_unit as category_avg_cost,
  CASE
    WHEN vb.speed_vs_category > 10 THEN 'Faster'
    WHEN vb.speed_vs_category < -10 THEN 'Slower'
    ELSE 'Average'
  END as speed_rating,
  CASE
    WHEN vb.cost_vs_category > 10 THEN 'Cheaper'
    WHEN vb.cost_vs_category < -10 THEN 'Pricier'
    ELSE 'Market Rate'
  END as cost_rating
FROM v2_vendors v
JOIN v2_vendor_benchmarks vb ON vb.vendor_id = v.id
JOIN v2_scope_categories sc ON sc.id = vb.scope_category_id
LEFT JOIN v2_category_benchmarks cb ON cb.scope_category_id = sc.id
ORDER BY sc.trade, vb.avg_quality_score DESC;

-- View: Quick schedule generator data
CREATE OR REPLACE VIEW v2_schedule_generator_data AS
SELECT
  sc.code as scope_code,
  sc.name as scope_name,
  sc.trade,
  sc.phase,
  cb.p50_days_per_unit as expected_rate,
  cb.p25_days_per_unit as optimistic_rate,
  cb.p75_days_per_unit as conservative_rate,
  cb.avg_workers as typical_crew_size,
  cb.sample_count as data_points,
  sc.primary_unit
FROM v2_scope_categories sc
LEFT JOIN v2_category_benchmarks cb ON cb.scope_category_id = sc.id
WHERE sc.is_active = true
ORDER BY
  CASE sc.phase
    WHEN 'sitework' THEN 1
    WHEN 'rough' THEN 2
    WHEN 'finish' THEN 3
  END,
  sc.trade;
