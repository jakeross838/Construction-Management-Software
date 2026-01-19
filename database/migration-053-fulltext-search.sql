-- Migration 053: Full-Text Search for Master Items
-- Improves matching performance by using PostgreSQL full-text search instead of loading items into memory

-- Add tsvector column for full-text search
ALTER TABLE v2_master_items
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create function to update search vector
CREATE OR REPLACE FUNCTION update_master_item_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.standard_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.subcategory, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.keywords, ' '), '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update search vector
DROP TRIGGER IF EXISTS master_item_search_update ON v2_master_items;
CREATE TRIGGER master_item_search_update
  BEFORE INSERT OR UPDATE OF standard_name, category, subcategory, keywords
  ON v2_master_items
  FOR EACH ROW
  EXECUTE FUNCTION update_master_item_search_vector();

-- Populate search_vector for existing records
UPDATE v2_master_items SET
  search_vector =
    setweight(to_tsvector('english', COALESCE(standard_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(category, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(subcategory, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(keywords, ' '), '')), 'C');

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_master_items_search ON v2_master_items USING GIN(search_vector);

-- Create function for full-text search with ranking
CREATE OR REPLACE FUNCTION search_master_items(
  p_query TEXT,
  p_category TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
) RETURNS TABLE (
  id UUID,
  standard_name TEXT,
  category TEXT,
  subcategory TEXT,
  standard_unit TEXT,
  keywords TEXT[],
  dimensions JSONB,
  rank REAL
) AS $$
DECLARE
  v_tsquery tsquery;
BEGIN
  -- Convert search terms to tsquery (handle partial words)
  v_tsquery := plainto_tsquery('english', p_query);

  RETURN QUERY
  SELECT
    m.id,
    m.standard_name,
    m.category,
    m.subcategory,
    m.standard_unit,
    m.keywords,
    m.dimensions,
    ts_rank(m.search_vector, v_tsquery) AS rank
  FROM v2_master_items m
  WHERE m.is_active = true
    AND (p_category IS NULL OR m.category = p_category)
    AND (
      m.search_vector @@ v_tsquery
      OR m.standard_name ILIKE '%' || p_query || '%'
    )
  ORDER BY rank DESC, m.standard_name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Also add full-text search to vendor aliases
ALTER TABLE v2_vendor_item_aliases
ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE OR REPLACE FUNCTION update_alias_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.vendor_description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS alias_search_update ON v2_vendor_item_aliases;
CREATE TRIGGER alias_search_update
  BEFORE INSERT OR UPDATE OF vendor_description
  ON v2_vendor_item_aliases
  FOR EACH ROW
  EXECUTE FUNCTION update_alias_search_vector();

-- Populate for existing aliases
UPDATE v2_vendor_item_aliases SET
  search_vector = to_tsvector('english', COALESCE(vendor_description, ''));

CREATE INDEX IF NOT EXISTS idx_vendor_aliases_search ON v2_vendor_item_aliases USING GIN(search_vector);

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Full-text search indexes created for master_items and vendor_aliases';
END $$;
