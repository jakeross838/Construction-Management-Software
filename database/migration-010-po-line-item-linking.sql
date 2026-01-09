-- Migration 010: PO Line Item Direct Linking
-- Adds direct linking between invoice allocations and PO line items
-- This allows precise tracking of which invoice allocations bill against which PO line items

-- Add po_line_item_id to invoice allocations for direct linking
ALTER TABLE v2_invoice_allocations
ADD COLUMN IF NOT EXISTS po_line_item_id UUID REFERENCES v2_po_line_items(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_po_line_item
ON v2_invoice_allocations(po_line_item_id)
WHERE po_line_item_id IS NOT NULL;

-- Add a view to easily see PO line item billing status
CREATE OR REPLACE VIEW v_po_line_item_billing AS
SELECT
  pli.id as po_line_item_id,
  pli.po_id,
  po.po_number,
  pli.cost_code_id,
  cc.code as cost_code,
  cc.name as cost_code_name,
  pli.description,
  pli.amount as budgeted_amount,
  COALESCE(pli.invoiced_amount, 0) as invoiced_amount,
  pli.amount - COALESCE(pli.invoiced_amount, 0) as remaining_amount,
  CASE
    WHEN pli.amount > 0 THEN ROUND((COALESCE(pli.invoiced_amount, 0) / pli.amount * 100)::numeric, 1)
    ELSE 0
  END as percent_billed,
  (
    SELECT json_agg(json_build_object(
      'allocation_id', ia.id,
      'invoice_id', ia.invoice_id,
      'invoice_number', inv.invoice_number,
      'invoice_status', inv.status,
      'amount', ia.amount
    ))
    FROM v2_invoice_allocations ia
    JOIN v2_invoices inv ON inv.id = ia.invoice_id
    WHERE ia.po_line_item_id = pli.id
    AND inv.deleted_at IS NULL
  ) as linked_allocations
FROM v2_po_line_items pli
JOIN v2_purchase_orders po ON po.id = pli.po_id
LEFT JOIN v2_cost_codes cc ON cc.id = pli.cost_code_id
WHERE po.deleted_at IS NULL;

COMMENT ON COLUMN v2_invoice_allocations.po_line_item_id IS 'Direct link to PO line item this allocation bills against';
