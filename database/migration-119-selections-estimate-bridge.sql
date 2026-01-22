-- Migration 119: Selections/Estimate Bridge & Client Approval
-- Bridges estimate allowance line items to the existing selections system
-- Adds client approval tracking fields to v2_selections
-- Creates conversion function for estimate-to-allowance workflow

-- ============================================================
-- BRIDGE: Add estimate_line_id to v2_allowances
-- ============================================================
-- This column tracks which estimate line created this allowance
-- Enables traceability from allowance back to original estimate

ALTER TABLE v2_allowances
  ADD COLUMN IF NOT EXISTS estimate_line_id UUID REFERENCES v2_estimate_lines(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_allowances_estimate_line ON v2_allowances(estimate_line_id);

COMMENT ON COLUMN v2_allowances.estimate_line_id IS
  'Reference to the estimate line that created this allowance (NULL if manually created)';

-- ============================================================
-- CLIENT APPROVAL: Add fields to v2_selections
-- ============================================================
-- Separate from admin approval (approved_at, approved_by)
-- Tracks client's explicit approval with audit trail

ALTER TABLE v2_selections
  ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_approved_by TEXT,
  ADD COLUMN IF NOT EXISTS client_approval_ip TEXT,
  ADD COLUMN IF NOT EXISTS client_approval_method TEXT CHECK (client_approval_method IN ('checkbox', 'signature', 'email')),
  ADD COLUMN IF NOT EXISTS client_approval_notes TEXT;

COMMENT ON COLUMN v2_selections.client_approved_at IS
  'Timestamp when client approved this selection';
COMMENT ON COLUMN v2_selections.client_approved_by IS
  'Name/email of client who approved';
COMMENT ON COLUMN v2_selections.client_approval_ip IS
  'IP address for audit trail';
COMMENT ON COLUMN v2_selections.client_approval_method IS
  'How client approved: checkbox (web UI), signature (e-sign), or email';
COMMENT ON COLUMN v2_selections.client_approval_notes IS
  'Any notes client provided during approval';

CREATE INDEX IF NOT EXISTS idx_selections_client_approved_at ON v2_selections(client_approved_at);

-- ============================================================
-- FUNCTION: convert_estimate_allowances
-- ============================================================
-- Called when an estimate is approved/converted to create allowances in the job
-- Converts estimate lines with is_allowance=true to v2_allowances entries
--
-- TEST SCENARIOS:
--
-- Scenario A: First-time conversion
--   - Create estimate with is_allowance=true lines
--   - Call convert_estimate_allowances(estimate_id)
--   - Expect: Allowances created with estimate_line_id set
--
-- Scenario B: Idempotent (double conversion)
--   - Call convert_estimate_allowances again on same estimate
--   - Expect: Returns 0, no duplicates created
--
-- Scenario C: Estimate without job_id
--   - Attempt conversion on orphan estimate
--   - Expect: Exception raised
--
-- Scenario D: No allowance lines
--   - Estimate has no is_allowance=true lines
--   - Expect: Returns 0
--
-- Scenario E: Category matching
--   - Allowance with cost code "Flooring"
--   - Expect: Matches v2_selection_categories "Flooring"
--
-- Scenario F: Fallback to Other category
--   - Allowance with unmatchable cost code
--   - Expect: Uses "Other" category

CREATE OR REPLACE FUNCTION convert_estimate_allowances(p_estimate_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_job_id UUID;
  v_line RECORD;
  v_created_count INTEGER := 0;
  v_category_id UUID;
BEGIN
  -- Get job_id from estimate
  SELECT job_id INTO v_job_id
  FROM v2_estimates
  WHERE id = p_estimate_id;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Estimate % has no job_id', p_estimate_id;
  END IF;

  -- Check if already converted (prevent duplicates)
  -- If any allowance already has an estimate_line_id from this estimate, skip
  IF EXISTS (
    SELECT 1 FROM v2_allowances
    WHERE estimate_line_id IN (
      SELECT id FROM v2_estimate_lines
      WHERE estimate_id = p_estimate_id AND is_allowance = true
    )
  ) THEN
    RAISE NOTICE 'Allowances already converted for estimate %', p_estimate_id;
    RETURN 0;
  END IF;

  -- Loop through allowance lines
  FOR v_line IN
    SELECT el.id, el.description, el.amount, el.allowance_notes,
           el.cost_code_id,
           cc.name as cost_code_name
    FROM v2_estimate_lines el
    LEFT JOIN v2_cost_codes cc ON el.cost_code_id = cc.id
    WHERE el.estimate_id = p_estimate_id
      AND el.is_allowance = true
  LOOP
    -- Find matching category based on cost code name or default to 'Other'
    -- First try exact match, then partial match
    SELECT id INTO v_category_id
    FROM v2_selection_categories
    WHERE name ILIKE '%' || COALESCE(v_line.cost_code_name, 'Other') || '%'
       OR name ILIKE '%' || split_part(COALESCE(v_line.cost_code_name, 'Other'), ' ', 1) || '%'
    ORDER BY
      CASE WHEN name ILIKE '%' || COALESCE(v_line.cost_code_name, '') || '%' THEN 0 ELSE 1 END
    LIMIT 1;

    -- Fallback to 'Other' category if no match found
    IF v_category_id IS NULL THEN
      SELECT id INTO v_category_id
      FROM v2_selection_categories
      WHERE name = 'Other'
      LIMIT 1;
    END IF;

    -- Create allowance entry
    INSERT INTO v2_allowances (
      job_id,
      category_id,
      estimate_line_id,
      name,
      description,
      budgeted_amount,
      allowance_type,
      notes,
      status
    ) VALUES (
      v_job_id,
      v_category_id,
      v_line.id,
      v_line.description,
      v_line.allowance_notes,
      v_line.amount,
      'material_only',
      'Created from estimate',
      'pending'
    );

    v_created_count := v_created_count + 1;
  END LOOP;

  RETURN v_created_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION convert_estimate_allowances(UUID) IS
  'Converts estimate allowance lines to job allowances when estimate is approved. Returns count of allowances created. Idempotent - safe to call multiple times.';

-- ============================================================
-- FUNCTION: get_allowance_variance_summary
-- ============================================================
-- Helper function to get aggregate variance data for a job
-- Useful for dashboard/summary views

CREATE OR REPLACE FUNCTION get_allowance_variance_summary(p_job_id UUID)
RETURNS TABLE (
  total_budgeted DECIMAL(14,2),
  total_selected DECIMAL(14,2),
  total_variance DECIMAL(14,2),
  over_budget_count INTEGER,
  under_budget_count INTEGER,
  on_budget_count INTEGER,
  pending_selection_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(a.budgeted_amount), 0)::DECIMAL(14,2) as total_budgeted,
    COALESCE(SUM(a.selected_amount), 0)::DECIMAL(14,2) as total_selected,
    COALESCE(SUM(a.variance), 0)::DECIMAL(14,2) as total_variance,
    COUNT(*) FILTER (WHERE a.variance > 0)::INTEGER as over_budget_count,
    COUNT(*) FILTER (WHERE a.variance < 0)::INTEGER as under_budget_count,
    COUNT(*) FILTER (WHERE a.variance = 0 AND a.selected_amount > 0)::INTEGER as on_budget_count,
    COUNT(*) FILTER (WHERE a.status = 'pending')::INTEGER as pending_selection_count
  FROM v2_allowances a
  WHERE a.job_id = p_job_id
    AND a.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_allowance_variance_summary(UUID) IS
  'Returns aggregate allowance variance data for a job: totals, counts by status, and variance breakdown.';
