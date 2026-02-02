-- Migration 150: Team Invitations Table
-- For managing pending team member invitations

CREATE TABLE IF NOT EXISTS v2_team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  role_id UUID REFERENCES v2_roles(id),
  invited_by UUID REFERENCES v2_users(id),
  token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id, email)
);

CREATE INDEX IF NOT EXISTS idx_team_invitations_email ON v2_team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON v2_team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_builder ON v2_team_invitations(builder_id);
