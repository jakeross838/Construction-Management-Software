-- Migration 061: Notifications
-- System notifications for various events

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Recipient
  user_name TEXT NOT NULL,

  -- Notification content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- info, success, warning, error, task, rfi, submittal, invoice, po

  -- Source entity
  entity_type TEXT, -- job, invoice, rfi, submittal, task, po, draw, message
  entity_id UUID,
  entity_link TEXT, -- URL to navigate to

  -- Status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  -- Priority
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_name TEXT NOT NULL,

  -- Email preferences
  email_enabled BOOLEAN DEFAULT true,
  email_frequency TEXT DEFAULT 'instant', -- instant, hourly, daily, weekly

  -- In-app preferences
  in_app_enabled BOOLEAN DEFAULT true,

  -- Notification type preferences (JSON object)
  type_preferences JSONB DEFAULT '{
    "task_assigned": true,
    "task_due": true,
    "rfi_received": true,
    "rfi_response": true,
    "submittal_review": true,
    "invoice_approved": true,
    "po_approved": true,
    "mention": true,
    "message": true
  }'::jsonb,

  -- Quiet hours
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_name)
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_notifications_user_name ON v2_notifications(user_name);
CREATE INDEX IF NOT EXISTS idx_v2_notifications_is_read ON v2_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_v2_notifications_type ON v2_notifications(type);
CREATE INDEX IF NOT EXISTS idx_v2_notifications_entity ON v2_notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_v2_notifications_created_at ON v2_notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_v2_notification_preferences_user ON v2_notification_preferences(user_name);

-- ============================================================
-- TRIGGER FOR updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_notification_preferences_updated_at ON v2_notification_preferences;
CREATE TRIGGER trigger_notification_preferences_updated_at
  BEFORE UPDATE ON v2_notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_preferences_updated_at();
