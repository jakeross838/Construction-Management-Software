-- Migration 081: Selection Catalog Enhancements for Visual Catalog v2.1
-- Adds multi-photo support, product specs, category hierarchy, and thumbhash placeholders

-- ============================================================
-- 1. CATEGORY HIERARCHY (parent_id for multi-level navigation)
-- ============================================================
ALTER TABLE v2_selection_categories
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES v2_selection_categories(id);

ALTER TABLE v2_selection_categories
ADD COLUMN IF NOT EXISTS slug TEXT;

ALTER TABLE v2_selection_categories
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add index for parent lookups
CREATE INDEX IF NOT EXISTS idx_v2_selection_categories_parent_id
ON v2_selection_categories(parent_id);

-- Update existing categories with slugs
UPDATE v2_selection_categories SET slug = LOWER(REPLACE(name, ' ', '-')) WHERE slug IS NULL;

-- ============================================================
-- 2. CATALOG ITEM ENHANCEMENTS (specs, dimensions, room)
-- ============================================================
-- Add product specification columns
ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS specs JSONB DEFAULT '{}';
-- Example: {"color": "Brushed Nickel", "finish": "Matte", "style": "Modern"}

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS dimensions JSONB DEFAULT '{}';
-- Example: {"width": 24, "height": 36, "depth": 12, "unit": "in"}

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS square_footage DECIMAL(10,2);
-- For flooring, tile, etc.

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS quantity_default DECIMAL(10,2) DEFAULT 1;
-- Default quantity when adding to selection

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS room TEXT;
-- Kitchen, Master Bath, Living Room, etc.

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS tags TEXT[];
-- For search/filtering: ['undermount', 'single-bowl', 'stainless']

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS thumb_hash TEXT;
-- ThumbHash for low-res placeholder while image loads

ALTER TABLE v2_selection_catalog
ADD COLUMN IF NOT EXISTS primary_image_id UUID;
-- Reference to main image in v2_catalog_images (added after table created)

-- Add indexes for filtering
CREATE INDEX IF NOT EXISTS idx_v2_selection_catalog_room ON v2_selection_catalog(room);
CREATE INDEX IF NOT EXISTS idx_v2_selection_catalog_tags ON v2_selection_catalog USING GIN(tags);

-- ============================================================
-- 3. CATALOG IMAGES TABLE (multiple photos per product)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_catalog_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  catalog_item_id UUID NOT NULL REFERENCES v2_selection_catalog(id) ON DELETE CASCADE,

  -- Storage info
  storage_path TEXT NOT NULL,        -- Path in Supabase storage: selections/{catalog_id}/{filename}
  file_name TEXT NOT NULL,
  file_size INTEGER,                 -- bytes
  mime_type TEXT DEFAULT 'image/jpeg',

  -- Image metadata
  width INTEGER,
  height INTEGER,
  thumb_hash TEXT,                   -- ThumbHash for placeholder

  -- Thumbnail
  thumbnail_path TEXT,               -- Path to generated thumbnail

  -- Display
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  caption TEXT,
  alt_text TEXT,

  -- Metadata
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_v2_catalog_images_catalog_item_id
ON v2_catalog_images(catalog_item_id);

CREATE INDEX IF NOT EXISTS idx_v2_catalog_images_is_primary
ON v2_catalog_images(catalog_item_id, is_primary) WHERE is_primary = true;

-- ============================================================
-- 4. ADD FOREIGN KEY FOR PRIMARY IMAGE
-- ============================================================
ALTER TABLE v2_selection_catalog
ADD CONSTRAINT fk_primary_image
FOREIGN KEY (primary_image_id) REFERENCES v2_catalog_images(id) ON DELETE SET NULL;

-- ============================================================
-- 5. TRIGGER: Auto-set primary_image_id when first image uploaded
-- ============================================================
CREATE OR REPLACE FUNCTION set_primary_catalog_image()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is the first image for the catalog item, set it as primary
  IF NOT EXISTS (
    SELECT 1 FROM v2_catalog_images
    WHERE catalog_item_id = NEW.catalog_item_id AND id != NEW.id
  ) THEN
    NEW.is_primary := true;
    -- Update the catalog item's primary_image_id
    UPDATE v2_selection_catalog
    SET primary_image_id = NEW.id, thumb_hash = NEW.thumb_hash
    WHERE id = NEW.catalog_item_id;
  END IF;

  -- If this is marked as primary, unmark others
  IF NEW.is_primary THEN
    UPDATE v2_catalog_images
    SET is_primary = false
    WHERE catalog_item_id = NEW.catalog_item_id AND id != NEW.id;

    -- Update catalog item's primary reference
    UPDATE v2_selection_catalog
    SET primary_image_id = NEW.id, thumb_hash = NEW.thumb_hash
    WHERE id = NEW.catalog_item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_primary_catalog_image ON v2_catalog_images;
