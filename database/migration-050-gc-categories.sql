-- Migration 050: Add GC-Relevant Categories (Trim, Decking)
-- Adds Trim and Decking categories with sample items for GC price tracking

-- ============================================================
-- ADD TRIM ITEMS
-- ============================================================

INSERT INTO v2_master_items (id, category, subcategory, standard_name, standard_unit, keywords, is_active) VALUES
-- Exterior Trim
('11111111-1111-1111-1111-000000000080', 'Trim', 'Exterior', '1x4x16 PVC Trim Board', 'lf', ARRAY['pvc', 'trim', 'azek', 'exterior'], true),
('11111111-1111-1111-1111-000000000081', 'Trim', 'Exterior', '1x6x16 PVC Trim Board', 'lf', ARRAY['pvc', 'trim', 'azek', 'exterior'], true),
('11111111-1111-1111-1111-000000000082', 'Trim', 'Exterior', '1x8x16 PVC Trim Board', 'lf', ARRAY['pvc', 'trim', 'azek', 'exterior'], true),
('11111111-1111-1111-1111-000000000083', 'Trim', 'Exterior', '5/4x6x16 PVC Trim Board', 'lf', ARRAY['pvc', 'trim', 'azek', 'exterior', '5/4'], true),
-- Fascia & Soffit
('11111111-1111-1111-1111-000000000084', 'Trim', 'Fascia', '1x6x16 Primed Fascia', 'lf', ARRAY['fascia', 'primed', 'exterior'], true),
('11111111-1111-1111-1111-000000000085', 'Trim', 'Fascia', '1x8x16 Primed Fascia', 'lf', ARRAY['fascia', 'primed', 'exterior'], true),
('11111111-1111-1111-1111-000000000086', 'Trim', 'Soffit', '12" Vinyl Soffit Panel', 'lf', ARRAY['soffit', 'vinyl', 'vented'], true),
-- Interior Trim
('11111111-1111-1111-1111-000000000087', 'Trim', 'Interior', '3-1/4" Colonial Casing', 'lf', ARRAY['casing', 'colonial', 'door', 'window'], true),
('11111111-1111-1111-1111-000000000088', 'Trim', 'Interior', '5-1/4" Colonial Base', 'lf', ARRAY['baseboard', 'colonial', 'base'], true),
('11111111-1111-1111-1111-000000000089', 'Trim', 'Interior', '2-1/4" Chair Rail', 'lf', ARRAY['chair rail', 'moulding'], true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADD DECKING ITEMS
-- ============================================================

INSERT INTO v2_master_items (id, category, subcategory, standard_name, standard_unit, keywords, is_active) VALUES
-- Composite Decking
('11111111-1111-1111-1111-000000000090', 'Decking', 'Composite', 'Trex Select 1x6x16 Grooved', 'lf', ARRAY['trex', 'composite', 'grooved'], true),
('11111111-1111-1111-1111-000000000091', 'Decking', 'Composite', 'Trex Enhance 1x6x16 Grooved', 'lf', ARRAY['trex', 'composite', 'enhance'], true),
('11111111-1111-1111-1111-000000000092', 'Decking', 'Composite', 'TimberTech Pro 1x6x16', 'lf', ARRAY['timbertech', 'composite'], true),
-- PT Decking
('11111111-1111-1111-1111-000000000093', 'Decking', 'Pressure Treated', '5/4x6x16 PT Decking', 'lf', ARRAY['pressure treated', 'pt', 'deck board'], true),
('11111111-1111-1111-1111-000000000094', 'Decking', 'Pressure Treated', '2x6x16 PT Decking', 'lf', ARRAY['pressure treated', 'pt', 'deck board'], true),
('11111111-1111-1111-1111-000000000095', 'Decking', 'Pressure Treated', '2x8x16 PT Joist', 'ea', ARRAY['pressure treated', 'pt', 'joist'], true),
('11111111-1111-1111-1111-000000000096', 'Decking', 'Pressure Treated', '4x4x8 PT Post', 'ea', ARRAY['pressure treated', 'pt', 'post'], true),
-- Deck Hardware
('11111111-1111-1111-1111-000000000097', 'Decking', 'Hardware', 'Hidden Deck Fastener 90ct', 'box', ARRAY['hidden fastener', 'clip', 'composite'], true),
('11111111-1111-1111-1111-000000000098', 'Decking', 'Hardware', 'Deck Screw Brown 5# Box', 'box', ARRAY['deck screw', 'composite', 'brown'], true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- ADD WASTE FACTORS FOR NEW CATEGORIES
-- ============================================================

INSERT INTO v2_waste_factors (category, subcategory, default_waste_percent, notes) VALUES
('Trim', 'Exterior', 10, 'Cuts at corners and openings'),
('Trim', 'Fascia', 8, 'Long runs, fewer cuts'),
('Trim', 'Soffit', 8, 'Similar to fascia'),
('Trim', 'Interior', 12, 'More cuts for doors and windows'),
('Decking', 'Composite', 10, 'End cuts and board layout'),
('Decking', 'Pressure Treated', 10, 'Similar to composite'),
('Decking', 'Hardware', 0, 'No waste on fasteners')
ON CONFLICT DO NOTHING;

-- ============================================================
-- ADD SAMPLE PRICES FOR NEW ITEMS
-- ============================================================

DO $$
DECLARE
  v_vendor1 UUID;
  v_vendor2 UUID;
  v_vendor3 UUID;
BEGIN
  SELECT id INTO v_vendor1 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 0;
  SELECT id INTO v_vendor2 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 1;
  SELECT id INTO v_vendor3 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 2;

  IF v_vendor1 IS NULL THEN
    RAISE NOTICE 'No vendors found - skipping price insertion';
    RETURN;
  END IF;

  -- PVC Trim prices
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_lf, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000080', v_vendor1, 'quote', 1.85, 'lf', 16, 1.85, 3, true, CURRENT_DATE - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-000000000080', v_vendor2, 'invoice', 1.95, 'lf', 16, 1.95, 2, true, CURRENT_DATE - INTERVAL '3 days'),
  ('11111111-1111-1111-1111-000000000081', v_vendor1, 'quote', 2.45, 'lf', 16, 2.45, 3, true, CURRENT_DATE - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-000000000081', v_vendor2, 'invoice', 2.65, 'lf', 16, 2.65, 2, true, CURRENT_DATE - INTERVAL '3 days')
  ON CONFLICT DO NOTHING;

  -- Fascia prices
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_lf, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000084', v_vendor1, 'quote', 0.89, 'lf', 16, 0.89, 2, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000084', v_vendor2, 'invoice', 0.95, 'lf', 16, 0.95, 1, true, CURRENT_DATE - INTERVAL '2 days'),
  ('11111111-1111-1111-1111-000000000085', v_vendor1, 'quote', 1.15, 'lf', 16, 1.15, 2, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000085', v_vendor2, 'invoice', 1.25, 'lf', 16, 1.25, 1, true, CURRENT_DATE - INTERVAL '2 days')
  ON CONFLICT DO NOTHING;

  -- Composite Decking prices
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_lf, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000090', v_vendor1, 'quote', 3.25, 'lf', 16, 3.25, 5, true, CURRENT_DATE - INTERVAL '6 days'),
  ('11111111-1111-1111-1111-000000000090', v_vendor2, 'invoice', 3.45, 'lf', 16, 3.45, 3, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000090', v_vendor3, 'quote', 3.65, 'lf', 16, 3.65, 7, false, CURRENT_DATE - INTERVAL '8 days'),
  ('11111111-1111-1111-1111-000000000091', v_vendor1, 'quote', 4.15, 'lf', 16, 4.15, 5, true, CURRENT_DATE - INTERVAL '6 days'),
  ('11111111-1111-1111-1111-000000000091', v_vendor2, 'invoice', 4.35, 'lf', 16, 4.35, 3, true, CURRENT_DATE - INTERVAL '4 days')
  ON CONFLICT DO NOTHING;

  -- PT Decking prices
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_lf, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000093', v_vendor1, 'quote', 1.45, 'lf', 16, 1.45, 2, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000093', v_vendor2, 'invoice', 1.55, 'lf', 16, 1.55, 1, true, CURRENT_DATE - INTERVAL '2 days'),
  ('11111111-1111-1111-1111-000000000093', v_vendor3, 'quote', 1.65, 'lf', 16, 1.65, 3, true, CURRENT_DATE - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-000000000094', v_vendor1, 'quote', 1.85, 'lf', 16, 1.85, 2, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000094', v_vendor2, 'invoice', 1.95, 'lf', 16, 1.95, 1, true, CURRENT_DATE - INTERVAL '2 days')
  ON CONFLICT DO NOTHING;

  -- PT Posts
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000096', v_vendor1, 'quote', 12.95, 'ea', 1, 12.95, 2, true, CURRENT_DATE - INTERVAL '3 days'),
  ('11111111-1111-1111-1111-000000000096', v_vendor2, 'invoice', 13.45, 'ea', 1, 13.45, 1, true, CURRENT_DATE - INTERVAL '2 days'),
  ('11111111-1111-1111-1111-000000000096', v_vendor3, 'quote', 14.25, 'ea', 1, 14.25, 3, true, CURRENT_DATE - INTERVAL '4 days')
  ON CONFLICT DO NOTHING;

END $$;

-- Refresh the materialized view
DO $$
BEGIN
  REFRESH MATERIALIZED VIEW v2_current_prices;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not refresh v2_current_prices view: %', SQLERRM;
END $$;
