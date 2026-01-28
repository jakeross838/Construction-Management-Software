-- =====================================================
-- PRICE INTELLIGENCE SYSTEM - MATERIAL PRICING
-- =====================================================

-- Master catalog of standardized materials
CREATE TABLE public.v2_master_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  description TEXT,
  category VARCHAR NOT NULL, -- lumber, drywall, tile, plumbing, electrical, etc.
  default_unit VARCHAR NOT NULL DEFAULT 'each', -- SF, LF, board_foot, each, sheet, box, bag
  waste_factor_percent NUMERIC DEFAULT 0, -- lumber 5%, drywall 10%, tile 15%
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Maps vendor-specific descriptions/SKUs to master items
CREATE TABLE public.v2_vendor_item_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_item_id UUID NOT NULL REFERENCES public.v2_master_items(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  vendor_sku VARCHAR,
  vendor_description TEXT NOT NULL,
  unit_conversion_factor NUMERIC DEFAULT 1, -- e.g., if vendor sells in boxes of 10, factor = 10
  vendor_unit VARCHAR, -- vendor's unit of measure
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, vendor_sku)
);

-- Every price point from invoices, quotes, manual entry
CREATE TABLE public.v2_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_item_id UUID NOT NULL REFERENCES public.v2_master_items(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  unit_price NUMERIC NOT NULL,
  unit VARCHAR NOT NULL, -- normalized unit
  quantity NUMERIC DEFAULT 1,
  source_type VARCHAR NOT NULL CHECK (source_type IN ('invoice', 'quote', 'manual', 'catalog')),
  source_id UUID, -- reference to invoice_id, po_id, etc.
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Latest price per item/vendor (maintained via trigger or periodic refresh)
CREATE TABLE public.v2_current_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_item_id UUID NOT NULL REFERENCES public.v2_master_items(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  latest_price NUMERIC NOT NULL,
  unit VARCHAR NOT NULL,
  price_count INTEGER DEFAULT 1, -- number of price points
  avg_price NUMERIC,
  min_price NUMERIC,
  max_price NUMERIC,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(master_item_id, vendor_id)
);

-- Data quality scores
CREATE TABLE public.v2_price_confidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_item_id UUID NOT NULL REFERENCES public.v2_master_items(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  recency_score NUMERIC DEFAULT 0 CHECK (recency_score >= 0 AND recency_score <= 100), -- full <30 days, declining after
  source_score NUMERIC DEFAULT 0 CHECK (source_score >= 0 AND source_score <= 100), -- invoice=100, quote=80, manual=60
  variance_score NUMERIC DEFAULT 0 CHECK (variance_score >= 0 AND variance_score <= 100), -- lower variance = higher score
  overall_confidence NUMERIC GENERATED ALWAYS AS (
    (recency_score * 0.4 + source_score * 0.35 + variance_score * 0.25)
  ) STORED,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(master_item_id, vendor_id)
);

-- =====================================================
-- LABOR PRICING - SUBCONTRACTOR BIDS
-- =====================================================

-- Trades with typical $/SF ranges
CREATE TABLE public.v2_labor_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE,
  description TEXT,
  min_price_per_sf NUMERIC, -- e.g., Framing $8/SF
  max_price_per_sf NUMERIC, -- e.g., Framing $15/SF
  typical_price_per_sf NUMERIC,
  unit VARCHAR DEFAULT 'SF', -- SF, LF, each, hour
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Material/finish options that affect price
CREATE TABLE public.v2_labor_specifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  labor_category_id UUID NOT NULL REFERENCES public.v2_labor_categories(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL, -- e.g., "Level 5 Finish", "Premium Grade"
  description TEXT,
  price_multiplier NUMERIC DEFAULT 1.0, -- Level 5 drywall = 1.35x
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Actual proposals from subs
CREATE TABLE public.v2_labor_bids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  labor_category_id UUID NOT NULL REFERENCES public.v2_labor_categories(id) ON DELETE RESTRICT,
  labor_specification_id UUID REFERENCES public.v2_labor_specifications(id) ON DELETE SET NULL,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE RESTRICT,
  bid_amount NUMERIC NOT NULL,
  square_footage NUMERIC, -- for auto-calculating $/SF
  calculated_per_sf NUMERIC GENERATED ALWAYS AS (
    CASE WHEN square_footage > 0 THEN bid_amount / square_footage ELSE NULL END
  ) STORED,
  scope_description TEXT,
  inclusions JSONB DEFAULT '[]'::jsonb, -- what's included
  exclusions JSONB DEFAULT '[]'::jsonb, -- what's NOT included
  terms TEXT, -- payment terms, warranty, etc.
  is_lowest_bid BOOLEAN DEFAULT false,
  status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'withdrawn')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  valid_until DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Historical performance tracking
CREATE TABLE public.v2_sub_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  labor_category_id UUID REFERENCES public.v2_labor_categories(id) ON DELETE SET NULL,
  jobs_bid INTEGER DEFAULT 0,
  jobs_won INTEGER DEFAULT 0,
  jobs_completed INTEGER DEFAULT 0,
  win_rate NUMERIC GENERATED ALWAYS AS (
    CASE WHEN jobs_bid > 0 THEN (jobs_won::numeric / jobs_bid) * 100 ELSE 0 END
  ) STORED,
  avg_budget_variance NUMERIC DEFAULT 0, -- positive = over budget
  quality_score NUMERIC DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  on_time_rate NUMERIC DEFAULT 0 CHECK (on_time_rate >= 0 AND on_time_rate <= 100),
  last_evaluated TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, labor_category_id)
);

