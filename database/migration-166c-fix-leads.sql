-- Migration 166c: Fix v2_leads table
-- Adds missing columns to leads table that was partially created

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'v2_leads'
  ) THEN
    -- Add status if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'status') THEN
      ALTER TABLE v2_leads ADD COLUMN status TEXT DEFAULT 'active';
    END IF;

    -- Add stage_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'stage_id') THEN
      ALTER TABLE v2_leads ADD COLUMN stage_id UUID;
    END IF;

    -- Add assigned_to if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'assigned_to') THEN
      ALTER TABLE v2_leads ADD COLUMN assigned_to UUID;
    END IF;

    -- Add source_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'source_id') THEN
      ALTER TABLE v2_leads ADD COLUMN source_id UUID;
    END IF;

    -- Add next_follow_up if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'next_follow_up') THEN
      ALTER TABLE v2_leads ADD COLUMN next_follow_up DATE;
    END IF;

    -- Add created_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'created_at') THEN
      ALTER TABLE v2_leads ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add lot_lat and lot_lng if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'lot_lat') THEN
      ALTER TABLE v2_leads ADD COLUMN lot_lat DECIMAL(10, 8);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'lot_lng') THEN
      ALTER TABLE v2_leads ADD COLUMN lot_lng DECIMAL(11, 8);
    END IF;

    -- Add deleted_at if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'deleted_at') THEN
      ALTER TABLE v2_leads ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;

    -- Add pipeline_stage if missing (used by frontend)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'v2_leads' AND column_name = 'pipeline_stage') THEN
      ALTER TABLE v2_leads ADD COLUMN pipeline_stage TEXT;
    END IF;
  END IF;
END
$$;
