-- Migration 006: Reconciliation & External Sync Tracking
-- Adds tables for financial reconciliation and external system sync tracking

-- =====================================================
-- External Sync Tracking Table
-- Tracks sync status with QuickBooks, banks, lenders, etc.
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_external_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Entity reference
  entity_type TEXT NOT NULL,  -- 'invoice', 'draw', 'payment', 'vendor', 'job'
  entity_id UUID NOT NULL,

  -- External system info
  system TEXT NOT NULL,       -- 'quickbooks', 'bank', 'lender_portal', etc.
  external_id TEXT,           -- ID in the external system

  -- Sync status
  status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'synced', 'failed', 'skipped'
  synced_at TIMESTAMPTZ,
  synced_by TEXT,

  -- Details and error tracking
  details JSONB,              -- Additional sync data
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_error_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one sync record per entity per system
  UNIQUE(entity_type, entity_id, system)
);

-- Index for querying by entity
CREATE INDEX IF NOT EXISTS idx_external_sync_entity
  ON v2_external_sync(entity_type, entity_id);

-- Index for querying by system and status
CREATE INDEX IF NOT EXISTS idx_external_sync_system_status
  ON v2_external_sync(system, status);

-- Index for finding failed syncs
CREATE INDEX IF NOT EXISTS idx_external_sync_failed
  ON v2_external_sync(status) WHERE status = 'failed';

-- =====================================================
-- Reconciliation Log Table
-- Stores history of reconciliation runs
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_reconciliation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  job_id UUID REFERENCES v2_jobs(id),  -- NULL for all-jobs reconciliation

  -- Results
  total_checks INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  warnings INTEGER NOT NULL DEFAULT 0,

  -- Details
  results JSONB,              -- Full reconciliation results
  errors JSONB,               -- Array of error details

  -- Execution info
  run_at TIMESTAMPTZ DEFAULT NOW(),
  run_by TEXT,
  duration_ms INTEGER,

  -- Resolution tracking
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT
);

-- Index for querying by job
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_job
  ON v2_reconciliation_log(job_id);

-- Index for finding unresolved issues
CREATE INDEX IF NOT EXISTS idx_reconciliation_log_unresolved
  ON v2_reconciliation_log(failed) WHERE failed > 0 AND resolved_at IS NULL;

-- =====================================================
-- Financial Snapshot Table
-- Point-in-time snapshots for audit trail
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_financial_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Scope
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  snapshot_type TEXT NOT NULL,  -- 'draw_submit', 'month_end', 'year_end', 'manual'

  -- Reference (e.g., draw_id for draw submissions)
  reference_type TEXT,
  reference_id UUID,

  -- Snapshot data
  snapshot_data JSONB NOT NULL,  -- Full financial state at this point

  -- Totals for quick reference
  total_contract DECIMAL(14,2),
  total_billed DECIMAL(14,2),
  total_paid DECIMAL(14,2),
  retainage_held DECIMAL(14,2),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  notes TEXT
);

-- Index for querying snapshots by job
CREATE INDEX IF NOT EXISTS idx_financial_snapshots_job
  ON v2_financial_snapshots(job_id, created_at DESC);

-- =====================================================
-- Add reconciliation fields to existing tables
-- =====================================================

-- Add last_reconciled_at to invoices
ALTER TABLE v2_invoices
  ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'pending';

-- Add last_reconciled_at to draws
ALTER TABLE v2_draws
  ADD COLUMN IF NOT EXISTS last_reconciled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reconciliation_status TEXT DEFAULT 'pending';

-- =====================================================
-- Comments
-- =====================================================
COMMENT ON TABLE v2_external_sync IS 'Tracks synchronization with external systems (QuickBooks, banks, etc.)';
COMMENT ON TABLE v2_reconciliation_log IS 'History of reconciliation checks and their results';
COMMENT ON TABLE v2_financial_snapshots IS 'Point-in-time financial snapshots for audit trail';
