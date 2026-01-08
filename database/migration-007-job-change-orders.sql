-- Migration 007: Job-Level Change Orders
-- Adds change order tracking for client billing (separate from PO change orders)

-- ============================================================
-- JOB CHANGE ORDERS TABLE
-- Tracks change orders that are billed to clients
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_job_change_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  change_order_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  reason TEXT CHECK (reason IN ('scope_change', 'owner_request', 'unforeseen_conditions', 'design_change', 'other')),
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected')),
  internal_approved_at TIMESTAMPTZ,
  internal_approved_by TEXT,
  client_approved_at TIMESTAMPTZ,
  client_approved_by TEXT,
  client_approval_bypassed BOOLEAN DEFAULT false,
  bypass_reason TEXT,
  rejection_reason TEXT,
  billed_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, change_order_number)
);

-- Index for fast lookups by job
CREATE INDEX IF NOT EXISTS idx_job_change_orders_job_id ON v2_job_change_orders(job_id);

-- Index for status filtering
CREATE INDEX IF NOT EXISTS idx_job_change_orders_status ON v2_job_change_orders(status);

-- ============================================================
-- CO DRAW BILLINGS TABLE
-- Tracks how much of each CO is billed per draw
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_job_co_draw_billings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES v2_job_change_orders(id) ON DELETE CASCADE,
  draw_id UUID NOT NULL REFERENCES v2_draws(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(change_order_id, draw_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_co_draw_billings_co_id ON v2_job_co_draw_billings(change_order_id);

-- Index for draw lookups
CREATE INDEX IF NOT EXISTS idx_co_draw_billings_draw_id ON v2_job_co_draw_billings(draw_id);

-- ============================================================
-- CO ACTIVITY LOG (for audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_job_co_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  change_order_id UUID NOT NULL REFERENCES v2_job_change_orders(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for activity lookups
CREATE INDEX IF NOT EXISTS idx_co_activity_co_id ON v2_job_co_activity(change_order_id);
