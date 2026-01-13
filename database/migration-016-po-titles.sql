-- Migration 016: Add title fields to POs and line items
-- Adds a title field to purchase orders and line items for better organization

-- Add title to purchase orders
ALTER TABLE v2_purchase_orders
ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN v2_purchase_orders.title IS 'Title/name for the purchase order';

-- Add title to line items
ALTER TABLE v2_po_line_items
ADD COLUMN IF NOT EXISTS title TEXT;

COMMENT ON COLUMN v2_po_line_items.title IS 'Title/name for the line item';
