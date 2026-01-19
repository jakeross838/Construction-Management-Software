-- Migration 065: Verbal Purchase Orders (VPOs)
-- VPOs are quick authorizations for additional work without full CO paperwork

-- Create VPO table
CREATE TABLE IF NOT EXISTS v2_verbal_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES v2_purchase_orders(id) ON DELETE CASCADE,
  vpo_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  reason TEXT,
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  authorized_by TEXT,
  authorized_date DATE DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'voided')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(po_id, vpo_number)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_vpo_po_id ON v2_verbal_purchase_orders(po_id);
CREATE INDEX IF NOT EXISTS idx_vpo_status ON v2_verbal_purchase_orders(status);

-- Add VPO total to purchase orders if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'v2_purchase_orders' AND column_name = 'vpo_total'
  ) THEN
    ALTER TABLE v2_purchase_orders ADD COLUMN vpo_total DECIMAL(12,2) DEFAULT 0;
  END IF;
END $$;

-- Function to update PO vpo_total when VPOs change
CREATE OR REPLACE FUNCTION update_po_vpo_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the PO's vpo_total
  UPDATE v2_purchase_orders
  SET vpo_total = COALESCE((
    SELECT SUM(amount)
    FROM v2_verbal_purchase_orders
    WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    AND status = 'approved'
  ), 0),
  total_amount = original_amount + COALESCE(change_order_total, 0) + COALESCE((
    SELECT SUM(amount)
    FROM v2_verbal_purchase_orders
    WHERE po_id = COALESCE(NEW.po_id, OLD.po_id)
    AND status = 'approved'
  ), 0)
  WHERE id = COALESCE(NEW.po_id, OLD.po_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger for VPO changes
DROP TRIGGER IF EXISTS trigger_update_po_vpo_total ON v2_verbal_purchase_orders;
CREATE TRIGGER trigger_update_po_vpo_total
AFTER INSERT OR UPDATE OR DELETE ON v2_verbal_purchase_orders
FOR EACH ROW EXECUTE FUNCTION update_po_vpo_total();

-- Enable RLS
ALTER TABLE v2_verbal_purchase_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Allow all access to VPOs" ON v2_verbal_purchase_orders;
CREATE POLICY "Allow all access to VPOs" ON v2_verbal_purchase_orders FOR ALL USING (true);

COMMENT ON TABLE v2_verbal_purchase_orders IS 'Verbal Purchase Orders - quick authorizations for additional work';
