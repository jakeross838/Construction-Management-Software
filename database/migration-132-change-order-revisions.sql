-- Migration 132: Change Order Revisions
-- Adds revision tracking for change orders

-- ============================================================
-- ADD REVISION NUMBER TO CHANGE ORDERS
-- ============================================================
ALTER TABLE v2_job_change_orders
ADD COLUMN IF NOT EXISTS revision_number INTEGER DEFAULT 0;

-- Set existing records to revision 0 (original)
UPDATE v2_job_change_orders SET revision_number = 0 WHERE revision_number IS NULL;

-- ============================================================
-- CHANGE ORDER REVISIONS TABLE
-- Stores historical snapshots when a CO is revised
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_change_order_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES v2_job_change_orders(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,

  -- Snapshot of CO data at this revision
  title TEXT,
  description TEXT,
  reason TEXT,
  amount DECIMAL(12,2),
  base_amount DECIMAL(12,2),
  gc_fee_percent DECIMAL(5,2),
  gc_fee_amount DECIMAL(12,2),
  admin_hours DECIMAL(8,2),
  admin_rate DECIMAL(10,2),
  admin_cost DECIMAL(12,2),
  days_added INTEGER,
  markup_percent DECIMAL(5,2),
  markup_amount DECIMAL(12,2),
  subtotal DECIMAL(12,2),
  total_amount DECIMAL(12,2),
  pm_hours DECIMAL(8,2),
  pm_hourly_rate DECIMAL(10,2),
  pm_cost DECIMAL(12,2),
  days_impact INTEGER,

  -- Line items stored as JSONB for historical snapshot
  line_items JSONB,

  -- Revision metadata
  revision_reason TEXT,
  revised_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(change_order_id, revision_number)
);

-- Index for fast lookups by change order
CREATE INDEX IF NOT EXISTS idx_co_revisions_change_order_id
ON v2_change_order_revisions(change_order_id);

-- Index for revision ordering
CREATE INDEX IF NOT EXISTS idx_co_revisions_number
ON v2_change_order_revisions(change_order_id, revision_number DESC);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON TABLE v2_change_order_revisions IS 'Historical snapshots of change orders for revision tracking';
COMMENT ON COLUMN v2_change_order_revisions.revision_number IS 'Revision number (0 = original, 1+ = revisions)';
COMMENT ON COLUMN v2_change_order_revisions.line_items IS 'JSON snapshot of line items at this revision';
COMMENT ON COLUMN v2_change_order_revisions.revision_reason IS 'Explanation of why this revision was created';
