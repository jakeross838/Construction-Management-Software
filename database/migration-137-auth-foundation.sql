-- Migration 137: Authentication Foundation for SaaS
-- Creates v2_builders (tenant organizations) and v2_users (authenticated users)

-- =====================================================
-- v2_builders: Tenant Organizations (Construction Companies)
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_builders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  license_number TEXT,
  plan TEXT DEFAULT 'basic' CHECK (plan IN ('basic', 'professional', 'enterprise', 'trial')),
  plan_started_at TIMESTAMPTZ,
  plan_expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  max_active_jobs INTEGER DEFAULT 3,
  max_users INTEGER DEFAULT 3,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_builders_slug ON v2_builders(slug) WHERE deleted_at IS NULL;

-- =====================================================
-- v2_users: Authenticated Users (linked to Supabase Auth)
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'accounting', 'pm', 'supervisor', 'office', 'field_crew')),
  employee_id UUID,
  notification_preferences JSONB DEFAULT '{"email": true, "push": true}'::jsonb,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_builder ON v2_users(builder_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email ON v2_users(email) WHERE deleted_at IS NULL;

-- =====================================================
-- v2_user_invitations: Pending User Invitations
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'accounting', 'pm', 'supervisor', 'office', 'field_crew')),
  invited_by UUID REFERENCES v2_users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_pending_invitation UNIQUE (builder_id, email)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON v2_user_invitations(token) WHERE accepted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invitations_email ON v2_user_invitations(email) WHERE accepted_at IS NULL;

-- =====================================================
-- v2_audit_log: Track important user actions
-- =====================================================
CREATE TABLE IF NOT EXISTS v2_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES v2_users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_builder ON v2_audit_log(builder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON v2_audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON v2_audit_log(entity_type, entity_id);
