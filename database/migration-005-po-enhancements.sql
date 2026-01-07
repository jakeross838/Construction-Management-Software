-- Migration 005: PO Management Enhancements
-- Run this in Supabase SQL Editor

-- ============================================================
-- ENHANCE PURCHASE ORDERS TABLE
-- ============================================================

ALTER TABLE v2_purchase_orders
  ADD COLUMN IF NOT EXISTS status_detail TEXT DEFAULT 'pending',  -- pending, approved, active, closed, cancelled
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending', -- pending, approved, rejected
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by TEXT,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by TEXT,
  ADD COLUMN IF NOT EXISTS closed_reason TEXT,
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS change_order_total DECIMAL(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS scope_of_work TEXT,
  ADD COLUMN IF NOT EXISTS expected_completion_date DATE,
  ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  -- New fields for enhanced PO management
  ADD COLUMN IF NOT EXISTS assigned_to TEXT,
  ADD COLUMN IF NOT EXISTS schedule_start_date DATE,
  ADD COLUMN IF NOT EXISTS schedule_end_date DATE,
  ADD COLUMN IF NOT EXISTS schedule_notes TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Update existing POs to new schema
UPDATE v2_purchase_orders
SET status_detail = 'active',
    approval_status = 'approved',
    original_amount = total_amount
WHERE status = 'open' AND status_detail IS NULL;

UPDATE v2_purchase_orders
SET status_detail = 'closed',
    approval_status = 'approved',
    original_amount = COALESCE(original_amount, total_amount)
WHERE status = 'closed' AND status_detail IS NULL;

UPDATE v2_purchase_orders
SET status_detail = 'cancelled',
    approval_status = 'approved',
    original_amount = COALESCE(original_amount, total_amount)
WHERE status = 'cancelled' AND status_detail IS NULL;

-- ============================================================
-- PO ATTACHMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_po_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,  -- pdf, image, document, spreadsheet, other
  file_size BIGINT,
  storage_path TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- contract, quote, drawing, photo, permit, other
  uploaded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_v2_po_attachments_po ON v2_po_attachments(po_id);

-- ============================================================
-- PO ACTIVITY LOG
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_po_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- created, submitted, approved, rejected, change_order_added, invoice_linked, closed, reopened, cancelled
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CHANGE ORDERS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE CASCADE,
  change_order_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,  -- scope_change, price_adjustment, additional_work, error_correction
  amount_change DECIMAL(12,2) NOT NULL,
  previous_total DECIMAL(12,2) NOT NULL,
  new_total DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, approved, rejected
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(po_id, change_order_number)
);

-- ============================================================
-- CHANGE ORDER LINE ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_change_order_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID REFERENCES v2_change_orders(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE SET NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  is_new BOOLEAN DEFAULT false,
  original_line_item_id UUID REFERENCES v2_po_line_items(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPROVAL THRESHOLDS (Company Settings)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_approval_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL,  -- 'po', 'change_order', 'invoice'
  threshold_amount DECIMAL(12,2) NOT NULL,
  requires_approval_from TEXT NOT NULL,
  auto_approve_below BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default thresholds (if table was just created)
INSERT INTO v2_approval_thresholds (entity_type, threshold_amount, requires_approval_from, auto_approve_below)
SELECT 'po', 5000, 'project_manager', true
WHERE NOT EXISTS (SELECT 1 FROM v2_approval_thresholds WHERE entity_type = 'po' AND threshold_amount = 5000);

INSERT INTO v2_approval_thresholds (entity_type, threshold_amount, requires_approval_from, auto_approve_below)
SELECT 'po', 25000, 'owner', false
WHERE NOT EXISTS (SELECT 1 FROM v2_approval_thresholds WHERE entity_type = 'po' AND threshold_amount = 25000);

INSERT INTO v2_approval_thresholds (entity_type, threshold_amount, requires_approval_from, auto_approve_below)
SELECT 'change_order', 2500, 'project_manager', true
WHERE NOT EXISTS (SELECT 1 FROM v2_approval_thresholds WHERE entity_type = 'change_order' AND threshold_amount = 2500);

INSERT INTO v2_approval_thresholds (entity_type, threshold_amount, requires_approval_from, auto_approve_below)
SELECT 'change_order', 10000, 'owner', false
WHERE NOT EXISTS (SELECT 1 FROM v2_approval_thresholds WHERE entity_type = 'change_order' AND threshold_amount = 10000);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_v2_po_status_detail ON v2_purchase_orders(status_detail);
CREATE INDEX IF NOT EXISTS idx_v2_po_approval ON v2_purchase_orders(approval_status);
CREATE INDEX IF NOT EXISTS idx_v2_change_orders_po ON v2_change_orders(po_id);
CREATE INDEX IF NOT EXISTS idx_v2_change_orders_status ON v2_change_orders(status);
CREATE INDEX IF NOT EXISTS idx_v2_po_activity_po ON v2_po_activity(po_id);
CREATE INDEX IF NOT EXISTS idx_v2_po_deleted ON v2_purchase_orders(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_po_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = COALESCE(OLD.version, 0) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_po_updated_at ON v2_purchase_orders;
CREATE TRIGGER trigger_po_updated_at
  BEFORE UPDATE ON v2_purchase_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_po_updated_at();
