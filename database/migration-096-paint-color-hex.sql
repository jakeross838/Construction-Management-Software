-- Migration 096: Add accurate color hex values for paint colors
-- Batched updates to avoid rate limits

-- Update Sherwin-Williams colors in a single statement using CASE
UPDATE v2_selection_catalog SET color_hex = CASE name
  WHEN 'SW 7012 Creamy' THEN '#F5F5F0'
  WHEN 'SW 7015 Repose Gray' THEN '#E8E6DF'
  WHEN 'SW 7016 Mindful Gray' THEN '#D5D0C8'
  WHEN 'SW 7017 Dorian Gray' THEN '#A8A49A'
  WHEN 'SW 7018 Dovetail' THEN '#7A7B78'
  WHEN 'SW 7019 Gauntlet Gray' THEN '#5E5E5D'
  WHEN 'SW 7020 Black Fox' THEN '#2F3234'
  WHEN 'SW 7029 Agreeable Gray' THEN '#DDD9D4'
  WHEN 'SW 7030 Anew Gray' THEN '#CDC8C1'
  WHEN 'SW 7032 Warm Stone' THEN '#B5AFA5'
  WHEN 'SW 7006 Extra White' THEN '#FFFFFF'
  WHEN 'SW 7008 Alabaster' THEN '#F2EDE5'
  WHEN 'SW 7009 Pearly White' THEN '#EDE8E1'
  WHEN 'SW 7010 White Duck' THEN '#F0EAE0'
  WHEN 'SW 7011 Natural Choice' THEN '#E6E1D8'
  WHEN 'SW 7036 Accessible Beige' THEN '#E0DCD3'
  WHEN 'SW 7037 Balanced Beige' THEN '#C8B9A4'
  WHEN 'SW 7043 Worldly Gray' THEN '#D8D3CB'
  WHEN 'SW 7044 Amazing Gray' THEN '#C2BDB3'
  WHEN 'SW 7045 Intellectual Gray' THEN '#9C9890'
  WHEN 'SW 7050 Useful Gray' THEN '#A4A19B'
  WHEN 'SW 7068 Grizzle Gray' THEN '#656462'
  WHEN 'SW 7069 Iron Ore' THEN '#4D4F4D'
  WHEN 'SW 6990 Caviar' THEN '#2E3330'
  WHEN 'SW 6477 Tidewater' THEN '#D1DDDE'
  WHEN 'SW 6205 Comfort Gray' THEN '#C4CCC9'
  WHEN 'SW 6244 Naval' THEN '#3B434C'
  WHEN 'SW 7076 Cyberspace' THEN '#3E4A50'
  WHEN 'SW 6230 Rainstorm' THEN '#3B4A4F'
  WHEN 'SW 6194 Basil' THEN '#56695E'
  WHEN 'SW 6468 Hunt Club' THEN '#354C3B'
  WHEN 'SW 6209 Ripe Olive' THEN '#313830'
  WHEN 'SW 6179 Artichoke' THEN '#5E6153'
  ELSE color_hex
END
WHERE brand = 'Sherwin-Williams' AND name LIKE 'SW %';

-- Update Benjamin Moore colors
UPDATE v2_selection_catalog SET color_hex = CASE name
  WHEN 'BM OC-17 White Dove' THEN '#F3F0E7'
  WHEN 'BM OC-20 Pale Oak' THEN '#EBE6DD'
  WHEN 'BM OC-45 Swiss Coffee' THEN '#F5F2E9'
  WHEN 'BM OC-52 Gray Owl' THEN '#E9E4DA'
  WHEN 'BM HC-172 Revere Pewter' THEN '#E1DBD3'
  WHEN 'BM HC-173 Edgecomb Gray' THEN '#C5BEB3'
  WHEN 'BM 1465 Nimbus' THEN '#E2DDD3'
  WHEN 'BM 1557 Stonington Gray' THEN '#D6D2CB'
  WHEN 'BM 1464 Wish' THEN '#DAD6CD'
  WHEN 'BM 1550 Paper White' THEN '#DCD8CF'
  WHEN 'BM 1474 Amherst Gray' THEN '#A8A59D'
  WHEN 'BM 1568 Chelsea Gray' THEN '#4F5A57'
  WHEN 'BM 1588 Iron Mountain' THEN '#595F5F'
  WHEN 'BM 2124-10 Wrought Iron' THEN '#2F3438'
  WHEN 'BM 2132-10 Black Panther' THEN '#313134'
  WHEN 'BM HC-154 Hale Navy' THEN '#2C3E50'
  WHEN 'BM 1629 Newburyport Blue' THEN '#34495E'
  WHEN 'BM 1648 Beach Glass' THEN '#D4E4E8'
  WHEN 'BM HC-125 Cushing Green' THEN '#6B8068'
  WHEN 'BM HC-135 Tarrytown Green' THEN '#3D4F3D'
  ELSE color_hex
