-- Migration 015: Add cost_type to PO line items
-- Adds a cost type field to categorize line items (Labor, Material, Equipment, Subcontractor, Other)

ALTER TABLE v2_po_line_items
ADD COLUMN IF NOT EXISTS cost_type TEXT;

COMMENT ON COLUMN v2_po_line_items.cost_type IS 'Type of cost: Labor, Material, Equipment, Subcontractor, Other';
