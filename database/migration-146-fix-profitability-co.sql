-- Migration 146: Fix Profitability Change Order Reference
-- The calculate_job_profitability function incorrectly referenced v2_change_orders
-- It should use v2_job_change_orders which has job_id and amount columns

-- Fix the calculate_job_profitability function
CREATE OR REPLACE FUNCTION calculate_job_profitability(p_job_id UUID)
RETURNS TABLE (
  contract_amount DECIMAL(14,2),
  change_order_total DECIMAL(14,2),
  total_contract DECIMAL(14,2),
  billed_amount DECIMAL(14,2),
  total_direct DECIMAL(14,2),
  total_overhead DECIMAL(14,2),
  total_cost DECIMAL(14,2),
  gross_profit DECIMAL(14,2),
  gross_margin DECIMAL(6,4),
  net_profit DECIMAL(14,2),
  net_margin DECIMAL(6,4),
  percent_complete DECIMAL(5,2)
) AS $$
DECLARE
  v_contract DECIMAL(14,2);
  v_co_total DECIMAL(14,2) := 0;
  v_billed DECIMAL(14,2) := 0;
  v_direct DECIMAL(14,2) := 0;
  v_overhead DECIMAL(14,2) := 0;
  v_total_cost DECIMAL(14,2);
  v_gross DECIMAL(14,2);
  v_net DECIMAL(14,2);
BEGIN
  -- Get contract amount
  SELECT COALESCE(j.contract_amount, 0) INTO v_contract
  FROM v2_jobs j WHERE j.id = p_job_id;

  -- Get change order total from v2_job_change_orders (client-facing COs)
  -- Note: v2_change_orders are PO-level COs with po_id, not job_id
  SELECT COALESCE(SUM(co.amount), 0) INTO v_co_total
  FROM v2_job_change_orders co
  WHERE co.job_id = p_job_id
    AND co.status = 'approved';

  -- Get billed amount from draws
  SELECT COALESCE(SUM(d.total_amount), 0) INTO v_billed
  FROM v2_draws d
  WHERE d.job_id = p_job_id
    AND d.status IN ('submitted', 'funded');

  -- Get direct costs
  SELECT dc.total_direct INTO v_direct
  FROM get_job_direct_costs(p_job_id) dc;

  -- Get allocated overhead (handle case where table doesn't exist)
  BEGIN
    SELECT COALESCE(SUM(joa.allocated_overhead), 0) INTO v_overhead
    FROM v2_job_overhead_allocations joa
    WHERE joa.job_id = p_job_id AND joa.is_final = TRUE;
  EXCEPTION WHEN undefined_table THEN
    v_overhead := 0;
  END;

  -- Calculate totals
  v_total_cost := COALESCE(v_direct, 0) + v_overhead;
  v_gross := (v_contract + v_co_total) - COALESCE(v_direct, 0);
  v_net := (v_contract + v_co_total) - v_total_cost;

  RETURN QUERY SELECT
    v_contract,
    v_co_total,
    v_contract + v_co_total,
    v_billed,
    COALESCE(v_direct, 0),
    v_overhead,
    v_total_cost,
    v_gross,
    CASE WHEN (v_contract + v_co_total) > 0 THEN ROUND(v_gross / (v_contract + v_co_total), 4) ELSE 0 END,
    v_net,
    CASE WHEN (v_contract + v_co_total) > 0 THEN ROUND(v_net / (v_contract + v_co_total), 4) ELSE 0 END,
    CASE WHEN (v_contract + v_co_total) > 0 THEN ROUND((v_billed / (v_contract + v_co_total)) * 100, 2) ELSE 0 END;
END;
$$ LANGUAGE plpgsql;

-- Recreate the view to use the fixed function
CREATE OR REPLACE VIEW v2_job_profitability_current AS
SELECT
  j.id as job_id,
  j.name as job_name,
  j.status as job_status,
  p.*
FROM v2_jobs j
CROSS JOIN LATERAL calculate_job_profitability(j.id) p
WHERE j.status = 'active' AND j.deleted_at IS NULL;
