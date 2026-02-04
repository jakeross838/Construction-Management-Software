-- Migration 172c: Fix v2_notifications and v2_quickbooks_sync_log tables
-- Creates tables if missing or adds missing columns

-- Create v2_notifications if it doesn't exist
CREATE TABLE IF NOT EXISTS v2_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  builder_id UUID,
  type TEXT,
  title TEXT,
  message TEXT,
  link TEXT,
  entity_type TEXT,
  entity_id UUID,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to v2_notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_notifications') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_notifications' AND column_name = 'user_id') THEN
      ALTER TABLE v2_notifications ADD COLUMN user_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_notifications' AND column_name = 'read') THEN
      ALTER TABLE v2_notifications ADD COLUMN read BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_notifications' AND column_name = 'created_at') THEN
      ALTER TABLE v2_notifications ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END
$$;

-- Create v2_quickbooks_sync_log if it doesn't exist
CREATE TABLE IF NOT EXISTS v2_quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID,
  entity_type TEXT,
  entity_id UUID,
  qbo_id TEXT,
  action TEXT,
  status TEXT DEFAULT 'pending',
  error_message TEXT,
  request_data JSONB,
  response_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to v2_quickbooks_sync_log
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_quickbooks_sync_log') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_quickbooks_sync_log' AND column_name = 'builder_id') THEN
      ALTER TABLE v2_quickbooks_sync_log ADD COLUMN builder_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_quickbooks_sync_log' AND column_name = 'status') THEN
      ALTER TABLE v2_quickbooks_sync_log ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_quickbooks_sync_log' AND column_name = 'created_at') THEN
      ALTER TABLE v2_quickbooks_sync_log ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END
$$;
