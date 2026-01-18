-- Migration 045: Seed Price Intelligence with Test Data
-- Creates sample master items, vendor prices, and aliases for testing

-- ============================================================
-- MASTER ITEMS - Common construction materials
-- ============================================================

INSERT INTO v2_master_items (id, category, subcategory, standard_name, standard_unit, keywords, is_active) VALUES
-- Lumber
('11111111-1111-1111-1111-000000000001', 'Lumber', 'Studs', '2x4x8 SPF Stud', 'ea', ARRAY['stud', '2x4', 'framing', 'spf'], true),
('11111111-1111-1111-1111-000000000002', 'Lumber', 'Studs', '2x4x10 SPF Stud', 'ea', ARRAY['stud', '2x4', 'framing', 'spf'], true),
('11111111-1111-1111-1111-000000000003', 'Lumber', 'Studs', '2x6x8 SPF Stud', 'ea', ARRAY['stud', '2x6', 'framing', 'spf'], true),
('11111111-1111-1111-1111-000000000004', 'Lumber', 'Dimensional', '2x4x16 SPF', 'ea', ARRAY['dimensional', '2x4', 'framing'], true),
('11111111-1111-1111-1111-000000000005', 'Lumber', 'Dimensional', '2x6x16 SPF', 'ea', ARRAY['dimensional', '2x6', 'framing'], true),
('11111111-1111-1111-1111-000000000006', 'Lumber', 'Treated', '2x6x8 PT Ground Contact', 'ea', ARRAY['pressure treated', 'pt', 'ground contact'], true),
('11111111-1111-1111-1111-000000000007', 'Lumber', 'LVL', '1-3/4x11-7/8 LVL', 'lf', ARRAY['lvl', 'beam', 'engineered'], true),

-- Plywood & Sheathing
('11111111-1111-1111-1111-000000000010', 'Plywood', 'Sheathing', '7/16 OSB Sheathing 4x8', 'sheet', ARRAY['osb', 'sheathing', 'wall'], true),
('11111111-1111-1111-1111-000000000011', 'Plywood', 'Sheathing', '23/32 Tongue & Groove OSB Subfloor', 'sheet', ARRAY['osb', 'subfloor', 't&g', 'advantech'], true),
('11111111-1111-1111-1111-000000000012', 'Plywood', 'CDX', '1/2 CDX Plywood 4x8', 'sheet', ARRAY['cdx', 'plywood', 'exterior'], true),
('11111111-1111-1111-1111-000000000013', 'Plywood', 'CDX', '3/4 CDX Plywood 4x8', 'sheet', ARRAY['cdx', 'plywood', 'exterior'], true),

-- Drywall
('11111111-1111-1111-1111-000000000020', 'Drywall', 'Regular', '1/2 Drywall 4x8', 'sheet', ARRAY['drywall', 'sheetrock', 'gypsum'], true),
('11111111-1111-1111-1111-000000000021', 'Drywall', 'Regular', '1/2 Drywall 4x12', 'sheet', ARRAY['drywall', 'sheetrock', 'gypsum'], true),
('11111111-1111-1111-1111-000000000022', 'Drywall', 'Regular', '5/8 Drywall 4x8', 'sheet', ARRAY['drywall', 'sheetrock', 'gypsum', 'fire rated'], true),
('11111111-1111-1111-1111-000000000023', 'Drywall', 'Moisture Resistant', '1/2 Green Board 4x8', 'sheet', ARRAY['greenboard', 'moisture resistant', 'bathroom'], true),

-- Insulation
('11111111-1111-1111-1111-000000000030', 'Insulation', 'Batt', 'R-13 Unfaced Batt 15" (40 sf)', 'bag', ARRAY['r13', 'batt', 'fiberglass', 'wall'], true),
('11111111-1111-1111-1111-000000000031', 'Insulation', 'Batt', 'R-19 Unfaced Batt 15" (48 sf)', 'bag', ARRAY['r19', 'batt', 'fiberglass', 'floor'], true),
('11111111-1111-1111-1111-000000000032', 'Insulation', 'Batt', 'R-30 Unfaced Batt 16" (48 sf)', 'bag', ARRAY['r30', 'batt', 'fiberglass', 'attic'], true),
('11111111-1111-1111-1111-000000000033', 'Insulation', 'Rigid', '1" XPS Rigid Foam 4x8', 'sheet', ARRAY['xps', 'foam', 'rigid', 'r5'], true),

