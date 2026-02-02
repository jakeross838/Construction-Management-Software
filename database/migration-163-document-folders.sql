-- Migration 163: Document Folders
-- Date: 2026-02-01
-- Purpose: Add folder management for organizing documents within jobs

-- ============================================================
-- 1. DOCUMENT FOLDERS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_document_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  parent_folder_id UUID REFERENCES v2_document_folders(id) ON DELETE CASCADE,
  color TEXT,  -- Optional folder color for UI
  icon TEXT,   -- Optional icon name
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,

  -- Unique folder names within same parent (or at root level)
  UNIQUE NULLS NOT DISTINCT (job_id, parent_folder_id, name)
);

-- ============================================================
-- 2. ADD FOLDER REFERENCE TO DOCUMENTS
-- ============================================================
ALTER TABLE v2_documents
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES v2_document_folders(id) ON DELETE SET NULL;

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_document_folders_job ON v2_document_folders(job_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_parent ON v2_document_folders(parent_folder_id);
CREATE INDEX IF NOT EXISTS idx_document_folders_deleted ON v2_document_folders(deleted_at);
CREATE INDEX IF NOT EXISTS idx_documents_folder ON v2_documents(folder_id);

-- ============================================================
-- 4. FUNCTION: Get folder path (breadcrumb)
-- ============================================================
CREATE OR REPLACE FUNCTION get_folder_path(p_folder_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  level INTEGER
) AS $$
WITH RECURSIVE folder_path AS (
  -- Start with the target folder
  SELECT
    f.id,
    f.name,
    f.parent_folder_id,
    0 as level
  FROM v2_document_folders f
  WHERE f.id = p_folder_id AND f.deleted_at IS NULL

  UNION ALL

  -- Recursively get parent folders
  SELECT
    parent.id,
    parent.name,
    parent.parent_folder_id,
    fp.level + 1
  FROM v2_document_folders parent
  JOIN folder_path fp ON parent.id = fp.parent_folder_id
  WHERE parent.deleted_at IS NULL
)
SELECT fp.id, fp.name, fp.level
FROM folder_path fp
ORDER BY fp.level DESC;  -- Root first, then children
$$ LANGUAGE sql;

-- ============================================================
-- 5. FUNCTION: Get folder contents with counts
-- ============================================================
CREATE OR REPLACE FUNCTION get_folder_contents(p_folder_id UUID, p_job_id UUID)
RETURNS TABLE (
  folder_id UUID,
  folder_name TEXT,
  subfolder_count BIGINT,
  document_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    f.id as folder_id,
    f.name as folder_name,
    (SELECT COUNT(*) FROM v2_document_folders sf
     WHERE sf.parent_folder_id = f.id AND sf.deleted_at IS NULL) as subfolder_count,
    (SELECT COUNT(*) FROM v2_documents d
     WHERE d.folder_id = f.id AND d.deleted_at IS NULL) as document_count
  FROM v2_document_folders f
  WHERE f.job_id = p_job_id
    AND f.deleted_at IS NULL
    AND (
      (p_folder_id IS NULL AND f.parent_folder_id IS NULL) OR
      f.parent_folder_id = p_folder_id
    )
  ORDER BY f.sort_order, f.name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 6. COMMENTS
-- ============================================================
COMMENT ON TABLE v2_document_folders IS 'Hierarchical folder structure for organizing documents within jobs';
COMMENT ON COLUMN v2_document_folders.parent_folder_id IS 'Parent folder ID for nested folders. NULL means root level.';
COMMENT ON COLUMN v2_documents.folder_id IS 'Optional folder organization. NULL means document is at root level.';
