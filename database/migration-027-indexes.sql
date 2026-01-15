-- Migration 027: Add indexes for common query patterns
-- Improves performance for invoice list, filtering, and reports

-- v2_invoices indexes
-- Status filter is the most common query pattern
CREATE INDEX IF NOT EXISTS idx_invoices_status ON v2_invoices(status) WHERE deleted_at IS NULL;

-- Job filter for invoice lists
CREATE INDEX IF NOT EXISTS idx_invoices_job_id ON v2_invoices(job_id) WHERE deleted_at IS NULL;

-- Vendor filter for invoice lists
CREATE INDEX IF NOT EXISTS idx_invoices_vendor_id ON v2_invoices(vendor_id) WHERE deleted_at IS NULL;

-- PO lookup for billing tracking
CREATE INDEX IF NOT EXISTS idx_invoices_po_id ON v2_invoices(po_id) WHERE deleted_at IS NULL;

-- Split invoice parent lookup
CREATE INDEX IF NOT EXISTS idx_invoices_parent_id ON v2_invoices(parent_invoice_id) WHERE deleted_at IS NULL;

-- Composite index for common invoice list query (status + job)
CREATE INDEX IF NOT EXISTS idx_invoices_status_job ON v2_invoices(status, job_id) WHERE deleted_at IS NULL;

-- v2_invoice_allocations indexes
-- Invoice lookup (most common)
CREATE INDEX IF NOT EXISTS idx_allocations_invoice_id ON v2_invoice_allocations(invoice_id);

-- Cost code lookup for G703 reports
CREATE INDEX IF NOT EXISTS idx_allocations_cost_code_id ON v2_invoice_allocations(cost_code_id);

-- PO line item lookup for billing tracking
CREATE INDEX IF NOT EXISTS idx_allocations_po_line_item ON v2_invoice_allocations(po_line_item_id) WHERE po_line_item_id IS NOT NULL;

-- Change order lookup
CREATE INDEX IF NOT EXISTS idx_allocations_change_order ON v2_invoice_allocations(change_order_id) WHERE change_order_id IS NOT NULL;

-- v2_draws indexes
-- Job lookup for draw lists
CREATE INDEX IF NOT EXISTS idx_draws_job_id ON v2_draws(job_id);

-- Status filter
CREATE INDEX IF NOT EXISTS idx_draws_status ON v2_draws(status);

-- Composite for finding draft draws by job
CREATE INDEX IF NOT EXISTS idx_draws_job_status ON v2_draws(job_id, status);

-- v2_draw_invoices indexes
-- Draw lookup
CREATE INDEX IF NOT EXISTS idx_draw_invoices_draw_id ON v2_draw_invoices(draw_id);

-- Invoice lookup (which draw is this invoice in?)
CREATE INDEX IF NOT EXISTS idx_draw_invoices_invoice_id ON v2_draw_invoices(invoice_id);

-- v2_po_line_items indexes
-- PO lookup
CREATE INDEX IF NOT EXISTS idx_po_line_items_po_id ON v2_po_line_items(po_id);

-- Cost code lookup for matching allocations
CREATE INDEX IF NOT EXISTS idx_po_line_items_cost_code ON v2_po_line_items(cost_code_id);

-- v2_purchase_orders indexes
-- Job filter
CREATE INDEX IF NOT EXISTS idx_purchase_orders_job_id ON v2_purchase_orders(job_id) WHERE deleted_at IS NULL;

-- Vendor filter
CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id ON v2_purchase_orders(vendor_id) WHERE deleted_at IS NULL;

-- Status filter
CREATE INDEX IF NOT EXISTS idx_purchase_orders_status ON v2_purchase_orders(status) WHERE deleted_at IS NULL;

-- v2_budget_lines indexes
-- Job lookup for budget reports
CREATE INDEX IF NOT EXISTS idx_budget_lines_job_id ON v2_budget_lines(job_id);

-- v2_invoice_activity indexes
-- Invoice lookup for activity logs
CREATE INDEX IF NOT EXISTS idx_invoice_activity_invoice_id ON v2_invoice_activity(invoice_id);

-- Date ordering for recent activity
CREATE INDEX IF NOT EXISTS idx_invoice_activity_created_at ON v2_invoice_activity(created_at DESC);

-- v2_job_change_orders indexes
-- Job lookup
CREATE INDEX IF NOT EXISTS idx_change_orders_job_id ON v2_job_change_orders(job_id);
