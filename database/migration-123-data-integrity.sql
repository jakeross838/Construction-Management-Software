-- Migration 123: Data Integrity Improvements
-- Adds unique constraints, missing indexes, soft-delete support, and audit columns

-- ============================================
-- 1. UNIQUE CONSTRAINTS
-- ============================================

-- Unique cost code codes (prevent duplicates)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_cost_code_code'
  ) THEN
    -- First, check for existing duplicates and keep only the first one
    DELETE FROM v2_cost_codes a USING v2_cost_codes b
    WHERE a.id > b.id AND a.code = b.code;

    ALTER TABLE v2_cost_codes ADD CONSTRAINT unique_cost_code_code UNIQUE(code);
  END IF;
END $$;

-- Unique PO numbers (prevent duplicate PO numbers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_po_number'
  ) THEN
    ALTER TABLE v2_purchase_orders ADD CONSTRAINT unique_po_number UNIQUE(po_number);
  END IF;
EXCEPTION WHEN unique_violation THEN
  -- If duplicates exist, create a partial unique index instead
  CREATE UNIQUE INDEX IF NOT EXISTS idx_po_number_unique
  ON v2_purchase_orders(po_number)
  WHERE deleted_at IS NULL;
END $$;

-- Unique invoice number per job/vendor combination (prevent duplicate invoices)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_unique_number
ON v2_invoices(job_id, vendor_id, invoice_number)
WHERE deleted_at IS NULL AND job_id IS NOT NULL AND vendor_id IS NOT NULL;

-- ============================================
-- 2. MISSING INDEXES
-- ============================================

-- Cost codes indexes
CREATE INDEX IF NOT EXISTS idx_cost_codes_code ON v2_cost_codes(code);
CREATE INDEX IF NOT EXISTS idx_cost_codes_category ON v2_cost_codes(category);

-- Vendor indexes
CREATE INDEX IF NOT EXISTS idx_vendors_name ON v2_vendors(name) WHERE deleted_at IS NULL;

-- PO indexes
CREATE INDEX IF NOT EXISTS idx_po_po_number ON v2_purchase_orders(po_number) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_po_job_status ON v2_purchase_orders(job_id, status) WHERE deleted_at IS NULL;

-- Change order indexes
CREATE INDEX IF NOT EXISTS idx_co_job_status ON v2_job_change_orders(job_id, status);
CREATE INDEX IF NOT EXISTS idx_co_number ON v2_job_change_orders(change_order_number);

-- Draw allocations composite index for G703 reports
CREATE INDEX IF NOT EXISTS idx_draw_allocations_draw_cost
ON v2_draw_allocations(draw_id, cost_code_id);

-- Invoice allocations job index
CREATE INDEX IF NOT EXISTS idx_allocations_job_id ON v2_invoice_allocations(job_id);

-- ============================================
-- 3. SOFT DELETE SUPPORT
-- ============================================

-- Add deleted_at to v2_cost_codes for soft delete support
ALTER TABLE v2_cost_codes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for active cost codes
CREATE INDEX IF NOT EXISTS idx_cost_codes_active ON v2_cost_codes(id) WHERE deleted_at IS NULL;

-- Add deleted_at to v2_jobs if it doesn't exist
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Index for active jobs
CREATE INDEX IF NOT EXISTS idx_jobs_active ON v2_jobs(id) WHERE deleted_at IS NULL;

-- ============================================
-- 4. AUDIT COLUMNS
-- ============================================

-- Add updated_at to v2_jobs
ALTER TABLE v2_jobs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at to v2_vendors
ALTER TABLE v2_vendors ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at to v2_cost_codes
ALTER TABLE v2_cost_codes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add updated_at to v2_budget_lines
ALTER TABLE v2_budget_lines ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create trigger function for auto-updating updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_jobs_updated_at') THEN
    CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON v2_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_vendors_updated_at') THEN
    CREATE TRIGGER update_vendors_updated_at
    BEFORE UPDATE ON v2_vendors
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cost_codes_updated_at') THEN
    CREATE TRIGGER update_cost_codes_updated_at
    BEFORE UPDATE ON v2_cost_codes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_budget_lines_updated_at') THEN
    CREATE TRIGGER update_budget_lines_updated_at
    BEFORE UPDATE ON v2_budget_lines
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ============================================
-- 5. CHECK CONSTRAINTS
-- ============================================

-- Ensure positive amounts on invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_invoice_amount_not_negative'
  ) THEN
    -- Allow negative for credit invoices, but add constraint for documentation
    -- ALTER TABLE v2_invoices ADD CONSTRAINT chk_invoice_amount_not_negative CHECK (amount >= 0);
    NULL; -- Credit invoices can be negative, so we skip this
  END IF;
END $$;

-- Ensure positive amounts on budget lines
ALTER TABLE v2_budget_lines DROP CONSTRAINT IF EXISTS chk_budget_amounts_positive;
ALTER TABLE v2_budget_lines ADD CONSTRAINT chk_budget_amounts_positive
CHECK (budgeted_amount >= 0 AND committed_amount >= 0);

-- ============================================
-- 6. DROP ORPHANED TABLE
-- ============================================

-- v2_draw_line_items was replaced by v2_draw_allocations in migration-008
-- Only drop if it exists and has no data
DO $$
DECLARE
  row_count INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'v2_draw_line_items') THEN
    SELECT COUNT(*) INTO row_count FROM v2_draw_line_items;
    IF row_count = 0 THEN
      DROP TABLE v2_draw_line_items;
      RAISE NOTICE 'Dropped orphaned table v2_draw_line_items';
    ELSE
      RAISE NOTICE 'v2_draw_line_items has % rows, not dropping', row_count;
    END IF;
  END IF;
END $$;
