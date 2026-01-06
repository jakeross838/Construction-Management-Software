-- Migration 002: Invoice System Enhancements
-- Run this in Supabase SQL Editor
-- Created: 2026-01-06

-- ============================================================
-- SOFT DELETE SUPPORT
-- ============================================================

ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ============================================================
-- AI PROCESSING METADATA
-- ============================================================

ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS ai_processed BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS ai_confidence JSONB;
-- Example: {"vendor": 0.95, "job": 0.72, "amount": 0.99, "invoice_number": 0.88, "date": 0.95, "overall": 0.87}

ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS ai_extracted_data JSONB;
-- Stores raw AI extraction for reference/audit

ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS ai_overrides JSONB;
-- Tracks which fields were manually overridden
-- Example: {"job_id": {"ai_value": null, "ai_confidence": 0.45, "override_value": "uuid", "override_by": "Jake", "override_at": "timestamp"}}

ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS needs_review BOOLEAN DEFAULT FALSE;
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS review_flags TEXT[];
-- Example: ["low_job_confidence", "possible_duplicate", "amount_mismatch", "verify_job", "select_job", "no_job_match"]

-- Version tracking for conflict detection
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- ============================================================
-- UNDO QUEUE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_undo_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  previous_state JSONB NOT NULL,
  performed_by TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  undone BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DUPLICATE DETECTION
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_invoice_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES v2_invoices ON DELETE CASCADE,
  hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FILE TRACKING
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_file_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES v2_invoices ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  file_type TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  orphaned_at TIMESTAMPTZ
);

-- ============================================================
-- EDIT LOCKS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_entity_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  locked_by TEXT NOT NULL,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  UNIQUE(entity_type, entity_id)
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================

-- Invoice indexes
CREATE INDEX IF NOT EXISTS idx_invoices_status_active ON v2_invoices(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_job_active ON v2_invoices(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_vendor ON v2_invoices(vendor_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created ON v2_invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_needs_review ON v2_invoices(needs_review) WHERE needs_review = TRUE AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_ai_processed ON v2_invoices(ai_processed) WHERE ai_processed = TRUE;

-- Activity indexes
CREATE INDEX IF NOT EXISTS idx_activity_invoice_date ON v2_invoice_activity(invoice_id, created_at DESC);

-- Undo queue indexes
CREATE INDEX IF NOT EXISTS idx_undo_expires ON v2_undo_queue(expires_at) WHERE undone = FALSE;
CREATE INDEX IF NOT EXISTS idx_undo_entity ON v2_undo_queue(entity_type, entity_id, created_at DESC);

-- Lock indexes
CREATE INDEX IF NOT EXISTS idx_locks_expires ON v2_entity_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_locks_entity ON v2_entity_locks(entity_type, entity_id);

-- File reference indexes
CREATE INDEX IF NOT EXISTS idx_file_refs_invoice ON v2_file_references(invoice_id);
CREATE INDEX IF NOT EXISTS idx_file_refs_orphaned ON v2_file_references(orphaned_at) WHERE orphaned_at IS NOT NULL;

-- Hash indexes for duplicate detection
CREATE INDEX IF NOT EXISTS idx_invoice_hashes_hash ON v2_invoice_hashes(hash);

-- ============================================================
-- CLEANUP FUNCTION FOR EXPIRED LOCKS
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
  DELETE FROM v2_entity_locks WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- CLEANUP FUNCTION FOR EXPIRED UNDO ENTRIES
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_expired_undo()
RETURNS void AS $$
BEGIN
  DELETE FROM v2_undo_queue WHERE expires_at < NOW() AND undone = FALSE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TRIGGER TO INCREMENT VERSION ON UPDATE
-- ============================================================

CREATE OR REPLACE FUNCTION increment_invoice_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_invoice_version ON v2_invoices;
CREATE TRIGGER trigger_invoice_version
  BEFORE UPDATE ON v2_invoices
  FOR EACH ROW
  EXECUTE FUNCTION increment_invoice_version();

-- ============================================================
-- ENABLE REALTIME FOR KEY TABLES
-- ============================================================

-- Note: Run these in Supabase dashboard if not already enabled
-- ALTER PUBLICATION supabase_realtime ADD TABLE v2_invoices;
-- ALTER PUBLICATION supabase_realtime ADD TABLE v2_invoice_activity;
-- ALTER PUBLICATION supabase_realtime ADD TABLE v2_draws;
