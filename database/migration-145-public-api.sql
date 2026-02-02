-- ============================================================
-- Public API Keys and Webhooks
-- Migration: 145
-- ============================================================

-- API Keys for external integrations
CREATE TABLE IF NOT EXISTS v2_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- User-friendly name
  key_prefix TEXT NOT NULL,  -- First 8 chars for display (e.g., "rba_8x7a...")
  key_hash TEXT NOT NULL,  -- SHA-256 hash of the full key
  scopes TEXT[] DEFAULT ARRAY['read'],  -- read, write, admin
  rate_limit INTEGER DEFAULT 1000,  -- Requests per hour
  last_used_at TIMESTAMPTZ,
  request_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES v2_users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE(key_prefix, builder_id)
);

-- API Request Log (for analytics and debugging)
CREATE TABLE IF NOT EXISTS v2_api_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  api_key_id UUID REFERENCES v2_api_keys(id) ON DELETE SET NULL,
  method TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  request_body JSONB,  -- Truncated for storage
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook subscriptions
CREATE TABLE IF NOT EXISTS v2_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  secret TEXT NOT NULL,  -- For signature verification
  events TEXT[] NOT NULL,  -- Events to subscribe to
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 3,
  timeout_seconds INTEGER DEFAULT 30,
  last_triggered_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS v2_webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES v2_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_id UUID NOT NULL,  -- ID of the related entity
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  attempt_number INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending, success, failed, retrying
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Available webhook events
CREATE TABLE IF NOT EXISTS v2_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  category TEXT,  -- invoice, job, vendor, etc.
  payload_example JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert available webhook events
INSERT INTO v2_webhook_events (name, description, category) VALUES
  ('invoice.created', 'An invoice was created', 'invoice'),
  ('invoice.updated', 'An invoice was updated', 'invoice'),
  ('invoice.approved', 'An invoice was approved', 'invoice'),
  ('invoice.paid', 'An invoice was marked as paid', 'invoice'),
  ('job.created', 'A job was created', 'job'),
  ('job.updated', 'A job was updated', 'job'),
  ('job.status_changed', 'A job status changed', 'job'),
  ('vendor.created', 'A vendor was created', 'vendor'),
  ('vendor.updated', 'A vendor was updated', 'vendor'),
  ('po.created', 'A purchase order was created', 'purchase_order'),
  ('po.approved', 'A purchase order was approved', 'purchase_order'),
  ('draw.created', 'A draw was created', 'draw'),
  ('draw.submitted', 'A draw was submitted', 'draw'),
  ('draw.funded', 'A draw was funded', 'draw'),
  ('client_message.received', 'A message from client was received', 'client_portal')
ON CONFLICT (name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_api_keys_builder ON v2_api_keys(builder_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON v2_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_requests_builder ON v2_api_requests(builder_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_created ON v2_api_requests(created_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_builder ON v2_webhooks(builder_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON v2_webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON v2_webhook_deliveries(status);

-- Enable RLS
ALTER TABLE v2_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_api_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "api_keys_builder_policy" ON v2_api_keys
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "api_requests_builder_policy" ON v2_api_requests
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "webhooks_builder_policy" ON v2_webhooks
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "webhook_deliveries_builder_policy" ON v2_webhook_deliveries
  FOR ALL USING (
    webhook_id IN (SELECT id FROM v2_webhooks WHERE builder_id = auth.uid()::uuid)
  );

-- Webhook events are public read
CREATE POLICY "webhook_events_public_read" ON v2_webhook_events
  FOR SELECT USING (true);

-- Function to validate API key
CREATE OR REPLACE FUNCTION validate_api_key(p_key TEXT)
RETURNS TABLE(builder_id UUID, api_key_id UUID, scopes TEXT[]) AS $$
DECLARE
  v_key_hash TEXT;
  v_result RECORD;
BEGIN
  -- Hash the provided key
  v_key_hash := encode(digest(p_key, 'sha256'), 'hex');

  -- Find matching key
  SELECT k.builder_id, k.id, k.scopes INTO v_result
  FROM v2_api_keys k
  WHERE k.key_hash = v_key_hash
    AND k.is_active = true
    AND (k.expires_at IS NULL OR k.expires_at > NOW())
    AND k.revoked_at IS NULL;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Update last used
  UPDATE v2_api_keys
  SET last_used_at = NOW(), request_count = request_count + 1
  WHERE id = v_result.id;

  RETURN QUERY SELECT v_result.builder_id, v_result.id, v_result.scopes;
END;
$$ LANGUAGE plpgsql;
