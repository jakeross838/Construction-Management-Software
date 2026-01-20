-- Migration 090: Catalog Popularity & Pre-Populated Products
-- Adds popularity tracking, smart features, and real product catalogs

-- ============================================================
-- 1. ADD POPULARITY COLUMNS TO CATALOG
-- ============================================================
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS usage_count INTEGER DEFAULT 0;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS times_selected INTEGER DEFAULT 0;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS last_selected_at TIMESTAMPTZ;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS is_popular BOOLEAN DEFAULT false;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS is_new BOOLEAN DEFAULT false;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS collection TEXT;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS color_hex TEXT;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS finish TEXT;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS material TEXT;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS dimensions JSONB;
ALTER TABLE v2_selection_catalog ADD COLUMN IF NOT EXISTS specifications JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_catalog_popular ON v2_selection_catalog(is_popular) WHERE is_popular = true;
CREATE INDEX IF NOT EXISTS idx_catalog_featured ON v2_selection_catalog(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_catalog_brand ON v2_selection_catalog(brand);
CREATE INDEX IF NOT EXISTS idx_catalog_tags ON v2_selection_catalog USING gin(tags);

-- ============================================================
-- 2. BRANDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_catalog_brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  website_url TEXT,
  category TEXT, -- 'paint', 'flooring', 'hardware', etc.
  tier TEXT CHECK (tier IN ('budget', 'mid-range', 'premium', 'luxury')) DEFAULT 'mid-range',
  is_preferred BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed popular brands
INSERT INTO v2_catalog_brands (name, category, tier, is_preferred) VALUES
  ('Sherwin-Williams', 'paint', 'premium', true),
  ('Benjamin Moore', 'paint', 'premium', true),
  ('Behr', 'paint', 'mid-range', false),
  ('PPG', 'paint', 'mid-range', false),
  ('Farrow & Ball', 'paint', 'luxury', false),
  ('Minwax', 'stain', 'mid-range', true),
  ('Varathane', 'stain', 'mid-range', false),
  ('General Finishes', 'stain', 'premium', true),
  ('Rubio Monocoat', 'stain', 'luxury', false),
  ('Schlage', 'hardware', 'premium', true),
  ('Kwikset', 'hardware', 'mid-range', false),
  ('Baldwin', 'hardware', 'luxury', false),
  ('Emtek', 'hardware', 'premium', true),
  ('Top Knobs', 'hardware', 'premium', true),
  ('Amerock', 'hardware', 'mid-range', false),
  ('Delta', 'plumbing', 'mid-range', true),
  ('Kohler', 'plumbing', 'premium', true),
  ('Moen', 'plumbing', 'mid-range', true),
  ('Grohe', 'plumbing', 'luxury', false),
  ('Shaw', 'flooring', 'mid-range', true),
  ('Mohawk', 'flooring', 'mid-range', false),
  ('Armstrong', 'flooring', 'mid-range', false),
  ('Anderson', 'flooring', 'premium', true),
  ('Mannington', 'flooring', 'premium', false),
  ('Caesarstone', 'countertops', 'premium', true),
  ('Silestone', 'countertops', 'premium', false),
  ('Cambria', 'countertops', 'luxury', true),
  ('MSI', 'countertops', 'mid-range', false),
  ('Progress Lighting', 'lighting', 'mid-range', true),
  ('Kichler', 'lighting', 'mid-range', false),
  ('Visual Comfort', 'lighting', 'luxury', false),
  ('Hudson Valley', 'lighting', 'premium', false)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 3. SELECTION BUNDLES (Pre-configured packages)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_selection_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  style TEXT CHECK (style IN ('modern', 'traditional', 'transitional', 'farmhouse', 'coastal', 'contemporary', 'industrial')),
  tier TEXT CHECK (tier IN ('budget', 'mid-range', 'premium', 'luxury')) DEFAULT 'mid-range',
  room_type TEXT, -- 'kitchen', 'bathroom', 'whole_home', etc.
  estimated_cost DECIMAL(12,2),
  image_url TEXT,
  is_featured BOOLEAN DEFAULT false,
  times_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_selection_bundle_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID NOT NULL REFERENCES v2_selection_bundles(id) ON DELETE CASCADE,
  catalog_item_id UUID REFERENCES v2_selection_catalog(id),
  category_id UUID REFERENCES v2_selection_categories(id),
  quantity INTEGER DEFAULT 1,
  notes TEXT
);

-- ============================================================
-- 4. FAVORITES (User/company favorites)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_catalog_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,
  user_id TEXT,
  company_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(catalog_item_id, user_id)
);

-- ============================================================
-- 5. RECENTLY USED (Track recent selections by user)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_catalog_recent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  job_id UUID REFERENCES v2_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_recent_user ON v2_catalog_recent(user_id, used_at DESC);

