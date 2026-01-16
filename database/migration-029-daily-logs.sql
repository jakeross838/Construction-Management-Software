-- Migration 029: Daily Logs System
-- Full-featured site activity tracking with vendor and PO integration

-- ============================================================
-- Main Daily Logs Table
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_daily_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  
  -- Weather
  weather_conditions TEXT CHECK (weather_conditions IN ('sunny', 'partly_cloudy', 'cloudy', 'rainy', 'stormy', 'windy', 'snow')),
  temperature_high INTEGER,
  temperature_low INTEGER,
  weather_notes TEXT,
  
  -- Work summary
  work_completed TEXT,
  delays_issues TEXT,
  site_visitors TEXT,
  safety_notes TEXT,
  
  -- Status
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  
  -- Metadata
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  
  -- One log per job per day
  UNIQUE(job_id, log_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_daily_logs_job ON v2_daily_logs(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_logs_date ON v2_daily_logs(log_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_logs_status ON v2_daily_logs(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_daily_logs_job_date ON v2_daily_logs(job_id, log_date) WHERE deleted_at IS NULL;

-- ============================================================
-- Crew Entries (Workers on site)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_daily_log_crew (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES v2_daily_logs(id) ON DELETE CASCADE,
  
  -- Vendor link (optional but recommended)
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  
  -- Worker info
  worker_count INTEGER DEFAULT 1,
  hours_worked DECIMAL(5,2),
  trade TEXT,
  
  -- PO link for tracking work against PO
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE SET NULL,
  
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_log_crew_log ON v2_daily_log_crew(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_crew_vendor ON v2_daily_log_crew(vendor_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_crew_po ON v2_daily_log_crew(po_id);

-- ============================================================
-- Deliveries (Materials received)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_daily_log_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES v2_daily_logs(id) ON DELETE CASCADE,
  
  -- Vendor link
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  
  -- PO link for tracking materials against PO
  po_id UUID REFERENCES v2_purchase_orders(id) ON DELETE SET NULL,
  
  -- Delivery info
  description TEXT NOT NULL,
  quantity DECIMAL(10,2),
  unit TEXT,
  received_by TEXT,
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_log_deliveries_log ON v2_daily_log_deliveries(daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_deliveries_vendor ON v2_daily_log_deliveries(vendor_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_deliveries_po ON v2_daily_log_deliveries(po_id);

-- ============================================================
-- Attachments (Photos)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_daily_log_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES v2_daily_logs(id) ON DELETE CASCADE,
  
  file_url TEXT NOT NULL,
  file_name TEXT,
  file_type TEXT,
  caption TEXT,
  category TEXT DEFAULT 'progress' CHECK (category IN ('progress', 'delivery', 'safety', 'inspection', 'other')),
  
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_log_attachments_log ON v2_daily_log_attachments(daily_log_id);

-- ============================================================
-- Activity Log (Audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS v2_daily_log_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  daily_log_id UUID NOT NULL REFERENCES v2_daily_logs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_daily_log_activity_log ON v2_daily_log_activity(daily_log_id) WHERE deleted_at IS NULL;
