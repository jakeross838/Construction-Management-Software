-- Migration 160: Slack Integration
-- Webhook-based Slack notifications for construction events

-- ============================================================
-- SLACK INTEGRATIONS
-- Store Slack webhook configurations per builder
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_slack_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,

  -- Slack workspace info
  workspace_name TEXT,                          -- Friendly name for the workspace
  channel_name TEXT,                            -- Target channel (e.g., #project-updates)

  -- Webhook URL (encrypted in application layer before storage)
  webhook_url TEXT NOT NULL,                    -- Slack incoming webhook URL

  -- Notification configuration
  notification_types JSONB NOT NULL DEFAULT '{
    "invoice_received": true,
    "invoice_approved": true,
    "invoice_denied": false,
    "draw_created": true,
    "draw_submitted": true,
    "draw_funded": true,
    "po_created": false,
    "po_approved": true,
    "task_assigned": true,
    "task_completed": false,
    "daily_summary": false
  }'::jsonb,

  -- Status
  enabled BOOLEAN DEFAULT TRUE,

  -- Audit
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SLACK MESSAGE LOG
-- Track sent Slack notifications
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_slack_message_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES v2_slack_integrations(id) ON DELETE CASCADE,

  -- Message info
  event_type TEXT NOT NULL,                     -- invoice_approved, draw_submitted, etc.
  event_id UUID,                                -- Reference to the source entity
  message_text TEXT,                            -- The message that was sent

  -- Delivery status
  status TEXT NOT NULL DEFAULT 'pending',       -- pending, success, failed
  response_status INTEGER,                      -- HTTP status code from Slack
  error_message TEXT,                           -- Error details if failed

  -- Timing
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Builder lookup
CREATE INDEX IF NOT EXISTS idx_slack_integrations_builder ON v2_slack_integrations(builder_id);

-- Only one active integration per builder (optional - allows multiple channels)
-- CREATE UNIQUE INDEX IF NOT EXISTS idx_slack_integrations_builder_unique
--   ON v2_slack_integrations(builder_id) WHERE enabled = TRUE;

-- Message log queries
CREATE INDEX IF NOT EXISTS idx_slack_message_log_integration ON v2_slack_message_log(integration_id);
CREATE INDEX IF NOT EXISTS idx_slack_message_log_event_type ON v2_slack_message_log(event_type);
CREATE INDEX IF NOT EXISTS idx_slack_message_log_status ON v2_slack_message_log(status) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_slack_message_log_created ON v2_slack_message_log(created_at);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Update timestamp on integration changes
CREATE OR REPLACE FUNCTION update_slack_integration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_slack_integration_timestamp ON v2_slack_integrations;
CREATE TRIGGER set_slack_integration_timestamp
  BEFORE UPDATE ON v2_slack_integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_slack_integration_timestamp();

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE v2_slack_integrations IS 'Slack webhook integrations for builder notifications';
COMMENT ON TABLE v2_slack_message_log IS 'Log of Slack messages sent, for debugging and analytics';
COMMENT ON COLUMN v2_slack_integrations.webhook_url IS 'Slack Incoming Webhook URL - encrypt before storing';
COMMENT ON COLUMN v2_slack_integrations.notification_types IS 'JSONB config of which events trigger notifications';
COMMENT ON COLUMN v2_slack_integrations.channel_name IS 'Slack channel name for display (actual channel determined by webhook)';
