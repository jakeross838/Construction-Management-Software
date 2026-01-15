-- Migration 026: Send Back Tracking
-- Adds columns to track when and why invoices are sent back for review

-- Add sent_back tracking columns to v2_invoices
ALTER TABLE v2_invoices
  ADD COLUMN IF NOT EXISTS sent_back_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sent_back_by TEXT,
  ADD COLUMN IF NOT EXISTS sent_back_reason TEXT;

-- Add index for querying sent back invoices
CREATE INDEX IF NOT EXISTS idx_invoices_sent_back_at ON v2_invoices(sent_back_at) WHERE sent_back_at IS NOT NULL;
