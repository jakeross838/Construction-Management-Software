-- Migration 177: Add description column to v2_invoices
-- The invoice create route (server/routes/invoices.js:2662) references this column but it doesn't exist

ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS description TEXT;

-- Add index for searching
CREATE INDEX IF NOT EXISTS idx_v2_invoices_description ON v2_invoices USING gin(to_tsvector('english', COALESCE(description, '')));
