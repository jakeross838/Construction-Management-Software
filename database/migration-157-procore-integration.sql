-- ============================================================
-- Procore Integration Tables
-- Migration: 157
-- Two-way sync with Procore for project management
-- ============================================================

-- Procore connection/credentials per builder
CREATE TABLE IF NOT EXISTS v2_procore_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  company_id TEXT,  -- Procore company ID
  company_name TEXT,
  access_token TEXT,  -- Encrypted OAuth access token
  refresh_token TEXT,  -- Encrypted OAuth refresh token
  token_expires_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  sync_settings JSONB DEFAULT '{
    "sync_jobs": true,
    "sync_vendors": true,
    "sync_rfis": true,
    "sync_submittals": true,
    "sync_frequency": "hourly",
    "auto_sync_enabled": true
  }'::jsonb,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id)  -- One Procore connection per builder
);

-- Sync operation log for auditing
CREATE TABLE IF NOT EXISTS v2_procore_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES v2_procore_integrations(id) ON DELETE CASCADE,
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,  -- jobs, vendors, rfis, submittals, full
  direction TEXT NOT NULL,  -- import, export, bidirectional
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, in_progress, success, failed
  records_synced INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity mapping between local IDs and Procore IDs
CREATE TABLE IF NOT EXISTS v2_procore_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- job, vendor, rfi, submittal, document
  local_id UUID NOT NULL,
  procore_id TEXT NOT NULL,
  procore_project_id TEXT,  -- Procore project context if applicable
  last_synced_at TIMESTAMPTZ,
  sync_hash TEXT,  -- Hash of last synced data for change detection
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, entity_type, local_id),
  UNIQUE(builder_id, entity_type, procore_id)
);

-- Procore webhook subscriptions (for real-time sync)
CREATE TABLE IF NOT EXISTS v2_procore_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES v2_procore_integrations(id) ON DELETE CASCADE,
  procore_hook_id TEXT,
  event_type TEXT NOT NULL,  -- project.created, project.updated, rfi.created, etc.
  enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, event_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_procore_integrations_builder
  ON v2_procore_integrations(builder_id);

CREATE INDEX IF NOT EXISTS idx_procore_sync_log_integration
  ON v2_procore_sync_log(integration_id);

CREATE INDEX IF NOT EXISTS idx_procore_sync_log_builder
  ON v2_procore_sync_log(builder_id);

CREATE INDEX IF NOT EXISTS idx_procore_sync_log_status
  ON v2_procore_sync_log(status);

CREATE INDEX IF NOT EXISTS idx_procore_sync_log_type
  ON v2_procore_sync_log(sync_type);

CREATE INDEX IF NOT EXISTS idx_procore_entity_map_builder
  ON v2_procore_entity_map(builder_id);

CREATE INDEX IF NOT EXISTS idx_procore_entity_map_lookup
  ON v2_procore_entity_map(builder_id, entity_type, local_id);

CREATE INDEX IF NOT EXISTS idx_procore_entity_map_procore
  ON v2_procore_entity_map(builder_id, entity_type, procore_id);

CREATE INDEX IF NOT EXISTS idx_procore_webhooks_builder
  ON v2_procore_webhooks(builder_id);

-- Enable Row Level Security
ALTER TABLE v2_procore_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_procore_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_procore_entity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_procore_webhooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies (builder can only access their own data)
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "procore_integrations_builder_policy" ON v2_procore_integrations;
  DROP POLICY IF EXISTS "procore_sync_log_builder_policy" ON v2_procore_sync_log;
  DROP POLICY IF EXISTS "procore_entity_map_builder_policy" ON v2_procore_entity_map;
  DROP POLICY IF EXISTS "procore_webhooks_builder_policy" ON v2_procore_webhooks;
END $$;

CREATE POLICY "procore_integrations_builder_policy" ON v2_procore_integrations
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "procore_sync_log_builder_policy" ON v2_procore_sync_log
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "procore_entity_map_builder_policy" ON v2_procore_entity_map
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "procore_webhooks_builder_policy" ON v2_procore_webhooks
  FOR ALL USING (builder_id = auth.uid()::uuid);

-- Comments
COMMENT ON TABLE v2_procore_integrations IS 'Procore OAuth credentials and settings per builder';
COMMENT ON TABLE v2_procore_sync_log IS 'Audit log of Procore sync operations';
COMMENT ON TABLE v2_procore_entity_map IS 'Mapping between local entities and Procore IDs';
COMMENT ON TABLE v2_procore_webhooks IS 'Procore webhook subscriptions for real-time sync';

-- Sync settings columns documentation
COMMENT ON COLUMN v2_procore_integrations.sync_settings IS 'JSON settings: sync_jobs, sync_vendors, sync_rfis, sync_submittals, sync_frequency (realtime|hourly|daily|manual), auto_sync_enabled';
