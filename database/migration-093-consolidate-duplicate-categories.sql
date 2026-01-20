-- Migration 093: Consolidate duplicate categories
-- Fix duplicates created across multiple migrations

-- For each duplicate category name, move products to the first one and delete the rest
DO $$
DECLARE
  cat_name TEXT;
  primary_id UUID;
  dup_id UUID;
  dup_ids UUID[];
BEGIN
  -- Get list of duplicate category names
  FOR cat_name IN
    SELECT name FROM v2_selection_categories GROUP BY name HAVING COUNT(*) > 1
  LOOP
    -- Get the first (oldest) category as primary
    SELECT id INTO primary_id
    FROM v2_selection_categories
    WHERE name = cat_name
    ORDER BY created_at
    LIMIT 1;

    -- Get all duplicate IDs (excluding primary)
    SELECT array_agg(id) INTO dup_ids
    FROM v2_selection_categories
    WHERE name = cat_name AND id != primary_id;

    -- Move products from duplicates to primary
    FOREACH dup_id IN ARRAY dup_ids
    LOOP
      UPDATE v2_selection_catalog
      SET category_id = primary_id
      WHERE category_id = dup_id;

      -- Delete the duplicate category
      DELETE FROM v2_selection_categories WHERE id = dup_id;

      RAISE NOTICE 'Consolidated % (moved products from % to %)', cat_name, dup_id, primary_id;
    END LOOP;
  END LOOP;
END $$;

-- Show final counts
DO $$
DECLARE
  cat_count INTEGER;
  prod_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO cat_count FROM v2_selection_categories;
  SELECT COUNT(*) INTO prod_count FROM v2_selection_catalog;
  RAISE NOTICE 'Final: % categories, % products', cat_count, prod_count;
END $$;
