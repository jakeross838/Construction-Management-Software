-- Migration 064: Budget RPC Functions
-- Create atomic RPC functions for updating budget committed_amount
--
-- These functions support the PO approval/void workflow:
-- - increment_committed_amount: Called when PO is approved
-- - decrement_committed_amount: Called when PO is voided
--
-- The RPC approach ensures atomic updates and prevents race conditions
-- when multiple PO approvals happen simultaneously.

-- ============================================================
-- INCREMENT_COMMITTED_AMOUNT
-- ============================================================
-- Atomically increases committed_amount for a budget line.
-- Called by PO approval process for each line item.
-- Requires budget line to exist (must set up budget before committing).

CREATE OR REPLACE FUNCTION increment_committed_amount(
  p_job_id UUID,
  p_cost_code_id UUID,
  p_amount DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  v_result DECIMAL;
BEGIN
  UPDATE v2_budget_lines
  SET committed_amount = committed_amount + p_amount
  WHERE job_id = p_job_id AND cost_code_id = p_cost_code_id
  RETURNING committed_amount INTO v_result;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Budget line not found for job/cost_code - budget must exist before committing'
      USING HINT = 'Create a budget line for this job and cost code first';
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- DECREMENT_COMMITTED_AMOUNT
-- ============================================================
-- Atomically decreases committed_amount for a budget line.
-- Called by PO void process for each line item.
-- If budget line doesn't exist, silently returns 0 (void on non-existent is no-op).
-- Uses GREATEST(0, ...) to prevent negative committed_amount.

CREATE OR REPLACE FUNCTION decrement_committed_amount(
  p_job_id UUID,
  p_cost_code_id UUID,
  p_amount DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
  v_result DECIMAL;
BEGIN
  UPDATE v2_budget_lines
  SET committed_amount = GREATEST(0, committed_amount - p_amount)
  WHERE job_id = p_job_id AND cost_code_id = p_cost_code_id
  RETURNING committed_amount INTO v_result;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON FUNCTION increment_committed_amount(UUID, UUID, DECIMAL) IS
  'Atomically increment committed_amount for a budget line. Called on PO approval.';

COMMENT ON FUNCTION decrement_committed_amount(UUID, UUID, DECIMAL) IS
  'Atomically decrement committed_amount for a budget line. Called on PO void.';
