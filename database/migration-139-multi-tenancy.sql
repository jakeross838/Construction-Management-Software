-- Migration 139: Multi-tenancy - Add builder_id to all tables
-- This migration adds builder_id column to all v2_ tables for tenant isolation
-- Consolidated into DO blocks to reduce API calls

DO $$
DECLARE
  tables_to_modify TEXT[] := ARRAY[
    -- Core tables
    'v2_jobs', 'v2_vendors', 'v2_cost_codes', 'v2_employees',
    -- Financial
    'v2_invoices', 'v2_invoice_allocations', 'v2_invoice_activity', 'v2_invoice_hashes', 'v2_invoice_payments',
    'v2_purchase_orders', 'v2_po_line_items', 'v2_po_activity', 'v2_po_attachments',
    'v2_draws', 'v2_draw_invoices', 'v2_draw_activity', 'v2_draw_allocations', 'v2_draw_attachments',
    'v2_budget_lines', 'v2_expenses', 'v2_expense_activity', 'v2_expense_categories', 'v2_expense_receipts', 'v2_recurring_expenses',
    -- Change Orders
    'v2_change_orders', 'v2_change_order_line_items', 'v2_change_order_cost_codes', 'v2_change_order_invoices', 'v2_change_order_revisions',
    'v2_job_change_orders', 'v2_job_co_activity', 'v2_job_co_draw_billings',
    -- Estimates & Proposals
    'v2_estimates', 'v2_estimate_lines', 'v2_estimate_line_items', 'v2_estimate_groups', 'v2_estimate_subgroups',
    'v2_estimate_phases', 'v2_estimate_sections', 'v2_estimate_assemblies', 'v2_estimate_assembly_items',
    'v2_estimate_activity', 'v2_estimate_versions', 'v2_estimate_templates', 'v2_estimate_conversions', 'v2_job_estimates',
    'v2_proposals', 'v2_ai_estimates', 'v2_ai_estimate_lines', 'v2_assembly_templates', 'v2_assembly_template_items',
    -- Bids
    'v2_bids', 'v2_bid_lines', 'v2_bid_activity', 'v2_bid_documents', 'v2_bid_evaluation_scores',
    'v2_bid_scoring_criteria', 'v2_bid_scoring_templates', 'v2_bid_package_templates', 'v2_bid_template_checklist',
    'v2_subcontractor_bid_documents', 'v2_subcontractor_bids', 'v2_labor_bids', 'v2_labor_bid_items', 'v2_labor_bid_specs',
    -- Leads & CRM
    'v2_leads', 'v2_lead_activities', 'v2_lead_documents', 'v2_lead_sources', 'v2_lead_stage_history', 'v2_lead_tasks',
    'v2_contacts', 'v2_contact_jobs', 'v2_companies', 'v2_communications',
    -- Contracts
    'v2_contracts', 'v2_contract_activity', 'v2_contract_analysis', 'v2_contract_signers',
    -- Schedules
    'v2_schedules', 'v2_schedule_tasks', 'v2_schedule_dependencies', 'v2_schedule_milestones', 'v2_schedule_activity',
    'v2_schedule_templates', 'v2_schedule_template_tasks', 'v2_schedule_template_dependencies', 'v2_schedule_duration_feedback',
    'v2_schedule_baselines', 'v2_schedule_baseline_tasks',
    -- Daily Logs
    'v2_daily_logs', 'v2_daily_log_crew', 'v2_daily_log_activity', 'v2_daily_log_attachments', 'v2_daily_log_deliveries',
    -- Documents
    'v2_documents', 'v2_document_versions', 'v2_document_activity', 'v2_document_types', 'v2_document_requirements',
    'v2_document_extractions', 'v2_document_queue', 'v2_document_routing_log', 'v2_document_search_log',
    'v2_photos', 'v2_photo_activity', 'v2_photo_links',
    -- Inspections
    'v2_inspections', 'v2_inspection_activity', 'v2_inspection_attachments', 'v2_inspection_deficiencies', 'v2_final_inspections',
    -- Punch Lists
    'v2_punch_lists', 'v2_punch_list_items', 'v2_punch_list_activity', 'v2_punch_list_attachments', 'v2_punch_list_photos',
    -- Selections
    'v2_selections', 'v2_selection_categories', 'v2_selection_catalog', 'v2_selection_status_history', 'v2_selection_bundles', 'v2_selection_bundle_items',
    -- RFIs & Submittals
    'v2_rfis', 'v2_rfi_attachments', 'v2_rfi_responses', 'v2_submittals', 'v2_submittal_items', 'v2_submittal_attachments', 'v2_submittal_log',
    -- Tasks & Messaging
    'v2_tasks', 'v2_task_attachments', 'v2_task_checklists', 'v2_task_comments',
    'v2_conversations', 'v2_messages', 'v2_message_attachments', 'v2_message_reactions',
    'v2_notifications', 'v2_notification_preferences',
    -- Permits
    'v2_permits', 'v2_permit_activity', 'v2_permit_documents', 'v2_permit_inspections',
    -- Warranties & Closeout
    'v2_warranties', 'v2_warranty_attachments', 'v2_warranty_claims',
    'v2_lien_releases', 'v2_lien_release_activity', 'v2_lien_waivers',
    'v2_closeout_packages', 'v2_closeout_checklist_items', 'v2_closeout_documents',
    -- Timesheets & Labor
    'v2_timesheets', 'v2_timesheet_activity', 'v2_timesheet_batches',
    'v2_labor_categories', 'v2_labor_history', 'v2_labor_specifications',
    'v2_burden_classes', 'v2_burden_rate_history', 'v2_burden_review_reminders',
    'v2_crew_members', 'v2_crew_schedules', 'v2_crew_availability',
    -- Financial Reporting
    'v2_financial_periods', 'v2_financial_period_activity', 'v2_financial_snapshots',
    'v2_cash_flow_forecasts', 'v2_cash_flow_entries', 'v2_pnl_snapshots', 'v2_wip_snapshots',
    'v2_overhead_rates', 'v2_job_overhead_allocations', 'v2_job_profitability_snapshots', 'v2_job_cost_details',
    'v2_business_plans', 'v2_plan_milestones', 'v2_plan_actuals',
    'v2_reconciliation_log', 'v2_external_sync', 'v2_payment_schedules',
    -- Vendors Extended
    'v2_vendor_aliases', 'v2_vendor_documents', 'v2_vendor_duplicates', 'v2_vendor_incidents',
    'v2_vendor_item_aliases', 'v2_vendor_quotes', 'v2_vendor_reviews', 'v2_vendor_scorecards',
    'v2_vendor_benchmarks', 'v2_verbal_purchase_orders',
    -- AI & Intelligence
    'v2_ai_learning', 'v2_ai_feedback', 'v2_ai_predictions', 'v2_learning_rules', 'v2_correction_patterns',
    'v2_user_feedback', 'v2_accuracy_metrics', 'v2_intelligence_insights',
    -- Pricing & Catalog
    'v2_price_history', 'v2_price_confidence', 'v2_historical_pricing', 'v2_delivery_price_feedback',
    'v2_catalog_brands', 'v2_catalog_trades', 'v2_catalog_images', 'v2_catalog_dependencies',
    'v2_catalog_favorites', 'v2_catalog_recent', 'v2_catalog_knowledge', 'v2_catalog_labor_feedback',
    -- Misc
    'v2_job_activity', 'v2_job_document_checklist', 'v2_job_milestones', 'v2_job_specifications', 'v2_job_specs_activity',
    'v2_project_details', 'v2_allowances', 'v2_approval_thresholds', 'v2_entity_locks', 'v2_undo_queue',
    'v2_naming_conventions', 'v2_file_references', 'v2_extraction_templates', 'v2_master_items',
    'v2_cost_code_mappings', 'v2_description_cost_mappings', 'v2_trade_cost_mappings',
    'v2_scope_categories', 'v2_scope_templates', 'v2_scope_performance', 'v2_scopes_of_work',
    'v2_category_benchmarks', 'v2_kpi_definitions', 'v2_kpi_targets', 'v2_revenue_categories',
    'v2_cost_pools', 'v2_cost_pool_categories', 'v2_savings_log', 'v2_optimized_orders', 'v2_order_line_items',
    'v2_waste_factors', 'v2_sub_performance', 'v2_trade_metrics', 'v2_work_requests', 'v2_system_health_metrics',
    'v2_company_settings', 'v2_company_branding'
  ];
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY tables_to_modify
  LOOP
    -- Check if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      -- Check if column already exists
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'builder_id') THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN builder_id UUID REFERENCES v2_builders(id)', tbl);
        RAISE NOTICE 'Added builder_id to %', tbl;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Create indexes for core tables with high query volume
