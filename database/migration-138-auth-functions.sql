-- Migration 138: Authentication Helper Functions
-- Creates stored procedures for signup and invitation workflows

-- =====================================================
-- Function to create a new builder with owner user
-- Called during signup via API
-- =====================================================
CREATE OR REPLACE FUNCTION create_builder_with_owner(
  p_auth_user_id UUID,
  p_builder_name TEXT,
  p_email TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS TABLE (builder_id UUID, user_id UUID) AS $func$
DECLARE
  v_builder_id UUID;
  v_slug TEXT;
BEGIN
  -- Generate a unique slug from the builder name
  v_slug := lower(regexp_replace(p_builder_name, '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := trim(both '-' from v_slug);

  -- Make slug unique if needed
  IF EXISTS (SELECT 1 FROM v2_builders WHERE slug = v_slug) THEN
    v_slug := v_slug || '-' || substr(p_auth_user_id::text, 1, 8);
  END IF;

  -- Create the builder
  INSERT INTO v2_builders (name, slug, email, plan, plan_started_at, plan_expires_at)
  VALUES (
    p_builder_name,
    v_slug,
    p_email,
    'trial',
    NOW(),
    NOW() + INTERVAL '14 days'
  )
  RETURNING id INTO v_builder_id;

  -- Create the owner user
  INSERT INTO v2_users (id, builder_id, email, first_name, last_name, role)
  VALUES (p_auth_user_id, v_builder_id, p_email, p_first_name, p_last_name, 'owner');

  RETURN QUERY SELECT v_builder_id, p_auth_user_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Function to accept an invitation
-- =====================================================
CREATE OR REPLACE FUNCTION accept_invitation(
  p_auth_user_id UUID,
  p_token TEXT,
  p_first_name TEXT DEFAULT NULL,
  p_last_name TEXT DEFAULT NULL
)
RETURNS TABLE (success BOOLEAN, message TEXT, builder_id UUID) AS $func$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Find the invitation
  SELECT * INTO v_invitation
  FROM v2_user_invitations
  WHERE token = p_token
    AND accepted_at IS NULL
    AND expires_at > NOW();

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid or expired invitation'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Create the user
  INSERT INTO v2_users (id, builder_id, email, first_name, last_name, role)
  VALUES (p_auth_user_id, v_invitation.builder_id, v_invitation.email, p_first_name, p_last_name, v_invitation.role)
  ON CONFLICT (id) DO UPDATE SET
    builder_id = v_invitation.builder_id,
    role = v_invitation.role,
    updated_at = NOW();

  -- Mark invitation as accepted
  UPDATE v2_user_invitations
  SET accepted_at = NOW()
  WHERE id = v_invitation.id;

  RETURN QUERY SELECT true, 'Invitation accepted'::TEXT, v_invitation.builder_id;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- Updated_at trigger function (if not exists)
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $func$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Apply updated_at triggers
DROP TRIGGER IF EXISTS update_builders_updated_at ON v2_builders;
CREATE TRIGGER update_builders_updated_at
  BEFORE UPDATE ON v2_builders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_users_updated_at ON v2_users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON v2_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
