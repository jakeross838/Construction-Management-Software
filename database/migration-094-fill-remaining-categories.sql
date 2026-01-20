-- Migration 094: Fill remaining empty categories and clean up redundant ones

-- First, delete redundant empty categories (where we have more specific ones already)
DELETE FROM v2_selection_categories WHERE name IN (
  'Doors',           -- We have Interior Doors, Exterior Doors
  'Paint Colors',    -- We have Interior Paint, Exterior Paint
  'Sinks',           -- We have Kitchen Sinks, Bathroom Sinks
  'Tubs & Showers',  -- We have Bathtubs, Shower Enclosures
  'Showers',         -- We have Shower Enclosures
  'Hardware',        -- We have Door Hardware, Cabinet Hardware
  'Other',           -- Too generic
  'Pantry'           -- Specialty, not enough products
);

-- Add Bath Faucets products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('Kohler Forte Single Handle', 'Modern single-handle bathroom faucet with brushed nickel finish', 189.00, 'Kohler', true, true, 'https://images.build.com/img/qualtiy/kohler-k-10215-4-forte-single-handle-bathroom-faucet.jpg'),
  ('Delta Linden Centerset', 'Two-handle centerset bathroom faucet in chrome', 149.00, 'Delta', true, false, 'https://images.build.com/img/qualtiy/delta-2538-dst-linden-centerset-faucet.jpg'),
  ('Moen Genta Single-Hole', 'Sleek single-hole faucet with chrome finish', 179.00, 'Moen', true, true, 'https://images.build.com/img/qualtiy/moen-6702-genta-single-hole-faucet.jpg'),
  ('Pfister Ladera Widespread', '8-inch widespread faucet in matte black', 219.00, 'Pfister', true, true, 'https://images.build.com/img/qualtiy/pfister-lg49-lrdb-ladera-widespread.jpg'),
  ('American Standard Colony PRO', 'Centerset bathroom faucet with brass construction', 129.00, 'American Standard', true, false, 'https://images.build.com/img/qualtiy/american-standard-7075200-colony-pro.jpg'),
  ('Kohler Artifacts Widespread', 'Vintage-style widespread faucet with porcelain handles', 499.00, 'Kohler', false, true, 'https://images.build.com/img/qualtiy/kohler-72759-artifacts-widespread.jpg'),
  ('Delta Trinsic Single Handle', 'Contemporary single-handle faucet in champagne bronze', 249.00, 'Delta', true, true, 'https://images.build.com/img/qualtiy/delta-559lf-czmpu-trinsic-single-handle.jpg'),
  ('Moen Align Single-Hole', 'Modern minimalist design in brushed gold', 299.00, 'Moen', true, true, 'https://images.build.com/img/qualtiy/moen-6190bg-align-single-hole.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Bath Faucets';

-- Add Bathroom Sinks products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('Kohler Caxton Undermount', 'Oval undermount sink in white vitreous china', 169.00, 'Kohler', true, true, 'https://images.build.com/img/qualtiy/kohler-2210-0-caxton-undermount.jpg'),
  ('DERA Rectangular Vessel', 'Modern rectangular vessel sink in white ceramic', 189.00, 'DERA', true, true, 'https://images.build.com/img/qualtiy/dera-rectangular-vessel-sink.jpg'),
  ('American Standard Studio S Drop-In', 'Drop-in bathroom sink with overflow', 149.00, 'American Standard', true, false, 'https://images.build.com/img/qualtiy/american-standard-0621001-studio-s.jpg'),
  ('Kohler Memoirs Pedestal', 'Classic pedestal sink with stately lines', 349.00, 'Kohler', true, true, 'https://images.build.com/img/qualtiy/kohler-2238-memoirs-pedestal.jpg'),
  ('Swiss Madison Well Made Forever', 'Wall-hung rectangular sink, modern style', 159.00, 'Swiss Madison', true, false, 'https://images.build.com/img/qualtiy/swiss-madison-sm-ws320-wall-hung.jpg'),
  ('Kraus Elavo Ceramic', 'Small round vessel sink in white', 99.00, 'Kraus', true, false, 'https://images.build.com/img/qualtiy/kraus-kcv-200-elavo-vessel.jpg'),
  ('Kohler Vox Rectangle', 'Above-counter rectangular sink with single faucet hole', 279.00, 'Kohler', true, true, 'https://images.build.com/img/qualtiy/kohler-2660-1-vox-rectangle.jpg'),
  ('TOTO Promenade II', 'Self-rimming lavatory with elegant design', 259.00, 'TOTO', true, true, 'https://images.build.com/img/qualtiy/toto-lt532-promenade-ii.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Bathroom Sinks';

-- Add Carpet products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('Shaw Floorigami', 'Premium peel and stick carpet tiles, various colors', 4.99, 'Shaw', true, true, 'https://images.build.com/img/qualtiy/shaw-floorigami-carpet-tiles.jpg'),
  ('Mohawk SmartStrand Silk', 'Ultra-soft, stain-resistant carpet in neutral tones', 6.49, 'Mohawk', true, true, 'https://images.build.com/img/qualtiy/mohawk-smartstrand-silk.jpg'),
  ('Stainmaster PetProtect', 'Pet-friendly carpet with odor reduction technology', 5.99, 'Stainmaster', true, true, 'https://images.build.com/img/qualtiy/stainmaster-petprotect.jpg'),
  ('Karastan Kashmere', 'Luxurious plush carpet with rich texture', 8.99, 'Karastan', true, true, 'https://images.build.com/img/qualtiy/karastan-kashmere.jpg'),
  ('Shaw Anso Nylon', 'Durable nylon carpet for high-traffic areas', 4.49, 'Shaw', true, false, 'https://images.build.com/img/qualtiy/shaw-anso-nylon.jpg'),
  ('Mohawk Everstrand', 'Eco-friendly carpet made from recycled bottles', 5.49, 'Mohawk', true, false, 'https://images.build.com/img/qualtiy/mohawk-everstrand.jpg'),
  ('Dream Weaver Soft Touch', 'Budget-friendly soft carpet for bedrooms', 3.99, 'Dream Weaver', true, false, 'https://images.build.com/img/qualtiy/dream-weaver-soft-touch.jpg'),
  ('Fabrica Versailles', 'Designer wool carpet with elegant patterns', 12.99, 'Fabrica', false, true, 'https://images.build.com/img/qualtiy/fabrica-versailles-wool.jpg'),
  ('Shaw Lifeguard', 'Waterproof carpet with spill protection', 7.49, 'Shaw', true, true, 'https://images.build.com/img/qualtiy/shaw-lifeguard-waterproof.jpg'),
  ('Phenix Flooring Microban', 'Antimicrobial carpet with built-in protection', 5.79, 'Phenix', true, false, 'https://images.build.com/img/qualtiy/phenix-microban.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Carpet';

-- Add Ceiling Fans products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('Hunter Original 52"', 'Classic cast iron ceiling fan with reversible blades', 349.00, 'Hunter', true, true, 'https://images.build.com/img/qualtiy/hunter-original-52.jpg'),
  ('Minka Aire Light Wave 52"', 'Modern fan with LED light and DC motor', 449.00, 'Minka Aire', true, true, 'https://images.build.com/img/qualtiy/minka-aire-light-wave.jpg'),
  ('Fanimation Spitfire 48"', 'Mid-century modern style with wood blades', 399.00, 'Fanimation', true, true, 'https://images.build.com/img/qualtiy/fanimation-spitfire-48.jpg'),
  ('Casablanca Panama 54"', 'Elegant traditional design with remote control', 549.00, 'Casablanca', true, true, 'https://images.build.com/img/qualtiy/casablanca-panama-54.jpg'),
  ('Hampton Bay Rockport 52"', 'Budget-friendly with LED and 3 speeds', 149.00, 'Hampton Bay', true, false, 'https://images.build.com/img/qualtiy/hampton-bay-rockport.jpg'),
  ('Monte Carlo Maverick 60"', 'Large modern fan with sleek lines', 479.00, 'Monte Carlo', true, true, 'https://images.build.com/img/qualtiy/monte-carlo-maverick-60.jpg'),
  ('Westinghouse Comet 52"', 'Industrial style with caged LED light', 189.00, 'Westinghouse', true, false, 'https://images.build.com/img/qualtiy/westinghouse-comet.jpg'),
  ('Hunter Low Profile III 52"', 'Hugger fan for low ceilings', 179.00, 'Hunter', true, false, 'https://images.build.com/img/qualtiy/hunter-low-profile-iii.jpg'),
  ('Big Ass Fans Haiku 60"', 'Premium smart fan with SenseMe technology', 1195.00, 'Big Ass Fans', false, true, 'https://images.build.com/img/qualtiy/big-ass-fans-haiku.jpg'),
  ('Modern Forms Roboto 52"', 'Smart fan with wet-rated outdoor option', 499.00, 'Modern Forms', true, true, 'https://images.build.com/img/qualtiy/modern-forms-roboto.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Ceiling Fans';

-- Add Gutters products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('5" K-Style Aluminum', 'Standard seamless aluminum gutter, white', 8.50, 'Generic', true, false, 'https://images.build.com/img/qualtiy/k-style-aluminum-gutter.jpg'),
  ('6" K-Style Aluminum', 'Larger capacity aluminum gutter for steep roofs', 10.50, 'Generic', true, true, 'https://images.build.com/img/qualtiy/6-inch-k-style-aluminum.jpg'),
  ('Half-Round Copper', 'Premium copper half-round gutter', 32.00, 'Generic', false, true, 'https://images.build.com/img/qualtiy/half-round-copper-gutter.jpg'),
  ('LeafGuard Seamless', 'Clog-free seamless gutter system with hood', 25.00, 'LeafGuard', true, true, 'https://images.build.com/img/qualtiy/leafguard-seamless.jpg'),
  ('Amerimax Vinyl 5"', 'Budget-friendly vinyl gutter system', 5.99, 'Amerimax', true, false, 'https://images.build.com/img/qualtiy/amerimax-vinyl.jpg'),
  ('Gutter Helmet', 'Gutter protection system with nose-forward design', 18.00, 'Gutter Helmet', true, true, 'https://images.build.com/img/qualtiy/gutter-helmet.jpg'),
  ('Zinc Half-Round', 'European-style zinc gutter with patina finish', 28.00, 'Generic', false, true, 'https://images.build.com/img/qualtiy/zinc-half-round.jpg'),
  ('LeafFilter Micro-Mesh', 'Surgical-grade steel mesh gutter guard', 15.00, 'LeafFilter', true, true, 'https://images.build.com/img/qualtiy/leaffilter-micro-mesh.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Gutters';

-- Add Hardwood products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('Bruce Natural Oak 3/4"', 'Solid oak hardwood in natural finish', 6.99, 'Bruce', true, true, 'https://images.build.com/img/qualtiy/bruce-natural-oak.jpg'),
  ('Shaw Epic Plus Hickory', 'Engineered hickory with enhanced durability', 7.49, 'Shaw', true, true, 'https://images.build.com/img/qualtiy/shaw-epic-hickory.jpg'),
  ('Mohawk TecWood Walnut', 'Engineered walnut with WetProtect technology', 8.99, 'Mohawk', true, true, 'https://images.build.com/img/qualtiy/mohawk-tecwood-walnut.jpg'),
  ('Somerset Wide Plank White Oak', '7" wide plank white oak, character grade', 9.49, 'Somerset', true, true, 'https://images.build.com/img/qualtiy/somerset-wide-plank-white-oak.jpg'),
  ('Carlisle Wide Plank', 'Custom wide plank flooring, various species', 15.00, 'Carlisle', false, true, 'https://images.build.com/img/qualtiy/carlisle-wide-plank.jpg'),
  ('Armstrong Prime Harvest Oak', '3/4" solid oak in multiple stain options', 5.99, 'Armstrong', true, false, 'https://images.build.com/img/qualtiy/armstrong-prime-harvest.jpg'),
  ('Mannington Hand Crafted', 'Hand-scraped engineered hardwood', 8.49, 'Mannington', true, true, 'https://images.build.com/img/qualtiy/mannington-hand-crafted.jpg'),
  ('Mirage Maple', 'Premium Canadian maple hardwood', 7.99, 'Mirage', true, false, 'https://images.build.com/img/qualtiy/mirage-maple.jpg'),
  ('Mullican Hillshire Maple', 'Budget-friendly solid maple flooring', 4.99, 'Mullican', true, false, 'https://images.build.com/img/qualtiy/mullican-hillshire-maple.jpg'),
  ('Garrison French Oak', 'European-style French oak with wire brushing', 11.99, 'Garrison', true, true, 'https://images.build.com/img/qualtiy/garrison-french-oak.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Hardwood';

-- Add Kitchen Cabinets products (distinct from Cabinets category which has semi-custom)
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('Hampton Bay Shaker White Base', 'Stock white shaker base cabinet, 36"', 289.00, 'Hampton Bay', true, false, 'https://images.build.com/img/qualtiy/hampton-bay-shaker-white-base.jpg'),
  ('KraftMaid Durham Maple', 'Semi-custom maple shaker in natural', 549.00, 'KraftMaid', true, true, 'https://images.build.com/img/qualtiy/kraftmaid-durham-maple.jpg'),
  ('IKEA SEKTION Base', 'Modular base cabinet frame, 24" deep', 149.00, 'IKEA', true, false, 'https://images.build.com/img/qualtiy/ikea-sektion-base.jpg'),
  ('Merillat Classic Shaker', 'American-made shaker style in multiple finishes', 399.00, 'Merillat', true, true, 'https://images.build.com/img/qualtiy/merillat-classic-shaker.jpg'),
  ('Diamond Now Arcadia', 'Ready-to-assemble white shaker cabinets', 199.00, 'Diamond Now', true, false, 'https://images.build.com/img/qualtiy/diamond-now-arcadia.jpg'),
  ('Thomasville Studio 1904', 'Premium semi-custom with soft-close', 749.00, 'Thomasville', true, true, 'https://images.build.com/img/qualtiy/thomasville-studio-1904.jpg'),
  ('Cabinets To Go Shaker Espresso', 'Espresso-stained birch shaker style', 349.00, 'Cabinets To Go', true, false, 'https://images.build.com/img/qualtiy/ctg-shaker-espresso.jpg'),
  ('CliqStudios Dayton', 'Custom quality at semi-custom prices', 599.00, 'CliqStudios', true, true, 'https://images.build.com/img/qualtiy/cliqstudios-dayton.jpg'),
  ('Fabuwood Allure Galaxy', 'Full-overlay frameless cabinets', 449.00, 'Fabuwood', true, true, 'https://images.build.com/img/qualtiy/fabuwood-allure-galaxy.jpg'),
  ('Waypoint Living Spaces', 'Dealer-only quality cabinets', 549.00, 'Waypoint', true, true, 'https://images.build.com/img/qualtiy/waypoint-living-spaces.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Kitchen Cabinets';

-- Add Landscaping products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('Belgard Paver - Dublin Cobble', 'Tumbled concrete paver with old-world look', 5.99, 'Belgard', true, true, 'https://images.build.com/img/qualtiy/belgard-dublin-cobble.jpg'),
  ('Techo-Bloc Blu 60mm', 'Smooth linear paver in multiple colors', 6.49, 'Techo-Bloc', true, true, 'https://images.build.com/img/qualtiy/techo-bloc-blu.jpg'),
  ('Pavestone Rumblestone', 'Natural stone look wall block', 4.99, 'Pavestone', true, false, 'https://images.build.com/img/qualtiy/pavestone-rumblestone.jpg'),
  ('EP Henry Bristol Stone', 'Premium concrete paver with texture', 7.99, 'EP Henry', true, true, 'https://images.build.com/img/qualtiy/ep-henry-bristol.jpg'),
  ('Unilock Beacon Hill', 'Flagstone-look paver for patios', 8.49, 'Unilock', true, true, 'https://images.build.com/img/qualtiy/unilock-beacon-hill.jpg'),
  ('Tremron Olde Towne', 'Classic tumbled paver pattern', 5.49, 'Tremron', true, false, 'https://images.build.com/img/qualtiy/tremron-olde-towne.jpg'),
  ('Natural Bluestone', 'Pennsylvania bluestone irregular flagging', 12.00, 'Generic', false, true, 'https://images.build.com/img/qualtiy/natural-bluestone.jpg'),
  ('Travertine Pavers', 'Natural travertine stone pavers', 9.99, 'Generic', true, true, 'https://images.build.com/img/qualtiy/travertine-pavers.jpg'),
  ('Decomposed Granite', 'Permeable ground cover, gold/tan', 0.99, 'Generic', true, false, 'https://images.build.com/img/qualtiy/decomposed-granite.jpg'),
  ('River Rock 1-2"', 'Natural river rock for beds and borders', 1.49, 'Generic', true, false, 'https://images.build.com/img/qualtiy/river-rock.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Landscaping';

-- Add Siding products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('James Hardie HardiePlank', 'Fiber cement lap siding, 8.25" exposure', 3.99, 'James Hardie', true, true, 'https://images.build.com/img/qualtiy/hardieplank-lap.jpg'),
  ('LP SmartSide', 'Engineered wood siding with SmartGuard', 2.99, 'LP', true, true, 'https://images.build.com/img/qualtiy/lp-smartside.jpg'),
  ('CertainTeed Cedar Impressions', 'Polymer shake siding that looks like cedar', 5.49, 'CertainTeed', true, true, 'https://images.build.com/img/qualtiy/cedar-impressions.jpg'),
  ('Mastic Vinyl Quest', 'Double 4" dutch lap vinyl siding', 1.99, 'Mastic', true, false, 'https://images.build.com/img/qualtiy/mastic-vinyl-quest.jpg'),
  ('Royal Building Products', 'Premium vinyl siding with lifetime warranty', 2.49, 'Royal', true, false, 'https://images.build.com/img/qualtiy/royal-vinyl.jpg'),
  ('James Hardie Artisan V-Rustic', 'Board and batten fiber cement', 4.99, 'James Hardie', true, true, 'https://images.build.com/img/qualtiy/hardie-artisan.jpg'),
  ('Nichiha Vintage Wood', 'Fiber cement panels with wood grain', 6.99, 'Nichiha', true, true, 'https://images.build.com/img/qualtiy/nichiha-vintage-wood.jpg'),
  ('Real Cedar Shingles', 'Western red cedar shingles, #1 grade', 8.99, 'Generic', true, true, 'https://images.build.com/img/qualtiy/cedar-shingles.jpg'),
  ('Longboard Aluminum', 'Interlocking aluminum siding panels', 12.99, 'Longboard', false, true, 'https://images.build.com/img/qualtiy/longboard-aluminum.jpg'),
  ('Alside Prodigy', 'Insulated vinyl siding for energy efficiency', 4.49, 'Alside', true, true, 'https://images.build.com/img/qualtiy/alside-prodigy.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Siding';

-- Add Tile products
INSERT INTO v2_selection_catalog (name, category_id, description, unit_price, brand, is_popular, is_featured, image_url)
SELECT
  p.name, c.id, p.description, p.unit_price, p.brand, p.is_popular, p.is_featured, p.image_url
FROM v2_selection_categories c
CROSS JOIN (VALUES
  ('Daltile Restore Bright White 3x6', 'Classic white subway tile for walls', 1.29, 'Daltile', true, true, 'https://images.build.com/img/qualtiy/daltile-restore-white-subway.jpg'),
  ('MSI Carrara White Marble 12x24', 'Polished marble look porcelain', 4.99, 'MSI', true, true, 'https://images.build.com/img/qualtiy/msi-carrara-12x24.jpg'),
  ('Merola Hex White 1"', 'Matte white hexagon mosaic', 8.99, 'Merola', true, true, 'https://images.build.com/img/qualtiy/merola-hex-white.jpg'),
  ('Emser Zellige 4x4', 'Handmade Moroccan-style wall tile', 14.99, 'Emser', true, true, 'https://images.build.com/img/qualtiy/emser-zellige.jpg'),
  ('Florida Tile Sequence 12x24', 'Modern rectified porcelain floor tile', 3.49, 'Florida Tile', true, false, 'https://images.build.com/img/qualtiy/florida-tile-sequence.jpg'),
  ('Bedrosians Cloe 2.5x8', 'Handmade ceramic with wavy edges', 11.99, 'Bedrosians', true, true, 'https://images.build.com/img/qualtiy/bedrosians-cloe.jpg'),
  ('Soci Calacatta Gold 24x48', 'Large format marble-look porcelain', 6.99, 'Soci', true, true, 'https://images.build.com/img/qualtiy/soci-calacatta-gold.jpg'),
  ('Anatolia Zera Annex 12x24', 'Wood look porcelain plank', 3.99, 'Anatolia', true, false, 'https://images.build.com/img/qualtiy/anatolia-zera-annex.jpg'),
  ('Jeffrey Court Penny Round', 'Porcelain penny tile in various colors', 9.99, 'Jeffrey Court', true, true, 'https://images.build.com/img/qualtiy/jeffrey-court-penny.jpg'),
  ('Marazzi Montagna 6x24', 'Rustic wood-look floor tile', 2.99, 'Marazzi', true, false, 'https://images.build.com/img/qualtiy/marazzi-montagna.jpg')
) AS p(name, description, unit_price, brand, is_popular, is_featured, image_url)
WHERE c.name = 'Tile';

-- Add more brands that were missing
INSERT INTO v2_catalog_brands (name, website_url, logo_url) VALUES
  ('Pfister', 'https://www.pfisterfaucets.com', NULL),
  ('Swiss Madison', 'https://www.swissmadison.com', NULL),
  ('DERA', 'https://www.dera.com', NULL),
  ('Shaw', 'https://www.shawfloors.com', NULL),
  ('Karastan', 'https://www.karastan.com', NULL),
  ('Dream Weaver', 'https://www.dreamweavercarpet.com', NULL),
  ('Fabrica', 'https://www.fabrica.com', NULL),
  ('Phenix', 'https://www.phenixflooring.com', NULL),
  ('Fanimation', 'https://www.fanimation.com', NULL),
  ('Casablanca', 'https://www.casablancafanco.com', NULL),
  ('Monte Carlo', 'https://www.montecarlofans.com', NULL),
  ('Westinghouse', 'https://www.westinghouselighting.com', NULL),
  ('Big Ass Fans', 'https://www.bigassfans.com', NULL),
  ('Modern Forms', 'https://www.modernforms.com', NULL),
  ('LeafGuard', 'https://www.leafguard.com', NULL),
  ('Amerimax', 'https://www.amerimax.com', NULL),
  ('Gutter Helmet', 'https://www.gutterhelmet.com', NULL),
  ('LeafFilter', 'https://www.leaffilter.com', NULL),
  ('Bruce', 'https://www.bruce.com', NULL),
  ('Somerset', 'https://www.somersetfloors.com', NULL),
  ('Carlisle', 'https://www.carlislewideplanks.com', NULL),
  ('Mannington', 'https://www.mannington.com', NULL),
  ('Mirage', 'https://www.miragefloors.com', NULL),
  ('Mullican', 'https://www.mullican.com', NULL),
  ('Garrison', 'https://www.garrisonfloors.com', NULL),
  ('KraftMaid', 'https://www.kraftmaid.com', NULL),
  ('IKEA', 'https://www.ikea.com', NULL),
  ('Merillat', 'https://www.merillat.com', NULL),
  ('Diamond Now', 'https://www.lowes.com', NULL),
  ('Thomasville', 'https://www.thomasvillecabinetry.com', NULL),
  ('Cabinets To Go', 'https://www.cabinetstogo.com', NULL),
  ('CliqStudios', 'https://www.cliqstudios.com', NULL),
  ('Fabuwood', 'https://www.fabuwood.com', NULL),
  ('Waypoint', 'https://www.waypointlivingspaces.com', NULL),
  ('Belgard', 'https://www.belgard.com', NULL),
  ('Techo-Bloc', 'https://www.techo-bloc.com', NULL),
  ('Pavestone', 'https://www.pavestone.com', NULL),
  ('EP Henry', 'https://www.ephenry.com', NULL),
  ('Unilock', 'https://www.unilock.com', NULL),
  ('Tremron', 'https://www.tremron.com', NULL),
  ('LP', 'https://www.lpcorp.com', NULL),
  ('Mastic', 'https://www.plygemca.com', NULL),
  ('Royal', 'https://www.royalbuildingproducts.com', NULL),
  ('Nichiha', 'https://www.nichiha.com', NULL),
  ('Longboard', 'https://www.longboardproducts.com', NULL),
  ('Alside', 'https://www.alside.com', NULL),
  ('Daltile', 'https://www.daltile.com', NULL),
  ('MSI', 'https://www.msisurfaces.com', NULL),
  ('Merola', 'https://www.homedepot.com', NULL),
  ('Emser', 'https://www.emser.com', NULL),
  ('Florida Tile', 'https://www.floridatile.com', NULL),
  ('Bedrosians', 'https://www.bedrosians.com', NULL),
  ('Soci', 'https://www.soci.com', NULL),
  ('Anatolia', 'https://www.anatoliatile.com', NULL),
  ('Jeffrey Court', 'https://www.jeffreycourt.com', NULL),
  ('Marazzi', 'https://www.marazziusa.com', NULL)
ON CONFLICT (name) DO NOTHING;
