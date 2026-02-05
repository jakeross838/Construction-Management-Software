-- Migration 178: Fix duplicate draw invoices
-- Removes any duplicate entries in v2_draw_invoices and ensures UNIQUE constraint

-- First, remove duplicates by keeping only the first entry (by created_at or id)
DELETE FROM v2_draw_invoices a
USING v2_draw_invoices b
WHERE a.draw_id = b.draw_id
  AND a.invoice_id = b.invoice_id
  AND a.id > b.id;

-- Re-add the UNIQUE constraint if it doesn't exist (it should from schema.sql)
DO $$
BEGIN
  -- Check if the constraint already exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'v2_draw_invoices_draw_id_invoice_id_key'
  ) THEN
    ALTER TABLE v2_draw_invoices
    ADD CONSTRAINT v2_draw_invoices_draw_id_invoice_id_key
    UNIQUE (draw_id, invoice_id);
  END IF;
END $$;
