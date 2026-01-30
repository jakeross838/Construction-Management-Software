-- Migration 126: Remove v2_ Prefix - Create Compatibility Views
--
-- This migration creates views without the v2_ prefix that point to the existing tables.
-- This allows gradual migration of code without breaking existing functionality.
--
-- STRATEGY:
-- 1. Create views with new names pointing to v2_ tables
-- 2. Gradually update server code to use new names (views work with SELECT/INSERT/UPDATE/DELETE)
-- 3. In future migration, rename actual tables and drop views
--
-- Benefits:
-- - Zero downtime migration
-- - Rollback is simple (just drop views)
-- - Can update code gradually
-- - Both old and new names work simultaneously

-- ====================================================================
-- CORE TABLES - Create views without v2_ prefix
-- ====================================================================

-- Jobs
CREATE OR REPLACE VIEW jobs AS SELECT * FROM v2_jobs;

-- Vendors
CREATE OR REPLACE VIEW vendors AS SELECT * FROM v2_vendors;

-- Cost Codes
CREATE OR REPLACE VIEW cost_codes AS SELECT * FROM v2_cost_codes;

-- Invoices
CREATE OR REPLACE VIEW invoices AS SELECT * FROM v2_invoices;

-- Invoice Allocations
CREATE OR REPLACE VIEW invoice_allocations AS SELECT * FROM v2_invoice_allocations;

-- Invoice Activity
CREATE OR REPLACE VIEW invoice_activity AS SELECT * FROM v2_invoice_activity;

-- Invoice Hashes (for duplicate detection)
CREATE OR REPLACE VIEW invoice_hashes AS SELECT * FROM v2_invoice_hashes;

-- Purchase Orders
CREATE OR REPLACE VIEW purchase_orders AS SELECT * FROM v2_purchase_orders;

-- PO Line Items
CREATE OR REPLACE VIEW po_line_items AS SELECT * FROM v2_po_line_items;

-- PO Activity
CREATE OR REPLACE VIEW po_activity AS SELECT * FROM v2_po_activity;

-- PO Attachments
CREATE OR REPLACE VIEW po_attachments AS SELECT * FROM v2_po_attachments;

-- Draws
CREATE OR REPLACE VIEW draws AS SELECT * FROM v2_draws;

-- Draw Invoices (junction table)
CREATE OR REPLACE VIEW draw_invoices AS SELECT * FROM v2_draw_invoices;

-- Draw Allocations
CREATE OR REPLACE VIEW draw_allocations AS SELECT * FROM v2_draw_allocations;

-- Draw Activity
CREATE OR REPLACE VIEW draw_activity AS SELECT * FROM v2_draw_activity;

-- Draw Attachments
CREATE OR REPLACE VIEW draw_attachments AS SELECT * FROM v2_draw_attachments;

-- Budget Lines
CREATE OR REPLACE VIEW budget_lines AS SELECT * FROM v2_budget_lines;

-- Change Orders
CREATE OR REPLACE VIEW change_orders AS SELECT * FROM v2_change_orders;

-- Change Order Line Items
CREATE OR REPLACE VIEW change_order_line_items AS SELECT * FROM v2_change_order_line_items;

-- ====================================================================
-- SYSTEM TABLES - Create views
-- ====================================================================

-- Entity Locks
CREATE OR REPLACE VIEW entity_locks AS SELECT * FROM v2_entity_locks;

-- Undo Queue
CREATE OR REPLACE VIEW undo_queue AS SELECT * FROM v2_undo_queue;

-- Approval Thresholds
CREATE OR REPLACE VIEW approval_thresholds AS SELECT * FROM v2_approval_thresholds;

-- AI Learning
CREATE OR REPLACE VIEW ai_learned_mappings AS SELECT * FROM v2_ai_learned_mappings;

-- AI Feedback
CREATE OR REPLACE VIEW ai_feedback AS SELECT * FROM v2_ai_feedback;

-- ====================================================================
-- FEATURE TABLES - Create views
-- ====================================================================

-- Daily Logs
CREATE OR REPLACE VIEW daily_logs AS SELECT * FROM v2_daily_logs;

-- Daily Log Crew
CREATE OR REPLACE VIEW daily_log_crew AS SELECT * FROM v2_daily_log_crew;

-- Daily Log Weather
CREATE OR REPLACE VIEW daily_log_weather AS SELECT * FROM v2_daily_log_weather;

-- Daily Log Deliveries
CREATE OR REPLACE VIEW daily_log_deliveries AS SELECT * FROM v2_daily_log_deliveries;

-- Schedules
CREATE OR REPLACE VIEW schedules AS SELECT * FROM v2_schedules;

-- Schedule Tasks
CREATE OR REPLACE VIEW schedule_tasks AS SELECT * FROM v2_schedule_tasks;

-- Inspections
CREATE OR REPLACE VIEW inspections AS SELECT * FROM v2_inspections;

-- Punch Lists
CREATE OR REPLACE VIEW punch_list_items AS SELECT * FROM v2_punch_list_items;

-- Documents
CREATE OR REPLACE VIEW documents AS SELECT * FROM v2_documents;

-- Lien Releases
CREATE OR REPLACE VIEW lien_releases AS SELECT * FROM v2_lien_releases;

-- Reconciliation History
CREATE OR REPLACE VIEW reconciliation_history AS SELECT * FROM v2_reconciliation_history;

-- External Sync
CREATE OR REPLACE VIEW external_sync AS SELECT * FROM v2_external_sync;

-- ====================================================================
-- HELPER COMMENT
-- ====================================================================
COMMENT ON VIEW jobs IS 'Compatibility view - will become actual table in future migration';
COMMENT ON VIEW vendors IS 'Compatibility view - will become actual table in future migration';
COMMENT ON VIEW invoices IS 'Compatibility view - will become actual table in future migration';
COMMENT ON VIEW purchase_orders IS 'Compatibility view - will become actual table in future migration';
COMMENT ON VIEW draws IS 'Compatibility view - will become actual table in future migration';