-- =====================================================
-- LABOR PRICING - EMPLOYEE BURDEN
-- =====================================================

-- Burden rate groups
CREATE TABLE public.v2_burden_classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL UNIQUE, -- "Field Crew", "Office Staff", "Management"
  description TEXT,
  fica_rate NUMERIC DEFAULT 7.65, -- FICA (Social Security + Medicare)
  futa_rate NUMERIC DEFAULT 0.6, -- Federal Unemployment
  suta_rate NUMERIC DEFAULT 2.7, -- State Unemployment (varies by state)
  workers_comp_rate NUMERIC DEFAULT 5.0, -- Field ~12%, Office ~1%
  health_insurance_rate NUMERIC DEFAULT 8.0, -- as % of wages
  retirement_match_rate NUMERIC DEFAULT 3.0, -- 401k match
  pto_accrual_rate NUMERIC DEFAULT 4.0, -- PTO/sick time
  other_benefits_rate NUMERIC DEFAULT 0,
  total_burden_rate NUMERIC GENERATED ALWAYS AS (
    fica_rate + futa_rate + suta_rate + workers_comp_rate + 
    health_insurance_rate + retirement_match_rate + pto_accrual_rate + other_benefits_rate
  ) STORED,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Link employees to burden classes (extends existing employees table)
ALTER TABLE public.employees 
  ADD COLUMN IF NOT EXISTS burden_class_id UUID REFERENCES public.v2_burden_classes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS base_hourly_rate NUMERIC,
  ADD COLUMN IF NOT EXISTS burdened_hourly_rate NUMERIC;

-- Audit trail of burden rate changes
CREATE TABLE public.v2_burden_rate_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  burden_class_id UUID NOT NULL REFERENCES public.v2_burden_classes(id) ON DELETE CASCADE,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  previous_total_rate NUMERIC,
  new_total_rate NUMERIC NOT NULL,
  rate_components JSONB, -- snapshot of all component rates
  changed_by VARCHAR,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_v2_master_items_category ON public.v2_master_items(category);
