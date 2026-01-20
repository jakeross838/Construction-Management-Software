-- Migration 092: More Catalog Products
-- Additional products for all remaining categories

-- ============================================================
-- 1. DOOR HARDWARE
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Door Hardware' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url) VALUES
      -- Schlage
      (v_cat_id, 'Schlage Encode Smart Deadbolt', 'Schlage', 'BE489WB', 299.00, 'each', true, true, ARRAY['smart', 'deadbolt', 'keyless', 'wifi', 'popular'], 'Satin Nickel', 'Metal', 'https://images.schlage.com/encode-be489.jpg'),
      (v_cat_id, 'Schlage Century Handleset', 'Schlage', 'F60CEN619', 249.00, 'each', true, true, ARRAY['handleset', 'entry', 'traditional'], 'Satin Nickel', 'Metal', 'https://images.schlage.com/century-f60.jpg'),
      (v_cat_id, 'Schlage Bowery Privacy Knob', 'Schlage', 'F40BWE619', 39.00, 'each', true, false, ARRAY['knob', 'privacy', 'bedroom', 'bathroom'], 'Satin Nickel', 'Metal', 'https://images.schlage.com/bowery-f40.jpg'),
      (v_cat_id, 'Schlage Accent Lever Passage', 'Schlage', 'F10ACC619', 35.00, 'each', true, false, ARRAY['lever', 'passage', 'hallway'], 'Satin Nickel', 'Metal', 'https://images.schlage.com/accent-f10.jpg'),
      -- Kwikset
      (v_cat_id, 'Kwikset Halo Smart Lock', 'Kwikset', '99390-001', 229.00, 'each', true, true, ARRAY['smart', 'deadbolt', 'keyless', 'wifi'], 'Satin Nickel', 'Metal', 'https://images.kwikset.com/halo-99390.jpg'),
      (v_cat_id, 'Kwikset Halifax Entry Lever', 'Kwikset', '740HFL', 79.00, 'each', true, false, ARRAY['lever', 'entry', 'modern'], 'Satin Nickel', 'Metal', 'https://images.kwikset.com/halifax-740.jpg'),
      (v_cat_id, 'Kwikset Tustin Privacy Lever', 'Kwikset', '300T', 29.00, 'each', true, false, ARRAY['lever', 'privacy', 'budget-friendly'], 'Satin Nickel', 'Metal', 'https://images.kwikset.com/tustin-300t.jpg'),
      -- Emtek (Premium)
      (v_cat_id, 'Emtek Baden Entry Set', 'Emtek', '4812', 599.00, 'each', false, true, ARRAY['handleset', 'entry', 'premium', 'modern'], 'Satin Brass', 'Solid Brass', 'https://images.emtek.com/baden-4812.jpg'),
      (v_cat_id, 'Emtek Stuttgart Lever', 'Emtek', '520STUSB', 189.00, 'each', false, true, ARRAY['lever', 'modern', 'premium'], 'Satin Brass', 'Solid Brass', 'https://images.emtek.com/stuttgart.jpg'),
      -- Baldwin (Luxury)
      (v_cat_id, 'Baldwin Estate Beverly Knob', 'Baldwin', '5025.030', 299.00, 'each', false, true, ARRAY['knob', 'traditional', 'luxury'], 'Polished Brass', 'Solid Brass', 'https://images.baldwin.com/beverly-5025.jpg'),
      (v_cat_id, 'Baldwin Reserve Santa Cruz', 'Baldwin', 'FD.SCR', 449.00, 'each', false, true, ARRAY['handleset', 'contemporary', 'luxury'], 'Satin Nickel', 'Solid Brass', 'https://images.baldwin.com/santacruz.jpg')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 2. FIREPLACES
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Fireplace' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, specifications) VALUES
      -- Gas Fireplaces
      (v_cat_id, 'Napoleon Ascent 36" Linear Gas', 'Napoleon', 'BL36NTE', 2499.00, 'each', true, true, ARRAY['gas', 'linear', 'modern', 'popular'], 'Black', 'Steel', 'https://images.napoleon.com/bl36nte.jpg', '{"btu": 30000, "width": "36 in", "fuel": "natural_gas"}'),
      (v_cat_id, 'Heat & Glo 6000 Modern', 'Heat & Glo', '6000MOD', 3299.00, 'each', true, true, ARRAY['gas', 'modern', 'clean-face'], 'Black', 'Steel', 'https://images.heatnglo.com/6000mod.jpg', '{"btu": 35000, "width": "42 in"}'),
      (v_cat_id, 'Majestic Quartz 36" Direct Vent', 'Majestic', '?"LDVT', 1899.00, 'each', true, false, ARRAY['gas', 'traditional', 'direct-vent'], 'Black', 'Steel', 'https://images.majesticproducts.com/quartz36.jpg', '{"btu": 25000, "width": "36 in"}'),
      (v_cat_id, 'Regency Horizon HZ54E', 'Regency', 'HZ54E', 4999.00, 'each', false, true, ARRAY['gas', 'linear', 'large', 'premium'], 'Black', 'Steel', 'https://images.regency-fire.com/hz54e.jpg', '{"btu": 45000, "width": "54 in"}'),
      -- Electric Fireplaces
      (v_cat_id, 'Dimplex Ignite XL 50"', 'Dimplex', 'XLF50', 1299.00, 'each', true, true, ARRAY['electric', 'linear', 'modern', 'popular'], 'Black', 'Steel/Glass', 'https://images.dimplex.com/xlf50.jpg', '{"width": "50 in", "fuel": "electric"}'),
      (v_cat_id, 'SimpliFire Scion 55"', 'SimpliFire', 'SF-SC55', 1599.00, 'each', true, false, ARRAY['electric', 'linear', 'wall-mount'], 'Black', 'Steel', 'https://images.simplifireallusion.com/sc55.jpg', '{"width": "55 in"}'),
      (v_cat_id, 'Touchstone Sideline Elite 50"', 'Touchstone', '80036', 799.00, 'each', true, false, ARRAY['electric', 'recessed', 'budget-friendly'], 'Black', 'Steel', 'https://images.touchstonehomeproducts.com/80036.jpg', '{"width": "50 in"}'),
      -- Wood Burning
      (v_cat_id, 'Regency F2500 Wood Stove', 'Regency', 'F2500', 2499.00, 'each', false, true, ARRAY['wood', 'stove', 'freestanding', 'traditional'], 'Black', 'Cast Iron', 'https://images.regency-fire.com/f2500.jpg', '{"btu": 75000, "fuel": "wood"}'),
      -- Fireplace Surrounds
      (v_cat_id, 'Pearl Mantels 540 Marshall', 'Pearl Mantels', '540-60', 599.00, 'each', true, true, ARRAY['surround', 'mantel', 'traditional', 'wood'], 'Unfinished', 'Solid Wood', 'https://images.pearlmantels.com/540-60.jpg', '{"width": "60 in"}'),
      (v_cat_id, 'Ekena Millwork Moderne Surround', 'Ekena', 'MNTSM', 399.00, 'each', true, false, ARRAY['surround', 'modern', 'mdf'], 'Primed', 'MDF', 'https://images.ekenafactory.com/moderne.jpg', '{"width": "60 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 3. TRIM/MOLDING
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Trim/Molding' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Baseboards
      (v_cat_id, 'Metrie 5-1/4" Colonial Base', 'Metrie', 'PFJ514', 2.99, 'linear ft', true, true, ARRAY['baseboard', 'colonial', 'traditional', 'popular'], 'Primed', 'MDF', 'https://images.metrie.com/colonial-base.jpg', '{"height": "5.25 in", "thickness": "0.5 in"}'),
      (v_cat_id, 'Metrie 4-1/4" Modern Base', 'Metrie', 'MFJ414', 2.49, 'linear ft', true, true, ARRAY['baseboard', 'modern', 'flat', 'popular'], 'Primed', 'MDF', 'https://images.metrie.com/modern-base.jpg', '{"height": "4.25 in", "thickness": "0.5 in"}'),
      (v_cat_id, 'Metrie 3-1/4" Craftsman Base', 'Metrie', 'CFJ314', 1.99, 'linear ft', true, false, ARRAY['baseboard', 'craftsman', 'arts-crafts'], 'Primed', 'MDF', 'https://images.metrie.com/craftsman-base.jpg', '{"height": "3.25 in"}'),
      (v_cat_id, 'WindsorONE 7-1/4" S4S Base', 'WindsorONE', 'WO714', 4.99, 'linear ft', false, true, ARRAY['baseboard', 'tall', 'premium', 'wood'], 'Primed', 'Pine', 'https://images.windsorone.com/s4s-base.jpg', '{"height": "7.25 in"}'),
      -- Crown Molding
      (v_cat_id, 'Metrie 4-5/8" Crown Molding', 'Metrie', 'CRWN458', 3.49, 'linear ft', true, true, ARRAY['crown', 'traditional', 'popular'], 'Primed', 'MDF', 'https://images.metrie.com/crown-458.jpg', '{"projection": "4.625 in"}'),
      (v_cat_id, 'Metrie 3-1/2" Simple Crown', 'Metrie', 'CRWN312', 2.49, 'linear ft', true, false, ARRAY['crown', 'simple', 'transitional'], 'Primed', 'MDF', 'https://images.metrie.com/crown-312.jpg', '{"projection": "3.5 in"}'),
      (v_cat_id, 'Ornamental Mouldings 6" Crown', 'Ornamental', '1027-6', 5.99, 'linear ft', false, true, ARRAY['crown', 'ornate', 'traditional', 'premium'], 'Primed', 'Polyurethane', 'https://images.ornamentalmouldings.com/1027-6.jpg', '{"projection": "6 in"}'),
      -- Casing
      (v_cat_id, 'Metrie 2-1/4" Colonial Casing', 'Metrie', 'CAS214C', 1.29, 'linear ft', true, true, ARRAY['casing', 'door', 'window', 'colonial'], 'Primed', 'MDF', 'https://images.metrie.com/casing-colonial.jpg', '{"width": "2.25 in"}'),
      (v_cat_id, 'Metrie 3-1/2" Craftsman Casing', 'Metrie', 'CAS312CR', 1.99, 'linear ft', true, true, ARRAY['casing', 'craftsman', 'flat', 'popular'], 'Primed', 'MDF', 'https://images.metrie.com/casing-craftsman.jpg', '{"width": "3.5 in"}'),
      -- Chair Rail
      (v_cat_id, 'Metrie 2-1/2" Chair Rail', 'Metrie', 'CHR212', 1.79, 'linear ft', true, false, ARRAY['chair-rail', 'traditional'], 'Primed', 'MDF', 'https://images.metrie.com/chair-rail.jpg', '{"height": "2.5 in"}'),
      -- Shiplap/Wainscoting
      (v_cat_id, 'UFP-Edge 5-1/2" Shiplap', 'UFP-Edge', 'SHIP55', 3.99, 'linear ft', true, true, ARRAY['shiplap', 'farmhouse', 'wall', 'popular'], 'Primed', 'Pine', 'https://images.ufp-edge.com/shiplap.jpg', '{"width": "5.5 in"}'),
      (v_cat_id, 'Metrie Beadboard Panel 32x48"', 'Metrie', 'BEAD3248', 29.99, 'each', true, false, ARRAY['beadboard', 'wainscoting', 'traditional'], 'Primed', 'MDF', 'https://images.metrie.com/beadboard.jpg', '{"width": "32 in", "height": "48 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 4. SHOWER ENCLOSURES
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Shower Enclosures' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Frameless
      (v_cat_id, 'DreamLine Unidoor-X 58" Hinged', 'DreamLine', 'SHDR-24587', 1299.00, 'each', true, true, ARRAY['frameless', 'hinged', 'walk-in', 'popular'], 'Brushed Nickel', 'Clear Glass', 'https://images.dreamline.com/unidoor-x.jpg', '{"width": "58 in", "height": "72 in", "glass": "3/8 in"}'),
      (v_cat_id, 'Kohler Levity 60" Sliding', 'Kohler', 'K-706015-L-ABZ', 1799.00, 'each', true, true, ARRAY['frameless', 'sliding', 'bypass', 'popular'], 'Bronze', 'Clear Glass', 'https://images.us.kohler.com/levity.jpg', '{"width": "60 in", "height": "74 in"}'),
      (v_cat_id, 'DreamLine Elegance-LS 46" Pivot', 'DreamLine', 'SHDR-4346', 999.00, 'each', true, false, ARRAY['frameless', 'pivot', 'corner'], 'Chrome', 'Clear Glass', 'https://images.dreamline.com/elegance-ls.jpg', '{"width": "46 in", "height": "72 in"}'),
      (v_cat_id, 'Aston Langham 60" Sliding', 'Aston', 'SDR978', 1599.00, 'each', false, true, ARRAY['frameless', 'sliding', 'premium'], 'Chrome', 'Clear Glass', 'https://images.?"astonglobal.com/langham.jpg', '{"width": "60 in", "height": "75 in"}'),
      -- Semi-Frameless
      (v_cat_id, 'DreamLine Flex 36" Corner', 'DreamLine', 'DL-6717', 699.00, 'each', true, false, ARRAY['semi-frameless', 'corner', 'pivot', 'budget-friendly'], 'Chrome', 'Clear Glass', 'https://images.dreamline.com/flex.jpg', '{"width": "36 in", "height": "72 in"}'),
      (v_cat_id, 'Delta Lyndall 60" Sliding', 'Delta', 'SD3276551', 549.00, 'each', true, false, ARRAY['semi-frameless', 'sliding', 'value'], 'Nickel', 'Clear Glass', 'https://images.deltafaucet.com/lyndall.jpg', '{"width": "60 in", "height": "71 in"}'),
      -- Fixed Panel
      (v_cat_id, 'DreamLine Linea 34" Fixed Panel', 'DreamLine', 'SHDR-3234', 399.00, 'each', true, true, ARRAY['fixed', 'walk-in', 'modern', 'open'], 'Chrome', 'Clear Glass', 'https://images.dreamline.com/linea.jpg', '{"width": "34 in", "height": "72 in"}'),
      -- Tub Doors
      (v_cat_id, 'DreamLine Aqua 60" Tub Door', 'DreamLine', 'SHDR-3260', 499.00, 'each', true, false, ARRAY['tub', 'sliding', 'frameless'], 'Chrome', 'Clear Glass', 'https://images.dreamline.com/aqua-tub.jpg', '{"width": "60 in", "height": "58 in"}'),
      (v_cat_id, 'Kohler Revel 60" Tub Door', 'Kohler', 'K-707206', 599.00, 'each', true, false, ARRAY['tub', 'sliding', 'frameless'], 'Nickel', 'Clear Glass', 'https://images.us.kohler.com/revel-tub.jpg', '{"width": "60 in", "height": "55 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 5. MIRRORS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Mirrors' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Vanity Mirrors
      (v_cat_id, 'Delta 24x30 Frameless Mirror', 'Delta', 'DL-FM2430', 129.00, 'each', true, false, ARRAY['vanity', 'frameless', 'rectangular', 'budget-friendly'], 'Clear', 'Glass', 'https://images.deltafaucet.com/mirror-2430.jpg', '{"width": "24 in", "height": "30 in"}'),
      (v_cat_id, 'Kohler Verdera 34" Lighted Mirror', 'Kohler', 'K-99010-TL', 599.00, 'each', true, true, ARRAY['vanity', 'lighted', 'modern', 'popular'], 'Aluminum', 'Glass/LED', 'https://images.us.kohler.com/verdera.jpg', '{"width": "34 in", "height": "33 in", "lighted": true}'),
      (v_cat_id, 'Pottery Barn Classic 36" Round', 'Pottery Barn', 'PB-CM36', 299.00, 'each', true, true, ARRAY['round', 'framed', 'classic'], 'Bronze', 'Glass/Metal', 'https://images.potterybarn.com/classic-round.jpg', '{"diameter": "36 in"}'),
      (v_cat_id, 'West Elm Metal Framed 30x40', 'West Elm', 'WE-MF3040', 249.00, 'each', true, false, ARRAY['rectangular', 'framed', 'modern'], 'Antique Brass', 'Glass/Metal', 'https://images.westelm.com/metal-framed.jpg', '{"width": "30 in", "height": "40 in"}'),
      -- Medicine Cabinets
      (v_cat_id, 'Kohler Verdera 24" Medicine Cabinet', 'Kohler', 'K-99006-NA', 499.00, 'each', true, true, ARRAY['medicine-cabinet', 'recessed', 'aluminum'], 'Aluminum', 'Glass/Metal', 'https://images.us.kohler.com/verdera-mc.jpg', '{"width": "24 in", "height": "30 in"}'),
      (v_cat_id, 'Robern PL 30" Medicine Cabinet', 'Robern', 'PL3030', 899.00, 'each', false, true, ARRAY['medicine-cabinet', 'recessed', 'premium'], 'Mirrored', 'Glass/Aluminum', 'https://images.?"?"robern.?"?"?"?"com/pl3030.jpg', '{"width": "30 in", "height": "30 in"}'),
      -- Full Length
      (v_cat_id, 'IKEA HOVET 78" Full Length', 'IKEA', 'HOVET', 149.00, 'each', true, false, ARRAY['full-length', 'wall', 'budget-friendly'], 'Aluminum', 'Glass', 'https://images.ikea.com/hovet.jpg', '{"width": "31 in", "height": "78 in"}'),
      -- LED Backlit
      (v_cat_id, 'Keonjinn 36x28 LED Bathroom Mirror', 'Keonjinn', 'KJ-LED3628', 199.00, 'each', true, true, ARRAY['led', 'backlit', 'modern', 'anti-fog'], 'Frameless', 'Glass/LED', 'https://images.keonjinn.com/led-3628.jpg', '{"width": "36 in", "height": "28 in", "lighted": true}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 6. WINDOW TREATMENTS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Window Treatments' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, specifications) VALUES
      -- Blinds
      (v_cat_id, 'Levolor 2" Faux Wood Blinds', 'Levolor', 'LV-FW2', 79.00, 'each', true, true, ARRAY['blinds', 'faux-wood', '2-inch', 'popular'], 'White', 'Faux Wood', 'https://images.levolor.com/faux-wood.jpg', '{"slat_size": "2 in", "custom": true}'),
      (v_cat_id, 'Bali 2-1/2" Real Wood Blinds', 'Bali', 'BALI-RW25', 149.00, 'each', true, false, ARRAY['blinds', 'wood', '2.5-inch', 'premium'], 'Various', 'Basswood', 'https://images.?"?"baliblinds.com/real-wood.jpg', '{"slat_size": "2.5 in"}'),
      -- Cellular Shades
      (v_cat_id, 'Levolor Cellular Single Cell', 'Levolor', 'LV-CELL1', 99.00, 'each', true, true, ARRAY['cellular', 'honeycomb', 'energy-efficient', 'popular'], 'White', 'Fabric', 'https://images.levolor.com/cellular.jpg', '{"cell_size": "0.375 in", "light_filtering": true}'),
      (v_cat_id, 'Hunter Douglas Duette', 'Hunter Douglas', 'HD-DUETTE', 299.00, 'each', false, true, ARRAY['cellular', 'honeycomb', 'premium', 'energy-efficient'], 'Various', 'Fabric', 'https://images.hunterdouglas.com/duette.jpg', '{"cell_size": "0.75 in"}'),
      -- Roller Shades
      (v_cat_id, 'Levolor Roller Shade Light Filtering', 'Levolor', 'LV-RL-LF', 69.00, 'each', true, false, ARRAY['roller', 'light-filtering', 'modern'], 'White', 'Polyester', 'https://images.levolor.com/roller-lf.jpg', '{"light_filtering": true}'),
      (v_cat_id, 'Lutron Serena Smart Shade', 'Lutron', 'SERENA', 449.00, 'each', false, true, ARRAY['roller', 'smart', 'motorized', 'premium'], 'Various', 'Fabric', 'https://images.lutron.com/serena.jpg', '{"motorized": true, "smart": true}'),
      -- Roman Shades
      (v_cat_id, 'Bali Natural Roman Shade', 'Bali', 'BALI-ROM', 179.00, 'each', true, false, ARRAY['roman', 'natural', 'woven'], 'Natural', 'Woven Grass', 'https://images.baliblinds.com/roman.jpg', '{"style": "waterfall"}'),
      -- Shutters
      (v_cat_id, 'Sunland 3.5" Plantation Shutters', 'Sunland', 'SL-PS35', 35.00, 'sqft', true, true, ARRAY['shutters', 'plantation', '3.5-inch', 'popular'], 'White', 'Composite', 'https://images.sunlandshutters.com/plantation.jpg', '{"louver_size": "3.5 in"}'),
      (v_cat_id, 'Norman 4.5" Wood Shutters', 'Norman', 'NORM-WS45', 55.00, 'sqft', false, true, ARRAY['shutters', 'wood', 'premium', '4.5-inch'], 'Various', 'Basswood', 'https://images.?"?"?"normanshutters.com/wood.jpg', '{"louver_size": "4.5 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 7. GARAGE DOORS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Garage Doors' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, dimensions) VALUES
      -- Steel
      (v_cat_id, 'Clopay Classic 16x7 Steel', 'Clopay', 'CL-4050', 899.00, 'each', true, false, ARRAY['steel', 'insulated', 'traditional', 'budget-friendly'], 'White', 'Steel', 'https://images.?"?"?"clopay.com/classic.jpg', '{"width": "16 ft", "height": "7 ft", "r_value": 12}'),
      (v_cat_id, 'Clopay Gallery 16x7 Steel', 'Clopay', 'CL-GALLERY', 1499.00, 'each', true, true, ARRAY['steel', 'insulated', 'carriage', 'popular'], 'Various', 'Steel', 'https://images.clopay.com/gallery.jpg', '{"width": "16 ft", "height": "7 ft", "r_value": 18}'),
      (v_cat_id, 'Amarr Stratford 16x7', 'Amarr', 'AM-STRAT', 1199.00, 'each', true, false, ARRAY['steel', 'insulated', 'traditional'], 'White', 'Steel', 'https://images.amarr.com/stratford.jpg', '{"width": "16 ft", "height": "7 ft"}'),
      -- Carriage House
      (v_cat_id, 'Clopay Coachman 16x7', 'Clopay', 'CL-COACH', 2299.00, 'each', true, true, ARRAY['carriage', 'insulated', 'farmhouse', 'popular'], 'Walnut', 'Steel/Composite', 'https://images.clopay.com/coachman.jpg', '{"width": "16 ft", "height": "7 ft", "r_value": 18}'),
      (v_cat_id, 'Wayne Dalton 9700 Carriage', 'Wayne Dalton', 'WD-9700', 2799.00, 'each', false, true, ARRAY['carriage', 'wood-look', 'premium'], 'Various', 'Steel', 'https://images.wayne-dalton.com/9700.jpg', '{"width": "16 ft", "height": "7 ft"}'),
      -- Modern/Contemporary
      (v_cat_id, 'Clopay Avante 16x7 Full View', 'Clopay', 'CL-AVANTE', 3499.00, 'each', false, true, ARRAY['modern', 'glass', 'aluminum', 'contemporary'], 'Bronze', 'Aluminum/Glass', 'https://images.clopay.com/avante.jpg', '{"width": "16 ft", "height": "7 ft", "glass": true}'),
      (v_cat_id, 'Northwest Door Modern Tech', 'Northwest Door', 'NW-MTECH', 4999.00, 'each', false, true, ARRAY['modern', 'flush', 'premium', 'luxury'], 'Various', 'Aluminum', 'https://images.?"?"nwdusa.com/modern-tech.jpg', '{"width": "16 ft", "height": "8 ft"}'),
      -- Wood
      (v_cat_id, 'Clopay Reserve Wood 16x7', 'Clopay', 'CL-RESERVE', 5999.00, 'each', false, true, ARRAY['wood', 'custom', 'luxury', 'handcrafted'], 'Various', 'Solid Wood', 'https://images.clopay.com/reserve.jpg', '{"width": "16 ft", "height": "7 ft", "material": "hemlock"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 8. WASHER/DRYER
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Washer/Dryer' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, image_url, specifications) VALUES
      -- Front Load Washers
      (v_cat_id, 'LG 5.0 Cu Ft Front Load Washer', 'LG', 'WM4000HWA', 999.00, 'each', true, true, ARRAY['front-load', 'smart', 'steam', 'popular'], 'White', 'https://images.lg.com/wm4000hwa.jpg', '{"capacity": "5.0 cu ft", "smart": true, "steam": true}'),
      (v_cat_id, 'Samsung 5.0 Cu Ft AddWash', 'Samsung', 'WF50R8500AW', 1099.00, 'each', true, true, ARRAY['front-load', 'smart', 'addwash'], 'White', 'https://images.samsung.com/wf50r8500.jpg', '{"capacity": "5.0 cu ft", "addwash": true}'),
      (v_cat_id, 'GE Profile 5.3 Cu Ft UltraFresh', 'GE Profile', 'PFW950SPTDS', 1399.00, 'each', false, true, ARRAY['front-load', 'smart', 'ultrafresh', 'premium'], 'Diamond Gray', 'https://images.ge.com/pfw950.jpg', '{"capacity": "5.3 cu ft", "odor_block": true}'),
      -- Dryers
      (v_cat_id, 'LG 7.4 Cu Ft Electric Dryer', 'LG', 'DLEX4000W', 999.00, 'each', true, true, ARRAY['electric', 'smart', 'steam', 'popular'], 'White', 'https://images.lg.com/dlex4000.jpg', '{"capacity": "7.4 cu ft", "smart": true}'),
      (v_cat_id, 'Samsung 7.5 Cu Ft Electric Dryer', 'Samsung', 'DVE50R8500W', 1099.00, 'each', true, false, ARRAY['electric', 'smart', 'sensor-dry'], 'White', 'https://images.samsung.com/dve50r8500.jpg', '{"capacity": "7.5 cu ft"}'),
      -- Stackable/Combo
      (v_cat_id, 'LG WashTower Stacked Unit', 'LG', 'WKEX200HWA', 2399.00, 'pair', true, true, ARRAY['stacked', 'smart', 'washtower', 'space-saving'], 'White', 'https://images.lg.com/washtower.jpg', '{"washer": "4.5 cu ft", "dryer": "7.4 cu ft"}'),
      (v_cat_id, 'GE 24" Stackable Washer/Dryer', 'GE', 'GFW148SSMWW', 1599.00, 'pair', true, false, ARRAY['compact', 'stackable', 'ventless'], 'White', 'https://images.ge.com/gfw148.jpg', '{"washer": "2.4 cu ft", "dryer": "4.1 cu ft", "ventless": true}'),
      -- Top Load
      (v_cat_id, 'LG 5.5 Cu Ft Top Load Washer', 'LG', 'WT7400CW', 899.00, 'each', true, false, ARRAY['top-load', 'smart', 'turbo-wash'], 'White', 'https://images.lg.com/wt7400.jpg', '{"capacity": "5.5 cu ft"}'),
      (v_cat_id, 'Maytag 5.3 Cu Ft Top Load', 'Maytag', 'MVW7232HW', 999.00, 'each', true, false, ARRAY['top-load', 'extra-power', 'deep-fill'], 'White', 'https://images.maytag.com/mvw7232.jpg', '{"capacity": "5.3 cu ft"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 9. DECKING
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Decking' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, specifications) VALUES
      -- Composite
      (v_cat_id, 'Trex Transcend 1x6x16', 'Trex', 'TRANS16', 4.50, 'linear ft', true, true, ARRAY['composite', 'capped', 'premium', 'popular'], 'Various', 'Composite', 'https://images.trex.com/transcend.jpg', '{"width": "5.5 in", "length": "16 ft", "warranty": "25 year"}'),
      (v_cat_id, 'Trex Select 1x6x16', 'Trex', 'SELECT16', 3.00, 'linear ft', true, false, ARRAY['composite', 'value', 'fade-resistant'], 'Various', 'Composite', 'https://images.trex.com/select.jpg', '{"width": "5.5 in", "length": "16 ft"}'),
      (v_cat_id, 'TimberTech AZEK Vintage', 'TimberTech', 'TT-VINTAGE', 5.50, 'linear ft', false, true, ARRAY['composite', 'pvc', 'premium', 'luxury'], 'Various', 'PVC', 'https://images.timbertech.com/vintage.jpg', '{"width": "5.5 in", "material": "capped_pvc"}'),
      (v_cat_id, 'Fiberon Good Life', 'Fiberon', 'FB-GOODLIFE', 2.75, 'linear ft', true, false, ARRAY['composite', 'budget-friendly', 'good-value'], 'Various', 'Composite', 'https://images.fiberondecking.com/goodlife.jpg', '{"width": "5.5 in"}'),
      -- Wood
      (v_cat_id, 'Pressure Treated Pine 2x6x16', 'Generic', 'PT-2616', 1.25, 'linear ft', true, false, ARRAY['wood', 'pressure-treated', 'budget-friendly'], 'Natural', 'Southern Pine', 'https://images.homedepot.com/pt-decking.jpg', '{"width": "5.5 in", "length": "16 ft"}'),
      (v_cat_id, 'Cedar 2x6x16 Decking', 'Generic', 'CEDAR-2616', 2.75, 'linear ft', true, false, ARRAY['wood', 'cedar', 'natural', 'aromatic'], 'Natural', 'Western Red Cedar', 'https://images.homedepot.com/cedar-decking.jpg', '{"width": "5.5 in"}'),
      (v_cat_id, 'Ipe Brazilian Hardwood 1x6', 'Generic', 'IPE-16', 6.00, 'linear ft', false, true, ARRAY['wood', 'ipe', 'premium', 'hardwood'], 'Natural', 'Ipe', 'https://images.advantagelumber.com/ipe.jpg', '{"width": "5.5 in", "hardness": "3680 janka"}'),
      -- Deck Tiles
      (v_cat_id, 'Kontiki Composite Deck Tiles', 'Kontiki', 'KT-TILE', 5.99, 'sqft', true, false, ARRAY['tile', 'modular', 'diy', 'rooftop'], 'Teak', 'Composite', 'https://images.builddirect.com/kontiki.jpg', '{"size": "12x12 in", "interlocking": true}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 10. OUTDOOR LIGHTING
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Outdoor Lighting' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, specifications) VALUES
      -- Wall Sconces
      (v_cat_id, 'Kichler Barrington 1-Light Outdoor', 'Kichler', '49714OZ', 129.00, 'each', true, true, ARRAY['wall', 'sconce', 'traditional', 'popular'], 'Olde Bronze', 'Aluminum/Glass', 'https://images.?"?"?"kichler.com/barrington.jpg', '{"height": "15 in", "width": "6 in"}'),
      (v_cat_id, 'Hinkley Atwater Medium Wall', 'Hinkley', '1144AH', 199.00, 'each', true, false, ARRAY['wall', 'coastal', 'transitional'], 'Ash Bronze', 'Aluminum/Glass', 'https://images.hinkley.com/atwater.jpg', '{"height": "14 in"}'),
      (v_cat_id, 'Modern Forms Axis LED Sconce', 'Modern Forms', 'WS-W15916', 299.00, 'each', false, true, ARRAY['wall', 'modern', 'led', 'contemporary'], 'Bronze', 'Aluminum', 'https://images.?"?"?"?"?"?"?"?"?"?"modernforms.com/axis.jpg', '{"led": true, "height": "16 in"}'),
      -- Post Lights
      (v_cat_id, 'Kichler Tournai 3-Light Post', 'Kichler', '9558LD', 349.00, 'each', true, true, ARRAY['post', 'traditional', 'elegant'], 'Londonderry', 'Aluminum', 'https://images.kichler.com/tournai.jpg', '{"height": "24 in"}'),
      (v_cat_id, 'Progress Lighting Westport Post', 'Progress', 'P5474-31', 89.00, 'each', true, false, ARRAY['post', 'traditional', 'budget-friendly'], 'Black', 'Aluminum', 'https://images.?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"progresslighting.com/westport.jpg', '{"height": "17 in"}'),
      -- Path Lights
      (v_cat_id, 'Kichler LED Path Light', 'Kichler', '15870AZT', 69.00, 'each', true, true, ARRAY['path', 'led', 'landscape', 'popular'], 'Bronze', 'Brass', 'https://images.kichler.com/path-led.jpg', '{"led": true, "height": "22 in"}'),
      (v_cat_id, 'WAC Landscape LED Path', 'WAC', '6011-30BZ', 89.00, 'each', true, false, ARRAY['path', 'led', 'modern'], 'Bronze', 'Aluminum', 'https://images.?"?"?"?"?"?"?"?"?"?"?"?"?"?"waclighting.com/path.jpg', '{"led": true}'),
      -- Flood/Security
      (v_cat_id, 'Ring Floodlight Cam Wired Pro', 'Ring', 'B08F6DWKQP', 249.00, 'each', true, true, ARRAY['flood', 'smart', 'security', 'camera'], 'White', 'Plastic', 'https://images.ring.com/floodlight-pro.jpg', '{"lumens": 2000, "camera": true, "smart": true}'),
      (v_cat_id, 'RAB Lighting LED Flood', 'RAB', 'FFLED18', 149.00, 'each', true, false, ARRAY['flood', 'led', 'commercial'], 'Bronze', 'Aluminum', 'https://images.?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"rablighting.com/ffled.jpg', '{"lumens": 1800, "led": true}'),
      -- String Lights
      (v_cat_id, 'Brightech Ambience Pro LED', 'Brightech', 'BP-LEDSTRING', 49.00, 'each', true, true, ARRAY['string', 'led', 'patio', 'popular'], 'Black', 'Plastic/Glass', 'https://images.brightech.com/ambience.jpg', '{"length": "48 ft", "bulbs": 15}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 11. ROOFING
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Roofing' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, material, image_url, specifications) VALUES
      -- Architectural Shingles
      (v_cat_id, 'GAF Timberline HDZ Charcoal', 'GAF', 'TL-HDZ-CHAR', 110.00, 'square', true, true, ARRAY['shingle', 'architectural', 'lifetime', 'popular'], 'Charcoal', 'Asphalt', 'https://images.gaf.com/timberline-hdz.jpg', '{"warranty": "lifetime", "wind_rating": "130 mph"}'),
      (v_cat_id, 'GAF Timberline HDZ Weathered Wood', 'GAF', 'TL-HDZ-WW', 110.00, 'square', true, true, ARRAY['shingle', 'architectural', 'lifetime'], 'Weathered Wood', 'Asphalt', 'https://images.gaf.com/hdz-weathered.jpg', '{"warranty": "lifetime"}'),
      (v_cat_id, 'Owens Corning Duration Onyx Black', 'Owens Corning', 'OC-DUR-ONYX', 115.00, 'square', true, false, ARRAY['shingle', 'architectural', 'surenail'], 'Onyx Black', 'Asphalt', 'https://images.owenscorning.com/duration.jpg', '{"warranty": "lifetime"}'),
      (v_cat_id, 'CertainTeed Landmark Pro', 'CertainTeed', 'CT-LPRO', 125.00, 'square', true, false, ARRAY['shingle', 'architectural', 'max-def'], 'Various', 'Asphalt', 'https://images.certainteed.com/landmark.jpg', '{"warranty": "lifetime"}'),
      -- Designer/Luxury Shingles
      (v_cat_id, 'GAF Grand Sequoia', 'GAF', 'GAF-GSEQ', 250.00, 'square', false, true, ARRAY['shingle', 'designer', 'wood-shake-look', 'premium'], 'Various', 'Asphalt', 'https://images.gaf.com/grand-sequoia.jpg', '{"warranty": "lifetime", "style": "wood_shake"}'),
      (v_cat_id, 'CertainTeed Presidential Shake', 'CertainTeed', 'CT-PRES', 275.00, 'square', false, true, ARRAY['shingle', 'designer', 'luxury'], 'Various', 'Asphalt', 'https://images.certainteed.com/presidential.jpg', '{"warranty": "50 year"}'),
      -- Metal Roofing
      (v_cat_id, 'Everlast Standing Seam Metal', 'Everlast', 'EV-SSML', 450.00, 'square', false, true, ARRAY['metal', 'standing-seam', 'premium', 'modern'], 'Various', 'Steel', 'https://images.everlast.com/standing-seam.jpg', '{"warranty": "50 year", "gauge": "24"}'),
      (v_cat_id, 'Classic Metal Roofing Oxford Shingle', 'Classic', 'CL-OXFORD', 375.00, 'square', false, true, ARRAY['metal', 'shingle', 'lifetime'], 'Various', 'Aluminum', 'https://images.classicmetalroofing.com/oxford.jpg', '{"warranty": "lifetime"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 12. ADD MORE EXTERIOR PAINT COLORS
-- ============================================================
DO $$
DECLARE
  v_cat_id UUID;
BEGIN
  SELECT id INTO v_cat_id FROM v2_selection_categories WHERE name = 'Exterior Paint' LIMIT 1;

  IF v_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, collection, color_hex, unit_price, unit, is_popular, is_featured, tags, image_url) VALUES
      -- Sherwin-Williams Exterior
      (v_cat_id, 'SW 7005 Pure White Exterior', 'Sherwin-Williams', 'Exterior', '#F3F1EA', 85.00, 'gallon', true, true, ARRAY['white', 'exterior', 'trim', 'popular'], 'https://images.sherwin-williams.com/ext-7005.jpg'),
      (v_cat_id, 'SW 7006 Extra White Exterior', 'Sherwin-Williams', 'Exterior', '#F1F0ED', 85.00, 'gallon', true, true, ARRAY['white', 'exterior', 'bright'], 'https://images.sherwin-williams.com/ext-7006.jpg'),
      (v_cat_id, 'SW 7015 Repose Gray Exterior', 'Sherwin-Williams', 'Exterior', '#C2BFB8', 85.00, 'gallon', true, false, ARRAY['gray', 'exterior', 'body'], 'https://images.sherwin-williams.com/ext-7015.jpg'),
      (v_cat_id, 'SW 7069 Iron Ore Exterior', 'Sherwin-Williams', 'Exterior', '#4A4A48', 85.00, 'gallon', true, true, ARRAY['dark', 'exterior', 'modern', 'popular'], 'https://images.sherwin-williams.com/ext-7069.jpg'),
      (v_cat_id, 'SW 6119 Antique White Exterior', 'Sherwin-Williams', 'Exterior', '#F2E6D9', 85.00, 'gallon', true, false, ARRAY['cream', 'exterior', 'traditional'], 'https://images.sherwin-williams.com/ext-6119.jpg'),
      (v_cat_id, 'SW 6244 Naval Exterior', 'Sherwin-Williams', 'Exterior', '#34495E', 85.00, 'gallon', true, true, ARRAY['navy', 'exterior', 'door', 'accent'], 'https://images.sherwin-williams.com/ext-6244.jpg'),
      (v_cat_id, 'SW 2927 Colonial Revival Green', 'Sherwin-Williams', 'Historic', '#5A6B5A', 85.00, 'gallon', false, false, ARRAY['green', 'exterior', 'historic'], 'https://images.sherwin-williams.com/ext-2927.jpg'),
      (v_cat_id, 'SW 0050 Classic French Gray', 'Sherwin-Williams', 'Historic', '#8E9A98', 85.00, 'gallon', false, false, ARRAY['gray', 'exterior', 'historic', 'blue-gray'], 'https://images.sherwin-williams.com/ext-0050.jpg'),
      -- Benjamin Moore Exterior
      (v_cat_id, 'BM OC-17 White Dove Exterior', 'Benjamin Moore', 'Exterior', '#F3EEE4', 95.00, 'gallon', true, true, ARRAY['white', 'exterior', 'popular'], 'https://images.benjaminmoore.com/ext-oc17.jpg'),
      (v_cat_id, 'BM HC-172 Revere Pewter Exterior', 'Benjamin Moore', 'Exterior', '#C4BAA8', 95.00, 'gallon', true, true, ARRAY['greige', 'exterior', 'popular'], 'https://images.benjaminmoore.com/ext-hc172.jpg'),
      (v_cat_id, 'BM 2163-10 Wrought Iron', 'Benjamin Moore', 'Exterior', '#3C3C3C', 95.00, 'gallon', true, true, ARRAY['black', 'exterior', 'modern', 'door'], 'https://images.benjaminmoore.com/ext-2163.jpg'),
      (v_cat_id, 'BM HC-158 Newburyport Blue', 'Benjamin Moore', 'Exterior', '#4A5D6E', 95.00, 'gallon', false, true, ARRAY['blue', 'exterior', 'historic', 'navy'], 'https://images.benjaminmoore.com/ext-hc158.jpg')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Update images for items without them
UPDATE v2_selection_catalog
SET image_url = 'https://placehold.co/400x300/e2e8f0/64748b?text=' || REPLACE(SUBSTRING(name, 1, 20), ' ', '+')
WHERE image_url IS NULL;

-- Mark popular items
UPDATE v2_selection_catalog SET is_popular = true WHERE times_selected >= 5;

COMMENT ON TABLE v2_selection_catalog IS 'Complete product catalog with 500+ items across all categories';
