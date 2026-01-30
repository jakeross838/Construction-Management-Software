-- Migration 125: Cleanup Unused Tables
-- Drops tables that are defined but never referenced in server code
-- Part of backend reorganization - cleanup phase

-- ====================================================================
-- DROP UNUSED TABLES
-- ====================================================================

-- v2_draw_line_items: Superseded by v2_draw_allocations
-- Originally intended for tracking per-line G703 data but never implemented
DROP TABLE IF EXISTS v2_draw_line_items CASCADE;

-- v2_file_references: Planned for generic file linking but never implemented
-- Documents are handled by specific tables (v2_documents, v2_po_attachments, etc.)
DROP TABLE IF EXISTS v2_file_references CASCADE;

-- v2_estimate_templates: Feature not implemented
-- Estimate system uses v2_estimates and v2_estimate_line_items instead
DROP TABLE IF EXISTS v2_estimate_templates CASCADE;

-- v2_paint_catalog: Never used
-- Paint colors are handled by v2_selections with type='paint'
DROP TABLE IF EXISTS v2_paint_catalog CASCADE;

-- v2_company_branding: Feature not implemented
-- Branding is hardcoded for Ross Built
DROP TABLE IF EXISTS v2_company_branding CASCADE;

-- v2_estimate_assemblies: Incomplete implementation
-- Assembly templates use v2_assembly_templates instead
DROP TABLE IF EXISTS v2_estimate_assemblies CASCADE;

-- ====================================================================
-- CONSOLIDATE DUPLICATE TABLES (if they exist)
-- ====================================================================

-- Check if v2_estimate_lines exists (old name) - migrate to v2_estimate_line_items
DO $$
BEGIN
    -- If both tables exist, we need to consolidate
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'v2_estimate_lines')
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'v2_estimate_line_items') THEN

        -- Copy any data from old table to new table if not already there
        INSERT INTO v2_estimate_line_items (
            estimate_id,
            cost_code_id,
            description,
            quantity,
            unit,
            unit_price,
            amount,
            notes,
            sort_order,
            created_at
        )
        SELECT
            estimate_id,
            cost_code_id,
            description,
            quantity,
            unit,
            unit_price,
            amount,
            notes,
            sort_order,
            created_at
        FROM v2_estimate_lines el
        WHERE NOT EXISTS (
            SELECT 1 FROM v2_estimate_line_items eli
            WHERE eli.estimate_id = el.estimate_id
              AND eli.cost_code_id = el.cost_code_id
        );

        -- Drop the old table
        DROP TABLE v2_estimate_lines CASCADE;

        RAISE NOTICE 'Consolidated v2_estimate_lines into v2_estimate_line_items';
    ELSIF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'v2_estimate_lines') THEN
        -- Only old table exists, rename it
        ALTER TABLE v2_estimate_lines RENAME TO v2_estimate_line_items;
        RAISE NOTICE 'Renamed v2_estimate_lines to v2_estimate_line_items';
    END IF;
END $$;

-- ====================================================================
-- CLEANUP ORPHANED DATA
-- ====================================================================

-- Remove any orphaned invoice allocations (invoice was hard deleted)
DELETE FROM v2_invoice_allocations
WHERE invoice_id NOT IN (SELECT id FROM v2_invoices);

-- Remove any orphaned draw_invoices (draw or invoice was hard deleted)
DELETE FROM v2_draw_invoices
WHERE draw_id NOT IN (SELECT id FROM v2_draws)
   OR invoice_id NOT IN (SELECT id FROM v2_invoices);

-- Remove any orphaned PO line items (PO was hard deleted)
DELETE FROM v2_po_line_items
WHERE po_id NOT IN (SELECT id FROM v2_purchase_orders);