-- ============================================================
-- 6. FUNCTION: Track item selection
-- ============================================================
CREATE OR REPLACE FUNCTION track_catalog_selection(
  p_item_id UUID,
  p_user_id TEXT DEFAULT NULL,
  p_job_id UUID DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Update catalog item stats
  UPDATE v2_selection_catalog SET
    times_selected = times_selected + 1,
    last_selected_at = NOW(),
    is_popular = CASE WHEN times_selected >= 10 THEN true ELSE is_popular END
  WHERE id = p_item_id;

  -- Track in recent if user provided
  IF p_user_id IS NOT NULL THEN
    INSERT INTO v2_catalog_recent (catalog_item_id, user_id, job_id)
    VALUES (p_item_id, p_user_id, p_job_id);

    -- Keep only last 50 per user
    DELETE FROM v2_catalog_recent
    WHERE id IN (
      SELECT id FROM v2_catalog_recent
      WHERE user_id = p_user_id
      ORDER BY used_at DESC
      OFFSET 50
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 7. SEED PAINT COLORS - SHERWIN-WILLIAMS
-- ============================================================
-- First ensure we have a Paint category
INSERT INTO v2_selection_categories (name, description, display_order)
VALUES ('Interior Paint', 'Wall and trim paint colors', 10)
ON CONFLICT DO NOTHING;

-- Get category ID for paint
DO $$
DECLARE
  v_paint_cat_id UUID;
BEGIN
  SELECT id INTO v_paint_cat_id FROM v2_selection_categories WHERE name = 'Interior Paint' LIMIT 1;

  IF v_paint_cat_id IS NOT NULL THEN
    -- Sherwin-Williams Popular Colors
    INSERT INTO v2_selection_catalog (category_id, name, brand, collection, color_hex, unit_price, unit, is_popular, is_featured, tags) VALUES
      -- Whites & Neutrals
      (v_paint_cat_id, 'SW 7012 Creamy', 'Sherwin-Williams', 'Top 50', '#F3EAD8', 75.00, 'gallon', true, true, ARRAY['white', 'neutral', 'warm', 'popular']),
      (v_paint_cat_id, 'SW 7015 Repose Gray', 'Sherwin-Williams', 'Top 50', '#C2BFB8', 75.00, 'gallon', true, true, ARRAY['gray', 'greige', 'neutral', 'popular']),
      (v_paint_cat_id, 'SW 7016 Mindful Gray', 'Sherwin-Williams', 'Top 50', '#B4AFA7', 75.00, 'gallon', true, true, ARRAY['gray', 'warm', 'neutral']),
      (v_paint_cat_id, 'SW 7029 Agreeable Gray', 'Sherwin-Williams', 'Top 50', '#D1CBC0', 75.00, 'gallon', true, true, ARRAY['greige', 'neutral', 'bestseller', 'popular']),
      (v_paint_cat_id, 'SW 7036 Accessible Beige', 'Sherwin-Williams', 'Top 50', '#D1C4B2', 75.00, 'gallon', true, false, ARRAY['beige', 'neutral', 'warm']),
      (v_paint_cat_id, 'SW 7043 Worldly Gray', 'Sherwin-Williams', 'Top 50', '#B5AFA5', 75.00, 'gallon', true, false, ARRAY['gray', 'warm', 'neutral']),
      (v_paint_cat_id, 'SW 7044 Amazing Gray', 'Sherwin-Williams', 'Top 50', '#A8A29A', 75.00, 'gallon', true, false, ARRAY['gray', 'neutral']),
      (v_paint_cat_id, 'SW 6119 Antique White', 'Sherwin-Williams', 'Classic', '#F2E6D9', 75.00, 'gallon', true, false, ARRAY['white', 'cream', 'classic']),
      (v_paint_cat_id, 'SW 7008 Alabaster', 'Sherwin-Williams', 'Top 50', '#F0EBE0', 75.00, 'gallon', true, true, ARRAY['white', 'warm', 'popular']),
      (v_paint_cat_id, 'SW 7011 Natural Choice', 'Sherwin-Williams', 'Top 50', '#E8E1D4', 75.00, 'gallon', true, false, ARRAY['white', 'neutral', 'warm']),
      (v_paint_cat_id, 'SW 6385 Dover White', 'Sherwin-Williams', 'Historic', '#F0E8D8', 75.00, 'gallon', false, false, ARRAY['white', 'warm', 'trim']),
      (v_paint_cat_id, 'SW 7006 Extra White', 'Sherwin-Williams', 'Essentials', '#F1F0ED', 75.00, 'gallon', true, false, ARRAY['white', 'bright', 'ceiling', 'trim']),
      -- Blues
      (v_paint_cat_id, 'SW 6217 Topsail', 'Sherwin-Williams', 'Coastal', '#D4E4E6', 75.00, 'gallon', true, false, ARRAY['blue', 'coastal', 'light']),
      (v_paint_cat_id, 'SW 6218 Tradewind', 'Sherwin-Williams', 'Coastal', '#B5D1D6', 75.00, 'gallon', true, false, ARRAY['blue', 'coastal', 'spa']),
      (v_paint_cat_id, 'SW 6219 Rain', 'Sherwin-Williams', 'Coastal', '#9FC1C9', 75.00, 'gallon', false, false, ARRAY['blue', 'coastal']),
      (v_paint_cat_id, 'SW 6244 Naval', 'Sherwin-Williams', '2020 COTY', '#34495E', 75.00, 'gallon', true, true, ARRAY['blue', 'navy', 'dark', 'accent']),
      (v_paint_cat_id, 'SW 9140 Breezy', 'Sherwin-Williams', 'Living Well', '#C8DDE3', 75.00, 'gallon', false, false, ARRAY['blue', 'light', 'soft']),
      (v_paint_cat_id, 'SW 6230 Rainstorm', 'Sherwin-Williams', 'Classic', '#3D5A6F', 75.00, 'gallon', false, false, ARRAY['blue', 'dark', 'moody']),
      -- Greens
      (v_paint_cat_id, 'SW 6194 Basil', 'Sherwin-Williams', 'Classic', '#6B8E6B', 75.00, 'gallon', false, false, ARRAY['green', 'herb', 'natural']),
      (v_paint_cat_id, 'SW 6199 Rare Gray', 'Sherwin-Williams', 'Emerald', '#C5D1C0', 75.00, 'gallon', false, false, ARRAY['green', 'gray', 'sage']),
      (v_paint_cat_id, 'SW 9130 Evergreen Fog', 'Sherwin-Williams', '2022 COTY', '#96A793', 75.00, 'gallon', true, true, ARRAY['green', 'sage', 'trending']),
      (v_paint_cat_id, 'SW 0015 Gallery Green', 'Sherwin-Williams', 'Historic', '#6A8A74', 75.00, 'gallon', false, false, ARRAY['green', 'forest', 'rich']),
      (v_paint_cat_id, 'SW 6179 Artichoke', 'Sherwin-Williams', 'Classic', '#9EA582', 75.00, 'gallon', false, false, ARRAY['green', 'olive', 'earthy']),
      -- Blacks & Dark Colors
      (v_paint_cat_id, 'SW 6258 Tricorn Black', 'Sherwin-Williams', 'Essentials', '#2C2C2C', 75.00, 'gallon', true, true, ARRAY['black', 'dark', 'accent', 'trim']),
      (v_paint_cat_id, 'SW 7020 Black Fox', 'Sherwin-Williams', 'Classic', '#4A4541', 75.00, 'gallon', false, false, ARRAY['charcoal', 'dark', 'warm']),
      (v_paint_cat_id, 'SW 7019 Gauntlet Gray', 'Sherwin-Williams', 'Classic', '#5A5651', 75.00, 'gallon', false, false, ARRAY['gray', 'dark', 'charcoal']),
      (v_paint_cat_id, 'SW 7048 Urbane Bronze', 'Sherwin-Williams', '2021 COTY', '#54504A', 75.00, 'gallon', true, true, ARRAY['bronze', 'warm', 'trending']),
      (v_paint_cat_id, 'SW 7069 Iron Ore', 'Sherwin-Williams', 'Classic', '#4A4A48', 75.00, 'gallon', true, false, ARRAY['charcoal', 'dark', 'exterior'])
    ON CONFLICT DO NOTHING;

    -- Benjamin Moore Popular Colors
    INSERT INTO v2_selection_catalog (category_id, name, brand, collection, color_hex, unit_price, unit, is_popular, is_featured, tags) VALUES
      -- Whites & Neutrals
      (v_paint_cat_id, 'OC-17 White Dove', 'Benjamin Moore', 'Off-White', '#F3EEE4', 85.00, 'gallon', true, true, ARRAY['white', 'warm', 'bestseller', 'popular']),
      (v_paint_cat_id, 'OC-45 Swiss Coffee', 'Benjamin Moore', 'Off-White', '#F2E9DC', 85.00, 'gallon', true, false, ARRAY['white', 'cream', 'warm']),
      (v_paint_cat_id, 'OC-65 Chantilly Lace', 'Benjamin Moore', 'Off-White', '#F5F3EE', 85.00, 'gallon', true, true, ARRAY['white', 'bright', 'crisp', 'popular']),
      (v_paint_cat_id, 'OC-20 Pale Oak', 'Benjamin Moore', 'Off-White', '#E8E0D4', 85.00, 'gallon', true, false, ARRAY['greige', 'neutral', 'warm']),
      (v_paint_cat_id, 'CC-40 Cloud White', 'Benjamin Moore', 'Color Preview', '#F0EDE6', 85.00, 'gallon', true, false, ARRAY['white', 'soft', 'classic']),
      (v_paint_cat_id, 'HC-172 Revere Pewter', 'Benjamin Moore', 'Historical', '#C4BAA8', 85.00, 'gallon', true, true, ARRAY['greige', 'neutral', 'bestseller', 'popular']),
      (v_paint_cat_id, 'HC-173 Edgecomb Gray', 'Benjamin Moore', 'Historical', '#D3CCC0', 85.00, 'gallon', true, false, ARRAY['greige', 'warm', 'neutral']),
      (v_paint_cat_id, '2163-40 Balboa Mist', 'Benjamin Moore', 'Color Preview', '#D4CEC3', 85.00, 'gallon', true, false, ARRAY['greige', 'light', 'neutral']),
      (v_paint_cat_id, '1548 Wish', 'Benjamin Moore', 'Color Stories', '#DBD6CD', 85.00, 'gallon', false, false, ARRAY['gray', 'neutral', 'soft']),
      (v_paint_cat_id, 'AF-20 Mascarpone', 'Benjamin Moore', 'Affinity', '#F5EBD8', 85.00, 'gallon', false, false, ARRAY['cream', 'warm', 'soft']),
      -- Blues
      (v_paint_cat_id, 'HC-157 Hale Navy', 'Benjamin Moore', 'Historical', '#3C4A5B', 85.00, 'gallon', true, true, ARRAY['navy', 'blue', 'dark', 'accent']),
      (v_paint_cat_id, '1677 Van Deusen Blue', 'Benjamin Moore', 'Classics', '#4A6A8A', 85.00, 'gallon', true, false, ARRAY['blue', 'classic', 'medium']),
      (v_paint_cat_id, '2062-70 Summer Shower', 'Benjamin Moore', 'Color Preview', '#C5DCE8', 85.00, 'gallon', false, false, ARRAY['blue', 'light', 'coastal']),
      (v_paint_cat_id, '2055-40 Breath of Fresh Air', 'Benjamin Moore', 'Color Preview', '#C5D7E3', 85.00, 'gallon', false, false, ARRAY['blue', 'light', 'soft']),
      (v_paint_cat_id, '2135-50 Quiet Moments', 'Benjamin Moore', 'Color Preview', '#C2D4D6', 85.00, 'gallon', false, false, ARRAY['blue', 'spa', 'soft']),
      -- Greens
      (v_paint_cat_id, 'HC-138 Covington Blue', 'Benjamin Moore', 'Historical', '#6B8A8E', 85.00, 'gallon', false, false, ARRAY['green', 'teal', 'historical']),
      (v_paint_cat_id, 'HC-114 Saybrook Sage', 'Benjamin Moore', 'Historical', '#A5A98F', 85.00, 'gallon', true, false, ARRAY['green', 'sage', 'muted']),
      (v_paint_cat_id, '2029-40 October Mist', 'Benjamin Moore', '2022 COTY', '#B8BBA8', 85.00, 'gallon', true, true, ARRAY['green', 'sage', 'trending']),
      (v_paint_cat_id, 'AF-445 Aventurine', 'Benjamin Moore', 'Affinity', '#91A088', 85.00, 'gallon', false, false, ARRAY['green', 'sage', 'earthy']),
      (v_paint_cat_id, '2041-30 Salamander', 'Benjamin Moore', 'Color Preview', '#5A6B4A', 85.00, 'gallon', false, false, ARRAY['green', 'dark', 'forest']),
      -- Blacks & Dark Colors
      (v_paint_cat_id, '2132-10 Black', 'Benjamin Moore', 'Classics', '#2B2B2B', 85.00, 'gallon', true, false, ARRAY['black', 'dark', 'accent']),
      (v_paint_cat_id, 'HC-166 Kendall Charcoal', 'Benjamin Moore', 'Historical', '#5A5A58', 85.00, 'gallon', true, false, ARRAY['charcoal', 'gray', 'dark']),
      (v_paint_cat_id, '2121-10 Black Panther', 'Benjamin Moore', 'Color Preview', '#3A3A3A', 85.00, 'gallon', false, false, ARRAY['black', 'dark']),
      (v_paint_cat_id, '2133-20 Iron Mountain', 'Benjamin Moore', 'Color Preview', '#4B4C4A', 85.00, 'gallon', true, false, ARRAY['charcoal', 'exterior', 'dark']),
      (v_paint_cat_id, 'AF-685 Thunder', 'Benjamin Moore', 'Affinity', '#424544', 85.00, 'gallon', false, false, ARRAY['gray', 'dark', 'moody'])
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 8. SEED WOOD STAINS
-- ============================================================
INSERT INTO v2_selection_categories (name, description, display_order)
VALUES ('Wood Stain', 'Interior wood stains and finishes', 15)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_stain_cat_id UUID;
BEGIN
  SELECT id INTO v_stain_cat_id FROM v2_selection_categories WHERE name = 'Wood Stain' LIMIT 1;

  IF v_stain_cat_id IS NOT NULL THEN
    -- Minwax Stains
    INSERT INTO v2_selection_catalog (category_id, name, brand, collection, color_hex, unit_price, unit, is_popular, tags, finish) VALUES
      (v_stain_cat_id, 'Minwax 2716 Golden Oak', 'Minwax', 'Wood Finish', '#C4973C', 15.00, 'quart', true, ARRAY['oak', 'golden', 'classic'], 'satin'),
      (v_stain_cat_id, 'Minwax 70001 Golden Oak', 'Minwax', 'Wood Finish', '#C4973C', 15.00, 'quart', true, ARRAY['oak', 'golden', 'bestseller'], 'satin'),
      (v_stain_cat_id, 'Minwax 70011 English Chestnut', 'Minwax', 'Wood Finish', '#6E4A2E', 15.00, 'quart', true, ARRAY['chestnut', 'medium', 'warm'], 'satin'),
      (v_stain_cat_id, 'Minwax 2718 Provincial', 'Minwax', 'Wood Finish', '#8B6B4A', 15.00, 'quart', true, ARRAY['brown', 'medium', 'classic'], 'satin'),
      (v_stain_cat_id, 'Minwax 224 Special Walnut', 'Minwax', 'Wood Finish', '#5D4A3A', 15.00, 'quart', true, ARRAY['walnut', 'dark', 'popular'], 'satin'),
      (v_stain_cat_id, 'Minwax 2716 Red Oak', 'Minwax', 'Wood Finish', '#B5734A', 15.00, 'quart', false, ARRAY['oak', 'red', 'warm'], 'satin'),
      (v_stain_cat_id, 'Minwax 2714 Jacobean', 'Minwax', 'Wood Finish', '#4A3828', 15.00, 'quart', true, ARRAY['dark', 'rich', 'popular'], 'satin'),
      (v_stain_cat_id, 'Minwax 2718 Dark Walnut', 'Minwax', 'Wood Finish', '#3A2A1A', 15.00, 'quart', true, ARRAY['walnut', 'dark', 'rich'], 'satin'),
      (v_stain_cat_id, 'Minwax 2754 Ebony', 'Minwax', 'Wood Finish', '#2A2018', 15.00, 'quart', true, ARRAY['black', 'dark', 'modern'], 'satin'),
      (v_stain_cat_id, 'Minwax 2742 Weathered Oak', 'Minwax', 'Wood Finish', '#A8A090', 15.00, 'quart', true, ARRAY['gray', 'weathered', 'farmhouse'], 'satin'),
      (v_stain_cat_id, 'Minwax 271 Classic Gray', 'Minwax', 'Wood Finish', '#8A8A82', 15.00, 'quart', true, ARRAY['gray', 'modern', 'trending'], 'satin'),
      (v_stain_cat_id, 'Minwax 2126 White Wash', 'Minwax', 'Wood Finish', '#E8E0D4', 15.00, 'quart', false, ARRAY['white', 'wash', 'light'], 'satin'),
      -- Varathane Stains
      (v_stain_cat_id, 'Varathane Early American', 'Varathane', 'Premium', '#8A6A4A', 14.00, 'quart', true, ARRAY['brown', 'classic', 'warm'], 'satin'),
      (v_stain_cat_id, 'Varathane Golden Oak', 'Varathane', 'Premium', '#C4973C', 14.00, 'quart', true, ARRAY['oak', 'golden', 'classic'], 'satin'),
      (v_stain_cat_id, 'Varathane Kona', 'Varathane', 'Premium', '#3A281A', 14.00, 'quart', true, ARRAY['dark', 'espresso', 'modern'], 'satin'),
      (v_stain_cat_id, 'Varathane Briarsmoke', 'Varathane', 'Premium', '#6A5A4A', 14.00, 'quart', false, ARRAY['gray-brown', 'smoky', 'modern'], 'satin'),
      (v_stain_cat_id, 'Varathane Weathered Gray', 'Varathane', 'Premium', '#9A9A90', 14.00, 'quart', true, ARRAY['gray', 'weathered', 'farmhouse'], 'satin'),
      -- General Finishes (Premium)
      (v_stain_cat_id, 'GF Java Gel Stain', 'General Finishes', 'Gel Stain', '#3A2A1A', 28.00, 'quart', true, ARRAY['dark', 'espresso', 'gel', 'premium'], 'gel'),
      (v_stain_cat_id, 'GF Antique Walnut Gel Stain', 'General Finishes', 'Gel Stain', '#5A4A38', 28.00, 'quart', true, ARRAY['walnut', 'antique', 'gel'], 'gel'),
      (v_stain_cat_id, 'GF Gray Gel Stain', 'General Finishes', 'Gel Stain', '#7A7A72', 28.00, 'quart', true, ARRAY['gray', 'modern', 'gel'], 'gel')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 9. SEED CABINET HARDWARE
-- ============================================================
INSERT INTO v2_selection_categories (name, description, display_order)
VALUES ('Cabinet Hardware', 'Pulls, knobs, and cabinet hardware', 20)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_hw_cat_id UUID;
BEGIN
  SELECT id INTO v_hw_cat_id FROM v2_selection_categories WHERE name = 'Cabinet Hardware' LIMIT 1;

  IF v_hw_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, tags, finish, material, dimensions) VALUES
      -- Top Knobs
      (v_hw_cat_id, 'Top Knobs M1887 Bar Pull 5-1/16"', 'Top Knobs', 'M1887', 12.50, 'each', true, ARRAY['bar', 'modern', 'brushed nickel'], 'Brushed Satin Nickel', 'Zinc', '{"length": "5.0625 in", "projection": "1.375 in"}'),
      (v_hw_cat_id, 'Top Knobs M1890 Bar Pull 8-13/16"', 'Top Knobs', 'M1890', 16.00, 'each', true, ARRAY['bar', 'modern', 'brushed nickel'], 'Brushed Satin Nickel', 'Zinc', '{"length": "8.8125 in", "projection": "1.375 in"}'),
      (v_hw_cat_id, 'Top Knobs TK951AG Knob', 'Top Knobs', 'TK951AG', 8.50, 'each', true, ARRAY['knob', 'transitional', 'gold'], 'Ash Gray', 'Zinc', '{"diameter": "1.25 in"}'),
      (v_hw_cat_id, 'Top Knobs M1325 Pennington Pull', 'Top Knobs', 'M1325', 18.00, 'each', false, ARRAY['cup', 'transitional', 'polished nickel'], 'Polished Nickel', 'Zinc', '{"length": "4 in"}'),
      -- Amerock
      (v_hw_cat_id, 'Amerock BP36800G10 Bar Pull 5"', 'Amerock', 'BP36800G10', 8.00, 'each', true, ARRAY['bar', 'modern', 'satin nickel'], 'Satin Nickel', 'Zinc', '{"length": "5 in", "centers": "3.75 in"}'),
      (v_hw_cat_id, 'Amerock BP36800ORB Bar Pull 5"', 'Amerock', 'BP36800ORB', 8.00, 'each', true, ARRAY['bar', 'modern', 'bronze'], 'Oil Rubbed Bronze', 'Zinc', '{"length": "5 in", "centers": "3.75 in"}'),
      (v_hw_cat_id, 'Amerock BP55272BBR Knob', 'Amerock', 'BP55272BBR', 5.50, 'each', true, ARRAY['knob', 'traditional', 'bronze'], 'Black Bronze', 'Zinc', '{"diameter": "1.25 in"}'),
      (v_hw_cat_id, 'Amerock BP53012G10 Cup Pull', 'Amerock', 'BP53012G10', 12.00, 'each', false, ARRAY['cup', 'farmhouse', 'satin nickel'], 'Satin Nickel', 'Zinc', '{"length": "3 in"}'),
      -- Emtek (Premium)
      (v_hw_cat_id, 'Emtek 86325US15 Urban Modern Pull', 'Emtek', '86325US15', 24.00, 'each', false, ARRAY['bar', 'modern', 'satin nickel', 'premium'], 'Satin Nickel', 'Solid Brass', '{"length": "6 in"}'),
      (v_hw_cat_id, 'Emtek 86702US10B Freestone Knob', 'Emtek', '86702US10B', 18.00, 'each', false, ARRAY['knob', 'modern', 'oil rubbed bronze', 'premium'], 'Oil Rubbed Bronze', 'Solid Brass', '{"diameter": "1.25 in"}'),
      -- Richelieu
      (v_hw_cat_id, 'Richelieu BP8160128195 Knob', 'Richelieu', 'BP8160128195', 4.50, 'each', true, ARRAY['knob', 'traditional', 'brushed nickel', 'budget'], 'Brushed Nickel', 'Zinc', '{"diameter": "1 in"}'),
      (v_hw_cat_id, 'Richelieu BP881128195 Pull 5"', 'Richelieu', 'BP881128195', 6.00, 'each', true, ARRAY['bar', 'modern', 'brushed nickel', 'budget'], 'Brushed Nickel', 'Zinc', '{"length": "5 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 10. SEED COUNTERTOPS
-- ============================================================
INSERT INTO v2_selection_categories (name, description, display_order)
VALUES ('Countertops', 'Kitchen and bathroom countertop materials', 25)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_counter_cat_id UUID;
BEGIN
  SELECT id INTO v_counter_cat_id FROM v2_selection_categories WHERE name = 'Countertops' LIMIT 1;

  IF v_counter_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, collection, unit_price, unit, is_popular, is_featured, tags, material, finish) VALUES
      -- Quartz - Caesarstone
      (v_counter_cat_id, 'Caesarstone 5141 Frosty Carrina', 'Caesarstone', 'Supernatural', 85.00, 'sqft', true, true, ARRAY['quartz', 'white', 'marble-look', 'popular'], 'Quartz', 'Polished'),
      (v_counter_cat_id, 'Caesarstone 5143 White Attica', 'Caesarstone', 'Supernatural', 85.00, 'sqft', true, false, ARRAY['quartz', 'white', 'veined'], 'Quartz', 'Polished'),
      (v_counter_cat_id, 'Caesarstone 5031 Statuario Maximus', 'Caesarstone', 'Supernatural', 95.00, 'sqft', true, true, ARRAY['quartz', 'white', 'marble-look', 'premium'], 'Quartz', 'Polished'),
      (v_counter_cat_id, 'Caesarstone 4004 Raw Concrete', 'Caesarstone', 'Metropolitan', 75.00, 'sqft', false, false, ARRAY['quartz', 'gray', 'industrial'], 'Quartz', 'Matte'),
      (v_counter_cat_id, 'Caesarstone 4130 Clamshell', 'Caesarstone', 'Classico', 70.00, 'sqft', false, false, ARRAY['quartz', 'beige', 'neutral'], 'Quartz', 'Polished'),
      -- Quartz - Silestone
      (v_counter_cat_id, 'Silestone Calacatta Gold', 'Silestone', 'Eternal', 90.00, 'sqft', true, true, ARRAY['quartz', 'white', 'marble-look', 'gold veins'], 'Quartz', 'Polished'),
      (v_counter_cat_id, 'Silestone Eternal Serena', 'Silestone', 'Eternal', 85.00, 'sqft', true, false, ARRAY['quartz', 'white', 'subtle'], 'Quartz', 'Polished'),
      (v_counter_cat_id, 'Silestone White Zeus', 'Silestone', 'Mythology', 80.00, 'sqft', false, false, ARRAY['quartz', 'white', 'clean'], 'Quartz', 'Polished'),
      -- Quartz - Cambria
      (v_counter_cat_id, 'Cambria Brittanicca', 'Cambria', 'Marble Collection', 110.00, 'sqft', true, true, ARRAY['quartz', 'white', 'marble-look', 'luxury', 'popular'], 'Quartz', 'Polished'),
      (v_counter_cat_id, 'Cambria Torquay', 'Cambria', 'Marble Collection', 100.00, 'sqft', true, false, ARRAY['quartz', 'white', 'warm'], 'Quartz', 'Polished'),
      (v_counter_cat_id, 'Cambria Ella', 'Cambria', 'Marble Collection', 105.00, 'sqft', true, false, ARRAY['quartz', 'white', 'soft veining'], 'Quartz', 'Polished'),
      -- Granite
      (v_counter_cat_id, 'White Ice Granite', 'Natural Stone', 'Granite', 55.00, 'sqft', true, false, ARRAY['granite', 'white', 'natural', 'budget-friendly'], 'Granite', 'Polished'),
      (v_counter_cat_id, 'Giallo Ornamental Granite', 'Natural Stone', 'Granite', 50.00, 'sqft', true, false, ARRAY['granite', 'beige', 'classic'], 'Granite', 'Polished'),
      (v_counter_cat_id, 'Uba Tuba Granite', 'Natural Stone', 'Granite', 45.00, 'sqft', true, false, ARRAY['granite', 'dark', 'green', 'budget-friendly'], 'Granite', 'Polished'),
      (v_counter_cat_id, 'Black Pearl Granite', 'Natural Stone', 'Granite', 60.00, 'sqft', false, false, ARRAY['granite', 'black', 'dramatic'], 'Granite', 'Polished'),
      -- Marble
      (v_counter_cat_id, 'Carrara Marble', 'Natural Stone', 'Marble', 75.00, 'sqft', true, false, ARRAY['marble', 'white', 'classic', 'italian'], 'Marble', 'Honed'),
      (v_counter_cat_id, 'Calacatta Marble', 'Natural Stone', 'Marble', 150.00, 'sqft', false, true, ARRAY['marble', 'white', 'luxury', 'italian'], 'Marble', 'Polished'),
      -- Butcher Block
      (v_counter_cat_id, 'Maple Butcher Block', 'Craft Art', 'Wood', 45.00, 'sqft', true, false, ARRAY['wood', 'maple', 'warm', 'farmhouse'], 'Maple', 'Oiled'),
      (v_counter_cat_id, 'Walnut Butcher Block', 'Craft Art', 'Wood', 65.00, 'sqft', false, false, ARRAY['wood', 'walnut', 'rich', 'modern'], 'Walnut', 'Oiled')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 11. SEED FLOORING
-- ============================================================
INSERT INTO v2_selection_categories (name, description, display_order)
VALUES ('Flooring', 'Hardwood, LVP, tile, and carpet flooring', 30)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_floor_cat_id UUID;
BEGIN
  SELECT id INTO v_floor_cat_id FROM v2_selection_categories WHERE name = 'Flooring' LIMIT 1;

  IF v_floor_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, collection, unit_price, unit, is_popular, is_featured, tags, material, finish) VALUES
      -- Hardwood
      (v_floor_cat_id, 'Shaw Repel Reflections White Oak', 'Shaw', 'Repel Hardwood', 8.50, 'sqft', true, true, ARRAY['hardwood', 'white oak', 'engineered', 'waterproof'], 'Engineered White Oak', 'Matte'),
      (v_floor_cat_id, 'Shaw Epic Tactility Oak Ecru', 'Shaw', 'Epic', 7.00, 'sqft', true, false, ARRAY['hardwood', 'oak', 'engineered'], 'Engineered Oak', 'Wire-brushed'),
      (v_floor_cat_id, 'Anderson Natural Timbers Smooth', 'Anderson', 'Natural Timbers', 10.00, 'sqft', false, true, ARRAY['hardwood', 'premium', 'smooth'], 'Engineered Hardwood', 'Smooth'),
      (v_floor_cat_id, 'Bruce Dundee Strip Red Oak', 'Bruce', 'Dundee', 6.50, 'sqft', true, false, ARRAY['hardwood', 'red oak', 'solid', 'classic'], 'Solid Red Oak', 'Satin'),
      -- LVP (Luxury Vinyl Plank)
      (v_floor_cat_id, 'Shaw Floorte Pro Paragon HD Plus', 'Shaw', 'Floorte Pro', 4.50, 'sqft', true, true, ARRAY['lvp', 'waterproof', 'wood-look', 'popular'], 'Luxury Vinyl', 'Textured'),
      (v_floor_cat_id, 'Shaw Floorte Anvil Plus Clean Pine', 'Shaw', 'Floorte', 3.50, 'sqft', true, false, ARRAY['lvp', 'waterproof', 'budget-friendly'], 'Luxury Vinyl', 'Textured'),
      (v_floor_cat_id, 'COREtec Pro Plus Enhanced Tile', 'COREtec', 'Pro Plus', 5.00, 'sqft', true, false, ARRAY['lvp', 'waterproof', 'tile-look', 'premium'], 'Luxury Vinyl', 'Textured'),
      (v_floor_cat_id, 'LifeProof Sterling Oak', 'LifeProof', 'Essential', 3.00, 'sqft', true, false, ARRAY['lvp', 'waterproof', 'budget-friendly', 'home depot'], 'Luxury Vinyl', 'Textured'),
      -- Tile
      (v_floor_cat_id, 'MSI Arabescato Carrara 12x24', 'MSI', 'Marble', 8.00, 'sqft', true, true, ARRAY['tile', 'marble-look', 'porcelain', 'popular'], 'Porcelain', 'Polished'),
      (v_floor_cat_id, 'Daltile Cotto Contempo 13x13', 'Daltile', 'Cotto Contempo', 4.00, 'sqft', false, false, ARRAY['tile', 'porcelain', 'rustic'], 'Porcelain', 'Matte'),
      (v_floor_cat_id, 'Shaw Surrender 12x24 White', 'Shaw', 'Surrender', 5.50, 'sqft', true, false, ARRAY['tile', 'large format', 'modern'], 'Ceramic', 'Matte'),
      -- Carpet
      (v_floor_cat_id, 'Shaw Caress Quiet Comfort', 'Shaw', 'Caress', 6.00, 'sqft', true, false, ARRAY['carpet', 'soft', 'bedroom'], 'Nylon', 'Plush'),
      (v_floor_cat_id, 'Mohawk SmartStrand Silk', 'Mohawk', 'SmartStrand', 5.50, 'sqft', true, false, ARRAY['carpet', 'stain-resistant', 'pet-friendly'], 'Triexta', 'Plush')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 12. SEED LIGHTING FIXTURES
