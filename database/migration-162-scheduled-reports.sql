-- Migration 162: Scheduled Reports
-- Phase 7 feature: Email delivery on schedule with multiple recipients and format options

-- ============================================================
-- SCHEDULED REPORTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,

  -- Optional link to report template (for custom reports)
  report_template_id UUID,  -- FK to v2_report_templates added separately if table exists

  -- Report configuration
  name TEXT NOT NULL,
  description TEXT,

  -- Report type (built-in reports or template-based)
  -- Built-in: job_cost, vendor_spend, category_spend, budget_variance, invoice_aging,
  --           schedule_performance, revenue_per_worker, labor_cost_analysis
  -- Template: uses report_template_id
  report_type TEXT NOT NULL DEFAULT 'custom', -- built_in, custom
  builtin_report_name TEXT, -- For built-in reports: job_cost, vendor_spend, etc.

  -- Report parameters/filters (job_id, date range, etc.)
  -- Format: { "job_id": "uuid", "start_date": "2024-01-01", "end_date": "2024-12-31" }
  parameters JSONB NOT NULL DEFAULT '{}',

  -- Schedule configuration
  schedule_type TEXT NOT NULL, -- daily, weekly, monthly
  schedule_day INTEGER, -- For weekly: 0-6 (Sun-Sat), For monthly: 1-31
  schedule_time TIME NOT NULL DEFAULT '08:00:00', -- Time of day to send (in builder's timezone)
  timezone TEXT DEFAULT 'America/New_York',

  -- Recipients
  -- Format: ["email1@example.com", "email2@example.com"]
  recipients JSONB NOT NULL DEFAULT '[]',

  -- Output format
  format TEXT NOT NULL DEFAULT 'excel', -- excel, pdf, both

  -- State
  enabled BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  -- Audit
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEDULED REPORT RUN HISTORY
-- Tracks all executions for auditing and debugging
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_scheduled_report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id UUID REFERENCES v2_scheduled_reports(id) ON DELETE CASCADE,
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,

  -- Run details
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, completed, failed

  -- Results
  recipients_sent JSONB DEFAULT '[]', -- Array of emails that were sent to
  files_generated JSONB DEFAULT '[]', -- Array of file URLs/paths generated

  -- Error handling
  error_message TEXT,
  error_details JSONB,

  -- Performance metrics
  generation_time_ms INTEGER,
  file_size_bytes INTEGER
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_builder ON v2_scheduled_reports(builder_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_enabled ON v2_scheduled_reports(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON v2_scheduled_reports(next_run_at) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_template ON v2_scheduled_reports(report_template_id) WHERE report_template_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_type ON v2_scheduled_reports(report_type);

CREATE INDEX IF NOT EXISTS idx_scheduled_report_runs_report ON v2_scheduled_report_runs(scheduled_report_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_report_runs_builder ON v2_scheduled_report_runs(builder_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_report_runs_status ON v2_scheduled_report_runs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_report_runs_started ON v2_scheduled_report_runs(started_at);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION update_scheduled_report_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_scheduled_report_timestamp ON v2_scheduled_reports;
CREATE TRIGGER set_scheduled_report_timestamp
  BEFORE UPDATE ON v2_scheduled_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_scheduled_report_timestamp();

-- Note: Complex next_run_at calculation moved to application layer
-- to avoid issues with migration system injecting metadata into SQL

-- Note: Trigger for auto-calculating next_run_at removed
-- Application layer handles this calculation to avoid SQL parsing issues

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_scheduled_reports IS 'Scheduled report configurations for automatic email delivery';
COMMENT ON COLUMN v2_scheduled_reports.schedule_type IS 'Frequency: daily, weekly, monthly';
COMMENT ON COLUMN v2_scheduled_reports.schedule_day IS 'For weekly: 0-6 (Sun-Sat). For monthly: 1-31 (day of month)';
COMMENT ON COLUMN v2_scheduled_reports.schedule_time IS 'Time of day to run the report (in builder timezone)';
COMMENT ON COLUMN v2_scheduled_reports.recipients IS 'JSON array of email addresses to send the report to';
COMMENT ON COLUMN v2_scheduled_reports.format IS 'Output format: excel, pdf, or both';
COMMENT ON COLUMN v2_scheduled_reports.parameters IS 'Report-specific parameters like job_id, date ranges, etc.';

COMMENT ON TABLE v2_scheduled_report_runs IS 'Execution history for scheduled reports';
COMMENT ON COLUMN v2_scheduled_report_runs.status IS 'Run status: pending, running, completed, failed';
