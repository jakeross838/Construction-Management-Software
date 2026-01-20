-- Migration 066: Cost Code Keywords and Learned Mappings
-- Replaces hardcoded keyword mapping with database-driven approach

-- ============================================================
-- TASK 1: Add Keywords and Trade Types to Cost Codes
-- ============================================================

-- Add keywords column to cost codes for pattern matching
ALTER TABLE v2_cost_codes ADD COLUMN IF NOT EXISTS keywords TEXT[];

-- Add trade_types column for vendor trade type defaults
ALTER TABLE v2_cost_codes ADD COLUMN IF NOT EXISTS trade_types TEXT[];

-- Populate common keywords based on existing hardcoded map
-- Cabinets & Millwork (21101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['cabinet', 'cabinets', 'cabinetry', 'vanity', 'millwork', 'pantry', 'laundry', 'master bath', 'bathroom cabinet'],
  trade_types = ARRAY['cabinets']
WHERE code = '21101';

-- Cabinet Installation (21102)
UPDATE v2_cost_codes SET
  keywords = ARRAY['cabinet install', 'cabinetry install', 'cabinet installation'],
  trade_types = ARRAY['cabinets']
WHERE code = '21102';

-- Countertops (21103)
UPDATE v2_cost_codes SET
  keywords = ARRAY['countertop', 'countertops', 'granite', 'quartz', 'marble', 'stone top', 'surface'],
  trade_types = ARRAY['countertops']
WHERE code = '21103';

-- Appliances (22101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['appliance', 'appliances', 'refrigerator', 'range', 'dishwasher', 'microwave', 'oven', 'cooktop', 'hood', 'washer', 'dryer'],
  trade_types = ARRAY['appliances']
WHERE code = '22101';

-- Flooring Material (23101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['floor', 'flooring', 'flooring material', 'carpet', 'hardwood', 'lvp', 'vinyl', 'laminate', 'wood floor'],
  trade_types = ARRAY['flooring']
WHERE code = '23101';

-- Flooring Labor (23102)
UPDATE v2_cost_codes SET
  keywords = ARRAY['flooring labor', 'floor install', 'flooring installation'],
  trade_types = ARRAY['flooring']
WHERE code = '23102';

-- Tile Labor (24101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['tile labor', 'tile install', 'tile installation', 'tile work'],
  trade_types = ARRAY['tile']
WHERE code = '24101';

-- Tile Material (24102)
UPDATE v2_cost_codes SET
  keywords = ARRAY['tile', 'tile material', 'ceramic', 'porcelain', 'backsplash', 'shower tile'],
  trade_types = ARRAY['tile']
WHERE code = '24102';

-- Interior Doors (25101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['interior door', 'door', 'doors', 'closet door', 'pocket door', 'barn door'],
  trade_types = ARRAY['windows_doors']
WHERE code = '25101';

-- Painting (27101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['paint', 'painting', 'primer', 'stain', 'finish'],
  trade_types = ARRAY['painting']
WHERE code = '27101';

-- Garage Doors (28101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['garage door', 'garage doors', 'overhead door'],
  trade_types = ARRAY['windows_doors']
WHERE code = '28101';

-- Door Hardware (29101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['hardware', 'door hardware', 'pulls', 'knobs', 'hinges', 'lockset', 'handle'],
  trade_types = ARRAY['general']
WHERE code = '29101';

-- Bath Hardware (30101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['bath hardware', 'bathroom hardware', 'towel bar', 'toilet paper holder', 'robe hook', 'bathroom accessory'],
  trade_types = ARRAY['general']
WHERE code = '30101';

-- Framing (10101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['framing', 'lumber', 'frame', 'stud', 'joist', 'truss', 'beam'],
  trade_types = ARRAY['framing']
WHERE code = '10101';

-- Windows (11101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['window', 'windows', 'glass', 'pane'],
  trade_types = ARRAY['windows_doors']
WHERE code = '11101';

-- Exterior Doors (11102)
UPDATE v2_cost_codes SET
  keywords = ARRAY['exterior door', 'entry door', 'sliding door', 'patio door'],
  trade_types = ARRAY['windows_doors']
WHERE code = '11102';

-- Front Door (11104)
UPDATE v2_cost_codes SET
  keywords = ARRAY['front door', 'entry door', 'main entry'],
  trade_types = ARRAY['windows_doors']
WHERE code = '11104';

-- Plumbing Labor (12101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['plumbing', 'plumbing labor', 'pipe', 'piping', 'rough plumbing'],
  trade_types = ARRAY['plumbing']
WHERE code = '12101';

-- Plumbing Fixtures (12102)
UPDATE v2_cost_codes SET
  keywords = ARRAY['plumbing fixture', 'faucet', 'toilet', 'sink', 'shower', 'tub', 'bathtub', 'lavatory'],
  trade_types = ARRAY['plumbing']
WHERE code = '12102';

-- Electrical Labor (13101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['electrical', 'electrical labor', 'wiring', 'panel', 'outlet', 'circuit', 'rough electric'],
  trade_types = ARRAY['electrical']
WHERE code = '13101';

-- Electrical Fixtures (13102)
UPDATE v2_cost_codes SET
  keywords = ARRAY['lighting', 'light', 'electrical fixture', 'fixture', 'chandelier', 'fan', 'ceiling fan'],
  trade_types = ARRAY['electrical']
WHERE code = '13102';

-- HVAC (14101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['hvac', 'ac', 'air conditioning', 'duct', 'ductwork', 'air handler', 'condenser', 'heating', 'cooling'],
  trade_types = ARRAY['hvac']
WHERE code = '14101';

-- Roofing (15101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['roof', 'roofing', 'shingle', 'tile roof', 'metal roof', 'roofing material'],
  trade_types = ARRAY['roofing']
WHERE code = '15101';

-- Drywall (19101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['drywall', 'sheetrock', 'wallboard', 'gypsum', 'drywall hang', 'drywall finish'],
  trade_types = ARRAY['drywall']
WHERE code = '19101';

-- Pool (34101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['pool', 'spa', 'swimming pool', 'pool deck', 'pool equipment'],
  trade_types = ARRAY['pool']
WHERE code = '34101';

-- Landscaping (35101)
UPDATE v2_cost_codes SET
  keywords = ARRAY['landscape', 'landscaping', 'plant', 'tree', 'shrub', 'mulch'],
  trade_types = ARRAY['landscaping']
WHERE code = '35101';

-- Irrigation (35102)
UPDATE v2_cost_codes SET
  keywords = ARRAY['irrigation', 'sprinkler', 'drip system'],
  trade_types = ARRAY['landscaping']
WHERE code = '35102';

-- Sod (35103)
UPDATE v2_cost_codes SET
  keywords = ARRAY['sod', 'grass', 'turf', 'lawn'],
  trade_types = ARRAY['landscaping']
WHERE code = '35103';

-- Delivery (03108)
UPDATE v2_cost_codes SET
  keywords = ARRAY['delivery', 'shipping', 'freight', 'transport'],
  trade_types = ARRAY['general']
WHERE code = '03108';

-- General Labor (03116)
UPDATE v2_cost_codes SET
  keywords = ARRAY['labor', 'general labor', 'cleanup', 'cleaning'],
  trade_types = ARRAY['general']
WHERE code = '03116';

-- ============================================================
-- TASK 2: Create Learned Mappings Table
-- ============================================================

-- Table for learned cost code mappings from user corrections
CREATE TABLE IF NOT EXISTS v2_cost_code_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  description_pattern TEXT NOT NULL,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  vendor_trade TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.80,
  usage_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one mapping per pattern + trade combination
  UNIQUE(description_pattern, vendor_trade)
);

-- Index for fast pattern lookups
CREATE INDEX IF NOT EXISTS idx_ccm_pattern ON v2_cost_code_mappings(description_pattern);

-- Index for trade-based queries
CREATE INDEX IF NOT EXISTS idx_ccm_trade ON v2_cost_code_mappings(vendor_trade);

-- Index for confidence-based ordering
CREATE INDEX IF NOT EXISTS idx_ccm_confidence ON v2_cost_code_mappings(confidence DESC);

-- RPC function to increment usage count (for learning reinforcement)
CREATE OR REPLACE FUNCTION increment_cost_code_mapping_usage(
  p_pattern TEXT,
  p_trade TEXT
)
RETURNS void AS $$
BEGIN
  UPDATE v2_cost_code_mappings
  SET
    usage_count = usage_count + 1,
    confidence = LEAST(0.99, confidence + 0.01),
    updated_at = NOW()
  WHERE description_pattern = p_pattern
    AND (vendor_trade = p_trade OR (vendor_trade IS NULL AND p_trade IS NULL));
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE v2_cost_code_mappings IS 'Learned mappings from description patterns to cost codes';
COMMENT ON COLUMN v2_cost_code_mappings.description_pattern IS 'Normalized description text (first 50 chars, lowercase)';
COMMENT ON COLUMN v2_cost_code_mappings.vendor_trade IS 'Trade type for context-specific mappings';
COMMENT ON COLUMN v2_cost_code_mappings.confidence IS 'Confidence score, increases with usage';
COMMENT ON COLUMN v2_cost_code_mappings.usage_count IS 'Number of times this mapping has been confirmed';
