-- Migration 095: Add category hierarchy with parent/child structure
-- Simpler approach: Add parent categories and assign existing categories as children

-- Add columns for hierarchy
ALTER TABLE v2_selection_categories
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES v2_selection_categories(id),
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS icon TEXT;

-- Create index for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_selection_categories_parent ON v2_selection_categories(parent_id);

-- Create top-level parent categories
INSERT INTO v2_selection_categories (id, name, display_order, icon) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Plumbing', 1, 'droplet'),
  ('10000000-0000-0000-0000-000000000002', 'Appliances', 2, 'zap'),
  ('10000000-0000-0000-0000-000000000003', 'Flooring', 3, 'grid'),
  ('10000000-0000-0000-0000-000000000004', 'Cabinets & Storage', 4, 'archive'),
  ('10000000-0000-0000-0000-000000000005', 'Doors & Windows', 5, 'square'),
  ('10000000-0000-0000-0000-000000000006', 'Paint & Finishes', 6, 'edit-3'),
  ('10000000-0000-0000-0000-000000000007', 'Countertops & Surfaces', 7, 'layers'),
  ('10000000-0000-0000-0000-000000000008', 'Exterior', 8, 'home'),
  ('10000000-0000-0000-0000-000000000009', 'Lighting & Electrical', 9, 'sun'),
  ('10000000-0000-0000-0000-000000000010', 'Climate & Comfort', 10, 'thermometer'),
  ('10000000-0000-0000-0000-000000000011', 'Trim & Millwork', 11, 'minus')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon;

-- Assign existing categories to parent categories based on their names
-- Plumbing children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000001', display_order = 1
WHERE name IN ('Kitchen Faucets', 'Bath Faucets') AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000001', display_order = 2
WHERE name IN ('Kitchen Sinks', 'Bathroom Sinks') AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000001', display_order = 3
WHERE name = 'Toilets' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000001', display_order = 4
WHERE name IN ('Bathtubs', 'Shower Enclosures', 'Plumbing Fixtures') AND parent_id IS NULL;

-- Appliances children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000002', display_order = 1
WHERE name IN ('Range/Cooktop', 'Range Hood', 'Appliances') AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000002', display_order = 2
WHERE name = 'Refrigerator' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000002', display_order = 3
WHERE name = 'Dishwasher' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000002', display_order = 4
WHERE name = 'Washer/Dryer' AND parent_id IS NULL;

-- Flooring children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000003', display_order = 1
WHERE name = 'Hardwood' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000003', display_order = 2
WHERE name IN ('LVP/LVT', 'Flooring') AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000003', display_order = 3
WHERE name = 'Tile' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000003', display_order = 4
WHERE name = 'Carpet' AND parent_id IS NULL;

-- Cabinets & Storage children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000004', display_order = 1
WHERE name IN ('Kitchen Cabinets', 'Cabinets') AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000004', display_order = 2
WHERE name = 'Bathroom Vanities' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000004', display_order = 3
WHERE name = 'Cabinet Hardware' AND parent_id IS NULL;

-- Doors & Windows children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000005', display_order = 1
WHERE name = 'Interior Doors' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000005', display_order = 2
WHERE name = 'Exterior Doors' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000005', display_order = 3
WHERE name = 'Windows' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000005', display_order = 4
WHERE name = 'Door Hardware' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000005', display_order = 5
WHERE name = 'Window Treatments' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000005', display_order = 6
WHERE name = 'Garage Doors' AND parent_id IS NULL;

-- Paint & Finishes children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000006', display_order = 1
WHERE name = 'Interior Paint' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000006', display_order = 2
WHERE name = 'Exterior Paint' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000006', display_order = 3
WHERE name = 'Wood Stain' AND parent_id IS NULL;

-- Countertops & Surfaces children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000007', display_order = 1
WHERE name = 'Countertops' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000007', display_order = 2
WHERE name = 'Backsplash' AND parent_id IS NULL;

-- Exterior children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000008', display_order = 1
WHERE name = 'Siding' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000008', display_order = 2
WHERE name = 'Roofing' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000008', display_order = 3
WHERE name = 'Decking' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000008', display_order = 4
WHERE name = 'Gutters' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000008', display_order = 5
WHERE name = 'Landscaping' AND parent_id IS NULL;

-- Lighting & Electrical children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000009', display_order = 1
WHERE name = 'Lighting' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000009', display_order = 2
WHERE name = 'Outdoor Lighting' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000009', display_order = 3
WHERE name = 'Ceiling Fans' AND parent_id IS NULL;

-- Climate & Comfort children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000010', display_order = 1
WHERE name = 'Fireplace' AND parent_id IS NULL;

-- Trim & Millwork children
UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000011', display_order = 1
WHERE name = 'Trim/Molding' AND parent_id IS NULL;

UPDATE v2_selection_categories SET parent_id = '10000000-0000-0000-0000-000000000011', display_order = 2
WHERE name = 'Mirrors' AND parent_id IS NULL;

-- Create a function to get category tree with product counts
CREATE OR REPLACE FUNCTION get_category_tree()
RETURNS TABLE (
  id UUID,
  name TEXT,
  parent_id UUID,
  parent_name TEXT,
  display_order INTEGER,
  icon TEXT,
  level INTEGER,
  product_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH RECURSIVE category_tree AS (
    SELECT
      c.id,
      c.name,
      c.parent_id,
      NULL::TEXT as parent_name,
      c.display_order,
      c.icon,
      0 as level
    FROM v2_selection_categories c
    WHERE c.parent_id IS NULL

    UNION ALL

    SELECT
      c.id,
      c.name,
      c.parent_id,
      ct.name as parent_name,
      c.display_order,
      c.icon,
      ct.level + 1
    FROM v2_selection_categories c
    JOIN category_tree ct ON c.parent_id = ct.id
  )
  SELECT
    ct.id,
    ct.name,
    ct.parent_id,
    ct.parent_name,
    ct.display_order,
    ct.icon,
    ct.level,
    COUNT(p.id) as product_count
  FROM category_tree ct
  LEFT JOIN v2_selection_catalog p ON p.category_id = ct.id
  GROUP BY ct.id, ct.name, ct.parent_id, ct.parent_name, ct.display_order, ct.icon, ct.level
  ORDER BY ct.level, ct.display_order, ct.name;
END;
$$ LANGUAGE plpgsql;

-- Create view for browsing catalog with full hierarchy info and brand prominence
CREATE OR REPLACE VIEW v2_catalog_browse AS
SELECT
  p.id,
  p.name as product_name,
  p.description,
  p.brand,
  p.unit_price,
  p.color_hex,
  p.finish,
  p.material,
  p.is_popular,
  p.is_featured,
  p.image_url,
  p.usage_count,
  p.times_selected,
  c.id as category_id,
  c.name as category_name,
  c.display_order as category_order,
  pc.id as parent_category_id,
  pc.name as parent_category_name,
  pc.icon as parent_category_icon,
  pc.display_order as parent_category_order,
  b.logo_url as brand_logo_url,
  b.is_preferred as brand_is_preferred
FROM v2_selection_catalog p
JOIN v2_selection_categories c ON p.category_id = c.id
LEFT JOIN v2_selection_categories pc ON c.parent_id = pc.id
LEFT JOIN v2_catalog_brands b ON LOWER(p.brand) = LOWER(b.name)
WHERE p.is_active = true
ORDER BY pc.display_order, c.display_order, p.is_featured DESC, p.is_popular DESC, p.times_selected DESC;
