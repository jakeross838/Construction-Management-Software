-- Migration 169: Lead Notifications & Automation
-- Adds notification preferences, templates, and scheduled reminders

-- Lead notification preferences per user
CREATE TABLE IF NOT EXISTS v2_lead_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,

  -- Stage transition notifications
  notify_new_lead BOOLEAN DEFAULT true,
  notify_stage_change BOOLEAN DEFAULT true,
  notify_lead_won BOOLEAN DEFAULT true,
  notify_lead_lost BOOLEAN DEFAULT true,

  -- Follow-up reminders
  notify_follow_up_due BOOLEAN DEFAULT true,
  follow_up_reminder_hours INTEGER DEFAULT 24, -- hours before due

  -- Lead aging alerts
  notify_stale_leads BOOLEAN DEFAULT true,
  stale_lead_days INTEGER DEFAULT 7, -- days without activity

  -- Notification channels
  email_notifications BOOLEAN DEFAULT true,
  in_app_notifications BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead scheduled reminders
CREATE TABLE IF NOT EXISTS v2_lead_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES v2_leads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,

  reminder_type TEXT NOT NULL, -- follow_up, custom, stale_check
  reminder_at TIMESTAMPTZ NOT NULL,
  message TEXT,

  -- Status tracking
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  is_dismissed BOOLEAN DEFAULT false,
  dismissed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lead notifications log
CREATE TABLE IF NOT EXISTS v2_lead_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES v2_leads(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,

  notification_type TEXT NOT NULL, -- new_lead, stage_change, follow_up_due, stale_lead, won, lost
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Reference data
  metadata JSONB DEFAULT '{}',

  -- Read status
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email templates for lead notifications
CREATE TABLE IF NOT EXISTS v2_lead_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT,

  -- Template variables: {{lead_name}}, {{lead_email}}, {{stage}}, {{assigned_to}}, etc.
  template_type TEXT NOT NULL, -- new_lead, stage_change, follow_up, stale_lead
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_lead_reminders_lead ON v2_lead_reminders(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_user ON v2_lead_reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_reminders_due ON v2_lead_reminders(reminder_at) WHERE NOT is_sent AND NOT is_dismissed;
CREATE INDEX IF NOT EXISTS idx_lead_notifications_user ON v2_lead_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_lead_notifications_unread ON v2_lead_notifications(user_id, is_read) WHERE NOT is_read;

-- Insert default email templates
INSERT INTO v2_lead_email_templates (name, subject, body_html, body_text, template_type) VALUES
('New Lead Assigned',
 'New Lead: {{lead_name}}',
 '<h2>New Lead Assigned</h2><p>A new lead has been assigned to you:</p><ul><li><strong>Name:</strong> {{lead_name}}</li><li><strong>Email:</strong> {{lead_email}}</li><li><strong>Phone:</strong> {{lead_phone}}</li><li><strong>Project:</strong> {{project_type}}</li><li><strong>Estimated Value:</strong> {{estimated_value}}</li></ul><p><a href="{{lead_url}}">View Lead Details</a></p>',
 'New Lead Assigned\n\nA new lead has been assigned to you:\n- Name: {{lead_name}}\n- Email: {{lead_email}}\n- Phone: {{lead_phone}}\n- Project: {{project_type}}\n- Estimated Value: {{estimated_value}}',
 'new_lead'),

('Stage Changed',
 'Lead {{lead_name}} moved to {{new_stage}}',
 '<h2>Lead Stage Updated</h2><p>The lead <strong>{{lead_name}}</strong> has moved from <strong>{{old_stage}}</strong> to <strong>{{new_stage}}</strong>.</p><p><a href="{{lead_url}}">View Lead Details</a></p>',
 'Lead Stage Updated\n\nThe lead {{lead_name}} has moved from {{old_stage}} to {{new_stage}}.',
 'stage_change'),

('Follow-up Reminder',
 'Follow-up Due: {{lead_name}}',
 '<h2>Follow-up Reminder</h2><p>You have a follow-up due for <strong>{{lead_name}}</strong>.</p><p><strong>Due:</strong> {{follow_up_date}}</p><p>{{reminder_message}}</p><p><a href="{{lead_url}}">View Lead Details</a></p>',
 'Follow-up Reminder\n\nYou have a follow-up due for {{lead_name}}.\nDue: {{follow_up_date}}\n{{reminder_message}}',
 'follow_up'),

('Stale Lead Alert',
 'Stale Lead Alert: {{lead_name}} ({{days_inactive}} days)',
 '<h2>Stale Lead Alert</h2><p>The lead <strong>{{lead_name}}</strong> has had no activity for <strong>{{days_inactive}} days</strong>.</p><p><strong>Current Stage:</strong> {{stage}}</p><p><strong>Last Activity:</strong> {{last_activity}}</p><p><a href="{{lead_url}}">View Lead Details</a></p>',
 'Stale Lead Alert\n\nThe lead {{lead_name}} has had no activity for {{days_inactive}} days.\nCurrent Stage: {{stage}}\nLast Activity: {{last_activity}}',
 'stale_lead')
ON CONFLICT (name) DO NOTHING;
