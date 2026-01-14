-- Migration 024: Add change_order_id to PO line items
-- This allows PO line items with CO cost codes to be linked to a specific Change Order

-- Add change_order_id column to po_line_items
ALTER TABLE v2_po_line_items
ADD COLUMN IF NOT EXISTS change_order_id UUID REFERENCES v2_job_change_orders(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_po_line_items_change_order_id
ON v2_po_line_items(change_order_id)
WHERE change_order_id IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN v2_po_line_items.change_order_id IS 'If this line item uses a CO cost code, link to the Change Order it belongs to';
