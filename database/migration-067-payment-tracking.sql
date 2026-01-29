-- Migration 067: Separate vendor payment tracking from client billing
-- This distinguishes between:
--   1. Client billing (draw funded = client paid us)
--   2. Vendor payment (we paid the vendor)

-- Add payment tracking fields to invoices
ALTER TABLE v2_invoices
ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid')),
ADD COLUMN IF NOT EXISTS paid_to_vendor_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS paid_to_vendor_by TEXT,
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('check', 'ach', 'wire', 'credit_card', 'cash', 'other')),
ADD COLUMN IF NOT EXISTS payment_reference TEXT,  -- Check number, ACH reference, etc.
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

-- QuickBooks integration fields (for future sync)
ALTER TABLE v2_invoices
ADD COLUMN IF NOT EXISTS qb_bill_id TEXT,           -- QB Bill ID (vendor bill)
ADD COLUMN IF NOT EXISTS qb_payment_id TEXT,        -- QB Bill Payment ID
ADD COLUMN IF NOT EXISTS qb_sync_status TEXT DEFAULT 'pending' CHECK (qb_sync_status IN ('pending', 'synced', 'error', 'skipped')),
ADD COLUMN IF NOT EXISTS qb_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qb_sync_error TEXT;

-- Add similar fields to POs for QB sync
ALTER TABLE v2_purchase_orders
ADD COLUMN IF NOT EXISTS qb_po_id TEXT,
ADD COLUMN IF NOT EXISTS qb_sync_status TEXT DEFAULT 'pending' CHECK (qb_sync_status IN ('pending', 'synced', 'error', 'skipped')),
ADD COLUMN IF NOT EXISTS qb_sync_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qb_sync_error TEXT;

-- Add QB fields to vendors for linking
ALTER TABLE v2_vendors
ADD COLUMN IF NOT EXISTS qb_vendor_id TEXT,
ADD COLUMN IF NOT EXISTS qb_sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS qb_sync_at TIMESTAMPTZ;

-- Add QB fields to jobs for linking
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS qb_customer_id TEXT,      -- Jobs map to QB Customers
ADD COLUMN IF NOT EXISTS qb_class_id TEXT,         -- Optional: QB Class for job tracking
ADD COLUMN IF NOT EXISTS qb_sync_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS qb_sync_at TIMESTAMPTZ;

-- Rename 'paid' status to 'billed' for clarity (client paid us)
-- First update any existing 'paid' invoices to 'billed'
UPDATE v2_invoices SET status = 'billed' WHERE status = 'paid';

-- Create index for payment tracking queries
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON v2_invoices(payment_status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_qb_sync ON v2_invoices(qb_sync_status) WHERE deleted_at IS NULL;

-- Create payment history table for audit trail
CREATE TABLE IF NOT EXISTS v2_invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES v2_invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method TEXT CHECK (payment_method IN ('check', 'ach', 'wire', 'credit_card', 'cash', 'other')),
  reference_number TEXT,
  notes TEXT,
  recorded_by TEXT,
  qb_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON v2_invoice_payments(invoice_id);

-- Add comment explaining the status flow
COMMENT ON COLUMN v2_invoices.status IS 'Workflow status: needs_review → ready_for_approval → approved → in_draw → billed (client paid via funded draw)';
COMMENT ON COLUMN v2_invoices.payment_status IS 'Vendor payment status: unpaid → partial → paid (we paid the vendor)';
