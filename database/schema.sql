-- Ross Built CMS v2 Schema
-- Run this in Supabase SQL Editor

-- Jobs
CREATE TABLE IF NOT EXISTS v2_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  client_name TEXT,
  contract_amount DECIMAL(12,2),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors
CREATE TABLE IF NOT EXISTS v2_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost Codes
CREATE TABLE IF NOT EXISTS v2_cost_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Budget Lines (per job, per cost code)
CREATE TABLE IF NOT EXISTS v2_budget_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  budgeted_amount DECIMAL(12,2) DEFAULT 0,
  committed_amount DECIMAL(12,2) DEFAULT 0,
  billed_amount DECIMAL(12,2) DEFAULT 0,
  paid_amount DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, cost_code_id)
);

-- Invoices
CREATE TABLE IF NOT EXISTS v2_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  invoice_number TEXT,
  invoice_date DATE,
  due_date DATE,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending',  -- pending, pm_approved, in_draw, paid
  pdf_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by TEXT
);

-- Invoice Allocations (how invoice splits across cost codes)
CREATE TABLE IF NOT EXISTS v2_invoice_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES v2_invoices(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draws (pay applications to owner)
CREATE TABLE IF NOT EXISTS v2_draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES v2_jobs(id) ON DELETE CASCADE,
  draw_number INTEGER NOT NULL,
  period_end DATE,
  total_amount DECIMAL(12,2) DEFAULT 0,
  status TEXT DEFAULT 'draft',  -- draft, submitted, funded
  submitted_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  funded_amount DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id, draw_number)
);

-- Draw Line Items
CREATE TABLE IF NOT EXISTS v2_draw_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID REFERENCES v2_draws(id) ON DELETE CASCADE,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE CASCADE,
  this_period DECIMAL(12,2) DEFAULT 0,
  previous_total DECIMAL(12,2) DEFAULT 0,
  total_completed DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draw Invoices (which invoices are in each draw)
CREATE TABLE IF NOT EXISTS v2_draw_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID REFERENCES v2_draws(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES v2_invoices(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draw_id, invoice_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_v2_invoices_job_id ON v2_invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_invoices_status ON v2_invoices(status);
CREATE INDEX IF NOT EXISTS idx_v2_budget_lines_job_id ON v2_budget_lines(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_draws_job_id ON v2_draws(job_id);
CREATE INDEX IF NOT EXISTS idx_v2_invoice_allocations_invoice_id ON v2_invoice_allocations(invoice_id);
