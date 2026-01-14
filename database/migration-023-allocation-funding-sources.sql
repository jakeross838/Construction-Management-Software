-- Migration 023: Add funding source tracking to invoice allocations
-- Allows each allocation line to specify whether it goes to a PO, CO, or base budget

-- Add PO reference columns to invoice allocations
ALTER TABLE v2_invoice_allocations
  ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS po_line_item_id UUID REFERENCES v2_po_line_items(id) ON DELETE SET NULL;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_po_id ON v2_invoice_allocations(po_id);
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_po_line_item_id ON v2_invoice_allocations(po_line_item_id);

-- Add comments explaining the funding source logic
COMMENT ON COLUMN v2_invoice_allocations.po_id IS 'If set, this allocation is for PO work';
COMMENT ON COLUMN v2_invoice_allocations.po_line_item_id IS 'Optional: specific PO line item this allocation applies to';
COMMENT ON COLUMN v2_invoice_allocations.change_order_id IS 'If set, this allocation is for CO work';
-- Note: If neither po_id nor change_order_id is set, allocation goes to base budget