DO $$
DECLARE
  indexed_tables TEXT[] := ARRAY[
    'v2_jobs', 'v2_vendors', 'v2_cost_codes', 'v2_employees',
    'v2_invoices', 'v2_invoice_allocations', 'v2_purchase_orders', 'v2_draws', 'v2_budget_lines',
    'v2_expenses', 'v2_change_orders', 'v2_estimates', 'v2_proposals', 'v2_bids',
    'v2_leads', 'v2_contacts', 'v2_contracts', 'v2_schedules', 'v2_daily_logs',
    'v2_documents', 'v2_photos', 'v2_inspections', 'v2_punch_lists', 'v2_selections',
    'v2_rfis', 'v2_submittals', 'v2_tasks', 'v2_permits', 'v2_warranties', 'v2_lien_releases', 'v2_timesheets'
  ];
  tbl TEXT;
  idx_name TEXT;
BEGIN
  FOREACH tbl IN ARRAY indexed_tables
  LOOP
    idx_name := 'idx_' || replace(tbl, 'v2_', '') || '_builder_id';
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = tbl) THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'builder_id') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = idx_name) THEN
          -- Check if table has deleted_at column for partial index
          IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = tbl AND column_name = 'deleted_at') THEN
            EXECUTE format('CREATE INDEX %I ON %I(builder_id) WHERE deleted_at IS NULL', idx_name, tbl);
          ELSE
            EXECUTE format('CREATE INDEX %I ON %I(builder_id)', idx_name, tbl);
          END IF;
          RAISE NOTICE 'Created index % on %', idx_name, tbl;
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;