-- ============================================================
INSERT INTO v2_selection_categories (name, description, display_order)
VALUES ('Lighting', 'Light fixtures and ceiling fans', 35)
ON CONFLICT DO NOTHING;

DO $$
DECLARE
  v_light_cat_id UUID;
BEGIN
  SELECT id INTO v_light_cat_id FROM v2_selection_categories WHERE name = 'Lighting' LIMIT 1;

  IF v_light_cat_id IS NOT NULL THEN
    INSERT INTO v2_selection_catalog (category_id, name, brand, model_number, unit_price, unit, is_popular, is_featured, tags, finish, dimensions) VALUES
      -- Pendants
      (v_light_cat_id, 'Progress Lighting Laird Pendant', 'Progress Lighting', 'P500023-009', 89.00, 'each', true, false, ARRAY['pendant', 'modern', 'brushed nickel'], 'Brushed Nickel', '{"diameter": "6.5 in", "height": "8 in"}'),
      (v_light_cat_id, 'Kichler Everly Pendant 8"', 'Kichler', '42046NICS', 130.00, 'each', true, true, ARRAY['pendant', 'transitional', 'seeded glass', 'popular'], 'Brushed Nickel', '{"diameter": "8.75 in", "height": "10.75 in"}'),
      (v_light_cat_id, 'Sea Gull Lighting Alturas Pendant', 'Sea Gull', '6537301EN3-962', 180.00, 'each', false, false, ARRAY['pendant', 'modern', 'brushed gold'], 'Satin Brass', '{"diameter": "9 in", "height": "12 in"}'),
      -- Chandeliers
      (v_light_cat_id, 'Kichler Circolo 5-Light Chandelier', 'Kichler', '2344OZ', 450.00, 'each', true, true, ARRAY['chandelier', 'transitional', 'dining room'], 'Olde Bronze', '{"diameter": "26 in", "height": "28 in"}'),
      (v_light_cat_id, 'Progress Lighting Bravo Chandelier', 'Progress Lighting', 'P4623-09', 320.00, 'each', false, false, ARRAY['chandelier', 'modern', 'etched glass'], 'Brushed Nickel', '{"diameter": "22 in", "height": "18 in"}'),
      -- Flush Mounts
      (v_light_cat_id, 'Progress Lighting Inspire 2-Light', 'Progress Lighting', 'P350007-009', 75.00, 'each', true, false, ARRAY['flush', 'transitional', 'bedroom', 'hallway'], 'Brushed Nickel', '{"diameter": "15 in", "height": "5.5 in"}'),
      (v_light_cat_id, 'Kichler Flush Mount 11"', 'Kichler', '10837NILED', 85.00, 'each', true, false, ARRAY['flush', 'led', 'modern', 'laundry'], 'Brushed Nickel', '{"diameter": "11 in", "height": "3.75 in"}'),
      -- Vanity Lights
      (v_light_cat_id, 'Progress Lighting Lucky 3-Light', 'Progress Lighting', 'P2116-09', 110.00, 'each', true, true, ARRAY['vanity', 'bathroom', 'transitional'], 'Brushed Nickel', '{"width": "24 in", "height": "7.5 in"}'),
      (v_light_cat_id, 'Kichler Colinet 3-Light Bath', 'Kichler', '45924NI', 165.00, 'each', true, false, ARRAY['vanity', 'bathroom', 'modern'], 'Brushed Nickel', '{"width": "24 in", "height": "5.25 in"}'),
      -- Recessed
      (v_light_cat_id, 'Halo 6" LED Retrofit Kit', 'Halo', 'RL6069S1EWHR', 28.00, 'each', true, true, ARRAY['recessed', 'led', 'retrofit', 'popular'], 'White', '{"diameter": "6 in"}'),
      (v_light_cat_id, 'Halo 4" LED Retrofit Kit', 'Halo', 'LT460WH6930R', 22.00, 'each', true, false, ARRAY['recessed', 'led', 'retrofit', 'small'], 'White', '{"diameter": "4 in"}'),
      -- Ceiling Fans
      (v_light_cat_id, 'Hunter Fan Bennett 52"', 'Hunter', '54188', 230.00, 'each', true, true, ARRAY['ceiling fan', 'traditional', 'light kit'], 'Brushed Nickel', '{"diameter": "52 in"}'),
      (v_light_cat_id, 'Minka Aire Simple 52"', 'Minka Aire', 'F787-SL', 200.00, 'each', true, false, ARRAY['ceiling fan', 'modern', 'no light'], 'Silver', '{"diameter": "52 in"}')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 13. VIEW: Popular items by category