-- Roofing
('11111111-1111-1111-1111-000000000040', 'Roofing', 'Shingles', 'Architectural Shingle Bundle (33 sf)', 'bundle', ARRAY['shingle', 'architectural', 'asphalt'], true),
('11111111-1111-1111-1111-000000000041', 'Roofing', 'Underlayment', '15# Felt Underlayment (400 sf)', 'roll', ARRAY['felt', 'underlayment', 'tar paper'], true),
('11111111-1111-1111-1111-000000000042', 'Roofing', 'Underlayment', 'Synthetic Underlayment (1000 sf)', 'roll', ARRAY['synthetic', 'underlayment'], true),

-- Concrete
('11111111-1111-1111-1111-000000000050', 'Concrete', 'Ready Mix', 'Concrete 80# Bag', 'bag', ARRAY['concrete', 'quikrete', 'sakrete'], true),
('11111111-1111-1111-1111-000000000051', 'Concrete', 'Rebar', '#4 Rebar 20ft', 'ea', ARRAY['rebar', 'reinforcing', 'steel'], true),
('11111111-1111-1111-1111-000000000052', 'Concrete', 'Wire Mesh', '6x6 10/10 Wire Mesh 5x150', 'roll', ARRAY['wire mesh', 'reinforcing'], true),

-- Hardware
('11111111-1111-1111-1111-000000000060', 'Hardware', 'Fasteners', '3" Deck Screws 5# Box', 'box', ARRAY['deck screws', 'fasteners', 'exterior'], true),
('11111111-1111-1111-1111-000000000061', 'Hardware', 'Fasteners', '16d Framing Nails 50# Box', 'box', ARRAY['nails', 'framing', '16d'], true),
('11111111-1111-1111-1111-000000000062', 'Hardware', 'Hangers', 'LUS26 Joist Hanger', 'ea', ARRAY['joist hanger', 'simpson', 'connector'], true),

-- Siding
('11111111-1111-1111-1111-000000000070', 'Siding', 'Hardie', 'HardiePlank Lap Siding 8.25x144', 'pc', ARRAY['hardie', 'fiber cement', 'lap'], true),
('11111111-1111-1111-1111-000000000071', 'Siding', 'Vinyl', 'D4 Vinyl Siding White (200 sf)', 'sq', ARRAY['vinyl', 'd4', 'siding'], true)

ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Get existing vendor IDs for price data
-- We'll use a function to insert prices with actual vendor IDs
-- ============================================================

DO $$
DECLARE
  v_vendor1 UUID;
  v_vendor2 UUID;
  v_vendor3 UUID;
  v_vendor4 UUID;
