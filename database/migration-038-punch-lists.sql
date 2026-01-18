-- Migration 038: Punch Lists System
-- Punch list tracking with PO retainage integration

-- Main punch list (per job/PO)
CREATE TABLE IF NOT EXISTS v2_punch_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES v2_jobs(id),
  po_id UUID REFERENCES v2_purchase_orders(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assigned_vendor_id UUID REFERENCES v2_vendors(id),
  due_date DATE,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Individual items
CREATE TABLE IF NOT EXISTS v2_punch_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_list_id UUID NOT NULL REFERENCES v2_punch_lists(id) ON DELETE CASCADE,
  item_number INTEGER,
  description TEXT NOT NULL,
  location TEXT,
  category TEXT, -- finish, structural, mechanical, electrical, plumbing, other
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'verified')),
  assigned_vendor_id UUID REFERENCES v2_vendors(id),
  schedule_task_id UUID REFERENCES v2_schedule_tasks(id),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  resolution_notes TEXT,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Photos (before/after)
CREATE TABLE IF NOT EXISTS v2_punch_list_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_list_id UUID REFERENCES v2_punch_lists(id) ON DELETE CASCADE,
  item_id UUID REFERENCES v2_punch_list_items(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT,
  category TEXT DEFAULT 'before' CHECK (category IN ('before', 'after', 'progress')),
  caption TEXT,
  uploaded_by TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity log
CREATE TABLE IF NOT EXISTS v2_punch_list_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_list_id UUID NOT NULL REFERENCES v2_punch_lists(id) ON DELETE CASCADE,
  item_id UUID REFERENCES v2_punch_list_items(id),
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add retainage to POs
ALTER TABLE v2_purchase_orders
  ADD COLUMN IF NOT EXISTS retainage_percent DECIMAL(5,2) DEFAULT 10.00,
  ADD COLUMN IF NOT EXISTS retainage_held DECIMAL(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retainage_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retainage_released_by TEXT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_punch_lists_job ON v2_punch_lists(job_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_punch_lists_po ON v2_punch_lists(po_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_punch_lists_status ON v2_punch_lists(status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_punch_items_list ON v2_punch_list_items(punch_list_id);
CREATE INDEX IF NOT EXISTS idx_punch_items_status ON v2_punch_list_items(status);
CREATE INDEX IF NOT EXISTS idx_punch_attachments_list ON v2_punch_list_attachments(punch_list_id);
CREATE INDEX IF NOT EXISTS idx_punch_attachments_item ON v2_punch_list_attachments(item_id);
CREATE INDEX IF NOT EXISTS idx_punch_activity_list ON v2_punch_list_activity(punch_list_id);
