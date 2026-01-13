-- Migration 012: Reorganize General Conditions
-- Keep only overhead expenses in General Conditions: Contractor Fee, Supervision, Insurance, Fuel
-- Move other items to appropriate categories

-- Move pre-construction services to Pre-Construction & Design
UPDATE v2_cost_codes SET category = 'Pre-Construction & Design' WHERE code LIKE '03101%'; -- Asbestos Survey & Remediation
UPDATE v2_cost_codes SET category = 'Pre-Construction & Design' WHERE code LIKE '03102%'; -- Energy Calcs
UPDATE v2_cost_codes SET category = 'Pre-Construction & Design' WHERE code LIKE '03103%'; -- Soil Borings and Geotech
UPDATE v2_cost_codes SET category = 'Pre-Construction & Design' WHERE code LIKE '03104%'; -- Monitoring and Testing

-- Move fee items to Permits & Fees
UPDATE v2_cost_codes SET category = 'Permits & Fees' WHERE code LIKE '03105%'; -- Water and Sewer Tap Fees
UPDATE v2_cost_codes SET category = 'Permits & Fees' WHERE code LIKE '03106%'; -- Connection and UG Utility Fees

-- Move site/equipment items to Site Work
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03107%'; -- Project Signage
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03108%'; -- Copies
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03109%'; -- Silt Fence/Temporary Fencing
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03110%'; -- Temporary Electric & Water
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03111%'; -- Temporary Sanitation
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03112%'; -- Debris Removal
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03113%'; -- Safety
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03114%'; -- Equipment Rental
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03116%'; -- General Labor and Job Site Cleaning
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03117%'; -- Existing Conditions Protection
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03118%'; -- Punch List
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '03119%'; -- Final Cleaning
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '38101%'; -- Bobcat Usage
UPDATE v2_cost_codes SET category = 'Site Work' WHERE code LIKE '39101%'; -- Dump Trailer Usage

-- Keep in General Conditions (overhead/fees only):
-- 03115 - Fuel (already there)
-- 03120 - Project Insurance (already there)
-- 03121 - Supervision (already there)
-- 03122 - Contractor Fee (already there)
-- 37101 - Contingency (already there - keeping as overhead reserve)
