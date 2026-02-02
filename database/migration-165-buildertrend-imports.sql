-- Migration 165: Buildertrend Import System
-- Tracks imports from Buildertrend CSV exports

-- Buildertrend imports tracking table
CREATE TABLE IF NOT EXISTS v2_buildertrend_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL CHECK (import_type IN ('jobs', 'schedules', 'budgets', 'contacts')),
  file_name TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  records_imported INTEGER DEFAULT 0,
  records_skipped INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  mapping_notes JSONB DEFAULT '{}'::jsonb,
  imported_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_v2_buildertrend_imports_builder_id ON v2_buildertrend_imports(builder_id);
CREATE INDEX IF NOT EXISTS idx_v2_buildertrend_imports_status ON v2_buildertrend_imports(status);
CREATE INDEX IF NOT EXISTS idx_v2_buildertrend_imports_type ON v2_buildertrend_imports(import_type);
CREATE INDEX IF NOT EXISTS idx_v2_buildertrend_imports_created ON v2_buildertrend_imports(created_at DESC);

-- Field mapping table to track how BT fields map to our schema
CREATE TABLE IF NOT EXISTS v2_buildertrend_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  import_type TEXT NOT NULL,
  bt_field_name TEXT NOT NULL,
  our_field_name TEXT NOT NULL,
  transform_rule TEXT, -- 'direct', 'uppercase', 'date', 'currency', 'lookup', etc.
  lookup_table TEXT,   -- For lookup transforms, which table to check
  default_value TEXT,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, import_type, bt_field_name)
);

-- Table to track imported records for deduplication
CREATE TABLE IF NOT EXISTS v2_buildertrend_import_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES v2_buildertrend_imports(id) ON DELETE CASCADE,
  bt_record_id TEXT, -- Original ID from Buildertrend if available
  entity_type TEXT NOT NULL, -- 'job', 'schedule_task', 'budget_line', 'vendor', 'contact'
  local_entity_id UUID, -- ID of the created/updated record in our system
  status TEXT DEFAULT 'created' CHECK (status IN ('created', 'updated', 'skipped', 'failed')),
  error_message TEXT,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_bt_import_records_import ON v2_buildertrend_import_records(import_id);
CREATE INDEX IF NOT EXISTS idx_v2_bt_import_records_bt_id ON v2_buildertrend_import_records(bt_record_id);
CREATE INDEX IF NOT EXISTS idx_v2_bt_import_records_entity ON v2_buildertrend_import_records(entity_type, local_entity_id);
