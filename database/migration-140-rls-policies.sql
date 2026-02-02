-- Migration 140: Row-Level Security (RLS) Policies
-- Creates database-level security policies for multi-tenant isolation
-- This provides defense-in-depth beyond application-level filtering

-- =====================================================
-- Helper function to get builder_id from JWT
-- Returns NULL if user not authenticated or not found
-- =====================================================
CREATE OR REPLACE FUNCTION get_current_builder_id()
RETURNS UUID AS $$
DECLARE
  user_builder_id UUID;
BEGIN
  -- Get builder_id from the JWT claims
  -- The v2_users table links auth.uid() to builder_id
  SELECT builder_id INTO user_builder_id
  FROM v2_users
  WHERE id = auth.uid()
  LIMIT 1;

  RETURN user_builder_id;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- Enable RLS and create policies for tables with builder_id
-- Using a single DO block to handle all tables
-- =====================================================
DO $$
DECLARE
  rec RECORD;
  policy_name TEXT;
BEGIN
  -- Loop through all tables that have builder_id column
  FOR rec IN
    SELECT DISTINCT table_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name = 'builder_id'
      AND table_name LIKE 'v2_%'
      AND table_name != 'v2_builders' -- Special handling below
  LOOP
    BEGIN
      -- Enable RLS
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', rec.table_name);

      -- Create policy name
      policy_name := 'builder_isolation_' || replace(rec.table_name, 'v2_', '');

      -- Drop existing policy if it exists
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I', policy_name, rec.table_name);

      -- Create policy that allows access if builder_id matches or is NULL (transition period)
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (builder_id = get_current_builder_id() OR builder_id IS NULL)',
        policy_name, rec.table_name
      );

      RAISE NOTICE 'Enabled RLS and created policy for %', rec.table_name;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Error processing %: %', rec.table_name, SQLERRM;
    END;
  END LOOP;
END $$;

-- =====================================================
-- Special policies for auth tables
-- =====================================================

-- v2_builders: Only see your own builder
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_builders') THEN
    ALTER TABLE v2_builders ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS builder_own_data ON v2_builders;
    CREATE POLICY builder_own_data ON v2_builders
      FOR ALL USING (id = get_current_builder_id());
    RAISE NOTICE 'Enabled RLS for v2_builders';
  END IF;
END $$;

-- =====================================================
-- Grant necessary permissions
-- =====================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Service role has full access (bypasses RLS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
