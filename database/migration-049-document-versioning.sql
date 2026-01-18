-- Migration 049: Document Versioning
-- Adds version tracking, history, and rollback capabilities to v2_documents

-- Add version tracking columns to v2_documents
ALTER TABLE v2_documents
ADD COLUMN IF NOT EXISTS version_number INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS parent_document_id UUID REFERENCES v2_documents(id),
ADD COLUMN IF NOT EXISTS is_current BOOLEAN DEFAULT true;

-- Initialize existing documents as version 1, is_current=true
UPDATE v2_documents
SET version_number = 1, is_current = true
WHERE version_number IS NULL;

-- Index for efficient version queries
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON v2_documents(parent_document_id);
CREATE INDEX IF NOT EXISTS idx_documents_is_current ON v2_documents(is_current) WHERE is_current = true;

-- Add new activity types for versioning
COMMENT ON TABLE v2_document_activity IS 'Document activity log. Actions: uploaded, viewed, downloaded, updated, deleted, new_version, rollback';