BEGIN
  -- Get first 4 vendors (or create dummy ones if none exist)
  SELECT id INTO v_vendor1 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 0;
  SELECT id INTO v_vendor2 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 1;
  SELECT id INTO v_vendor3 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 2;
  SELECT id INTO v_vendor4 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 3;

  -- If no vendors exist, skip price insertion
  IF v_vendor1 IS NULL THEN
    RAISE NOTICE 'No vendors found - creating sample vendors first';

    INSERT INTO v2_vendors (id, name, email) VALUES
      (gen_random_uuid(), '84 Lumber', 'orders@84lumber.com'),
      (gen_random_uuid(), 'Builders FirstSource', 'sales@bldr.com'),
      (gen_random_uuid(), 'ABC Supply', 'orders@abcsupply.com'),
      (gen_random_uuid(), 'Home Depot Pro', 'pro@homedepot.com')
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_vendor1 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 0;
    SELECT id INTO v_vendor2 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 1;
    SELECT id INTO v_vendor3 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 2;
    SELECT id INTO v_vendor4 FROM v2_vendors ORDER BY name LIMIT 1 OFFSET 3;
  END IF;

  -- Insert price history for 2x4x8 Stud (varies by vendor)
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000001', v_vendor1, 'quote', 3.98, 'ea', 1, 3.98, 2, true, CURRENT_DATE - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-000000000001', v_vendor2, 'invoice', 4.15, 'ea', 1, 4.15, 1, true, CURRENT_DATE - INTERVAL '3 days'),
  ('11111111-1111-1111-1111-000000000001', v_vendor3, 'quote', 4.29, 'ea', 1, 4.29, 3, true, CURRENT_DATE - INTERVAL '7 days'),
  ('11111111-1111-1111-1111-000000000001', v_vendor4, 'manual', 4.47, 'ea', 1, 4.47, 0, true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- 2x4x10 Stud
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000002', v_vendor1, 'quote', 5.48, 'ea', 1, 5.48, 2, true, CURRENT_DATE - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-000000000002', v_vendor2, 'invoice', 5.75, 'ea', 1, 5.75, 1, true, CURRENT_DATE - INTERVAL '3 days'),
  ('11111111-1111-1111-1111-000000000002', v_vendor3, 'quote', 5.99, 'ea', 1, 5.99, 3, false, CURRENT_DATE - INTERVAL '7 days')
  ON CONFLICT DO NOTHING;

  -- 2x6x8 Stud
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000003', v_vendor1, 'quote', 6.28, 'ea', 1, 6.28, 2, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000003', v_vendor2, 'invoice', 6.49, 'ea', 1, 6.49, 1, true, CURRENT_DATE - INTERVAL '2 days'),
  ('11111111-1111-1111-1111-000000000003', v_vendor4, 'manual', 6.97, 'ea', 1, 6.97, 0, true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- OSB Sheathing
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000010', v_vendor1, 'quote', 11.98, 'sheet', 1, 11.98, 2, true, CURRENT_DATE - INTERVAL '6 days'),
  ('11111111-1111-1111-1111-000000000010', v_vendor2, 'invoice', 12.45, 'sheet', 1, 12.45, 1, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000010', v_vendor3, 'quote', 12.89, 'sheet', 1, 12.89, 3, true, CURRENT_DATE - INTERVAL '8 days'),
  ('11111111-1111-1111-1111-000000000010', v_vendor4, 'manual', 14.27, 'sheet', 1, 14.27, 0, true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- Subfloor OSB
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000011', v_vendor1, 'quote', 28.50, 'sheet', 1, 28.50, 2, true, CURRENT_DATE - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-000000000011', v_vendor2, 'invoice', 29.95, 'sheet', 1, 29.95, 1, true, CURRENT_DATE - INTERVAL '3 days'),
  ('11111111-1111-1111-1111-000000000011', v_vendor3, 'quote', 31.25, 'sheet', 1, 31.25, 5, false, CURRENT_DATE - INTERVAL '10 days')
  ON CONFLICT DO NOTHING;

  -- 1/2 Drywall
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000020', v_vendor1, 'quote', 9.98, 'sheet', 1, 9.98, 2, true, CURRENT_DATE - INTERVAL '3 days'),
  ('11111111-1111-1111-1111-000000000020', v_vendor2, 'invoice', 10.25, 'sheet', 1, 10.25, 1, true, CURRENT_DATE - INTERVAL '2 days'),
  ('11111111-1111-1111-1111-000000000020', v_vendor3, 'quote', 10.75, 'sheet', 1, 10.75, 3, true, CURRENT_DATE - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-000000000020', v_vendor4, 'manual', 12.47, 'sheet', 1, 12.47, 0, true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- R-13 Insulation
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000030', v_vendor1, 'quote', 32.50, 'bag', 1, 32.50, 2, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000030', v_vendor2, 'invoice', 34.95, 'bag', 1, 34.95, 1, true, CURRENT_DATE - INTERVAL '3 days'),
  ('11111111-1111-1111-1111-000000000030', v_vendor4, 'manual', 36.97, 'bag', 1, 36.97, 0, true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- Shingles
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000040', v_vendor1, 'quote', 32.98, 'bundle', 1, 32.98, 3, true, CURRENT_DATE - INTERVAL '6 days'),
  ('11111111-1111-1111-1111-000000000040', v_vendor2, 'invoice', 35.50, 'bundle', 1, 35.50, 2, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000040', v_vendor3, 'quote', 34.25, 'bundle', 1, 34.25, 1, true, CURRENT_DATE - INTERVAL '2 days')
  ON CONFLICT DO NOTHING;

  -- HardiePlank
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000070', v_vendor1, 'quote', 8.95, 'pc', 1, 8.95, 5, true, CURRENT_DATE - INTERVAL '7 days'),
  ('11111111-1111-1111-1111-000000000070', v_vendor2, 'invoice', 9.45, 'pc', 1, 9.45, 3, true, CURRENT_DATE - INTERVAL '5 days'),
  ('11111111-1111-1111-1111-000000000070', v_vendor3, 'quote', 9.75, 'pc', 1, 9.75, 7, false, CURRENT_DATE - INTERVAL '10 days')
  ON CONFLICT DO NOTHING;

  -- Concrete bags
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000050', v_vendor1, 'quote', 5.98, 'bag', 1, 5.98, 1, true, CURRENT_DATE - INTERVAL '2 days'),
  ('11111111-1111-1111-1111-000000000050', v_vendor2, 'invoice', 6.25, 'bag', 1, 6.25, 1, true, CURRENT_DATE - INTERVAL '1 day'),
  ('11111111-1111-1111-1111-000000000050', v_vendor4, 'manual', 6.97, 'bag', 1, 6.97, 0, true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

  -- Joist Hangers
  INSERT INTO v2_price_history (master_item_id, vendor_id, source_type, unit_price, unit, quantity, price_per_each, lead_days, in_stock, price_date) VALUES
  ('11111111-1111-1111-1111-000000000062', v_vendor1, 'quote', 2.45, 'ea', 1, 2.45, 2, true, CURRENT_DATE - INTERVAL '3 days'),
  ('11111111-1111-1111-1111-000000000062', v_vendor2, 'invoice', 2.65, 'ea', 1, 2.65, 1, true, CURRENT_DATE - INTERVAL '2 days'),
  ('11111111-1111-1111-1111-000000000062', v_vendor3, 'quote', 2.89, 'ea', 1, 2.89, 3, true, CURRENT_DATE - INTERVAL '4 days'),
  ('11111111-1111-1111-1111-000000000062', v_vendor4, 'manual', 3.17, 'ea', 1, 3.17, 0, true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;

END $$;

-- ============================================================
-- WASTE FACTORS (seed common ones)
-- ============================================================

INSERT INTO v2_waste_factors (category, subcategory, default_waste_percent, notes) VALUES
('Lumber', 'Studs', 5, 'Minimal waste on standard stud framing'),
('Lumber', 'Dimensional', 8, 'Some waste from cuts and defects'),
('Lumber', 'Treated', 5, 'Similar to untreated dimensional'),
('Plywood', 'Sheathing', 8, 'Some waste at openings and edges'),
('Plywood', 'Subfloor', 5, 'Less waste due to large floor areas'),
('Drywall', NULL, 10, 'Standard drywall waste factor'),
('Insulation', 'Batt', 5, 'Minimal waste on batt insulation'),
('Insulation', 'Rigid', 8, 'Some cutting waste'),
('Roofing', 'Shingles', 10, 'Hip and valley cuts add waste'),
('Roofing', 'Underlayment', 5, 'Overlap included in coverage'),
('Siding', NULL, 10, 'Corners and openings add waste'),
('Flooring', 'Tile', 15, 'High waste for cuts and patterns'),
('Flooring', 'Hardwood', 10, 'Board length variations'),
('Concrete', NULL, 5, 'Minimal waste on bag concrete'),
('Hardware', NULL, 0, 'No waste on hardware items')
ON CONFLICT DO NOTHING;

-- ============================================================
-- REFRESH MATERIALIZED VIEW
-- ============================================================

-- Note: This requires the view to exist from migration-044
-- If it fails, the view may need to be created first
DO $$
BEGIN
  REFRESH MATERIALIZED VIEW v2_current_prices;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not refresh v2_current_prices view: %', SQLERRM;
END $$;
