-- Migration 172b: Fix tables for performance indexes
-- Adds missing columns to tables that may have been partially created

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
