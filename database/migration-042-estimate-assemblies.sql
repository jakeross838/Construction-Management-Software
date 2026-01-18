-- Migration 042: Estimate Assemblies (Line Item Grouping)
-- Allows grouping line items into collapsible assemblies/packages

-- Add assembly-related columns to estimate_lines
ALTER TABLE v2_estimate_lines
  ADD COLUMN IF NOT EXISTS parent_line_id UUID REFERENCES v2_estimate_lines(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_assembly BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS hide_components_from_client BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS collapsed BOOLEAN DEFAULT FALSE;

-- Create index for efficient parent lookups
CREATE INDEX IF NOT EXISTS idx_estimate_lines_parent ON v2_estimate_lines(parent_line_id);

-- Add comment explaining the assembly structure
COMMENT ON COLUMN v2_estimate_lines.parent_line_id IS 'If this line is part of an assembly, this points to the assembly header line';
COMMENT ON COLUMN v2_estimate_lines.is_assembly IS 'True if this line is an assembly header (container for child lines)';
COMMENT ON COLUMN v2_estimate_lines.hide_components_from_client IS 'If true, only show assembly total to client, not individual components';
COMMENT ON COLUMN v2_estimate_lines.collapsed IS 'UI state: whether the assembly is collapsed in the interface';
