-- ============================================================
-- MIGRATION 008: Draw Workflow Redesign
-- Auto-assignment of invoices to draws, immutable funded draws
-- ============================================================

-- 1. Add current_draft flag to draws (only one draft per job)
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS is_current_draft BOOLEAN DEFAULT false;

-- 2. Create draw-specific allocations table
-- This replaces the current model where allocations are cleared on partial billing
-- Allocations are now per-draw, allowing same invoice to be billed across multiple draws
CREATE TABLE IF NOT EXISTS v2_draw_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES v2_draws(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES v2_invoices(id) ON DELETE CASCADE,
  cost_code_id UUID NOT NULL REFERENCES v2_cost_codes(id),
  amount DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  UNIQUE(draw_id, invoice_id, cost_code_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_draw_allocations_draw ON v2_draw_allocations(draw_id);
CREATE INDEX IF NOT EXISTS idx_draw_allocations_invoice ON v2_draw_allocations(invoice_id);

-- 3. Draw attachments (for lien releases and supporting docs)
CREATE TABLE IF NOT EXISTS v2_draw_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES v2_draws(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  attachment_type TEXT NOT NULL DEFAULT 'other', -- lien_release, affidavit, insurance_cert, other
  vendor_id UUID REFERENCES v2_vendors(id), -- For vendor-specific docs like lien releases
  notes TEXT,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_draw_attachments_draw ON v2_draw_attachments(draw_id);

-- 4. Draw activity log (audit trail)
CREATE TABLE IF NOT EXISTS v2_draw_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES v2_draws(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- created, invoice_added, invoice_removed, submitted, unsubmitted, funded, attachment_added
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draw_activity_draw ON v2_draw_activity(draw_id);

-- 5. Add new columns to v2_draws for caching funded state and tracking
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS cached_g702_pdf_url TEXT;
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS cached_g703_pdf_url TEXT;
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS unsubmitted_at TIMESTAMPTZ;
ALTER TABLE v2_draws ADD COLUMN IF NOT EXISTS unsubmit_reason TEXT;

-- 6. Add invoice tracking for multi-draw billing
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS first_draw_id UUID REFERENCES v2_draws(id);
ALTER TABLE v2_invoices ADD COLUMN IF NOT EXISTS fully_billed_at TIMESTAMPTZ;

-- 7. Ensure only one draft draw per job
-- Drop if exists first to avoid errors on re-run
DROP INDEX IF EXISTS idx_one_draft_per_job;
CREATE UNIQUE INDEX idx_one_draft_per_job
  ON v2_draws(job_id)
  WHERE status = 'draft';

-- 8. Migrate existing invoice allocations to draw_allocations
-- For invoices that are already in draws, copy their allocations to the new table
INSERT INTO v2_draw_allocations (draw_id, invoice_id, cost_code_id, amount, notes, created_at, created_by)
SELECT
  di.draw_id,
  ia.invoice_id,
  ia.cost_code_id,
  ia.amount,
  ia.notes,
  COALESCE(ia.created_at, NOW()),
  'migration-008'
FROM v2_invoice_allocations ia
JOIN v2_draw_invoices di ON di.invoice_id = ia.invoice_id
WHERE ia.cost_code_id IS NOT NULL
ON CONFLICT (draw_id, invoice_id, cost_code_id) DO NOTHING;

-- 9. Create activity records for existing draws
INSERT INTO v2_draw_activity (draw_id, action, performed_by, details, created_at)
SELECT
  id,
  'created',
  'migration-008',
  jsonb_build_object('migrated', true, 'original_status', status),
  COALESCE(created_at, NOW())
FROM v2_draws
WHERE NOT EXISTS (
  SELECT 1 FROM v2_draw_activity da WHERE da.draw_id = v2_draws.id AND da.action = 'created'
);

-- Add submitted activity for submitted/funded draws
INSERT INTO v2_draw_activity (draw_id, action, performed_by, details, created_at)
SELECT
  id,
  'submitted',
  'migration-008',
  jsonb_build_object('migrated', true),
  COALESCE(submitted_at, created_at, NOW())
FROM v2_draws
WHERE status IN ('submitted', 'funded', 'partially_funded', 'overfunded')
AND NOT EXISTS (
  SELECT 1 FROM v2_draw_activity da WHERE da.draw_id = v2_draws.id AND da.action = 'submitted'
);

-- Add funded activity for funded draws
INSERT INTO v2_draw_activity (draw_id, action, performed_by, details, created_at)
SELECT
  id,
  'funded',
  'migration-008',
  jsonb_build_object('migrated', true, 'funded_amount', funded_amount),
  COALESCE(funded_at, NOW())
FROM v2_draws
WHERE status IN ('funded', 'partially_funded', 'overfunded')
AND funded_at IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM v2_draw_activity da WHERE da.draw_id = v2_draws.id AND da.action = 'funded'
);

-- 10. Set locked_at for submitted/funded draws
UPDATE v2_draws
SET locked_at = COALESCE(submitted_at, funded_at, NOW())
WHERE status IN ('submitted', 'funded', 'partially_funded', 'overfunded')
AND locked_at IS NULL;
