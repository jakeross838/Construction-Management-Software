-- Migration: Extended Purchase Order fields
-- Adds payment terms, delivery, warranty, and insurance tracking to POs

-- Payment and delivery fields
ALTER TABLE v2_purchase_orders
ADD COLUMN IF NOT EXISTS payment_terms TEXT,
ADD COLUMN IF NOT EXISTS delivery_date DATE,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS warranty_period TEXT;

-- Insurance tracking
ALTER TABLE v2_purchase_orders
ADD COLUMN IF NOT EXISTS insurance_required BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS insurance_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS insurance_verified_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS insurance_verified_by TEXT;

-- Vendor contact for this PO (may differ from vendor's default contact)
ALTER TABLE v2_purchase_orders
ADD COLUMN IF NOT EXISTS contact_name TEXT,
ADD COLUMN IF NOT EXISTS contact_phone TEXT,
ADD COLUMN IF NOT EXISTS contact_email TEXT;

-- Track if vendor/job can be changed (no invoices linked)
-- This is a computed field helper
CREATE OR REPLACE FUNCTION po_has_invoices(po_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM v2_invoices
    WHERE v2_invoices.po_id = $1
    AND deleted_at IS NULL
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Add comments
COMMENT ON COLUMN v2_purchase_orders.payment_terms IS 'Payment terms: Net 30, Due on Receipt, etc.';
COMMENT ON COLUMN v2_purchase_orders.delivery_date IS 'Expected delivery date for materials';
COMMENT ON COLUMN v2_purchase_orders.delivery_address IS 'Delivery address if different from job site';
COMMENT ON COLUMN v2_purchase_orders.warranty_period IS 'Warranty period for this work/materials';
COMMENT ON COLUMN v2_purchase_orders.insurance_required IS 'Whether vendor insurance is required for this PO';
COMMENT ON COLUMN v2_purchase_orders.insurance_verified IS 'Whether vendor insurance has been verified';
COMMENT ON COLUMN v2_purchase_orders.contact_name IS 'Vendor contact person for this PO';
COMMENT ON COLUMN v2_purchase_orders.contact_phone IS 'Vendor contact phone for this PO';
COMMENT ON COLUMN v2_purchase_orders.contact_email IS 'Vendor contact email for this PO';
