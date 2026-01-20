-- Migration 097: Update category tree function and rename for consistency

-- Rename Trim/Molding to Trim & Molding for consistency
UPDATE v2_selection_categories SET name = 'Trim & Molding' WHERE name = 'Trim/Molding';

-- Update get_category_tree function to properly format the hierarchy
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
    -- Root categories (level 0)
    SELECT
      c.id,
      c.name,
      c.parent_id,
      NULL::TEXT as parent_name,
      COALESCE(c.display_order, 999) as display_order,
      c.icon,
      0 as level
    FROM v2_selection_categories c
    WHERE c.parent_id IS NULL

    UNION ALL

    -- Child categories (level 1+)
    SELECT
      c.id,
      c.name,
      c.parent_id,
      ct.name as parent_name,
      COALESCE(c.display_order, 999) as display_order,
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
    COALESCE(
      (SELECT COUNT(*) FROM v2_selection_catalog p WHERE p.category_id = ct.id AND p.is_active = true),
      0
    ) as product_count
  FROM category_tree ct
  ORDER BY
    ct.level,
    ct.display_order,
    ct.name;
END;
$$ LANGUAGE plpgsql;

-- Create a simpler function to get hierarchy for API
CREATE OR REPLACE FUNCTION get_category_hierarchy()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(parent_cat ORDER BY display_order) INTO result
  FROM (
    SELECT
      pc.id,
      pc.name,
      pc.icon,
      pc.display_order,
      (
        SELECT json_agg(child_cat ORDER BY c.display_order, c.name)
        FROM (
          SELECT
            c.id,
            c.name,
            c.display_order,
            (SELECT COUNT(*) FROM v2_selection_catalog p WHERE p.category_id = c.id AND p.is_active = true) as product_count
          FROM v2_selection_categories c
          WHERE c.parent_id = pc.id
        ) child_cat
      ) as subcategories
    FROM v2_selection_categories pc
    WHERE pc.parent_id IS NULL
  ) parent_cat;

  RETURN result;
END;
$$ LANGUAGE plpgsql;
