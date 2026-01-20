-- Migration 091: Complete Catalog with Images
-- Comprehensive product catalog for all selection categories

-- ============================================================
-- 1. ADD ALL CATEGORIES
-- ============================================================
INSERT INTO v2_selection_categories (name, description, display_order) VALUES
  ('Interior Paint', 'Wall and trim paint colors', 10),
  ('Exterior Paint', 'Exterior house paint colors', 11),
  ('Wood Stain', 'Interior wood stains and finishes', 15),
  ('Cabinet Hardware', 'Pulls, knobs, and cabinet hardware', 20),
  ('Door Hardware', 'Door knobs, levers, and hinges', 21),
  ('Countertops', 'Kitchen and bathroom countertop materials', 25),
  ('Backsplash', 'Kitchen and bathroom backsplash tile', 26),
  ('Flooring', 'Hardwood, LVP, tile, and carpet flooring', 30),
  ('Carpet', 'Carpet and area rugs', 31),
  ('Tile', 'Floor and wall tile', 32),
  ('Lighting', 'Light fixtures and ceiling fans', 35),
  ('Ceiling Fans', 'Ceiling fans with and without lights', 36),
  ('Plumbing Fixtures', 'Faucets, sinks, and bathroom fixtures', 40),
  ('Kitchen Sinks', 'Kitchen sink options', 41),
  ('Bathroom Sinks', 'Bathroom vanity sinks', 42),
  ('Toilets', 'Toilet fixtures', 43),
  ('Bathtubs', 'Bathtub and soaking tub options', 44),
  ('Showers', 'Shower systems and enclosures', 45),
  ('Appliances', 'Kitchen and laundry appliances', 50),
  ('Range/Cooktop', 'Ranges, cooktops, and ovens', 51),
  ('Refrigerator', 'Refrigerator and freezer options', 52),
  ('Dishwasher', 'Dishwasher options', 53),
  ('Range Hood', 'Ventilation and range hoods', 54),
  ('Washer/Dryer', 'Laundry appliances', 55),
  ('Cabinets', 'Kitchen and bathroom cabinets', 60),
  ('Interior Doors', 'Interior door styles', 65),
  ('Exterior Doors', 'Entry and exterior doors', 66),
  ('Garage Doors', 'Garage door styles', 67),
  ('Windows', 'Window styles and materials', 70),
  ('Trim/Molding', 'Crown molding, baseboards, and trim', 75),
  ('Fireplace', 'Fireplaces and surrounds', 80),
  ('Mirrors', 'Bathroom and decorative mirrors', 85),
  ('Shower Enclosures', 'Glass shower doors and enclosures', 86),
  ('Window Treatments', 'Blinds, shades, and shutters', 90),
  ('Roofing', 'Roofing materials', 95),
  ('Siding', 'Exterior siding materials', 96),
  ('Gutters', 'Gutter systems', 97),
  ('Decking', 'Deck and outdoor flooring', 98),
  ('Outdoor Lighting', 'Exterior and landscape lighting', 99)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. ADD IMAGES TO EXISTING PAINT COLORS
-- ============================================================
UPDATE v2_selection_catalog SET image_url = 'https://images.sherwin-williams.com/p/7012_creamy.jpg' WHERE name = 'SW 7012 Creamy';
UPDATE v2_selection_catalog SET image_url = 'https://images.sherwin-williams.com/p/7015_repose_gray.jpg' WHERE name = 'SW 7015 Repose Gray';
UPDATE v2_selection_catalog SET image_url = 'https://images.sherwin-williams.com/p/7029_agreeable_gray.jpg' WHERE name = 'SW 7029 Agreeable Gray';
UPDATE v2_selection_catalog SET image_url = 'https://images.sherwin-williams.com/p/7008_alabaster.jpg' WHERE name = 'SW 7008 Alabaster';
UPDATE v2_selection_catalog SET image_url = 'https://images.sherwin-williams.com/p/6244_naval.jpg' WHERE name = 'SW 6244 Naval';
UPDATE v2_selection_catalog SET image_url = 'https://images.sherwin-williams.com/p/9130_evergreen_fog.jpg' WHERE name = 'SW 9130 Evergreen Fog';
UPDATE v2_selection_catalog SET image_url = 'https://images.sherwin-williams.com/p/6258_tricorn_black.jpg' WHERE name = 'SW 6258 Tricorn Black';
UPDATE v2_selection_catalog SET image_url = 'https://images.sherwin-williams.com/p/7048_urbane_bronze.jpg' WHERE name = 'SW 7048 Urbane Bronze';

UPDATE v2_selection_catalog SET image_url = 'https://images.benjaminmoore.com/p/oc17_white_dove.jpg' WHERE name = 'OC-17 White Dove';
UPDATE v2_selection_catalog SET image_url = 'https://images.benjaminmoore.com/p/oc65_chantilly_lace.jpg' WHERE name = 'OC-65 Chantilly Lace';
UPDATE v2_selection_catalog SET image_url = 'https://images.benjaminmoore.com/p/hc172_revere_pewter.jpg' WHERE name = 'HC-172 Revere Pewter';
UPDATE v2_selection_catalog SET image_url = 'https://images.benjaminmoore.com/p/hc157_hale_navy.jpg' WHERE name = 'HC-157 Hale Navy';
UPDATE v2_selection_catalog SET image_url = 'https://images.benjaminmoore.com/p/2029_40_october_mist.jpg' WHERE name = '2029-40 October Mist';

