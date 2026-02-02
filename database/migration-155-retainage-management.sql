-- Migration 155: Retainage Management
-- Adds retainage tracking per allocation and retainage release management

-- ============================================================
-- 1. Add retainage_percent to invoice allocations
-- ============================================================

ALTER TABLE v2_invoice_allocations
  ADD COLUMN IF NOT EXISTS retainage_percent DECIMAL(5,2) DEFAULT 10.00;

-- ============================================================
-- 2. Create retainage releases table
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_retainage_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id UUID REFERENCES v2_builders(id),
  job_id UUID NOT NULL REFERENCES v2_jobs(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES v2_vendors(id) ON DELETE SET NULL,
  cost_code_id UUID REFERENCES v2_cost_codes(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  release_date DATE,
  invoice_id UUID REFERENCES v2_invoices(id) ON DELETE SET NULL,  -- The vendor invoice for retainage release
  client_invoice_id UUID REFERENCES v2_client_invoices(id) ON DELETE SET NULL,  -- The client invoice for retainage billing
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient queries
CREATE INDEX IF NOT EXISTS idx_retainage_releases_job_id ON v2_retainage_releases(job_id);
CREATE INDEX IF NOT EXISTS idx_retainage_releases_vendor_id ON v2_retainage_releases(vendor_id);
CREATE INDEX IF NOT EXISTS idx_retainage_releases_cost_code_id ON v2_retainage_releases(cost_code_id);
CREATE INDEX IF NOT EXISTS idx_retainage_releases_builder_id ON v2_retainage_releases(builder_id);

-- ============================================================
-- 3. Create function to get job retainage summary
-- ============================================================

CREATE OR REPLACE FUNCTION get_job_retainage_summary(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_total_held DECIMAL(14,2);
  v_total_released DECIMAL(14,2);
  v_by_cost_code JSONB;
  v_by_vendor JSONB;
BEGIN
  -- Calculate total retainage held from invoice allocations
  -- Retainage = allocation amount * retainage_percent / 100
  SELECT COALESCE(SUM(
    ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100
  ), 0)
  INTO v_total_held
  FROM v2_invoice_allocations ia
  JOIN v2_invoices i ON ia.invoice_id = i.id
  WHERE i.job_id = p_job_id
    AND i.status IN ('approved', 'in_draw', 'paid')
    AND i.deleted_at IS NULL;

  -- Calculate total retainage released
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_released
  FROM v2_retainage_releases
  WHERE job_id = p_job_id;

  -- Get retainage breakdown by cost code
  SELECT COALESCE(jsonb_agg(cc_data), '[]'::jsonb)
  INTO v_by_cost_code
  FROM (
    SELECT
      cc.id AS cost_code_id,
      cc.code AS cost_code,
      cc.name AS cost_code_name,
      COALESCE(SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100), 0) AS retainage_held,
      COALESCE(released.total_released, 0) AS retainage_released,
      COALESCE(SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100), 0) - COALESCE(released.total_released, 0) AS balance
    FROM v2_invoice_allocations ia
    JOIN v2_invoices i ON ia.invoice_id = i.id
    JOIN v2_cost_codes cc ON ia.cost_code_id = cc.id
    LEFT JOIN (
      SELECT cost_code_id, SUM(amount) AS total_released
      FROM v2_retainage_releases
      WHERE job_id = p_job_id
      GROUP BY cost_code_id
    ) released ON released.cost_code_id = cc.id
    WHERE i.job_id = p_job_id
      AND i.status IN ('approved', 'in_draw', 'paid')
      AND i.deleted_at IS NULL
    GROUP BY cc.id, cc.code, cc.name, released.total_released
    HAVING COALESCE(SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100), 0) > 0
    ORDER BY cc.code
  ) cc_data;

  -- Get retainage breakdown by vendor
  SELECT COALESCE(jsonb_agg(vendor_data), '[]'::jsonb)
  INTO v_by_vendor
  FROM (
    SELECT
      v.id AS vendor_id,
      v.name AS vendor_name,
      COALESCE(SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100), 0) AS retainage_held,
      COALESCE(released.total_released, 0) AS retainage_released,
      COALESCE(SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100), 0) - COALESCE(released.total_released, 0) AS balance
    FROM v2_invoice_allocations ia
    JOIN v2_invoices i ON ia.invoice_id = i.id
    JOIN v2_vendors v ON i.vendor_id = v.id
    LEFT JOIN (
      SELECT vendor_id, SUM(amount) AS total_released
      FROM v2_retainage_releases
      WHERE job_id = p_job_id
      GROUP BY vendor_id
    ) released ON released.vendor_id = v.id
    WHERE i.job_id = p_job_id
      AND i.status IN ('approved', 'in_draw', 'paid')
      AND i.deleted_at IS NULL
    GROUP BY v.id, v.name, released.total_released
    HAVING COALESCE(SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100), 0) > 0
    ORDER BY v.name
  ) vendor_data;

  -- Build result
  v_result := jsonb_build_object(
    'job_id', p_job_id,
    'total_retainage_held', v_total_held,
    'total_retainage_released', v_total_released,
    'retainage_balance', v_total_held - v_total_released,
    'retainage_by_cost_code', v_by_cost_code,
    'retainage_by_vendor', v_by_vendor
  );

  RETURN v_result;