CREATE TRIGGER trigger_set_primary_catalog_image
  BEFORE INSERT ON v2_catalog_images
  FOR EACH ROW
  EXECUTE FUNCTION set_primary_catalog_image();

-- Also handle updates to is_primary
CREATE OR REPLACE FUNCTION handle_primary_image_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary AND NOT OLD.is_primary THEN
    -- This image is being set as primary
    UPDATE v2_catalog_images
    SET is_primary = false
    WHERE catalog_item_id = NEW.catalog_item_id AND id != NEW.id;

    UPDATE v2_selection_catalog
    SET primary_image_id = NEW.id, thumb_hash = NEW.thumb_hash
    WHERE id = NEW.catalog_item_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_handle_primary_image_update ON v2_catalog_images;
CREATE TRIGGER trigger_handle_primary_image_update
  AFTER UPDATE OF is_primary ON v2_catalog_images
  FOR EACH ROW
  EXECUTE FUNCTION handle_primary_image_update();

-- ============================================================
-- 6. SEED SUBCATEGORIES (example hierarchy)
-- ============================================================
-- Get Flooring category ID and add subcategories
DO $$
DECLARE
  v_flooring_id UUID;
  v_cabinets_id UUID;
  v_plumbing_id UUID;
BEGIN
  SELECT id INTO v_flooring_id FROM v2_selection_categories WHERE name = 'Flooring' LIMIT 1;
  SELECT id INTO v_cabinets_id FROM v2_selection_categories WHERE name = 'Cabinets' LIMIT 1;
  SELECT id INTO v_plumbing_id FROM v2_selection_categories WHERE name = 'Plumbing Fixtures' LIMIT 1;

  -- Flooring subcategories
  IF v_flooring_id IS NOT NULL THEN
    INSERT INTO v2_selection_categories (name, slug, parent_id, display_order) VALUES
      ('Hardwood', 'hardwood', v_flooring_id, 1),
      ('LVP/LVT', 'lvp-lvt', v_flooring_id, 2),
      ('Tile', 'tile', v_flooring_id, 3),
      ('Carpet', 'carpet', v_flooring_id, 4)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Cabinet subcategories
  IF v_cabinets_id IS NOT NULL THEN
    INSERT INTO v2_selection_categories (name, slug, parent_id, display_order) VALUES
      ('Kitchen Cabinets', 'kitchen-cabinets', v_cabinets_id, 1),
      ('Bathroom Vanities', 'bathroom-vanities', v_cabinets_id, 2),
      ('Pantry', 'pantry', v_cabinets_id, 3)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Plumbing subcategories
  IF v_plumbing_id IS NOT NULL THEN
    INSERT INTO v2_selection_categories (name, slug, parent_id, display_order) VALUES
      ('Kitchen Faucets', 'kitchen-faucets', v_plumbing_id, 1),
      ('Bath Faucets', 'bath-faucets', v_plumbing_id, 2),
      ('Sinks', 'sinks', v_plumbing_id, 3),
      ('Toilets', 'toilets', v_plumbing_id, 4),
      ('Tubs & Showers', 'tubs-showers', v_plumbing_id, 5)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- ============================================================
-- 7. STORAGE BUCKET NOTE
-- ============================================================
-- The Supabase storage bucket 'selections' should be created via:
-- - Supabase Dashboard: Storage > New Bucket > 'selections' (public: false)
-- - Or via Supabase CLI: supabase storage create selections --public false
--
-- Bucket policies should allow:
-- - Authenticated users: INSERT, SELECT, DELETE on selections/*
-- - Service role: full access

COMMENT ON TABLE v2_catalog_images IS
'Images for selection catalog items. Storage bucket: selections/{catalog_item_id}/{filename}';
