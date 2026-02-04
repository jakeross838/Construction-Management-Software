-- Migration 166b: Fix v2_contacts table
-- Adds missing columns to tables that were partially created

-- Fix v2_contacts - add missing columns
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'v2_contacts'
  ) THEN
    -- Add primary_email if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'v2_contacts' AND column_name = 'primary_email'
    ) THEN
      ALTER TABLE v2_contacts ADD COLUMN primary_email TEXT;
    END IF;

    -- Add primary_phone if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'v2_contacts' AND column_name = 'primary_phone'
    ) THEN
      ALTER TABLE v2_contacts ADD COLUMN primary_phone TEXT;
    END IF;

    -- Add is_client if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'v2_contacts' AND column_name = 'is_client'
    ) THEN
      ALTER TABLE v2_contacts ADD COLUMN is_client BOOLEAN DEFAULT false;
    END IF;
  END IF;
END
$$;
