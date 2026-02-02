-- ============================================================
-- QuickBooks Online Integration Tables
-- Migration: 142
-- ============================================================

-- QuickBooks credentials and connection info per builder
CREATE TABLE IF NOT EXISTS v2_quickbooks_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  realm_id TEXT NOT NULL,  -- QBO Company ID
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  company_name TEXT,
  is_sandbox BOOLEAN DEFAULT false,
  last_sync_at TIMESTAMPTZ,
  sync_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id)  -- One QBO connection per builder
);

-- Entity mapping between local and QuickBooks IDs
CREATE TABLE IF NOT EXISTS v2_quickbooks_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,  -- vendor, invoice, bill, customer, account, class
  local_id UUID NOT NULL,
  qbo_id TEXT NOT NULL,
  qbo_sync_token TEXT,  -- QBO's version tracking
  last_synced_at TIMESTAMPTZ,
  sync_direction TEXT DEFAULT 'bidirectional',  -- local_to_qbo, qbo_to_local, bidirectional
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, entity_type, local_id),
  UNIQUE(builder_id, entity_type, qbo_id)
);

-- Sync log for tracking all sync operations
CREATE TABLE IF NOT EXISTS v2_quickbooks_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL,  -- full, incremental, entity
  entity_type TEXT,
  entity_id UUID,
  direction TEXT,  -- push, pull
  status TEXT NOT NULL,  -- pending, in_progress, success, failed
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

-- QuickBooks account mappings (cost codes to QBO accounts)
CREATE TABLE IF NOT EXISTS v2_quickbooks_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  qbo_expense_account_id TEXT,
  qbo_expense_account_name TEXT,
  qbo_class_id TEXT,
  qbo_class_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, cost_code_id)
);

-- Sync settings per builder
CREATE TABLE IF NOT EXISTS v2_quickbooks_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,

  -- Sync preferences
  auto_sync_enabled BOOLEAN DEFAULT true,
  sync_frequency TEXT DEFAULT 'hourly',  -- realtime, hourly, daily, manual

  -- What to sync
  sync_vendors BOOLEAN DEFAULT true,
  sync_bills BOOLEAN DEFAULT true,      -- Invoices become Bills in QBO
  sync_payments BOOLEAN DEFAULT true,
  sync_jobs_as_customers BOOLEAN DEFAULT false,
  sync_jobs_as_classes BOOLEAN DEFAULT true,

  -- Mapping preferences
  default_expense_account_id TEXT,
  default_ap_account_id TEXT,
  use_po_numbers_as_ref BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_qbo_connections_builder ON v2_quickbooks_connections(builder_id);
CREATE INDEX IF NOT EXISTS idx_qbo_entity_map_builder ON v2_quickbooks_entity_map(builder_id);
CREATE INDEX IF NOT EXISTS idx_qbo_entity_map_lookup ON v2_quickbooks_entity_map(builder_id, entity_type, local_id);
CREATE INDEX IF NOT EXISTS idx_qbo_sync_log_builder ON v2_quickbooks_sync_log(builder_id);
CREATE INDEX IF NOT EXISTS idx_qbo_sync_log_status ON v2_quickbooks_sync_log(status);

-- Enable RLS
ALTER TABLE v2_quickbooks_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_quickbooks_entity_map ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_quickbooks_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_quickbooks_account_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_quickbooks_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (builder can only access their own data)
CREATE POLICY "qbo_connections_builder_policy" ON v2_quickbooks_connections
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "qbo_entity_map_builder_policy" ON v2_quickbooks_entity_map
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "qbo_sync_log_builder_policy" ON v2_quickbooks_sync_log
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "qbo_account_mappings_builder_policy" ON v2_quickbooks_account_mappings
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "qbo_settings_builder_policy" ON v2_quickbooks_settings
  FOR ALL USING (builder_id = auth.uid()::uuid);

-- Comment on tables
COMMENT ON TABLE v2_quickbooks_connections IS 'QuickBooks Online OAuth credentials per builder';
COMMENT ON TABLE v2_quickbooks_entity_map IS 'Mapping between local entities and QuickBooks IDs';
COMMENT ON TABLE v2_quickbooks_sync_log IS 'Audit log of all sync operations';
COMMENT ON TABLE v2_quickbooks_account_mappings IS 'Map cost codes to QuickBooks expense accounts';
COMMENT ON TABLE v2_quickbooks_settings IS 'QuickBooks sync preferences per builder';
