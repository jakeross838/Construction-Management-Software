-- Migration 156: Report Templates for Custom Report Builder
-- Phase 7 feature: Drag-and-drop field selection, filter conditions, grouping and aggregation

-- ============================================================
-- REPORT TEMPLATES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_report_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,

  -- Template metadata
  name TEXT NOT NULL,
  description TEXT,

  -- Entity type defines which table/data source this report queries
  entity_type TEXT NOT NULL, -- 'jobs', 'invoices', 'vendors', 'purchase_orders', 'draws', 'expenses', 'daily_logs', 'budget_lines'

  -- Column configuration (which fields to include, order, labels)
  -- Format: [{ field: "name", label: "Job Name", visible: true, width: 200 }, ...]
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Filter conditions
  -- Format: [{ field: "status", operator: "eq", value: "active" }, { field: "amount", operator: "gte", value: 1000 }, ...]
  -- Operators: eq, neq, gt, gte, lt, lte, like, ilike, in, is_null, is_not_null, between
  filters JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Grouping configuration
  -- Format: { groupBy: ["job_id", "status"], aggregations: [{ field: "amount", function: "sum", alias: "total_amount" }] }
  grouping JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Sort configuration
  -- Format: [{ field: "created_at", direction: "desc" }, { field: "name", direction: "asc" }]
  sort JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Additional display options
  options JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Access control
  is_public BOOLEAN DEFAULT FALSE, -- If true, shared with all users in the organization
  created_by TEXT,

  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- ============================================================
-- REPORT EXECUTION HISTORY (for caching and audit)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_report_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES v2_report_templates(id) ON DELETE CASCADE,
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,

  -- Execution details
  executed_by TEXT,
  executed_at TIMESTAMPTZ DEFAULT NOW(),

  -- Runtime filters (may differ from template defaults)
  runtime_filters JSONB,

  -- Result stats (for performance tracking)
  row_count INTEGER,
  execution_time_ms INTEGER,

  -- Cached result (optional, for expensive queries)
  result_cache JSONB,
  cache_expires_at TIMESTAMPTZ
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_report_templates_builder ON v2_report_templates(builder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_report_templates_entity ON v2_report_templates(entity_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_report_templates_public ON v2_report_templates(is_public) WHERE deleted_at IS NULL AND is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_report_templates_created_by ON v2_report_templates(created_by) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_report_executions_template ON v2_report_executions(template_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_builder ON v2_report_executions(builder_id);
CREATE INDEX IF NOT EXISTS idx_report_executions_date ON v2_report_executions(executed_at);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_report_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_report_template_timestamp ON v2_report_templates;
CREATE TRIGGER set_report_template_timestamp
  BEFORE UPDATE ON v2_report_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_report_template_timestamp();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_report_templates IS 'Custom report builder templates with field selection, filters, grouping, and sorting';
COMMENT ON COLUMN v2_report_templates.entity_type IS 'Base entity/table for the report: jobs, invoices, vendors, purchase_orders, draws, expenses, daily_logs, budget_lines';
COMMENT ON COLUMN v2_report_templates.columns IS 'Array of column configurations with field name, label, visibility, and width';
COMMENT ON COLUMN v2_report_templates.filters IS 'Array of filter conditions with field, operator, and value';
COMMENT ON COLUMN v2_report_templates.grouping IS 'Object with groupBy fields and aggregation functions';
COMMENT ON COLUMN v2_report_templates.sort IS 'Array of sort configurations with field and direction';
COMMENT ON TABLE v2_report_executions IS 'Audit log of report executions with performance metrics and optional result caching';
