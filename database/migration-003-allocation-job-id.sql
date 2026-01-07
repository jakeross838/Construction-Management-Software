-- Migration 003: Add job_id to invoice allocations
-- This allows splitting invoices across multiple jobs at the line item level

ALTER TABLE v2_invoice_allocations
ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES v2_jobs(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_v2_invoice_allocations_job_id ON v2_invoice_allocations(job_id);
