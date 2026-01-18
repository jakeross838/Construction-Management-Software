-- Migration 044: Price Intelligence System
-- Run this in Supabase SQL Editor
-- Creates tables for vendor price tracking, order optimization, and savings analytics

-- ============================================================
-- 1. MASTER ITEM CATALOG
-- Central catalog of standardized items that grows organically from invoices/quotes
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_master_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  standard_name TEXT NOT NULL,
  standard_unit TEXT NOT NULL,
  dimensions JSONB,
  keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_v2_master_items_category ON v2_master_items(category);
CREATE INDEX IF NOT EXISTS idx_v2_master_items_subcategory ON v2_master_items(subcategory);
CREATE INDEX IF NOT EXISTS idx_v2_master_items_keywords ON v2_master_items USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_v2_master_items_active ON v2_master_items(is_active) WHERE is_active = true;

COMMENT ON TABLE v2_master_items IS 'Master catalog of standardized material items';
COMMENT ON COLUMN v2_master_items.dimensions IS 'JSON with item dimensions: {length, width, thickness, weight, etc}';
COMMENT ON COLUMN v2_master_items.keywords IS 'Array of searchable keywords for matching vendor descriptions';

-- ============================================================
-- 2. VENDOR ITEM ALIASES
-- Maps vendor-specific descriptions to master items
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_vendor_item_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_item_id UUID REFERENCES v2_master_items(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE CASCADE,
  vendor_description TEXT NOT NULL,
  vendor_sku TEXT,
  match_method TEXT DEFAULT 'manual', -- manual, ai, keyword, exact
  confidence DECIMAL(5,4) DEFAULT 1.0,
  times_matched INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_vendor_item_aliases_master ON v2_vendor_item_aliases(master_item_id);
CREATE INDEX IF NOT EXISTS idx_v2_vendor_item_aliases_vendor ON v2_vendor_item_aliases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_vendor_item_aliases_description ON v2_vendor_item_aliases(vendor_description);
CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_vendor_item_aliases_unique ON v2_vendor_item_aliases(vendor_id, vendor_description);

COMMENT ON TABLE v2_vendor_item_aliases IS 'Maps vendor-specific item descriptions/SKUs to master items';
COMMENT ON COLUMN v2_vendor_item_aliases.match_method IS 'How the match was created: manual, ai, keyword, exact';
COMMENT ON COLUMN v2_vendor_item_aliases.confidence IS 'Confidence score of the match (0-1)';

-- ============================================================
-- 3. PRICE HISTORY
-- Every price point captured from invoices, quotes, manual entry
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_item_id UUID REFERENCES v2_master_items(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL, -- invoice, quote, manual, catalog
  source_id UUID, -- Reference to invoice_line_item or quote_item
  unit_price DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  quantity DECIMAL(12,4),
  price_per_each DECIMAL(12,4),
  price_per_lf DECIMAL(12,4),
  price_per_sf DECIMAL(12,4),
  price_per_bf DECIMAL(12,4),
  price_per_sheet DECIMAL(12,4),
  lead_days INTEGER,
  in_stock BOOLEAN,
  price_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_price_history_master ON v2_price_history(master_item_id);
CREATE INDEX IF NOT EXISTS idx_v2_price_history_vendor ON v2_price_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_price_history_date ON v2_price_history(price_date DESC);
CREATE INDEX IF NOT EXISTS idx_v2_price_history_source ON v2_price_history(source_type, source_id);

COMMENT ON TABLE v2_price_history IS 'Historical price data for items from all sources';
COMMENT ON COLUMN v2_price_history.source_type IS 'Where price came from: invoice, quote, manual, catalog';
COMMENT ON COLUMN v2_price_history.price_per_lf IS 'Normalized price per linear foot';
COMMENT ON COLUMN v2_price_history.price_per_sf IS 'Normalized price per square foot';
COMMENT ON COLUMN v2_price_history.price_per_bf IS 'Normalized price per board foot';

-- ============================================================
-- 4. CURRENT PRICES (Materialized View)
-- Fast lookup of latest prices per item/vendor combination
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS v2_current_prices AS
SELECT DISTINCT ON (master_item_id, vendor_id)
  ph.id,
  ph.master_item_id,
  ph.vendor_id,
  ph.source_type,
  ph.unit_price,
  ph.unit,
  ph.price_per_each,
  ph.price_per_lf,
  ph.price_per_sf,
  ph.price_per_bf,
  ph.price_per_sheet,
  ph.lead_days,
  ph.in_stock,
  ph.price_date,
  mi.standard_name,
  mi.category,
  mi.subcategory,
  v.name as vendor_name
FROM v2_price_history ph
JOIN v2_master_items mi ON mi.id = ph.master_item_id
JOIN v2_vendors v ON v.id = ph.vendor_id
WHERE mi.is_active = true
ORDER BY master_item_id, vendor_id, price_date DESC;

CREATE UNIQUE INDEX IF NOT EXISTS idx_v2_current_prices_unique ON v2_current_prices(master_item_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_current_prices_category ON v2_current_prices(category);
CREATE INDEX IF NOT EXISTS idx_v2_current_prices_vendor ON v2_current_prices(vendor_id);

-- ============================================================
-- 5. VENDOR QUOTES
-- Uploaded quote documents for tracking and extraction
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_vendor_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  quote_date DATE,
  expiration_date DATE,
  status TEXT DEFAULT 'pending', -- pending, processed, expired
  items_extracted INTEGER DEFAULT 0,
  total_amount DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_v2_vendor_quotes_vendor ON v2_vendor_quotes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_vendor_quotes_status ON v2_vendor_quotes(status);
CREATE INDEX IF NOT EXISTS idx_v2_vendor_quotes_expiration ON v2_vendor_quotes(expiration_date);

COMMENT ON TABLE v2_vendor_quotes IS 'Uploaded vendor quote documents';

-- ============================================================
-- 6. PRICE CONFIDENCE
-- Data quality scores per item/vendor combination
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_price_confidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_item_id UUID REFERENCES v2_master_items(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE CASCADE,
  invoice_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  manual_count INTEGER DEFAULT 0,
  confidence_score DECIMAL(5,4) DEFAULT 0,
  last_price_date DATE,
  price_variance DECIMAL(12,4), -- Stddev of recent prices
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(master_item_id, vendor_id)
);

CREATE INDEX IF NOT EXISTS idx_v2_price_confidence_master ON v2_price_confidence(master_item_id);
CREATE INDEX IF NOT EXISTS idx_v2_price_confidence_vendor ON v2_price_confidence(vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_price_confidence_score ON v2_price_confidence(confidence_score DESC);

COMMENT ON TABLE v2_price_confidence IS 'Data quality metrics for pricing data';
COMMENT ON COLUMN v2_price_confidence.confidence_score IS 'Calculated score based on recency, source count, variance';

-- ============================================================
-- 7. OPTIMIZED ORDERS
-- Order optimizer sessions and results
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_optimized_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  name TEXT,
  status TEXT DEFAULT 'draft', -- draft, finalized, ordered
  total_input_items INTEGER DEFAULT 0,
  matched_items INTEGER DEFAULT 0,
  unmatched_items INTEGER DEFAULT 0,
  optimized_total DECIMAL(12,2),
  baseline_total DECIMAL(12,2),
  savings_amount DECIMAL(12,2),
  savings_percent DECIMAL(5,2),
  vendor_count INTEGER DEFAULT 0,
  include_waste BOOLEAN DEFAULT true,
  max_lead_days INTEGER,
  budget_limit DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID
);

CREATE INDEX IF NOT EXISTS idx_v2_optimized_orders_job ON v2_optimized_orders(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_optimized_orders_status ON v2_optimized_orders(status);
CREATE INDEX IF NOT EXISTS idx_v2_optimized_orders_created ON v2_optimized_orders(created_at DESC);

COMMENT ON TABLE v2_optimized_orders IS 'Order optimization sessions';

-- ============================================================
-- 8. ORDER LINE ITEMS
-- Individual items within an optimized order
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  optimized_order_id UUID REFERENCES v2_optimized_orders(id) ON DELETE CASCADE,
  input_description TEXT NOT NULL,
  input_quantity DECIMAL(12,4) NOT NULL,
  input_unit TEXT,
  master_item_id UUID REFERENCES v2_master_items(id) ON DELETE SET NULL,
  match_confidence DECIMAL(5,4),
  match_method TEXT,
  recommended_vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  recommended_price DECIMAL(12,4),
  all_vendor_prices JSONB, -- [{vendor_id, vendor_name, unit_price, total_price, lead_days, in_stock}]
  waste_factor DECIMAL(5,4) DEFAULT 0,
  quantity_with_waste DECIMAL(12,4),
  extended_price DECIMAL(12,2),
  baseline_price DECIMAL(12,2),
  savings DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_order_line_items_order ON v2_order_line_items(optimized_order_id);
CREATE INDEX IF NOT EXISTS idx_v2_order_line_items_master ON v2_order_line_items(master_item_id);
CREATE INDEX IF NOT EXISTS idx_v2_order_line_items_vendor ON v2_order_line_items(recommended_vendor_id);

COMMENT ON TABLE v2_order_line_items IS 'Line items in an optimization session';
COMMENT ON COLUMN v2_order_line_items.all_vendor_prices IS 'JSON array of all vendor price options for this item';

-- ============================================================
-- 9. SAVINGS LOG
-- Historical savings tracking
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_savings_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE SET NULL,
  optimized_order_id UUID REFERENCES v2_optimized_orders(id) ON DELETE SET NULL,
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE SET NULL,
  order_date DATE NOT NULL,
  total_spent DECIMAL(12,2) NOT NULL,
  baseline_cost DECIMAL(12,2) NOT NULL,
  savings_amount DECIMAL(12,2) NOT NULL,
  savings_percent DECIMAL(5,2),
  savings_by_category JSONB, -- {category: {spent, baseline, savings}}
  savings_by_vendor JSONB, -- {vendor_id: {spent, savings}}
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_savings_log_job ON v2_savings_log(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_savings_log_date ON v2_savings_log(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_v2_savings_log_order ON v2_savings_log(optimized_order_id);

COMMENT ON TABLE v2_savings_log IS 'Historical record of savings achieved';

-- ============================================================
-- 10. WASTE FACTORS
-- Default waste percentages by material category
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_waste_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  default_waste_percent DECIMAL(5,2) NOT NULL,
  min_waste_percent DECIMAL(5,2),
  max_waste_percent DECIMAL(5,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, subcategory)
);

CREATE INDEX IF NOT EXISTS idx_v2_waste_factors_category ON v2_waste_factors(category);

COMMENT ON TABLE v2_waste_factors IS 'Standard waste factors by material category';

-- ============================================================
-- VENDOR TABLE ENHANCEMENTS
-- Add delivery and lead time fields
-- ============================================================

ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2);
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS free_delivery_minimum DECIMAL(10,2);
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS typical_lead_days INTEGER;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS rush_available BOOLEAN DEFAULT false;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS rush_lead_days INTEGER;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS rush_fee DECIMAL(10,2);
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2);

-- ============================================================
-- SEED DATA: Common Waste Factors
-- ============================================================

INSERT INTO v2_waste_factors (category, subcategory, default_waste_percent, min_waste_percent, max_waste_percent, notes)
VALUES
  ('Lumber', NULL, 5.00, 3.00, 10.00, 'General lumber framing'),
  ('Lumber', 'Studs', 3.00, 2.00, 5.00, 'Pre-cut studs, lower waste'),
  ('Lumber', 'Trim', 10.00, 5.00, 15.00, 'Higher waste for mitered cuts'),
  ('Lumber', 'Decking', 7.00, 5.00, 10.00, 'Depends on deck layout'),
  ('Plywood', NULL, 5.00, 3.00, 8.00, 'Sheet goods'),
  ('Plywood', 'Subfloor', 5.00, 3.00, 7.00, 'Standard subfloor'),
  ('Plywood', 'Sheathing', 5.00, 3.00, 7.00, 'Wall sheathing'),
  ('Drywall', NULL, 10.00, 7.00, 15.00, 'Standard gypsum board'),
  ('Drywall', 'Ceiling', 12.00, 10.00, 15.00, 'More cuts for fixtures'),
  ('Insulation', NULL, 5.00, 3.00, 8.00, 'Batt insulation'),
  ('Insulation', 'Blown', 8.00, 5.00, 12.00, 'Blown-in settling factor'),
  ('Roofing', 'Shingles', 10.00, 8.00, 15.00, 'Hip/valley cuts'),
  ('Roofing', 'Metal', 5.00, 3.00, 8.00, 'Panel roofing'),
  ('Roofing', 'Underlayment', 5.00, 3.00, 8.00, 'Felt/synthetic'),
  ('Siding', NULL, 7.00, 5.00, 10.00, 'Vinyl/fiber cement'),
  ('Siding', 'Lap', 10.00, 7.00, 15.00, 'More corner cuts'),
  ('Flooring', 'Hardwood', 10.00, 7.00, 15.00, 'Direction changes'),
  ('Flooring', 'Tile', 15.00, 10.00, 20.00, 'Cuts and breakage'),
  ('Flooring', 'LVP', 10.00, 7.00, 12.00, 'Click-lock vinyl'),
  ('Flooring', 'Carpet', 8.00, 5.00, 12.00, 'Seam planning'),
  ('Concrete', NULL, 5.00, 3.00, 8.00, 'Ready-mix'),
  ('Concrete', 'Block', 5.00, 3.00, 8.00, 'CMU'),
  ('Electrical', 'Wire', 10.00, 8.00, 15.00, 'Home runs'),
  ('Electrical', 'Conduit', 5.00, 3.00, 8.00, 'EMT/PVC'),
  ('Plumbing', 'Pipe', 8.00, 5.00, 12.00, 'Copper/PEX'),
  ('Plumbing', 'Fittings', 5.00, 3.00, 8.00, 'Extra fittings'),
  ('HVAC', 'Ductwork', 10.00, 7.00, 15.00, 'Custom fitting'),
  ('Paint', NULL, 10.00, 8.00, 15.00, 'Coverage variance'),
  ('Hardware', NULL, 3.00, 2.00, 5.00, 'Fasteners, misc'),
  ('Windows', NULL, 0.00, 0.00, 0.00, 'Ordered to size'),
  ('Doors', NULL, 0.00, 0.00, 0.00, 'Ordered to size'),
  ('Cabinets', NULL, 0.00, 0.00, 0.00, 'Ordered to plan')
ON CONFLICT (category, subcategory) DO UPDATE SET
  default_waste_percent = EXCLUDED.default_waste_percent,
  min_waste_percent = EXCLUDED.min_waste_percent,
  max_waste_percent = EXCLUDED.max_waste_percent,
  notes = EXCLUDED.notes,
  updated_at = NOW();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to refresh current prices view
CREATE OR REPLACE FUNCTION refresh_current_prices()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v2_current_prices;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate price confidence score
CREATE OR REPLACE FUNCTION calculate_price_confidence(
  p_invoice_count INTEGER,
  p_quote_count INTEGER,
  p_manual_count INTEGER,
  p_last_price_date DATE,
  p_price_variance DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  source_score DECIMAL;
  recency_score DECIMAL;
  variance_score DECIMAL;
  days_old INTEGER;
BEGIN
  -- Source score: invoices worth most, then quotes, then manual
  source_score := LEAST(1.0, (p_invoice_count * 0.4 + p_quote_count * 0.3 + p_manual_count * 0.1));

  -- Recency score: full score if <30 days, declining after
  days_old := COALESCE(CURRENT_DATE - p_last_price_date, 365);
  recency_score := GREATEST(0, 1.0 - (days_old::DECIMAL / 180.0));

  -- Variance score: lower variance = higher score
  variance_score := CASE
    WHEN p_price_variance IS NULL THEN 0.5
    WHEN p_price_variance < 0.05 THEN 1.0
    WHEN p_price_variance < 0.15 THEN 0.8
    WHEN p_price_variance < 0.30 THEN 0.5
    ELSE 0.2
  END;

  -- Combined score (weighted average)
  RETURN ROUND((source_score * 0.4 + recency_score * 0.4 + variance_score * 0.2)::DECIMAL, 4);
END;
$$ LANGUAGE plpgsql;

-- Function to update price confidence after new price entry
CREATE OR REPLACE FUNCTION update_price_confidence()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO v2_price_confidence (master_item_id, vendor_id, invoice_count, quote_count, manual_count, last_price_date)
  VALUES (NEW.master_item_id, NEW.vendor_id, 0, 0, 0, NEW.price_date)
  ON CONFLICT (master_item_id, vendor_id) DO UPDATE SET
    invoice_count = CASE WHEN NEW.source_type = 'invoice' THEN v2_price_confidence.invoice_count + 1 ELSE v2_price_confidence.invoice_count END,
    quote_count = CASE WHEN NEW.source_type = 'quote' THEN v2_price_confidence.quote_count + 1 ELSE v2_price_confidence.quote_count END,
    manual_count = CASE WHEN NEW.source_type = 'manual' THEN v2_price_confidence.manual_count + 1 ELSE v2_price_confidence.manual_count END,
    last_price_date = GREATEST(v2_price_confidence.last_price_date, NEW.price_date),
    updated_at = NOW();

  -- Update confidence score
  UPDATE v2_price_confidence pc SET
    confidence_score = calculate_price_confidence(
      pc.invoice_count, pc.quote_count, pc.manual_count, pc.last_price_date, pc.price_variance
    )
  WHERE pc.master_item_id = NEW.master_item_id AND pc.vendor_id = NEW.vendor_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_price_history_confidence
AFTER INSERT ON v2_price_history
FOR EACH ROW EXECUTE FUNCTION update_price_confidence();

-- ============================================================
-- VIEWS FOR ANALYTICS
-- ============================================================

-- Vendor spend summary view
CREATE OR REPLACE VIEW v_vendor_spend_summary AS
SELECT
  v.id as vendor_id,
  v.name as vendor_name,
  COUNT(DISTINCT i.id) as invoice_count,
  COUNT(DISTINCT po.id) as po_count,
  SUM(i.amount) as total_invoiced,
  SUM(CASE WHEN i.invoice_date >= CURRENT_DATE - INTERVAL '30 days' THEN i.amount ELSE 0 END) as spend_30_days,
  SUM(CASE WHEN i.invoice_date >= CURRENT_DATE - INTERVAL '90 days' THEN i.amount ELSE 0 END) as spend_90_days,
  SUM(CASE WHEN i.invoice_date >= DATE_TRUNC('year', CURRENT_DATE) THEN i.amount ELSE 0 END) as spend_ytd
FROM v2_vendors v
LEFT JOIN v2_invoices i ON i.vendor_id = v.id AND i.deleted_at IS NULL
LEFT JOIN v2_purchase_orders po ON po.vendor_id = v.id AND po.deleted_at IS NULL
GROUP BY v.id, v.name;

-- Category spend summary view
CREATE OR REPLACE VIEW v_category_spend_summary AS
SELECT
  mi.category,
  mi.subcategory,
  COUNT(DISTINCT ph.vendor_id) as vendor_count,
  COUNT(DISTINCT mi.id) as item_count,
  AVG(cp.unit_price) as avg_price,
  MIN(cp.unit_price) as min_price,
  MAX(cp.unit_price) as max_price,
  STDDEV(cp.unit_price) as price_stddev
FROM v2_master_items mi
LEFT JOIN v2_current_prices cp ON cp.master_item_id = mi.id
LEFT JOIN v2_price_history ph ON ph.master_item_id = mi.id
WHERE mi.is_active = true
GROUP BY mi.category, mi.subcategory;

-- ============================================================
-- GRANTS (if using RLS)
-- ============================================================

-- Enable RLS on new tables
ALTER TABLE v2_master_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_vendor_item_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_vendor_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_price_confidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_optimized_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_order_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_savings_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_waste_factors ENABLE ROW LEVEL SECURITY;

-- Permissive policies (adjust based on your auth setup)
CREATE POLICY "Allow all for v2_master_items" ON v2_master_items FOR ALL USING (true);
CREATE POLICY "Allow all for v2_vendor_item_aliases" ON v2_vendor_item_aliases FOR ALL USING (true);
CREATE POLICY "Allow all for v2_price_history" ON v2_price_history FOR ALL USING (true);
CREATE POLICY "Allow all for v2_vendor_quotes" ON v2_vendor_quotes FOR ALL USING (true);
CREATE POLICY "Allow all for v2_price_confidence" ON v2_price_confidence FOR ALL USING (true);
CREATE POLICY "Allow all for v2_optimized_orders" ON v2_optimized_orders FOR ALL USING (true);
CREATE POLICY "Allow all for v2_order_line_items" ON v2_order_line_items FOR ALL USING (true);
CREATE POLICY "Allow all for v2_savings_log" ON v2_savings_log FOR ALL USING (true);
CREATE POLICY "Allow all for v2_waste_factors" ON v2_waste_factors FOR ALL USING (true);
