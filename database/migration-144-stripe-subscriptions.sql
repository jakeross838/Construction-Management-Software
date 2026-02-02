-- ============================================================
-- Stripe Subscription and Pricing Tables
-- Migration: 144
-- ============================================================

-- Pricing Plans
CREATE TABLE IF NOT EXISTS v2_pricing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,  -- Basic, Professional, Enterprise
  slug TEXT UNIQUE NOT NULL,  -- basic, professional, enterprise
  description TEXT,
  stripe_price_id TEXT,  -- Stripe Price ID for monthly
  stripe_price_id_annual TEXT,  -- Stripe Price ID for annual
  monthly_price DECIMAL(10,2) NOT NULL,
  annual_price DECIMAL(10,2),  -- Usually discounted
  currency TEXT DEFAULT 'usd',

  -- Feature limits
  max_active_jobs INTEGER,  -- null = unlimited
  max_users INTEGER,
  max_storage_gb INTEGER,

  -- Feature flags
  client_portal BOOLEAN DEFAULT false,
  quickbooks_sync BOOLEAN DEFAULT false,
  xero_sync BOOLEAN DEFAULT false,
  api_access BOOLEAN DEFAULT false,
  white_label BOOLEAN DEFAULT false,
  custom_domain BOOLEAN DEFAULT false,
  priority_support BOOLEAN DEFAULT false,
  dedicated_support BOOLEAN DEFAULT false,

  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Builder subscriptions
CREATE TABLE IF NOT EXISTS v2_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES v2_pricing_plans(id),
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'trialing',  -- trialing, active, past_due, canceled, incomplete
  billing_interval TEXT DEFAULT 'month',  -- month, year
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  canceled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(builder_id)
);

-- Payment history
CREATE TABLE IF NOT EXISTS v2_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES v2_subscriptions(id),
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'usd',
  status TEXT NOT NULL,  -- succeeded, failed, pending, refunded
  description TEXT,
  invoice_url TEXT,
  invoice_pdf TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking (for metered features)
CREATE TABLE IF NOT EXISTS v2_usage_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,  -- active_jobs, users, storage_bytes, api_calls
  value INTEGER NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature access log
CREATE TABLE IF NOT EXISTS v2_feature_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID NOT NULL REFERENCES v2_builders(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  granted BOOLEAN NOT NULL,
  reason TEXT,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing plans
INSERT INTO v2_pricing_plans (name, slug, description, monthly_price, annual_price, max_active_jobs, max_users, max_storage_gb, client_portal, quickbooks_sync, xero_sync, api_access, white_label, custom_domain, priority_support, dedicated_support, display_order)
VALUES
  ('Basic', 'basic', 'Perfect for small builders just getting started', 99.00, 990.00, 3, 3, 10, false, false, false, false, false, false, false, false, 1),
  ('Professional', 'professional', 'For growing builders who need more power', 249.00, 2490.00, 15, 10, 50, true, true, true, false, false, false, true, false, 2),
  ('Enterprise', 'enterprise', 'Full-featured solution for large operations', 499.00, 4990.00, null, null, null, true, true, true, true, true, true, true, true, 3)
ON CONFLICT (slug) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_builder ON v2_subscriptions(builder_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON v2_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payments_builder ON v2_payments(builder_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_builder ON v2_usage_records(builder_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric ON v2_usage_records(metric, recorded_at);

-- Enable RLS
ALTER TABLE v2_pricing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE v2_feature_access_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Plans are readable by everyone
CREATE POLICY "pricing_plans_public_read" ON v2_pricing_plans
  FOR SELECT USING (true);

CREATE POLICY "subscriptions_builder_policy" ON v2_subscriptions
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "payments_builder_policy" ON v2_payments
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "usage_records_builder_policy" ON v2_usage_records
  FOR ALL USING (builder_id = auth.uid()::uuid);

CREATE POLICY "feature_access_log_builder_policy" ON v2_feature_access_log
  FOR ALL USING (builder_id = auth.uid()::uuid);

-- Function to check feature access
CREATE OR REPLACE FUNCTION check_feature_access(p_builder_id UUID, p_feature TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan v2_pricing_plans%ROWTYPE;
  v_granted BOOLEAN;
BEGIN
  -- Get builder's current plan
  SELECT p.* INTO v_plan
  FROM v2_subscriptions s
  JOIN v2_pricing_plans p ON p.id = s.plan_id
  WHERE s.builder_id = p_builder_id
    AND s.status IN ('active', 'trialing');

  -- No active subscription = no features
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check specific feature
  CASE p_feature
    WHEN 'client_portal' THEN v_granted := v_plan.client_portal;
    WHEN 'quickbooks_sync' THEN v_granted := v_plan.quickbooks_sync;
    WHEN 'xero_sync' THEN v_granted := v_plan.xero_sync;
    WHEN 'api_access' THEN v_granted := v_plan.api_access;
    WHEN 'white_label' THEN v_granted := v_plan.white_label;
    WHEN 'custom_domain' THEN v_granted := v_plan.custom_domain;
    WHEN 'priority_support' THEN v_granted := v_plan.priority_support;
    WHEN 'dedicated_support' THEN v_granted := v_plan.dedicated_support;
    ELSE v_granted := false;
  END CASE;

  -- Log the check
  INSERT INTO v2_feature_access_log (builder_id, feature, granted)
  VALUES (p_builder_id, p_feature, v_granted);

  RETURN v_granted;
END;
$$ LANGUAGE plpgsql;

-- Function to check usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(p_builder_id UUID, p_metric TEXT, p_current_value INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  v_plan v2_pricing_plans%ROWTYPE;
  v_limit INTEGER;
BEGIN
  -- Get builder's current plan
  SELECT p.* INTO v_plan
  FROM v2_subscriptions s
  JOIN v2_pricing_plans p ON p.id = s.plan_id
  WHERE s.builder_id = p_builder_id
    AND s.status IN ('active', 'trialing');

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get limit for metric
  CASE p_metric
    WHEN 'active_jobs' THEN v_limit := v_plan.max_active_jobs;
    WHEN 'users' THEN v_limit := v_plan.max_users;
    WHEN 'storage_gb' THEN v_limit := v_plan.max_storage_gb;
    ELSE v_limit := null;
  END CASE;

  -- null limit = unlimited
  IF v_limit IS NULL THEN
    RETURN true;
  END IF;

  RETURN p_current_value < v_limit;
END;
$$ LANGUAGE plpgsql;
