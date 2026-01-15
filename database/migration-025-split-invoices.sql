-- Migration 025: Split Invoice Support and PO-CO Linkage
--
-- Enables splitting a single uploaded invoice into multiple invoice records
-- and links POs directly to Job Change Orders for automatic CO tracking.

-- ============================================================
-- PART 1: SPLIT INVOICE TRACKING
-- ============================================================

-- Add parent/child relationship to v2_invoices
ALTER TABLE v2_invoices
  ADD COLUMN IF NOT EXISTS parent_invoice_id UUID REFERENCES v2_invoices(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_split_parent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS split_index INTEGER,
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(12,2);

-- Index for efficient family queries
CREATE INDEX IF NOT EXISTS idx_invoices_parent_id
  ON v2_invoices(parent_invoice_id)
  WHERE parent_invoice_id IS NOT NULL;

-- Index for finding split parents
CREATE INDEX IF NOT EXISTS idx_invoices_split_parent
  ON v2_invoices(is_split_parent)
  WHERE is_split_parent = TRUE;

-- ============================================================
-- PART 2: AI SPLIT DETECTION FIELDS
-- ============================================================

-- Add fields to track AI split suggestions
ALTER TABLE v2_invoices
  ADD COLUMN IF NOT EXISTS ai_split_suggested BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ai_split_data JSONB;

-- Comment explaining the fields
COMMENT ON COLUMN v2_invoices.parent_invoice_id IS 'If this invoice is a split child, points to the parent invoice';
COMMENT ON COLUMN v2_invoices.is_split_parent IS 'TRUE if this invoice has been split into children (container only, not in pipeline)';
COMMENT ON COLUMN v2_invoices.split_index IS 'Order within split siblings (1, 2, 3...)';
COMMENT ON COLUMN v2_invoices.original_amount IS 'Stores original amount before splitting';
COMMENT ON COLUMN v2_invoices.ai_split_suggested IS 'TRUE if AI detected multiple jobs/POs in this invoice';
COMMENT ON COLUMN v2_invoices.ai_split_data IS 'AI-suggested split details: {suggested_splits: [{job, amount}], confidence}';

-- ============================================================
-- PART 3: PO-LEVEL CHANGE ORDER LINKAGE
-- ============================================================

-- Add job_change_order_id to purchase orders
-- When a PO is created for CO work, link it here
ALTER TABLE v2_purchase_orders
  ADD COLUMN IF NOT EXISTS job_change_order_id UUID REFERENCES v2_job_change_orders(id) ON DELETE SET NULL;

-- Index for efficient CO lookups
CREATE INDEX IF NOT EXISTS idx_po_job_change_order_id
  ON v2_purchase_orders(job_change_order_id)
  WHERE job_change_order_id IS NOT NULL;

-- Comment explaining the field
COMMENT ON COLUMN v2_purchase_orders.job_change_order_id IS
  'Links PO to a Job Change Order - all invoices against this PO are automatically CO work';

-- ============================================================
-- PART 4: UPDATE VALIDATION.JS STATUS TRANSITIONS
-- ============================================================
-- Note: 'split' status needs to be added to STATUS_TRANSITIONS in server/validation.js
-- Split parents have status='split' and are excluded from normal pipeline

-- ============================================================
-- MIGRATION COMPLETE
-- ============================================================