-- ============================================================
-- 3. PLUMBING FIXTURES - FAUCETS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Plumbing Fixtures' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, image_url, specifications) VALUES
      -- Kitchen Faucets - Delta
      (v_cat_id, 'Delta Leland Pull-Down Kitchen Faucet', 'Delta', '9178-AR-DST', 329.00, 'each', true, true, ARRAY['kitchen', 'pull-down', 'arctic stainless', 'popular'], 'Arctic Stainless', 'https://images.homedepot-static.com/productImages/delta-leland-9178.jpg', '{"flow_rate": "1.8 GPM", "height": "15.5 in", "reach": "9.25 in"}'),
      (v_cat_id, 'Delta Trinsic Pro Kitchen Faucet', 'Delta', '9159T-AR-DST', 499.00, 'each', true, true, ARRAY['kitchen', 'pull-down', 'touch', 'modern'], 'Arctic Stainless', 'https://images.homedepot-static.com/productImages/delta-trinsic-9159.jpg', '{"flow_rate": "1.8 GPM", "touch_activated": true}'),
      (v_cat_id, 'Delta Cassidy Kitchen Faucet', 'Delta', '9197-AR-DST', 549.00, 'each', false, false, ARRAY['kitchen', 'pull-down', 'traditional'], 'Arctic Stainless', 'https://images.homedepot-static.com/productImages/delta-cassidy-9197.jpg', '{"flow_rate": "1.8 GPM"}'),
      (v_cat_id, 'Delta Essa Pull-Down Kitchen Faucet', 'Delta', '9113-AR-DST', 249.00, 'each', true, false, ARRAY['kitchen', 'pull-down', 'budget-friendly'], 'Arctic Stainless', 'https://images.homedepot-static.com/productImages/delta-essa-9113.jpg', '{"flow_rate": "1.8 GPM"}'),
      -- Kitchen Faucets - Kohler
      (v_cat_id, 'Kohler Artifacts Kitchen Faucet', 'Kohler', 'K-99261-VS', 599.00, 'each', true, true, ARRAY['kitchen', 'pull-down', 'premium'], 'Vibrant Stainless', 'https://images.us.kohler.com/artifacts-k99261.jpg', '{"flow_rate": "1.8 GPM", "height": "17.625 in"}'),
      (v_cat_id, 'Kohler Simplice Pull-Down Faucet', 'Kohler', 'K-596-VS', 349.00, 'each', true, true, ARRAY['kitchen', 'pull-down', 'popular'], 'Vibrant Stainless', 'https://images.us.kohler.com/simplice-k596.jpg', '{"flow_rate": "1.8 GPM", "height": "16.625 in"}'),
      (v_cat_id, 'Kohler Sensate Touchless Faucet', 'Kohler', 'K-72218-VS', 679.00, 'each', false, true, ARRAY['kitchen', 'touchless', 'modern'], 'Vibrant Stainless', 'https://images.us.kohler.com/sensate-k72218.jpg', '{"touchless": true}'),
      -- Kitchen Faucets - Moen
      (v_cat_id, 'Moen Arbor MotionSense Wave', 'Moen', '7594EWSRS', 449.00, 'each', true, true, ARRAY['kitchen', 'pull-down', 'touchless', 'popular'], 'Spot Resist Stainless', 'https://images.moen.com/arbor-7594ewsrs.jpg', '{"motionsense": true, "power_clean": true}'),
      (v_cat_id, 'Moen Align Pull-Down Faucet', 'Moen', '7565SRS', 299.00, 'each', true, false, ARRAY['kitchen', 'pull-down', 'modern'], 'Spot Resist Stainless', 'https://images.moen.com/align-7565srs.jpg', '{"flow_rate": "1.5 GPM"}'),
      (v_cat_id, 'Moen Brantford Kitchen Faucet', 'Moen', '7185SRS', 279.00, 'each', true, false, ARRAY['kitchen', 'pull-down', 'traditional'], 'Spot Resist Stainless', 'https://images.moen.com/brantford-7185srs.jpg', '{"flow_rate": "1.5 GPM"}'),
      -- Bathroom Faucets - Delta
      (v_cat_id, 'Delta Trinsic Bathroom Faucet', 'Delta', '559LF-SSMPU', 229.00, 'each', true, true, ARRAY['bathroom', 'single-handle', 'modern', 'popular'], 'Stainless', 'https://images.homedepot-static.com/productImages/delta-trinsic-559lf.jpg', '{"flow_rate": "1.2 GPM"}'),
      (v_cat_id, 'Delta Cassidy Widespread Faucet', 'Delta', '3597LF-SSMPU', 449.00, 'each', false, false, ARRAY['bathroom', 'widespread', 'traditional'], 'Stainless', 'https://images.homedepot-static.com/productImages/delta-cassidy-3597lf.jpg', '{"flow_rate": "1.2 GPM"}'),
      (v_cat_id, 'Delta Lahara Centerset Faucet', 'Delta', '2538-SSMPU-DST', 169.00, 'each', true, false, ARRAY['bathroom', 'centerset', 'transitional'], 'Stainless', 'https://images.homedepot-static.com/productImages/delta-lahara-2538.jpg', '{"flow_rate": "1.2 GPM"}'),
      -- Bathroom Faucets - Kohler
      (v_cat_id, 'Kohler Purist Widespread Faucet', 'Kohler', 'K-14406-4-BN', 649.00, 'each', true, true, ARRAY['bathroom', 'widespread', 'modern', 'premium'], 'Brushed Nickel', 'https://images.us.kohler.com/purist-k14406.jpg', '{"flow_rate": "1.2 GPM"}'),
      (v_cat_id, 'Kohler Artifacts Faucet', 'Kohler', 'K-72759-VS', 529.00, 'each', false, true, ARRAY['bathroom', 'single-handle', 'premium'], 'Vibrant Stainless', 'https://images.us.kohler.com/artifacts-k72759.jpg', '{"flow_rate": "1.2 GPM"}'),
      -- Bathroom Faucets - Moen
      (v_cat_id, 'Moen Genta Bathroom Faucet', 'Moen', '84760SRN', 129.00, 'each', true, false, ARRAY['bathroom', 'single-handle', 'modern', 'budget-friendly'], 'Spot Resist Brushed Nickel', 'https://images.moen.com/genta-84760srn.jpg', '{"flow_rate": "1.2 GPM"}'),
      (v_cat_id, 'Moen Voss Widespread Faucet', 'Moen', 'T6905BN', 289.00, 'each', true, false, ARRAY['bathroom', 'widespread', 'transitional'], 'Brushed Nickel', 'https://images.moen.com/voss-t6905bn.jpg', '{"flow_rate": "1.2 GPM"}'),
      -- Shower Fixtures - Delta
      (v_cat_id, 'Delta Trinsic Monitor Shower', 'Delta', 'T14259-SS', 249.00, 'each', true, true, ARRAY['shower', 'single-handle', 'modern'], 'Stainless', 'https://images.homedepot-static.com/productImages/delta-trinsic-t14259.jpg', '{"valve_included": false}'),
      (v_cat_id, 'Delta In2ition Shower System', 'Delta', '58480-SS-PK', 189.00, 'each', true, true, ARRAY['shower', 'combo', 'handheld', 'popular'], 'Stainless', 'https://images.homedepot-static.com/productImages/delta-in2ition-58480.jpg', '{"2_in_1": true}'),
      -- Shower Fixtures - Kohler
      (v_cat_id, 'Kohler Awaken Showerhead', 'Kohler', 'K-72419-G-BN', 149.00, 'each', true, false, ARRAY['shower', 'showerhead', 'multi-function'], 'Brushed Nickel', 'https://images.us.kohler.com/awaken-k72419.jpg', '{"spray_modes": 3}'),
      (v_cat_id, 'Kohler HydroRail Shower Column', 'Kohler', 'K-45906-BN', 499.00, 'each', false, true, ARRAY['shower', 'column', 'spa', 'premium'], 'Brushed Nickel', 'https://images.us.kohler.com/hydrorail-k45906.jpg', '{"sliding_bar": true}'),
      -- Pot Filler
      (v_cat_id, 'Delta Traditional Pot Filler', 'Delta', '1177LF-SS', 449.00, 'each', true, false, ARRAY['pot-filler', 'kitchen', 'traditional'], 'Stainless', 'https://images.homedepot-static.com/productImages/delta-potfiller-1177lf.jpg', '{"reach": "22 in"}'),
      (v_cat_id, 'Kohler Artifacts Pot Filler', 'Kohler', 'K-99271-VS', 649.00, 'each', false, true, ARRAY['pot-filler', 'kitchen', 'premium'], 'Vibrant Stainless', 'https://images.us.kohler.com/artifacts-potfiller.jpg', '{"reach": "22 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 4. KITCHEN SINKS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Kitchen Sinks' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Stainless Steel
      (v_cat_id, 'Kraus Standart PRO 33" Undermount', 'Kraus', 'KHU100-33', 349.00, 'each', true, true, ARRAY['undermount', 'stainless', 'single-bowl', 'popular'], 'Stainless Steel', '16-Gauge Stainless', 'https://images.kraususa.com/khu100-33.jpg', '{"width": "33 in", "depth": "10 in"}'),
      (v_cat_id, 'Kraus Kore Workstation 33" Sink', 'Kraus', 'KWU110-33', 499.00, 'each', true, true, ARRAY['workstation', 'stainless', 'accessories', 'popular'], 'Stainless Steel', '16-Gauge Stainless', 'https://images.kraususa.com/kwu110-33.jpg', '{"width": "33 in", "depth": "10 in", "workstation": true}'),
      (v_cat_id, 'Kohler Vault 33" Smart Divide', 'Kohler', 'K-3838-NA', 649.00, 'each', true, false, ARRAY['undermount', 'stainless', 'double-bowl'], 'Stainless Steel', '18-Gauge Stainless', 'https://images.us.kohler.com/vault-k3838.jpg', '{"width": "33 in", "depth": "9.5 in"}'),
      (v_cat_id, 'Elkay Crosstown 32" Undermount', 'Elkay', 'ECTRU31179', 429.00, 'each', true, false, ARRAY['undermount', 'stainless', 'single-bowl'], 'Stainless Steel', '18-Gauge Stainless', 'https://images.elkay.com/crosstown-ectru.jpg', '{"width": "32 in", "depth": "9 in"}'),
      -- Farmhouse/Apron
      (v_cat_id, 'Kohler Whitehaven 36" Farmhouse', 'Kohler', 'K-6489-0', 1299.00, 'each', true, true, ARRAY['farmhouse', 'apron', 'cast-iron', 'white', 'popular'], 'White', 'Enameled Cast Iron', 'https://images.us.kohler.com/whitehaven-k6489.jpg', '{"width": "36 in", "depth": "9.625 in"}'),
      (v_cat_id, 'Blanco Ikon 33" Farmhouse', 'Blanco', '401899', 1499.00, 'each', true, true, ARRAY['farmhouse', 'apron', 'silgranit', 'premium'], 'White', 'Silgranit', 'https://images.blanco.com/ikon-401899.jpg', '{"width": "33 in", "depth": "9 in"}'),
      (v_cat_id, 'Kraus Bellucci 33" Farmhouse', 'Kraus', 'KGF1-33WHITE', 499.00, 'each', true, false, ARRAY['farmhouse', 'apron', 'granite', 'budget-friendly'], 'White', 'Granite Composite', 'https://images.kraususa.com/kgf1-33.jpg', '{"width": "33 in", "depth": "10 in"}'),
      -- Composite/Granite
      (v_cat_id, 'Blanco Diamond Super Single', 'Blanco', '440194', 599.00, 'each', true, false, ARRAY['undermount', 'silgranit', 'single-bowl', 'anthracite'], 'Anthracite', 'Silgranit', 'https://images.blanco.com/diamond-440194.jpg', '{"width": "32 in", "depth": "9.5 in"}'),
      (v_cat_id, 'Blanco Precis 33" Double Bowl', 'Blanco', '442524', 699.00, 'each', false, false, ARRAY['undermount', 'silgranit', 'double-bowl'], 'Concrete Gray', 'Silgranit', 'https://images.blanco.com/precis-442524.jpg', '{"width": "33 in", "depth": "9.5 in"}'),
      -- Fireclay
      (v_cat_id, 'Bocchi Contempo 33" Farmhouse', 'Bocchi', '1352-001-0120', 799.00, 'each', true, false, ARRAY['farmhouse', 'fireclay', 'white', 'italian'], 'White', 'Fireclay', 'https://images.bocchi.com/contempo-1352.jpg', '{"width": "33 in", "depth": "10 in"}'),
      (v_cat_id, 'Rohl Shaws 33" Fireclay', 'Rohl', 'RC3318WH', 1899.00, 'each', false, true, ARRAY['farmhouse', 'fireclay', 'premium', 'handcrafted'], 'White', 'Fireclay', 'https://images.rohlhome.com/rc3318.jpg', '{"width": "33 in", "depth": "10 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 5. TOILETS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Toilets' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, image_url, specifications) VALUES
      -- Kohler
      (v_cat_id, 'Kohler Memoirs Stately Comfort Height', 'Kohler', 'K-3817-0', 449.00, 'each', true, true, ARRAY['two-piece', 'elongated', 'traditional', 'popular'], 'White', 'https://images.us.kohler.com/memoirs-k3817.jpg', '{"gpf": 1.28, "height": "comfort", "bowl": "elongated"}'),
      (v_cat_id, 'Kohler Cimarron Comfort Height', 'Kohler', 'K-3609-0', 299.00, 'each', true, true, ARRAY['two-piece', 'elongated', 'budget-friendly', 'popular'], 'White', 'https://images.us.kohler.com/cimarron-k3609.jpg', '{"gpf": 1.28, "height": "comfort", "bowl": "elongated"}'),
      (v_cat_id, 'Kohler Santa Rosa One-Piece', 'Kohler', 'K-3810-0', 549.00, 'each', true, false, ARRAY['one-piece', 'elongated', 'compact'], 'White', 'https://images.us.kohler.com/santarosa-k3810.jpg', '{"gpf": 1.28, "one_piece": true}'),
      (v_cat_id, 'Kohler Veil Intelligent Toilet', 'Kohler', 'K-5401-0', 2999.00, 'each', false, true, ARRAY['smart', 'bidet', 'heated-seat', 'luxury'], 'White', 'https://images.us.kohler.com/veil-k5401.jpg', '{"bidet": true, "heated_seat": true, "auto_flush": true}'),
      (v_cat_id, 'Kohler Wellworth Two-Piece', 'Kohler', 'K-3998-0', 199.00, 'each', true, false, ARRAY['two-piece', 'round', 'budget-friendly'], 'White', 'https://images.us.kohler.com/wellworth-k3998.jpg', '{"gpf": 1.28, "bowl": "round"}'),
      -- TOTO
      (v_cat_id, 'TOTO Drake II Two-Piece', 'TOTO', 'CST454CEFG#01', 429.00, 'each', true, true, ARRAY['two-piece', 'elongated', 'tornado-flush', 'popular'], 'Cotton White', 'https://images.totousa.com/drake-ii.jpg', '{"gpf": 1.28, "tornado_flush": true}'),
      (v_cat_id, 'TOTO Ultramax II One-Piece', 'TOTO', 'MS604114CEFG#01', 549.00, 'each', true, true, ARRAY['one-piece', 'elongated', 'tornado-flush'], 'Cotton White', 'https://images.totousa.com/ultramax-ii.jpg', '{"gpf": 1.28, "one_piece": true}'),
      (v_cat_id, 'TOTO Washlet+ Drake', 'TOTO', 'MW7763084CEG#01', 1299.00, 'each', true, true, ARRAY['bidet', 'washlet', 'integrated', 'premium'], 'Cotton White', 'https://images.totousa.com/washlet-drake.jpg', '{"bidet": true, "heated_seat": true}'),
      (v_cat_id, 'TOTO Neorest NX2', 'TOTO', 'MS903CUMFG#01', 11500.00, 'each', false, true, ARRAY['smart', 'bidet', 'luxury', 'actilight'], 'Cotton White', 'https://images.totousa.com/neorest-nx2.jpg', '{"bidet": true, "auto_open": true, "uv_light": true}'),
      -- American Standard
      (v_cat_id, 'American Standard Champion 4', 'American Standard', '2034314.020', 349.00, 'each', true, false, ARRAY['two-piece', 'elongated', 'powerful-flush'], 'White', 'https://images.americanstandard.com/champion4.jpg', '{"gpf": 1.6, "max_flush": true}'),
      (v_cat_id, 'American Standard Cadet 3', 'American Standard', '2988101.020', 229.00, 'each', true, false, ARRAY['two-piece', 'elongated', 'budget-friendly'], 'White', 'https://images.americanstandard.com/cadet3.jpg', '{"gpf": 1.28}'),
      (v_cat_id, 'American Standard VorMax Plus', 'American Standard', '2882108.020', 449.00, 'each', false, false, ARRAY['two-piece', 'elongated', 'clean-bowl'], 'White', 'https://images.americanstandard.com/vormax.jpg', '{"gpf": 1.28, "clean_curve": true}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 6. BATHTUBS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Bathtubs' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Freestanding
      (v_cat_id, 'Kohler Underscore 60" Freestanding', 'Kohler', 'K-1137-0', 2499.00, 'each', true, true, ARRAY['freestanding', 'soaking', 'modern', 'popular'], 'White', 'Acrylic', 'https://images.us.kohler.com/underscore-k1137.jpg', '{"length": "60 in", "width": "30 in", "depth": "22 in"}'),
      (v_cat_id, 'Kohler Memoirs Freestanding', 'Kohler', 'K-2337-0', 3299.00, 'each', false, true, ARRAY['freestanding', 'soaking', 'traditional'], 'White', 'Acrylic', 'https://images.us.kohler.com/memoirs-k2337.jpg', '{"length": "66 in", "width": "32 in"}'),
      (v_cat_id, 'Wyndham Mermaid 67" Freestanding', 'Wyndham', 'WCOBT100067', 1099.00, 'each', true, false, ARRAY['freestanding', 'soaking', 'budget-friendly'], 'White', 'Acrylic', 'https://images.wyndham.com/mermaid-67.jpg', '{"length": "67 in", "width": "31.25 in"}'),
      (v_cat_id, 'WOODBRIDGE 67" Freestanding', 'Woodbridge', 'B0014', 999.00, 'each', true, false, ARRAY['freestanding', 'soaking', 'modern', 'budget-friendly'], 'White', 'Acrylic', 'https://images.woodbridge.com/b0014.jpg', '{"length": "67 in", "width": "31.5 in"}'),
      -- Alcove/Drop-in
      (v_cat_id, 'Kohler Archer 60" Alcove', 'Kohler', 'K-1946-LA-0', 899.00, 'each', true, true, ARRAY['alcove', 'soaking', 'transitional', 'popular'], 'White', 'Acrylic', 'https://images.us.kohler.com/archer-k1946.jpg', '{"length": "60 in", "width": "32 in"}'),
      (v_cat_id, 'Kohler Villager 60" Cast Iron', 'Kohler', 'K-715-0', 599.00, 'each', true, false, ARRAY['alcove', 'cast-iron', 'traditional'], 'White', 'Enameled Cast Iron', 'https://images.us.kohler.com/villager-k715.jpg', '{"length": "60 in", "width": "30 in"}'),
      (v_cat_id, 'American Standard Americast 60"', 'American Standard', '2391202.020', 699.00, 'each', true, false, ARRAY['alcove', 'soaking', 'durable'], 'White', 'Americast', 'https://images.americanstandard.com/americast.jpg', '{"length": "60 in", "width": "32 in"}'),
      -- Clawfoot
      (v_cat_id, 'Kingston Brass 67" Clawfoot', 'Kingston Brass', 'VCT7D673122ZB', 1699.00, 'each', false, true, ARRAY['clawfoot', 'victorian', 'cast-iron'], 'White/Oil Rubbed Bronze', 'Cast Iron', 'https://images.kingstonbrass.com/vct7d67.jpg', '{"length": "67 in", "width": "31 in"}'),
      -- Jetted/Whirlpool
      (v_cat_id, 'Kohler Archer 60" Whirlpool', 'Kohler', 'K-1122-LA-0', 1999.00, 'each', false, false, ARRAY['whirlpool', 'jetted', 'spa'], 'White', 'Acrylic', 'https://images.us.kohler.com/archer-whirlpool.jpg', '{"length": "60 in", "jets": 8}'),
      (v_cat_id, 'Jacuzzi Signature 60" Whirlpool', 'Jacuzzi', 'R5D6032WLR1XX', 1599.00, 'each', true, false, ARRAY['whirlpool', 'jetted', 'spa'], 'White', 'Acrylic', 'https://images.jacuzzi.com/signature-60.jpg', '{"length": "60 in", "jets": 6}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 7. APPLIANCES - RANGES
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Range/Cooktop' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, image_url, specifications) VALUES
      -- Gas Ranges
      (v_cat_id, 'GE Profile 30" Smart Gas Range', 'GE Profile', 'PGB960YPFS', 2199.00, 'each', true, true, ARRAY['gas', 'smart', 'convection', 'popular'], 'Stainless Steel', 'https://images.ge.com/pgb960ypfs.jpg', '{"fuel": "gas", "width": "30 in", "convection": true, "smart": true}'),
      (v_cat_id, 'Samsung 30" Smart Gas Range', 'Samsung', 'NX60A6511SS', 1299.00, 'each', true, false, ARRAY['gas', 'smart', 'air-fry'], 'Stainless Steel', 'https://images.samsung.com/nx60a6511ss.jpg', '{"fuel": "gas", "width": "30 in", "air_fry": true}'),
      (v_cat_id, 'LG 30" Smart Gas Range', 'LG', 'LRGL5823S', 1399.00, 'each', true, false, ARRAY['gas', 'smart', 'air-fry'], 'Stainless Steel', 'https://images.lg.com/lrgl5823s.jpg', '{"fuel": "gas", "width": "30 in", "air_fry": true}'),
      (v_cat_id, 'KitchenAid 30" Gas Range', 'KitchenAid', 'KFGC500JSS', 2899.00, 'each', false, true, ARRAY['gas', 'commercial-style', 'premium'], 'Stainless Steel', 'https://images.kitchenaid.com/kfgc500jss.jpg', '{"fuel": "gas", "width": "30 in", "commercial_style": true}'),
      -- Pro Ranges
      (v_cat_id, 'Viking 36" Professional Gas Range', 'Viking', 'VGR5366BSS', 7999.00, 'each', false, true, ARRAY['gas', 'professional', '36-inch', 'luxury'], 'Stainless Steel', 'https://images.vikingrange.com/vgr5366bss.jpg', '{"fuel": "gas", "width": "36 in", "burners": 6}'),
      (v_cat_id, 'Wolf 36" Gas Range', 'Wolf', 'GR366', 8599.00, 'each', false, true, ARRAY['gas', 'professional', '36-inch', 'luxury'], 'Stainless Steel', 'https://images.subzero-wolf.com/gr366.jpg', '{"fuel": "gas", "width": "36 in", "burners": 6}'),
      (v_cat_id, 'Thermador 36" Pro Harmony', 'Thermador', 'PRG364WDH', 6799.00, 'each', false, true, ARRAY['gas', 'professional', '36-inch', 'premium'], 'Stainless Steel', 'https://images.thermador.com/prg364wdh.jpg', '{"fuel": "gas", "width": "36 in", "burners": 4}'),
      -- Electric/Induction
      (v_cat_id, 'GE Profile 30" Induction Range', 'GE Profile', 'PHS930YPFS', 2799.00, 'each', true, true, ARRAY['induction', 'smart', 'convection', 'popular'], 'Stainless Steel', 'https://images.ge.com/phs930ypfs.jpg', '{"fuel": "induction", "width": "30 in", "convection": true}'),
      (v_cat_id, 'Samsung Bespoke 30" Induction', 'Samsung', 'NE63A6711SS', 2199.00, 'each', true, false, ARRAY['induction', 'smart', 'air-fry'], 'Stainless Steel', 'https://images.samsung.com/ne63a6711ss.jpg', '{"fuel": "induction", "width": "30 in", "air_fry": true}'),
      (v_cat_id, 'Bosch 800 Series 30" Induction', 'Bosch', 'HII8047U', 2999.00, 'each', false, true, ARRAY['induction', 'slide-in', 'premium'], 'Stainless Steel', 'https://images.bosch.com/hii8047u.jpg', '{"fuel": "induction", "width": "30 in"}'),
      -- Cooktops
      (v_cat_id, 'GE Profile 36" Gas Cooktop', 'GE Profile', 'PGP9036SLSS', 1299.00, 'each', true, false, ARRAY['gas', 'cooktop', '36-inch'], 'Stainless Steel', 'https://images.ge.com/pgp9036slss.jpg', '{"fuel": "gas", "width": "36 in", "burners": 5}'),
      (v_cat_id, 'KitchenAid 36" Induction Cooktop', 'KitchenAid', 'KCIG556JSS', 2399.00, 'each', false, true, ARRAY['induction', 'cooktop', '36-inch'], 'Stainless Steel', 'https://images.kitchenaid.com/kcig556jss.jpg', '{"fuel": "induction", "width": "36 in", "elements": 5}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 8. REFRIGERATORS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Refrigerator' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, image_url, specifications) VALUES
      -- French Door
      (v_cat_id, 'Samsung 28 cu ft Smart French Door', 'Samsung', 'RF28T5001SR', 1899.00, 'each', true, true, ARRAY['french-door', 'smart', 'stainless', 'popular'], 'Stainless Steel', 'https://images.samsung.com/rf28t5001sr.jpg', '{"capacity": "28 cu ft", "width": "36 in", "smart": true}'),
      (v_cat_id, 'LG 26 cu ft Smart French Door', 'LG', 'LRFXS2503S', 2199.00, 'each', true, true, ARRAY['french-door', 'smart', 'instaview'], 'Stainless Steel', 'https://images.lg.com/lrfxs2503s.jpg', '{"capacity": "26 cu ft", "width": "36 in", "instaview": true}'),
      (v_cat_id, 'GE Profile 27.9 cu ft French Door', 'GE Profile', 'PVD28BYNFS', 3299.00, 'each', true, true, ARRAY['french-door', 'smart', 'hands-free', 'premium'], 'Stainless Steel', 'https://images.ge.com/pvd28bynfs.jpg', '{"capacity": "27.9 cu ft", "width": "36 in", "hands_free": true}'),
      (v_cat_id, 'KitchenAid 26.8 cu ft French Door', 'KitchenAid', 'KRFF507HPS', 2999.00, 'each', false, true, ARRAY['french-door', 'platinum-interior', 'premium'], 'Stainless Steel', 'https://images.kitchenaid.com/krff507hps.jpg', '{"capacity": "26.8 cu ft", "width": "36 in"}'),
      -- Counter-Depth
      (v_cat_id, 'GE Profile Counter-Depth French Door', 'GE Profile', 'PYE22KYNFS', 2999.00, 'each', true, true, ARRAY['counter-depth', 'french-door', 'smart', 'popular'], 'Stainless Steel', 'https://images.ge.com/pye22kynfs.jpg', '{"capacity": "22.1 cu ft", "depth": "counter", "smart": true}'),
      (v_cat_id, 'Bosch 800 Series Counter-Depth', 'Bosch', 'B36CL80SNS', 3299.00, 'each', false, true, ARRAY['counter-depth', 'french-door', 'farmfresh'], 'Stainless Steel', 'https://images.bosch.com/b36cl80sns.jpg', '{"capacity": "21 cu ft", "depth": "counter"}'),
      -- Built-In/Panel Ready
      (v_cat_id, 'Sub-Zero 42" Built-In Side by Side', 'Sub-Zero', 'BI-42S/S', 12999.00, 'each', false, true, ARRAY['built-in', 'side-by-side', 'luxury', 'panel-ready'], 'Stainless Steel', 'https://images.subzero-wolf.com/bi-42s.jpg', '{"capacity": "25 cu ft", "width": "42 in", "built_in": true}'),
      (v_cat_id, 'Thermador 36" Built-In French Door', 'Thermador', 'T36BT925NS', 8499.00, 'each', false, true, ARRAY['built-in', 'french-door', 'panel-ready', 'premium'], 'Stainless Steel', 'https://images.thermador.com/t36bt925ns.jpg', '{"capacity": "19.4 cu ft", "width": "36 in"}'),
      -- Side by Side
      (v_cat_id, 'Samsung 27.4 cu ft Side by Side', 'Samsung', 'RS27T5200SR', 1399.00, 'each', true, false, ARRAY['side-by-side', 'smart', 'ice-maker'], 'Stainless Steel', 'https://images.samsung.com/rs27t5200sr.jpg', '{"capacity": "27.4 cu ft", "width": "36 in"}'),
      (v_cat_id, 'Whirlpool 28 cu ft Side by Side', 'Whirlpool', 'WRS588FIHZ', 1599.00, 'each', true, false, ARRAY['side-by-side', 'fingerprint-resistant'], 'Stainless Steel', 'https://images.whirlpool.com/wrs588fihz.jpg', '{"capacity": "28 cu ft", "width": "36 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 9. DISHWASHERS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Dishwasher' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, image_url, specifications) VALUES
      (v_cat_id, 'Bosch 800 Series Dishwasher', 'Bosch', 'SHPM88Z75N', 1249.00, 'each', true, true, ARRAY['quiet', 'third-rack', 'crystaldry', 'popular'], 'Stainless Steel', 'https://images.bosch.com/shpm88z75n.jpg', '{"decibels": 40, "cycles": 6, "third_rack": true}'),
      (v_cat_id, 'Bosch 500 Series Dishwasher', 'Bosch', 'SHPM65Z55N', 999.00, 'each', true, false, ARRAY['quiet', 'third-rack', 'autoair'], 'Stainless Steel', 'https://images.bosch.com/shpm65z55n.jpg', '{"decibels": 44, "cycles": 5}'),
      (v_cat_id, 'KitchenAid Top Control Dishwasher', 'KitchenAid', 'KDTM404KPS', 1149.00, 'each', true, true, ARRAY['third-rack', 'freeflex', 'premium'], 'Stainless Steel', 'https://images.kitchenaid.com/kdtm404kps.jpg', '{"decibels": 44, "cycles": 5}'),
      (v_cat_id, 'GE Profile Smart Dishwasher', 'GE Profile', 'PDT755SYRFS', 1099.00, 'each', true, false, ARRAY['smart', 'bottle-jets', 'fingerprint-resistant'], 'Stainless Steel', 'https://images.ge.com/pdt755syrfs.jpg', '{"decibels": 45, "smart": true}'),
      (v_cat_id, 'Samsung Smart Linear Wash', 'Samsung', 'DW80R9950US', 999.00, 'each', true, false, ARRAY['smart', 'linear-wash', 'autorelease'], 'Stainless Steel', 'https://images.samsung.com/dw80r9950us.jpg', '{"decibels": 39, "smart": true}'),
      (v_cat_id, 'LG QuadWash Pro Dishwasher', 'LG', 'LDPS6762S', 1099.00, 'each', true, false, ARRAY['quadwash', 'truesteam', 'smart'], 'Stainless Steel', 'https://images.lg.com/ldps6762s.jpg', '{"decibels": 44, "quadwash": true}'),
      (v_cat_id, 'Miele G 7000 Series', 'Miele', 'G7566SCVISF', 1999.00, 'each', false, true, ARRAY['premium', 'knocktoopen', 'autodos', 'luxury'], 'Stainless Steel', 'https://images.miele.com/g7566scvisf.jpg', '{"decibels": 38, "autodos": true}'),
      (v_cat_id, 'Thermador Sapphire Dishwasher', 'Thermador', 'DWHD660WFM', 2299.00, 'each', false, true, ARRAY['premium', 'star-speed', 'luxury'], 'Stainless Steel', 'https://images.thermador.com/dwhd660wfm.jpg', '{"decibels": 42, "star_speed": true}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 10. RANGE HOODS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Range Hood' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, image_url, specifications) VALUES
      -- Wall Mount
      (v_cat_id, 'Broan 30" Chimney Hood', 'Broan', 'EW5630SS', 599.00, 'each', true, false, ARRAY['wall-mount', 'chimney', '30-inch', 'popular'], 'Stainless Steel', 'https://images.broan.com/ew5630ss.jpg', '{"cfm": 500, "width": "30 in", "type": "chimney"}'),
      (v_cat_id, 'Zephyr Anzio 30" Wall Hood', 'Zephyr', 'ZAN-E30DS', 999.00, 'each', true, true, ARRAY['wall-mount', 'chimney', '30-inch', 'designer'], 'Stainless Steel', 'https://images.zephyronline.com/zan-e30ds.jpg', '{"cfm": 600, "width": "30 in"}'),
      (v_cat_id, 'KitchenAid 36" Canopy Hood', 'KitchenAid', 'KVWC956KSS', 1299.00, 'each', false, true, ARRAY['wall-mount', 'canopy', '36-inch', 'premium'], 'Stainless Steel', 'https://images.kitchenaid.com/kvwc956kss.jpg', '{"cfm": 585, "width": "36 in"}'),
      -- Under Cabinet
      (v_cat_id, 'Broan 30" Under Cabinet Hood', 'Broan', 'BCSD130SS', 299.00, 'each', true, false, ARRAY['under-cabinet', '30-inch', 'budget-friendly'], 'Stainless Steel', 'https://images.broan.com/bcsd130ss.jpg', '{"cfm": 300, "width": "30 in", "type": "under_cabinet"}'),
      (v_cat_id, 'GE 30" Under Cabinet Hood', 'GE', 'JVX5300SJSS', 349.00, 'each', true, false, ARRAY['under-cabinet', '30-inch'], 'Stainless Steel', 'https://images.ge.com/jvx5300sjss.jpg', '{"cfm": 350, "width": "30 in"}'),
      -- Island
      (v_cat_id, 'Zephyr Milano 36" Island Hood', 'Zephyr', 'ZMI-E36BS', 1499.00, 'each', false, true, ARRAY['island', '36-inch', 'glass', 'designer'], 'Stainless/Glass', 'https://images.zephyronline.com/zmi-e36bs.jpg', '{"cfm": 600, "width": "36 in", "type": "island"}'),
      (v_cat_id, 'Best Cirrus 36" Island Hood', 'Best', 'WC34IQT36SB', 1799.00, 'each', false, true, ARRAY['island', '36-inch', 'premium'], 'Stainless Steel', 'https://images.bestrangehoods.com/wc34iqt.jpg', '{"cfm": 650, "width": "36 in"}'),
      -- Pro Style
      (v_cat_id, 'Viking 36" Pro Wall Hood', 'Viking', 'VCWH53648SS', 2999.00, 'each', false, true, ARRAY['wall-mount', 'professional', '36-inch', 'luxury'], 'Stainless Steel', 'https://images.vikingrange.com/vcwh53648ss.jpg', '{"cfm": 1200, "width": "36 in"}'),
      (v_cat_id, 'Wolf 36" Pro Wall Hood', 'Wolf', 'PW362418', 2799.00, 'each', false, true, ARRAY['wall-mount', 'professional', '36-inch', 'luxury'], 'Stainless Steel', 'https://images.subzero-wolf.com/pw362418.jpg', '{"cfm": 1000, "width": "36 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 11. CABINETS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Cabinets' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, collection, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url) VALUES
      -- Stock Cabinets
      (v_cat_id, 'Hampton Bay Shaker White', 'Hampton Bay', 'Shaker', 150.00, 'linear ft', true, false, ARRAY['stock', 'shaker', 'white', 'budget-friendly', 'popular'], 'White', 'Thermofoil', 'https://images.homedepot-static.com/hampton-shaker-white.jpg'),
      (v_cat_id, 'Hampton Bay Madison Java', 'Hampton Bay', 'Madison', 165.00, 'linear ft', true, false, ARRAY['stock', 'raised-panel', 'java', 'traditional'], 'Java', 'Thermofoil', 'https://images.homedepot-static.com/hampton-madison-java.jpg'),
      -- Semi-Custom
      (v_cat_id, 'KraftMaid Durham Maple', 'KraftMaid', 'Durham', 350.00, 'linear ft', true, true, ARRAY['semi-custom', 'maple', 'shaker', 'popular'], 'Various', 'Solid Maple', 'https://images.kraftmaid.com/durham-maple.jpg'),
      (v_cat_id, 'KraftMaid Harrington Cherry', 'KraftMaid', 'Harrington', 400.00, 'linear ft', false, true, ARRAY['semi-custom', 'cherry', 'raised-panel', 'traditional'], 'Various', 'Solid Cherry', 'https://images.kraftmaid.com/harrington-cherry.jpg'),
      (v_cat_id, 'Thomasville Nouveau', 'Thomasville', 'Nouveau', 325.00, 'linear ft', true, false, ARRAY['semi-custom', 'modern', 'slab'], 'Various', 'MDF/Wood', 'https://images.thomasvillecabinetry.com/nouveau.jpg'),
      (v_cat_id, 'Diamond NOW Arcadia White', 'Diamond NOW', 'Arcadia', 275.00, 'linear ft', true, false, ARRAY['semi-custom', 'shaker', 'white'], 'White', 'Solid Wood', 'https://images.diamondcabinets.com/arcadia-white.jpg'),
      -- Custom
      (v_cat_id, 'Wood-Mode Custom Cabinets', 'Wood-Mode', 'Custom', 750.00, 'linear ft', false, true, ARRAY['custom', 'luxury', 'premium'], 'Custom', 'Solid Wood', 'https://images.wood-mode.com/custom.jpg'),
      (v_cat_id, 'Brookhaven by Wood-Mode', 'Brookhaven', 'Custom', 550.00, 'linear ft', true, true, ARRAY['semi-custom', 'premium', 'american-made'], 'Custom', 'Solid Wood', 'https://images.brookhavencabinets.com/custom.jpg'),
      (v_cat_id, 'Plain & Fancy Custom', 'Plain & Fancy', 'Custom', 800.00, 'linear ft', false, true, ARRAY['custom', 'handcrafted', 'luxury'], 'Custom', 'Solid Wood', 'https://images.plainfancycabinetry.com/custom.jpg'),
      -- Frameless/European
      (v_cat_id, 'IKEA SEKTION White', 'IKEA', 'SEKTION', 125.00, 'linear ft', true, false, ARRAY['frameless', 'european', 'white', 'budget-friendly'], 'White', 'Particleboard', 'https://images.ikea.com/sektion-white.jpg'),
      (v_cat_id, 'Nobilia German Cabinets', 'Nobilia', 'Line N', 450.00, 'linear ft', false, true, ARRAY['frameless', 'european', 'german', 'premium'], 'Various', 'MDF/Wood', 'https://images.nobilia.de/line-n.jpg')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 12. INTERIOR DOORS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Interior Doors' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Panel Doors
      (v_cat_id, 'Masonite 2-Panel Shaker Hollow Core', 'Masonite', '10035', 89.00, 'each', true, false, ARRAY['shaker', '2-panel', 'hollow-core', 'budget-friendly'], 'Primed', 'MDF', 'https://images.masonite.com/shaker-2panel.jpg', '{"width": "30 in", "height": "80 in"}'),
      (v_cat_id, 'Masonite 5-Panel Shaker Solid Core', 'Masonite', '10040', 189.00, 'each', true, true, ARRAY['shaker', '5-panel', 'solid-core', 'popular'], 'Primed', 'MDF/Solid Core', 'https://images.masonite.com/shaker-5panel.jpg', '{"width": "30 in", "height": "80 in"}'),
      (v_cat_id, 'JELD-WEN 6-Panel Colonist', 'JELD-WEN', 'C6020', 149.00, 'each', true, false, ARRAY['colonist', '6-panel', 'traditional'], 'Primed', 'Composite', 'https://images.jeld-wen.com/colonist-6panel.jpg', '{"width": "30 in", "height": "80 in"}'),
      (v_cat_id, 'Metrie 3-Panel Craftsman', 'Metrie', 'MC3000', 249.00, 'each', false, true, ARRAY['craftsman', '3-panel', 'solid-core'], 'Primed', 'MDF/Solid Core', 'https://images.metrie.com/craftsman-3panel.jpg', '{"width": "30 in", "height": "80 in"}'),
      -- Barn Doors
      (v_cat_id, 'Masonite 36" K-Bar Barn Door', 'Masonite', 'BD3684', 329.00, 'each', true, true, ARRAY['barn-door', 'k-bar', 'farmhouse', 'popular'], 'Primed', 'MDF', 'https://images.masonite.com/barn-kbar.jpg', '{"width": "36 in", "height": "84 in"}'),
      (v_cat_id, 'Artisan 42" Z-Frame Barn Door', 'Artisan', 'Z4284', 449.00, 'each', false, true, ARRAY['barn-door', 'z-frame', 'rustic'], 'Unfinished Pine', 'Solid Pine', 'https://images.artisanhardware.com/z-frame.jpg', '{"width": "42 in", "height": "84 in"}'),
      -- French Doors
      (v_cat_id, 'JELD-WEN 60" French Door', 'JELD-WEN', 'FR6080', 599.00, 'pair', true, true, ARRAY['french', 'glass', '10-lite', 'popular'], 'Primed', 'Wood/Glass', 'https://images.jeld-wen.com/french-10lite.jpg', '{"width": "60 in", "height": "80 in"}'),
      (v_cat_id, 'Masonite 60" Clear Glass French', 'Masonite', 'FD6080CL', 549.00, 'pair', true, false, ARRAY['french', 'glass', 'modern'], 'Primed', 'MDF/Glass', 'https://images.masonite.com/french-clear.jpg', '{"width": "60 in", "height": "80 in"}'),
      -- Pocket Doors
      (v_cat_id, 'Johnson 36" Pocket Door Frame', 'Johnson', '1500HD', 199.00, 'each', true, false, ARRAY['pocket', 'hardware', 'frame'], 'N/A', 'Steel', 'https://images.johnsonhardware.com/1500hd.jpg', '{"width": "36 in"}'),
      -- Slab Doors
      (v_cat_id, 'Metrie Slab Flat Panel', 'Metrie', 'SLABFP', 79.00, 'each', true, false, ARRAY['slab', 'flat', 'modern', 'budget-friendly'], 'Primed', 'MDF', 'https://images.metrie.com/slab-flat.jpg', '{"width": "30 in", "height": "80 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 13. EXTERIOR DOORS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Exterior Doors' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Fiberglass Entry
      (v_cat_id, 'Therma-Tru 36" Craftsman Entry', 'Therma-Tru', 'CCM200', 1299.00, 'each', true, true, ARRAY['entry', 'craftsman', 'fiberglass', 'popular'], 'Various', 'Fiberglass', 'https://images.thermatru.com/craftsman-ccm200.jpg', '{"width": "36 in", "height": "80 in"}'),
      (v_cat_id, 'Therma-Tru Classic-Craft Canvas', 'Therma-Tru', 'CCRS200', 1599.00, 'each', true, true, ARRAY['entry', 'smooth', 'fiberglass', 'paintable'], 'Primed', 'Fiberglass', 'https://images.thermatru.com/canvas-ccrs200.jpg', '{"width": "36 in", "height": "80 in"}'),
      (v_cat_id, 'Masonite Belleville Fiberglass', 'Masonite', 'BV6080', 899.00, 'each', true, false, ARRAY['entry', 'fiberglass', 'traditional'], 'Various', 'Fiberglass', 'https://images.masonite.com/belleville.jpg', '{"width": "36 in", "height": "80 in"}'),
      -- Steel Entry
      (v_cat_id, 'JELD-WEN 36" Steel Entry Door', 'JELD-WEN', 'STLD36', 599.00, 'each', true, false, ARRAY['entry', 'steel', 'insulated', 'budget-friendly'], 'Primed', 'Steel', 'https://images.jeld-wen.com/steel-entry.jpg', '{"width": "36 in", "height": "80 in"}'),
      (v_cat_id, 'Pella 36" Performance Steel', 'Pella', 'PS3680', 999.00, 'each', false, true, ARRAY['entry', 'steel', 'high-performance'], 'Various', 'Steel', 'https://images.pella.com/performance-steel.jpg', '{"width": "36 in", "height": "80 in"}'),
      -- Wood Entry
      (v_cat_id, 'Simpson Nantucket 36" Wood', 'Simpson', 'NANT36', 1899.00, 'each', false, true, ARRAY['entry', 'wood', 'premium', 'handcrafted'], 'Unfinished', 'Solid Wood', 'https://images.simpsondoor.com/nantucket.jpg', '{"width": "36 in", "height": "80 in"}'),
      -- Patio Doors
      (v_cat_id, 'Andersen 72" Sliding Patio Door', 'Andersen', 'PS6068', 1799.00, 'each', true, true, ARRAY['patio', 'sliding', 'vinyl', 'popular'], 'White', 'Vinyl', 'https://images.andersenwindows.com/ps6068.jpg', '{"width": "72 in", "height": "80 in"}'),
      (v_cat_id, 'Pella 72" French Patio Door', 'Pella', 'FPD7280', 2999.00, 'each', false, true, ARRAY['patio', 'french', 'hinged', 'premium'], 'Various', 'Wood/Fiberglass', 'https://images.pella.com/french-patio.jpg', '{"width": "72 in", "height": "80 in"}'),
      (v_cat_id, 'Marvin Bi-Fold Patio Door', 'Marvin', 'BF96', 8999.00, 'each', false, true, ARRAY['patio', 'bi-fold', 'luxury', 'modern'], 'Various', 'Wood/Aluminum', 'https://images.marvin.com/bi-fold.jpg', '{"width": "96 in", "height": "96 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 14. WINDOWS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Windows' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, specifications) VALUES
      -- Vinyl
      (v_cat_id, 'Pella 250 Series Double-Hung', 'Pella', '250DH', 399.00, 'each', true, true, ARRAY['double-hung', 'vinyl', 'energy-star', 'popular'], 'White', 'Vinyl', 'https://images.pella.com/250-doublehung.jpg', '{"width": "36 in", "height": "48 in", "u_factor": 0.27}'),
      (v_cat_id, 'Andersen 100 Series Double-Hung', 'Andersen', '100DH', 449.00, 'each', true, true, ARRAY['double-hung', 'fibrex', 'energy-star'], 'White', 'Fibrex', 'https://images.andersenwindows.com/100-doublehung.jpg', '{"width": "36 in", "height": "48 in", "u_factor": 0.27}'),
      (v_cat_id, 'Milgard Tuscany Double-Hung', 'Milgard', 'TUSCANY', 369.00, 'each', true, false, ARRAY['double-hung', 'vinyl', 'west-coast'], 'White', 'Vinyl', 'https://images.milgard.com/tuscany-dh.jpg', '{"width": "36 in", "height": "48 in"}'),
      -- Wood
      (v_cat_id, 'Marvin Essential Double-Hung', 'Marvin', 'ESSDH', 699.00, 'each', true, true, ARRAY['double-hung', 'wood', 'fiberglass-exterior', 'premium'], 'Various', 'Wood/Fiberglass', 'https://images.marvin.com/essential-dh.jpg', '{"width": "36 in", "height": "48 in"}'),
      (v_cat_id, 'Pella Reserve Traditional', 'Pella', 'RESERVEDH', 899.00, 'each', false, true, ARRAY['double-hung', 'wood', 'premium', 'traditional'], 'Various', 'Solid Wood', 'https://images.pella.com/reserve-dh.jpg', '{"width": "36 in", "height": "48 in"}'),
      (v_cat_id, 'Andersen E-Series Double-Hung', 'Andersen', 'ESERIESDH', 799.00, 'each', false, true, ARRAY['double-hung', 'wood', 'aluminum-clad'], 'Various', 'Wood/Aluminum', 'https://images.andersenwindows.com/eseries-dh.jpg', '{"width": "36 in", "height": "48 in"}'),
      -- Casement
      (v_cat_id, 'Andersen 400 Series Casement', 'Andersen', '400CAS', 549.00, 'each', true, true, ARRAY['casement', 'wood', 'popular'], 'Various', 'Wood/Vinyl', 'https://images.andersenwindows.com/400-casement.jpg', '{"width": "28 in", "height": "48 in"}'),
      (v_cat_id, 'Pella Impervia Casement', 'Pella', 'IMPCAS', 499.00, 'each', true, false, ARRAY['casement', 'fiberglass', 'energy-efficient'], 'Various', 'Fiberglass', 'https://images.pella.com/impervia-cas.jpg', '{"width": "28 in", "height": "48 in"}'),
      -- Picture/Fixed
      (v_cat_id, 'Marvin Modern Picture Window', 'Marvin', 'MODPIC', 1299.00, 'each', false, true, ARRAY['picture', 'modern', 'large', 'premium'], 'Various', 'Wood/Aluminum', 'https://images.marvin.com/modern-picture.jpg', '{"width": "72 in", "height": "60 in"}'),
      -- Awning
      (v_cat_id, 'Milgard Style Line Awning', 'Milgard', 'SLAWN', 329.00, 'each', true, false, ARRAY['awning', 'vinyl', 'bathroom', 'basement'], 'White', 'Vinyl', 'https://images.milgard.com/styleline-awn.jpg', '{"width": "36 in", "height": "24 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 15. TILE - BACKSPLASH
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Backsplash' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Subway Tile
      (v_cat_id, 'Daltile Rittenhouse Square 3x6', 'Daltile', 'K1636MOD', 4.99, 'sqft', true, true, ARRAY['subway', 'white', 'glossy', 'classic', 'popular'], 'Glossy', 'Ceramic', 'https://images.daltile.com/rittenhouse-white.jpg', '{"size": "3x6 in"}'),
      (v_cat_id, 'MSI Arctic Ice 3x6 Subway', 'MSI', 'SMOT-GL-T-AI36', 12.99, 'sqft', true, true, ARRAY['subway', 'glass', 'white', 'modern'], 'Glossy', 'Glass', 'https://images.msistone.com/arctic-ice.jpg', '{"size": "3x6 in"}'),
      (v_cat_id, 'Bedrosians Cloe 2.5x8 Subway', 'Bedrosians', 'CLOE0258', 14.99, 'sqft', true, true, ARRAY['subway', 'handmade-look', 'zellige', 'artisan'], 'Glossy', 'Ceramic', 'https://images.bedrosians.com/cloe.jpg', '{"size": "2.5x8 in"}'),
      -- Mosaic
      (v_cat_id, 'Jeffrey Court 12" Hex Mosaic', 'Jeffrey Court', 'HC12', 15.99, 'sqft', true, false, ARRAY['mosaic', 'hexagon', 'marble', 'geometric'], 'Polished', 'Marble', 'https://images.jeffreycourt.com/hex-marble.jpg', '{"size": "2 in hex"}'),
      (v_cat_id, 'MSI Calacatta Gold Basketweave', 'MSI', 'SMOT-CAL-BWP', 19.99, 'sqft', false, true, ARRAY['mosaic', 'basketweave', 'marble', 'classic'], 'Polished', 'Marble', 'https://images.msistone.com/calacatta-bw.jpg', '{"pattern": "basketweave"}'),
      (v_cat_id, 'Soci Penny Round White', 'Soci', 'SSC-1304', 12.99, 'sqft', true, false, ARRAY['mosaic', 'penny-round', 'white', 'retro'], 'Matte', 'Porcelain', 'https://images.soci.com/penny-white.jpg', '{"size": "0.75 in round"}'),
      -- Patterned
      (v_cat_id, 'Merola Tile Twenties Vintage', 'Merola', 'FTC2VWHT', 8.99, 'sqft', true, true, ARRAY['patterned', 'encaustic-look', 'vintage', 'popular'], 'Matte', 'Ceramic', 'https://images.merolatile.com/twenties.jpg', '{"size": "7.75x7.75 in"}'),
      (v_cat_id, 'Bedrosians Cementine 8x8', 'Bedrosians', 'CEMENT0808', 11.99, 'sqft', true, false, ARRAY['patterned', 'cement-look', 'modern'], 'Matte', 'Porcelain', 'https://images.bedrosians.com/cementine.jpg', '{"size": "8x8 in"}'),
      -- Natural Stone
      (v_cat_id, 'MSI Carrara White 4x12 Honed', 'MSI', 'TCARWHT412H', 14.99, 'sqft', true, true, ARRAY['marble', 'carrara', 'honed', 'natural'], 'Honed', 'Marble', 'https://images.msistone.com/carrara-4x12.jpg', '{"size": "4x12 in"}'),
      (v_cat_id, 'Jeffrey Court Tundra Grey Stack', 'Jeffrey Court', 'TGS612', 18.99, 'sqft', false, false, ARRAY['marble', 'grey', 'stacked', 'contemporary'], 'Honed', 'Marble', 'https://images.jeffreycourt.com/tundra-stack.jpg', '{"size": "6x12 in"}'),
      -- Metallic
      (v_cat_id, 'Aspect Peel & Stick Metal', 'Aspect', 'A9550', 9.99, 'sqft', true, false, ARRAY['metal', 'peel-stick', 'brushed-nickel', 'diy'], 'Brushed', 'Aluminum', 'https://images.aspecttile.com/metal-bn.jpg', '{"size": "3x6 in", "peel_stick": true}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Update all existing items to have placeholder images if missing
UPDATE v2_selection_catalog
SET image_url = 'https://placehold.co/400x300/e2e8f0/64748b?text=' || REPLACE(SUBSTRING(name, 1, 20), ' ', '+')
WHERE image_url IS NULL;

-- ============================================================
-- 16. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_selection_catalog IS 'Comprehensive product catalog with images and specifications';
