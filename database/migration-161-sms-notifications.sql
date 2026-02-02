-- Migration 161: SMS Notifications Infrastructure
-- Adds Twilio SMS support for notification system

-- ============================================================
-- EXTEND NOTIFICATION PREFERENCES WITH SMS SUPPORT
-- ============================================================
ALTER TABLE v2_notification_preferences
ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN DEFAULT false;

ALTER TABLE v2_notification_preferences
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT false;

ALTER TABLE v2_notification_preferences
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Extended type preferences for SMS
-- Update default type_preferences to include sms fields
COMMENT ON COLUMN v2_notification_preferences.type_preferences IS
'JSON preferences per notification type. Each type can have: in_app, email, sms, push booleans.
Example: {"invoice_approved": {"in_app": true, "email": true, "sms": false, "push": false}}';

-- ============================================================
-- NOTIFICATION LOG TABLE
-- Tracks all sent notifications for auditing and debugging
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Builder context (multi-tenant support)
  builder_id UUID,

  -- Recipient info
  user_id UUID,
  user_name TEXT,

  -- Notification details
  notification_type TEXT NOT NULL, -- invoice_approved, draw_funded, task_assigned, inspection_scheduled, etc.
  channel TEXT NOT NULL, -- email, sms, push, in_app
  recipient TEXT NOT NULL, -- phone number, email address, or user_name for in_app

  -- Message content
  subject TEXT, -- For emails
  message TEXT NOT NULL,

  -- Delivery status
  status TEXT DEFAULT 'pending', -- pending, sent, delivered, failed
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  -- External service reference
  external_id TEXT, -- Twilio SID, SendGrid ID, etc.

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Additional context like entity_id, entity_type, etc.

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SMS TEMPLATES
-- Pre-defined templates for common notification types
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID,

  notification_type TEXT NOT NULL UNIQUE,
  template_text TEXT NOT NULL, -- Use {{variable}} for placeholders
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default SMS templates
INSERT INTO v2_sms_templates (notification_type, template_text) VALUES
  ('invoice_approved', 'Ross Built: Invoice #{{invoice_number}} for ${{amount}} has been approved for {{job_name}}.'),
  ('invoice_denied', 'Ross Built: Invoice #{{invoice_number}} was denied. Reason: {{reason}}'),
  ('draw_funded', 'Ross Built: Draw #{{draw_number}} for {{job_name}} has been funded. Amount: ${{amount}}'),
  ('draw_submitted', 'Ross Built: Draw #{{draw_number}} for {{job_name}} has been submitted for ${{amount}}.'),
  ('task_assigned', 'Ross Built: New task assigned to you: {{task_title}} for {{job_name}}. Due: {{due_date}}'),
  ('task_due_soon', 'Ross Built: Reminder - Task "{{task_title}}" is due {{due_date}}.'),
  ('inspection_scheduled', 'Ross Built: Inspection scheduled for {{job_name}} on {{date}} at {{time}}. Type: {{inspection_type}}'),
  ('inspection_passed', 'Ross Built: Inspection passed for {{job_name}}. Type: {{inspection_type}}'),
  ('inspection_failed', 'Ross Built: Inspection FAILED for {{job_name}}. Type: {{inspection_type}}. Notes: {{notes}}'),
  ('po_approved', 'Ross Built: PO #{{po_number}} for ${{amount}} has been approved.'),
  ('change_order_approved', 'Ross Built: Change Order #{{co_number}} for {{job_name}} approved. Amount: ${{amount}}'),
  ('rfi_received', 'Ross Built: New RFI received for {{job_name}}: {{subject}}'),
  ('rfi_response', 'Ross Built: Your RFI "{{subject}}" has been answered.'),
  ('submittal_approved', 'Ross Built: Submittal "{{title}}" for {{job_name}} has been approved.'),
  ('submittal_rejected', 'Ross Built: Submittal "{{title}}" for {{job_name}} was rejected. Review required.'),
  ('daily_log_reminder', 'Ross Built: Reminder to complete your daily log for {{job_name}}.'),
  ('weather_alert', 'Ross Built: Weather alert for {{job_name}}: {{alert_message}}'),
  ('permit_expiring', 'Ross Built: Permit expiring soon for {{job_name}}: {{permit_type}} expires {{expiry_date}}.')
ON CONFLICT (notification_type) DO NOTHING;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_notification_log_user ON v2_notification_log(user_id);
CREATE INDEX IF NOT EXISTS idx_v2_notification_log_user_name ON v2_notification_log(user_name);
CREATE INDEX IF NOT EXISTS idx_v2_notification_log_channel ON v2_notification_log(channel);
CREATE INDEX IF NOT EXISTS idx_v2_notification_log_status ON v2_notification_log(status);
CREATE INDEX IF NOT EXISTS idx_v2_notification_log_type ON v2_notification_log(notification_type);
CREATE INDEX IF NOT EXISTS idx_v2_notification_log_created_at ON v2_notification_log(created_at);
CREATE INDEX IF NOT EXISTS idx_v2_notification_log_builder ON v2_notification_log(builder_id);

CREATE INDEX IF NOT EXISTS idx_v2_sms_templates_type ON v2_sms_templates(notification_type);

-- ============================================================
-- TRIGGER FOR updated_at on templates
-- ============================================================
CREATE OR REPLACE FUNCTION update_sms_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sms_templates_updated_at ON v2_sms_templates;
CREATE TRIGGER trigger_sms_templates_updated_at
  BEFORE UPDATE ON v2_sms_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_sms_templates_updated_at();
