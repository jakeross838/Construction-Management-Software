-- Migration 043: AI-Integrated Budget System
-- Adds bid line items, AI estimates, budget source tracking, and historical pricing

-- ============================================================
-- 1. BID LINE ITEMS (break down bids by cost code)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_bid_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bid_id UUID NOT NULL REFERENCES v2_bids(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  description TEXT,
  quantity DECIMAL(10,2) DEFAULT 1,
  unit TEXT,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  amount DECIMAL(14,2) DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add primary cost code and trade type to bids
ALTER TABLE v2_bids
  ADD COLUMN IF NOT EXISTS primary_cost_code_id UUID REFERENCES v2_cost_codes(id),
  ADD COLUMN IF NOT EXISTS trade_type TEXT;

-- Index for bid lines
CREATE INDEX IF NOT EXISTS idx_bid_lines_bid ON v2_bid_lines(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_lines_cost_code ON v2_bid_lines(cost_code_id);
CREATE INDEX IF NOT EXISTS idx_bids_primary_cost_code ON v2_bids(primary_cost_code_id) WHERE primary_cost_code_id IS NOT NULL;

-- ============================================================
-- 2. AI ESTIMATES (auto-generated preliminary estimates)
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_ai_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  total_amount DECIMAL(14,2) DEFAULT 0,
  job_sqft INTEGER,
  job_type TEXT,  -- new_construction, renovation, addition
  scope_description TEXT,
  confidence DECIMAL(3,2) DEFAULT 0.5,  -- 0.00 to 1.00
  similar_jobs_used INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'superseded')),
  generated_by TEXT DEFAULT 'System',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS v2_ai_estimate_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ai_estimate_id UUID NOT NULL REFERENCES v2_ai_estimates(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id),
  description TEXT,
  amount DECIMAL(14,2) DEFAULT 0,
  confidence DECIMAL(3,2) DEFAULT 0.5,  -- 0.00 to 1.00
  data_source TEXT,  -- historical_avg, similar_job, sqft_based, template
  reasoning TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for AI estimates
CREATE INDEX IF NOT EXISTS idx_ai_estimates_job ON v2_ai_estimates(job_id);
CREATE INDEX IF NOT EXISTS idx_ai_estimates_status ON v2_ai_estimates(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_ai_estimate_lines_estimate ON v2_ai_estimate_lines(ai_estimate_id);
CREATE INDEX IF NOT EXISTS idx_ai_estimate_lines_cost_code ON v2_ai_estimate_lines(cost_code_id);

-- ============================================================
-- 3. BUDGET SOURCE TRACKING
-- ============================================================

ALTER TABLE v2_budget_lines
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'manual' CHECK (source_type IN ('manual', 'accepted_bid', 'ai_estimate', 'estimate')),
  ADD COLUMN IF NOT EXISTS source_bid_id UUID REFERENCES v2_bids(id),
  ADD COLUMN IF NOT EXISTS source_ai_estimate_id UUID REFERENCES v2_ai_estimates(id),
  ADD COLUMN IF NOT EXISTS source_locked BOOLEAN DEFAULT FALSE;

-- Index for budget source tracking
CREATE INDEX IF NOT EXISTS idx_budget_lines_source_bid ON v2_budget_lines(source_bid_id) WHERE source_bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_lines_source_ai ON v2_budget_lines(source_ai_estimate_id) WHERE source_ai_estimate_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_lines_source_type ON v2_budget_lines(source_type);

-- ============================================================
-- 4. HISTORICAL PRICING CACHE
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_historical_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cost_code_id UUID UNIQUE NOT NULL REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  avg_amount DECIMAL(14,2) DEFAULT 0,
  min_amount DECIMAL(14,2) DEFAULT 0,
  max_amount DECIMAL(14,2) DEFAULT 0,
  sample_count INTEGER DEFAULT 0,
  avg_per_sqft DECIMAL(10,2) DEFAULT 0,
  last_refreshed TIMESTAMPTZ DEFAULT NOW()
);

-- Index for historical pricing
CREATE INDEX IF NOT EXISTS idx_historical_pricing_cost_code ON v2_historical_pricing(cost_code_id);

-- ============================================================
-- 5. COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE v2_bid_lines IS 'Line item breakdown for bids - maps bid amounts to cost codes';
COMMENT ON TABLE v2_ai_estimates IS 'AI-generated preliminary estimates for jobs';
COMMENT ON TABLE v2_ai_estimate_lines IS 'Line items for AI estimates with confidence and reasoning';
COMMENT ON TABLE v2_historical_pricing IS 'Cached historical pricing statistics by cost code';

COMMENT ON COLUMN v2_budget_lines.source_type IS 'Where budget line originated: manual, accepted_bid, ai_estimate, or estimate';
COMMENT ON COLUMN v2_budget_lines.source_locked IS 'If true, budget line will not auto-update when new bids are accepted';
COMMENT ON COLUMN v2_ai_estimate_lines.data_source IS 'How the estimate was derived: historical_avg, similar_job, sqft_based, template';
COMMENT ON COLUMN v2_ai_estimate_lines.confidence IS 'AI confidence level for this line (0.00 to 1.00)';
