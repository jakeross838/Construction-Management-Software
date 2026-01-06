-- Migration 001: Add Purchase Orders and Enhanced Invoice Tracking
-- Run this in Supabase SQL Editor

-- ============================================================
-- PURCHASE ORDERS
-- ============================================================

CREATE TABLE v2_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  po_number TEXT NOT NULL,
  description TEXT,
  total_amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'open',  -- open, closed, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

CREATE TABLE v2_po_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE SET NULL,
  description TEXT,
  amount DECIMAL(12,2) NOT NULL,
  invoiced_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ENHANCE INVOICES TABLE
-- ============================================================

-- Add new columns to existing v2_invoices table
ALTER TABLE v2_invoices
  ADD COLUMN IF NOT EXISTS po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS pdf_stamped_url TEXT,
  ADD COLUMN IF NOT EXISTS coded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS coded_by TEXT,
  ADD COLUMN IF NOT EXISTS denied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS denied_by TEXT,
  ADD COLUMN IF NOT EXISTS denial_reason TEXT;

-- Update status to use new flow: received → coded → approved → in_draw → paid
-- (existing data with 'pending' status will become 'coded')
UPDATE v2_invoices SET status = 'coded' WHERE status = 'pending';
UPDATE v2_invoices SET status = 'approved' WHERE status = 'pm_approved';

-- ============================================================
-- INVOICE ACTIVITY LOG
-- ============================================================

CREATE TABLE v2_invoice_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES v2_invoices(id) ON DELETE CASCADE,
  action TEXT NOT NULL,  -- uploaded, coded, approved, denied, stamped, added_to_draw, paid
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_v2_po_job_id ON v2_purchase_orders(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_po_vendor_id ON v2_purchase_orders(vendor_id);
CREATE INDEX IF NOT EXISTS idx_v2_po_items_po_id ON v2_po_line_items(po_id);
CREATE INDEX IF NOT EXISTS idx_v2_invoice_activity_invoice_id ON v2_invoice_activity(invoice_id);
CREATE INDEX IF NOT EXISTS idx_v2_invoices_po_id ON v2_invoices(po_id);

-- ============================================================
-- ENABLE STORAGE (for PDF uploads)
-- ============================================================

-- Create storage bucket for invoices (run separately if this fails)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', true);
