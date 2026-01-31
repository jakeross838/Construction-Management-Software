-- Migration 130: Bid Package Templates
-- Allows saving reusable bid package templates for common trade scopes

-- Create bid package templates table
CREATE TABLE IF NOT EXISTS v2_bid_package_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  trade_category TEXT NOT NULL,
  scope_of_work TEXT,
  specs_summary TEXT,
  special_requirements TEXT,
  default_duration_days INTEGER,
  typical_square_footage INTEGER,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create template checklist items (common requirements)
CREATE TABLE IF NOT EXISTS v2_bid_template_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES v2_bid_package_templates(id) ON DELETE CASCADE,
  item_text TEXT NOT NULL,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_bid_templates_trade ON v2_bid_package_templates(trade_category);
CREATE INDEX IF NOT EXISTS idx_bid_templates_active ON v2_bid_package_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_bid_template_checklist_template ON v2_bid_template_checklist(template_id);

-- Insert some common templates
INSERT INTO v2_bid_package_templates (name, trade_category, scope_of_work, special_requirements, description) VALUES
  ('Standard Framing Package', 'Wood & Plastics', 'Provide all labor and materials for rough framing including:
- Wall framing per plans
- Floor and ceiling framing
- Roof framing with trusses or conventional
- Sheathing (wall, roof, floor)
- Hardware per engineering
- Backing for cabinets, fixtures, grab bars
- Beam wraps if required', 'General liability and workers comp insurance required
Must provide detailed takeoff with bid
10% retainage until substantial completion', 'Standard scope for residential wood framing'),

  ('Plumbing Rough & Finish', 'Plumbing', 'Provide all labor and materials for complete plumbing system:

ROUGH-IN:
- Water supply lines (PEX or copper)
- DWV system (PVC)
- Gas piping if applicable
- Hose bibbs per plan
- Pressure testing

FINISH:
- Install owner-provided fixtures
- Connect appliances
- Final testing and inspection', 'Must be licensed plumber
Provide fixture allowance if supplying fixtures
Include permit fees in bid', 'Complete plumbing package for residential'),

  ('Electrical Rough & Finish', 'Electrical', 'Provide all labor and materials for complete electrical system:

ROUGH-IN:
- Main service and panel
- Branch circuits per plan
- Low voltage rough (data, coax, speaker)
- Smoke/CO detector rough
- HVAC connections

FINISH:
- Devices and covers
- Fixtures (per allowance)
- Final connections
- Testing and inspection', 'Must be licensed electrician
Include permit fees
Provide lighting allowance or use selections', 'Complete electrical package for residential'),

  ('HVAC Complete System', 'HVAC', 'Provide complete HVAC system including:
- Equipment sizing and selection
- Ductwork design and installation
- Equipment installation
- Refrigerant lines
- Condensate drainage
- Thermostat and controls
- Start-up and balancing
- Permit and inspections', 'Equipment warranty minimum 10 years parts
Must provide Manual J/D calculations
Include maintenance instructions', 'Complete HVAC system installation'),

  ('Drywall Hang & Finish', 'Drywall', 'Provide all labor and materials for drywall:
- Hang drywall throughout (1/2" standard, 5/8" where required)
- Tape and finish to Level 4 (Level 5 where specified)
- Metal corner bead at all outside corners
- Texture per specification
- Garage taped and textured', 'Include scaffolding in bid
Dispose of all waste
Touch-up after paint prime included', 'Standard residential drywall package'),

  ('Interior Paint Complete', 'Painting', 'Provide complete interior painting:
- Prime all new drywall
- Two coats finish on walls
- Two coats on ceilings (flat white unless specified)
- Paint all trim, doors, and millwork
- Paint closet interiors
- Caulk all gaps and nail holes', 'Use specified paint brands/colors
Include paint for touch-up at close-out
Protect all floors and fixtures', 'Complete interior paint package'),

  ('Tile Installation', 'Tile', 'Provide all labor and materials for tile installation:
- Floor tile in bathrooms, laundry
- Wall tile in showers/tubs
- Backsplash in kitchen
- Waterproofing in wet areas (Kerdi or equivalent)
- Grout and seal', 'Owner to provide tile selections
Include setting materials in bid
Grout color per selections', 'Tile installation package for residential'),

  ('Roofing Shingle', 'Roofing', 'Provide complete roofing system:
- Underlayment (synthetic)
- Drip edge and rake metal
- Ice & water shield at valleys and penetrations
- Shingles per specification
- Ridge vent
- Flashing at all penetrations
- Clean up and haul off', '30-year architectural shingles minimum
Manufacturer warranty required
Include permit if required', 'Standard shingle roofing package')
ON CONFLICT DO NOTHING;