END;
$$;

-- ============================================================
-- 4. Create function to get detailed retainage by cost code and vendor
-- ============================================================

CREATE OR REPLACE FUNCTION get_job_retainage_details(p_job_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'job_id', p_job_id,
    'details', COALESCE(jsonb_agg(detail_row), '[]'::jsonb)
  )
  INTO v_result
  FROM (
    SELECT
      cc.id AS cost_code_id,
      cc.code AS cost_code,
      cc.name AS cost_code_name,
      v.id AS vendor_id,
      v.name AS vendor_name,
      SUM(ia.amount) AS total_invoiced,
      AVG(COALESCE(ia.retainage_percent, 10.00)) AS avg_retainage_percent,
      SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100) AS retainage_held,
      COALESCE(released.total_released, 0) AS retainage_released,
      SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100) - COALESCE(released.total_released, 0) AS balance,
      COUNT(DISTINCT i.id) AS invoice_count
    FROM v2_invoice_allocations ia
    JOIN v2_invoices i ON ia.invoice_id = i.id
    JOIN v2_cost_codes cc ON ia.cost_code_id = cc.id
    LEFT JOIN v2_vendors v ON i.vendor_id = v.id
    LEFT JOIN (
      SELECT cost_code_id, vendor_id, SUM(amount) AS total_released
      FROM v2_retainage_releases
      WHERE job_id = p_job_id
      GROUP BY cost_code_id, vendor_id
    ) released ON released.cost_code_id = cc.id
               AND (released.vendor_id = v.id OR (released.vendor_id IS NULL AND v.id IS NULL))
    WHERE i.job_id = p_job_id
      AND i.status IN ('approved', 'in_draw', 'paid')
      AND i.deleted_at IS NULL
    GROUP BY cc.id, cc.code, cc.name, v.id, v.name, released.total_released
    HAVING SUM(ia.amount * COALESCE(ia.retainage_percent, 10.00) / 100) > 0
    ORDER BY cc.code, v.name NULLS LAST
  ) detail_row;

  RETURN v_result;
END;
$$;

-- ============================================================
-- 5. Activity tracking for retainage releases
-- ============================================================

CREATE TABLE IF NOT EXISTS v2_retainage_release_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES v2_retainage_releases(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retainage_release_activity_release_id
  ON v2_retainage_release_activity(release_id);

-- ============================================================
-- 6. Grant permissions
-- ============================================================

GRANT EXECUTE ON FUNCTION get_job_retainage_summary(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_job_retainage_details(UUID) TO authenticated;
