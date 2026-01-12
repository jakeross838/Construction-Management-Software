-- Migration 011: Reorganize Cost Code Categories to Follow Construction Flow
-- Categories ordered by typical construction sequence

-- 1. Pre-Construction & Design (01xxx)
UPDATE v2_cost_codes SET category = 'Pre-Construction & Design' WHERE code LIKE '011%';

-- 2. Permits & Fees (02xxx)
UPDATE v2_cost_codes SET category = 'Permits & Fees' WHERE code LIKE '021%';

-- 3. Site Work (04xxx - Surveying, 05xxx - Demo, 06xxx - Clearing/Grading)
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '041%';
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '051%';
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '061%';

-- 4. Foundation (07xxx - Pilings, 08xxx - Concrete, 09xxx - Masonry)
UPDATE v2_cost_codes SET category = 'Foundation' WHERE code LIKE '071%';
UPDATE v2_cost_codes SET category = 'Foundation' WHERE code LIKE '081%';
UPDATE v2_cost_codes SET category = 'Foundation' WHERE code LIKE '091%';

-- 5. Framing & Structure (10xxx)
UPDATE v2_cost_codes SET category = 'Framing & Structure' WHERE code LIKE '101%';

-- 6. Exterior Windows & Doors (11xxx)
UPDATE v2_cost_codes SET category = 'Windows & Doors' WHERE code LIKE '111%';

-- 7. Plumbing (12xxx)
UPDATE v2_cost_codes SET category = 'Plumbing' WHERE code LIKE '121%';

-- 8. Electrical (13xxx)
UPDATE v2_cost_codes SET category = 'Electrical & Low Voltage' WHERE code LIKE '131%';

-- 9. HVAC (14xxx)
UPDATE v2_cost_codes SET category = 'HVAC' WHERE code LIKE '141%';

-- 10. Gas (15xxx)
UPDATE v2_cost_codes SET category = 'Gas' WHERE code LIKE '151%';

-- 11. Fireplace (16xxx)
UPDATE v2_cost_codes SET category = 'Fireplace' WHERE code LIKE '161%';

-- 12. Roofing (17xxx)
UPDATE v2_cost_codes SET category = 'Roofing' WHERE code LIKE '171%';

-- 13. Insulation (18xxx)
UPDATE v2_cost_codes SET category = 'Insulation' WHERE code LIKE '181%';

-- 14. Drywall (19xxx)
UPDATE v2_cost_codes SET category = 'Drywall & Ceilings' WHERE code LIKE '191%';

-- 15. Cabinetry & Countertops (21xxx)
UPDATE v2_cost_codes SET category = 'Cabinetry & Countertops' WHERE code LIKE '211%';

-- 16. Appliances (22xxx)
UPDATE v2_cost_codes SET category = 'Appliances' WHERE code LIKE '221%';

-- 17. Flooring (23xxx, 24xxx)
UPDATE v2_cost_codes SET category = 'Flooring & Tile' WHERE code LIKE '231%';
UPDATE v2_cost_codes SET category = 'Flooring & Tile' WHERE code LIKE '241%';

-- 18. Interior Trim & Doors (25xxx)
UPDATE v2_cost_codes SET category = 'Interior Trim & Doors' WHERE code LIKE '251%';

-- 19. Exterior Finishes (26xxx)
UPDATE v2_cost_codes SET category = 'Exterior Finishes' WHERE code LIKE '261%';

-- 20. Painting (27xxx)
UPDATE v2_cost_codes SET category = 'Painting' WHERE code LIKE '271%';

-- 21. Garage Doors (28xxx)
UPDATE v2_cost_codes SET category = 'Garage Doors' WHERE code LIKE '281%';

-- 22. Hardware (29xxx, 30xxx)
UPDATE v2_cost_codes SET category = 'Hardware & Accessories' WHERE code LIKE '291%';
UPDATE v2_cost_codes SET category = 'Hardware & Accessories' WHERE code LIKE '301%';

-- 23. Glass & Mirrors (31xxx)
UPDATE v2_cost_codes SET category = 'Glass & Mirrors' WHERE code LIKE '311%';

-- 24. Closets (32xxx)
UPDATE v2_cost_codes SET category = 'Closets' WHERE code LIKE '321%';

-- 25. Specialty Items (33xxx - Elevator, 34xxx - Pool/Outdoor)
UPDATE v2_cost_codes SET category = 'Specialty Items' WHERE code LIKE '331%';
UPDATE v2_cost_codes SET category = 'Outdoor & Pool' WHERE code LIKE '341%';

-- 26. Landscaping & Site (35xxx, 36xxx)
UPDATE v2_cost_codes SET category = 'Landscaping & Hardscape' WHERE code LIKE '351%';
UPDATE v2_cost_codes SET category = 'Landscaping & Hardscape' WHERE code LIKE '361%';

-- 27. General Conditions (03xxx - Project Admin, 37xxx - Contingency, 38xxx, 39xxx - Equipment)
UPDATE v2_cost_codes SET category = 'General Conditions' WHERE code LIKE '031%';
UPDATE v2_cost_codes SET category = 'General Conditions' WHERE code LIKE '371%';
UPDATE v2_cost_codes SET category = 'General Conditions' WHERE code LIKE '381%';
UPDATE v2_cost_codes SET category = 'General Conditions' WHERE code LIKE '391%';
