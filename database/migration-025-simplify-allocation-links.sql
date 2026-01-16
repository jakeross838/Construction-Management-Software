-- Migration 025: Simplify Allocation Links
-- Cost code type determines link type: base codes -> PO, CO codes -> CO
-- No dual linking allowed (mutual exclusivity)

-- Add pending_co flag for T&M work where invoice arrives before CO is created
ALTER TABLE v2_invoice_allocations
ADD COLUMN IF NOT EXISTS pending_co BOOLEAN DEFAULT false;

COMMENT ON COLUMN v2_invoice_allocations.pending_co IS 'True if CO cost code allocation is waiting for CO to be created. Invoice cannot be approved until resolved.';

-- Clean up existing dual-linked allocations
-- If both po_id and change_order_id are set, keep the one that matches cost code type

-- For CO cost codes (ending in 'C'), keep change_order_id, clear po_id
UPDATE v2_invoice_allocations a
SET po_id = NULL
WHERE a.change_order_id IS NOT NULL
  AND a.po_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM v2_cost_codes cc
    WHERE cc.id = a.cost_code_id
    AND cc.code LIKE '%C'
  );

-- For base cost codes (not ending in 'C'), keep po_id, clear change_order_id
UPDATE v2_invoice_allocations a
SET change_order_id = NULL
WHERE a.change_order_id IS NOT NULL
  AND a.po_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM v2_cost_codes cc
    WHERE cc.id = a.cost_code_id
    AND cc.code NOT LIKE '%C'
  );

-- Add constraint: mutual exclusivity - allocation has EITHER po_id OR change_order_id, never both
ALTER TABLE v2_invoice_allocations
DROP CONSTRAINT IF EXISTS chk_single_link_type;

ALTER TABLE v2_invoice_allocations
ADD CONSTRAINT chk_single_link_type
CHECK (po_id IS NULL OR change_order_id IS NULL);

-- Create index for pending_co lookups
CREATE INDEX IF NOT EXISTS idx_allocations_pending_co
ON v2_invoice_allocations(pending_co)
WHERE pending_co = true;