-- ============================================================
CREATE OR REPLACE VIEW v2_catalog_popular AS
SELECT
  c.id,
  c.name,
  c.brand,
  c.unit_price,
  c.unit,
  c.image_url,
  c.color_hex,
  c.times_selected,
  cat.name as category_name,
  cat.id as category_id,
  RANK() OVER (PARTITION BY c.category_id ORDER BY c.times_selected DESC) as popularity_rank
FROM v2_selection_catalog c
JOIN v2_selection_categories cat ON c.category_id = cat.id
WHERE c.is_active = true
  AND c.is_popular = true
ORDER BY cat.display_order, c.times_selected DESC;

-- ============================================================
-- 14. FUNCTION: Get recommendations based on selections
-- ============================================================
CREATE OR REPLACE FUNCTION get_catalog_recommendations(
  p_selected_items UUID[],
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  brand TEXT,
  category_name TEXT,
  unit_price DECIMAL,
  recommendation_reason TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH selected_styles AS (
    SELECT DISTINCT unnest(tags) as tag
    FROM v2_selection_catalog
    WHERE id = ANY(p_selected_items)
  ),
  selected_brands AS (
    SELECT DISTINCT brand
    FROM v2_selection_catalog
    WHERE id = ANY(p_selected_items)
  )
  SELECT DISTINCT ON (c.id)
    c.id,
    c.name,
    c.brand,
    cat.name as category_name,
    c.unit_price,
    CASE
      WHEN c.brand IN (SELECT brand FROM selected_brands) THEN 'Same brand as your selections'
      WHEN c.is_popular THEN 'Popular choice'
      WHEN c.tags && ARRAY(SELECT tag FROM selected_styles) THEN 'Matches your style'
      ELSE 'Recommended'
    END as recommendation_reason
  FROM v2_selection_catalog c
  JOIN v2_selection_categories cat ON c.category_id = cat.id
  WHERE c.is_active = true
    AND c.id != ALL(p_selected_items)
    AND (
      c.brand IN (SELECT brand FROM selected_brands)
      OR c.tags && ARRAY(SELECT tag FROM selected_styles)
      OR c.is_popular = true
    )
  ORDER BY c.id, c.times_selected DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 15. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_catalog_brands IS 'Brand information for catalog items';
COMMENT ON TABLE v2_selection_bundles IS 'Pre-configured selection packages';
COMMENT ON TABLE v2_catalog_favorites IS 'User/company favorited catalog items';
COMMENT ON VIEW v2_catalog_popular IS 'Popular items ranked by category';
COMMENT ON FUNCTION track_catalog_selection IS 'Track when an item is selected to update popularity';
COMMENT ON FUNCTION get_catalog_recommendations IS 'Get product recommendations based on selected items';