CREATE INDEX idx_v2_master_items_name ON public.v2_master_items(name);
CREATE INDEX idx_v2_vendor_aliases_master ON public.v2_vendor_item_aliases(master_item_id);
CREATE INDEX idx_v2_vendor_aliases_vendor ON public.v2_vendor_item_aliases(vendor_id);
CREATE INDEX idx_v2_price_history_item ON public.v2_price_history(master_item_id);
CREATE INDEX idx_v2_price_history_vendor ON public.v2_price_history(vendor_id);
CREATE INDEX idx_v2_price_history_captured ON public.v2_price_history(captured_at DESC);
CREATE INDEX idx_v2_price_history_source ON public.v2_price_history(source_type);
CREATE INDEX idx_v2_current_prices_item ON public.v2_current_prices(master_item_id);
CREATE INDEX idx_v2_labor_bids_job ON public.v2_labor_bids(job_id);
CREATE INDEX idx_v2_labor_bids_vendor ON public.v2_labor_bids(vendor_id);
CREATE INDEX idx_v2_labor_bids_category ON public.v2_labor_bids(labor_category_id);
CREATE INDEX idx_v2_labor_bids_status ON public.v2_labor_bids(status);
CREATE INDEX idx_v2_sub_performance_vendor ON public.v2_sub_performance(vendor_id);
CREATE INDEX idx_employees_burden_class ON public.employees(burden_class_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE public.v2_master_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_vendor_item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_current_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_price_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_labor_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_labor_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_labor_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_sub_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_burden_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v2_burden_rate_history ENABLE ROW LEVEL SECURITY;

-- Policies for all tables (matching existing app pattern)
CREATE POLICY "v2_master_items_all" ON public.v2_master_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_vendor_item_aliases_all" ON public.v2_vendor_item_aliases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_price_history_all" ON public.v2_price_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_current_prices_all" ON public.v2_current_prices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_price_confidence_all" ON public.v2_price_confidence FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_labor_categories_all" ON public.v2_labor_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_labor_specifications_all" ON public.v2_labor_specifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_labor_bids_all" ON public.v2_labor_bids FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_sub_performance_all" ON public.v2_sub_performance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_burden_classes_all" ON public.v2_burden_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "v2_burden_rate_history_all" ON public.v2_burden_rate_history FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- TRIGGERS FOR updated_at
-- =====================================================

CREATE TRIGGER update_v2_master_items_updated_at BEFORE UPDATE ON public.v2_master_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v2_vendor_item_aliases_updated_at BEFORE UPDATE ON public.v2_vendor_item_aliases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v2_labor_categories_updated_at BEFORE UPDATE ON public.v2_labor_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v2_labor_specifications_updated_at BEFORE UPDATE ON public.v2_labor_specifications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v2_labor_bids_updated_at BEFORE UPDATE ON public.v2_labor_bids
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v2_sub_performance_updated_at BEFORE UPDATE ON public.v2_sub_performance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_v2_burden_classes_updated_at BEFORE UPDATE ON public.v2_burden_classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- SEED DATA - Default Labor Categories & Burden Classes
-- =====================================================

INSERT INTO public.v2_labor_categories (name, description, min_price_per_sf, max_price_per_sf, typical_price_per_sf, sort_order) VALUES
  ('Sitework', 'Site prep, grading, utilities', 2.00, 8.00, 4.50, 1),
  ('Foundation', 'Footings, slabs, stem walls', 8.00, 18.00, 12.00, 2),
  ('Framing', 'Structural framing - wood or steel', 8.00, 15.00, 11.00, 3),
  ('Roofing', 'Roof installation and waterproofing', 3.00, 8.00, 5.00, 4),
  ('Windows & Doors', 'Window and door installation', 2.00, 5.00, 3.50, 5),
  ('Siding/Exterior', 'Exterior cladding and trim', 4.00, 12.00, 7.00, 6),
  ('Plumbing Rough', 'Plumbing rough-in', 4.00, 8.00, 5.50, 7),
  ('Plumbing Finish', 'Fixture installation', 2.00, 5.00, 3.00, 8),
  ('Electrical Rough', 'Electrical rough-in', 4.00, 8.00, 5.50, 9),
  ('Electrical Finish', 'Device and fixture installation', 1.50, 4.00, 2.50, 10),
  ('HVAC Rough', 'Ductwork and equipment rough-in', 4.00, 10.00, 6.50, 11),
  ('HVAC Finish', 'Trim-out and startup', 1.00, 3.00, 1.75, 12),
  ('Insulation', 'Insulation installation', 1.50, 3.50, 2.25, 13),
  ('Drywall', 'Drywall hang, tape, and finish', 1.50, 3.50, 2.25, 14),
  ('Painting', 'Interior/exterior painting', 1.50, 4.00, 2.50, 15),
  ('Flooring', 'Flooring installation', 2.00, 8.00, 4.00, 16),
  ('Tile', 'Tile installation', 8.00, 25.00, 15.00, 17),
  ('Cabinets', 'Cabinet installation', 3.00, 8.00, 5.00, 18),
  ('Countertops', 'Countertop installation', 15.00, 80.00, 40.00, 19),
  ('Trim Carpentry', 'Interior trim and millwork', 3.00, 8.00, 5.00, 20);

-- Drywall finish level specifications
INSERT INTO public.v2_labor_specifications (labor_category_id, name, description, price_multiplier, is_default, sort_order)
SELECT id, 'Level 3 Finish', 'Basic taping - for areas receiving tile or hidden', 0.85, false, 1 FROM public.v2_labor_categories WHERE name = 'Drywall'
UNION ALL
SELECT id, 'Level 4 Finish', 'Standard finish - for flat paint and light textures', 1.00, true, 2 FROM public.v2_labor_categories WHERE name = 'Drywall'
UNION ALL
SELECT id, 'Level 5 Finish', 'Premium finish - for gloss paint and critical lighting', 1.35, false, 3 FROM public.v2_labor_categories WHERE name = 'Drywall';

-- Default burden classes
INSERT INTO public.v2_burden_classes (name, description, fica_rate, futa_rate, suta_rate, workers_comp_rate, health_insurance_rate, retirement_match_rate, pto_accrual_rate) VALUES
  ('Field Crew', 'Field construction workers', 7.65, 0.6, 2.7, 12.0, 8.0, 3.0, 4.0),
  ('Skilled Trades', 'Licensed trades (plumber, electrician)', 7.65, 0.6, 2.7, 8.0, 10.0, 4.0, 5.0),
  ('Supervision', 'Site superintendents and foremen', 7.65, 0.6, 2.7, 6.0, 12.0, 5.0, 6.0),
  ('Office Staff', 'Administrative and office personnel', 7.65, 0.6, 2.7, 1.0, 12.0, 4.0, 6.0),
  ('Management', 'Project managers and executives', 7.65, 0.6, 2.7, 1.0, 15.0, 6.0, 8.0);

-- Default master item categories with waste factors
INSERT INTO public.v2_master_items (name, category, default_unit, waste_factor_percent) VALUES
  ('2x4 Stud 8ft', 'lumber', 'each', 5),
  ('2x6 Stud 8ft', 'lumber', 'each', 5),
  ('2x10x16 Joist', 'lumber', 'each', 5),
  ('2x12x16 Joist', 'lumber', 'each', 5),
  ('3/4" CDX Plywood', 'lumber', 'sheet', 5),
  ('1/2" OSB Sheathing', 'lumber', 'sheet', 5),
  ('1/2" Drywall 4x8', 'drywall', 'sheet', 10),
  ('5/8" Drywall 4x8', 'drywall', 'sheet', 10),
  ('1/2" Moisture Resistant Drywall', 'drywall', 'sheet', 10),
  ('R-19 Batt Insulation', 'insulation', 'SF', 5),
  ('R-30 Batt Insulation', 'insulation', 'SF', 5),
  ('Spray Foam Insulation', 'insulation', 'board_foot', 10),
  ('Architectural Shingle', 'roofing', 'square', 10),
  ('30# Felt Underlayment', 'roofing', 'roll', 10),
  ('12x24 Porcelain Tile', 'tile', 'SF', 15),
  ('3x6 Subway Tile', 'tile', 'SF', 15),
  ('Hardwood Flooring', 'flooring', 'SF', 10),
  ('LVP Flooring', 'flooring', 'SF', 10),
  ('Romex 12/2', 'electrical', 'LF', 5),
  ('Romex 14/2', 'electrical', 'LF', 5),
  ('1/2" PEX Tubing', 'plumbing', 'LF', 5),
  ('3/4" PEX Tubing', 'plumbing', 'LF', 5),
  ('Interior Latex Paint', 'paint', 'gallon', 10),
  ('Exterior Latex Paint', 'paint', 'gallon', 10),
  ('Primer', 'paint', 'gallon', 10);