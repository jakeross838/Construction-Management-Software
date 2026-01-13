-- Migration 017: Add attachment categories to PO attachments
-- Categorizes attachments into: quote, scope, plans, contract, other

ALTER TABLE v2_po_attachments
ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'other';

COMMENT ON COLUMN v2_po_attachments.category IS 'Attachment category: quote, scope, plans, contract, other';

-- Add an index for filtering by category
CREATE INDEX IF NOT EXISTS idx_po_attachments_category ON v2_po_attachments(category);
