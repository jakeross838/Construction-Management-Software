-- Migration 128: Trade and Description Cost Code Mappings
-- Creates tables for AI invoice processor to map trades and descriptions to cost codes

-- Trade type to cost code mappings
CREATE TABLE IF NOT EXISTS v2_trade_cost_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_type TEXT NOT NULL,
  cost_code_id UUID NOT NULL REFERENCES v2_cost_codes(id),
  priority INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trade_type, cost_code_id)
);

-- Description keyword to cost code mappings
CREATE TABLE IF NOT EXISTS v2_description_cost_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL UNIQUE,
  cost_code_id UUID NOT NULL REFERENCES v2_cost_codes(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default trade mappings (trade_type -> cost_code)
-- These map vendor trade types to their primary cost codes
INSERT INTO v2_trade_cost_mappings (trade_type, cost_code_id, priority)
SELECT trade, cc.id, 1
FROM (VALUES
  ('electrical', '26000'),
  ('plumbing', '22000'),
  ('hvac', '23000'),
  ('drywall', '09250'),
  ('framing', '06100'),
  ('roofing', '07500'),
  ('painting', '09900'),
  ('flooring', '09600'),
  ('tile', '09310'),
  ('concrete', '03300'),
  ('masonry', '04000'),
  ('landscaping', '32900'),
  ('pool', '13150'),
  ('cabinets', '12300'),
  ('countertops', '12361'),
  ('windows_doors', '08500'),
  ('insulation', '07200'),
  ('stucco', '09220'),
  ('siding', '07460'),
  ('appliances', '11450'),
  ('millwork', '06200'),
  ('garage_doors', '08360'),
  ('gutters', '07710'),
  ('cleaning', '01740'),
  ('waterproofing', '07100'),
  ('fireplace', '10300'),
  ('security', '28100'),
  ('audio_video', '27400')
) AS mappings(trade, code)
JOIN v2_cost_codes cc ON cc.code = mappings.code
ON CONFLICT (trade_type, cost_code_id) DO NOTHING;

-- Insert description keyword mappings
-- These map specific words in line item descriptions to cost codes
INSERT INTO v2_description_cost_mappings (keyword, cost_code_id)
SELECT keyword, cc.id
FROM (VALUES
  ('cabinet', '12300'),
  ('cabinetry', '12300'),
  ('countertop', '12361'),
  ('granite', '12361'),
  ('quartz', '12361'),
  ('marble', '12361'),
  ('electrical', '26000'),
  ('wiring', '26000'),
  ('outlet', '26000'),
  ('panel', '26000'),
  ('plumbing', '22000'),
  ('pipe', '22000'),
  ('faucet', '22510'),
  ('toilet', '22420'),
  ('hvac', '23000'),
  ('air conditioning', '23000'),
  ('ac', '23000'),
  ('ductwork', '23310'),
  ('drywall', '09250'),
  ('sheetrock', '09250'),
  ('framing', '06100'),
  ('lumber', '06100'),
  ('stud', '06100'),
  ('roofing', '07500'),
  ('shingle', '07500'),
  ('paint', '09900'),
  ('primer', '09900'),
  ('flooring', '09600'),
  ('hardwood', '09640'),
  ('tile', '09310'),
  ('backsplash', '09310'),
  ('concrete', '03300'),
  ('slab', '03300'),
  ('foundation', '03300'),
  ('masonry', '04000'),
  ('block', '04000'),
  ('brick', '04210'),
  ('landscaping', '32900'),
  ('sod', '32920'),
  ('irrigation', '32840'),
  ('pool', '13150'),
  ('window', '08500'),
  ('door', '08100'),
  ('insulation', '07200'),
  ('stucco', '09220'),
  ('siding', '07460'),
  ('appliance', '11450'),
  ('range', '11450'),
  ('refrigerator', '11450'),
  ('dishwasher', '11450'),
  ('millwork', '06200'),
  ('trim', '06200'),
  ('crown', '06200'),
  ('baseboard', '06200'),
  ('garage door', '08360'),
  ('gutter', '07710'),
  ('downspout', '07710'),
  ('cleaning', '01740'),
  ('waterproofing', '07100'),
  ('fireplace', '10300'),
  ('security', '28100'),
  ('alarm', '28100'),
  ('camera', '28100'),
  ('audio', '27400'),
  ('speaker', '27400'),
  ('permit', '01105'),
  ('inspection', '01450'),
  ('engineering', '01106'),
  ('survey', '02210'),
  ('demo', '02050'),
  ('demolition', '02050'),
  ('excavation', '02300'),
  ('grading', '02210'),
  ('septic', '02530'),
  ('well', '02520'),
  ('impact fee', '01105'),
  ('utility', '02500')
) AS mappings(keyword, code)
JOIN v2_cost_codes cc ON cc.code = mappings.code
ON CONFLICT (keyword) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_trade_cost_mappings_trade ON v2_trade_cost_mappings(trade_type);
CREATE INDEX IF NOT EXISTS idx_description_cost_mappings_keyword ON v2_description_cost_mappings(keyword);