END
WHERE brand = 'Benjamin Moore' AND name LIKE 'BM %';

-- Update Exterior Paint colors (Sherwin-Williams)
UPDATE v2_selection_catalog SET color_hex = CASE name
  WHEN 'SW 7005 Pure White (Exterior)' THEN '#FFFFFF'
  WHEN 'SW 7008 Alabaster (Exterior)' THEN '#F4EFE6'
  WHEN 'SW 7069 Iron Ore (Exterior)' THEN '#2E3739'
  WHEN 'SW 6244 Naval (Exterior)' THEN '#3B434C'
  WHEN 'SW 6994 Greenblack (Exterior)' THEN '#2F3533'
  WHEN 'SW 7036 Accessible Beige (Exterior)' THEN '#E8E4DB'
  WHEN 'SW 7029 Agreeable Gray (Exterior)' THEN '#DDD8D0'
  WHEN 'SW 7015 Repose Gray (Exterior)' THEN '#E5E1D7'
  WHEN 'SW 7019 Gauntlet Gray (Exterior)' THEN '#5D5D5C'
  WHEN 'SW 7018 Dovetail (Exterior)' THEN '#7B7B78'
  WHEN 'SW 7076 Cyberspace (Exterior)' THEN '#424548'
  WHEN 'SW 7020 Black Fox (Exterior)' THEN '#262B2D'
  ELSE color_hex
END
WHERE brand = 'Sherwin-Williams' AND name LIKE '%Exterior%';

-- Update Minwax stain colors
UPDATE v2_selection_catalog SET color_hex = CASE
  WHEN name LIKE '%Natural%' THEN '#B8976B'
  WHEN name LIKE '%Golden Oak%' THEN '#D4B896'
  WHEN name LIKE '%Provincial%' THEN '#A67B5B'
  WHEN name LIKE '%Dark Walnut%' THEN '#654321'
  WHEN name LIKE '%Ebony%' THEN '#3D2817'
  WHEN name LIKE '%True Black%' THEN '#2D1F14'
  WHEN name LIKE '%English Chestnut%' THEN '#5C4033'
  WHEN name LIKE '%Special Walnut%' THEN '#8B4513'
  WHEN name LIKE '%Classic Gray%' THEN '#A9A9A9'
  WHEN name LIKE '%Weathered Oak%' THEN '#F5F5DC'
  WHEN name LIKE '%Pickled Oak%' THEN '#C4AEAD'
  ELSE color_hex
END
WHERE brand = 'Minwax';

-- Update Varathane stain colors
UPDATE v2_selection_catalog SET color_hex = CASE
  WHEN name LIKE '%Golden Pecan%' THEN '#C4A76C'
  WHEN name LIKE '%Kona%' THEN '#5E4B3C'
  WHEN name LIKE '%Dark Walnut%' THEN '#3B2820'
  WHEN name LIKE '%Carbon Gray%' THEN '#4A4543'
  WHEN name LIKE '%Antique White%' THEN '#DAD0C6'
  ELSE color_hex
END
WHERE brand = 'Varathane';

-- Update General Finishes stain colors
UPDATE v2_selection_catalog SET color_hex = CASE
  WHEN name LIKE '%Java%' THEN '#3D2B1F'
  WHEN name LIKE '%Antique Walnut%' THEN '#8B7355'
  WHEN name LIKE '%Brown Mahogany%' THEN '#4F3824'
  WHEN name LIKE '%Gray%' THEN '#BFB8AF'
  ELSE color_hex
END
WHERE brand = 'General Finishes';

-- Create view for paint products with color chip display
CREATE OR REPLACE VIEW v2_paint_catalog AS
SELECT
  p.id,
  p.name,
  p.description,
  p.brand,
  p.color_hex,
  p.unit_price,
  p.is_popular,
  p.is_featured,
  p.image_url,
  c.name as category_name,
  c.parent_id as category_parent_id,
  pc.name as parent_category_name,
  -- Indicator for whether this is a paint/stain product
  CASE WHEN p.color_hex IS NOT NULL AND p.color_hex != '' THEN true ELSE false END as has_color_chip
FROM v2_selection_catalog p
JOIN v2_selection_categories c ON p.category_id = c.id
LEFT JOIN v2_selection_categories pc ON c.parent_id = pc.id
WHERE pc.name = 'Paint & Finishes'
   OR c.name IN ('Interior Paint', 'Exterior Paint', 'Wood Stain')
ORDER BY p.brand, p.name;
