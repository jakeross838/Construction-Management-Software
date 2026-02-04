-- Migration 173: Additional performance indexes for Phase 3.4
-- Adds indexes to tables created after migration-027 for optimal query performance

-- ============================================================
-- CLIENT INVOICES (AR) - v2_client_invoices
-- ============================================================

-- Builder tenant filter (required for all queries)
CREATE INDEX IF NOT EXISTS idx_client_invoices_builder_id
ON v2_client_invoices(builder_id)
WHERE deleted_at IS NULL;

-- Status filter for invoice lists
CREATE INDEX IF NOT EXISTS idx_client_invoices_status
ON v2_client_invoices(status)
WHERE deleted_at IS NULL;

-- Job filter for job-specific invoice views
CREATE INDEX IF NOT EXISTS idx_client_invoices_job_id
ON v2_client_invoices(job_id)
WHERE deleted_at IS NULL;

-- Client filter for client-specific invoice views
CREATE INDEX IF NOT EXISTS idx_client_invoices_client_id
ON v2_client_invoices(client_id)
WHERE deleted_at IS NULL;

-- Date range queries for reports
CREATE INDEX IF NOT EXISTS idx_client_invoices_invoice_date
ON v2_client_invoices(invoice_date DESC)
WHERE deleted_at IS NULL;

-- Composite for common dashboard query (builder + status + date)
CREATE INDEX IF NOT EXISTS idx_client_invoices_builder_status_date
ON v2_client_invoices(builder_id, status, invoice_date DESC)
WHERE deleted_at IS NULL;

-- ============================================================
-- LEADS - v2_leads
-- ============================================================

-- Builder tenant filter
CREATE INDEX IF NOT EXISTS idx_leads_builder_id
ON v2_leads(builder_id)
WHERE deleted_at IS NULL;

-- Pipeline stage for Kanban view
CREATE INDEX IF NOT EXISTS idx_leads_pipeline_stage
ON v2_leads(pipeline_stage)
WHERE deleted_at IS NULL;

-- Status filter
CREATE INDEX IF NOT EXISTS idx_leads_status
ON v2_leads(status)
WHERE deleted_at IS NULL;

-- Composite for lead dashboard (builder + stage)
CREATE INDEX IF NOT EXISTS idx_leads_builder_stage
ON v2_leads(builder_id, pipeline_stage)
WHERE deleted_at IS NULL;

-- ============================================================
-- DOCUMENTS - v2_documents
-- ============================================================

-- Job filter for document lists
CREATE INDEX IF NOT EXISTS idx_documents_job_id
ON v2_documents(job_id)
WHERE deleted_at IS NULL;

-- Category filter
CREATE INDEX IF NOT EXISTS idx_documents_category
ON v2_documents(category)
WHERE deleted_at IS NULL;

-- Folder navigation
CREATE INDEX IF NOT EXISTS idx_documents_folder_id
ON v2_documents(folder_id)
WHERE deleted_at IS NULL;

-- ============================================================
-- SCHEDULES - v2_schedules
-- ============================================================

-- Job filter
CREATE INDEX IF NOT EXISTS idx_schedules_job_id
ON v2_schedules(job_id)
WHERE deleted_at IS NULL;

-- Date range queries
CREATE INDEX IF NOT EXISTS idx_schedules_start_date
ON v2_schedules(start_date)
WHERE deleted_at IS NULL;

-- ============================================================
-- TASKS - v2_tasks
-- ============================================================

-- Job filter
CREATE INDEX IF NOT EXISTS idx_tasks_job_id
ON v2_tasks(job_id)
WHERE deleted_at IS NULL;

-- Status filter for task lists
CREATE INDEX IF NOT EXISTS idx_tasks_status
ON v2_tasks(status)
WHERE deleted_at IS NULL;

-- Assignee filter
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to
ON v2_tasks(assigned_to)
WHERE deleted_at IS NULL;

-- Priority filter
CREATE INDEX IF NOT EXISTS idx_tasks_priority
ON v2_tasks(priority)
WHERE deleted_at IS NULL;

-- Due date for overdue queries
CREATE INDEX IF NOT EXISTS idx_tasks_due_date
ON v2_tasks(due_date)
WHERE deleted_at IS NULL AND status != 'completed';

-- ============================================================
-- DAILY LOGS - v2_daily_logs
-- ============================================================

-- Job filter
CREATE INDEX IF NOT EXISTS idx_daily_logs_job_id
ON v2_daily_logs(job_id)
WHERE deleted_at IS NULL;

-- Date filter for log lookup
CREATE INDEX IF NOT EXISTS idx_daily_logs_date
ON v2_daily_logs(log_date DESC)
WHERE deleted_at IS NULL;

-- ============================================================
-- CONTRACTS - v2_contracts
-- ============================================================

-- Job filter
CREATE INDEX IF NOT EXISTS idx_contracts_job_id
ON v2_contracts(job_id)
WHERE deleted_at IS NULL;

-- Status filter
CREATE INDEX IF NOT EXISTS idx_contracts_status
ON v2_contracts(status)
WHERE deleted_at IS NULL;

-- ============================================================
-- NOTIFICATIONS - v2_notifications
-- ============================================================

-- User filter for notification inbox
CREATE INDEX IF NOT EXISTS idx_notifications_user_id
ON v2_notifications(user_id);

-- Unread filter
CREATE INDEX IF NOT EXISTS idx_notifications_read_status
ON v2_notifications(user_id, read)
WHERE read = false;

-- Date ordering for recent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_created_at
ON v2_notifications(created_at DESC);

-- ============================================================
-- QUICKBOOKS SYNC - v2_quickbooks_sync_log
-- ============================================================

-- Builder filter for sync history
CREATE INDEX IF NOT EXISTS idx_qbo_sync_log_builder_id
ON v2_quickbooks_sync_log(builder_id);

-- Status filter for pending syncs
CREATE INDEX IF NOT EXISTS idx_qbo_sync_log_status
ON v2_quickbooks_sync_log(status);

-- Date ordering for recent activity
CREATE INDEX IF NOT EXISTS idx_qbo_sync_log_created_at
ON v2_quickbooks_sync_log(created_at DESC);

-- ============================================================
-- JOBS - Additional indexes for v2_jobs
-- ============================================================

-- Status filter for job lists
CREATE INDEX IF NOT EXISTS idx_jobs_status
ON v2_jobs(status)
WHERE deleted_at IS NULL;

-- Builder filter
CREATE INDEX IF NOT EXISTS idx_jobs_builder_id
ON v2_jobs(builder_id)
WHERE deleted_at IS NULL;

-- Composite for dashboard (builder + status)
CREATE INDEX IF NOT EXISTS idx_jobs_builder_status
ON v2_jobs(builder_id, status)
WHERE deleted_at IS NULL;

-- ============================================================
-- VENDORS - Additional indexes for v2_vendors
-- ============================================================

-- Builder filter
CREATE INDEX IF NOT EXISTS idx_vendors_builder_id
ON v2_vendors(builder_id)
WHERE deleted_at IS NULL;

-- Trade filter
CREATE INDEX IF NOT EXISTS idx_vendors_trade
ON v2_vendors(trade)
WHERE deleted_at IS NULL;

-- Active status filter
CREATE INDEX IF NOT EXISTS idx_vendors_status
ON v2_vendors(status)
WHERE deleted_at IS NULL;

-- Composite for vendor lists (builder + status)
CREATE INDEX IF NOT EXISTS idx_vendors_builder_status
ON v2_vendors(builder_id, status)
WHERE deleted_at IS NULL;
