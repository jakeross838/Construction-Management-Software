-- Migration 141: Client Portal
-- Homeowner/Client portal for viewing project progress

-- ============================================================
-- CLIENTS (Portal Users)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,

  -- Identity
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,

  -- Portal access
  portal_enabled BOOLEAN DEFAULT false,
  portal_token TEXT UNIQUE,  -- Magic link token
  portal_token_expires_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,

  -- Preferences
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,

  -- Metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(builder_id, email)
);

-- ============================================================
-- CLIENT INVITATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_client_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  client_id UUID REFERENCES v2_clients(id) ON DELETE CASCADE,

  -- Invitation details
  email TEXT NOT NULL,
  invite_token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  -- Status: pending, accepted, expired
  status TEXT DEFAULT 'pending',
  accepted_at TIMESTAMPTZ,

  -- Metadata
  invited_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENT MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_client_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  client_id UUID REFERENCES v2_clients(id) ON DELETE CASCADE,

  -- Message content
  subject TEXT,
  content TEXT NOT NULL,

  -- Direction: client_to_builder, builder_to_client
  direction TEXT NOT NULL,
  sender_name TEXT,

  -- Read status
  read_at TIMESTAMPTZ,

  -- Attachments (stored as JSON array of file URLs)
  attachments JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENT ACTIVITY LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_client_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES v2_clients(id) ON DELETE CASCADE,

  -- Activity details
  action TEXT NOT NULL,  -- login, view_photos, view_selections, send_message, etc.
  details JSONB,

  -- IP and device info
  ip_address TEXT,
  user_agent TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CLIENT PORTAL SETTINGS (per builder)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_client_portal_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID UNIQUE REFERENCES v2_builders(id) ON DELETE CASCADE,

  -- Features enabled
  show_budget BOOLEAN DEFAULT false,
  show_schedule BOOLEAN DEFAULT true,
  show_photos BOOLEAN DEFAULT true,
  show_documents BOOLEAN DEFAULT true,
  show_selections BOOLEAN DEFAULT true,
  show_change_orders BOOLEAN DEFAULT true,

  -- Branding
  welcome_message TEXT,
  custom_logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',

  -- Communication settings
  allow_messaging BOOLEAN DEFAULT true,
  auto_notify_photos BOOLEAN DEFAULT true,
  auto_notify_milestones BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_v2_clients_builder_id ON v2_clients(builder_id);
CREATE INDEX IF NOT EXISTS idx_v2_clients_job_id ON v2_clients(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_clients_email ON v2_clients(email);
CREATE INDEX IF NOT EXISTS idx_v2_clients_portal_token ON v2_clients(portal_token);
CREATE INDEX IF NOT EXISTS idx_v2_client_invitations_token ON v2_client_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_v2_client_invitations_status ON v2_client_invitations(status);
CREATE INDEX IF NOT EXISTS idx_v2_client_messages_job_id ON v2_client_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_client_messages_client_id ON v2_client_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_v2_client_activity_client_id ON v2_client_activity(client_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_client_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_client_updated_at ON v2_clients;
CREATE TRIGGER trigger_client_updated_at
  BEFORE UPDATE ON v2_clients
  FOR EACH ROW
  EXECUTE FUNCTION update_client_updated_at();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Generate magic link token
CREATE OR REPLACE FUNCTION generate_portal_token()
RETURNS TEXT AS $$
DECLARE
  token TEXT;
BEGIN
  -- Generate a secure random token
  SELECT encode(gen_random_bytes(32), 'hex') INTO token;
  RETURN token;
END;
$$ LANGUAGE plpgsql;

-- Validate and get client from portal token
CREATE OR REPLACE FUNCTION validate_portal_token(p_token TEXT)
RETURNS TABLE(client_id UUID, builder_id UUID, job_id UUID, email TEXT, name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id as client_id,
    c.builder_id,
    c.job_id,
    c.email,
    c.name
  FROM v2_clients c
  WHERE c.portal_token = p_token
    AND c.portal_enabled = true
    AND c.portal_token_expires_at > NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS POLICIES FOR CLIENT PORTAL
-- ============================================================

-- Enable RLS
ALTER TABLE v2_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_client_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_client_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_client_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_client_portal_settings ENABLE ROW LEVEL SECURITY;

-- Policies for clients (builders see their clients)
CREATE POLICY "Builders manage their clients" ON v2_clients
  FOR ALL USING (builder_id = get_current_builder_id());

CREATE POLICY "Builders manage invitations" ON v2_client_invitations
  FOR ALL USING (builder_id = get_current_builder_id());

CREATE POLICY "Builders see messages" ON v2_client_messages
  FOR ALL USING (builder_id = get_current_builder_id());

CREATE POLICY "Builders see client activity" ON v2_client_activity
  FOR SELECT USING (
    client_id IN (SELECT id FROM v2_clients WHERE builder_id = get_current_builder_id())
  );

CREATE POLICY "Builders manage portal settings" ON v2_client_portal_settings
  FOR ALL USING (builder_id = get_current_builder_id());
