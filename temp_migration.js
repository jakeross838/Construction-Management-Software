const { Client } = require('pg');

const migration172b = `
-- Fix v2_documents
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_documents') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_documents' AND column_name = 'category') THEN
      ALTER TABLE v2_documents ADD COLUMN category TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_documents' AND column_name = 'folder_id') THEN
      ALTER TABLE v2_documents ADD COLUMN folder_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_documents' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_documents ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
  END IF;
END
$$;

-- Fix v2_client_invoices
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_client_invoices') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_client_invoices' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_client_invoices ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
  END IF;
END
$$;

-- Fix v2_schedules
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_schedules') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_schedules' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_schedules ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
  END IF;
END
$$;

-- Fix v2_tasks
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_tasks' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_tasks ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
  END IF;
END
$$;

-- Fix v2_daily_logs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_daily_logs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_daily_logs' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_daily_logs ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
  END IF;
END
$$;

-- Fix v2_contracts
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_contracts') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_contracts' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_contracts ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
  END IF;
END
$$;

-- Fix v2_jobs
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_jobs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_jobs' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_jobs ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
  END IF;
END
$$;

-- Fix v2_vendors
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_vendors') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_vendors' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_vendors ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
  END IF;
END
$$;
`;

const migration172c = `
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
`;

async function runMigrations() {
  // Try pooler connection
  const client = new Client({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.sorghqcpeamdfbvysafj',
    password: 'R0ssBuilt99!',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to database via pooler');

    console.log('Running migration 172b (fix documents and soft delete columns)...');
    await client.query(migration172b);
    console.log('Migration 172b complete');

    console.log('Running migration 172c (fix notifications and quickbooks sync)...');
    await client.query(migration172c);
    console.log('Migration 172c complete');

    console.log('All migrations applied successfully!');
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigrations();
