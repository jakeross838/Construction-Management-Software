-- Migration 124: Standardize Timestamps
-- Adds missing updated_at and deleted_at columns to tables for consistency
-- Part of backend reorganization - database standardization phase

-- ====================================================================
-- ADD updated_at COLUMNS TO TABLES MISSING THEM
-- ====================================================================

-- Jobs table
ALTER TABLE v2_jobs
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Vendors table
ALTER TABLE v2_vendors
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Cost codes table
ALTER TABLE v2_cost_codes
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Budget lines
ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Draw invoices junction table
ALTER TABLE v2_draw_invoices
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Draws table (verify it has updated_at)
ALTER TABLE v2_draws
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Invoice allocations
ALTER TABLE v2_invoice_allocations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- PO line items
ALTER TABLE v2_po_line_items
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ====================================================================
-- ADD deleted_at COLUMNS FOR SOFT DELETE SUPPORT
-- ====================================================================

-- Vendors (already have most important tables)
ALTER TABLE v2_vendors
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Cost codes
ALTER TABLE v2_cost_codes
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Budget lines
ALTER TABLE v2_budget_lines
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Draws (soft delete support)
ALTER TABLE v2_draws
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Invoice allocations (soft delete for audit trail)
ALTER TABLE v2_invoice_allocations
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- PO line items
ALTER TABLE v2_po_line_items
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- ====================================================================
-- CREATE TRIGGERS FOR auto-updating updated_at
-- ====================================================================

-- Create generic trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables
DO $$
DECLARE
    tables TEXT[] := ARRAY[
        'v2_jobs',
        'v2_vendors',
        'v2_cost_codes',
        'v2_budget_lines',
        'v2_draws',
        'v2_invoice_allocations',
        'v2_po_line_items'
    ];
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY tables
    LOOP
        -- Drop existing trigger if any
        EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I', tbl);

        -- Create new trigger
        EXECUTE format('
            CREATE TRIGGER set_updated_at
            BEFORE UPDATE ON %I
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column()
        ', tbl);
    END LOOP;
END $$;

-- ====================================================================
-- CREATE INDEXES ON deleted_at FOR SOFT DELETE QUERIES
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_vendors_deleted_at ON v2_vendors(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_cost_codes_deleted_at ON v2_cost_codes(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budget_lines_deleted_at ON v2_budget_lines(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_draws_deleted_at ON v2_draws(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_allocations_deleted_at ON v2_invoice_allocations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_po_line_items_deleted_at ON v2_po_line_items(deleted_at) WHERE deleted_at IS NULL;
