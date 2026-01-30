-- Migration 126: Remove v2_ Prefix - Create Compatibility Views
--
-- This migration creates views without the v2_ prefix that point to the existing tables.
-- This allows gradual migration of code without breaking existing functionality.
--
-- Note: Only creates views for tables that are known to exist.
-- Uses DO blocks to safely check table existence before creating views.

-- ====================================================================
-- HELPER FUNCTION to safely create views
-- ====================================================================
DROP FUNCTION IF EXISTS create_view_if_table_exists(TEXT, TEXT);
CREATE FUNCTION create_view_if_table_exists(p_view_name TEXT, p_table_name TEXT)
RETURNS VOID AS $$
BEGIN
    -- Check if source table exists
    IF EXISTS (SELECT FROM information_schema.tables t WHERE t.table_name = p_table_name AND t.table_schema = 'public') THEN
        -- Drop existing view if any
        EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', p_view_name);
        -- Create new view
        EXECUTE format('CREATE VIEW %I AS SELECT * FROM %I', p_view_name, p_table_name);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ====================================================================
-- CORE TABLES - Create views for tables that exist
-- ====================================================================
SELECT create_view_if_table_exists('jobs', 'v2_jobs');
SELECT create_view_if_table_exists('vendors', 'v2_vendors');
SELECT create_view_if_table_exists('cost_codes', 'v2_cost_codes');
SELECT create_view_if_table_exists('invoices', 'v2_invoices');
SELECT create_view_if_table_exists('invoice_allocations', 'v2_invoice_allocations');
SELECT create_view_if_table_exists('invoice_activity', 'v2_invoice_activity');
SELECT create_view_if_table_exists('invoice_hashes', 'v2_invoice_hashes');
SELECT create_view_if_table_exists('purchase_orders', 'v2_purchase_orders');
SELECT create_view_if_table_exists('po_line_items', 'v2_po_line_items');
SELECT create_view_if_table_exists('po_activity', 'v2_po_activity');
SELECT create_view_if_table_exists('po_attachments', 'v2_po_attachments');
SELECT create_view_if_table_exists('draws', 'v2_draws');
SELECT create_view_if_table_exists('draw_invoices', 'v2_draw_invoices');
SELECT create_view_if_table_exists('draw_allocations', 'v2_draw_allocations');
SELECT create_view_if_table_exists('draw_activity', 'v2_draw_activity');
SELECT create_view_if_table_exists('draw_attachments', 'v2_draw_attachments');
SELECT create_view_if_table_exists('budget_lines', 'v2_budget_lines');
SELECT create_view_if_table_exists('change_orders', 'v2_change_orders');
SELECT create_view_if_table_exists('change_order_line_items', 'v2_change_order_line_items');

-- ====================================================================
-- SYSTEM TABLES
-- ====================================================================
SELECT create_view_if_table_exists('entity_locks', 'v2_entity_locks');
SELECT create_view_if_table_exists('undo_queue', 'v2_undo_queue');
SELECT create_view_if_table_exists('approval_thresholds', 'v2_approval_thresholds');
SELECT create_view_if_table_exists('ai_learned_mappings', 'v2_ai_learned_mappings');
SELECT create_view_if_table_exists('ai_feedback', 'v2_ai_feedback');

-- ====================================================================
-- FEATURE TABLES
-- ====================================================================
SELECT create_view_if_table_exists('daily_logs', 'v2_daily_logs');
SELECT create_view_if_table_exists('daily_log_crew', 'v2_daily_log_crew');
SELECT create_view_if_table_exists('daily_log_weather', 'v2_daily_log_weather');
SELECT create_view_if_table_exists('daily_log_deliveries', 'v2_daily_log_deliveries');
SELECT create_view_if_table_exists('schedules', 'v2_schedules');
SELECT create_view_if_table_exists('schedule_tasks', 'v2_schedule_tasks');
SELECT create_view_if_table_exists('inspections', 'v2_inspections');
SELECT create_view_if_table_exists('punch_list_items', 'v2_punch_list_items');
SELECT create_view_if_table_exists('documents', 'v2_documents');
SELECT create_view_if_table_exists('lien_releases', 'v2_lien_releases');
SELECT create_view_if_table_exists('reconciliation_history', 'v2_reconciliation_history');
SELECT create_view_if_table_exists('external_sync', 'v2_external_sync');

-- ====================================================================
-- CLEANUP - Drop helper function
-- ====================================================================
DROP FUNCTION IF EXISTS create_view_if_table_exists(TEXT, TEXT);

-- ====================================================================
-- COMMENTS
-- ====================================================================
COMMENT ON VIEW jobs IS 'Compatibility view pointing to v2_jobs';
COMMENT ON VIEW vendors IS 'Compatibility view pointing to v2_vendors';
COMMENT ON VIEW invoices IS 'Compatibility view pointing to v2_invoices';
COMMENT ON VIEW purchase_orders IS 'Compatibility view pointing to v2_purchase_orders';
COMMENT ON VIEW draws IS 'Compatibility view pointing to v2_draws';
