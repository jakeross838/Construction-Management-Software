-- Migration 156: Email Integration
-- Adds email templates and sent email tracking for in-app email communication

-- ============================================================
-- 1. Create email templates table
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN ('invoice_notification', 'draw_submitted', 'task_assigned', 'po_approved', 'bid_request', 'custom')),
  variables JSONB DEFAULT '[]'::jsonb,  -- Available merge fields for this template
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_email_templates_builder_id ON v2_email_templates(builder_id);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON v2_email_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_email_templates_default ON v2_email_templates(is_default) WHERE is_default = true;

-- ============================================================
-- 2. Create sent emails table
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_sent_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  template_id UUID REFERENCES v2_email_templates(id) ON DELETE SET NULL,
  to_addresses JSONB NOT NULL DEFAULT '[]'::jsonb,  -- Array of email addresses
  cc_addresses JSONB DEFAULT '[]'::jsonb,
  bcc_addresses JSONB DEFAULT '[]'::jsonb,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  body_html TEXT,  -- Optional HTML version
  attachments JSONB DEFAULT '[]'::jsonb,  -- Array of {name, url, size, type}
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced', 'delivered', 'opened')),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  error_message TEXT,
  provider_message_id TEXT,  -- ID from SendGrid/other provider
  related_entity_type TEXT,  -- e.g., 'invoice', 'draw', 'task', 'po', 'bid'
  related_entity_id UUID,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_sent_emails_builder_id ON v2_sent_emails(builder_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_status ON v2_sent_emails(status);
CREATE INDEX IF NOT EXISTS idx_sent_emails_created_at ON v2_sent_emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sent_emails_related_entity ON v2_sent_emails(related_entity_type, related_entity_id);
CREATE INDEX IF NOT EXISTS idx_sent_emails_template_id ON v2_sent_emails(template_id);

-- ============================================================
-- 3. Create email settings table (per-builder configuration)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_email_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID UNIQUE REFERENCES v2_builders(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'none' CHECK (provider IN ('none', 'sendgrid', 'smtp', 'ses')),
  from_name TEXT,
  from_email TEXT,
  reply_to_email TEXT,
  sendgrid_api_key_encrypted TEXT,  -- Encrypted API key if using SendGrid
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_user TEXT,
  smtp_password_encrypted TEXT,
  smtp_secure BOOLEAN DEFAULT true,
  signature_html TEXT,  -- Email signature to append
  footer_html TEXT,  -- Footer for all emails
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_settings_builder_id ON v2_email_settings(builder_id);

-- ============================================================
-- 4. Seed default email templates
-- ============================================================

-- Invoice notification template
INSERT INTO v2_email_templates (name, subject_template, body_template, template_type, variables, is_default)
VALUES (
  'Invoice Approved Notification',
  'Invoice {{invoice_number}} Approved - {{job_name}}',
  'Hello,

The following invoice has been approved and is ready for payment:

Invoice #: {{invoice_number}}
Vendor: {{vendor_name}}
Job: {{job_name}}
Amount: {{amount}}
Approved By: {{approved_by}}
Approved Date: {{approved_date}}

{{#if notes}}
Notes: {{notes}}
{{/if}}

Best regards,
{{company_name}}',
  'invoice_notification',
  '["invoice_number", "vendor_name", "job_name", "amount", "approved_by", "approved_date", "notes", "company_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Draw submitted template
INSERT INTO v2_email_templates (name, subject_template, body_template, template_type, variables, is_default)
VALUES (
  'Draw Submitted Notification',
  'Draw #{{draw_number}} Submitted - {{job_name}}',
  'Hello,

A draw has been submitted for your review:

Job: {{job_name}}
Draw #: {{draw_number}}
Period: {{period_start}} to {{period_end}}
Total Amount: {{total_amount}}
Number of Invoices: {{invoice_count}}

Please review and process at your earliest convenience.

{{#if notes}}
Notes: {{notes}}
{{/if}}

Best regards,
{{company_name}}',
  'draw_submitted',
  '["draw_number", "job_name", "period_start", "period_end", "total_amount", "invoice_count", "notes", "company_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Task assigned template
INSERT INTO v2_email_templates (name, subject_template, body_template, template_type, variables, is_default)
VALUES (
  'Task Assigned Notification',
  'Task Assigned: {{task_title}}',
  'Hello {{assignee_name}},

You have been assigned a new task:

Task: {{task_title}}
Job: {{job_name}}
Priority: {{priority}}
Due Date: {{due_date}}

{{#if description}}
Description:
{{description}}
{{/if}}

Please log in to view more details and update the task status.

Best regards,
{{company_name}}',
  'task_assigned',
  '["task_title", "assignee_name", "job_name", "priority", "due_date", "description", "company_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- PO approved template
INSERT INTO v2_email_templates (name, subject_template, body_template, template_type, variables, is_default)
VALUES (
  'Purchase Order Approved',
  'PO {{po_number}} Approved - {{job_name}}',
  'Hello {{vendor_name}},

Your purchase order has been approved:

PO #: {{po_number}}
Job: {{job_name}}
Total Amount: {{total_amount}}
Approved By: {{approved_by}}
Approved Date: {{approved_date}}

{{#if scope_of_work}}
Scope of Work:
{{scope_of_work}}
{{/if}}

Please proceed with the work as outlined.

Best regards,
{{company_name}}',
  'po_approved',
  '["po_number", "vendor_name", "job_name", "total_amount", "approved_by", "approved_date", "scope_of_work", "company_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- Bid request template
INSERT INTO v2_email_templates (name, subject_template, body_template, template_type, variables, is_default)
VALUES (
  'Bid Request',
  'Bid Request: {{bid_package_name}} - {{job_name}}',
  'Hello {{vendor_name}},

You are invited to submit a bid for the following project:

Project: {{job_name}}
Address: {{job_address}}
Bid Package: {{bid_package_name}}
Trade Category: {{trade_category}}

Due Date: {{due_date}}

{{#if scope_description}}
Scope Description:
{{scope_description}}
{{/if}}

Please submit your bid by the due date. Contact us if you have any questions.

Best regards,
{{company_name}}',
  'bid_request',
  '["bid_package_name", "vendor_name", "job_name", "job_address", "trade_category", "due_date", "scope_description", "company_name"]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. Grant permissions
-- ============================================================

-- RLS policies would be added here for multi-tenant security
-- For now, allowing authenticated access

COMMENT ON TABLE v2_email_templates IS 'Email templates for in-app email sending with merge field support';
COMMENT ON TABLE v2_sent_emails IS 'Audit log of all emails sent from the application';
COMMENT ON TABLE v2_email_settings IS 'Per-builder email provider configuration';
