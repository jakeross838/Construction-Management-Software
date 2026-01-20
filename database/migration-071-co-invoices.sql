-- Migration 008: Change Order Invoice Linking
-- Adds junction table for linking invoices to change orders
-- Also adds GC fee tracking fields to change orders

-- ============================================================
-- ADD GC FEE FIELDS TO CHANGE ORDERS
-- ============================================================
ALTER TABLE v2_job_change_orders
  ADD COLUMN IF NOT EXISTS base_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS gc_fee_percent DECIMAL(5,2) DEFAULT 20.00,
  ADD COLUMN IF NOT EXISTS gc_fee_amount DECIMAL(12,2),
  ADD COLUMN IF NOT EXISTS first_billed_draw_number INTEGER;

-- ============================================================
-- CHANGE ORDER INVOICES JUNCTION TABLE
-- Links invoices to change orders (many-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_change_order_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES v2_job_change_orders(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES v2_invoices(id) ON DELETE CASCADE,
  amount DECIMAL(12,2), -- portion of invoice for this CO (null = full invoice amount)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(change_order_id, invoice_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_co_invoices_co_id ON v2_change_order_invoices(change_order_id);
CREATE INDEX IF NOT EXISTS idx_co_invoices_invoice_id ON v2_change_order_invoices(invoice_id);

-- ============================================================
-- CHANGE ORDER COST CODE ALLOCATIONS
-- Tracks which cost codes a CO affects (for budget impact)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_change_order_cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES v2_job_change_orders(id) ON DELETE CASCADE,
  cost_code_id UUID NOT NULL REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(change_order_id, cost_code_id)
);

-- Index for cost code lookups
CREATE INDEX IF NOT EXISTS idx_co_cost_codes_co_id ON v2_change_order_cost_codes(change_order_id);
CREATE INDEX IF NOT EXISTS idx_co_cost_codes_cc_id ON v2_change_order_cost_codes(cost_code_id);
