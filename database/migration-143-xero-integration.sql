-- ============================================================
-- Xero Integration Tables
-- Migration: 143
-- ============================================================

-- Xero credentials and connection info per builder
CREATE TABLE IF NOT EXISTS v2_xero_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,  -- Xero Organization ID
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  id_token TEXT,
  organization_name TEXT,
  last_sync_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id)
);

-- Entity mapping between local and Xero IDs
CREATE TABLE IF NOT EXISTS v2_xero_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- contact, invoice, bill, account, tracking_category
  local_id UUID NOT NULL,
  xero_id TEXT NOT NULL,
  last_synced_at TIMESTAMPTZ,
  sync_direction TEXT DEFAULT 'bidirectional',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, entity_type, local_id),
  UNIQUE(builder_id, entity_type, xero_id)
);

-- Sync log for tracking all sync operations
CREATE TABLE IF NOT EXISTS v2_xero_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  direction TEXT,
  status TEXT NOT NULL,
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  error_details JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Xero account mappings (cost codes to Xero accounts)
CREATE TABLE IF NOT EXISTS v2_xero_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  xero_account_id TEXT,
  xero_account_code TEXT,
  xero_account_name TEXT,
  xero_tracking_category_id TEXT,
  xero_tracking_option_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, cost_code_id)
);

-- Sync settings per builder
CREATE TABLE IF NOT EXISTS v2_xero_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,

  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_frequency TEXT DEFAULT 'hourly',

  sync_contacts BOOLEAN DEFAULT true,  -- Vendors become Contacts
  sync_bills BOOLEAN DEFAULT true,
  sync_payments BOOLEAN DEFAULT true,
  sync_jobs_as_tracking BOOLEAN DEFAULT true,  -- Jobs as Tracking Categories

  default_expense_account_code TEXT,
  default_ap_account_code TEXT,
  use_po_numbers_as_ref BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_xero_connections_builder ON v2_xero_connections(builder_id);
CREATE INDEX IF NOT EXISTS idx_xero_entity_map_builder ON v2_xero_entity_map(builder_id);
CREATE INDEX IF NOT EXISTS idx_xero_entity_map_lookup ON v2_xero_entity_map(builder_id, entity_type, local_id);
CREATE INDEX IF NOT EXISTS idx_xero_sync_log_builder ON v2_xero_sync_log(builder_id);

-- Enable RLS
ALTER TABLE v2_xero_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_xero_entity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_xero_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_xero_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_xero_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "xero_connections_builder_policy" ON v2_xero_connections
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "xero_entity_map_builder_policy" ON v2_xero_entity_map
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "xero_sync_log_builder_policy" ON v2_xero_sync_log
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "xero_account_mappings_builder_policy" ON v2_xero_account_mappings
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "xero_settings_builder_policy" ON v2_xero_settings
  FOR ALL USING (builder_id = auth.uid()::uuid);
