-- Seed Price Intelligence with Test Data
-- Run this directly in Supabase SQL Editor

-- ============================================================
-- First ensure v2_master_items table exists (from migration-044)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_master_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  standard_name TEXT NOT NULL,
  standard_unit TEXT NOT NULL DEFAULT 'ea',
  dimensions JSONB,
  keywords TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_item_id UUID REFERENCES v2_master_items(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id UUID,
  unit_price DECIMAL(12,4) NOT NULL,
  unit TEXT NOT NULL,
  quantity DECIMAL(12,4),
  price_per_each DECIMAL(12,4),
  price_per_lf DECIMAL(12,4),
  price_per_sf DECIMAL(12,4),
  price_per_bf DECIMAL(12,4),
  price_per_sheet DECIMAL(12,4),
  lead_days INTEGER,
  in_stock BOOLEAN DEFAULT true,
  price_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_waste_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  subcategory TEXT,
  default_waste_percent DECIMAL(5,2) NOT NULL DEFAULT 10,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes if not exist
CREATE INDEX IF NOT EXISTS idx_master_items_category ON v2_master_items(category);
CREATE INDEX IF NOT EXISTS idx_master_items_keywords ON v2_master_items USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_price_history_item ON v2_price_history(master_item_id);
CREATE INDEX IF NOT EXISTS idx_price_history_vendor ON v2_price_history(vendor_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON v2_price_history(price_date DESC);

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
-- WASTE FACTORS
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
